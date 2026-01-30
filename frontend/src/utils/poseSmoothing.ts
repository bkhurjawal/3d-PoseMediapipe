/**
 * Pose Smoothing Utilities
 * Implements Catmull-Rom spline interpolation and temporal smoothing
 * for smooth pose transitions
 */

import * as THREE from 'three';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Catmull-Rom spline interpolation for a single value
 * @param p0 Previous frame value
 * @param p1 Current frame value
 * @param p2 Next frame value
 * @param p3 Frame after next value
 * @param t Interpolation factor (0-1)
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;

  return (
    (2 * p1 - 2 * p2 + v0 + v1) * t3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
    v0 * t +
    p1
  );
}

/**
 * Interpolate a single landmark using Catmull-Rom spline
 */
function interpolateLandmark(
  lm0: Landmark,
  lm1: Landmark,
  lm2: Landmark,
  lm3: Landmark,
  t: number
): Landmark {
  return {
    x: catmullRom(lm0.x, lm1.x, lm2.x, lm3.x, t),
    y: catmullRom(lm0.y, lm1.y, lm2.y, lm3.y, t),
    z: catmullRom(lm0.z, lm1.z, lm2.z, lm3.z, t),
    visibility: lm1.visibility,
  };
}

/**
 * Interpolate between two landmark sets for a given frame
 */
export function interpolateFrame(
  landmarks: Landmark[][],
  frameIndex: number,
  subframe: number = 0
): Landmark[] {
  const totalFrames = landmarks.length;

  // Clamp frame index
  const frame = Math.max(0, Math.min(frameIndex, totalFrames - 1));

  // If no interpolation needed
  if (subframe === 0 || totalFrames < 4) {
    return landmarks[frame];
  }

  // Get surrounding frames for Catmull-Rom interpolation
  const idx1 = Math.max(0, frame - 1);
  const idx2 = frame;
  const idx3 = Math.min(totalFrames - 1, frame + 1);
  const idx4 = Math.min(totalFrames - 1, frame + 2);

  const frame0 = landmarks[idx1];
  const frame1 = landmarks[idx2];
  const frame2 = landmarks[idx3];
  const frame3 = landmarks[idx4];

  // Interpolate each landmark
  const interpolated: Landmark[] = [];
  for (let i = 0; i < frame1.length; i++) {
    interpolated.push(
      interpolateLandmark(frame0[i], frame1[i], frame2[i], frame3[i], subframe)
    );
  }

  return interpolated;
}

/**
 * Temporal smoothing using a rolling average buffer
 */
export class TemporalSmoother {
  private buffer: Landmark[][];
  private bufferSize: number;

  constructor(bufferSize: number = 5) {
    this.buffer = [];
    this.bufferSize = bufferSize;
  }

  /**
   * Add a frame to the buffer and get smoothed result
   */
  smooth(landmarks: Landmark[]): Landmark[] {
    // Add to buffer
    this.buffer.push(landmarks);

    // Keep buffer at max size
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // If buffer not full yet, return current frame
    if (this.buffer.length < 3) {
      return landmarks;
    }

    // Compute weighted average (more weight to recent frames)
    const smoothed: Landmark[] = [];
    const numLandmarks = landmarks.length;

    for (let i = 0; i < numLandmarks; i++) {
      let x = 0, y = 0, z = 0;
      let totalWeight = 0;

      // Weighted average - more recent frames have higher weight
      for (let j = 0; j < this.buffer.length; j++) {
        const weight = (j + 1) / this.buffer.length; // Linear weight increase
        x += this.buffer[j][i].x * weight;
        y += this.buffer[j][i].y * weight;
        z += this.buffer[j][i].z * weight;
        totalWeight += weight;
      }

      smoothed.push({
        x: x / totalWeight,
        y: y / totalWeight,
        z: z / totalWeight,
        visibility: landmarks[i].visibility,
      });
    }

    return smoothed;
  }

  /**
   * Reset the buffer
   */
  reset() {
    this.buffer = [];
  }
}

/**
 * Quaternion-based rotation interpolation (SLERP)
 * For smooth joint rotations
 */
export class RotationSmoother {
  private previousRotations: Map<string, THREE.Quaternion>;

  constructor() {
    this.previousRotations = new Map();
  }

  /**
   * Smoothly interpolate rotation
   * @param jointId Unique identifier for the joint
   * @param targetRotation Target rotation quaternion
   * @param alpha Interpolation factor (0-1), higher = smoother but more lag
   */
  smoothRotation(
    jointId: string,
    targetRotation: THREE.Quaternion,
    alpha: number = 0.3
  ): THREE.Quaternion {
    const prev = this.previousRotations.get(jointId);

    if (!prev) {
      // First time seeing this joint
      const newQuat = targetRotation.clone();
      this.previousRotations.set(jointId, newQuat);
      return newQuat;
    }

    // SLERP (Spherical Linear Interpolation) for smooth rotation
    const smoothed = new THREE.Quaternion();
    smoothed.slerpQuaternions(prev, targetRotation, alpha);

    // Update previous rotation
    this.previousRotations.set(jointId, smoothed.clone());

    return smoothed;
  }

  /**
   * Reset all stored rotations
   */
  reset() {
    this.previousRotations.clear();
  }
}

/**
 * Calculate rotation quaternion between two points
 */
export function calculateBoneRotation(
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Quaternion {
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const up = new THREE.Vector3(0, 1, 0);

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(up, direction);

  return quaternion;
}

/**
 * Smooth position transition using exponential smoothing
 */
export class PositionSmoother {
  private previousPositions: Map<string, THREE.Vector3>;
  private alpha: number;

  constructor(alpha: number = 0.3) {
    this.previousPositions = new Map();
    this.alpha = alpha; // Smoothing factor (0-1), higher = smoother but more lag
  }

  /**
   * Smooth position transition
   */
  smoothPosition(
    pointId: string,
    targetPosition: THREE.Vector3
  ): THREE.Vector3 {
    const prev = this.previousPositions.get(pointId);

    if (!prev) {
      const newPos = targetPosition.clone();
      this.previousPositions.set(pointId, newPos);
      return newPos;
    }

    // Exponential smoothing
    const smoothed = new THREE.Vector3();
    smoothed.lerpVectors(prev, targetPosition, this.alpha);

    this.previousPositions.set(pointId, smoothed.clone());

    return smoothed;
  }

  /**
   * Reset all stored positions
   */
  reset() {
    this.previousPositions.clear();
  }
}
