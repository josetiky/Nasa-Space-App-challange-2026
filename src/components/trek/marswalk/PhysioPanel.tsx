/**
 * MarsWalk · Pesos fisiológicos dinámicos del A* y fuente de telemetría HUELLA ("metricas de vida").
 * Solo lee `session.physio`, `session.directive` y `session.envelope` y emite acciones del store:
 * el cálculo de necesidades y pesos vive en src/core/trek/health/physio.ts.
 */
import { useState } from "react";
import { PHYSIO_NEED_IDS, type PhysioNeedId, type PhysioTerm } from "@/core/trek/health/physio";
import { firstReplayEventS, replayPhaseAt } from "@/core/trek/health/huellaReplay";
import { HUELLA_REPLAYS, loadHuellaReplay } from "@/services/trek/huella";
import { dispatchTrek, useTrek } from "@/state/trekStore";

const NEED_LABEL: Readonly<Record<PhysioNeedId, { es: string; en: string }>> = {
  cardio: { es: "Cardio", en: "Cardio" },
  thermal: { es: "Térmica", en: "Thermal" },
  respiratory: { es: "Respiración", en: "Breathing" },
  suit: { es: "Traje", en: "Suit" },
  consumables: { es: "Consumibles", en: "Consumables" },
  fatigue: { es: "Fatiga", en: "Fatigue" },
  exposure: { es: "Exposición", en: "Exposure" },
  navigation: { es: "Navegación", en: "Navigation" },
};

const TERM_LABEL: Readonly<Record<PhysioTerm, { es: string; en: string; color: string }>> = {
  h: { es: "Esfuerzo", en: "Effort", color: "#fb7185" },
  t: { es: "Pendiente", en: "Slope", color: "#f59e0b" },
  e: { es: "Recursos", en: "Resources", color: "#34d399" },
  r: { es: "Exposición", en: "Exposure", color: "#f43f5e" },
  u: { es: "Terreno conocido", en: "Known terrain", color: "#a78bfa" },
};
const TERMS: readonly PhysioTerm[] = ["h", "t", "e", "r", "u"];

const SIGNAL_LABEL: Readonly<Record<string, { es: string; en: string }>> = {
  hr_residual_bpm: { es: "FC sobre lo esperado", en: "HR above expected" },
  heart_rate_bpm: { es: "FC", en: "HR" },
  rhythm_irregular: { es: "Ritmo irregular", en: "Irregular rhythm" },
  core_temp_c: { es: "Temp. central", en: "Core temp" },
  psi: { es: "Índice de estrés (PSI)", en: "Strain index (PSI)" },
  suit_humidity_pct: { es: "Humedad del traje", en: "Suit humidity" },
  helmet_co2_mmhg: { es: "CO₂ en casco", en: "Helmet CO₂" },
  spo2_pct: { es: "SpO₂", en: "SpO₂" },
  resp_rate_rpm: { es: "Frec. respiratoria", en: "Resp. rate" },
  fan_rpm: { es: "Ventilador", en: "Fan" },
  suit_pressure_dev_kpa: { es: "Desvío de presión", en: "Pressure deviation" },
  o2_source: { es: "O₂ secundario", en: "Secondary O₂" },
  consumable_min_pct: { es: "Consumible más bajo", en: "Lowest consumable" },
  comm_ok: { es: "Sin enlace", en: "No link" },
  pos_uncertainty_m: { es: "Incertidumbre de posición", en: "Position uncertainty" },
  fatigue_index: { es: "Índice de fatiga", en: "Fatigue index" },
  dose_rate_ratio: { es: "Tasa de dosis", en: "Dose rate" },
};

const fmt = (v: number) =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);

function useLang() {
  return useTrek((s) => s.lang);
}

