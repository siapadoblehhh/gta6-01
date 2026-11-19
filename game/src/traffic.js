// Traffic and pedestrians: the city alive around the player. Traffic cars
// cruise the road grid and turn at intersections; pedestrians stroll the
// sidewalks and run from a speeding car. None of them is scripted: the same
// seed gives the same morning rush.
import * as THREE from 'three';
import { CAR } from './config.js';
import { pick, range } from './random.js';
import { makeCar, stepDrive, distance2D } from './cars.js';
import { collideCircle, clampToCity } from './city.js';

const TRAFFIC_COLORS = [0x8a94a3, 0xb03a2e, 0x2e6da4, 0xd9a441, 0x5a7d5a, 0x6b5b95, 0xc0c8d0, 0x3a3f45];
const PED_COLORS = [0xe86a4a, 0x4a90d9, 0x7bc47f, 0xd9a441, 0x9b59b6, 0xef8354, 0x5d6d7e];

function makePedMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.5, 8), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 2.1;
  head.castShadow = true;
  group.add(head);
  return group;
}

export function createTraffic(world) {
  const { scene, rng, city } = world;
  const cars = [];
  const peds = [];

  for (let i = 0; i < 12; i += 1) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const lane = pick(rng, city.roads);
    const dir = rng() < 0.5 ? 1 : -1;
    const car = makeCar(pick(rng, TRAFFIC_COLORS), 'traffic', 0, 0, 0);
    car.axis = axis;
    car.lane = lane;
    car.dir = dir;
    car.cruise = range(rng, 8, 14);
    if (axis === 'x') {
      car.pos.set(range(rng, -150, 150), 0, lane + 3.5 * dir);
      car.yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.pos.set(lane - 3.5 * dir, 0, range(rng, -150, 150));
      car.yaw = dir > 0 ? Math.PI : 0;
    }
    car.group.rotation.y = car.yaw;
    scene.add(car.group);
    cars.push(car);
  }

  for (let i = 0; i < 22; i += 1) {
    const mesh = makePedMesh(pick(rng, PED_COLORS));
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = pick(rng, city.roads);
    const side = rng() < 0.5 ? 9.5 : -9.5;
    const pos = new THREE.Vector3(0, 0, 0);
    if (axis === 'x') pos.set(range(rng, -150, 150), 0, road + side);
    else pos.set(road + side, 0, range(rng, -150, 150));
    mesh.position.copy(pos);
    scene.add(mesh);
    peds.push({
      mesh,
      pos,
      yaw: rng() * Math.PI * 2,
      axis,
      dir: rng() < 0.5 ? 1 : -1,
      speed: range(rng, 1.2, 2.2),
      flee: 0,
      down: 0,
    });
  }

  function nearestRoad(value) {
    let best = city.roads[0];
    for (const road of city.roads) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
    return best;
  }

  function update(dt) {
    // Traffic: cruise the grid, turn at intersections sometimes, turn around
    // at the city edge. Cars never leave their lane.
    for (const car of cars) {
      const along = car.axis === 'x' ? car.pos.x : car.pos.z;
      const cross = car.axis === 'x' ? car.pos.z : car.pos.x;
      const next = nearestRoad(along + car.dir * 3);
      if (Math.abs(along - next) < 3 && Math.abs(along - next) > 0.5 && rng() < 0.02) {
        // Turn onto the crossing road.
        const newLane = nearestRoad(cross);
        const newDir = rng() < 0.5 ? 1 : -1;
        if (car.axis === 'x') {
          car.pos.z = newLane - 3.5 * newDir;
          car.pos.x = next;
          car.yaw = newDir > 0 ? Math.PI : 0;
        } else {
          car.pos.x = newLane + 3.5 * newDir;
          car.pos.z = next;
          car.yaw = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.lane = newLane;
        car.dir = newDir;
      }
      const target = car.axis === 'x'
        ? { x: car.pos.x + car.dir * car.cruise * dt, z: car.lane + 3.5 * car.dir }
        : { x: car.lane - 3.5 * car.dir, z: car.pos.z + car.dir * car.cruise * dt };
      car.pos.x = target.x;
      car.pos.z = target.z;
      if (Math.abs(car.pos.x) > 156 || Math.abs(car.pos.z) > 156) {
        car.dir *= -1;
        car.yaw += Math.PI;
      }
      car.group.rotation.y = car.yaw;
      // Keep a little distance from the car ahead on the same lane.
      for (const other of cars) {
        if (other === car || other.axis !== car.axis || other.lane !== car.lane || other.dir !== car.dir) continue;
        const gap = (car.axis === 'x' ? other.pos.x - car.pos.x : other.pos.z - car.pos.z) * car.dir;
        if (gap > 0 && gap < 7) {
          if (car.axis === 'x') car.pos.x -= car.dir * (7 - gap);
          else car.pos.z -= car.dir * (7 - gap);
        }
      }
      collideCircle(car.pos, CAR.radius, world.city.colliders);
      clampToCity(car.pos, CAR.radius);
    }

    // Pedestrians: stroll the sidewalks, turn at intersections, and run when
    // a fast car gets close.
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        ped.mesh.rotation.z = Math.min(Math.PI / 2, ped.mesh.rotation.z + dt * 4);
        if (ped.down <= 0) {
          ped.mesh.rotation.z = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      const playerCar = world.player.inCar;
      const threat = playerCar || world.player;
      const threatPos = playerCar ? playerCar.pos : world.player.pos;
      const d = distance2D(ped.pos, threatPos);
      const threatSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
      if (d < 9 && threatSpeed > 6) {
        ped.flee = 1.5;
        const away = Math.atan2(ped.pos.x - threatPos.x, ped.pos.z - threatPos.z);
        ped.yaw = away;
      }
      if (ped.flee > 0) ped.flee -= dt;
      const speed = ped.flee > 0 ? ped.speed * 2.6 : ped.speed;
      const fx = Math.sin(ped.yaw);
      const fz = Math.cos(ped.yaw);
      ped.pos.x += fx * speed * dt;
      ped.pos.z += fz * speed * dt;
      // At an intersection, sometimes turn onto the crossing sidewalk.
      const along = ped.axis === 'x' ? ped.pos.x : ped.pos.z;
      const next = nearestRoad(along + ped.dir * 2);
      if (Math.abs(along - next) < 2 && rng() < 0.01) {
        ped.axis = ped.axis === 'x' ? 'z' : 'x';
        ped.dir = rng() < 0.5 ? 1 : -1;
        ped.yaw = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? Math.PI : 0);
      }
      if (Math.abs(ped.pos.x) > 158 || Math.abs(ped.pos.z) > 158) ped.dir *= -1;
      ped.mesh.position.copy(ped.pos);
      ped.mesh.rotation.y = ped.yaw;
      // A little walk bob.
      ped.mesh.position.y = Math.abs(Math.sin(world.time * 8 + ped.pos.x)) * 0.08;
      collideCircle(ped.pos, 0.6, world.city.colliders);
    }
  }

  return { cars, peds, update };
}
