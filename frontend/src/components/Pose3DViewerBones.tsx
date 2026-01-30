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
import { TemporalSmoother, RotationSmoother, PositionSmoother } from '../utils/poseSmoothing';
import {
  configureDepthRendering,
  applyDepthMaterial,
  updateRenderOrdersByDepth,
} from '../utils/contactShadows';

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
  const boneMeshesRef = useRef<THREE.Mesh[]>([]); // Store bone meshes for dynamic depth sorting

  // Smoothing instances
  const temporalSmootherRef = useRef<TemporalSmoother>(new TemporalSmoother(5));
  const positionSmootherRef = useRef<PositionSmoother>(new PositionSmoother(0.3));
  const rotationSmootherRef = useRef<RotationSmoother>(new RotationSmoother());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) {
      console.log('Bones viewer: Container ref not available');
      return;
    }

    // Wait for container to have dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    console.log('Bones viewer: Container dimensions:', containerWidth, containerHeight);

    if (containerWidth === 0 || containerHeight === 0) {
      console.warn('Bones viewer: Container has zero dimensions, retrying...');
      // Retry after a short delay
      const timeoutId = setTimeout(() => {
        if (containerRef.current) {
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          console.log('Bones viewer retry: Container dimensions:', w, h);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a); // Dark blue-black background
    scene.fog = new THREE.Fog(0x0a0e1a, 5, 15);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.8, 1.8);
    cameraRef.current = camera;

    // Renderer with enhanced settings for X-ray transparency
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      depth: true,
      stencil: true,
      premultipliedAlpha: false,
    });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Configure for additive blending and transparency
    renderer.sortObjects = true; // Enable depth sorting for transparency
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Configure tone mapping for glowing effect
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; // Brighter for X-ray effect
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    console.log('Bones viewer: Three.js initialized successfully');

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controlsRef.current = controls;

    // Enhanced lighting for X-ray effect with multiple angles
    const ambientLight = new THREE.AmbientLight(0x001122, 0.2);
    scene.add(ambientLight);

    // Key light - bright cyan from front
    const keyLight = new THREE.DirectionalLight(0x00FFFF, 1.2);
    keyLight.position.set(0, 3, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    // Fill light - blue from side
    const fillLight = new THREE.DirectionalLight(0x0088FF, 0.8);
    fillLight.position.set(-5, 2, 2);
    scene.add(fillLight);

    // Rim light - bright cyan from behind for edge glow
    const rimLight = new THREE.DirectionalLight(0x00DDFF, 0.9);
    rimLight.position.set(0, 2, -5);
    scene.add(rimLight);

    // Hemisphere light for ambient X-ray glow
    const hemisphereLight = new THREE.HemisphereLight(0x00CCFF, 0x004488, 0.5);
    scene.add(hemisphereLight);

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

      // Update render orders dynamically based on camera distance
      // This ensures proper depth sorting when bones overlap
      if (boneMeshesRef.current.length > 0) {
        updateRenderOrdersByDepth(boneMeshesRef.current, camera, 100);
      }

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

        // Reset smoothers when loading new video
        temporalSmootherRef.current.reset();
        positionSmootherRef.current.reset();
        rotationSmootherRef.current.reset();

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

  // Helper function to create gradient-colored X-ray bone with 3D perspective
  const createXRayBone = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    boneId: string = '',
    startColor: THREE.Color = new THREE.Color(0x00FFFF), // Cyan
    endColor: THREE.Color = new THREE.Color(0x0088FF)    // Blue
  ): THREE.Mesh => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();

    // Create thick cylindrical bone with high segment count for 3D perspective
    const geometry = new THREE.CylinderGeometry(
      radius * 1.1, // Slightly wider at ends for joint connection
      radius * 1.1,
      length,
      32, // High radial segments for smooth 3D appearance
      8   // Height segments for gradient interpolation
    );

    // Apply vertex gradient for color transition from joint to joint
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    // Find min and max Y values for gradient mapping
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const range = maxY - minY;

    // Apply gradient colors based on Y position (along bone length)
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = (y - minY) / range; // 0 to 1 along bone length

      // Interpolate between start and end colors
      const color = new THREE.Color().lerpColors(startColor, endColor, t);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Enhanced X-ray material with transparency and glow
    const material = new THREE.MeshPhongMaterial({
      color: 0xFFFFFF, // White base to allow vertex colors to show
      emissive: 0x00CCFF, // Bright cyan-blue glow
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7, // Semi-transparent for overlapping visibility
      shininess: 120,
      side: THREE.DoubleSide, // Render both sides for X-ray effect
      depthWrite: false, // Disable depth writing for transparency
      depthTest: true,
      vertexColors: true, // Enable vertex color gradient
      blending: THREE.AdditiveBlending, // Additive blending for glow effect
    });

    const bone = new THREE.Mesh(geometry, material);
    bone.position.copy(start).add(direction.clone().multiplyScalar(0.5));

    // Calculate target rotation
    const axis = new THREE.Vector3(0, 1, 0);
    const targetQuat = new THREE.Quaternion();
    targetQuat.setFromUnitVectors(axis, direction.normalize());

    // Apply smoothed rotation (SLERP)
    if (boneId) {
      bone.quaternion.copy(rotationSmootherRef.current.smoothRotation(boneId, targetQuat, 0.3));
    } else {
      bone.quaternion.copy(targetQuat);
    }

    // Enable shadows for 3D depth
    bone.castShadow = true;
    bone.receiveShadow = true;

    return bone;
  };

  // Helper function to create bright keypoint spheres at joints
  const createKeyPointSphere = (
    position: THREE.Vector3,
    radius: number,
    color: THREE.Color = new THREE.Color(0x00FFFF)
  ): THREE.Mesh => {
    const geometry = new THREE.SphereGeometry(radius, 24, 24);
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
      shininess: 150,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    // Add point light at keypoint for extra glow
    const pointLight = new THREE.PointLight(color.getHex(), 1.5, 0.3);
    pointLight.position.copy(position);
    sphere.add(pointLight);

    return sphere;
  };

  // Render X-ray skeleton
  const renderSkeleton = (frameIndex: number) => {
    if (!skeletonGroupRef.current || !landmarksRef.current[frameIndex]) return;

    // Clear bone meshes array for new frame
    boneMeshesRef.current = [];

    // Apply temporal smoothing to landmarks
    const rawLandmarks = landmarksRef.current[frameIndex];
    const landmarks = temporalSmootherRef.current.smooth(rawLandmarks);

    // Helper to get landmark position with smoothing
    const getPos = (idx: number) => {
      const raw = new THREE.Vector3(landmarks[idx].x, -landmarks[idx].y, -landmarks[idx].z);
      return positionSmootherRef.current.smoothPosition(`bone_joint_${idx}`, raw);
    };

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

    const skullGeometry = new THREE.SphereGeometry(0.1, 24, 24);
    const skullMaterial = new THREE.MeshPhongMaterial({
      color: 0x00FFFF, // Bright cyan
      emissive: 0x00DDFF,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.75,
      shininess: 150,
      wireframe: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    const skull = new THREE.Mesh(skullGeometry, skullMaterial);
    skull.position.copy(headCenter);
    skeletonGroupRef.current!.add(skull);

    // Add bright keypoint at head center
    const headKeypoint = createKeyPointSphere(headCenter, 0.025, new THREE.Color(0x00FFFF));
    skeletonGroupRef.current!.add(headKeypoint);

    // Spine - thicker with gradient from cyan to blue
    const shoulderCenter = new THREE.Vector3()
      .addVectors(leftShoulderPos, rightShoulderPos)
      .multiplyScalar(0.5);
    const hipCenter = new THREE.Vector3()
      .addVectors(leftHipPos, rightHipPos)
      .multiplyScalar(0.5);

    const spineCyan = new THREE.Color(0x00FFFF); // Bright cyan at top
    const spineBlue = new THREE.Color(0x0088FF); // Blue at bottom
    const spine = createXRayBone(shoulderCenter, hipCenter, 0.035, 'bone_spine', spineCyan, spineBlue);
    skeletonGroupRef.current!.add(spine);
    boneMeshesRef.current.push(spine);

    // Add keypoints at spine ends
    const spineTopKeypoint = createKeyPointSphere(shoulderCenter, 0.022, spineCyan);
    skeletonGroupRef.current!.add(spineTopKeypoint);

    const spineBottomKeypoint = createKeyPointSphere(hipCenter, 0.022, spineBlue);
    skeletonGroupRef.current!.add(spineBottomKeypoint);

    // Ribs removed - cleaner look without horizontal lines

    // Arms - thicker with gradient coloring
    const armCyan = new THREE.Color(0x00FFFF);    // Cyan at shoulder
    const armBlue = new THREE.Color(0x0099FF);     // Blue at elbow
    const forearmBlue = new THREE.Color(0x0099FF); // Blue at elbow
    const forearmDeep = new THREE.Color(0x0066DD); // Deep blue at wrist

    // Left arm
    const leftElbowPos = getPos(13);
    const leftWristPos = getPos(15);

    const leftUpperArm = createXRayBone(leftShoulderPos, leftElbowPos, 0.028, 'bone_left_upper_arm', armCyan, armBlue);
    skeletonGroupRef.current!.add(leftUpperArm);
    boneMeshesRef.current.push(leftUpperArm);

    const leftForearm = createXRayBone(leftElbowPos, leftWristPos, 0.025, 'bone_left_forearm', forearmBlue, forearmDeep);
    skeletonGroupRef.current!.add(leftForearm);
    boneMeshesRef.current.push(leftForearm);

    // Add keypoints
    const leftShoulderKeypoint = createKeyPointSphere(leftShoulderPos, 0.020, armCyan);
    skeletonGroupRef.current!.add(leftShoulderKeypoint);

    const leftElbowKeypoint = createKeyPointSphere(leftElbowPos, 0.018, armBlue);
    skeletonGroupRef.current!.add(leftElbowKeypoint);

    const leftWristKeypoint = createKeyPointSphere(leftWristPos, 0.016, forearmDeep);
    skeletonGroupRef.current!.add(leftWristKeypoint);

    // Right arm
    const rightElbowPos = getPos(14);
    const rightWristPos = getPos(16);

    const rightUpperArm = createXRayBone(rightShoulderPos, rightElbowPos, 0.028, 'bone_right_upper_arm', armCyan, armBlue);
    skeletonGroupRef.current!.add(rightUpperArm);
    boneMeshesRef.current.push(rightUpperArm);

    const rightForearm = createXRayBone(rightElbowPos, rightWristPos, 0.025, 'bone_right_forearm', forearmBlue, forearmDeep);
    skeletonGroupRef.current!.add(rightForearm);
    boneMeshesRef.current.push(rightForearm);

    // Add keypoints
    const rightShoulderKeypoint = createKeyPointSphere(rightShoulderPos, 0.020, armCyan);
    skeletonGroupRef.current!.add(rightShoulderKeypoint);

    const rightElbowKeypoint = createKeyPointSphere(rightElbowPos, 0.018, armBlue);
    skeletonGroupRef.current!.add(rightElbowKeypoint);

    const rightWristKeypoint = createKeyPointSphere(rightWristPos, 0.016, forearmDeep);
    skeletonGroupRef.current!.add(rightWristKeypoint);

    // Legs - thicker with gradient coloring
    const legCyan = new THREE.Color(0x00FFFF);     // Cyan at hip
    const legBlue = new THREE.Color(0x0099FF);     // Blue at knee
    const shinBlue = new THREE.Color(0x0099FF);    // Blue at knee
    const shinDeep = new THREE.Color(0x0055CC);    // Deep blue at ankle

    // Left leg
    const leftKneePos = getPos(25);
    const leftAnklePos = getPos(27);

    const leftThigh = createXRayBone(leftHipPos, leftKneePos, 0.032, 'bone_left_thigh', legCyan, legBlue);
    skeletonGroupRef.current!.add(leftThigh);
    boneMeshesRef.current.push(leftThigh);

    const leftShin = createXRayBone(leftKneePos, leftAnklePos, 0.028, 'bone_left_shin', shinBlue, shinDeep);
    skeletonGroupRef.current!.add(leftShin);
    boneMeshesRef.current.push(leftShin);

    // Add keypoints
    const leftHipKeypoint = createKeyPointSphere(leftHipPos, 0.022, legCyan);
    skeletonGroupRef.current!.add(leftHipKeypoint);

    const leftKneeKeypoint = createKeyPointSphere(leftKneePos, 0.020, legBlue);
    skeletonGroupRef.current!.add(leftKneeKeypoint);

    const leftAnkleKeypoint = createKeyPointSphere(leftAnklePos, 0.018, shinDeep);
    skeletonGroupRef.current!.add(leftAnkleKeypoint);

    // Right leg
    const rightKneePos = getPos(26);
    const rightAnklePos = getPos(28);

    const rightThigh = createXRayBone(rightHipPos, rightKneePos, 0.032, 'bone_right_thigh', legCyan, legBlue);
    skeletonGroupRef.current!.add(rightThigh);
    boneMeshesRef.current.push(rightThigh);

    const rightShin = createXRayBone(rightKneePos, rightAnklePos, 0.028, 'bone_right_shin', shinBlue, shinDeep);
    skeletonGroupRef.current!.add(rightShin);
    boneMeshesRef.current.push(rightShin);

    // Add keypoints
    const rightHipKeypoint = createKeyPointSphere(rightHipPos, 0.022, legCyan);
    skeletonGroupRef.current!.add(rightHipKeypoint);

    const rightKneeKeypoint = createKeyPointSphere(rightKneePos, 0.020, legBlue);
    skeletonGroupRef.current!.add(rightKneeKeypoint);

    const rightAnkleKeypoint = createKeyPointSphere(rightAnklePos, 0.018, shinDeep);
    skeletonGroupRef.current!.add(rightAnkleKeypoint);

    // Pelvis - thicker with gradient (left to right)
    const pelvisLeftColor = new THREE.Color(0x00FFFF);  // Cyan on left
    const pelvisRightColor = new THREE.Color(0x00DDFF); // Bright cyan on right
    const pelvis = createXRayBone(leftHipPos, rightHipPos, 0.032, 'bone_pelvis', pelvisLeftColor, pelvisRightColor);
    skeletonGroupRef.current!.add(pelvis);
    boneMeshesRef.current.push(pelvis);

    // Shoulders/Clavicles - thicker with gradient (left to right)
    const clavicleLeftColor = new THREE.Color(0x00FFFF);  // Cyan on left
    const clavicleRightColor = new THREE.Color(0x00DDFF); // Bright cyan on right
    const clavicles = createXRayBone(leftShoulderPos, rightShoulderPos, 0.028, 'bone_clavicles', clavicleLeftColor, clavicleRightColor);
    skeletonGroupRef.current!.add(clavicles);
    boneMeshesRef.current.push(clavicles);

    // Note: Keypoint spheres are now added with each bone segment above
    // This provides better visual connection between bones and joints with gradient colors
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
