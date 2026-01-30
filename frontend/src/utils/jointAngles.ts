/**
 * Joint Angle Calculation and Visualization
 * Calculates angles at major joints and creates visual arc indicators
 */

import * as THREE from 'three';

/**
 * Calculate angle between three points (in degrees)
 * middlePoint is the vertex of the angle
 */
export function calculateJointAngle(
  point1: THREE.Vector3,
  middlePoint: THREE.Vector3,
  point3: THREE.Vector3
): number {
  // Create vectors from middle point to the other two points
  const vector1 = new THREE.Vector3().subVectors(point1, middlePoint).normalize();
  const vector2 = new THREE.Vector3().subVectors(point3, middlePoint).normalize();

  // Calculate dot product
  const dotProduct = vector1.dot(vector2);

  // Clamp to avoid floating point errors with acos
  const clampedDot = Math.max(-1, Math.min(1, dotProduct));

  // Calculate angle in radians, then convert to degrees
  const angleRadians = Math.acos(clampedDot);
  const angleDegrees = THREE.MathUtils.radToDeg(angleRadians);

  return angleDegrees;
}

/**
 * Joint angle data structure
 */
export interface JointAngleData {
  angle: number;
  jointName: string;
  jointPosition: THREE.Vector3;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  normalVector: THREE.Vector3;
}

/**
 * Calculate all major joint angles from landmarks
 */
export interface JointAngles {
  leftElbow?: JointAngleData;
  rightElbow?: JointAngleData;
  leftKnee?: JointAngleData;
  rightKnee?: JointAngleData;
  leftShoulder?: JointAngleData;
  rightShoulder?: JointAngleData;
  leftHip?: JointAngleData;
  rightHip?: JointAngleData;
}

/**
 * Create angle arc visualization
 */
export function createAngleArc(
  angleData: JointAngleData,
  arcRadius: number = 0.08,
  color: number = 0xFFAA00,
  showLabel: boolean = true
): THREE.Group {
  const group = new THREE.Group();
  group.name = `angle_arc_${angleData.jointName}`;

  const { angle, jointPosition, startPoint, endPoint, normalVector } = angleData;

  // Create vectors for arc drawing
  const startVector = new THREE.Vector3().subVectors(startPoint, jointPosition).normalize();
  const endVector = new THREE.Vector3().subVectors(endPoint, jointPosition).normalize();

  // Create arc curve
  const angleRadians = THREE.MathUtils.degToRad(angle);
  const segments = Math.max(16, Math.floor(angle / 5)); // More segments for larger angles

  const arcPoints: THREE.Vector3[] = [];

  // Calculate arc points using quaternion rotation
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const currentAngle = angleRadians * t;

    // Rotate start vector around normal by currentAngle
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(normalVector, currentAngle);

    const point = startVector.clone()
      .applyQuaternion(quaternion)
      .multiplyScalar(arcRadius)
      .add(jointPosition);

    arcPoints.push(point);
  }

  // Create arc line
  const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const arcMaterial = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
    transparent: true,
    opacity: 0.9,
  });
  const arcLine = new THREE.Line(arcGeometry, arcMaterial);
  group.add(arcLine);

  // Create glowing arc tube for better visibility
  const tubeRadius = 0.004;
  const arcCurve = new THREE.CatmullRomCurve3(arcPoints);
  const tubeGeometry = new THREE.TubeGeometry(arcCurve, segments, tubeRadius, 8, false);
  const tubeMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.5,
    metalness: 0.6,
    roughness: 0.3,
  });
  const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
  group.add(tubeMesh);

  // Add end point markers
  const markerGeometry = new THREE.SphereGeometry(0.008, 12, 12);
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.6,
  });

  const startMarker = new THREE.Mesh(markerGeometry, markerMaterial);
  startMarker.position.copy(arcPoints[0]);
  group.add(startMarker);

  const endMarker = new THREE.Mesh(markerGeometry, markerMaterial);
  endMarker.position.copy(arcPoints[arcPoints.length - 1]);
  group.add(endMarker);

  // Add angle label if requested
  if (showLabel) {
    const labelPosition = startVector.clone()
      .add(endVector)
      .normalize()
      .multiplyScalar(arcRadius * 1.5)
      .add(jointPosition);

    const labelSprite = createAngleLabel(Math.round(angle), color);
    labelSprite.position.copy(labelPosition);
    group.add(labelSprite);
  }

  return group;
}

