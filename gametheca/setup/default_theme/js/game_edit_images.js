// Prevent default drag behaviors
function preventDefaults (e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone when item is dragged over it
function highlight(e) {
    document.getElementById('upload-area').classList.add('highlight');
}

// Unhighlight drop zone when item is dragged away
function unhighlight(e) {
    document.getElementById('upload-area').classList.remove('highlight');
}

function uploadFile(file, gameUuid, csrfToken, imageType = 'screenshot') {
    console.log('Uploading file:', file.name);
    let url = `/upload_image/${gameUuid}`;
    let formData = new FormData();
    formData.append('file', file);
    
    // Show spinner if this is a cover image upload
    if (imageType === 'cover') {
        document.getElementById('coverSpinner').style.display = 'block';
    }
    formData.append('image_type', imageType);

    console.log('Form data:', formData, url);
    fetch(url, {
        method: 'POST',
        body: formData,
        headers: CSRFUtils.getHeaders(),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Upload failed');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Upload response:', data);
        if (data.url) {
            if (imageType === 'cover') {
                displayCoverImage(data);
                document.getElementById('coverSpinner').style.display = 'none';
            } else {
                displayImage(data);
            }
            if (data.flash) {
                // Create and display flash message
                let flashContainer = document.querySelector('.flashes');
                if (!flashContainer) {
                    // Create the main flash container if it doesn't exist
                    const mainContainer = document.createElement('div');
                    mainContainer.className = 'content-flash';
                    document.querySelector('.glass-panel').prepend(mainContainer);
                    
                    // Create the flashes container
                    flashContainer = document.createElement('div');
                    flashContainer.className = 'flashes';
                    mainContainer.appendChild(flashContainer);
                }
                
                const flashMessage = document.createElement('div');
                flashMessage.className = 'flash';
                flashMessage.textContent = data.flash;
                flashContainer.appendChild(flashMessage);

                // Remove the flash message after 3 seconds
                setTimeout(() => {
                    flashMessage.remove();
                    if (document.querySelector('.flashes').children.length === 0) {
                        document.querySelector('.flashes').remove();
                    }
                }, 3000);
                
                console.log('Success:', data.flash);
            }
        } else {
            throw new Error('Upload succeeded but no URL was returned.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Hide spinner if this was a cover image upload
        if (imageType === 'cover') {
            document.getElementById('coverSpinner').style.display = 'none';
        }
        var errorModalMessage = document.getElementById('errorModalMessage');
        errorModalMessage.textContent = error.message;
        
        var errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        errorModal.show();
    });
}

function displayImage(data) {
    let imageList = document.getElementById('image-editor-list');
    let newImgDiv = document.createElement('div');

    newImgDiv.id = `image-${data.image_id}`;
    newImgDiv.className = 'image-editor-image'; // Add this line to set the class

    newImgDiv.innerHTML = `<button class="btn btn-danger" onclick="deleteImage(${data.image_id})">Delete</button><img src="${data.url}" alt="Image" class="image-editor-image" style="max-width: 300px; max-height: 300px;">`;
    imageList.appendChild(newImgDiv);
}

function displayCoverImage(data) {
    let coverImageEditor = document.getElementById('cover-image-editor');

    let existingImg = coverImageEditor.querySelector('img');
    if (existingImg) {
        existingImg.remove();
    }

    let img = document.createElement('img');
    img.src = data.url;
    img.alt = "Cover Image";
    img.style.maxWidth = "300px";
    img.style.maxHeight = "300px";

    coverImageEditor.insertBefore(img, coverImageEditor.firstChild);
}

function deleteImage(imageId) {
    console.log('Deleting image with ID:', imageId);
    var csrfToken = CSRFUtils.getToken();
    
    // Check if this is a cover image
    const coverImageEditor = document.getElementById('cover-image-editor');
    const isCoverImage = coverImageEditor.querySelector(`img[data-image-id="${imageId}"]`) !== null;

    // If it's a cover image, show confirmation dialog
    if (isCoverImage) {
        if (!confirm('Are you sure you want to delete the cover image?')) {
            return;
        }
    }

    fetch('/delete_image', {
        method: 'POST',
        headers: CSRFUtils.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ 
            image_id: imageId,
            is_cover: isCoverImage 
        }),
    })
    .then(response => {
        console.log('Network response:', response);
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Deletion failed');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Delete response:', data);
        if (data.default_cover) {
            // This was a cover image, replace with default
            const coverImageEditor = document.getElementById('cover-image-editor');
            const img = coverImageEditor.querySelector('img');
            if (img) {
                img.src = data.default_cover;
                img.removeAttribute('data-image-id');
            }
        } else {
            // Regular screenshot, just remove it
            document.getElementById(`image-${imageId}`).remove();
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        var errorModalMessage = document.getElementById('errorModalMessage');
        errorModalMessage.textContent = error.message;
        
        var errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        errorModal.show();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    
    var gameUuid = document.getElementById('upload-area').getAttribute('data-game-uuid');
    let selectedFiles = [];
    const uploadArea = document.getElementById('upload-area');

    document.getElementById('cover-image-input').addEventListener('change', function(e) {
        let file = e.target.files[0];
        let csrfToken = CSRFUtils.getToken();

        if (file) {
            uploadFile(file, gameUuid, csrfToken, 'cover');
        }
    });

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    uploadArea.addEventListener('drop', handleDrop, false);
    document.getElementById('file-input').addEventListener('change', function(e) {
        console.log('Files selected');
        selectedFiles = e.target.files;
    });


    document.getElementById('upload-button').addEventListener('click', function() {
        let gameUuid = document.getElementById('upload-area').getAttribute('data-game-uuid');
        let csrfToken = CSRFUtils.getToken();
        console.log('Uploading files:', selectedFiles);
        for (let i = 0; i < selectedFiles.length; i++) {
            uploadFile(selectedFiles[i], gameUuid, csrfToken);
        }
    });

    function handleDrop(e) {
        console.log('Drop event triggered');
        e.preventDefault();
        e.stopPropagation();
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        console.log('Handling files');
        let csrfToken = CSRFUtils.getToken();
        for (let i = 0; i < files.length; i++) {
            uploadFile(files[i], gameUuid, csrfToken, 'screenshot');
        }
    }

    // SteamGridDB / IGDB artwork picker (admin artwork only)
    const sgdbRoot = document.getElementById('sgdb-cover-picker');
    const sgdbQuery = document.getElementById('sgdb-query');
    const sgdbSearchBtn = document.getElementById('sgdb-search-btn');
    const sgdbResults = document.getElementById('sgdb-results');
    const sgdbStatus = document.getElementById('sgdb-status');
    const sgdbImageType = document.getElementById('sgdb-image-type');
    const sgdbProvider = document.getElementById('sgdb-provider');

    function selectedImageType() {
        const value = (sgdbImageType?.value || 'cover').trim().toLowerCase();
        return ['cover', 'logo', 'hero'].includes(value) ? value : 'cover';
    }

    function syncImageTypeForProvider() {
        const provider = (sgdbProvider?.value || 'steamgriddb');
        if (!sgdbImageType) return;
        if (provider === 'igdb' || provider === 'giantbomb') {
            sgdbImageType.value = 'cover';
            sgdbImageType.disabled = true;
        } else {
            sgdbImageType.disabled = false;
        }
    }

    async function sgdbSearch() {
        if (!sgdbRoot || !sgdbQuery) return;
        const q = (sgdbQuery.value || '').trim();
        const provider = (sgdbProvider?.value || 'steamgriddb');
        const imageType = selectedImageType();
        if (!q) {
            sgdbStatus.textContent = 'Enter a search title.';
            return;
        }
        if (provider === 'igdb' && imageType !== 'cover') {
            sgdbStatus.textContent = 'IGDB only supports covers.';
            return;
        }
        if (provider === 'giantbomb' && imageType !== 'cover') {
            sgdbStatus.textContent = 'Giant Bomb only supports covers.';
            return;
        }
        sgdbStatus.textContent = 'Searching…';
        sgdbResults.innerHTML = '';
        try {
            const qs = new URLSearchParams({ q, limit: '12' });
            if (provider === 'steamgriddb') {
                qs.set('image_type', imageType);
            }
            const resp = await fetch(`/api/providers/${provider}/search?${qs.toString()}`, {
                headers: CSRFUtils.getHeaders(),
            });
            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data.error || `Search failed (${resp.status})`);
            }
            const rows = data.results || [];
            if (!rows.length) {
                sgdbStatus.textContent = 'No results.';
                return;
            }
            sgdbStatus.textContent = `${rows.length} result(s) — click to apply as ${imageType}.`;
            rows.forEach((item) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-sm btn-outline-light p-1';
                btn.title = item.game_name || item.id || `Apply ${imageType}`;
                const img = document.createElement('img');
                img.src = item.thumb_url || item.url;
                img.alt = item.game_name || imageType;
                img.style.width = imageType === 'hero' ? '160px' : '96px';
                img.style.height = 'auto';
                img.style.display = 'block';
                btn.appendChild(img);
                btn.addEventListener('click', () => sgdbApply(item.url, provider, imageType));
                sgdbResults.appendChild(btn);
            });
        } catch (err) {
            sgdbStatus.textContent = err.message || String(err);
        }
    }

    async function sgdbApply(url, provider, imageType) {
        const uuid = sgdbRoot.getAttribute('data-game-uuid');
        const providerId = provider || sgdbProvider?.value || 'steamgriddb';
        const type = imageType || selectedImageType();
        sgdbStatus.textContent = `Applying ${type}…`;
        try {
            let resp;
            let data;
            if (type === 'cover') {
                resp = await fetch('/admin/api/covers/apply', {
                    method: 'POST',
                    headers: {
                        ...CSRFUtils.getHeaders(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ game_uuid: uuid, url, provider: providerId }),
                });
                data = await resp.json().catch(() => ({}));
            } else {
                resp = await fetch(`/api/games/${uuid}/artwork/steamgriddb`, {
                    method: 'POST',
                    headers: {
                        ...CSRFUtils.getHeaders(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url, image_type: type, provider: providerId }),
                });
                data = await resp.json().catch(() => ({}));
            }
            if (!resp.ok) {
                const reason = data.error || data.message || `Apply failed (HTTP ${resp.status})`;
                throw new Error(reason);
            }
            sgdbStatus.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} applied.`;
            if (type === 'cover') {
                const preview = document.getElementById('cover-preview-img');
                const coverUrl = data.cover_url || data.url;
                if (preview && coverUrl) {
                    preview.src = coverUrl + '?t=' + Date.now();
                } else {
                    window.location.reload();
                }
            }
        } catch (err) {
            sgdbStatus.textContent = err.message || String(err);
        }
    }

    syncImageTypeForProvider();
    sgdbProvider?.addEventListener('change', syncImageTypeForProvider);
    sgdbSearchBtn?.addEventListener('click', sgdbSearch);
    sgdbQuery?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sgdbSearch();
        }
    });
});
