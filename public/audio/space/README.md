# Space Audio — Earth Information Jukebox

The Space Audio system features real-time procedural sonification of the solar system, NASA planetary fact-sheet values, and helioseismic oscillations:

1. **Planet Voices**: Sustained voices mapped from orbital period (harmonic series on C), rotation rate (tremolo LFO), surface temperature (lowpass filter cutoff), atmospheric density (resonance Q), and ring structure (Saturn ring shimmer).
2. **Sun Drone**: Deep acoustic solar drone based on 3.3 mHz p-mode acoustic oscillations and 0.06 Hz convective granulation.
3. **Orbit Chimes**: Resonant FM celestial bells ringing as planets cross the zero meridian on true period ratios.
4. **Whole System Mode**: Real-time multi-channel spatialization with dynamic screen-side stereo panning (-1.0 to +1.0).

All audio synthesis is synthesized in real time via Tone.js and Web Audio without external audio sample dependencies, ensuring zero network latency, instant playback, full offline capability, and 100% data-true acoustic responsiveness.
