/**
 * MarsWalk · Misión individual: máquina de estados visible, fallas en el camino y parámetros del
 * astronauta (port de la UI de simulador_huella.html de "metricas de vida"). Solo lee la sesión y
 * emite `updateLive` / eventos del motor; la física y las reglas viven en core/trek/health/liveSuit.ts
 * y la FSM en core/trek/health/fsm.ts (sin cambios).
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { HealthState } from "@/core/trek/contracts";
import {
  bsaMosteller,
  CREW_PRESETS,
  fcMaxTanaka,
  LIVE_RISE_S,
  radiationMatrix,
  type CrewParams,
  type SuitFaults,
} from "@/core/trek/health/liveSuit";
import { PSI_TO_KPA } from "@/core/trek/health/rules";
import type { LivePatch } from "@/core/trek/sim/session";
import { dispatchTrek, useTrek } from "@/state/trekStore";
import { MarsEnvPanel } from "./MarsEnvPanel";
import { PhysioWeightsPanel } from "./PhysioPanel";

type Lang = "es" | "en";
const L = (lang: Lang, es: string, en: string) => (lang === "es" ? es : en);

const STATE_COLOR: Readonly<Record<HealthState, string>> = {
  NORMAL: "#8fd6b0",
  FATIGUE: "#8fb3f0",
  CAUTION: "#f3c27a",
  CRITICAL: "#ff6b4a",
  EMERGENCY: "#ff3b30",
};

/** Despacha cambios al motor con un pequeño retardo para no replanificar en cada píxel del deslizador. */
function useLiveDispatch() {
  const timer = useRef<number | null>(null);
  const pending = useRef<LivePatch>({});
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  return (patch: LivePatch, immediate = false) => {
    pending.current = {
      ...pending.current,
      ...patch,
      params: { ...pending.current.params, ...patch.params },
      faults: { ...pending.current.faults, ...patch.faults },
      protocol: { ...pending.current.protocol, ...patch.protocol },
    };
    if (timer.current) window.clearTimeout(timer.current);
    const send = () => {
      const p = pending.current;
      pending.current = {};
      timer.current = null;
      dispatchTrek({ type: "updateLive", patch: p });
    };
    if (immediate) send();
    else timer.current = window.setTimeout(send, 140);
  };
}

