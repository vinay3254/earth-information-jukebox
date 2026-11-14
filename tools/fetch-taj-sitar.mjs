import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const metaUrl = 'https://commons.wikimedia.org/w/api.php?action=query&titles=File:Sitar%20sample%20yaman.ogg&prop=imageinfo&iiprop=url&format=json';
  const res = await fetch(metaUrl, { headers: { 'User-Agent': 'HEARTH-Audio/1.0 (kishore1035@github)' } });
  const data = await res.json();
  const pages = data?.query?.pages || {};
  const first = Object.keys(pages)[0];
  const downloadUrl = pages[first]?.imageinfo?.[0]?.url;
  console.log('Download URL:', downloadUrl);

  if (downloadUrl) {
    const fileRes = await fetch(downloadUrl, { headers: { 'User-Agent': 'HEARTH-Audio/1.0 (kishore1035@github)' } });
    const buf = Buffer.from(await fileRes.arrayBuffer());
    const dest = path.join(__dirname, '../assets/audio/taj-sitar-yaman.ogg');
    fs.writeFileSync(dest, buf);
    console.log(`Saved taj-sitar-yaman.ogg (${(buf.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch(console.error);
