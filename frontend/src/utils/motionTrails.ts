/**
 * Motion Trail System
 * Visualizes movement paths of key joints over time
 */

import * as THREE from 'three';

/**
 * Trail configuration for a specific joint
 */
export interface TrailConfig {
  jointIndex: number;
  jointName: string;
  color: number;
  maxLength: number; // Maximum number of positions to store
  lineWidth: number;
  opacity: number;
}

/**
 * Predefined trail configurations for key joints
 */
export const TRAIL_PRESETS: { [key: string]: TrailConfig } = {
  leftHand: {
    jointIndex: 15, // Left wrist
    jointName: 'Left Hand',
    color: 0xFF6B6B,
    maxLength: 30,
    lineWidth: 2,
    opacity: 0.8,
  },
  rightHand: {
    jointIndex: 16, // Right wrist
    jointName: 'Right Hand',
    color: 0xFF8E8E,
    maxLength: 30,
    lineWidth: 2,
    opacity: 0.8,
  },
  leftFoot: {
    jointIndex: 31, // Left foot index
    jointName: 'Left Foot',
    color: 0xFECA57,
    maxLength: 30,
    lineWidth: 2,
    opacity: 0.8,
  },
  rightFoot: {
    jointIndex: 32, // Right foot index
    jointName: 'Right Foot',
    color: 0xFFD77A,
    maxLength: 30,
    lineWidth: 2,
    opacity: 0.8,
  },
  head: {
    jointIndex: 0, // Nose
    jointName: 'Head',
    color: 0x00CCFF,
    maxLength: 30,
    lineWidth: 2,
    opacity: 0.8,
  },
  leftElbow: {
    jointIndex: 13,
    jointName: 'Left Elbow',
    color: 0xFF4466,
    maxLength: 30,
    lineWidth: 1.5,
    opacity: 0.7,
  },
  rightElbow: {
    jointIndex: 14,
    jointName: 'Right Elbow',
    color: 0xFF6688,
    maxLength: 30,
    lineWidth: 1.5,
    opacity: 0.7,
  },
  leftKnee: {
    jointIndex: 25,
    jointName: 'Left Knee',
    color: 0xFDB447,
    maxLength: 30,
    lineWidth: 1.5,
    opacity: 0.7,
  },
  rightKnee: {
    jointIndex: 26,
    jointName: 'Right Knee',
    color: 0xFDC767,
    maxLength: 30,
    lineWidth: 1.5,
    opacity: 0.7,
  },
};

/**
 * Trail history manager
 */
export class TrailHistory {
  private history: Map<number, THREE.Vector3[]>;
  private maxLength: number;

  constructor(maxLength: number = 30) {
    this.history = new Map();
    this.maxLength = maxLength;
  }

  /**
   * Add a position to joint history
   */
  addPosition(jointIndex: number, position: THREE.Vector3): void {
    if (!this.history.has(jointIndex)) {
      this.history.set(jointIndex, []);
    }

    const positions = this.history.get(jointIndex)!;
    positions.push(position.clone());

    // Keep only recent positions
    if (positions.length > this.maxLength) {
      positions.shift();
    }
  }

  /**
   * Get position history for a joint
   */
  getHistory(jointIndex: number): THREE.Vector3[] {
    return this.history.get(jointIndex) || [];
  }

  /**
   * Clear history for a joint
   */
  clearJoint(jointIndex: number): void {
    this.history.delete(jointIndex);
  }

  /**
   * Clear all history
   */
  clearAll(): void {
    this.history.clear();
  }

  /**
   * Get all tracked joint indices
   */
  getTrackedJoints(): number[] {
    return Array.from(this.history.keys());
  }

  /**
   * Set maximum trail length
   */
  setMaxLength(length: number): void {
    this.maxLength = length;

    // Trim existing histories
    this.history.forEach((positions) => {
      if (positions.length > length) {
        positions.splice(0, positions.length - length);
      }
    });
  }
}

/**
 * Create a smooth motion trail from position history
 */
export function createMotionTrail(
  positions: THREE.Vector3[],
  config: TrailConfig
): THREE.Group {
  const group = new THREE.Group();
  group.name = `motion_trail_${config.jointName}`;

  if (positions.length < 2) return group;

  // Create smooth curve through positions using Catmull-Rom spline
  const curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.5);
  const points = curve.getPoints(positions.length * 3); // Interpolate for smoothness

  // Create fading trail with gradient opacity
  for (let i = 0; i < points.length - 1; i++) {
    const t = i / (points.length - 1); // 0 to 1 (oldest to newest)
    const opacity = config.opacity * t; // Fade from transparent to opaque

    const segmentPoints = [points[i], points[i + 1]];
    const segmentGeometry = new THREE.BufferGeometry().setFromPoints(segmentPoints);
    const segmentMaterial = new THREE.LineBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: opacity,
      linewidth: config.lineWidth,
    });

    const segment = new THREE.Line(segmentGeometry, segmentMaterial);
    group.add(segment);
  }

  // Add tubes for better visibility
  if (points.length > 3) {
    const tubeRadius = 0.005;
    const tubeGeometry = new THREE.TubeGeometry(curve, points.length * 2, tubeRadius, 8, false);

    // Create gradient material
    const tubeMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity * 0.6,
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    group.add(tube);
  }

  // Add position markers at intervals
  const markerInterval = Math.max(1, Math.floor(positions.length / 5));
  for (let i = 0; i < positions.length; i += markerInterval) {
    const t = i / (positions.length - 1);
    const markerOpacity = config.opacity * t * 0.8;

    const markerGeometry = new THREE.SphereGeometry(0.012, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: markerOpacity,
    });

    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(positions[i]);
    group.add(marker);
  }

  return group;
}

