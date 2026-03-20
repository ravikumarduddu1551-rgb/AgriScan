document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const previewArea = document.getElementById('preview-area');
    const imagePreview = document.getElementById('image-preview');
    const removeImgBtn = document.getElementById('remove-img');
    const analyzeBtn = document.getElementById('analyze-btn');
    
    const loadingState = document.getElementById('loading-state');
    const resultsSection = document.getElementById('results-section');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const resetBtn = document.getElementById('reset-btn');
    const uploadSection = document.querySelector('.upload-section');

    let selectedFile = null;

    // Drag and drop handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
    });

    uploadArea.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function() {
        if(this.files && this.files.length > 0) {
            handleFiles(this.files);
        }
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            
            // Basic validation
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file.');
                return;
            }
            if (file.size > 16 * 1024 * 1024) {
                alert('File is too large. Max size is 16MB.');
                return;
            }

            selectedFile = file;
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = function() {
                imagePreview.src = reader.result;
                uploadArea.classList.add('hidden');
                previewArea.classList.remove('hidden');
            }
        }
    }

    removeImgBtn.addEventListener('click', () => {
        resetUpload();
    });

    function resetUpload() {
        selectedFile = null;
        fileInput.value = '';
        imagePreview.src = '';
        document.getElementById('user-notes').value = '';
        previewArea.classList.add('hidden');
        uploadArea.classList.remove('hidden');
    }

    // Analysis trigger
    analyzeBtn.addEventListener('click', () => {
        if (!selectedFile) return;

        // Show loading state
        previewArea.classList.add('hidden');
        uploadSection.classList.add('hidden');
        errorState.classList.add('hidden');
        resultsSection.classList.add('hidden');
        loadingState.classList.remove('hidden');

        const formData = new FormData();
        formData.append('file', selectedFile);

        const userNotes = document.getElementById('user-notes').value;
        if (userNotes && userNotes.trim() !== '') {
            formData.append('notes', userNotes);
        }

        fetch('/api/analyze', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Server error') });
            }
            return response.json();
        })
        .then(data => {
            displayResults(data);
        })
        .catch(error => {
            showError(error.message);
        });
    });

    function displayResults(data) {
        loadingState.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        // Populate details
        document.getElementById('res-plant').textContent = data.plant || 'Unknown';
        document.getElementById('res-disease').textContent = data.disease || 'Unknown';
        document.getElementById('res-description').textContent = data.description || 'No description available.';
        document.getElementById('res-details').textContent = data.details || 'No expanded details provided.';
        document.getElementById('res-immediate-action').textContent = data.immediate_action || 'Consult an agricultural expert.';
        document.getElementById('res-treatment').textContent = data.treatment || 'Consult a local agricultural expert.';
        document.getElementById('res-precautions').textContent = data.precautions || 'Maintain good field hygiene.';

        // Handle severity badge
        const badge = document.getElementById('severity-badge');
        let severity = (data.severity || 'Unknown').toLowerCase();
        
        badge.className = 'badge'; // reset
        
        // Map severity string to CSS class
        if (severity.includes('low')) {
            badge.classList.add('severity-low');
            badge.textContent = 'Low Severity';
        } else if (severity.includes('medium') || severity.includes('moderate')) {
            badge.classList.add('severity-medium');
            badge.textContent = 'Medium Severity';
        } else if (severity.includes('high')) {
            badge.classList.add('severity-high');
            badge.textContent = 'High Severity';
        } else if (severity.includes('critical') || severity.includes('severe')) {
            badge.classList.add('severity-critical');
            badge.textContent = 'Critical Severity';
        } else if (severity.includes('none') || severity.includes('healthy')) {
            badge.classList.add('severity-none');
            badge.textContent = 'Healthy';
        } else {
            badge.classList.add('severity-medium');
            badge.textContent = severity.charAt(0).toUpperCase() + severity.slice(1);
        }
    }

    function showError(msg) {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.textContent = msg;
    }

    retryBtn.addEventListener('click', () => {
        errorState.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        previewArea.classList.remove('hidden');
    });

    resetBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        resetUpload();
    });
});
