# Data sources

Every NASA source the platform uses, how it is reached, what it feeds, and its limitations. The registry shown in the **NASA Data Center** (`src/data/sources.ts`) mirrors this document, and each entry there has a live health check that performs the real request.

## Access strategy

Each adapter (`src/services/nasa/adapters.ts`) tries, in order:

1. **live**: the browser calls NASA directly, for services with CORS.
2. **proxy**: our server route calls NASA, for services without CORS or that need a key.
3. **snapshot**: a file saved by `npm run data:fetch` in `public/data/nasa/`.

The origin actually used is displayed next to the data. If every route fails, the UI says the source is unavailable; values are never invented.

## Integrated sources

| Source | Endpoint | Access | Feeds | Limitations |
| --- | --- | --- | --- | --- |
| **MOLA MEGDR** (MGS MOLA, PDS Geosciences Node) | `pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.img` | snapshot → `/api/nasa/mola` (PDS has no CORS) | Elevation, slope and hazard layers; pressure, radiation and temperature models; globe relief; site analysis | 4 px/deg (~15 km): too coarse for EVA-scale slopes. Areoid heights. Range −8068…21134 m |
| **Mars Trek WMTS** (NASA Solar System Treks, JPL) | `trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0/default/default028mm/{z}/{row}/{col}.jpg` | live (CORS) → saved tiles | Atlas basemaps; globe texture (zoom 1→2, HD 3) | Layers used: `Mars_Viking_MDIM21_ClrMosaic_global_232m`, `Mars_MGS_MOLA_ClrShade_merge_global_463m`. Visual mosaics, not radiometric data |
| **Curiosity REMS** (MSL; NASA/JPL-Caltech/CAB) | `mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json` | live (CORS) → `/api/nasa/rems` → snapshot | Overview weather widget, NASA Data table, model calibration reference | Gale only; gaps when the instrument is off; opacity is categorical |
| **Rover traverses and waypoints** (MMGIS, JPL) | `mars.nasa.gov/mmgis-maps/{M20,MSL}/Layers/json/{M20,MSL}_traverse.json`, `…/MSL_waypoints.json` | live (CORS) → snapshot | Atlas "Exploration routes" layer. Waypoints (sol, lat, lon, elevation) gave the rover elevation for the REMS calibration and the position of the Mount Sharp boxwork site (centroid of sols 4575–4711) | Traverses simplified with Douglas–Peucker (2·10⁻⁵°). Localisation can lag the latest drives |
| **HiRISE Curiosity roving-site mosaic** (MRO HiRISE via Mars Trek) | `trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{row}/{col}.png` | live (tiles as images, CORS) | Basemap of the boxwork Marswalk (Explorer → Boxwork EVA) | PNG tiles to zoom 16 (≈0.64 m/px); covers 137.12–137.73°E, 4.25–4.93°S. Imagery only. Registration with rover waypoints is not guaranteed to the metre. The same area's `Gale_DEM_SMG_1m` tiles are 8-bit visual stretches (one grey level ≈ several metres), so they are **not** used as elevations |
| **Curiosity boxwork waypoints** (MMGIS `MSL_waypoints.json`) | same file, sols 4530–4711 | bundled in `src/data/boxwork.ts` (retrieved 2026-11-09, column checksums checked against the source) | Boxwork Marswalk: positions, elevations above the areoid, rover tilt, drive lengths and odometer | Elevations differenced over short legs amplify localisation errors, so leg grades are labelled as derived from rover elevations |
| **Curiosity mission blog and Photojournal** (NASA) | `science.nasa.gov/blog/…`, `science.nasa.gov/photojournal/…` | links + summaries written for the app | The 8 boxwork science stops (sol, what was done there), each with its source link; PIA26558/PIA26559 images via the NASA Image and Video Library | Stop positions are the waypoints of the sols the blog posts describe |
| **DONKI SEP** (CCMC via api.nasa.gov) | `api.nasa.gov/DONKI/SEP?startDate&endDate&api_key` | `/api/nasa/donki` (key server-side) → snapshot → **bundled 2024 record** | SEP frequency and severity context (NASA Data) | Observed near Earth; used statistically, not by date. `DEMO_KEY` is rate-limited |
| **NASA Image and Video Library** | `images-api.nasa.gov/search?q=…&media_type=image` | live (CORS) | Imagery for the mission site | Keyword search, not georeferenced |
| **Access Mars terrain** (Google Creative Lab + NASA JPL Ops Lab; Apache-2.0) | `github.com/googlecreativelab/access-mars` | bundled in `public/eva/` | Surface EVA planner (terrain mesh, textures, POIs) | Four Gale crater sites from Curiosity's 2012–2016 traverse; Draco bitstream 2.0 needs the default (master) decoder |

The "bundled 2024 record" is the list of DONKI 2024 SEP episodes that the original Sol-by-Sol simulator already shipped (`public/sol-simulator/app.js`). It is real data, labelled with its period.

## Not integrated (and why)

| Service | Reason |
| --- | --- |
| Mars Rover Photos API | Archived on api.nasa.gov (source repository archived 2025-10-08) |
| InSight Mars Weather Service | Mission ended in December 2022; static data. REMS is used instead |
| Original data.nasa.gov records (Viking IRTM, Odyssey MARIE, MRO CRISM…) | The team archive holds landing-page metadata, not instrument data. Listed for provenance only |

## Derived and modelled layers

| Layer | Type | How |
| --- | --- | --- |
| Elevation | REAL | MOLA grid, bilinear sampling at pixel centres |
| Slope | DERIVED | Central differences on the MOLA grid (regional slope, not rock-scale) |
| Temperature | MODELLED | Annual-mean daily temperature from TOA insolation, latitude and lapse rate (see SIMULATION_MODEL.md) |
| Radiation | MODELLED | GCR dose equivalent anchored to MSL-RAD at Gale, scaled with column pressure |
| Dust storms | DERIVED | Qualitative activity from literature storm tracks and basins |
| Water ice | DERIVED | Qualitative likelihood from published ice deposits (SHARAD, Phoenix, debris aprons) |
| Resources | REAL positions | Documented mineral, ice and hazard targets with references |
| Landing zones | REAL positions | Successful landers (mission, agency, year) and the platform's catalogue sites |
| Hazards | DERIVED | 0.5·slope + 0.3·relief + 0.2·elevation, each smoothstep-normalised |
| Routes | REAL + SIMULATED | MMGIS traverses (real) + the user's planned legs (labelled as plans) |

## Offline snapshots

`npm run data:fetch` writes:

```
public/data/nasa/
  manifest.json                         what was saved, when, and from where
  mola/megt90n000cb_int16le.bin (+ .lbl) MEGDR converted to little-endian int16, with its PDS label
  rems/msl_rems_weather.json            trimmed REMS feed
  traverses/m20.json, msl.json          simplified traverse lines
  donki/sep.json                        raw DONKI SEP records (last 365 days)
  trek/{viking,molaShade}/{z}/{row}/{col}.jpg
```

The script uses the same unit-tested transforms as the app (`src/services/nasa/transform.ts`).

## Credits

NASA data are generally not subject to copyright in the United States. Credit lines used in the app: *NASA/JPL-Caltech*, *NASA/JPL-Caltech/USGS* (Viking mosaic), *NASA/JPL-Caltech/GSFC* (MOLA), *NASA/JPL-Caltech/CAB(CSIC-INTA)* (REMS), *NASA CCMC* (DONKI). Access Mars: © 2017 Google Inc., Apache License 2.0 (see `public/eva/NOTICE.md`).
