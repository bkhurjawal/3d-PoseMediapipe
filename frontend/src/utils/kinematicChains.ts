/**
 * Kinematic Chain System
 * Defines body segments and joint chains for highlighting and analysis
 */

import * as THREE from 'three';

/**
 * Kinematic chain definition
 */
export interface KinematicChain {
  name: string;
  joints: number[];
  color: number;
  category: 'arm' | 'leg' | 'torso' | 'head';
}

/**
 * All kinematic chains in the body
 */
export const KINEMATIC_CHAINS: KinematicChain[] = [
  // Left Arm
  {
    name: 'Left Arm',
    joints: [11, 13, 15, 17, 19, 21], // shoulder → elbow → wrist → pinky/index/thumb
    color: 0xFF6B6B,
    category: 'arm',
  },
  // Right Arm
  {
    name: 'Right Arm',
    joints: [12, 14, 16, 18, 20, 22], // shoulder → elbow → wrist → pinky/index/thumb
    color: 0xFF8E8E,
    category: 'arm',
  },
  // Left Leg
  {
    name: 'Left Leg',
    joints: [23, 25, 27, 29, 31], // hip → knee → ankle → heel → foot index
    color: 0xFECA57,
    category: 'leg',
  },
  // Right Leg
  {
    name: 'Right Leg',
    joints: [24, 26, 28, 30, 32], // hip → knee → ankle → heel → foot index
    color: 0xFFD77A,
    category: 'leg',
  },
  // Torso
  {
    name: 'Torso',
    joints: [11, 12, 23, 24], // shoulders and hips
    color: 0x4ECDC4,
    category: 'torso',
  },
  // Head/Face
  {
    name: 'Head',
    joints: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // nose, eyes, ears, mouth
    color: 0x00CCFF,
    category: 'head',
  },
];

/**
 * Get all chains that contain a specific joint
 */
export function getChainsForJoint(jointIndex: number): KinematicChain[] {
  return KINEMATIC_CHAINS.filter((chain) => chain.joints.includes(jointIndex));
}

/**
 * Get the primary chain for a joint (the most specific one)
 */
export function getPrimaryChain(jointIndex: number): KinematicChain | null {
  const chains = getChainsForJoint(jointIndex);

  if (chains.length === 0) return null;

  // Prefer limb chains over torso
  const limbChain = chains.find((c) => c.category === 'arm' || c.category === 'leg');
  if (limbChain) return limbChain;

  return chains[0];
}

/**
 * Create highlight effect for a kinematic chain
 */
export function createChainHighlight(
  jointPositions: Map<number, THREE.Vector3>,
  chain: KinematicChain,
  intensity: number = 1.0
): THREE.Group {
  const group = new THREE.Group();
  group.name = `chain_highlight_${chain.name}`;

  // Create glowing spheres at each joint in the chain
  chain.joints.forEach((jointIndex) => {
    const position = jointPositions.get(jointIndex);
    if (!position) return;

    const geometry = new THREE.SphereGeometry(0.035, 24, 24);
    const material = new THREE.MeshBasicMaterial({
      color: chain.color,
      transparent: true,
      opacity: 0.5 * intensity,
      wireframe: false,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    group.add(sphere);

    // Add outer glow ring
    const ringGeometry = new THREE.RingGeometry(0.04, 0.05, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: chain.color,
      transparent: true,
      opacity: 0.4 * intensity,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    ring.lookAt(new THREE.Vector3(0, 0, 1)); // Face camera
    group.add(ring);
  });

  // Create glowing connections between joints
  for (let i = 0; i < chain.joints.length - 1; i++) {
    const startPos = jointPositions.get(chain.joints[i]);
    const endPos = jointPositions.get(chain.joints[i + 1]);

    if (startPos && endPos) {
      // Skip if joints are too far apart (not connected)
      const distance = startPos.distanceTo(endPos);
      if (distance > 0.5) continue;

      const points = [startPos, endPos];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: chain.color,
        linewidth: 3,
        transparent: true,
        opacity: 0.8 * intensity,
      });

      const line = new THREE.Line(geometry, material);
      group.add(line);

      // Add tube for better visibility
      const direction = new THREE.Vector3().subVectors(endPos, startPos);
      const length = direction.length();
      const tubeGeometry = new THREE.CylinderGeometry(0.012, 0.012, length, 16);
      const tubeMaterial = new THREE.MeshStandardMaterial({
        color: chain.color,
        emissive: chain.color,
        emissiveIntensity: 0.5 * intensity,
        transparent: true,
        opacity: 0.7 * intensity,
      });

      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.position.copy(startPos).add(direction.multiplyScalar(0.5));

      // Orient tube
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, direction.normalize());
      tube.setRotationFromQuaternion(quaternion);

      group.add(tube);
    }
  }

  return group;
}

