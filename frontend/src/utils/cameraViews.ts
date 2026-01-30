/**
 * Camera View System
 * Manages perspective/orthographic camera modes and view presets
 */

import * as THREE from 'three';

/**
 * Camera mode types
 */
export type CameraMode = 'perspective' | 'orthographic';

/**
 * View preset types
 */
export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'isometric';

/**
 * Camera view configuration
 */
export interface CameraViewConfig {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
}

/**
 * Get camera configuration for a view preset
 */
export function getViewPresetConfig(preset: ViewPreset, distance: number = 2.0): CameraViewConfig {
  const target = new THREE.Vector3(0, 0.5, 0); // Center of body

  switch (preset) {
    case 'front':
      return {
        position: new THREE.Vector3(0, 0.5, distance),
        target: target,
        up: new THREE.Vector3(0, 1, 0),
      };

    case 'back':
      return {
        position: new THREE.Vector3(0, 0.5, -distance),
        target: target,
        up: new THREE.Vector3(0, 1, 0),
      };

    case 'left':
      return {
        position: new THREE.Vector3(-distance, 0.5, 0),
        target: target,
        up: new THREE.Vector3(0, 1, 0),
      };

    case 'right':
      return {
        position: new THREE.Vector3(distance, 0.5, 0),
        target: target,
        up: new THREE.Vector3(0, 1, 0),
      };

    case 'top':
      return {
        position: new THREE.Vector3(0, distance + 0.5, 0),
        target: target,
        up: new THREE.Vector3(0, 0, -1), // Z-axis points up in top view
      };

    case 'bottom':
      return {
        position: new THREE.Vector3(0, -distance + 0.5, 0),
        target: target,
        up: new THREE.Vector3(0, 0, 1),
      };

    case 'isometric':
      const iso = distance / Math.sqrt(3);
      return {
        position: new THREE.Vector3(iso, iso + 0.5, iso),
        target: target,
        up: new THREE.Vector3(0, 1, 0),
      };

    default:
      return getViewPresetConfig('front', distance);
  }
}

/**
 * Create orthographic camera from perspective camera
 */
export function createOrthographicCamera(
  perspectiveCamera: THREE.PerspectiveCamera,
  frustumSize: number = 1.5
): THREE.OrthographicCamera {
  const aspect = perspectiveCamera.aspect;
  const halfHeight = frustumSize / 2;
  const halfWidth = halfHeight * aspect;

  const orthoCamera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    1000
  );

  // Copy position and rotation from perspective camera
  orthoCamera.position.copy(perspectiveCamera.position);
  orthoCamera.rotation.copy(perspectiveCamera.rotation);
  orthoCamera.up.copy(perspectiveCamera.up);

  return orthoCamera;
}

/**
 * Update orthographic camera frustum on resize
 */
export function updateOrthographicFrustum(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  frustumSize: number = 1.5
): void {
  const aspect = width / height;
  const halfHeight = frustumSize / 2;
  const halfWidth = halfHeight * aspect;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;

  camera.updateProjectionMatrix();
}

/**
 * Apply view preset to camera and controls
 */
export function applyViewPreset(
  camera: THREE.Camera,
  controls: any, // OrbitControls
  preset: ViewPreset,
  distance: number = 2.0,
  animate: boolean = true
): void {
  const config = getViewPresetConfig(preset, distance);

  if (animate) {
    // Smooth animation would require GSAP or similar
    // For now, just set directly
    camera.position.copy(config.position);
    camera.up.copy(config.up);
    controls.target.copy(config.target);
  } else {
    camera.position.copy(config.position);
    camera.up.copy(config.up);
    controls.target.copy(config.target);
  }

  controls.update();
}

/**
 * Get zoom level for orthographic camera based on frustum size
 */
export function getOrthoZoomLevel(frustumSize: number): number {
  // Inverse relationship: smaller frustum = more zoomed in
  return 1.5 / frustumSize;
}

/**
 * Set zoom level for orthographic camera
 */
export function setOrthoZoomLevel(
  camera: THREE.OrthographicCamera,
  zoomLevel: number,
  width: number,
  height: number
): void {
  const frustumSize = 1.5 / zoomLevel;
  updateOrthographicFrustum(camera, width, height, frustumSize);
}

/**
 * Get camera mode description
 */
