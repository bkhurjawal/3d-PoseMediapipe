/**
 * Kalidokit-inspired pose solver for MediaPipe to 3D avatar retargeting
 * Based on Kalidokit's algorithms for accurate bone rotation calculation
 */

import * as THREE from 'three';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseRotation {
  Hips: {
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
  };
  Spine: THREE.Quaternion;
  Chest: THREE.Quaternion;
  Neck: THREE.Quaternion;
  Head: THREE.Quaternion;
  LeftUpperArm: THREE.Quaternion;
  LeftLowerArm: THREE.Quaternion;
  RightUpperArm: THREE.Quaternion;
  RightLowerArm: THREE.Quaternion;
  LeftUpperLeg: THREE.Quaternion;
  LeftLowerLeg: THREE.Quaternion;
  RightUpperLeg: THREE.Quaternion;
  RightLowerLeg: THREE.Quaternion;
}

/**
 * Calculate rotation to look from one point to another
 */
const calculateRotation = (
  a: Vector3D,
  b: Vector3D,
  c?: Vector3D
): THREE.Euler => {
  const vector1 = new THREE.Vector3(a.x, a.y, a.z);
  const vector2 = new THREE.Vector3(b.x, b.y, b.z);
  const vector3 = c ? new THREE.Vector3(c.x, c.y, c.z) : null;

  const direction = new THREE.Vector3().subVectors(vector2, vector1).normalize();

  if (vector3) {
    const up = new THREE.Vector3().subVectors(vector3, vector1).normalize();
    const right = new THREE.Vector3().crossVectors(direction, up).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(right, direction).normalize();

    const matrix = new THREE.Matrix4();
    matrix.makeBasis(right, correctedUp, direction.negate());

    return new THREE.Euler().setFromRotationMatrix(matrix);
  }

  // Simple rotation without up vector
  const euler = new THREE.Euler();
  euler.x = Math.atan2(direction.y, Math.sqrt(direction.x ** 2 + direction.z ** 2));
  euler.y = Math.atan2(-direction.x, -direction.z);
  euler.z = 0;

  return euler;
};

/**
 * Calculate angle between three points (for joint angles)
 */
const calculateAngle = (a: Vector3D, b: Vector3D, c: Vector3D): number => {
  const vector1 = new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
  const vector2 = new THREE.Vector3(c.x - b.x, c.y - b.y, c.z - b.z);

  vector1.normalize();
  vector2.normalize();

  return Math.acos(vector1.dot(vector2));
};

/**
 * Clamp value between min and max
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Linear interpolation
 */
const lerp = (start: number, end: number, t: number): number => {
  return start * (1 - t) + end * t;
};

/**
 * Convert MediaPipe landmarks to Three.js Vector3
 */
const landmarkToVector3 = (landmark: Vector3D): THREE.Vector3 => {
  return new THREE.Vector3(
    landmark.x,
    -landmark.y,  // Flip Y for Three.js coordinate system
    -landmark.z   // Flip Z for depth
  );
};

/**
 * Solve pose rotations from MediaPipe landmarks
 */
