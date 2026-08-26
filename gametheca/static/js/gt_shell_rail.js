/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
    document.addEventListener("DOMContentLoaded", function() {
        console.log("Document loaded.");

        // Existing function to close all submenus
        function closeAllSubmenus() {
            document.querySelectorAll('.submenu').forEach(submenu => {
                submenu.style.display = 'none';
            });
            document.querySelectorAll('.has-submenu').forEach(item => {
                item.classList.remove('open');
            });
        }
    
        closeAllSubmenus();
    
        // Toggle sidebar
        // Rail toggle (GT-B2). Replaces the #sidebar/#content .collapsed pair:
        // the shell grid reads data-rail, and the same attribute drives the
        // mobile drawer, so one control covers both like the React shells.
        const railToggle = document.getElementById("gt-rail-toggle");
        const shell = document.getElementById("gt-shell");
        if (railToggle && shell) {
            const RAIL_KEY = "gt-rail-state";
            const mobile = () => window.matchMedia("(max-width: 900px)").matches;

            // Match the React hook's persisted preference so collapsing on a
            // Jinja page and collapsing in the SPA are the same setting.
            try {
                if (localStorage.getItem(RAIL_KEY) === "collapsed" && !mobile()) {
                    shell.dataset.rail = "collapsed";
                    railToggle.setAttribute("aria-expanded", "false");
                }
            } catch (e) { /* storage disabled — rail just will not remember */ }

            railToggle.addEventListener("click", function() {
                if (mobile()) {
                    const open = shell.dataset.rail === "open";
                    shell.dataset.rail = open ? "expanded" : "open";
                    railToggle.setAttribute("aria-expanded", String(!open));
                    return;
                }
                const collapsed = shell.dataset.rail === "collapsed";
                shell.dataset.rail = collapsed ? "expanded" : "collapsed";
                railToggle.setAttribute("aria-expanded", String(collapsed));
                try {
                    localStorage.setItem(RAIL_KEY, collapsed ? "expanded" : "collapsed");
                } catch (e) { /* not fatal */ }
                closeAllSubmenus();
            });
        }
    
        // The account menu used to be #userAccountIcon / #userAccountMenu here,
        // toggled by hand and rotated via .user-expand-icon. GT-B2 retired that
        // markup with the sidebar: partials/rail.html renders the menu as a
        // <details>, so open/close and click-outside are the browser's job and
        // there is nothing left for this file to wire up.

        // Handling click events on sidebar links with submenu
        document.querySelectorAll('.sidebar-link.has-submenu').forEach(item => {
            item.addEventListener('click', function(e) {
                console.log("Submenu item clicked.");
                closeAllSubmenus();
                
                e.preventDefault();
    
                let nextElement = this.nextElementSibling;
                if (nextElement && nextElement.classList.contains('submenu')) {
                    this.classList.toggle('open');
                    nextElement.style.display = nextElement.style.display === 'block' ? 'none' : 'block';
                }
    
                e.stopPropagation();
            });
        });
    });
    
    // Additional checks for visibility of elements based on URL
    if (window.location.pathname !== '/library') {
        console.log("Not on '/library' page, adjusting visibility.");
        const filterContainer = document.querySelector('.container-filtersandsort');
        if (filterContainer) {
            filterContainer.style.visibility = 'hidden';
        }
    }
