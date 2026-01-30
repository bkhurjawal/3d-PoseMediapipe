/**
 * Muscle Geometry Utilities
 * Creates anatomically accurate muscle group visualizations
 */

import * as THREE from 'three';

export interface MuscleConfig {
  color: number;
  opacity: number;
  emissive: number;
}

// Muscle group colors
export const MUSCLE_COLORS = {
  biceps: 0xFF6B6B,      // Red
  triceps: 0xFF8E53,     // Orange-red
  forearm: 0xFFA07A,     // Light salmon
  deltoid: 0xFF4757,     // Bright red
  chest: 0x4ECDC4,       // Teal
  back: 0x45B7D1,        // Light blue
  abs: 0x96CEB4,         // Mint green
  quads: 0xFECA57,       // Yellow
  hamstrings: 0xF9CA24,  // Gold
  calves: 0xFFD93D,      // Light yellow
  glutes: 0xFFAA00,      // Amber
};

/**
 * Create muscle material with proper depth settings
 */
function createMuscleMaterial(color: number, emissiveIntensity: number = 0.1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: emissiveIntensity,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false, // Transparent materials don't write to depth buffer
    depthTest: true,
    depthFunc: THREE.LessEqualDepth,
  });
}

/**
 * Apply muscle mesh properties
 */
function applyMuscleMeshProperties(mesh: THREE.Mesh): void {
  mesh.renderOrder = 2; // Render after skeleton but with proper depth testing
  mesh.castShadow = false; // Muscles are semi-transparent, don't cast shadows
  mesh.receiveShadow = true;
}

/**
 * Create bicep muscle geometry
 */
export function createBicep(
  shoulderPos: THREE.Vector3,
  elbowPos: THREE.Vector3,
  side: 'left' | 'right'
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(elbowPos, shoulderPos);
  const length = direction.length();

  // Bicep is on the front/inner side of the arm
  const segments = 16;
  const curve = new THREE.CatmullRomCurve3([
    shoulderPos.clone(),
    new THREE.Vector3().lerpVectors(shoulderPos, elbowPos, 0.3).add(
      new THREE.Vector3(side === 'left' ? 0.02 : -0.02, 0, 0.03)
    ),
    new THREE.Vector3().lerpVectors(shoulderPos, elbowPos, 0.6).add(
      new THREE.Vector3(side === 'left' ? 0.025 : -0.025, 0, 0.035)
    ),
    elbowPos.clone(),
  ]);

  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.035, 12, false);
  const material = createMuscleMaterial(MUSCLE_COLORS.biceps);
  const mesh = new THREE.Mesh(tubeGeometry, material);
  applyMuscleMeshProperties(mesh);
  return mesh;
}

/**
 * Create tricep muscle geometry
 */
export function createTricep(
  shoulderPos: THREE.Vector3,
  elbowPos: THREE.Vector3,
  side: 'left' | 'right'
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(elbowPos, shoulderPos);
  const length = direction.length();

  // Tricep is on the back side of the arm
  const segments = 16;
  const curve = new THREE.CatmullRomCurve3([
    shoulderPos.clone(),
    new THREE.Vector3().lerpVectors(shoulderPos, elbowPos, 0.35).add(
      new THREE.Vector3(side === 'left' ? -0.015 : 0.015, 0, -0.035)
    ),
    new THREE.Vector3().lerpVectors(shoulderPos, elbowPos, 0.65).add(
      new THREE.Vector3(side === 'left' ? -0.02 : 0.02, 0, -0.03)
    ),
    elbowPos.clone(),
  ]);

  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.03, 12, false);
  const material = createMuscleMaterial(MUSCLE_COLORS.triceps);
  const mesh = new THREE.Mesh(tubeGeometry, material);
  applyMuscleMeshProperties(mesh);
  return mesh;
}

/**
 * Create forearm muscle geometry
 */
export function createForearm(
  elbowPos: THREE.Vector3,
  wristPos: THREE.Vector3
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(wristPos, elbowPos);
  const length = direction.length();

  const segments = 12;
  const curve = new THREE.CatmullRomCurve3([
    elbowPos.clone(),
    new THREE.Vector3().lerpVectors(elbowPos, wristPos, 0.5),
    wristPos.clone(),
  ]);

  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.025, 10, false);

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.forearm,
    emissive: MUSCLE_COLORS.forearm,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(tubeGeometry, material);
}

/**
 * Create deltoid (shoulder) muscle geometry
 */
export function createDeltoid(
  shoulderPos: THREE.Vector3,
  side: 'left' | 'right'
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.055, 16, 16, 0, Math.PI, 0, Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.deltoid,
    emissive: MUSCLE_COLORS.deltoid,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.75,
    metalness: 0.1,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(shoulderPos);

  // Rotate to cover shoulder
  if (side === 'left') {
    mesh.rotation.z = Math.PI / 6;
  } else {
    mesh.rotation.z = -Math.PI / 6;
  }

  return mesh;
}

/**
 * Create quadriceps muscle geometry
 */
export function createQuad(
  hipPos: THREE.Vector3,
  kneePos: THREE.Vector3,
  side: 'left' | 'right'
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(kneePos, hipPos);
  const length = direction.length();

  // Quads are on the front of the thigh
  const segments = 16;
  const curve = new THREE.CatmullRomCurve3([
    hipPos.clone(),
    new THREE.Vector3().lerpVectors(hipPos, kneePos, 0.3).add(
      new THREE.Vector3(0, 0, 0.04)
    ),
    new THREE.Vector3().lerpVectors(hipPos, kneePos, 0.7).add(
      new THREE.Vector3(0, 0, 0.035)
    ),
    kneePos.clone(),
  ]);

  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.055, 14, false);

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.quads,
    emissive: MUSCLE_COLORS.quads,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(tubeGeometry, material);
}

