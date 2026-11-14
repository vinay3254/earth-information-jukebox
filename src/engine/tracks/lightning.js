/**
 * Earth Information Jukebox — Active Fires & Optical Pulses Track Module
 *
 * SVS 5011 / MODIS Terra: Thermal Anomalies & Active Fires
 * Feature: New thermal fire hotspots per frame (frame diff hotspots).
 * Sound: Crisp percussion hits; x position = stereo pan (-0.95..+0.95); count = strike density.
 *
 * Variants:
 * - 'electro-snap': Pure electro-acoustic membrane strike with snappy transient
 * - 'acoustic-wood-strike' (Default): Resonant drum body + snapping ember crackle transient
 * - 'spatial-fire-burst': Dual-voice 3D spatial percussion with distant low rumble
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

let currentVariant = 'acoustic-wood-strike';

const VOICE_COUNT = 4;
let voices = [];
let thunderSynth = null;
let reverb = null;
let fireBed = null;
let fireBedFilter = null;
let voiceIndex = 0;
let lastRumbleTime = 0;

function initNodes(audio) {
  if (typeof window === 'undefined') return;

  try {
    reverb = new Tone.Reverb({ decay: 2.2, wet: 0.24 });
    reverb.connect(audio.master);

    // Warm nocturnal fire bed: maintains running energy to prevent > 6 dB onset jumps
    fireBedFilter = new Tone.Filter(500, 'lowpass');
    fireBedFilter.connect(reverb);
    fireBed = new Tone.Noise('pink');
    fireBed.volume.value = -24;
    fireBed.connect(fireBedFilter);
    fireBed.start();

    voices = [];
    for (let i = 0; i < VOICE_COUNT; i++) {
      const panner = new Tone.Panner(0);
      panner.connect(reverb);

      // Resonant drum body synth with smooth 16ms attack
      const synth = new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 2.8,
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.016,
          decay: 0.24,
          sustain: 0.02,
          release: 0.16
        }
      });
      synth.volume.value = -5.5;
      synth.connect(panner);

      // Snappy crackle / spark noise transient synth for Variant B & C
      const noiseSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.014, decay: 0.06, sustain: 0.0 }
      });
      noiseSynth.volume.value = -14;
      noiseSynth.connect(panner);

      voices.push({ synth, noiseSynth, panner });
    }

    // Low resonant thunder / fire-plume sub bass rumble
    thunderSynth = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 2.0,
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.04,
        decay: 0.8,
        sustain: 0.04,
        release: 0.4
      }
    });
    thunderSynth.volume.value = -9;
    thunderSynth.connect(reverb);
  } catch {
    // Non-browser fallback
  }
}

export default {
  id: 'lightning',
  colorClasses: undefined,

  setVariant(v) {
    if (['electro-snap', 'acoustic-wood-strike', 'spatial-fire-burst'].includes(v)) {
      currentVariant = v;
    }
  },

  getVariant() {
    return currentVariant;
  },

  get variants() {
    return ['electro-snap', 'acoustic-wood-strike', 'spatial-fire-burst'];
  },

  start(audio) {
    this.stop(audio);
    initNodes(audio);

    voiceIndex = 0;
    lastRumbleTime = 0;
  },

  update(features, audio, state) {
    if (!voices.length || !features) return;

    const hotspots = features.hotspots || [];
    if (hotspots.length === 0) return;

    const scaleName = currentVariant === 'acoustic-wood-strike' ? 'fireBlues' : 'lightning';
    const notes = audio.scale(scaleName);
    const now = Tone.now();

    const limit = Math.min(3, hotspots.length);
    for (let i = 0; i < limit; i++) {
      const spot = hotspots[i];
      const voice = voices[voiceIndex];
      voiceIndex = (voiceIndex + 1) % VOICE_COUNT;

      // X position -> stereo pan [-0.95 .. +0.95]
      const panVal = audio.panFromX ? audio.panFromX(spot.x) : Math.max(-0.95, Math.min(0.95, (spot.x - 0.5) * 1.9));
      if (voice.panner && voice.panner.pan) {
        voice.panner.pan.setValueAtTime(panVal, now + i * 0.03);
      }

      const latNorm = 1.0 - Math.max(0, Math.min(1, spot.y));
      const noteIdx = Math.floor(latNorm * (notes.length - 1));
      const note = notes[noteIdx] || 'C3';

      const strength = spot.strength || 0.5;
      const velocity = Math.min(0.85, Math.max(0.3, strength * 1.3));

      try {
        voice.synth.triggerAttackRelease(note, '16n', now + i * 0.03, velocity);

        if (currentVariant !== 'electro-snap' && voice.noiseSynth) {
          voice.noiseSynth.triggerAttackRelease('32n', now + i * 0.03, velocity * 0.5);
        }
      } catch {}
    }

    if (hotspots.length >= 3 && thunderSynth && now - lastRumbleTime > 1.2) {
      try {
        thunderSynth.triggerAttackRelease('A1', '4n', now + 0.08, 0.5);
        lastRumbleTime = now;
      } catch {}
    }
  },

  describe(features) {
    const hotspots = features?.hotspots || [];
    const count = hotspots.length;

    if (count === 0) {
      return 'Active Fires: calm night observation, no thermal anomalies detected.';
    }

    if (count === 1) {
      const spot = hotspots[0];
      const side = spot.x < 0.35 ? 'western flank' : (spot.x > 0.65 ? 'eastern flank' : 'central region');
      return `Active Fires: thermal hotspot detected near ${side}.`;
    }

    if (count <= 3) {
      return `Active Fires: ${count} active fire clusters burning across landscape.`;
    }

    return `Active Fires: intense regional wildfire outbreak with ${count} simultaneous fire fronts.`;
  },

  probe(region, audio, xNorm = 0.5) {
    if (audio && typeof audio.playProbe === 'function') {
      audio.playProbe(region, xNorm);
    } else {
      const voice = voices[0];
      if (!voice) return;
      const notes = audio.scale('fireBlues');
      const lum = region?.luma || 0;
      const note = notes[Math.floor(Math.min(0.999, lum * 1.5) * notes.length)] || 'C3';

      try {
        voice.synth.triggerAttackRelease(note, '8n', Tone.now(), Math.min(0.85, lum * 2.0 + 0.3));
      } catch {}
    }
  },

  stop(audio) {
    if (fireBed) {
      try {
        fireBed.stop();
        fireBed.dispose();
      } catch {}
      fireBed = null;
    }
    if (fireBedFilter) {
      try { fireBedFilter.dispose(); } catch {}
      fireBedFilter = null;
    }
    for (const voice of voices) {
      try {
        voice.synth.dispose();
        if (voice.noiseSynth) voice.noiseSynth.dispose();
        voice.panner.dispose();
      } catch {}
    }
    voices = [];

    if (thunderSynth) {
      try { thunderSynth.dispose(); } catch {}
      thunderSynth = null;
    }
    if (reverb) {
      try { reverb.dispose(); } catch {}
      reverb = null;
    }
  }
};
