/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
    document.getElementById("selectAll").addEventListener("click", function(e) {
    var userCheckboxes = document.getElementsByClassName("userCheckbox");
    for(var i = 0; i < userCheckboxes.length; i++) {
        userCheckboxes[i].checked = e.target.checked;
    }
    updateRecipients();
});

function updateRecipients() {
    var recipients = [];
    var checkboxes = document.querySelectorAll('input[name="user"]:checked');

    for (var i = 0; i < checkboxes.length; i++) {
        recipients.push(checkboxes[i].value);
    }

    document.querySelector('input[name="recipients"]').value = recipients.join(',');

    console.log('Recipients: ' + document.querySelector('input[name="recipients"]').value);
}

updateRecipients();
