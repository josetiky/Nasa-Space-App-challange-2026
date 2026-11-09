import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Crosshair, Info, MapPin, Pin, Route as RouteIcon, X } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { DataBadge, Loading, Meter, Notice, btn, fmt, scoreTone } from "@/components/mission/ui";
import type { LayerState } from "@/components/atlas/AtlasMap";
import { distanceKm } from "@/core/science/geo";
import type { GeoPoint, LocationAnalysis, LocationScores } from "@/core/types";
import { LAYERS, type LayerId, type LayerSpec } from "@/data/layers";
import { CATALOGUE_SITES, customSite } from "@/data/sites";
import { layerValue } from "@/services/atlas/rasters";
import { analyzeSite, useGrid } from "@/services/analysis";
import { TREK_LAYERS, type TrekLayerKey } from "@/services/nasa/adapters";
import { dispatchMission, useMission } from "@/state/missionStore";
import { cn } from "@/lib/utils";

const AtlasMap = lazy(() => import("@/components/atlas/AtlasMap"));

export const Route = createFileRoute("/atlas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Survival Atlas — MARS // SURVIVE" }, { name: "description", content: "Ten NASA-sourced survival layers for Mars with provenance, legends and site comparison." }] }),
  component: AtlasPage,
});

const SCORE_ROWS: Array<{ key: keyof LocationScores; label: string; invert?: boolean }> = [
  { key: "habitability", label: "Habitability" },
  { key: "landingSafety", label: "Landing safety" },
  { key: "radiationProtection", label: "Radiation protection" },
  { key: "thermal", label: "Thermal" },
  { key: "solarPower", label: "Solar power" },
  { key: "water", label: "Water access" },
  { key: "science", label: "Science value" },
  { key: "risk", label: "Overall risk", invert: true },
];

function snapToSite(point: GeoPoint) {
  const nearest = CATALOGUE_SITES.map((site) => ({ site, d: distanceKm(point, site.point) })).sort((a, b) => a.d - b.d)[0];
  return nearest && nearest.d < 60 ? nearest.site : customSite(point.lat, point.lon);
}

