"""
This is the main file that Vercel will look for to start the Python server
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from api.logic import process_receipt_image

# Initialize FastAPI app
app = FastAPI(docs_url="/api/python/docs",
              openapi_url="/api/python/openapi.json")


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
        return {"success": True, "data": data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
