/**
 * Joint Constraint System
 * Visualizes anatomical joint limits and range of motion constraints
 */

import * as THREE from 'three';

/**
 * Constraint types based on anatomical joint behavior
 */
export type ConstraintType = 'hinge' | 'ball-socket' | 'saddle' | 'pivot';

/**
 * Constraint status based on current angle
 */
export type ConstraintStatus = 'safe' | 'warning' | 'limit' | 'exceeded';

/**
 * Joint constraint definition
 */
export interface JointConstraint {
  jointIndex: number;
  jointName: string;
  type: ConstraintType;
  axis: THREE.Vector3; // Primary rotation axis for hinge joints
  minAngle: number; // Minimum angle in degrees
  maxAngle: number; // Maximum angle in degrees
  warningThreshold: number; // Degrees from limit to show warning (default 15)
  color: number;
}

/**
 * Predefined anatomical constraints for major joints
 */
export const JOINT_CONSTRAINTS: JointConstraint[] = [
  // Elbow joints (hinge - flexion only)
  {
    jointIndex: 13,
    jointName: 'Left Elbow',
    type: 'hinge',
    axis: new THREE.Vector3(1, 0, 0), // X-axis rotation
    minAngle: 0,
    maxAngle: 150,
    warningThreshold: 15,
    color: 0xFF6B6B,
  },
  {
    jointIndex: 14,
    jointName: 'Right Elbow',
    type: 'hinge',
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: 0,
    maxAngle: 150,
    warningThreshold: 15,
    color: 0xFF8E8E,
  },
  // Knee joints (hinge - flexion only)
  {
    jointIndex: 25,
    jointName: 'Left Knee',
    type: 'hinge',
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: 0,
    maxAngle: 140,
    warningThreshold: 15,
    color: 0xFECA57,
  },
  {
    jointIndex: 26,
    jointName: 'Right Knee',
    type: 'hinge',
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: 0,
    maxAngle: 140,
    warningThreshold: 15,
    color: 0xFFD77A,
  },
  // Shoulder joints (ball-and-socket - multi-axis)
  {
    jointIndex: 11,
    jointName: 'Left Shoulder',
    type: 'ball-socket',
    axis: new THREE.Vector3(0, 1, 0), // Primary axis
    minAngle: 0,
    maxAngle: 180,
    warningThreshold: 20,
    color: 0xFF4466,
  },
  {
    jointIndex: 12,
    jointName: 'Right Shoulder',
    type: 'ball-socket',
    axis: new THREE.Vector3(0, 1, 0),
    minAngle: 0,
    maxAngle: 180,
    warningThreshold: 20,
    color: 0xFF6688,
  },
  // Hip joints (ball-and-socket)
  {
    jointIndex: 23,
    jointName: 'Left Hip',
    type: 'ball-socket',
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: 0,
    maxAngle: 120,
    warningThreshold: 20,
    color: 0xFDB447,
  },
  {
    jointIndex: 24,
    jointName: 'Right Hip',
    type: 'ball-socket',
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: 0,
    maxAngle: 120,
    warningThreshold: 20,
    color: 0xFDC767,
  },
  // Wrist joints (saddle - complex motion)
  {
    jointIndex: 15,
    jointName: 'Left Wrist',
    type: 'saddle',
    axis: new THREE.Vector3(0, 1, 0),
    minAngle: -70,
    maxAngle: 80,
    warningThreshold: 10,
    color: 0x4ECDC4,
  },
  {
    jointIndex: 16,
    jointName: 'Right Wrist',
    type: 'saddle',
    axis: new THREE.Vector3(0, 1, 0),
    minAngle: -70,
    maxAngle: 80,
    warningThreshold: 10,
    color: 0x6ED9D0,
  },
  // Ankle joints (hinge)
  {
    jointIndex: 27,
    jointName: 'Left Ankle',
    type: 'hinge',
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: -45,
    maxAngle: 30,
    warningThreshold: 10,
    color: 0x00CCFF,
  },
  {
    jointIndex: 28,
    jointName: 'Right Ankle',
    type: 'hinge',
    axis: new THREE.Vector3(1, 0, 0),
    minAngle: -45,
    maxAngle: 30,
    warningThreshold: 10,
    color: 0x33DDFF,
  },
];

