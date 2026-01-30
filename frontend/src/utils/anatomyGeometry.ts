/**
 * Anatomically Accurate Geometry for Humanoid Model
 * Creates realistic body part geometries with proper proportions
 */

import * as THREE from 'three';

/**
 * Create anatomically accurate chest (ribcage) geometry
 * Wider at top (shoulders), slightly narrower at bottom (diaphragm)
 */
export function createChestGeometry(
  leftShoulder: THREE.Vector3,
  rightShoulder: THREE.Vector3,
  leftMidTorso: THREE.Vector3,
  rightMidTorso: THREE.Vector3,
  depth: number = 0.15
): THREE.BufferGeometry {
  // Chest is barrel-shaped, wider at shoulders, slightly narrower at diaphragm
  const geometry = new THREE.BufferGeometry();

  // Front face vertices
  const frontVertices = [
    leftShoulder.x, leftShoulder.y, leftShoulder.z,
    rightShoulder.x, rightShoulder.y, rightShoulder.z,
    rightMidTorso.x, rightMidTorso.y, rightMidTorso.z,
    leftMidTorso.x, leftMidTorso.y, leftMidTorso.z,
  ];

  // Back face vertices (chest is deeper than abdomen)
  const backVertices = [
    leftShoulder.x, leftShoulder.y, leftShoulder.z - depth,
    rightShoulder.x, rightShoulder.y, rightShoulder.z - depth,
    rightMidTorso.x, rightMidTorso.y, rightMidTorso.z - depth * 0.9,
    leftMidTorso.x, leftMidTorso.y, leftMidTorso.z - depth * 0.9,
  ];

  // Create all faces
  const vertices = new Float32Array([
    // Front face (2 triangles)
    ...frontVertices.slice(0, 3), ...frontVertices.slice(3, 6), ...frontVertices.slice(6, 9),
    ...frontVertices.slice(0, 3), ...frontVertices.slice(6, 9), ...frontVertices.slice(9, 12),

    // Back face (2 triangles)
    ...backVertices.slice(0, 3), ...backVertices.slice(6, 9), ...backVertices.slice(3, 6),
    ...backVertices.slice(0, 3), ...backVertices.slice(9, 12), ...backVertices.slice(6, 9),

    // Left side (2 triangles)
    frontVertices[0], frontVertices[1], frontVertices[2],
    frontVertices[9], frontVertices[10], frontVertices[11],
    backVertices[9], backVertices[10], backVertices[11],

    frontVertices[0], frontVertices[1], frontVertices[2],
    backVertices[9], backVertices[10], backVertices[11],
    backVertices[0], backVertices[1], backVertices[2],

    // Right side (2 triangles)
    frontVertices[3], frontVertices[4], frontVertices[5],
    backVertices[3], backVertices[4], backVertices[5],
    backVertices[6], backVertices[7], backVertices[8],

    frontVertices[3], frontVertices[4], frontVertices[5],
    backVertices[6], backVertices[7], backVertices[8],
    frontVertices[6], frontVertices[7], frontVertices[8],

    // Top (shoulders - 2 triangles)
    frontVertices[0], frontVertices[1], frontVertices[2],
    backVertices[0], backVertices[1], backVertices[2],
    backVertices[3], backVertices[4], backVertices[5],

    frontVertices[0], frontVertices[1], frontVertices[2],
    backVertices[3], backVertices[4], backVertices[5],
    frontVertices[3], frontVertices[4], frontVertices[5],

    // Bottom (diaphragm - 2 triangles)
    frontVertices[9], frontVertices[10], frontVertices[11],
    frontVertices[6], frontVertices[7], frontVertices[8],
    backVertices[6], backVertices[7], backVertices[8],

    frontVertices[9], frontVertices[10], frontVertices[11],
    backVertices[6], backVertices[7], backVertices[8],
    backVertices[9], backVertices[10], backVertices[11],
  ]);

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  // Apply extra smooth normal calculation for organic appearance
  const normals = geometry.attributes.normal;
  if (normals) {
    for (let i = 0; i < normals.count; i++) {
      const nx = normals.getX(i);
      const ny = normals.getY(i);
      const nz = normals.getZ(i);
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (length > 0) {
        normals.setXYZ(i, nx / length, ny / length, nz / length);
      }
    }
    normals.needsUpdate = true;
  }

  return geometry;
}

/**
 * Create anatomically accurate abdomen geometry
 * Narrower than chest, tapers toward hips
 */
