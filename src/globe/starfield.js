/**
 * src/globe/starfield.js
 *
 * Background starfield for the 3D globe view.
 */

import * as THREE from 'three';

export function createStarfield({ count = 2000, radius = 90 } = {}) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const starColors = [
    new THREE.Color(0xffffff), // White
    new THREE.Color(0xdce8ff), // Pale blue
    new THREE.Color(0xfff3db), // Pale warm yellow
    new THREE.Color(0xcfe2fe), // Ice blue
  ];

  for (let i = 0; i < count; i++) {
    // Distribute uniformly on a sphere
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = radius * (0.85 + Math.random() * 0.3);

    const sinPhi = Math.sin(phi);
    const x = r * sinPhi * Math.cos(theta);
    const y = r * sinPhi * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Pick a subtle color
    const baseColor = starColors[Math.floor(Math.random() * starColors.length)];
    const brightness = 0.5 + Math.random() * 0.5;
    colors[i * 3] = baseColor.r * brightness;
    colors[i * 3 + 1] = baseColor.g * brightness;
    colors[i * 3 + 2] = baseColor.b * brightness;

    sizes[i] = 1.0 + Math.random() * 2.0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Canvas circle texture for smooth round star points instead of square blocks
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(8, 8, 8, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.PointsMaterial({
    size: 2.0,
    vertexColors: true,
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}
