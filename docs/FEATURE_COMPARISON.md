# FEATURE_COMPARISON

_Phase 1 deliverable · how each reference contributes to MARS // SURVIVE — Intelligent Mission Control_

Legend: ✔ present · ◐ partial / demo values · — absent. **Plan** column: **Reuse** (kept as is), **Adapt** (kept, rewired or relabelled), **New** (built from scratch).

## 1. Capability matrix

| Capability | A · MARS // SURVIVE | B · Access Mars | C · Aether Survey | D · ATLAS | Plan |
| --- | --- | --- | --- | --- | --- |
| Interactive 3D globe | ✔ Nestaeric model | — | ◐ (model failing) | ✔ Cesium | **Adapt**: new globe with real Mars Trek imagery + MOLA relief; legacy globe kept on Mission Lab |
| Real terrain from mission data | — | ✔ Curiosity stereo terrain (5 sites) | — | ✔ HiRISE/CTX tiles | **Adapt**: Access Mars glTF+Draco reused in a new R3F "Surface EVA" view |
| Progressive texture loading | — | ✔ LOD tiles + progressive JPEG | — | ✔ tile streaming | **New** (LOD swap `_xsm` → base, closest-first) |
| Points of interest with context | ◐ 5 waypoints | ✔ POIs with cards | ◐ | ✔ | **Adapt**: real site catalogue + Access Mars POIs |
| Coordinates on selection | ✔ fixed sites only | — | ✔ fixed | ✔ any point | **New**: click any point → lat/lon |
| Route visualisation | ◐ decorative arc | — | — | ✔ Marswalk tools | **New**: great-circle legs on globe/atlas + EVA path on real terrain |
| Layered atlas with toggles | ◐ 5 toggles recolour markers | — | ◐ cards only | ✔ 13 layers with sources | **New**: 10 independent layers with legend, unit, source, period, resolution, data-type badge |
| Elevation / slope | — | ✔ local mesh | — | ✔ | **New**: MOLA MEGDR grid (bundled) + slope derived; EVA-scale slope from Access Mars mesh |
| Temperature / radiation / dust | ◐ static numbers | — | ◐ static | ✔ | **New**: REMS-calibrated models, RAD-anchored dose, dust climatology zones, all labelled |
| Water ice / resources | ◐ text | — | ◐ simulated numbers | ✔ | **New**: literature-derived proxy + documented detections |
| Landing zones | ◐ | — | ◐ | ✔ | **New**: historical landers (real coordinates) |
| Rover traverses | — | — | — | ✔ | **New**: MMGIS M20 + MSL traverses (real) |
| Location comparison | — | — | ◐ ranking | ◐ site report | **New**: pin up to 3 sites, side-by-side scores |
| Mission planning | ◐ text brief | — | — | ✔ cargo/power choices | **New**: validated mission plan feeding the simulator |
| Sol-by-sol simulation | ✔ Sol by Sol (iframe) | — | — | ◐ episodes | **Adapt**: constants and seeded RNG ported into a typed engine; iframe kept |
| Random events with choices | — | — | — | ✔ narrative | **New**: 10 event types, configurable probabilities, 3–4 actions each |
| Decision engine | — | — | — | ◐ scripted | **New**: deterministic multi-criteria + Monte-Carlo look-ahead + rules |
| LLM explanations | ✔ advisor endpoint | — | — | ✔ "Ask ATLAS" | **Adapt**: advisor receives the engine's structured analysis; cannot change state |
| NASA data provenance | ✔ registry (metadata) | ◐ credits | — | ✔ attribution panel | **Adapt**: registry + live status checks + bundled snapshots |
| Mission reports | — | — | — | ◐ failed-run view | **New**: persisted reports with decisions, consumption, incidents, factors |
| Real Mars time (MSD/LMST) | — hard-coded clock | — | — | ✔ | **New**: Mars24 algorithm |
| Survival protocols | ✔ static | — | ✔ static | — | **Adapt**: thresholds evaluated live against the simulation |
| Hazard / resource reference | ✔ | — | ✔ | — | **Reuse** inside Survival Atlas (routes kept) |
| Region image library | ✔ 46 PNGs | — | — | — | **Reuse** in Mission Lab (provenance flagged) |
| Dark mission-control theme | ◐ light default | — | ✔ | ✔ | **Adapt**: dark default, light kept |
| Mobile 360 / VR | — | ✔ WebVR (obsolete API) | — | — | **New** (touch orbit, responsive); WebVR not ported |

## 2. What is reused, adapted, built

**Reused as is**: TanStack Start shell, shadcn/ui components, design tokens, Nestaeric globe asset, Mission Lab, Sol-by-Sol iframe page, Hazard/Resources/Protocols routes, NASA dataset registry, error pages.

**Adapted**: navigation (8 primary modules + reference group), theme (dark default), home → Overview dashboard, `/api/mars-advisor` (accepts decision analyses), Sol-by-Sol constants/RNG → typed engine, Access Mars terrain + POIs → R3F, misleading labels corrected, TypeScript errors fixed.

**New**: shared mission store; science models (Mars time, insolation, temperature/pressure, radiation, terrain sampling, EVA cost); simulation engine; decision engine; NASA adapters and server proxies; Mars Explorer (globe + Surface EVA); Survival Atlas (Leaflet, 10 layers, analysis, comparison); Mission Planner; Mission Simulator; Decision Intelligence; NASA Data Center; Mission Reports; Vitest suites; documentation set.

## 3. Ideas deliberately not copied

* ATLAS code, layers or narrative text (no license; inspiration only).
* Access Mars voice-over and WebVR controllers (obsolete APIs, large audio payload).
* Simulated numbers from Aether Survey (e.g. "12 wt % ice at 3.2 m").
