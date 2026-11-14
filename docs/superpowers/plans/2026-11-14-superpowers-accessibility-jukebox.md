# Superpowers: Multi-Sensory Accessibility & Ultimate Jukebox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full multi-sensory accessibility (Earcons, Haptic Vibration, Speech Rate Selector, WCAG AAA Ultra-High Contrast, Blind Explorer Keypad Shortcuts) and advanced Jukebox capabilities (Live Audio Visualizer, 1-Click WAV Audio Exporter, 2-Minute Guided Audio Story Tour).

**Architecture:**
- Modular ES modules (`src/earcons.js`, `src/visualizer.js`, `src/audio-export.js`, `src/tour.js`).
- Deep integration into `src/signal-audio.js`, `src/ui.js`, `src/main.js`, and `styles.css`.
- Fully vanilla Web Audio, Web Speech, Canvas2D, and Haptic vibration APIs with zero external dependencies.

**Tech Stack:** Three.js r128+, Web Audio API (`AnalyserNode`, `AudioContext`), Web Speech API (`SpeechSynthesis`), HTML5 Canvas, Vanilla CSS3 with CSS variables.

---

## Global Constraints
- Zero external build dependencies or npm libraries (vanilla ESM).
- Non-breaking backward compatibility with all 28 destinations and 10 telemetry streams.
- WCAG 2.2 AAA accessibility compliance.
- Complete offline capability.

---

### Task 1: Auditory UI "Earcons" & Tactile Haptic Engine (`src/earcons.js`)

**Files:**
- Create: `C:\Users\pkish\HEARTH\src\earcons.js`
- Modify: `C:\Users\pkish\HEARTH\src\ui.js`

- [ ] **Step 1: Implement `EarconEngine` and `triggerHaptic` in `src/earcons.js`**
  - Synthesizes 5 distinct acoustic feedback cues:
    - `enable`: Ascending gentle ping (C5 523Hz -> G5 784Hz)
    - `disable`: Descending gentle tone (G5 784Hz -> C5 523Hz)
    - `tick`: Acoustic tick for slider year scrubs (1200Hz filtered click)
    - `select`: Double bell chime for region selection (587Hz -> 880Hz)
    - `disaster`: Low resonant rumble for catastrophe events
  - `triggerHaptic(type)`:
    - `milestone`: `[30, 20, 30]` ms
    - `disaster`: `[90, 40, 90]` ms
    - `click`: `[14]` ms

- [ ] **Step 2: Wire Earcons and Haptics into UI actions in `src/ui.js`**
  - Layer switches toggle `enable`/`disable` earcon and `click` haptic.
  - Year slider triggers `tick` earcon and `milestone` haptic on landmark years (1985, 2000, 2026).
  - Region selection triggers `select` earcon.

---

### Task 3: Screen-Reader Speech Rate & Voice Settings (`src/ui.js`)

**Files:**
- Modify: `C:\Users\pkish\HEARTH\src\ui.js`
- Modify: `C:\Users\pkish\HEARTH\index.html`

- [ ] **Step 1: Add Accessibility Settings Popover & Controls in `index.html`**
  - Speech rate selector (0.75x, 1.0x, 1.25x, 1.5x, 2.0x).
  - Voice selection dropdown (enumerating system voices).
  - High-contrast mode toggle button.

- [ ] **Step 2: Connect Voice Settings to `speakSummary()` in `src/ui.js`**
  - Saves preferences to `localStorage`.
  - Applies rate and voice to `SpeechSynthesisUtterance`.

---

### Task 4: WCAG AAA Ultra-High Contrast Mode (`styles.css`)

**Files:**
- Modify: `C:\Users\pkish\HEARTH\styles.css`
- Modify: `C:\Users\pkish\HEARTH\src\ui.js`

- [ ] **Step 1: Define `.high-contrast` CSS variables and overrides in `styles.css`**
  - Pure black background `#000000`.
  - Laser neon yellow `#FFEE00` high-visibility text.
  - Electric cyan `#00FFFF` active indicators.
  - 3px solid focus rings on interactive elements.

- [ ] **Step 2: Wire toggle button and keyboard shortcut `H` in `src/ui.js`**

---

### Task 5: "Blind Explorer" Keypad Shortcuts Mode (`src/ui.js`)

**Files:**
- Modify: `C:\Users\pkish\HEARTH\src\ui.js`

- [ ] **Step 1: Add global hotkey handler in `src/ui.js`**
  - `1`-`7`: Selects biome category.
  - `P`: Play / Pause.
  - `M`: Mute / Unmute.
  - `C`: Benchmark 40-year comparison.
  - `V`: Read climate summary.
  - `H`: Toggle High-Contrast.
  - `T`: Start Guided Tour.
  - `E`: Export Audio.
  - `?`: Speak available shortcuts aloud.

---

### Task 6: Live Audio Visualizer / Frequency Wave HUD (`src/visualizer.js`)

**Files:**
- Create: `C:\Users\pkish\HEARTH\src\visualizer.js`
- Modify: `C:\Users\pkish\HEARTH\src\signal-audio.js`
- Modify: `C:\Users\pkish\HEARTH\index.html`
- Modify: `C:\Users\pkish\HEARTH\src\main.js`

- [ ] **Step 1: Add `AnalyserNode` in `SignalAudio.buildGraph`**
- [ ] **Step 2: Implement canvas audio visualizer in `src/visualizer.js`**
- [ ] **Step 3: Render frequency wave in HUD**

---

### Task 7: 1-Click WAV Audio Exporter (`src/audio-export.js`)

**Files:**
- Create: `C:\Users\pkish\HEARTH\src\audio-export.js`
- Modify: `C:\Users\pkish\HEARTH\src\ui.js`

- [ ] **Step 1: Implement `exportSonificationWav` in `src/audio-export.js`**
  - Records 10 seconds of master audio via `MediaRecorder` or generates offline PCM WAV buffer.
  - Triggers browser file download with descriptive name (e.g. `HEARTH_Amazon_Rainforest_2026.wav`).

- [ ] **Step 2: Add "Export Audio" button in HUD toolbar**

---

### Task 8: 2-Minute Guided Audio Story Tour (`src/tour.js`)

**Files:**
- Create: `C:\Users\pkish\HEARTH\src\tour.js`
- Modify: `C:\Users\pkish\HEARTH\src\main.js`
- Modify: `C:\Users\pkish\HEARTH\index.html`

- [ ] **Step 1: Implement `GuidedTour` orchestrator in `src/tour.js`**
  - Iterates through 5 key biomes (Amazon, California Wildfires, Wayanad, Copacabana, Taj Mahal).
  - Triggers flight, year setting, and spoken narrative for each stop.

- [ ] **Step 2: Add "Take the Tour" button in Observatory masthead**

---

### Task 9: Verification & E2E Testing
- [ ] Run Playwright tests to verify Earcons, High-Contrast mode, Visualizer, Audio Export, and Tour mode.
- [ ] Commit and push to GitHub.
