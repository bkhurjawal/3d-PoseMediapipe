#!/bin/bash
# Start the FastAPI backend server

cd "$(dirname "$0")/backend"

# Activate virtual environment
source venv/bin/activate

# Set environment file path
export ENV_FILE="$(dirname "$0")/.env"

# Start uvicorn server
echo "Starting FastAPI backend on http://localhost:8000..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
