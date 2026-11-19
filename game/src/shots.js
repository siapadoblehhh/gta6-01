// The screenshot scenes behind ?shot=start|play|night|end. Each one sets the
// real world to a fixed, seeded state — the same seed always gives the same
// frame — so the screenshots are honest renders of the game, not mock-ups.
// The caller paints twice and sets window.__shotReady.
import * as THREE from 'three';
import { makeCar } from './cars.js';

function clearPolice(world) {
  for (const car of world.police) {
    world.scene.remove(car.group);
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
  }
  world.police.length = 0;
  world.wanted.stars = 0;
}

function simulate(world, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    world.time += 1 / 60;
    world.traffic.update(1 / 60);
  }
}

function placePlayerCar(world, x, z, yaw, color) {
  const car = makeCar(color, 'player', x, z, yaw);
  car.owned = true;
  world.scene.add(car.group);
  world.cars.push(car);
  return car;
}

function chasePair(world, x, z, yaw) {
  // Two patrol cars on the player's bumper: behind them along their heading,
  // a lane over, lights flashing.
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (const back of [16, 26]) {
    const car = makeCar(0xf2f2f2, 'police', x - fx * back + 3, z - fz * back, yaw);
    world.scene.add(car.group);
    world.cars.push(car);
    world.police.push(car);
  }
  world.wanted.stars = 2;
  world.wanted.lastCrime = world.time;
}

// Set `world` to the named scene and return the screen to draw over it.
export function stageShot(name, world) {
  const { player } = world;
  clearPolice(world);
  player.health = 100;
  player.invulnerable = 0;
  player.inCar = null;
  player.mesh.visible = true;
  world.missions.status = 'idle';
  world.missions.sideJob = null;
  world.missions.beacon.visible = false;
  world.cameraOverride = null;

  if (name === 'play') {
    world.setDayFrac(0.15);
    player.cash = 450;
    simulate(world, 4);
    // East down the southern road, the beach on the right, two patrol cars
    // on the bumper and the marina beacon ahead.
    const car = placePlayerCar(world, -40, 153.5, Math.PI / 2, 0xb03a2e);
    car.speed = 24;
    player.inCar = car;
    player.mesh.visible = false;
    player.camYaw = car.yaw;
    chasePair(world, -40, 153.5, Math.PI / 2);
    world.missions.status = 'active';
    world.missions.current = { title: 'First Run', steps: [{ type: 'goto', place: 'marina', text: 'Deliver the parcel to the marina' }] };
    world.missions.step = 0;
    world.missions.beacon.visible = true;
    world.missions.beacon.position.set(60, 0, 162);
    world.cameraOverride = {
      pos: new THREE.Vector3(-76, 12, 146),
      lookAt: new THREE.Vector3(-5, 2, 154),
    };
    return { screen: 'play' };
  }

  if (name === 'night') {
    world.setDayFrac(0.78);
    player.cash = 900;
    simulate(world, 4);
    placePlayerCar(world, 52, 158, -Math.PI / 2, 0x2e6da4);
    player.pos.set(56, 0, 152);
    player.mesh.position.copy(player.pos);
    player.yaw = Math.PI;
    player.camYaw = Math.PI * 0.9;
    world.missions.status = 'active';
    world.missions.current = { title: 'Harbor Lights', steps: [{ type: 'goto', place: 'lighthouse', text: 'Final drop at the lighthouse pier' }] };
    world.missions.step = 0;
    world.missions.beacon.visible = true;
    world.missions.beacon.position.set(120, 0, 196);
    world.cameraOverride = {
      pos: new THREE.Vector3(40, 6, 140),
      lookAt: new THREE.Vector3(72, 3, 168),
    };
    return { screen: 'play' };
  }

  if (name === 'end') {
    world.setDayFrac(0.3);
    player.cash = 2350;
    simulate(world, 4);
    placePlayerCar(world, 112, 186, Math.PI, 0xd9a441);
    player.pos.set(116, 0, 188);
    player.mesh.position.copy(player.pos);
    player.yaw = Math.PI * 0.9;
    player.camYaw = Math.PI * 0.9;
    world.cameraOverride = {
      pos: new THREE.Vector3(104, 6, 162),
      lookAt: new THREE.Vector3(128, 5, 196),
    };
    return { screen: 'complete', cash: 2350 };
  }

  // start (and any unknown name): the title over the city at golden hour.
  world.setDayFrac(0.42);
  player.cash = 0;
  simulate(world, 5);
  placePlayerCar(world, -96, 140, Math.PI * 0.7, 0x2e6da4);
  player.pos.set(-100, 0, 144);
  player.mesh.position.copy(player.pos);
  player.yaw = Math.PI * 0.6;
  player.camYaw = Math.PI * 0.6;
  world.cameraOverride = {
    pos: new THREE.Vector3(-60, 42, 170),
    lookAt: new THREE.Vector3(-40, 6, 40),
  };
  return { screen: 'title' };
}
