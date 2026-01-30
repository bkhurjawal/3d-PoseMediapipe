/**
 * Contact Shadow System
 * Creates realistic shadows where limbs intersect or come close together
 */

import * as THREE from 'three';

export interface ContactShadowConfig {
  darkness: number;
  blur: number;
  resolution: number;
}

/**
 * Calculate distance between two line segments (bones)
 */
function segmentDistance(
  a1: THREE.Vector3,
  a2: THREE.Vector3,
  b1: THREE.Vector3,
  b2: THREE.Vector3
): number {
  const da = new THREE.Vector3().subVectors(a2, a1);
  const db = new THREE.Vector3().subVectors(b2, b1);
  const dc = new THREE.Vector3().subVectors(b1, a1);

  const cross = new THREE.Vector3().crossVectors(da, db);
  const denom = cross.lengthSq();

  // Parallel segments
  if (denom === 0) {
    const d0 = dc.dot(da) / da.lengthSq();
    const d1 = new THREE.Vector3().subVectors(b2, a1).dot(da) / da.lengthSq();
    const t = Math.max(0, Math.min(1, d0));
    const s = Math.max(0, Math.min(1, d1));
    const pointOnA = new THREE.Vector3().lerpVectors(a1, a2, t);
    const pointOnB = new THREE.Vector3().lerpVectors(b1, b2, s);
    return pointOnA.distanceTo(pointOnB);
  }

  // Non-parallel segments
  const t = dc.cross(db).dot(cross) / denom;
  const s = dc.cross(da).dot(cross) / denom;

  const tClamped = Math.max(0, Math.min(1, t));
  const sClamped = Math.max(0, Math.min(1, s));

  const pointOnA = new THREE.Vector3().lerpVectors(a1, a2, tClamped);
  const pointOnB = new THREE.Vector3().lerpVectors(b1, b2, sClamped);

  return pointOnA.distanceTo(pointOnB);
}

/**
 * Create a contact shadow plane between two close limbs
 */
export function createContactShadow(
  pos1: THREE.Vector3,
  pos2: THREE.Vector3,
  distance: number,
  maxDistance: number = 0.15
): THREE.Mesh | null {
  if (distance > maxDistance) return null;

  // Calculate shadow intensity based on proximity
  const intensity = 1 - distance / maxDistance;
  const opacity = intensity * 0.4; // Max 40% opacity

  // Calculate midpoint and orientation
  const midpoint = new THREE.Vector3().lerpVectors(pos1, pos2, 0.5);
  const direction = new THREE.Vector3().subVectors(pos2, pos1).normalize();

  // Create shadow plane
  const shadowSize = 0.08;
  const geometry = new THREE.PlaneGeometry(shadowSize, shadowSize);

  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const shadow = new THREE.Mesh(geometry, material);
  shadow.position.copy(midpoint);

  // Orient shadow to face camera
  shadow.lookAt(midpoint.clone().add(new THREE.Vector3(0, 0, 1)));

  // Offset slightly to prevent z-fighting
  shadow.position.add(direction.clone().multiplyScalar(0.001));

  return shadow;
}

/**
 * Detect and create contact shadows between all limb pairs
 */
export function createAllContactShadows(
  limbPairs: Array<{ start: THREE.Vector3; end: THREE.Vector3; id: string }>,
  maxDistance: number = 0.15
): THREE.Mesh[] {
  const shadows: THREE.Mesh[] = [];

  for (let i = 0; i < limbPairs.length; i++) {
    for (let j = i + 1; j < limbPairs.length; j++) {
      const limb1 = limbPairs[i];
      const limb2 = limbPairs[j];

      // Skip if same limb or connected limbs
      if (limb1.id === limb2.id) continue;

      // Calculate closest distance between limb segments
      const distance = segmentDistance(
        limb1.start,
        limb1.end,
        limb2.start,
        limb2.end
      );

      // Create shadow if limbs are close
      if (distance < maxDistance) {
        // Find closest points
        const midpoint1 = new THREE.Vector3().lerpVectors(limb1.start, limb1.end, 0.5);
        const midpoint2 = new THREE.Vector3().lerpVectors(limb2.start, limb2.end, 0.5);

        const shadow = createContactShadow(midpoint1, midpoint2, distance, maxDistance);
        if (shadow) {
          shadows.push(shadow);
        }
      }
    }
  }

  return shadows;
}

