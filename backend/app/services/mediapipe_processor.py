import cv2
import numpy as np
import mediapipe as mp
from typing import Optional
from app.utils.exceptions import VideoProcessingError


class MediaPipeProcessor:
    """Handles MediaPipe Pose initialization and frame processing"""

    def __init__(self):
        self.pose_landmarker = None
        self.initialized = False
        self.pose_connections = [
            (0, 1), (1, 2), (2, 3), (3, 7), (0, 4), (4, 5), (5, 6), (6, 8),
            (9, 10), (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21),
            (17, 19), (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
            (11, 23), (12, 24), (23, 24), (23, 25), (25, 27), (27, 29), (27, 31),
            (29, 31), (24, 26), (26, 28), (28, 30), (28, 32), (30, 32)
        ]

    def initialize(self):
        """Initialize MediaPipe Pose"""
        if self.initialized:
            return

        try:
            # Create pose landmarker using the new tasks API
            from mediapipe.tasks import python
            from mediapipe.tasks.python import vision
            import os
            from pathlib import Path
            
            # Get the absolute model path
            # Navigate from this file to backend/models/pose_landmarker_heavy.task
            current_file = Path(__file__).resolve()
            backend_dir = current_file.parent.parent.parent  # Go up to backend/
            model_path = str(backend_dir / 'models' / 'pose_landmarker_heavy.task')
            
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found at: {model_path}")
            
            print(f"Loading MediaPipe model from: {model_path}")
            
            # Configure the pose landmarker
            base_options = python.BaseOptions(
                model_asset_path=model_path
            )
            options = vision.PoseLandmarkerOptions(
                base_options=base_options,
                running_mode=vision.RunningMode.IMAGE,
                num_poses=1,
                min_pose_detection_confidence=0.5,
                min_pose_presence_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            self.pose_landmarker = vision.PoseLandmarker.create_from_options(options)
            self.initialized = True
            print("✅ MediaPipe Pose initialized successfully (using Heavy model)")

        except Exception as e:
            print(f"❌ Failed to initialize MediaPipe Pose: {e}")
            raise VideoProcessingError(f"Failed to initialize MediaPipe Pose: {str(e)}")

    def process_frame(self, frame: np.ndarray) -> tuple[np.ndarray, list]:
        """
        Process a single frame with MediaPipe Pose

        Args:
            frame: Input frame as numpy array (BGR format)

        Returns:
            Tuple of (frame with pose overlay, world_landmarks for 3D)
        """
        if not self.initialized:
            self.initialize()

        try:
            # Convert BGR to RGB (MediaPipe requires RGB)
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Create MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)

            # Detect pose landmarks
            detection_result = self.pose_landmarker.detect(mp_image)
            
            # Extract world landmarks for 3D visualization
            world_landmarks = None
            if detection_result.pose_world_landmarks and len(detection_result.pose_world_landmarks) > 0:
                world_landmarks = detection_result.pose_world_landmarks[0]

            # Draw pose landmarks on the frame
            if detection_result.pose_landmarks:
                for pose_landmarks in detection_result.pose_landmarks:
                    # Draw landmarks
                    for idx, landmark in enumerate(pose_landmarks):
                        h, w, _ = frame.shape
                        cx, cy = int(landmark.x * w), int(landmark.y * h)
                        cv2.circle(frame, (cx, cy), 5, (0, 255, 0), -1)
                    
                    # Draw connections
                    for connection in self.pose_connections:
                        start_idx, end_idx = connection
                        if start_idx < len(pose_landmarks) and end_idx < len(pose_landmarks):
                            start = pose_landmarks[start_idx]
                            end = pose_landmarks[end_idx]
                            h, w, _ = frame.shape
                            start_point = (int(start.x * w), int(start.y * h))
                            end_point = (int(end.x * w), int(int(end.y * h)))
                            cv2.line(frame, start_point, end_point, (255, 0, 0), 2)

            return frame, world_landmarks

        except Exception as e:
            print(f"Error processing frame with MediaPipe: {e}")
            # Return original frame on error
            return frame, None

    def __del__(self):
        """Cleanup resources"""
        if self.pose_landmarker:
            self.pose_landmarker.close()


# Create a global MediaPipe processor instance
mediapipe_processor = MediaPipeProcessor()
