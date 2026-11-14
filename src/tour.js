// HEARTH — 2-Minute Guided Audio Story Tour Orchestrator
// Takes users on an automated narrative flight across 5 key planetary biomes.

export const TOUR_STOPS = [
  {
    regionId: 'amazon_rainforest',
    year: 1985,
    compareYear: 2025,
    title: 'Amazon Rainforest, Brazil',
    narrative: 'Welcome to the HEARTH Planetary Sonification Observatory. We begin over the Amazon Basin, the lungs of Earth. Listen to how dense canopy reverb and lush moisture rings evolve across four decades.'
  },
  {
    regionId: 'california_wildfires',
    year: 2020,
    compareYear: 2026,
    title: 'California Wildfire Front, USA',
    narrative: 'Flying north to the California Sierra Nevada. Here, extreme thermal infrared anomalies and low soil moisture trigger crackling wildfire textures and ascending temperature pitch.'
  },
  {
    regionId: 'wayanad_landslide',
    year: 2024,
    compareYear: 2026,
    title: 'Wayanad Western Ghats, India',
    narrative: 'Now crossing to Wayanad in the Western Ghats of India. Intense precipitation bursts of over 500 millimeters saturated steep slopes, culminating in historic landslides sonified by deep low-frequency sub-bass.'
  },
  {
    regionId: 'copacabana_beach',
    year: 1985,
    compareYear: 2025,
    title: 'Copacabana Beach, Rio de Janeiro',
    narrative: 'Approaching the iconic sands of Copacabana in Rio de Janeiro. Multi-satellite altimetry captures rising ocean sea levels, translated into dynamic ocean surf wash filters.'
  },
  {
    regionId: 'taj_mahal',
    year: 1985,
    compareYear: 2026,
    title: 'Taj Mahal & Yamuna Basin, India',
    narrative: 'Concluding at the majestic Taj Mahal in Agra, India. Listen to the interplay of Yamuna river basin hydrology and air quality particle density framing this world wonder.'
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
