# OpenPose 3D Pose Reconstruction Web Application

A full-stack web application that uses OpenPose for whole-body 3D pose reconstruction and estimation. Upload a video or provide a video URL, and see the original video side-by-side with the 3D pose estimation overlay.

## Features

- Upload video files or provide video URLs
- Real-time processing status with progress tracking
- Side-by-side comparison of original and processed videos
- Synchronized video playback
- Whole-body 3D pose reconstruction using OpenPose
- Dockerized deployment for easy setup

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite
- Material-UI
- Axios
- React Dropzone

**Backend:**
- Python FastAPI
- OpenPose (CMU Perceptual Computing Lab)
- Celery for async task processing
- Redis for task queue
- OpenCV for video processing

**Infrastructure:**
- Docker & Docker Compose
- Nginx (for production)

## Prerequisites

- Docker and Docker Compose installed
- (Optional) NVIDIA Docker for GPU acceleration
- At least 8GB RAM
- 20GB free disk space

## Installation

### 1. Clone the Repository

```bash
cd /path/to/openPose
```

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` if needed. Default values should work for most cases.

### 3. Build and Run with Docker Compose

```bash
docker-compose up --build
```

This will:
- Build OpenPose from source (this takes 20-30 minutes on first run)
- Set up the backend with FastAPI
- Set up the frontend with React
- Start Redis for task queue
- Start Celery worker for video processing

### 4. Access the Application

Once all services are running:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

## Usage

### Upload a Video

1. Open http://localhost:3000 in your browser
2. Either:
   - Drag and drop a video file, or
   - Click to select a video file, or
   - Enter a video URL and click "Process Video from URL"
3. Wait for processing to complete (progress is shown in real-time)
4. View the side-by-side comparison with synchronized playback

### Supported Video Formats

- MP4
- AVI
- MOV
- WEBM
- MKV

### File Size Limit

- Maximum: 500MB per video

## GPU Acceleration (Optional)

For faster processing, enable GPU support:

### 1. Install NVIDIA Docker

Follow the instructions at: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

### 2. Enable GPU in Docker Compose

Edit `docker-compose.yml` and uncomment the GPU sections under `backend` and `celery-worker`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

### 3. Update Environment

Set `USE_GPU=true` in your `.env` file:

```bash
USE_GPU=true
```

### 4. Rebuild and Restart

```bash
docker-compose down
docker-compose up --build
```

## Project Structure

```
openPose/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── routers/           # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── tasks/             # Celery tasks
│   │   └── main.py            # FastAPI app
│   ├── openpose_setup/        # OpenPose build scripts
│   └── Dockerfile
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # API client
│   │   └── App.tsx
│   └── Dockerfile
├── shared/                     # Shared volume for videos
│   ├── uploads/               # Original videos
│   └── processed/             # Processed videos
├── docker-compose.yml
└── README.md
```

## API Endpoints

### POST /api/v1/video/upload
Upload a video file for processing.

**Request:**
- multipart/form-data with `file` field

**Response:**
```json
{
  "task_id": "uuid",
  "status": "queued",
  "message": "Video uploaded successfully"
}
```

### POST /api/v1/video/process-url
Process a video from a URL.

**Request:**
```json
{
  "video_url": "https://example.com/video.mp4"
}
```

**Response:**
```json
{
  "task_id": "uuid",
  "status": "queued",
  "message": "Video downloaded successfully"
}
```

### GET /api/v1/video/status/{task_id}
Get processing status.

**Response:**
```json
{
  "task_id": "uuid",
  "status": "processing",
  "progress": 45,
  "message": "Processing frame 450/1000",
  "result": {
    "original_url": "/api/v1/video/serve/original/uuid",
    "processed_url": "/api/v1/video/serve/processed/uuid",
    "metadata": {
      "duration": 30.5,
      "fps": 30,
      "resolution": "1920x1080",
      "total_frames": 915
    }
  }
}
```

### GET /api/v1/video/serve/{type}/{task_id}
Stream a video file (type: original or processed).

### DELETE /api/v1/video/{task_id}
Delete all files associated with a task.

## Configuration

Environment variables can be configured in `.env`:

### Backend Settings
- `BACKEND_HOST` - Backend host (default: 0.0.0.0)
- `BACKEND_PORT` - Backend port (default: 8000)
- `MAX_FILE_SIZE` - Maximum file size in bytes (default: 524288000 = 500MB)
- `VIDEO_EXPIRY_HOURS` - Hours before videos are auto-deleted (default: 24)

### OpenPose Settings
- `OPENPOSE_MODEL` - Pose model (default: BODY_25)
- `OPENPOSE_NET_RESOLUTION` - Network resolution (default: -1x368)
- `OPENPOSE_RENDER_THRESHOLD` - Render threshold (default: 0.05)
- `USE_GPU` - Enable GPU processing (default: false)

### Frontend Settings
- `VITE_API_URL` - Backend API URL (default: http://localhost:8000)
- `VITE_POLLING_INTERVAL` - Status polling interval in ms (default: 2000)

## Troubleshooting

### OpenPose Build Fails

If OpenPose fails to build:
1. Check Docker logs: `docker-compose logs backend`
2. Ensure you have enough disk space (need ~15GB for build)
3. Try rebuilding without cache: `docker-compose build --no-cache backend`

### Video Processing is Slow

Without GPU, processing can be slow. Options:
1. Enable GPU support (see GPU Acceleration section)
2. Use smaller/shorter videos for testing
3. Reduce `OPENPOSE_NET_RESOLUTION` to `-1x256` for faster (but less accurate) processing

### Cannot Access Frontend

1. Check if all services are running: `docker-compose ps`
2. Check frontend logs: `docker-compose logs frontend`
3. Ensure port 3000 is not in use by another application

### "Failed to connect to backend"

1. Ensure backend is running: `docker-compose logs backend`
2. Check if port 8000 is accessible
3. Verify CORS settings in `backend/app/config.py`

### Videos Not Processing

1. Check Celery worker logs: `docker-compose logs celery-worker`
2. Ensure Redis is running: `docker-compose logs redis`
3. Check if video file is valid and within size limit

## Development

### Run Backend Locally

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Note: OpenPose must be installed separately.

### Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

### Run Celery Worker Locally

```bash
cd backend
celery -A app.tasks.celery_tasks worker --loglevel=info
```

## License

This project uses OpenPose, which is licensed under the OpenPose License. Please refer to the [OpenPose repository](https://github.com/CMU-Perceptual-Computing-Lab/openpose) for licensing details.

## Credits

- [OpenPose](https://github.com/CMU-Perceptual-Computing-Lab/openpose) by CMU Perceptual Computing Lab
- Built with FastAPI, React, and Docker

## Support

For issues or questions, please open an issue on the GitHub repository.
