# IMPLEMENTATION_ROADMAP

_Phase 1 deliverable · phased plan with acceptance criteria. Status is updated at the end of each phase._

| Phase | Goal | Main deliverables | Acceptance criteria | Status |
| --- | --- | --- | --- | --- |
| 1 · Audit | Understand what exists | `PROJECT_AUDIT.md`, `FEATURE_COMPARISON.md`, `TECHNICAL_ARCHITECTURE.md`, this roadmap | Every module classified reuse/adapt/new; NASA endpoints tested | ✅ Done |
| 2 · Visual integration | One navigation, one look, shared state | App shell (sidebar + status bar + real Mars clock), dark mission-control theme, mission store, route stubs for the 8 modules, legacy routes kept, misleading labels fixed, TS errors fixed | All old routes still render; new nav reaches every module; `tsc` clean | ✅ Done |
| 3 · Mars Explorer | Real-data 3D exploration | Globe with Trek imagery + MOLA relief, click-to-coordinates, catalogue sites, Surface EVA on Access Mars terrain with POIs and waypoint profile | Selecting a point updates the shared selection; EVA plan stored | ✅ Done |
| 4 · Survival Atlas | Scientific cartography | 10 toggleable layers with legend/unit/source/period/resolution/data-type, location analysis, 3-site comparison, hazard & resource references | Clicking a point samples all layers; "use as mission site" flows to the planner | ✅ Done |
| 5 · Decision Engine | Deterministic recommendations | Rules, criteria, look-ahead evaluator, explanations, Decision Intelligence page, advisor integration | Same input ⇒ same output; dust-storm example ranks A–D with reasons | ✅ Done |
| 6 · Mission Simulator | Sol-by-sol mission with decisions | Engine, 10 event types, planner → simulator, decision loop, history, success/compromised/failed, reports | A full run produces a report; outcomes reachable in tests | ✅ Done |
| 7 · NASA Data | Honest integrations | Bundled snapshots + adapters + server proxies + status page | Each source shows live/snapshot status and limitations | ✅ Done |
| 8 · Testing & optimisation | Prove it works | Vitest suites, build, browser verification, lazy loading, texture LOD | Tests green, build green, end-to-end flow verified in a browser | ✅ Done |
| 9 · Documentation | Hand-off | `README.md`, `SYSTEM_ARCHITECTURE.md`, `DATA_SOURCES.md`, `SIMULATION_MODEL.md`, `DECISION_ENGINE.md`, `INSTALLATION.md`, attributions | A teammate can install, run and extend the platform | ✅ Done |

## Status (November 2026)

All nine phases are implemented on branch `feature/intelligent-mission-control`: 102 unit tests passing, `tsc --noEmit` clean, production build green, and the end-to-end flow verified in headless Chrome.

Known follow-ups:

- ✅ Temperature and pressure calibrated against REMS (Gale, sols 1–4995). Next: latitudinal validation (Viking, Pathfinder, Phoenix, InSight records) and a polar-cap model.
- Ship offline snapshots with the deployment (`npm run data:fetch`) so MOLA-based layers work on static hosts.
- Higher-resolution topography (HRSC/CTX DEMs) for regional EVA planning outside the four Access Mars sites.
- Optional: code-split the heaviest 3D chunks further and add a service worker for offline tiles.

## Order of work and rationale

1. **Core before UI.** Science models, simulator and decision engine are written and unit-tested first; the UI then binds to stable functions.
2. **Data snapshots early.** Bundled NASA data (MOLA grid, Trek mosaics, REMS, traverses) are prepared before building the layers that depend on them.
3. **Shell second.** Navigation and the store land before individual modules so every page is integrated from day one.
4. **Legacy stays reachable.** Mission Lab, Hazard Layers, Resources, Protocols and Sol by Sol remain under "Reference" in the navigation.

## Out of scope (documented, not built)

* WebVR/WebXR headsets (Access Mars' VR modes rely on removed WebVR APIs).
* Operational flight-rules; this is a planning and education tool.
* Global HiRISE-scale terrain beyond the Access Mars sites.