/**
 * Create text label sprite for angle
 */
export function createAngleLabel(angle: number, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = 128;
  canvas.height = 64;

  // Clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 8);
  context.fill();

  // Draw text
  context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.font = 'bold 32px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${angle}°`, canvas.width / 2, canvas.height / 2);

  // Create sprite
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.1, 0.05, 1);

  return sprite;
}

/**
 * Get angle color based on joint type and angle value
 * Different colors for different joint health ranges
 */
export function getAngleColor(jointName: string, angle: number): number {
  // Elbow angles
  if (jointName.includes('elbow')) {
    if (angle < 30) return 0xFF4444; // Too bent - red
    if (angle > 170) return 0x00FF88; // Extended - green
    return 0xFFAA00; // Normal range - orange
  }

  // Knee angles
  if (jointName.includes('knee')) {
    if (angle < 30) return 0xFF4444; // Too bent - red
    if (angle > 170) return 0x00FF88; // Extended - green
    return 0xFFAA00; // Normal range - orange
  }

  // Shoulder angles (wider range)
  if (jointName.includes('shoulder')) {
    if (angle < 20) return 0xFF4444; // Too close - red
    if (angle > 160) return 0xFF4444; // Over-extended - red
    return 0x00CCFF; // Normal range - cyan
  }

  // Hip angles
  if (jointName.includes('hip')) {
    if (angle < 20) return 0xFF4444; // Too bent - red
    if (angle > 170) return 0x00FF88; // Extended - green
    return 0xFFAA00; // Normal range - orange
  }

  return 0xFFAA00; // Default orange
}

/**
 * Calculate normal vector for arc plane
 * Uses cross product of the two limb vectors
 */
export function calculateArcNormal(
  point1: THREE.Vector3,
  middlePoint: THREE.Vector3,
  point3: THREE.Vector3
): THREE.Vector3 {
  const vector1 = new THREE.Vector3().subVectors(point1, middlePoint);
  const vector2 = new THREE.Vector3().subVectors(point3, middlePoint);

  // Cross product gives perpendicular vector
  const normal = new THREE.Vector3().crossVectors(vector1, vector2).normalize();

  return normal;
}

/**
 * Create range of motion indicator (cone showing possible movement)
 */
export function createRangeOfMotionIndicator(
  jointPosition: THREE.Vector3,
  direction: THREE.Vector3,
  minAngle: number,
  maxAngle: number,
  color: number = 0x4488FF
): THREE.Mesh {
  const coneAngle = THREE.MathUtils.degToRad(maxAngle - minAngle);
  const coneHeight = 0.15;
  const coneRadius = Math.tan(coneAngle / 2) * coneHeight;

  const geometry = new THREE.ConeGeometry(coneRadius, coneHeight, 24, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    wireframe: true,
  });

  const cone = new THREE.Mesh(geometry, material);
  cone.position.copy(jointPosition);

  // Orient cone in direction
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(up, direction);
  cone.setRotationFromQuaternion(quaternion);

  cone.name = 'range_of_motion_cone';

  return cone;
}

/**
 * Determine if angle is within healthy range
 */
export function isAngleHealthy(jointName: string, angle: number): boolean {
  if (jointName.includes('elbow') || jointName.includes('knee')) {
    return angle >= 30 && angle <= 170;
  }
  if (jointName.includes('shoulder')) {
    return angle >= 20 && angle <= 160;
  }
  if (jointName.includes('hip')) {
    return angle >= 20 && angle <= 170;
  }
  return true;
}

/**
 * Get angle description for UI
 */
export function getAngleDescription(angle: number): string {
  if (angle < 30) return 'Highly Flexed';
  if (angle < 90) return 'Flexed';
  if (angle < 120) return 'Partially Extended';
  if (angle < 160) return 'Extended';
  return 'Fully Extended';
}
