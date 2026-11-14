# The Earth Information Jukebox - NASA Space Apps Challenge

This directory contains offline backups, full screenshots, dataset breakdowns, and project architecture for **The Earth Information Jukebox** challenge from the NASA Space Apps Challenge.

---

## 📁 Downloaded Offline Files & Backups

All materials have been downloaded and saved locally in this folder:
- **Challenge Details Page (Full HTML):** [`challenge_details.html`](file:///home/vinay/earth-information-jukebox/challenge_details.html)
- **Challenge Details View (Full Page Screenshot):** [`challenge_details_screenshot.png`](file:///home/vinay/earth-information-jukebox/challenge_details_screenshot.png)
- **Challenge Resources Page (Full HTML):** [`challenge_resources.html`](file:///home/vinay/earth-information-jukebox/challenge_resources.html)
- **Challenge Resources View (Full Page Screenshot):** [`challenge_resources_screenshot.png`](file:///home/vinay/earth-information-jukebox/challenge_resources_screenshot.png)

---

## 🌍 Problem Statement Overview

### The Core Goal
Build an **"Earth Jukebox"**—an interactive interface, script, or application that pairs NASA Earth Information Center (EIC) visual frames with dynamic **sonifications generated in real time**.

### Background & Context
NASA's Earth Information Center (EIC) produces stunning visualizations tracking planetary dynamics: shifting temperatures, ocean currents, wildfires, melting ice, and atmospheric aerosols. However, presenting this information exclusively through visual graphics creates a major accessibility gap for blind and low-vision individuals. 

**Data Sonification** (translating data into non-speech audio) transforms visual elements into multi-sensory soundscapes. It not only enables accessibility but also reveals hidden rhythmic patterns and anomalies that visual inspection might miss.

---

## 🎯 Objectives & Deliverables

1. **Sight-to-Sound Translation:** Convert visual attributes (color spectra, pixel intensity, coordinates, frames) or time-series data into musical elements (pitch, tempo, timbre, chords, volume).
2. **Interactive Jukebox UI / Curated Player:**
   - Develop an interactive tool (web app, desktop GUI, or script) where users can choose an Earth dataset and listen in real-time.
   - Alternatively, deliver a curated series of generated audio files telling the auditory story of Earth changes with documented methodology.
3. **Accessibility First:** Support screen readers, keyboard navigation, and provide descriptive narrative text accompanying the audio.

---

## 📊 Complete Breakdown of NASA's 11 Official Challenge Resources

Every single resource page has been downloaded and archived locally in [`resources/`](file:///home/vinay/earth-information-jukebox/resources) so you can read them without network timeouts:

| # | Resource & Offline File | Online URL | NASA Suggested Use Case & Sonification Strategy |
|---|---|---|---|
| 1 | **[01_earth_information_center_gallery.md](file:///home/vinay/earth-information-jukebox/resources/01_earth_information_center_gallery.md)** | [NASA SVS Gallery](https://svs.gsfc.nasa.gov/gallery/earth-information-center/) | Core baseline visual repository (SVS gallery used for EIC dashboards). Provides video and image datasets for frame-by-frame sound generation. |
| 2 | **[02_caldwell_73_sonification.md](file:///home/vinay/earth-information-jukebox/resources/02_caldwell_73_sonification.md)** | [NASA SVS 13786](https://svs.gsfc.nasa.gov/13786/) | **Reference Model:** NASA's sonification by SYSTEM Sounds (Hubble data). Demonstrates radar-sweep mapping: distance from center $\to$ pitch; red/orange stars $\to$ marimba; blue stars $\to$ glockenspiel; background $\to$ choir. |
| 3 | **[03_night_lights_2012_2023.md](file:///home/vinay/earth-information-jukebox/resources/03_night_lights_2012_2023.md)** | [NASA SVS 5313](https://svs.gsfc.nasa.gov/5313/) | NASA Black Marble dataset. High visual contrast between dark regions and illuminated cities. Ideal for mapping pixel intensity/luminance to tempo or volume. |
| 4 | **[04_sea_surface_currents_temp.md](file:///home/vinay/earth-information-jukebox/resources/04_sea_surface_currents_temp.md)** | [NASA SVS 3912](https://svs.gsfc.nasa.gov/3912/) | Continuous fluid movement and thermal gradients. Suited for fluid, ambient synthesis where water speed controls filter cutoffs and temperature controls pitch. |
| 5 | **[05_geos_aerosols.md](file:///home/vinay/earth-information-jukebox/resources/05_geos_aerosols.md)** | [NASA SVS 5669](https://svs.gsfc.nasa.gov/5669/) | Tracks atmospheric plumes (smoke, sea salt, dust, sulfates). Ideal for multi-track audio where each particle type triggers a distinct instrument or acoustic texture. |
| 6 | **[06_air_quality_model_runs.md](file:///home/vinay/earth-information-jukebox/resources/06_air_quality_model_runs.md)** | [NASA SVS 5533](https://svs.gsfc.nasa.gov/5533/) | High-resolution frames of atmospheric chemistry. Best for computer vision algorithms that map color palettes and pixel densities into sound profiles. |
| 7 | **[07_perpetual_ocean_2.md](file:///home/vinay/earth-information-jukebox/resources/07_perpetual_ocean_2.md)** | [NASA SVS 5425](https://svs.gsfc.nasa.gov/5425/) | High-contrast visual maps of oceanic boundary flows. Great for rhythm extraction and harmonic scale shifts aligned with current directions. |
| 8 | **[08_dyamond_co2.md](file:///home/vinay/earth-information-jukebox/resources/08_dyamond_co2.md)** | [NASA SVS 5196](https://svs.gsfc.nasa.gov/5196/) | Global $CO_2$ seasonal rise and fall over time. Prime candidate for driving the main synthesizer lead in the jukebox. |
| 9 | **[09_iss_lightning_events.md](file:///home/vinay/earth-information-jukebox/resources/09_iss_lightning_events.md)** | [NASA SVS 5011](https://svs.gsfc.nasa.gov/5011/) | Space-detected lightning flashes. Perfectly suited for punctuated, percussive beats or snare/cymbal triggers corresponding to lightning bursts. |
| 10 | **[10_atmospheric_river_3d.md](file:///home/vinay/earth-information-jukebox/resources/10_atmospheric_river_3d.md)** | [NASA SVS 4960](https://svs.gsfc.nasa.gov/4960/) | 3D moisture corridors. Extract frames to map moisture thickness and atmospheric spread into stereo/spatial soundscapes. |
| 11 | **[11_gedi_forest_height.md](file:///home/vinay/earth-information-jukebox/resources/11_gedi_forest_height.md)** | [NASA SVS 4950](https://svs.gsfc.nasa.gov/4950/) | Canopy elevation maps. Color gradients signify tree height and biomass density; easily mapped to pitch scales or harmonic frequencies. |

---

## 🛠️ Recommended Tech Stack & Architecture

- **Frontend / Jukebox UI:** Next.js / Vite + React / Vanilla JS with Tailwind CSS or retro Jukebox styling.
- **Audio Synthesis:**
  - In-browser: **Web Audio API**, **Tone.js** (synthesizers, polyphony, filters, delay).
  - Python / Backend: **Mido / PyDub / NumPy / SciPy** or **Music21**.
- **Visual Processing:** **Canvas API** / **OpenCV (Python or OpenCV.js)** for pixel luminance, RGB histograms, and optical flow vector calculation.
