/**
 * Joint Tooltip and Interaction System
 * Handles raycasting, hover detection, and tooltip display
 */

import * as THREE from 'three';

/**
 * Joint names for MediaPipe Pose landmarks
 */
export const JOINT_NAMES: { [key: number]: string } = {
  0: 'Nose',
  1: 'Left Eye (Inner)',
  2: 'Left Eye',
  3: 'Left Eye (Outer)',
  4: 'Right Eye (Inner)',
  5: 'Right Eye',
  6: 'Right Eye (Outer)',
  7: 'Left Ear',
  8: 'Right Ear',
  9: 'Mouth (Left)',
  10: 'Mouth (Right)',
  11: 'Left Shoulder',
  12: 'Right Shoulder',
  13: 'Left Elbow',
  14: 'Right Elbow',
  15: 'Left Wrist',
  16: 'Right Wrist',
  17: 'Left Pinky',
  18: 'Right Pinky',
  19: 'Left Index',
  20: 'Right Index',
  21: 'Left Thumb',
  22: 'Right Thumb',
  23: 'Left Hip',
  24: 'Right Hip',
  25: 'Left Knee',
  26: 'Right Knee',
  27: 'Left Ankle',
  28: 'Right Ankle',
  29: 'Left Heel',
  30: 'Right Heel',
  31: 'Left Foot Index',
  32: 'Right Foot Index',
};

/**
 * Joint tooltip data structure
 */
export interface JointTooltipData {
  jointIndex: number;
  jointName: string;
  position: THREE.Vector3;
  confidence: number;
  angle?: number;
  connectedJoints: number[];
}

/**
 * Get connected joints for a specific joint
 */
export function getConnectedJoints(jointIndex: number): number[] {
  const connections: { [key: number]: number[] } = {
    // Face
    0: [1, 4],
    1: [2],
    2: [3],
    4: [5],
    5: [6],
    // Ears
    3: [7],
    6: [8],
    // Mouth
    9: [10],
    // Torso
    11: [12, 13, 23],
    12: [11, 14, 24],
    // Arms
    13: [11, 15],
    14: [12, 16],
    15: [13, 17, 19, 21],
    16: [14, 18, 20, 22],
    // Hands
    17: [15],
    18: [16],
    19: [15],
    20: [16],
    21: [15],
    22: [16],
    // Legs
    23: [11, 24, 25],
    24: [12, 23, 26],
    25: [23, 27],
    26: [24, 28],
    // Feet
    27: [25, 29, 31],
    28: [26, 30, 32],
    29: [27],
    30: [28],
    31: [27],
    32: [28],
  };

  return connections[jointIndex] || [];
}

/**
 * Perform raycasting to detect joint hover
 */
export function raycastJoints(
  mouseX: number,
  mouseY: number,
  camera: THREE.Camera,
  jointMeshes: THREE.Mesh[]
): THREE.Intersection | null {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 0.05; // Increase detection threshold

  // Convert mouse position to normalized device coordinates (-1 to +1)
  const mouse = new THREE.Vector2(mouseX, mouseY);

  raycaster.setFromCamera(mouse, camera);

  // Perform intersection test
  const intersects = raycaster.intersectObjects(jointMeshes, false);

  if (intersects.length > 0) {
    return intersects[0];
  }

  return null;
}

/**
 * Create highlight effect for hovered joint
 */
export function createJointHighlight(
  position: THREE.Vector3,
  radius: number = 0.04
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 24, 24);
  const material = new THREE.MeshBasicMaterial({
    color: 0xFFFF00,
    transparent: true,
    opacity: 0.3,
    wireframe: true,
  });

  const highlight = new THREE.Mesh(geometry, material);
  highlight.position.copy(position);
  highlight.name = 'joint_highlight';

  return highlight;
}

/**
 * Create pulsing ring effect around hovered joint
 */
export function createPulsingRing(
  position: THREE.Vector3,
  innerRadius: number = 0.025,
  outerRadius: number = 0.035
): THREE.Mesh {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00FFFF,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.position.copy(position);
  ring.lookAt(new THREE.Vector3(0, 0, 1)); // Face camera
  ring.name = 'pulsing_ring';

  return ring;
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

/**
 * Format position as coordinates
 */
export function formatPosition(position: THREE.Vector3): string {
  return `(${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`;
}

/**
 * Get joint category for color coding
 */
export function getJointCategory(jointIndex: number): string {
  if (jointIndex <= 10) return 'face';
  if (jointIndex >= 11 && jointIndex <= 22) return 'upper_body';
  if (jointIndex >= 23 && jointIndex <= 28) return 'lower_body';
  return 'extremities';
}

/**
 * Get category color
 */
export function getCategoryColor(category: string): string {
  switch (category) {
    case 'face':
      return '#00CCFF';
    case 'upper_body':
      return '#FF6B6B';
    case 'lower_body':
      return '#FECA57';
    case 'extremities':
      return '#4ECDC4';
    default:
      return '#FFFFFF';
  }
}

/**
 * Create connection lines to connected joints
 */
export function createConnectionLines(
  fromPosition: THREE.Vector3,
  toPositions: THREE.Vector3[],
  color: number = 0x00FFFF
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'connection_lines';

  toPositions.forEach((toPos) => {
    const points = [fromPosition, toPos];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      linewidth: 2,
    });

    const line = new THREE.Line(geometry, material);
    group.add(line);
  });

  return group;
}

/**
 * Animate hover effect (scale pulsing)
 */
export function animateHoverEffect(mesh: THREE.Mesh, time: number): void {
  const scale = 1 + Math.sin(time * 5) * 0.1;
  mesh.scale.set(scale, scale, scale);
}

/**
 * Get joint description
 */
export function getJointDescription(jointIndex: number): string {
  const descriptions: { [key: number]: string } = {
    11: 'Upper arm attachment, shoulder joint',
    12: 'Upper arm attachment, shoulder joint',
    13: 'Elbow joint, flexion/extension',
    14: 'Elbow joint, flexion/extension',
    15: 'Wrist joint, hand articulation',
    16: 'Wrist joint, hand articulation',
    23: 'Hip joint, leg attachment',
    24: 'Hip joint, leg attachment',
    25: 'Knee joint, leg flexion/extension',
    26: 'Knee joint, leg flexion/extension',
    27: 'Ankle joint, foot articulation',
    28: 'Ankle joint, foot articulation',
  };

  return descriptions[jointIndex] || 'Pose landmark point';
}

/**
 * Convert screen coordinates to normalized device coordinates
 */
export function screenToNDC(
  screenX: number,
  screenY: number,
  containerWidth: number,
  containerHeight: number
): THREE.Vector2 {
  const x = (screenX / containerWidth) * 2 - 1;
  const y = -(screenY / containerHeight) * 2 + 1;
  return new THREE.Vector2(x, y);
}
