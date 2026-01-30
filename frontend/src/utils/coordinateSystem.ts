/**
 * Coordinate System and Grid Utilities
 * Creates axes, grids, and reference planes for spatial orientation
 */

import * as THREE from 'three';

/**
 * Create 3D coordinate axes with labels
 */
export function createCoordinateAxes(size: number = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.name = 'coordinate_axes';

  // X Axis (Red) - Right
  const xGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(size, 0, 0),
  ]);
  const xMaterial = new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 2 });
  const xAxis = new THREE.Line(xGeometry, xMaterial);
  group.add(xAxis);

  // Add arrow cone for X
  const xArrowGeometry = new THREE.ConeGeometry(0.02, 0.06, 8);
  const xArrowMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
  const xArrow = new THREE.Mesh(xArrowGeometry, xArrowMaterial);
  xArrow.position.set(size, 0, 0);
  xArrow.rotation.z = -Math.PI / 2;
  group.add(xArrow);

  // Y Axis (Green) - Up
  const yGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, size, 0),
  ]);
  const yMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00, linewidth: 2 });
  const yAxis = new THREE.Line(yGeometry, yMaterial);
  group.add(yAxis);

  // Add arrow cone for Y
  const yArrowGeometry = new THREE.ConeGeometry(0.02, 0.06, 8);
  const yArrowMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
  const yArrow = new THREE.Mesh(yArrowGeometry, yArrowMaterial);
  yArrow.position.set(0, size, 0);
  group.add(yArrow);

  // Z Axis (Blue) - Forward
  const zGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, size),
  ]);
  const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 2 });
  const zAxis = new THREE.Line(zGeometry, zMaterial);
  group.add(zAxis);

  // Add arrow cone for Z
  const zArrowGeometry = new THREE.ConeGeometry(0.02, 0.06, 8);
  const zArrowMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF });
  const zArrow = new THREE.Mesh(zArrowGeometry, zArrowMaterial);
  zArrow.position.set(0, 0, size);
  zArrow.rotation.x = Math.PI / 2;
  group.add(zArrow);

  // Add axis labels
  const xLabel = createAxisLabel('X', 0xFF0000);
  xLabel.position.set(size + 0.1, 0, 0);
  group.add(xLabel);

  const yLabel = createAxisLabel('Y', 0x00FF00);
  yLabel.position.set(0, size + 0.1, 0);
  group.add(yLabel);

  const zLabel = createAxisLabel('Z', 0x0000FF);
  zLabel.position.set(0, 0, size + 0.1);
  group.add(zLabel);

  return group;
}

/**
 * Create axis label sprite
 */
function createAxisLabel(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = 64;
  canvas.height = 64;

  // Clear
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Text
  context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.font = 'bold 48px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create sprite
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.1, 0.1, 1);

  return sprite;
}

/**
 * Create enhanced grid helper with custom styling
 */
export function createEnhancedGrid(
  size: number = 2,
  divisions: number = 20,
  centerColor: number = 0x444444,
  gridColor: number = 0x222222
): THREE.GridHelper {
  const grid = new THREE.GridHelper(size, divisions, centerColor, gridColor);
  grid.position.y = -0.05; // Slightly below ground level
  grid.name = 'floor_grid';

  return grid;
}

/**
 * Create XZ floor plane with transparency
 */
export function createFloorPlane(size: number = 2, opacity: number = 0.1): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({
    color: 0x333333,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
  });

  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2; // Rotate to horizontal
  plane.position.y = -0.06; // Below grid
  plane.name = 'floor_plane';

  return plane;
}

/**
 * Create vertical grid wall for better depth perception
 */
