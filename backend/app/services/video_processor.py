import cv2
import os
import sys
import numpy as np
from pathlib import Path
from typing import Tuple, Optional, Callable
from app.config import settings
from app.utils.exceptions import VideoProcessingError, InvalidVideoFormat
from app.models import VideoMetadata


class OpenPoseProcessor:
    """Handles OpenPose initialization and frame processing"""

    def __init__(self):
        self.openpose = None
        self.params = None
        self.initialized = False

    def initialize(self):
        """Initialize OpenPose"""
        if self.initialized:
            return

        try:
            # Add OpenPose Python path
            sys.path.append(f"{settings.openpose_root}/build/python")

            # Import OpenPose
            from openpose import pyopenpose as op

            # Set parameters
            self.params = {
                "model_folder": f"{settings.openpose_root}/models/",
                "model_pose": settings.openpose_model,
                "net_resolution": settings.openpose_net_resolution,
                "render_threshold": settings.openpose_render_threshold,
            }

            # Add GPU settings if enabled
            if settings.use_gpu:
                self.params["num_gpu"] = 1
                self.params["num_gpu_start"] = 0
            else:
                self.params["num_gpu"] = 0

            # Create OpenPose wrapper
            opWrapper = op.WrapperPython()
            opWrapper.configure(self.params)
            opWrapper.start()

            self.openpose = opWrapper
            self.initialized = True
            print("✅ OpenPose initialized successfully")

        except Exception as e:
            print(f"❌ Failed to initialize OpenPose: {e}")
            raise VideoProcessingError(f"Failed to initialize OpenPose: {str(e)}")

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Process a single frame with OpenPose

        Args:
            frame: Input frame as numpy array

        Returns:
            Frame with pose overlay
        """
        if not self.initialized:
            self.initialize()

        try:
            # Create datum
            from openpose import pyopenpose as op
            datum = op.Datum()
            datum.cvInputData = frame

            # Process frame
            self.openpose.emplaceAndPop(op.VectorDatum([datum]))

            # Return rendered frame
            return datum.cvOutputData if datum.cvOutputData is not None else frame

        except Exception as e:
            print(f"Error processing frame: {e}")
            # Return original frame on error
            return frame


# Import MediaPipe processor
from app.services.mediapipe_processor import mediapipe_processor

# Global processor instance - will be selected based on config
processor = None


def get_processor():
    """Get the appropriate processor based on configuration"""
    global processor

    if processor is None:
        if settings.pose_engine.lower() == "mediapipe":
            print("Using MediaPipe Pose engine")
            processor = mediapipe_processor
        else:
            print("Using OpenPose engine")
            processor = OpenPoseProcessor()

    return processor


def get_video_metadata(video_path: str) -> VideoMetadata:
    """
    Extract video metadata

    Args:
        video_path: Path to video file

    Returns:
        VideoMetadata object
    """
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise InvalidVideoFormat(f"Cannot open video file: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0

    cap.release()

    return VideoMetadata(
        duration=duration,
        fps=fps,
        resolution=f"{width}x{height}",
        total_frames=total_frames
    )


def process_video(
    input_path: str,
    output_path: str,
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> Tuple[VideoMetadata, Optional[str]]:
    """
    Process video with pose detection

    Args:
        input_path: Path to input video
        output_path: Path to save processed video
        progress_callback: Optional callback function(progress_percent, message)

    Returns:
        Tuple of (VideoMetadata object, path to 3D video or None)

    Raises:
        VideoProcessingError: If processing fails
    """
    try:
        # Get and initialize processor
        proc = get_processor()
        engine_name = "MediaPipe" if settings.pose_engine.lower() == "mediapipe" else "OpenPose"

        if progress_callback:
            progress_callback(5, f"Initializing {engine_name}...")
        proc.initialize()

        # Open input video
        if progress_callback:
            progress_callback(10, "Opening video file...")
        cap = cv2.VideoCapture(input_path)

        if not cap.isOpened():
            raise InvalidVideoFormat(f"Cannot open video file: {input_path}")

        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Use H.264 codec for browser compatibility
        # Try avc1 first (H.264), fallback to mp4v if not available
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        
        # Create video writer
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # If avc1 fails, try mp4v as fallback
        if not out.isOpened():
            print("⚠️ H.264 (avc1) codec not available, falling back to mp4v")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        if not out.isOpened():
            raise VideoProcessingError(f"Cannot create output video: {output_path}")

        # Process frames
        frame_count = 0
        world_landmarks_sequence = []  # Store 3D landmarks for each frame
        
        if progress_callback:
            progress_callback(15, f"Processing frames (0/{total_frames})...")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Process frame with selected pose engine
            result = proc.process_frame(frame)
            
            # Handle different return types (OpenPose vs MediaPipe)
            if isinstance(result, tuple):
                processed_frame, world_landmarks = result
                if world_landmarks is not None:
                    world_landmarks_sequence.append(world_landmarks)
            else:
                processed_frame = result

            # Write processed frame
            out.write(processed_frame)

            frame_count += 1

            # Update progress
            if progress_callback and frame_count % 10 == 0:
                progress = 15 + int((frame_count / total_frames) * 75)  # 15-90% for frame processing
                progress_callback(
                    progress,
                    f"Processing frames ({frame_count}/{total_frames})..."
                )

        # Release resources
        cap.release()
        out.release()
        
        # Save landmarks for Interactive 3D Pose viewer (skip 3D video rendering)
        output_3d_path = None
        if world_landmarks_sequence and len(world_landmarks_sequence) > 0:
            if progress_callback:
                progress_callback(80, "Saving pose landmarks...")

            try:
                import json

                # Save landmarks to JSON file for Interactive 3D Pose viewer
                landmarks_path = output_path.replace('_processed.mp4', '_landmarks.json')

                # Convert Landmark objects to dictionaries for JSON serialization
                landmarks_data = []
                for frame_landmarks in world_landmarks_sequence:
                    frame_data = []
                    for landmark in frame_landmarks:
                        # Convert MediaPipe Landmark to dict
                        frame_data.append({
                            'x': landmark.x,
                            'y': landmark.y,
                            'z': landmark.z,
                            'visibility': getattr(landmark, 'visibility', 1.0)
                        })
                    landmarks_data.append(frame_data)

                with open(landmarks_path, 'w') as f:
                    json.dump({'landmarks': landmarks_data}, f)
                print(f"✅ Saved landmarks to: {landmarks_path}")
                print(f"ℹ️  Skipping 3D video rendering (using Interactive 3D Pose instead)")

            except Exception as e:
                print(f"⚠️ Failed to save landmarks: {e}")

        if progress_callback:
            progress_callback(90, "Finalizing video...")

        # Get metadata
        metadata = get_video_metadata(output_path)

        if progress_callback:
            progress_callback(100, "Processing complete!")

        return metadata, output_3d_path

    except Exception as e:
        print(f"Error processing video: {e}")
        raise VideoProcessingError(f"Video processing failed: {str(e)}")

    finally:
        # Ensure resources are released
        try:
            cap.release()
            out.release()
        except:
            pass


def validate_video_file(file_path: str) -> bool:
    """
    Validate video file can be opened

    Args:
        file_path: Path to video file

    Returns:
        True if valid
    """
    try:
        cap = cv2.VideoCapture(file_path)
        is_valid = cap.isOpened()
        cap.release()
        return is_valid
    except:
        return False
