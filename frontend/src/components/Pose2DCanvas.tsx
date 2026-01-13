import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Button,
  ButtonGroup,
} from '@mui/material';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import { getLandmarks } from '../services/api';

interface Pose2DCanvasProps {
  taskId: string;
  currentFrame: number;
  width?: string | number;
  height?: string | number;
}

// MediaPipe Pose connections
const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], // Face
  [0, 4], [4, 5], [5, 6], [6, 8], // Face
  [9, 10], // Mouth
  [11, 12], // Shoulders
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], // Left arm
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], // Right arm
  [11, 23], [12, 24], [23, 24], // Torso
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31], // Left leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32], // Right leg
];

// Body part colors
const BODY_COLORS = {
  face: '#FFD700',        // Gold
  leftArm: '#FF4444',     // Red
  rightArm: '#4444FF',    // Blue
  leftLeg: '#FF8844',     // Orange
  rightLeg: '#44AAFF',    // Light Blue
  torso: '#44FF44',       // Green
  joints: '#FFFFFF',      // White
};

export const Pose2DCanvas: React.FC<Pose2DCanvasProps> = ({
  taskId,
  currentFrame,
  width = '100%',
  height = '100%',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarksRef = useRef<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);
  const [viewAngle, setViewAngle] = useState<'front' | 'side' | 'top'>('front');
  const [scale, setScale] = useState(1.5);

  // Load landmark data
  useEffect(() => {
    const loadLandmarks = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Loading landmarks for task: ${taskId}`);
        const data = await getLandmarks(taskId);
        console.log(`Loaded ${data.landmarks?.length || 0} frames of landmark data`);

        if (!data.landmarks || data.landmarks.length === 0) {
          throw new Error('No landmark data available');
        }

        landmarksRef.current = data.landmarks;
        setTotalFrames(data.landmarks.length);
        setLoading(false);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load landmarks';
        console.error('Error loading landmarks:', errorMsg);
        setError(errorMsg);
        setLoading(false);
      }
    };
    loadLandmarks();
  }, [taskId]);

  // Get connection color based on body part
  const getConnectionColor = (start: number, end: number): string => {
    // Face
    if (start <= 10 && end <= 10) return BODY_COLORS.face;

    // Left arm (11, 13, 15, 17, 19, 21)
    if ([11, 13, 15, 17, 19, 21].includes(start) && [11, 13, 15, 17, 19, 21].includes(end)) {
      return BODY_COLORS.leftArm;
    }

    // Right arm (12, 14, 16, 18, 20, 22)
    if ([12, 14, 16, 18, 20, 22].includes(start) && [12, 14, 16, 18, 20, 22].includes(end)) {
      return BODY_COLORS.rightArm;
    }

    // Left leg (23, 25, 27, 29, 31)
    if ([23, 25, 27, 29, 31].includes(start) && [23, 25, 27, 29, 31].includes(end)) {
      return BODY_COLORS.leftLeg;
    }

    // Right leg (24, 26, 28, 30, 32)
    if ([24, 26, 28, 30, 32].includes(start) && [24, 26, 28, 30, 32].includes(end)) {
      return BODY_COLORS.rightLeg;
    }

    // Torso
    return BODY_COLORS.torso;
  };

  // Draw pose on canvas
  const drawPose = (frameIndex: number) => {
    if (!canvasRef.current || !landmarksRef.current[frameIndex]) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const landmarks = landmarksRef.current[frameIndex];

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get canvas dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // First pass: find bounds of all landmarks for proper scaling
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    landmarks.forEach((lm: any) => {
      let x, y;
      switch (viewAngle) {
        case 'front':
          x = lm.x;
          y = -lm.y;
          break;
        case 'side':
          x = -lm.z;
          y = -lm.y;
          break;
        case 'top':
          x = lm.x;
          y = -lm.z;
          break;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });

    // Calculate scale to fit the skeleton in the canvas
    const padding = 80;
    const availableWidth = canvasWidth - 2 * padding;
    const availableHeight = canvasHeight - 2 * padding;

    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;

    const scaleX = availableWidth / (dataWidth || 1);
    const scaleY = availableHeight / (dataHeight || 1);
    const autoScale = Math.min(scaleX, scaleY) * 0.8; // 80% of available space

    // Calculate center offset
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Project landmarks to 2D based on view angle
    const project2D = (lm: any): { x: number; y: number } => {
      let x, y;

      switch (viewAngle) {
        case 'front':
          x = lm.x;
          y = -lm.y;
          break;
        case 'side':
          x = -lm.z;
          y = -lm.y;
          break;
        case 'top':
          x = lm.x;
          y = -lm.z;
          break;
      }

      // Apply scaling and centering
      const scaledX = (x - centerX) * autoScale * scale;
      const scaledY = (y - centerY) * autoScale * scale;

      return {
        x: canvasWidth / 2 + scaledX,
        y: canvasHeight / 2 + scaledY,
      };
    };

    // Draw connections (bones)
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';

    POSE_CONNECTIONS.forEach(([start, end]) => {
      if (start < landmarks.length && end < landmarks.length) {
        const startPos = project2D(landmarks[start]);
        const endPos = project2D(landmarks[end]);

        // Get color for this connection
        const color = getConnectionColor(start, end);

        // Draw shadow/outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();

        // Draw main line
        ctx.strokeStyle = color;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();
      }
    });

    // Draw joints (landmarks)
    landmarks.forEach((lm: any, index: number) => {
      const pos = project2D(lm);

      // Outer circle (border/shadow)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI);
      ctx.fill();

      // Inner circle (joint)
      ctx.fillStyle = BODY_COLORS.joints;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 9, 0, 2 * Math.PI);
      ctx.fill();

      // Highlight key joints
      if ([11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(index)) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 14, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });

    // Draw labels with background
    ctx.font = 'bold 16px Arial';

    const viewText = `View: ${viewAngle.toUpperCase()}`;
    const frameText = `Frame: ${frameIndex + 1}/${totalFrames}`;

    // Background for view label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 140, 60);

    // View text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(viewText, 20, 32);
    ctx.fillText(frameText, 20, 55);
  };

  // Update canvas when frame changes
  useEffect(() => {
    if (currentFrame >= 0 && currentFrame < totalFrames) {
      drawPose(currentFrame);
    }
  }, [currentFrame, totalFrames, viewAngle, scale]);

  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!canvasRef.current || !containerRef.current) return;

      const container = containerRef.current;
      canvasRef.current.width = container.clientWidth;
      canvasRef.current.height = container.clientHeight;

      // Redraw after resize
      if (currentFrame >= 0 && currentFrame < totalFrames) {
        drawPose(currentFrame);
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [currentFrame, totalFrames]);

  const handleReset = () => {
    setScale(1.5);
    setViewAngle('front');
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.3));
  };

  return (
    <Box
      sx={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#1a1a2e',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid #333' }}>
        <Typography
          variant="h6"
          sx={{
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: '1rem',
          }}
        >
          <ViewInArIcon fontSize="small" /> Interactive 2D Pose
        </Typography>
      </Box>

      {/* Canvas */}
      <Box ref={containerRef} sx={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
        {loading && !error && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              textAlign: 'center',
              zIndex: 10,
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              p: 2,
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">Loading pose data...</Typography>
          </Box>
        )}
        {error && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#ff4444',
              textAlign: 'center',
              p: 2,
              zIndex: 10,
            }}
          >
            <Typography variant="body2" sx={{ mb: 1 }}>
              Failed to load 2D data
            </Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>
              {error}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ p: 1.5, borderTop: '1px solid #333', bgcolor: '#1a1a1a' }}>
        <Stack spacing={1.5}>
          {/* View controls */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={() => setViewAngle('front')}
                variant={viewAngle === 'front' ? 'contained' : 'outlined'}
              >
                Front
              </Button>
              <Button
                onClick={() => setViewAngle('side')}
                variant={viewAngle === 'side' ? 'contained' : 'outlined'}
              >
                Side
              </Button>
              <Button
                onClick={() => setViewAngle('top')}
                variant={viewAngle === 'top' ? 'contained' : 'outlined'}
              >
                Top
              </Button>
            </ButtonGroup>

            <Stack direction="row" spacing={0.5}>
              <IconButton
                onClick={handleZoomIn}
                sx={{ color: 'white' }}
                title="Zoom In"
                size="small"
              >
                +
              </IconButton>
              <IconButton
                onClick={handleZoomOut}
                sx={{ color: 'white' }}
                title="Zoom Out"
                size="small"
              >
                -
              </IconButton>
              <IconButton
                onClick={handleReset}
                sx={{ color: 'white' }}
                title="Reset View"
                size="small"
              >
                <RotateLeftIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {/* Legend */}
          <Stack direction="row" spacing={2} sx={{ fontSize: '0.75rem', color: '#888', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 4, bgcolor: BODY_COLORS.leftArm, borderRadius: 1 }} />
              <span>Left Arm</span>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 4, bgcolor: BODY_COLORS.rightArm, borderRadius: 1 }} />
              <span>Right Arm</span>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 4, bgcolor: BODY_COLORS.leftLeg, borderRadius: 1 }} />
              <span>Left Leg</span>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 4, bgcolor: BODY_COLORS.rightLeg, borderRadius: 1 }} />
              <span>Right Leg</span>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
