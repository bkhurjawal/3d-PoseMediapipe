from fastapi import APIRouter
from app.models import HealthResponse
import os
from app.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""

    # Check pose engine availability
    pose_engine = settings.pose_engine.lower()

    if pose_engine == "mediapipe":
        # MediaPipe is always available if installed (check by trying to import)
        try:
            import mediapipe
            pose_available = True
        except ImportError:
            pose_available = False
    else:
        # Check if OpenPose is available
        pose_available = os.path.exists(settings.openpose_root)

    return HealthResponse(
        status="healthy",
        version="1.0.0",
        openpose_available=pose_available,
        pose_engine=pose_engine
    )