function AtlasPage() {
  const navigate = useNavigate();
  const { grid, state: gridState, error: gridError } = useGrid();
  const store = useMission();
  const [basemap, setBasemap] = useState<TrekLayerKey>("viking");
  const [basemapStatus, setBasemapStatus] = useState<"live" | "snapshot" | "offline" | null>(null);
  const [layers, setLayers] = useState<Record<LayerId, LayerState>>(() => Object.fromEntries(LAYERS.map((l) => [l.id, { on: l.defaultOn, opacity: l.defaultOpacity }])) as Record<LayerId, LayerState>);
  const [layerStatus, setLayerStatus] = useState<Partial<Record<LayerId, string>>>({});
  const [probe, setProbe] = useState<LocationAnalysis | null>(null);
  const [focus, setFocus] = useState<GeoPoint | null>(null);

  const onBasemapStatus = useCallback((s: "live" | "snapshot" | "offline") => setBasemapStatus(s), []);
  const onLayerStatus = useCallback((id: LayerId, s: string | null) => setLayerStatus((prev) => (prev[id] === (s ?? undefined) ? prev : { ...prev, [id]: s ?? undefined })), []);
  const onPick = useCallback((point: GeoPoint) => setProbe(analyzeSite(snapToSite(point), grid)), [grid]);

  const current = probe ?? store.analysis;
  // Re-evaluate with the grid once it arrives (analyses made before MOLA loaded are flagged).
  const shown = useMemo(() => (current && grid && current.environment.elevationSource !== "mola" ? analyzeSite(current.site, grid) : current), [current, grid]);

  const jump = (id: string) => {
    const site = CATALOGUE_SITES.find((s) => s.id === id);
    if (!site) return;
    setProbe(analyzeSite(site, grid));
    setFocus({ ...site.point });
  };

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[.24em] text-amber">Module 2 · Survival Atlas</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-.03em]">Read Mars layer by layer</h1>
          <p className="mt-1.5 max-w-3xl text-[13px] text-fog">Ten layers, each with its source, period, resolution and data type. Click anywhere to analyse a location; pin up to three sites to compare them.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
          <select className="mission-input h-9 w-full rounded-lg px-2 text-[12px]" defaultValue="" onChange={(e) => jump(e.target.value)} aria-label="Jump to a catalogue site">
            <option value="" disabled>
              Jump to a site…
            </option>
            {CATALOGUE_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          </div>
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Basemap">
            {(Object.keys(TREK_LAYERS) as TrekLayerKey[]).map((key) => (
              <button key={key} type="button" onClick={() => setBasemap(key)} className={cn("rounded-md px-2.5 py-1.5 font-mono text-[10.5px]", basemap === key ? "bg-amber/15 text-amber" : "text-fog hover:text-bright")}>
                {key === "viking" ? "Viking colour" : "MOLA relief"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <LayerPanel layers={layers} setLayers={setLayers} status={layerStatus} gridState={gridState} gridError={gridError} />

        <div className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-2xl border border-line xl:h-[calc(100vh-190px)]">
          <Suspense fallback={<div className="grid h-full place-items-center bg-black"><Loading text="Loading map engine…" /></div>}>
            <AtlasMap basemap={basemap} layers={layers} grid={grid} selected={store.selectedSite?.point ?? null} probe={probe?.site.point ?? null} traverse={store.traverse} focus={focus} onPick={onPick} onBasemapStatus={onBasemapStatus} onLayerStatus={onLayerStatus} />
          </Suspense>
          <div className="pointer-events-none absolute right-3 top-3 z-[500] flex max-w-[70%] flex-wrap justify-end gap-1.5">
            <span className="rounded-full border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[9.5px] text-white/80 backdrop-blur">
              {TREK_LAYERS[basemap].label} · {basemapStatus === "live" ? "live NASA Trek" : basemapStatus === "snapshot" ? "saved tiles" : basemapStatus === "offline" ? "basemap offline" : "connecting…"}
            </span>
            <span className="rounded-full border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[9.5px] text-white/80 backdrop-blur">Equirectangular · planetocentric °E</span>
          </div>
          {!shown ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded-full border border-amber/30 bg-black/70 px-3 py-1.5 font-mono text-[10.5px] text-amber backdrop-blur">
              <Crosshair className="mr-1.5 inline size-3.5" /> Click the map to analyse a location
            </div>
          ) : null}
        </div>

        <AnalysisPanel
          analysis={shown}
          layers={layers}
          isMissionSite={!!shown && store.selectedSite?.id === shown.site.id}
          onSelect={(a) => dispatchMission({ type: "selectSite", analysis: a })}
          onPin={(a) => dispatchMission({ type: "pinComparison", analysis: a })}
          onWaypoint={(a) => dispatchMission({ type: "addTraversePoint", point: a.site.point })}
          onPlan={(a) => {
            dispatchMission({ type: "selectSite", analysis: a });
            void navigate({ to: "/planner" });
          }}
        />
      </div>

      <ComparisonTable comparison={store.comparison} grid={!!grid} />
      {store.traverse.length ? <TraverseSummary traverse={store.traverse} /> : null}
    </div>
  );
}

function Legend({ spec }: { spec: LayerSpec }) {
  const legend = spec.legend;
  if (legend.kind === "categories")
    return (
      <ul className="mt-2 space-y-1">
        {legend.items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[10.5px] text-fog">
            <span className="size-2.5 rounded-full" style={{ background: item.color }} /> {item.label}
          </li>
        ))}
      </ul>
    );
  const gradient = `linear-gradient(90deg, ${legend.stops.map(([v, c]) => `${c} ${(((v - legend.min) / (legend.max - legend.min)) * 100).toFixed(1)}%`).join(", ")})`;
  return (
    <div className="mt-2">
      <div className="h-2 rounded-full border border-line/60" style={{ background: gradient }} />
      <div className="mt-0.5 flex justify-between font-mono text-[9px] text-fog">
        <span>{fmt.n(legend.min, legend.max - legend.min < 5 ? 1 : 0)}</span>
        <span>{spec.unit}</span>
        <span>{fmt.n(legend.max, legend.max - legend.min < 5 ? 1 : 0)}</span>
      </div>
    </div>
  );
}

function LayerPanel({ layers, setLayers, status, gridState, gridError }: { layers: Record<LayerId, LayerState>; setLayers: (fn: (prev: Record<LayerId, LayerState>) => Record<LayerId, LayerState>) => void; status: Partial<Record<LayerId, string>>; gridState: string; gridError: string | null }) {
  const [open, setOpen] = useState<LayerId | null>("elevation");
  return (
    <aside className="mc-panel max-h-[calc(100vh-190px)] overflow-y-auto rounded-2xl border border-line bg-panel/80 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">Layers</p>
        <span className="font-mono text-[9.5px] text-fog">MOLA: {gridState === "ready" ? <span className="text-mint">loaded</span> : gridState === "loading" ? "loading…" : <span className="text-rose">unavailable</span>}</span>
      </div>
      {gridState === "unavailable" ? <Notice tone="warn" className="mb-2">MOLA grid unavailable ({gridError}). Elevation-based layers are disabled — run <code>npm run data:fetch</code> or check NASA Data.</Notice> : null}
      <ul className="space-y-1.5">
        {LAYERS.map((spec) => {
          const st = layers[spec.id];
          const expanded = open === spec.id;
          return (
            <li key={spec.id} className={cn("rounded-xl border px-2.5 py-2 transition", st.on ? "border-amber/30 bg-amber/[.05]" : "border-line/70")}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={st.on} onChange={(e) => setLayers((prev) => ({ ...prev, [spec.id]: { ...prev[spec.id], on: e.target.checked } }))} className="size-3.5 accent-amber" aria-label={`Toggle ${spec.title}`} />
                <button type="button" onClick={() => setOpen(expanded ? null : spec.id)} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                  <span className="truncate text-[12.5px] font-medium text-bright">{spec.title}</span>
                  <span className="flex items-center gap-1">
                    <DataBadge type={spec.dataType} />
                    <ChevronDown className={cn("size-3.5 text-fog transition", expanded && "rotate-180")} />
                  </span>
                </button>
              </div>
              {st.on ? (
                <input type="range" min={0.1} max={1} step={0.05} value={st.opacity} onChange={(e) => setLayers((prev) => ({ ...prev, [spec.id]: { ...prev[spec.id], opacity: Number(e.target.value) } }))} className="mt-1.5 w-full accent-amber" aria-label={`${spec.title} opacity`} />
              ) : null}
              {st.on && status[spec.id] ? <p className="mt-1 text-[10.5px] text-rose">{status[spec.id]}</p> : null}
              {expanded ? (
                <div className="mt-2 space-y-1 border-t border-line/60 pt-2 text-[10.5px] leading-snug text-fog">
                  <p className="text-bright/90">{spec.description}</p>
                  <p>
                    <span className="text-fog/70">Source:</span> {spec.source}
                  </p>
                  <p>
                    <span className="text-fog/70">Period:</span> {spec.period}
                  </p>
                  <p>
                    <span className="text-fog/70">Resolution:</span> {spec.resolution}
                  </p>
                  <p>
                    <span className="text-fog/70">Unit:</span> {spec.unit}
                  </p>
                  <Legend spec={spec} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 px-1 text-[10px] leading-relaxed text-fog">
        <Info className="mr-1 inline size-3" />
        Formulas and references: docs/SIMULATION_MODEL.md and <Link to="/nasa-data" className="text-amber underline-offset-2 hover:underline">NASA Data</Link>.
      </p>
    </aside>
  );
}

function AnalysisPanel({ analysis, layers, isMissionSite, onSelect, onPin, onWaypoint, onPlan }: { analysis: LocationAnalysis | null; layers: Record<LayerId, LayerState>; isMissionSite: boolean; onSelect: (a: LocationAnalysis) => void; onPin: (a: LocationAnalysis) => void; onWaypoint: (a: LocationAnalysis) => void; onPlan: (a: LocationAnalysis) => void }) {
  if (!analysis)
    return (
      <aside className="mc-panel rounded-2xl border border-line bg-panel/80 p-4">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">Location analysis</p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-fog">Select a point on the map or jump to a catalogue site. The analyser combines the MOLA grid with the documented radiation, thermal, solar, ice, dust and science models.</p>
      </aside>
    );
  const { site, environment: env, scores, flags } = analysis;
  const active = LAYERS.filter((l) => layers[l.id].on);
  return (
    <aside className="mc-panel max-h-[calc(100vh-190px)] overflow-y-auto rounded-2xl border border-line bg-panel/80">
      <div className="border-b border-line/70 p-4">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">{site.kind === "catalogue" ? "Catalogue site" : "Custom location"}</p>
        <h2 className="mt-0.5 font-display text-lg font-semibold">{site.name}</h2>
        <p className="font-mono text-[10.5px] text-cyan">{fmt.latLon(site.point.lat, site.point.lon)}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-fog">Habitability</p>
            <p className={cn("font-display text-4xl font-bold tabular-nums", { good: "text-mint", warn: "text-amber", bad: "text-rose", default: "text-bright", info: "text-cyan" }[scoreTone(scores.habitability)])}>
              {Math.round(scores.habitability)}
              <span className="text-sm text-fog">/100</span>
            </p>
          </div>
          <DataBadge type="DERIVED" />
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        {SCORE_ROWS.slice(1).map((row) => (
          <Meter key={row.key} label={row.label} value={row.invert ? 100 - scores[row.key] : scores[row.key]} detail={`${Math.round(scores[row.key])}`} />
        ))}
      </div>
      {flags.length ? (
        <ul className="space-y-1 px-4 pb-3">
          {flags.map((f) => (
            <li key={f.text} className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug", f.level === "danger" ? "border-rose/35 text-rose" : f.level === "caution" ? "border-amber/30 text-amber" : "border-cyan/25 text-cyan")}>
              {f.text}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="border-t border-line/70 p-4">
        <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">Active layer values</p>
        <dl className="space-y-1.5">
          {(active.length ? active : LAYERS.slice(0, 4)).map((spec) => {
            const v = layerValue(spec.id, env);
            return (
              <div key={spec.id} className="flex items-start justify-between gap-3 text-[11.5px]">
                <dt className="text-fog">{spec.title}</dt>
                <dd className="text-right text-bright">{v.text}</dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-2 font-mono text-[9.5px] text-fog">Pressure {fmt.n(env.meanPressurePa)} Pa · column {env.shieldingGcm2.toFixed(1)} g/cm² · solar {fmt.n(env.solarAnnualMeanWm2)} W/m²</p>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line/70 p-4">
        <button type="button" className={cn(btn.primary, "col-span-2")} onClick={() => onPlan(analysis)}>
          Plan a mission here
        </button>
        <button type="button" className={btn.secondary} onClick={() => onSelect(analysis)} disabled={isMissionSite}>
          <MapPin className="size-3.5" /> {isMissionSite ? "Mission site" : "Set site"}
        </button>
        <button type="button" className={btn.secondary} onClick={() => onPin(analysis)}>
          <Pin className="size-3.5" /> Compare
        </button>
        <button type="button" className={cn(btn.secondary, "col-span-2")} onClick={() => onWaypoint(analysis)}>
          <RouteIcon className="size-3.5" /> Add traverse waypoint
        </button>
      </div>
    </aside>
  );
}

function ComparisonTable({ comparison, grid }: { comparison: LocationAnalysis[]; grid: boolean }) {
  if (!comparison.length) return null;
  const rows: Array<{ label: string; get: (a: LocationAnalysis) => number | null; digits?: number; unit?: string; higherIsBetter: boolean; type: "DERIVED" | "REAL" | "MODELLED" }> = [
    ...SCORE_ROWS.map((r) => ({ label: r.label, get: (a: LocationAnalysis) => a.scores[r.key], higherIsBetter: !r.invert, type: "DERIVED" as const })),
    { label: "Elevation (MOLA)", get: (a) => a.environment.elevationM, unit: "m", higherIsBetter: false, type: "REAL" },
    { label: "GCR dose", get: (a) => a.environment.gcrDoseMsvPerSol, digits: 2, unit: "mSv/sol", higherIsBetter: false, type: "MODELLED" },
    { label: "Annual mean temperature", get: (a) => a.environment.annualMeanTempC, unit: "°C", higherIsBetter: true, type: "MODELLED" },
    { label: "Ice likelihood", get: (a) => a.environment.iceLikelihood, digits: 2, higherIsBetter: true, type: "DERIVED" },
    { label: "Dust activity", get: (a) => a.environment.dustActivity, digits: 2, higherIsBetter: false, type: "DERIVED" },
  ];
  return (
    <section className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel/80">
      <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">Comparison</p>
          <h2 className="font-display text-[15px] font-semibold">{comparison.length} pinned site{comparison.length > 1 ? "s" : ""}</h2>
        </div>
        <button type="button" className={btn.ghost} onClick={() => dispatchMission({ type: "clearComparison" })}>
          Clear
        </button>
      </div>
      {!grid ? <p className="px-4 pt-2 text-[11px] text-amber">MOLA not loaded: elevation-based rows use the reference elevation.</p> : null}
      <table className="w-full min-w-[640px] text-[12px]">
        <thead>
          <tr className="border-b border-line/60 text-left">
            <th className="px-4 py-2 font-mono text-[9.5px] font-normal uppercase tracking-[.14em] text-fog">Metric</th>
            {comparison.map((a) => (
              <th key={a.site.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[13px] font-semibold text-bright">{a.site.name}</span>
                  <button type="button" aria-label={`Remove ${a.site.name}`} className="text-fog hover:text-rose" onClick={() => dispatchMission({ type: "unpinComparison", siteId: a.site.id })}>
                    <X className="size-3.5" />
                  </button>
                </div>
                <button type="button" className="mt-0.5 font-mono text-[9.5px] text-amber hover:underline" onClick={() => dispatchMission({ type: "selectSite", analysis: a })}>
                  set as mission site
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = comparison.map(row.get);
            const valid = values.filter((v): v is number => v !== null);
            const best = valid.length > 1 ? (row.higherIsBetter ? Math.max(...valid) : Math.min(...valid)) : null;
            return (
              <tr key={row.label} className="border-b border-line/40 last:border-0">
                <td className="px-4 py-1.5 text-fog">
                  {row.label} <DataBadge type={row.type} className="ml-1 scale-90" />
                </td>
                {values.map((v, i) => (
                  <td key={comparison[i]!.site.id} className={cn("px-3 py-1.5 tabular-nums", v !== null && v === best ? "font-semibold text-mint" : "text-bright")}>
                    {v === null ? "—" : `${fmt.n(v, row.digits ?? 0)}${row.unit ? ` ${row.unit}` : ""}`}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function TraverseSummary({ traverse }: { traverse: GeoPoint[] }) {
  const legs = traverse.slice(1).map((p, i) => distanceKm(traverse[i]!, p));
  const total = legs.reduce((a, b) => a + b, 0);
  return (
    <section className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber/25 bg-amber/[.05] px-4 py-3 text-[12px]">
      <RouteIcon className="size-4 text-amber" />
      <span className="text-bright">
        Planned traverse: {traverse.length} waypoint{traverse.length > 1 ? "s" : ""} · {fmt.n(total)} km great-circle
      </span>
      <DataBadge type="SIMULATED" />
      <span className="text-fog">{legs.map((d, i) => `leg ${i + 1}: ${fmt.n(d)} km`).join(" · ")}</span>
      <button type="button" className={cn(btn.ghost, "ml-auto")} onClick={() => dispatchMission({ type: "clearTraverse" })}>
        Clear traverse
      </button>
    </section>
  );
}
