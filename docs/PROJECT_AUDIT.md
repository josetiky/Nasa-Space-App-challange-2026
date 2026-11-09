# PROJECT_AUDIT — MARS // SURVIVE → Intelligent Mission Control

_Phase 1 deliverable · audited 2026-11-08/09 · NASA Space Apps Challenge 2026_

This audit records what exists today, how it works, what is real versus simulated, and what can be reused. Every statement below was verified against source code, the running sites, or a live request to the data provider on the dates shown. Nothing here is a NASA endorsement.

## 1. Method

| Resource | How it was inspected |
| --- | --- |
| **A. MARS // SURVIVE** (main project) | Source cloned from `github.com/lshtiaq/Nasa-Space-App-challange-2026` at commit `a3be377` (2026-10-08). Every route/component read, `npm install` + `vite build` + `tsc --noEmit` executed, deployed site `nasaspaceappchallange2026.vercel.app` inspected in a browser. |
| **B. Access Mars** | Local copy in `NASA Space App Challenge/access-mars` (upstream `googlecreativelab/access-mars` @ `4b0a445`). Code, `package.json`, assets and glTF headers parsed programmatically. |
| **C. Mars Guide Buddy / Aether Survey** | Live site `mars-guide-buddy.lovable.app`, all four routes read. |
| **D. ATLAS — Mars Survival Story** | Live site `atlas-mars.vercel.app`, Mission Mode and Map Mode exercised, network resources listed. |
| **NASA data services** | Each endpoint requested from a browser (cross-origin) to verify status, format and CORS. Details in §6. |

## 2. Project A — MARS // SURVIVE (the project we evolve)

### 2.1 Stack

| Layer | Technology (version in `package.json`) |
| --- | --- |
| Framework | TanStack Start `^1.168` (React 19.2, file-based TanStack Router, SSR shell, Nitro server build) |
| Build | Vite `8.1.5` (Rolldown), `@lovable.dev/vite-tanstack-config` |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix), tokens in `src/styles.css` (`ink`, `panel`, `line`, `fog`, `bright`, `amber`, `cyan`, `rose`, `mint`) |
| 3D | three `0.186`, @react-three/fiber `9`, @react-three/drei `10` |
| Data/UI libs | TanStack Query, recharts 2, zod, lucide-react, sonner |
| Server | TanStack Start server route `/api/mars-advisor` (Gemini via `GEMINI_API_KEY`, local fallback) |
| Language | TypeScript, `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` |
| Tooling | ESLint 9, Prettier. **No test runner.** |

`vite build` succeeds (≈2 s; Nitro defaults to a Cloudflare worker output). `tsc --noEmit` **fails with 8 strict-mode errors** (missing `override` modifiers in `MarsExplorer.tsx`, `ErrorComponent` prop type in `__root.tsx`, index-signature access to `process.env` in `mars-advisor.ts` and to a record in `mission-lab.tsx`).

### 2.2 Architecture as found

```
src/routes/__root.tsx      shell: header nav (8 links), theme toggle, footer
src/routes/index.tsx       home: hero globe + MarsExplorer + stats + NasaDataAtlas + SurvivalSimulator
src/routes/hazard-layers   6 static hazard cards
src/routes/resources       6 resource cards + NASA registry links
src/routes/mission-lab     7-tab workspace (overview, 3D terrain, sim, region library, landing sites, planner, research)
src/routes/protocols       6 static protocol cards
src/routes/sol-by-sol      iframe → public/sol-simulator (original vanilla-JS 500-sol simulator)
src/routes/api/mars-advisor.ts   POST question+mission JSON → Gemini or deterministic fallback
src/components/MarsExplorer.tsx  943-line monolith: globe, regional GLBs, layers, waypoint panel, Marswalk overlay
src/components/SurvivalSimulator.tsx  6-slider weighted index
src/components/NasaDataAtlas.tsx      provenance cards from src/data/nasaDatasets.ts
```

There is **no shared state**: every page keeps its own `useState`. Site data is duplicated (5 sites in `MarsExplorer`, 6 in Mission Lab, 5 in `sol-simulator/app.js`, a free-text destination list in the planner). Nothing selected on one page reaches another.

### 2.3 Feature status