/**
 * Create trail with arrow indicating direction
 */
export function createDirectionalTrail(
  positions: THREE.Vector3[],
  config: TrailConfig
): THREE.Group {
  const group = createMotionTrail(positions, config);

  if (positions.length >= 2) {
    // Add arrow at the newest position showing direction
    const newest = positions[positions.length - 1];
    const previous = positions[positions.length - 2];

    const direction = new THREE.Vector3().subVectors(newest, previous).normalize();
    const arrowLength = 0.05;

    const arrowGeometry = new THREE.ConeGeometry(0.015, arrowLength, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity,
    });

    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.copy(newest);

    // Orient arrow in movement direction
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, direction);
    arrow.setRotationFromQuaternion(quaternion);

    group.add(arrow);
  }

  return group;
}

/**
 * Calculate trail statistics
 */
export interface TrailStats {
  totalDistance: number;
  averageSpeed: number;
  maxSpeed: number;
  boundingBox: THREE.Box3;
}

export function calculateTrailStats(positions: THREE.Vector3[]): TrailStats | null {
  if (positions.length < 2) return null;

  let totalDistance = 0;
  let maxSpeed = 0;
  const distances: number[] = [];

  for (let i = 1; i < positions.length; i++) {
    const distance = positions[i].distanceTo(positions[i - 1]);
    totalDistance += distance;
    distances.push(distance);
    maxSpeed = Math.max(maxSpeed, distance);
  }

  const averageSpeed = totalDistance / distances.length;

  const boundingBox = new THREE.Box3();
  positions.forEach((pos) => boundingBox.expandByPoint(pos));

  return {
    totalDistance,
    averageSpeed,
    maxSpeed,
    boundingBox,
  };
}

/**
 * Create trail legend sprite
 */
export function createTrailLegend(config: TrailConfig, position: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = 200;
  canvas.height = 50;

  // Clear
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 5);
  context.fill();

  // Trail line sample
  context.strokeStyle = `#${config.color.toString(16).padStart(6, '0')}`;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(15, canvas.height / 2);
  context.lineTo(50, canvas.height / 2);
  context.stroke();

  // Text
  context.fillStyle = `#${config.color.toString(16).padStart(6, '0')}`;
  context.font = 'bold 16px Arial';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(config.jointName, 60, canvas.height / 2);

  // Create sprite
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.2, 0.05, 1);
  sprite.position.copy(position);

  return sprite;
}

/**
 * Interpolate trail color based on speed
 */
export function getSpeedBasedColor(
  speed: number,
  minSpeed: number,
  maxSpeed: number
): THREE.Color {
  const t = Math.min(1, Math.max(0, (speed - minSpeed) / (maxSpeed - minSpeed)));

  // Color gradient: blue (slow) → green → yellow → red (fast)
  if (t < 0.33) {
    // Blue to green
    const localT = t / 0.33;
    return new THREE.Color().lerpColors(
      new THREE.Color(0x0000FF),
      new THREE.Color(0x00FF00),
      localT
    );
  } else if (t < 0.67) {
    // Green to yellow
    const localT = (t - 0.33) / 0.34;
    return new THREE.Color().lerpColors(
      new THREE.Color(0x00FF00),
      new THREE.Color(0xFFFF00),
      localT
    );
  } else {
    // Yellow to red
    const localT = (t - 0.67) / 0.33;
    return new THREE.Color().lerpColors(
      new THREE.Color(0xFFFF00),
      new THREE.Color(0xFF0000),
      localT
    );
  }
}

/**
 * Create speed-colored trail
 */
export function createSpeedColoredTrail(
  positions: THREE.Vector3[],
  config: TrailConfig
): THREE.Group {
  const group = new THREE.Group();
  group.name = `speed_trail_${config.jointName}`;

  if (positions.length < 2) return group;

  // Calculate speeds
  const speeds: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    const speed = positions[i].distanceTo(positions[i - 1]);
    speeds.push(speed);
  }

  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);

  // Create colored segments
  for (let i = 0; i < positions.length - 1; i++) {
    const speed = speeds[i];
    const color = getSpeedBasedColor(speed, minSpeed, maxSpeed);
    const t = i / (positions.length - 1);
    const opacity = config.opacity * t;

    const segmentPoints = [positions[i], positions[i + 1]];
    const segmentGeometry = new THREE.BufferGeometry().setFromPoints(segmentPoints);
    const segmentMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      linewidth: config.lineWidth,
    });

    const segment = new THREE.Line(segmentGeometry, segmentMaterial);
    group.add(segment);
  }

  return group;
}