/** Selector de telemetría: generador determinista o una caminata HUELLA de "metricas de vida". */
export function HuellaSourcePicker() {
  const state = useTrek();
  const es = state.lang === "es";
  const { session } = state;
  const replay = session.huellaReplay;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = replay ? firstReplayEventS(replay) : null;
  const jumpTo = first !== null ? Math.max(0, first - 120) : null;

  const choose = (id: string) => {
    setError(null);
    if (id === "generator") {
      dispatchTrek({ type: "setHuellaReplay", trace: null });
      return;
    }
    setLoading(id);
    loadHuellaReplay(id)
      .then((trace) => dispatchTrek({ type: "setHuellaReplay", trace }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(null));
  };

  return (
    <div
      className="mw-huella"
      role="group"
      aria-label={es ? "Fuente de telemetría" : "Telemetry source"}
    >
      <label
        className="chip mw-huella__pick"
        title={
          replay?.source ??
          (es ? "Generador determinista (telemetry.ts)" : "Deterministic generator")
        }
      >
        <span className="chip__dot" aria-hidden="true" />
        <select
          value={loading ?? replay?.scenarioId ?? "generator"}
          onChange={(e) => choose(e.target.value)}
          aria-label={es ? "Fuente de telemetría" : "Telemetry source"}
        >
          <option value="generator">
            {session.live
              ? es
                ? "Telemetría: tu astronauta (en vivo)"
                : "Telemetry: your astronaut (live)"
              : es
                ? "Telemetría: generador"
                : "Telemetry: generator"}
          </option>
          {HUELLA_REPLAYS.map((r) => (
            <option key={r.id} value={r.id}>
              {`HUELLA CSV · ${es ? r.titleEs : r.titleEn}`}
            </option>
          ))}
        </select>
      </label>
      {replay && jumpTo !== null && session.clockS < jumpTo ? (
        <button
          type="button"
          className="icon-btn mw-huella__jump"
          onClick={() => dispatchTrek({ type: "simTick", dtS: jumpTo - session.clockS })}
          aria-label={
            es
              ? "Saltar a 2 min antes del primer evento HUELLA"
              : "Jump to 2 min before the first HUELLA event"
          }
          title={
            es
              ? "Saltar a 2 min antes del primer evento HUELLA"
              : "Jump to 2 min before the first HUELLA event"
          }
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 3.5 7.5 8l-5 4.5zM8.5 3.5l5 4.5-5 4.5z" />
          </svg>
        </button>
      ) : null}
      {error ? <span className="chip chip--crit">{error}</span> : null}
    </div>
  );
}

/**
 * Panel de pesos fisiológicos: necesidades (0–1), multiplicadores FSM vs fisiología y lo que los empuja.
 * `compact` = tira para el mapa de la pestaña Simulación.
 */
export function PhysioWeightsPanel({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const es = lang === "es";
  const session = useTrek((s) => s.session);
  const { physio, directive, envelope, fsm } = session;
  const top = physio.drivers[0];
  const replayTitle = session.huellaReplay
    ? es
      ? session.huellaReplay.titleEs
      : session.huellaReplay.titleEn
    : "";
  const sourceLabel =
    physio.source === "huella-csv"
      ? `HUELLA CSV · ${replayTitle}`
      : physio.source === "live"
        ? es
          ? "astronauta en vivo"
          : "live astronaut"
        : physio.source === "generator"
          ? es
            ? "generador"
            : "generator"
          : es
            ? "sin telemetría"
            : "no telemetry";
  const raised = TERMS.filter((k) => (envelope.weightMultipliers[k] ?? 1) > 1);
  const driverText = (d: NonNullable<typeof top>) =>
    `${SIGNAL_LABEL[d.signal]?.[lang] ?? d.signal} ${fmt(d.value)}${d.unit ? ` ${d.unit}` : ""} · ${d.ruleId}`;

  if (compact) {
    return (
      <div className="mw-physio mw-physio--compact" aria-live="polite">
        <p className="t-label">A* · {es ? "pesos fisiológicos" : "physiological weights"}</p>
        <p className="mw-physio__src">
          {sourceLabel}
          {session.huellaReplay
            ? ` · ${replayPhaseAt(session.huellaReplay, session.clockS).replace(/_/g, " ")}`
            : ""}
          {physio.stale && physio.source !== "none" ? " · stale" : ""}
        </p>
        <div className="mw-physio__chips">
          {raised.length === 0 ? (
            <span className="mw-physio__chip">{es ? "neutros ×1" : "neutral ×1"}</span>
          ) : (
            raised.map((k) => (
              <span
                key={k}
                className="mw-physio__chip"
                style={{ borderColor: TERM_LABEL[k].color }}
              >
                <i style={{ background: TERM_LABEL[k].color }} />
                {k.toUpperCase()}×{(envelope.weightMultipliers[k] ?? 1).toFixed(2)}
              </span>
            ))
          )}
          {envelope.comfortSlopeDeg < 90 ? (
            <span className="mw-physio__chip">
              {es ? "cómoda" : "comfort"} ≤{envelope.comfortSlopeDeg}°
            </span>
          ) : null}
        </div>
        <div className="mw-physio__mini" aria-hidden="true">
          {PHYSIO_NEED_IDS.map((k) => (
            <span key={k} title={`${NEED_LABEL[k][lang]} ${(physio.needs[k] * 100).toFixed(0)} %`}>
              <b
                style={{
                  height: `${Math.max(4, physio.needs[k] * 100)}%`,
                  opacity: physio.needs[k] > 0 ? 1 : 0.25,
                }}
              />
            </span>
          ))}
        </div>
        <p className="mw-physio__why">
          {top
            ? driverText(top)
            : es
              ? `Sin necesidades sobre la línea base nominal · FSM ${fsm.state}`
              : `No needs above nominal baseline · FSM ${fsm.state}`}
        </p>
      </div>
    );
  }

  return (
    <section
      className="mw-physio"
      aria-label={es ? "Pesos fisiológicos dinámicos" : "Dynamic physiological weights"}
    >
      <header className="mw-physio__head">
        <p className="t-label">
          <b>{es ? "Pesos fisiológicos dinámicos" : "Dynamic physiological weights"}</b> ·{" "}
          {sourceLabel}
          {physio.stale && physio.source !== "none" ? " · stale" : ""}
        </p>
        <span className="chip" data-state={fsm.state}>
          FSM {fsm.state}
        </span>
      </header>
      <HuellaSourcePicker />
      <p className="mw__muted">
        {es
          ? "Cada ciclo, la telemetría HUELLA se compara con la caminata nominal de “metricas de vida” (0 %) y con los umbrales de reglas.json (100 %). Esas necesidades suben los pesos blandos del A*; la máquina de estados sigue mandando en los límites duros (pendiente máxima, zonas, meta)."
          : "Each cycle, HUELLA telemetry is compared with the nominal walk in “metricas de vida” (0 %) and the reglas.json thresholds (100 %). Those needs raise the A* soft weights; the state machine still owns the hard limits (max slope, zones, goal)."}
      </p>
      <ul className="mw-physio__needs">
        {PHYSIO_NEED_IDS.map((k) => (
          <li key={k}>
            <span>{NEED_LABEL[k][lang]}</span>
            <span className="mw-physio__bar">
              <span style={{ width: `${physio.needs[k] * 100}%` }} />
            </span>
            <span className="t-mono">{(physio.needs[k] * 100).toFixed(0)} %</span>
          </li>
        ))}
      </ul>
      <table className="mw-physio__table">
        <thead>
          <tr>
            <th>{es ? "Término" : "Term"}</th>
            <th>FSM</th>
            <th>{es ? "Fisiología" : "Physiology"}</th>
            <th>A*</th>
          </tr>
        </thead>
        <tbody>
          {TERMS.map((k) => {
            const f = directive.weightMultipliers[k] ?? 1;
            const p = physio.multipliers[k];
            const a = envelope.weightMultipliers[k] ?? 1;
            return (
              <tr key={k}>
                <td>
                  <i className="mw-dot" style={{ background: TERM_LABEL[k].color }} />{" "}
                  <b>{k.toUpperCase()}</b> · {TERM_LABEL[k][lang]}
                </td>
                <td className="t-mono">×{f.toFixed(2)}</td>
                <td className="t-mono" data-up={p > f ? "" : undefined}>
                  ×{p.toFixed(2)}
                </td>
                <td className="t-mono">
                  <b>×{a.toFixed(2)}</b>
                </td>
              </tr>
            );
          })}
          <tr>
            <td>φ · {es ? "exigencia" : "strain"}</td>
            <td className="t-mono">×{directive.strainFactor.toFixed(2)}</td>
            <td className="t-mono">×{physio.strainFactor.toFixed(2)}</td>
            <td className="t-mono">
              <b>×{envelope.strainFactor.toFixed(2)}</b>
            </td>
          </tr>
          <tr>
            <td>{es ? "Capacidad sostenible" : "Sustainable capacity"}</td>
            <td className="t-mono">{((directive.capacityFactor ?? 1) * 100).toFixed(0)} %</td>
            <td className="t-mono">{(physio.capacityFactor * 100).toFixed(0)} %</td>
            <td className="t-mono">
              <b>{(envelope.capacityFactor * 100).toFixed(0)} %</b>
            </td>
          </tr>
          <tr>
            <td>{es ? "Pendiente cómoda (blanda)" : "Comfort slope (soft)"}</td>
            <td className="t-mono">—</td>
            <td className="t-mono">
              {physio.comfortSlopeDeg === null ? "—" : `${physio.comfortSlopeDeg}°`}
            </td>
            <td className="t-mono">
              <b>
                {envelope.comfortSlopeDeg < 90 ? `${envelope.comfortSlopeDeg}°` : "—"} /{" "}
                {es ? "máx" : "max"} {envelope.maxSlopeDeg}°
              </b>
            </td>
          </tr>
        </tbody>
      </table>
      {physio.drivers.length > 0 ? (
        <ul className="mw-physio__drivers">
          {physio.drivers.slice(0, 4).map((d) => (
            <li key={d.signal}>
              <span>{driverText(d)}</span>
              <span className="t-mono">
                {es ? "base" : "base"} {fmt(d.zero)} → {es ? "umbral" : "limit"} {fmt(d.one)} ·{" "}
                {(d.intensity * 100).toFixed(0)} %
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mw__muted">
          {es
            ? "Ninguna señal supera la línea base nominal: pesos neutros (×1)."
            : "No signal is above the nominal baseline: neutral weights (×1)."}
        </p>
      )}
    </section>
  );
}
