import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.resolve(__dirname, '../assets/audio');

async function downloadFile(title, outName) {
  const metaUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
  const metaRes = await fetch(metaUrl, { headers: { 'User-Agent': 'HEARTH-AudioBot/1.0 (kishore1035@github)' } });
  const meta = await metaRes.json();
  const pages = meta?.query?.pages || {};
  const first = Object.keys(pages)[0];
  const downloadUrl = pages[first]?.imageinfo?.[0]?.url;
  if (!downloadUrl) throw new Error(`No URL for ${title}`);

  console.log(`Downloading ${outName}...`);
  await new Promise(r => setTimeout(r, 1200));
  const fileRes = await fetch(downloadUrl, { headers: { 'User-Agent': 'HEARTH-AudioBot/1.0 (kishore1035@github)' } });
  if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
  const buf = Buffer.from(await fileRes.arrayBuffer());
  const dest = path.join(AUDIO_DIR, outName);
  fs.writeFileSync(dest, buf);
  console.log(`✓ Saved ${outName} (${(buf.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  const items = [
    { title: 'File:Geiger calm.ogg', out: 'chernobyl-geiger.ogg' },
    { title: 'File:Water fall.ogg', out: 'victoria-waterfall.ogg' },
    { title: 'File:Seggiano middayring.ogg', out: 'venice-bells.ogg' },
    { title: 'File:Howling wind.ogg', out: 'everest-howling-wind.ogg' }
  ];

  for (const it of items) {
    try {
      await downloadFile(it.title, it.out);
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.warn(`Failed ${it.out}:`, e.message);
    }
  }
  console.log('All downloads finished!');
}

main().catch(console.error);
