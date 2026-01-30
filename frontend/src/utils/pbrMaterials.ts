/**
 * PBR Material System for Humanoid Model
 * Implements physically-based rendering with gradient shading and proper surface normals
 */

import * as THREE from 'three';

/**
 * Create a gradient texture for skin-like shading
 */
export function createGradientTexture(
  topColor: THREE.Color,
  bottomColor: THREE.Color,
  size: number = 256
): THREE.DataTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, `#${topColor.getHexString()}`);
  gradient.addColorStop(1, `#${bottomColor.getHexString()}`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, size);

  const imageData = ctx.getImageData(0, 0, 1, size);
  const texture = new THREE.DataTexture(imageData.data, 1, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}

/**
 * PBR Material configuration for different body parts
 */
export interface PBRMaterialConfig {
  baseColor: number;
  metalness: number;
  roughness: number;
  emissive?: number;
  emissiveIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  useGradient?: boolean;
  gradientTopColor?: THREE.Color;
  gradientBottomColor?: THREE.Color;
}

/**
 * Create a PBR material with enhanced properties
 */
export function createPBRMaterial(config: PBRMaterialConfig): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: config.baseColor,
    metalness: config.metalness,
    roughness: config.roughness,
    emissive: config.emissive || 0x000000,
    emissiveIntensity: config.emissiveIntensity || 0,

    // Enhanced material properties for realism
    flatShading: false, // Smooth shading
    side: THREE.FrontSide,

    // Depth properties
    depthWrite: true,
    depthTest: true,
    depthFunc: THREE.LessEqualDepth,

    // Environment mapping for reflections
    envMapIntensity: 0.3,
  });

  // Apply gradient if specified
  if (config.useGradient && config.gradientTopColor && config.gradientBottomColor) {
    const gradientTexture = createGradientTexture(
      config.gradientTopColor,
      config.gradientBottomColor
    );
    material.map = gradientTexture;
  }

  return material;
}

/**
 * Preset material configurations for different body parts
 */
export const MaterialPresets = {
  // Main body limbs - smooth skin-like appearance
  limb: {
    baseColor: 0xA78BFA, // Purple
    metalness: 0.05,
    roughness: 0.6,
    emissive: 0x4B2B7F,
    emissiveIntensity: 0.05,
    useGradient: true,
    gradientTopColor: new THREE.Color(0xB899FA),
    gradientBottomColor: new THREE.Color(0x967DD9),
  } as PBRMaterialConfig,

  // Torso - slightly different properties
  torso: {
    baseColor: 0xA78BFA,
    metalness: 0.03,
    roughness: 0.65,
    emissive: 0x4B2B7F,
    emissiveIntensity: 0.03,
  } as PBRMaterialConfig,

  // Head - smoother, more reflective
  head: {
    baseColor: 0xB899FA,
    metalness: 0.02,
    roughness: 0.5,
    emissive: 0x5B3B8F,
    emissiveIntensity: 0.08,
  } as PBRMaterialConfig,

  // Joints - highlighted with warm tone (20% more visible)
  joint: {
    baseColor: 0xFFAA44, // Brighter orange-gold
    metalness: 0.5, // Increased metalness for mechanical look
    roughness: 0.3, // Smoother for more reflections
    emissive: 0xFF7700,
    emissiveIntensity: 0.25, // Increased from 0.15 to 0.25 (66% increase)
  } as PBRMaterialConfig,

  // Minor joints - softer highlight
  minorJoint: {
    baseColor: 0xA78BFA,
    metalness: 0.15,
    roughness: 0.5,
    emissive: 0x7B5BBA,
    emissiveIntensity: 0.1,
  } as PBRMaterialConfig,

  // Joint connectors - cylindrical segments between bones
  jointConnector: {
    baseColor: 0xCC8833, // Bronze/copper color
    metalness: 0.65, // Very metallic
    roughness: 0.25, // Smooth metallic surface
    emissive: 0x995522,
    emissiveIntensity: 0.15,
  } as PBRMaterialConfig,

  // Joint caps - mechanical covers at articulation points
  jointCap: {
    baseColor: 0xDDAA55, // Gold/brass color
    metalness: 0.75, // Highly metallic
    roughness: 0.2, // Very smooth
    emissive: 0xBB8844,
    emissiveIntensity: 0.2,
  } as PBRMaterialConfig,
};

/**
 * Create a smooth cylinder mesh with proper normals for limbs
 */
export function createSmoothLimbMesh(
  start: THREE.Vector3,
  end: THREE.Vector3,
  topRadius: number,
  bottomRadius: number,
  material: THREE.Material,
  segments: number = 16
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  // Create cylinder with high segment count for smooth normals
  const geometry = new THREE.CylinderGeometry(
    bottomRadius, // radiusTop (at end)
    topRadius,    // radiusBottom (at start)
    length,
    segments,     // radialSegments - more = smoother
    8             // heightSegments - for smooth bending
  );

  // Ensure normals are properly calculated
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);

  // Position at midpoint
  mesh.position.copy(start).add(direction.clone().multiplyScalar(0.5));

  // Orient the mesh
  const axis = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(axis, direction.normalize());
  mesh.quaternion.copy(quaternion);

  // Enable shadows
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Create a smooth sphere for joints with proper normals
 */
