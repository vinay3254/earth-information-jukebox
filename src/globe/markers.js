/**
 * src/globe/markers.js
 *
 * Interactive 3D region markers on the globe with animated pulse rings,
 * billboarding labels, raycasting interaction, and smooth highlight states.
 */

import * as THREE from 'three';
import { latLonToVector3 } from './coordinates.js';

/**
 * Creates a text label sprite using HTML5 Canvas.
 * @param {string} text - Region name
 * @param {boolean} isHighlighted
 * @returns {THREE.Sprite}
 */
function createTextSprite(text, isHighlighted = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  drawLabelCanvas(ctx, text, isHighlighted);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false, // constant on-screen size at any zoom
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.2, 0.05, 1.0);
  sprite.userData = { canvas, ctx, texture, text };
  return sprite;
}

function drawLabelCanvas(ctx, text, isHighlighted) {
  ctx.clearRect(0, 0, 512, 128);

  const padX = 24;
  const padY = 16;
  const fontSize = 34;

  ctx.font = `600 ${fontSize}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;

  const boxWidth = Math.min(500, textWidth + padX * 2);
  const boxHeight = fontSize + padY * 2;
  const boxX = (512 - boxWidth) / 2;
  const boxY = (128 - boxHeight) / 2;
  const radius = 18;

  // Background rounded pill
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);

  if (isHighlighted) {
    ctx.fillStyle = 'rgba(15, 30, 51, 0.92)';
    ctx.strokeStyle = '#f2b544'; // sodium amber accent
    ctx.lineWidth = 3;
  } else {
    ctx.fillStyle = 'rgba(15, 30, 51, 0.78)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 2;
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Small dot indicator inside label
  const dotRadius = 6;
  const dotX = boxX + padX - 4;
  const dotY = boxY + boxHeight / 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = isHighlighted ? '#f2b544' : '#9cc3e0';
  ctx.fill();

  // Label text
  ctx.fillStyle = isHighlighted ? '#ffffff' : '#f1f5f9';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, dotX + dotRadius + 12, boxY + boxHeight / 2);
}

export class MarkerManager {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {Array<{ id: string, name: string, lat: number, lon: number }>} regions
   * @param {function(string): void} onSelect
   */
  constructor(scene, camera, regions = [], onSelect = () => {}) {
    this.scene = scene;
    this.camera = camera;
    this.regions = regions;
    this.onSelect = onSelect;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.markers = [];
    this.highlightedId = null;
    this.hoveredId = null;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.initMarkers();
  }

  initMarkers() {
    const pinGeom = new THREE.SphereGeometry(0.022, 16, 16);
    const ringGeom = new THREE.RingGeometry(0.025, 0.045, 32);

    this.regions.forEach((region) => {
      const pos = latLonToVector3(region.lat, region.lon, 1.004);
      const normal = pos.clone().normalize();

      const markerGroup = new THREE.Group();
      markerGroup.position.copy(pos);

      // Central glowing pin
      const pinMat = new THREE.MeshBasicMaterial({
        color: 0x9cc3e0,
        depthTest: true,
      });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      markerGroup.add(pinMesh);

      // Pulse ring on earth surface, oriented along normal
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x9cc3e0,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      markerGroup.add(ringMesh);

      // Invisible larger hit sphere for easy clicking/touching
      const hitGeom = new THREE.SphereGeometry(0.075, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeom, hitMat);
      hitMesh.userData = { regionId: region.id, region };
      markerGroup.add(hitMesh);

      // Label sprite elevated slightly above surface
      const label = createTextSprite(region.name, false);
      const labelOffset = normal.clone().multiplyScalar(0.08);
      label.position.copy(labelOffset);
      markerGroup.add(label);

      this.group.add(markerGroup);

      this.markers.push({
        id: region.id,
        region,
        pos,
        normal,
        markerGroup,
        pinMesh,
        pinMat,
        ringMesh,
        ringMat,
        hitMesh,
        label,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    });
  }

  /**
   * Set visual highlight on a region marker
   * @param {string|null} regionId
   */
  setHighlight(regionId) {
    this.highlightedId = regionId;
    this.markers.forEach((m) => {
      const isHigh = m.id === regionId;
      m.pinMat.color.setHex(isHigh ? 0xf2b544 : 0x9cc3e0); // Gold when selected, Sky Blue default
      m.ringMat.color.setHex(isHigh ? 0xf2b544 : 0x9cc3e0);

      // Redraw canvas label with highlighted styling
      drawLabelCanvas(m.label.userData.ctx, m.region.name, isHigh);
      m.label.userData.texture.needsUpdate = true;
      m.label.scale.set(isHigh ? 0.24 : 0.2, isHigh ? 0.06 : 0.05, 1.0);
    });
  }

  /**
   * Update animation loop: pulse rings and back-face occlusion fading
   * @param {number} time - Current elapsed time in seconds
   */
  update(time) {
    const camPos = this.camera.position;

    this.markers.forEach((m) => {
      // 1. Occlusion check: Is marker facing towards camera?
      const dirToCam = camPos.clone().sub(m.pos).normalize();
      const dot = m.normal.dot(dirToCam);

      // Smoothly fade markers on back of the sphere
      if (dot < 0.05) {
        m.markerGroup.visible = false;
        return;
      }
      m.markerGroup.visible = true;

      const alpha = THREE.MathUtils.clamp((dot - 0.05) / 0.25, 0.0, 1.0);
      m.label.material.opacity = alpha;
      m.pinMat.opacity = alpha;

      // 2. Pulse ring expansion and fade
      const isHigh = m.id === this.highlightedId;
      // Static ring: nothing here is live, so it does not pulse.
      const ringScale = isHigh ? 1.0 : 0.8;
      const ringOpacity = (isHigh ? 0.55 : 0.25) * alpha;

      m.ringMesh.scale.set(ringScale, ringScale, 1.0);
      m.ringMat.opacity = ringOpacity;

      // 3. Keep label facing camera
      m.label.quaternion.copy(this.camera.quaternion);
    });
  }

  /**
   * Raycast check against marker hit spheres
   * @param {number} ndcX - Normalized device coordinate X (-1 to 1)
   * @param {number} ndcY - Normalized device coordinate Y (-1 to 1)
   * @returns {string|null} Hovered region id
   */
  checkHover(ndcX, ndcY) {
    this.pointer.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hitMeshes = this.markers
      .filter((m) => m.markerGroup.visible)
      .map((m) => m.hitMesh);

    const intersects = this.raycaster.intersectObjects(hitMeshes, false);
    if (intersects.length > 0) {
      const regionId = intersects[0].object.userData.regionId;
      this.hoveredId = regionId;
      return regionId;
    }

    this.hoveredId = null;
    return null;
  }

  /**
   * Click check
   * @param {number} ndcX
   * @param {number} ndcY
   * @returns {string|null} Clicked region id
   */
  checkClick(ndcX, ndcY) {
    const regionId = this.checkHover(ndcX, ndcY);
    if (regionId) {
      this.setHighlight(regionId);
      if (typeof this.onSelect === 'function') {
        this.onSelect(regionId);
      }
      return regionId;
    }
    return null;
  }

  dispose() {
    this.markers.forEach((m) => {
      m.pinMesh.geometry.dispose();
      m.pinMat.dispose();
      m.ringMesh.geometry.dispose();
      m.ringMat.dispose();
      m.hitMesh.geometry.dispose();
      m.label.material.map.dispose();
      m.label.material.dispose();
    });
    this.scene.remove(this.group);
  }
}
