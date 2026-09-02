document.addEventListener('DOMContentLoaded', function() {
    // Mirrors icons.html's 'eye' and 'eye-slash' glyphs — this is a static asset
    // so it can't call the Jinja macro, hence the SVG markup is duplicated here.
    const EYE_SVG = '<svg class="od-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_SLASH_SVG = '<svg class="od-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7c1.9 0 3.5.5 4.8 1.2M22 12s-1.3 2.6-3.8 4.4M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>';

    // Function to toggle password visibility
    function togglePasswordVisibility(inputId, iconEl) {
        const passwordInput = document.getElementById(inputId);

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            iconEl.innerHTML = EYE_SLASH_SVG;
        } else {
            passwordInput.type = 'password';
            iconEl.innerHTML = EYE_SVG;
        }
    }

    // Add event listeners for both password fields
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            const inputId = this.getAttribute('data-input');
            const iconEl = this.querySelector('.toggle-password-icon');
            togglePasswordVisibility(inputId, iconEl);
        });
    });

    // Validate passwords match
    const passwordForm = document.getElementById('password-form');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm_password');
    const submitButton = document.querySelector('input[type="submit"]');

    function validatePasswords() {
        if (password.value !== confirmPassword.value) {
            confirmPassword.setCustomValidity("Passwords do not match");
            return false;
        } else {
            confirmPassword.setCustomValidity('');
            return true;
        }
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', function(event) {
            if (!validatePasswords()) {
                event.preventDefault();
            }
        });

        confirmPassword.addEventListener('input', validatePasswords);
        password.addEventListener('input', validatePasswords);
    }
});
