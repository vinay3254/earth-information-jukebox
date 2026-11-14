# Earth Information Jukebox — Design

NASA Space Apps Challenge 2026: *The Earth Information Jukebox*.

## 1. What it is

A browser app that turns NASA Earth data into sound. You start among the planets, fly down to Earth, pick a place, and hear forty years of real measurements change. A third view, the Frame Lab, plays NASA satellite videos and makes sound live from the pixels on screen.

The challenge asks for sight-to-sound translation that blind and low-vision people can use. Accessibility is part of the core design. Every visual has a spoken or written equivalent, and everything works from the keyboard.

### Principles

1. **Real data only.** Every number shown or heard comes from a fetched public dataset. A missing value is silent. We never fill gaps with invented numbers.
2. **Rules you can read.** Each sound says in plain words what drives it ("Lead melody. Warmer is higher.").
3. **Musical, not noisy.** Every pitch snaps to a scale, and a limiter on each output keeps levels safe.
4. **Space first.** The 3D scene fills the screen. Controls float over it and never replace it.
5. **Ours.** No code, layout, regions or assets are taken from other teams' entries.

## 2. Experience flow

```
Entry gate ──▶ Solar system ──"Fly down to Earth"──▶ Earth ──▶ pick a place ──▶ listen / sweep / compare
   │                │                                    │
   │                └── click a planet: fly to it, facts, chime
   └── "Start with voice guide" turns on speech          └── Frame Lab (L): NASA videos sonified live
```

| Step | What happens |
|---|---|
| Entry gate | A large title and two buttons: *Start listening* and *Start with voice guide*. The click also unlocks browser audio. |
| Solar system | The camera flies in from deep space. Eight planets orbit an animated Sun. |
| Planet focus | The camera flies to the planet's sunlit side and keeps it centred while it orbits. A fact card appears and the planet's chime rings. |
| Fly down to Earth | The camera closes on Earth and dives in, the screen fades to atmosphere-blue, and the Earth view opens. |
| Earth | A daylit globe with 6 place markers. Picking one flies the camera there, shows that year's satellite photo, and opens the listening panel. |
| Frame Lab | Four NASA satellite videos. The engine analyses each frame and plays it. *Explore by hand* lets you probe any point. |

Views: **S** Solar system, **G** Earth, **L** Frame Lab. **Esc** skips any camera flight.

## 3. Visual design

### Palette

| Token | Hex | Role |
|---|---|---|
| `--atmos` | `#0f1e33` | Base: deep atmosphere blue, never pure black |
| `--panel` | `#17304d` | Raised surfaces |
| `--glass` | `rgb(12 26 46 / 0.72)` + 14px blur | Floating panels over the 3D scene |
| `--cloud` | `#e8eef3` | Text |
| `--muted` | `#a9bccd` | Secondary text |
| `--amber` | `#f2b544` | Single accent: the sodium streetlight colour seen from orbit. Used for selection, focus, the year number, the scan line |
| `--ice` | `#9cc3e0` | Secondary marks: unselected markers, links |
| `--cool` / `--warm` | `#3a6ea5` / `#c8553d` | Data colours for the heat ribbon only |

The scene is dark by design (it is space), so the app pins `data-theme="dark"`. Light tokens exist for the text surfaces.

### Type

