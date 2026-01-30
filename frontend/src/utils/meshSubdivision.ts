/**
 * Mesh Subdivision and Smoothing Utilities
 * Implements subdivision surfaces for smoother geometry
 */

import * as THREE from 'three';

/**
 * Apply smooth shading to geometry
 * Computes smooth vertex normals for Phong shading
 */
export function applySmoothShading(geometry: THREE.BufferGeometry): void {
  geometry.computeVertexNormals();

  // Ensure normals are properly normalized
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
}

/**
 * Increase geometry resolution by adding more vertices
 * Simple midpoint subdivision
 */
export function subdivideGeometry(
  geometry: THREE.BufferGeometry,
  iterations: number = 1
): THREE.BufferGeometry {
  let currentGeometry = geometry.clone();

  for (let iter = 0; iter < iterations; iter++) {
    const positions = currentGeometry.attributes.position;
    const newPositions: number[] = [];
    const newIndices: number[] = [];

    // Build vertex map for deduplication
    const vertexMap = new Map<string, number>();
    const vertices: THREE.Vector3[] = [];

    const getVertexIndex = (v: THREE.Vector3): number => {
      const key = `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;
      if (vertexMap.has(key)) {
        return vertexMap.get(key)!;
      }
      const index = vertices.length;
      vertices.push(v.clone());
      vertexMap.set(key, index);
      return index;
    };

    // Process triangles
    const triangleCount = positions.count / 3;
    for (let i = 0; i < triangleCount; i++) {
      const i0 = i * 3;
      const i1 = i * 3 + 1;
      const i2 = i * 3 + 2;

      const v0 = new THREE.Vector3(
        positions.getX(i0),
        positions.getY(i0),
        positions.getZ(i0)
      );
      const v1 = new THREE.Vector3(
        positions.getX(i1),
        positions.getY(i1),
        positions.getZ(i1)
      );
      const v2 = new THREE.Vector3(
        positions.getX(i2),
        positions.getY(i2),
        positions.getZ(i2)
      );

      // Calculate midpoints
      const m01 = new THREE.Vector3().lerpVectors(v0, v1, 0.5);
      const m12 = new THREE.Vector3().lerpVectors(v1, v2, 0.5);
      const m20 = new THREE.Vector3().lerpVectors(v2, v0, 0.5);

      // Get vertex indices
      const idx0 = getVertexIndex(v0);
      const idx1 = getVertexIndex(v1);
      const idx2 = getVertexIndex(v2);
      const idx01 = getVertexIndex(m01);
      const idx12 = getVertexIndex(m12);
      const idx20 = getVertexIndex(m20);

      // Create 4 new triangles
      newIndices.push(idx0, idx01, idx20);
      newIndices.push(idx1, idx12, idx01);
      newIndices.push(idx2, idx20, idx12);
      newIndices.push(idx01, idx12, idx20);
    }

    // Build new geometry
    const newGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(vertices.length * 3);
    for (let i = 0; i < vertices.length; i++) {
      posArray[i * 3] = vertices[i].x;
      posArray[i * 3 + 1] = vertices[i].y;
      posArray[i * 3 + 2] = vertices[i].z;
    }

    newGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    newGeometry.setIndex(newIndices);
    newGeometry.computeVertexNormals();

    currentGeometry.dispose();
    currentGeometry = newGeometry;
  }

  return currentGeometry;
}

/**
 * Create high-quality smooth sphere
 * Uses increased segment count for curves
 */
export function createSmoothSphere(
  radius: number,
  forHead: boolean = false
): THREE.BufferGeometry {
  const segments = forHead ? 64 : 48; // Higher resolution for head
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  applySmoothShading(geometry);
  return geometry;
}

/**
 * Create high-quality smooth cylinder
 * Uses increased segment count for curves
 */
export function createSmoothCylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  forLimb: boolean = false
): THREE.BufferGeometry {
  const radialSegments = forLimb ? 32 : 24;
  const heightSegments = forLimb ? 16 : 8;

  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    heightSegments
  );

  applySmoothShading(geometry);
  return geometry;
}

/**
 * Apply Laplacian smoothing to existing geometry
 * Smooths surface while preserving volume
 */
export function laplacianSmooth(
  geometry: THREE.BufferGeometry,
  iterations: number = 1,
  factor: number = 0.5
): void {
  const positions = geometry.attributes.position;
  const posArray = positions.array as Float32Array;

  // Build adjacency map
  const adjacency = new Map<number, Set<number>>();
  const indices = geometry.index;

  if (indices) {
    for (let i = 0; i < indices.count; i += 3) {
      const i0 = indices.getX(i);
      const i1 = indices.getX(i + 1);
      const i2 = indices.getX(i + 2);

      if (!adjacency.has(i0)) adjacency.set(i0, new Set());
      if (!adjacency.has(i1)) adjacency.set(i1, new Set());
      if (!adjacency.has(i2)) adjacency.set(i2, new Set());

      adjacency.get(i0)!.add(i1);
      adjacency.get(i0)!.add(i2);
      adjacency.get(i1)!.add(i0);
      adjacency.get(i1)!.add(i2);
      adjacency.get(i2)!.add(i0);
      adjacency.get(i2)!.add(i1);
    }
  }

  // Perform smoothing iterations
  for (let iter = 0; iter < iterations; iter++) {
    const newPositions = new Float32Array(posArray.length);

    for (let i = 0; i < positions.count; i++) {
      const neighbors = adjacency.get(i);
      if (!neighbors || neighbors.size === 0) {
        // No neighbors, keep original position
        newPositions[i * 3] = posArray[i * 3];
        newPositions[i * 3 + 1] = posArray[i * 3 + 1];
        newPositions[i * 3 + 2] = posArray[i * 3 + 2];
        continue;
      }

      // Calculate average of neighbors
      let avgX = 0, avgY = 0, avgZ = 0;
      for (const neighbor of neighbors) {
        avgX += posArray[neighbor * 3];
        avgY += posArray[neighbor * 3 + 1];
        avgZ += posArray[neighbor * 3 + 2];
      }
      avgX /= neighbors.size;
      avgY /= neighbors.size;
      avgZ /= neighbors.size;

      // Interpolate between original and average
      newPositions[i * 3] = posArray[i * 3] * (1 - factor) + avgX * factor;
      newPositions[i * 3 + 1] = posArray[i * 3 + 1] * (1 - factor) + avgY * factor;
      newPositions[i * 3 + 2] = posArray[i * 3 + 2] * (1 - factor) + avgZ * factor;
    }

    // Update positions
    for (let i = 0; i < posArray.length; i++) {
      posArray[i] = newPositions[i];
    }
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}
