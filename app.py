import os
import json
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image
from flask_cors import CORS

import tempfile

# Dynamically construct absolute paths to avoid Vercel Serverless cwd issues
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

load_dotenv()

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
# Enable CORS just in case
CORS(app)
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

try:
    model = genai.GenerativeModel('gemini-2.5-flash')
except Exception as e:
    model = None
    print(f"Error initializing model: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    if not api_key:
        return jsonify({"error": "Gemini API Key not configured. Please set GEMINI_API_KEY in .env file."}), 500
        
    if model is None:
        return jsonify({"error": "The Gemini model failed to initialize."}), 500
        
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if file:
        try:
            # Use file.stream directly to avoid disk I/O and permission issues on serverless
            with Image.open(file.stream) as img:
                img.load() # ensure the image is fully read into memory
                user_notes = request.form.get('notes', '').strip()
                notes_context = f"\nUser's additional context/description: '{user_notes}'\n" if user_notes else ""
                
                prompt = f"""
                You are an advanced agricultural botanist and plant pathologist. 
                Analyze this image of a plant/crop. {notes_context}
                Identify the plant type and any visible diseases or pests.
                Respond in JSON format with exactly these keys:
                - "plant": The type of plant (e.g., "Tomato", "Apple", "Unknown").
                - "disease": The name of the disease or pest. If healthy, state "Healthy". If unknown, state "Unknown".
                - "severity": The severity level (e.g., "Low", "Medium", "High", "Critical"). If healthy, state "None".
                - "description": A brief description of the symptoms or observation.
                - "details": In-depth details of the disease, its biological causes, and how it spreads.
                - "immediate_action": What the user needs to do *immediately* to mitigate damage or stop the spread.
                - "treatment": A suggested concise long-term treatment or cure.
                - "precautions": Preventative measures to take to prevent the disease from returning in the future.
                Do not include any markdown formatting or extra text outside the JSON. Return valid raw JSON.
                """
                
                response = model.generate_content([prompt, img])
                
                # Clean up JSON if model wrapped in markdown
                text = response.text.strip()
                if text.startswith('```json'):
                    text = text[7:]
                if text.startswith('```'):
                    text = text[3:]
                if text.endswith('```'):
                    text = text[:-3]
                    
                result = json.loads(text.strip())
            
            return jsonify(result)
            
        except Exception as e:
            print(f"Error during analysis: {e}")
            return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
