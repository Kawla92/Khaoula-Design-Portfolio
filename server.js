const express = require('express');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===================================
// MIDDLEWARES
// ===================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://maxcdn.bootstrapcdn.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://code.jquery.com", "https://cdn.jsdelivr.net", "https://maxcdn.bootstrapcdn.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
            connectSrc: ["'self'"]
        },
        reportOnly: true,
    }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ===================================
// CONFIGURATION SENDGRID API
// ===================================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Vérification de la configuration au démarrage
const verifyEmailConfig = () => {
    if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ SENDGRID_API_KEY manquante dans les variables d\'environnement');
        return false;
    }
    if (!process.env.SENDGRID_FROM_EMAIL) {
        console.error('❌ SENDGRID_FROM_EMAIL manquante dans les variables d\'environnement');
        return false;
    }
    console.log('✅ Configuration SendGrid vérifiée avec succès');
    return true;
};

// ===================================
// VALIDATIONS
// ===================================
const contactValidationRules = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .matches(/^[a-zA-ZÀ-ÖØ-öø-ÿ\-\s]{2,50}$/)
        .withMessage('Le nom doit contenir entre 2 et 50 caractères (lettres, espaces et tirets uniquement).'),

    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .isLength({ max: 100 })
        .withMessage('Veuillez entrer une adresse e-mail valide.'),

    body('subject')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Le sujet doit contenir entre 3 et 100 caractères.'),

    body('message')
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Le message doit contenir entre 10 et 1000 caractères.'),
];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Erreurs de validation',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg
            }))
        });
    }
    next();
};

// ===================================
// FONCTIONS UTILITAIRES
// ===================================
const sanitizeHtml = (text) => {
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\n/g, '<br>');
};

const sendEmailToAdmin = async (name, email, subject, message) => {
    const mailOptions = {
        to: process.env.SENDGRID_FROM_EMAIL, // Vous recevez sur votre email pro
        from: process.env.SENDGRID_FROM_EMAIL, // Email vérifié dans SendGrid
        replyTo: email,
        subject: `📩 Nouveau message de ${name} - ${subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                    Nouveau message via le formulaire de contact
                </h2>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>👤 Nom:</strong> ${sanitizeHtml(name)}</p>
                    <p><strong>📧 Email:</strong> <a href="mailto:${email}" style="color: #007bff;">${email}</a></p>
                    <p><strong>📝 Sujet:</strong> ${sanitizeHtml(subject)}</p>
                </div>
                <div style="background-color: #ffffff; padding: 20px; border-left: 4px solid #007bff;">
                    <h3 style="color: #333; margin-top: 0;">Message:</h3>
                    <p style="line-height: 1.6;">${sanitizeHtml(message)}</p>
                </div>
                <hr style="margin: 30px 0;">
                <p style="color: #666; font-size: 12px; text-align: center;">
                    Message reçu le ${new Date().toLocaleString('fr-FR')}
                </p>
            </div>
        `
    };

    return await sgMail.send(mailOptions);
};