- **Atkinson Hyperlegible Next** for body and UI. The Braille Institute designed it for low-vision readers, so it fits this audience.
- **Bricolage Grotesque** for headings and the large year number.
- Base size 18px. Line length stays under about 60 characters in panels.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Earth Information Jukebox   [Solar][Earth][Lab]  Voice Vol Keys│  ← floating bar
│                                                ┌────────────┐ │
│        full-screen 3D scene                    │  panel     │ │
│        (globe shifted left so the              │  (glass,   │ │
│         target stays visible)                  │  scrolls)  │ │
│  ┌──────┐                                      │            │ │
│  │photo │  satellite plate for the year        └────────────┘ │
│  └──────┘                                                     │
│ footer: data credits                                          │
└──────────────────────────────────────────────────────────────┘
```

- On wide screens, both 3D cameras use `setViewOffset` to move the scene centre left of the panel.
- Below 860px everything stacks: the scene takes 56vh with the panel below it, and key hints are hidden.

### Signature element: the heat ribbon

The year slider's track is a strip of stripes, one per year from 1981 to 2025. Each stripe is coloured by that place's real mean temperature relative to its own average: blue is cooler, red is warmer. The slider shows the warming before you press play. The thumb is a plain vertical bar, and the year sits above it in large amber numerals.

### Motion

- Orchestrated moments only: the arrival flight from deep space, planet flights, and the dive into Earth.
- Flights use eased cubic interpolation timed by the wall clock, so they don't slow down at low frame rates. They track moving planets, so the camera lands on the planet, not where it was.
- `prefers-reduced-motion` makes all flights instant and removes the fades.

## 4. The three views

### 4.1 Solar system

- **Sun:** a GLSL shader with animated fractal noise (granulation), a limb glow, and two additive glow sprites. A point light at the Sun lights the planets.
- **Planets:** all 8, with surfaces generated on a canvas in code (no downloads). Rocky worlds have craters, gas giants have warped bands, Venus has cloud swirls, and Jupiter has its Great Red Spot. Earth uses the NASA Blue Marble texture, an atmosphere shell and an orbiting Moon. Saturn has rings with the Cassini division. Uranus is tilted 98°.
- **Scale:** sizes are `0.42 + 0.78·∛(r/r⊕)` and distances `7 + 10.5·√AU`, both compressed to fit the screen. Orbital periods keep their **true ratios**; Earth completes one orbit in 48 s.
- **Fact card:** distance (AU and km), year length, day length, mean temperature and moons, from the NASA Planetary Fact Sheet.
- **Orbit chimes:** each planet rings once per orbit, from Mercury on E6 down to Neptune on C3. The rhythm *is* the real period ratio.

### 4.2 Earth

The six places were chosen to tell different climate stories:

| Place | Story |
|---|---|
| Greenland Ice Sheet (Ilulissat) | Ice loss, Arctic warming |
| Amazon Rainforest (Rondônia) | Deforestation, drought |
| Sahel (Lake Chad basin) | Dust, rainfall swings, a drying lake |
| Delhi & Indo-Gangetic Plain | Heat, air pollution, urban growth |
| Great Barrier Reef | Ocean heat, bleaching |
| California (Sierra Nevada) | Wildfire, drought, snowpack |

The data synth has seven voices, one per variable. Each can be switched on or off and shows its live value:

| Variable | Range used | Sound |
|---|---|---|
| Temperature (°C) | −15 to 35 | Lead melody; warmer is higher |
| Precipitation (mm/yr) | 0 to 3000 | Plucked notes; more rain, more notes |
| Solar irradiance (kWh/m²/day) | 1.5 to 7.5 | High shimmer pad; more sun, brighter |
| Wind (m/s) | 0.5 to 12 | Filtered pink noise; windier, louder |
| Humidity (%) | 10 to 95 | Reverb amount |
| CO₂ (ppm) | 335 to 435 | Pad detune; drifts out of tune as CO₂ rises |
| Global temperature anomaly (°C) | −0.2 to 1.6 | Low drone that rises as the world warms |

Ranges are shared across all places, so Greenland and the Sahel sound clearly different.

Controls:
- **Play this year.**
- **Play all years:** a sweep at 0.6 s per year.
- **Compare two years:** presets for first to last and each decade. The comparison is spoken and written from the data, for example "Greenland, 1981 to 2025: average temperature up 2.0 °C (−4.2 to −2.2); yearly rain up 88 mm…".

### 4.3 Frame Lab

Each frame is shrunk to 160×90 and analysed about 15 times a second. The analysis gives mean brightness, a brightness grid, warm, cool and green colour fractions, motion since the previous frame, new bright spots, and colour-class coverage.

| Track | Video (NASA GIBS, Aug–Oct 2024) | Sound |
|---|---|---|
| Night lights | VIIRS Day/Night Band | A scan line sweeps west to east every 8 s; bright columns play plucked pentatonic notes; darkness is silent |
| Ocean currents | GHRSST MUR sea surface temperature | Held chord; warmer water lifts it; faster change opens the filter |
| Active fires | MODIS Terra thermal anomalies | Each new fire is a percussion hit, panned by longitude |
| Dust, smoke and sea salt | MODIS aerosol optical depth | One instrument per aerosol colour class; coverage sets the volume |

The overlay draws the scan line, rings around new bright spots, and the explore cursor. A *This frame* panel shows live meters. **Explore by hand** pauses playback; the arrow keys (Shift for bigger steps) or a click move the listening point, and you hear and read what is under it.

## 5. Accessibility

- **Voice guide:** uses `speechSynthesis`. It is off by default, remembered per browser, and never talks over itself. It speaks arrivals, planet facts, year changes (after input settles) and comparisons.
- **Live captions:** in `aria-live="polite"` regions, with repeats skipped.
- **The 3D canvases are `aria-hidden`.** Every action they offer is also a real button in the panel. Planet labels in the scene are clickable but not tab stops, which avoids duplicate focus targets.
- **Keyboard:** Space plays or pauses, S/G/L switch views, V toggles the voice guide, +/− and M control volume, / jumps to the list, ←/→ change the year, C compares, 1–4 pick a Lab track, E explores, ? opens the key list, and Esc skips a flight.
- **Visible focus:** a 3px amber outline. Touch targets are at least 44px. There is a skip link.
- **Missing data says so:** "no data" appears in place of a value, and the voice for that variable is silent.

## 6. Data sources

| Data | Source | Used for |
|---|---|---|
| Monthly temperature, max temperature, precipitation, solar, wind, humidity (1981–2025) | NASA POWER point API | Earth data synth |
| Global temperature anomaly | NASA GISS GISTEMP v4 | Drone voice |
| CO₂ annual mean | NOAA GML Mauna Loa | Detune voice |
| Yearly true-colour snapshots (2001–2025) | NASA GIBS, MODIS Terra corrected reflectance | Place photo plate |
| Earth day and night textures | NASA GIBS, Blue Marble Next Generation and Black Marble | Globe and solar-system Earth |
| Lab videos | NASA GIBS daily layers, assembled with ffmpeg | Frame Lab |
| Planet facts | NASA Planetary Fact Sheet | Fact cards, orbit speeds |

Every fetched source, with its URL and retrieval date, is listed in `public/data/sources.json` and `public/media/credits.json`.

NASA SVS (the challenge's suggested gallery) was unreachable from our build network. The Lab therefore uses GIBS layers of the same phenomena, and there is no lightning layer on GIBS, so the lightning track was replaced with active fires.

## 7. Architecture

Static site: Vite, vanilla ES modules, Three.js 0.170 and Tone.js 15. No backend.

```
index.html               shell: gate, top bar, three views, help dialog
src/main.js              view switching, keyboard, volume, voice, gate
src/style.css            tokens, layout, components
src/ui/
  dom.js                 tiny element builder, live-region helper
  voice.js               speech voice guide
  spaceView.js           solar system panel, fact card, chimes, dive to Earth
  globeView.js           places, heat ribbon, data synth controls, compare
  labView.js             tracks, overlay, explore mode, frame meters
