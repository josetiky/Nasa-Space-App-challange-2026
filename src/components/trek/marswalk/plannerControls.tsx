/**
 * MarsWalk · Controles del planificador: puntos conocidos (origen/destino) y prioridades del A*.
 * Solo emiten eventos al motor (set-origin, set-goal, set-custom-weights, set-weight-profile).
 * La validación de pesos (INV-R1/R5) y el recálculo de la ruta viven en src/core/trek/**.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CostTermId, LocalPoint, WeightProfileId, WeightVector } from "@/core/trek/contracts";
import { resolveBaseWeights } from "@/core/trek/cost/weights";
import { TREK_PARAMS } from "@/core/trek/params";
import { dispatchTrek, useTrek } from "@/state/trekStore";
import { TREK_TEXTS } from "../i18n";
import { PhysioWeightsPanel } from "./PhysioPanel";
import { computeOptimalRoute, onRouteComputed } from "./routeBus";
import { RouteResultCard } from "./RouteResultCard";
import { ConfChip } from "./ui";
import { engineText } from "./engineText";

const TERMS: readonly CostTermId[] = ["D", "T", "R", "E", "U", "H"];
const KEY: Readonly<Record<CostTermId, keyof WeightVector>> = {
  D: "d",
  T: "t",
  R: "r",
  E: "e",
  U: "u",
  H: "h",
};
const COLORS: Readonly<Record<CostTermId, string>> = {
  D: "#38bdf8",
  T: "#f59e0b",
  R: "#f43f5e",
  E: "#34d399",
  U: "#a78bfa",
  H: "#fb7185",
};
const MIN_WD = TREK_PARAMS.minDistanceWeight.value;

interface KnownPoint {
  readonly id: string;
  readonly group: "shelter" | "poi" | "traverse";
  readonly label: string;
  readonly point: LocalPoint;
}

const same = (a: LocalPoint, b: LocalPoint) =>
  Math.abs(a.x - b.x) < 0.01 && Math.abs(a.z - b.z) < 0.01;

/* ------------------------------------------------------------------ */
/* Puntos conocidos                                                    */
/* ------------------------------------------------------------------ */
export function KnownPoints() {
  const state = useTrek();
  const es = state.lang === "es";
  const { siteInfo, session, pickMode } = state;
  const [resultOpen, setResultOpen] = useState(false);
  useEffect(() => onRouteComputed(() => setResultOpen(true)), []);
  // Al cambiar origen/destino la tarjeta deja de describir la ruta vigente
  useEffect(() => setResultOpen(false), [session.origin, session.goal]);

  const points = useMemo<KnownPoint[]>(
    () => [
      ...session.shelters.map((s) => ({
        id: `sh-${s.id}`,
        group: "shelter" as const,
        label: `◆ ${s.name}`,
        point: s.point,
      })),
      ...siteInfo.pois.map((p) => ({
        id: `poi-${p.id}`,
        group: "poi" as const,
        label: `● ${p.title}`,
        point: p.point,
      })),
      ...siteInfo.roverTraversePoints.map((p, i) => ({
        id: `tr-${i}`,
        group: "traverse" as const,
        label: `${es ? "Travesía Curiosity" : "Curiosity traverse"} #${i + 1}`,
        point: p,
      })),
    ],
    [session.shelters, siteInfo.pois, siteInfo.roverTraversePoints, es],
  );

  const groups: ReadonlyArray<[KnownPoint["group"], string]> = [
    ["shelter", es ? "Refugios y hábitat" : "Shelters & habitat"],
    ["poi", es ? "Objetivos científicos (Curiosity)" : "Science targets (Curiosity)"],
    ["traverse", es ? "Travesía real del rover" : "Real rover traverse"],
  ];

  const row = (kind: "origin" | "goal") => {
    const current = kind === "origin" ? session.origin : session.goal;
    const match = points.find((p) => same(p.point, current));
    const slope = session.snapshot.sample("slopeDeg", current.x, current.z);
    const zone = session.snapshot.zoneAt(current.x, current.z);
    const conf = session.snapshot.confidenceAt(current.x, current.z);
    return (
      <div className="mw-pt">
        <div className="mw-pt__head">
          <span className="t-label">
            <b>{kind === "origin" ? (es ? "Origen" : "Origin") : es ? "Destino" : "Goal"}</b>
          </span>
          <span className="mw-pt__meta t-label">
            ({current.x}, {current.z}) m · {Number.isNaN(slope) ? "NaN" : `${slope.toFixed(1)}°`} ·{" "}
            {zone} <ConfChip cls={conf} />
          </span>
        </div>
        <div className="mw-pt__ctrl">
          <label className="chip mw__select mw-pt__select">
            <select
              aria-label={
                kind === "origin"
                  ? es
                    ? "Origen conocido"
                    : "Known origin"
                  : es
                    ? "Destino conocido"
                    : "Known goal"
              }
              value={match?.id ?? ""}
              onChange={(e) => {
                const p = points.find((k) => k.id === e.target.value);
                if (!p) return;
                dispatchTrek(
                  kind === "origin"
                    ? {
                        type: "simEvent",
                        event: { kind: "set-origin", origin: p.point, simulated: false },
                      }
                    : {
                        type: "simEvent",
                        event: { kind: "set-goal", goal: p.point, simulated: false },
                      },
                );
                dispatchTrek({ type: "inspectPoint", point: p.point });
              }}
            >
              <option value="" disabled>
                {es ? "Punto libre del mapa" : "Free map point"}
              </option>
              {groups.map(([g, title]) => {
                const items = points.filter((p) => p.group === g);
                if (items.length === 0) return null;
                return (
                  <optgroup key={g} label={title}>
                    {items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} · ({p.point.x}, {p.point.z})
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={pickMode === kind}
            title={es ? "Elegir en el mapa (clic)" : "Pick on the map (click)"}
            aria-label={es ? "Elegir en el mapa" : "Pick on the map"}
            onClick={() => dispatchTrek({ type: "setPickMode", mode: kind })}
          >
            <svg viewBox="0 0 16 16">
              {kind === "origin" ? (
                <>
                  <circle cx="8" cy="8" r="4.5" />
                  <circle cx="8" cy="8" r="1.4" />
                </>
              ) : (
                <>
                  <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z" />
                  <circle cx="8" cy="6.5" r="1.6" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mw-points" data-in>
      {row("origin")}
      <button
        type="button"
        className="btn btn--ghost btn--sm mw-pt__swap"
        onClick={() =>
          dispatchTrek({
            type: "simEvent",
            event: [
              { kind: "set-origin", origin: session.goal, simulated: false },
              { kind: "set-goal", goal: session.origin, simulated: false },
            ],
          })
        }
      >
        ⇅ {es ? "Invertir" : "Swap"}
      </button>
      {row("goal")}
      <button
        type="button"
        className="btn btn--primary btn--sm mw-compute"
        onClick={computeOptimalRoute}
      >
        {es ? "Calcular ruta óptima (A*)" : "Compute optimal route (A*)"}
        <span className="btn__icon" aria-hidden="true" style={{ width: 26, height: 26 }}>
          <svg viewBox="0 0 12 12">
            <path d="M3 1.8v8.4L10 6z" />
          </svg>
        </span>
      </button>
      {resultOpen ? <RouteResultCard onClose={() => setResultOpen(false)} /> : null}
      <p className="mw__muted">
        {es
          ? "El A* explora toda la malla (no solo la línea recta) y elige el camino de menor costo con tus prioridades, sin salir de la envolvente de seguridad. La tarjeta del mapa compara el resultado con la línea recta."
          : "A* explores the whole mesh (not just the straight line) and picks the lowest-cost path with your priorities, never leaving the safety envelope. The map card compares the result with the straight line."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prioridades del A* (pesos dinámicos)                                */
/* ------------------------------------------------------------------ */
type Raw = Record<CostTermId, number>;

function toRaw(w: WeightVector): Raw {
  return {
    D: Math.round(w.d * 100),
    T: Math.round(w.t * 100),
    R: Math.round(w.r * 100),
    E: Math.round(w.e * 100),
    U: Math.round(w.u * 100),
    H: Math.round(w.h * 100),
  };
}

/** Respeta w_d ≥ 0.05 (INV-R1) antes de enviar; el motor vuelve a validar. */
function toVector(raw: Raw): WeightVector | null {
  const others = raw.T + raw.R + raw.E + raw.U + raw.H;
  const d = Math.max(raw.D, (MIN_WD * others) / (1 - MIN_WD) + 1e-6, others === 0 ? 1 : 0);
  const sum = d + others;
  if (sum <= 0) return null;
  return {
    d: d / sum,
    t: raw.T / sum,
    r: raw.R / sum,
    e: raw.E / sum,
    u: raw.U / sum,
    h: raw.H / sum,
  };
}

const PRESETS: ReadonlyArray<WeightProfileId> = [
  "balanced",
  "safest",
  "fastest",
  "known",
  "resource-saving",
];

export function WeightTuner() {
  const state = useTrek();
  const es = state.lang === "es";
  const tt = TREK_TEXTS[state.lang];
  const { session } = state;
  const base = useMemo(
    () => resolveBaseWeights(session.weightProfile, session.customWeights),
    [session.weightProfile, session.customWeights],
  );
  const [raw, setRaw] = useState<Raw>(() => toRaw(base));
  const pending = useRef<number | null>(null);
  const sentRef = useRef<WeightVector | null>(null);

  // Si el perfil cambia desde fuera (escenario, botón de perfil), sincronizar los deslizadores;
  // si es el eco de lo que acabamos de enviar, no mover el deslizador que el operador está arrastrando.
  useEffect(() => {
    const sent = sentRef.current;
    if (
      sent &&
      (["d", "t", "r", "e", "u", "h"] as const).every((k) => Math.abs(sent[k] - base[k]) < 1e-6)
    )
      return;
    setRaw(toRaw(base));
  }, [base]);

  const push = (next: Raw) => {
    setRaw(next);
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      const v = toVector(next);
      sentRef.current = v;
      if (v)
        dispatchTrek({
          type: "simEvent",
          event: { kind: "set-custom-weights", weights: v, simulated: false },
        });
    }, 220);
  };
  useEffect(
    () => () => {
      if (pending.current) window.clearTimeout(pending.current);
    },
    [],
  );

  // Porcentaje base ya normalizado con el mínimo w_d ≥ 0.05 que aplicará el motor
  const norm = toVector(raw);
  const eff = session.activeWeights;
  const emergency = session.fsm.state === "CRITICAL" || session.fsm.state === "EMERGENCY";
  const rr = session.routeResult;

  return (
    <div className="mw-weights" data-in>
      <div className="mw-weights__presets">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className="chip mw-weights__preset"
            aria-pressed={!session.customWeights && session.weightProfile === p}
            onClick={() => dispatchTrek({ type: "setWeightProfile", profile: p })}
          >
            {tt.weightProfiles[p]}
          </button>
        ))}
        <span className={`chip ${session.customWeights ? "chip--mars" : ""}`}>
          {session.customWeights
            ? es
              ? "• Personalizado"
              : "• Custom"
            : es
              ? "Perfil"
              : "Profile"}
        </span>
      </div>

      <ul className="mw-weights__list">
        {TERMS.map((k) => {
          const pctBase = norm ? norm[KEY[k]] * 100 : 0;
          const pctEff = eff[KEY[k]] * 100;
          return (
            <li key={k}>
              <label className="mw-weights__row">
                <span className="mw-weights__name">
                  <i className="mw-dot" style={{ background: COLORS[k] }} />
                  <b>{k}</b> · {tt.costTerms[k].label}
                </span>
                <input
                  type="range"
                  min={k === "D" ? 5 : 0}
                  max={100}
                  step={1}
                  value={raw[k]}
                  style={{ accentColor: COLORS[k] }}
                  onChange={(e) => push({ ...raw, [k]: Number(e.target.value) })}
                  aria-label={`${k} · ${tt.costTerms[k].label}`}
                />
                <span className="mw-weights__pct t-mono">{pctBase.toFixed(0)} %</span>
              </label>
              <span
                className="mw-weights__eff"
                title={
                  es
                    ? "Peso efectivo tras la directiva de salud"
                    : "Effective weight after the health directive"
                }
              >
                <span style={{ width: `${Math.min(100, pctEff)}%`, background: COLORS[k] }} />
              </span>
              <span className="mw-weights__effpct t-mono">
                {es ? "efectivo" : "effective"} {pctEff.toFixed(1)} %
              </span>
            </li>
          );
        })}
      </ul>

      {emergency ? (
        <div className="mw-block mw-block--crit">
          <b>{session.fsm.state}</b> ·{" "}
          {es
            ? "la seguridad manda: el A* usa el perfil de emergencia y tu preferencia queda en pausa hasta que la salud baje."
            : "safety rules: A* uses the emergency profile and your preference is paused until health recovers."}
        </div>
      ) : null}

      <PhysioWeightsPanel />

      <p className="mw__muted">
        {rr.ok
          ? es
            ? `Ruta recalculada: ${rr.route.distanceM.toFixed(0)} m · máx ${rr.route.maxSlopeDeg.toFixed(1)}° · ${rr.route.durationMin.toFixed(1)} min · ${rr.explanation.totals.equivalentCostM.toFixed(0)} m-eq.`
            : `Route recomputed: ${rr.route.distanceM.toFixed(0)} m · max ${rr.route.maxSlopeDeg.toFixed(1)}° · ${rr.route.durationMin.toFixed(1)} min · ${rr.explanation.totals.equivalentCostM.toFixed(0)} m-eq.`
          : es
            ? `Sin ruta admisible: ${rr.message}`
            : `No admissible route: ${engineText(rr.message, "en")}`}{" "}
        {es
          ? "Los pesos solo cambian qué ruta prefiere el A* entre las seguras: la envolvente (pendiente, zonas, confianza) no se relaja."
          : "Weights only change which safe route A* prefers: the envelope (slope, zones, confidence) is never relaxed."}
      </p>
    </div>
  );
}
