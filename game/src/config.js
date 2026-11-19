// Solmar Sunset: constants for the city, the player, cars, police and missions.
// One place for every number the game tunes by.
export const WORLD = {
  block: 46, // a city block is this wide (units)
  road: 14, // roads are this wide
  blocks: 5, // the city is blocks x blocks
  ground: 320, // ground plane size
};

export const CITY = {
  // The grid spans from -half to +half on both axes.
  half: (WORLD.blocks * (WORLD.block + WORLD.road) + WORLD.road) / 2,
  // Sun-soaked palette: warm plaster, terracotta roofs, teal sea.
  buildingColors: [0xe8dcc8, 0xd9b48f, 0xc98f6b, 0xf2e6d4, 0xb7c4c9, 0xe3cfa5, 0xd6a58a],
  roofColors: [0xb5654a, 0x8a5a44, 0x5f7d7a, 0x9c6b4f],
  palmTrunk: 0x7a5a38,
  palmLeaf: 0x3f8f4f,
  road: 0x2e3138,
  sidewalk: 0x9aa0a3,
  sand: 0xe6cf9e,
  sea: 0x2a7f8f,
};

export const PLAYER = {
  walkSpeed: 9,
  runSpeed: 15,
  radius: 0.9,
  health: 100,
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverse: 12,
  maxSpeed: 46,
  maxReverse: 14,
  steer: 0.55,
  grip: 6.5,
  radius: 2.2,
};

export const POLICE = {
  // How many patrol cars chase at each wanted level (index = stars).
  carsPerStar: [0, 1, 2, 3, 4, 5],
  chaseSpeed: 40,
  ramDamage: 8,
  bustDistance: 2.6,
  // Seconds without a crime before the wanted level starts to cool off.
  coolDown: 18,
};

export const MISSION = {
  markerHeight: 26,
  arriveDistance: 7,
};

export const DAY = {
  // One full day/night cycle, in seconds.
  cycleSeconds: 300,
  // Sun elevation limits; night is dark but never pitch black.
  nightAmbient: 0.16,
};

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  handbrake: ['Space'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter'],
  mute: ['KeyM'],
};

export const BEST_KEY = 'solmar-sunset-best';
export const SAVE_KEY = 'solmar-sunset-save';
