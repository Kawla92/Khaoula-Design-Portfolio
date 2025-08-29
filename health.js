// Module pour la route de santé du serveur
// Ce fichier peut être utilisé pour des vérifications de santé plus avancées

const os = require('os');

/**
 * Fonction pour obtenir les informations de santé du serveur
 * @returns {Object} Informations de santé du serveur
 */
function getHealthInfo() {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
        },
        memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
        },
        system: {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
            freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
            loadAverage: os.loadavg()
        },
        environment: process.env.NODE_ENV || 'development',
        mode: 'Développement',
        version: '1.0.0'
    };
}

/**
 * Formate le temps de fonctionnement en format lisible
 * @param {number} uptime Temps de fonctionnement en secondes
 * @returns {string} Temps formaté
 */
function formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    let formatted = '';
    if (days > 0) formatted += `${days}j `;
    if (hours > 0) formatted += `${hours}h `;
    if (minutes > 0) formatted += `${minutes}m `;
    formatted += `${seconds}s`;
    
    return formatted;
}

/**
 * Vérifie la santé des services externes (base de données, APIs, etc.)
 * @returns {Object} État des services externes
 */
async function checkExternalServices() {
    const services = {
        database: 'N/A', // Pas de base de données dans ce projet
        email: 'Unknown',
        filesystem: 'OK'
    };
    
    // Vérification du service email
    try {
        if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
            services.email = 'Configured';
        } else {
            services.email = 'Not configured';
        }
    } catch (error) {
        services.email = 'Error';
    }
    
    // Vérification du système de fichiers
    try {
        const fs = require('fs');
        await fs.promises.access(__dirname, fs.constants.R_OK | fs.constants.W_OK);
        services.filesystem = 'OK';
    } catch (error) {
        services.filesystem = 'Error';
    }
    
    return services;
}

/**
 * Gestionnaire de route pour la santé du serveur
 * @param {Object} req Objet de requête Express
 * @param {Object} res Objet de réponse Express
 */
async function healthHandler(req, res) {
    try {
        const healthInfo = getHealthInfo();
        const externalServices = await checkExternalServices();
        
        const response = {
            ...healthInfo,
            services: externalServices
        };
        
        res.json(response);
    } catch (error) {
        console.error('Erreur lors de la vérification de santé:', error);
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            message: 'Erreur lors de la vérification de santé',
            error: error.message
        });
    }
}

module.exports = {
    getHealthInfo,
    formatUptime,
    checkExternalServices,
    healthHandler
};

