import cv2
import numpy as np
from typing import List, Tuple, Optional
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.backends.backend_agg import FigureCanvasAgg


class Pose3DRenderer:
    """Renders 3D pose landmarks as a video"""
    
    # MediaPipe Pose landmark connections
    POSE_CONNECTIONS = [
        (0, 1), (1, 2), (2, 3), (3, 7),  # Face
        (0, 4), (4, 5), (5, 6), (6, 8),  # Face
        (9, 10),  # Mouth
        (11, 12),  # Shoulders
        (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),  # Left arm
        (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),  # Right arm
        (11, 23), (12, 24), (23, 24),  # Torso
        (23, 25), (25, 27), (27, 29), (27, 31), (29, 31),  # Left leg
        (24, 26), (26, 28), (28, 30), (28, 32), (30, 32),  # Right leg
    ]
    
    def __init__(self, width: int = 640, height: int = 480, dpi: int = 120):
        """
        Initialize the 3D renderer
        
        Args:
            width: Output video width
            height: Output video height
            dpi: DPI for matplotlib figure (higher = better quality)
        """
        self.width = width
        self.height = height
        self.dpi = dpi
        # Increase figure size for better visibility
        self.fig_width = width / dpi
        self.fig_height = height / dpi
        
    def render_frame(self, world_landmarks: List) -> np.ndarray:
        """
        Render a single frame with 3D pose landmarks
        
        Args:
            world_landmarks: List of 3D landmarks with x, y, z coordinates
            
        Returns:
            Frame as numpy array (BGR format)
        """
        # Create figure with tight layout
        fig = plt.figure(figsize=(self.fig_width, self.fig_height), dpi=self.dpi)
        ax = fig.add_subplot(111, projection='3d')
        
        # Reduce margins to make pose bigger
        fig.subplots_adjust(left=0, right=1, top=0.95, bottom=0.05)
        
        # Extract coordinates
        if not world_landmarks or len(world_landmarks) == 0:
            # Return black frame if no landmarks
            plt.close(fig)
            return np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        xs = [lm.x for lm in world_landmarks]
        ys = [lm.y for lm in world_landmarks]
        zs = [lm.z for lm in world_landmarks]
        
        # Calculate bounds for better framing
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)
        z_min, z_max = min(zs), max(zs)
        
        # Add minimal padding (10% on each side) for larger pose
        x_range = x_max - x_min
        y_range = y_max - y_min
        z_range = z_max - z_min
        padding = 0.1
        
        x_center = (x_min + x_max) / 2
        y_center = (y_min + y_max) / 2
        z_center = (z_min + z_max) / 2
        
        # Use the maximum range to keep aspect ratio
        max_range = max(x_range, y_range, z_range) * (1 + padding)
        
        # Plot landmarks with larger markers
        ax.scatter(xs, ys, zs, c='#FF4444', marker='o', s=100, alpha=0.9, edgecolors='white', linewidths=1)
        
        # Plot connections with thicker lines
        for connection in self.POSE_CONNECTIONS:
            start_idx, end_idx = connection
            if start_idx < len(world_landmarks) and end_idx < len(world_landmarks):
                ax.plot(
                    [xs[start_idx], xs[end_idx]],
                    [ys[start_idx], ys[end_idx]],
                    [zs[start_idx], zs[end_idx]],
                    '#00AAFF', linewidth=3, alpha=0.8
                )
        
        # Set viewing angle to FRONT VIEW for easy comparison with original video
        # Elevation: 10° (slightly above), Azimuth: 0° (front view)
        ax.view_init(elev=10, azim=0)
        
        # Set axis limits based on actual pose bounds
        ax.set_xlim([x_center - max_range/2, x_center + max_range/2])
        ax.set_ylim([y_center - max_range/2, y_center + max_range/2])
        ax.set_zlim([z_center - max_range/2, z_center + max_range/2])
        
        # Labels with better styling
        ax.set_xlabel('X', fontsize=10, color='white')
        ax.set_ylabel('Y', fontsize=10, color='white')
        ax.set_zlabel('Z', fontsize=10, color='white')
        ax.set_title('3D Pose Reconstruction', fontsize=14, pad=15, color='white', weight='bold')
        
        # Set background colors
        ax.set_facecolor('#1a1a1a')
        fig.patch.set_facecolor('#0a0a0a')
        
        # Improve grid visibility
        ax.grid(True, alpha=0.2, color='white')
        
        # Set tick colors
        ax.tick_params(colors='white', labelsize=8)
        
        # Remove panes for cleaner look
        ax.xaxis.pane.fill = False
        ax.yaxis.pane.fill = False
        ax.zaxis.pane.fill = False
        ax.xaxis.pane.set_edgecolor('w')
        ax.yaxis.pane.set_edgecolor('w')
        ax.zaxis.pane.set_edgecolor('w')
        ax.xaxis.pane.set_alpha(0.1)
        ax.yaxis.pane.set_alpha(0.1)
        ax.zaxis.pane.set_alpha(0.1)
        
        # Convert figure to image
        canvas = FigureCanvasAgg(fig)
        canvas.draw()
        
        # Get the RGBA buffer from the figure
        buf = np.frombuffer(canvas.buffer_rgba(), dtype=np.uint8)
        buf = buf.reshape(fig.canvas.get_width_height()[::-1] + (4,))
        
        # Convert RGBA to BGR
        frame = cv2.cvtColor(buf, cv2.COLOR_RGBA2BGR)
        
        plt.close(fig)
        
        return frame
    
    def create_video(
        self,
        world_landmarks_sequence: List[List],
        output_path: str,
        fps: float
    ) -> None:
        """
        Create a video from a sequence of 3D landmarks
        
        Args:
            world_landmarks_sequence: List of landmark lists for each frame
            output_path: Path to save the output video
            fps: Frames per second
        """
        if not world_landmarks_sequence:
            raise ValueError("No landmarks provided")
        
        # Use H.264 codec for browser compatibility
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(output_path, fourcc, fps, (self.width, self.height))
        
        # If avc1 fails, try mp4v as fallback
        if not out.isOpened():
            print("⚠️ H.264 (avc1) codec not available for 3D video, falling back to mp4v")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (self.width, self.height))
        
        if not out.isOpened():
            raise RuntimeError(f"Cannot create output video: {output_path}")
        
        total_frames = len(world_landmarks_sequence)
        for i, world_landmarks in enumerate(world_landmarks_sequence):
            if i % 10 == 0:
                print(f"Rendering 3D frame {i+1}/{total_frames}...")
            
            frame = self.render_frame(world_landmarks)
            out.write(frame)
        
        out.release()
        print(f"✅ 3D video saved to: {output_path}")
