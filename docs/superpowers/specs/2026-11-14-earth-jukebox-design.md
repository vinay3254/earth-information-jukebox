# Earth Information Jukebox — Design

NASA Space Apps 2026 challenge: "The Earth Information Jukebox".

## Intent

Make NASA Earth Information Center (EIC) visualizations audible. A user picks an
Earth visualization, watches the video, and hears a soundscape generated **in real
time from the video frames on screen**. Primary audience includes blind and
low-vision users, so accessibility is a core feature, not polish. Output must be
data-true *and* musically pleasant (notes snap to scales).

## Goals

- Browser app, no backend, static hosting (GitHub Pages). $0 budget.
- 4 tracks, each sourced from a NASA SVS visualization, each with a distinct sound.
- Real-time frame analysis in browser (canvas), driving Tone.js synthesis.
- Full keyboard control, screen-reader live captions, explore mode, written
  explanation of every mapping.

## Non-goals

- User upload of custom videos (possible later extra).
- Backend, accounts, server-side processing at runtime.
- Mobile polish beyond basic responsive layout.
- Reusing `earth_jukebox_demo.html` or `sample_datasets/` (ignore both).

## Anti-goals

- Chaotic noise: raw pixel-to-frequency mapping without scales.
- Fake sonification: sound that is not driven by actual frame features.
- Inaccessible UI: anything mouse-only.

## Approach (chosen: A)

- **A. Live in-browser frame analysis (chosen).** Videos downloaded once by a script,
  shrunk, served as static files. Browser reads each frame via canvas and maps
  features to sound. Truly real-time, best demo.
- B. Precomputed features JSON. Rejected: not real time from frames.
- C. Stream from SVS at runtime. Rejected: likely CORS block, fragile.

## Tracks

| id | Title | SVS ID | Feature | Sound |
|----|-------|--------|---------|-------|
| `nightlights` | Night Lights 2012–2023 | 5313 | brightness under a scan line sweeping left to right | plucked notes, pentatonic; bright = loud + high; dark = silence |
| `ocean` | Sea Surface Currents & Temperature | 3912 | frame-to-frame motion + warm/cool hue balance | warm pad; motion opens low-pass filter; warmer = higher chord |
| `lightning` | ISS Lightning 2017–2023 | 5011 | new bright spots per frame (frame diff hotspots) | percussion hits; x position = stereo pan; count = density |
| `aerosols` | GEOS Aerosols | 5669 | coverage of color classes (dust / smoke / sea salt / sulfate) | one instrument per class; coverage = volume |

## Architecture

```
scripts/fetch_media.py   one-off: SVS API -> download -> ffmpeg -> public/media/
public/media/<id>.mp4    <= 20 MB each, 854x480 or smaller, H.264, no audio, <= 90 s
public/media/<id>.jpg    poster frame
public/media/credits.json  [{id, svs_id, title, url, credits, source_file}]
index.html
src/main.js              boot, wires ui + engine
src/ui/                  UI, keyboard, explore mode, live captions   (agent: ui)
src/engine/features.js   frame feature extraction                    (agent: engine)
src/engine/audio.js      Tone.js instruments + master bus            (agent: engine)
src/engine/tracks/*.js   one mapping module per track                (agent: engine)
src/tracks.js            track registry: metadata + narration text   (agent: ui)
```

Stack: Vite + vanilla JS (ES modules) + Tone.js. No framework.

## Contracts (all agents must follow)

### Track registry — `src/tracks.js` (owner: ui)

```js
export const TRACKS = [
  { id: 'nightlights', title, svsId: 5313, video: 'media/nightlights.mp4',
    poster: 'media/nightlights.jpg', summary, mappingText, key: '1' },
  ...
];
```

`mappingText` = plain-language explanation of what the user hears and why.

### Features — `src/engine/features.js` (owner: engine)

