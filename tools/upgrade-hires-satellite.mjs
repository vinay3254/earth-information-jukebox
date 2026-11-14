import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEXTURE_DIR = path.resolve(__dirname, '../assets/textures');

// High-resolution satellite plates for planetary destinations (1280x1280, 0 watermarks)
const HIGH_RES_TARGETS = [
  {
    id: 'taj_mahal',
    file: 'taj-mahal-satellite.jpg',
    // 27.175°N, 78.042°E (Taj Mahal, Yamuna river, Mehtab Bagh, Agra Fort)
    bbox: '78.028,27.163,78.058,27.188',
    label: 'High-Resolution Satellite · Taj Mahal, Yamuna River & Charbagh Complex',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'grand_canyon',
    file: 'grand-canyon-satellite.jpg',
    // 36.107°N, 112.113°W (Grand Canyon South Rim, Colorado River, Desert View)
    bbox: '-112.165,36.060,-112.060,36.155',
    label: 'High-Resolution Satellite · Grand Canyon & Colorado River Gorge',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'wayanad',
    file: 'wayanad-landslide-satellite.jpg',
    // 11.52°N, 76.13°E (Wayanad Western Ghats, Chooralmala, Meppadi valley)
    bbox: '76.085,11.480,76.185,11.570',
    label: 'High-Resolution Satellite · Wayanad Western Ghats Escarpment & Valley',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'whitehaven_beach',
    file: 'whitehaven-beach-satellite.jpg',
    // 20.283°S, 149.040°E (Whitehaven Beach, Hill Inlet silica swirls, Whitsunday Island)
    bbox: '149.010,-20.315,149.075,-20.250',
    label: 'High-Resolution Satellite · Whitehaven Beach & Hill Inlet Silica Barrier',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'kedarnath',
    file: 'kedarnath-landslide-satellite.jpg',
    // 30.735°N, 79.067°E (Kedarnath temple, Mandakini river, Chorabari glacier moraine)
    bbox: '79.040,30.710,79.095,30.760',
    label: 'High-Resolution Satellite · Kedarnath Valley & Himalayan Glacial Moraine',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'zhouqu',
    file: 'zhouqu-landslide-satellite.jpg',
    // 33.78°N, 104.37°E (Zhouqu Bailong river mountain canyon)
    bbox: '104.335,33.750,104.410,33.815',
    label: 'High-Resolution Satellite · Zhouqu Mountain Canyon & Bailong River',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'banda_aceh',
    file: 'banda-aceh-satellite.jpg',
    // 5.548°N, 95.324°E (Banda Aceh tsunami coast, Ulee Lheue harbor, Aceh river mouth)
    bbox: '95.285,5.515,95.365,5.590',
    label: 'High-Resolution Satellite · Banda Aceh Coastal Margin & River Estuary',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'daintree',
    file: 'daintree-rainforest-satellite.jpg',
    // 16.17°S, 145.42°E (Daintree River mouth, Cape Tribulation primary tropical canopy)
    bbox: '145.370,-16.220,145.470,-16.120',
    label: 'High-Resolution Satellite · Daintree Ancient Rainforest Canopy & Coral Coast',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'borneo',
    file: 'borneo-rainforest-satellite.jpg',
    // 0.96°N, 114.55°E (Heart of Borneo tropical rainforest river system)
    bbox: '114.480,0.890,114.620,1.030',
    label: 'High-Resolution Satellite · Heart of Borneo Tropical Peat Swamp & Rainforest',
    credit: 'High-Resolution Planetary Earth Observation'
  },
  {
    id: 'congo',
    file: 'congo-rainforest-satellite.jpg',
    // 0.50°S, 18.20°E (Congo Basin primary rainforest river meanders)
    bbox: '18.120,-0.570,18.280,-0.430',
    label: 'High-Resolution Satellite · Congo Basin Primary Rainforest River System',
    credit: 'High-Resolution Planetary Earth Observation'
  }
];

async function downloadPlate(target) {
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${target.bbox}&bboxSR=4326&imageSR=4326&size=1280,1280&format=jpg&f=image`;
  console.log(`Downloading high-res satellite plate: ${target.file}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 50000) throw new Error(`Buffer too small: ${buf.length} bytes`);
    const filePath = path.join(TEXTURE_DIR, target.file);
    fs.writeFileSync(filePath, buf);
    console.log(`✓ Saved ${target.file} (${(buf.length / 1024).toFixed(1)} KB) - Crystal clear!`);
    return true;
  } catch (err) {
    console.error(`✗ Failed ${target.file}:`, err.message);
    return false;
  }
}

async function main() {
  console.log(`Upgrading ${HIGH_RES_TARGETS.length} plates to crystal-clear high resolution...`);
  for (const target of HIGH_RES_TARGETS) {
    await downloadPlate(target);
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log('All high-resolution satellite plates upgraded!');
}

main();
