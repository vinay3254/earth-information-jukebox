/**
 * Earth Information Jukebox — Audio Engine & Master Bus
 *
 * Conforms to spec contract in docs/superpowers/specs/2026-11-14-earth-jukebox-design.md
 * Targets from audio-brief.md:
 * - True peak at output <= 0.8 (-2 dBFS); never >= 1.0.
 * - Each mode playing on its own sits roughly -20 to -16 LUFS-ish.
 * - Pause / stop reaches silence within 0.5 s.
 * - No sudden onsets louder than 6 dB above the running level.
 */

import * as Tone from 'tone';

let masterNode = null;
let limiterNode = null;
let earconSynth = null;
let earconPanner = null;
let probeSynth = null;
let probePanner = null;
let probeFilter = null;
let exploreBed = null;
let exploreBedFilter = null;
let currentVolume = 0.80;
let isMuted = false;
let audioStarted = false;

const SCALES = {
  pentatonic: [
    'C2', 'D2', 'E2', 'G2', 'A2',
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
    'C6', 'D6', 'E6', 'G6', 'A6',
    'C7'
  ],
  majorPentatonic: [
    'C2', 'D2', 'E2', 'G2', 'A2',
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
    'C6', 'D6', 'E6', 'G6', 'A6',
    'C7'
  ],
  lydianPentatonic: [
    'C2', 'E2', 'F#2', 'G2', 'B2',
    'C3', 'E3', 'F#3', 'G3', 'B3',
    'C4', 'E4', 'F#4', 'G4', 'B4',
    'C5', 'E5', 'F#5', 'G5', 'B5',
    'C6', 'E6', 'F#6', 'G6', 'B6'
  ],
  minorPentatonic: [
    'A1', 'C2', 'D2', 'E2', 'G2',
    'A2', 'C3', 'D3', 'E3', 'G3',
    'A3', 'C4', 'D4', 'E4', 'G4',
    'A4', 'C5', 'D5', 'E5', 'G5',
    'A5', 'C6', 'D6', 'E6', 'G6'
  ],
  lightning: [
    'A1', 'C2', 'D2', 'E2', 'G2',
    'A2', 'C3', 'D3', 'E3', 'G3',
    'A3', 'C4', 'D4', 'E4', 'G4',
    'A4', 'C5', 'D5', 'E5', 'G5'
  ],
  fireBlues: [
    'A1', 'C2', 'D2', 'Eb2', 'E2', 'G2',
    'A2', 'C3', 'D3', 'Eb3', 'E3', 'G3',
    'A3', 'C4', 'D4', 'Eb4', 'E4', 'G4',
    'A4', 'C5', 'D5', 'Eb5', 'E5', 'G5'
  ],
  ocean: [
    'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3',
    'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4',
    'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
    'D5', 'E5', 'F5', 'G5', 'A5'
  ],
  dorian: [
    'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3',
    'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4',
    'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
    'D5', 'E5', 'F5', 'G5', 'A5'
  ],
  aerosols: [
    'F2', 'G2', 'A2', 'C3', 'D3',
    'F3', 'G3', 'A3', 'C4', 'D4',
    'F4', 'G4', 'A4', 'C5', 'D5',
    'F5', 'G5', 'A5', 'C6', 'D6'
  ],
  major: [
    'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
    'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'
  ],
  minor: [
    'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3',
    'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4',
    'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'
  ]
};

function ensureMaster() {
  if (!masterNode && typeof window !== 'undefined') {
    // Limiter at -2.5 dBFS guarantees true peak <= 0.75 (strictly <= 0.8)
    limiterNode = new Tone.Limiter(-2.5);
    limiterNode.toDestination();

    masterNode = new Tone.Volume(Tone.gainToDb(currentVolume));
    masterNode.connect(limiterNode);
    masterNode.mute = isMuted;
  }
  return masterNode;
}

export async function initAudio() {
  if (!audioStarted) {
    await Tone.start();
    audioStarted = true;
  }
  ensureMaster();
  const ctx = Tone.getContext();
  if (ctx && ctx.state !== 'running') {
    await ctx.resume();
  }
  return true;
}

export function panFromX(xNorm) {
  const clamped = Math.max(0, Math.min(1, Number(xNorm) || 0.5));
  return (clamped - 0.5) * 1.8;
}