export function createSmoothJointSphere(
  position: THREE.Vector3,
  radius: number,
  material: THREE.Material
): THREE.Mesh {
  // High segment count for smooth appearance
  const geometry = new THREE.SphereGeometry(radius, 32, 32);

  // Ensure proper normal calculation
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Apply subsurface scattering approximation to material
 * This simulates light penetrating and scattering within the surface
 */
export function applySubsurfaceScattering(
  material: THREE.MeshStandardMaterial,
  scatterColor: THREE.Color = new THREE.Color(0xFFAAAA),
  intensity: number = 0.3
): void {
  // Approximate SSS using emissive color
  material.emissive = scatterColor;
  material.emissiveIntensity = intensity;

  // Adjust material properties for translucent appearance
  material.roughness = Math.max(0.4, material.roughness);
  material.metalness = Math.min(0.1, material.metalness);
}

/**
 * Create environment map for realistic reflections
 */
export function createEnvironmentMap(): THREE.CubeTexture {
  const loader = new THREE.CubeTextureLoader();

  // Create a simple procedural environment
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#5588ff');
  gradient.addColorStop(1, '#112244');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Create data URLs for all 6 faces
  const dataUrl = canvas.toDataURL();
  const urls = [dataUrl, dataUrl, dataUrl, dataUrl, dataUrl, dataUrl];

  return loader.load(urls);
}

/**
 * Update material with vertex colors for gradient effect
 */
export function applyVertexGradient(
  geometry: THREE.BufferGeometry,
  topColor: THREE.Color,
  bottomColor: THREE.Color
): void {
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  // Find min and max Y values
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const range = maxY - minY;

  // Apply gradient colors based on Y position
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const t = (y - minY) / range; // Normalized position (0 to 1)

    const color = new THREE.Color().lerpColors(bottomColor, topColor, t);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Create a cylindrical joint connector between two positions
 * Used to show articulation between bone segments
 */
export function createJointConnector(
  position: THREE.Vector3,
  radius: number,
  height: number = 0.025
): THREE.Mesh {
  // Create a short cylinder as connector
  const geometry = new THREE.CylinderGeometry(
    radius * 1.1, // Top radius (slightly wider)
    radius * 1.1, // Bottom radius
    height,
    24,  // radialSegments for smooth appearance
    1
  );

  geometry.computeVertexNormals();

  // Create metallic bronze material
  const material = createPBRMaterial(MaterialPresets.jointConnector);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Create a joint cap (mechanical cover) for major articulation points
 * Like a robotic joint cover
 */
export function createJointCap(
  position: THREE.Vector3,
  size: number,
  type: 'sphere' | 'disc' = 'sphere'
): THREE.Group {
  const group = new THREE.Group();

  if (type === 'sphere') {
    // Spherical cap with metallic bands
    const capGeometry = new THREE.SphereGeometry(size * 1.15, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7);
    capGeometry.computeVertexNormals();

    const capMaterial = createPBRMaterial(MaterialPresets.jointCap);
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);

    // Add metallic rings around the cap
    for (let i = 0; i < 2; i++) {
      const ringGeometry = new THREE.TorusGeometry(
        size * (1.0 + i * 0.15), // radius
        size * 0.08, // tube
        16, // radialSegments
        32  // tubularSegments
      );
      ringGeometry.computeVertexNormals();

      const ringMaterial = createPBRMaterial({
        ...MaterialPresets.jointCap,
        metalness: 0.85,
        roughness: 0.15,
      });

      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -size * 0.3 * (i + 1);
      ring.castShadow = true;
      ring.receiveShadow = true;
      group.add(ring);
    }
  } else {
    // Disc-shaped cap
    const capGeometry = new THREE.CylinderGeometry(size * 1.2, size * 1.1, size * 0.3, 32);
    capGeometry.computeVertexNormals();

    const capMaterial = createPBRMaterial(MaterialPresets.jointCap);
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
  }

  group.position.copy(position);
  return group;
}

/**
 * Create an enhanced joint sphere with connector rings
 */
export function createEnhancedJoint(
  position: THREE.Vector3,
  radius: number,
  isMajor: boolean = false
): THREE.Group {
  const group = new THREE.Group();

  // Main joint sphere
  const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
  sphereGeometry.computeVertexNormals();

  const sphereMaterial = createPBRMaterial(
    isMajor ? MaterialPresets.joint : MaterialPresets.minorJoint
  );

  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  group.add(sphere);

  // Add connector ring for major joints
  if (isMajor) {
    const ringGeometry = new THREE.TorusGeometry(
      radius * 1.15, // radius
      radius * 0.15, // tube
      16,
      32
    );
    ringGeometry.computeVertexNormals();

    const ringMaterial = createPBRMaterial({
      ...MaterialPresets.jointConnector,
      metalness: 0.8,
      emissiveIntensity: 0.2,
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);
  }

  group.position.copy(position);
  return group;
}
