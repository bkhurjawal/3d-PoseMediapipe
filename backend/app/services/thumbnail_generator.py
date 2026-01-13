"""
Thumbnail generation service for video files
"""
import cv2
import os
from pathlib import Path


def generate_thumbnail(video_path: str, output_path: str, frame_number: int = 30) -> bool:
    """
    Generate a thumbnail from a video file

    Args:
        video_path: Path to the video file
        output_path: Path to save the thumbnail
        frame_number: Frame number to extract (default: 30, which is ~1 second at 30fps)

    Returns:
        True if successful, False otherwise
    """
    try:
        # Open video file
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            print(f"Failed to open video: {video_path}")
            return False

        # Get total frames
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Use middle frame if specified frame is out of range
        if frame_number >= total_frames:
            frame_number = total_frames // 2

        # Set frame position
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)

        # Read frame
        ret, frame = cap.read()

        if not ret:
            print(f"Failed to read frame {frame_number} from {video_path}")
            cap.release()
            return False

        # Resize to thumbnail size (maintain aspect ratio)
        height, width = frame.shape[:2]
        thumbnail_width = 400
        thumbnail_height = int(height * (thumbnail_width / width))

        thumbnail = cv2.resize(frame, (thumbnail_width, thumbnail_height))

        # Save thumbnail
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, thumbnail)

        cap.release()
        return True

    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return False


def get_or_generate_thumbnail(video_path: str, task_id: str, thumbnails_dir: str) -> str:
    """
    Get existing thumbnail or generate a new one

    Args:
        video_path: Path to the video file
        task_id: Unique task identifier
        thumbnails_dir: Directory to store thumbnails

    Returns:
        Path to the thumbnail file, or empty string if failed
    """
    thumbnail_path = os.path.join(thumbnails_dir, f"{task_id}_thumb.jpg")

    # If thumbnail already exists, return it
    if os.path.exists(thumbnail_path):
        return thumbnail_path

    # Generate new thumbnail
    if generate_thumbnail(video_path, thumbnail_path):
        return thumbnail_path

    return ""
