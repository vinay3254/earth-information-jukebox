/**
 * Earth Information Jukebox — Engine Facade
 *
 * Coordinates:
 * - Active track mapping module (nightlights, ocean, lightning, aerosols)
 * - Canvas feature extraction at ~15 Hz (requestAnimationFrame throttled)
 * - Tone.js audio synthesis and master volume/limiter
 * - Sweep scanline progression (scanX 0..1 over ~8 s)
 * - Explore mode probing
 * - Event bus for 'frame' and 'caption' events
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import { initAudio, audio } from './audio.js';
import { createExtractor } from './features.js';

import nightlights from './tracks/nightlights.js';
import ocean from './tracks/ocean.js';
import lightning from './tracks/lightning.js';
import aerosols from './tracks/aerosols.js';

const TRACK_MODULES = {
  nightlights,
  ocean,
  lightning,
  aerosols
};

/**
 * Creates the engine instance.
 * UI only talks to createEngine() and TRACKS.
 */
export function createEngine() {
  let activeTrackId = null;
  let activeTrack = null;
  let videoEl = null;
  let isPlaying = false;
  let isExplore = false;
  let audioReady = false;

  let extractor = null;
  const state = { scanX: 0 };

  const listeners = {
    caption: new Set(),
    frame: new Set()
  };

  let rafId = null;
  let lastTickTime = 0;
  let lastCaptionTime = 0;
  let lastCaptionText = '';

  function emit(event, ...args) {
    const handlers = listeners[event];
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in engine listener for '${event}':`, err);
        }
      }
    }
  }

  function tick(dt, now) {
    if (!activeTrack || !extractor) return;

    // Advance scan line across frame: 0..1 over ~8 seconds
    if (videoEl && typeof videoEl.currentTime === 'number' && videoEl.currentTime > 0) {
      state.scanX = (videoEl.currentTime % 8.0) / 8.0;
    } else {
      state.scanX = (state.scanX + dt / 8.0) % 1.0;
    }

    // Extract frame features
    const features = extractor.analyze(videoEl);
    features.scanX = state.scanX;

    // Run active track sonification
    if (audioReady) {
      activeTrack.update(features, audio, state);
    }

    // Emit frame event for UI overlays (scanline, hotspots, etc.)
    emit('frame', features);

    // Emit screen-reader caption throttled to at most one per ~2 seconds
    if (now - lastCaptionTime >= 1800) {
      try {
        const text = activeTrack.describe(features);
        if (text && text !== lastCaptionText) {
          lastCaptionText = text;
          lastCaptionTime = now;
          emit('caption', text);
        }
      } catch {}
    }
  }

  function rafLoop() {
    if (!isPlaying) return;
    rafId = requestAnimationFrame(rafLoop);

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!lastTickTime) lastTickTime = now;
    const elapsed = now - lastTickTime;

    // ~15 Hz throttling (every ~66.7 ms, allow slightly earlier to prevent drift)
    if (elapsed >= 60) {
      const dt = elapsed / 1000;
      lastTickTime = now;
      tick(dt, now);
    }
  }

  return {
    /**
     * Load a track by ID and bind the video element.
     * @param {string} trackId - 'nightlights' | 'ocean' | 'lightning' | 'aerosols'
     * @param {HTMLVideoElement} videoElement
     */
    async load(trackId, videoElement) {
      if (activeTrack && audioReady) {
        activeTrack.stop(audio);
      }

      activeTrackId = trackId;
      activeTrack = TRACK_MODULES[trackId] || null;
      videoEl = videoElement || null;
      state.scanX = 0;
      lastCaptionText = '';
      lastCaptionTime = 0;

      if (!activeTrack) {
        console.warn(`[Engine] Unknown track: ${trackId}`);
        return;
      }

      // Initialize extractor configured with track's color classes
      extractor = createExtractor({
        width: 160,
        height: 90,
        colorClasses: activeTrack.colorClasses
      });

      if (isPlaying && audioReady) {
        activeTrack.start(audio);
      }
    },

    /**
     * Start sonification and video playback.
     */
    async play() {
      if (!audioReady) {
        try {
          await initAudio();
          audioReady = true;
        } catch (err) {
          console.warn('[Engine] Audio initialization deferred or failed:', err);
        }
      }

      if (activeTrack && audioReady) {
        activeTrack.start(audio);
      }

      isPlaying = true;
      lastTickTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      if (videoEl && typeof videoEl.play === 'function') {
        try {
          const playPromise = videoEl.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Video autoplay policy might require manual interaction
            });
          }
        } catch {}
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(rafLoop);
      }
    },

    /**
     * Pause sonification and video playback.
     */
    pause() {
      isPlaying = false;
      if (rafId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (videoEl && typeof videoEl.pause === 'function') {
        try {
          videoEl.pause();
        } catch {}
      }

      if (activeTrack && audioReady) {
        activeTrack.stop(audio);
      }
    },

    /**
     * Toggle or set explore mode.
     * When explore mode is active, playback is paused for point-by-point examination.
     * @param {boolean} bool
     */
    setExplore(bool) {
      isExplore = Boolean(bool);
      if (isExplore && isPlaying) {
        this.pause();
      }
    },

    /**
     * Probe sound and features for a normalized coordinate (0..1, 0..1).
     * @param {number} xNorm
     * @param {number} yNorm
     */
    async probe(xNorm, yNorm) {
      if (!audioReady) {
        try {
          await initAudio();
          audioReady = true;
        } catch {}
      }

      if (!activeTrack) return;

      if (!extractor) {
        extractor = createExtractor({
          width: 160,
          height: 90,
          colorClasses: activeTrack.colorClasses
        });
      }

      if (videoEl) {
        extractor.analyze(videoEl);
      }

      const region = extractor.sampleAt(xNorm, yNorm);
      activeTrack.probe(region, audio);

      // Emit caption for explored coordinate
      const xPct = Math.round(xNorm * 100);
      const yPct = Math.round(yNorm * 100);
      const desc = `Probed (${xPct}%, ${yPct}%): ${region.hueName} region, brightness ${Math.round(region.luma * 100)}%.`;
      emit('caption', desc);
    },

    /**
     * Subscribe to engine events: 'caption' or 'frame'.
     * @param {'caption'|'frame'} event
     * @param {Function} cb
     * @returns {Function} unsubscribe function
     */
    on(event, cb) {
      if (!listeners[event]) {
        listeners[event] = new Set();
      }
      listeners[event].add(cb);
      return () => {
        listeners[event]?.delete(cb);
      };
    },

    // Additional state accessors for UI and tests
    getTrackId() {
      return activeTrackId;
    },
    isPlaying() {
      return isPlaying;
    },
    isExplore() {
      return isExplore;
    },
    getState() {
      return { ...state };
    }
  };
}

// Re-export audio and feature extractor for convenience
export { initAudio, audio } from './audio.js';
export { createExtractor } from './features.js';
