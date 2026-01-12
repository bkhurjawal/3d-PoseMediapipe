from celery import Celery, Task
from celery.result import AsyncResult
from app.config import settings
from app.services.video_processor import process_video, get_video_metadata
from app.services.file_manager import get_processed_path, get_video_url
from app.models import TaskStatus, ProcessingResult
from typing import Dict, Any

# Create Celery app
celery_app = Celery(
    "openpose_tasks",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_send_sent_event=True,
)


class CallbackTask(Task):
    """Custom task class with progress callback"""

    def update_progress(self, progress: int, message: str):
        """Update task progress"""
        self.update_state(
            state="PROCESSING",
            meta={
                "progress": progress,
                "message": message
            }
        )


@celery_app.task(bind=True, base=CallbackTask, name="process_video_task")
def process_video_task(self, task_id: str, input_path: str) -> Dict[str, Any]:
    """
    Celery task to process video with OpenPose

    Args:
        task_id: Unique task ID
        input_path: Path to input video

    Returns:
        Dict with processing results
    """
    try:
        # Update state to processing
        self.update_progress(0, "Starting video processing...")

        # Determine output path
        output_path = get_processed_path(task_id)

        # Progress callback
        def progress_callback(progress: int, message: str):
            self.update_progress(progress, message)

        # Process video
        metadata, output_3d_path = process_video(
            input_path=input_path,
            output_path=output_path,
            progress_callback=progress_callback
        )
        
        # No longer generating 3D video - using Interactive 3D Pose instead
        # Use processed video as fallback for pose_3d_url
        pose_3d_url = get_video_url(task_id, "processed")

        # Prepare result
        result = {
            "task_id": task_id,
            "status": TaskStatus.COMPLETED.value,
            "progress": 100,
            "message": "Processing completed successfully",
            "result": {
                "original_url": get_video_url(task_id, "original"),
                "processed_url": get_video_url(task_id, "processed"),
                "pose_3d_url": pose_3d_url,
                "metadata": {
                    "duration": metadata.duration,
                    "fps": metadata.fps,
                    "resolution": metadata.resolution,
                    "total_frames": metadata.total_frames
                }
            }
        }

        return result

    except Exception as e:
        error_msg = f"Video processing failed: {str(e)}"
        print(error_msg)

        # Return error result instead of raising to avoid Celery serialization issues
        return {
            "task_id": task_id,
            "status": TaskStatus.FAILED.value,
            "progress": 0,
            "message": error_msg,
            "result": None,
            "error": str(e)
        }


def get_task_status(task_id: str) -> Dict[str, Any]:
    """
    Get the status of a Celery task

    Args:
        task_id: Task ID

    Returns:
        Dict with task status information
    """
    task_result = AsyncResult(task_id, app=celery_app)

    if task_result.state == "PENDING":
        response = {
            "task_id": task_id,
            "status": TaskStatus.QUEUED.value,
            "progress": 0,
            "message": "Task is queued and waiting to be processed",
            "result": None
        }
    elif task_result.state == "PROCESSING":
        response = {
            "task_id": task_id,
            "status": TaskStatus.PROCESSING.value,
            "progress": task_result.info.get("progress", 0),
            "message": task_result.info.get("message", "Processing..."),
            "result": None
        }
    elif task_result.state == "SUCCESS":
        result_data = task_result.result
        # Check if the task actually failed but returned a result
        if isinstance(result_data, dict) and result_data.get("status") == TaskStatus.FAILED.value:
            response = {
                "task_id": task_id,
                "status": TaskStatus.FAILED.value,
                "progress": 0,
                "message": result_data.get("message", "Processing failed"),
                "result": None,
                "error": result_data.get("error", "Unknown error")
            }
        else:
            response = {
                "task_id": task_id,
                "status": TaskStatus.COMPLETED.value,
                "progress": 100,
                "message": result_data.get("message", "Processing completed"),
                "result": result_data.get("result")
            }
    elif task_result.state == "FAILURE":
        response = {
            "task_id": task_id,
            "status": TaskStatus.FAILED.value,
            "progress": 0,
            "message": str(task_result.info),
            "result": None,
            "error": str(task_result.info)
        }
    else:
        response = {
            "task_id": task_id,
            "status": task_result.state.lower(),
            "progress": 0,
            "message": f"Task state: {task_result.state}",
            "result": None
        }

    return response
