/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
document.addEventListener('DOMContentLoaded', function() {
    // Function to open a specific section
    function openSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            const content = section.querySelector('.collapsible-content');
            const icon = section.querySelector('.collapse-icon');
            content.style.display = 'block';
            icon.classList.remove('collapsed');
        }
    }

    // Handle hash changes
    function handleHashChange() {
        const hash = window.location.hash.slice(1); // Remove the # symbol
        if (hash) {
            openSection(hash);
        }
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    // Handle initial page load with hash
    if (window.location.hash) {
        handleHashChange();
    }

    // Add click handlers for all section headers
    document.querySelectorAll('.admin-section h2').forEach(header => {
        header.addEventListener('click', function() {
            const section = this.closest('.admin-section');
            const content = section.querySelector('.collapsible-content');
            const icon = this.querySelector('.collapse-icon');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.classList.remove('collapsed');
            } else {
                content.style.display = 'none';
                icon.classList.add('collapsed');
            }
        });
    });

    // Collapse all sections except Quick Start Guide by default
    document.querySelectorAll('.admin-section').forEach(section => {
        if (section.id !== 'quick-start') {
            const content = section.querySelector('.collapsible-content');
            content.style.display = 'none';
            section.querySelector('.collapse-icon').classList.add('collapsed');
        }
    });
});