src/space/               solar system scene (planets.js data, textures.js, solarSystem.js, chimes.js)
src/globe/               Earth globe (shader, atmosphere, markers, camera flights)
src/datasynth/           seven-voice data synth (ranges, scales, voices, synth)
src/engine/              Frame Lab engine (features.js, audio.js, tracks/*.js)
src/tracks.js            Frame Lab track text, written to be read aloud
scripts/                 fetch_data.py, fetch_media.py, fetch_globe_textures.py (stdlib + ffmpeg)
public/data|media|globe  fetched data, imagery, videos, textures
```

Optional modules load through `import.meta.glob`, so a missing module shows a "not ready" note instead of breaking the page.

### Audio chain

```
Solar system: FM chime (PolySynth) ─▶ reverb ─▶ out
Earth:        7 voices ─▶ reverb ─▶ gain (fades on play/pause) ─▶ limiter −3 dB ─▶ out
Frame Lab:    track instruments ─▶ engine master volume ─▶ limiter −1 dB ─▶ out
```

Measured in a headless browser by tapping the audio output: peaks are 0.60 in the Earth view and up to 0.76 in the Lab. Both stay under full scale. Pause reaches silence within 0.4 s.

## 8. Running it

```bash
npm install
python3 scripts/fetch_data.py           # regions.json + yearly imagery
python3 scripts/fetch_globe_textures.py # Earth textures
python3 scripts/fetch_media.py          # Frame Lab videos (needs ffmpeg)
npx vite                                # http://localhost:5173
npx vite build                          # static site in dist/
```

## 9. Known limits and next steps

- The Earth textures are 2048×1024; higher resolution would sharpen close-ups.
- The Lab videos cover three months of 2024. Longer spans (multi-year night lights, for example) would tell a bigger story.
- The planet surfaces are procedural. Real NASA mosaics would be more accurate if the texture hosts become reachable.
- The sound design needs tuning by ear with real listeners, especially blind and low-vision testers.
- Hosting: right now there is only a temporary tunnel. GitHub Pages would give a stable link.
