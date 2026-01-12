import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Button,
  ButtonGroup,
} from '@mui/material';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import { getLandmarks } from '../services/api';

interface Pose3DViewerSyncProps {
  taskId: string;
  currentFrame: number;
  width?: string | number;
  height?: string | number;
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

export const Pose3DViewerSync: React.FC<Pose3DViewerSyncProps> = ({
  taskId,
  currentFrame,
  width = '100%',
  height = '100%',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const skeletonGroupRef = useRef<THREE.Group | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);

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

  // Render skeleton for current frame
  const renderSkeleton = (frameIndex: number) => {
    if (!skeletonGroupRef.current || !landmarksRef.current[frameIndex]) return;

    // Clear previous skeleton
    while (skeletonGroupRef.current.children.length > 0) {
      skeletonGroupRef.current.remove(skeletonGroupRef.current.children[0]);
    }

    const landmarks = landmarksRef.current[frameIndex];

    // Create landmarks (spheres) - larger for better visibility
    landmarks.forEach((lm: any) => {
      const geometry = new THREE.SphereGeometry(0.035, 16, 16);
      const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(lm.x, -lm.y, -lm.z); // Invert Y and Z for proper orientation
      skeletonGroupRef.current!.add(sphere);
    });

    // Create connections (lines)
    POSE_CONNECTIONS.forEach(([start, end]) => {
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
          color: 0x00aaff,
          linewidth: 2,
        });
        const line = new THREE.Line(geometry, material);
        skeletonGroupRef.current!.add(line);
      }
    });
  };

  // Update skeleton when currentFrame prop changes
  useEffect(() => {
    if (currentFrame >= 0 && currentFrame < totalFrames) {
      renderSkeleton(currentFrame);
    }
  }, [currentFrame, totalFrames]);

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
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0a0a0a',
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
          <ViewInArIcon fontSize="small" /> Interactive 3D Pose
        </Typography>
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
            <Typography variant="body2">Loading 3D data...</Typography>
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
            <Typography variant="body2" sx={{ mb: 1 }}>
              Failed to load 3D data
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
          >
            <ButtonGroup variant="outlined" size="small">
              <Button onClick={() => handleViewPreset('front')}>Front</Button>
              <Button onClick={() => handleViewPreset('side')}>Side</Button>
              <Button onClick={() => handleViewPreset('top')}>Top</Button>
            </ButtonGroup>

            <Stack direction="row" spacing={0.5}>
              <IconButton
                onClick={handleZoomIn}
                sx={{ color: 'white' }}
                title="Zoom In"
                size="small"
              >
                <ZoomInIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleZoomOut}
                sx={{ color: 'white' }}
                title="Zoom Out"
                size="small"
              >
                <ZoomOutIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleResetView}
                sx={{ color: 'white' }}
                title="Reset View"
                size="small"
              >
                <RotateLeftIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {/* Frame info */}
          <Typography
            variant="caption"
            sx={{ color: '#888', textAlign: 'center' }}
          >
            Frame: {currentFrame + 1} / {totalFrames} | 🖱️ Drag to rotate • Scroll
            to zoom
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
