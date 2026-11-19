# Solmar Sunset

An open-world crime game in the spirit of GTA 6, built from scratch in three.js. You are Dana Cole, a courier driver for Sunset Courier Co. in Solmar — a sun-soaked coastal city with a marina, a lighthouse pier, a plaza, and a police department that notices everything.

## What you do

- **Walk and drive** around a 5×5 city grid: on foot with WASD, behind the wheel with the same keys, mouse drag to look around. Press E to get in (or borrow) a car.
- **Take jobs** from Mara Voss: five story missions, from a first parcel run to a final case delivery at the lighthouse, then side jobs for cash at the depot.
- **Mind the law**: stealing cars, hitting pedestrians and ramming patrol cars raise your wanted level. Patrol cars chase, ram, and bust you if you stand still next to one. Lay low and the heat cools off.
- **Live in the city**: traffic cruises the grid, pedestrians stroll the sidewalks and run from speeding cars, cash bundles and health packs are tucked around the blocks, and the sun circles from golden morning to night, when the windows and streetlights come on.

## Controls

W A S D — walk / drive · Shift — run · Mouse drag — look around · E — get in / out of a car · Space — handbrake · P — pause · M — mute

## How it runs

Static files under `game/`, no build step, no network at runtime: `node serve.ts`, then open http://localhost:8080. three.js is vendored as `game/vendor/three.min.js`. The entry point is `main.ts` (Node 22), which copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Everything in Solmar is original: the city, the names, the story and the art. Nothing comes from Rockstar Games or any other commercial game.

Built for the make.fun bounty — [Make GTA 6](https://make.fun/bounty/gta6-01).

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/siapadoblehhh/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/siapadoblehhh/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)
