import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEXTURE_DIR = path.resolve(__dirname, '../assets/textures');

function makeGibsUrl(bbox, time = '2023-08-15') {
  return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&TIME=${time}T00:00:00Z&BBOX=${bbox}&CRS=EPSG:4326&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&WRAP=day&FORMAT=image/jpeg&WIDTH=1024&HEIGHT=1024`;
}

const PLATES = [
  {
    id: 'chernobyl',
    filename: 'chernobyl-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/ISS-57_Chernobyl_Nuclear_Power_Plant%2C_Ukraine.jpg/1280px-ISS-57_Chernobyl_Nuclear_Power_Plant%2C_Ukraine.jpg',
    label: 'NASA ISS-57 Astronaut Photography · Chernobyl Reactor & Exclusion Zone',
    credit: 'NASA Johnson Space Center (ISS-57)'
  },
  {
    id: 'pyramids_giza',
    filename: 'pyramids-giza-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/ISS-32_Pyramids_at_Giza%2C_Egypt.jpg/1280px-ISS-32_Pyramids_at_Giza%2C_Egypt.jpg',
    label: 'NASA ISS-32 Astronaut Photography · Great Pyramids at Giza & Nile Margin',
    credit: 'NASA JSC Earth Science and Remote Sensing Unit'
  },
  {
    id: 'taj_mahal',
    filename: 'taj-mahal-satellite.jpg',
    url: makeGibsUrl('26.8,77.6,27.6,78.5', '2023-10-15'),
    label: 'NASA GIBS VIIRS True Color · Taj Mahal & Yamuna Basin Air Basin',
    credit: 'NASA EOSDIS Global Imagery Browse Services (GIBS)'
  },
  {
    id: 'great_barrier_reef',
    filename: 'great-barrier-reef-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Heavy_Sediment_along_the_Queensland_Coast.jpg',
    label: 'NASA Earth Observatory · Great Barrier Reef Marine Coral System',
    credit: 'NASA Earth Observatory'
  },
  {
    id: 'grand_canyon',
    filename: 'grand-canyon-satellite.jpg',
    url: makeGibsUrl('35.5,-112.8,36.7,-111.4', '2023-09-01'),
    label: 'NASA GIBS VIIRS True Color · Grand Canyon & Colorado Plateau',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'amazon_rainforest',
    filename: 'amazon-rainforest-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Amazon-river-delta-NASA.jpg/1280px-Amazon-river-delta-NASA.jpg',
    label: 'NASA Earth Observatory · Amazon River Delta & Primary Rainforest',
    credit: 'NASA Earth Observatory / MODIS'
  },
  {
    id: 'congo_rainforest',
    filename: 'congo-rainforest-satellite.jpg',
    url: makeGibsUrl('-1.5,17.2,0.5,19.2', '2023-07-20'),
    label: 'NASA GIBS VIIRS True Color · Congo Basin Primary Peatland Canopy',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'daintree_rainforest',
    filename: 'daintree-rainforest-satellite.jpg',
    url: makeGibsUrl('-16.7,144.8,-15.6,146.0', '2023-08-15'),
    label: 'NASA GIBS VIIRS True Color · Daintree Ancient Wet Tropics Canopy',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'borneo_rainforest',
    filename: 'borneo-rainforest-satellite.jpg',
    url: makeGibsUrl('0.0,113.5,2.0,115.5', '2023-08-01'),
    label: 'NASA GIBS VIIRS True Color · Borneo Tropical Peat Swamp & Rainforest',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'praia_do_cassino',
    filename: 'praia-do-cassino-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d6/Lagoa_dos_Patos.jpg/1280px-Lagoa_dos_Patos.jpg',
    label: 'NASA Terra MODIS · Praia do Cassino 212 km Ocean Beach Shoreline',
    credit: 'NASA Earth Observatory / MODIS'
  },
  {
    id: 'copacabana_beach',
    filename: 'copacabana-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/ISS-47_Rio_de_Janeiro_and_Niteroi%2C_Brazil.jpg/1280px-ISS-47_Rio_de_Janeiro_and_Niteroi%2C_Brazil.jpg',
    label: 'NASA ISS-47 Astronaut Photography · Copacabana & Guanabara Bay Shoreline',
    credit: 'NASA JSC Earth Observations'
  },
  {
    id: 'whitehaven_beach',
    filename: 'whitehaven-beach-satellite.jpg',
    url: makeGibsUrl('-20.6,148.6,-19.9,149.4', '2023-09-10'),
    label: 'NASA GIBS VIIRS True Color · Whitehaven Silica Beach & Whitsunday Archipelago',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'wayanad_landslide',
    filename: 'wayanad-landslide-satellite.jpg',
    url: makeGibsUrl('11.0,75.5,12.0,76.7', '2024-02-15'),
    label: 'NASA GIBS VIIRS True Color · Western Ghats Wayanad Escarpment',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'oso_landslide',
    filename: 'oso-landslide-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/2014_Washington_Landslide.jpg/1280px-2014_Washington_Landslide.jpg',
    label: 'USGS & Washington State Patrol · Oso Catastrophic Valley Landslide',
    credit: 'USGS / Washington State Patrol'
  },
  {
    id: 'kedarnath_landslide',
    filename: 'kedarnath-landslide-satellite.jpg',
    url: makeGibsUrl('30.2,78.5,31.2,79.6', '2023-10-01'),
    label: 'NASA GIBS VIIRS True Color · Garhwal Himalaya & Kedarnath Valley',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'zhouqu_landslide',
    filename: 'zhouqu-landslide-satellite.jpg',
    url: makeGibsUrl('33.2,103.8,34.3,104.9', '2023-09-15'),
    label: 'NASA GIBS VIIRS True Color · Gansu Loess Plateau & Zhouqu River Gorge',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'tohoku_fukushima',
    filename: 'tohoku-fukushima-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Flooding_from_Tsunami_near_Sendai%2C_Japan.jpg',
    label: 'NASA Earth Observatory · Tohoku Coastal Tsunami Surge & Inundation',
    credit: 'NASA Earth Observatory / Landsat'
  },
  {
    id: 'banda_aceh',
    filename: 'banda-aceh-satellite.jpg',
    url: makeGibsUrl('4.8,94.6,6.3,96.0', '2024-03-01'),
    label: 'NASA GIBS VIIRS True Color · Banda Aceh Coastal Inundation Zone',
    credit: 'NASA EOSDIS GIBS'
  },
  {
    id: 'venice_lagoon',
    filename: 'venice-lagoon-satellite.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Lagoon-of-venice-landsat-1.jpg',
    label: 'NASA ASTER & Landsat · Venice Lagoon Barrier Islands & Sea Surge',
    credit: 'NASA / USGS / ASTER'
  },
  {
    id: 'machu_picchu',
    filename: 'machu-picchu-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/ISS007-E-11345_-_View_of_Peru.jpg/1280px-ISS007-E-11345_-_View_of_Peru.jpg',
    label: 'NASA ISS Astronaut Photography · Peruvian Andes & Urubamba Gorge',
    credit: 'NASA JSC Earth Observations'
  },
  {
    id: 'victoria_falls',
    filename: 'victoria-falls-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Satellite_view_of_Victoria_Falls.jpg/1280px-Satellite_view_of_Victoria_Falls.jpg',
    label: 'NASA Astronaut Photography · Victoria Falls & Zambezi River Gorges',
    credit: 'NASA JSC Earth Science'
  },
  {
    id: 'death_valley',
    filename: 'death-valley-satellite.jpg',
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/DeathValleySpaceLand_LR.jpg/1280px-DeathValleySpaceLand_LR.jpg',
    label: 'NASA Landsat 7 & USGS · Badwater Basin, Death Valley Thermal Sink',
    credit: 'NASA / USGS EROS Data Center'
  }
];

async function downloadPlate(plate) {
  const dest = path.join(TEXTURE_DIR, plate.filename);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 15000) {
    console.log(`[EXISTS] ${plate.filename} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    return;
  }
  console.log(`[FETCHING] ${plate.filename}...`);
  try {
    const res = await fetch(plate.url, {
      headers: {
        'User-Agent': 'HearthObservatory/1.0 (https://github.com/kishore1035/HEARTH; contact: kishore1035@gmail.com)'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) throw new Error(`Image payload too small: ${buf.length} bytes`);
    fs.writeFileSync(dest, buf);
    console.log(`[SUCCESS] Saved ${plate.filename} (${Math.round(buf.length / 1024)} KB)`);
  } catch (err) {
    console.error(`[ERROR] Failed ${plate.filename}: ${err.message}`);
  }
}

async function run() {
  console.log(`Downloading ${PLATES.length} NASA/USGS satellite plates...`);
  for (const plate of PLATES) {
    await downloadPlate(plate);
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log('Finished downloading all satellite plates!');
}

run();
