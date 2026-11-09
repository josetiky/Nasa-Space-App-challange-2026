import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Footprints, Globe2, Mountain, Navigation, Plus, Route as RouteIcon, Save, X } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataBadge, Loading, Metric, Notice, btn, fmt, scoreTone } from "@/components/mission/ui";
import type { TextureSource } from "@/components/explorer/Globe";
import { distanceKm } from "@/core/science/geo";
import { sampleElevation } from "@/core/science/terrain";
import type { EvaPlan, GeoPoint, LocationAnalysis } from "@/core/types";
import { EVA_SITES, type EvaPoi } from "@/data/evaSites";
import { CATALOGUE_SITES, customSite, findCatalogueSite } from "@/data/sites";
import { analyzeSite, useGrid } from "@/services/analysis";
import { dispatchMission, useMission } from "@/state/missionStore";
import { cn } from "@/lib/utils";

const Globe = lazy(() => import("@/components/explorer/Globe"));
const SurfaceEva = lazy(() => import("@/components/explorer/SurfaceEva"));
const BoxworkTraverse = lazy(() => import("@/components/explorer/BoxworkTraverse"));
const LegacyExplorer = lazy(() => import("@/components/MarsExplorer").then((m) => ({ default: m.MarsExplorer })));

type Mode = "globe" | "surface" | "boxwork" | "regional";
const MODES: readonly Mode[] = ["globe", "surface", "boxwork", "regional"];

export const Route = createFileRoute("/explorer")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } => (MODES.includes(search["mode"] as Mode) && search["mode"] !== "globe" ? { mode: search["mode"] as Mode } : {}),
  head: () => ({ meta: [{ title: "Mars Explorer — MARS // SURVIVE" }, { name: "description", content: "3D Mars globe on NASA Trek imagery and MOLA relief, with real Curiosity terrain for EVA planning." }] }),
  component: ExplorerPage,
});

function snap(point: GeoPoint) {
  const nearest = CATALOGUE_SITES.map((site) => ({ site, d: distanceKm(point, site.point) })).sort((a, b) => a.d - b.d)[0];
  return nearest && nearest.d < 80 ? nearest.site : customSite(point.lat, point.lon);
}

function ExplorerPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const mode: Mode = search.mode ?? "globe";
  const setMode = (m: Mode) => void navigate({ to: "/explorer", search: m === "globe" ? {} : { mode: m }, replace: true });
  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[.24em] text-amber">Module 1 · Mars Explorer</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-.03em]">Navigate Mars on real data</h1>
          <p className="mt-1.5 max-w-3xl text-[13px] text-fog">Globe: NASA Trek Viking mosaic over MOLA relief, with real-time sunlight from the Mars24 clock. Surface: Curiosity's reconstructed terrain in Gale crater for EVA route planning. Boxwork: Curiosity's 2025 path on Mount Sharp over HiRISE imagery, as a Marswalk.</p>
        </div>
        <div className="flex max-w-full self-start overflow-x-auto rounded-xl border border-line p-1" role="tablist" aria-label="Explorer mode">
          {([
            ["globe", "Planetary globe", Globe2],
            ["surface", "Surface EVA · Gale", Footprints],
            ["boxwork", "Boxwork EVA · 2025", RouteIcon],
            ["regional", "Regional models", Mountain],
          ] as const).map(([m, label, Icon]) => (
            <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)} className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px]", mode === m ? "bg-amber/15 text-amber" : "text-fog hover:text-bright")}>
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "globe" ? (
        <GlobeMode onSurface={() => setMode("surface")} onBoxwork={() => setMode("boxwork")} />
      ) : mode === "surface" ? (
        <SurfaceMode />
      ) : mode === "boxwork" ? (
        <Suspense fallback={<div className="grid h-[60vh] place-items-center"><Loading text="Loading the boxwork traverse…" /></div>}>
          <BoxworkTraverse />
        </Suspense>
      ) : (
        <RegionalMode />
      )}
    </div>
  );
}

