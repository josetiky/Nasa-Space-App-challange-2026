# Installation and operation

## Requirements

- Node.js **20.19+ or 22.12+** (required by Vite 8) and npm.
- A modern browser with WebGL 2 (Chrome, Edge, Firefox, Safari 17+).
- Internet access for live NASA data. The app also works offline with saved snapshots; see below.

## Install and run

```bash
git clone <repo-url> mars-survive && cd mars-survive
git checkout feature/intelligent-mission-control
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The dev server also serves the server routes (`/api/nasa/*`, `/api/mars-advisor`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload (regenerates `src/routeTree.gen.ts`) |
| `npm test` | Unit tests (Vitest): science models, simulator, decision engine, planning, store, adapters, exports |
| `npm run typecheck` | `tsc --noEmit` (strict, `exactOptionalPropertyTypes`) |
| `npm run build` | Production build (TanStack Start + Nitro) into `.output/` |
| `npm run preview` | Preview the production build |
| `npm run data:fetch` | Download offline snapshots of the NASA sources (see below) |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Environment variables (server side only)

Create `.env` (or set them in your host). They are read only by server routes and never sent to the browser.

```bash
NASA_API_KEY=your_api_nasa_gov_key   # DONKI SEP events; DEMO_KEY is used if missing (rate-limited)
GEMINI_API_KEY=...                   # optional, narration in Decision Intelligence and the legacy advisor
GEMINI_MODEL=gemini-2.5-flash-lite   # optional
```

## Offline snapshots of NASA data

```bash
npm run data:fetch                         # MOLA, REMS, both traverses, DONKI, Trek tiles zoom 0–2
npm run data:fetch -- --trek-zoom=3        # more detailed basemap tiles (larger download)
npm run data:fetch -- --only=mola,rems     # a subset
```

Files go to `public/data/nasa/` with a `manifest.json`, and the NASA Data page shows what was saved. At runtime every adapter tries the live source (or the server proxy) first. A snapshot is used only when that fails, and it is labelled as such. Without network access and without snapshots, the affected layers report "unavailable". They never show invented values.

Approximate sizes: MOLA grid 2 MB, REMS 0.5 MB, traverses < 1 MB, Trek tiles (zoom 0–2, two layers) about 2 MB.

## Deployment

The build uses Nitro. `@lovable.dev/vite-tanstack-config` targets Cloudflare by default; use a Node or Vercel preset if your host needs one. The server routes matter:

- `/api/nasa/mola` streams the MOLA grid from the PDS Geosciences Node, which sends no CORS headers. Without server routes, run `npm run data:fetch` before building so the grid ships as a static file.
- `/api/nasa/rems` and `/api/nasa/donki` keep the API key server-side and add caching.
- `/api/mars-advisor` holds the optional Gemini key.

Purely static hosting still works: Trek tiles, REMS, traverses and the NASA Images API allow browser CORS, and MOLA and DONKI can come from snapshots.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "MOLA unavailable" in the atlas | The PDS proxy is unreachable and no snapshot exists. Run `npm run data:fetch -- --only=mola` |
| Basemap "offline" | trek.nasa.gov is unreachable. Saved tiles are used if present (`--trek-zoom` controls detail) |
| REMS "unavailable" | mars.nasa.gov is unreachable. Save a snapshot with `--only=rems` |
| DONKI shows "bundled 2024" | api.nasa.gov rate limit or outage. Set `NASA_API_KEY` |
| Surface EVA stuck on "Decoding…" | The Draco decoder must be the default (master) build in `public/draco/`, because Access Mars meshes use Draco bitstream 2.0 |
| Stale mission after an update | Mission data lives in `localStorage` (`mars-survive:mission:v1`); clear it from the browser devtools |
