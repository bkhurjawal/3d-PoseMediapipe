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
    scene.fog = new THREE.Fog(0x0a0a0a, 5, 15);
    sceneRef.current = scene;

    // Camera - positioned closer for bigger pose view
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.8, 1.8);
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

    // Lights - Enhanced for 3D model visualization
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(hemisphereLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(2, 10, 0x1a1a1a, 0x0f0f0f);
    gridHelper.position.y = -0.1; // Position the grid
    scene.add(gridHelper);

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


  // Render 3D wireframe pose for current frame
  const renderSkeleton = (frameIndex: number) => {
    if (!skeletonGroupRef.current || !landmarksRef.current[frameIndex]) return;

    const landmarks = landmarksRef.current[frameIndex];

    // Helper to get landmark position
    const getPos = (idx: number) =>
      new THREE.Vector3(
        landmarks[idx].x,
        -landmarks[idx].y,
        -landmarks[idx].z
      );

    // Clear previous wireframe elements
    while (skeletonGroupRef.current.children.length > 0) {
      skeletonGroupRef.current.remove(skeletonGroupRef.current.children[0]);
    }

    // Define landmark indices
    const LEFT_SIDE = [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]; // Left shoulder, elbow, wrist, etc.
    const RIGHT_SIDE = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]; // Right shoulder, elbow, wrist, etc.
    const CENTER_TORSO = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Face and center landmarks

    // Render head as a large ellipsoid
    const nose = getPos(0);
    const leftEye = getPos(2);
    const rightEye = getPos(5);
    const leftEar = getPos(7);
    const rightEar = getPos(8);

    // Calculate head center and size
    const headCenter = new THREE.Vector3(
      (leftEar.x + rightEar.x) / 2,
      (nose.y + leftEar.y + rightEar.y) / 3,
      (leftEar.z + rightEar.z) / 2
    );

    const headWidth = leftEar.distanceTo(rightEar) * 0.8;
    const headHeight = headWidth * 1.3;
    const headDepth = headWidth * 0.7;

    const headGeometry = new THREE.SphereGeometry(1, 32, 32);
    headGeometry.scale(headWidth, headHeight, headDepth);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0x7a8b99,
      metalness: 0.3,
      roughness: 0.7
    });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.copy(headCenter);
    skeletonGroupRef.current!.add(headMesh);

    // Render landmarks with color coding
    landmarks.forEach((lm: any, idx: number) => {
      // Skip face landmarks as we have the head sphere
      if (idx <= 10) return;

      let color = 0x999999; // Default gray for center
      let size = 0.025;

      if (LEFT_SIDE.includes(idx)) {
        color = 0x4db8ff; // Blue for left side
        size = 0.03;
      } else if (RIGHT_SIDE.includes(idx)) {
        color = 0xff69b4; // Pink for right side
        size = 0.03;
      }

      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.4,
        roughness: 0.6
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(lm.x, -lm.y, -lm.z);
      skeletonGroupRef.current!.add(sphere);
    });

    // Render connection lines in green
    POSE_CONNECTIONS.forEach(([start, end]) => {
      if (start < landmarks.length && end < landmarks.length) {
        const points = [getPos(start), getPos(end)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: 0x00ff00,
          linewidth: 2,
          opacity: 0.7,
          transparent: true
        });
        const line = new THREE.Line(geometry, material);
        skeletonGroupRef.current!.add(line);
      }
    });

    // Add ground shadow
    const hipCenter = new THREE.Vector3(
      (landmarks[23].x + landmarks[24].x) / 2,
      -(landmarks[23].y + landmarks[24].y) / 2,
      -(landmarks[23].z + landmarks[24].z) / 2
    );

    const shadowGeometry = new THREE.CircleGeometry(0.3, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      opacity: 0.3,
      transparent: true
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(hipCenter.x, -0.1, hipCenter.z);
    skeletonGroupRef.current!.add(shadow);
  };

  // Update skeleton when currentFrame prop changes
  useEffect(() => {
    if (currentFrame >= 0 && currentFrame < totalFrames) {
      renderSkeleton(currentFrame);
    }
  }, [currentFrame, totalFrames]);

  const handleResetView = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(0, 0.8, 1.8);
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
        cameraRef.current.position.set(0, 0.8, 1.8);
        break;
      case 'side':
        cameraRef.current.position.set(1.8, 0.8, 0);
        break;
      case 'top':
        cameraRef.current.position.set(0, 2.0, 0);
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
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1, borderBottom: '1px solid #333' }}>
        <Typography
          variant="h6"
          sx={{
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: '0.95rem',
          }}
        >
          <ViewInArIcon fontSize="small" /> Interactive 3D Pose
        </Typography>
      </Box>

      {/* 3D Canvas */}
      <Box ref={containerRef} sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
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
            <Typography variant="body2">
              Loading pose data...
            </Typography>
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
              Failed to load 3D data
            </Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>
              {error}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ p: 1, borderTop: '1px solid #333', bgcolor: '#0a0a0a', flexShrink: 0 }}>
        <Stack spacing={1}>
          {/* View controls */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
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
            sx={{ color: '#888', textAlign: 'center', fontSize: '0.75rem' }}
          >
            Frame: {currentFrame + 1} / {totalFrames} | 🖱️ Drag to rotate • Scroll to zoom
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
