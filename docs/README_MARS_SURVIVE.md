# MARS // SURVIVE — Intelligent Mission Control & Mars Trek Navigator

NASA Space Apps Challenge 2026 · *Interplanetary Survival Guide: Martian Map*

MARS // SURVIVE is a mission-control web app and EVA navigation system for planning a human Mars mission. You choose a site on real NASA data, read its hazards and resources layer by layer, plan safe EVA traverses with the **Mars Trek Multi-Layer A\* Navigator (`/trek` & `/martian-map`)**, and live the mission sol by sol with a **deterministic, explainable decision engine** and the **HUELLA + FSM Astronaut Health State Machine**.

> This is the evolution of the original MARS // SURVIVE / *Martian Map* project (Lovable + TanStack Start). Its pages, 3D models and simulators are kept intact. The original README is preserved in [docs/ORIGINAL_README.md](docs/ORIGINAL_README.md).

## The mission flow

**Select a region → analyse → plan EVA route (`/trek` or `/martian-map`) → simulate → face events → consult the engine → decide → see the consequences → evaluate survival → report.** Every module reads and writes shared mission state, so the flow works from any entry point.

| Module | Route | What it does |
| --- | --- | --- |
| Overview | `/` | Mission status, live Curiosity REMS weather, Mars24 clock, entry points |
| **Mars Trek · Navegador** | `/trek` & `/martian-map` | **Multi-layer A\* EVA Route Navigator** over 1 m real Curiosity stereo meshes in Gale crater (`TYPE_TILE`, 129×129 nodes, 100% coverage) + synthetic validation field (`T-06`). Composes a hard `SafetyEnvelope` (`safety > distance`) driven by terrain slope, roughness, soft soil, dust/SEP hazards, scientific confidence (`K1–K5`), walkback consumables (`pandolf-mars` 0.38g / `tobler-linear`), and the independent **HUELLA + FSM Astronaut Health State Machine** (`NORMAL, FATIGUE, CAUTION, CRITICAL, EMERGENCY`) with human confirmation interlock, Why-Bar cost breakdown (`D, T, R, E, U, H`), and dynamic replanning. See [docs/DEMO_SCENARIO.md](docs/DEMO_SCENARIO.md) |
| Mars Explorer | `/explorer` | 3D globe (NASA Trek Viking mosaic over MOLA relief, real-time sunlight); EVA route planning on **real Curiosity terrain** in Gale crater (Access Mars), with a **safe-route planner** (A\* that avoids slopes ≥ 15° and never crosses ≥ 25°) and a **helmet-visor HUD** that walks the route in first person; a **boxwork Marswalk** along Curiosity's real 2025 path on Mount Sharp |
| Survival Atlas | `/atlas` | Leaflet map on NASA Trek tiles with **10 layers** (elevation, slope, temperature, radiation, dust, water ice, resources, landing zones, hazards, routes). Each layer shows its legend, unit, source, period, resolution and data type. Analyse any location and compare up to 3 sites |
| Mission Planner | `/planner` | Crew, habitat, power, supplies, ISRU, EVA programme, scenario and risk posture. zod validation, BVAD-based supply sizing, sol-1 energy budget and a 12-seed feasibility preview |
| Mission Simulator | `/simulator` | Sol-by-sol O₂, water, food, energy, health, morale, habitat temperature, systems and dose, with 10 seeded event types, actions per event, history charts, a live protocol monitor and the mission log |
| Decision Intelligence | `/decisions` | Rules + Monte-Carlo look-ahead + MCDA. Shows contributions, trajectories, consequences and rules for each option, lets you re-run with a different posture, and has a sandbox plus an optional LLM narration |
| NASA Data Center | `/nasa-data` | Every source with its endpoint, format, access, terms, limitations and live health checks; REMS table; traverses; DONKI SEP episodes; NASA imagery |
| Mission Reports | `/reports` | Report filed automatically at the end of each run: outcome, decisions, incidents, consumption. Export to Markdown, CSV, JSON or print |

The original reference pages (Hazard Layers, Resources, Survival Protocols, Mission Lab, Sol by Sol) are still available from the sidebar.

## Data honesty & confidence classes

Every value carries one of four provenance labels (`REAL`, `DERIVED`, `MODELLED`, `SIMULATED`) and, in Mars Trek (`/trek` & `/martian-map`), a scientific confidence class (`K1` rover-traversed > `K2` surface stereo photogrammetry > `K3a` 1–2 m orbital DTM > `K3b–K3d` regional DEM > `K4` inferred > `K5` unknown / `NaN`). Unknown cells (`NaN`) are never filled with zero: they map to `K5` and zone `Z3`, and hard safety constraints (`Z5`, slope > limit, insufficient confidence) are removed from the A\* graph as masks (`INV-R3`, `INV-R4`, `INV-S2`). Layers that lack a local EVA-scale numeric raster (e.g. regional MOLA/HRSC 200 m DEM, THEMIS RGB WMTS tiles, CRISM/OMEGA without local PDS rasters) are explicitly decoupled and marked `no_disponible`.

## Quick start

```bash
npm install
npm run dev          # http://localhost:8080/trek or http://localhost:8080/martian-map
npm test             # vitest — 30 test suites (199 tests: baseline + Mars Trek A*, HUELLA parity, FSM, costmap)
npm run typecheck    # tsc --noEmit
npm run build        # production build (Nitro)
node scripts/trek/build-site-tiles.mjs  # regenerate the 5 Gale 129×129 1m elevation tiles from Access Mars Draco meshes
```

## Documentation

- [docs/DEMO_SCENARIO.md](docs/DEMO_SCENARIO.md): step-by-step walkthrough of `/trek` and `/martian-map` (`T-03`, `T-04`, `T-06`, `T-07`, `T-08`, `T-11`)
- [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md): layers, shared state, data flow, routes, testing
- [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md): every NASA source, how it is accessed, its fallbacks and limitations
- [docs/SIMULATION_MODEL.md](docs/SIMULATION_MODEL.md): science models, simulator equations, events, outcomes, assumptions
- [docs/DECISION_ENGINE.md](docs/DECISION_ENGINE.md): rules, Monte-Carlo look-ahead, MCDA, explanations, determinism
- [docs/INSTALLATION.md](docs/INSTALLATION.md): install, scripts, environment, deployment
