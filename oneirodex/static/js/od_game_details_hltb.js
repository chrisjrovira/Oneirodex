/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
// Function to refresh HLTB data for a game
async function refreshHLTB(gameUuid) {
    try {
        const button = event.target.closest('button');
        const icon = button.querySelector('i, .od-spinner, svg');

        // Show loading state
        if (icon) {
            icon.replaceWith(Object.assign(document.createElement('span'), {
                className: 'od-spinner od-spinner--sm',
                setAttribute: undefined,
            }));
        } else {
            button.insertAdjacentHTML('afterbegin', '<span class="od-spinner od-spinner--sm" aria-hidden="true"></span>');
        }
        button.disabled = true;

        const response = await fetch(`/admin2/api/hltb/refresh/${gameUuid}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRFUtils.getToken()
            }
        });

        const result = await response.json();

        if (result.success) {
            Notify.create({
                title: 'Success',
                text: result.message,
                status: 'success'
            });
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            Notify.create({
                title: 'Error',
                text: result.error || 'Failed to refresh HLTB data',
                status: 'error'
            });
            button.disabled = false;
            window.location.reload();
        }
    } catch (error) {
        console.error('Error refreshing HLTB data:', error);
        Notify.create({
            title: 'Error',
            text: 'An error occurred while refreshing HLTB data',
            status: 'error'
        });
        const button = event.target.closest('button');
        button.disabled = false;
    }
}
