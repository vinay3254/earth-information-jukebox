// HEARTH — 2-Minute Guided Audio Story Tour Orchestrator
// Takes users on an automated narrative flight across 5 key planetary biomes.

// Narratives quote the real NASA POWER annual values in src/regions.js.
export const TOUR_STOPS = [
  {
    regionId: 'amazon_rainforest',
    year: 1985,
    compareYear: 2015,
    title: 'Amazon Rainforest, Brazil',
    narrative: 'Welcome to the HEARTH Planetary Sonification Observatory. We begin over the Amazon. In 1985 it received about 2,500 millimetres of rain. In the 2015 El Nino drought that fell to about 1,170, soil moisture dropped from 0.84 to 0.58, and the year ran three degrees warmer. Listen for the raindrops thinning and the melody rising.'
  },
  {
    regionId: 'california_wildfires',
    year: 2020,
    compareYear: 2025,
    title: 'California Wildfire Front, USA',
    narrative: 'Flying north to the Sierra Nevada wildfire front. 2020, a record fire year, was dry: about 350 millimetres of rain, low soil moisture and clearer skies. The sub-bass thins as the soil dries, and the pad brightens as the cloud cover falls.'
  },
  {
    regionId: 'wayanad_landslide',
    year: 2016,
    compareYear: 2024,
    title: 'Wayanad Western Ghats, India',
    narrative: 'Now to Wayanad in the Western Ghats of India. 2016 was its driest year here, about 1,030 millimetres. By 2024, the year of the landslides, annual rain had risen to about 1,790 and the soil was near its wettest. Listen for denser rain and a fuller sub-bass.'
  },
  {
    regionId: 'copacabana_beach',
    year: 1985,
    compareYear: 2014,
    title: 'Copacabana Beach, Rio de Janeiro',
    narrative: 'Approaching Copacabana in Rio de Janeiro. In 2014, during the southeast Brazil water crisis, rain fell to about 710 millimetres, half of the 1985 total. Hear the raindrops grow sparse against the ocean surf.'
  },
  {
    regionId: 'taj_mahal',
    year: 1985,
    compareYear: 2025,
    title: 'Taj Mahal & Yamuna Basin, India',
    narrative: 'Concluding at the Taj Mahal in Agra. Here 2025 was the wettest year in the record, about 1,070 millimetres, and humidity rose from 44 to 55 percent, so the reverb grows deeper. Meanwhile global carbon dioxide climbed from 346 to 427 parts per million, a slow detune under every place you have heard.'
  }
];

export class GuidedTour {
  constructor(app) {
    this.app = app;
    this.currentStep = -1;
    this.isRunning = false;
    this.timer = null;
    this.onStatusChange = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.app.ui.setSpeechEnabled(true);
    this.executeCurrentStep();
    this.emitStatus();
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.app.ui.cancelSpeech();
    this.currentStep = -1;
    this.emitStatus();
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  next() {
    if (!this.isRunning) return;
    this.currentStep++;
    if (this.currentStep >= TOUR_STOPS.length) {
      this.stop();
      if (this.app.ui.speak) {
        this.app.ui.speak('Tour complete. You can now freely explore all 28 planetary destinations.');
      }
      return;
    }
    this.executeCurrentStep();
    this.emitStatus();
  }

  executeCurrentStep() {
    if (this.timer) clearTimeout(this.timer);
    const stop = TOUR_STOPS[this.currentStep];
    if (!stop) return;

    // Find destination region object
    const region = this.app.findRegionById ? this.app.findRegionById(stop.regionId) : null;
    if (region) {
      if (this.app.mode === 'atlas') {
        this.app.switchDestinationInAtlas(region);
      } else {
        this.app.selectDestination(region, false);
      }
      if (this.app.ui.setYear) {
        this.app.ui.setYear(stop.year, true);
      }
      if (this.app.audio && this.app.audio.start) {
        this.app.audio.start();
        this.app.audio.setYear(stop.year);
      }
    }

    // Speak narration after a brief delay for camera arrival
    setTimeout(() => {
      if (!this.isRunning) return;
      if (this.app.ui.speak) {
        this.app.ui.speak(stop.narrative);
      }
    }, 1800);

    // Schedule next stop in 22 seconds
    this.timer = setTimeout(() => {
      this.next();
    }, 22000);
  }

  emitStatus() {
    if (this.onStatusChange) {
      this.onStatusChange({
        isRunning: this.isRunning,
        step: this.currentStep + 1,
        total: TOUR_STOPS.length,
        stop: TOUR_STOPS[this.currentStep] || null
      });
    }
  }
}
