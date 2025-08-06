# app.py
import os
import base64
import cv2
import numpy as np
from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from werkzeug.utils import secure_filename
from yolov8_utils import run_yolov8_inference_for_upload, run_yolov8_inference_for_webcam, CRITICAL_OBJECTS

app = Flask(__name__)
app.secret_key = "spacevision_secret_key_12345"
app.config['UPLOAD_FOLDER'] = 'static/uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

DETECTION_HISTORY = []

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/upload', methods=['GET', 'POST'])
def upload():
    if request.method == 'POST':
        file = request.files.get('image')
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Use the function that draws on the image for uploads
            result_img_with_boxes, detections = run_yolov8_inference_for_upload(filepath)
            
            result_filename = 'result_' + filename
            out_path = os.path.join(app.config['UPLOAD_FOLDER'], result_filename)
            cv2.imwrite(out_path, result_img_with_boxes)
            
            detection_entry = {
                'original_filename': filename,
                'result_img_filename': result_filename,
                'detections': detections
            }
            
            DETECTION_HISTORY.append(detection_entry)
            session['last_result'] = detection_entry
            return redirect(url_for('results'))
            
    return render_template('upload.html')

@app.route('/webcam')
def webcam():
    return render_template('webcam.html', critical_objects=CRITICAL_OBJECTS)

@app.route('/detect_webcam', methods=['POST'])
def detect_webcam():
    try:
        data = request.get_json()
        # The JS sends a data URL like "data:image/jpeg;base64,..."
        # We split it to get just the base64 part
        img_data_b64 = data['image'].split(',')[1]
        
        img_bytes = base64.b64decode(img_data_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Could not decode image from base64 string")

        # Use the function that ONLY returns detections
        detections = run_yolov8_inference_for_webcam(img)
        
        # We send back the ORIGINAL image data URI (which the JS already has) 
        # and the new detection data.
        return jsonify({
            'result_img': data['image'], # Send back the original clean image dataURL
            'detections': detections
        })

    except Exception as e:
        print(f"Error in /detect_webcam: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/results')
def results():
    result = session.get('last_result', None)
    return render_template('results.html', result=result, critical_objects=CRITICAL_OBJECTS)

@app.route('/history')
def history():
    return render_template('results.html', history=list(reversed(DETECTION_HISTORY)), critical_objects=CRITICAL_OBJECTS)

if __name__ == '__main__':
    app.run(debug=True)