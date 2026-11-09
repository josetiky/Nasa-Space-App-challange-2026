# Simulation model

All models live in `src/core` as pure, unit-tested TypeScript. Every constant is either sourced (with its reference in `src/core/science/constants.ts`) or marked **ASSUMPTION** in the code. Outputs are labelled MODELLED or SIMULATED in the UI.

> **Calibration status.** Temperature and pressure are calibrated against Curiosity REMS at Gale: 36 solar-longitude bins (medians of sols 1–4995, 4,717 valid sols, retrieved 2026-11-09). Each sol is referred to −4450 m using the rover elevation from the MMGIS waypoints. Residuals: daily mean 0.72 K RMS, diurnal range 1.8 K RMS, pressure 0.40 % RMS (`src/core/science/calibration/`, enforced by `calibration.test.ts`). A single site constrains the seasonal cycle, not the latitudinal structure, whose coefficients remain assumptions (see §4).

## 1. Environment models (`src/core/science`)

**Mars time (Mars24, Allison & McEwen 2000).** From UTC: Julian date (TT), Mars Sol Date `MSD = (JD_TT − 2451549.5)/1.0274912517 + 44796 − 0.0009626`, Coordinated Mars Time, solar longitude Ls (with the planetary perturbation terms), equation of time and local true solar time. **Mars year** (Clancy et al. numbering): counted from the MY 37 equinox (MSD 52961.52, 2022-12-26) with the tropical year (686.9726 d), snapped near boundaries using Ls. Tests cover the equinoxes of MY 37, 38 and 39 and MY 1.

