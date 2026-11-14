# Audio Credits — Earth Information Jukebox (Earth Sound System)

All samples in `public/audio/earth/` are licensed under Creative Commons Attribution (CC-BY 3.0) or Apache 2.0 / Public Domain.

## 1. Concert Harp (`public/audio/earth/harp/*.mp3`)
- **Source**: `https://github.com/nbrosowsky/tonejs-instruments` (sample library: `samples/harp`)
- **Original Audio**: Versilian Studios Chamber Orchestra 2: Community Edition (VSCO-2 CE) / Karoryfer / Freesound
- **License**: Creative Commons Attribution 3.0 Unported (CC-BY 3.0)
- **Modifications**: Normalized, trimmed, encoded to high-efficiency MP3 for web streaming.
- **Used for**: Precipitation voice (`precipMm`) plucked note density (liquid raindrops and downpours).

## 2. Concert Flute / Lead (`public/audio/earth/lead/*.mp3`)
- **Source**: `https://github.com/nbrosowsky/tonejs-instruments` (sample library: `samples/flute`)
- **Original Audio**: Versilian Studios Chamber Orchestra 2: Community Edition (VSCO-2 CE)
- **License**: Creative Commons Attribution 3.0 Unported (CC-BY 3.0)
- **Modifications**: Normalized, trimmed, pitch-centered, encoded to MP3.
- **Used for**: Temperature melodic lead voice (`tempC`), expressing atmospheric warmth and breath.

## 3. Acoustic Impulse Responses (`public/audio/earth/ir/*.mp3`)
- **Source**: `https://github.com/Tonejs/audio/tree/master/impulse-responses` & `https://github.com/cwilso/web-audio-samples`
- **Authors**: Chris Wilson (W3C Web Audio Chair) & Tone.js team
- **License**: Apache 2.0 / Public Domain
- **Files**:
  - `hall.mp3`: Warm concert hall convolution impulse response.
  - `diffusor.mp3`: Acoustic diffusor stereo impulse response.
- **Used for**: Convolution Reverb (`Tone.Convolver`), driven by regional Humidity (`humidity`).
