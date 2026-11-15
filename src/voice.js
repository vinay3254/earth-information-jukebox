// Expressive voice guide on top of the browser's speech engine.
//
// The Web Speech API has no emotion or SSML support, but each utterance can
// set its own pitch, rate and volume. So text is split into sentences, each
// sentence gets a delivery ("mood") from its words, and the sentences are
// spoken as a queue with natural pauses between them.
//
// Voice choice: the browser default is often the most robotic voice. When the
// user has not picked one, the best available English voice is chosen:
// neural "Natural"/"Online" voices (Edge), then Google voices (Chrome), then
// enhanced Apple voices, then the rest.

// Delivery per mood, relative to the user's chosen rate.
const MOODS = {
  calm: { pitch: 1.0, rate: 0.96, volume: 1 },
  warm: { pitch: 1.06, rate: 0.94, volume: 1 },
  concern: { pitch: 0.9, rate: 0.86, volume: 0.95 },
  hopeful: { pitch: 1.1, rate: 1.0, volume: 1 },
  emphasis: { pitch: 1.04, rate: 0.88, volume: 1 }
};

const CONCERN = /\b(drought|driest|dry|hottest|hotter|warmer|record|fire|fires|wildfire|blaze|burn|flood|landslide|tsunami|disaster|crisis|lost|loss|fell|falls|dropped|warning|extreme|heat)\b/i;
const WARM = /\b(welcome|begin|beautiful|majestic|iconic|listen|explore|enjoy|thank)\b/i;
const HOPEFUL = /\b(recovered|recovery|wettest|greener|cooler|improved|rose back|complete)\b/i;
const NUMBERS = /\d/;

export function moodOf(sentence) {
  if (CONCERN.test(sentence)) return 'concern';
  if (HOPEFUL.test(sentence)) return 'hopeful';
  if (WARM.test(sentence)) return 'warm';
  if (NUMBERS.test(sentence)) return 'emphasis';
  return 'calm';
}

// Sentences, keeping their end punctuation; decimals like 2.5 stay intact.
export function sentences(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Higher score = better sounding voice.
export function voiceScore(voice) {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = 0;
  if (!voice.lang || !voice.lang.toLowerCase().startsWith('en')) return -1;
  if (/natural|neural/.test(name)) score += 100;
  if (/online/.test(name)) score += 40;
  if (/google/.test(name)) score += 60;
  if (/enhanced|premium|siri/.test(name)) score += 50;
  if (/(aria|jenny|ava|emma|michelle|sonia|libby|natasha|samantha|karen|serena)/.test(name)) score += 12;
  if (/(guy|andrew|brian|ryan|eric|daniel)/.test(name)) score += 8;
  if (/zira/.test(name)) score += 6; // the softest of the basic Windows voices
  if (voice.lang === 'en-US') score += 4;
  else if (voice.lang === 'en-GB') score += 3;
  if (!voice.localService) score += 5; // cloud voices are usually neural
  return score;
}

export function isNaturalVoice(voice) {
  return voiceScore(voice) >= 60;
}

export class ExpressiveVoice {
  constructor(synth = window.speechSynthesis) {
    this.synth = synth || null;
    this.token = 0;
    this.onStart = null;
    this.onEnd = null;
  }

  bestVoice() {
    if (!this.synth) return null;
    const voices = this.synth.getVoices() || [];
    let best = null;
    let bestScore = -1;
    for (const voice of voices) {
      const score = voiceScore(voice);
      if (score > bestScore) {
        best = voice;
        bestScore = score;
      }
    }
    return best;
  }

  cancel() {
    this.token += 1;
    if (this.synth) this.synth.cancel();
    this.onEnd?.();
  }

  // Speak text sentence by sentence. `mood` forces one delivery for all of it.
  // `onDone` runs once the last sentence has been spoken (not if it was cut
  // off by newer speech).
  // `whole: true` speaks the text as one utterance: no gap between sentences,
  // for longer passages such as the temperature trend.
  say(text, { rate = 1, voice = null, mood = null, onDone = null, whole = false } = {}) {
    if (!this.synth || !text) return;
    this.cancel();
    const token = this.token;
    const chosen = voice || this.bestVoice();
    // Basic (non-neural) voices are easier to follow a little slower.
    const basicSlowdown = chosen && !isNaturalVoice(chosen) ? 0.94 : 1;
    const parts = whole ? [String(text).trim()].filter(Boolean) : sentences(text);
    if (!parts.length) return;
    this.onStart?.();
    parts.forEach((part, i) => {
      const style = MOODS[mood || moodOf(part)] || MOODS.calm;
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = chosen?.lang || 'en-US';
      if (chosen) utterance.voice = chosen;
      utterance.rate = Math.max(0.5, Math.min(2, rate * style.rate * basicSlowdown));
      utterance.pitch = style.pitch;
      utterance.volume = style.volume;
      if (i === parts.length - 1) {
        utterance.onend = () => {
          if (token !== this.token) return;
          this.onEnd?.();
          onDone?.();
        };
      }
      utterance.onerror = () => {
        if (token !== this.token || i !== parts.length - 1) return;
        this.onEnd?.();
        onDone?.();
      };
      this.synth.speak(utterance);
    });
  }
}
