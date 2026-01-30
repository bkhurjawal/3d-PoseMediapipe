/**
 * Head Direction and Facial Indicators
 * Creates directional arrows and eye direction indicators
 */

import * as THREE from 'three';

/**
 * Calculate face direction vector from nose and ear landmarks
 */
export function calculateFaceDirection(
  nose: THREE.Vector3,
  leftEar: THREE.Vector3,
  rightEar: THREE.Vector3
): THREE.Vector3 {
  // Calculate the center between ears (back of head)
  const earCenter = new THREE.Vector3()
    .addVectors(leftEar, rightEar)
    .multiplyScalar(0.5);

  // Direction from ear center to nose (forward direction)
  const direction = new THREE.Vector3()
    .subVectors(nose, earCenter)
    .normalize();

  return direction;
}

/**
 * Calculate face normal (up vector) from face landmarks
 */
export function calculateFaceNormal(
  nose: THREE.Vector3,
  leftEye: THREE.Vector3,
  rightEye: THREE.Vector3
): THREE.Vector3 {
  // Vector from right eye to left eye
  const eyeVector = new THREE.Vector3().subVectors(leftEye, rightEye);

  // Eye center to nose vector
  const eyeCenter = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);
  const noseVector = new THREE.Vector3().subVectors(nose, eyeCenter);

  // Cross product gives us the normal (perpendicular to face plane)
  const normal = new THREE.Vector3()
    .crossVectors(eyeVector, noseVector)
    .normalize();

  return normal;
}

/**
 * Create directional arrow on head
 */
export function createHeadDirectionArrow(
  headPosition: THREE.Vector3,
  direction: THREE.Vector3,
  color: number = 0x00FF00,
  length: number = 0.15
): THREE.Group {
  const arrowGroup = new THREE.Group();

  // Arrow shaft (cylinder)
  const shaftLength = length * 0.7;
  const shaftRadius = 0.008;
  const shaftGeometry = new THREE.CylinderGeometry(
    shaftRadius,
    shaftRadius,
    shaftLength,
    16
  );
  const shaftMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.3,
    metalness: 0.6,
    roughness: 0.3,
  });
  const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);

  // Arrow head (cone)
  const headLength = length * 0.3;
  const headRadius = 0.02;
  const headGeometry = new THREE.ConeGeometry(headRadius, headLength, 16);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.4,
    metalness: 0.7,
    roughness: 0.2,
  });
  const arrowHead = new THREE.Mesh(headGeometry, headMaterial);

  // Position arrow head at end of shaft
  arrowHead.position.y = shaftLength / 2 + headLength / 2;

  arrowGroup.add(shaft);
  arrowGroup.add(arrowHead);

  // Position arrow group at head position
  arrowGroup.position.copy(headPosition);

  // Orient arrow in direction
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(up, direction);
  arrowGroup.setRotationFromQuaternion(quaternion);

  arrowGroup.name = 'head_direction_arrow';

  return arrowGroup;
}

/**
 * Create eye direction indicator
 */
export function createEyeDirectionIndicator(
  eyePosition: THREE.Vector3,
  faceDirection: THREE.Vector3,
  isLeftEye: boolean,
  color: number = 0x00CCFF
): THREE.Group {
  const eyeGroup = new THREE.Group();

  // Small sphere at eye position (pupil representation)
  const pupilRadius = 0.012;
  const pupilGeometry = new THREE.SphereGeometry(pupilRadius, 16, 16);
  const pupilMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
  });
  const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);

  // Small cone showing gaze direction
  const gazeLength = 0.04;
  const gazeRadius = 0.008;
  const gazeGeometry = new THREE.ConeGeometry(gazeRadius, gazeLength, 12);
  const gazeMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.7,
    metalness: 0.5,
    roughness: 0.4,
  });
  const gazeCone = new THREE.Mesh(gazeGeometry, gazeMaterial);

  // Position gaze cone in front of pupil
  gazeCone.position.copy(faceDirection.clone().multiplyScalar(gazeLength / 2 + pupilRadius));

  // Orient gaze cone
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(up, faceDirection);
  gazeCone.setRotationFromQuaternion(quaternion);

  eyeGroup.add(pupil);
  eyeGroup.add(gazeCone);

  // Position at eye location
  eyeGroup.position.copy(eyePosition);

  eyeGroup.name = isLeftEye ? 'left_eye_indicator' : 'right_eye_indicator';

  return eyeGroup;
}

/**
 * Create face orientation plane (subtle indicator)
 */
export function createFaceOrientationPlane(
  headPosition: THREE.Vector3,
  faceDirection: THREE.Vector3,
  faceNormal: THREE.Vector3,
  size: number = 0.12
): THREE.Mesh {
  const planeGeometry = new THREE.PlaneGeometry(size, size * 0.8);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0x00FF88,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);

  // Position at head
  plane.position.copy(headPosition);
  plane.position.add(faceDirection.clone().multiplyScalar(0.08));

  // Orient plane perpendicular to face direction
  const quaternion = new THREE.Quaternion();
  const targetDir = faceDirection.clone().normalize();
  const up = faceNormal.clone().normalize();
  const matrix = new THREE.Matrix4();
  matrix.lookAt(new THREE.Vector3(0, 0, 0), targetDir, up);
  quaternion.setFromRotationMatrix(matrix);
  plane.setRotationFromQuaternion(quaternion);

  plane.name = 'face_orientation_plane';

  return plane;
}

/**
 * Update head size for better visibility
 */
export function enlargeHeadSphere(
  headMesh: THREE.Mesh,
  scaleFactor: number = 1.3
): void {
  if (headMesh && headMesh.geometry instanceof THREE.SphereGeometry) {
    headMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
  }
}

/**
 * Create complete head direction visualization
 */
export function createHeadDirectionVisualization(
  nose: THREE.Vector3,
  leftEye: THREE.Vector3,
  rightEye: THREE.Vector3,
  leftEar: THREE.Vector3,
  rightEar: THREE.Vector3,
  options: {
    showArrow?: boolean;
    showEyes?: boolean;
    showPlane?: boolean;
    arrowColor?: number;
    eyeColor?: number;
    arrowLength?: number;
  } = {}
): THREE.Group {
  const {
    showArrow = true,
    showEyes = true,
    showPlane = false,
    arrowColor = 0x00FF00,
    eyeColor = 0x00CCFF,
    arrowLength = 0.15,
  } = options;

  const group = new THREE.Group();
  group.name = 'head_direction_visualization';

  // Calculate face direction and normal
  const faceDirection = calculateFaceDirection(nose, leftEar, rightEar);
  const faceNormal = calculateFaceNormal(nose, leftEye, rightEye);

  // Head center (slightly behind nose)
  const headCenter = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);

  // Add directional arrow
  if (showArrow) {
    const arrow = createHeadDirectionArrow(
      headCenter,
      faceDirection,
      arrowColor,
      arrowLength
    );
    group.add(arrow);
  }

  // Add eye direction indicators
  if (showEyes) {
    const leftEyeIndicator = createEyeDirectionIndicator(
      leftEye,
      faceDirection,
      true,
      eyeColor
    );
    const rightEyeIndicator = createEyeDirectionIndicator(
      rightEye,
      faceDirection,
      false,
      eyeColor
    );
    group.add(leftEyeIndicator);
    group.add(rightEyeIndicator);
  }

  // Add face orientation plane
  if (showPlane) {
    const plane = createFaceOrientationPlane(
      headCenter,
      faceDirection,
      faceNormal
    );
    group.add(plane);
  }

  return group;
}
