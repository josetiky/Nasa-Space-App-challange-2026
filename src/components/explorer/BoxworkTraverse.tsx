import "leaflet/dist/leaflet.css";
import { Link } from "@tanstack/react-router";
import type * as Leaflet from "leaflet";
import { ExternalLink, Flag, MapPin, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataBadge, Metric, Notice, btn, fmt } from "@/components/mission/ui";
import { REMS_GALE_META } from "@/core/science/calibration/remsGale";
import { EVA } from "@/core/science/constants";
import {
  backgroundTau,
  dailyTemperature,
  gcrDosePerSol,
  pressureAt,
} from "@/core/science/environment";
import { formatHours, localTrueSolarTime, marsTimeFromDate } from "@/core/science/marsTime";
import { MMGIS_SPHERE_RADIUS_M, type RoverWaypoint } from "@/core/science/roverTraverse";
import type { EvaPlan } from "@/core/types";
import {
  BOXWORK_CONTEXT,
  BOXWORK_META,
  BOXWORK_PRESETS,
  BOXWORK_SITE_ID,
  BOXWORK_STOPS,
  BOXWORK_WAYPOINTS,
  planBoxworkEva,
} from "@/data/boxwork";
import { findCatalogueSite } from "@/data/sites";
import { cn } from "@/lib/utils";
import { analyzeSite, useGrid } from "@/services/analysis";
import { dispatchMission, useMission } from "@/state/missionStore";

/* Colours for Leaflet SVG paths (SVG attributes cannot read CSS variables). */
const C = {
  amber: "#f4a93b",
  cyan: "#4fc3dc",
  rose: "#f0644a",
  mint: "#4fd29a",
  violet: "#a78bfa",
  ink: "#0b0806",
};
const tiltColor = (deg: number) =>
  deg >= EVA.cautionSlopeDeg ? C.rose : deg >= 10 ? C.amber : C.mint;
const BY_SOL = new Map(BOXWORK_WAYPOINTS.map((w) => [w.sol, w]));
const STOP_BY_SOL = new Map(BOXWORK_STOPS.map((s, i) => [s.sol, { stop: s, n: i + 1 }]));
const SOL_DURATION_MIN = 24.6597 * 60;
/** Gale-floor reference elevation of the REMS calibration. */
const GALE_FLOOR_M = REMS_GALE_META.referenceElevationM;
const DEG = Math.PI / 180;

type Basemap = "loading" | "live" | "offline";
interface Selection {
  fromSol: number;
  toSol: number;
  returnToStart: boolean;
}

/** Restore the span of a saved boxwork EVA from its waypoint ids ("sol-4641", …, "sol-4641-return"). */
function selectionFromPlan(plan: EvaPlan | null): Selection | null {
  if (!plan || plan.siteId !== BOXWORK_SITE_ID) return null;
  const outbound = plan.waypoints.filter((w) => !w.id.endsWith("-return"));
  const sol = (id: string | undefined) => Number(id?.replace("sol-", ""));
  const fromSol = sol(outbound[0]?.id);
  const toSol = sol(outbound.at(-1)?.id);
  if (!BY_SOL.has(fromSol) || !BY_SOL.has(toSol)) return null;
  return { fromSol, toSol, returnToStart: plan.waypoints.length > outbound.length };
}

