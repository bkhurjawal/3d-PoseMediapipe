import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
  Box,
  IconButton,
  Stack,
  Slider,
  Typography,
  Button,
  ButtonGroup,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import { getLandmarks } from '../services/api';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ViewInArIcon from '@mui/icons-material/ViewInAr';

interface Pose3DViewerProps {
  taskId: string;
  onClose?: () => void;
}

// MediaPipe Pose connections
const POSE_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7], // Face
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8], // Face
  [9, 10], // Mouth
  [11, 12], // Shoulders
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19], // Left arm
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20], // Right arm
  [11, 23],
  [12, 24],
  [23, 24], // Torso
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [29, 31], // Left leg
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
  [30, 32], // Right leg
];

export const Pose3DViewer: React.FC<Pose3DViewerProps> = ({
  taskId,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const skeletonGroupRef = useRef<THREE.Group | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera - positioned closer for bigger pose view
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 1.8);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(2, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);

    // Skeleton group
    const skeletonGroup = new THREE.Group();
    scene.add(skeletonGroup);
    skeletonGroupRef.current = skeletonGroup;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // Load landmark data
  useEffect(() => {
    const loadLandmarks = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Loading landmarks for task: ${taskId}`);
        const data = await getLandmarks(taskId);
        console.log(
          `Loaded ${data.landmarks?.length || 0} frames of landmark data`
        );

        if (!data.landmarks || data.landmarks.length === 0) {
          throw new Error('No landmark data available');
        }

        landmarksRef.current = data.landmarks;
        setTotalFrames(data.landmarks.length);
        setLoading(false);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to load landmarks';
        console.error('Error loading landmarks:', errorMsg);
        setError(errorMsg);
        setLoading(false);
      }
    };
    loadLandmarks();
  }, [taskId]);

  // Render skeleton for current frame
  const renderSkeleton = (frameIndex: number) => {
    if (!skeletonGroupRef.current || !landmarksRef.current[frameIndex]) return;

    // Clear previous skeleton
    while (skeletonGroupRef.current.children.length > 0) {
      skeletonGroupRef.current.remove(skeletonGroupRef.current.children[0]);
    }

    const landmarks = landmarksRef.current[frameIndex];

    const HIDDEN_INDICES = new Set([
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10, // Face
      17,
      18,
      19,
      20,
      21,
      22, // Fingers
      31,
      32, // Toes
    ]);

    // Helper to get raw position
    const getRawPos = (idx: number) => landmarks[idx];

    // Render Head
    const nose = getRawPos(0);
    const leftEar = getRawPos(7);
    const rightEar = getRawPos(8);

    if (nose && leftEar && rightEar) {
      const headCenter = new THREE.Vector3(
        (leftEar.x + rightEar.x) / 2,
        (nose.y + leftEar.y + rightEar.y) / 3, // Approximate center
        (leftEar.z + rightEar.z) / 2
      );
      // Invert for 3D space
      const finalHeadPos = new THREE.Vector3(
        headCenter.x,
        -headCenter.y,
        -headCenter.z
      );

      const headWidth = Math.abs(leftEar.x - rightEar.x) * 0.8 || 0.15; // Fallback size if single point
      const headGeometry = new THREE.SphereGeometry(1, 16, 16);
      // Scale to make an ellipsoid
      headGeometry.scale(headWidth, headWidth * 1.3, headWidth);

      const headMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff });
      const headMesh = new THREE.Mesh(headGeometry, headMaterial);
      headMesh.position.copy(finalHeadPos);
      skeletonGroupRef.current!.add(headMesh);
    }

    // Create landmarks (spheres)
    landmarks.forEach((lm: any, index: number) => {
      if (HIDDEN_INDICES.has(index)) return;

      const geometry = new THREE.SphereGeometry(0.02, 16, 16); // Reduced size
      const material = new THREE.MeshStandardMaterial({ color: 0x00ffff });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(lm.x, -lm.y, -lm.z); // Invert Y and Z for proper orientation
      skeletonGroupRef.current!.add(sphere);
    });

    // Create connections (lines)
    POSE_CONNECTIONS.forEach(([start, end]) => {
      // Skip connections if either point is hidden
      if (HIDDEN_INDICES.has(start) || HIDDEN_INDICES.has(end)) return;

      if (start < landmarks.length && end < landmarks.length) {
        const points = [
          new THREE.Vector3(
            landmarks[start].x,
            -landmarks[start].y,
            -landmarks[start].z
          ),
          new THREE.Vector3(
            landmarks[end].x,
            -landmarks[end].y,
            -landmarks[end].z
          ),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          linewidth: 2,
        });
        const line = new THREE.Line(geometry, material);
        skeletonGroupRef.current!.add(line);
      }
    });
  };

  // Playback controls
  useEffect(() => {
    if (!isPlaying || totalFrames === 0) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        const next = (prev + 1) % totalFrames;
        renderSkeleton(next);
        return next;
      });
    }, 1000 / 25); // 25 FPS

    return () => clearInterval(interval);
  }, [isPlaying, totalFrames]);

  // Update skeleton when frame changes
  useEffect(() => {
    renderSkeleton(currentFrame);
  }, [currentFrame]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleFrameChange = (_: Event, value: number | number[]) => {
    const frame = value as number;
    setCurrentFrame(frame);
    renderSkeleton(frame);
  };

  const handleResetView = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(0, 0, 1.8);
      controlsRef.current.reset();
    }
  };

  const handleZoomIn = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const direction = new THREE.Vector3();
    cameraRef.current.getWorldDirection(direction);
    cameraRef.current.position.addScaledVector(direction, 0.2);
    controlsRef.current.update();
  };

  const handleZoomOut = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const direction = new THREE.Vector3();
    cameraRef.current.getWorldDirection(direction);
    cameraRef.current.position.addScaledVector(direction, -0.2);
    controlsRef.current.update();
  };

  const handleViewPreset = (preset: 'front' | 'side' | 'top') => {
    if (!cameraRef.current || !controlsRef.current) return;

    switch (preset) {
      case 'front':
        cameraRef.current.position.set(0, 0, 1.8);
        break;
      case 'side':
        cameraRef.current.position.set(1.8, 0, 0);
        break;
      case 'top':
        cameraRef.current.position.set(0, 1.8, 0);
        break;
    }
    controlsRef.current.update();
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0a0a0a',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography
            variant="h5"
            sx={{
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ViewInArIcon /> Interactive 3D Pose Viewer
          </Typography>
          {onClose && (
            <Button variant="outlined" onClick={onClose}>
              Close
            </Button>
          )}
        </Stack>
      </Box>

      {/* 3D Canvas */}
      <Box ref={containerRef} sx={{ flex: 1, position: 'relative' }}>
        {loading && !error && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              textAlign: 'center',
            }}
          >
            <Typography>Loading 3D data...</Typography>
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
            }}
          >
            <Typography variant="h6" sx={{ mb: 1 }}>
              Failed to load 3D data
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              {error}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ p: 2, borderTop: '1px solid #333', bgcolor: '#1a1a1a' }}>
        <Stack spacing={2}>
          {/* Playback controls */}
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton onClick={handlePlayPause} sx={{ color: 'white' }}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <Slider
              value={currentFrame}
              onChange={handleFrameChange}
              min={0}
              max={totalFrames - 1}
              sx={{ flex: 1, color: '#00aaff' }}
            />
            <Typography sx={{ color: 'white', minWidth: 80 }}>
              {currentFrame} / {totalFrames}
            </Typography>
          </Stack>

          {/* View controls */}
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
          >
            <ButtonGroup variant="outlined" size="small">
              <Button onClick={() => handleViewPreset('front')}>Front</Button>
              <Button onClick={() => handleViewPreset('side')}>Side</Button>
              <Button onClick={() => handleViewPreset('top')}>Top</Button>
            </ButtonGroup>

            <Stack direction="row" spacing={1}>
              <IconButton
                onClick={handleZoomIn}
                sx={{ color: 'white' }}
                title="Zoom In"
              >
                <ZoomInIcon />
              </IconButton>
              <IconButton
                onClick={handleZoomOut}
                sx={{ color: 'white' }}
                title="Zoom Out"
              >
                <ZoomOutIcon />
              </IconButton>
              <IconButton
                onClick={handleResetView}
                sx={{ color: 'white' }}
                title="Reset View"
              >
                <RotateLeftIcon />
              </IconButton>
            </Stack>
          </Stack>

          {/* Instructions */}
          <Typography
            variant="caption"
            sx={{ color: '#888', textAlign: 'center' }}
          >
            🖱️ Left click + drag to rotate • Scroll to zoom • Right click + drag
            to pan
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
