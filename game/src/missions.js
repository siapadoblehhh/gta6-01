// The story: Dana Cole, courier for Sunset Courier Co., one bad week in
// Solmar. Five missions from Mara Voss, then side jobs for cash. Each mission
// is a short list of steps — go somewhere, pick something up, lose the cops —
// and the beacon in the world and the HUD both point at the next one.
import * as THREE from 'three';
import { MISSION } from './config.js';
import { distance2D } from './cars.js';

const MISSIONS = [
  {
    id: 'first-run',
    title: 'First Run',
    giver: 'Mara Voss',
    brief: 'Morning, Dana. A parcel at the depot, a client waiting at the marina. Drive it over, no rush — just don\u2019t scratch the van.',
    reward: 150,
    steps: [
      { type: 'goto', place: 'depot', text: 'Pick up the parcel at the depot' },
      { type: 'goto', place: 'marina', text: 'Deliver the parcel to the marina', needsCar: true },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Mara Voss',
    brief: 'Big Lou needs a sports coupe moved, and the owner left it by the plaza. Take it. If the owner shouts, drive faster.',
    reward: 300,
    steps: [
      { type: 'goto', place: 'plaza', text: 'Take the coupe at the plaza' },
      { type: 'goto', place: 'garage', text: 'Deliver the coupe to Big Lou\u2019s garage', needsCar: true },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    giver: 'Big Lou',
    brief: 'That coupe was hot, kid. The whole Solmar PD is on you. Lose them, then get to the hideout and lay low.',
    reward: 400,
    wanted: 2,
    steps: [
      { type: 'escape', text: 'Lose the cops — get your wanted level to zero' },
      { type: 'goto', place: 'hideout', text: 'Reach the hideout' },
    ],
  },
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    giver: 'Mara Voss',
    brief: 'Night run, three stops: fish market, Palma Hotel, then the lighthouse. The clients pay double after dark. You have two and a half minutes.',
    reward: 500,
    timer: 150,
    steps: [
      { type: 'goto', place: 'fishMarket', text: 'Pick up at the fish market' },
      { type: 'goto', place: 'hotel', text: 'Drop at the Palma Hotel' },
      { type: 'goto', place: 'lighthouse', text: 'Final drop at the lighthouse pier' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    giver: 'Mara Voss',
    brief: 'Last one. A case from Meridian Bank to the lighthouse pier. The whole city will be watching — make it count, Dana.',
    reward: 1000,
    wanted: 3,
    steps: [
      { type: 'goto', place: 'bank', text: 'Pick up the case at Meridian Bank' },
      { type: 'goto', place: 'lighthouse', text: 'Deliver the case to the lighthouse pier' },
    ],
  },
];

function makeBeacon() {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.4, MISSION.markerHeight, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = MISSION.markerHeight / 2;
  group.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd34d }),
  );
  diamond.position.y = MISSION.markerHeight + 2;
  group.add(diamond);
  return { group, diamond };
}

export function createMissions(world) {
  const { group, diamond } = makeBeacon();
  group.visible = false;
  world.scene.add(group);
  const state = {
    index: 0,
    step: 0,
    status: 'idle', // idle | active | done
    timer: 0,
    beacon: group,
    diamond,
    sideJob: null,
    current: null,
  };
  world.missions = state;
  return state;
}

function stepTarget(world) {
  const m = world.missions;
  const mission = MISSIONS[m.index];
  if (!mission) return null;
  const step = mission.steps[m.step];
  if (!step) return null;
  if (step.type === 'escape') return null;
  return world.city.landmarks[step.place];
}

export function startMission(world, index) {
  const m = world.missions;
  const mission = MISSIONS[index];
  if (!mission) return false;
  m.index = index;
  m.step = 0;
  m.status = 'active';
  m.timer = mission.timer || 0;
  m.current = mission;
  if (mission.wanted) {
    world.wanted.stars = Math.max(world.wanted.stars, mission.wanted);
    world.wanted.lastCrime = world.time;
  }
  world.toast(`${mission.title} — ${mission.giver}`);
  world.announce(`${mission.title}. ${mission.brief}`);
  return true;
}

export function completeMission(world) {
  const m = world.missions;
  const mission = m.current;
  if (!mission) return;
  world.player.cash += mission.reward;
  world.toast(`${mission.title} complete — +$${mission.reward}`);
  world.audio.jingle();
  m.status = 'idle';
  m.current = null;
  m.beacon.visible = false;
  m.step = 0;
  // Save progress: the next mission waits for the player to walk to the depot
  // marker, or starts at once from the mission-complete panel.
  m.index += 1;
  try {
    window.localStorage.setItem('solmar-sunset-save', JSON.stringify({ mission: m.index, cash: world.player.cash }));
  } catch {
    // Storage off: progress lasts this visit only.
  }
}

