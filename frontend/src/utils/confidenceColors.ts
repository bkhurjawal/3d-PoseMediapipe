/**
 * Confidence-Based Coloring System
 * Maps confidence scores to colors for visual quality feedback
 */

import * as THREE from 'three';

/**
 * Confidence thresholds for color mapping
 */
export const ConfidenceThresholds = {
  HIGH: 0.9,    // Above this is high confidence (bright purple)
  MEDIUM: 0.5,  // Between this and HIGH is medium (orange)
  LOW: 0.5,     // Below this is low confidence (red/gray)
};

/**
 * Confidence color palette
 */
export const ConfidenceColors = {
  // High confidence: Bright purple (original model color)
  HIGH: new THREE.Color(0xB899FA),
  HIGH_EMISSIVE: new THREE.Color(0x8B6BDA),

  // Medium confidence: Orange/amber warning
  MEDIUM: new THREE.Color(0xFFAA44),
  MEDIUM_EMISSIVE: new THREE.Color(0xFF8822),

  // Low confidence: Red alert
  LOW: new THREE.Color(0xFF4444),
  LOW_EMISSIVE: new THREE.Color(0xDD2222),

  // Very low/missing: Gray
  VERY_LOW: new THREE.Color(0x666666),
  VERY_LOW_EMISSIVE: new THREE.Color(0x444444),
};

/**
 * Get confidence level category
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'very_low' {
  if (confidence >= ConfidenceThresholds.HIGH) {
    return 'high';
  } else if (confidence >= ConfidenceThresholds.MEDIUM) {
    return 'medium';
  } else if (confidence >= 0.2) {
    return 'low';
  } else {
    return 'very_low';
  }
}

/**
 * Get color based on confidence score
 */
export function getConfidenceColor(confidence: number): THREE.Color {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case 'high':
      return ConfidenceColors.HIGH.clone();
    case 'medium':
      return ConfidenceColors.MEDIUM.clone();
    case 'low':
      return ConfidenceColors.LOW.clone();
    case 'very_low':
      return ConfidenceColors.VERY_LOW.clone();
    default:
      return ConfidenceColors.VERY_LOW.clone();
  }
}

/**
 * Get emissive color based on confidence score
 */
export function getConfidenceEmissive(confidence: number): THREE.Color {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case 'high':
      return ConfidenceColors.HIGH_EMISSIVE.clone();
    case 'medium':
      return ConfidenceColors.MEDIUM_EMISSIVE.clone();
    case 'low':
      return ConfidenceColors.LOW_EMISSIVE.clone();
    case 'very_low':
      return ConfidenceColors.VERY_LOW_EMISSIVE.clone();
    default:
      return ConfidenceColors.VERY_LOW_EMISSIVE.clone();
  }
}

/**
 * Interpolate color between two confidence scores
 * Used for limbs to show gradient from one joint to another
 */
export function interpolateConfidenceColor(
  confidence1: number,
  confidence2: number,
  t: number
): THREE.Color {
  const color1 = getConfidenceColor(confidence1);
  const color2 = getConfidenceColor(confidence2);

  return new THREE.Color().lerpColors(color1, color2, t);
}

/**
 * Get emissive intensity based on confidence
 * Higher confidence = more glow
 */
export function getConfidenceEmissiveIntensity(confidence: number): number {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case 'high':
      return 0.12; // Bright glow
    case 'medium':
      return 0.18; // Warning glow
    case 'low':
      return 0.25; // Alert glow
    case 'very_low':
      return 0.05; // Dim
    default:
      return 0.05;
  }
}

/**
 * Get opacity based on confidence
 * Lower confidence = more transparent
 */
export function getConfidenceOpacity(confidence: number): number {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case 'high':
      return 1.0;   // Fully opaque
    case 'medium':
      return 0.85;  // Slightly transparent
    case 'low':
      return 0.7;   // More transparent
    case 'very_low':
      return 0.5;   // Very transparent
    default:
      return 0.5;
  }
}

/**
 * Get metalness based on confidence
 * Used for joints - higher confidence = more metallic
 */
export function getConfidenceMetalness(confidence: number): number {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case 'high':
      return 0.5;   // Normal metallic joints
    case 'medium':
      return 0.4;   // Slightly less metallic
    case 'low':
      return 0.3;   // Less metallic
    case 'very_low':
      return 0.15;  // Minimal metallic
    default:
      return 0.15;
  }
}

/**
 * Get joint size multiplier based on confidence
 * Lower confidence = smaller joints to indicate uncertainty
 */
export function getConfidenceSizeMultiplier(confidence: number): number {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case 'high':
      return 1.0;   // Full size
    case 'medium':
      return 0.9;   // Slightly smaller
    case 'low':
      return 0.8;   // Smaller
    case 'very_low':
      return 0.7;   // Much smaller
    default:
      return 0.7;
  }
}

/**
 * Get confidence description for UI
 */
export function getConfidenceDescription(confidence: number): string {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case 'high':
      return 'High Quality';
    case 'medium':
      return 'Medium Quality';
    case 'low':
      return 'Low Quality';
    case 'very_low':
      return 'Very Low/Missing';
    default:
      return 'Unknown';
  }
}

/**
 * Apply confidence-based gradient to geometry vertices
 */
export function applyConfidenceGradient(
  geometry: THREE.BufferGeometry,
  confidence1: number,
  confidence2: number
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

    const color = interpolateConfidenceColor(confidence1, confidence2, t);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
