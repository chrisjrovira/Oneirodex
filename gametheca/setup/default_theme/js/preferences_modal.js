document.addEventListener('DOMContentLoaded', function() {
    function syncThemeSwatches(selected) {
        document.querySelectorAll('#themeSwatchGrid .theme-swatch').forEach(btn => {
            btn.classList.toggle('is-selected', btn.dataset.theme === selected);
        });
    }

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        syncThemeSwatches(themeSelect.value);
        themeSelect.addEventListener('change', function() {
            syncThemeSwatches(this.value);
        });
    }

    document.querySelectorAll('#themeSwatchGrid .theme-swatch').forEach(btn => {
        btn.addEventListener('click', function() {
            const value = this.dataset.theme;
            if (themeSelect) {
                themeSelect.value = value;
                themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            syncThemeSwatches(value);
        });
    });

    $(document).on('submit', '#preferencesForm', function(event) {
        event.preventDefault();
        
        const formData = new FormData(this);
        const csrfToken = CSRFUtils.getToken();
        
        fetch(this.action, {
            method: 'POST',
            body: formData,
            headers: CSRFUtils.getHeaders()
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('preferencesModal'));
                if (modal) {
                    modal.hide();
                }
                
                // Show success message
                $.notify(data.message, "success");
                
                // Reload page after short delay to apply new preferences
                setTimeout(() => window.location.reload(), 1000);
            } else {
                // Show error messages
                Object.values(data.errors || {}).forEach(error => {
                    $.notify(error[0], "error");
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            $.notify("An error occurred while saving preferences", "error");
        });
    });
});
