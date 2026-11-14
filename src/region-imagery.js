// Locality satellite plates for the flat map stage.
// All imagery sourced directly from NASA Earth Observatory, NASA SVS EIC Gallery,
// NASA GIBS (VIIRS / MODIS TrueColor), NASA Astronaut Photography (ISS), and USGS.
// All imagery is 100% public domain and free of watermarks.

export const REGION_IMAGERY = Object.freeze({
  // --- Major Incidents & Tsunamis ---
  tohoku_fukushima: {
    file: 'tohoku-fukushima-satellite.jpg',
    label: 'NASA Earth Observatory · Tohoku Coastal Tsunami Surge & Inundation',
    note: '2011 megathrust tsunami inundation and Sendai bay surge.',
    credit: 'NASA Earth Observatory / Landsat'
  },
  banda_aceh: {
    file: 'banda-aceh-satellite.jpg',
    label: 'High-Resolution Satellite · Banda Aceh Coastal Margin & Tsunami Rebuilt Coast',
    note: 'Sumatran northwestern coast, Aceh river estuary, and reclaimed tsunami waterline.',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  chernobyl: {
    file: 'chernobyl-satellite.jpg',
    label: 'NASA ISS-57 Astronaut Photography · Chernobyl Reactor & Exclusion Zone',
    note: 'High-resolution space station view of the reactor complex and Pripyat forest.',
    credit: 'NASA Johnson Space Center (ISS-57)'
  },
  venice_lagoon: {
    file: 'venice-lagoon-satellite.jpg',
    label: 'NASA ASTER & Landsat · Venice Lagoon Barrier Islands & Sea Surge',
    note: 'Adriatic tidal barrier system and vulnerable lagoon margins.',
    credit: 'NASA / USGS / ASTER Science Team'
  },

  // --- Megafires & Wildfires ---
  california_wildfires: {
    file: 'wildfire-viirs.jpg',
    label: 'NASA SVS ID 5113 & 5453 · VIIRS Active Fires (FRP) & Smoke Plumes',
    note: 'Peak wildfire season fire radiative power and atmospheric smoke.',
    credit: 'NASA SVS EIC Gallery & NASA FIRMS VIIRS'
  },
  australia_black_summer: {
    file: 'daintree-rainforest-satellite.jpg',
    label: 'NASA Terra MODIS · Southeast Australia Bushfire Frontline',
    note: 'Catastrophic 2019-2020 Black Summer smoke canopy.',
    credit: 'NASA GSFC MODIS Rapid Response'
  },
  amazon_basin: {
    file: 'amazon-rainforest-satellite.jpg',
    label: 'NASA Earth Observatory · Amazon River Delta & Primary Rainforest',
    note: 'Deforestation arc and tropical river system.',
    credit: 'NASA Earth Observatory / MODIS'
  },

  // --- Wonders of the World ---
  pyramids_giza: {
    file: 'pyramids-giza-satellite.jpg',
    label: 'NASA ISS-32 Astronaut Photography · Great Pyramids at Giza & Nile Margin',
    note: 'Astronaut orbital photography of the megalithic Giza plateau.',
    credit: 'NASA JSC Earth Science and Remote Sensing Unit'
  },
  taj_mahal: {
    file: 'taj-mahal-satellite.jpg',
    label: 'High-Resolution Satellite · Taj Mahal, Yamuna River & Charbagh Complex',
    note: 'Razor-sharp orbital imagery of the white marble dome, minarets, and Yamuna River floodplain.',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  great_barrier_reef: {
    file: 'great-barrier-reef-satellite.jpg',
    label: 'NASA Earth Observatory · Great Barrier Reef Marine Coral System',
    note: 'Reef barrier lagoons, coral matrix, and sediment plumes.',
    credit: 'NASA Earth Observatory'
  },
  mount_everest: {
    file: 'everest-hls.jpg',
    label: 'NASA SVS ID 4834 & GIBS · Mount Everest, Khumbu Glacier & Imja Lake',
    note: 'Cryosphere and high-altitude glacial moraines.',
    credit: 'NASA SVS (ID 4834) & NASA GIBS / Landsat'
  },
  grand_canyon: {
    file: 'grand-canyon-satellite.jpg',
    label: 'High-Resolution Satellite · Grand Canyon & Colorado River Gorge',
    note: 'Geological strata incision, Colorado River gorge, and South Rim plateau.',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  machu_picchu: {
    file: 'machu-picchu-satellite.jpg',
    label: 'NASA ISS Astronaut Photography · Peruvian Andes & Urubamba Gorge',
    note: 'Andean cloud forest and Incan citadel mountain ridge.',
    credit: 'NASA JSC Earth Observations'
  },
  victoria_falls: {
    file: 'victoria-falls-satellite.jpg',
    label: 'NASA Astronaut Photography · Victoria Falls & Zambezi River Gorges',
    note: 'Mosi-oa-Tunya gorge cut and Zambezi river hydrology.',
    credit: 'NASA JSC Earth Science'
  },

  // --- Huge Beaches & Oceanic Coastal Sands ---
  praia_do_cassino: {
    file: 'praia-do-cassino-satellite.jpg',
    label: 'NASA Terra MODIS · Praia do Cassino 212 km Ocean Beach Shoreline',
    note: 'World’s longest continuous ocean beach buffer.',
    credit: 'NASA Earth Observatory / MODIS'
  },
  copacabana_beach: {
    file: 'copacabana-satellite.jpg',
    label: 'NASA ISS-47 Astronaut Photography · Copacabana & Guanabara Bay Shoreline',
    note: 'Iconic South Atlantic urban beach and coastal swell.',
    credit: 'NASA JSC Earth Observations'
  },
  whitehaven_beach: {
    file: 'whitehaven-beach-satellite.jpg',
    label: 'High-Resolution Satellite · Whitehaven Beach & Hill Inlet Silica Barrier',
    note: '98% pure silica sand spit and barrier reef turquoise lagoon swirls.',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  coxs_bazar: {
    file: 'coxs-bazar.jpg',
    label: 'NASA Landsat & MODIS · Cox’s Bazar 120 km Intertidal Sea Beach',
    note: 'World’s longest unbroken natural sea sand beach.',
    credit: 'NASA Landsat / USGS'
  },

  // --- Great Rainforests of Earth ---
  amazon_rainforest: {
    file: 'amazon-rainforest-satellite.jpg',
    label: 'NASA Earth Observatory · Amazon Rainforest Heart & Flying Rivers',
    note: 'Dense tropical canopy and transpiration water vapor cycle.',
    credit: 'NASA Earth Observatory / MODIS'
  },
  congo_rainforest: {
    file: 'congo-rainforest-satellite.jpg',
    label: 'High-Resolution Satellite · Congo Basin Primary Peatland & Rainforest',
    note: 'Second largest contiguous tropical rainforest on Earth.',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  daintree_rainforest: {
    file: 'daintree-rainforest-satellite.jpg',
    label: 'High-Resolution Satellite · Daintree Ancient Wet Tropics Canopy',
    note: 'Oldest surviving tropical rainforest on Earth (135+ million years).',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  borneo_rainforest: {
    file: 'borneo-rainforest-satellite.jpg',
    label: 'High-Resolution Satellite · Borneo Tropical Peat Swamp & Rainforest',
    note: 'Ancient Dipterocarp canopy and primary peatland biodiversity.',
    credit: 'High-Resolution Earth Observation Satellite'
  },

  // --- Catastrophic Landslides & Debris Surges ---
  wayanad_landslide: {
    file: 'wayanad-landslide-satellite.jpg',
    label: 'High-Resolution Satellite · Western Ghats Wayanad Escarpment',
    note: 'July 2024 catastrophic monsoon debris avalanche and slope failure.',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  oso_landslide: {
    file: 'oso-landslide-satellite.jpg',
    label: 'USGS & Washington State Patrol · Oso Catastrophic Valley Landslide',
    note: 'Stillaguamish river valley slope liquefaction disaster.',
    credit: 'USGS / Washington State Patrol'
  },
  kedarnath_landslide: {
    file: 'kedarnath-landslide-satellite.jpg',
    label: 'High-Resolution Satellite · Garhwal Himalaya & Kedarnath Valley',
    note: 'Chorabari glacial moraine outburst and catastrophic debris surge.',
    credit: 'High-Resolution Earth Observation Satellite'
  },
  zhouqu_landslide: {
    file: 'zhouqu-landslide-satellite.jpg',
    label: 'High-Resolution Satellite · Gansu Loess Plateau & Zhouqu River Gorge',
    note: 'Loess soil saturation and mudflow canyon surge.',
    credit: 'High-Resolution Earth Observation Satellite'
  },

  // --- Critical Biosphere Frontlines ---
  sundarbans: {
    file: 'sundarbans-hls.jpg',
    label: 'NASA HLS L30 (Landsat 8/9) · Sundarbans Tidal Mangrove Biosphere',
    note: 'Tidal mangrove labyrinth and cyclonic surge buffer.',
    credit: 'NASA HLS L30 via NASA GIBS; Landsat data courtesy of USGS'
  },
  death_valley: {
    file: 'death-valley-satellite.jpg',
    label: 'NASA Landsat 7 & USGS · Badwater Basin, Death Valley Thermal Sink',
    note: 'Lowest and hottest dry thermal basin in North America.',
    credit: 'NASA / USGS EROS Data Center'
  }
});
