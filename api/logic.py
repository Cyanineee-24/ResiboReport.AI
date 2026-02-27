import hashlib
import json
import os
import io
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image

# 1. Load Environment & API Keys
load_dotenv()
my_secret_key = os.getenv("GEMINI_API_KEY")
if not my_secret_key:
    raise ValueError("CRITICAL ERROR: GEMINI_API_KEY is missing. Check your .env")

# 2. Configure Gemini
genai.configure(api_key=my_secret_key)
model = genai.GenerativeModel('gemini-2.5-flash')

# 3. The Core Function
def process_receipt_image(image_bytes: bytes) -> dict:
    """Takes image bytes, extracts data via Gemini, and signs it."""
    img = Image.open(io.BytesIO(image_bytes))

    prompt = """Analyze this GCash receipt or local bank transfer screenshot. Extract the following fields into a clean JSON format:
    - reference_number (usually alphanumeric or 13-digit)
    - amount (numeric only, no currency symbols)
    - sender_name (or merchant name)
    - timestamp (format: YYYY-MM-DD HH:MM)
    
    Return ONLY the raw JSON. No markdown blocks, no explanations."""

    response = model.generate_content([prompt, img])
    
    clean_json = response.text.replace('```json', '').replace('```', '').strip()
    data = json.loads(clean_json)

    # Generate the Tamper-Proof Hash
    raw_signature = f"{data.get('reference_number')}|{data.get('amount')}|{data.get('timestamp')}"
    digital_signature = hashlib.sha256(raw_signature.encode()).hexdigest()

    data['fingerprint'] = digital_signature

    return data