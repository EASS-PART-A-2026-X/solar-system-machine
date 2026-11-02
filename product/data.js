// Shared facts (NASA planetary fact sheet). radiusKm = equatorial radius, au = mean distance from Sun.
export const SUN = { name: 'Sun', radiusKm: 695700, color: '#ffb347' };

export const PLANETS = [
  { name: 'Mercury', radiusKm: 2440,  au: 0.39,  periodDays: 88,    dayHours: 4222.6, moons: 0,   tilt: 0.03 },
  { name: 'Venus',   radiusKm: 6052,  au: 0.72,  periodDays: 225,   dayHours: 2802,   moons: 0,   tilt: 177.4 },
  { name: 'Earth',   radiusKm: 6371,  au: 1.00,  periodDays: 365,   dayHours: 24,     moons: 1,   tilt: 23.4 },
  { name: 'Mars',    radiusKm: 3390,  au: 1.52,  periodDays: 687,   dayHours: 24.7,   moons: 2,   tilt: 25.2 },
  { name: 'Jupiter', radiusKm: 69911, au: 5.20,  periodDays: 4331,  dayHours: 9.9,    moons: 95,  tilt: 3.1 },
  { name: 'Saturn',  radiusKm: 58232, au: 9.58,  periodDays: 10747, dayHours: 10.7,   moons: 274, tilt: 26.7 },
  { name: 'Uranus',  radiusKm: 25362, au: 19.19, periodDays: 30589, dayHours: 17.2,   moons: 28,  tilt: 97.8 },
  { name: 'Neptune', radiusKm: 24622, au: 30.07, periodDays: 59800, dayHours: 16.1,   moons: 16,  tilt: 28.3 },
];