/**
 * Determine constraint status based on current angle
 */
export function getConstraintStatus(
  currentAngle: number,
  constraint: JointConstraint
): ConstraintStatus {
  if (currentAngle < constraint.minAngle || currentAngle > constraint.maxAngle) {
    return 'exceeded';
  }

  const minWarning = constraint.minAngle + constraint.warningThreshold;
  const maxWarning = constraint.maxAngle - constraint.warningThreshold;

  if (currentAngle < minWarning || currentAngle > maxWarning) {
    const minDist = Math.abs(currentAngle - constraint.minAngle);
    const maxDist = Math.abs(currentAngle - constraint.maxAngle);
    return minDist < 5 || maxDist < 5 ? 'limit' : 'warning';
  }

  return 'safe';
}

/**
 * Get color for constraint status
 */
export function getConstraintStatusColor(status: ConstraintStatus): number {
  switch (status) {
    case 'safe':
      return 0x00FF00; // Green
    case 'warning':
      return 0xFFAA00; // Orange
    case 'limit':
      return 0xFF6600; // Dark orange
    case 'exceeded':
      return 0xFF0000; // Red
    default:
      return 0xCCCCCC;
  }
}

/**
 * Create range of motion visualization for hinge joints
 */
export function createHingeConstraintVisualization(
  constraint: JointConstraint,
  jointPosition: THREE.Vector3,
  currentAngle: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = `constraint_hinge_${constraint.jointName}`;

  const status = getConstraintStatus(currentAngle, constraint);
  const statusColor = getConstraintStatusColor(status);

  // Create arc showing valid range
  const arcRadius = 0.12;
  const segments = 32;
  const startAngleRad = THREE.MathUtils.degToRad(constraint.minAngle);
  const endAngleRad = THREE.MathUtils.degToRad(constraint.maxAngle);

  const arcPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngleRad + (endAngleRad - startAngleRad) * t;
    const x = Math.cos(angle) * arcRadius;
    const y = Math.sin(angle) * arcRadius;
    arcPoints.push(new THREE.Vector3(x, y, 0));
  }

  const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const arcMaterial = new THREE.LineBasicMaterial({
    color: constraint.color,
    linewidth: 2,
    transparent: true,
    opacity: 0.6,
  });
  const arc = new THREE.Line(arcGeometry, arcMaterial);
  group.add(arc);

  // Create constraint limit lines
  const minLimitPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      Math.cos(startAngleRad) * arcRadius * 1.2,
      Math.sin(startAngleRad) * arcRadius * 1.2,
      0
    ),
  ];
  const minLimitGeometry = new THREE.BufferGeometry().setFromPoints(minLimitPoints);
  const minLimitMaterial = new THREE.LineBasicMaterial({
    color: 0xFF0000,
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  const minLimit = new THREE.Line(minLimitGeometry, minLimitMaterial);
  group.add(minLimit);

  const maxLimitPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      Math.cos(endAngleRad) * arcRadius * 1.2,
      Math.sin(endAngleRad) * arcRadius * 1.2,
      0
    ),
  ];
  const maxLimitGeometry = new THREE.BufferGeometry().setFromPoints(maxLimitPoints);
  const maxLimitMaterial = new THREE.LineBasicMaterial({
    color: 0xFF0000,
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  const maxLimit = new THREE.Line(maxLimitGeometry, maxLimitMaterial);
  group.add(maxLimit);

  // Create current angle indicator
  const currentAngleRad = THREE.MathUtils.degToRad(currentAngle);
  const indicatorPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      Math.cos(currentAngleRad) * arcRadius,
      Math.sin(currentAngleRad) * arcRadius,
      0
    ),
  ];
  const indicatorGeometry = new THREE.BufferGeometry().setFromPoints(indicatorPoints);
  const indicatorMaterial = new THREE.LineBasicMaterial({
    color: statusColor,
    linewidth: 3,
  });
  const indicator = new THREE.Line(indicatorGeometry, indicatorMaterial);
  group.add(indicator);

  // Add status sphere at indicator tip
  const sphereGeometry = new THREE.SphereGeometry(0.015, 16, 16);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: statusColor,
    transparent: true,
    opacity: 0.8,
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.set(
    Math.cos(currentAngleRad) * arcRadius,
    Math.sin(currentAngleRad) * arcRadius,
    0
  );
  group.add(sphere);

  // Position at joint
  group.position.copy(jointPosition);

  return group;
}