/**
 * Create ambient occlusion shadow at a joint
 */
export function createJointShadow(
  position: THREE.Vector3,
  radius: number = 0.04
): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(radius, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const shadow = new THREE.Mesh(geometry, material);
  shadow.position.copy(position);
  shadow.position.z += 0.001; // Slight offset

  return shadow;
}

/**
 * Apply depth material properties for correct rendering
 */
export function applyDepthMaterial(material: THREE.Material): void {
  if (material instanceof THREE.MeshStandardMaterial ||
      material instanceof THREE.MeshPhongMaterial) {
    material.depthWrite = true;
    material.depthTest = true;
    material.depthFunc = THREE.LessEqualDepth;

    // For transparent materials, adjust rendering
    if (material.transparent) {
      material.depthWrite = false; // Don't write to depth buffer for transparency
      material.alphaTest = 0.01; // Discard fully transparent pixels
    }
  }
}

/**
 * Configure renderer for proper depth sorting
 */
export function configureDepthRendering(renderer: THREE.WebGLRenderer): void {
  renderer.sortObjects = true; // Enable automatic depth sorting
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Enable depth testing
  const gl = renderer.getContext();
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

/**
 * Set render order for proper layering
 */
export function setRenderOrder(
  object: THREE.Object3D,
  order: number,
  recursive: boolean = true
): void {
  object.renderOrder = order;

  if (recursive) {
    object.traverse((child) => {
      child.renderOrder = order;
    });
  }
}

/**
 * Calculate depth from camera for sorting
 */
export function calculateDepthFromCamera(
  position: THREE.Vector3,
  camera: THREE.Camera
): number {
  const cameraPos = camera.position.clone();
  return position.distanceTo(cameraPos);
}

/**
 * Sort objects by depth (back to front for transparency)
 */
export function sortByDepth(
  objects: THREE.Object3D[],
  camera: THREE.Camera
): THREE.Object3D[] {
  return objects.sort((a, b) => {
    const depthA = calculateDepthFromCamera(a.position, camera);
    const depthB = calculateDepthFromCamera(b.position, camera);
    return depthB - depthA; // Back to front
  });
}

/**
 * Update render orders dynamically based on camera depth
 * This ensures proper occlusion when limbs overlap
 */
export function updateRenderOrdersByDepth(
  objects: THREE.Object3D[],
  camera: THREE.Camera,
  baseOrder: number = 100
): void {
  // Calculate depths for all objects
  const objectsWithDepth = objects.map((obj) => ({
    object: obj,
    depth: calculateDepthFromCamera(obj.position, camera),
  }));

  // Sort by depth (farthest to nearest)
  objectsWithDepth.sort((a, b) => b.depth - a.depth);

  // Assign render orders (farthest gets lowest order, nearest gets highest)
  objectsWithDepth.forEach((item, index) => {
    item.object.renderOrder = baseOrder + index;
  });
}

/**
 * Create ambient occlusion shadow at limb intersection point
 */
export function createIntersectionShadow(
  pos1: THREE.Vector3,
  pos2: THREE.Vector3,
  distance: number,
  maxDistance: number = 0.15
): THREE.Mesh | null {
  if (distance > maxDistance) return null;

  // Calculate shadow intensity based on proximity (closer = darker)
  const intensity = 1 - distance / maxDistance;
  const opacity = intensity * 0.6; // Max 60% opacity for better visibility

  // Calculate midpoint between intersecting limbs
  const midpoint = new THREE.Vector3().lerpVectors(pos1, pos2, 0.5);

  // Create spherical ambient occlusion shadow
  const shadowRadius = 0.04 + (1 - intensity) * 0.02; // Larger when further apart
  const geometry = new THREE.SphereGeometry(shadowRadius, 16, 16);

  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.MultiplyBlending, // Darker blending for shadows
  });

  const shadow = new THREE.Mesh(geometry, material);
  shadow.position.copy(midpoint);
  shadow.renderOrder = -10; // Render before everything else

  return shadow;
}
