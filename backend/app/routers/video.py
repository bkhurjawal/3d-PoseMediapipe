from fastapi import APIRouter, UploadFile, File, HTTPException, Path as FastAPIPath
from fastapi.responses import FileResponse, StreamingResponse
from app.models import (
    VideoUrlRequest,
    VideoUploadResponse,
    ProcessingStatusResponse,
    TaskStatus
)
from app.services.file_manager import (
    generate_task_id,
    save_upload,
    cleanup_task_files,
    get_video_url
)
from app.services.video_downloader import download_video_from_url, validate_video_url
from app.services.video_processor import validate_video_file
from app.tasks.celery_tasks import process_video_task, get_task_status
from app.utils.exceptions import (
    VideoDownloadError,
    FileSizeExceededError,
    InvalidVideoFormat
)
from app.config import settings
import os
from pathlib import Path as PathLib
import glob

router = APIRouter()


@router.post("/video/upload", response_model=VideoUploadResponse)
async def upload_video(file: UploadFile = File(...)):
    """
    Upload a video file for processing

    Args:
        file: Video file upload

    Returns:
        VideoUploadResponse with task_id
    """
    try:
        # Validate file extension
        file_ext = PathLib(file.filename).suffix.lower()
        allowed_extensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv']

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file format. Allowed: {', '.join(allowed_extensions)}"
            )

        # Generate task ID
        task_id = generate_task_id()

        # Read and save file
        file_content = await file.read()
        file_path = await save_upload(file_content, file.filename, task_id)

        # Validate video file
        if not validate_video_file(file_path):
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail="Invalid video file. Cannot be opened or processed."
            )

        # Queue Celery task
        task = process_video_task.apply_async(
            args=[task_id, file_path],
            task_id=task_id
        )

        return VideoUploadResponse(
            task_id=task_id,
            status=TaskStatus.QUEUED.value,
            message="Video uploaded successfully and queued for processing"
        )

    except FileSizeExceededError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except InvalidVideoFormat as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/video/process-url", response_model=VideoUploadResponse)
async def process_video_url(request: VideoUrlRequest):
    """
    Process a video from a URL

    Args:
        request: VideoUrlRequest with video_url

    Returns:
        VideoUploadResponse with task_id
    """
    try:
        # Validate URL format
        if not validate_video_url(request.video_url):
            raise HTTPException(
                status_code=400,
                detail="Invalid video URL format"
            )

        # Generate task ID
        task_id = generate_task_id()

        # Download video
        try:
            file_path = await download_video_from_url(request.video_url, task_id)
        except VideoDownloadError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except FileSizeExceededError as e:
            raise HTTPException(status_code=413, detail=str(e))

        # Validate video file
        if not validate_video_file(file_path):
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail="Downloaded file is not a valid video"
            )

        # Queue Celery task
        task = process_video_task.apply_async(
            args=[task_id, file_path],
            task_id=task_id
        )

        return VideoUploadResponse(
            task_id=task_id,
            status=TaskStatus.QUEUED.value,
            message="Video downloaded successfully and queued for processing"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process video URL: {str(e)}"
        )


@router.get("/video/status/{task_id}", response_model=ProcessingStatusResponse)
async def get_video_status(task_id: str = FastAPIPath(..., description="Task ID")):
    """
    Get the processing status of a video

    Args:
        task_id: Unique task ID

    Returns:
        ProcessingStatusResponse with current status
    """
    try:
        status = get_task_status(task_id)
        return ProcessingStatusResponse(**status)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get task status: {str(e)}"
        )


@router.get("/video/serve/{video_type}/{task_id}")
async def serve_video(
    video_type: str = FastAPIPath(..., description="Video type: original, processed, or 3d"),
    task_id: str = FastAPIPath(..., description="Task ID")
):
    """
    Serve a video file

    Args:
        video_type: "original", "processed", or "3d"
        task_id: Unique task ID

    Returns:
        Video file stream
    """
    try:
        # Determine directory
        if video_type == "original":
            directory = settings.upload_dir
        elif video_type == "processed":
            directory = settings.processed_dir
        elif video_type == "3d":
            directory = settings.processed_dir  # 3D videos are also stored in processed dir
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid video type. Must be 'original', 'processed', or '3d'"
            )

        # Find file with task_id and suffix
        if video_type == "original":
            pattern = os.path.join(directory, f"{task_id}_original.*")
        elif video_type == "processed":
            pattern = os.path.join(directory, f"{task_id}_processed.*")
        else:  # video_type == "3d"
            pattern = os.path.join(directory, f"{task_id}_3d.*")

        files = glob.glob(pattern)

        # Filter to only video files (not JSON)
        video_files = [f for f in files if f.endswith(('.mp4', '.avi', '.mov', '.webm', '.mkv'))]

        if not video_files:
            raise HTTPException(
                status_code=404,
                detail=f"Video not found for task {task_id}"
            )

        file_path = video_files[0]

        # Return file
        return FileResponse(
            file_path,
            media_type="video/mp4",
            filename=os.path.basename(file_path)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to serve video: {str(e)}"
        )


@router.get("/video/landmarks/{task_id}")
async def get_landmarks(task_id: str = FastAPIPath(..., description="Task ID")):
    """
    Get the 3D pose landmarks data for a task

    Args:
        task_id: Unique task ID

    Returns:
        JSON with landmarks data
    """
    try:
        # Find landmarks file - try both patterns for compatibility
        directory = settings.processed_dir

        # Try direct pattern first (most common)
        pattern1 = os.path.join(directory, f"{task_id}_landmarks.json")
        if os.path.exists(pattern1):
            landmarks_path = pattern1
        else:
            # Fall back to wildcard pattern for backward compatibility
            pattern2 = os.path.join(directory, f"{task_id}_*_landmarks.json")
            files = glob.glob(pattern2)

            if not files:
                raise HTTPException(
                    status_code=404,
                    detail=f"Landmarks not found for task {task_id}"
                )

            landmarks_path = files[0]

        # Read and return landmarks
        import json
        with open(landmarks_path, 'r') as f:
            data = json.load(f)

        return data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load landmarks: {str(e)}"
        )


@router.delete("/video/{task_id}")
async def delete_video(task_id: str = FastAPIPath(..., description="Task ID")):
    """
    Delete all files associated with a task

    Args:
        task_id: Unique task ID

    Returns:
        Success message
    """
    try:
        cleanup_task_files(task_id)
        return {"message": f"Files for task {task_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete files: {str(e)}"
        )