function startSideJob(world) {
  const m = world.missions;
  const spots = ['marina', 'hotel', 'bank', 'plaza', 'fishMarket', 'hospital', 'garage'];
  const from = spots[Math.floor(Math.random() * spots.length)];
  let to = spots[Math.floor(Math.random() * spots.length)];
  if (to === from) to = 'lighthouse';
  m.sideJob = {
    title: 'Side job',
    from,
    to,
    reward: 60 + Math.floor(Math.random() * 80),
    phase: 'pickup',
  };
  world.toast(`Side job: pick up a fare at ${world.city.landmarks[from].name}`);
}

export function updateMissions(world, dt) {
  const m = world.missions;
  const pos = world.player.inCar ? world.player.inCar.pos : world.player.pos;

  if (m.status === 'idle') {
    // Between missions the beacon waits at the depot: walk there to start.
    const depot = world.city.landmarks.depot;
    m.beacon.visible = true;
    m.beacon.position.set(depot.x, 0, depot.z);
    m.diamond.rotation.y += dt * 2;
    if (distance2D(pos, depot) < MISSION.arriveDistance) {
      if (m.index < MISSIONS.length) startMission(world, m.index);
      else if (!m.sideJob) startSideJob(world);
    }
    if (m.sideJob) updateSideJob(world, dt, pos);
    return;
  }
  if (m.status !== 'active' || !m.current) return;

  const mission = m.current;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      world.toast(`${mission.title} failed — out of time.`);
      world.audio.crash();
      m.status = 'idle';
      m.beacon.visible = false;
      return;
    }
  }
  const step = mission.steps[m.step];
  if (!step) {
    completeMission(world);
    return;
  }
  if (step.type === 'escape') {
    m.beacon.visible = false;
    if (world.wanted.stars === 0) {
      m.step += 1;
      world.toast('Clean. Now get to the hideout.');
    }
    return;
  }
  const target = world.city.landmarks[step.place];
  m.beacon.visible = true;
  m.beacon.position.set(target.x, 0, target.z);
  m.diamond.rotation.y += dt * 2;
  m.diamond.position.y = MISSION.markerHeight + 2 + Math.sin(world.time * 2) * 0.8;
  if (distance2D(pos, target) < MISSION.arriveDistance) {
    m.step += 1;
    if (step.needsCar && !world.player.inCar) {
      // Arrived on foot where a car was expected: the step still counts, but
      // the next leg will be slow. No penalty beyond the walk.
    }
    if (m.step >= mission.steps.length) completeMission(world);
    else world.toast(mission.steps[m.step].text);
  }
}

function updateSideJob(world, dt, pos) {
  const m = world.missions;
  const job = m.sideJob;
  const place = job.phase === 'pickup' ? job.from : job.to;
  const target = world.city.landmarks[place];
  m.beacon.visible = true;
  m.beacon.position.set(target.x, 0, target.z);
  m.diamond.rotation.y += dt * 2;
  if (distance2D(pos, target) < MISSION.arriveDistance) {
    if (job.phase === 'pickup') {
      job.phase = 'drop';
      world.toast(`Fare aboard — take them to ${world.city.landmarks[job.to].name}`);
    } else {
      world.player.cash += job.reward;
      world.toast(`Side job done — +$${job.reward}`);
      world.audio.jingle();
      m.sideJob = null;
      m.beacon.visible = false;
    }
  }
}

export function missionObjective(world) {
  const m = world.missions;
  if (m.status === 'active' && m.current) {
    const step = m.current.steps[m.step];
    if (!step) return { title: m.current.title, text: 'Done', distance: 0 };
    if (step.type === 'escape') return { title: m.current.title, text: step.text, distance: 0 };
    const target = world.city.landmarks[step.place];
    const pos = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    return { title: m.current.title, text: step.text, distance: Math.round(distance2D(pos, target)) };
  }
  if (m.sideJob) {
    const place = m.sideJob.phase === 'pickup' ? m.sideJob.from : m.sideJob.to;
    const target = world.city.landmarks[place];
    const pos = world.player.inCar ? world.player.inCar.pos : world.player.pos;
    return { title: 'Side job', text: m.sideJob.phase === 'pickup' ? `Pick up a fare at ${target.name}` : `Drop the fare at ${target.name}`, distance: Math.round(distance2D(pos, target)) };
  }
  if (m.index >= MISSIONS.length) return { title: 'Free roam', text: 'Solmar is yours — visit the depot for side jobs', distance: 0 };
  return { title: MISSIONS[m.index].title, text: 'Go to the depot to start', distance: Math.round(distance2D(world.player.pos, world.city.landmarks.depot)) };
}

export function missionTimer(world) {
  return world.missions.status === 'active' ? Math.max(0, world.missions.timer) : 0;
}
