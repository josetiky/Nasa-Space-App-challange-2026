# TECHNICAL_ARCHITECTURE — MARS // SURVIVE · Intelligent Mission Control

_Phase 1 deliverable · target architecture for the evolved platform_

## 1. Principles

1. **Evolve, don't replace.** The TanStack Start application, its routes, tokens and components stay. New modules plug into the same shell.
2. **One mission, one source of truth.** A single mission store holds the selected region, the plan, the simulation and the reports. Every module reads and writes it.
3. **Deterministic core, optional AI.** Science models, the simulator and the decision engine are pure TypeScript functions with seeded randomness. An LLM may *explain* their output; it can never change state or invent data.
4. **Provenance everywhere.** Every number shown carries a data-type badge — `REAL` (measured, NASA source), `DERIVED` (computed from real data), `MODELLED` (physics/empirical model with stated assumptions), `SIMULATED` (scenario output) — plus source, period and resolution.
5. **Works offline, refreshes live.** Real NASA snapshots are bundled with their retrieval date; adapters refresh them when the network allows.

## 2. Layered view

```
┌──────────────────────────────── UI (routes) ─────────────────────────────────┐
│ Overview · Mars Explorer · Survival Atlas · Mission Planner · Mission Simulator │
│ Decision Intelligence · NASA Data · Mission Reports  (+ legacy: Mission Lab,    │
│ Hazard Layers, Resources, Protocols, Sol by Sol)                                │
├──────────────────────────── Components (React) ───────────────────────────────┤
│ shell/ explorer/ atlas/ planner/ simulator/ decision/ nasa/ reports/ common/   │
├──────────────────────────── State (mission store) ────────────────────────────┤
│ useSyncExternalStore store · actions · localStorage persistence (versioned)    │
├───────────────────────── Domain core (pure TypeScript) ───────────────────────┤
│ science/ (Mars time, insolation, environment, terrain, EVA, geo)              │
│ sim/ (resources, events, engine, outcome)   decision/ (rules, criteria, engine)│
├──────────────────────────── Services (I/O) ───────────────────────────────────┤
│ nasa/ adapters (MOLA, REMS, traverses, DONKI, imagery, Trek)  atlas/ sampler   │
├──────────────────────────── Server routes (Nitro) ────────────────────────────┤
│ /api/mars-advisor (LLM narrative) · /api/nasa/status · /api/nasa/donki ·       │
│ /api/nasa/rems — keys stay server-side                                         │
├──────────────────────────── Static data & assets ─────────────────────────────┤
│ public/data/nasa (snapshots + MANIFEST) · public/textures/mars · public/eva ·  │
│ public/draco · existing public/models, mars-terrain-library, sol-simulator     │
└────────────────────────────────────────────────────────────────────────────────┘
```

Dependencies only point downward. `src/core` imports nothing from React, the store or the network, which is what makes it testable and reproducible.

## 3. Directory layout (new and changed)

```
src/core/types.ts                  shared domain types
src/core/rng.ts                    mulberry32 + hashed sub-streams
src/core/science/constants.ts      constants with citations
src/core/science/marsTime.ts       Mars24 (MSD, MTC, LMST, Ls)
src/core/science/insolation.ts     top-of-atmosphere + dust-attenuated insolation
src/core/science/environment.ts    site environment (temperature, pressure, dose, dust season)
src/core/science/terrain.ts        MOLA grid sampling, slope, relief
src/core/science/eva.ts            suited-traverse time / O2 / hazard model
src/core/science/geo.ts            great-circle distance, bearings, interpolation
src/core/sim/{config,events,resources,engine,outcome}.ts
src/core/decision/{criteria,rules,engine,explain}.ts
src/data/{sites,layers,sources,evaSites}.ts
src/services/nasa/{mola,rems,traverses,donki,imagery,trek,status}.ts
src/services/atlas/{sampler,rasters}.ts
src/state/missionStore.ts
src/components/{shell,explorer,atlas,planner,simulator,decision,nasa,reports,common}/
src/routes/{index,explorer,atlas,planner,simulator,decisions,nasa-data,reports}.tsx
src/routes/api/nasa/{status,donki,rems}.ts
tests: src/**/*.test.ts (Vitest)
```

