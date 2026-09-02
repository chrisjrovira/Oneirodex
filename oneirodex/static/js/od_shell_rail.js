/* Rail collapse / mobile drawer. Lives under static/js, not a theme copy —
 * no Reset Themes. Submenu / account-menu / library-filter hacks that used
 * to live here matched nothing the templates render (GT-B2). */
document.addEventListener('DOMContentLoaded', function() {
    const railToggle = document.getElementById('od-rail-toggle');
    const shell = document.getElementById('od-shell');
    if (!railToggle || !shell) return;

    const RAIL_KEY = 'od-rail-state';
    const mobile = () => window.matchMedia('(max-width: 900px)').matches;

    try {
        if (localStorage.getItem(RAIL_KEY) === 'collapsed' && !mobile()) {
            shell.dataset.rail = 'collapsed';
            railToggle.setAttribute('aria-expanded', 'false');
        }
    } catch (e) { /* storage disabled — rail just will not remember */ }

    railToggle.addEventListener('click', function() {
        if (mobile()) {
            const open = shell.dataset.rail === 'open';
            shell.dataset.rail = open ? 'expanded' : 'open';
            railToggle.setAttribute('aria-expanded', String(!open));
            return;
        }
        const collapsed = shell.dataset.rail === 'collapsed';
        shell.dataset.rail = collapsed ? 'expanded' : 'collapsed';
        railToggle.setAttribute('aria-expanded', String(collapsed));
        try {
            localStorage.setItem(RAIL_KEY, collapsed ? 'expanded' : 'collapsed');
        } catch (e) { /* not fatal */ }
    });
});
