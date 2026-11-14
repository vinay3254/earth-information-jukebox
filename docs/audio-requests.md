# Audio Package Requests

This document tracks package requests submitted to the project lead by audio agents.
Ground rules: Do NOT edit `package.json` or run `npm install` directly; all code should use guarded dynamic imports.

---

## Research Agent Requests

### `@tonaljs/tonal`
- **Package:** `@tonaljs/tonal`
- **Exact Version:** `4.13.0`
- **Size:** 447 KB unpacked (~82 KB tarball)
- **License:** MIT
- **Why:** Algorithmic music theory engine for scale snapping, modal harmonization (Pentatonic, Dorian, Lydian), note-to-frequency math, and interval transposition. Simplifies dynamic scale switching across climate regions without manual array mapping.
- **Usage Strategy:** Optional / progressive enhancement behind guarded dynamic import (`await import('@tonaljs/tonal')`) with static fallback to existing `src/datasynth/scales.js`.
