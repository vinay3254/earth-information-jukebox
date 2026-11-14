// Spoken voice guide using the browser's speechSynthesis.
// Off by default. Remembered per browser. Never talks over itself.

const KEY = 'eij-voice-guide';

function readPref() {
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}
function writePref(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
}

export function createVoiceGuide() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  let enabled = supported && readPref();
  let timer = null;

  function speakNow(text) {
    if (!enabled || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    window.speechSynthesis.speak(u);
  }

  return {
    supported,
    get enabled() { return enabled; },
    set(on) {
      enabled = supported && on;
      writePref(enabled);
      if (!enabled && supported) window.speechSynthesis.cancel();
    },
    // Speak right away, cutting off anything in progress.
    say(text) { clearTimeout(timer); speakNow(text); },
    // Speak after input settles, for things like dragging the year slider.
    sayLater(text, ms = 700) {
      clearTimeout(timer);
      timer = setTimeout(() => speakNow(text), ms);
    }
  };
}
