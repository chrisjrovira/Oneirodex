/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
document.addEventListener('DOMContentLoaded', function() {
    let deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    let currentDeleteId = null;

    document.querySelectorAll('.delete-whitelist').forEach(button => {
        button.addEventListener('click', function() {
            currentDeleteId = this.dataset.id;
            document.getElementById('emailToDelete').textContent = this.dataset.email;
            deleteModal.show();
        });
    });

    document.getElementById('confirmDelete').addEventListener('click', function() {
        if (currentDeleteId) {
            fetch(`/admin/whitelist/${currentDeleteId}`, {
                method: 'DELETE',
                headers: CSRFUtils.getHeaders({
                    'Content-Type': 'application/json'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Error deleting entry: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error deleting entry');
            });
            deleteModal.hide();
        }
    });
});
