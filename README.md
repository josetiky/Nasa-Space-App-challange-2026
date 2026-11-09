# MARS // SURVIVE — Intelligent Mission Control

NASA Space Apps Challenge 2026 · *Interplanetary Survival Guide: Martian Map*

MARS // SURVIVE is a mission-control web app for planning a human Mars mission. You choose a site on real NASA data, read its hazards and resources layer by layer, and plan the crew, habitat, power and supplies. Then you live the mission sol by sol, facing events with a **deterministic, explainable decision engine**. The engine tells you what to do and why, and every recommendation can be reproduced.

> This is the evolution of the original MARS // SURVIVE / *Martian Map* project (Lovable + TanStack Start). Its pages, 3D models and simulators are kept. The original README is preserved in [docs/ORIGINAL_README.md](docs/ORIGINAL_README.md).

## The mission flow

**Select a region → analyse → plan → simulate → face events → consult the engine → decide → see the consequences → evaluate survival → report.** Every module reads and writes one shared mission state, so the flow works from any entry point.

| Module | Route | What it does |
| --- | --- | --- |
| Overview | `/` | Mission status, live Curiosity REMS weather, Mars24 clock, entry points |
| Mars Explorer | `/explorer` | 3D globe (NASA Trek Viking mosaic over MOLA relief, real-time sunlight); EVA route planning on **real Curiosity terrain** in Gale crater (Access Mars), with a **safe-route planner** (A* that avoids slopes ≥ 15° and never crosses ≥ 25°) and a **helmet-visor HUD** that walks the route in first person; a **boxwork Marswalk** along Curiosity's real 2025 path on Mount Sharp (HiRISE basemap, rover elevations and tilt, 8 science stops from the mission blog, EVA time/O₂/dose, saved to the mission); legacy regional models |
| Survival Atlas | `/atlas` | Leaflet map on NASA Trek tiles with **10 layers** (elevation, slope, temperature, radiation, dust, water ice, resources, landing zones, hazards, routes). Each layer shows its legend, unit, source, period, resolution and data type. Analyse any location and compare up to 3 sites |
| Mission Planner | `/planner` | Crew, habitat, power, supplies, ISRU, EVA programme, scenario and risk posture. zod validation, BVAD-based supply sizing, sol-1 energy budget and a 12-seed feasibility preview |
| Mission Simulator | `/simulator` | Sol-by-sol O₂, water, food, energy, health, morale, habitat temperature, systems and dose, with 10 seeded event types, actions per event, history charts, a live protocol monitor and the mission log |
| Decision Intelligence | `/decisions` | Rules + Monte-Carlo look-ahead + MCDA. Shows contributions, trajectories, consequences and rules for each option, lets you re-run with a different posture, and has a sandbox (e.g. the dust-storm dilemma) plus an optional LLM narration |
| NASA Data Center | `/nasa-data` | Every source with its endpoint, format, access, terms, limitations and live health checks; REMS table; traverses; DONKI SEP episodes; NASA imagery |
| Mission Reports | `/reports` | Report filed automatically at the end of each run: outcome, decisions, incidents, consumption. Export to Markdown, CSV, JSON or print |

The original reference pages (Hazard Layers, Resources, Survival Protocols, Mission Lab, Sol by Sol) are still available from the sidebar.

The catalogue includes the **Mount Sharp boxwork** ridges the challenge cites as an example. Curiosity studied them up close from May 2025 into 2026 (campaign sols 4534–4805). The site sits at the centroid of the rover's real MMGIS waypoints, and the Explorer's **Boxwork EVA** mode turns the rover's 2025 path into a Marswalk.

## Data honesty

Every value carries one of four labels:

- **REAL**: measured by a NASA instrument (MOLA heights, REMS weather, rover traverses, DONKI events).
- **DERIVED**: computed from real data with a documented formula (slope, hazard index, ice and dust proxies, scores).
- **MODELLED**: a physical or empirical model evaluated by the platform (insolation, temperature, GCR dose, EVA metabolism).
- **SIMULATED**: output of the seeded mission simulator.

No NASA connection is faked. When a source is unreachable the UI says so. It falls back only to files you saved with `npm run data:fetch`, and labels them as snapshots. See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 (or the port Vite prints)
npm test             # vitest — science, simulator, decision engine, store, adapters
npm run typecheck    # tsc --noEmit
npm run build        # production build (Nitro)
npm run data:fetch   # optional: save offline snapshots of the NASA sources into public/data/nasa/
```

Optional server environment variables (never exposed to the browser):

| Variable | Used by |
| --- | --- |
| `NASA_API_KEY` | `/api/nasa/donki` (DONKI SEP events). Defaults to the rate-limited `DEMO_KEY` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | `/api/mars-advisor` (optional narration; a deterministic text is used without a key) |

Full setup, deployment and troubleshooting: [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Documentation

- [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md): layers, shared state, data flow, routes, testing
- [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md): every NASA source, how it is accessed, its fallbacks and limitations
- [docs/SIMULATION_MODEL.md](docs/SIMULATION_MODEL.md): science models, simulator equations, events, outcomes, assumptions
- [docs/DECISION_ENGINE.md](docs/DECISION_ENGINE.md): rules, Monte-Carlo look-ahead, MCDA, explanations, determinism
- [docs/INSTALLATION.md](docs/INSTALLATION.md): install, scripts, environment, deployment
- Phase 1 analysis: [PROJECT_AUDIT](docs/PROJECT_AUDIT.md) · [FEATURE_COMPARISON](docs/FEATURE_COMPARISON.md) · [TECHNICAL_ARCHITECTURE](docs/TECHNICAL_ARCHITECTURE.md) · [IMPLEMENTATION_ROADMAP](docs/IMPLEMENTATION_ROADMAP.md)

## Stack

TanStack Start (React 19, file routes, server routes) · Vite 8 · TypeScript (strict) · Tailwind v4 + shadcn/Radix · three.js / React Three Fiber / drei · Leaflet · TanStack Query · Recharts · zod · Vitest.

## Credits and licences

- **NASA / JPL-Caltech / USGS / GSFC / CCMC / Centro de Astrobiología (CSIC-INTA)**: MOLA MEGDR (PDS Geosciences Node), Mars Trek WMTS tiles, Curiosity REMS weather, MMGIS rover traverses, DONKI, NASA Image and Video Library. NASA data are generally public domain; each source's credit is shown where it is used.
- **Access Mars**: © 2017 Google Inc. (Google Creative Lab with NASA JPL), Apache License 2.0. A subset of its Gale crater terrain (meshes, textures, point-of-interest texts) is bundled in `public/eva/` with [its licence and notice](public/eva/NOTICE.md). Terrain imagery: NASA/JPL-Caltech.
- **Draco decoder**: Google, Apache License 2.0 (`public/draco/`).
- Physiology and limits: NASA BVAD (Anderson et al. 2018), NASA-STD-3001. Radiation anchor: MSL-RAD (Hassler et al. 2014). Mars time: Mars24 (Allison & McEwen 2000).

Models and simulations are educational planning aids, not mission-certified tools.
