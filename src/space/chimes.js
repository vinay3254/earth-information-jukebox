// Orbit chimes: each planet rings once per orbit. Inner planets are high and
// frequent, outer planets low and rare, so the rhythm is the real period ratio.
// Enhanced with output safety limiter (-2 dBFS) and rich planetary FM bell harmonics.
import * as Tone from 'tone';

export const NOTES = {
  mercury: 'E6', venus: 'C6', earth: 'G5', mars: 'E5',
  jupiter: 'C4', saturn: 'G3', uranus: 'E3', neptune: 'C3'
};

export function createChimes() {
  let synth = null;
  let limiter = null;
  let reverb = null;
  let enabled = false;
  let volume = 0.8;

  function ensure() {
    if (synth) return synth;

    // Safety limiter guarantees True Peak <= 0.8 (-2 dBFS) even when multiple orbits chime simultaneously
    limiter = new Tone.Limiter(-2).toDestination();
    reverb = new Tone.Reverb({ decay: 5.5, wet: 0.42 }).connect(limiter);

    synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 5.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.006, decay: 1.8, sustain: 0.02, release: 2.2 },
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 0.006, decay: 0.7, sustain: 0, release: 1.2 }
    }).connect(reverb);

    synth.volume.value = volume <= 0 ? -Infinity : -3 + 20 * Math.log10(volume);
    return synth;
  }

  return {
    get enabled() { return enabled; },

    set(on) {
      enabled = Boolean(on);
      if (enabled) ensure();
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0));
      if (synth) {
        synth.volume.value = volume <= 0.001 ? -Infinity : -3 + 20 * Math.log10(volume);
      }
    },

    ring(planet, force = false) {
      if ((!enabled && !force) || volume <= 0.001 || !planet) return;
      const s = ensure();
      const note = NOTES[planet.id] || 'C5';

      // Outer gas giants have more resonant mass; inner worlds are crisp and crystalline
      const isGiant = planet.id === 'jupiter' || planet.id === 'saturn';
      const velocity = isGiant ? 0.82 : 0.65;
      const duration = isGiant ? '4n' : '8n';

      s.triggerAttackRelease(note, duration, Tone.now(), velocity);
    },

    dispose() {
      try {
        if (synth) { synth.dispose(); synth = null; }
        if (reverb) { reverb.dispose(); reverb = null; }
        if (limiter) { limiter.dispose(); limiter = null; }
      } catch {}
    }
  };
}
