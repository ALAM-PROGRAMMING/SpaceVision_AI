document.addEventListener("DOMContentLoaded", function () {
    // --- Element Selectors ---
    const webcam = document.getElementById("webcam");
    const resultImage = document.getElementById("result_image");
    const detectBtn = document.getElementById("detect-btn");
    const resetBtn = document.getElementById("reset-btn");
    const loading = document.getElementById("loading");
    const resultContainer = document.getElementById("result-container");
    const statusText = document.getElementById("status-text");

    // Check if we are on the webcam page by seeing if the webcam element exists
    if (!webcam) {
        return; // Exit if not on the webcam page
    }

    const canvas = document.createElement('canvas'); // A temporary canvas for capturing frames
    let stream = null; // To hold the webcam stream

    // --- Function to start the webcam ---
    function startWebcam() {
        // Make sure we have access to the user's camera
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(s => {
                    stream = s;
                    webcam.srcObject = stream;
                    webcam.onloadedmetadata = () => {
                        // Set canvas dimensions to match the video feed
                        canvas.width = webcam.videoWidth;
                        canvas.height = webcam.videoHeight;
                        
                        // Set the UI to the initial state
                        webcam.style.display = 'block';
                        resultImage.style.display = 'none';
                        detectBtn.style.display = 'inline-block';
                        resetBtn.style.display = 'none';
                    };
                })
                .catch(err => {
                    console.error("Error accessing webcam: ", err);
                    if(resultContainer) {
                        resultContainer.innerHTML = `<div class="alert alert-danger">Could not access webcam. Please check permissions and refresh the page.</div>`;
                    }
                });
        }
    }

    // --- Detect Button Click ---
    detectBtn.onclick = function () {
        // Update UI to show we are working
        loading.style.display = "inline-block";
        detectBtn.disabled = true;
        detectBtn.style.display = 'none';
        resultContainer.innerHTML = '<p class="text-muted text-center">Analyzing...</p>';

        // Capture a frame from the video feed
        const context = canvas.getContext('2d');
        context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
        const dataURL = canvas.toDataURL("image/jpeg"); // Use jpeg for smaller file size

        // --- Send the captured image to the Flask server ---
        fetch("/detect_webcam", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataURL }) // Send the full data URL
        })
        .then(res => {
            if (!res.ok) {
                // Handle server-side errors
                return res.json().then(errorData => {
                    throw new Error(`Server Error: ${errorData.error || res.statusText}`);
                });
            }
            return res.json();
        })
        .then(data => {
            // --- SUCCESS: Display the results ---
            // Stop the live webcam stream to free up resources
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            // Hide the live video and show the processed image
            webcam.style.display = 'none';
            resultImage.src = data.result_img; // The server sends back the image with boxes
            resultImage.style.display = 'block';

            // Show the "Try Again" button
            resetBtn.style.display = 'inline-block';

            // Update the results panel with the list of detections
            updateStatus(data.detections);
        })
        .catch(error => {
            // --- ERROR: Show an error message ---
            console.error('Detection Error:', error);
            resultContainer.innerHTML = `<div class="alert alert-danger">An error occurred during detection. Please try again.</div>`;
            // Show the detect button again so the user can retry
            detectBtn.style.display = 'inline-block';
            resetBtn.style.display = 'none';
        })
        .finally(() => {
            // Hide the loading spinner and re-enable the button
            loading.style.display = "none";
            detectBtn.disabled = false;
        });
    };

    // --- Reset Button Click ---
    resetBtn.onclick = function() {
        // Clear the previous results
        resultContainer.innerHTML = `
            <h4 class="text-center">Analysis</h4>
            <hr>
            <p id="status-text" class="text-muted text-center">Point your camera at an object and click "Detect Objects".</p>
        `;
        // Restart the webcam to get a live feed again
        startWebcam();
    };

    // --- Function to build the results HTML ---
    function updateStatus(detections) {
        let detectionsHtml = '';
        
        if (detections && detections.length > 0) {
            // Create a list item for each detected object
            detections.forEach(det => {
                detectionsHtml += `
                    <li class="list-group-item list-group-item-info">
                        <span>
                            <i class="fas fa-eye me-2"></i><strong>${det.name}</strong>
                        </span>
                    </li>
                `;
            });
        } else {
            // Display a message if nothing was found
            detectionsHtml = `<li class="list-group-item">No objects detected in the frame.</li>`;
        }

        // Construct the final HTML for the results panel
        const resultHtml = `
            <h4 class="text-center">Detection Summary</h4>
            <ul class="list-group list-group-flush mb-3">${detectionsHtml}</ul>
        `;
        resultContainer.innerHTML = resultHtml;
    }
    
    // --- Initial call to start the webcam when the page loads ---
    startWebcam();
});