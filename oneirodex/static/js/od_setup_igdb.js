/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
function testSettings() {
    const clientId = document.getElementById('igdb_client_id').value;
    const clientSecret = document.getElementById('igdb_client_secret').value;

    if (!clientId || !clientSecret) {
        $.notify("Please fill in both Client ID and Secret", "error");
        return;
    }

    const testButton = document.querySelector('button.btn-secondary');
    const originalText = testButton.textContent;
    testButton.disabled = true;
    testButton.textContent = 'Testing...';
    
    fetch('/admin/test_igdb', {
        method: 'POST',
        headers: CSRFUtils.getHeaders({
            'Content-Type': 'application/json'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            $.notify("IGDB API test successful", "success");
        } else {
            $.notify("IGDB API test failed: " + data.message, "error");
        }
    })
    .catch(error => {
        $.notify("Error testing IGDB API: " + error, "error");
    })
    .finally(() => {
        testButton.disabled = false;
        testButton.textContent = originalText;
    });
}
