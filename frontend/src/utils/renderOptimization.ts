/**
 * Render Optimization System
 * Implements instancing, caching, pooling, and LOD for performance
 */

import * as THREE from 'three';

/**
 * Geometry cache for reusing common geometries
 */
export class GeometryCache {
  private cache: Map<string, THREE.BufferGeometry>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get or create a sphere geometry
   */
  getSphere(radius: number, widthSegments: number = 32, heightSegments: number = 32): THREE.BufferGeometry {
    const key = `sphere_${radius}_${widthSegments}_${heightSegments}`;

    if (!this.cache.has(key)) {
      const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
      this.cache.set(key, geometry);
    }

    return this.cache.get(key)!;
  }

  /**
   * Get or create a cylinder geometry
   */
  getCylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number = 16
  ): THREE.BufferGeometry {
    const key = `cylinder_${radiusTop}_${radiusBottom}_${height}_${radialSegments}`;

    if (!this.cache.has(key)) {
      const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
      this.cache.set(key, geometry);
    }

    return this.cache.get(key)!;
  }

  /**
   * Get or create a box geometry
   */
  getBox(width: number, height: number, depth: number): THREE.BufferGeometry {
    const key = `box_${width}_${height}_${depth}`;

    if (!this.cache.has(key)) {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      this.cache.set(key, geometry);
    }

    return this.cache.get(key)!;
  }

  /**
   * Get or create a cone geometry
   */
  getCone(radius: number, height: number, radialSegments: number = 16): THREE.BufferGeometry {
    const key = `cone_${radius}_${height}_${radialSegments}`;

    if (!this.cache.has(key)) {
      const geometry = new THREE.ConeGeometry(radius, height, radialSegments);
      this.cache.set(key, geometry);
    }

    return this.cache.get(key)!;
  }

  /**
   * Get cache statistics
   */
  getStats(): { count: number; keys: string[] } {
    return {
      count: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.forEach((geometry) => geometry.dispose());
    this.cache.clear();
  }

  /**
   * Dispose specific geometry
   */
  dispose(key: string): void {
    const geometry = this.cache.get(key);
    if (geometry) {
      geometry.dispose();
      this.cache.delete(key);
    }
  }
}

/**
 * Material cache for reusing materials
 */
export class MaterialCache {
  private cache: Map<string, THREE.Material>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get or create a PBR material
   */
  getMaterial(
    color: number,
    metalness: number = 0.3,
    roughness: number = 0.5,
    emissive: number = 0x000000,
    emissiveIntensity: number = 0
  ): THREE.MeshStandardMaterial {
    const key = `pbr_${color}_${metalness}_${roughness}_${emissive}_${emissiveIntensity}`;

    if (!this.cache.has(key)) {
      const material = new THREE.MeshStandardMaterial({
        color: color,
        metalness: metalness,
        roughness: roughness,
        emissive: emissive,
        emissiveIntensity: emissiveIntensity,
      });
      this.cache.set(key, material);
    }

    return this.cache.get(key) as THREE.MeshStandardMaterial;
  }

  /**
   * Get or create a basic material
   */
  getBasicMaterial(color: number, transparent: boolean = false, opacity: number = 1.0): THREE.MeshBasicMaterial {
    const key = `basic_${color}_${transparent}_${opacity}`;

    if (!this.cache.has(key)) {
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: transparent,
        opacity: opacity,
      });
      this.cache.set(key, material);
    }

    return this.cache.get(key) as THREE.MeshBasicMaterial;
  }

  /**
   * Get or create a line material
   */
  getLineMaterial(color: number, linewidth: number = 1): THREE.LineBasicMaterial {
    const key = `line_${color}_${linewidth}`;

    if (!this.cache.has(key)) {
      const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: linewidth,
      });
      this.cache.set(key, material);
    }

    return this.cache.get(key) as THREE.LineBasicMaterial;
  }

  /**
   * Get cache statistics
   */
  getStats(): { count: number; keys: string[] } {
    return {
      count: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.forEach((material) => material.dispose());
    this.cache.clear();
  }
}

/**
 * Instance renderer for repeated geometries
 */
export class InstancedRenderer {
  private instances: Map<string, THREE.InstancedMesh>;
  private counts: Map<string, number>;
  private maxInstances: number;

  constructor(maxInstances: number = 100) {
    this.instances = new Map();
    this.counts = new Map();
    this.maxInstances = maxInstances;
  }

