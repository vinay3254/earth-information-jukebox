/**
 * src/globe/atmosphere.js
 *
 * Atmosphere rim glow for Earth rendering.
 */

import * as THREE from 'three';

export function createAtmosphere({ radius = 1.0, glowRadius = 1.025 } = {}) {
  // Outer atmosphere glow using BackSide Fresnel
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec3 viewDir = normalize(-vPosition);
      // Fresnel rim factor on back-facing shell
      float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
      vec3 atmosphereColor = vec3(0.25, 0.55, 1.0); // NASA blue/cyan atmosphere
      gl_FragColor = vec4(atmosphereColor, clamp(intensity * 1.2, 0.0, 0.9));
    }
  `;

  const geometry = new THREE.SphereGeometry(glowRadius, 64, 64);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Mesh(geometry, material);
}
