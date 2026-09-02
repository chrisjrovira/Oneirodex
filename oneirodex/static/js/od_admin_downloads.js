/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
// Initialize DataTables
$(document).ready(function() {
    $('#downloadsTable').DataTable({
        "order": [[0, "desc"]], // Sort by ID descending by default
        "pageLength": 25,
        "theme": "dark",
        "responsive": true,
        "language": {
            "search": "Search downloads:",
            "lengthMenu": "Show _MENU_ entries per page",
            "info": "Showing _START_ to _END_ of _TOTAL_ download requests"
        },
        "columnDefs": [
            { "orderable": false, "targets": 7 } // Disable sorting on Actions column
        ]
    });
});

let currentDeleteId = null;

function showDeleteModal(requestId) {
    currentDeleteId = requestId;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

function confirmDelete() {
    if (currentDeleteId) {
        // Make the AJAX call
        fetch(`/api/delete_download/${currentDeleteId}`, {
            method: 'DELETE',
            headers: CSRFUtils.getHeaders({
                'Content-Type': 'application/json'
            })
        })
        .then(response => response.json())
        .then(data => {
            // Hide the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'));
            modal.hide();
            
            // Show appropriate message
            if (data.status === 'success') {
                // Get DataTable instance and remove the row
                const table = $('#downloadsTable').DataTable();
                const row = table.row(`tr[data-download-id="${currentDeleteId}"]`);
                row.remove().draw(false);
                $.notify(data.message, "success");
            } else if (data.status === 'warning') {
                $.notify(data.message, "warn");
            } else {
                $.notify(data.message, "error");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            $.notify("An error occurred while deleting the download", "error");
        });
    }
}
