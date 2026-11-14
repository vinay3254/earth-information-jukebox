/**
 * src/globe/index.js
 *
 * Earth Information Jukebox — 3D Globe Component
 * Built with Three.js (three@0.170.0).
 *
 * API:
 * export function createGlobe(container, { regions, onSelect });
 * // globe.flyTo(regionId) -> Promise; globe.showAll(); globe.dispose()
 * // globe.setHighlight(regionId)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { latLonToVector3 } from './coordinates.js';
import { createEarthMaterial } from './earthShader.js';
import { createAtmosphere } from './atmosphere.js';
import { createStarfield } from './starfield.js';
import { MarkerManager } from './markers.js';
import { CameraController } from './cameraController.js';

export function createGlobe(container, { regions = [], onSelect = () => {} } = {}) {
  if (!container) {
    throw new Error('createGlobe: container element is required');
  }

  // Ensure container has relative positioning
  const computedStyle = window.getComputedStyle(container);
  if (computedStyle.position === 'static') {
    container.style.position = 'relative';
  }

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  // 1. Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a); // Deep space black-blue

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0.6, 3.6);

  // 2. Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Accessibility requirement: canvas aria-hidden
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.cursor = 'grab';
  container.appendChild(canvas);

  // 3. OrbitControls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.6;
  controls.minDistance = 1.35;
  controls.maxDistance = 12.0;
  controls.enablePan = false;

  // Subtle auto-rotation when user is idle
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  // 4. Textures: NASA Blue Marble (day) & Black Marble (night)
  const textureLoader = new THREE.TextureLoader();
  const dayTexture = textureLoader.load('/globe/blue_marble.jpg');
  dayTexture.colorSpace = THREE.SRGBColorSpace;
  dayTexture.wrapS = THREE.ClampToEdgeWrapping;
  dayTexture.wrapT = THREE.ClampToEdgeWrapping;

  const nightTexture = textureLoader.load('/globe/black_marble.jpg');
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.wrapS = THREE.ClampToEdgeWrapping;
  nightTexture.wrapT = THREE.ClampToEdgeWrapping;

  // 5. Earth Mesh
  const earthRadius = 1.0;
  const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
  const sunDirection = new THREE.Vector3(1.2, 0.5, 0.9).normalize();
  const earthMaterial = createEarthMaterial({ dayTexture, nightTexture, sunDirection });
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earthMesh);

  // 6. Atmosphere glow
  const atmosphereMesh = createAtmosphere({ radius: earthRadius, glowRadius: 1.022 });
  scene.add(atmosphereMesh);

  // 7. Background Starfield
  const starfield = createStarfield({ count: 1800, radius: 85 });
  scene.add(starfield);

  // 8. Region Markers
  const markerManager = new MarkerManager(scene, camera, regions, (regionId) => {
    // When marker clicked, fly to it and notify callback
    globe.flyTo(regionId);
    if (typeof onSelect === 'function') {
      onSelect(regionId);
    }
  });

  // 9. Camera Controller & Space Intro
  const cameraController = new CameraController(camera, controls);
  cameraController.startIntro();

  // 10. Pointer Interaction & Click Detection
  let pointerDownPos = { x: 0, y: 0 };
  let isPointerDown = false;

  function getPointerNDC(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y };
  }

  function onPointerDown(e) {
    isPointerDown = true;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
    controls.autoRotate = false; // Pause auto-rotation during user drag
  }

  function onPointerMove(e) {
    const { x, y } = getPointerNDC(e);
    if (!isPointerDown) {
      const hoveredId = markerManager.checkHover(x, y);
      canvas.style.cursor = hoveredId ? 'pointer' : 'grab';
    }
  }

  function onPointerUp(e) {
    isPointerDown = false;
    canvas.style.cursor = 'grab';

    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    const distanceMoved = Math.hypot(dx, dy);

    // If mouse didn't drag significantly, treat as click
    if (distanceMoved < 6) {
      const { x, y } = getPointerNDC(e);
      markerManager.checkClick(x, y);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cameraController.skipIntro();
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  // 11. Responsive Resize handling
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;

    camera.aspect = w / h;
    // On wide screens the control panel covers the right side; shift the
    // globe left so the selected place stays visible.
    const shift = w > 860 ? Math.min(w * 0.18, 270) : 0;
    if (shift) camera.setViewOffset(w, h, shift, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const resizeObserver = new ResizeObserver(() => onResize());
  resizeObserver.observe(container);

  // 12. 60 FPS Render Loop
  let animationFrameId = null;
  let isDisposed = false;

  function animate(now) {
    if (isDisposed) return;
    animationFrameId = requestAnimationFrame(animate);

    const timeSeconds = now * 0.001;

    // Update camera transition flight
    cameraController.update(now);

    // Update controls damping & auto-rotation
    if (!cameraController.isAnimating) {
      controls.update();
    }

    // Update marker animations (pulse rings and billboard rotation)
    markerManager.update(timeSeconds);

    renderer.render(scene, camera);
  }

  animationFrameId = requestAnimationFrame(animate);

  // 13. Public Globe API
  const globe = {
    /**
     * Fly camera to target region
     * @param {string} regionId
     * @returns {Promise<void>}
     */
    flyTo(regionId) {
      controls.autoRotate = false;
      const region = regions.find((r) => r.id === regionId);
      if (!region) {
        console.warn(`createGlobe: region with id "${regionId}" not found`);
        return Promise.resolve();
      }

      markerManager.setHighlight(regionId);
      const targetPos = latLonToVector3(region.lat, region.lon, earthRadius);
      return cameraController.flyTo(targetPos, 2.0);
    },

    /**
     * Pull camera back out to overview distance
     * @returns {Promise<void>}
     */
    showAll() {
      markerManager.setHighlight(null);
      return cameraController.showAll();
    },

    /**
     * Highlight region marker without camera jump
     * @param {string|null} regionId
     */
    setHighlight(regionId) {
      markerManager.setHighlight(regionId);
    },

    /**
     * Clean teardown of all Three.js resources and DOM listeners
     */
    dispose() {
      isDisposed = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);

      controls.dispose();
      cameraController.dispose();
      markerManager.dispose();

      earthGeometry.dispose();
      earthMaterial.dispose();
      dayTexture.dispose();
      nightTexture.dispose();

      atmosphereMesh.geometry.dispose();
      atmosphereMesh.material.dispose();

      starfield.geometry.dispose();
      starfield.material.map?.dispose();
      starfield.material.dispose();

      renderer.dispose();
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
  };

  return globe;
}