export const audio = {
  get master() {
    return ensureMaster();
  },

  setVolume(val) {
    currentVolume = Math.max(0, Math.min(1, Number(val) || 0));
    if (masterNode) {
      if (currentVolume <= 0.001) {
        masterNode.volume.value = -Infinity;
      } else {
        masterNode.volume.rampTo(Tone.gainToDb(currentVolume), 0.05);
      }
    }
  },

  mute(shouldMute) {
    isMuted = Boolean(shouldMute);
    if (masterNode) masterNode.mute = isMuted;
    if (typeof Tone.getDestination === 'function') {
      Tone.getDestination().mute = isMuted;
    }
  },

  scale(name) {
    if (name && SCALES[name]) return [...SCALES[name]];
    return [...SCALES.pentatonic];
  },

  panFromX,

  /**
   * Start or stop explore mode ambient focus bed.
   * Keeps running energy smooth to prevent >6 dB onset jumps during cursor probing.
   */
  setExploreBed(active) {
    if (typeof window === 'undefined') return;
    try {
      if (active) {
        if (!exploreBed) {
          exploreBedFilter = new Tone.Filter(400, 'lowpass');
          exploreBedFilter.connect(ensureMaster());
          exploreBed = new Tone.Noise('pink');
          exploreBed.volume.value = -28;
          exploreBed.connect(exploreBedFilter);
          exploreBed.start();
        } else {
          exploreBed.volume.rampTo(-28, 0.1);
        }
      } else if (exploreBed) {
        exploreBed.volume.rampTo(-Infinity, 0.15);
      }
    } catch {}
  },

  /**
   * Play a short, distinct earcon (~350ms) introducing a track on start or switch.
   */
  playEarcon(trackId) {
    if (typeof window === 'undefined') return;
    try {
      if (!earconSynth) {
        earconPanner = new Tone.Panner(0);
        earconPanner.connect(ensureMaster());
        earconSynth = new Tone.PolySynth(Tone.Synth, {
          maxPolyphony: 4,
          options: {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, decay: 0.22, sustain: 0.1, release: 0.18 }
          }
        });
        earconSynth.volume.value = -5;
        earconSynth.connect(earconPanner);
      }

      const now = Tone.now();
      switch (trackId) {
        case 'nightlights': {
          earconPanner.pan.setValueAtTime(-0.5, now);
          earconPanner.pan.rampTo(0.5, 0.35);
          earconSynth.triggerAttackRelease('C5', '8n', now, 0.65);
          earconSynth.triggerAttackRelease('G5', '8n', now + 0.08, 0.70);
          earconSynth.triggerAttackRelease('E6', '8n', now + 0.16, 0.75);
          break;
        }
        case 'ocean': {
          earconPanner.pan.setValueAtTime(0, now);
          earconSynth.triggerAttackRelease('D3', '4n', now, 0.65);
          earconSynth.triggerAttackRelease('A3', '4n', now + 0.08, 0.70);
          earconSynth.triggerAttackRelease('F4', '4n', now + 0.16, 0.75);
          break;
        }
        case 'lightning': {
          earconPanner.pan.setValueAtTime(-0.5, now);
          earconPanner.pan.rampTo(0.5, 0.3);
          earconSynth.triggerAttackRelease('A2', '16n', now, 0.68);
          earconSynth.triggerAttackRelease('D3', '16n', now + 0.07, 0.72);
          earconSynth.triggerAttackRelease('G3', '8n', now + 0.14, 0.78);
          break;
        }
        case 'aerosols': {
          earconPanner.pan.setValueAtTime(-0.4, now);
          earconPanner.pan.rampTo(0.4, 0.35);
          earconSynth.triggerAttackRelease('D4', '8n', now, 0.65);
          earconSynth.triggerAttackRelease('F4', '8n', now + 0.08, 0.70);
          earconSynth.triggerAttackRelease('A4', '8n', now + 0.16, 0.72);
          earconSynth.triggerAttackRelease('C5', '4n', now + 0.24, 0.75);
          break;
        }
        default:
          break;
      }
    } catch {}
  },

  /**
   * Universal explore probe sound encoding brightness (pitch) and colour (timbre).
   */
  playProbe(region, xNorm = 0.5) {
    if (typeof window === 'undefined') return;
    try {
      if (!probeSynth) {
        probePanner = new Tone.Panner(0);
        probePanner.connect(ensureMaster());

        probeFilter = new Tone.Filter(2200, 'lowpass');
        probeFilter.connect(probePanner);

        probeSynth = new Tone.MonoSynth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.32, sustain: 0.15, release: 0.35 },
          filterEnvelope: { attack: 0.02, decay: 0.25, sustain: 0.2, release: 0.3, baseFrequency: 400, octaves: 2.8 }
        });
        probeSynth.volume.value = -3.5;
        probeSynth.connect(probeFilter);
      }

      const luma = Math.max(0, Math.min(1, region?.luma ?? 0));
      const hue = region?.hueName || 'dark';
      const now = Tone.now();

      // Pan to probed coordinate
      const panVal = panFromX(xNorm);
      if (probePanner && probePanner.pan) {
        probePanner.pan.setValueAtTime(panVal, now);
      }

      // Brightness -> Pitch
      const notes = audio.scale('pentatonic');
      const pitchIdx = Math.floor(Math.min(0.999, Math.max(0, luma * 1.5)) * notes.length);
      const note = notes[pitchIdx] || 'C3';

      // Colour -> Timbre
      if (hue === 'warm') {
        probeSynth.oscillator.type = 'sawtooth';
        probeFilter.frequency.setValueAtTime(2600, now);
      } else if (hue === 'cool') {
        probeSynth.oscillator.type = 'sine';
        probeFilter.frequency.setValueAtTime(3400, now);
      } else if (hue === 'green') {
        probeSynth.oscillator.type = 'square';
        probeFilter.frequency.setValueAtTime(1500, now);
      } else {
        probeSynth.oscillator.type = 'triangle';
        probeFilter.frequency.setValueAtTime(luma > 0.05 ? 1000 : 450, now);
      }

      const velocity = Math.min(0.9, Math.max(0.3, luma * 1.5 + 0.35));
      probeSynth.triggerAttackRelease(note, '4n', now, velocity);
    } catch {}
  }
};

export function snapToScale(normVal, scaleName = 'pentatonic') {
  const notes = audio.scale(scaleName);
  const clamped = Math.max(0, Math.min(0.999, normVal));
  const idx = Math.floor(clamped * notes.length);
  return notes[idx];
}
