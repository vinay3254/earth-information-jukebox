import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEXTURE_DIR = path.resolve(__dirname, '../assets/textures');

const PLATES = [
  {
    id: 'chernobyl',
    filename: 'chernobyl-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/ISS-57_Chernobyl_Nuclear_Power_Plant%2C_Ukraine.jpg/1280px-ISS-57_Chernobyl_Nuclear_Power_Plant%2C_Ukraine.jpg',
    label: 'NASA ISS-57 Astronaut Photography · Chernobyl Reactor & Exclusion Zone',
    credit: 'NASA Johnson Space Center Earth Observation (ISS-57)'
  },
  {
    id: 'pyramids_giza',
    filename: 'pyramids-giza-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/ISS-32_Pyramids_at_Giza%2C_Egypt.jpg/1280px-ISS-32_Pyramids_at_Giza%2C_Egypt.jpg',
    label: 'NASA ISS-32 Astronaut Photography · Great Pyramids at Giza & Nile Margin',
    credit: 'NASA JSC Earth Science and Remote Sensing Unit'
  },
  {
    id: 'taj_mahal',
    filename: 'taj-mahal-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Agra_India_EO.jpg/1280px-Agra_India_EO.jpg',
    label: 'NASA Earth Observatory & ASTER · Taj Mahal & Yamuna River Floodplain',
    credit: 'NASA/GSFC/METI/ERSDAC/JAROS and U.S./Japan ASTER Science Team'
  },
  {
    id: 'great_barrier_reef',
    filename: 'great-barrier-reef-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/GreatBarrierReef-EO.JPG/1280px-GreatBarrierReef-EO.JPG',
    label: 'NASA Earth Observatory · Great Barrier Reef Marine Coral System',
    credit: 'NASA Earth Observatory / Landsat'
  },
  {
    id: 'grand_canyon',
    filename: 'grand-canyon-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Grand_Canyon_Landsat.jpg/1280px-Grand_Canyon_Landsat.jpg',
    label: 'NASA Landsat & USGS · Grand Canyon & Colorado River Plateau',
    credit: 'NASA Goddard / USGS'
  },
  {
    id: 'amazon_basin',
    filename: 'amazon-rainforest-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Amazon_deforestation_NASA.jpg/1280px-Amazon_deforestation_NASA.jpg',
    label: 'NASA Earth Observatory · Amazon River Basin & Deforestation Arc',
    credit: 'NASA Earth Observatory / MODIS'
  },
  {
    id: 'congo_rainforest',
    filename: 'congo-rainforest-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Congo_River_from_Space.jpg/1280px-Congo_River_from_Space.jpg',
    label: 'NASA Astronaut Photography · Congo Basin Primary Peatland Rainforest',
    credit: 'NASA JSC Earth Science'
  },
  {
    id: 'daintree_rainforest',
    filename: 'daintree-rainforest-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Cape_York_Peninsula_MODIS.jpg/1280px-Cape_York_Peninsula_MODIS.jpg',
    label: 'NASA Terra MODIS · Daintree Ancient Wet Tropics Canopy',
    credit: 'NASA GSFC MODIS Rapid Response'
  },
  {
    id: 'borneo_rainforest',
    filename: 'borneo-rainforest-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Borneo_MODIS.jpg/1280px-Borneo_MODIS.jpg',
    label: 'NASA Aqua MODIS · Borneo Tropical Peat Swamp & Rainforest',
    credit: 'NASA GSFC / Jeff Schmaltz'
  },
  {
    id: 'praia_do_cassino',
    filename: 'praia-do-cassino-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Lagoa_dos_Patos_MODIS.jpg/1280px-Lagoa_dos_Patos_MODIS.jpg',
    label: 'NASA Terra MODIS · Praia do Cassino 212 km Ocean Beach & Patos Lagoon',
    credit: 'NASA Earth Observatory / MODIS'
  },
  {
    id: 'copacabana_beach',
    filename: 'copacabana-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/ISS-43_Rio_de_Janeiro%2C_Brazil.jpg/1280px-ISS-43_Rio_de_Janeiro%2C_Brazil.jpg',
    label: 'NASA ISS-43 Astronaut Photography · Copacabana & Guanabara Bay Shoreline',
    credit: 'NASA JSC Earth Observations'
  },
  {
    id: 'whitehaven_beach',
    filename: 'whitehaven-beach-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Whitsunday_Island_aerial.jpg/1280px-Whitsunday_Island_aerial.jpg',
    label: 'NASA / USGS Landsat · Whitehaven Silica Sands & Whitsunday Passage',
    credit: 'NASA / USGS Earth Resources Observation'
  },
  {
    id: 'wayanad_landslide',
    filename: 'wayanad-landslide-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Western_Ghats_from_Space.jpg/1280px-Western_Ghats_from_Space.jpg',
    label: 'NASA Astronaut Photography & Landsat · Western Ghats Wayanad Escarpment',
    credit: 'NASA JSC Earth Science / USGS Landsat'
  },
  {
    id: 'oso_landslide',
    filename: 'oso-landslide-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Oso%2C_Washington_landslide_aerial_view.jpg/1280px-Oso%2C_Washington_landslide_aerial_view.jpg',
    label: 'USGS & NASA Earth Observatory · Oso Catastrophic Valley Landslide',
    credit: 'USGS / Washington State Patrol / NASA EO'
  },
  {
    id: 'kedarnath_landslide',
    filename: 'kedarnath-landslide-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Himalayas_from_space_ISS008.jpg/1280px-Himalayas_from_space_ISS008.jpg',
    label: 'NASA ISS008 Astronaut Photography · Garhwal Himalaya & Kedarnath Valley',
    credit: 'NASA JSC Earth Science'
  },
  {
    id: 'zhouqu_landslide',
    filename: 'zhouqu-landslide-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Gansu_from_space.jpg/1280px-Gansu_from_space.jpg',
    label: 'NASA ASTER & Landsat · Gansu Loess Plateau & Zhouqu River Gorge',
    credit: 'NASA / GSFC / METI / ERSDAC'
  },
  {
    id: 'tohoku_fukushima',
    filename: 'tohoku-fukushima-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Sendai_Flooding_NASA.jpg/1280px-Sendai_Flooding_NASA.jpg',
    label: 'NASA Earth Observatory · Tohoku Coastal Tsunami Surge & Inundation',
    credit: 'NASA Earth Observatory / Landsat'
  },
  {
    id: 'banda_aceh',
    filename: 'banda-aceh-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Banda_Aceh_tsunami_satellite.jpg/1280px-Banda_Aceh_tsunami_satellite.jpg',
    label: 'NASA Earth Observatory / QuickBird · 2004 Banda Aceh Tsunami Inundation',
    credit: 'DigitalGlobe / NASA Earth Observatory'
  },
  {
    id: 'venice_lagoon',
    filename: 'venice-lagoon-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Venice_from_space.jpg/1280px-Venice_from_space.jpg',
    label: 'NASA ASTER & Earth Observatory · Venice Lagoon & Barrier Islands',
    credit: 'NASA / GSFC / METI / ERSDAC'
  },
  {
    id: 'machu_picchu',
    filename: 'machu-picchu-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Andes_from_ISS.jpg/1280px-Andes_from_ISS.jpg',
    label: 'NASA ISS Astronaut Photography · Peruvian Andes & Urubamba River Valley',
    credit: 'NASA JSC Earth Observations'
  },
  {
    id: 'victoria_falls',
    filename: 'victoria-falls-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Victoria_Falls_from_space.jpg/1280px-Victoria_Falls_from_space.jpg',
    label: 'NASA Astronaut Photography · Victoria Falls & Zambezi River Gorges',
    credit: 'NASA JSC Earth Science'
  },
  {
    id: 'death_valley',
    filename: 'death-valley-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Death_Valley_Landsat_7.jpg/1280px-Death_Valley_Landsat_7.jpg',
    label: 'NASA Landsat 7 & USGS · Badwater Basin, Death Valley Thermal Sink',
    credit: 'NASA / USGS EROS Data Center'
  }
];

async function downloadPlate(plate) {
  const dest = path.join(TEXTURE_DIR, plate.filename);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
    console.log(`[SKIP] Already exists: ${plate.filename}`);
    return;
  }
  console.log(`[DOWNLOADING] ${plate.filename} from ${plate.url}...`);
  try {
    const res = await fetch(plate.url, {
      headers: {
        'User-Agent': 'HearthObservatory/1.0 (https://github.com/kishore1035/HEARTH; contact: kishore1035@gmail.com)'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) throw new Error(`Too small (${buf.length} bytes)`);
    fs.writeFileSync(dest, buf);
    console.log(`[DONE] ${plate.filename} (${Math.round(buf.length / 1024)} KB)`);
  } catch (err) {
    console.error(`[ERROR] Failed to download ${plate.filename}:`, err.message);
  }
}

async function main() {
  console.log(`Downloading satellite plates for ${PLATES.length} planetary destinations...`);
  for (const plate of PLATES) {
    await downloadPlate(plate);
    await new Promise((r) => setTimeout(r, 600)); // Be gentle with rate limits
  }
  console.log('All downloads completed!');
}

main();