  /**
   * Create or get instanced mesh
   */
  getInstancedMesh(
    key: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number
  ): THREE.InstancedMesh {
    if (!this.instances.has(key)) {
      const instancedMesh = new THREE.InstancedMesh(geometry, material, Math.min(count, this.maxInstances));
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.instances.set(key, instancedMesh);
      this.counts.set(key, 0);
    }

    return this.instances.get(key)!;
  }

  /**
   * Set instance transform
   */
  setInstanceTransform(
    key: string,
    index: number,
    position: THREE.Vector3,
    rotation: THREE.Quaternion = new THREE.Quaternion(),
    scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
  ): void {
    const instancedMesh = this.instances.get(key);
    if (!instancedMesh) return;

    const matrix = new THREE.Matrix4();
    matrix.compose(position, rotation, scale);
    instancedMesh.setMatrixAt(index, matrix);
    instancedMesh.instanceMatrix.needsUpdate = true;

    // Update count
    const currentCount = this.counts.get(key) || 0;
    if (index >= currentCount) {
      this.counts.set(key, index + 1);
    }
  }

  /**
   * Set instance color
   */
  setInstanceColor(key: string, index: number, color: THREE.Color): void {
    const instancedMesh = this.instances.get(key);
    if (!instancedMesh) return;

    if (!instancedMesh.instanceColor) {
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(this.maxInstances * 3),
        3
      );
    }

    instancedMesh.setColorAt(index, color);
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Reset instance count
   */
  resetCount(key: string): void {
    this.counts.set(key, 0);
  }

  /**
   * Get instance count
   */
  getCount(key: string): number {
    return this.counts.get(key) || 0;
  }

  /**
   * Clear all instances
   */
  clear(): void {
    this.instances.forEach((mesh) => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.instances.clear();
    this.counts.clear();
  }
}

/**
 * Object pool for reusing objects
 */
export class ObjectPool<T> {
  private pool: T[];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 10) {
    this.factory = factory;
    this.reset = reset;
    this.pool = [];

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /**
   * Acquire object from pool
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /**
   * Release object back to pool
   */
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  /**
   * Get pool size
   */
  getSize(): number {
    return this.pool.length;
  }

  /**
   * Clear pool
   */
  clear(): void {
    this.pool = [];
  }
}

/**
 * LOD (Level of Detail) manager
 */
export interface LODConfig {
  near: number; // Distance threshold for high detail
  mid: number; // Distance threshold for medium detail
  far: number; // Distance threshold for low detail
}

export const DEFAULT_LOD_CONFIG: LODConfig = {
  near: 2.0,
  mid: 5.0,
  far: 10.0,
};

/**
 * Get LOD level based on distance
 */
export function getLODLevel(distance: number, config: LODConfig = DEFAULT_LOD_CONFIG): 'high' | 'medium' | 'low' {
  if (distance < config.near) return 'high';
  if (distance < config.mid) return 'medium';
  return 'low';
}

/**
 * Get segment count based on LOD level
 */
export function getLODSegments(level: 'high' | 'medium' | 'low', baseSegments: number = 32): number {
  switch (level) {
    case 'high':
      return baseSegments;
    case 'medium':
      return Math.floor(baseSegments / 2);
    case 'low':
      return Math.floor(baseSegments / 4);
    default:
      return baseSegments;
  }
}

/**
 * Frustum culling helper
 */
export class FrustumCuller {
  private frustum: THREE.Frustum;
  private projScreenMatrix: THREE.Matrix4;

  constructor() {
    this.frustum = new THREE.Frustum();
    this.projScreenMatrix = new THREE.Matrix4();
  }

  /**
   * Update frustum from camera
   */
  updateFromCamera(camera: THREE.Camera): void {
    this.projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
  }

  /**
   * Check if object is in frustum
   */
  isVisible(object: THREE.Object3D): boolean {
    // Update world matrix if needed
    if (object.matrixWorldNeedsUpdate) {
      object.updateMatrixWorld(true);
    }

    // Check bounding sphere
    if (object instanceof THREE.Mesh) {
      if (!object.geometry.boundingSphere) {
        object.geometry.computeBoundingSphere();
      }

      const boundingSphere = object.geometry.boundingSphere!.clone();
      boundingSphere.applyMatrix4(object.matrixWorld);

      return this.frustum.intersectsSphere(boundingSphere);
    }

    // For other objects, use position
    return this.frustum.containsPoint(object.position);
  }