| Feature | Status | Notes |
| --- | --- | --- |
| **Mission Map** (globe, waypoints, 5 layer toggles) | Works, demo data | Globe = Nestaeric CC BY 4.0 model. Markers placed from real coordinates. Layer toggles only recolour markers; telemetry chips (suit power 78 %, wind 18 km/h, relay 98 %) are hard-coded. Route arc always goes to "the first other site". |
| 3D regional terrain (7 GLBs) | Works, unverified provenance | `custom GLB builder` meshes (~40 k vertices, unlit textures with pins/labels). Preview PNGs display the **NASA insignia** and claim "Source: NASA MOLA" although the assets' origin is undocumented → misleading; UI labels them "7 NASA-ready models". |
| **Hazard Layers** | Static content | Six cards; several values are illustrative (e.g. "3 days out", "12 per 100 km²"). Not connected to the map. |
| **Resources** | Static content | Careful wording ("planning abstractions"); links to six NASA Open Data Portal records. |
| **Mission Lab** | Works | Good workspace UX. Planner only produces a text brief; "Region Library" shows 46 PNGs of unverified provenance (low-res, palette images). CSS targets Tailwind class chains (`.mission-lab-explorer > .mb-5.grid`) — brittle. |
| **NASA Data** | Partial | Honest provenance registry (metadata pages only, no data). No live integration. |
| **Simulator** (home) | Works, toy model | Weighted index of six sliders; no time dimension. |
| **Survival Protocols** | Static content | Thresholds described but never evaluated. |
| **Sol by Sol** | Works — **best existing model** | Deterministic seeded RNG (mulberry32), 500 sols, BVAD-based O₂/H₂O constants, Curiosity RAD dose baseline, NASA-STD-3001 600 mSv limit, bundled NASA DONKI 2024 SEP snapshot with optional live refresh. Isolated in an iframe; its results never reach the React app. UI text says "OpenAI" while the API now uses Gemini. |
| **AI Mission Advisor** | Works | Server-side key, deterministic fallback. Prompt already forbids inventing NASA data. Receives only the Sol-by-Sol snapshot. |

### 2.4 Data integrity

* **Real**: site coordinates; planetary constants (gravity, sol length, CO₂ fraction); RAD baseline, BVAD values and the 600 mSv limit inside Sol by Sol; DONKI 2024 episode dates; NASA dataset links.
* **Simulated / illustrative but shown without a label**: telemetry chips, viability scores (82, 48 …), "route confidence 91 %", Marswalk progress, checklist "7/8 READY", hazard values, regional model labels.
* **Header clock** "SOL 214 · 06:42 LST" is a constant.

### 2.5 Reuse decision

Keep the framework, design tokens, shadcn components, routes, globe asset, Mission Lab, Sol by Sol and the advisor endpoint. Extract site data into one catalogue, add a shared mission store and pure domain engines, relabel misleading UI, and fix the 8 TypeScript errors.

## 3. Project B — Access Mars (Google Creative Lab · NASA/JPL)

| Item | Finding |
| --- | --- |
| License | Apache-2.0 (code); assets ship in the same repository. Attribution to Google Creative Lab and NASA/JPL-Caltech required. |
| Runtime | A-Frame `googlecreativelab/aframe#v0.6.0c-mod` (2017 fork) + forked three.js with progressive JPEG decoding via an emscripten libjpeg WebWorker, Browserify 14, Babel 6, `node-sass` 4 (deprecated, fails on modern Node). |
| Terrain | 5 sites (Landing Site/Bradbury, Pahrump Hills, Marias Pass, Murray Buttes, 2017 "live" site). Each `terrain.glb` is **glTF 2.0 with `KHR_draco_mesh_compression`** (COLLADA2GLTF), 64 tiles + background + simplified collision mesh; node names encode tile metadata (`TYPE_TILE`, `ID`, `SIZE`, `MD`, `LG`). Tile textures in 4 LODs (`_xsm` 64 px → `_sm` → base 256–512 px → `_lg`). ≈5 MB per site without `_lg`. |
| Content | Points of interest with positions in metres and texts (e.g. "Buckskin" drill target, "Selfie", "Conjunction"), 26 card images, voice-over audio, rover model, site map. |
| Compatibility | The A-Frame/three forks cannot run inside React 19 / three 0.186 and add WebVR APIs that browsers removed. **Decision: do not port the runtime. Reuse the data** — the Draco glTFs load with the modern `GLTFLoader` + `DRACOLoader` — and re-implement LOD texture streaming and POIs in React Three Fiber. |
| Local copy | `public/css/vr.css` has an uncommitted change (compiled SCSS). Left untouched. |

