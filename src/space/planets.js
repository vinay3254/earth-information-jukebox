// Real planetary facts (NASA Planetary Fact Sheet values, rounded).
// Visual sizes and distances are compressed so everything fits on screen;
// orbital periods keep their true ratios.
export const PLANETS = [
  {
    id: 'mercury', name: 'Mercury', au: 0.39, radiusKm: 2440, periodDays: 88, dayHours: 4223, tempC: 167, moons: 0,
    kind: 'rock', colors: ['#5b5550', '#8c8178', '#b3a89c', '#6e655d'],
    fact: 'Smallest planet. A year lasts 88 Earth days, but one sunrise to the next takes 176.'
  },
  {
    id: 'venus', name: 'Venus', au: 0.72, radiusKm: 6052, periodDays: 225, dayHours: 2802, tempC: 464, moons: 0,
    kind: 'cloud', colors: ['#c99a5b', '#e3c08a', '#f1dcb0', '#b78447'],
    fact: 'Hottest planet. Thick carbon dioxide traps heat, a runaway greenhouse effect.'
  },
  {
    id: 'earth', name: 'Earth', au: 1.0, radiusKm: 6371, periodDays: 365.25, dayHours: 24, tempC: 15, moons: 1,
    kind: 'earth', colors: [],
    fact: 'Our home. The only planet known to have life and liquid water on its surface.'
  },
  {
    id: 'mars', name: 'Mars', au: 1.52, radiusKm: 3390, periodDays: 687, dayHours: 24.7, tempC: -65, moons: 2,
    kind: 'rock', colors: ['#7a3a22', '#a8522e', '#c97345', '#5e2c1a'],
    fact: 'A cold desert. Iron oxide dust makes it red. It once had rivers and lakes.'
  },
  {
    id: 'jupiter', name: 'Jupiter', au: 5.2, radiusKm: 69911, periodDays: 4333, dayHours: 9.9, tempC: -110, moons: 95,
    kind: 'gas', colors: ['#d8c3a5', '#a9784f', '#efe3cf', '#8a5a3b', '#c99b6d'],
    fact: 'Largest planet. Its Great Red Spot is a storm wider than Earth.'
  },
  {
    id: 'saturn', name: 'Saturn', au: 9.54, radiusKm: 58232, periodDays: 10759, dayHours: 10.7, tempC: -140, moons: 146,
    kind: 'gas', colors: ['#e8d6a8', '#c9ad78', '#f3e7c6', '#b0915e'], rings: true,
    fact: 'Its rings are ice and rock, hundreds of thousands of kilometres wide but only metres thick.'
  },
  {
    id: 'uranus', name: 'Uranus', au: 19.2, radiusKm: 25362, periodDays: 30687, dayHours: 17.2, tempC: -195, moons: 28,
    kind: 'gas', colors: ['#9fd8dd', '#b7e6e8', '#8ccbd2', '#a9dfe2'], tilt: 98,
    fact: 'Rolls around the Sun on its side, tilted 98 degrees.'
  },
  {
    id: 'neptune', name: 'Neptune', au: 30.1, radiusKm: 24622, periodDays: 60190, dayHours: 16.1, tempC: -200, moons: 16,
    kind: 'gas', colors: ['#2f55b8', '#4a74d6', '#26449a', '#6a8fe0'],
    fact: 'The windiest planet. Storms move at over 2,000 kilometres per hour.'
  }
];

const R_EARTH = 6371;
export const visualRadius = (p) => 0.42 + 0.78 * Math.cbrt(p.radiusKm / R_EARTH);
export const visualDistance = (p) => 7 + 10.5 * Math.sqrt(p.au);
export const SUN_RADIUS = 4.2;
// Earth completes one orbit in this many seconds; others keep true ratios.
export const EARTH_ORBIT_SECONDS = 48;