/**
 * Create pulsing animation for chain highlight
 */
export function animateChainHighlight(group: THREE.Group, time: number): void {
  const pulse = 0.8 + Math.sin(time * 3) * 0.2; // Pulse between 0.6 and 1.0

  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const material = child.material as THREE.Material;
      if ('opacity' in material) {
        const baseOpacity = child.geometry instanceof THREE.SphereGeometry ? 0.5 : 0.7;
        (material as any).opacity = baseOpacity * pulse;
      }
      if ('emissiveIntensity' in material) {
        (material as any).emissiveIntensity = 0.5 * pulse;
      }
    }
  });
}

/**
 * Get chain description for UI
 */
export function getChainDescription(chain: KinematicChain): string {
  switch (chain.category) {
    case 'arm':
      return 'Upper limb from shoulder to hand';
    case 'leg':
      return 'Lower limb from hip to foot';
    case 'torso':
      return 'Core body structure connecting limbs';
    case 'head':
      return 'Facial features and head position';
    default:
      return 'Body segment';
  }
}

/**
 * Get ordered joint sequence in a chain
 */
export function getChainSequence(chain: KinematicChain): string[] {
  const jointNames: { [key: number]: string } = {
    0: 'Nose',
    11: 'Left Shoulder',
    12: 'Right Shoulder',
    13: 'Left Elbow',
    14: 'Right Elbow',
    15: 'Left Wrist',
    16: 'Right Wrist',
    17: 'Left Pinky',
    18: 'Right Pinky',
    19: 'Left Index',
    20: 'Right Index',
    21: 'Left Thumb',
    22: 'Right Thumb',
    23: 'Left Hip',
    24: 'Right Hip',
    25: 'Left Knee',
    26: 'Right Knee',
    27: 'Left Ankle',
    28: 'Right Ankle',
    29: 'Left Heel',
    30: 'Right Heel',
    31: 'Left Foot Index',
    32: 'Right Foot Index',
  };

  return chain.joints.map((idx) => jointNames[idx] || `Joint ${idx}`);
}

/**
 * Check if two chains overlap
 */
export function chainsOverlap(chain1: KinematicChain, chain2: KinematicChain): boolean {
  return chain1.joints.some((joint) => chain2.joints.includes(joint));
}

/**
 * Get all joints in multiple chains (deduplicated)
 */
export function getAllChainJoints(chains: KinematicChain[]): number[] {
  const jointSet = new Set<number>();
  chains.forEach((chain) => {
    chain.joints.forEach((joint) => jointSet.add(joint));
  });
  return Array.from(jointSet);
}

/**
 * Create chain label sprite
 */
export function createChainLabel(chain: KinematicChain, position: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = 256;
  canvas.height = 64;

  // Clear
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 8);
  context.fill();

  // Border
  context.strokeStyle = `#${chain.color.toString(16).padStart(6, '0')}`;
  context.lineWidth = 3;
  context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 8);
  context.stroke();

  // Text
  context.fillStyle = `#${chain.color.toString(16).padStart(6, '0')}`;
  context.font = 'bold 28px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(chain.name, canvas.width / 2, canvas.height / 2);

  // Create sprite
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.2, 0.05, 1);
  sprite.position.copy(position);

  return sprite;
}
