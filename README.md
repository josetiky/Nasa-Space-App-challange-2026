# M.I.Y.H. — Mars In Your Hands

**NASA International Space Apps Challenge 2026 · *Martian Map* challenge · Team Space Rockstars**

> **Human footprints over 60 years of robot tracks.**
> A walking-scale map for the first people who will explore Mars on foot: it plans the next few hundred meters of an astronaut's walk on real NASA terrain, judges the route and the body together, and explains every decision in plain language.

**Status: early prototype.** The engine (planner, health rules, data pipeline) is in place and tested. We are now iterating on the interface. Everything here is meant to be simple to use and easy to extend.

---

## Contents

1. [The experience](#1-the-experience)
2. [How it works](#2-how-it-works)
3. [Features](#3-features)
4. [Data honesty: provenance labels and confidence classes](#4-data-honesty-provenance-labels-and-confidence-classes)
5. [NASA data and scientific sources](#5-nasa-data-and-scientific-sources)
6. [Technology and why we chose it](#6-technology-and-why-we-chose-it)
7. [Architecture and code map](#7-architecture-and-code-map)
8. [Validation and tests](#8-validation-and-tests)
9. [Run it locally and deploy](#9-run-it-locally-and-deploy)
10. [Design and accessibility](#10-design-and-accessibility)
11. [Scalability and roadmap](#11-scalability-and-roadmap)
12. [What makes M.I.Y.H. different](#12-what-makes-miyh-different)
13. [Documentation index](#13-documentation-index)
14. [Use of AI](#14-use-of-ai)
15. [Team, credits and licenses](#15-team-credits-and-licenses)

---

## 1. The experience

M.I.Y.H. is a guided journey. A mission guide greets first-time visitors and offers a one-minute tour, a top bar always shows "Step X of 5" with a button to the next step, and every button says what it does.

| # | View | What you do |
| --- | --- | --- |
| — | **Home** | A narrated arrival and a landing in Gale crater, then "Start the mission". |
| 1 | **Plan your walk** (MarsWalk) | Pick a real Gale site, start, goal and science stops. A* computes the safest route and tells you if there is enough oxygen to get back. |
| 2 | **Watch the simulated walk** | The astronaut walks the route in time (×1 to ×300). Vitals, suit, consumables, health state and the assistant log update live; incidents can happen on the way. |
| 3 | **Explore Mars in 3D** | The ship's hatch opens and you roam the terrain in our Unity WebGL simulator. "Finish exploring" takes you on. |
| 4 | **The story of the rovers** | A carousel of 11 Mars missions, the lessons each one left and its terrain in 3D. |
| 5 | **How we built it** | The team, the challenge, the numbers behind the project. |
| + | **Sources** | Every dataset, standard, tool and license, with links. |

---

## 2. How it works

Three layers, each one checkable.

**1 · Real data.** NASA Mars Trek tiles, the MOLA elevation model, Curiosity's REMS weather and its traverse, DONKI solar particle events, and the Access Mars terrain meshes of Gale crater (1 m Curiosity stereo). See [section 5](#5-nasa-data-and-scientific-sources).

**2 · Deterministic rules.**
- **Route:** a multi-layer A* planner finds the lowest-cost route inside a hard *safety envelope*: forbidden slopes, zones and low-confidence terrain are removed from the graph, never just penalized. Safety always beats distance.
- **Body:** the **HUELLA** rule set (thresholds from NASA-STD-3001 Vol. 2, Apollo metabolic data and the NASA SUITS telemetry format) feeds a 5-state health state machine: NORMAL → FATIGUE → CAUTION → CRITICAL → EMERGENCY. Critical states latch and need a recorded human confirmation to step down.
- **Coupling:** the health state and the astronaut's physiological needs change the route weights and limits in real time. A tired astronaut gets a gentler route; a critical one is sent to the nearest shelter.
- **The rules decide; the assistant only explains.**

**3 · Interfaces built for a crew.** Big type, one main action per screen, states shown with color *and* shape, every number next to its limit, keyboard navigation, "reduce motion" support, a typeface designed for low vision, English and Spanish.

---

## 3. Features

### MarsWalk planner
- **A\* on real terrain:** 129×129 nodes at 1 m over five Curiosity stereo scenes in Gale (Landing Site, Pahrump Hills, Marias Pass, Murray Buttes, Vera Rubin Ridge), plus a synthetic validation field.
- **Six cost terms**, all shown in a "why this route" breakdown: Distance, Terrain, Risk, Energy, Uncertainty and Health.
- **Weight profiles** (balanced, fastest, safest, resource-saving, best-known terrain, emergency) and fine-tuning. The safety envelope is never relaxed by preferences.
- **Explainable blocking:** "24° slope, the safe limit is 20°" plus up to three safe alternative points.
- **Return margin:** consumables left after getting back (O₂, CO₂ scrubber, cooling water, battery), the point of no return and a 30-minute reserve (HUELLA PRE-01 / EVA-01).
- **Science itinerary (multi-stop):** origin → science stations → goal. Each leg is its own A* search under the same envelope. Work time at each stop consumes oxygen and counts in the margin. Unreachable stops are skipped with a reason. The default walk is a 2.6 h EVA through three real Curiosity targets and back to the rover.
- **Science on this route:** real Curiosity targets with photos. Targets on 40° butte walls get a safe observation point, validated with the planner itself.
- **Maps:** orthophoto + hillshade + contours from the Access Mars meshes, slope, zones, confidence, storms and SEP layers, with a legend for each.

### Walk simulation
- Time control **×1, ×5, ×15, ×60, ×300** (mission seconds per real second).
- **Telemetry sources:** a deterministic generator, replays of the six HUELLA walks, or a **live astronaut** (solo mission) whose age, height, mass, VO₂max, load, suit setpoint and radiation history you can edit. Fan, cooling, leak, arrhythmia and comms failures can be injected mid-walk.
- **Health state machine** drawn live, with transitions, latches and human-confirmation dialog.
- **Physiological dynamic weights:** heart-rate residual, core temperature, CO₂, SpO₂, strain index and more are compared with the nominal baseline from the HUELLA data and raise the A* weights smoothly (rise 20 s, fall 120 s).
- **Mars environment:** real Mars24 local solar time and Sun elevation in Gale, REMS pressure and temperatures (with their age), GCR dose derived from pressure, DONKI SEP status. Each value shows whether it is REAL, DERIVED, MODELLED or SIMULATED. Examples: now in Gale, sunset, dust season, real SEP.
- **Incidents from real precedents:** dust storms (MY34, 2018), SEPs, dust on solar power, Parmitano 2013 (water in helmet), Leonov 1965 (suit ballooning), Cernan 1966 (overexertion), Irwin 1971 (arrhythmia) and relay gaps. Their probability depends on season, opacity, DONKI, EVA time and slope.
- **Replanning with a 10% stability rule**, return to start along known terrain if the goal becomes inadmissible, and an automatic end of EVA back at the rover.

### Exploration, missions and sources
- **3D exploration** in our Unity WebGL topographic simulator, opened through an animated ship hatch.
- **Mission atlas:** 11 Mars missions with profile, lessons and terrain in 3D (Gale meshes are REAL; other terrains are clearly labeled MODELLED).
- **Sources view** with every dataset, standard, tool and font, and its license.

### Guidance
- First-visit welcome, a 15-step guided tour with spotlights, a "Step X of 5" bar, "next" buttons between views, and a "Help" mode on each console that numbers and explains its parts.

---

## 4. Data honesty: provenance labels and confidence classes

Every value on screen carries one of four labels:

| Label | Meaning | Example |
| --- | --- | --- |
| **REAL** | Measured by a NASA mission | REMS pressure, Curiosity terrain, DONKI events |
| **DERIVED** | Computed from real data or the real clock | Mars24 solar time, GCR dose from REMS pressure |
| **MODELLED** | Climatology, models or design assumptions | Seasonal dust τ, metabolic cost, station work time |
| **SIMULATED** | Generated for the demo | Suit telemetry, storms, failures |

There is no public real-time stream from the surface of Mars. REMS publishes one record per sol with a delay, so we show its age, and DONKI measures solar particles near Earth. We say so in the interface.

Terrain cells also carry a **scientific confidence class**: K1 rover-traversed > K2 surface stereo > K3a–K3d orbital DTMs/DEMs > K4 inferred > K5 unknown. Unknown cells (`NaN`) are never filled with zero. They become K5 and are excluded from the route. See [SCIENTIFIC_CONFIDENCE.md](docs/miyh/SCIENTIFIC_CONFIDENCE.md).

---

## 5. NASA data and scientific sources

Full register, with endpoints, formats, resolution, update rate, restrictions and verification status: [docs/miyh/DATA_SOURCES.md](docs/miyh/DATA_SOURCES.md).

### Data used in the app

| Source | Institution | Used for | Link |
| --- | --- | --- | --- |
| Access Mars terrain meshes (Gale, ~1 m, glTF/Draco) | NASA JPL & Google Creative Lab (Apache-2.0) | Elevation grids, slope, orthophotos for the 5 Gale scenes | https://github.com/googlecreativelab/access-mars |
| Mars Trek WMTS tiles | NASA SSERVI / JPL | Base maps, atlas layers | https://trek.nasa.gov/mars/ |
| MOLA MEGDR | Mars Global Surveyor · PDS Geosciences | Global elevation | https://pds-geosciences.wustl.edu/missions/mgs/megdr.html |
| HiRISE (via Mars Trek) | MRO · Univ. of Arizona | High-resolution imagery of Curiosity's area | https://www.uahirise.org/ |
| Rover traverses and waypoints (MMGIS) | NASA/JPL | Curiosity path, boxwork campaign | https://mars.nasa.gov/maps/location/?mission=M20 |
| REMS daily weather | NASA/JPL-Caltech, CAB (CSIC-INTA) | Pressure, temperatures, opacity, sunrise/sunset | https://mars.nasa.gov/msl/weather/ |
| REMS archive | PDS Atmospheres (NMSU) | Reference series | https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/ |
| DONKI solar particle events | NASA CCMC / M2M | SEP alerts (api.nasa.gov with CCMC fallback) | https://ccmc.gsfc.nasa.gov/tools/DONKI/ |
| MSL Analyst's Notebook | PDS Geosciences | Validation of traverses | https://an.rsl.wustl.edu/ |
| NASA Image and Video Library | NASA | Mission imagery | https://images.nasa.gov/ |
| Curiosity mission pages and Photojournal | NASA | Science targets, context | https://science.nasa.gov/mission/msl-curiosity/ |
| NASA SUITS Telemetry Stream Server | NASA SUITS | Suit telemetry format; recordings converted to HUELLA | https://github.com/SUITS-Techteam/TSS_2024 |

### Human factors and standards

| Source | What we take from it |
| --- | --- |
| **NASA-STD-3001 Vol. 2**, ch. 11 Spacesuits, and OCHMO technical briefs (radiation, CO₂) — https://www.nasa.gov/reference/11-0-spacesuits-vol-2/ | Suit pressure, CO₂, thermal and dose limits behind the HUELLA rules |
| **xEVA concept of operations** (EVA-EXP-0042) — https://ntrs.nasa.gov/citations/20205008200 | Walking on slopes up to 20°, EVAs up to 8 h |
| **Human Research Program evidence reports** — https://ntrs.nasa.gov/citations/20220004017 | EVA risk, workload and fatigue |
| **Surface EVA health and performance** — https://ntrs.nasa.gov/citations/20230015332 · https://ntrs.nasa.gov/citations/20230014953 | Loads observed in simulations, VO₂ peak ≥ 36.5 mL/kg/min |
| **EVA Walkback and Integrated Suit Tests**, NASA/TP-2009-214796 — https://ntrs.nasa.gov/citations/20080013604 | Metabolic cost of suited walking in partial gravity |
| **Apollo metabolic rates**, NASA TN D-7883 — https://www.nasa.gov/wp-content/uploads/static/history/alsj/tnD7883Metabolic.pdf | Flat-ground calibration (1000 kJ/h reference) |
| **Baseline Values and Assumptions (BVAD)**, NASA/TP-2015-218570 | Crew consumables |
| **SEXTANT** (MIT) — https://dspace.mit.edu/handle/1721.1/59560 | Prior art in EVA traverse planning |
| **MSL-RAD** surface dose (Hassler et al., 2014) | 0.64 mSv/day anchor for the GCR dose |
| **Mars dust climatology** (Montabone et al., doi:10.1016/j.icarus.2014.12.034) | Seasonal dust opacity |

### Models and equations

| Model | Use |
| --- | --- |
| Pandolf et al. (1977) load-carriage equation, weight terms scaled to 0.38 g | Metabolic power while walking |
| Tobler hiking function | Speed versus slope (alternative locomotion model) |
| Tanaka (2001) HRmax = 208 − 0.7·age | Heart-rate reserve of the live astronaut |
| Mosteller body-surface area | Cooling-garment heat removal |
| Mars24 (Allison & McEwen, 2000) | Local true solar time, Ls and Sun elevation in Gale |

### Historical precedents behind the incidents

ISS US EVA-23 (Parmitano, 2013), Voskhod 2 (Leonov, 1965), Gemini 9A (Cernan, 1966), Apollo 15 (Irwin, 1971), the 2018 global dust storm (MY34) and the end of Opportunity, Curiosity/RAD surface SEPs (September 2017), and orbiter relay windows (MRO, Odyssey).

---

## 6. Technology and why we chose it

| Technology | Why |
| --- | --- |
| **TypeScript (strict)** | The planner and health engine are safety logic: strict types catch unit and null mistakes early. |
| **React 19** | A component model for consoles that update every tick, with concurrent rendering for smooth playback. |
| **TanStack Start + TanStack Router** (Vite) | File routes, server routes for the NASA proxies (API keys stay on the server), SSR, one codebase for web and API. |
| **TanStack Query** | Caching and retries for NASA endpoints (REMS, DONKI, images). |
| **Vite 8** | Fast dev server and builds. |
| **Tailwind CSS 4** + hand-written CSS | Design tokens for the general UI; custom CSS for the crew consoles where every pixel matters. |
| **Radix UI** (via shadcn/ui), **lucide-react** | Accessible primitives: dialogs, sliders, tabs, focus management. |
| **three.js · React Three Fiber · drei · Draco** | 3D globe, landing sequence, mission terrains and Gale meshes in the browser. |
| **Unity (WebGL)** | Our first-person topographic simulator for the Exploration view. |
| **Leaflet** | Tiled 2D maps over Mars Trek WMTS. |
| **Recharts** | Telemetry and consumable charts. |
| **zod**, **react-hook-form** | Validation of mission parameters and data contracts. |
| **Python** | Data preparation: orthophotos from the Access Mars meshes, HUELLA rule engine and synthetic walks, SUITS-to-HUELLA conversion. |
| **Node scripts (tsx)** | NASA snapshot download (`npm run data:fetch`), elevation tile and HUELLA replay builders. |
| **Vitest** | Unit and property tests for the engine (see section 8). |
| **ESLint + Prettier** | Consistent, reviewable code. |
| **Netlify** (Nitro preset) | Static site + serverless functions for the NASA proxies; NASA snapshots are fetched at build time so the demo still works if an endpoint is down. |
| **Gemini API (optional)** | Optional narration of decisions in the Decision Intelligence page. It never decides anything and falls back to local text without a key. |
| **Fonts:** Atkinson Hyperlegible (Braille Institute), Syncopate, Inter, JetBrains Mono (OFL) | Legibility for low vision on the crew consoles. |

---

## 7. Architecture and code map

```
src/
  core/trek/            Pure engine (no React, no network): fully testable
    contracts/            Types and invariants (routes, envelopes, directives, tours)
    costmap/              Static terrain + dynamic snapshot (storms, SEP, dust, Sun)
    cost/ safety/         Cost terms D·T·R·E·U·H and the safety envelope
    routing/              A*, trace, planner with fallback ladder, multi-stop tours
    health/               HUELLA rules, fatigue, FSM, directives, physiology, live suit
    resources/            Consumables, return margin, locomotion models
    env/                  Mars environment (Mars24 clock, REMS, DONKI, provenance)
    sim/                  Session, replanner, scenarios, historical incidents
  services/             NASA adapters and proxies, Gale site catalog and tiles
  state/                Store that connects the engine to the UI
  components/trek/marswalk/   The guided M.I.Y.H. experience (views, consoles, guide)
  routes/               Pages and server routes (/api/nasa/*)
scripts/                Data builders (tiles, orthophotos, HUELLA replays, NASA snapshot)
public/data/            Prepared data (Gale elevation tiles, orthophotos, HUELLA walks)
docs/miyh/              Design documents and decision records (see section 13)
```

The session cycle on every tick: **costmap → resources → health (rules + fatigue + FSM → directive) → physiological weights → safety envelope → A\* → replan decision.**

---

## 8. Validation and tests

- **299 automated tests** (46 files) with Vitest, including property tests over hundreds of random grids:
  - A* never crosses a forbidden slope or zone, and smoothing never increases slope or cost.
  - Same input, same route (determinism).
  - The FSM steps down one level at a time, latches CRITICAL/EMERGENCY and never reports NORMAL without data.
  - Team directives always use the most restrictive crew member.
  - Every default science tour is reachable and returns to the rover.
  - No engine message is left untranslated in English.
- **HUELLA rule parity:** the TypeScript rules reproduce the Python rule engine exactly on six simulated walks built from NASA physiology data:
  - a normal walk
  - a fan failure
  - a suit leak
  - heat stress
  - an arrhythmia
  - a loss of communication

  The normal walk raises no alerts, a short scare does not trigger an alarm, and each failure escalates to the expected level.
- **SUITS telemetry:** we recorded telemetry from NASA's SUITS Telemetry Stream Server and converted it to the HUELLA format.

```bash
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

---

## 9. Run it locally and deploy

Requirements: Node.js 22.

```bash
npm ci
cp .env.example .env     # optional keys, see below
npm run dev              # http://localhost:8081 (or the port Vite prints)
```

| Variable | Needed? | Purpose |
| --- | --- | --- |
| `NASA_API_KEY` | Optional | api.nasa.gov key for DONKI. `DEMO_KEY` works but is rate-limited; the app falls back to the CCMC service. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional | Narration in Decision Intelligence. Without it, local text is used. |

Deploy: the included `netlify.toml` builds the site, downloads a NASA data snapshot and publishes the server routes as Netlify Functions. See [COMO_PUBLICAR_EN_NETLIFY.md](COMO_PUBLICAR_EN_NETLIFY.md).

The guided experience lives at `/trek`. The previous modules (Mars Explorer, Survival Atlas, Mission Planner, Sol-by-Sol simulator, Decision Intelligence, NASA Data Center, Reports) are still in the app and described in [docs/README_MARS_SURVIVE.md](docs/README_MARS_SURVIVE.md).

---

## 10. Design and accessibility

- One main action per screen; a "next step" button between views; a guided tour on first visit.
- Color is never the only signal: states also use shape, text and position.
- Every number is shown next to its limit ("17.2° of 20°").
- Atkinson Hyperlegible typography, large sizes, high contrast, readable through a visor.
- Full keyboard navigation, focus management in dialogs, `prefers-reduced-motion` respected (including the hatch animation).
- English and Spanish, including the engine's warnings.
- Voice narration of the assistant log is available in the walk console.

---

## 11. Scalability and roadmap

M.I.Y.H. is deliberately simple on the surface and modular underneath: the engine is pure TypeScript with no UI or network dependencies, so it can be reused, tested and moved.

**More places**
- Any site with a NASA elevation model can be added: HiRISE DTMs (1–2 m, e.g. Jezero mosaics), the USGS 1 m Gale DEM, the HRSC–MOLA 200 m blend for regional context.
- **The same engine works for the Moon and Artemis**: swap gravity (0.38 g → 0.166 g), terrain tiles (LOLA/LRO) and the sunlight model.

**Better data**
- Perseverance **MEDA** weather for Jezero.
- Calibrated REMS series and the Mars Climate Database for dust and temperature forecasts.
- WSA-ENLIL arrival times at Mars for SEP and CME warnings.
- CRISM/THEMIS layers for soil firmness and science value.

**Real crews**
- **Live suit telemetry** following the NASA SUITS format.
- Multi-astronaut EVAs with buddy rules.
- Rover-assisted traverses.
- Mission-control handover and an offline/edge mode for habitat computers with no Earth link.

**Smarter planning**
- Optimal ordering of science stops (a traveling-salesman variant with time windows).
- Sunset- and battery-aware turnaround times.
- Uncertainty-aware routes from DTM error maps.

**Accessibility (priority for the next versions)**
- Color-blind-safe palettes and patterns, selectable per user (protanopia, deuteranopia, tritanopia).
- Captions and visual alerts for every spoken message, so deaf and hard-of-hearing users get the full narration; vibration/flash cues for alarms.
- Full spoken dictation of the guide and the consoles for blind and low-vision users, and screen-reader-first descriptions of maps and routes.
- Simplified "classroom" mode and more languages.

**Education**
- Lesson plans and challenges built on the real NASA data, always labeled, for schools and science-outreach programs (for example, communities with limited connectivity: the app runs in any browser with nothing to install).

---

## 12. What makes M.I.Y.H. different

- **Walking scale.** Mars Trek and USGS map whole regions; M.I.Y.H. plans the next few hundred meters of an astronaut's walk.
- **Body plus terrain.** Slope, oxygen, CO₂, heart rate, temperature and radiation are judged together in one GO/NO-GO, and the astronaut's state changes the route in real time.
- **Science-aware.** A walk is a sequence of science stations with work time, not just A to B.
- **Explainable.** When a route is blocked, it says why and offers a safe alternative. The rules decide; the assistant only explains.
- **Honest data.** Real, derived, modelled and simulated values are labeled everywhere.
- **Grounded in history.** Incidents come from real EVAs and real Martian weather.
- **For everyone.** Mission planners get a walking-scale GO/NO-GO before an EVA. Crews get a console they can read through a helmet visor. Students and teachers explore Mars with real NASA data. It runs in any web browser.

**This is only the beginning.** M.I.Y.H. is a prototype, but its pieces were built to grow: the same engine can plan walks anywhere NASA has an elevation model, the same rules can read real suit telemetry, and the same interface can teach a classroom or brief a crew. We kept it simple on purpose. The first people on Mars will need tools they can trust at a glance, and so will the next generation that is learning about Mars today.

---

## 13. Documentation index

| Document | Content |
| --- | --- |
| [docs/miyh/ARCHITECTURE.md](docs/miyh/ARCHITECTURE.md) | System architecture of the navigation engine |
| [docs/miyh/ROUTING_ALGORITHM.md](docs/miyh/ROUTING_ALGORITHM.md) | A*, cost terms, fallback ladder, smoothing, explanations |
| [docs/miyh/DYNAMIC_COSTMAP.md](docs/miyh/DYNAMIC_COSTMAP.md) | Layers, zones, storms, SEP, dust and Sun |
| [docs/miyh/ASTRONAUT_HEALTH_STATE_MACHINE.md](docs/miyh/ASTRONAUT_HEALTH_STATE_MACHINE.md) | HUELLA rules, FSM, latches, directives |
| [docs/miyh/RESOURCE_MANAGEMENT.md](docs/miyh/RESOURCE_MANAGEMENT.md) | Consumables, return margin, locomotion models |
| [docs/miyh/SCIENTIFIC_CONFIDENCE.md](docs/miyh/SCIENTIFIC_CONFIDENCE.md) | Confidence classes K1–K5 |
| [docs/miyh/DATA_SOURCES.md](docs/miyh/DATA_SOURCES.md) | Full register of 39 data sources with verification status |
| [docs/miyh/TESTING_STRATEGY.md](docs/miyh/TESTING_STRATEGY.md) | Test plan and invariants |
| [docs/miyh/UX_UI_GUIDELINES.md](docs/miyh/UX_UI_GUIDELINES.md) | Crew-interface guidelines |
| [docs/miyh/ROADMAP.md](docs/miyh/ROADMAP.md) | Roadmap |
| [docs/miyh/HUELLA_SYNTHETIC_WALKS.md](docs/miyh/HUELLA_SYNTHETIC_WALKS.md) | How the six HUELLA walks were generated and their sources |
| [docs/miyh/decisions/](docs/miyh/decisions/) | Decision records ADR-001 to ADR-005 |
| [docs/miyh/plans/](docs/miyh/plans/) | Implementation plans and progress ledger |
| [docs/](docs/) | Earlier documents: data pipeline, decision engine, simulation model, installation |

Most design documents are written in Spanish, the team's working language.

---

## 14. Use of AI

- **Building the project.** We used Claude, Gemini and NotebookLM to help write code, structure data-cleaning scripts and organize documentation. Every physical value and threshold comes from the NASA sources listed above, and the team reviewed each one before using it.
- **Inside the app.** An optional Gemini call can narrate the Decision Intelligence results in plain language. It never takes decisions: routes and health states come only from the deterministic engine, and without an API key the app uses local text.
- No NASA logos are used. NASA imagery is credited to its sources.

---

## 15. Team, credits and licenses

**Space Rockstars** — Grecia, Lulú, Tiky and Pao.

- Terrain: NASA/JPL-Caltech MSL; Access Mars (Apache-2.0, NASA JPL & Google Creative Lab).
- Photos: NASA/JPL-Caltech, MSSS, Cornell, Univ. of Arizona, ASU, CNSA/PEC (CC BY 4.0), The Mars Society (CC BY-SA 4.0), Wikimedia Commons.
- Textures: Solar System Scope (CC BY 4.0).
- Fonts: Atkinson Hyperlegible (Braille Institute), Syncopate, Inter, JetBrains Mono (SIL OFL).

Educational prototype for the NASA International Space Apps Challenge 2026. **Not endorsed by NASA.**