const sendConfirmationToUser = async (name, email) => {
    const mailOptions = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: '✅ Merci pour votre message !',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">Merci ${sanitizeHtml(name)} !</h1>
                </div>
                <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <p style="font-size: 16px; line-height: 1.6; color: #333;">
                        Votre message a bien été reçu. Je vous remercie de m'avoir contactée.
                    </p>
                    <p style="font-size: 16px; line-height: 1.6; color: #333;">
                        Je vous répondrai dans les plus brefs délais. Au cours de<strong>24 heures</strong>.
                    </p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <p style="margin: 0; color: #155724;">
                            💡 <strong>Astuce:</strong> Vous pouvez répondre directement à cet email si vous souhaitez ajouter des informations.
                        </p>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <div style="text-align: center;">
                        <p style="color: #666; margin-bottom: 5px;">Cordialement,</p>
                        <p style="font-weight: bold; color: #333; margin: 0;">${process.env.SENDGRID_FROM_NAME || 'Khaoula Zaroui'}</p>
                        <p style="color: #666; font-style: italic; margin: 5px 0 0 0;">Graphic Designer</p>
                    </div>
                </div>
            </div>
        `
    };

    return await sgMail.send(mailOptions);
};

// ===================================
// ROUTES PRINCIPALES
// ===================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog.html'));
});

app.get('/conception', (req, res) => {
    res.sendFile(path.join(__dirname, 'conception.html'));
});

// Route de santé pour monitoring
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// ===================================
// ROUTE CONTACT PRINCIPALE
// ===================================
app.post('/api/contact', contactValidationRules, handleValidationErrors, async (req, res) => {
    const startTime = Date.now();
    
    // Protection anti-spam (honeypot)
    if (req.body.website && req.body.website.trim() !== '') {
        console.warn(`🚫 Tentative de spam détectée depuis ${req.ip}`);
        return res.status(400).json({
            success: false,
            message: 'Spam détecté.'
        });
    }

    const { name, email, subject, message } = req.body;

    // Limitation de fréquence basique (en production, utilisez Redis)
    const userKey = req.ip + email;
    const now = Date.now();
    const timeWindow = 60 * 1000; // 1 minute
    
    if (global.rateLimiter && global.rateLimiter[userKey]) {
        if (now - global.rateLimiter[userKey] < timeWindow) {
            return res.status(429).json({
                success: false,
                message: 'Veuillez patienter avant d\'envoyer un nouveau message.'
            });
        }
    }

    try {
        console.log(`📧 Nouveau message reçu de ${name} (${email}) - Sujet: ${subject}`);

        // Initialiser le rate limiter si nécessaire
        if (!global.rateLimiter) global.rateLimiter = {};

        // Envoi des emails en parallèle pour améliorer les performances
        const [adminResult, confirmationResult] = await Promise.all([
            sendEmailToAdmin(name, email, subject, message),
            sendConfirmationToUser(name, email)
        ]);

        // Mettre à jour le rate limiter
        global.rateLimiter[userKey] = now;

        const processingTime = Date.now() - startTime;
        console.log(`✅ Emails envoyés avec succès en ${processingTime}ms`);
        console.log(`   - Email admin: ${adminResult.messageId}`);
        console.log(`   - Confirmation: ${confirmationResult.messageId}`);

        res.status(200).json({
            success: true,
            message: 'Votre message a été envoyé avec succès ! Un email de confirmation vous a été adressé.',
            processingTime: `${processingTime}ms`
        });

    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi des emails:', error);
        
        // Log détaillé pour debug
        if (error.response) {
            console.error('Réponse SendGrid:', error.response.body);
        }

        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer dans quelques instants.'
        });
    }
});

// ===================================
// GESTION DES ERREURS
// ===================================

// Gestionnaire 404
app.use((req, res, next) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, '404.html'));
        return;
    }
    
    res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        path: req.path
    });
});

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
    console.error('❌ Erreur interne du serveur:', error);
    
    const isDev = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur.',
        ...(isDev && { error: error.message, stack: error.stack })
    });
});

// ===================================
// DÉMARRAGE DU SERVEUR
// ===================================
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log('═'.repeat(60));
    console.log(`✅ Serveur Portfolio Khaoula Zaroui démarré avec succès`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔗 URL locale: http://localhost:${PORT}`);
    console.log(`🛡️  Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log('═'.repeat(60));
    
    // Vérifier la configuration email
    verifyEmailConfig();
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ ERREUR: Le port ${PORT} est déjà utilisé.`);
        console.error('💡 Essayez un autre port ou fermez l\'application qui utilise ce port.');
        process.exit(1);
    } else {
        console.error('❌ Erreur critique du serveur:', err);
        process.exit(1);
    }
});

// Gestion propre de l'arrêt du serveur
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur en cours...');
    server.close(() => {
        console.log('✅ Serveur arrêté proprement.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Signal SIGTERM reçu, arrêt du serveur...');
    server.close(() => {
        console.log('✅ Serveur arrêté proprement.');
        process.exit(0);
    });
});

module.exports = app;
