import hashlib
import datetime
import json
import os
import io
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai
from PIL import Image
from fastapi import HTTPException

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
            "transaction_date": data.get("transaction_date"),
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

    prompt = """Analyze this GCash transaction log or receipt screenshot. Extract the following fields into a clean JSON format:
    - reference_number (usually alphanumeric or 13-digit)
    - amount (numeric only, but KEEP the negative '-' sign if it is present to indicate outgoing money. e.g., -500.00 or 250.00)
    - transaction_date (Format: YYYY-MM-DD HH:MM)
        
    CRITICAL: Do NOT extract or include the sender_name due to data privacy.
    Return ONLY the raw JSON. No markdown blocks, no explanations."""

    response = model.generate_content([prompt, img])

    clean_json = response.text.replace(
        '```json', '').replace('```', '').strip()
    data = json.loads(clean_json)

    # THE FIX: Safely handle commas and convert to float
    raw_amount = str(data.get("amount", "0")).replace(',', '')
    amount_value = float(raw_amount)

    if amount_value < 0:
        # It's an outgoing log! Block it.
        raise HTTPException(
            status_code=400, detail="Outgoing transaction detected! Only incoming receipts are recorded.")

    # Save the clean, comma-free number back to the dictionary for the database
    data["amount"] = amount_value

    if not data.get("transaction_date"):
        data["transaction_date"] = datetime.datetime.now().strftime(
            "%Y-%m-%d %H:%M")

    # Generate the Tamper-Proof Hash (Kept beautifully simple)
    raw_signature = f"{data.get('reference_number')}|{data.get('amount')}|{data.get('transaction_date')}"
    digital_signature = hashlib.sha256(raw_signature.encode()).hexdigest()

    data['fingerprint'] = digital_signature

    # Strict Data Privacy Enforcement
    if 'sender_name' in data:
        del data['sender_name']

    save_to_database(data)

    return data
``