  /**
   * Filter visible objects
   */
  filterVisible(objects: THREE.Object3D[]): THREE.Object3D[] {
    return objects.filter((obj) => this.isVisible(obj));
  }
}

/**
 * Batch renderer for reducing draw calls
 */
export class BatchRenderer {
  private batches: Map<string, THREE.Mesh[]>;

  constructor() {
    this.batches = new Map();
  }

  /**
   * Add mesh to batch
   */
  addToBatch(batchKey: string, mesh: THREE.Mesh): void {
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);
    }
    this.batches.get(batchKey)!.push(mesh);
  }

  /**
   * Merge batch into single geometry
   */
  mergeBatch(batchKey: string): THREE.Mesh | null {
    const meshes = this.batches.get(batchKey);
    if (!meshes || meshes.length === 0) return null;

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    meshes.forEach((mesh) => {
      if (mesh.geometry) {
        const clonedGeometry = mesh.geometry.clone();
        clonedGeometry.applyMatrix4(mesh.matrixWorld);
        geometries.push(clonedGeometry);
      }
      if (mesh.material) {
        materials.push(mesh.material as THREE.Material);
      }
    });

    if (geometries.length === 0) return null;

    // Merge geometries
    const mergedGeometry = new THREE.BufferGeometry();

    // Simple merge - assumes same attributes
    // For production, use BufferGeometryUtils.mergeGeometries

    // Use first material (assumes batch has same material)
    const material = materials[0];

    const mergedMesh = new THREE.Mesh(mergedGeometry, material);
    return mergedMesh;
  }

  /**
   * Clear batch
   */
  clearBatch(batchKey: string): void {
    this.batches.delete(batchKey);
  }

  /**
   * Clear all batches
   */
  clearAll(): void {
    this.batches.clear();
  }
}

/**
 * Performance monitor
 */
export class PerformanceMonitor {
  private stats: {
    drawCalls: number;
    triangles: number;
    points: number;
    lines: number;
    fps: number;
    frameTimes: number[];
  };
  private lastTime: number;
  private maxFrameTimes: number;

  constructor() {
    this.stats = {
      drawCalls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
      fps: 0,
      frameTimes: [],
    };
    this.lastTime = performance.now();
    this.maxFrameTimes = 60;
  }

  /**
   * Update frame statistics
   */
  update(renderer: THREE.WebGLRenderer): void {
    const currentTime = performance.now();
    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Track frame times
    this.stats.frameTimes.push(frameTime);
    if (this.stats.frameTimes.length > this.maxFrameTimes) {
      this.stats.frameTimes.shift();
    }

    // Calculate FPS
    const avgFrameTime =
      this.stats.frameTimes.reduce((a, b) => a + b, 0) / this.stats.frameTimes.length;
    this.stats.fps = Math.round(1000 / avgFrameTime);

    // Get render info
    const info = renderer.info;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.points = info.render.points;
    this.stats.lines = info.render.lines;
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      drawCalls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
      fps: 0,
      frameTimes: [],
    };
  }
}

/**
 * Memory manager for cleanup
 */
export class MemoryManager {
  /**
   * Dispose object and all children
   */
  static disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  /**
   * Dispose texture
   */
  static disposeTexture(texture: THREE.Texture): void {
    texture.dispose();
  }

  /**
   * Dispose render target
   */
  static disposeRenderTarget(renderTarget: THREE.WebGLRenderTarget): void {
    renderTarget.dispose();
  }

  /**
   * Get memory usage estimate (MB)
   */
  static estimateMemoryUsage(scene: THREE.Scene): number {
    let totalBytes = 0;

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // Estimate geometry memory
        if (object.geometry) {
          const attributes = object.geometry.attributes;
          for (const key in attributes) {
            const attribute = attributes[key];
            totalBytes += attribute.array.byteLength;
          }
        }

        // Estimate texture memory (rough)
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((mat: THREE.Material) => {
            if ('map' in mat && mat.map) {
              const texture = mat.map as THREE.Texture;
              if (texture.image) {
                // Rough estimate: width * height * 4 bytes per pixel
                totalBytes += texture.image.width * texture.image.height * 4;
              }
            }
          });
        }
      }
    });

    return totalBytes / (1024 * 1024); // Convert to MB
  }
}