/**
 * Create range of motion visualization for ball-and-socket joints
 */
export function createBallSocketConstraintVisualization(
  constraint: JointConstraint,
  jointPosition: THREE.Vector3,
  currentAngle: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = `constraint_ball_${constraint.jointName}`;

  const status = getConstraintStatus(currentAngle, constraint);
  const statusColor = getConstraintStatusColor(status);

  // Create cone showing range of motion
  const coneHeight = 0.15;
  const coneAngle = THREE.MathUtils.degToRad(constraint.maxAngle / 2);
  const coneRadius = Math.tan(coneAngle) * coneHeight;

  const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true);
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: constraint.color,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    wireframe: false,
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.rotation.x = Math.PI / 2; // Point forward
  cone.position.z = coneHeight / 2;
  group.add(cone);

  // Create wireframe outline
  const wireframeGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true);
  const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: constraint.color,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  });
  const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
  wireframe.rotation.x = Math.PI / 2;
  wireframe.position.z = coneHeight / 2;
  group.add(wireframe);

  // Create circular rings at intervals
  const numRings = 3;
  for (let i = 1; i <= numRings; i++) {
    const t = i / (numRings + 1);
    const ringZ = coneHeight * t;
    const ringRadius = (coneRadius * t);

    const ringGeometry = new THREE.RingGeometry(ringRadius * 0.95, ringRadius, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: constraint.color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.y = Math.PI / 2;
    ring.position.z = ringZ;
    group.add(ring);
  }

  // Add status indicator at center
  const indicatorGeometry = new THREE.SphereGeometry(0.02, 16, 16);
  const indicatorMaterial = new THREE.MeshBasicMaterial({
    color: statusColor,
    transparent: true,
    opacity: 0.8,
  });
  const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  group.add(indicator);

  // Add outer glow ring
  const glowGeometry = new THREE.RingGeometry(0.025, 0.035, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: statusColor,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  group.add(glow);

  // Position at joint
  group.position.copy(jointPosition);

  return group;
}

/**
 * Create range of motion visualization for saddle joints
 */
export function createSaddleConstraintVisualization(
  constraint: JointConstraint,
  jointPosition: THREE.Vector3,
  currentAngle: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = `constraint_saddle_${constraint.jointName}`;

  const status = getConstraintStatus(currentAngle, constraint);
  const statusColor = getConstraintStatusColor(status);

  // Create box showing multi-axis range
  const boxWidth = 0.08;
  const boxHeight = 0.12;
  const boxDepth = 0.08;

  const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const boxMaterial = new THREE.MeshBasicMaterial({
    color: constraint.color,
    transparent: true,
    opacity: 0.1,
    wireframe: false,
  });
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  group.add(box);

  // Add wireframe edges
  const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
  const edgesMaterial = new THREE.LineBasicMaterial({
    color: constraint.color,
    transparent: true,
    opacity: 0.5,
  });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  group.add(edges);

  // Add status indicator at center
  const indicatorGeometry = new THREE.SphereGeometry(0.018, 16, 16);
  const indicatorMaterial = new THREE.MeshBasicMaterial({
    color: statusColor,
    transparent: true,
    opacity: 0.8,
  });
  const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  group.add(indicator);

  // Position at joint
  group.position.copy(jointPosition);

  return group;
}

/**
 * Create constraint visualization based on joint type
 */
export function createConstraintVisualization(
  constraint: JointConstraint,
  jointPosition: THREE.Vector3,
  currentAngle: number
): THREE.Group {
  switch (constraint.type) {
    case 'hinge':
      return createHingeConstraintVisualization(constraint, jointPosition, currentAngle);
    case 'ball-socket':
      return createBallSocketConstraintVisualization(constraint, jointPosition, currentAngle);
    case 'saddle':
      return createSaddleConstraintVisualization(constraint, jointPosition, currentAngle);
    default:
      return new THREE.Group();
  }
}

/**
 * Get constraint for a specific joint
 */
export function getConstraintForJoint(jointIndex: number): JointConstraint | null {
  return JOINT_CONSTRAINTS.find((c) => c.jointIndex === jointIndex) || null;
}

/**
 * Create constraint info label
 */
export function createConstraintLabel(
  constraint: JointConstraint,
  currentAngle: number,
  position: THREE.Vector3
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = 256;
  canvas.height = 96;

  const status = getConstraintStatus(currentAngle, constraint);
  const statusColor = getConstraintStatusColor(status);

  // Clear
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 8);
  context.fill();

  // Status indicator
  context.fillStyle = `#${statusColor.toString(16).padStart(6, '0')}`;
  context.fillRect(15, 15, 10, canvas.height - 30);

  // Joint name
  context.fillStyle = '#FFFFFF';
  context.font = 'bold 18px Arial';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillText(constraint.jointName, 35, 15);

  // Range info
  context.fillStyle = '#AAAAAA';
  context.font = '14px Arial';
  context.fillText(
    `Range: ${constraint.minAngle}° - ${constraint.maxAngle}°`,
    35,
    40
  );

  // Current angle with status color
  context.fillStyle = `#${statusColor.toString(16).padStart(6, '0')}`;
  context.font = 'bold 16px Arial';
  context.fillText(`Current: ${currentAngle.toFixed(1)}° [${status.toUpperCase()}]`, 35, 62);

  // Create sprite
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.3, 0.11, 1);
  sprite.position.copy(position);

  return sprite;
}