function GlobeMode({ onSurface, onBoxwork }: { onSurface: () => void; onBoxwork: () => void }) {
  const { grid, state: gridState } = useGrid();
  const store = useMission();
  const [exaggeration, setExaggeration] = useState(12);
  const [realSun, setRealSun] = useState(true);
  const [hd, setHd] = useState(false);
  const [landers, setLanders] = useState(true);
  const [hover, setHover] = useState<GeoPoint | null>(null);
  const [probe, setProbe] = useState<LocationAnalysis | null>(null);
  const [focus, setFocus] = useState<GeoPoint | null>(store.selectedSite?.point ?? null);
  const [texture, setTexture] = useState<TextureSource | null>(null);
  const onTextureSource = useCallback((s: TextureSource) => setTexture(s), []);
  const onPick = useCallback((p: GeoPoint) => setProbe(analyzeSite(snap(p), grid)), [grid]);
  const onHover = useCallback((p: GeoPoint | null) => setHover(p), []);
  const current = probe ?? store.analysis;
  const shown = useMemo(() => (current && grid && current.environment.elevationSource !== "mola" ? analyzeSite(current.site, grid) : current), [current, grid]);
  const isGale = shown ? distanceKm(shown.site.point, findCatalogueSite("gale")!.point) < 120 : false;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="relative h-[64vh] min-h-[440px] overflow-hidden rounded-2xl border border-line bg-black xl:h-[calc(100vh-200px)]">
        <Suspense fallback={<div className="grid h-full place-items-center"><Loading text="Starting 3D engine…" /></div>}>
          <Globe grid={grid} exaggeration={exaggeration} realSun={realSun} hd={hd} selected={store.selectedSite?.point ?? null} probe={probe?.site.point ?? null} traverse={store.traverse} focus={focus} showLanders={landers} onPick={onPick} onHover={onHover} onTextureSource={onTextureSource} />
        </Suspense>
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/65 px-3 py-2 font-mono text-[10.5px] text-white/85 backdrop-blur">
          <span className="text-white/60">Imagery:</span>
          <span>{!texture ? "loading…" : texture.kind === "trek" ? `Viking MDIM 2.1 · Trek zoom ${texture.zoom} (${texture.origin})` : texture.kind === "mola" ? "MOLA colour relief (Trek unreachable)" : "none (Trek and MOLA unavailable)"}</span>
          <span className="text-white/40">|</span>
          <label className="flex items-center gap-1.5">
            Relief ×{exaggeration}
            <input type="range" min={0} max={40} step={2} value={exaggeration} onChange={(e) => setExaggeration(Number(e.target.value))} className="w-20 accent-amber" disabled={!grid} aria-label="Vertical exaggeration" />
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={realSun} onChange={(e) => setRealSun(e.target.checked)} className="accent-amber" /> Real-time sunlight
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={landers} onChange={(e) => setLanders(e.target.checked)} className="accent-amber" /> Landers
          </label>
          <button type="button" onClick={() => setHd(true)} disabled={hd} className="rounded border border-white/20 px-1.5 py-0.5 disabled:opacity-50">
            {hd ? "HD requested" : "Load HD (zoom 3)"}
          </button>
          <span className="ml-auto text-cyan">{hover ? `${fmt.latLon(hover.lat, hover.lon)}${grid ? ` · ${fmt.n(sampleElevation(grid, hover))} m` : ""}` : gridState === "loading" ? "MOLA loading…" : "hover the globe"}</span>
        </div>
      </div>

      <aside className="space-y-4">
        <SiteCard analysis={shown} isGale={isGale} onSurface={onSurface} onBoxwork={onBoxwork} />
        <section className="rounded-2xl border border-line bg-panel/80 p-3">
          <p className="mb-2 px-1 font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">Catalogue sites</p>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 xl:grid-cols-1">
            {CATALOGUE_SITES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setFocus({ ...s.point });
                  setProbe(analyzeSite(s, grid));
                }}
                className={cn("flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-ink2", store.selectedSite?.id === s.id && "bg-amber/10")}
              >
                <span className="truncate text-bright">{s.name}</span>
                <span className="font-mono text-[9.5px] text-fog">{fmt.latLon(s.point.lat, s.point.lon)}</span>
              </button>
            ))}
          </div>
        </section>
        <TraversePanel />
      </aside>
    </div>
  );
}