function Row({
  label,
  value,
  children,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="solo-row" title={hint}>
      <span className="solo-row__label">
        {label}: <b>{value}</b>
      </span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Máquina de estados                                                  */
/* ------------------------------------------------------------------ */

const BOXES: ReadonlyArray<{
  id: HealthState;
  x: number;
  y: number;
  sub: { es: string; en: string };
}> = [
  { id: "NORMAL", x: 6, y: 6, sub: { es: "ESTABLE · nominal", en: "STABLE · nominal" } },
  { id: "FATIGUE", x: 158, y: 6, sub: { es: "fatiga acumulada", en: "accumulated fatigue" } },
  { id: "CAUTION", x: 310, y: 6, sub: { es: "PRECAUCIÓN", en: "CAUTION" } },
  { id: "EMERGENCY", x: 6, y: 128, sub: { es: "ABORTAR · candado IV1", en: "ABORT · IV1 lock" } },
  {
    id: "CRITICAL",
    x: 310,
    y: 128,
    sub: { es: "SUPERVIVENCIA · regreso", en: "SURVIVAL · return" },
  },
];
const BW = 108;
const BH = 46;

export function FsmDiagram({ onOpenConfirm }: { onOpenConfirm?: () => void }) {
  const state = useTrek();
  const lang = state.lang;
  const { fsm, live } = state.session;
  const suit = live?.suit ?? null;
  const n = live?.protocol.observationS ?? 30;
  const active = fsm.state;
  const recovering =
    suit && suit.level === "PRECAUCION" && suit.recoverySinceS !== null
      ? Math.min(n, suit.tS - suit.recoverySinceS)
      : null;
  const confirming =
    suit && suit.candLevel ? Math.min(LIVE_RISE_S, suit.tS - suit.candSinceS) : null;
  const history = fsm.history.slice(-3).reverse();

  const arrow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label: string,
    lx: number,
    ly: number,
    back = false,
  ) => (
    <g className={back ? "fsm-arrow fsm-arrow--back" : "fsm-arrow"}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#fsm-head)" />
      <text x={lx} y={ly} textAnchor="middle">
        {label}
      </text>
    </g>
  );

  return (
    <section
      className="solo-fsm glass panel"
      aria-label={L(lang, "Máquina de estados", "State machine")}
    >
      <header className="sim__phead">
        <p className="t-label">
          <b>{L(lang, "Máquina de estados", "State machine")}</b> · EVA1
        </p>
        <span
          className="solo-pill"
          style={{ color: STATE_COLOR[active], borderColor: STATE_COLOR[active] }}
        >
          {active}
        </span>
      </header>
      <svg className="solo-fsm__svg" viewBox="0 0 440 182" role="img" aria-label={`FSM ${active}`}>
        <defs>
          <marker
            id="fsm-head"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 8 4 0 8z" />
          </marker>
        </defs>
        {arrow(116, 22, 156, 22, "F ≥ 0.6", 136, 16)}
        {arrow(156, 40, 116, 40, "F ≤ 0.4", 136, 50, true)}
        {arrow(268, 22, 308, 22, `≥${LIVE_RISE_S} s`, 288, 16)}
        {arrow(308, 40, 268, 40, `${n} s`, 288, 50, true)}
        {arrow(352, 54, 352, 126, `≥${LIVE_RISE_S} s`, 334, 92)}
        {arrow(380, 126, 380, 54, L(lang, "refugio · IV", "shelter · IV"), 408, 92, true)}
        {arrow(308, 144, 116, 144, L(lang, "2+ SUP · O₂ SEC", "2+ SUP · O₂ SEC"), 212, 138)}
        {arrow(
          116,
          164,
          308,
          164,
          L(lang, "solo autorización IV1", "IV1 authorization only"),
          212,
          176,
          true,
        )}
        {BOXES.map((b) => {
          const on = b.id === active;
          return (
            <g
              key={b.id}
              className={`fsm-box${on ? " is-on" : ""}`}
              style={{ ["--c" as string]: STATE_COLOR[b.id] }}
            >
              <rect x={b.x} y={b.y} width={BW} height={BH} rx={10} />
              <text x={b.x + BW / 2} y={b.y + 20} textAnchor="middle" className="fsm-box__name">
                {b.id}
              </text>
              <text x={b.x + BW / 2} y={b.y + 35} textAnchor="middle" className="fsm-box__sub">
                {b.sub[lang]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="solo-fsm__status">
        {suit ? (
          <p>
            {L(lang, "Motor instantáneo", "Instant engine")}: <b>{suit.raw}</b>
            {suit.rules.length > 0 ? ` (${suit.rules.map((r) => r.ruleId).join(", ")})` : ""} ·{" "}
            {L(lang, "filtrado", "filtered")}: <b>{suit.level}</b>
          </p>
        ) : (
          <p>
            {L(lang, "Telemetría", "Telemetry")}:{" "}
            {state.session.huellaReplay ? "HUELLA CSV" : L(lang, "generador", "generator")}
          </p>
        )}
        {confirming !== null && suit?.candLevel ? (
          <p className="solo-fsm__count">
            {L(lang, "Confirmando", "Confirming")} {suit.candLevel}: {confirming}/{LIVE_RISE_S} s
            <span className="solo-bar">
              <span style={{ width: `${(confirming / LIVE_RISE_S) * 100}%` }} />
            </span>
          </p>
        ) : null}
        {recovering !== null ? (
          <p className="solo-fsm__count">
            {L(lang, "Observación en PRECAUCIÓN", "Observation in CAUTION")}: {recovering}/{n} s →{" "}
            {L(lang, "ESTABLE", "STABLE")}
            <span className="solo-bar">
              <span style={{ width: `${(recovering / n) * 100}%` }} />
            </span>
          </p>
        ) : null}
        {fsm.latch !== "none" ? (
          <p className="solo-fsm__latch">
            {fsm.latch === "iv-lock"
              ? L(
                  lang,
                  "Candado IV1: solo baja con autorización del hábitat.",
                  "IV1 lock: only the habitat can release it.",
                )
              : L(
                  lang,
                  "Modo regreso: baja al llegar al refugio o con confirmación del IV.",
                  "Return mode: releases at the shelter or with IV confirmation.",
                )}{" "}
            {fsm.requiresHumanConfirmation && onOpenConfirm ? (
              <button type="button" className="chip solo-chip-btn" onClick={onOpenConfirm}>
                {L(lang, "Autorizar (IV1) →", "Authorize (IV1) →")}
              </button>
            ) : null}
          </p>
        ) : null}
        <PhysioWeightsPanel compact />
        {history.length > 0 ? (
          <ol className="solo-fsm__log">
            {history.map((h) => (
              <li key={h.seq}>
                <span className="t-mono">T+{Math.round(h.missionTimeS)}s</span> {h.from} →{" "}
                <b style={{ color: STATE_COLOR[h.to] }}>{h.to}</b>{" "}
                <small>
                  {h.triggers
                    .map((t) => t.ruleId)
                    .slice(0, 3)
                    .join(", ")}
                </small>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fallas y protocolo (en pleno camino)                                */
/* ------------------------------------------------------------------ */

export function FaultControls() {
  const state = useTrek();
  const lang = state.lang;
  const { live, sepAlertActive } = state.session;
  const send = useLiveDispatch();
  const [local, setLocal] = useState<SuitFaults | null>(null);
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    setLocal(null);
    setN(null);
  }, [live?.faults, live?.protocol]);
  if (!live) return null;
  const f = local ?? live.faults;
  const obs = n ?? live.protocol.observationS;
  const setF = (patch: Partial<SuitFaults>) => {
    setLocal({ ...f, ...patch });
    send({ faults: patch });
  };

  return (
    <div className="solo-pane">
      <Row
        label={L(lang, "Observación n en PRECAUCIÓN", "Observation n in CAUTION")}
        value={`${obs} s`}
      >
        <input
          type="range"
          min={5}
          max={120}
          step={5}
          value={obs}
          onChange={(e) => {
            setN(+e.target.value);
            send({ protocol: { observationS: +e.target.value } });
          }}
        />
      </Row>
      <label
        className="solo-row solo-row--check"
        title={L(
          lang,
          "En Mars Trek el candado de EMERGENCY (ABORTAR) es parte de la máquina de estados y no se puede apagar.",
          "In Mars Trek the EMERGENCY (ABORT) lock is part of the state machine and cannot be turned off.",
        )}
      >
        <input type="checkbox" checked disabled />
        <span>
          {L(
            lang,
            "Candado IV1 en ABORTAR (siempre activo: solo baja si autoriza el hábitat)",
            "IV1 lock on ABORT (always on: only the habitat can release it)",
          )}
        </span>
      </label>
      <div className="solo-actions">
        <span className="t-label">
          {L(lang, "Control gradual de potencia y fallas", "Gradual power and fault control")}
        </span>
        <button
          type="button"
          className="chip solo-chip-btn solo-chip-btn--warn"
          onClick={() => send({ scare: true }, true)}
        >
          ⚡ {L(lang, "Susto (+35 lpm)", "Scare (+35 bpm)")}
        </button>
        <button
          type="button"
          className="chip solo-chip-btn solo-chip-btn--ok"
          onClick={() => {
            setLocal(null);
            send({ nominal: true }, true);
          }}
        >
          ✓ {L(lang, "Todo nominal", "All nominal")}
        </button>
      </div>
      <Row
        label={L(lang, "Potencia ventilador", "Fan power")}
        value={`${f.fanPct} % (${Math.round(300 * f.fanPct).toLocaleString()} rpm)`}
        hint="EVA-05 · EVA-04"
      >
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={f.fanPct}
          onChange={(e) => setF({ fanPct: +e.target.value })}
        />
      </Row>
      <Row
        label={L(lang, "Enfriamiento LCVG (estrés térmico)", "LCVG cooling (heat stress)")}
        value={`${f.coolPct} % (${(22 + 12 * (1 - f.coolPct / 100)).toFixed(1)} °C)`}
        hint="EVA-09 · EVA-21"
      >
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={f.coolPct}
          onChange={(e) => setF({ coolPct: +e.target.value })}
        />
      </Row>
      <Row
        label={L(lang, "Tasa de fuga del traje", "Suit leak rate")}
        value={`${f.leakRateKpaMin.toFixed(1)} kPa/min`}
        hint="EVA-02 · EVA-03"
      >
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={f.leakRateKpaMin}
          onChange={(e) => setF({ leakRateKpaMin: +e.target.value })}
        />
      </Row>
      <Row
        label={L(lang, "Inestabilidad ECG (arritmia)", "ECG instability (arrhythmia)")}
        value={`${f.arrhythmiaPct} %`}
        hint="EVA-12"
      >
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={f.arrhythmiaPct}
          onChange={(e) => setF({ arrhythmiaPct: +e.target.value })}
        />
      </Row>
      <label className="solo-row solo-row--check">
        <input
          type="checkbox"
          checked={f.commLoss}
          onChange={(e) => setF({ commLoss: e.target.checked })}
        />
        <span>
          {L(
            lang,
            "Pérdida de enlace con el hábitat (EVA-16 a los 5 min)",
            "Loss of link with the habitat (EVA-16 after 5 min)",
          )}
        </span>
      </label>
      <label className="solo-row solo-row--check">
        <input
          type="checkbox"
          checked={sepAlertActive}
          onChange={(e) =>
            dispatchTrek({
              type: "simEvent",
              event: {
                kind: "sep-alert",
                active: e.target.checked,
                doseRateMultiplier: 150,
                simulated: true,
              },
            })
          }
        />
        <span>
          {L(
            lang,
            "Simular Evento Solar (SPE) en vivo",
            "Simulate a live Solar Particle Event (SPE)",
          )}{" "}
          · EVA-13 · {L(lang, "refugio obligatorio", "mandatory shelter")}
        </span>
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parámetros del astronauta                                           */
/* ------------------------------------------------------------------ */

export function CrewParamsPanel() {
  const state = useTrek();
  const lang = state.lang;
  const live = state.session.live;
  const send = useLiveDispatch();
  const [local, setLocal] = useState<CrewParams | null>(null);
  useEffect(() => setLocal(null), [live?.params]);
  if (!live) {
    return (
      <p className="mw__muted">
        {L(
          lang,
          "Elige la misión «solo · Astronauta individual» para editar al astronauta.",
          "Choose the «solo» mission to edit the astronaut.",
        )}
      </p>
    );
  }
  const p = local ?? live.params;
  const setP = (patch: Partial<CrewParams>) => {
    setLocal({ ...p, ...patch });
    send({ params: patch });
  };
  const bsa = bsaMosteller(p.massKg, p.heightCm);
  const preset = (id: keyof typeof CREW_PRESETS) => {
    setLocal({ ...p, ...CREW_PRESETS[id] });
    send({ params: { ...CREW_PRESETS[id] } }, true);
  };

  return (
    <div className="solo-pane">
      <div className="solo-actions">
        <span className="mw__muted">
          BSA Mosteller: <b>{bsa.toFixed(2)} m²</b> ·{" "}
          {L(
            lang,
            "disipación LCVG ajustada por área corporal",
            "LCVG dissipation scaled by body area",
          )}
        </span>
        <button type="button" className="chip solo-chip-btn" onClick={() => preset("EVA1")}>
          {L(lang, "Perfil", "Profile")} EVA1
        </button>
        <button type="button" className="chip solo-chip-btn" onClick={() => preset("EVA2")}>
          {L(lang, "Perfil", "Profile")} EVA2
        </button>
      </div>
      <Row
        label={L(lang, "Edad astronauta", "Astronaut age")}
        value={`${p.ageY} ${L(lang, "años", "y")} (FCmáx ${Math.round(fcMaxTanaka(p.ageY))})`}
      >
        <input
          type="range"
          min={20}
          max={65}
          step={1}
          value={p.ageY}
          onChange={(e) => setP({ ageY: +e.target.value })}
        />
      </Row>
      <Row label={L(lang, "Estatura", "Height")} value={`${p.heightCm} cm`}>
        <input
          type="range"
          min={145}
          max={200}
          step={1}
          value={p.heightCm}
          onChange={(e) => setP({ heightCm: +e.target.value })}
        />
      </Row>
      <Row label={L(lang, "Masa corporal", "Body mass")} value={`${p.massKg} kg`}>
        <input
          type="range"
          min={45}
          max={110}
          step={1}
          value={p.massKg}
          onChange={(e) => setP({ massKg: +e.target.value })}
        />
      </Row>
      <Row
        label={L(lang, "VO₂máx (capacidad aeróbica)", "VO₂max (aerobic capacity)")}
        value={`${p.vo2MaxMlKgMin.toFixed(1)} mL/kg/min`}
      >
        <input
          type="range"
          min={25}
          max={65}
          step={0.5}
          value={p.vo2MaxMlKgMin}
          onChange={(e) => setP({ vo2MaxMlKgMin: +e.target.value })}
        />
      </Row>
      <Row
        label={L(lang, "Carga extra (equipo + muestras)", "Extra load (gear + samples)")}
        value={`${p.payloadKg.toFixed(1)} kg`}
      >
        <input
          type="range"
          min={0}
          max={40}
          step={0.5}
          value={p.payloadKg}
          onChange={(e) => setP({ payloadKg: +e.target.value })}
        />
      </Row>
      <div className="solo-row">
        <span className="solo-row__label">
          <input
            type="checkbox"
            checked={p.manualSlopePct !== null}
            onChange={(e) => setP({ manualSlopePct: e.target.checked ? 5 : null })}
            aria-label={L(lang, "Pendiente manual", "Manual slope")}
          />{" "}
          {L(lang, "Pendiente manual", "Manual slope")}:{" "}
          <b>
            {p.manualSlopePct === null
              ? L(lang, "la del tramo de la ruta", "from the route leg")
              : `${p.manualSlopePct} %`}
          </b>
        </span>
        <input
          type="range"
          min={-20}
          max={40}
          step={1}
          value={p.manualSlopePct ?? 5}
          onChange={(e) => setP({ manualSlopePct: +e.target.value })}
          aria-label={L(lang, "Pendiente manual (%)", "Manual slope (%)")}
        />
      </div>
      <Row
        label={L(lang, "Setpoint del traje", "Suit setpoint")}
        value={`${p.setpointPsi.toFixed(1)} psi (${(p.setpointPsi * PSI_TO_KPA).toFixed(1)} kPa)`}
        hint="EVA-02"
      >
        <input
          type="range"
          min={3.5}
          max={5}
          step={0.1}
          value={p.setpointPsi}
          onChange={(e) => setP({ setpointPsi: +e.target.value })}
        />
      </Row>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Radiación                                                           */
/* ------------------------------------------------------------------ */

export function RadiationPanel() {
  const state = useTrek();
  const lang = state.lang;
  const { live, sepAlertActive, baseDoseRateMsvPerSol } = state.session;
  const send = useLiveDispatch();
  const [career, setCareer] = useState<number | null>(null);
  useEffect(() => setCareer(null), [live?.params.careerDoseMsv]);
  if (!live) return null;
  const c = career ?? live.params.careerDoseMsv;
  const rows = radiationMatrix(c, sepAlertActive);
  const lvlClass = (l: string) =>
    l === "ABORTAR"
      ? "crit"
      : l === "SUPERVIVENCIA"
        ? "warn"
        : l === "PRECAUCION"
          ? "caution"
          : "ok";
  return (
    <div className="solo-pane">
      <Row
        label={L(lang, "Dosis previa acumulada en carrera", "Prior career dose")}
        value={`${c} mSv / 600 mSv`}
        hint="PRE-14"
      >
        <input
          type="range"
          min={0}
          max={600}
          step={10}
          value={c}
          onChange={(e) => {
            setCareer(+e.target.value);
            send({ params: { careerDoseMsv: +e.target.value } });
          }}
        />
      </Row>
      <label className="solo-row solo-row--check">
        <input
          type="checkbox"
          checked={sepAlertActive}
          onChange={(e) =>
            dispatchTrek({
              type: "simEvent",
              event: {
                kind: "sep-alert",
                active: e.target.checked,
                doseRateMultiplier: 150,
                simulated: true,
              },
            })
          }
        />
        <span>
          {L(lang, "Simular Evento Solar (SPE) en vivo", "Simulate a live SPE")} (EVA-13) ·{" "}
          <span className="mw__muted">RAD {baseDoseRateMsvPerSol.toFixed(2)} mSv/sol</span>
        </span>
      </label>
      <table className="solo-rad">
        <thead>
          <tr>
            <th>{L(lang, "Tiempo fuera", "Time outside")}</th>
            <th>{L(lang, "Dosis EVA", "EVA dose")}</th>
            <th>{L(lang, "Total carrera", "Career total")}</th>
            <th>{L(lang, "Impacto en salud y protocolo", "Health and protocol impact")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{lang === "es" ? r.labelEs : r.labelEn}</td>
              <td className="t-mono">{r.doseEvaMsv.toFixed(2)} mSv</td>
              <td className="t-mono">{r.totalMsv.toFixed(1)} mSv</td>
              <td>
                <span className={`solo-rad__pill solo-rad__pill--${lvlClass(r.level)}`}>
                  {lang === "es" ? r.effectEs : r.effectEn}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mw__muted">
        {L(
          lang,
          "0.64 mSv/día en superficie (MSL/RAD, Hassler et al. 2014); SPE ×150 [diseño, como en el simulador].",
          "0.64 mSv/day at the surface (MSL/RAD, Hassler et al. 2014); SPE ×150 [design, as in the simulator].",
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Consola de la misión individual (pestaña Simulación)                */
/* ------------------------------------------------------------------ */

export function SoloConsole({ assistant }: { assistant: ReactNode }) {
  const lang = useTrek((s) => s.lang);
  const [tab, setTab] = useState<"faults" | "crew" | "rad" | "env" | "assistant">("faults");
  const tabs: ReadonlyArray<[typeof tab, string]> = [
    ["faults", L(lang, "Fallas y protocolo", "Faults & protocol")],
    ["crew", L(lang, "Astronauta", "Astronaut")],
    ["rad", L(lang, "Radiación", "Radiation")],
    ["env", L(lang, "Marte", "Mars")],
    ["assistant", L(lang, "Asistente", "Assistant")],
  ];
  return (
    <section
      className="solo-console glass panel"
      aria-label={L(lang, "Consola de la misión individual", "Solo mission console")}
    >
      <div className="mw-seg solo-console__tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="solo-console__body">
        {tab === "faults" ? (
          <FaultControls />
        ) : tab === "crew" ? (
          <CrewParamsPanel />
        ) : tab === "rad" ? (
          <RadiationPanel />
        ) : tab === "env" ? (
          <MarsEnvPanel />
        ) : (
          assistant
        )}
      </div>
    </section>
  );
}
