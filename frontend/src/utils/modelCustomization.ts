/**
 * Model Customization System
 * Handles visualization modes and material customization
 */

import * as THREE from 'three';

/**
 * Visualization modes
 */
export type VisualizationMode = 'solid' | 'wireframe' | 'skeleton' | 'transparent';

/**
 * Model customization settings
 */
export interface ModelCustomization {
  visualizationMode: VisualizationMode;
  baseColor: string;
  transparency: number; // 0-100
  metalness: number; // 0-100
  roughness: number; // 0-100
  modelScale: number; // 0.5-2.0
  showJoints: boolean;
  showBones: boolean;
  showMesh: boolean;
  jointSize: number; // 0.5-2.0
}

/**
 * Default customization settings
 */
export const defaultCustomization: ModelCustomization = {
  visualizationMode: 'solid',
  baseColor: '#A78BFA',
  transparency: 0,
  metalness: 8,
  roughness: 55,
  modelScale: 1.0,
  showJoints: true,
  showBones: true,
  showMesh: true,
  jointSize: 1.0,
};

/**
 * Apply visualization mode to a mesh
 */
export function applyVisualizationMode(
  mesh: THREE.Mesh,
  mode: VisualizationMode
): void {
  if (!mesh.material) return;

  const material = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;

  switch (mode) {
    case 'solid':
      material.wireframe = false;
      material.transparent = false;
      material.opacity = 1.0;
      material.visible = true;
      break;

    case 'wireframe':
      material.wireframe = true;
      material.transparent = false;
      material.opacity = 1.0;
      material.visible = true;
      break;

    case 'skeleton':
      // Hide mesh, show only joints and bones
      material.visible = false;
      break;

    case 'transparent':
      material.wireframe = false;
      material.transparent = true;
      material.opacity = 0.3;
      material.visible = true;
      break;
  }

  material.needsUpdate = true;
}

/**
 * Apply custom color to material
 */
export function applyCustomColor(
  material: THREE.Material,
  colorHex: string
): void {
  if ('color' in material) {
    (material as any).color = new THREE.Color(colorHex);
  }
  material.needsUpdate = true;
}

/**
 * Apply custom transparency
 */
export function applyCustomTransparency(
  material: THREE.Material,
  transparency: number // 0-100
): void {
  const opacity = 1 - (transparency / 100);

  if ('opacity' in material) {
    (material as any).transparent = transparency > 0;
    (material as any).opacity = opacity;
  }
  material.needsUpdate = true;
}

/**
 * Apply custom material properties
 */
export function applyCustomMaterial(
  material: THREE.Material,
  metalness: number, // 0-100
  roughness: number  // 0-100
): void {
  if (material instanceof THREE.MeshStandardMaterial) {
    material.metalness = metalness / 100;
    material.roughness = roughness / 100;
  }
  material.needsUpdate = true;
}

/**
 * Apply scale to object
 */
export function applyModelScale(
  object: THREE.Object3D,
  scale: number
): void {
  object.scale.set(scale, scale, scale);
}

/**
 * Apply all customizations to a scene
 */
export function applyCustomizationToScene(
  scene: THREE.Scene,
  customization: ModelCustomization,
  skeletonGroup: THREE.Group | null,
  muscleGroup: THREE.Group | null
): void {
  // Apply to skeleton group
  if (skeletonGroup) {
    skeletonGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        applyVisualizationMode(child, customization.visualizationMode);

        if (customization.visualizationMode !== 'skeleton') {
          applyCustomColor(child.material, customization.baseColor);
          applyCustomTransparency(child.material, customization.transparency);
          applyCustomMaterial(
            child.material,
            customization.metalness,
            customization.roughness
          );
        }
      }
    });

    // Apply scale
    applyModelScale(skeletonGroup, customization.modelScale);

    // Show/hide based on settings
    skeletonGroup.visible = customization.showMesh || customization.visualizationMode === 'skeleton';
  }

  // Apply to muscle group
  if (muscleGroup) {
    muscleGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (customization.visualizationMode === 'skeleton') {
          child.visible = false;
        }
      }
    });
  }
}

/**
 * Toggle joint visibility in scene
 */
export function toggleJointVisibility(
  skeletonGroup: THREE.Group | null,
  visible: boolean
): void {
  if (!skeletonGroup) return;

  skeletonGroup.traverse((child) => {
    // Check if it's a joint sphere (typically smaller spheres)
    if (child instanceof THREE.Mesh) {
      const geometry = child.geometry;
      if (geometry instanceof THREE.SphereGeometry) {
        // Identify joints by checking if they're part of joint group names
        if (child.name.includes('joint') || child.parent?.name.includes('joint')) {
          child.visible = visible;
        }
      }
    }
  });
}

/**
 * Create wireframe overlay for a mesh
 */
export function createWireframeOverlay(
  geometry: THREE.BufferGeometry,
  color: number = 0x000000
): THREE.LineSegments {
  const wireframeGeometry = new THREE.WireframeGeometry(geometry);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 1,
    transparent: true,
    opacity: 0.5,
  });

  return new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
}

/**
 * Get visualization mode description
 */
export function getVisualizationModeDescription(mode: VisualizationMode): string {
  switch (mode) {
    case 'solid':
      return 'Full 3D model with solid surfaces';
    case 'wireframe':
      return 'Wireframe view showing mesh structure';
    case 'skeleton':
      return 'Bones and joints only';
    case 'transparent':
      return 'Semi-transparent view for depth perception';
    default:
      return 'Unknown mode';
  }
}
