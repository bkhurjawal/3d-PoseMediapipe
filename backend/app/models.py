from pydantic import BaseModel, HttpUrl
from typing import Optional
from enum import Enum


class TaskStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoUrlRequest(BaseModel):
    video_url: str


class VideoUploadResponse(BaseModel):
    task_id: str
    status: str
    message: str


class VideoMetadata(BaseModel):
    duration: float
    fps: float
    resolution: str
    total_frames: int


class ProcessingResult(BaseModel):
    original_url: str
    processed_url: str
    pose_3d_url: str  # URL for 3D pose visualization
    metadata: VideoMetadata


class ProcessingStatusResponse(BaseModel):
    task_id: str
    status: TaskStatus
    progress: int  # 0-100
    message: str
    result: Optional[ProcessingResult] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    openpose_available: bool
    pose_engine: Optional[str] = None
