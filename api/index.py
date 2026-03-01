"""
This is the main file that Vercel will look for to start the Python server
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from api.logic import process_receipt_image


# Initialize FastAPI app
app = FastAPI(docs_url="/api/python/docs",
              openapi_url="/api/python/openapi.json")

# CORS Section
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"  # Added this just to be safe!
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/python/health")
def health_check():
    return {"status": "ResiboReport API is alive!"}


@app.post("/api/python/extract")
async def extract_receipt(file: UploadFile = File(...)):
    try:
        # 1. Read the uploaded image file in memory
        image_bytes = await file.read()

        # 2. Pass it to your logic file to do the heavy lifting
        data = process_receipt_image(image_bytes)

        # 3. Return the result to the user
        return {
            "message": "Image received successfully by Python!",
            "filename": file.filename,
            "status": "success"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