export function createAbdomenGeometry(
  leftMidTorso: THREE.Vector3,
  rightMidTorso: THREE.Vector3,
  leftHip: THREE.Vector3,
  rightHip: THREE.Vector3,
  depth: number = 0.12
): THREE.BufferGeometry {
  // Abdomen is softer, less deep than chest
  const geometry = new THREE.BufferGeometry();

  // Front face vertices
  const frontVertices = [
    leftMidTorso.x, leftMidTorso.y, leftMidTorso.z,
    rightMidTorso.x, rightMidTorso.y, rightMidTorso.z,
    rightHip.x, rightHip.y, rightHip.z,
    leftHip.x, leftHip.y, leftHip.z,
  ];

  // Back face vertices (abdomen is shallower)
  const backVertices = [
    leftMidTorso.x, leftMidTorso.y, leftMidTorso.z - depth * 0.9,
    rightMidTorso.x, rightMidTorso.y, rightMidTorso.z - depth * 0.9,
    rightHip.x, rightHip.y, rightHip.z - depth,
    leftHip.x, leftHip.y, leftHip.z - depth,
  ];

  const vertices = new Float32Array([
    // Front face
    ...frontVertices.slice(0, 3), ...frontVertices.slice(3, 6), ...frontVertices.slice(6, 9),
    ...frontVertices.slice(0, 3), ...frontVertices.slice(6, 9), ...frontVertices.slice(9, 12),

    // Back face
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

    // Top
    frontVertices[0], frontVertices[1], frontVertices[2],
    backVertices[0], backVertices[1], backVertices[2],
    backVertices[3], backVertices[4], backVertices[5],

    frontVertices[0], frontVertices[1], frontVertices[2],
    backVertices[3], backVertices[4], backVertices[5],
    frontVertices[3], frontVertices[4], frontVertices[5],

    // Bottom
    frontVertices[9], frontVertices[10], frontVertices[11],
    frontVertices[6], frontVertices[7], frontVertices[8],
    backVertices[6], backVertices[7], backVertices[8],

    frontVertices[9], frontVertices[10], frontVertices[11],
    backVertices[6], backVertices[7], backVertices[8],
    backVertices[9], backVertices[10], backVertices[11],
  ]);

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  // Apply extra smooth normal calculation for organic appearance
  const normals = geometry.attributes.normal;
  if (normals) {
    for (let i = 0; i < normals.count; i++) {
      const nx = normals.getX(i);
      const ny = normals.getY(i);
      const nz = normals.getZ(i);
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (length > 0) {
        normals.setXYZ(i, nx / length, ny / length, nz / length);
      }
    }
    normals.needsUpdate = true;
  }

  return geometry;
}

/**
 * Create anatomically accurate neck geometry
 * Cylindrical with slight taper from shoulders to head
 */
export function createNeckGeometry(
  headBase: THREE.Vector3,
  shoulderCenter: THREE.Vector3,
  neckRadius: number = 0.045
): { geometry: THREE.BufferGeometry; midpoint: THREE.Vector3; direction: THREE.Vector3 } {
  const direction = new THREE.Vector3().subVectors(headBase, shoulderCenter);
  const height = direction.length();

  // Neck tapers from shoulders (wider) to head (narrower)
  const geometry = new THREE.CylinderGeometry(
    neckRadius * 0.7,  // Top radius (at head) - narrower
    neckRadius,        // Bottom radius (at shoulders) - wider
    height,
    32,  // High segment count for smooth appearance
    4    // Height segments for smooth transitions
  );

  geometry.computeVertexNormals();

  const midpoint = new THREE.Vector3()
    .addVectors(shoulderCenter, headBase)
    .multiplyScalar(0.5);

  return { geometry, midpoint, direction };
}

/**
 * Create clavicle (collarbone) structure
 * Connects shoulders across the chest
 */
export function createClavicleGeometry(
  leftShoulder: THREE.Vector3,
  rightShoulder: THREE.Vector3,
  shoulderCenter: THREE.Vector3,
  radius: number = 0.018
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Left clavicle
  const leftDirection = new THREE.Vector3().subVectors(leftShoulder, shoulderCenter);
  const leftLength = leftDirection.length();
  const leftGeometry = new THREE.CylinderGeometry(
    radius * 0.8, // Narrower at shoulder
    radius,       // Wider at center
    leftLength,
    24,
    1
  );
  leftGeometry.computeVertexNormals();
  geometries.push(leftGeometry);

  // Right clavicle
  const rightDirection = new THREE.Vector3().subVectors(rightShoulder, shoulderCenter);
  const rightLength = rightDirection.length();
  const rightGeometry = new THREE.CylinderGeometry(
    radius * 0.8, // Narrower at shoulder
    radius,       // Wider at center
    rightLength,
    24,
    1
  );
  rightGeometry.computeVertexNormals();
  geometries.push(rightGeometry);

  return geometries;
}

/**
 * Anatomically accurate limb tapering ratios
 * Based on average human proportions
 */
export const AnatomicalProportions = {
  // Upper arm: shoulder to elbow
  upperArm: {
    proximalRadius: 0.05,  // At shoulder (wider)
    distalRadius: 0.035,   // At elbow (narrower)
    taperRatio: 0.7,       // 70% of proximal
  },

  // Forearm: elbow to wrist
  forearm: {
    proximalRadius: 0.035,  // At elbow
    distalRadius: 0.025,    // At wrist
    taperRatio: 0.71,       // 71% of proximal
  },

  // Thigh: hip to knee
  thigh: {
    proximalRadius: 0.07,   // At hip (widest)
    distalRadius: 0.048,    // At knee
    taperRatio: 0.69,       // 69% of proximal
  },

  // Shin: knee to ankle
  shin: {
    proximalRadius: 0.048,  // At knee
    distalRadius: 0.032,    // At ankle
    taperRatio: 0.67,       // 67% of proximal
  },

  // Neck proportions
  neck: {
    radius: 0.045,
    heightRatio: 0.15,  // 15% of total torso height
  },

  // Torso proportions
  torso: {
    chestDepth: 0.16,      // Front to back
    abdomenDepth: 0.13,     // Slightly shallower
    chestHeightRatio: 0.55, // 55% of torso is chest
  },
};
