# HEARTH — Planetary Geospatial Sonification Observatory

**Translating 42 Years (1985–2026) of NASA Earth Observation Satellite Telemetry & Multi-Spectral Visual Frames into Real-Time Interactive Acoustic Soundscapes**

[![Author](https://img.shields.io/badge/Author-kishore1035-0B3D91?style=for-the-badge&logo=github&logoColor=white)](https://github.com/kishore1035)
[![NASA Space Apps](https://img.shields.io/badge/NASA_Space_Apps_Challenge-The_Earth_Information_Jukebox-0284C7?style=for-the-badge&logo=nasa&logoColor=white)](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
[![Runtime](https://img.shields.io/badge/Runtime-Zero_Dependencies_Vanilla_ESM_WebGL2-1E293B?style=for-the-badge)](https://github.com/kishore1035/HEARTH)
[![Acoustic Engine](https://img.shields.io/badge/Synthesis-10_Layer_Web_Audio_Graph-FF6D00?style=for-the-badge&logo=waveform&logoColor=white)](https://github.com/kishore1035/HEARTH)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG_2.2_Screen_Reader_and_Voice_Guide-7C3AED?style=for-the-badge)](https://github.com/kishore1035/HEARTH)

---

## 1. Overview & Vision

For more than four decades, space agency Earth-observing satellites have tracked our evolving biosphere in staggering visual resolution. Yet relying exclusively on visual graphs and imagery creates an accessibility divide for blind and low-vision individuals, while obscuring multi-dimensional planetary trends that the human ear can distinguish with ease.

**HEARTH** is a zero-dependency, browser-native geospatial sonification observatory that unites 3D celestial navigation, computer-vision image telemetry, and multi-timbral synthesis across two interconnected engines:

1. **The 3D Solar-to-Surface Observatory (`index.html`):**  
   Choreographs an 8-stage cinematic descent from the wide Solar System past an atmosphere-wrapped Earth onto high-resolution satellite locality plates across **28 global destinations** (Wonders of the World, Megafires, Tsunamis, Landslides, Rainforests, and Oceanic Beaches). Each destination drives a real-time **10-voice Web Audio synthesizer** spanning **1985–2026**, equipped with **authentic spatial environmental recordings** and **5-year to 40-year comparative delta ($\Delta$) auditioning**.
2. **The Acoustic Computer-Vision Lab (`studio.html`):**  
   Performs live pixel-level feature extraction on chronological NASA EIC satellite filmstrip matrices (130-month MODIS series, annual Cryosphere glacial retreat, and VIIRS wildfire smoke plumes). A hardware-clocked scanline analyzes luminance, cloud coverage, vegetation greenness, spatial edge density, and surface water in real time to drive an expressive A-minor pentatonic synthesizer.

---

## 2. NASA Space Apps Challenge Alignment: "The Earth Information Jukebox"

HEARTH was built specifically to address the core problem, objectives, and resource specifications of the **2026 NASA Space Apps Challenge — "The Earth Information Jukebox"**:

| Challenge Requirement | How HEARTH Satisfies It | Implementation Location |
| :--- | :--- | :--- |
| **Pairs EIC visual frames with dynamic sonifications in real time** | The Acoustic Lab performs real-time client-side computer-vision canvas pixel analysis on NASA EIC visual filmstrips (130 monthly frames of Cox's Bazar, 27 annual frames of Everest/Imja Glacier, 27 annual frames of Wildfires) and dynamically maps pixel density, cloud cover, and greenness into audio parameters in real time. | `studio.html`, `src/filmstrip.js`, `src/sonify.js` |
| **Interactive Jukebox interface** | Full interactive 3D Earth jukebox allowing users to select any of 28 planetary destinations, scrub 42 years of climate history (1985–2026), isolate individual sound layers, and trigger comparative time-lapse playback. | `index.html`, `src/ui.js`, `src/signal-audio.js` |
| **Musicality over noise (Consonant scales & harmonies)** | Uses an A-minor pentatonic register `[0, 3, 5, 7, 10, 12]` and pure harmonic sine/triangle foundations. Clamped warm lowpass filtering (280–850 Hz) guarantees that sounds remain cinematic, engaging, and pleasant without chaotic noise or harsh buzzing. | `src/signal-audio.js`, `src/sonify.js` |
| **Accessibility for Blind & Low-Vision Users** | Full WCAG 2.2 compliant accessibility: ARIA roles (`slider`, `option`, `group`, `aria-checked`, `aria-valuetext`), screen reader live regions, frame-by-frame speech announcements, full keyboard navigation (`Space`, `Arrows`, `Esc`), and a built-in **Web Speech API Voice Guide** that speaks climate summaries aloud. | `src/ui.js`, `studio.html` |
| **Spatial Relevance & Biome Identity** | Includes authentic CC0 spatial audio soundscapes corresponding to every destination: Amazon toucans/canopy choir for rainforests, ocean surf breakers for beaches, crackling timber embers for wildfires, torrential monsoon downpours for landslides, and sacred singing bowls for ancient wonders. | `assets/audio/`, `src/signal-audio.js` |

---

## 3. NASA EIC Resources Implemented in HEARTH

All ten featured datasets and resources from the official NASA challenge resources are directly incorporated into HEARTH:

1. **Change in Night Lights between 2012 and 2023 (EIC Version):** Integrated as Signal 9 (`nightLights`), driving a crystalline glass-harp pentatonic arpeggiator reflecting human electrification and urban expansion.
2. **Global Sea Surface Currents & Temperature:** Integrated as Signal 1 (`temperature`, MERRA-2 / MODIS SST) and Signal 6 (`seaLevel`, AVISO / Perpetual Ocean), driving wave-wash bandpass filters.
3. **GEOS Aerosols (Smoke, Dust, Atmospheric Particles):** Integrated as Signal 7 (`air`), driving bandpass wind breath filters, and in the Acoustic Lab's 27-frame Global Wildfire Smoke series.
4. **Air Quality Model Runs (SVS):** Integrated as Signal 7 (`air`, Aura OMI NO₂ and MODIS AOD).
5. **Perpetual Ocean 2: Western Boundary Currents:** Integrated as Signal 6 (`seaLevel`), creating undulating tidal sweeps across coastal regions.
6. **DYAMOND Global Carbon Dioxide:** Integrated as Signal 8 (`carbon`, DYAMOND / OCO-2 CO₂), adding subtle harmonic tension ($0\text{ to }22\text{ cents}$) across the multi-timbral pad.
7. **Lightning Events Detected from ISS (2017–2023):** Integrated as Signal 10 (`disasters`), driving punctuated percussive hits and deep exponential sub-bass drops.
8. **3D View of an Atmospheric River from an Earth System Model:** Integrated as Signal 2 (`rain`, GPM IMERG / PRECTOTCORR), driving water droplet pluck density.
9. **GEDI Forest Height:** Integrated as Signal 4 (`canopy`, NASA ISS GEDI Lidar), modulating physical convolution reverb decay length.
10. **Data Sonification: Caldwell 73 Framework:** Followed as the architectural guideline for non-linear exponential perceptual mapping.

---

## 4. 28 Planetary Destinations Across All Major Biomes

HEARTH expands beyond local telemetry to encompass 28 global frontlines:

* **Ancient & Lush Rainforests:** Amazon Rainforest Heart (Brazil), Congo Basin Primary Rainforest (DRC), Daintree Ancient Rainforest (Australia), Borneo Tropical Peat Canopy (Indonesia).
* **Huge Beaches & Ocean Coasts:** Copacabana & Ipanema Shoreline (Brazil), Praia do Cassino (Brazil, longest beach on Earth), Whitehaven Beach & Whitsundays (Australia), Cox’s Bazar (Bangladesh), Venice Lagoon (Italy), Great Barrier Reef (Australia).
* **Megafires & Wildfires:** Pacific Northwest & California Wildfires (USA), NSW & Southeast Australia Black Summer (Australia), Amazon Basin Deforestation Arc (Brazil).
* **Catastrophic Landslides & Mountain Disasters:** Wayanad Megalandslide Frontline (India), Oso Landslide Disaster (USA), Kedarnath Glacial Debris Surge (India), Zhouqu Loess Mudslide Disaster (China).
* **Wonders of the World:** Great Pyramid of Giza (Egypt), Taj Mahal & Yamuna Basin (India), Mount Everest & Khumbu Glacier (Nepal), Grand Canyon & Lake Mead (USA), Machu Picchu & Andean Cloud Forest (Peru), Victoria Falls & Zambezi (Zambia/Zimbabwe).
* **Critical Biosphere Frontlines:** Tohoku Coast & Fukushima (Japan), Banda Aceh Tsunami Coast (Indonesia), Chernobyl Exclusion Zone (Ukraine), Sundarbans Mangrove Delta (Bangladesh/India), Death Valley Thermal Basin (USA).

---

## 5. Acoustic Synthesis Architecture (`src/signal-audio.js`)

| # | Environmental Layer | Sensor / Model Source | Physical Range & Unit | Real-Time Web Audio Synthesis Behavior |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Surface Temperature** (`T2M_C`) | NASA POWER / MERRA-2 | $10.0\text{ to }40.0^\circ\text{C}$ | **Celestial Sine Lead:** Octave glide $f = 164.81 \times 3^{\frac{T-10}{30}}\text{ Hz}$ with $0.65\text{ Hz}$ chorused drift. |
| **2** | **Precipitation** (`PRECTOTCORR_mm`) | NASA POWER / GPM IMERG | $0\text{ to }6,000\text{ mm/yr}$ | **Organic Water Droplet Plucks:** Pure sine droplets ($0.3\text{--}5.5\text{ drops/sec}$) across an A-minor pentatonic register. |
| **3** | **Vegetation Greenness** (`NDVI`) | NASA MODIS / VIIRS | $0.10\text{ to }0.90\text{ index}$ | **Harmonic Ambient Pad:** 4-voice pure sine/triangle pad (A2, E3, A3, E4) filtered through warm lowpass ($280\text{--}800\text{ Hz}$). |
| **4** | **Canopy Height** (`GEDI_canopy_m`) | NASA ISS GEDI Lidar | $2.0\text{ to }20.0\text{ m}$ | **Convolution Reverb Wet Mix:** Direct send ($0.08\text{--}0.65$). Deep canopies reverberate in lush space. |
| **5** | **Groundwater & Ice Mass** (`GRACE_ewh_cm`) | NASA GRACE / GRACE-FO | $-20.0\text{ to }+15.0\text{ cm EWH}$ | **Sub-Bass Foundation Drone:** Pure $45\text{--}80\text{ Hz}$ sine drone providing acoustic depth. |
| **6** | **Sea-Level Anomaly** (`SEA_LEVEL_mm`) | NASA Sea Level Change | $0.0\text{ to }250.0\text{ mm}$ | **Coastal Wave-Wash Sweep:** Bandpass noise ($240\text{--}690\text{ Hz}$) modulated by a $0.12\text{ Hz}$ tidal LFO. |
| **7** | **Air Quality** (`AIR_AOD_NO2_index`) | NASA Aura OMI & MODIS AOD | $10.0\text{ to }100.0\text{ index}$ | **Wind Breath Filter:** Bandpass noise ($900\text{--}1,500\text{ Hz}$) creating natural atmospheric respiration. |
| **8** | **Atmospheric Carbon** (`CO2_ppm`) | NASA OCO-2 / OCO-3 | $340.0\text{ to }435.0\text{ ppm}$ | **Greenhouse Detune:** Adds $0\text{ to }+22\text{ cents}$ detune across voices to express atmospheric greenhouse tension. |
| **9** | **Nighttime Lights** (`NIGHT_LIGHTS_nW`) | NASA Black Marble VIIRS | $0.0\text{ to }100.0\text{ nW/cm}^2/\text{sr}$ | **Glass Celesta Chimes:** Sine-wave pentatonic arpeggiations ($1.2\text{--}6.2\text{ steps/sec}$) reflecting electrification. |
| **10**| **Disasters & Wildfires** (`EXTREME_EVENTS`) | NASA FIRMS VIIRS | $0\text{ to }30+\text{ events/yr}$ | **Atmospheric Percussion:** Filtered noise bursts paired with $65 \to 38\text{ Hz}$ exponential sub-thump bass drums. |
| **11**| **Dedicated Spatial Soundscapes** | Field Recordings & Physical Modeling | Continuous Biome Ambiance | **28 Distinct Authentic Soundscapes:** Every location has its dedicated spatial acoustic environment—including classical evening sitar Raga Yaman over the Yamuna River for Taj Mahal, whistling concrete ruins and Geiger radiation clicks for Chernobyl, 8,000m sub-zero blizzard gales for Mount Everest, roaring cataract white water for Victoria Falls, Adriatic canal lapping with distant bells for Venice, and torrential Western Ghats monsoon cloudbursts for Wayanad. |

### Dedicated Soundscapes Across All 28 Planetary Destinations

| Biome & Category | Destination | Authentic Spatial Acoustic Environment | Source / Modeling |
| :--- | :--- | :--- | :--- |
| **Wonders of the World** | **Taj Mahal & Yamuna Basin** | Sacred evening Sitar Raga Yaman & serene Yamuna riverbank waters *(pure classical sitar, zero outdoor bird chirping artifacts)* | Classical Indian Sitar (CC BY-SA 3.0) |
| | **Great Pyramid of Giza** | Sahara desert wind howling across ancient limestone corridors | Procedural biquad acoustic resonance |
| | **Mount Everest & Khumbu** | 8,000m sub-zero Himalayan alpine blizzard gale | High-altitude Khumbu gale recording |
| | **Victoria Falls & Zambezi** | Mosi-oa-Tunya cataract roar & massive white-water deluge | Zambezi cataract field recording |
| | **Grand Canyon & Lake Mead** | Colorado River gorge wind whistling through cavernous red-rock amphitheaters | Cavernous acoustic DSP delay network |
| | **Machu Picchu & Andes** | Misty Andean cloud forest breeze with breathy Quena flute tone | Andean highland acoustic modeling |
| | **Great Barrier Reef** | Coral Sea reef lagoon hydrophone clicks & submerged tropical swell | Marine hydrophone acoustic model |
| **Major Incidents & Tsunamis**| **Chernobyl Exclusion Zone** | Pripyat concrete ruins howling wind & authentic Geiger counter radiation clicks | Field Geiger counter recording & wind |
| | **Tohoku & Fukushima Coast** | Pacific tsunami surge crashing against concrete seawalls & offshore warning buoy | Ocean surge & marine bell synthesis |
| | **Banda Aceh Shoreline** | Heavy Indian Ocean tropical surf breakers rolling onto rebuilt coast | Low-frequency tropical surf synthesis |
| | **Venice Lagoon** | Venetian canal water gently lapping stone quays with distant Italian church bells | Adriatic canal & campanile modeling |
| **Megafires & Wildfires** | **Pacific NW & California** | Sierra Nevada pine forest crown fire roar & timber crackle | Forest wildfire recording |
| | **NSW & SE Australia** | Black Summer eucalyptus bushfire frontline & ember gale | Catastrophic bushfire recording |
| | **Amazon Basin & Pantanal** | Burning timber arc & dense smoke thermal updrafts | Deforestation fire bed |
| **Catastrophic Landslides** | **Wayanad Megalandslide** | Torrential Western Ghats monsoon cloudburst & surging mountain mud torrent | Monsoon deluge & debris roar synthesis |
| | **Kedarnath Glacial Debris** | Mandakini Valley roaring glacial flood & boulder-choked river rapids | Glacial flood white-water modeling |
| | **Oso Landslide Disaster** | Pacific Northwest heavy valley downpour & distant thunder roll | Rainstorm & thunder acoustic bed |
| | **Zhouqu Loess Mudslide** | Bailong River mountain canyon mud torrent & torrential rainfall | Mountain mudflow acoustic modeling |
| **Huge Oceanic Beaches** | **Praia do Cassino** | Continuous 240km South Atlantic heavy rolling ocean roar | Sub-bass oceanic swell synthesis |
| | **Cox’s Bazar Beach** | Bay of Bengal 120km unbroken intertidal surf & coastal breeze | Bay of Bengal surf loop |
| | **Copacabana & Ipanema** | Atlantic shoreline rolling crescent breakers | Coastal wave surge bed |
| | **Whitehaven Beach** | Gentle turquoise water ripples washing over 98% pure silica sand | High-frequency silica sand wash |
| **Great Rainforests** | **Amazon Rainforest Heart** | Dense equatorial primary canopy wildlife choir & warm tropical rainfall | Primary rainforest field recording |
| | **Congo Basin Rainforest** | Deep nocturnal equatorial rainforest insect chorus & dense canopy drips | Deep jungle nocturnal chorus |
| | **Daintree Tropical Rainforest**| 135-million-year-old ancient tropical canopy breeze & flowing mossy creek | Ancient wet-tropics birds & stream |
| | **Borneo Peat Swamp Canopy** | Ancient equatorial peat swamp treefrog chorus & warm tropical mist | Peat swamp treefrog soundscape |
| **Critical Biosphere** | **Sundarbans Mangrove Delta** | Swirling mangrove tidal delta waters & Bay of Bengal sea breeze | Estuarine tidal wash synthesis |
| | **Death Valley Thermal Basin** | Scorching Badwater Basin thermal silence & shimmering arid heat drafts | Ultra-low arid wind drift synthesis |

---

## 6. Multi-Sensory Superpowers & Inclusive Accessibility

To ensure every user—including completely blind, legally blind, low-vision, neurodivergent, and motor-impaired individuals—can experience the planetary jukebox with total autonomy, HEARTH includes a comprehensive multi-sensory accessibility suite:

### 1. "Blind Explorer" Direct Keypad Navigation
Operate the entire planetary jukebox without requiring mouse or pointer interaction:
* **Keypad `1`–`7`**: Jump directly across biome categories:
  * `1`: Major Incidents & Tsunamis (Chernobyl, Fukushima, Banda Aceh)
  * `2`: Megafires & Wildfires (California, Amazon, Black Summer)
  * `3`: Wonders of the World (Pyramids, Taj Mahal, Everest, Grand Canyon)
  * `4`: Huge Beaches & Coastal Sands (Copacabana, Praia do Cassino, Bondi, Cox's Bazar)
  * `5`: Great Rainforests of Earth (Amazon, Congo, Daintree, Borneo)
  * `6`: Catastrophic Landslides (Wayanad, Oso, Kedarnath, Zhouqu)
  * `7`: Critical Biosphere Frontlines (Sundarbans, Death Valley)
* **`P`**: Toggle audio playback (Play / Pause).
* **`M`**: Mute / Unmute planetary audio.
* **`C`**: Start / Stop 40-year benchmark comparative auditioning.
* **`V`**: Trigger spoken climate telemetry summary aloud.
* **`H`**: Toggle WCAG 2.2 AAA Ultra-High Contrast Mode.
* **`T`**: Start / Stop the 2-Minute Guided Audio Story Tour.
* **`E`**: 1-Click high-fidelity 16-bit PCM WAV audio export.
* **`?`**: Read keyboard shortcuts aloud via Speech Synthesis.
* **`←` / `→`**: Scrub listening year backward and forward (1985–2026).

### 2. Auditory UI "Earcons" (Acoustic Feedback Engine)
Non-visual acoustic cues synthesized instantaneously using Web Audio:
* **Enable Ping:** Ascending sine chime ($C_5 \to G_5$, $523 \to 784\text{ Hz}$) when a sound layer is activated.
* **Disable Tone:** Descending gentle tone ($G_5 \to C_5$, $784 \to 523\text{ Hz}$) when a layer is muted.
* **Slider Tick:** $1,200\text{ Hz}$ bandpass-filtered micro-click for every annual year step.
* **Select Chime:** Celestial double-bell arpeggio ($D_5 \to A_5$, $587 \to 880\text{ Hz}$) on destination selection.
* **Disaster Rumble:** Deep resonant sub-rumble ($70 \to 40\text{ Hz}$) alerting to extreme events and wildfires.

### 3. Tactile / Haptic Vibration Feedback (`navigator.vibrate`)
Physical feedback for touchscreens, mobile phones, tablets, and supported game controllers:
* **Milestone Scrub Pulse:** Double-pulse `[30ms, 25ms, 30ms]` across benchmark years (1985, 2000, 2025, 2026).
* **Disaster Rumble Pulse:** Heavy tremor pattern `[90ms, 40ms, 90ms]` upon selecting catastrophe zones.
* **Micro-Click Tick:** Short `14ms` tactile click on slider steps and button toggles.

### 4. WCAG 2.2 AAA Ultra-High Contrast Mode
Engineered specifically for macular degeneration, low vision, and cataract conditions:
* **Pure Black Background:** `#000000` eliminates backlight glare and eye strain.
* **Laser Neon Yellow:** `#FFEE00` text providing an exceptional 21:1 contrast ratio (exceeding WCAG AAA 7:1).
* **Electric Cyan Accents:** `#00FFFF` active indicators with 3px solid high-visibility focus rings.
* Instant toggle via the **`H`** key or Accessibility Settings panel.

### 5. Screen-Reader Power User Voice & Speech Rate Selector
* Configurable speech rate dropdown ($0.75\times$, $1.0\times$ standard, $1.25\times$, $1.5\times$, and $2.0\times$ power-user speed).
* System voice selection dropdown enumerating installed TTS voices.
* Preferences persist across sessions via `localStorage`.

### 6. Live Canvas Audio Visualizer / Frequency Wave HUD
* Real-time 24-band frequency spectrum and smooth oscilloscope center wave powered by `AnalyserNode` ($64\text{ FFT}$).
* Responsive HiDPI Canvas rendering synchronized with audio playback.

### 7. 1-Click High-Fidelity WAV Audio Exporter
* Captures 6 seconds of live sonification (synthesizer + spatial environment) directly from master user gain.
* Encodes into uncompressed 16-bit stereo 44.1kHz PCM RIFF `.wav` files with zero compression artifacts.
* Automatic browser download with descriptive filenames (e.g. `HEARTH_Amazon_Rainforest_Heart_1985.wav`).

### 8. 2-Minute Guided Audio Story Tour
* Automated 5-stop planetary journey across the globe (Amazon Rainforest, California Wildfires, Wayanad Landslides, Copacabana Coastal Sands, Taj Mahal).
* Synchronized camera flight, 40-year comparative time scrubbing, and narrated voice storytelling.

---

## 7. Running Locally

HEARTH runs natively in any modern web browser without requiring a bundler, build step, or package manager:

```bash
# Start local server (Node.js 18+)
node server.mjs

# Custom port
PORT=5174 node server.mjs
```

Open your browser to:
* **Observatory:** `http://localhost:5174/`
* **Acoustic Lab:** `http://localhost:5174/studio.html`

---

## 8. Author & Attribution

* **Architect & Developer:** **Kishore** ([GitHub @kishore1035](https://github.com/kishore1035))
* **License:** Released under the [Apache-2.0 License](LICENSE).
* **Data & Imagery:** Courtesy of the **NASA Earth Information Center (EIC)**, **NASA SVS**, **NASA POWER**, **USGS/NASA Landsat**, **MODIS/VIIRS**, and **NASA ISS Astronaut Photography**.