/**
 * Animate constraint visualizations with pulsing effect
 */
export function animateConstraintVisualization(group: THREE.Group, time: number): void {
  const pulse = 0.7 + Math.sin(time * 2) * 0.3; // Pulse between 0.4 and 1.0

  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const material = child.material as THREE.Material;
      if ('opacity' in material) {
        const baseOpacity = (material as any).userData?.baseOpacity || (material as any).opacity;
        if (!((material as any).userData?.baseOpacity)) {
          (material as any).userData = { baseOpacity: (material as any).opacity };
        }
        (material as any).opacity = baseOpacity * pulse;
      }
    }
  });
}

/**
 * Check if any constraints are violated
 */
export function checkConstraintViolations(
  jointAngles: Map<number, number>
): { constraint: JointConstraint; angle: number; status: ConstraintStatus }[] {
  const violations: { constraint: JointConstraint; angle: number; status: ConstraintStatus }[] = [];

  JOINT_CONSTRAINTS.forEach((constraint) => {
    const angle = jointAngles.get(constraint.jointIndex);
    if (angle !== undefined) {
      const status = getConstraintStatus(angle, constraint);
      if (status === 'limit' || status === 'exceeded') {
        violations.push({ constraint, angle, status });
      }
    }
  });

  return violations;
}

/**
 * Get constraint type description
 */
export function getConstraintTypeDescription(type: ConstraintType): string {
  switch (type) {
    case 'hinge':
      return 'Hinge joint - single axis rotation (flexion/extension)';
    case 'ball-socket':
      return 'Ball-and-socket joint - multi-axis rotation (360° range)';
    case 'saddle':
      return 'Saddle joint - two-axis movement (flexion/extension + abduction/adduction)';
    case 'pivot':
      return 'Pivot joint - rotational movement around single axis';
    default:
      return 'Unknown joint type';
  }
}
