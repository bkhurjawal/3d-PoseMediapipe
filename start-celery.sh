#!/bin/bash
# Start the Celery worker for video processing

cd "$(dirname "$0")/backend"

# Activate virtual environment
source venv/bin/activate

# Start Celery worker with solo pool (required for MediaPipe on macOS)
# The solo pool avoids fork() which conflicts with OpenGL initialization
echo "Starting Celery worker with MediaPipe..."
celery -A app.tasks.celery_tasks worker --loglevel=info --pool=solo
