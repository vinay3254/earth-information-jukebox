// HEARTH — Auditory UI Earcons & Tactile Haptic Engine
// Provides instantaneous, non-intrusive acoustic & vibration cues for accessibility.

let earconCtx = null;

function getEarconContext() {
  if (!earconCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) {
      earconCtx = new Ctor({ latencyHint: 'interactive' });
    }
  }
  if (earconCtx && earconCtx.state === 'suspended') {
    earconCtx.resume().catch(() => {});
  }
  return earconCtx;
}

/**
 * Synthesizes instantaneous, gentle acoustic feedback for UI actions.
 * @param {'enable' | 'disable' | 'tick' | 'select' | 'disaster'} type
 */
export function playEarcon(type) {
  try {
    const ctx = getEarconContext();
    if (!ctx || ctx.state === 'closed') return;

    const now = ctx.currentTime;

    if (type === 'enable') {
      // Ascending gentle ping (C5 523.25 Hz -> G5 783.99 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === 'disable') {
      // Descending gentle tone (G5 783.99 Hz -> C5 523.25 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.09);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'tick') {
      // Micro-click tick for slider scrubbing (~20ms)
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    } else if (type === 'select') {
      // Double celestial bell chime (D5 587.33 Hz -> A5 880 Hz)
      const notes = [587.33, 880.0];
      notes.forEach((freq, i) => {
        const start = now + i * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.09, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.23);
      });
    } else if (type === 'disaster') {
      // Low resonant rumble for catastrophe / alert
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);
      filter.frequency.exponentialRampToValueAtTime(60, now + 0.35);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    }
  } catch (err) {
    // Non-critical: earcons should never break app execution
    console.debug('Earcon playback skipped:', err);
  }
}

/**
 * Triggers physical tactile haptic vibration patterns if supported on the device.
 * @param {'click' | 'milestone' | 'disaster' | 'select'} type
 */
export function triggerHaptic(type) {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

    if (type === 'click') {
      navigator.vibrate(14);
    } else if (type === 'milestone') {
      navigator.vibrate([30, 25, 30]);
    } else if (type === 'disaster') {
      navigator.vibrate([90, 40, 90]);
    } else if (type === 'select') {
      navigator.vibrate([25, 20, 40]);
    }
  } catch (err) {
    // Graceful degradation on devices without haptic engines
  }
}
