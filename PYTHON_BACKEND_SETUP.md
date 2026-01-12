# Python Backend Setup Guide

## ✅ What's Fixed

### Frontend Changes:
1. **Updated types** - Added `pose_3d_url` to `ProcessingResult` interface
2. **Fixed video URL handling** - Now uses URLs from backend response instead of constructing locally
3. **Configured for Python backend** - API base URL set to `http://localhost:8000`

### Backend Fixes:
1. **Fixed video serving route** - Now correctly serves 3D videos by matching exact file suffix (`{taskId}_3d.mp4`)
2. **Added video file filtering** - Excludes JSON files when serving videos

## 🚀 How to Run

### Prerequisites:
- ✅ Redis is running (already verified)
- ✅ Python virtual environment is set up
- ✅ All dependencies are installed

### Terminal 1 - Start Python Backend API:
```bash
cd /Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose
./start-backend.sh
```
**Expected output:**
```
Starting FastAPI backend on http://localhost:8000...
🚀 OpenPose Video Processing API started
📁 Upload directory: /Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose/shared/uploads
📁 Processed directory: /Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose/shared/processed
🎯 OpenPose model: BODY_25
🖥️  GPU enabled: False
```

### Terminal 2 - Start Celery Worker:
```bash
cd /Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose
./start-celery.sh
```
**Expected output:**
```
Starting Celery worker with MediaPipe...
[INFO] Connected to redis://localhost:6379/0
[INFO] celery@hostname ready.
```

### Terminal 3 - Start Frontend:
```bash
cd /Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose
./start-frontend.sh
```
**Expected output:**
```
VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

## 🎯 Testing

1. Open browser to: `http://localhost:3000`
2. Upload a video (MP4, AVI, MOV, WEBM, or MKV)
3. Watch the progress:
   - ✅ Video uploads
   - ✅ Processing starts (real MediaPipe pose detection!)
   - ✅ Progress bar shows frame-by-frame processing
4. View results:
   - **Original Video** - Your uploaded video
   - **3D Pose Reconstruction** - 3D skeleton visualization (NOW WITH REAL MOVEMENT!)
   - **Interactive 3D Pose** - Draggable 3D skeleton

## 🎨 What You'll See

### Before (Node.js with dummy data):
- Static skeleton with tiny sine wave movements
- Not tracking actual person in video
- 3D pose barely moved

### After (Python with MediaPipe):
- ✅ **Real pose detection** from the actual person in video
- ✅ **Animated 3D skeleton** showing real movements
- ✅ **Processed video** with skeleton overlay on the person
- ✅ **Smooth tracking** of body movements

## 🐛 Troubleshooting

### Port 8000 already in use:
```bash
# Stop the Node.js backend if it's still running
lsof -ti :8000 | xargs kill -9
```

### Celery worker not processing:
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Restart Celery worker
pkill -f celery
./start-celery.sh
```

### Frontend can't connect:
```bash
# Verify backend is running
curl http://localhost:8000/
# Should return: {"message":"OpenPose Video Processing API","version":"1.0.0","docs":"/docs"}
```

## 📊 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🔧 Configuration

All settings are in `/Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose/.env`:

```env
# Backend Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
POSE_ENGINE=mediapipe  # Using MediaPipe for pose detection

# Directories (using shared folder)
UPLOAD_DIR=/Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose/shared/uploads
PROCESSED_DIR=/Users/bhavyasaurabh/Repository/NexTurn/Carespace/openPose/shared/processed

# Celery (Redis)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

## ✨ Features

1. **Real-time Progress** - See frame-by-frame processing progress
2. **MediaPipe Pose Detection** - Industry-standard pose estimation
3. **3D Visualization** - Interactive 3D skeleton viewer
4. **Video Processing** - Creates processed video with skeleton overlay
5. **Landmarks Export** - Saves pose data as JSON for further analysis

## 🎉 Enjoy!

Your 3D pose visualization should now show **real movement** from the person in the video!
