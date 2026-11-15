# HEARTH — Planetary Geospatial Sonification Observatory

**Hear how 28 places on Earth have changed from 1985 to 2025, played as music from real NASA measurements.**

Built for the [NASA Space Apps Challenge 2026 — The Earth Information Jukebox](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/).

---

## 1. What it is

Climate data is almost always shown as charts, which leaves out blind and low-vision people and hides how a place has changed over a lifetime. HEARTH lets anyone hear it.

- **Observatory (`index.html`)** — fly from the solar system to Earth, pick one of 28 places, choose a year, and the real yearly data for that place plays as music. A jukebox bar plays, pauses, steps through years or plays all 41 years in a row.
- **Acoustic Lab (`studio.html`)** — turns satellite image sequences into sound frame by frame.
- **Live ISS mode** — a tone that follows the International Space Station's real position around the planet.

Everything runs in the browser with plain JavaScript: no build step, no npm dependencies.

---

## 2. Data (all real measurements)

| Source | What HEARTH uses | Where |
| --- | --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/) monthly/annual API (MERRA-2 reanalysis, CERES satellite) | Annual temperature (`T2M`), rain (`PRECTOTCORR`, as a yearly total), humidity (`RH2M`), wind (`WS2M`), sunlight (`ALLSKY_SFC_SW_DWN`), cloud cover (`CLOUD_AMT`) and root-zone soil moisture (`GWETROOT`) at each of the 28 places, 1985–2025 | Observatory music |
| [NOAA GML Mauna Loa](https://gml.noaa.gov/ccgg/trends/) annual mean CO₂ (not NASA; the record NASA shows on climate.nasa.gov) | Global CO₂, 1985–2025, the same at every place | Observatory music |
| [NASA GISTEMP v4](https://data.giss.nasa.gov/gistemp/) | Global monthly temperature anomaly, 2000–2010 | Acoustic Lab drone |
| NASA POWER (Cox's Bazar point file) | Monthly temperature, rain, wind, sunlight, 2000–2010 | Acoustic Lab tuning |
| Satellite imagery | Filmstrips and place images as credited in `src/filmstrip.js` and `src/region-imagery.js` (NASA GIBS / MODIS, NASA Earth Observatory, ISS photography) | Lab filmstrips, close-up map view |
| [Open Notify](http://open-notify.org/) / [wheretheiss.at](https://wheretheiss.at/) (not NASA) | Live ISS latitude and longitude | Live ISS mode |

**Rebuild the data:** `node tools/fetch-real-nasa-data.mjs` fetches everything again and rewrites `src/regions.js`. The raw responses and their sources are kept in `assets/data/real-nasa-annual.json`.

**Notes on the data**
- Values are averages over NASA POWER's roughly 50 km grid cells, not single weather stations (Everest reads about −3 °C, the cell average, not the summit).
- Tohoku and the Great Barrier Reef sit on ocean cells, so their soil moisture comes from the nearest land cell (Fukushima coast; the Herbert River catchment that drains onto the reef).
- "Amazon Deforestation Arc" uses Novo Progresso, Pará; it previously shared a grid cell with the Amazon Rainforest entry.
- 2026 is not included because the year is not complete.
- An earlier version of HEARTH used generated placeholder values (`tools/generate-global-regions.mjs`). They are no longer used; do not run that script, it would overwrite the real data.

**Not yet included** (need a NASA Earthdata login or other registration): vegetation (MODIS NDVI), groundwater (GRACE), sea level, air quality (OMI NO₂), night lights (VIIRS Black Marble), disaster counts (EM-DAT).

---

## 3. How the data becomes sound

Each value is scored two ways and blended:

```
n = 0.6 × character + 0.4 × change
character = where the value sits among Earth's climates (fixed global scale; rain on a log scale)
change    = 1 / (1 + e^(−z / 1.5)),  z = (value − mean₁₉₈₅₋₂₀₀₀) / sd₁₉₈₅₋₂₀₀₀   (that place's own baseline)
```

| Layer | Sound |
| --- | --- |
| Temperature | Melody note within the place's key (A-minor pentatonic); hotter places are also given higher keys |
| Rain | How often raindrops fall (random Poisson timing) |
| Humidity | Reverb depth |
| Wind | Wind noise, 2.5–5 kHz, right |
| Sunlight | Bell chimes |
| Cloud cover | Pad brightness and a soft haze, left |
| Soil moisture | Sub-bass, 50–100 Hz |
| CO₂ (global) | Slow detune, 0–22 cents |

**Each climate sounds different** — places are classified from their own averages:

| Climate | Places | Instrument and tempo |
| --- | --- | --- |
| Desert (rain < 350 mm) | Giza, Grand Canyon, Death Valley | Dry pluck, 56 bpm, sparse, dry wind |
| Cold / mountain (< 10 °C) | Everest, Chernobyl, Sierra Nevada, Oso, Kedarnath, Zhouqu | Glass bells, 46 bpm, wind, ice-tinkle rain |
| Coast | Tohoku, Banda Aceh, Venice, Great Barrier Reef, beaches, Cox's Bazar, Sundarbans | Soft flute, 72 bpm, surf swell |
| Rainforest (≥ 22 °C, ≥ 1750 mm) | Amazon (both), Congo, Daintree, Borneo, Wayanad | Marimba, 112 bpm, insects, heavy rain |
| Temperate / seasonal | Taj Mahal, Machu Picchu, Victoria Falls, New South Wales | Warm keys, 84 bpm |

**Listening aids**
- **Trend sweep** — when a place opens (or press `R`), its 41 yearly temperatures play as one 2.6-second run, left to right, low to high; the record-warm year rings brighter.
- **Record years** — the driest year makes the rain almost stop with a falling figure; the hottest year plays a rising shimmer; the wettest year pours.
- **Compare by ear** — compare mode plays the same short phrase for both years, A on the left and B on the right.
- **Mix** — levels in decibels, log-scaled frequencies, each layer in its own frequency band and stereo position, all in one key and chord progression.

---

## 4. Place sounds

Each place also plays an ambient sound, labelled in the app as a *field recording* or a *synthesized soundscape*:

- **Field recordings** (`assets/audio/*.ogg`): the Taj Mahal sitar (Raga Yaman), Everest howling wind, Victoria Falls waterfall and Chernobyl Geiger clicks come from Wikimedia Commons (`tools/fetch-taj-sitar.mjs`, `tools/download-targeted-audio.mjs`). The shared rain, ocean, forest-bird, rainforest, thunder, wildfire, cricket, bowl and bell loops came with the original project; their individual sources are not yet documented in this repo.
- **Synthesized soundscapes** (generated by `tools/generate-spatial-soundscapes.mjs`, `assets/audio/*.wav`): Tohoku, Banda Aceh, Chernobyl, Venice, Giza, Great Barrier Reef, Grand Canyon, Machu Picchu, Praia do Cassino, Whitehaven, Congo, Borneo, Wayanad, Kedarnath, Zhouqu, Death Valley and Sundarbans.

---

## 5. Accessibility

- **Keyboard:** `1`–`7` jump to a category · `↑`/`↓` move · `Enter` select · `←`/`→` year · `P` play/pause · `M` mute · `C` compare · `R` temperature trend · `V` voice guide · `H` high contrast · `T` guided tour · `E` export WAV · `?` read shortcuts aloud.
- **Voice guide:** switches itself on the first time you move around with the keyboard (press `V` to turn it off; the choice is remembered). It says where you are and the year's facts, e.g. "2015: 28.6 degrees, 1,168 millimetres of rain, the driest year in the record." It picks the most natural voice available and changes tone per sentence; if only basic voices exist, the accessibility menu explains how to get a better one.
- **Screen readers:** ARIA labels and live regions; each year change is announced, including any record it sets.
- **Also:** earcons for UI actions, haptic feedback on touch devices, a WCAG AAA high-contrast mode, a speech-rate selector, a live spectrum visualizer and WAV export.

---

## 6. Acoustic Lab image analysis

Each filmstrip frame is measured on a 2 px grid: brightness (Rec.709 luma), greenness (VARI = (G − R)/(G + R − B)), cloud and haze (bright, low-saturation pixels), water (clearly blue pixels), detail (Sobel gradient magnitude) and contrast. Each feature is scaled to the 5th–95th percentile of its own filmstrip, then drives filter brightness, chord colour, noise, bass and rhythm, tuned by NASA POWER climate and GISTEMP warming.

---

## 7. Running locally

```bash
node server.mjs            # Node.js 18+, serves on http://localhost:5173/
PORT=5190 node server.mjs  # custom port
```

- Observatory: `http://localhost:5173/`
- Acoustic Lab: `http://localhost:5173/studio.html`

---

## 8. Tech

Plain JavaScript ES modules · three.js r170 (vendored) and WebGL2 · Web Audio API · Web Speech API · GSAP (vendored) · Web Workers for procedural textures · a small Node.js static server.

---

## 9. Credits

- **Original architect & developer:** Kishore ([github.com/kishore1035](https://github.com/kishore1035))
- **License:** [MIT](LICENSE)
- **Data:** NASA POWER, NASA GISS (GISTEMP), NOAA GML, NASA GIBS / Worldview, NASA Earth Observatory, Wikimedia Commons recordings as listed above.