## 4. Shared mission state

```ts
interface MissionStoreState {
  version: 1;
  selection: { site: SiteRef | null; analysis: LocationAnalysis | null };
  comparison: SiteRef[];            // up to 3 pinned locations
  evaPlan: EvaPlan | null;          // drawn on real terrain in the Explorer
  plan: MissionPlan | null;         // validated in the Planner
  sim: SimState | null;             // advanced by the Simulator
  analysis: DecisionAnalysis | null;// last decision-engine output
  reports: MissionReport[];         // persisted outcomes
}
```

* Implemented with `useSyncExternalStore` (no new dependency); selectors keep re-renders local.
* Persisted to `localStorage` under `mars-survive:mission:v1`, wrapped in `try/catch`; a schema version gates migrations; simulation history is capped.
* Only actions mutate state: `selectSite`, `pinForComparison`, `setEvaPlan`, `savePlan`, `startSimulation`, `advanceSol`, `chooseOption`, `setAnalysis`, `finishMission`, `reset…`.

## 5. Integration flow (the end-to-end demo path)

1. **Mars Explorer** — user clicks a catalogue site or any point on the real-imagery globe → `selectSite`.
2. The **atlas sampler** queries all 10 layers at that point → `LocationAnalysis` (scores + flags) stored with the selection.
3. **Survival Atlas** shows the same selection, its layer values and lets the user pin up to 3 sites for comparison.
4. The user confirms a site → **Mission Planner** pre-fills site, environment and terrain risk; optional **EVA plan** drawn on Access Mars terrain (Gale sites) is attached.
5. `startSimulation(plan)` → engine `createInitialState(plan, environment)`.
6. **Mission Simulator** advances sol by sol (`stepSol`); environment comes from the site models (REMS-calibrated temperature/pressure, RAD-anchored dose, dust season).
7. When an event fires, the sim pauses at `awaiting-decision`.
8. **Decision Engine** `analyzeDecision(state)` evaluates every action (rules + Monte-Carlo look-ahead + multi-criteria score) and recommends one with an explanation.
9. The user confirms an action → `chooseOption` applies deterministic effects.
10. Resources, systems and crew update; the log and per-sol history grow.
11. At the end (or on failure) `finishMission` builds a **Mission Report** (decisions, consumption, incidents, determining factors) → **Mission Reports**.

## 6. Domain core

### 6.1 Science models (`src/core/science`)
* **Mars time** — Mars24 algorithm (Allison & McEwen 2000): MSD, MTC, LMST for a longitude, areocentric solar longitude Ls.
* **Insolation** — daily-mean top-of-atmosphere flux from Ls (declination, heliocentric distance), attenuated by dust optical depth τ with a documented global-irradiance factor.
* **Environment** — temperature from an empirical model calibrated against the bundled REMS record (Gale); pressure from REMS seasonal curve scaled by MOLA elevation (scale height 11.1 km); GCR dose equivalent anchored to MSL-RAD 0.64 mSv/sol (Hassler et al. 2014) and scaled by atmospheric column; dust-season factor from Ls.
* **Terrain** — bilinear sampling of the MOLA MEGDR 4 px/deg grid, slope from central differences on the areoid-referenced grid, local relief.
* **EVA** — suited walking speed vs grade (Tobler-type function, stated assumption), metabolic O2 from energy equivalent of oxygen, hazard thresholds on slope.

