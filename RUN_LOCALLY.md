# Running OpenPose Locally on macOS

This guide explains how to run the OpenPose application directly on macOS without Docker.

## Prerequisites

All dependencies have been installed:
- ✅ Homebrew
- ✅ Python 3.13
- ✅ Node.js 18.20.8
- ✅ Redis (running as a service)
- ✅ CMake, OpenCV, Boost, and other system dependencies
- ⏳ OpenPose (currently building)

## Running the Application

You need to run three services in separate terminal windows:

### Terminal 1: Backend Server

```bash
./start-backend.sh
```

This starts the FastAPI backend on http://localhost:8000

### Terminal 2: Celery Worker

```bash
./start-celery.sh
```

This starts the Celery worker that processes videos with OpenPose.

### Terminal 3: Frontend

```bash
./start-frontend.sh
```

This starts the React frontend on http://localhost:5173

## Accessing the Application

Once all three services are running:
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Troubleshooting

### Redis Connection Error

If you see Redis connection errors, ensure Redis is running:

```bash
brew services list
```

If Redis is not running:

```bash
brew services start redis
```

### OpenPose Not Found

If the Celery worker can't find OpenPose, ensure the build completed successfully.
OpenPose should be installed at: `~/openpose/openpose`

Check the Python bindings:

```bash
cd backend
source venv/bin/activate
python -c "import pyopenpose; print('OpenPose imported successfully')"
```

### Port Already in Use

If port 8000 or 5173 is already in use, you can modify the ports in:
- Backend: `.env` file (`BACKEND_PORT`)
- Frontend: `frontend/vite.config.ts`

## Stopping the Services

Press `Ctrl+C` in each terminal window to stop the respective service.

To stop Redis:

```bash
brew services stop redis
```

## Development

### Backend Development

The backend runs with `--reload` flag, so it will automatically restart when you make changes to Python files.

### Frontend Development

The frontend runs with Vite's HMR (Hot Module Replacement), so changes will be reflected immediately in the browser.

## Environment Variables

All configuration is in the `.env` file at the project root. Key settings:

- `UPLOAD_DIR`: Where uploaded videos are stored
- `PROCESSED_DIR`: Where processed videos are saved
- `OPENPOSE_MODEL`: Pose detection model (default: BODY_25)
- `USE_GPU`: Enable GPU acceleration (requires CUDA on macOS with Metal GPU support)

## Notes

- Video processing is CPU-intensive and will be slow without GPU acceleration
- The first video processing may take longer as OpenPose initializes
- Large videos (>100MB) will take several minutes to process
