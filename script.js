document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        MIN_NAME_LENGTH: 2,
        MAX_NAME_LENGTH: 50,
        MIN_MESSAGE_LENGTH: 10,
        MAX_MESSAGE_LENGTH: 1000,
        MAX_EMAIL_LENGTH: 100,
        HONEYPOT_DELAY: 3000, // Délai minimum avant soumission (3 secondes)
        SUBMISSION_TIMEOUT: 30000 // Timeout pour la soumission (30 secondes)
    };

    // Sélection des éléments
    const form = document.getElementById('myForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const subjectSelect = document.getElementById('subject');
    const messageTextarea = document.getElementById('message');
    const privacyCheckbox = document.getElementById('privacy');
    const submitBtn = document.getElementById('submit-btn');
    const formMessages = document.getElementById('form-messages');
    const messageCounter = document.getElementById('message-counter');
    
    // Variables de contrôle
    let formStartTime = Date.now();
    let isSubmitting = false;
    let validationErrors = {};

    // Messages d'erreur
    const ERROR_MESSAGES = {
        name: {
            required: 'Le nom est obligatoire',
            pattern: 'Le nom doit contenir entre 2 et 50 caractères (lettres, espaces, tirets et apostrophes uniquement)',
            minlength: 'Le nom doit contenir au moins 2 caractères',
            maxlength: 'Le nom ne peut pas dépasser 50 caractères'
        },
        email: {
            required: 'L\'email est obligatoire',
            pattern: 'Veuillez entrer un email valide (exemple: nom@domaine.com)',
            maxlength: 'L\'email ne peut pas dépasser 100 caractères'
        },
        subject: {
            required: 'Veuillez choisir un sujet'
        },
        message: {
            required: 'Le message est obligatoire',
            minlength: 'Le message doit contenir au moins 10 caractères',
            maxlength: 'Le message ne peut pas dépasser 1000 caractères'
        },
        privacy: {
            required: 'Vous devez accepter l\'utilisation de vos données'
        },
        honeypot: 'Erreur de validation du formulaire',
        network: 'Erreur de connexion. Veuillez réessayer.',
        timeout: 'La requête a pris trop de temps. Veuillez réessayer.',
        server: 'Erreur du serveur. Veuillez réessayer plus tard.',
        success: 'Votre message a été envoyé avec succès ! Nous vous recontacterons bientôt.'
    };

    // Expressions régulières
    const PATTERNS = {
        name: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s\-']{2,50}$/,
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    };

    // Vérifier si tous les éléments existent
    if (!form) {
        console.warn('Formulaire non trouvé');
        return;
    }

    // Fonctions utilitaires
    function showError(input, message) {
        const errorDiv = document.getElementById(input.id + '-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
        validationErrors[input.id] = message;
    }

    function clearError(input) {
        const errorDiv = document.getElementById(input.id + '-error');
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
        input.classList.remove('error');
        input.setAttribute('aria-invalid', 'false');
        delete validationErrors[input.id];
    }

    function showFormMessage(message, type = 'error') {
        if (!formMessages) return;
        
        formMessages.innerHTML = `
            <div class="alert alert-${type === 'success' ? 'success' : 'danger'}" role="alert">
                <i class="fa fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
                ${message}
            </div>
        `;
        formMessages.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                formMessages.innerHTML = '';
            }, 5000);
        }
    }

    function updateCharacterCounter() {
        if (!messageTextarea || !messageCounter) return;
        
        const currentLength = messageTextarea.value.length;
        messageCounter.textContent = `${currentLength}/${CONFIG.MAX_MESSAGE_LENGTH} caractères`;
        
        if (currentLength > CONFIG.MAX_MESSAGE_LENGTH * 0.9) {
            messageCounter.classList.add('warning');
        } else {
            messageCounter.classList.remove('warning');
        }
    }

    function setSubmitButtonState(loading = false) {
        if (!submitBtn) return;
        
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        if (loading) {
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'inline-block';
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-busy', 'true');
        } else {
            if (btnText) btnText.style.display = 'inline-block';
            if (btnLoading) btnLoading.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.setAttribute('aria-busy', 'false');
        }
    }

    // Validation des champs individuels
    function validateName() {
        if (!nameInput) return true;
        
        const value = nameInput.value.trim();
        
        if (!value) {
            showError(nameInput, ERROR_MESSAGES.name.required);
            return false;
        }
        
        if (value.length < CONFIG.MIN_NAME_LENGTH) {
            showError(nameInput, ERROR_MESSAGES.name.minlength);
            return false;
        }
        
        if (value.length > CONFIG.MAX_NAME_LENGTH) {
            showError(nameInput, ERROR_MESSAGES.name.maxlength);
            return false;
        }
        
        if (!PATTERNS.name.test(value)) {
            showError(nameInput, ERROR_MESSAGES.name.pattern);
            return false;
        }
        
        clearError(nameInput);
        return true;
    }

    function validateEmail() {
        if (!emailInput) return true;
        
        const value = emailInput.value.trim();
        
        if (!value) {
            showError(emailInput, ERROR_MESSAGES.email.required);
            return false;
        }
        
        if (value.length > CONFIG.MAX_EMAIL_LENGTH) {
            showError(emailInput, ERROR_MESSAGES.email.maxlength);
            return false;
        }
        
        if (!PATTERNS.email.test(value)) {
            showError(emailInput, ERROR_MESSAGES.email.pattern);
            return false;
        }
        
        clearError(emailInput);
        return true;
    }

    function validateSubject() {
        if (!subjectSelect) return true;
        
        if (!subjectSelect.value) {
            showError(subjectSelect, ERROR_MESSAGES.subject.required);
            return false;
        }
        
        clearError(subjectSelect);
        return true;
    }

    function validateMessage() {
        if (!messageTextarea) return true;
        
        const value = messageTextarea.value.trim();
        
        if (!value) {
            showError(messageTextarea, ERROR_MESSAGES.message.required);
            return false;
        }
        
        if (value.length < CONFIG.MIN_MESSAGE_LENGTH) {
            showError(messageTextarea, ERROR_MESSAGES.message.minlength);
            return false;
        }
        
        if (value.length > CONFIG.MAX_MESSAGE_LENGTH) {
            showError(messageTextarea, ERROR_MESSAGES.message.maxlength);
            return false;
        }
        
        clearError(messageTextarea);
        return true;
    }

    function validatePrivacy() {
        if (!privacyCheckbox) return true;
        
        if (!privacyCheckbox.checked) {
            showError(privacyCheckbox, ERROR_MESSAGES.privacy.required);
            return false;
        }
        
        clearError(privacyCheckbox);
        return true;
    }

    // Validation honeypot
    function validateHoneypot() {
        const honeypotFields = form.querySelectorAll('.honeypot-field input');
        
        // Vérifier que tous les champs honeypot sont vides
        for (let field of honeypotFields) {
            if (field.value.trim() !== '') {
                console.warn('Honeypot field filled:', field.name);
                return false;
            }
        }
        
        // Vérifier le délai minimum (protection contre les bots rapides)
        const timeSinceStart = Date.now() - formStartTime;
        if (timeSinceStart < CONFIG.HONEYPOT_DELAY) {
            console.warn('Form submitted too quickly:', timeSinceStart + 'ms');
            return false;
        }
        
        return true;
    }

    // Validation complète du formulaire
    function validateForm() {
        let isValid = true;
        
        // Effacer les messages précédents
        if (formMessages) formMessages.innerHTML = '';
        
        // Valider tous les champs
        if (!validateName()) isValid = false;
        if (!validateEmail()) isValid = false;
        if (!validateSubject()) isValid = false;
        if (!validateMessage()) isValid = false;
        if (!validatePrivacy()) isValid = false;
        
        return isValid;
    }

    // Gestionnaires d'événements pour la validation en temps réel
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            if (this.value.trim()) {
                validateName();
            } else {
                clearError(this);
            }
        });
        nameInput.addEventListener('blur', validateName);
    }

    if (emailInput) {
        emailInput.addEventListener('input', function() {
            if (this.value.trim()) {
                validateEmail();
            } else {
                clearError(this);
            }
        });
        emailInput.addEventListener('blur', validateEmail);
    }

    if (subjectSelect) {
        subjectSelect.addEventListener('change', validateSubject);
    }

    if (messageTextarea) {
        messageTextarea.addEventListener('input', function() {
            updateCharacterCounter();
            if (this.value.trim()) {
                validateMessage();
            } else {
                clearError(this);
            }
        });
        messageTextarea.addEventListener('blur', validateMessage);
    }

    if (privacyCheckbox) {
        privacyCheckbox.addEventListener('change', validatePrivacy);
    }

    // Initialiser le compteur de caractères
    updateCharacterCounter();

    // Gestionnaire de soumission du formulaire
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Empêcher les soumissions multiples
        if (isSubmitting) {
            return;
        }
        
        console.log('Tentative de soumission du formulaire');
        
        // Validation honeypot
        if (!validateHoneypot()) {
            showFormMessage(ERROR_MESSAGES.honeypot, 'error');
            return;
        }
        
        // Validation du formulaire
        if (!validateForm()) {
            const firstError = Object.keys(validationErrors)[0];
            if (firstError) {
                const firstErrorElement = document.getElementById(firstError);
                if (firstErrorElement) {
                    firstErrorElement.focus();
                    firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }
        
        // Marquer comme en cours de soumission
        isSubmitting = true;
        setSubmitButtonState(true);
        
        try {
            // Préparer les données du formulaire
            const formData = new FormData(form);
            
            // Supprimer les champs honeypot des données envoyées
            formData.delete('website');
            formData.delete('email_confirm');
            formData.delete('url_field');
            
            // Convertir FormData en objet JSON pour l'API
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            console.log('Envoi des données vers l\'API locale...');
            
            // Envoyer le formulaire avec timeout vers l'API locale
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.SUBMISSION_TIMEOUT);
            
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                console.log('Formulaire envoyé avec succès');
                showFormMessage(result.message || ERROR_MESSAGES.success, 'success');
                
                // Réinitialiser le formulaire
                form.reset();
                updateCharacterCounter();
                
                // Effacer toutes les erreurs
                [nameInput, emailInput, subjectSelect, messageTextarea, privacyCheckbox]
                    .filter(el => el)
                    .forEach(clearError);
                
                // Réinitialiser le temps de démarrage pour une nouvelle soumission
                formStartTime = Date.now();
                
            } else {
                console.error('Erreur de réponse:', response.status, response.statusText);
                
                let errorMessage = result.message || ERROR_MESSAGES.server;
                
                // Afficher les erreurs de validation spécifiques si disponibles
                if (result.errors && result.errors.length > 0) {
                    errorMessage += '<br><ul>';
                    result.errors.forEach(error => {
                        errorMessage += `<li>${error.message}</li>`;
                    });
                    errorMessage += '</ul>';
                }
                
                showFormMessage(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Erreur lors de l\'envoi:', error);
            
            let errorMessage = ERROR_MESSAGES.network;
            
            if (error.name === 'AbortError') {
                errorMessage = ERROR_MESSAGES.timeout;
            }
            
            showFormMessage(errorMessage, 'error');
            
        } finally {
            // Réinitialiser l'état de soumission
            isSubmitting = false;
            setSubmitButtonState(false);
        }
    });

   
