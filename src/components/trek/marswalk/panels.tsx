/**
 * MarsWalk · Pestañas de la cubierta con el layout de mars-space-rockstars:
 *   01 MarsWalk (tabs/02-marswalk)        02 Ruta y porqués (mismo layout copia + panel)
 *   03 Simulación (tabs/03-simulacion)    04 Salud y contingencias
 * Cada pestaña lee `useTrek()` y solo emite `dispatchTrek(...)`: no hay umbrales, costos ni reglas
 * de salud en este archivo. Lo que el front entrante calculaba en local (ruta de ejemplo, motor de
 * vitales, alertas por umbral, "viabilidad") se sustituye por los valores del motor.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  CostTermId,
  HealthState,
  MissionProfileId,
  WeightProfileId,
  ZoneClass,
} from "@/core/trek/contracts";
import { healthRank } from "@/core/trek/contracts";
import { TREK_SCENARIOS } from "@/core/trek/sim/scenarios";
import { TREK_SITES } from "@/services/trek/sites";
import { dispatchTrek, isHumanLockActive, useTrek } from "@/state/trekStore";
import { layerProvenance, MAP_LAYER_IDS, UNAVAILABLE_DECOUPLED_LAYERS } from "../layerCatalog";
import { TREK_TEXTS } from "../i18n";
import { asciiSparkBar, healthVisual, whyBarSegments, zoneVisual } from "../viewHelpers";
import { DECK_TEXTS } from "./deckText";
import { MW_TEXTS } from "./i18n";
import { IsoMap } from "./IsoMap";
import { MarsWalkMap } from "./MarsWalkMap";
import { KnownPoints, WeightTuner } from "./plannerControls";
import { HuellaSourcePicker, PhysioWeightsPanel } from "./PhysioPanel";
import { CrewParamsPanel, FsmDiagram, RadiationPanel, SoloConsole } from "./SoloConsole";
import { MarsEnvChip } from "./MarsEnvPanel";
import { computeOptimalRoute, onRouteComputed } from "./routeBus";
import {
  buildAssistantFeed,
  canSubmitHumanConfirmation,
  MIN_JUSTIFICATION_CHARS,
  missionClock,
  vitalsFromRow,
} from "./model";
import { ConfChip, ProvChip, UnavailableChip } from "./ui";
import { engineText } from "./engineText";

const fmt1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const fmt0 = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : "—");
const pad = (n: number) => String(n).padStart(2, "0");

/** Segundos de misión por segundo real (×1 = tiempo real). */
export const SPEEDS = [1, 5, 15, 60, 300] as const;
export type Speed = (typeof SPEEDS)[number];

const INCIDENTS = [
  "fatiga_progresiva",
  "estres_termico",
  "falla_ventilador",
  "emergencia_medica",
  "perdida_sensores",
] as const;

function Eyebrow({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="t-label" data-in>
      <b>{pad(n)}</b> / {children}
    </p>
  );
}