export function createVerticalGrid(
  width: number = 2,
  height: number = 2,
  divisions: number = 10,
  color: number = 0x1a1a1a,
  position: 'back' | 'left' | 'right' = 'back'
): THREE.Group {
  const group = new THREE.Group();
  group.name = `vertical_grid_${position}`;

  // Create grid lines
  const segmentWidth = width / divisions;
  const segmentHeight = height / divisions;

  // Horizontal lines
  for (let i = 0; i <= divisions; i++) {
    const y = (i * segmentHeight) - height / 2;
    const points = [
      new THREE.Vector3(-width / 2, y, 0),
      new THREE.Vector3(width / 2, y, 0),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
    });
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }

  // Vertical lines
  for (let i = 0; i <= divisions; i++) {
    const x = (i * segmentWidth) - width / 2;
    const points = [
      new THREE.Vector3(x, -height / 2, 0),
      new THREE.Vector3(x, height / 2, 0),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
    });
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }

  // Position based on wall location
  switch (position) {
    case 'back':
      group.position.set(0, height / 2, -width / 2);
      break;
    case 'left':
      group.position.set(-width / 2, height / 2, 0);
      group.rotation.y = Math.PI / 2;
      break;
    case 'right':
      group.position.set(width / 2, height / 2, 0);
      group.rotation.y = -Math.PI / 2;
      break;
  }

  return group;
}

/**
 * Create origin marker (small sphere at 0,0,0)
 */
export function createOriginMarker(size: number = 0.03): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(size, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.8,
  });

  const marker = new THREE.Mesh(geometry, material);
  marker.name = 'origin_marker';

  return marker;
}

/**
 * Create measurement grid with labeled increments
 */
export function createMeasurementGrid(size: number = 2, increment: number = 0.2): THREE.Group {
  const group = new THREE.Group();
  group.name = 'measurement_grid';

  const divisions = size / increment;
  const halfSize = size / 2;

  // Create major and minor grid lines
  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    const pos = i * increment;
    const isMajor = i % 5 === 0; // Every 5th line is major

    // X-direction lines
    const xPoints = [
      new THREE.Vector3(pos, 0, -halfSize),
      new THREE.Vector3(pos, 0, halfSize),
    ];
    const xGeometry = new THREE.BufferGeometry().setFromPoints(xPoints);
    const xMaterial = new THREE.LineBasicMaterial({
      color: isMajor ? 0x444444 : 0x222222,
      transparent: true,
      opacity: isMajor ? 0.5 : 0.3,
    });
    const xLine = new THREE.Line(xGeometry, xMaterial);
    group.add(xLine);

    // Z-direction lines
    const zPoints = [
      new THREE.Vector3(-halfSize, 0, pos),
      new THREE.Vector3(halfSize, 0, pos),
    ];
    const zGeometry = new THREE.BufferGeometry().setFromPoints(zPoints);
    const zMaterial = new THREE.LineBasicMaterial({
      color: isMajor ? 0x444444 : 0x222222,
      transparent: true,
      opacity: isMajor ? 0.5 : 0.3,
    });
    const zLine = new THREE.Line(zGeometry, zMaterial);
    group.add(zLine);

    // Add labels for major lines
    if (isMajor && i !== 0) {
      const label = createGridLabel(`${Math.abs(pos).toFixed(1)}m`);
      label.position.set(pos, 0.01, -halfSize - 0.1);
      group.add(label);
    }
  }

  group.position.y = -0.05;
  return group;
}

/**
 * Create grid label sprite
 */
function createGridLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = 128;
  canvas.height = 32;

  // Clear
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Text
  context.fillStyle = '#888888';
  context.font = '20px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create sprite
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.15, 0.04, 1);

  return sprite;
}

/**
 * Create bounding box visualization
 */
export function createBoundingBox(min: THREE.Vector3, max: THREE.Vector3): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    // Bottom face
    min.x, min.y, min.z, max.x, min.y, min.z,
    max.x, min.y, min.z, max.x, min.y, max.z,
    max.x, min.y, max.z, min.x, min.y, max.z,
    min.x, min.y, max.z, min.x, min.y, min.z,
    // Top face
    min.x, max.y, min.z, max.x, max.y, min.z,
    max.x, max.y, min.z, max.x, max.y, max.z,
    max.x, max.y, max.z, min.x, max.y, max.z,
    min.x, max.y, max.z, min.x, max.y, min.z,
    // Vertical edges
    min.x, min.y, min.z, min.x, max.y, min.z,
    max.x, min.y, min.z, max.x, max.y, min.z,
    max.x, min.y, max.z, max.x, max.y, max.z,
    min.x, min.y, max.z, min.x, max.y, max.z,
  ]);

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0x00FFFF,
    transparent: true,
    opacity: 0.5,
  });

  const box = new THREE.LineSegments(geometry, material);
  box.name = 'bounding_box';

  return box;
}