```js
export function createExtractor({ width = 160, height = 90 } = {});
// extractor.analyze(videoEl) -> FrameFeatures
// extractor.sampleAt(xNorm, yNorm, radiusNorm = 0.05) -> RegionFeatures (uses last frame)
```

```ts
FrameFeatures = {
  t: number,                 // video currentTime, seconds
  width, height,             // analysis grid size
  luma: Float32Array,        // width*height, 0..1
  meanLuma: number,          // 0..1
  hue: { warm: number, cool: number, green: number }, // fractions 0..1
  motion: number,            // mean abs luma diff vs previous frame, 0..1
  hotspots: Array<{ x: number, y: number, strength: number }>, // x,y normalized 0..1, new bright spots
  columnLuma: Float32Array,  // length width, mean luma per column
  classes: Record<string, number> // color-class coverage 0..1, keys defined per track via options
}
RegionFeatures = { luma, hueName: 'warm'|'cool'|'green'|'dark', motion }
```

`createExtractor` accepts optional `colorClasses: { name: [r,g,b] , ... }` for nearest-color
coverage (used by aerosols).

### Track mapping modules — `src/engine/tracks/<id>.js` (owner: engine)

```js
export default {
  id: 'nightlights',
  colorClasses: undefined | { ... },
  start(audio),            // create/connect instruments
  update(features, audio, state), // called ~15 Hz while playing; state = { scanX } etc.
  describe(features) -> string,   // short caption for screen readers, e.g. "Sweeping Europe: dense, bright"
  probe(region, audio),    // explore mode: sound for one region
  stop(audio),
};
```

### Audio — `src/engine/audio.js` (owner: engine)

```js
export async function initAudio();     // must be called from a user gesture (Tone.start())
export const audio = { master, setVolume(0..1), mute(bool), scale(name) -> notes[] };
```

### Engine facade — `src/engine/index.js` (owner: engine)

```js
export function createEngine();
// engine.load(trackId, videoEl)
// engine.play() / engine.pause()
// engine.setExplore(bool); engine.probe(xNorm, yNorm)
// engine.on('caption', cb(text)); engine.on('frame', cb(features))
```

UI only talks to `createEngine()` and `TRACKS`.

## UI

```
┌───────────────────────────────────────────┐
│ Earth Jukebox                              │
│ [1 Night Lights][2 Ocean][3 Lightning][4 Air]│
│ ┌──────────── video frame ───────────────┐ │
│ │      ▌ scan line / explore cursor       │ │
│ └─────────────────────────────────────────┘ │
│ ▶ Play  ◉ Explore   vol ▬▬▬                │
│ Now: "Sweeping Europe: dense, bright"      │
│ How this sounds ▸ (mapping explained)      │
└───────────────────────────────────────────┘
```

Keyboard: Space play/pause, 1–4 pick track, E toggle explore, arrows move explore
cursor (paused frame), +/- volume, M mute, ? help dialog. All controls are real
buttons with labels. Captions in an `aria-live="polite"` region, throttled to at most
one per 2 s. Respect `prefers-reduced-motion`. Light/dark via `prefers-color-scheme`.
Overlay canvas draws scan line and explore cursor over the video.
Credits section lists NASA SVS sources from `credits.json`.

## Fetch script — `scripts/fetch_media.py` (owner: fetcher)

- Uses `https://svs.gsfc.nasa.gov/api/<id>` to list media; picks smallest mp4 >= 720p
  (or best available), downloads to `raw/` (gitignored).
- ffmpeg: scale to max 854 wide, strip audio, trim to <= 90 s, CRF tuned so file <= 20 MB,
  `-movflags +faststart`. Writes poster jpg from ~10% into video.
- Writes `public/media/credits.json`. Idempotent (skips existing). Python stdlib only + ffmpeg.
- If a track's SVS page has no usable video, report it and pick the closest alternative
  EIC/SVS visualization; record the substitution in credits.json.

## Left to builders

Exact instruments, scales, thresholds, styling, and caption wording — tune by ear and
eye, keep it pleasant.