export function getCameraModeDescription(mode: CameraMode): string {
  switch (mode) {
    case 'perspective':
      return 'Perspective - Natural depth perception with vanishing points';
    case 'orthographic':
      return 'Orthographic - Parallel projection for precise measurements';
    default:
      return 'Unknown camera mode';
  }
}

/**
 * Get view preset description
 */
export function getViewPresetDescription(preset: ViewPreset): string {
  switch (preset) {
    case 'front':
      return 'Front view - Face forward (XY plane)';
    case 'back':
      return 'Back view - From behind';
    case 'left':
      return 'Left side view - From left (YZ plane)';
    case 'right':
      return 'Right side view - From right (YZ plane)';
    case 'top':
      return 'Top view - From above (XZ plane)';
    case 'bottom':
      return 'Bottom view - From below';
    case 'isometric':
      return 'Isometric view - 3D perspective at 45°';
    default:
      return 'Unknown view';
  }
}

/**
 * Calculate optimal frustum size for scene bounds
 */
export function calculateOptimalFrustumSize(sceneBounds: THREE.Box3): number {
  const size = new THREE.Vector3();
  sceneBounds.getSize(size);

  // Use the larger dimension with some padding
  const maxDimension = Math.max(size.x, size.y, size.z);
  return maxDimension * 1.2; // 20% padding
}

/**
 * Align camera to nearest axis
 */
export function alignCameraToAxis(
  camera: THREE.Camera,
  controls: any
): ViewPreset | null {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  // Check which axis is closest
  const axes = [
    { preset: 'front' as ViewPreset, dir: new THREE.Vector3(0, 0, -1) },
    { preset: 'back' as ViewPreset, dir: new THREE.Vector3(0, 0, 1) },
    { preset: 'left' as ViewPreset, dir: new THREE.Vector3(1, 0, 0) },
    { preset: 'right' as ViewPreset, dir: new THREE.Vector3(-1, 0, 0) },
    { preset: 'top' as ViewPreset, dir: new THREE.Vector3(0, -1, 0) },
    { preset: 'bottom' as ViewPreset, dir: new THREE.Vector3(0, 1, 0) },
  ];

  let closestPreset: ViewPreset | null = null;
  let maxDot = -Infinity;

  for (const axis of axes) {
    const dot = direction.dot(axis.dir);
    if (dot > maxDot) {
      maxDot = dot;
      closestPreset = axis.preset;
    }
  }

  // Only align if reasonably close (within 15 degrees)
  if (maxDot > Math.cos(THREE.MathUtils.degToRad(15)) && closestPreset) {
    applyViewPreset(camera, controls, closestPreset, camera.position.distanceTo(controls.target), false);
    return closestPreset;
  }

  return null;
}

/**
 * Toggle between perspective and orthographic
 */
export function toggleCameraMode(
  currentMode: CameraMode,
  perspectiveCamera: THREE.PerspectiveCamera,
  orthographicCamera: THREE.OrthographicCamera | null,
  width: number,
  height: number,
  frustumSize: number = 1.5
): {
  newMode: CameraMode;
  camera: THREE.Camera;
  orthoCamera: THREE.OrthographicCamera | null;
} {
  if (currentMode === 'perspective') {
    // Switch to orthographic
    let orthoCamera = orthographicCamera;

    if (!orthoCamera) {
      orthoCamera = createOrthographicCamera(perspectiveCamera, frustumSize);
    } else {
      // Update position to match perspective camera
      orthoCamera.position.copy(perspectiveCamera.position);
      orthoCamera.rotation.copy(perspectiveCamera.rotation);
      orthoCamera.up.copy(perspectiveCamera.up);
      updateOrthographicFrustum(orthoCamera, width, height, frustumSize);
    }

    return {
      newMode: 'orthographic',
      camera: orthoCamera,
      orthoCamera: orthoCamera,
    };
  } else {
    // Switch to perspective
    perspectiveCamera.position.copy(orthographicCamera!.position);
    perspectiveCamera.rotation.copy(orthographicCamera!.rotation);
    perspectiveCamera.up.copy(orthographicCamera!.up);
    perspectiveCamera.updateProjectionMatrix();

    return {
      newMode: 'perspective',
      camera: perspectiveCamera,
      orthoCamera: orthographicCamera,
    };
  }
}
