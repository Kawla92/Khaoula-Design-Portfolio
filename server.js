const express = require('express');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares (Correctement placés en haut) ---
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));


// --- Configuration Nodemailer ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true pour le port 465, false pour les autres
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// --- Règles de Validation (inchangées) ---
const contactValidationRules = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .matches(/^[a-zA-ZÀ-ÖØ-öø-ÿ\- ]{2,50}$/)
        .withMessage('Le nom doit contenir entre 2 et 50 caractères.'),

    body('email')
        .trim().isEmail()
        .isLength({ max: 100 })
        .withMessage('Veuillez entrer une adresse e-mail valide.'),

    body('subject')
        .trim()
        .notEmpty()
        .withMessage('Veuillez choisir un sujet.'),

    body('message')
        .trim().isLength({ min: 10, max: 1000 })
        .withMessage('Le message doit contenir entre 10 et 1000 caractères.'),
];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Erreurs de validation',
            errors: errors.array().map(error => ({ field: error.path, message: error.msg }))
        });
    }
    next();
};


// --- Routes de l'application ---

// Route pour servir la page principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route pour servir la page blog
app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog.html'));
});

// Route pour vérifier la santé du serveur
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// =================================================================
// ## ROUTE /API/CONTACT CORRIGÉE ET FUSIONNÉE ##
// Une seule définition qui inclut la validation, le honeypot, l'email à l'admin et l'auto-reply.
// =================================================================
app.post('/api/contact', contactValidationRules, handleValidationErrors, async (req, res) => {
    // 1. Vérification du champ honeypot anti-spam
    if (req.body.website && req.body.website.trim() !== "") {
        return res.status(400).json({ success: false, message: "Spam détecté." });
    }

    const { name, subject, email, message } = req.body;

    try {
        console.log(`📧 Nouveau message reçu de ${name} (${email})`);

        // 2. Envoi du message à l'administrateur (vous)
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || `"${name}" <${email}>`, // Meilleur format pour le "De"
            to: process.env.EMAIL_USER,
            subject: `📩 Nouveau message de ${name} - ${subject}`,
            html: `
                <h3>Nouveau message via le formulaire de contact</h3>
                <p><strong>Nom:</strong> ${name}</p>
                <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                <p><strong>Sujet:</strong> ${subject}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `
        });

        // 3. Envoi de l'e-mail de confirmation (auto-reply) au visiteur
        await transporter.sendMail({
            from: `"Zaroui Khaoula" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "✅ Merci pour votre message !",
            html: `
                <p>Bonjour <b>${name}</b>,</p>
                <p>Merci de m'avoir contactée. Votre message a bien été reçu.</p>
                <p>Je vous répondrai dans les plus brefs délais.</p>
                <br>
                <p>Cordialement,</p>
                <p><b>Khaoula Zaroui</b></p>
                <p><i>Graphic Designer</i></p> 
            `
        });

        console.log("✅ Email à l'admin + auto-réponse envoyés avec succès.");

        res.status(200).json({
            success: true,
            message: 'Votre message a été envoyé. Un email de confirmation vous a été adressé.'
        });

    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'email:", error);
        res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de l'envoi du message. Veuillez réessayer."
        });
    }
});


// --- Gestion des Erreurs (Correctement placées à la fin) ---

// =================================================================
// ## GESTIONNAIRE 404 CORRIGÉ ET UNIQUE ##
// Ce gestionnaire est placé après toutes les routes valides.
// Il renvoie le fichier 404.html pour les navigateurs et du JSON pour les API.
// =================================================================
app.use((req, res, next) => {
    // Si la requête accepte du HTML (comme un navigateur)
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, '404.html'));
        return;
    }
    // Pour les autres types de requêtes (ex: API)
    res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// Gestionnaire d'erreurs global (pour les erreurs 500)
app.use((error, req, res, next) => {
    console.error('❌ Erreur Interne du Serveur:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
});


// --- Démarrage du Serveur ---
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('─'.repeat(50));
    console.log(`✅ Serveur de Zaroui Khaoula démarré avec succès sur le port ${PORT}`);
    console.log(`🌐 Accédez au site via: http://localhost:${PORT}`);
    console.log('─'.repeat(50));
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ ERREUR: Le port ${PORT} est déjà utilisé.`);
        process.exit(1);
    } else {
        console.error('❌ Erreur critique du serveur:', err);
    }
});

module.exports = app;