export const solvePoseRotations = (landmarks: Vector3D[]): PoseRotation | null => {
  if (!landmarks || landmarks.length < 33) {
    return null;
  }

  // MediaPipe Pose landmark indices
  const NOSE = 0;
  const LEFT_SHOULDER = 11;
  const RIGHT_SHOULDER = 12;
  const LEFT_ELBOW = 13;
  const RIGHT_ELBOW = 14;
  const LEFT_WRIST = 15;
  const RIGHT_WRIST = 16;
  const LEFT_HIP = 23;
  const RIGHT_HIP = 24;
  const LEFT_KNEE = 25;
  const RIGHT_KNEE = 26;
  const LEFT_ANKLE = 27;
  const RIGHT_ANKLE = 28;

  // Calculate body centers
  const hipCenter: Vector3D = {
    x: (landmarks[LEFT_HIP].x + landmarks[RIGHT_HIP].x) / 2,
    y: (landmarks[LEFT_HIP].y + landmarks[RIGHT_HIP].y) / 2,
    z: (landmarks[LEFT_HIP].z + landmarks[RIGHT_HIP].z) / 2,
  };

  const shoulderCenter: Vector3D = {
    x: (landmarks[LEFT_SHOULDER].x + landmarks[RIGHT_SHOULDER].x) / 2,
    y: (landmarks[LEFT_SHOULDER].y + landmarks[RIGHT_SHOULDER].y) / 2,
    z: (landmarks[LEFT_SHOULDER].z + landmarks[RIGHT_SHOULDER].z) / 2,
  };

  // HIPS - Position and rotation
  const hipsPosition = landmarkToVector3(hipCenter);
  const hipsRotation = new THREE.Quaternion().setFromEuler(
    calculateRotation(hipCenter, shoulderCenter)
  );

  // SPINE - Rotation from hips to shoulders
  const spineEuler = calculateRotation(hipCenter, shoulderCenter);
  const spineRotation = new THREE.Quaternion().setFromEuler(spineEuler);

  // CHEST - Upper torso
  const chestRotation = new THREE.Quaternion().setFromEuler(
    calculateRotation(hipCenter, shoulderCenter)
  );

  // NECK - From shoulder center to nose
  const neckEuler = calculateRotation(shoulderCenter, landmarks[NOSE]);
  const neckRotation = new THREE.Quaternion().setFromEuler(neckEuler);

  // HEAD - Follows neck
  const headRotation = neckRotation.clone();

  // LEFT ARM
  // Upper arm: shoulder to elbow
  const leftUpperArmEuler = calculateRotation(
    landmarks[LEFT_SHOULDER],
    landmarks[LEFT_ELBOW],
    landmarks[RIGHT_SHOULDER] // Up vector reference
  );
  const leftUpperArmRotation = new THREE.Quaternion().setFromEuler(leftUpperArmEuler);

  // Lower arm: elbow to wrist
  const leftLowerArmEuler = calculateRotation(
    landmarks[LEFT_ELBOW],
    landmarks[LEFT_WRIST],
    landmarks[LEFT_SHOULDER]
  );
  const leftLowerArmRotation = new THREE.Quaternion().setFromEuler(leftLowerArmEuler);

  // RIGHT ARM
  const rightUpperArmEuler = calculateRotation(
    landmarks[RIGHT_SHOULDER],
    landmarks[RIGHT_ELBOW],
    landmarks[LEFT_SHOULDER]
  );
  const rightUpperArmRotation = new THREE.Quaternion().setFromEuler(rightUpperArmEuler);

  const rightLowerArmEuler = calculateRotation(
    landmarks[RIGHT_ELBOW],
    landmarks[RIGHT_WRIST],
    landmarks[RIGHT_SHOULDER]
  );
  const rightLowerArmRotation = new THREE.Quaternion().setFromEuler(rightLowerArmEuler);

  // LEFT LEG
  const leftUpperLegEuler = calculateRotation(
    landmarks[LEFT_HIP],
    landmarks[LEFT_KNEE],
    landmarks[RIGHT_HIP]
  );
  const leftUpperLegRotation = new THREE.Quaternion().setFromEuler(leftUpperLegEuler);

  const leftLowerLegEuler = calculateRotation(
    landmarks[LEFT_KNEE],
    landmarks[LEFT_ANKLE],
    landmarks[LEFT_HIP]
  );
  const leftLowerLegRotation = new THREE.Quaternion().setFromEuler(leftLowerLegEuler);

  // RIGHT LEG
  const rightUpperLegEuler = calculateRotation(
    landmarks[RIGHT_HIP],
    landmarks[RIGHT_KNEE],
    landmarks[LEFT_HIP]
  );
  const rightUpperLegRotation = new THREE.Quaternion().setFromEuler(rightUpperLegEuler);

  const rightLowerLegEuler = calculateRotation(
    landmarks[RIGHT_KNEE],
    landmarks[RIGHT_ANKLE],
    landmarks[RIGHT_HIP]
  );
  const rightLowerLegRotation = new THREE.Quaternion().setFromEuler(rightLowerLegEuler);

  return {
    Hips: {
      position: hipsPosition,
      rotation: hipsRotation,
    },
    Spine: spineRotation,
    Chest: chestRotation,
    Neck: neckRotation,
    Head: headRotation,
    LeftUpperArm: leftUpperArmRotation,
    LeftLowerArm: leftLowerArmRotation,
    RightUpperArm: rightUpperArmRotation,
    RightLowerArm: rightLowerArmRotation,
    LeftUpperLeg: leftUpperLegRotation,
    LeftLowerLeg: leftLowerLegRotation,
    RightUpperLeg: rightUpperLegRotation,
    RightLowerLeg: rightLowerLegRotation,
  };
};

