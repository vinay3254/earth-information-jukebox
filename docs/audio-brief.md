# Audio sprint brief (shared by all audio agents)

Project: `/home/vinay/earth-information-jukebox`. Read `DESIGN.md` first; it describes the app, the three views, every sound mapping and the audio chain.

Goal: make every sound in the app richer, more musical and more informative, while staying **data-true** (sound only changes because the data changed) and **safe** (no clipping, nothing harsh or startling for headphone listeners).

## Ground rules

- Own only your files (listed in your prompt). Other agents work in parallel on the others.
- Do NOT edit `index.html`, `src/main.js`, `src/style.css`, `src/ui/**` (the lead builds all UI). If you need a UI control, describe it in your report: name, type, which function it calls.
- Do NOT edit `package.json` or run `npm install`. If you need a package, write the request (package, exact version, why) into `docs/audio-requests.md` (append, one section per agent) and code against it behind a guarded dynamic import so the app still runs without it.
- Do NOT use any browser MCP tools (playwright etc.); they block on permission prompts. Test with Node scripts or the shared harness in `scripts/audio-eval/` (owned by the eval agent).
- Do not git commit. Never invent data values.
- Keep public APIs backward compatible (signatures in DESIGN.md §4 and the files themselves). New features = new optional methods.

## Reachable from this network (verified)

npm registry, cdn.jsdelivr.net, unpkg.com, raw.githubusercontent.com (e.g. nbrosowsky/tonejs-instruments samples), tonejs.github.io/audio (Salamander piano), huggingface.co, freesound.org, storage.googleapis.com/magentadata (Magenta.js checkpoints). NOT reachable: svs.gsfc.nasa.gov, solarsystemscope.com.

Prefer **downloading samples into `public/audio/<your-area>/`** (small: mp3/ogg, total under 8 MB per area, with a `CREDITS.md` listing source URL + license; only CC0/CC-BY/public domain) over loading from CDNs at runtime, so the site works offline and on GitHub Pages.

## Loudness targets (the eval agent measures these)

- True peak at output ≤ 0.8 (−2 dBFS); never ≥ 1.0.
- Each mode playing on its own sits roughly −20 to −16 LUFS-ish (similar perceived loudness across modes).
- Pause / stop reaches silence within 0.5 s.
- No sudden onsets louder than 6 dB above the running level.

## Report format (print at the end)

Files written · what changed and why (one line per sound) · how to hear it · numbers from the eval harness · requests for the lead (UI controls, packages).
