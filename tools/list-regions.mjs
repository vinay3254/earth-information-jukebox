import { REGIONS } from '../src/regions.js';
REGIONS.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.id}] ${r.name} — ${r.group} (${r.country})`);
});
