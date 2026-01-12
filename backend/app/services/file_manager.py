import os
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from app.config import settings
from app.utils.exceptions import FileSizeExceededError


def generate_task_id() -> str:
    """Generate a unique task ID"""
    return str(uuid.uuid4())


async def save_upload(file_content: bytes, filename: str, task_id: str) -> str:
    """
    Save uploaded file to uploads directory

    Args:
        file_content: File content as bytes
        filename: Original filename
        task_id: Unique task ID

    Returns:
        Path to saved file
    """
    # Check file size
    if len(file_content) > settings.max_file_size:
        raise FileSizeExceededError(
            f"File size exceeds maximum allowed size of {settings.max_file_size} bytes"
        )

    # Create filename with task_id
    extension = Path(filename).suffix
    new_filename = f"{task_id}_original{extension}"
    file_path = os.path.join(settings.upload_dir, new_filename)

    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)

    return file_path


def get_processed_filename(task_id: str, extension: str = ".mp4") -> str:
    """Get the filename for processed video"""
    return f"{task_id}_processed{extension}"


def get_processed_path(task_id: str, extension: str = ".mp4") -> str:
    """Get the full path for processed video"""
    filename = get_processed_filename(task_id, extension)
    return os.path.join(settings.processed_dir, filename)


def cleanup_old_files():
    """Clean up files older than VIDEO_EXPIRY_HOURS"""
    expiry_time = datetime.now() - timedelta(hours=settings.video_expiry_hours)

    for directory in [settings.upload_dir, settings.processed_dir, settings.temp_dir]:
        if not os.path.exists(directory):
            continue

        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            if os.path.isfile(file_path):
                file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_mtime < expiry_time:
                    try:
                        os.remove(file_path)
                        print(f"Cleaned up expired file: {file_path}")
                    except Exception as e:
                        print(f"Error cleaning up file {file_path}: {e}")


def cleanup_task_files(task_id: str):
    """Clean up all files associated with a task"""
    patterns = [
        os.path.join(settings.upload_dir, f"{task_id}_*"),
        os.path.join(settings.processed_dir, f"{task_id}_*"),
        os.path.join(settings.temp_dir, f"{task_id}_*"),
    ]

    import glob
    for pattern in patterns:
        for file_path in glob.glob(pattern):
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
                print(f"Deleted: {file_path}")
            except Exception as e:
                print(f"Error deleting {file_path}: {e}")


def get_video_url(task_id: str, video_type: str) -> str:
    """Get the URL for a video"""
    if video_type == "original":
        return f"/api/v1/video/serve/original/{task_id}"
    elif video_type == "3d":
        return f"/api/v1/video/serve/3d/{task_id}"
    else:
        return f"/api/v1/video/serve/processed/{task_id}"
