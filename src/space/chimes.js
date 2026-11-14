// Orbit chimes: each planet rings once per orbit. Inner planets are high and
// frequent, outer planets low and rare, so the rhythm is the real period ratio.
import * as Tone from 'tone';

const NOTES = {
  mercury: 'E6', venus: 'C6', earth: 'G5', mars: 'E5',
  jupiter: 'C4', saturn: 'G3', uranus: 'E3', neptune: 'C3'
};

export function createChimes() {
  let synth = null;
  let enabled = false;
  let volume = 0.8;

  function ensure() {
    if (synth) return synth;
    const reverb = new Tone.Reverb({ decay: 6, wet: 0.45 }).toDestination();
    synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 6,
      envelope: { attack: 0.005, decay: 1.6, sustain: 0, release: 2.4 },
      modulationEnvelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 1 }
    }).connect(reverb);
    synth.volume.value = -2;
    return synth;
  }

  return {
    get enabled() { return enabled; },
    set(on) { enabled = on; if (on) ensure(); },
    setVolume(v) { volume = v; if (synth) synth.volume.value = v <= 0 ? -Infinity : -2 + 20 * Math.log10(v); },
    ring(planet, force = false) {
      if ((!enabled && !force) || volume <= 0) return;
      const s = ensure();
      s.triggerAttackRelease(NOTES[planet.id] || 'C5', '8n', Tone.now(), planet.id === 'jupiter' || planet.id === 'saturn' ? 0.9 : 0.6);
    }
  };
}