/**
 * Apply pose rotations to VRM skeleton bones
 */
export const applyPoseRotationsToRig = (
  poseRotations: PoseRotation,
  bones: { [key: string]: THREE.Bone },
  smoothing: number = 0.3
): void => {
  // Apply with smoothing (slerp)

  // Hips
  if (bones['mixamorigHips']) {
    bones['mixamorigHips'].position.lerp(poseRotations.Hips.position, smoothing);
    bones['mixamorigHips'].quaternion.slerp(poseRotations.Hips.rotation, smoothing);
  }

  // Spine
  if (bones['mixamorigSpine']) {
    bones['mixamorigSpine'].quaternion.slerp(poseRotations.Spine, smoothing);
  }

  // Chest
  if (bones['mixamorigSpine1']) {
    bones['mixamorigSpine1'].quaternion.slerp(poseRotations.Chest, smoothing * 0.5);
  }
  if (bones['mixamorigSpine2']) {
    bones['mixamorigSpine2'].quaternion.slerp(poseRotations.Chest, smoothing * 0.5);
  }

  // Neck
  if (bones['mixamorigNeck']) {
    bones['mixamorigNeck'].quaternion.slerp(poseRotations.Neck, smoothing * 0.7);
  }

  // Head
  if (bones['mixamorigHead']) {
    bones['mixamorigHead'].quaternion.slerp(poseRotations.Head, smoothing * 0.7);
  }

  // Left Arm
  if (bones['mixamorigLeftArm']) {
    bones['mixamorigLeftArm'].quaternion.slerp(poseRotations.LeftUpperArm, smoothing);
  }
  if (bones['mixamorigLeftForeArm']) {
    bones['mixamorigLeftForeArm'].quaternion.slerp(poseRotations.LeftLowerArm, smoothing);
  }

  // Right Arm
  if (bones['mixamorigRightArm']) {
    bones['mixamorigRightArm'].quaternion.slerp(poseRotations.RightUpperArm, smoothing);
  }
  if (bones['mixamorigRightForeArm']) {
    bones['mixamorigRightForeArm'].quaternion.slerp(poseRotations.RightLowerArm, smoothing);
  }

  // Left Leg
  if (bones['mixamorigLeftUpLeg']) {
    bones['mixamorigLeftUpLeg'].quaternion.slerp(poseRotations.LeftUpperLeg, smoothing);
  }
  if (bones['mixamorigLeftLeg']) {
    bones['mixamorigLeftLeg'].quaternion.slerp(poseRotations.LeftLowerLeg, smoothing);
  }

  // Right Leg
  if (bones['mixamorigRightUpLeg']) {
    bones['mixamorigRightUpLeg'].quaternion.slerp(poseRotations.RightUpperLeg, smoothing);
  }
  if (bones['mixamorigRightLeg']) {
    bones['mixamorigRightLeg'].quaternion.slerp(poseRotations.RightLowerLeg, smoothing);
  }
};