function TwoLineTitle({
  lines,
  className = "mw__title",
}: {
  lines: readonly string[];
  className?: string;
}) {
  return (
    <h2 className={`${className} t-title t-h2`} data-in>
      {lines.map((l, i) => (
        <span key={i}>
          {l}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </h2>
  );
}

type RowCls = "ready" | "progress" | "pending" | "crit";

function Roadmap({
  rows,
}: {
  rows: ReadonlyArray<{ key: string; label: ReactNode; cls: RowCls; text: ReactNode }>;
}) {
  return (
    <ul className="mw__roadmap" data-in>
      {rows.map((r) => (
        <li key={r.key}>
          <span>{r.label}</span>
          <span className={`status status--${r.cls}`}>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/* ================================================================== */
/* 01 · MarsWalk — planificador                                        */
/* ================================================================== */
export function PlannerTab({ onSend, onOpenWhy }: { onSend: () => void; onOpenWhy: () => void }) {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const tt = TREK_TEXTS[state.lang];
  const { session, siteInfo, loadingTile, loadError } = state;
  const rr = session.routeResult;
  const st = session.fsm.state;
  const locked = isHumanLockActive(state);
  const r = session.activeRoute;
  const [view, setView] = useState<"chain" | "points" | "weights" | "astro">("chain");
  const solo = session.missionProfile === "solo" && session.live !== null;
  // Al salir de la misión individual la vista "Astronauta" deja de existir
  useEffect(() => {
    if (!solo) setView((v) => (v === "astro" ? "chain" : v));
  }, [solo]);
  // El botón del pie también lleva a la vista "Puntos", donde aparece la tarjeta de resultado
  useEffect(() => onRouteComputed(() => setView("points")), []);

  const chain: Array<{ key: string; label: string; cls: RowCls; text: string }> = [
    {
      key: "tile",
      label: t.chainTile,
      cls: loadError ? "crit" : loadingTile ? "progress" : "ready",
      text: loadError ? t.error : loadingTile ? t.loading : `${t.ready} · ${siteInfo.dataType}`,
    },
    {
      key: "costmap",
      label: t.chainCostmap,
      cls: "ready",
      text: `${t.ready} · ${session.snapshot.simulated ? "SIMULATED" : "DERIVED"}`,
    },
    {
      key: "route",
      label: t.chainRoute,
      cls: rr.ok ? "ready" : "crit",
      text: rr.ok ? `${t.ready} · ε ${rr.epsilon}` : t.blocked,
    },
    {
      key: "direct",
      label: t.directBlocked,
      cls: !rr.ok ? "pending" : rr.explanation.blockedDirectPath.length > 0 ? "crit" : "ready",
      text: !rr.ok
        ? "—"
        : rr.explanation.blockedDirectPath.length > 0
          ? `${t.blocked} · ${[...new Set(rr.explanation.blockedDirectPath.map((b) => b.kind))].join(", ")}`
          : t.admissible,
    },
    {
      key: "health",
      label: t.chainHealth,
      cls:
        healthRank(st) >= healthRank("CRITICAL")
          ? "crit"
          : healthRank(st) > 0
            ? "progress"
            : "ready",
      text: locked ? `${st} · ${t.locked}` : st,
    },
    {
      key: "return",
      label: t.chainReturn,
      cls: !rr.ok ? "pending" : rr.resourcePlan.returnMarginMin < 0 ? "crit" : "ready",
      text: rr.ok ? `${fmt0(rr.resourcePlan.returnMarginMin)} min` : "—",
    },
  ];

  const stat = (k: string, v: ReactNode) => (
    <div key={k}>
      <dt className="t-label">{k}</dt>
      <dd>{v}</dd>
    </div>
  );

  return (
    <div className="mw">
      <div className="mw__copy">
        <Eyebrow n={2}>{d.plannerEyebrow}</Eyebrow>
        <TwoLineTitle lines={d.plannerTitle} />
        <p className="t-lead" data-in>
          {d.plannerLead}
        </p>
        <p data-in style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="chip chip--mars">
            • {siteInfo.dataType} · {siteInfo.subtitle}
          </span>
        </p>
        <div className="mw__selects" data-in>
          <label className="chip mw__select">
            <span>{t.site}</span>
            <select
              aria-label={t.site}
              value={state.siteId}
              disabled={locked}
              title={locked ? t.lockedByHuman : siteInfo.source}
              onChange={(e) => dispatchTrek({ type: "setSiteLoading", siteId: e.target.value })}
            >
              {TREK_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.dataType}
                </option>
              ))}
            </select>
          </label>
          <label className="chip mw__select">
            <span>{t.mission}</span>
            <select
              aria-label={t.mission}
              value={session.missionProfile}
              disabled={locked}
              title={locked ? t.lockedByHuman : undefined}
              onChange={(e) =>
                dispatchTrek({
                  type: "setMissionProfile",
                  profile: e.target.value as MissionProfileId,
                })
              }
            >
              {(Object.keys(t.missionProfiles) as MissionProfileId[]).map((p) => (
                <option key={p} value={p}>
                  {p} · {t.missionProfiles[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mw-seg" role="tablist" aria-label={d.plannerViews} data-in>
          {(["chain", "points", "weights", ...(solo ? (["astro"] as const) : [])] as const).map(
            (v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
              >
                {v === "astro"
                  ? state.lang === "es"
                    ? "Astronauta"
                    : "Astronaut"
                  : d.plannerView[v]}
              </button>
            ),
          )}
        </div>
        {view === "chain" ? (
          <Roadmap rows={chain} />
        ) : view === "points" ? (
          <KnownPoints />
        ) : view === "astro" ? (
          <div className="solo-planner">
            <CrewParamsPanel />
            <RadiationPanel />
          </div>
        ) : (
          <WeightTuner />
        )}
        <p data-in>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenWhy}>
            {d.openWhy}
          </button>
        </p>
      </div>

      <section className="mw__panel glass panel" aria-label={d.workspace} data-in>
        <MarsWalkMap />
        <footer className="mw__foot">
          <dl className="mw__stats">
            {stat(
              t.stats.distance,
              r ? (
                r.distanceM >= 1000 ? (
                  <>
                    {(r.distanceM / 1000).toFixed(2)}
                    <small>km</small>
                  </>
                ) : (
                  <>
                    {fmt0(r.distanceM)}
                    <small>m</small>
                  </>
                )
              ) : (
                "—"
              ),
            )}
            {stat(
              t.stats.ascent,
              r ? (
                <>
                  +{fmt1(r.elevationGainM)}
                  <small>m</small>
                </>
              ) : (
                "—"
              ),
            )}
            {stat(
              t.stats.maxSlope,
              r ? (
                <>
                  {fmt1(r.maxSlopeDeg)}
                  <small>° / {session.envelope.maxSlopeDeg}°</small>
                </>
              ) : (
                "—"
              ),
            )}
            {stat(
              t.stats.duration,
              r ? (
                <>
                  {fmt1(r.durationMin)}
                  <small>min</small>
                </>
              ) : (
                "—"
              ),
            )}
            {stat(t.stats.minConf, r ? <ConfChip cls={r.minConfidence} /> : "—")}
            {stat(
              "O₂",
              rr.ok ? (
                <>
                  {fmt1(rr.resourcePlan.totals.o2Kg * 1000)}
                  <small>g</small>
                </>
              ) : (
                "—"
              ),
            )}
            <div>
              <dt className="t-label">&nbsp;</dt>
              <dd>
                <ProvChip type="MODELLED" />
              </dd>
            </div>
          </dl>
          <button type="button" className="btn btn--ghost btn--sm" onClick={computeOptimalRoute}>
            {state.lang === "es" ? "Calcular ruta óptima" : "Compute optimal route"}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm mw__send"
            onClick={onSend}
            disabled={!r}
          >
            {d.send}
            <span className="btn__icon" aria-hidden="true" style={{ width: 26, height: 26 }}>
              <svg viewBox="0 0 12 12">
                <path d="M3 1.8v8.4L10 6z" />
              </svg>
            </span>
          </button>
        </footer>
      </section>
    </div>
  );
}

/* ================================================================== */
/* 02 · Ruta y porqués                                                 */
/* ================================================================== */
export function WhyTab() {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const tt = TREK_TEXTS[state.lang];
  const { session, activeLayer, visibleOverlays, siteInfo, manifest } = state;
  const { routeResult: rr, proposedRoute, resources } = session;
  const segments = useMemo(
    () => (rr.ok ? whyBarSegments(rr.explanation.contributions) : null),
    [rr],
  );

  return (
    <div className="mw mw--why">
      <div className="mw__copy">
        <Eyebrow n={2}>{d.whyEyebrow}</Eyebrow>
        <TwoLineTitle lines={d.whyTitle} />
        <p className="t-lead" data-in>
          {d.whyLead}
        </p>
        <p data-in style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="chip chip--mars">• {tt.weightProfiles[session.weightProfile]}</span>
          <ProvChip type="MODELLED" />
        </p>

        {rr.ok && segments ? (
          <div data-in>
            <div
              className="mw-why"
              role="img"
              aria-label={segments.map((s) => `${s.term} ${s.pct}%`).join(", ")}
            >
              {segments.map((s) =>
                s.pct > 0 ? (
                  <span key={s.term} style={{ width: `${s.pct}%`, background: s.colorHex }} />
                ) : null,
              )}
            </div>
            <Roadmap
              rows={segments.map((s) => ({
                key: s.term,
                label: (
                  <>
                    <i className="mw-dot" style={{ background: s.colorHex }} />
                    <b>{s.term}</b> · {tt.costTerms[s.term as CostTermId].label}
                  </>
                ),
                cls: s.pct >= 25 ? "progress" : "pending",
                text: `${s.pct.toFixed(1)} %`,
              }))}
            />
            <p className="t-label" style={{ marginTop: 8 }}>
              Σ = 100 % · {fmt0(rr.explanation.totals.equivalentCostM)} m-eq
            </p>
          </div>
        ) : (
          <div className="mw-block mw-block--crit" data-in>
            <b>
              {t.noRoute} · {!rr.ok ? rr.reason : ""}
            </b>
            <div>{!rr.ok ? engineText(rr.message, state.lang) : ""}</div>
            {!rr.ok
              ? rr.blocked.slice(0, 4).map((b, i) => (
                  <div key={i}>
                    [{b.kind.toUpperCase()}] {engineText(b.detail, state.lang)}
                  </div>
                ))
              : null}
          </div>
        )}
      </div>

      <section
        className="mw__panel mw__panel--scroll glass panel"
        aria-label={t.navTitle}
        data-in
        data-scroll-lock
      >
        {proposedRoute ? (
          <div
            className="mw-block mw-block--warn"
            style={{ display: "grid", gap: 8, marginBottom: 14 }}
          >
            <span>{t.proposed}</span>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => dispatchTrek({ type: "acceptProposedRoute" })}
            >
              {t.accept}
            </button>
          </div>
        ) : null}

        {rr.ok ? (
          <>
            <p className="t-label mw__sub">{t.directBlocked}</p>
            {rr.explanation.blockedDirectPath.length > 0 ? (
              <div className="mw__stack">
                {rr.explanation.blockedDirectPath.map((b, i) => (
                  <div key={i} className="mw-block mw-block--warn">
                    <b>[{b.kind.toUpperCase()}]</b> {engineText(b.detail, state.lang)}
                    {b.value !== undefined ? ` · ${b.value}` : ""}
                    {b.limit !== undefined ? ` / ${b.limit}` : ""} · ({b.at.x}, {b.at.z})
                  </div>
                ))}
              </div>
            ) : (
              <div className="mw-block mw-block--ok">{t.directClear}</div>
            )}

            <p className="t-label mw__sub">{t.alternatives}</p>
            {rr.explanation.alternatives.length === 0 ? (
              <div className="mw-block mw-block--ok">{t.noAlternatives}</div>
            ) : (
              <ul className="mw__roadmap mw__roadmap--tight">
                {rr.explanation.alternatives.map((a) => (
                  <li
                    key={a.id}
                    title={a.discardReasons
                      .map((x) => `[${x.kind}] ${engineText(x.detail, state.lang)}`)
                      .join("\n")}
                  >
                    <span>
                      {engineText(a.label, state.lang)}
                      <small className="mw__muted">
                        {engineText(a.summary, state.lang)}
                        {a.discardReasons[0]
                          ? ` · [${a.discardReasons[0].kind}] ${engineText(a.discardReasons[0].detail, state.lang)}`
                          : ""}
                      </small>
                    </span>
                    <span
                      className={`status ${a.status === "discarded" ? "status--crit" : "status--ready"}`}
                    >
                      {a.status === "discarded" ? t.discarded : t.admissible}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        <div className="mw__phead" style={{ marginTop: 16 }}>
          <p className="t-label">{t.consumables}</p>
          <span style={{ display: "flex", gap: 4 }}>
            {rr.ok ? <ProvChip type={rr.resourcePlan.provenance.dataType} /> : null}
            {resources.simulated ? <ProvChip type="SIMULATED" /> : null}
          </span>
        </div>
        <dl className="mw-kvs">
          <div className="mw-kv">
            <dt>O₂ ({resources.o2Source})</dt>
            <dd>
              {rr.ok ? `${fmt1(rr.resourcePlan.totals.o2Kg * 1000)} g` : "—"} /{" "}
              {fmt0(resources.o2PrimaryPsi)} psi · {fmt0(resources.o2PrimaryMin)} min
            </dd>
          </div>
          <div className="mw-kv">
            <dt>{state.lang === "es" ? "Batería" : "Battery"}</dt>
            <dd>
              {rr.ok ? `${fmt1(rr.resourcePlan.totals.energyWh)} Wh` : "—"} /{" "}
              {fmt0(resources.batteryWh)} Wh · {fmt0(resources.batteryMin)} min
            </dd>
          </div>
          <div className="mw-kv">
            <dt>H₂O · LCVG</dt>
            <dd title="La planificación de ruta no estima consumo de agua por tramo">
              <UnavailableChip /> / {fmt1(resources.coolantStoragePct)} % ·{" "}
              {fmt0(resources.coolantMin)} min
            </dd>
          </div>
          <div className="mw-kv">
            <dt>CO₂ · {state.lang === "es" ? "depurador" : "scrubber"}</dt>
            <dd title="La planificación de ruta no estima consumo de CO₂ por tramo">
              <UnavailableChip /> / {fmt1(resources.co2ScrubberPct)} % ·{" "}
              {fmt0(resources.co2CapacityMin)} min
            </dd>
          </div>
          {rr.ok ? (
            <>
              <div className="mw-kv">
                <dt>{t.returnMargin}</dt>
                <dd
                  className={
                    rr.resourcePlan.returnMarginMin < 0
                      ? "is-crit"
                      : rr.resourcePlan.returnMarginPct < 20
                        ? "is-warn"
                        : "is-ok"
                  }
                >
                  {fmt0(rr.resourcePlan.returnMarginMin)} min (
                  {fmt0(rr.resourcePlan.returnMarginPct)} %)
                </dd>
              </div>
              <div className="mw-kv">
                <dt>{t.pnr}</dt>
                <dd>
                  {rr.resourcePlan.pointOfNoReturnAtM === null
                    ? "—"
                    : `${fmt0(rr.resourcePlan.pointOfNoReturnAtM)} m`}
                </dd>
              </div>
            </>
          ) : null}
          <div className="mw-kv">
            <dt>{t.limiting}</dt>
            <dd>
              {resources.limiting.resource.toUpperCase()} · {fmt0(resources.limiting.minutes)} min
            </dd>
          </div>
        </dl>

        <div className="mw__phead" style={{ marginTop: 16 }}>
          <p className="t-label">{d.layersTitle}</p>
          <ProvChip type={siteInfo.dataType} />
        </div>
        <p className="mw__muted" style={{ marginBottom: 10 }}>
          {siteInfo.source} · {siteInfo.resolutionM} m/nodo
          {manifest
            ? ` · ${manifest.grid.nx}×${manifest.grid.nz} · ${manifest.license}`
            : ""} · {siteInfo.capturedDate} ({siteInfo.solRange})
        </p>
        <div className="mw__stack">
          {MAP_LAYER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="mw-layer"
              aria-pressed={activeLayer === id}
              onClick={() => dispatchTrek({ type: "setActiveLayer", layer: id })}
            >
              <span>{tt.layers[id]}</span>
              <ProvChip type={layerProvenance(id, state)} />
            </button>
          ))}
        </div>
        <div className="mw__toggles">
          {(Object.keys(visibleOverlays) as Array<keyof typeof visibleOverlays>).map((key) => (
            <label key={key} className="mw-toggle">
              <input
                type="checkbox"
                checked={visibleOverlays[key]}
                onChange={() => dispatchTrek({ type: "toggleOverlay", overlay: key })}
              />
              {t.overlayNames[key]}
            </label>
          ))}
        </div>
        <div className="mw__zones">
          {(["Z0", "Z1", "Z2", "Z3", "Z4", "Z5"] as ZoneClass[]).map((z) => {
            const zv = zoneVisual(z);
            return (
              <span key={z} className="t-label">
                <span style={{ color: zv.fillHex }}>{zv.shapeGlyph}</span> {tt.zoneLabels[z]}
              </span>
            );
          })}
        </div>
        <p className="t-label mw__sub">
          {t.unavailable} ({UNAVAILABLE_DECOUPLED_LAYERS.length})
        </p>
        <div className="mw__stack">
          {UNAVAILABLE_DECOUPLED_LAYERS.map((u) => (
            <div key={u.id} className="panel--inset" style={{ padding: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 550 }}>{u.title}</span>
                <UnavailableChip />
              </div>
              <p className="mw__muted" style={{ marginTop: 4 }}>
                {state.lang === "es" ? u.reasonEs : u.reasonEn}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/* 03 · Simulación y consola                                           */
/* ================================================================== */
export function SimTab({
  playing,
  onTogglePlay,
  speed,
  onSpeed,
  hrHistory,
  onOpenHealth,
  onOpenConfirm,
  onOpenEnv,
}: {
  onOpenHealth: () => void;
  onOpenConfirm?: () => void;
  onOpenEnv?: () => void;
  playing: boolean;
  onTogglePlay: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  hrHistory: readonly number[];
}) {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const { session, siteInfo } = state;
  const { fsm, envelope, latestTelemetryRow, clockS, routeResult: rr } = session;
  const locked = isHumanLockActive(state);
  const vitals = vitalsFromRow(latestTelemetryRow);
  const hr = vitals[0]!;
  const routeMin = session.activeRoute?.durationMin ?? 0;
  const elapsedMin = session.resources.evaElapsedMin;
  const progress = routeMin > 0 ? Math.max(0, Math.min(1, elapsedMin / routeMin)) : 0;
  const marginPct = rr.ok ? Math.max(0, Math.min(100, rr.resourcePlan.returnMarginPct)) : 0;
  // Misión individual: astronauta en vivo con máquina de estados visible y fallas en el camino
  const solo = session.missionProfile === "solo" && session.live !== null;

  return (
    <div className={`sim${solo ? " sim--solo" : ""}`}>
      <header className="sim__head">
        <Eyebrow n={3}>{d.simEyebrow}</Eyebrow>
        <TwoLineTitle lines={d.simTitle} className="sim__title" />
        <div className="sim__sub" data-in>
          <span className="chip chip--mars">• {d.simChip}</span>
          <button
            type="button"
            className="chip mw-healthchip"
            data-state={fsm.state}
            onClick={onOpenHealth}
          >
            <span className="chip__dot" aria-hidden="true" /> {fsm.state} · {d.openHealth}
            {fsm.requiresHumanConfirmation ? " · 🔒" : ""}
          </button>
          <p className="t-lead">{d.simLead}</p>
        </div>
      </header>

      <div className="sim__grid">
        <section
          className="sim__mapcard glass panel"
          aria-label={`${d.mapCard} · ${siteInfo.name}`}
          data-in
        >
          <div className="sim__overlay sim__overlay--tl panel--inset">
            <p className="t-label">
              <b>
                {d.mapCard} · {siteInfo.name}
              </b>
            </p>
            <p className="t-label">
              {siteInfo.dataType} · {siteInfo.resolutionM} m/nodo
            </p>
            {solo ? null : <PhysioWeightsPanel compact />}
          </div>
          <div className="sim__overlay sim__overlay--tr panel--inset">
            <p className="t-label">
              {d.returnMargin} <b>{rr.ok ? `${fmt0(rr.resourcePlan.returnMarginPct)} %` : "—"}</b>
            </p>
            <p className="sim__bar t-mono" aria-hidden="true">
              [{asciiSparkBar(marginPct, 0, 100, 10).replace(/\./g, "·")}]
            </p>
            <p className="t-label">
              {t.slopeLimit} {envelope.maxSlopeDeg}° · {fsm.state}
            </p>
            {onOpenEnv ? <MarsEnvChip onOpen={onOpenEnv} /> : null}
          </div>

          <IsoMap />

          <footer className="sim__controls">
            <div className="sim__btns">
              <button
                type="button"
                className="icon-btn"
                onClick={onTogglePlay}
                aria-label={playing ? t.pause : t.play}
                title={playing ? t.pause : t.play}
              >
                {playing ? (
                  <svg viewBox="0 0 16 16">
                    <path d="M5.5 3.5v9M10.5 3.5v9" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16">
                    <path d="M5 3l8 5-8 5z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t.reset}
                title={locked ? t.resetLocked : t.reset}
                disabled={locked}
                onClick={() => dispatchTrek({ type: "resetSession" })}
              >
                <svg viewBox="0 0 16 16">
                  <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
                  <path d="M2.5 2.5v3h3" />
                </svg>
              </button>
              <div className="sim__speed" role="group" aria-label="dt">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={speed === s}
                    onClick={() => onSpeed(s)}
                    title={
                      state.lang === "es"
                        ? `${s} s de misión por cada segundo real${s === 1 ? " (tiempo real)" : ""}`
                        : `${s} mission s per real second${s === 1 ? " (real time)" : ""}`
                    }
                  >
                    ×{s}
                  </button>
                ))}
              </div>
            </div>
            <div className="sim__progress" title={t.evaElapsed}>
              <span className="t-label">
                {t.pick.origin.toUpperCase()} → {t.pick.goal.toUpperCase()}
              </span>
              <span className="sim__ptrack">
                <span style={{ transform: `scaleX(${progress})` }} />
              </span>
              <span className="t-label t-mono">{Math.round(progress * 100)} %</span>
            </div>
            <span className="link-status">
              <span className="chip__dot" aria-hidden="true" /> SIM · local
            </span>
          </footer>
        </section>

        <div className="sim__side">
          <section className="sim__vitals glass panel" aria-label={t.healthTitle} data-in>
            <header className="sim__phead">
              <p className="t-label">
                {d.astronaut} · <b>EVA1</b>
              </p>
              <HuellaSourcePicker />
              <p className="t-label t-mono">{missionClock(clockS)}</p>
            </header>
            <div className="vit vit--wide panel--inset" data-quality={hr.quality}>
              <div>
                <p className="t-label">{hr.label}</p>
                <p className="vit__val">
                  <b>{hr.value === null ? "—" : hr.value.toFixed(hr.digits)}</b>
                  <small>{hr.unit}</small>
                </p>
              </div>
              <Spark values={hrHistory} />
            </div>
            <div className="vit__grid">
              {vitals.slice(1).map((v) => (
                <div
                  key={v.id}
                  className="vit panel--inset"
                  data-quality={v.quality}
                  title={`${t.dataQuality}: ${v.quality}`}
                >
                  <p className="t-label">{v.label}</p>
                  <p className="vit__val">
                    <b>{v.value === null ? "—" : v.value.toFixed(v.digits)}</b>
                    <small>{v.unit}</small>
                  </p>
                  {v.quality !== "valid" ? <span className="vit__q">{v.quality}</span> : null}
                </div>
              ))}
            </div>
            {latestTelemetryRow ? null : (
              <p className="mw__muted" style={{ marginTop: 8 }}>
                {t.noSample}
              </p>
            )}
          </section>

          {solo ? <FsmDiagram {...(onOpenConfirm ? { onOpenConfirm } : {})} /> : <AssistantPanel />}
        </div>
        {solo ? <SoloConsole assistant={<AssistantPanel />} /> : null}
      </div>
    </div>
  );
}

function Spark({ values }: { values: readonly number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    if (values.length < 2) return;
    const lo = Math.min(...values) - 5;
    const hi = Math.max(...values) + 5;
    g.lineWidth = 3;
    g.strokeStyle = "#df8a5d";
    g.shadowColor = "rgba(223,138,93,.6)";
    g.shadowBlur = 8;
    g.beginPath();
    values.forEach((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * c.width;
      const y = c.height - ((v - lo) / Math.max(1, hi - lo)) * (c.height - 8) - 4;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
  }, [values]);
  return <canvas ref={ref} className="vit__spark" width={600} height={80} aria-hidden="true" />;
}

/** Asistente con guía por voz (Web Speech, como en el front): narra la bitácora real del motor. */
function AssistantPanel() {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const feed = useMemo(
    () =>
      buildAssistantFeed(state.session.replanLog, state.session.fsm.history).map((f) => ({
        ...f,
        text: engineText(f.text, state.lang),
      })),
    [state.session.replanLog, state.session.fsm.history, state.lang],
  );
  const [voiceOn, setVoiceOn] = useState(false);
  const spokenRef = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const last = feed[feed.length - 1];
    if (!last || last.key === spokenRef.current) return;
    spokenRef.current = last.key;
    if (
      !voiceOn ||
      last.level === "info" ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    )
      return;
    try {
      const u = new SpeechSynthesisUtterance(last.text.replace(/\[[^\]]*\]\s*/g, ""));
      u.lang = state.lang === "es" ? "es-ES" : "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* voz no disponible */
    }
  }, [feed, voiceOn, state.lang]);

  return (
    <section className="sim__assist glass panel" aria-label={t.assistantTitle} data-in>
      <header className="sim__phead">
        <p className="t-label">
          {d.assistant} · <b>{d.routeGuide}</b>
        </p>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ProvChip type="SIMULATED" />
          <button
            type="button"
            className="btn btn--ghost btn--sm sim__voice"
            aria-pressed={voiceOn}
            onClick={() => {
              setVoiceOn((v) => !v);
              if (voiceOn && typeof window !== "undefined" && "speechSynthesis" in window)
                window.speechSynthesis.cancel();
            }}
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 6v4h2.5L9 13V3L5.5 6z" />
              <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" data-wave />
            </svg>
            {state.lang === "es" ? "Guía por voz" : "Voice guide"}
          </button>
        </span>
      </header>
      <ol ref={listRef} className="sim__log" aria-live="polite" data-scroll-lock>
        {feed.length === 0 ? (
          <li data-level="info">
            <time>{missionClock(0).slice(3)}</time>
            <span>{t.assistantIdle}</span>
          </li>
        ) : (
          feed.map((f) => (
            <li key={f.key} data-level={f.level}>
              <time>{missionClock(f.atS).slice(3)}</time>
              <span>{f.text}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

/* ================================================================== */
/* 04 · Salud y contingencias                                          */
/* ================================================================== */
export function HealthTab({
  onRunScenario,
  onOpenConfirm,
}: {
  onRunScenario: (id: string) => void;
  onOpenConfirm: () => void;
}) {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const tt = TREK_TEXTS[state.lang];
  const { session, activeScenarioId, scenarioStepIdx } = state;
  const { fsm, directive, envelope } = session;
  const hv = healthVisual(fsm.state);
  const locked = isHumanLockActive(state);

  return (
    <div className="mw mw--health">
      <div className="mw__copy">
        <Eyebrow n={3}>{d.healthEyebrow}</Eyebrow>
        <TwoLineTitle lines={d.healthTitle} />
        <p className="t-lead" data-in>
          {d.healthLead}
        </p>
        <div className="mw-health" data-state={fsm.state} role="status" aria-live="polite" data-in>
          <span>
            {hv.shapeGlyph} {fsm.state} · {tt.healthStates[fsm.state]}
          </span>
          <span className="mw-health__meta">
            {envelope.maxSlopeDeg}° · ×{envelope.speedFactor.toFixed(2)} · {fsm.latch}
          </span>
        </div>
        <Roadmap
          rows={[
            {
              key: "policy",
              label: t.goalPolicy,
              cls: directive.goalPolicy === "keep-goal" ? "ready" : "crit",
              text: directive.goalPolicy,
            },
            {
              key: "slope",
              label: t.slopeLimit,
              cls: "ready",
              text: `${directive.limits.maxSlopeDeg}°`,
            },
            {
              key: "latch",
              label: t.latch,
              cls: fsm.latch === "none" ? "ready" : "crit",
              text: fsm.latch,
            },
            {
              key: "causes",
              label: t.causes,
              cls: fsm.causes.length ? "progress" : "pending",
              text: fsm.causes.length ? fsm.causes.join(", ") : "—",
            },
            ...(directive.protocol
              ? [
                  {
                    key: "protocol",
                    label: "Protocol",
                    cls: "crit" as const,
                    text: directive.protocol,
                  },
                ]
              : []),
          ]}
        />
        <p className="t-label mw__sub" data-in>
          {t.triggers}
        </p>
        {fsm.activeTriggers.length === 0 ? (
          <div className="mw-block mw-block--ok" data-in>
            {t.noTriggers}
          </div>
        ) : (
          <div className="mw__stack" data-in>
            {fsm.activeTriggers.map((tr, i) => (
              <div
                key={`${tr.ruleId}-${i}`}
                className={`mw-block ${tr.level === "ABORTAR" || tr.level === "SUPERVIVENCIA" ? "mw-block--crit" : "mw-block--warn"}`}
              >
                <b>{tr.ruleId}</b> ({tr.level}) · {engineText(tr.message, state.lang)}
              </div>
            ))}
          </div>
        )}
        {locked ? (
          <div className="mw-block mw-block--crit mw__lock" data-in>
            <b>🔒 {t.awaitingHuman}</b>
            <button type="button" className="btn btn--crit btn--sm" onClick={onOpenConfirm}>
              {t.openConfirm}
            </button>
          </div>
        ) : null}
      </div>

      <section
        className="mw__panel mw__panel--scroll glass panel"
        aria-label={t.consoleTitle}
        data-in
        data-scroll-lock
      >
        <div className="mw__phead">
          <p className="t-label">
            <b>{t.scenarios}</b>
          </p>
          <ProvChip type="SIMULATED" />
        </div>
        <div className="mw__stack">
          {TREK_SCENARIOS.map((sc) => {
            const idx = activeScenarioId === sc.id ? scenarioStepIdx : 0;
            const next = sc.steps[idx];
            return (
              <button
                key={sc.id}
                type="button"
                className="mw-layer mw-layer--scenario"
                aria-pressed={activeScenarioId === sc.id}
                disabled={locked}
                title={locked ? t.resetLocked : undefined}
                onClick={() => onRunScenario(sc.id)}
              >
                <span>▶ {state.lang === "es" ? sc.titleEs : sc.titleEn}</span>
                <small>
                  {t.nextStep} {idx + 1}/{sc.steps.length}:{" "}
                  {next ? (state.lang === "es" ? next.labelEs : next.labelEn) : "—"}
                </small>
              </button>
            );
          })}
        </div>

        <p className="t-label mw__sub">{t.inject}</p>
        <div className="mw__tools mw__tools--wrap">
          {INCIDENTS.map((inc) => (
            <button
              key={inc}
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: { kind: "health-incident", incident: inc, simulated: true },
                })
              }
            >
              + {t.incidents[inc]}
            </button>
          ))}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-pressed={session.sepAlertActive}
            onClick={() =>
              dispatchTrek({
                type: "simEvent",
                event: {
                  kind: "sep-alert",
                  active: !session.sepAlertActive,
                  doseRateMultiplier: 4,
                  simulated: true,
                },
              })
            }
          >
            ☀ {t.sep}: {session.sepAlertActive ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              dispatchTrek({
                type: "simEvent",
                event: { kind: "battery-drop", dropPct: 25, simulated: true },
              })
            }
          >
            {t.battery}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => dispatchTrek({ type: "clearStorms" })}
          >
            {t.clearStorms}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={locked}
            title={locked ? t.resetLocked : undefined}
            onClick={() => dispatchTrek({ type: "resetSession" })}
          >
            ↺ {t.reset}
          </button>
        </div>
        <p className="mw__muted" style={{ marginTop: 18 }}>
          {d.credits}
        </p>
      </section>
    </div>
  );
}

/* ================================================================== */
/* Modal de confirmación humana (desescalamiento CRITICAL/EMERGENCY)   */
/* ================================================================== */
export function HumanConfirmModal({ onClose }: { onClose: () => void }) {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const { fsm } = state.session;
  const [by, setBy] = useState("HAB-IV1");
  const [reason, setReason] = useState("");
  // Hecho declarado por el operador, nunca asumido: por defecto el tripulante NO está en refugio.
  const [atShelter, setAtShelter] = useState(false);
  const firstRef = useRef<HTMLTextAreaElement | null>(null);
  const can = canSubmitHumanConfirmation({
    requiresHumanConfirmation: fsm.requiresHumanConfirmation,
    by,
    justification: reason,
  });

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!fsm.requiresHumanConfirmation) onClose();
  }, [fsm.requiresHumanConfirmation, onClose]);

  const lastStates: HealthState[] = fsm.history.slice(-3).map((h) => h.to);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mw-confirm-title">
      <div className="modal__scrim" onClick={onClose} />
      <form
        className="mw-modal__card glass panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (!can) return;
          dispatchTrek({
            type: "simEvent",
            event: {
              kind: "human-authorize",
              by: by.trim(),
              justification: reason.trim(),
              atShelter,
              simulated: true,
            },
          });
          setReason("");
        }}
      >
        <div className="mw__phead">
          <p id="mw-confirm-title" className="t-label" style={{ color: "var(--crit)" }}>
            <b style={{ color: "var(--crit)" }}>🔒 {t.confirmTitle}</b>
          </p>
          <ProvChip type="SIMULATED" />
        </div>
        <div className="mw-health" data-state={fsm.state}>
          <span>
            {fsm.state} · latch {fsm.latch}
          </span>
          <span className="mw-health__meta">{lastStates.join(" → ")}</span>
        </div>
        <p className="t-lead" style={{ fontSize: 14 }}>
          {t.confirmBody}
        </p>
        {fsm.activeTriggers.length > 0 ? (
          <div className="mw__stack">
            {fsm.activeTriggers.map((tr, i) => (
              <div key={i} className="mw-block mw-block--crit">
                <b>{tr.ruleId}</b> ({tr.level}) · {engineText(tr.message, state.lang)}
              </div>
            ))}
          </div>
        ) : null}
        <label className="t-label mw__field">
          {t.confirmBy}
          <input
            className="mw-input"
            value={by}
            onChange={(e) => setBy(e.target.value)}
            placeholder={t.confirmByPh}
            required
          />
        </label>
        <label className="t-label mw__field">
          {t.confirmReason} ({reason.trim().length}/{MIN_JUSTIFICATION_CHARS} {t.confirmMin})
          <textarea
            ref={firstRef}
            className="mw-input"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.confirmReasonPh}
            required
            minLength={MIN_JUSTIFICATION_CHARS}
          />
        </label>
        <label className="mw-toggle">
          <input
            type="checkbox"
            checked={atShelter}
            onChange={(e) => setAtShelter(e.target.checked)}
          />
          {t.confirmAtShelter}
        </label>
        <div className="mw__tools" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {t.confirmCancel}
          </button>
          <button type="submit" className="btn btn--crit btn--sm" disabled={!can}>
            {t.confirmSubmit}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================================================================== */
/* Fichas modales (mismo patrón que la ficha de misión del front)      */
/* ================================================================== */
export function DeckSheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card mw-sheet glass">
        <button
          type="button"
          className="icon-btn modal__close"
          onClick={onClose}
          aria-label="Cerrar / Close"
        >
          <svg viewBox="0 0 16 16">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <div className="mw-sheet__body" data-scroll-lock>
          {children}
        </div>
      </div>
    </div>
  );
}
