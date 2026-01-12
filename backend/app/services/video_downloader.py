import httpx
import os
from pathlib import Path
from app.config import settings
from app.utils.exceptions import VideoDownloadError, FileSizeExceededError


async def download_video_from_url(url: str, task_id: str) -> str:
    """
    Download video from URL

    Args:
        url: Video URL
        task_id: Unique task ID

    Returns:
        Path to downloaded file

    Raises:
        VideoDownloadError: If download fails
        FileSizeExceededError: If file size exceeds limit
    """
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Make HEAD request to check file size
            head_response = await client.head(url, follow_redirects=True)
            content_length = head_response.headers.get("content-length")

            if content_length and int(content_length) > settings.max_file_size:
                raise FileSizeExceededError(
                    f"Video file size ({content_length} bytes) exceeds maximum allowed size"
                )

            # Download the video
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()

            # Check actual size
            if len(response.content) > settings.max_file_size:
                raise FileSizeExceededError(
                    f"Video file size exceeds maximum allowed size of {settings.max_file_size} bytes"
                )

            # Determine file extension from URL or content-type
            extension = Path(url).suffix
            if not extension or extension not in ['.mp4', '.avi', '.mov', '.webm', '.mkv']:
                content_type = response.headers.get("content-type", "")
                if "mp4" in content_type:
                    extension = ".mp4"
                elif "webm" in content_type:
                    extension = ".webm"
                else:
                    extension = ".mp4"  # Default

            # Save file
            filename = f"{task_id}_original{extension}"
            file_path = os.path.join(settings.upload_dir, filename)

            with open(file_path, "wb") as f:
                f.write(response.content)

            return file_path

    except httpx.HTTPStatusError as e:
        raise VideoDownloadError(f"Failed to download video: HTTP {e.response.status_code}")
    except httpx.RequestError as e:
        raise VideoDownloadError(f"Failed to download video: {str(e)}")
    except Exception as e:
        raise VideoDownloadError(f"Unexpected error downloading video: {str(e)}")


def validate_video_url(url: str) -> bool:
    """
    Basic validation of video URL

    Args:
        url: Video URL to validate

    Returns:
        True if URL appears valid
    """
    if not url.startswith(("http://", "https://")):
        return False

    # Check if URL ends with common video extensions
    video_extensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.flv']
    url_lower = url.lower()

    # URL might not end with extension if it's a streaming URL
    # So we'll just check if it starts with http/https
    return True
