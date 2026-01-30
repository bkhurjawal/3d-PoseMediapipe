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
  FormControlLabel,
  Checkbox,
  Paper,
  Divider,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import TuneIcon from '@mui/icons-material/Tune';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { getLandmarks } from '../services/api';
import { TemporalSmoother, RotationSmoother, PositionSmoother } from '../utils/poseSmoothing';
import {
  createBicep,
  createTricep,
  createForearm,
  createDeltoid,
  createQuad,
  createHamstring,
  createCalf,
  createChest,
  createBack,
  createAbs,
  createGlutes,
} from '../utils/muscleGeometry';
import {
  createAllContactShadows,
  configureDepthRendering,
  setRenderOrder,
  applyDepthMaterial,
  updateRenderOrdersByDepth,
  createIntersectionShadow,
  createJointShadow,
} from '../utils/contactShadows';
import {
  createPBRMaterial,
  MaterialPresets,
  createSmoothLimbMesh,
  createSmoothJointSphere,
  applyVertexGradient,
  createJointConnector,
  createJointCap,
  createEnhancedJoint,
} from '../utils/pbrMaterials';
import {
  createChestGeometry,
  createAbdomenGeometry,
  createNeckGeometry,
  createClavicleGeometry,
  AnatomicalProportions,
} from '../utils/anatomyGeometry';
import {
  getConfidenceColor,
  getConfidenceEmissive,
  getConfidenceEmissiveIntensity,
  getConfidenceOpacity,
  getConfidenceMetalness,
  getConfidenceSizeMultiplier,
  applyConfidenceGradient,
  getConfidenceLevel,
} from '../utils/confidenceColors';
import {
  createSmoothSphere,
  createSmoothCylinder,
  applySmoothShading,
} from '../utils/meshSubdivision';
import {
  ModelCustomization,
  defaultCustomization,
  applyVisualizationMode,
  applyCustomColor,
  applyCustomTransparency,
  applyCustomMaterial,
  applyModelScale,
  VisualizationMode,
} from '../utils/modelCustomization';
import {
  createHeadDirectionVisualization,
  enlargeHeadSphere,
} from '../utils/headDirection';
import {
  calculateJointAngle,
  calculateArcNormal,
  createAngleArc,
  getAngleColor,
  JointAngleData,
  JointAngles,
} from '../utils/jointAngles';
import {
  JOINT_NAMES,
  JointTooltipData,
  getConnectedJoints,
  raycastJoints,
  createJointHighlight,
  formatConfidence,
  formatPosition,
  getJointCategory,
  getCategoryColor,
  getJointDescription,
  screenToNDC,
} from '../utils/jointTooltip';
import {
  KinematicChain,
  KINEMATIC_CHAINS,
  getPrimaryChain,
  createChainHighlight,
  animateChainHighlight,
  getChainDescription,
  getChainSequence,
} from '../utils/kinematicChains';
import {
  createCoordinateAxes,
  createEnhancedGrid,
  createFloorPlane,
  createVerticalGrid,
  createOriginMarker,
} from '../utils/coordinateSystem';
import {
  TrailHistory,
  TrailConfig,
  TRAIL_PRESETS,
  createMotionTrail,
  createDirectionalTrail,
} from '../utils/motionTrails';
import {
  CameraMode,
  ViewPreset,
  applyViewPreset,
  createOrthographicCamera,
  updateOrthographicFrustum,
  toggleCameraMode,
  getCameraModeDescription,
} from '../utils/cameraViews';
import {
  JointConstraint,
  JOINT_CONSTRAINTS,
  getConstraintForJoint,
  createConstraintVisualization,
  getConstraintStatus,
  getConstraintStatusColor,
  checkConstraintViolations,
  animateConstraintVisualization,
  ConstraintStatus,
} from '../utils/jointConstraints';
import {
  GeometryCache,
  MaterialCache,
  InstancedRenderer,
  FrustumCuller,
  PerformanceMonitor,
  MemoryManager,
  getLODLevel,
  getLODSegments,
} from '../utils/renderOptimization';

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
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const activeCameraRef = useRef<THREE.Camera | null>(null); // Currently active camera
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const skeletonGroupRef = useRef<THREE.Group | null>(null);
  const muscleGroupRef = useRef<THREE.Group | null>(null);
  const contactShadowGroupRef = useRef<THREE.Group | null>(null);
  const headDirectionGroupRef = useRef<THREE.Group | null>(null);
  const jointAngleGroupRef = useRef<THREE.Group | null>(null);
  const jointHighlightGroupRef = useRef<THREE.Group | null>(null);
  const chainHighlightGroupRef = useRef<THREE.Group | null>(null);
  const coordinateSystemGroupRef = useRef<THREE.Group | null>(null);
  const motionTrailGroupRef = useRef<THREE.Group | null>(null);
  const constraintGroupRef = useRef<THREE.Group | null>(null);
  const headSizeRef = useRef<number | null>(null);
  const limbMeshesRef = useRef<THREE.Mesh[]>([]); // Store limb meshes for dynamic depth sorting
  const jointMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map()); // Store joint meshes with indices
  const jointPositionsRef = useRef<Map<number, THREE.Vector3>>(new Map()); // Store joint positions
  const trailHistoryRef = useRef<TrailHistory>(new TrailHistory(30)); // Motion trail history

  // Smoothing instances
  const temporalSmootherRef = useRef<TemporalSmoother>(new TemporalSmoother(5));
  const positionSmootherRef = useRef<PositionSmoother>(new PositionSmoother(0.3));
  const rotationSmootherRef = useRef<RotationSmoother>(new RotationSmoother());

  // Optimization instances
  const geometryCacheRef = useRef<GeometryCache>(new GeometryCache());
  const materialCacheRef = useRef<MaterialCache>(new MaterialCache());
  const instancedRendererRef = useRef<InstancedRenderer>(new InstancedRenderer(50));
  const frustumCullerRef = useRef<FrustumCuller>(new FrustumCuller());
  const performanceMonitorRef = useRef<PerformanceMonitor>(new PerformanceMonitor());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);

  // Muscle group visibility toggles
  const [showMuscles, setShowMuscles] = useState(false);
  const [muscleGroups, setMuscleGroups] = useState({
    arms: true,
    legs: true,
    torso: true,
    details: false, // bicep/tricep separation, quad/hamstring separation
  });

  // Model customization state
  const [customization, setCustomization] = useState<ModelCustomization>(defaultCustomization);
  const [showCustomization, setShowCustomization] = useState(false);

  // Head direction visualization
  const [showHeadDirection, setShowHeadDirection] = useState(true);
  const [headDirectionOptions, setHeadDirectionOptions] = useState({
    showArrow: true,
    showEyes: true,
    showPlane: false,
  });

  // Joint angle visualization
  const [showJointAngles, setShowJointAngles] = useState(false);
  const [jointAngleOptions, setJointAngleOptions] = useState({
    showElbows: true,
    showKnees: true,
    showShoulders: false,
    showHips: false,
  });
  const [currentAngles, setCurrentAngles] = useState<JointAngles>({});

  // Joint tooltip state
  const [hoveredJoint, setHoveredJoint] = useState<JointTooltipData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [showTooltips, setShowTooltips] = useState(true);

  // Kinematic chain state
  const [selectedChain, setSelectedChain] = useState<KinematicChain | null>(null);
  const [enableChainHighlight, setEnableChainHighlight] = useState(true);

  // Coordinate system state
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showFloorPlane, setShowFloorPlane] = useState(false);
  const [showVerticalGrid, setShowVerticalGrid] = useState(false);
  const [showOriginMarker, setShowOriginMarker] = useState(true);

  // Motion trail state
  const [enableTrails, setEnableTrails] = useState(false);
  const [trailLength, setTrailLength] = useState(30);
  const [activeTrails, setActiveTrails] = useState<{ [key: string]: boolean }>({
    leftHand: true,
    rightHand: true,
    leftFoot: false,
    rightFoot: false,
    head: false,
  });

  // Camera mode state
  const [cameraMode, setCameraMode] = useState<CameraMode>('perspective');
  const [orthoFrustumSize, setOrthoFrustumSize] = useState(1.5);

  // Joint constraint state
  const [showConstraints, setShowConstraints] = useState(false);
  const [constraintOptions, setConstraintOptions] = useState({
    showElbows: true,
    showKnees: true,
    showShoulders: false,
    showHips: false,
    showWrists: false,
    showAnkles: false,
  });

  // Optimization and performance state
  const [enableOptimizations, setEnableOptimizations] = useState(true);
  const [showPerformanceStats, setShowPerformanceStats] = useState(false);
  const [performanceStats, setPerformanceStats] = useState({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    memoryMB: 0,
  });

  // UI state for floating controls and fullscreen
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) {
      console.log('Container ref not available');
      return;
    }

    // Wait for container to have dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    console.log('Container dimensions:', containerWidth, containerHeight);

    if (containerWidth === 0 || containerHeight === 0) {
      console.warn('Container has zero dimensions, retrying...');
      // Retry after a short delay
      const timeoutId = setTimeout(() => {
        if (containerRef.current) {
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          console.log('Retry - Container dimensions:', w, h);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 5, 15);
    sceneRef.current = scene;

    // Camera - positioned closer for bigger pose view
    const camera = new THREE.PerspectiveCamera(
      60,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.8, 1.8);
    cameraRef.current = camera;
    activeCameraRef.current = camera; // Start with perspective camera

    // Create orthographic camera (initially inactive)
    const orthoCamera = createOrthographicCamera(camera, orthoFrustumSize);
    orthoCameraRef.current = orthoCamera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      depth: true,
      stencil: true,
      premultipliedAlpha: false,
    });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Configure tone mapping for PBR (better HDR rendering)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Configure depth rendering and shadows
    configureDepthRendering(renderer);

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create environment map for realistic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a simple gradient environment for subtle reflections
    const envScene = new THREE.Scene();
    const gradientTexture = new THREE.DataTexture(
      new Uint8Array([30, 30, 50, 255, 10, 10, 20, 255]),
      1, 2,
      THREE.RGBAFormat
    );
    gradientTexture.needsUpdate = true;
    envScene.background = gradientTexture;

    const envTexture = pmremGenerator.fromScene(envScene).texture;
    scene.environment = envTexture;

    pmremGenerator.dispose();

    console.log('Three.js initialized successfully');

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controlsRef.current = controls;

    // Advanced Three-Point Lighting System for PBR
    // Ambient light - soft base illumination
    const ambientLight = new THREE.AmbientLight(0x404050, 0.4);
    scene.add(ambientLight);

    // Key Light - main light source (warm, from front-right-top)
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    keyLight.position.set(4, 6, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    scene.add(keyLight);

    // Fill Light - softer light from opposite side (cool, reduces harsh shadows)
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
    fillLight.position.set(-4, 2, -2);
    scene.add(fillLight);

    // Rim/Back Light - creates silhouette and depth (from behind)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(0, 3, -5);
    scene.add(rimLight);

    // Hemisphere light - simulates sky and ground reflections
    const hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x332211, 0.4);
    scene.add(hemisphereLight);

    // Point lights for local highlights on joints
    const shoulderLight = new THREE.PointLight(0xffffff, 0.3, 3);
    shoulderLight.position.set(0, 1.2, 0.5);
    scene.add(shoulderLight);

    // Coordinate system group with axes, grid, and reference planes
    const coordinateSystemGroup = new THREE.Group();
    coordinateSystemGroup.name = 'coordinate_system';
    scene.add(coordinateSystemGroup);
    coordinateSystemGroupRef.current = coordinateSystemGroup;

    // Add default grid
    const defaultGrid = createEnhancedGrid(2, 20, 0x444444, 0x1a1a1a);
    coordinateSystemGroup.add(defaultGrid);

    // Add coordinate axes
    const axes = createCoordinateAxes(0.5);
    axes.position.set(0, 0, 0);
    coordinateSystemGroup.add(axes);

    // Add origin marker
    const originMarker = createOriginMarker(0.02);
    coordinateSystemGroup.add(originMarker);

    // Skeleton group
    const skeletonGroup = new THREE.Group();
    scene.add(skeletonGroup);
    skeletonGroupRef.current = skeletonGroup;

    // Muscle group
    const muscleGroup = new THREE.Group();
    muscleGroup.visible = false; // Hidden by default
    scene.add(muscleGroup);
    muscleGroupRef.current = muscleGroup;

    // Contact shadow group (renders first, lowest render order)
    const contactShadowGroup = new THREE.Group();
    setRenderOrder(contactShadowGroup, -1); // Render before everything else
    scene.add(contactShadowGroup);
    contactShadowGroupRef.current = contactShadowGroup;

    // Head direction group
    const headDirectionGroup = new THREE.Group();
    scene.add(headDirectionGroup);
    headDirectionGroupRef.current = headDirectionGroup;

    // Joint angle group
    const jointAngleGroup = new THREE.Group();
    scene.add(jointAngleGroup);
    jointAngleGroupRef.current = jointAngleGroup;

    // Joint highlight group
    const jointHighlightGroup = new THREE.Group();
    scene.add(jointHighlightGroup);
    jointHighlightGroupRef.current = jointHighlightGroup;

    // Chain highlight group
    const chainHighlightGroup = new THREE.Group();
    scene.add(chainHighlightGroup);
    chainHighlightGroupRef.current = chainHighlightGroup;

    // Motion trail group
    const motionTrailGroup = new THREE.Group();
    scene.add(motionTrailGroup);
    motionTrailGroupRef.current = motionTrailGroup;

    // Constraint group
    const constraintGroup = new THREE.Group();
    scene.add(constraintGroup);
    constraintGroupRef.current = constraintGroup;

    // Set render orders for proper depth sorting
    setRenderOrder(skeletonGroup, 1); // Skeleton renders after shadows
    setRenderOrder(muscleGroup, 0); // Muscles render between shadows and skeleton

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      // Update render orders dynamically based on camera distance
      // This ensures proper depth sorting when limbs overlap
      if (limbMeshesRef.current.length > 0) {
        updateRenderOrdersByDepth(limbMeshesRef.current, camera, 100);
      }

      // Animate chain highlight
      if (chainHighlightGroupRef.current && chainHighlightGroupRef.current.children.length > 0) {
        const time = Date.now() * 0.001;
        animateChainHighlight(chainHighlightGroupRef.current, time);
      }

      // Animate constraint visualizations
      if (constraintGroupRef.current && constraintGroupRef.current.children.length > 0) {
        const time = Date.now() * 0.001;
        animateConstraintVisualization(constraintGroupRef.current, time);
      }

      // Update frustum culler for optimization
      if (enableOptimizations && frustumCullerRef.current) {
        const renderCamera = activeCameraRef.current || camera;
        frustumCullerRef.current.updateFromCamera(renderCamera);
      }

      // Use active camera for rendering
      const renderCamera = activeCameraRef.current || camera;
      renderer.render(scene, renderCamera);

      // Update performance monitor
      if (showPerformanceStats && performanceMonitorRef.current) {
        performanceMonitorRef.current.update(renderer);
      }
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      // Update perspective camera
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Update orthographic camera if it exists
      if (orthoCameraRef.current) {
        updateOrthographicFrustum(orthoCameraRef.current, width, height, orthoFrustumSize);
      }

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

      // Clean up optimization caches
      geometryCacheRef.current.clear();
      materialCacheRef.current.clear();
      instancedRendererRef.current.clear();

      // Dispose scene objects
      if (sceneRef.current) {
        MemoryManager.disposeObject(sceneRef.current);
      }
    };
  }, []);

  // Mouse event handlers for joint hover tooltips
  useEffect(() => {
    if (!containerRef.current || !showTooltips) return;

    const container = containerRef.current;

    const handleMouseMove = (event: MouseEvent) => {
      if (!cameraRef.current || jointMeshesRef.current.size === 0) return;

      const rect = container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Convert to NDC
      const ndc = screenToNDC(mouseX, mouseY, rect.width, rect.height);

      // Perform raycasting
      const jointMeshes = Array.from(jointMeshesRef.current.values());
      const raycaster = new THREE.Raycaster();
      raycaster.params.Points!.threshold = 0.05;
      raycaster.setFromCamera(ndc, cameraRef.current);

      const intersects = raycaster.intersectObjects(jointMeshes, false);

      if (intersects.length > 0 && intersects[0].object.userData.jointIndex !== undefined) {
        const mesh = intersects[0].object as THREE.Mesh;
        const jointIndex = mesh.userData.jointIndex;
        const jointName = mesh.userData.jointName;
        const confidence = mesh.userData.confidence;
        const position = mesh.userData.position;

        // Get angle if available
        const angle = currentAngles.leftElbow?.jointPosition.equals(position)
          ? currentAngles.leftElbow.angle
          : currentAngles.rightElbow?.jointPosition.equals(position)
          ? currentAngles.rightElbow.angle
          : currentAngles.leftKnee?.jointPosition.equals(position)
          ? currentAngles.leftKnee.angle
          : currentAngles.rightKnee?.jointPosition.equals(position)
          ? currentAngles.rightKnee.angle
          : undefined;

        setHoveredJoint({
          jointIndex,
          jointName,
          position,
          confidence,
          angle,
          connectedJoints: getConnectedJoints(jointIndex),
        });

        setTooltipPosition({ x: event.clientX, y: event.clientY });

        // Add highlight
        if (jointHighlightGroupRef.current) {
          jointHighlightGroupRef.current.clear();
          const highlight = createJointHighlight(position, 0.045);
          jointHighlightGroupRef.current.add(highlight);
        }
      } else {
        setHoveredJoint(null);
        setTooltipPosition(null);
        if (jointHighlightGroupRef.current) {
          jointHighlightGroupRef.current.clear();
        }
      }
    };

    const handleMouseLeave = () => {
      setHoveredJoint(null);
      setTooltipPosition(null);
      if (jointHighlightGroupRef.current) {
        jointHighlightGroupRef.current.clear();
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!cameraRef.current || jointMeshesRef.current.size === 0 || !enableChainHighlight) return;

      const rect = container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Convert to NDC
      const ndc = screenToNDC(mouseX, mouseY, rect.width, rect.height);

      // Perform raycasting
      const jointMeshes = Array.from(jointMeshesRef.current.values());
      const raycaster = new THREE.Raycaster();
      raycaster.params.Points!.threshold = 0.05;
      raycaster.setFromCamera(ndc, cameraRef.current);

      const intersects = raycaster.intersectObjects(jointMeshes, false);

      if (intersects.length > 0 && intersects[0].object.userData.jointIndex !== undefined) {
        const jointIndex = intersects[0].object.userData.jointIndex;
        const chain = getPrimaryChain(jointIndex);

        if (chain) {
          // Toggle selection if same chain clicked again
          if (selectedChain?.name === chain.name) {
            setSelectedChain(null);
          } else {
            setSelectedChain(chain);
          }
        }
      } else {
        // Click on empty space clears selection
        setSelectedChain(null);
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
    };
  }, [showTooltips, currentAngles, enableChainHighlight, selectedChain]);

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

        // Reset smoothers when loading new video
        temporalSmootherRef.current.reset();
        positionSmootherRef.current.reset();
        rotationSmootherRef.current.reset();

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

    // Apply temporal smoothing to landmarks
    const rawLandmarks = landmarksRef.current[frameIndex];
    const landmarks = temporalSmootherRef.current.smooth(rawLandmarks);

    // Helper to get landmark position with smoothing
    const getPos = (idx: number) => {
      const raw = new THREE.Vector3(landmarks[idx].x, -landmarks[idx].y, -landmarks[idx].z);
      return positionSmootherRef.current.smoothPosition(`joint_${idx}`, raw);
    };

    // Helper function to create smooth curved limb with confidence-based coloring
    const createSmoothLimb = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      topRadius: number,
      bottomRadius: number,
      segments: number = 8,
      limbId: string = '',
      startConfidence: number = 1.0,
      endConfidence: number = 1.0
    ) => {
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();

      // Create ultra-smooth tapered cylinder
      const geometry = createSmoothCylinder(
        bottomRadius, // radiusTop (at end)
        topRadius,    // radiusBottom (at start)
        length,
        true          // forLimb = true (higher quality)
      );

      // Apply confidence-based gradient coloring
      applyConfidenceGradient(geometry, startConfidence, endConfidence);

      // Get average confidence for material properties
      const avgConfidence = (startConfidence + endConfidence) / 2;
      const baseColor = getConfidenceColor(avgConfidence);
      const emissiveColor = getConfidenceEmissive(avgConfidence);
      const emissiveIntensity = getConfidenceEmissiveIntensity(avgConfidence);

      // Create PBR material with confidence-based properties
      const material = createPBRMaterial({
        ...MaterialPresets.limb,
        baseColor: baseColor.getHex(),
        metalness: 0.08,
        roughness: 0.55,
        emissive: emissiveColor.getHex(),
        emissiveIntensity: emissiveIntensity,
      });

      // Enable vertex colors for gradient
      material.vertexColors = true;
      material.transparent = true;
      material.opacity = Math.min(getConfidenceOpacity(startConfidence), getConfidenceOpacity(endConfidence));

      // Apply depth material properties
      applyDepthMaterial(material);

      const mesh = new THREE.Mesh(geometry, material);

      // Enable shadow casting and receiving
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Position at midpoint
      mesh.position.copy(start).add(direction.clone().multiplyScalar(0.5));

      // Calculate target rotation
      const axis = new THREE.Vector3(0, 1, 0);
      const targetQuat = new THREE.Quaternion();
      targetQuat.setFromUnitVectors(axis, direction.normalize());

      // Apply smoothed rotation (SLERP)
      if (limbId) {
        mesh.quaternion.copy(rotationSmootherRef.current.smoothRotation(limbId, targetQuat, 0.3));
      } else {
        mesh.quaternion.copy(targetQuat);
      }

      return mesh;
    };

    // Clear previous wireframe elements
    while (skeletonGroupRef.current.children.length > 0) {
      skeletonGroupRef.current.remove(skeletonGroupRef.current.children[0]);
    }

    // Clear joint meshes and positions for hover detection and chain highlighting
    jointMeshesRef.current.clear();
    jointPositionsRef.current.clear();

    // Clear previous contact shadows
    if (contactShadowGroupRef.current) {
      while (contactShadowGroupRef.current.children.length > 0) {
        contactShadowGroupRef.current.remove(contactShadowGroupRef.current.children[0]);
      }
    }

    // Clear limb meshes array for new frame
    limbMeshesRef.current = [];

    // Track all limb segments for contact shadow detection
    const limbSegments: Array<{ start: THREE.Vector3; end: THREE.Vector3; id: string }> = [];

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

      // Use stable head size (skull) with ultra-smooth detail
      const headSize = headSizeRef.current;
      const headGeometry = createSmoothSphere(headSize, true); // High-quality smooth sphere

      // Create PBR material for head with subtle glow
      const headMaterial = createPBRMaterial({
        ...MaterialPresets.head,
        baseColor: 0xB899FA, // Slightly lighter purple for head
        metalness: 0.04,
        roughness: 0.45,
        emissive: 0x6B4B9F,
        emissiveIntensity: 0.12,
      });
      applyDepthMaterial(headMaterial);

      const headMesh = new THREE.Mesh(headGeometry, headMaterial);
      headMesh.castShadow = true;
      headMesh.receiveShadow = true;
      headMesh.position.copy(finalHeadPos);
      headMesh.name = 'head_sphere';
      skeletonGroupRef.current!.add(headMesh);

      // Enlarge head for better visibility (30% larger)
      enlargeHeadSphere(headMesh, 1.3);

      // Add head direction visualization
      if (showHeadDirection && headDirectionGroupRef.current) {
        // Clear previous head direction indicators
        headDirectionGroupRef.current.clear();

        // Get eye landmarks for direction calculation
        const leftEyeRaw = getRawPos(2); // left_eye
        const rightEyeRaw = getRawPos(5); // right_eye

        if (leftEyeRaw && rightEyeRaw) {
          const nosePos = new THREE.Vector3(nose.x, -nose.y, -nose.z);
          const leftEyePos = new THREE.Vector3(leftEyeRaw.x, -leftEyeRaw.y, -leftEyeRaw.z);
          const rightEyePos = new THREE.Vector3(rightEyeRaw.x, -rightEyeRaw.y, -rightEyeRaw.z);
          const leftEarPos = new THREE.Vector3(leftEar.x, -leftEar.y, -leftEar.z);
          const rightEarPos = new THREE.Vector3(rightEar.x, -rightEar.y, -rightEar.z);

          // Create head direction visualization
          const headDirectionViz = createHeadDirectionVisualization(
            nosePos,
            leftEyePos,
            rightEyePos,
            leftEarPos,
            rightEarPos,
            {
              showArrow: headDirectionOptions.showArrow,
              showEyes: headDirectionOptions.showEyes,
              showPlane: headDirectionOptions.showPlane,
              arrowColor: 0x00FF88,
              eyeColor: 0x00CCFF,
              arrowLength: 0.18,
            }
          );

          headDirectionGroupRef.current.add(headDirectionViz);
        }
      }

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

        // Create anatomically accurate neck geometry
        const neckData = createNeckGeometry(
          neckBase,
          shoulderCenter,
          AnatomicalProportions.neck.radius
        );

        // Apply gradient to neck
        const neckTopColor = new THREE.Color(0xB899FA);
        const neckBottomColor = new THREE.Color(0xA78BFA);
        applyVertexGradient(neckData.geometry, neckTopColor, neckBottomColor);

        const neckMaterial = createPBRMaterial({
          ...MaterialPresets.limb,
          baseColor: 0xA78BFA,
          metalness: 0.06,
          roughness: 0.55,
          emissive: 0x5B3B8F,
          emissiveIntensity: 0.08,
        });
        neckMaterial.vertexColors = true;
        applyDepthMaterial(neckMaterial);

        const neckMesh = new THREE.Mesh(neckData.geometry, neckMaterial);
        neckMesh.castShadow = true;
        neckMesh.receiveShadow = true;

        // Position and orient neck
        neckMesh.position.copy(neckData.midpoint);
        const axis = new THREE.Vector3(0, 1, 0);
        neckMesh.quaternion.setFromUnitVectors(axis, neckData.direction.normalize());

        skeletonGroupRef.current!.add(neckMesh);

        // Add clavicle (collarbone) structure for anatomical accuracy
        const leftShoulderPos = getPos(11);
        const rightShoulderPos = getPos(12);

        const clavicleGeometries = createClavicleGeometry(
          leftShoulderPos,
          rightShoulderPos,
          shoulderCenter,
          0.018
        );

        // Left clavicle
        const leftClavicleMaterial = createPBRMaterial({
          ...MaterialPresets.jointConnector,
          baseColor: 0xDDAA66,
          metalness: 0.6,
          roughness: 0.3,
        });
        const leftClavicleMesh = new THREE.Mesh(clavicleGeometries[0], leftClavicleMaterial);
        const leftClavicleDir = new THREE.Vector3().subVectors(leftShoulderPos, shoulderCenter);
        const leftClavicleMid = new THREE.Vector3()
          .addVectors(shoulderCenter, leftShoulderPos)
          .multiplyScalar(0.5);
        leftClavicleMesh.position.copy(leftClavicleMid);
        leftClavicleMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          leftClavicleDir.normalize()
        );
        leftClavicleMesh.castShadow = true;
        leftClavicleMesh.receiveShadow = true;
        skeletonGroupRef.current!.add(leftClavicleMesh);

        // Right clavicle
        const rightClavicleMaterial = createPBRMaterial({
          ...MaterialPresets.jointConnector,
          baseColor: 0xDDAA66,
          metalness: 0.6,
          roughness: 0.3,
        });
        const rightClavicleMesh = new THREE.Mesh(clavicleGeometries[1], rightClavicleMaterial);
        const rightClavicleDir = new THREE.Vector3().subVectors(rightShoulderPos, shoulderCenter);
        const rightClavicleMid = new THREE.Vector3()
          .addVectors(shoulderCenter, rightShoulderPos)
          .multiplyScalar(0.5);
        rightClavicleMesh.position.copy(rightClavicleMid);
        rightClavicleMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          rightClavicleDir.normalize()
        );
        rightClavicleMesh.castShadow = true;
        rightClavicleMesh.receiveShadow = true;
        skeletonGroupRef.current!.add(rightClavicleMesh);
      }
    }

    // Render joints with confidence-based coloring
    landmarks.forEach((lm: any, index: number) => {
      if (HIDDEN_INDICES.has(index)) return;

      const jointPosition = new THREE.Vector3(lm.x, -lm.y, -lm.z);
      const confidence = lm.visibility || 1.0; // Use visibility as confidence score

      // Determine joint size and type based on importance
      let baseJointSize = 0.025;
      let isMajorJoint = false;
      let hasJointCap = false;

      // Major articulation points - shoulders and hips
      if ([11, 12, 23, 24].includes(index)) {
        baseJointSize = 0.042; // Increased from 0.035 (20% larger)
        isMajorJoint = true;
        hasJointCap = true;
      }
      // Secondary articulation - elbows and knees
      else if ([13, 14, 25, 26].includes(index)) {
        baseJointSize = 0.036; // Increased from 0.03 (20% larger)
        isMajorJoint = true;
        hasJointCap = true;
      }
      // Wrists and ankles
      else if ([15, 16, 27, 28].includes(index)) {
        baseJointSize = 0.028;
        isMajorJoint = false;
      }
      else {
        // Smaller joints
        baseJointSize = 0.025;
      }

      // Apply confidence-based size multiplier
      const jointSize = baseJointSize * getConfidenceSizeMultiplier(confidence);

      // Get confidence-based colors
      const jointColor = getConfidenceColor(confidence);
      const emissiveColor = getConfidenceEmissive(confidence);
      const emissiveIntensity = getConfidenceEmissiveIntensity(confidence);
      const metalness = getConfidenceMetalness(confidence);
      const opacity = getConfidenceOpacity(confidence);

      // Create ultra-smooth joint sphere with confidence color
      const geometry = createSmoothSphere(jointSize, false);

      const material = createPBRMaterial({
        baseColor: jointColor.getHex(),
        metalness: metalness,
        roughness: isMajorJoint ? 0.35 : 0.5,
        emissive: emissiveColor.getHex(),
        emissiveIntensity: emissiveIntensity,
      });
      material.transparent = true;
      material.opacity = opacity;
      applyDepthMaterial(material);

      const sphere = new THREE.Mesh(geometry, material);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      sphere.position.copy(jointPosition);
      sphere.name = `joint_${index}`;
      sphere.userData = {
        jointIndex: index,
        jointName: JOINT_NAMES[index] || `Joint ${index}`,
        confidence: confidence,
        position: jointPosition,
      };
      skeletonGroupRef.current!.add(sphere);

      // Store reference for raycasting and chain highlighting
      jointMeshesRef.current.set(index, sphere);
      jointPositionsRef.current.set(index, jointPosition.clone());

      // Add joint caps for major articulation points (colored by confidence)
      if (hasJointCap && confidence >= 0.5) {
        const capGroup = createJointCap(jointPosition, jointSize, 'sphere');
        // Update cap materials with confidence colors
        capGroup.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material as THREE.Material;
            if ('color' in mat) {
              (mat as any).color = jointColor.clone();
              (mat as any).emissive = emissiveColor.clone();
              mat.transparent = true;
              mat.opacity = opacity;
            }
          }
        });
        skeletonGroupRef.current!.add(capGroup);
      }

      // Add cylindrical connector for major joints
      if (isMajorJoint && confidence >= 0.5) {
        const connector = createJointConnector(jointPosition, jointSize * 0.9, 0.03);
        // Update connector material with confidence color
        if (connector.material) {
          const mat = connector.material as THREE.Material;
          if ('color' in mat) {
            (mat as any).color = jointColor.clone().multiplyScalar(0.8);
            (mat as any).emissive = emissiveColor.clone();
            mat.transparent = true;
            mat.opacity = opacity * 0.9;
          }
        }
        skeletonGroupRef.current!.add(connector);
      }

      // Add ambient occlusion shadow at major joints for depth perception
      if ([11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(index) && confidence >= 0.3) {
        const jointShadow = createJointShadow(jointPosition, jointSize * 0.8);
        if (contactShadowGroupRef.current) {
          contactShadowGroupRef.current.add(jointShadow);
        }
      }
    });

    // Create humanoid torso (chest and stomach) using shoulders (11, 12) and hips (23, 24)
    const leftShoulderPos = getPos(11);
    const rightShoulderPos = getPos(12);
    const leftHipPos = getPos(23);
    const rightHipPos = getPos(24);

    // Add enhanced shoulder connectors for better definition
    const leftShoulderConnector = createJointConnector(leftShoulderPos, 0.045, 0.035);
    skeletonGroupRef.current!.add(leftShoulderConnector);

    const rightShoulderConnector = createJointConnector(rightShoulderPos, 0.045, 0.035);
    skeletonGroupRef.current!.add(rightShoulderConnector);

    // Add enhanced hip connectors for better definition
    const leftHipConnector = createJointConnector(leftHipPos, 0.045, 0.035);
    skeletonGroupRef.current!.add(leftHipConnector);

    const rightHipConnector = createJointConnector(rightHipPos, 0.045, 0.035);
    skeletonGroupRef.current!.add(rightHipConnector);

    // Calculate mid-torso points for chest/abdomen separation
    const torsoHeight = leftShoulderPos.distanceTo(leftHipPos);
    const chestHeightRatio = AnatomicalProportions.torso.chestHeightRatio; // 55% is chest

    const leftMidTorso = new THREE.Vector3().lerpVectors(
      leftShoulderPos,
      leftHipPos,
      chestHeightRatio
    );
    const rightMidTorso = new THREE.Vector3().lerpVectors(
      rightShoulderPos,
      rightHipPos,
      chestHeightRatio
    );

    // CHEST (RIBCAGE) - Upper torso, wider and deeper
    const chestGeometry = createChestGeometry(
      leftShoulderPos,
      rightShoulderPos,
      leftMidTorso,
      rightMidTorso,
      AnatomicalProportions.torso.chestDepth
    );

    // Apply gradient to chest
    const chestTopColor = new THREE.Color(0xB899FA); // Lighter at shoulders
    const chestBottomColor = new THREE.Color(0xA788EA); // Mid-tone at diaphragm
    applyVertexGradient(chestGeometry, chestTopColor, chestBottomColor);

    const chestMaterial = createPBRMaterial({
      ...MaterialPresets.torso,
      baseColor: 0xA78BFA,
      metalness: 0.05,
      roughness: 0.6,
      emissive: 0x4B2B7F,
      emissiveIntensity: 0.06,
    });
    chestMaterial.vertexColors = true;
    chestMaterial.flatShading = false;
    applyDepthMaterial(chestMaterial);

    const chestMesh = new THREE.Mesh(chestGeometry, chestMaterial);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    skeletonGroupRef.current!.add(chestMesh);
    limbMeshesRef.current.push(chestMesh);

    // ABDOMEN - Lower torso, narrower and shallower
    const abdomenGeometry = createAbdomenGeometry(
      leftMidTorso,
      rightMidTorso,
      leftHipPos,
      rightHipPos,
      AnatomicalProportions.torso.abdomenDepth
    );

    // Apply gradient to abdomen
    const abdomenTopColor = new THREE.Color(0xA788EA); // Mid-tone at top
    const abdomenBottomColor = new THREE.Color(0x9677E9); // Darker at hips
    applyVertexGradient(abdomenGeometry, abdomenTopColor, abdomenBottomColor);

    const abdomenMaterial = createPBRMaterial({
      ...MaterialPresets.torso,
      baseColor: 0xA78BFA,
      metalness: 0.04,
      roughness: 0.65,
      emissive: 0x4B2B7F,
      emissiveIntensity: 0.05,
    });
    abdomenMaterial.vertexColors = true;
    abdomenMaterial.flatShading = false;
    applyDepthMaterial(abdomenMaterial);

    const abdomenMesh = new THREE.Mesh(abdomenGeometry, abdomenMaterial);
    abdomenMesh.castShadow = true;
    abdomenMesh.receiveShadow = true;
    skeletonGroupRef.current!.add(abdomenMesh);
    limbMeshesRef.current.push(abdomenMesh);

    // Add spine connector at mid-torso for definition
    const shoulderCenter = new THREE.Vector3()
      .addVectors(leftShoulderPos, rightShoulderPos)
      .multiplyScalar(0.5);
    const hipCenter = new THREE.Vector3()
      .addVectors(leftHipPos, rightHipPos)
      .multiplyScalar(0.5);
    const spineMid = new THREE.Vector3().lerpVectors(shoulderCenter, hipCenter, 0.5);
    const spineConnector = createJointConnector(spineMid, 0.04, 0.03);
    skeletonGroupRef.current!.add(spineConnector);

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

    // Compute normals for smooth shading
    buttocksGeometry.computeVertexNormals();

    // Create PBR material for buttocks
    const buttocksMaterial = createPBRMaterial({
      ...MaterialPresets.torso,
      baseColor: 0xA78BFA,
      metalness: 0.06,
      roughness: 0.6,
      emissive: 0x5B3B8F,
      emissiveIntensity: 0.07,
    });
    applyDepthMaterial(buttocksMaterial);

    const buttocksMesh = new THREE.Mesh(buttocksGeometry, buttocksMaterial);
    buttocksMesh.castShadow = true;
    buttocksMesh.receiveShadow = true;

    // Position buttocks at hip level, slightly below and behind the hip center
    buttocksMesh.position.set(
      hipMidpoint.x,
      hipMidpoint.y - buttocksRadius * 0.3, // Slightly below hip center
      hipMidpoint.z - buttocksDepth // Behind the body
    );

    // Rotate to face backward and downward
    buttocksMesh.rotation.x = Math.PI * 0.1; // Slight tilt

    skeletonGroupRef.current!.add(buttocksMesh);

    // Create LEFT THIGH (hip to knee) with anatomical tapering and confidence
    const leftKneePos = getPos(25);
    const leftHipConf = landmarks[23].visibility || 1.0;
    const leftKneeConf = landmarks[25].visibility || 1.0;
    const leftThigh = createSmoothLimb(
      leftHipPos,
      leftKneePos, // left knee
      AnatomicalProportions.thigh.proximalRadius,  // 0.07 at hip
      AnatomicalProportions.thigh.distalRadius,    // 0.048 at knee
      12,         // segments for smooth curves
      'left_thigh', // limbId for rotation smoothing
      leftHipConf,
      leftKneeConf
    );
    skeletonGroupRef.current!.add(leftThigh);
    limbMeshesRef.current.push(leftThigh); // Store for depth sorting
    limbSegments.push({ start: leftHipPos, end: leftKneePos, id: 'left_thigh' });

    // Add segment connector at midpoint
    const leftThighMid = new THREE.Vector3().lerpVectors(leftHipPos, leftKneePos, 0.5);
    const leftThighConnector = createJointConnector(leftThighMid, 0.053, 0.03);
    skeletonGroupRef.current!.add(leftThighConnector);

    // Create LEFT LOWER LEG (knee to ankle) with anatomical tapering and confidence
    const leftAnklePos = getPos(27);
    const leftAnkleConf = landmarks[27].visibility || 1.0;
    const leftLowerLeg = createSmoothLimb(
      leftKneePos, // left knee
      leftAnklePos, // left ankle
      AnatomicalProportions.shin.proximalRadius,  // 0.048 at knee
      AnatomicalProportions.shin.distalRadius,    // 0.032 at ankle
      12,
      'left_shin',
      leftKneeConf,
      leftAnkleConf
    );
    skeletonGroupRef.current!.add(leftLowerLeg);
    limbMeshesRef.current.push(leftLowerLeg); // Store for depth sorting
    limbSegments.push({ start: leftKneePos, end: leftAnklePos, id: 'left_shin' });

    // Add segment connector at midpoint
    const leftShinMid = new THREE.Vector3().lerpVectors(leftKneePos, leftAnklePos, 0.5);
    const leftShinConnector = createJointConnector(leftShinMid, 0.038, 0.025);
    skeletonGroupRef.current!.add(leftShinConnector);

    // Create RIGHT THIGH (hip to knee) with anatomical tapering and confidence
    const rightKneePos = getPos(26);
    const rightHipConf = landmarks[24].visibility || 1.0;
    const rightKneeConf = landmarks[26].visibility || 1.0;
    const rightThigh = createSmoothLimb(
      rightHipPos,
      rightKneePos, // right knee
      AnatomicalProportions.thigh.proximalRadius,  // 0.07 at hip
      AnatomicalProportions.thigh.distalRadius,    // 0.048 at knee
      12,
      'right_thigh',
      rightHipConf,
      rightKneeConf
    );
    skeletonGroupRef.current!.add(rightThigh);
    limbMeshesRef.current.push(rightThigh); // Store for depth sorting
    limbSegments.push({ start: rightHipPos, end: rightKneePos, id: 'right_thigh' });

    // Add segment connector at midpoint
    const rightThighMid = new THREE.Vector3().lerpVectors(rightHipPos, rightKneePos, 0.5);
    const rightThighConnector = createJointConnector(rightThighMid, 0.053, 0.03);
    skeletonGroupRef.current!.add(rightThighConnector);

    // Create RIGHT LOWER LEG (knee to ankle) with anatomical tapering and confidence
    const rightAnklePos = getPos(28);
    const rightAnkleConf = landmarks[28].visibility || 1.0;
    const rightLowerLeg = createSmoothLimb(
      rightKneePos, // right knee
      rightAnklePos, // right ankle
      AnatomicalProportions.shin.proximalRadius,  // 0.048 at knee
      AnatomicalProportions.shin.distalRadius,    // 0.032 at ankle
      12,
      'right_shin',
      rightKneeConf,
      rightAnkleConf
    );
    skeletonGroupRef.current!.add(rightLowerLeg);
    limbMeshesRef.current.push(rightLowerLeg); // Store for depth sorting
    limbSegments.push({ start: rightKneePos, end: rightAnklePos, id: 'right_shin' });

    // Add segment connector at midpoint
    const rightShinMid = new THREE.Vector3().lerpVectors(rightKneePos, rightAnklePos, 0.5);
    const rightShinConnector = createJointConnector(rightShinMid, 0.038, 0.025);
    skeletonGroupRef.current!.add(rightShinConnector);

    // Create LEFT UPPER ARM (shoulder to elbow) with anatomical tapering and confidence
    const leftElbowPos = getPos(13);
    const leftShoulderConf = landmarks[11].visibility || 1.0;
    const leftElbowConf = landmarks[13].visibility || 1.0;
    const leftUpperArm = createSmoothLimb(
      leftShoulderPos,
      leftElbowPos, // left elbow
      AnatomicalProportions.upperArm.proximalRadius,  // 0.05 at shoulder
      AnatomicalProportions.upperArm.distalRadius,    // 0.035 at elbow
      10,
      'left_upper_arm',
      leftShoulderConf,
      leftElbowConf
    );
    skeletonGroupRef.current!.add(leftUpperArm);
    limbMeshesRef.current.push(leftUpperArm); // Store for depth sorting
    limbSegments.push({ start: leftShoulderPos, end: leftElbowPos, id: 'left_upper_arm' });

    // Add segment connector at midpoint
    const leftUpperArmMid = new THREE.Vector3().lerpVectors(leftShoulderPos, leftElbowPos, 0.5);
    const leftUpperArmConnector = createJointConnector(leftUpperArmMid, 0.038, 0.025);
    skeletonGroupRef.current!.add(leftUpperArmConnector);

    // Create LEFT FOREARM (elbow to wrist) with anatomical tapering and confidence
    const leftWristPos = getPos(15);
    const leftWristConf = landmarks[15].visibility || 1.0;
    const leftForearm = createSmoothLimb(
      leftElbowPos, // left elbow
      leftWristPos, // left wrist
      AnatomicalProportions.forearm.proximalRadius,  // 0.035 at elbow
      AnatomicalProportions.forearm.distalRadius,    // 0.025 at wrist
      10,
      'left_forearm',
      leftElbowConf,
      leftWristConf
    );
    skeletonGroupRef.current!.add(leftForearm);
    limbMeshesRef.current.push(leftForearm); // Store for depth sorting
    limbSegments.push({ start: leftElbowPos, end: leftWristPos, id: 'left_forearm' });

    // Add segment connector at midpoint
    const leftForearmMid = new THREE.Vector3().lerpVectors(leftElbowPos, leftWristPos, 0.5);
    const leftForearmConnector = createJointConnector(leftForearmMid, 0.028, 0.02);
    skeletonGroupRef.current!.add(leftForearmConnector);

    // Create RIGHT UPPER ARM (shoulder to elbow) with anatomical tapering and confidence
    const rightElbowPos = getPos(14);
    const rightShoulderConf = landmarks[12].visibility || 1.0;
    const rightElbowConf = landmarks[14].visibility || 1.0;
    const rightUpperArm = createSmoothLimb(
      rightShoulderPos,
      rightElbowPos, // right elbow
      AnatomicalProportions.upperArm.proximalRadius,  // 0.05 at shoulder
      AnatomicalProportions.upperArm.distalRadius,    // 0.035 at elbow
      10,
      'right_upper_arm',
      rightShoulderConf,
      rightElbowConf
    );
    skeletonGroupRef.current!.add(rightUpperArm);
    limbMeshesRef.current.push(rightUpperArm); // Store for depth sorting
    limbSegments.push({ start: rightShoulderPos, end: rightElbowPos, id: 'right_upper_arm' });

    // Add segment connector at midpoint
    const rightUpperArmMid = new THREE.Vector3().lerpVectors(rightShoulderPos, rightElbowPos, 0.5);
    const rightUpperArmConnector = createJointConnector(rightUpperArmMid, 0.038, 0.025);
    skeletonGroupRef.current!.add(rightUpperArmConnector);

    // Create RIGHT FOREARM (elbow to wrist) with anatomical tapering and confidence
    const rightWristPos = getPos(16);
    const rightWristConf = landmarks[16].visibility || 1.0;
    const rightForearm = createSmoothLimb(
      rightElbowPos, // right elbow
      rightWristPos, // right wrist
      AnatomicalProportions.forearm.proximalRadius,  // 0.035 at elbow
      AnatomicalProportions.forearm.distalRadius,    // 0.025 at wrist
      10,
      'right_forearm',
      rightElbowConf,
      rightWristConf
    );
    skeletonGroupRef.current!.add(rightForearm);
    limbMeshesRef.current.push(rightForearm); // Store for depth sorting
    limbSegments.push({ start: rightElbowPos, end: rightWristPos, id: 'right_forearm' });

    // Add segment connector at midpoint
    const rightForearmMid = new THREE.Vector3().lerpVectors(rightElbowPos, rightWristPos, 0.5);
    const rightForearmConnector = createJointConnector(rightForearmMid, 0.028, 0.02);
    skeletonGroupRef.current!.add(rightForearmConnector);

    // All limbs are now created with smooth curves above
    // Old bone rendering code has been replaced

    // Add ground shadow - use existing hipCenter variable from above
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

    // Generate contact shadows and intersection shadows where limbs are close together
    if (contactShadowGroupRef.current && limbSegments.length > 0) {
      // Create contact shadows (planar)
      const contactShadows = createAllContactShadows(limbSegments, 0.15);
      contactShadows.forEach((shadowMesh) => {
        contactShadowGroupRef.current!.add(shadowMesh);
      });

      // Create intersection shadows (spherical ambient occlusion) for better depth perception
      for (let i = 0; i < limbSegments.length; i++) {
        for (let j = i + 1; j < limbSegments.length; j++) {
          const limb1 = limbSegments[i];
          const limb2 = limbSegments[j];

          // Skip connected limbs
          if (limb1.id === limb2.id) continue;

          // Calculate midpoints
          const mid1 = new THREE.Vector3().lerpVectors(limb1.start, limb1.end, 0.5);
          const mid2 = new THREE.Vector3().lerpVectors(limb2.start, limb2.end, 0.5);
          const distance = mid1.distanceTo(mid2);

          // Create intersection shadow if limbs are close
          if (distance < 0.15) {
            const intersectionShadow = createIntersectionShadow(mid1, mid2, distance, 0.15);
            if (intersectionShadow) {
              contactShadowGroupRef.current!.add(intersectionShadow);
            }
          }
        }
      }
    }

    // Calculate and visualize joint angles
    if (showJointAngles && jointAngleGroupRef.current) {
      jointAngleGroupRef.current.clear();

      const angles: JointAngles = {};

      // Left Elbow
      if (jointAngleOptions.showElbows) {
        const leftShoulder = getRawPos(11);
        const leftElbow = getRawPos(13);
        const leftWrist = getRawPos(15);

        if (leftShoulder && leftElbow && leftWrist) {
          const shoulderPos = new THREE.Vector3(leftShoulder.x, -leftShoulder.y, -leftShoulder.z);
          const elbowPos = new THREE.Vector3(leftElbow.x, -leftElbow.y, -leftElbow.z);
          const wristPos = new THREE.Vector3(leftWrist.x, -leftWrist.y, -leftWrist.z);

          const angle = calculateJointAngle(shoulderPos, elbowPos, wristPos);
          const normal = calculateArcNormal(shoulderPos, elbowPos, wristPos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'left_elbow',
            jointPosition: elbowPos,
            startPoint: shoulderPos,
            endPoint: wristPos,
            normalVector: normal,
          };

          angles.leftElbow = angleData;

          const color = getAngleColor('left_elbow', angle);
          const arc = createAngleArc(angleData, 0.08, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      // Right Elbow
      if (jointAngleOptions.showElbows) {
        const rightShoulder = getRawPos(12);
        const rightElbow = getRawPos(14);
        const rightWrist = getRawPos(16);

        if (rightShoulder && rightElbow && rightWrist) {
          const shoulderPos = new THREE.Vector3(rightShoulder.x, -rightShoulder.y, -rightShoulder.z);
          const elbowPos = new THREE.Vector3(rightElbow.x, -rightElbow.y, -rightElbow.z);
          const wristPos = new THREE.Vector3(rightWrist.x, -rightWrist.y, -rightWrist.z);

          const angle = calculateJointAngle(shoulderPos, elbowPos, wristPos);
          const normal = calculateArcNormal(shoulderPos, elbowPos, wristPos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'right_elbow',
            jointPosition: elbowPos,
            startPoint: shoulderPos,
            endPoint: wristPos,
            normalVector: normal,
          };

          angles.rightElbow = angleData;

          const color = getAngleColor('right_elbow', angle);
          const arc = createAngleArc(angleData, 0.08, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      // Left Knee
      if (jointAngleOptions.showKnees) {
        const leftHip = getRawPos(23);
        const leftKnee = getRawPos(25);
        const leftAnkle = getRawPos(27);

        if (leftHip && leftKnee && leftAnkle) {
          const hipPos = new THREE.Vector3(leftHip.x, -leftHip.y, -leftHip.z);
          const kneePos = new THREE.Vector3(leftKnee.x, -leftKnee.y, -leftKnee.z);
          const anklePos = new THREE.Vector3(leftAnkle.x, -leftAnkle.y, -leftAnkle.z);

          const angle = calculateJointAngle(hipPos, kneePos, anklePos);
          const normal = calculateArcNormal(hipPos, kneePos, anklePos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'left_knee',
            jointPosition: kneePos,
            startPoint: hipPos,
            endPoint: anklePos,
            normalVector: normal,
          };

          angles.leftKnee = angleData;

          const color = getAngleColor('left_knee', angle);
          const arc = createAngleArc(angleData, 0.09, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      // Right Knee
      if (jointAngleOptions.showKnees) {
        const rightHip = getRawPos(24);
        const rightKnee = getRawPos(26);
        const rightAnkle = getRawPos(28);

        if (rightHip && rightKnee && rightAnkle) {
          const hipPos = new THREE.Vector3(rightHip.x, -rightHip.y, -rightHip.z);
          const kneePos = new THREE.Vector3(rightKnee.x, -rightKnee.y, -rightKnee.z);
          const anklePos = new THREE.Vector3(rightAnkle.x, -rightAnkle.y, -rightAnkle.z);

          const angle = calculateJointAngle(hipPos, kneePos, anklePos);
          const normal = calculateArcNormal(hipPos, kneePos, anklePos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'right_knee',
            jointPosition: kneePos,
            startPoint: hipPos,
            endPoint: anklePos,
            normalVector: normal,
          };

          angles.rightKnee = angleData;

          const color = getAngleColor('right_knee', angle);
          const arc = createAngleArc(angleData, 0.09, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      // Left Shoulder
      if (jointAngleOptions.showShoulders) {
        const leftShoulder = getRawPos(11);
        const leftElbow = getRawPos(13);
        const shoulderCenter = getRawPos(11); // Approximation
        const leftHip = getRawPos(23);

        if (leftShoulder && leftElbow && leftHip) {
          const shoulderPos = new THREE.Vector3(leftShoulder.x, -leftShoulder.y, -leftShoulder.z);
          const elbowPos = new THREE.Vector3(leftElbow.x, -leftElbow.y, -leftElbow.z);
          const hipPos = new THREE.Vector3(leftHip.x, -leftHip.y, -leftHip.z);

          const angle = calculateJointAngle(hipPos, shoulderPos, elbowPos);
          const normal = calculateArcNormal(hipPos, shoulderPos, elbowPos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'left_shoulder',
            jointPosition: shoulderPos,
            startPoint: hipPos,
            endPoint: elbowPos,
            normalVector: normal,
          };

          angles.leftShoulder = angleData;

          const color = getAngleColor('left_shoulder', angle);
          const arc = createAngleArc(angleData, 0.08, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      // Right Shoulder
      if (jointAngleOptions.showShoulders) {
        const rightShoulder = getRawPos(12);
        const rightElbow = getRawPos(14);
        const rightHip = getRawPos(24);

        if (rightShoulder && rightElbow && rightHip) {
          const shoulderPos = new THREE.Vector3(rightShoulder.x, -rightShoulder.y, -rightShoulder.z);
          const elbowPos = new THREE.Vector3(rightElbow.x, -rightElbow.y, -rightElbow.z);
          const hipPos = new THREE.Vector3(rightHip.x, -rightHip.y, -rightHip.z);

          const angle = calculateJointAngle(hipPos, shoulderPos, elbowPos);
          const normal = calculateArcNormal(hipPos, shoulderPos, elbowPos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'right_shoulder',
            jointPosition: shoulderPos,
            startPoint: hipPos,
            endPoint: elbowPos,
            normalVector: normal,
          };

          angles.rightShoulder = angleData;

          const color = getAngleColor('right_shoulder', angle);
          const arc = createAngleArc(angleData, 0.08, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      // Left Hip
      if (jointAngleOptions.showHips) {
        const leftShoulder = getRawPos(11);
        const leftHip = getRawPos(23);
        const leftKnee = getRawPos(25);

        if (leftShoulder && leftHip && leftKnee) {
          const shoulderPos = new THREE.Vector3(leftShoulder.x, -leftShoulder.y, -leftShoulder.z);
          const hipPos = new THREE.Vector3(leftHip.x, -leftHip.y, -leftHip.z);
          const kneePos = new THREE.Vector3(leftKnee.x, -leftKnee.y, -leftKnee.z);

          const angle = calculateJointAngle(shoulderPos, hipPos, kneePos);
          const normal = calculateArcNormal(shoulderPos, hipPos, kneePos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'left_hip',
            jointPosition: hipPos,
            startPoint: shoulderPos,
            endPoint: kneePos,
            normalVector: normal,
          };

          angles.leftHip = angleData;

          const color = getAngleColor('left_hip', angle);
          const arc = createAngleArc(angleData, 0.08, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      // Right Hip
      if (jointAngleOptions.showHips) {
        const rightShoulder = getRawPos(12);
        const rightHip = getRawPos(24);
        const rightKnee = getRawPos(26);

        if (rightShoulder && rightHip && rightKnee) {
          const shoulderPos = new THREE.Vector3(rightShoulder.x, -rightShoulder.y, -rightShoulder.z);
          const hipPos = new THREE.Vector3(rightHip.x, -rightHip.y, -rightHip.z);
          const kneePos = new THREE.Vector3(rightKnee.x, -rightKnee.y, -rightKnee.z);

          const angle = calculateJointAngle(shoulderPos, hipPos, kneePos);
          const normal = calculateArcNormal(shoulderPos, hipPos, kneePos);

          const angleData: JointAngleData = {
            angle,
            jointName: 'right_hip',
            jointPosition: hipPos,
            startPoint: shoulderPos,
            endPoint: kneePos,
            normalVector: normal,
          };

          angles.rightHip = angleData;

          const color = getAngleColor('right_hip', angle);
          const arc = createAngleArc(angleData, 0.08, color, true);
          jointAngleGroupRef.current.add(arc);
        }
      }

      setCurrentAngles(angles);
    }

    // Visualize joint constraints
    if (showConstraints && constraintGroupRef.current) {
      constraintGroupRef.current.clear();

      // Map joint indices to current angles for constraints
      const constraintAngles = new Map<number, number>();
      if (currentAngles.leftElbow) constraintAngles.set(13, currentAngles.leftElbow.angle);
      if (currentAngles.rightElbow) constraintAngles.set(14, currentAngles.rightElbow.angle);
      if (currentAngles.leftKnee) constraintAngles.set(25, currentAngles.leftKnee.angle);
      if (currentAngles.rightKnee) constraintAngles.set(26, currentAngles.rightKnee.angle);
      if (currentAngles.leftShoulder) constraintAngles.set(11, currentAngles.leftShoulder.angle);
      if (currentAngles.rightShoulder) constraintAngles.set(12, currentAngles.rightShoulder.angle);
      if (currentAngles.leftHip) constraintAngles.set(23, currentAngles.leftHip.angle);
      if (currentAngles.rightHip) constraintAngles.set(24, currentAngles.rightHip.angle);

      // Left Elbow constraint
      if (constraintOptions.showElbows && constraintAngles.has(13)) {
        const constraint = getConstraintForJoint(13);
        const jointPos = jointPositionsRef.current.get(13);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(13)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Right Elbow constraint
      if (constraintOptions.showElbows && constraintAngles.has(14)) {
        const constraint = getConstraintForJoint(14);
        const jointPos = jointPositionsRef.current.get(14);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(14)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Left Knee constraint
      if (constraintOptions.showKnees && constraintAngles.has(25)) {
        const constraint = getConstraintForJoint(25);
        const jointPos = jointPositionsRef.current.get(25);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(25)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Right Knee constraint
      if (constraintOptions.showKnees && constraintAngles.has(26)) {
        const constraint = getConstraintForJoint(26);
        const jointPos = jointPositionsRef.current.get(26);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(26)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Left Shoulder constraint
      if (constraintOptions.showShoulders && constraintAngles.has(11)) {
        const constraint = getConstraintForJoint(11);
        const jointPos = jointPositionsRef.current.get(11);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(11)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Right Shoulder constraint
      if (constraintOptions.showShoulders && constraintAngles.has(12)) {
        const constraint = getConstraintForJoint(12);
        const jointPos = jointPositionsRef.current.get(12);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(12)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Left Hip constraint
      if (constraintOptions.showHips && constraintAngles.has(23)) {
        const constraint = getConstraintForJoint(23);
        const jointPos = jointPositionsRef.current.get(23);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(23)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Right Hip constraint
      if (constraintOptions.showHips && constraintAngles.has(24)) {
        const constraint = getConstraintForJoint(24);
        const jointPos = jointPositionsRef.current.get(24);
        if (constraint && jointPos) {
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            constraintAngles.get(24)!
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Left Wrist constraint
      if (constraintOptions.showWrists) {
        const constraint = getConstraintForJoint(15);
        const jointPos = jointPositionsRef.current.get(15);
        // Calculate wrist angle if available
        const leftElbowPos = jointPositionsRef.current.get(13);
        const leftWristPos = jointPositionsRef.current.get(15);
        const leftHandPos = jointPositionsRef.current.get(19); // Use index finger
        if (constraint && jointPos && leftElbowPos && leftWristPos && leftHandPos) {
          const wristAngle = calculateJointAngle(leftElbowPos, leftWristPos, leftHandPos);
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            wristAngle
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Right Wrist constraint
      if (constraintOptions.showWrists) {
        const constraint = getConstraintForJoint(16);
        const jointPos = jointPositionsRef.current.get(16);
        // Calculate wrist angle if available
        const rightElbowPos = jointPositionsRef.current.get(14);
        const rightWristPos = jointPositionsRef.current.get(16);
        const rightHandPos = jointPositionsRef.current.get(20); // Use index finger
        if (constraint && jointPos && rightElbowPos && rightWristPos && rightHandPos) {
          const wristAngle = calculateJointAngle(rightElbowPos, rightWristPos, rightHandPos);
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            wristAngle
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Left Ankle constraint
      if (constraintOptions.showAnkles) {
        const constraint = getConstraintForJoint(27);
        const jointPos = jointPositionsRef.current.get(27);
        // Calculate ankle angle if available
        const leftKneePos = jointPositionsRef.current.get(25);
        const leftAnklePos = jointPositionsRef.current.get(27);
        const leftFootPos = jointPositionsRef.current.get(31); // Use foot index
        if (constraint && jointPos && leftKneePos && leftAnklePos && leftFootPos) {
          const ankleAngle = calculateJointAngle(leftKneePos, leftAnklePos, leftFootPos);
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            ankleAngle
          );
          constraintGroupRef.current.add(visualization);
        }
      }

      // Right Ankle constraint
      if (constraintOptions.showAnkles) {
        const constraint = getConstraintForJoint(28);
        const jointPos = jointPositionsRef.current.get(28);
        // Calculate ankle angle if available
        const rightKneePos = jointPositionsRef.current.get(26);
        const rightAnklePos = jointPositionsRef.current.get(28);
        const rightFootPos = jointPositionsRef.current.get(32); // Use foot index
        if (constraint && jointPos && rightKneePos && rightAnklePos && rightFootPos) {
          const ankleAngle = calculateJointAngle(rightKneePos, rightAnklePos, rightFootPos);
          const visualization = createConstraintVisualization(
            constraint,
            jointPos,
            ankleAngle
          );
          constraintGroupRef.current.add(visualization);
        }
      }
    }

    // Render muscles if enabled
    if (showMuscles) {
      renderMuscles(frameIndex);
    }
  };

  // Render muscle groups
  const renderMuscles = (frameIndex: number) => {
    if (!muscleGroupRef.current || !landmarksRef.current[frameIndex]) return;

    // Clear previous muscles
    while (muscleGroupRef.current.children.length > 0) {
      muscleGroupRef.current.remove(muscleGroupRef.current.children[0]);
    }

    // Apply temporal smoothing
    const rawLandmarks = landmarksRef.current[frameIndex];
    const landmarks = temporalSmootherRef.current.smooth(rawLandmarks);

    // Helper to get landmark position with smoothing
    const getPos = (idx: number) => {
      const raw = new THREE.Vector3(landmarks[idx].x, -landmarks[idx].y, -landmarks[idx].z);
      return positionSmootherRef.current.smoothPosition(`muscle_joint_${idx}`, raw);
    };

    // Get key positions
    const leftShoulderPos = getPos(11);
    const rightShoulderPos = getPos(12);
    const leftElbowPos = getPos(13);
    const rightElbowPos = getPos(14);
    const leftWristPos = getPos(15);
    const rightWristPos = getPos(16);
    const leftHipPos = getPos(23);
    const rightHipPos = getPos(24);
    const leftKneePos = getPos(25);
    const rightKneePos = getPos(26);
    const leftAnklePos = getPos(27);
    const rightAnklePos = getPos(28);

    const shoulderCenter = new THREE.Vector3()
      .addVectors(leftShoulderPos, rightShoulderPos)
      .multiplyScalar(0.5);
    const hipCenter = new THREE.Vector3()
      .addVectors(leftHipPos, rightHipPos)
      .multiplyScalar(0.5);

    // ARM MUSCLES
    if (muscleGroups.arms) {
      if (muscleGroups.details) {
        // Detailed view - show biceps/triceps separation
        // Left arm
        const leftBicep = createBicep(leftShoulderPos, leftElbowPos, 'left');
        muscleGroupRef.current.add(leftBicep);

        const leftTricep = createTricep(leftShoulderPos, leftElbowPos, 'left');
        muscleGroupRef.current.add(leftTricep);

        // Right arm
        const rightBicep = createBicep(rightShoulderPos, rightElbowPos, 'right');
        muscleGroupRef.current.add(rightBicep);

        const rightTricep = createTricep(rightShoulderPos, rightElbowPos, 'right');
        muscleGroupRef.current.add(rightTricep);
      }

      // Forearms
      const leftForearmMuscle = createForearm(leftElbowPos, leftWristPos);
      muscleGroupRef.current.add(leftForearmMuscle);

      const rightForearmMuscle = createForearm(rightElbowPos, rightWristPos);
      muscleGroupRef.current.add(rightForearmMuscle);

      // Deltoids (shoulders)
      const leftDeltoid = createDeltoid(leftShoulderPos, 'left');
      muscleGroupRef.current.add(leftDeltoid);

      const rightDeltoid = createDeltoid(rightShoulderPos, 'right');
      muscleGroupRef.current.add(rightDeltoid);
    }

    // LEG MUSCLES
    if (muscleGroups.legs) {
      if (muscleGroups.details) {
        // Detailed view - show quads/hamstrings separation
        // Left leg
        const leftQuad = createQuad(leftHipPos, leftKneePos, 'left');
        muscleGroupRef.current.add(leftQuad);

        const leftHamstring = createHamstring(leftHipPos, leftKneePos, 'left');
        muscleGroupRef.current.add(leftHamstring);

        // Right leg
        const rightQuad = createQuad(rightHipPos, rightKneePos, 'right');
        muscleGroupRef.current.add(rightQuad);

        const rightHamstring = createHamstring(rightHipPos, rightKneePos, 'right');
        muscleGroupRef.current.add(rightHamstring);
      }

      // Calves
      const leftCalf = createCalf(leftKneePos, leftAnklePos);
      muscleGroupRef.current.add(leftCalf);

      const rightCalf = createCalf(rightKneePos, rightAnklePos);
      muscleGroupRef.current.add(rightCalf);

      // Glutes
      const glutes = createGlutes(leftHipPos, rightHipPos, hipCenter);
      muscleGroupRef.current.add(glutes);
    }

    // TORSO MUSCLES
    if (muscleGroups.torso) {
      // Chest
      const chest = createChest(leftShoulderPos, rightShoulderPos, shoulderCenter);
      muscleGroupRef.current.add(chest);

      // Back
      const back = createBack(leftShoulderPos, rightShoulderPos, shoulderCenter, hipCenter);
      muscleGroupRef.current.add(back);

      // Abs
      const abs = createAbs(shoulderCenter, hipCenter);
      muscleGroupRef.current.add(abs);
    }
  };

  // Update skeleton when currentFrame prop changes
  useEffect(() => {
    if (currentFrame >= 0 && currentFrame < totalFrames) {
      renderSkeleton(currentFrame);
    }
  }, [currentFrame, totalFrames, showHeadDirection, headDirectionOptions, showJointAngles, jointAngleOptions, showConstraints, constraintOptions]);

  // Update performance stats periodically
  useEffect(() => {
    if (!showPerformanceStats) return;

    const interval = setInterval(() => {
      if (performanceMonitorRef.current && rendererRef.current && sceneRef.current) {
        const stats = performanceMonitorRef.current.getStats();
        const memoryMB = MemoryManager.estimateMemoryUsage(sceneRef.current);

        setPerformanceStats({
          fps: stats.fps,
          drawCalls: stats.drawCalls,
          triangles: stats.triangles,
          memoryMB: Math.round(memoryMB * 10) / 10,
        });
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [showPerformanceStats]);

  // Update muscle visibility
  useEffect(() => {
    if (muscleGroupRef.current) {
      muscleGroupRef.current.visible = showMuscles;
    }
  }, [showMuscles]);

  // Re-render muscles when muscle settings change
  useEffect(() => {
    if (showMuscles && currentFrame >= 0 && currentFrame < totalFrames) {
      renderMuscles(currentFrame);
    }
  }, [muscleGroups, showMuscles, currentFrame, totalFrames]);

  // Update chain highlight when selection changes or frame changes
  useEffect(() => {
    if (!chainHighlightGroupRef.current) return;

    // Clear previous highlight
    chainHighlightGroupRef.current.clear();

    if (selectedChain && enableChainHighlight && jointPositionsRef.current.size > 0) {
      const highlight = createChainHighlight(jointPositionsRef.current, selectedChain, 1.0);
      chainHighlightGroupRef.current.add(highlight);
    }
  }, [selectedChain, enableChainHighlight, currentFrame]);

  // Update coordinate system visibility
  useEffect(() => {
    if (!coordinateSystemGroupRef.current) return;

    // Rebuild coordinate system based on settings
    coordinateSystemGroupRef.current.clear();

    // Add grid
    if (showGrid) {
      const grid = createEnhancedGrid(2, 20, 0x444444, 0x1a1a1a);
      coordinateSystemGroupRef.current.add(grid);
    }

    // Add floor plane
    if (showFloorPlane) {
      const floorPlane = createFloorPlane(2, 0.1);
      coordinateSystemGroupRef.current.add(floorPlane);
    }

    // Add axes
    if (showAxes) {
      const axes = createCoordinateAxes(0.5);
      coordinateSystemGroupRef.current.add(axes);
    }

    // Add origin marker
    if (showOriginMarker) {
      const originMarker = createOriginMarker(0.02);
      coordinateSystemGroupRef.current.add(originMarker);
    }

    // Add vertical grids
    if (showVerticalGrid) {
      const backWall = createVerticalGrid(2, 2, 10, 0x1a1a1a, 'back');
      coordinateSystemGroupRef.current.add(backWall);

      const leftWall = createVerticalGrid(2, 2, 10, 0x1a1a1a, 'left');
      coordinateSystemGroupRef.current.add(leftWall);
    }
  }, [showAxes, showGrid, showFloorPlane, showVerticalGrid, showOriginMarker]);

  // Update motion trails
  useEffect(() => {
    if (!enableTrails || !motionTrailGroupRef.current) {
      // Clear trails if disabled
      if (motionTrailGroupRef.current) {
        motionTrailGroupRef.current.clear();
      }
      return;
    }

    // Update trail history with current joint positions
    if (jointPositionsRef.current.size > 0) {
      Object.entries(TRAIL_PRESETS).forEach(([key, config]) => {
        if (activeTrails[key]) {
          const position = jointPositionsRef.current.get(config.jointIndex);
          if (position) {
            trailHistoryRef.current.addPosition(config.jointIndex, position);
          }
        }
      });
    }

    // Render trails
    motionTrailGroupRef.current.clear();

    Object.entries(TRAIL_PRESETS).forEach(([key, config]) => {
      if (activeTrails[key]) {
        const history = trailHistoryRef.current.getHistory(config.jointIndex);
        if (history.length >= 2) {
          const trail = createDirectionalTrail(history, config);
          motionTrailGroupRef.current!.add(trail);
        }
      }
    });
  }, [enableTrails, activeTrails, currentFrame]);

  // Update trail length
  useEffect(() => {
    trailHistoryRef.current.setMaxLength(trailLength);
  }, [trailLength]);

  // Clear trail history when trails are disabled
  useEffect(() => {
    if (!enableTrails) {
      trailHistoryRef.current.clearAll();
    }
  }, [enableTrails]);

  // Apply customization changes to the scene
  useEffect(() => {
    if (!skeletonGroupRef.current) return;

    // Apply visualization mode to all meshes
    skeletonGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Determine if this is a joint or bone/limb
        const isJoint = child.name.includes('joint') ||
                        child.geometry instanceof THREE.SphereGeometry;
        const isBone = child.name.includes('limb') || child.name.includes('bone') ||
                       child.geometry instanceof THREE.CylinderGeometry;

        // Apply visibility based on toggles
        if (isJoint && !customization.showJoints) {
          child.visible = false;
          return;
        }
        if (isBone && !customization.showBones) {
          child.visible = false;
          return;
        }

        // Apply visualization mode
        applyVisualizationMode(child, customization.visualizationMode);

        // Only apply color/material changes if not in skeleton mode
        if (customization.visualizationMode !== 'skeleton') {
          applyCustomColor(child.material, customization.baseColor);
          applyCustomTransparency(child.material, customization.transparency);
          applyCustomMaterial(
            child.material,
            customization.metalness,
            customization.roughness
          );
        }
      }
    });

    // Apply scale to skeleton group
    applyModelScale(skeletonGroupRef.current, customization.modelScale);

    // Control overall visibility based on settings
    const shouldShowSkeleton =
      customization.showMesh ||
      customization.showJoints ||
      customization.showBones ||
      customization.visualizationMode === 'skeleton';
    skeletonGroupRef.current.visible = shouldShowSkeleton;

    // Apply to muscle group if it exists
    if (muscleGroupRef.current) {
      muscleGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (customization.visualizationMode === 'skeleton') {
            child.visible = false;
          } else {
            child.visible = showMuscles;
          }
        }
      });
    }
  }, [customization, showMuscles]);

  const handleResetView = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(0, 0.8, 1.8);
      controlsRef.current.reset();
    }
  };

  const handleZoomIn = () => {
    if (!activeCameraRef.current || !controlsRef.current || !containerRef.current) return;

    if (cameraMode === 'orthographic' && orthoCameraRef.current) {
      // For orthographic, adjust frustum size
      const newFrustumSize = orthoFrustumSize * 0.9;
      setOrthoFrustumSize(newFrustumSize);
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      updateOrthographicFrustum(orthoCameraRef.current, width, height, newFrustumSize);
    } else {
      // For perspective, move camera closer
      const direction = new THREE.Vector3();
      activeCameraRef.current.getWorldDirection(direction);
      activeCameraRef.current.position.addScaledVector(direction, 0.2);
    }

    controlsRef.current.update();
  };

  const handleZoomOut = () => {
    if (!activeCameraRef.current || !controlsRef.current || !containerRef.current) return;

    if (cameraMode === 'orthographic' && orthoCameraRef.current) {
      // For orthographic, adjust frustum size
      const newFrustumSize = orthoFrustumSize * 1.1;
      setOrthoFrustumSize(newFrustumSize);
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      updateOrthographicFrustum(orthoCameraRef.current, width, height, newFrustumSize);
    } else {
      // For perspective, move camera away
      const direction = new THREE.Vector3();
      activeCameraRef.current.getWorldDirection(direction);
      activeCameraRef.current.position.addScaledVector(direction, -0.2);
    }

    controlsRef.current.update();
  };

  const handleViewPreset = (preset: ViewPreset) => {
    if (!activeCameraRef.current || !controlsRef.current) return;

    applyViewPreset(activeCameraRef.current, controlsRef.current, preset, 1.8, false);
  };

  const handleCameraModeToggle = () => {
    if (!cameraRef.current || !controlsRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const result = toggleCameraMode(
      cameraMode,
      cameraRef.current,
      orthoCameraRef.current,
      width,
      height,
      orthoFrustumSize
    );

    setCameraMode(result.newMode);
    orthoCameraRef.current = result.orthoCamera;
    activeCameraRef.current = result.camera;

    // Update controls to use new camera
    controlsRef.current.object = result.camera;
    controlsRef.current.update();
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleToggleControls = () => {
    setControlsExpanded(!controlsExpanded);
  };

  return (
    <Box
      sx={{
        width: isFullscreen ? '100vw' : width,
        height: isFullscreen ? '100vh' : height,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0a0a0a',
        borderRadius: isFullscreen ? 0 : 1,
        overflow: 'hidden',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
      }}
    >
      {/* Header with Fullscreen Toggle */}
      <Box sx={{ p: 1, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        <Stack direction="row" spacing={0.5}>
          <IconButton
            onClick={handleToggleControls}
            sx={{ color: 'white' }}
            title={controlsExpanded ? 'Hide Controls' : 'Show Controls'}
            size="small"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={handleToggleFullscreen}
            sx={{ color: 'white' }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            size="small"
          >
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Stack>
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

        {/* Joint Hover Tooltip */}
        {showTooltips && hoveredJoint && tooltipPosition && (
          <Box
            sx={{
              position: 'fixed',
              left: tooltipPosition.x + 15,
              top: tooltipPosition.y + 15,
              bgcolor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              p: 1.5,
              borderRadius: 1,
              border: `2px solid ${getCategoryColor(getJointCategory(hoveredJoint.jointIndex))}`,
              zIndex: 1000,
              pointerEvents: 'none',
              minWidth: 200,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Stack spacing={0.5}>
              {/* Joint Name */}
              <Typography
                variant="caption"
                sx={{
                  color: getCategoryColor(getJointCategory(hoveredJoint.jointIndex)),
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                }}
              >
                {hoveredJoint.jointName}
              </Typography>

              <Divider sx={{ borderColor: '#444', my: 0.5 }} />

              {/* Confidence */}
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
                  Confidence:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: hoveredJoint.confidence > 0.9 ? '#00FF88' : hoveredJoint.confidence > 0.5 ? '#FFAA00' : '#FF4444',
                    fontWeight: 'bold',
                    fontSize: '0.7rem',
                  }}
                >
                  {formatConfidence(hoveredJoint.confidence)}
                </Typography>
              </Stack>

              {/* Position */}
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
                  Position:
                </Typography>
                <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                  {formatPosition(hoveredJoint.position)}
                </Typography>
              </Stack>

              {/* Angle if available */}
              {hoveredJoint.angle !== undefined && (
                <>
                  <Divider sx={{ borderColor: '#444', my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
                      Joint Angle:
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#FFAA00',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                      }}
                    >
                      {Math.round(hoveredJoint.angle)}°
                    </Typography>
                  </Stack>
                </>
              )}

              {/* Connected Joints */}
              {hoveredJoint.connectedJoints.length > 0 && (
                <>
                  <Divider sx={{ borderColor: '#444', my: 0.5 }} />
                  <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
                    Connected to:
                  </Typography>
                  <Box sx={{ pl: 1 }}>
                    {hoveredJoint.connectedJoints.slice(0, 3).map((connectedIndex) => (
                      <Typography
                        key={connectedIndex}
                        variant="caption"
                        sx={{ color: '#888', fontSize: '0.65rem', display: 'block' }}
                      >
                        • {JOINT_NAMES[connectedIndex] || `Joint ${connectedIndex}`}
                      </Typography>
                    ))}
                    {hoveredJoint.connectedJoints.length > 3 && (
                      <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem' }}>
                        + {hoveredJoint.connectedJoints.length - 3} more
                      </Typography>
                    )}
                  </Box>
                </>
              )}

              {/* Description */}
              <Divider sx={{ borderColor: '#444', my: 0.5 }} />
              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', fontStyle: 'italic' }}>
                {getJointDescription(hoveredJoint.jointIndex)}
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Performance Stats Display */}
      {showPerformanceStats && (
        <Box
          sx={{
            position: 'absolute',
            top: 60,
            left: 16,
            bgcolor: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid #333',
            borderRadius: 1,
            p: 1,
            zIndex: 100,
            minWidth: 120,
          }}
        >
          <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
            Performance
          </Typography>
          <Stack spacing={0.3}>
            <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem', fontFamily: 'monospace' }}>
              FPS: {performanceStats.fps}
            </Typography>
            <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem', fontFamily: 'monospace' }}>
              Draws: {performanceStats.drawCalls}
            </Typography>
            <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem', fontFamily: 'monospace' }}>
              Tris: {performanceStats.triangles}
            </Typography>
            <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem', fontFamily: 'monospace' }}>
              Mem: {performanceStats.memoryMB} MB
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Floating Control Toggle Button (when panel is collapsed) */}
      {!controlsExpanded && (
        <IconButton
          onClick={handleToggleControls}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            bgcolor: 'rgba(167, 139, 250, 0.9)',
            color: 'white',
            zIndex: 100,
            '&:hover': {
              bgcolor: 'rgba(167, 139, 250, 1)',
            },
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
          size="large"
          title="Show Controls"
        >
          <TuneIcon />
        </IconButton>
      )}

      {/* Floating Controls Panel */}
      {controlsExpanded && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 320,
            maxHeight: 'calc(100% - 100px)',
            overflowY: 'auto',
            bgcolor: 'rgba(10, 10, 10, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #333',
            borderRadius: 2,
            p: 1.5,
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 1,
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'rgba(167, 139, 250, 0.5)',
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'rgba(167, 139, 250, 0.7)',
              },
            },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TuneIcon fontSize="small" /> Controls
            </Typography>
            <IconButton
              onClick={handleToggleControls}
              size="small"
              sx={{ color: '#888', '&:hover': { color: 'white' } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Divider sx={{ borderColor: '#333', mb: 1 }} />
          <Stack spacing={1}>
          {/* View controls */}
          <Stack spacing={1}>
            {/* Camera Mode Toggle */}
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Button
                onClick={handleCameraModeToggle}
                size="small"
                variant={cameraMode === 'orthographic' ? 'contained' : 'outlined'}
                sx={{
                  fontSize: '0.7rem',
                  color: cameraMode === 'orthographic' ? '#000' : '#A78BFA',
                  bgcolor: cameraMode === 'orthographic' ? '#A78BFA' : 'transparent',
                  borderColor: '#A78BFA',
                  '&:hover': {
                    bgcolor: cameraMode === 'orthographic' ? '#A78BFA' : 'rgba(167, 139, 250, 0.1)',
                  },
                }}
              >
                {cameraMode === 'perspective' ? 'Perspective' : 'Orthographic'}
              </Button>

              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', fontStyle: 'italic' }}>
                {cameraMode === 'orthographic' ? 'Parallel projection' : 'Natural depth'}
              </Typography>
            </Stack>

            {/* View Presets */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
            >
              <ButtonGroup variant="outlined" size="small">
                <Button onClick={() => handleViewPreset('front')}>Front</Button>
                <Button onClick={() => handleViewPreset('right')}>Right</Button>
                <Button onClick={() => handleViewPreset('top')}>Top</Button>
                <Button onClick={() => handleViewPreset('isometric')}>Iso</Button>
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
          </Stack>

          {/* Muscle Group Controls */}
          <Divider sx={{ borderColor: '#333', my: 0.5 }} />
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
            }}
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showMuscles}
                    onChange={(e) => setShowMuscles(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#A78BFA',
                      '&.Mui-checked': { color: '#A78BFA' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Show Muscle Groups
                  </Typography>
                }
              />

              {showMuscles && (
                <Stack spacing={0.5} sx={{ pl: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={muscleGroups.arms}
                        onChange={(e) =>
                          setMuscleGroups({ ...muscleGroups, arms: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#FF6B6B', '&.Mui-checked': { color: '#FF6B6B' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Arms (Biceps, Triceps, Forearms, Deltoids)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={muscleGroups.legs}
                        onChange={(e) =>
                          setMuscleGroups({ ...muscleGroups, legs: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#FECA57', '&.Mui-checked': { color: '#FECA57' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Legs (Quads, Hamstrings, Calves, Glutes)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={muscleGroups.torso}
                        onChange={(e) =>
                          setMuscleGroups({ ...muscleGroups, torso: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#4ECDC4', '&.Mui-checked': { color: '#4ECDC4' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Torso (Chest, Back, Abs)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={muscleGroups.details}
                        onChange={(e) =>
                          setMuscleGroups({ ...muscleGroups, details: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#F9CA24', '&.Mui-checked': { color: '#F9CA24' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                        Detailed Separation (Biceps/Triceps, Quads/Hamstrings)
                      </Typography>
                    }
                  />
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Confidence Legend */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'white', fontWeight: 'bold', display: 'block', mb: 0.5 }}
            >
              Detection Confidence
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" flexWrap="wrap">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, bgcolor: '#B899FA', borderRadius: '50%' }} />
                <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                  High (&gt;90%)
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, bgcolor: '#FFAA44', borderRadius: '50%' }} />
                <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                  Medium (50-90%)
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, bgcolor: '#FF4444', borderRadius: '50%' }} />
                <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                  Low (&lt;50%)
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, bgcolor: '#666666', borderRadius: '50%' }} />
                <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                  Missing
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          {/* Model Customization Controls */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={1}>
              <Button
                onClick={() => setShowCustomization(!showCustomization)}
                startIcon={<TuneIcon />}
                endIcon={showCustomization ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{
                  color: 'white',
                  textTransform: 'none',
                  justifyContent: 'space-between',
                  '&:hover': { bgcolor: '#2a2a2a' },
                }}
                fullWidth
              >
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  Model Customization
                </Typography>
              </Button>

              {showCustomization && (
                <Stack spacing={1.5} sx={{ px: 1 }}>
                  {/* Visualization Mode */}
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: '#888', fontSize: '0.75rem' }}>
                      Visualization Mode
                    </InputLabel>
                    <Select
                      value={customization.visualizationMode}
                      onChange={(e) =>
                        setCustomization({
                          ...customization,
                          visualizationMode: e.target.value as VisualizationMode,
                        })
                      }
                      label="Visualization Mode"
                      sx={{
                        color: 'white',
                        fontSize: '0.75rem',
                        '.MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                        '.MuiSvgIcon-root': { color: 'white' },
                      }}
                    >
                      <MenuItem value="solid">Solid</MenuItem>
                      <MenuItem value="wireframe">Wireframe</MenuItem>
                      <MenuItem value="skeleton">Skeleton Only</MenuItem>
                      <MenuItem value="transparent">Transparent</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Base Color */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mb: 0.5 }}>
                      Base Color
                    </Typography>
                    <input
                      type="color"
                      value={customization.baseColor}
                      onChange={(e) =>
                        setCustomization({ ...customization, baseColor: e.target.value })
                      }
                      style={{
                        width: '100%',
                        height: '32px',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    />
                  </Box>

                  {/* Transparency */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mb: 0.5 }}>
                      Transparency: {customization.transparency}%
                    </Typography>
                    <Slider
                      value={customization.transparency}
                      onChange={(_, value) =>
                        setCustomization({ ...customization, transparency: value as number })
                      }
                      min={0}
                      max={100}
                      sx={{
                        color: '#A78BFA',
                        '& .MuiSlider-thumb': { width: 12, height: 12 },
                      }}
                    />
                  </Box>

                  {/* Metalness */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mb: 0.5 }}>
                      Metalness: {customization.metalness}%
                    </Typography>
                    <Slider
                      value={customization.metalness}
                      onChange={(_, value) =>
                        setCustomization({ ...customization, metalness: value as number })
                      }
                      min={0}
                      max={100}
                      sx={{
                        color: '#A78BFA',
                        '& .MuiSlider-thumb': { width: 12, height: 12 },
                      }}
                    />
                  </Box>

                  {/* Roughness */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mb: 0.5 }}>
                      Roughness: {customization.roughness}%
                    </Typography>
                    <Slider
                      value={customization.roughness}
                      onChange={(_, value) =>
                        setCustomization({ ...customization, roughness: value as number })
                      }
                      min={0}
                      max={100}
                      sx={{
                        color: '#A78BFA',
                        '& .MuiSlider-thumb': { width: 12, height: 12 },
                      }}
                    />
                  </Box>

                  {/* Model Scale */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mb: 0.5 }}>
                      Model Scale: {customization.modelScale.toFixed(2)}x
                    </Typography>
                    <Slider
                      value={customization.modelScale}
                      onChange={(_, value) =>
                        setCustomization({ ...customization, modelScale: value as number })
                      }
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      sx={{
                        color: '#A78BFA',
                        '& .MuiSlider-thumb': { width: 12, height: 12 },
                      }}
                    />
                  </Box>

                  {/* Visibility Toggles */}
                  <Stack spacing={0.5}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={customization.showMesh}
                          onChange={(e) =>
                            setCustomization({ ...customization, showMesh: e.target.checked })
                          }
                          size="small"
                          sx={{ color: '#A78BFA', '&.Mui-checked': { color: '#A78BFA' } }}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ color: '#ccc' }}>
                          Show Mesh
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={customization.showJoints}
                          onChange={(e) =>
                            setCustomization({ ...customization, showJoints: e.target.checked })
                          }
                          size="small"
                          sx={{ color: '#A78BFA', '&.Mui-checked': { color: '#A78BFA' } }}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ color: '#ccc' }}>
                          Show Joints
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={customization.showBones}
                          onChange={(e) =>
                            setCustomization({ ...customization, showBones: e.target.checked })
                          }
                          size="small"
                          sx={{ color: '#A78BFA', '&.Mui-checked': { color: '#A78BFA' } }}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ color: '#ccc' }}>
                          Show Bones
                        </Typography>
                      }
                    />
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Head Direction Controls */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showHeadDirection}
                    onChange={(e) => setShowHeadDirection(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#00FF88',
                      '&.Mui-checked': { color: '#00FF88' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Head Direction Indicators
                  </Typography>
                }
              />

              {showHeadDirection && (
                <Stack spacing={0.5} sx={{ pl: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={headDirectionOptions.showArrow}
                        onChange={(e) =>
                          setHeadDirectionOptions({
                            ...headDirectionOptions,
                            showArrow: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#00FF88', '&.Mui-checked': { color: '#00FF88' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Directional Arrow
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={headDirectionOptions.showEyes}
                        onChange={(e) =>
                          setHeadDirectionOptions({
                            ...headDirectionOptions,
                            showEyes: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#00CCFF', '&.Mui-checked': { color: '#00CCFF' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Eye Direction Indicators
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={headDirectionOptions.showPlane}
                        onChange={(e) =>
                          setHeadDirectionOptions({
                            ...headDirectionOptions,
                            showPlane: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#00FF88', '&.Mui-checked': { color: '#00FF88' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Face Orientation Plane
                      </Typography>
                    }
                  />
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Joint Angle Controls */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showJointAngles}
                    onChange={(e) => setShowJointAngles(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#FFAA00',
                      '&.Mui-checked': { color: '#FFAA00' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Joint Angle Indicators
                  </Typography>
                }
              />

              {showJointAngles && (
                <Stack spacing={0.5} sx={{ pl: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={jointAngleOptions.showElbows}
                        onChange={(e) =>
                          setJointAngleOptions({
                            ...jointAngleOptions,
                            showElbows: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#FFAA00', '&.Mui-checked': { color: '#FFAA00' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Elbow Angles
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={jointAngleOptions.showKnees}
                        onChange={(e) =>
                          setJointAngleOptions({
                            ...jointAngleOptions,
                            showKnees: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#FFAA00', '&.Mui-checked': { color: '#FFAA00' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Knee Angles
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={jointAngleOptions.showShoulders}
                        onChange={(e) =>
                          setJointAngleOptions({
                            ...jointAngleOptions,
                            showShoulders: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#00CCFF', '&.Mui-checked': { color: '#00CCFF' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Shoulder Angles
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={jointAngleOptions.showHips}
                        onChange={(e) =>
                          setJointAngleOptions({
                            ...jointAngleOptions,
                            showHips: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#00CCFF', '&.Mui-checked': { color: '#00CCFF' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Hip Angles
                      </Typography>
                    }
                  />

                  {/* Display current angles */}
                  {Object.keys(currentAngles).length > 0 && (
                    <Box sx={{ mt: 1, p: 1, bgcolor: '#0a0a0a', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
                        Current Angles:
                      </Typography>
                      <Stack spacing={0.3}>
                        {currentAngles.leftElbow && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            L Elbow: {Math.round(currentAngles.leftElbow.angle)}°
                          </Typography>
                        )}
                        {currentAngles.rightElbow && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            R Elbow: {Math.round(currentAngles.rightElbow.angle)}°
                          </Typography>
                        )}
                        {currentAngles.leftKnee && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            L Knee: {Math.round(currentAngles.leftKnee.angle)}°
                          </Typography>
                        )}
                        {currentAngles.rightKnee && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            R Knee: {Math.round(currentAngles.rightKnee.angle)}°
                          </Typography>
                        )}
                        {currentAngles.leftShoulder && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            L Shoulder: {Math.round(currentAngles.leftShoulder.angle)}°
                          </Typography>
                        )}
                        {currentAngles.rightShoulder && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            R Shoulder: {Math.round(currentAngles.rightShoulder.angle)}°
                          </Typography>
                        )}
                        {currentAngles.leftHip && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            L Hip: {Math.round(currentAngles.leftHip.angle)}°
                          </Typography>
                        )}
                        {currentAngles.rightHip && (
                          <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.65rem' }}>
                            R Hip: {Math.round(currentAngles.rightHip.angle)}°
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Joint Constraint Controls */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showConstraints}
                    onChange={(e) => setShowConstraints(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#FF6600',
                      '&.Mui-checked': { color: '#FF6600' },
                    }}
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                      Joint Constraint Visualization
                    </Typography>
                  </Stack>
                }
              />

              {showConstraints && (
                <Stack spacing={0.5} sx={{ pl: 2 }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', fontStyle: 'italic', mb: 0.5 }}>
                    Visualizes anatomical range of motion limits
                  </Typography>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={constraintOptions.showElbows}
                        onChange={(e) =>
                          setConstraintOptions({
                            ...constraintOptions,
                            showElbows: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#FF6B6B', '&.Mui-checked': { color: '#FF6B6B' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Elbows (Hinge: 0-150°)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={constraintOptions.showKnees}
                        onChange={(e) =>
                          setConstraintOptions({
                            ...constraintOptions,
                            showKnees: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#FECA57', '&.Mui-checked': { color: '#FECA57' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Knees (Hinge: 0-140°)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={constraintOptions.showShoulders}
                        onChange={(e) =>
                          setConstraintOptions({
                            ...constraintOptions,
                            showShoulders: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#FF4466', '&.Mui-checked': { color: '#FF4466' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Shoulders (Ball-Socket: 0-180°)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={constraintOptions.showHips}
                        onChange={(e) =>
                          setConstraintOptions({
                            ...constraintOptions,
                            showHips: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#FDB447', '&.Mui-checked': { color: '#FDB447' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Hips (Ball-Socket: 0-120°)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={constraintOptions.showWrists}
                        onChange={(e) =>
                          setConstraintOptions({
                            ...constraintOptions,
                            showWrists: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#4ECDC4', '&.Mui-checked': { color: '#4ECDC4' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Wrists (Saddle: -70° to 80°)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={constraintOptions.showAnkles}
                        onChange={(e) =>
                          setConstraintOptions({
                            ...constraintOptions,
                            showAnkles: e.target.checked,
                          })
                        }
                        size="small"
                        sx={{ color: '#00CCFF', '&.Mui-checked': { color: '#00CCFF' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        Ankles (Hinge: -45° to 30°)
                      </Typography>
                    }
                  />

                  {/* Constraint Status Legend */}
                  <Box sx={{ mt: 1, p: 1, bgcolor: '#0a0a0a', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
                      Status Colors:
                    </Typography>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap">
                      <Stack direction="row" spacing={0.3} alignItems="center">
                        <Box sx={{ width: 8, height: 8, bgcolor: '#00FF00', borderRadius: '50%' }} />
                        <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.6rem' }}>
                          Safe
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.3} alignItems="center">
                        <Box sx={{ width: 8, height: 8, bgcolor: '#FFAA00', borderRadius: '50%' }} />
                        <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.6rem' }}>
                          Warning
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.3} alignItems="center">
                        <Box sx={{ width: 8, height: 8, bgcolor: '#FF6600', borderRadius: '50%' }} />
                        <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.6rem' }}>
                          Limit
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.3} alignItems="center">
                        <Box sx={{ width: 8, height: 8, bgcolor: '#FF0000', borderRadius: '50%' }} />
                        <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.6rem' }}>
                          Exceeded
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Interaction Settings */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showTooltips}
                    onChange={(e) => setShowTooltips(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#4ECDC4',
                      '&.Mui-checked': { color: '#4ECDC4' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Show Joint Tooltips on Hover
                  </Typography>
                }
              />

              <Divider sx={{ borderColor: '#333', my: 0.5 }} />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableChainHighlight}
                    onChange={(e) => setEnableChainHighlight(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#FF6B6B',
                      '&.Mui-checked': { color: '#FF6B6B' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Kinematic Chain Highlighting
                  </Typography>
                }
              />

              {/* Quick Chain Selection */}
              {enableChainHighlight && (
                <Box sx={{ pl: 2 }}>
                  <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
                    Quick select:
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                    {KINEMATIC_CHAINS.filter((c) => c.category !== 'torso' && c.category !== 'head').map((chain) => (
                      <Button
                        key={chain.name}
                        onClick={() => setSelectedChain(chain)}
                        size="small"
                        variant={selectedChain?.name === chain.name ? 'contained' : 'outlined'}
                        sx={{
                          fontSize: '0.6rem',
                          minWidth: 'auto',
                          px: 1,
                          py: 0.3,
                          color: selectedChain?.name === chain.name ? '#000' : `#${chain.color.toString(16).padStart(6, '0')}`,
                          bgcolor: selectedChain?.name === chain.name ? `#${chain.color.toString(16).padStart(6, '0')}` : 'transparent',
                          borderColor: `#${chain.color.toString(16).padStart(6, '0')}`,
                          '&:hover': {
                            bgcolor: selectedChain?.name === chain.name
                              ? `#${chain.color.toString(16).padStart(6, '0')}`
                              : 'rgba(255, 107, 107, 0.1)',
                          },
                        }}
                      >
                        {chain.name}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Selected Chain Info */}
              {selectedChain && enableChainHighlight && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1,
                    bgcolor: '#0a0a0a',
                    borderRadius: 1,
                    border: `2px solid #${selectedChain.color.toString(16).padStart(6, '0')}`,
                  }}
                >
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography
                        variant="caption"
                        sx={{
                          color: `#${selectedChain.color.toString(16).padStart(6, '0')}`,
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                        }}
                      >
                        {selectedChain.name}
                      </Typography>
                      <Button
                        onClick={() => setSelectedChain(null)}
                        size="small"
                        sx={{
                          color: '#888',
                          minWidth: 'auto',
                          p: 0.5,
                          fontSize: '0.65rem',
                        }}
                      >
                        Clear
                      </Button>
                    </Stack>

                    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem' }}>
                      {getChainDescription(selectedChain)}
                    </Typography>

                    <Divider sx={{ borderColor: '#333', my: 0.5 }} />

                    <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.65rem' }}>
                      Joints in chain:
                    </Typography>
                    <Box sx={{ pl: 1 }}>
                      {getChainSequence(selectedChain).slice(0, 4).map((joint, idx) => (
                        <Typography
                          key={idx}
                          variant="caption"
                          sx={{ color: '#888', fontSize: '0.6rem', display: 'block' }}
                        >
                          {idx === 0 ? '↳' : '  ↳'} {joint}
                        </Typography>
                      ))}
                      {getChainSequence(selectedChain).length > 4 && (
                        <Typography variant="caption" sx={{ color: '#666', fontSize: '0.6rem' }}>
                          + {getChainSequence(selectedChain).length - 4} more
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              )}
            </Stack>
          </Paper>

          {/* Coordinate System Controls */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', mb: 0.5 }}>
                Reference System
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={showAxes}
                    onChange={(e) => setShowAxes(e.target.checked)}
                    size="small"
                    sx={{ color: '#888', '&.Mui-checked': { color: '#888' } }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                    Coordinate Axes (X, Y, Z)
                  </Typography>
                }
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    size="small"
                    sx={{ color: '#888', '&.Mui-checked': { color: '#888' } }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                    Floor Grid
                  </Typography>
                }
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={showOriginMarker}
                    onChange={(e) => setShowOriginMarker(e.target.checked)}
                    size="small"
                    sx={{ color: '#888', '&.Mui-checked': { color: '#888' } }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                    Origin Marker
                  </Typography>
                }
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={showFloorPlane}
                    onChange={(e) => setShowFloorPlane(e.target.checked)}
                    size="small"
                    sx={{ color: '#888', '&.Mui-checked': { color: '#888' } }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                    Floor Plane
                  </Typography>
                }
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={showVerticalGrid}
                    onChange={(e) => setShowVerticalGrid(e.target.checked)}
                    size="small"
                    sx={{ color: '#888', '&.Mui-checked': { color: '#888' } }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                    Vertical Reference Walls
                  </Typography>
                }
              />
            </Stack>
          </Paper>

          {/* Motion Trail Controls */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableTrails}
                    onChange={(e) => setEnableTrails(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#A78BFA',
                      '&.Mui-checked': { color: '#A78BFA' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Motion Trails
                  </Typography>
                }
              />

              {enableTrails && (
                <Stack spacing={1} sx={{ pl: 2 }}>
                  {/* Trail Length Slider */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#ccc', display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                      Trail Length: {trailLength} frames
                    </Typography>
                    <Slider
                      value={trailLength}
                      onChange={(_, value) => setTrailLength(value as number)}
                      min={10}
                      max={60}
                      step={5}
                      sx={{
                        color: '#A78BFA',
                        '& .MuiSlider-thumb': { width: 12, height: 12 },
                      }}
                    />
                  </Box>

                  <Divider sx={{ borderColor: '#333', my: 0.5 }} />

                  {/* Active Trails */}
                  <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
                    Active Trails:
                  </Typography>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activeTrails.leftHand}
                        onChange={(e) =>
                          setActiveTrails({ ...activeTrails, leftHand: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#FF6B6B', '&.Mui-checked': { color: '#FF6B6B' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                        Left Hand
                      </Typography>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activeTrails.rightHand}
                        onChange={(e) =>
                          setActiveTrails({ ...activeTrails, rightHand: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#FF8E8E', '&.Mui-checked': { color: '#FF8E8E' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                        Right Hand
                      </Typography>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activeTrails.leftFoot}
                        onChange={(e) =>
                          setActiveTrails({ ...activeTrails, leftFoot: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#FECA57', '&.Mui-checked': { color: '#FECA57' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                        Left Foot
                      </Typography>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activeTrails.rightFoot}
                        onChange={(e) =>
                          setActiveTrails({ ...activeTrails, rightFoot: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#FFD77A', '&.Mui-checked': { color: '#FFD77A' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                        Right Foot
                      </Typography>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activeTrails.head}
                        onChange={(e) =>
                          setActiveTrails({ ...activeTrails, head: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#00CCFF', '&.Mui-checked': { color: '#00CCFF' } }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: '#ccc', fontSize: '0.7rem' }}>
                        Head
                      </Typography>
                    }
                  />

                  <Button
                    onClick={() => trailHistoryRef.current.clearAll()}
                    size="small"
                    variant="outlined"
                    sx={{
                      mt: 1,
                      fontSize: '0.65rem',
                      color: '#888',
                      borderColor: '#444',
                      '&:hover': { borderColor: '#666', bgcolor: '#1a1a1a' },
                    }}
                  >
                    Clear All Trails
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Optimization Controls */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#1a1a1a',
              p: 1,
              borderRadius: 1,
              border: '1px solid #333',
            }}
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableOptimizations}
                    onChange={(e) => setEnableOptimizations(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#00FF88',
                      '&.Mui-checked': { color: '#00FF88' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Performance Optimizations
                  </Typography>
                }
              />

              {enableOptimizations && (
                <Stack spacing={0.5} sx={{ pl: 2 }}>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', fontStyle: 'italic' }}>
                    • Geometry &amp; material caching
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', fontStyle: 'italic' }}>
                    • Frustum culling
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', fontStyle: 'italic' }}>
                    • LOD (Level of Detail)
                  </Typography>
                </Stack>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={showPerformanceStats}
                    onChange={(e) => setShowPerformanceStats(e.target.checked)}
                    size="small"
                    sx={{
                      color: '#A78BFA',
                      '&.Mui-checked': { color: '#A78BFA' },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Show Performance Stats
                  </Typography>
                }
              />
            </Stack>
          </Paper>

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
      )}
    </Box>
  );
};
