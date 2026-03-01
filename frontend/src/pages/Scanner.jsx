import { useState, useRef } from 'react';

function App() {
  const [image, setImage] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [errorType, setErrorType] = useState(null); // Tracks if it's "outgoing" or a general error
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // The hidden "film" to capture the frame

  // 1. Handle File Upload
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
      analyzeReceipt(file); // Immediately analyze
    }
  };

  // 2. Open Front Camera
  const startCamera = async () => {
    setImage(null); // Clear any previous images
    try {
      // facingMode: "user" forces the front/laptop camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      alert("Please allow camera access to use this feature.");
    }
  };

  // 3. Close Camera
  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop()); // Turn off the webcam light
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  // 4. Capture Frame & Analyze
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Match canvas size to video feed
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the frame onto the hidden canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to image format
      const imageData = canvas.toDataURL('image/jpeg');
      setImage(imageData);
      
      // Shut off camera immediately
      closeCamera(); 
      
      // Convert image back to a File for the backend
      fetch(imageData)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          analyzeReceipt(file);
        });
    }
  };

  // 5. The Analysis Bridge (Talking to Python)
  const analyzeReceipt = async (file) => {
    setIsAnalyzing(true); // 1. Start the spinner
    
    const formData = new FormData();
    formData.append("file", file); 

    try {
      const response = await fetch("/api/python/extract", {
        method: "POST",
        body: formData,
      });

      // Read the JSON ONLY ONCE. This contains either your success data OR your error details.
      const result = await response.json(); 

      // Did the Python bouncer block it?
      if (!response.ok) {
        if (response.status === 400 && result.detail) {
          // Throw the EXACT message Python sent us ("Outgoing transaction detected...")
          throw new Error(result.detail);
        } else {
          // Fallback for general server errors
          throw new Error(`Server error! Status: ${response.status}`);
        }
      }

      console.log("Backend Reply:", result);
      
      setIsAnalyzing(false); // Turn OFF spinner before success alert
      alert(`Success! Python says: ${result.message}`);
      
    } catch (error) {
      console.error("Connection Error:", error);
      setIsAnalyzing(false); // Turn OFF spinner on error
      
      setTimeout(() => {
        // This will now perfectly display our custom Python rejection message!
        alert(`Request Failed: ${error.message}`); 
      }, 10);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-black text-emerald-600 tracking-tight mb-2">ResiboReport</h1>
          <p className="text-slate-500 text-lg">Capture via camera or upload your Gcash receipt for instant AI processing</p>
        </header>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          
          {/* Card 1: Upload */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 text-3xl">
              📁
            </div>
            <h2 className="text-xl font-bold mb-2">Upload File</h2>
            <p className="text-slate-500 mb-6 flex-grow">Have a screenshot of a digital receipt? Upload it directly here.</p>
            <label className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl cursor-pointer transition-colors w-full">
              Choose Image
              <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            </label>
          </div>

          {/* Card 2: Camera Controls */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow">
             <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-4 text-3xl">
              📷
            </div>
            <h2 className="text-xl font-bold mb-2">Use Camera</h2>
            <p className="text-slate-500 mb-6 flex-grow">Hold your physical receipt up to your laptop webcam.</p>
            
            {/* DYNAMIC BUTTONS: Changes based on camera state */}
            {!isCameraOpen ? (
              <button 
                onClick={startCamera}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors w-full">
                Open Webcam
              </button>
            ) : (
              <div className="flex gap-3 w-full">
                <button 
                  onClick={captureImage}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex-[2]">
                  📸 Capture
                </button>
                <button 
                  onClick={closeCamera}
                  className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex-1">
                  Close
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Video Stream Viewfinder (Stays in the exact same spot) */}
        <div className="mb-10 flex justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            className="rounded-2xl shadow-lg bg-slate-900 w-full max-w-lg object-cover transition-all duration-300"
            style={{ minHeight: isCameraOpen ? '320px' : '0', opacity: isCameraOpen ? 1 : 0 }}
          />
        </div>

        {/* Results / Analysis View */}
        {image && (
          <div className="bg-white p-8 rounded-2xl shadow-md border-2 border-emerald-500 text-center max-w-lg mx-auto">
            <h3 className="font-bold text-xl mb-4 text-emerald-700">Receipt Captured!</h3>
            <img src={image} alt="Receipt preview" className="max-w-full mx-auto rounded-lg shadow-sm mb-6 max-h-80 object-contain" />
            
            {isAnalyzing ? (
              <div className="bg-slate-50 text-slate-600 p-4 rounded-xl flex items-center justify-center gap-3 font-bold animate-pulse">
                <span className="text-xl animate-spin">⏳</span> AI is processing your receipt...
              </div>
            ) : (
              <button onClick={() => setImage(null)} className="text-emerald-600 font-bold hover:underline">
                Clear & Scan Another
              </button>
            )}
          </div>
        )}

        {/* Hidden Canvas for "Freezing" the video frame */}
        <canvas ref={canvasRef} className="hidden" />

      </div>
    </div>
  );
}

export default App;