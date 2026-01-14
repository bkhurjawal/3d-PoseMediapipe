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

interface Pose3DViewerBonesProps {
  taskId: string;
  currentFrame: number;
  width?: string | number;
  height?: string | number;
}

export const Pose3DViewerBones: React.FC<Pose3DViewerBonesProps> = ({
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
    scene.background = new THREE.Color(0x0a0e1a); // Dark blue-black background
    scene.fog = new THREE.Fog(0x0a0e1a, 5, 15);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.8, 1.8);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

    // Lights for X-ray effect
    const ambientLight = new THREE.AmbientLight(0x00aaff, 0.3);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0x00ccff, 0.6);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x0088ff, 0.4);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    // Grid helper with cyan color
    const gridHelper = new THREE.GridHelper(2, 10, 0x004466, 0x002233);
    gridHelper.position.y = -0.1;
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
        const data = await getLandmarks(taskId);

        if (!data.landmarks || data.landmarks.length === 0) {
          throw new Error('No landmark data available');
        }

        landmarksRef.current = data.landmarks;
        setTotalFrames(data.landmarks.length);
        setLoading(false);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to load landmarks';
        setError(errorMsg);
        setLoading(false);
      }
    };
    loadLandmarks();
  }, [taskId]);

  // Helper function to create glowing bone with X-ray effect
  const createXRayBone = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number
  ): THREE.Mesh => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();

    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8, 1);

    // X-ray material with glow
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ddff, // Cyan color
      emissive: 0x0088cc, // Blue glow
      transparent: true,
      opacity: 0.7,
      shininess: 100,
    });

    const bone = new THREE.Mesh(geometry, material);
    bone.position.copy(start).add(direction.multiplyScalar(0.5));

    const axis = new THREE.Vector3(0, 1, 0);
    bone.quaternion.setFromUnitVectors(axis, direction.normalize());

    return bone;
  };

  // Render X-ray skeleton
  const renderSkeleton = (frameIndex: number) => {
    if (!skeletonGroupRef.current || !landmarksRef.current[frameIndex]) return;

    const landmarks = landmarksRef.current[frameIndex];

    const getPos = (idx: number) =>
      new THREE.Vector3(landmarks[idx].x, -landmarks[idx].y, -landmarks[idx].z);

    // Clear previous skeleton
    while (skeletonGroupRef.current.children.length > 0) {
      skeletonGroupRef.current.remove(skeletonGroupRef.current.children[0]);
    }

    const HIDDEN_INDICES = new Set([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      17, 18, 19, 20, 21, 22,
      31, 32,
    ]);

    // Get positions
    const leftShoulderPos = getPos(11);
    const rightShoulderPos = getPos(12);
    const leftHipPos = getPos(23);
    const rightHipPos = getPos(24);

    // Create skull (head)
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const headCenter = new THREE.Vector3(
      (nose.x + leftEar.x + rightEar.x) / 3,
      -(nose.y + leftEar.y + rightEar.y) / 3,
      -(nose.z + leftEar.z + rightEar.z) / 3
    );

    const skullGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const skullMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ddff,
      emissive: 0x0088cc,
      transparent: true,
      opacity: 0.4,
      shininess: 100,
      wireframe: true,
    });
    const skull = new THREE.Mesh(skullGeometry, skullMaterial);
    skull.position.copy(headCenter);
    skeletonGroupRef.current!.add(skull);

    // Spine
    const shoulderCenter = new THREE.Vector3()
      .addVectors(leftShoulderPos, rightShoulderPos)
      .multiplyScalar(0.5);
    const hipCenter = new THREE.Vector3()
      .addVectors(leftHipPos, rightHipPos)
      .multiplyScalar(0.5);
    const spine = createXRayBone(shoulderCenter, hipCenter, 0.02);
    skeletonGroupRef.current!.add(spine);

    // Ribs (simplified representation)
    const numRibs = 6;
    for (let i = 0; i < numRibs; i++) {
      const t = i / (numRibs - 1);
      const ribCenter = new THREE.Vector3().lerpVectors(
        shoulderCenter,
        hipCenter,
        t * 0.7
      );
      const ribWidth = 0.15 * (1 - t * 0.5);

      // Left rib
      const leftRibEnd = new THREE.Vector3(
        ribCenter.x + ribWidth,
        ribCenter.y,
        ribCenter.z - 0.05
      );
      const leftRib = createXRayBone(ribCenter, leftRibEnd, 0.008);
      skeletonGroupRef.current!.add(leftRib);

      // Right rib
      const rightRibEnd = new THREE.Vector3(
        ribCenter.x - ribWidth,
        ribCenter.y,
        ribCenter.z - 0.05
      );
      const rightRib = createXRayBone(ribCenter, rightRibEnd, 0.008);
      skeletonGroupRef.current!.add(rightRib);
    }

    // Arms
    const leftUpperArm = createXRayBone(leftShoulderPos, getPos(13), 0.015);
    skeletonGroupRef.current!.add(leftUpperArm);
    const leftForearm = createXRayBone(getPos(13), getPos(15), 0.012);
    skeletonGroupRef.current!.add(leftForearm);

    const rightUpperArm = createXRayBone(rightShoulderPos, getPos(14), 0.015);
    skeletonGroupRef.current!.add(rightUpperArm);
    const rightForearm = createXRayBone(getPos(14), getPos(16), 0.012);
    skeletonGroupRef.current!.add(rightForearm);

    // Legs
    const leftThigh = createXRayBone(leftHipPos, getPos(25), 0.02);
    skeletonGroupRef.current!.add(leftThigh);
    const leftShin = createXRayBone(getPos(25), getPos(27), 0.015);
    skeletonGroupRef.current!.add(leftShin);

    const rightThigh = createXRayBone(rightHipPos, getPos(26), 0.02);
    skeletonGroupRef.current!.add(rightThigh);
    const rightShin = createXRayBone(getPos(26), getPos(28), 0.015);
    skeletonGroupRef.current!.add(rightShin);

    // Pelvis
    const pelvis = createXRayBone(leftHipPos, rightHipPos, 0.02);
    skeletonGroupRef.current!.add(pelvis);

    // Shoulders/Clavicles
    const clavicles = createXRayBone(leftShoulderPos, rightShoulderPos, 0.015);
    skeletonGroupRef.current!.add(clavicles);

    // Joints with glow effect
    landmarks.forEach((lm: any, index: number) => {
      if (HIDDEN_INDICES.has(index)) return;

      let jointSize = 0.015;
      if ([11, 12, 23, 24].includes(index)) {
        jointSize = 0.025;
      } else if ([13, 14, 25, 26].includes(index)) {
        jointSize = 0.02;
      }

      const geometry = new THREE.SphereGeometry(jointSize, 12, 12);
      const material = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        emissive: 0x00aacc,
        transparent: true,
        opacity: 0.8,
        shininess: 100,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(lm.x, -lm.y, -lm.z);

      // Add point light at joints for glow
      const pointLight = new THREE.PointLight(0x00ddff, 0.5, 0.3);
      pointLight.position.copy(sphere.position);
      skeletonGroupRef.current!.add(pointLight);

      skeletonGroupRef.current!.add(sphere);
    });
  };

  // Update skeleton when currentFrame changes
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
        bgcolor: '#0a0e1a',
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1, borderBottom: '1px solid #1a3355' }}>
        <Typography
          variant="h6"
          sx={{
            color: '#00ddff',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: '0.95rem',
          }}
        >
          <ViewInArIcon fontSize="small" /> X-Ray Bone Structure
        </Typography>
      </Box>

      {/* 3D Canvas */}
      <Box
        ref={containerRef}
        sx={{ flex: 1, position: 'relative', minHeight: 0 }}
      >
        {loading && !error && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#00ddff',
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
              Failed to load 3D data
            </Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>
              {error}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box
        sx={{
          p: 1,
          borderTop: '1px solid #1a3355',
          bgcolor: '#0a0e1a',
          flexShrink: 0,
        }}
      >
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={() => handleViewPreset('front')}
                sx={{ color: '#00ddff', borderColor: '#1a3355' }}
              >
                Front
              </Button>
              <Button
                onClick={() => handleViewPreset('side')}
                sx={{ color: '#00ddff', borderColor: '#1a3355' }}
              >
                Side
              </Button>
              <Button
                onClick={() => handleViewPreset('top')}
                sx={{ color: '#00ddff', borderColor: '#1a3355' }}
              >
                Top
              </Button>
            </ButtonGroup>

            <Stack direction="row" spacing={0.5}>
              <IconButton
                onClick={handleZoomIn}
                sx={{ color: '#00ddff' }}
                title="Zoom In"
                size="small"
              >
                <ZoomInIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleZoomOut}
                sx={{ color: '#00ddff' }}
                title="Zoom Out"
                size="small"
              >
                <ZoomOutIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleResetView}
                sx={{ color: '#00ddff' }}
                title="Reset View"
                size="small"
              >
                <RotateLeftIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          <Typography
            variant="caption"
            sx={{ color: '#4488aa', textAlign: 'center', fontSize: '0.75rem' }}
          >
            Frame: {currentFrame + 1} / {totalFrames} | 🖱️ Drag to rotate •
            Scroll to zoom
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