/**
 * Create hamstring muscle geometry
 */
export function createHamstring(
  hipPos: THREE.Vector3,
  kneePos: THREE.Vector3,
  side: 'left' | 'right'
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(kneePos, hipPos);
  const length = direction.length();

  // Hamstrings are on the back of the thigh
  const segments = 16;
  const curve = new THREE.CatmullRomCurve3([
    hipPos.clone(),
    new THREE.Vector3().lerpVectors(hipPos, kneePos, 0.35).add(
      new THREE.Vector3(0, 0, -0.04)
    ),
    new THREE.Vector3().lerpVectors(hipPos, kneePos, 0.7).add(
      new THREE.Vector3(0, 0, -0.035)
    ),
    kneePos.clone(),
  ]);

  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.05, 14, false);

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.hamstrings,
    emissive: MUSCLE_COLORS.hamstrings,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(tubeGeometry, material);
}

/**
 * Create calf muscle geometry
 */
export function createCalf(
  kneePos: THREE.Vector3,
  anklePos: THREE.Vector3
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(anklePos, kneePos);
  const length = direction.length();

  // Calf bulges in the upper-mid section
  const segments = 12;
  const curve = new THREE.CatmullRomCurve3([
    kneePos.clone(),
    new THREE.Vector3().lerpVectors(kneePos, anklePos, 0.3).add(
      new THREE.Vector3(0, 0, -0.03)
    ),
    new THREE.Vector3().lerpVectors(kneePos, anklePos, 0.6),
    anklePos.clone(),
  ]);

  const radiusFunction = (t: number) => {
    // Bulge at 30-40% down the calf
    if (t < 0.35) return 0.02 + (t / 0.35) * 0.025;
    if (t < 0.6) return 0.045 - ((t - 0.35) / 0.25) * 0.01;
    return 0.035 - ((t - 0.6) / 0.4) * 0.015;
  };

  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.04, 12, false);

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.calves,
    emissive: MUSCLE_COLORS.calves,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(tubeGeometry, material);
}

/**
 * Create chest (pectorals) muscle geometry
 */
export function createChest(
  leftShoulderPos: THREE.Vector3,
  rightShoulderPos: THREE.Vector3,
  shoulderCenter: THREE.Vector3
): THREE.Mesh {
  const chestWidth = leftShoulderPos.distanceTo(rightShoulderPos);
  const chestDepth = 0.12;

  // Create a curved surface for the chest
  const geometry = new THREE.SphereGeometry(
    chestWidth * 0.35,
    16,
    12,
    0,
    Math.PI,
    0,
    Math.PI * 0.5
  );

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.chest,
    emissive: MUSCLE_COLORS.chest,
    emissiveIntensity: 0.12,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(shoulderCenter);
  mesh.position.z += 0.05; // Move forward
  mesh.rotation.x = Math.PI / 2;

  return mesh;
}

/**
 * Create back (latissimus dorsi) muscle geometry
 */
export function createBack(
  leftShoulderPos: THREE.Vector3,
  rightShoulderPos: THREE.Vector3,
  shoulderCenter: THREE.Vector3,
  hipCenter: THREE.Vector3
): THREE.Mesh {
  const backWidth = leftShoulderPos.distanceTo(rightShoulderPos) * 0.9;
  const backHeight = shoulderCenter.distanceTo(hipCenter) * 0.7;

  // Create a tapered back surface
  const geometry = new THREE.CylinderGeometry(
    backWidth * 0.25, // top radius
    backWidth * 0.35, // bottom radius (wider at lats)
    backHeight,
    16,
    8
  );

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.back,
    emissive: MUSCLE_COLORS.back,
    emissiveIntensity: 0.12,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const backCenter = new THREE.Vector3().lerpVectors(shoulderCenter, hipCenter, 0.4);
  mesh.position.copy(backCenter);
  mesh.position.z -= 0.08; // Move backward

  return mesh;
}

/**
 * Create abdominal muscles geometry
 */
export function createAbs(
  shoulderCenter: THREE.Vector3,
  hipCenter: THREE.Vector3
): THREE.Mesh {
  const absHeight = shoulderCenter.distanceTo(hipCenter) * 0.6;
  const absWidth = 0.15;

  const geometry = new THREE.BoxGeometry(absWidth, absHeight, 0.05, 6, 8, 1);

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.abs,
    emissive: MUSCLE_COLORS.abs,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const absCenter = new THREE.Vector3().lerpVectors(shoulderCenter, hipCenter, 0.5);
  mesh.position.copy(absCenter);
  mesh.position.z += 0.06; // Move forward

  return mesh;
}

/**
 * Create glute muscles geometry
 */
export function createGlutes(
  leftHipPos: THREE.Vector3,
  rightHipPos: THREE.Vector3,
  hipCenter: THREE.Vector3
): THREE.Mesh {
  const gluteWidth = leftHipPos.distanceTo(rightHipPos) * 0.8;

  const geometry = new THREE.SphereGeometry(
    gluteWidth * 0.35,
    16,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.6
  );

  const material = new THREE.MeshStandardMaterial({
    color: MUSCLE_COLORS.glutes,
    emissive: MUSCLE_COLORS.glutes,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.7,
    metalness: 0.1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(hipCenter);
  mesh.position.y -= 0.05; // Move down slightly
  mesh.position.z -= 0.08; // Move backward
  mesh.rotation.x = Math.PI * 0.1;

  return mesh;
}