## 4. Project C — Mars Guide Buddy / "Aether Survey"

* It is the **Lovable-hosted ancestor of Project A** (A's README links it as the live app). Same five sites and texts, darker theme, four routes (Map, Hazard Layers, Resources, Survival Protocols).
* Data is **simulated** (e.g. "Water ice High 12 wt %, 3.2 m depth", "Dust storm 3 days out", "Survival score 82/100"). These numbers must not be presented as NASA measurements.
* At inspection time the globe stalled at "LOADING MARS 0%" (hosted model unavailable).
* Ideas worth keeping: the "Survival Atlas" framing, ranked candidate sites, the dark mission-control look.

## 5. Project D — ATLAS: a Mars survival story

* CesiumJS globe streaming real tiles from Mars Trek (Viking MDIM 2.1, HiRISE mosaics) and Esri OnMars; layers for elevation, slope hazard, ground firmness, chemical hazard, roughness, dust cover, rover traverses, landing sites, caves, exploration zones.
* Map Mode: Marswalk route drawing (explore vs emergency pacing), walking range, line of sight, obstacle marking, sunlight, storm time-to-cover, haul-road, signal-delay simulation, rover replays, site reports.
* Mission Mode: episodic narrative ("1.1 Briefing and cargo", 6 steps) with crew roles, lander mass budgets, power choices with sourced numbers (Kilopower), and a "see a run that failed" path.
* **We take inspiration only** (decision framing, crew roles, failure scenarios, map↔story coupling). No ATLAS code or assets are reused; no license was published.

## 6. NASA data services (tested 2026-11-09 from a browser)

| Service | Result | Use in platform |
| --- | --- | --- |
| Mars Trek WMTS tiles `trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0/default/default028mm/{z}/{row}/{col}.jpg` (Viking MDIM 2.1, MOLA colour shaded relief) | 200, CORS ✔ | Live basemaps; zoom-3 mosaics bundled as offline textures |
| PDS Geosciences MOLA MEGDR 4 px/deg (`megt90n000cb.img`, 1440×720 int16 MSB, m) | 200, **no CORS** | Bundled snapshot (converted to little-endian only) → elevation, slope, shielding layers |
| `mars.nasa.gov/rss/api/?feed=weather&category=msl` (Curiosity REMS) | 200, CORS ✔, 4 745 sols | Live adapter + bundled snapshot; calibrates the temperature/pressure model |
| `…category=mars2020` (Perseverance MEDA) | 200 but ~1 KB (no daily data) | Documented as unavailable |
| MMGIS rover traverses (M20 traverse/waypoints, MSL traverse) | 200, CORS ✔ | Exploration-routes layer (real), bundled snapshot |
| NASA Image and Video Library `images-api.nasa.gov` | 200, CORS ✔ | Site imagery in the Explorer (credits kept) |
| DONKI SEP `api.nasa.gov/DONKI/SEP` | 503 / timeout with `DEMO_KEY` during tests | Server-side proxy with the team key; Sol-by-Sol 2024 snapshot as fallback |
| Mars Rover Photos API | **Archived** by api.nasa.gov (repository archived 2025-10-08) | Not used |
| InSight Mars Weather API | Mission ended 2022; static | Not used |
| Esri OnMars MDEM200M ImageServer | Metadata OK; `identify`/`exportImage` blocked | Not used |

## 7. Risks and corrective actions

1. **Misleading provenance** (NASA insignia in previews, "NASA-ready" labels) → relabel as illustrative; recommend replacing previews.
2. **Simulated numbers without labels** → every value in the new platform carries a `REAL / DERIVED / MODELLED / SIMULATED` badge and a source.
3. **No shared state, no tests** → single mission store + Vitest suites for the engines.
4. **Monolithic components / brittle CSS** → new modules are split by concern; legacy components stay untouched where they work.
5. **Network dependency during demos** → bundled, documented snapshots with live refresh when available.
6. **API keys** → only server routes read keys; the browser never sees them.