**Insolation.** Daily-mean top-of-atmosphere insolation from solar declination and heliocentric distance (Mars' orbital eccentricity, perihelion at Ls ≈ 251°), with S₀ = 1361 W/m² scaled by 1/r². Surface value = TOA × T(τ), with **T(τ) = exp(−0.45 τ)** (ASSUMPTION: global direct + diffuse transmission).

**Pressure.** `P(z, Ls) = 843.9 Pa · exp(−(z + 4450 m)/11.1 km) · (1 + Σ a_k cos kLs + b_k sin kLs)`, with fitted harmonics k = 1: (0.0537, −0.0352) and k = 2: (−0.0464, 0.0502). It reproduces REMS's seasonal CO₂ cycle at Gale (737 Pa at Ls ≈ 150°, 918 Pa at Ls ≈ 255°) to within 0.4 % RMS.

**Temperature (daily mean).** `T̄ = A + B·Q̄₄(lat) + Bs(lat)·(Q^¼ − Q̄₄(lat)) − 52·(lat/90)² − 1.5 K/km·(z + 4450 m)/1000 − 2·max(0, τ − 0.5)` K, floored at 148 K (CO₂ frost). Q is the daily-mean TOA insolation and Q̄₄ the annual mean of Q^¼ at that latitude, so the first terms set the annual-mean latitudinal structure and the third the seasonal cycle.
- Fitted to REMS: A = −72.49 K and the tropical seasonal sensitivity Bs₀ = 43.73.
- Assumptions: B = 83, the latitude term, and the blend `Bs(lat) = B − (B − Bs₀)·cos²(lat)`, under which seasons are damped in the tropics and approach equilibrium toward the poles.
- Diurnal range: `R = 64.58 K · (Q/180 W/m²)^0.576 · exp(−0.22·max(0, τ − 0.5))`, with R₀ and the exponent fitted. REMS shows 54 K at aphelion and 71 K near perihelion.
- Plausibility outside Gale: Phoenix summer comes out at −106…−40 °C (the lander measured roughly −95…−20 °C) and Viking 2 summer at −94…−29 °C.

**Radiation (GCR).** `D = 0.64 mSv/day · (850 Pa / P)^0.25` per day, converted to per-sol. Anchored to MSL-RAD's surface dose equivalent at Gale (Hassler et al. 2014: 0.64 ± 0.12 mSv/day). The pressure exponent 0.25 is an ASSUMPTION representing extra shielding by a thicker column. Habitat shielding factors are also ASSUMPTIONS: surface 10 %, regolith-covered 40 %, lava tube 70 % dose reduction. Limits: NASA-STD-3001, 600 mSv career and 250 mSv per SPE. SEP multipliers: ×1 / ×4 / ×12 by severity.

**Terrain (MOLA MEGDR, 4 px/deg).** Bilinear elevation; regional slope from central differences; local relief from the 3×3 neighbourhood range. Column mass `σ = P/g` gives the "shielding" in g/cm².

**Ice and dust proxies (DERIVED, qualitative 0–1).** Ice likelihood = max(logistic latitude term centred at |lat| = 52°, influence of published ice regions: Arcadia, Utopia (SHARAD), Deuteronilus, Phlegra, eastern Hellas aprons). Dust activity = influence of storm tracks and basins (Acidalia–Chryse, Utopia–Isidis, Arcadia–Amazonis, Hellas, Argyre–Noachis). Both are qualitative and must not be read as measured abundances.

**Location scores (0–100).**

| Score | Formula |
| --- | --- |
| Landing safety | 100·(0.45·f(elev; −2.5→+2 km) + 0.35·f(slope; 0.3→4°) + 0.2·f(relief; 200→3000 m)), with f = linear 1→0 (MSL required < −1 km: Golombek et al. 2012) |
| Radiation protection | 100·f(column; 26→8 g/cm²) |
| Thermal | 100·f(annual mean; −45→−105 °C) |
| Solar power | 100·(annual mean / max)·(1 − 0.35·dust activity) |
| Water | 100·ice likelihood |
| Science | 100·science value (proximity to documented targets) |
| **Habitability** | 0.25·landing + 0.15·radiation + 0.15·thermal + 0.15·solar + 0.20·water + 0.10·science |
| Risk | 100 − (0.5·landing + 0.25·radiation + 0.25·thermal) |

**Hazard index (atlas).** `0.5·s(slope; 0.3→3°) + 0.3·s(relief; 300→3000 m) + 0.2·s(elevation; 0→6 km)`, with s = smoothstep.

**EVA model.** Walking speed `v = 3 km/h · exp(−3.5·|g + 0.05|)/exp(−0.175)` (Tobler-type, normalised to 3 km/h on flat ground, ASSUMPTION). Metabolic rate 300 W + 12 W per degree of slope (ASSUMPTION). O₂ from the energy equivalent of oxygen (20.1 kJ/L, 700 L/kg). Slopes ≥ 15° raise a caution and ≥ 25° are no-go. Stops: 20 min per POI. On the Access Mars terrain the route is sampled every 1 m by ray-casting onto the collision mesh.

**Safe route (A\*).** `src/core/science/routing.ts` rasterises the collision mesh into a height grid (1 m nodes, coarser for long legs). A\* then searches 8-connected nodes:
- Steps at or above 25° and unknown terrain are impassable.
- Steps in the 15–25° caution band cost ×4 more.
- Step cost is `length·(1 + (slope/15°)²)`.
- Diagonals may not cut the corner of an impassable neighbour.

The node path is simplified by line of sight, without ever exceeding the raw path's steepest slope (sampled every half cell).

**Helmet HUD.** `src/core/science/evaWalk.ts` turns the route into a timeline (walking and science stops) using the same accounting as the EVA plan. Tests prove it ends on the plan's distance, duration and suit O₂. The HUD's GCR dose uses the Gale dose-rate model (MODELLED).

## 2. Mission simulator (`src/core/sim`)

**State.** Resources (O₂ kg, water kg, food crew-days, battery kWh, spare kits), systems health (life support, power, habitat, comms, rover, ISRU; %), crew (health, morale, cumulative dose), habitat temperature, panel cleanliness, science, active effects, pending event, log, per-sol history, decisions, incidents and consumption totals.

**Randomness.** mulberry32 seeded by the plan. Each sol and channel gets its own hashed sub-stream (`streamRng(seed, sol, channel)`). The same plan and seed always give the same mission, and the decision engine can compare options on common random numbers.

**One sol (`stepSol`, pure).**

1. Environment of the sol: Ls from MSD, τ = seasonal background (dust season Ls 180–360°) + active storm effects, insolation, temperatures, pressure, dose rate (×SEP multiplier).
2. Power: `solar = A·0.25·I·cleanliness·health·f_events`, `fission = n·10 kWe·availability`, over 24.66 h. Demand tiers: base `6 kW + 1.2 kW/crew`; heating `max(0, UA·(21 °C − T_out) − internal gains)` with UA 0.08/0.05/0.03 kW/K (surface/regolith/lava tube) and internal gains = 70 % of base load + 0.1 kW per crew; ISRU at 15 kWh/kg O₂ and 1.5 kWh/kg water. Shortfalls shed **ISRU first, then heating**, and the base load is served last.
3. Life support: O₂ use 0.816 kg/crew-day (BVAD) + EVA O₂; 50 % regenerated (ASSUMPTION) scaled by ECLSS health and power. Water use 2.9 kg/crew-day, 98 % recovered (ISS 2023) scaled by health. ISRU output scales with power served, plant health and (for water) the site ice proxy `0.2 + 0.8·ice`. Food: 1 crew-day per crew per sol.
4. Habitat temperature relaxes toward the equilibrium set by gains and heat loss (response 0.3/sol), capped at the 21 °C set point.
5. Dose: indoor dose × (1 − shielding), outdoor dose during EVA hours.
6. Dust deposits on panels at 0.28 %/sol (Pathfinder); wind-cleaning events are random.
7. Systems wear daily (life support 0.06, power 0.05, habitat 0.03, comms 0.03, rover 0.05, ISRU 0.08 %/sol), faster under event effects.
8. Scheduled EVA (every N sols) only if τ < 3, no SEP, no shelter order and crew health > 45 %. It uses the saved Access Mars route (hours, O₂, science value) or a generic EVA. EVA *actions* chosen in events need τ < 4 and health > 40 %.
9. Science: +0.4 per sol of base operations, + 6 × max(0.35, route science value) per EVA (generic EVA: value 0.5). Target = 0.75 × duration.
10. Health: +0.3/sol baseline; −12 with no water, −2.5 with no food, up to −5 when the habitat is below 10 °C, a penalty when less than 80 % of the base load is powered, up to −6 when the daily dose exceeds 1.5 mSv, −0.5 when morale < 30. Morale relaxes toward 70 (3 %/sol) and drops with comms loss, health < 60 or habitat < 15 °C; it rises on EVA days. Event and action effects add their own per-sol terms.
11. Event roll (below). Failure checks, then the end-of-mission check.

**Events.** Ten types with base probabilities per sol, adjusted by context (season, site dust activity, systems health) and by the scenario multiplier × user multiplier:

| Event | Base p/sol | Context |
| --- | --- | --- |
| Dust storm | 0.010 | ×1.8 in dust season (×0.4 otherwise) × (0.5 + site dust activity) |
| Power failure | 0.004 | × wear factor (power) × 1.5 when τ > 2 |
| Comms loss | 0.004 | × wear factor (comms) |
| Habitat damage | 0.002 | × wear factor (habitat) × 2 when τ > 2 |
| O₂ leak | 0.003 | × wear factors (habitat, life support) |
| Water system failure | 0.004 | × wear factor (life support) |
| Vehicle failure | 0.003 | × wear factor (rover) × 2.5 on EVA sols |
| Medical | 0.003 | × 2 when health < 70 % × 2 on EVA sols |
| Solar particle event | 0.022 | constant: ≈ 16 episodes per Earth year (DONKI 2024) × 0.5 (ASSUMPTION for Mars geometry) |
| Discovery | 0.006 | × (0.5 + site science value + 1 on EVA sols) × rover health |

The wear factor is `1 + (100 − health)/k` (k = 40–80), so worn systems fail more often.

Scenarios: *nominal*; *dust season* (storms ×2.5, power ×1.4, habitat ×1.3); *harsh* (most hazards ×2.2); *training* (hazards ×0.5, discovery ×1.2). Each event has severity 1–3 (dust storms are more severe in dust season), an immediate effect, an optional ongoing effect, and 3–4 options. Each option has an immediate effect, optional ongoing effects, a risk (probability + complication effect), requirements (systems, spares, comms, EVA allowed), and can end or shorten the event effect.

**Outcomes.** *Failed* if O₂ reaches 0, 3 sols without water, crew health < 15 %, habitat integrity < 8 %, or dose ≥ 600 mSv. At the end: *success* if science ≥ 70 % of target, health ≥ 60 % and fewer than 10 % of sols flown with less than 5 sols of reserves; otherwise *compromised* (reasons listed in the report).

## 3. Planning helpers

**Supply sizing (`sizeSupplies`).** Net loss per sol after closure and ISRU (O₂: 50 % regeneration + EVA O₂; water: 98 % recovery − ISRU × ice factor), × duration × 1.25 contingency, plus a reserve of 30 sols with ISRU offline and short open-loop buffers. Food covers duration + 30 sols. Spares: `⌈sols/15⌉ + 2`.

**Feasibility preview (`feasibilityPreview`).** Runs the plan with 12 hashed seeds and the default autopilot (each event resolved with its default option), then reports success, compromised and failure rates, failure causes, and median health and science.

**EVA along a rover traverse (`planRoverTraverseEva`, `src/core/science/roverTraverse.ts`).** Used for the Mount Sharp boxwork Marswalk. The walk follows Curiosity's end-of-drive waypoints (MMGIS) from a start sol to a turn-around sol, optionally back. Positions are projected to local metres on the 3396.19 km sphere MMGIS uses for its easting/northing. Each leg is as long as the rover's measured drive when that was longer than the straight line between stops (detours around ridges), and keeps the straight-line grade, which is the steeper and therefore conservative value; time and O₂ then follow the suited-walking model above (`computeEvaPlan` with per-segment length factors). Hazards are named by sols: legs whose mean grade from rover elevations reaches 15° (caution) or 25° (no-go), and stops where the rover's own measured tilt reaches those thresholds. Science stops count once even on a return walk. The EVA's cosmic-ray dose uses the surface rate at the route's mean elevation (no suit shielding).

## 4. Known simplifications

- One habitat node; no crew-member individuality; no resupply windows.
- Event probabilities are planning assumptions, not measured hazard rates (except SEP frequency).
- MOLA's 15 km cells cannot resolve rocks or small craters. EVA slopes therefore come from the Access Mars terrain mesh, which only covers four Gale sites, or, on the boxwork Marswalk, from Curiosity's own elevations and tilt at its stops (nothing is known between stops beyond the rover having driven there).
- Temperatures are calibrated at one site (Gale). Mid- and high-latitude winters run cold (the CO₂ frost floor is reached too easily; Viking 2's winter means were about −105 °C), and polar summers run warm because there is no polar-cap model (the residual caps stay near the frost point).

## References

Allison & McEwen (2000) *Planet. Space Sci.* 48 · Anderson et al. (2018) NASA BVAD, NASA/TP-2015-218570/REV2 · Hassler et al. (2014) *Science* 343 · NASA-STD-3001 Vol. 1 · Golombek et al. (2012) *Space Sci. Rev.* 170 · Montabone et al. (2015) *Icarus* 251 · Smith et al. (2001) MOLA, *JGR* 106 · NASA ISS ECLSS water recovery milestone (June 2023) · Hecht et al. (2021) MOXIE, *Space Sci. Rev.* 217 · Landis & Jenkins (2000) Pathfinder dust deposition.
