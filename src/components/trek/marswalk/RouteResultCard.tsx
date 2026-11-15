/**
 * MarsWalk · Tarjeta "Resultado A*": compara la ruta óptima del motor con la línea recta medida por el
 * mismo costmap (explanation.directLine) y muestra los pesos efectivos usados. Solo presenta datos del motor.
 */
import { useEffect, useRef } from "react";
import type { CostTermId } from "@/core/trek/contracts";
import { useTrek } from "@/state/trekStore";
import { TREK_TEXTS } from "../i18n";

const TERMS: ReadonlyArray<[CostTermId, "d" | "t" | "r" | "e" | "u" | "h"]> = [
  ["D", "d"],
  ["T", "t"],
  ["R", "r"],
  ["E", "e"],
  ["U", "u"],
  ["H", "h"],
];

const KIND_ES: Readonly<Record<string, string>> = {
  slope: "pendiente",
  zone: "zona prohibida",
  confidence: "confianza insuficiente",
  "unknown-terrain": "terreno sin datos",
  "out-of-bounds": "fuera de la malla",
  storm: "tormenta",
  sep: "evento SEP",
  reachability: "alcance",
};

export function RouteResultCard({ onClose }: { onClose: () => void }) {
  const state = useTrek();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const es = state.lang === "es";
  const tt = TREK_TEXTS[state.lang];
  const { session } = state;
  const rr = session.routeResult;
  const f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "—");

  if (!rr.ok) {
    return (
      <div ref={ref} className="mw-result glass" role="status">
        <header>
          <p className="t-label">
            <b>{es ? "Resultado A*" : "A* result"}</b>
          </p>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={es ? "Cerrar" : "Close"}
          >
            <svg viewBox="0 0 16 16">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <p className="mw-result__verdict is-crit">
          {es ? "Sin ruta admisible" : "No admissible route"} · {rr.reason}. {rr.message}
        </p>
      </div>
    );
  }

  const r = rr.route;
  const d = rr.explanation.directLine;
  const blockedKinds = [
    ...new Set(
      rr.explanation.blockedDirectPath.map((b) => (es ? (KIND_ES[b.kind] ?? b.kind) : b.kind)),
    ),
  ];
  const detourPct = d && d.distanceM > 0 ? ((r.distanceM - d.distanceM) / d.distanceM) * 100 : 0;
  const alts = rr.explanation.alternatives;
  const w = session.activeWeights;
  const emergency = session.fsm.state === "CRITICAL" || session.fsm.state === "EMERGENCY";

  let verdict: string;
  if (!d) verdict = "";
  else if (!d.admissible)
    verdict = es
      ? `La línea recta está bloqueada (${blockedKinds.join(", ")}). El A* rodea por terreno admisible: +${f1(r.distanceM - d.distanceM)} m (${detourPct >= 0 ? "+" : ""}${detourPct.toFixed(0)} %).`
      : `The straight line is blocked (${blockedKinds.join(", ")}). A* detours over admissible terrain: +${f1(r.distanceM - d.distanceM)} m (${detourPct >= 0 ? "+" : ""}${detourPct.toFixed(0)} %).`;
  else if (detourPct < 5)
    verdict = es
      ? "La línea recta es admisible y, con tus pesos, también es la opción de menor costo: el A* la sigue casi exacta."
      : "The straight line is admissible and, with your weights, also the cheapest option: A* follows it almost exactly.";
  else
    verdict = es
      ? `La recta sería admisible, pero el A* prefiere desviarse ${detourPct.toFixed(0)} % porque baja el costo con tus pesos (pend. máx ${f1(r.maxSlopeDeg)}° vs ${f1(d.maxSlopeDeg)}° en la recta).`
      : `The straight line would be admissible, but A* prefers a ${detourPct.toFixed(0)} % detour because it lowers the cost with your weights (max slope ${f1(r.maxSlopeDeg)}° vs ${f1(d.maxSlopeDeg)}° straight).`;

  const row = (label: string, a: string, b: string) => (
    <div className="mw-result__row">
      <span>{label}</span>
      <b>{a}</b>
      <b>{b}</b>
    </div>
  );

  return (
    <div ref={ref} className="mw-result glass" role="status" aria-live="polite">
      <header>
        <p className="t-label">
          <b>{es ? "Resultado A*" : "A* result"}</b> · ε {rr.epsilon} · {rr.computeMs.toFixed(0)} ms
        </p>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label={es ? "Cerrar" : "Close"}
        >
          <svg viewBox="0 0 16 16">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      <div className="mw-result__table">
        <div className="mw-result__row mw-result__row--head">
          <span />
          <span>{es ? "Ruta A*" : "A* route"}</span>
          <span>{es ? "Línea recta" : "Straight line"}</span>
        </div>
        {row(
          es ? "Distancia" : "Distance",
          `${f1(r.distanceM)} m`,
          d ? `${f1(d.distanceM)} m` : "—",
        )}
        {row(
          es ? "Pend. máx" : "Max slope",
          `${f1(r.maxSlopeDeg)}°`,
          d ? `${f1(d.maxSlopeDeg)}°` : "—",
        )}
        {row(
          es ? "Ascenso" : "Ascent",
          `+${f1(r.elevationGainM)} m`,
          d ? `+${f1(d.elevationGainM)} m` : "—",
        )}
        {row(
          es ? "Estado" : "Status",
          es ? "admisible" : "admissible",
          d
            ? d.admissible
              ? es
                ? "admisible"
                : "admissible"
              : es
                ? "bloqueada"
                : "blocked"
            : "—",
        )}
      </div>
      <p className={`mw-result__verdict${d && !d.admissible ? " is-warn" : ""}`}>{verdict}</p>
      <p className="mw-result__weights t-label">
        {emergency
          ? es
            ? "Perfil de emergencia · "
            : "Emergency profile · "
          : session.customWeights
            ? es
              ? "Pesos personalizados · "
              : "Custom weights · "
            : `${tt.weightProfiles[session.weightProfile]} · `}
        {TERMS.map(([k, key]) => `${k} ${(w[key] * 100).toFixed(0)}%`).join(" · ")}
      </p>
      <p className="mw-result__weights t-label">
        {alts.length} {es ? "alternativas evaluadas" : "alternatives evaluated"} ·{" "}
        {alts.filter((a) => a.status === "admissible").length} {es ? "admisibles" : "admissible"} ·{" "}
        {alts.filter((a) => a.status === "discarded").length} {es ? "descartadas" : "discarded"} ·{" "}
        {f1(rr.explanation.totals.equivalentCostM)} m-eq
      </p>
    </div>
  );
}
