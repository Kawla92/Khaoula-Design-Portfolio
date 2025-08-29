// contact.js
const { body, validationResult } = require('express-validator');

// Règles de validation pour le formulaire
const contactValidationRules = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Le nom doit contenir entre 2 et 50 caractères.')
        .matches(/^[a-zA-ZÀ-ÖØ-öø-ÿ\- ]+$/).withMessage('Caractères non autorisés dans le nom.'),

    body('email')
        .trim()
        .isEmail().withMessage('Adresse e-mail invalide.'),

    body('subject')
        .trim()
        .notEmpty().withMessage('Sujet obligatoire.'),

    body('message')
        .trim()
        .isLength({ min: 10, max: 1000 }).withMessage('Le message doit contenir entre 10 et 1000 caractères.')
];

// Middleware de gestion des erreurs
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

module.exports = {
    contactValidationRules,
    handleValidationErrors
};