export default function BoxworkTraverse() {
  const saved = useMission((s) => s.evaPlan);
  const selectedSiteId = useMission((s) => s.selectedSite?.id);
  const { grid } = useGrid();
  const preset = BOXWORK_PRESETS[0];
  const [sel, setSel] = useState<Selection>(
    () =>
      selectionFromPlan(saved) ?? {
        fromSol: preset.fromSol,
        toSol: preset.toSol,
        returnToStart: preset.returnToStart,
      },
  );
  const [crew, setCrew] = useState(2);
  const [focusSol, setFocusSol] = useState<number | null>(null);
  const [layers, setLayers] = useState({ hirise: true, tilt: true, stops: true });
  const [basemap, setBasemap] = useState<Basemap>("loading");

  const result = useMemo(() => planBoxworkEva({ ...sel, crew }), [sel, crew]);
  const plan = result.plan;
  const isSaved =
    !!saved &&
    saved.siteId === plan.siteId &&
    saved.distanceM === plan.distanceM &&
    saved.o2Kg === plan.o2Kg &&
    saved.waypoints.length === plan.waypoints.length;

  // Distance along the walk at each waypoint of the plan (segments are in waypoint order).
  const distAt = useMemo(
    () => plan.segments.reduce<number[]>((acc, seg) => [...acc, acc.at(-1)! + seg.distanceM], [0]),
    [plan],
  );
  const stopDots = result.outbound.flatMap((w, k) => {
    const hit = STOP_BY_SOL.get(w.sol);
    return hit
      ? [
          {
            n: hit.n,
            d: distAt[k] ?? 0,
            elevationM: w.elevationM,
            drill: hit.stop.kind === "drill",
          },
        ]
      : [];
  });
  const meanElevation =
    result.outbound.reduce((s, w) => s + w.elevationM, 0) / result.outbound.length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-black xl:h-[calc(100vh-200px)]">
        <BoxworkMap
          span={result.outbound}
          selectedSol={focusSol}
          showHirise={layers.hirise}
          showTilt={layers.tilt}
          showStops={layers.stops}
          onSelect={setFocusSol}
          onBasemap={setBasemap}
        />
        {layers.hirise && basemap === "offline" ? (
          <div className="pointer-events-none absolute left-14 right-3 top-3 z-[500] rounded-lg border border-amber/40 bg-black/75 px-3 py-2 font-mono text-[10.5px] text-amber">
            HiRISE tiles unreachable (NASA Mars Trek). The rover path below is still real MMGIS
            data.
          </div>
        ) : null}
        <div className="pointer-events-none absolute bottom-7 left-3 z-[500] rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 font-mono text-[9.5px] text-white/80">
          {layers.tilt ? (
            <span className="flex items-center gap-2">
              <span className="hidden sm:inline">Rover tilt:</span>
              <span className="sm:hidden">Tilt</span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full" style={{ background: C.mint }} />
                &lt;10°
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full" style={{ background: C.amber }} />
                10–15°
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full" style={{ background: C.rose }} />
                ≥15°
              </span>
            </span>
          ) : (
            <span>Dots: Curiosity's end-of-drive positions</span>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-line bg-panel/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">
                Curiosity · sols 4530–4711 (2025)
              </p>
              <h2 className="font-display text-lg font-semibold">Mount Sharp boxwork traverse</h2>
            </div>
            <DataBadge type="REAL" />
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-fog">{BOXWORK_CONTEXT.text}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
            {BOXWORK_CONTEXT.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan hover:underline"
              >
                {s.label} <ExternalLink className="size-3" />
              </a>
            ))}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Rover stops" value={BOXWORK_WAYPOINTS.length} />
            <Metric
              label="Driven"
              value={fmt.n(BOXWORK_WAYPOINTS.at(-1)!.odometerM - BOXWORK_WAYPOINTS[0]!.odometerM)}
              unit="m"
            />
            <Metric
              label="Climb"
              value={fmt.n(BOXWORK_WAYPOINTS.at(-1)!.elevationM - BOXWORK_WAYPOINTS[0]!.elevationM)}
              unit="m"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px]">
            {(
              [
                ["hirise", "HiRISE basemap"],
                ["tilt", "Rover tilt colours"],
                ["stops", "Science stops"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-amber"
                  checked={layers[key]}
                  onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))}
                />{" "}
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 font-mono text-[9.5px] leading-relaxed text-fog">
            Path, elevations and tilt: {BOXWORK_META.credit} (MMGIS waypoints, retrieved{" "}
            {BOXWORK_META.retrieved}). Basemap: {BOXWORK_META.basemap.credit}.
          </p>
        </section>

        {focusSol !== null && BY_SOL.has(focusSol) ? (
          <StopCard
            waypoint={BY_SOL.get(focusSol)!}
            onClose={() => setFocusSol(null)}
            onStart={(s) => setSel((v) => ({ ...v, fromSol: s }))}
            onEnd={(s) => setSel((v) => ({ ...v, toSol: s }))}
          />
        ) : null}

        <section className="rounded-2xl border border-line bg-panel/80 p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">
              Marswalk along the rover's path
            </p>
            <DataBadge type="MODELLED" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BOXWORK_PRESETS.map((p) => {
              const active =
                sel.fromSol === p.fromSol &&
                sel.toSol === p.toSol &&
                sel.returnToStart === p.returnToStart;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.note}
                  onClick={() =>
                    setSel({ fromSol: p.fromSol, toSol: p.toSol, returnToStart: p.returnToStart })
                  }
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11.5px]",
                    active
                      ? "border-amber/50 bg-amber/10 text-amber"
                      : "border-line text-fog hover:text-bright",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
            <SolSelect
              label="Start"
              value={sel.fromSol}
              onChange={(s) => setSel((v) => ({ ...v, fromSol: s }))}
            />
            <SolSelect
              label="Turn-around / end"
              value={sel.toSol}
              onChange={(s) => setSel((v) => ({ ...v, toSol: s }))}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-amber"
                checked={sel.returnToStart}
                onChange={(e) => setSel((v) => ({ ...v, returnToStart: e.target.checked }))}
              />{" "}
              Walk back to the start
            </label>
            <label className="flex items-center gap-1.5">
              Crew
              <select
                value={crew}
                onChange={(e) => setCrew(Number(e.target.value))}
                className="rounded-md border border-line bg-ink2 px-1.5 py-0.5"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric
              label="Walk"
              value={fmt.n(plan.distanceM)}
              unit="m"
              hint={`rover drove ${fmt.n(result.odometryM)} m one way`}
            />
            <Metric
              label="Duration"
              value={fmt.n(plan.durationMin)}
              unit="min"
              hint={`${plan.poisVisited.length} stops × ${EVA.stopMinutes} min`}
            />
            <Metric label="Suit O₂" value={plan.o2Kg.toFixed(2)} unit="kg" hint={`${crew} crew`} />
            <Metric label="Climb" value={fmt.n(plan.elevationGainM, 1)} unit="m" />
            <Metric
              label="Steepest"
              value={plan.maxSlopeDeg.toFixed(0)}
              unit="°"
              tone={
                plan.maxSlopeDeg >= EVA.noGoSlopeDeg
                  ? "bad"
                  : plan.maxSlopeDeg >= EVA.cautionSlopeDeg
                    ? "warn"
                    : "good"
              }
              hint="mean grade of a leg"
            />
            <Metric
              label="Max tilt"
              value={result.maxTiltDeg.toFixed(1)}
              unit="°"
              tone={result.maxTiltDeg >= EVA.cautionSlopeDeg ? "warn" : "good"}
              hint="measured by Curiosity (REAL)"
            />
          </div>

          {plan.profile.length < 2 ? (
            <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-2 text-[11.5px] text-fog">
              Start and turn-around are the same stop: choose two different sols to draw the walk's
              profile.
            </p>
          ) : (
            <div className="mt-3 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={plan.profile} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
                  <XAxis
                    dataKey="distanceM"
                    type="number"
                    domain={[0, "dataMax"]}
                    tick={{ fontSize: 9, fill: "var(--fog)" }}
                    tickFormatter={(v: number) => `${Math.round(v)} m`}
                    minTickGap={28}
                  />
                  <YAxis
                    dataKey="elevationM"
                    tick={{ fontSize: 9, fill: "var(--fog)" }}
                    width={46}
                    domain={["dataMin - 2", "dataMax + 2"]}
                    tickFormatter={(v: number) => v.toFixed(0)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [`${v.toFixed(1)} m`, "Elevation"]}
                    labelFormatter={(d: number) => `${Math.round(d)} m along the walk`}
                  />
                  <Area
                    type="linear"
                    dataKey="elevationM"
                    stroke="var(--amber)"
                    fill="color-mix(in srgb, var(--amber) 18%, transparent)"
                    isAnimationActive={false}
                  />
                  {stopDots.map((s) => (
                    <ReferenceDot
                      key={`${s.n}-${s.d}`}
                      x={s.d}
                      y={s.elevationM}
                      r={4}
                      fill={s.drill ? C.amber : C.cyan}
                      stroke={C.ink}
                      label={{
                        value: String(s.n),
                        position: "top",
                        fontSize: 9,
                        fill: "var(--bright)",
                      }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="font-mono text-[9.5px] leading-relaxed text-fog">
            Elevation above the areoid from Curiosity's waypoints (REAL). Each leg is as long as the
            rover's drive when that was longer than the straight line; time and O₂ use the
            documented suit model.
          </p>

          {plan.hazards.length ? (
            <ul className="mt-2 space-y-1">
              {plan.hazards.map((h) => (
                <li
                  key={h}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px]",
                    h.includes("no-go") ? "border-rose/40 text-rose" : "border-amber/30 text-amber",
                  )}
                >
                  {h}
                </li>
              ))}
            </ul>
          ) : (
            <Notice tone="good" className="mt-2">
              No leg or stop above the {EVA.cautionSlopeDeg}° caution threshold.
            </Notice>
          )}

          <ol className="mt-3 space-y-1">
            {result.stops.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setFocusSol(s.sol)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11.5px] hover:bg-ink2"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[9.5px]",
                      s.kind === "drill" ? "border-amber text-amber" : "border-cyan text-cyan",
                    )}
                  >
                    {STOP_BY_SOL.get(s.sol)?.n}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-bright">{s.title}</span>
                  <span className="font-mono text-[9.5px] text-fog">sol {s.sol}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(btn.primary, "col-span-2")}
              disabled={isSaved}
              onClick={() => dispatchMission({ type: "setEvaPlan", plan })}
            >
              <Save className="size-3.5" /> {isSaved ? "Saved to mission" : "Save EVA to mission"}
            </button>
            <button
              type="button"
              className={btn.secondary}
              disabled={selectedSiteId === BOXWORK_SITE_ID}
              onClick={() =>
                dispatchMission({
                  type: "selectSite",
                  analysis: analyzeSite(findCatalogueSite(BOXWORK_SITE_ID)!, grid),
                })
              }
            >
              <MapPin className="size-3.5" />{" "}
              {selectedSiteId === BOXWORK_SITE_ID ? "Mission site ✓" : "Use as mission site"}
            </button>
            <Link to="/planner" className={btn.secondary}>
              Planner →
            </Link>
          </div>
        </section>

        <EnvironmentNow elevationM={meanElevation} durationMin={plan.durationMin} />
      </aside>
    </div>
  );
}

function SolSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (sol: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 rounded-md border border-line bg-ink2 px-2 py-1"
      >
        {BOXWORK_WAYPOINTS.map((w) => {
          const hit = STOP_BY_SOL.get(w.sol);
          return (
            <option key={w.sol} value={w.sol}>
              Sol {w.sol}
              {hit ? ` · ${hit.n}. ${hit.stop.title}` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function StopCard({
  waypoint,
  onClose,
  onStart,
  onEnd,
}: {
  waypoint: RoverWaypoint;
  onClose: () => void;
  onStart: (sol: number) => void;
  onEnd: (sol: number) => void;
}) {
  const hit = STOP_BY_SOL.get(waypoint.sol);
  const stop = hit?.stop;
  return (
    <section className="overflow-hidden rounded-2xl border border-cyan/30 bg-panel/90">
      {stop?.images?.[0] ? (
        <a href={stop.images[0].href} target="_blank" rel="noreferrer" className="block">
          <img
            src={stop.images[0].src}
            alt={stop.images[0].caption}
            className="h-36 w-full object-cover"
            loading="lazy"
          />
        </a>
      ) : null}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">
              {stop ? `Stop ${hit!.n} · ` : ""}Sol {waypoint.sol} · site {waypoint.site} drive{" "}
              {waypoint.drive}
            </p>
            <h3 className="font-display text-[15px] font-semibold">
              {stop?.title ?? "Rover waypoint"}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-fog hover:text-bright"
          >
            <X className="size-4" />
          </button>
        </div>
        {stop ? <p className="mt-1 text-[12px] leading-relaxed text-fog">{stop.text}</p> : null}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Metric label="Elevation" value={fmt.n(waypoint.elevationM, 1)} unit="m" />
          <Metric
            label="Rover tilt"
            value={waypoint.tiltDeg.toFixed(1)}
            unit="°"
            tone={waypoint.tiltDeg >= EVA.cautionSlopeDeg ? "warn" : "good"}
          />
          <Metric label="Drive in" value={fmt.n(waypoint.driveM, 1)} unit="m" />
        </div>
        {stop?.images && stop.images.length > 0 ? (
          <ul className="mt-2 space-y-0.5 font-mono text-[9.5px] text-fog">
            {stop.images.map((im) => (
              <li key={im.src}>
                <a href={im.href} target="_blank" rel="noreferrer" className="hover:text-cyan">
                  {im.caption}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {stop ? (
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
            {[stop.source, ...(stop.alsoSee ?? [])].map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan hover:underline"
              >
                {s.label} <ExternalLink className="size-3" />
              </a>
            ))}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={cn(btn.secondary, "flex-1")}
            onClick={() => onStart(waypoint.sol)}
          >
            <MapPin className="size-3.5" /> Start here
          </button>
          <button
            type="button"
            className={cn(btn.secondary, "flex-1")}
            onClick={() => onEnd(waypoint.sol)}
          >
            <Flag className="size-3.5" /> End here
          </button>
        </div>
      </div>
    </section>
  );
}

function EnvironmentNow({ elevationM, durationMin }: { elevationM: number; durationMin: number }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return null;
  const site = BOXWORK_WAYPOINTS.at(-1)!;
  const t = marsTimeFromDate(now);
  const temp = dailyTemperature(site.lat, elevationM, t.ls, backgroundTau(t.ls));
  const doseRate = gcrDosePerSol(pressureAt(elevationM));
  const doseUsv = doseRate * (durationMin / SOL_DURATION_MIN) * 1000;
  const vsFloor = doseRate / gcrDosePerSol(pressureAt(GALE_FLOOR_M)) - 1;
  return (
    <section className="rounded-2xl border border-line bg-panel/80 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">
          At the boxwork today
        </p>
        <DataBadge type="MODELLED" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric
          label="Local time"
          value={formatHours(localTrueSolarTime(t.mtcHours, site.lon, t.eotDeg))}
          hint={`true solar time, Ls ${t.ls.toFixed(0)}° (DERIVED, Mars24)`}
        />
        <Metric
          label="Air temperature"
          value={`${fmt.n(temp.minC)}…${fmt.n(temp.maxC)}`}
          unit="°C"
          hint="daily min…max, REMS-calibrated model"
        />
        <Metric
          label="Pressure"
          value={fmt.n(pressureAt(elevationM, t.ls))}
          unit="Pa"
          hint={`at ${fmt.n(elevationM)} m`}
        />
        <Metric
          label="GCR dose this EVA"
          value={doseUsv.toFixed(0)}
          unit="µSv"
          hint="surface rate, no suit shielding"
        />
      </div>
      <p className="mt-2 font-mono text-[9.5px] leading-relaxed text-fog">
        Higher on Mount Sharp the air column is thinner: the modelled cosmic-ray dose rate here is{" "}
        {fmt.pct(vsFloor)} above the rate at {fmt.n(GALE_FLOOR_M)} m on Gale's floor.
      </p>
    </section>
  );
}

/* ------------------------------- Leaflet map ------------------------------- */

interface MapProps {
  span: RoverWaypoint[];
  selectedSol: number | null;
  showHirise: boolean;
  showTilt: boolean;
  showStops: boolean;
  onSelect: (sol: number) => void;
  onBasemap: (status: Basemap) => void;
}

function BoxworkMap({
  span,
  selectedSol,
  showHirise,
  showTilt,
  showStops,
  onSelect,
  onBasemap,
}: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const base = useRef<Leaflet.TileLayer | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const basemapRef = useRef(onBasemap);
  basemapRef.current = onBasemap;
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState<{ px: number; label: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      const lib =
        (mod as unknown as { default?: typeof Leaflet }).default ??
        (mod as unknown as typeof Leaflet);
      L.current = lib;
      const m = lib.map(el.current, {
        crs: lib.CRS.EPSG4326,
        minZoom: 11,
        maxZoom: 18,
        zoomSnap: 0.5,
      });
      m.attributionControl.setPrefix("Leaflet");
      m.attributionControl.addAttribution("Traverse: NASA/JPL-Caltech MMGIS");
      m.fitBounds(
        lib.latLngBounds(BOXWORK_WAYPOINTS.map((w) => [w.lat, w.lon] as [number, number])),
        { padding: [28, 28] },
      );
      // Leaflet's own scale bar assumes Earth's radius; this one uses the Mars sphere of the waypoint data.
      const updateScale = () => {
        const metresPerPx =
          (360 / (512 * 2 ** m.getZoom())) *
          DEG *
          MMGIS_SPHERE_RADIUS_M *
          Math.cos(m.getCenter().lat * DEG);
        const nice =
          [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
            .filter((v) => v <= metresPerPx * 120)
            .pop() ?? 5;
        setScale({
          px: nice / metresPerPx,
          label: nice >= 1000 ? `${nice / 1000} km` : `${nice} m`,
        });
      };
      m.on("zoomend moveend", updateScale);
      updateScale();
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      base.current = null;
    };
  }, []);

  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    if (!showHirise) {
      base.current?.remove();
      base.current = null;
      return;
    }
    let loaded = false;
    basemapRef.current("loading");
    const layer = lib.tileLayer(BOXWORK_META.basemap.template, {
      maxNativeZoom: BOXWORK_META.basemap.maxNativeZoom,
      maxZoom: 18,
      bounds: lib.latLngBounds(BOXWORK_META.basemap.bounds),
      noWrap: true,
      attribution: BOXWORK_META.basemap.credit,
    });
    layer.on("tileload", () => {
      if (!loaded) {
        loaded = true;
        basemapRef.current("live");
      }
    });
    const timer = window.setTimeout(() => !loaded && basemapRef.current("offline"), 9000);
    layer.addTo(m);
    layer.bringToBack();
    base.current = layer;
    return () => {
      window.clearTimeout(timer);
      layer.remove();
      if (base.current === layer) base.current = null;
    };
  }, [ready, showHirise]);

  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    const group = lib.layerGroup().addTo(m);
    const inSpan = new Set(span.map((w) => w.sol));
    lib
      .polyline(
        BOXWORK_WAYPOINTS.map((w) => [w.lat, w.lon] as [number, number]),
        { color: C.violet, weight: 2, opacity: 0.8, dashArray: "4 5", interactive: false },
      )
      .addTo(group);
    const spanLine = span.map((w) => [w.lat, w.lon] as [number, number]);
    lib
      .polyline(spanLine, { color: "#000", weight: 9, opacity: 0.45, interactive: false })
      .addTo(group);
    lib
      .polyline(spanLine, { color: C.amber, weight: 4, opacity: 0.95, interactive: false })
      .addTo(group);
    for (const w of BOXWORK_WAYPOINTS) {
      const chosen = w.sol === selectedSol;
      const fill = showTilt ? tiltColor(w.tiltDeg) : inSpan.has(w.sol) ? C.amber : C.violet;
      lib
        .circleMarker([w.lat, w.lon], {
          radius: chosen ? 7 : inSpan.has(w.sol) ? 4.5 : 3.5,
          color: chosen ? "#ffffff" : C.ink,
          weight: chosen ? 2 : 1,
          opacity: inSpan.has(w.sol) || chosen ? 1 : 0.5,
          fillColor: fill,
          fillOpacity: inSpan.has(w.sol) || chosen ? 0.95 : 0.45,
        })
        .bindTooltip(
          `Sol ${w.sol} · ${w.elevationM.toFixed(1)} m · tilt ${w.tiltDeg.toFixed(1)}°`,
          { direction: "top", offset: [0, -4] },
        )
        .on("click", () => selectRef.current(w.sol))
        .addTo(group);
    }
    const ends = [
      { w: span[0], color: C.mint, label: "Start" },
      { w: span.at(-1), color: C.rose, label: "Turn-around" },
    ];
    for (const { w, color, label } of ends) {
      if (!w) continue;
      lib
        .circleMarker([w.lat, w.lon], {
          radius: 10,
          color,
          weight: 3,
          fill: false,
          interactive: false,
        })
        .bindTooltip(label, { permanent: false })
        .addTo(group);
    }
    if (showStops) {
      BOXWORK_STOPS.forEach((s, i) => {
        const w = BY_SOL.get(s.sol);
        if (!w) return;
        const icon = lib.divIcon({
          className: "",
          html: `<div class="bw-stop${s.kind === "drill" ? " bw-drill" : ""}${s.sol === selectedSol ? " bw-sel" : ""}">${i + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        lib
          .marker([w.lat, w.lon], { icon, title: s.title, keyboard: true })
          .bindTooltip(`${i + 1}. ${s.title}`, { direction: "right", offset: [12, 0] })
          .on("click", () => selectRef.current(s.sol))
          .addTo(group);
      });
    }
    return () => {
      group.remove();
    };
  }, [ready, span, selectedSol, showTilt, showStops]);

  return (
    <>
      <div
        ref={el}
        className="mc-map h-full w-full"
        role="application"
        aria-label="Map of Curiosity's boxwork traverse on Mount Sharp"
      />
      {scale ? (
        <div className="pointer-events-none absolute bottom-7 right-3 z-[500] rounded-md bg-black/65 px-2 py-1 font-mono text-[9.5px] text-white/85">
          <div
            className="border-x-2 border-b-2 border-white/85"
            style={{ width: scale.px, height: 6 }}
          />
          <span>{scale.label} (Mars)</span>
        </div>
      ) : null}
    </>
  );
}
