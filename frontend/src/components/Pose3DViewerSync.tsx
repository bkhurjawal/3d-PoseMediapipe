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
  const headSizeRef = useRef<number | null>(null);

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

  // Helper function to create a tapered bone between two points
  const createBone = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    startRadius: number,
    endRadius: number,
    color: number
  ): THREE.Mesh => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();

    // Create a tapered cylinder using CylinderGeometry
    const geometry = new THREE.CylinderGeometry(
      endRadius,    // radiusTop
      startRadius,  // radiusBottom
      length,       // height
      8,            // radialSegments
      1             // heightSegments
    );

    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.7,
    });

    const bone = new THREE.Mesh(geometry, material);

    // Position and orient the bone
    bone.position.copy(start).add(direction.multiplyScalar(0.5));

    // Orient the bone to point from start to end
    const axis = new THREE.Vector3(0, 1, 0);
    bone.quaternion.setFromUnitVectors(axis, direction.normalize());

    return bone;
  };

  // Render 3D wireframe pose for current frame
  const renderSkeleton = (frameIndex: number) => {
    if (!skeletonGroupRef.current || !landmarksRef.current[frameIndex]) return;

    const landmarks = landmarksRef.current[frameIndex];

    // Helper to get landmark position
    const getPos = (idx: number) =>
      new THREE.Vector3(landmarks[idx].x, -landmarks[idx].y, -landmarks[idx].z);

    // Helper function to create smooth curved limb with multiple segments
    const createSmoothLimb = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      topRadius: number,
      bottomRadius: number,
      segments: number = 8
    ) => {
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();

      // Create a smooth tapered cylinder with more segments for curves
      const geometry = new THREE.CylinderGeometry(
        bottomRadius, // radiusTop (at end)
        topRadius,    // radiusBottom (at start)
        length,
        16,           // radialSegments for smooth curves
        segments      // heightSegments for bending
      );

      const material = new THREE.MeshStandardMaterial({
        color: 0xA78BFA,
        metalness: 0.2,
        roughness: 0.7,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Position at midpoint
      mesh.position.copy(start).add(direction.multiplyScalar(0.5));

      // Orient the limb
      const axis = new THREE.Vector3(0, 1, 0);
      mesh.quaternion.setFromUnitVectors(axis, direction.normalize());

      return mesh;
    };

    // Clear previous wireframe elements
    while (skeletonGroupRef.current.children.length > 0) {
      skeletonGroupRef.current.remove(skeletonGroupRef.current.children[0]);
    }

    // Define landmark indices
    const HIDDEN_INDICES = new Set([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, // Face
      17, 18, 19, 20, 21, 22, // Fingers
      31, 32, // Toes
    ]);

    // Helper to get raw position
    const getRawPos = (idx: number) => landmarks[idx];

    // Calculate stable head size (only once or when it changes significantly)
    const nose = getRawPos(0);
    const leftEar = getRawPos(7);
    const rightEar = getRawPos(8);
    const leftShoulder = getRawPos(11);
    const rightShoulder = getRawPos(12);

    // Use shoulder distance as a stable reference for head size
    if (!headSizeRef.current && leftShoulder && rightShoulder) {
      const shoulderDist = Math.abs(leftShoulder.x - rightShoulder.x);
      headSizeRef.current = shoulderDist * 0.35; // Head is roughly 35% of shoulder width
    }

    // Render Head with stable size
    if (nose && leftEar && rightEar && headSizeRef.current) {
      // Calculate head position (average of facial landmarks)
      const headCenter = new THREE.Vector3(
        (nose.x + leftEar.x + rightEar.x) / 3,
        (nose.y + leftEar.y + rightEar.y) / 3,
        (nose.z + leftEar.z + rightEar.z) / 3
      );

      const finalHeadPos = new THREE.Vector3(
        headCenter.x,
        -headCenter.y,
        -headCenter.z
      );

      // Use stable head size (skull)
      const headSize = headSizeRef.current;
      const headGeometry = new THREE.SphereGeometry(headSize, 32, 32);

      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xA78BFA, // Purple for head
        metalness: 0.2,
        roughness: 0.8,
      });
      const headMesh = new THREE.Mesh(headGeometry, headMaterial);
      headMesh.position.copy(finalHeadPos);
      skeletonGroupRef.current!.add(headMesh);

      // Create neck connecting head to shoulders
      const leftShoulderRaw = getRawPos(11);
      const rightShoulderRaw = getRawPos(12);

      if (leftShoulderRaw && rightShoulderRaw) {
        // Calculate shoulder center position
        const shoulderCenterRaw = {
          x: (leftShoulderRaw.x + rightShoulderRaw.x) / 2,
          y: (leftShoulderRaw.y + rightShoulderRaw.y) / 2,
          z: (leftShoulderRaw.z + rightShoulderRaw.z) / 2,
        };

        const shoulderCenter = new THREE.Vector3(
          shoulderCenterRaw.x,
          -shoulderCenterRaw.y,
          -shoulderCenterRaw.z
        );

        // Calculate neck base position (slightly below head)
        const neckBase = new THREE.Vector3(
          headCenter.x,
          -(headCenter.y - headSize * 0.8), // Position at bottom of head
          -headCenter.z
        );

        // Create neck cylinder
        const neckHeight = shoulderCenter.distanceTo(neckBase);
        const neckGeometry = new THREE.CylinderGeometry(
          0.035, // top radius (narrower at head)
          0.05,  // bottom radius (wider at shoulders)
          neckHeight,
          16
        );

        const neckMaterial = new THREE.MeshStandardMaterial({
          color: 0xA78BFA, // Purple to match body
          metalness: 0.2,
          roughness: 0.7,
        });

        const neckMesh = new THREE.Mesh(neckGeometry, neckMaterial);

        // Position neck at midpoint between shoulder center and neck base
        const neckCenter = new THREE.Vector3()
          .addVectors(shoulderCenter, neckBase)
          .multiplyScalar(0.5);
        neckMesh.position.copy(neckCenter);

        // Orient neck to point from shoulders to head
        const neckDirection = new THREE.Vector3()
          .subVectors(neckBase, shoulderCenter)
          .normalize();
        const axis = new THREE.Vector3(0, 1, 0);
        neckMesh.quaternion.setFromUnitVectors(axis, neckDirection);

        skeletonGroupRef.current!.add(neckMesh);
      }
    }

    // Render joints (larger and purple for the reference design)
    landmarks.forEach((lm: any, index: number) => {
      if (HIDDEN_INDICES.has(index)) return;

      // Determine joint size based on importance
      let jointSize = 0.025;
      let jointColor = 0xFF9933; // Orange for highlighted joints (like in reference)

      // Larger joints for major articulation points
      if ([11, 12, 23, 24].includes(index)) {
        jointSize = 0.035; // Shoulders and hips - orange
        jointColor = 0xFF9933;
      } else if ([13, 14, 25, 26].includes(index)) {
        jointSize = 0.03; // Elbows and knees - orange
        jointColor = 0xFF9933;
      } else {
        // Smaller joints in purple
        jointColor = 0xA78BFA;
      }

      const geometry = new THREE.SphereGeometry(jointSize, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: jointColor,
        metalness: 0.2,
        roughness: 0.8,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(lm.x, -lm.y, -lm.z);
      skeletonGroupRef.current!.add(sphere);
    });

    // Create humanoid torso (chest and stomach) using shoulders (11, 12) and hips (23, 24)
    const leftShoulderPos = getPos(11);
    const rightShoulderPos = getPos(12);
    const leftHipPos = getPos(23);
    const rightHipPos = getPos(24);

    // Calculate torso depth (front to back)
    const torsoDepth = 0.15; // Depth of the human torso

    // Create front face vertices
    const frontVertices = [
      leftShoulderPos.x, leftShoulderPos.y, leftShoulderPos.z,
      rightShoulderPos.x, rightShoulderPos.y, rightShoulderPos.z,
      rightHipPos.x, rightHipPos.y, rightHipPos.z,
      leftHipPos.x, leftHipPos.y, leftHipPos.z,
    ];

    // Create back face vertices (offset by torso depth)
    const backVertices = [
      leftShoulderPos.x, leftShoulderPos.y, leftShoulderPos.z - torsoDepth,
      rightShoulderPos.x, rightShoulderPos.y, rightShoulderPos.z - torsoDepth,
      rightHipPos.x, rightHipPos.y, rightHipPos.z - torsoDepth,
      leftHipPos.x, leftHipPos.y, leftHipPos.z - torsoDepth,
    ];

    // Create custom geometry for torso
    const torsoGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Front face (2 triangles)
      ...frontVertices.slice(0, 3), ...frontVertices.slice(3, 6), ...frontVertices.slice(6, 9),
      ...frontVertices.slice(0, 3), ...frontVertices.slice(6, 9), ...frontVertices.slice(9, 12),

      // Back face (2 triangles)
      ...backVertices.slice(0, 3), ...backVertices.slice(6, 9), ...backVertices.slice(3, 6),
      ...backVertices.slice(0, 3), ...backVertices.slice(9, 12), ...backVertices.slice(6, 9),

      // Left side
      frontVertices[0], frontVertices[1], frontVertices[2],
      frontVertices[9], frontVertices[10], frontVertices[11],
      backVertices[9], backVertices[10], backVertices[11],

      frontVertices[0], frontVertices[1], frontVertices[2],
      backVertices[9], backVertices[10], backVertices[11],
      backVertices[0], backVertices[1], backVertices[2],

      // Right side
      frontVertices[3], frontVertices[4], frontVertices[5],
      backVertices[3], backVertices[4], backVertices[5],
      backVertices[6], backVertices[7], backVertices[8],

      frontVertices[3], frontVertices[4], frontVertices[5],
      backVertices[6], backVertices[7], backVertices[8],
      frontVertices[6], frontVertices[7], frontVertices[8],

      // Top (shoulders)
      frontVertices[0], frontVertices[1], frontVertices[2],
      backVertices[0], backVertices[1], backVertices[2],
      backVertices[3], backVertices[4], backVertices[5],

      frontVertices[0], frontVertices[1], frontVertices[2],
      backVertices[3], backVertices[4], backVertices[5],
      frontVertices[3], frontVertices[4], frontVertices[5],

      // Bottom (hips)
      frontVertices[9], frontVertices[10], frontVertices[11],
      frontVertices[6], frontVertices[7], frontVertices[8],
      backVertices[6], backVertices[7], backVertices[8],

      frontVertices[9], frontVertices[10], frontVertices[11],
      backVertices[6], backVertices[7], backVertices[8],
      backVertices[9], backVertices[10], backVertices[11],
    ]);

    torsoGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    torsoGeometry.computeVertexNormals();

    const torsoMaterial = new THREE.MeshStandardMaterial({
      color: 0xA78BFA,
      metalness: 0.2,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });

    const torsoMesh = new THREE.Mesh(torsoGeometry, torsoMaterial);
    skeletonGroupRef.current!.add(torsoMesh);

    // Create buttocks structure for anatomical realism
    const hipMidpoint = new THREE.Vector3()
      .addVectors(leftHipPos, rightHipPos)
      .multiplyScalar(0.5);

    const hipWidth = leftHipPos.distanceTo(rightHipPos);
    const buttocksRadius = hipWidth * 0.4; // Size based on hip width
    const buttocksDepth = 0.12; // How much the buttocks protrude backward

    // Create rounded buttocks geometry using sphere
    const buttocksGeometry = new THREE.SphereGeometry(
      buttocksRadius,
      16, // widthSegments
      12, // heightSegments
      0, // phiStart
      Math.PI * 2, // phiLength (full circle)
      0, // thetaStart
      Math.PI * 0.6 // thetaLength (bottom half sphere)
    );

    const buttocksMaterial = new THREE.MeshStandardMaterial({
      color: 0xA78BFA, // Purple to match body
      metalness: 0.2,
      roughness: 0.7,
    });

    const buttocksMesh = new THREE.Mesh(buttocksGeometry, buttocksMaterial);

    // Position buttocks at hip level, slightly below and behind the hip center
    buttocksMesh.position.set(
      hipMidpoint.x,
      hipMidpoint.y - buttocksRadius * 0.3, // Slightly below hip center
      hipMidpoint.z - buttocksDepth // Behind the body
    );

    // Rotate to face backward and downward
    buttocksMesh.rotation.x = Math.PI * 0.1; // Slight tilt

    skeletonGroupRef.current!.add(buttocksMesh);

    // Create LEFT THIGH (hip to knee) with smooth curves
    const leftThigh = createSmoothLimb(
      leftHipPos,
      getPos(25), // left knee
      0.06,       // thick at hip
      0.045,      // narrower at knee
      12          // segments for smooth curves
    );
    skeletonGroupRef.current!.add(leftThigh);

    // Create LEFT LOWER LEG (knee to ankle) with smooth curves
    const leftLowerLeg = createSmoothLimb(
      getPos(25), // left knee
      getPos(27), // left ankle
      0.045,      // thick at knee
      0.03,       // narrow at ankle
      12
    );
    skeletonGroupRef.current!.add(leftLowerLeg);

    // Create RIGHT THIGH (hip to knee) with smooth curves
    const rightThigh = createSmoothLimb(
      rightHipPos,
      getPos(26), // right knee
      0.06,       // thick at hip
      0.045,      // narrower at knee
      12
    );
    skeletonGroupRef.current!.add(rightThigh);

    // Create RIGHT LOWER LEG (knee to ankle) with smooth curves
    const rightLowerLeg = createSmoothLimb(
      getPos(26), // right knee
      getPos(28), // right ankle
      0.045,      // thick at knee
      0.03,       // narrow at ankle
      12
    );
    skeletonGroupRef.current!.add(rightLowerLeg);

    // Create LEFT UPPER ARM (shoulder to elbow) with smooth curves
    const leftUpperArm = createSmoothLimb(
      leftShoulderPos,
      getPos(13), // left elbow
      0.045,      // thick at shoulder
      0.03,       // narrower at elbow
      10
    );
    skeletonGroupRef.current!.add(leftUpperArm);

    // Create LEFT FOREARM (elbow to wrist) with smooth curves
    const leftForearm = createSmoothLimb(
      getPos(13), // left elbow
      getPos(15), // left wrist
      0.03,       // thick at elbow
      0.025,      // narrow at wrist
      10
    );
    skeletonGroupRef.current!.add(leftForearm);

    // Create RIGHT UPPER ARM (shoulder to elbow) with smooth curves
    const rightUpperArm = createSmoothLimb(
      rightShoulderPos,
      getPos(14), // right elbow
      0.045,      // thick at shoulder
      0.03,       // narrower at elbow
      10
    );
    skeletonGroupRef.current!.add(rightUpperArm);

    // Create RIGHT FOREARM (elbow to wrist) with smooth curves
    const rightForearm = createSmoothLimb(
      getPos(14), // right elbow
      getPos(16), // right wrist
      0.03,       // thick at elbow
      0.025,      // narrow at wrist
      10
    );
    skeletonGroupRef.current!.add(rightForearm);

    // All limbs are now created with smooth curves above
    // Old bone rendering code has been replaced

    // Add ground shadow - calculate hip center for shadow positioning
    const hipCenter = new THREE.Vector3()
      .addVectors(leftHipPos, rightHipPos)
      .multiplyScalar(0.5);

    const shadowGeometry = new THREE.CircleGeometry(0.3, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      opacity: 0.3,
      transparent: true,
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
          borderTop: '1px solid #333',
          bgcolor: '#0a0a0a',
          flexShrink: 0,
        }}
      >
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
            Frame: {currentFrame + 1} / {totalFrames} | 🖱️ Drag to rotate •
            Scroll to zoom
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
