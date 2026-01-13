import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # File paths
    upload_dir: str = "./shared/uploads"
    processed_dir: str = "./shared/processed"
    temp_dir: str = "./shared/temp"
    thumbnails_dir: str = "./shared/thumbnails"

    # File limits
    max_file_size: int = 524288000  # 500MB
    video_expiry_hours: int = 24

    # Celery
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/0"

    # Pose Engine Selection
    pose_engine: str = "mediapipe"  # Options: "openpose" or "mediapipe"

    # OpenPose
    openpose_model: str = "BODY_25"
    openpose_net_resolution: str = "-1x368"
    openpose_render_threshold: float = 0.05
    use_gpu: bool = False
    openpose_root: str = "/opt/openpose"

    # CORS
    cors_origins: list = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8000"]

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        case_sensitive = False
        extra = "ignore"


# Create global settings instance
settings = Settings()

# Ensure directories exist
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.processed_dir, exist_ok=True)
os.makedirs(settings.temp_dir, exist_ok=True)
os.makedirs(settings.thumbnails_dir, exist_ok=True)
