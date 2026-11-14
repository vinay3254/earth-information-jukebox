/**
 * src/globe/cameraController.js
 *
 * Cinematic camera transitions, space intro flight, and smooth flyTo/showAll navigation.
 */

import * as THREE from 'three';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CameraController {
  /**
   * @param {THREE.Camera} camera
   * @param {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} controls
   */
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;

    this.defaultDistance = 3.6;
    this.overviewPosition = new THREE.Vector3(0, 0.6, this.defaultDistance);
    this.spaceStartPosition = new THREE.Vector3(0, 6.0, 18.0);

    this.isAnimating = false;
    this.animationResolve = null;

    this.currentAnim = null; // { startPos, endPos, startTime, duration, arcHeight, resolve }

    // Check prefers-reduced-motion
    this.reducedMotion = false;
    try {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}
  }

  /**
   * Play intro camera flight easing from deep space in towards Earth.
   * Skippable with Esc or user click. Instant when reduced motion is preferred.
   */
  startIntro() {
    if (this.reducedMotion) {
      this.camera.position.copy(this.overviewPosition);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) this.controls.target.set(0, 0, 0);
      return Promise.resolve();
    }

    this.camera.position.copy(this.spaceStartPosition);
    this.camera.lookAt(0, 0, 0);

    return this.animateTo(this.overviewPosition, 2.2, 0.5);
  }

  /**
   * Immediately complete any active camera animation (e.g. on Esc key).
   */
  skipIntro() {
    if (this.currentAnim) {
      this.camera.position.copy(this.currentAnim.endPos);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
      const resolve = this.currentAnim.resolve;
      this.currentAnim = null;
      this.isAnimating = false;
      if (resolve) resolve();
    }
  }

  /**
   * Fly camera to face a 3D target point on the globe.
   * @param {THREE.Vector3} targetPoint - Surface or normalized point
   * @param {number} distance - Target distance from Earth center (default 2.0)
   * @param {number} duration - Transition duration in seconds (default 1.6)
   * @returns {Promise<void>}
   */
  flyTo(targetPoint, distance = 2.0, duration = 1.6) {
    if (this.reducedMotion) {
      const targetPos = targetPoint.clone().normalize().multiplyScalar(distance);
      this.camera.position.copy(targetPos);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
      return Promise.resolve();
    }

    const endPos = targetPoint.clone().normalize().multiplyScalar(distance);
    return this.animateTo(endPos, duration, 0.4);
  }

  /**
   * Eases camera back to default overview distance.
   * @param {number} duration
   * @returns {Promise<void>}
   */
  showAll(duration = 1.4) {
    if (this.reducedMotion) {
      const currentDir = this.camera.position.clone().normalize();
      this.camera.position.copy(currentDir.multiplyScalar(this.defaultDistance));
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
      return Promise.resolve();
    }

    // Keep current heading angle but pull distance back to defaultDistance
    const currentDir = this.camera.position.clone().normalize();
    const endPos = currentDir.multiplyScalar(this.defaultDistance);
    return this.animateTo(endPos, duration, 0.2);
  }

  /**
   * Internal helper to animate camera along an arc between start and end.
   */
  animateTo(endPos, duration = 1.5, arcHeight = 0.3) {
    // If an animation is already running, resolve previous
    if (this.currentAnim && this.currentAnim.resolve) {
      this.currentAnim.resolve();
    }

    const startPos = this.camera.position.clone();

    // If already very close, resolve immediately
    if (startPos.distanceTo(endPos) < 0.01) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.isAnimating = true;
      if (this.controls) this.controls.enabled = false;

      this.currentAnim = {
        startPos,
        endPos,
        startTime: performance.now(),
        duration: duration * 1000,
        arcHeight,
        resolve,
      };
    });
  }

  /**
   * Called every frame in the render loop.
   * @param {number} currentTime
   */
  update(currentTime) {
    if (!this.currentAnim) return;

    const elapsed = currentTime - this.currentAnim.startTime;
    const progress = Math.min(1.0, elapsed / this.currentAnim.duration);
    const ease = easeInOutCubic(progress);

    const { startPos, endPos, arcHeight } = this.currentAnim;

    // Slerp or spherical arc interpolation
    const currentPos = new THREE.Vector3();
    currentPos.lerpVectors(startPos, endPos, ease);

    // Add arc bulge outward so camera doesn't dip through sphere
    const startDist = startPos.length();
    const endDist = endPos.length();
    const targetDist = THREE.MathUtils.lerp(startDist, endDist, ease);
    const arcLift = Math.sin(ease * Math.PI) * arcHeight;
    currentPos.normalize().multiplyScalar(targetDist + arcLift);

    this.camera.position.copy(currentPos);
    this.camera.lookAt(0, 0, 0);

    if (this.controls) {
      this.controls.target.set(0, 0, 0);
    }

    if (progress >= 1.0) {
      const resolve = this.currentAnim.resolve;
      this.currentAnim = null;
      this.isAnimating = false;
      if (this.controls) {
        this.controls.enabled = true;
        this.controls.update();
      }
      if (resolve) resolve();
    }
  }

  dispose() {
    this.currentAnim = null;
    this.isAnimating = false;
  }
}
