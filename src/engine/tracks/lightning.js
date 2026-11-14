/**
 * Earth Information Jukebox — ISS Lightning Track Module
 *
 * SVS 5011: ISS Lightning 2017–2023
 * Feature: New bright spots per frame (frame diff hotspots).
 * Sound: Crisp percussion hits; x position = stereo pan (-1..1); count = strike density.
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 */

import * as Tone from 'tone';

const VOICE_COUNT = 4;
let voices = [];
let thunderSynth = null;
let reverb = null;
let voiceIndex = 0;
let lastRumbleTime = 0;

export default {
  id: 'lightning',
  colorClasses: undefined,

  /**
   * Initialize and connect instruments.
   * @param {import('../audio.js').audio} audio
   */
  start(audio) {
    if (voices.length > 0) this.stop(audio);

    try {
      reverb = new Tone.Reverb({ decay: 1.8, wet: 0.25 });
      reverb.connect(audio.master);

      // Create pool of panned percussion voices
      voices = [];
      for (let i = 0; i < VOICE_COUNT; i++) {
        const panner = new Tone.Panner(0);
        panner.connect(reverb);

        // Crisp electro-acoustic strike synthesizer
        const synth = new Tone.MembraneSynth({
          pitchDecay: 0.02,
          octaves: 3,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.001,
            decay: 0.18,
            sustain: 0.0,
            release: 0.1
          }
        });
        synth.volume.value = -2;
        synth.connect(panner);

        voices.push({ synth, panner });
      }

      // Distant low thunder rumble synth
      thunderSynth = new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 2,
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.05,
          decay: 0.9,
          sustain: 0.05,
          release: 0.8
        }
      });
      thunderSynth.volume.value = -8;
      thunderSynth.connect(reverb);
    } catch {
      // AudioContext may not be active in tests
    }

    voiceIndex = 0;
    lastRumbleTime = 0;
  },

  /**
   * Called ~15 Hz while playing.
   * Strikes percussion voices for each detected lightning hotspot panned in stereo.
   *
   * @param {import('../features.js').FrameFeatures} features
   * @param {import('../audio.js').audio} audio
   * @param {{ scanX: number }} state
   */
  update(features, audio, state) {
    if (!voices.length || !features) return;

    const hotspots = features.hotspots || [];
    if (hotspots.length === 0) return;

    const notes = audio.scale('lightning');
    const now = Tone.now();

    // Trigger percussion hits for up to 3 hotspots per frame to prevent overload
    const limit = Math.min(3, hotspots.length);
    for (let i = 0; i < limit; i++) {
      const spot = hotspots[i];
      const voice = voices[voiceIndex];
      voiceIndex = (voiceIndex + 1) % VOICE_COUNT;

      // X position -> stereo pan [-1 .. +1]
      const panVal = Math.max(-1, Math.min(1, (spot.x - 0.5) * 2.0));
      if (voice.panner && voice.panner.pan) {
        voice.panner.pan.setValueAtTime(panVal, now + i * 0.025);
      }

      // Y position -> pitch in scale (higher in frame = higher pitch)
      const latNorm = 1.0 - Math.max(0, Math.min(1, spot.y));
      const noteIdx = Math.floor(latNorm * (notes.length - 1));
      const note = notes[noteIdx] || 'C3';

      const velocity = Math.min(1.0, Math.max(0.3, (spot.strength || 0.5) * 1.5));

      try {
        voice.synth.triggerAttackRelease(note, '16n', now + i * 0.025, velocity);
      } catch {}
    }

    // If multiple simultaneous strikes occur, add a distant thunder rumble
    if (hotspots.length >= 3 && thunderSynth && now - lastRumbleTime > 1.2) {
      try {
        thunderSynth.triggerAttackRelease('A1', '4n', now + 0.08, 0.6);
        lastRumbleTime = now;
      } catch {}
    }
  },

  /**
   * Generates a concise screen-reader caption describing lightning activity.
   * @param {import('../features.js').FrameFeatures} features
   * @returns {string}
   */
  describe(features) {
    const hotspots = features?.hotspots || [];
    const count = hotspots.length;

    if (count === 0) {
      return 'ISS Lightning: calm orbital view, no active optical pulses.';
    }

    if (count === 1) {
      const spot = hotspots[0];
      const side = spot.x < 0.35 ? 'western limb' : (spot.x > 0.65 ? 'eastern limb' : 'central track');
      return `ISS Lightning: single localized optical flash detected near ${side}.`;
    }

    if (count <= 3) {
      return `ISS Lightning: active convective cell with ${count} optical flash pulses.`;
    }

    return `ISS Lightning: intense multi-cluster storm system with ${count} simultaneous strikes.`;
  },

  /**
   * Play sound for a probed region in explore mode.
   * @param {{ luma: number, hueName: string, motion: number }} region
   * @param {import('../audio.js').audio} audio
   */
  probe(region, audio) {
    if (!voices.length) this.start(audio);
    if (!voices.length) return;

    const voice = voices[0];
    const notes = audio.scale('lightning');
    const lum = region?.luma || 0;
    const note = notes[Math.floor(Math.min(0.999, lum * 1.5) * notes.length)] || 'C3';

    try {
      voice.synth.triggerAttackRelease(note, '8n', Tone.now(), Math.min(1, lum * 2.0 + 0.3));
    } catch {}
  },

  /**
   * Release and dispose instruments.
   * @param {import('../audio.js').audio} audio
   */
  stop(audio) {
    for (const voice of voices) {
      try {
        voice.synth.dispose();
        voice.panner.dispose();
      } catch {}
    }
    voices = [];

    if (thunderSynth) {
      try {
        thunderSynth.dispose();
      } catch {}
      thunderSynth = null;
    }
    if (reverb) {
      try {
        reverb.dispose();
      } catch {}
      reverb = null;
    }
  }
};
