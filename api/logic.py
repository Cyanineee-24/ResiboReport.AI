import hashlib
import json
import os
import io
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai
from PIL import Image

load_dotenv()

# 1. Initialize Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# 2. Load Environment & API Keys

my_secret_key = os.getenv("GEMINI_API_KEY")
if not my_secret_key:
    raise ValueError(
        "CRITICAL ERROR: GEMINI_API_KEY is missing. Check your .env")

# 3. Configure Gemini
genai.configure(api_key=my_secret_key)
model = genai.GenerativeModel('gemini-2.5-flash')

# 4. Save to DB logic


def save_to_database(data: dict):
    """Inserts the extracted resibo data into Supabase."""

    try:
        # Use the data keys that match SQL table columns
        response = supabase.table("resibo_ledger").insert({
            "reference_number": data.get("reference_number"),
            "amount": data.get("amount"),
            "transaction_date": data.get("timestamp"),
            "fingerprint": data.get("fingerprint")
        }).execute()

        return response

    except Exception as e:
        print(f"Database Error: {e}")
        raise e


# 5. The Core Function
def process_receipt_image(image_bytes: bytes) -> dict:
    """Takes image bytes, extracts data via Gemini, and signs it."""
    img = Image.open(io.BytesIO(image_bytes))

    prompt = """Analyze this GCash receipt or local bank transfer screenshot. Extract the following fields into a clean JSON format:
    - reference_number (usually alphanumeric or 13-digit)
    - amount (numeric only, no currency symbols)
    - timestamp (format: YYYY-MM-DD HH:MM)
    
    Return ONLY the raw JSON. No markdown blocks, no explanations."""

    response = model.generate_content([prompt, img])

    clean_json = response.text.replace(
        '```json', '').replace('```', '').strip()
    data = json.loads(clean_json)

    # Generate the Tamper-Proof Hash
    raw_signature = f"{data.get('reference_number')}|{data.get('amount')}|{data.get('timestamp')}"
    digital_signature = hashlib.sha256(raw_signature.encode()).hexdigest()

    data['fingerprint'] = digital_signature

    if 'sender_name' in data:
        del data['sender_name']

    save_to_database(data)

    return data