function SiteCard({ analysis, isGale, onSurface, onBoxwork }: { analysis: LocationAnalysis | null; isGale: boolean; onSurface: () => void; onBoxwork: () => void }) {
  const navigate = useNavigate();
  const selectedId = useMission((s) => s.selectedSite?.id);
  if (!analysis)
    return (
      <section className="rounded-2xl border border-line bg-panel/80 p-4 text-[12.5px] text-fog">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em]">Location</p>
        <p className="mt-2">Click the globe (or a catalogue site) to analyse a location. Values come from the MOLA grid and the documented models; labels show which is which.</p>
      </section>
    );
  const env = analysis.environment;
  return (
    <section className="rounded-2xl border border-line bg-panel/80 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">{analysis.site.kind === "catalogue" ? "Catalogue site" : "Custom location"}</p>
          <h2 className="font-display text-lg font-semibold">{analysis.site.name}</h2>
          <p className="font-mono text-[10.5px] text-cyan">{fmt.latLon(analysis.site.point.lat, analysis.site.point.lon)}</p>
        </div>
        <Metric label="Habitability" value={Math.round(analysis.scores.habitability)} tone={scoreTone(analysis.scores.habitability)} badge="DERIVED" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Elevation" value={env.elevationM === null ? "n/a" : fmt.n(env.elevationM)} unit="m" badge="REAL" />
        <Metric label="GCR dose" value={env.gcrDoseMsvPerSol.toFixed(2)} unit="mSv/sol" badge="MODELLED" />
        <Metric label="Mean temp." value={fmt.n(env.annualMeanTempC)} unit="°C" badge="MODELLED" />
        <Metric label="Ice likelihood" value={env.iceLikelihood.toFixed(2)} badge="DERIVED" />
      </div>
      {analysis.flags.slice(0, 3).map((f) => (
        <p key={f.text} className={cn("mt-2 text-[11px] leading-snug", f.level === "danger" ? "text-rose" : f.level === "caution" ? "text-amber" : "text-cyan")}>
          • {f.text}
        </p>
      ))}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className={btn.primary} onClick={() => dispatchMission({ type: "selectSite", analysis })} disabled={selectedId === analysis.site.id}>
          {selectedId === analysis.site.id ? "Mission site ✓" : "Set mission site"}
        </button>
        <button type="button" className={btn.secondary} onClick={() => dispatchMission({ type: "addTraversePoint", point: analysis.site.point })}>
          <Plus className="size-3.5" /> Waypoint
        </button>
        <button type="button" className={btn.secondary} onClick={() => dispatchMission({ type: "pinComparison", analysis })}>
          Compare
        </button>
        <button
          type="button"
          className={btn.secondary}
          onClick={() => {
            dispatchMission({ type: "selectSite", analysis });
            void navigate({ to: "/atlas" });
          }}
        >
          Open in Atlas
        </button>
      </div>
      {isGale ? (
        <button type="button" onClick={onSurface} className={cn(btn.secondary, "mt-2 w-full border-cyan/40 text-cyan")}>
          <Footprints className="size-3.5" /> Plan an EVA on Curiosity's real terrain
        </button>
      ) : null}
      {analysis.site.id === "boxwork" ? (
        <button type="button" onClick={onBoxwork} className={cn(btn.secondary, "mt-2 w-full border-amber/40 text-amber")}>
          <RouteIcon className="size-3.5" /> Plan a Marswalk on Curiosity's boxwork path
        </button>
      ) : null}
    </section>
  );
}