### 6.2 Simulation engine (`src/core/sim`)
* State: O₂ (kg), water (kg), food (crew-days), battery (kWh), systems health (life support, power, habitat, comms, rover, ISRU), crew health/morale/dose, habitat temperature, science progress, environment, active effects, pending event, log, history.
* Daily balance per sol: crew consumption (NASA BVAD rates), ECLSS recovery and ISRU production gated by power and subsystem health, power generation (solar with dust or fission), load shedding priority (ISRU → science → heating → life support), thermal drift, health/morale dynamics, wear.
* Events: dust storm, power failure, communications loss, habitat damage, O₂ leak, water-system failure, vehicle failure, medical emergency, solar particle event, scientific discovery. Each has a base probability, condition multipliers, severity and 3–4 actions with deterministic effects. Probabilities are configurable per scenario.
* Determinism: every random draw comes from `rng(hash(seed, sol, stream))`, so all alternatives see the same future environment (common random numbers).
* Outcome: `failed` (O₂ exhausted, 3 sols without water, crew health < 15, habitat integrity < 10, dose > 600 mSv), `compromised` (completed with low margins/health/objectives), `success`.

### 6.3 Decision engine (`src/core/decision`)
1. Read state → identify risks (rule base: reserves in sols, system health, environment).
2. For each action: check constraints (vetoes such as "no EVA during an SEP"), apply its effects to a clone, simulate `H` sols (default 10) over `N` seeds (default 24) with an autopilot for later events.
3. Metrics: survival probability, minimum reserve (sols of O₂/water/power), expected crew health and morale, resource cost, science impact, risk index.
4. Multi-criteria score with weights from the mission's risk posture; rule penalties/bonuses are added explicitly.
5. Output `DecisionAnalysis`: ranked alternatives, contributions per criterion, fired rules, median trajectories, consequences, recommendation and a deterministic natural-language explanation.
6. Same state + same seed ⇒ identical analysis.

### 6.4 LLM layer
`/api/mars-advisor` receives the `DecisionAnalysis` and mission snapshot. The prompt forbids new facts, requires citing the provided numbers and states that state changes happen only through the user's confirmed action. Without a key, a deterministic narrative is returned. The response is displayed as "AI narrative", separate from the engine's analysis.

## 7. Services and data

| Adapter | Live source | Bundled snapshot | Type |
| --- | --- | --- | --- |
| `mola` | — (PDS has no CORS) | `public/data/nasa/mola/megt90n000cb_int16le.bin` | REAL |
| `trek` | Mars Trek WMTS tiles (CORS) | `public/textures/mars/*` zoom-3 mosaics | REAL imagery |
| `rems` | `mars.nasa.gov` REMS feed (CORS) via `/api/nasa/rems` or direct | `public/data/nasa/rems/msl_rems_weather.json` | REAL |
| `traverses` | MMGIS GeoJSON (CORS) | `public/data/nasa/traverses/*` | REAL |
| `donki` | `/api/nasa/donki` (server key) | Sol-by-Sol 2024 episodes | REAL |
| `imagery` | NASA Image and Video Library (CORS) | — | REAL |

Each adapter returns `{ status: 'live' | 'snapshot' | 'demo' | 'error', data, source, retrievedAt, notes }`. The NASA Data Center lists all sources, runs health checks and shows limitations.

## 8. 3D and maps

* **Globe** (R3F): sphere with Viking MDIM 2.1 or MOLA colour-relief texture (1 k → 4 k progressive), optional MOLA vertex displacement with exaggeration, click-to-coordinates raycast, catalogue markers, great-circle routes.
* **Surface EVA** (R3F): Access Mars Draco glTF terrain (scaled to metres), tile textures upgraded `_xsm` → base nearest-first, POIs with their original texts, waypoint drawing, elevation/slope profile sampled from the mesh.
* **Survival Atlas** (Leaflet, `CRS.EPSG4326`): Trek tiles online, bundled mosaic offline; raster layers rendered client-side from the MOLA grid and models; vector layers for sites, resources, traverses, routes.
* Heavy views are client-only (`ssr: false`) and lazy-loaded per route.

## 9. Quality

* Vitest suites for resource consumption, sol advance, event activation, risk calculation, decision evaluation and success/failure conditions, plus science helpers.
* `tsc --noEmit` clean (existing 8 errors fixed), `vite build` green.
* Input validation with zod in the planner; adapters never throw into the UI.
* Accessibility: keyboard-reachable controls, `aria-live` for simulation updates, reduced-motion respected.