function TraversePanel() {
  const traverse = useMission((s) => s.traverse);
  const legs = traverse.slice(1).map((p, i) => distanceKm(traverse[i]!, p));
  return (
    <section className="rounded-2xl border border-line bg-panel/80 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">Planned traverse</p>
        <DataBadge type="SIMULATED" />
      </div>
      {!traverse.length ? (
        <p className="px-1 text-[11.5px] text-fog">Add waypoints from the site card to draw great-circle legs (also shown in the Atlas routes layer).</p>
      ) : (
        <ol className="space-y-1">
          {traverse.map((p, i) => (
            <li key={`${p.lat}-${p.lon}-${i}`} className="flex items-center justify-between rounded-lg px-2 py-1 text-[11.5px] hover:bg-ink2">
              <span className="flex items-center gap-2">
                <Navigation className="size-3 text-amber" /> {fmt.latLon(p.lat, p.lon)}
              </span>
              <span className="flex items-center gap-2 font-mono text-[10px] text-fog">
                {i > 0 ? `${fmt.n(legs[i - 1])} km` : "start"}
                <button type="button" aria-label="Remove waypoint" onClick={() => dispatchMission({ type: "removeTraversePoint", index: i })} className="hover:text-rose">
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
          <li className="px-2 pt-1 font-mono text-[10.5px] text-bright">Total {fmt.n(legs.reduce((a, b) => a + b, 0))} km</li>
        </ol>
      )}
    </section>
  );
}

function SurfaceMode() {
  const saved = useMission((s) => s.evaPlan);
  const [siteId, setSiteId] = useState(saved?.siteId ?? EVA_SITES[0]!.id);
  const site = EVA_SITES.find((s) => s.id === siteId) ?? EVA_SITES[0]!;
  const [plan, setPlan] = useState<EvaPlan | null>(null);
  const [poi, setPoi] = useState<EvaPoi | null>(null);
  const onPlan = useCallback((p: EvaPlan | null) => setPlan(p), []);
  const isSaved = !!saved && !!plan && saved.siteId === plan.siteId && saved.distanceM === plan.distanceM && saved.waypoints.length === plan.waypoints.length;

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {EVA_SITES.map((s) => (
          <button key={s.id} type="button" onClick={() => (setSiteId(s.id), setPoi(null))} className={cn("rounded-xl border px-3 py-2 text-left transition", s.id === siteId ? "border-amber/40 bg-amber/10" : "border-line hover:border-amber/25")}>
            <p className="font-display text-[13px] font-semibold text-bright">{s.name}</p>
            <p className="font-mono text-[10px] text-fog">{s.traverseDistance} · {s.pois.length} POIs</p>
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-[64vh] min-h-[440px] overflow-hidden rounded-2xl border border-line bg-black xl:h-[calc(100vh-260px)]">
          <Suspense fallback={<div className="grid h-full place-items-center"><Loading text="Loading terrain engine…" /></div>}>
            <SurfaceEva key={site.id} site={site} initial={saved} onPlan={onPlan} onPoi={setPoi} activePoi={poi} />
          </Suspense>
          <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[9.5px] text-white/70">Terrain: NASA/JPL-Caltech (Curiosity Navcam/Mastcam stereo) via Access Mars · Google Creative Lab, Apache-2.0</p>
        </div>
        <aside className="space-y-4">
          {poi ? (
            <section className="overflow-hidden rounded-2xl border border-cyan/30 bg-panel/90">
              <img src={poi.image} alt="" className="h-36 w-full object-cover" loading="lazy" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-[15px] font-semibold">{poi.title}</h3>
                  <button type="button" aria-label="Close" onClick={() => setPoi(null)} className="text-fog hover:text-bright">
                    <X className="size-4" />
                  </button>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-fog">{poi.text}</p>
                <p className="mt-2 font-mono text-[9.5px] text-fog">Text: Access Mars (NASA JPL / Google). Science weight in planning: {poi.weight} (model assumption).</p>
              </div>
            </section>
          ) : null}
          <EvaPlanPanel plan={plan} saved={isSaved} />
        </aside>
      </div>
    </div>
  );
}

function EvaPlanPanel({ plan, saved }: { plan: EvaPlan | null; saved: boolean }) {
  if (!plan)
    return (
      <section className="rounded-2xl border border-line bg-panel/80 p-4 text-[12.5px] leading-relaxed text-fog">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em]">EVA route</p>
        <p className="mt-2">Click the terrain to place at least two waypoints (snap to a POI by clicking near it). Distance, climb, slope, duration and suit O₂ are computed from the real terrain mesh with the documented EVA model.</p>
      </section>
    );
  return (
    <section className="rounded-2xl border border-line bg-panel/80 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">EVA route · {plan.siteName}</p>
        <DataBadge type="MODELLED" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Metric label="Distance" value={fmt.n(plan.distanceM)} unit="m" />
        <Metric label="Duration" value={fmt.n(plan.durationMin)} unit="min" />
        <Metric label="Suit O₂" value={plan.o2Kg.toFixed(2)} unit="kg" />
        <Metric label="Climb" value={fmt.n(plan.elevationGainM, 1)} unit="m" />
        <Metric label="Max slope" value={plan.maxSlopeDeg.toFixed(1)} unit="°" tone={plan.maxSlopeDeg >= 25 ? "bad" : plan.maxSlopeDeg >= 15 ? "warn" : "good"} />
        <Metric label="Science" value={plan.scienceValue.toFixed(1)} hint={`${plan.poisVisited.length} POIs`} />
      </div>
      <div className="mt-3 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={plan.profile} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis dataKey="distanceM" tick={{ fontSize: 9, fill: "var(--fog)" }} tickFormatter={(v: number) => `${Math.round(v)} m`} minTickGap={30} />
            <YAxis dataKey="elevationM" tick={{ fontSize: 9, fill: "var(--fog)" }} width={42} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }} formatter={(v: number, name: string) => [name === "elevationM" ? `${v.toFixed(2)} m` : `${v.toFixed(1)}°`, name === "elevationM" ? "Height" : "Slope"]} labelFormatter={(d: number) => `${Math.round(d)} m along route`} />
            <Area type="monotone" dataKey="elevationM" stroke="var(--amber)" fill="color-mix(in srgb, var(--amber) 20%, transparent)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="font-mono text-[9.5px] text-fog">Height profile in the site frame (m) · route colour: green &lt; 15°, amber 15–25°, red ≥ 25°</p>
      {plan.hazards.length ? (
        <ul className="mt-2 space-y-1">
          {plan.hazards.map((h) => (
            <li key={h} className="rounded-lg border border-amber/30 px-2 py-1 text-[11px] text-amber">
              {h}
            </li>
          ))}
        </ul>
      ) : (
        <Notice tone="good" className="mt-2">
          No slope hazards on this route.
        </Notice>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" className={cn(btn.primary, "flex-1")} disabled={saved} onClick={() => dispatchMission({ type: "setEvaPlan", plan })}>
          <Save className="size-3.5" /> {saved ? "Saved to mission" : "Save EVA to mission"}
        </button>
        <Link to="/planner" className={btn.secondary}>
          Planner →
        </Link>
      </div>
    </section>
  );
}

function RegionalMode() {
  return (
    <div>
      <Notice tone="warn" className="mb-3">
        Regional 3D models from the original MARS // SURVIVE project. Use them for visual reference only: their site scores are demo values. The live analysis is in the globe and the Survival Atlas.
      </Notice>
      <Suspense fallback={<Loading text="Loading regional models…" />}>
        <LegacyExplorer />
      </Suspense>
    </div>
  );
}
