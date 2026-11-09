import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, BrainCircuit, CheckCircle2, FastForward, Pause, Play, RotateCcw, SkipForward, Square, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataBadge, Empty, Loading, Meter, Metric, Notice, PageHeader, Panel, StatusPill, btn, fmt, scoreTone } from "@/components/mission/ui";
import { activeProtocols, effectChips, optionSummary, SYSTEM_LABEL } from "@/components/mission/effects";
import { RADIATION } from "@/core/science/constants";
import { optionFeasibility } from "@/core/sim/engine";
import { compromisedReasons } from "@/core/sim/outcome";
import { reserveSols } from "@/core/sim/resources";
import type { DecisionAnalysis, SimState, SystemId } from "@/core/types";
import { dispatchMission, useMission } from "@/state/missionStore";
import { useAutoDecisionAnalysis } from "@/state/useDecisionAnalysis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/simulator")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mission Simulator — MARS // SURVIVE" }, { name: "description", content: "Sol-by-sol Mars mission simulation with seeded events and an explainable decision engine." }] }),
  component: SimulatorPage,
});

function SimulatorPage() {
  const { sim, plan, reports, activeRunId, lastError } = useMission();
  const [autoplay, setAutoplay] = useState(false);
  const { analysis, computing } = useAutoDecisionAnalysis();

  useEffect(() => {
    if (!autoplay) return;
    if (!sim || sim.status !== "running") {
      setAutoplay(false);
      return;
    }
    const timer = setInterval(() => dispatchMission({ type: "advance", sols: 1 }), 350);
    return () => clearInterval(timer);
  }, [autoplay, sim?.status]);

  if (!sim)
    return (
      <>
        <PageHeader eyebrow="Module 4 · Mission Simulator" title="Live the mission sol by sol" />
        <Panel>
          {plan ? (
            <Empty title={`Plan ready: ${plan.name}`} text={`${plan.site.name} · ${plan.crewSize} crew · ${plan.durationSols} sols · scenario ${plan.scenario}, seed ${plan.seed}.`} action={<button type="button" className={btn.primary} onClick={() => dispatchMission({ type: "startSimulation" })}><Play className="size-4" /> Start simulation</button>} />
          ) : (
            <Empty title="No mission plan yet" text="Pick a site and configure crew, power and supplies first; the simulator runs the plan you save." action={<Link to="/planner" className={btn.primary}>Open the Mission Planner</Link>} />
          )}
        </Panel>
      </>
    );

  const done = sim.status === "success" || sim.status === "compromised" || sim.status === "failed";
  const report = done ? reports.find((r) => r.id === activeRunId) : undefined;
  const reserves = reserveSols(sim);

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Mission Simulator"
        title={sim.ctx.missionName}
        description={`${sim.ctx.siteName} · ${sim.ctx.crewSize} crew · ${sim.ctx.habitat} habitat · scenario ${sim.ctx.scenario} · seed ${sim.seed}`}
        badges={
          <>
            <StatusPill status={sim.status} />
            <DataBadge type="SIMULATED" />
          </>
        }
        actions={
          <>
            <button type="button" className={btn.secondary} disabled={sim.status !== "running"} onClick={() => dispatchMission({ type: "advance", sols: 1 })}>
              <SkipForward className="size-4" /> 1 sol
            </button>
            <button type="button" className={btn.secondary} disabled={sim.status !== "running"} onClick={() => dispatchMission({ type: "advance", sols: 10 })}>
              <FastForward className="size-4" /> 10 sols
            </button>
            <button type="button" className={btn.secondary} disabled={sim.status !== "running"} onClick={() => dispatchMission({ type: "advance", sols: sim.durationSols })}>
              Run to next event
            </button>
            <button type="button" className={btn.primary} disabled={sim.status !== "running"} onClick={() => setAutoplay((a) => !a)}>
              {autoplay ? <Pause className="size-4" /> : <Play className="size-4" />} {autoplay ? "Pause" : "Auto-play"}
            </button>
            <button type="button" className={btn.ghost} onClick={() => (setAutoplay(false), dispatchMission({ type: "startSimulation" }))} title="Restart this plan from sol 0 (same seed)">
              <RotateCcw className="size-3.5" /> Restart
            </button>
            <button type="button" className={btn.ghost} onClick={() => (setAutoplay(false), dispatchMission({ type: "abortSimulation" }))}>
              <Square className="size-3.5" /> Abort
            </button>
          </>
        }
      />
      {lastError ? (
        <Notice tone="bad" className="mb-4">
          {lastError}
        </Notice>
      ) : null}

      <div className="mb-4">
        <Meter label={`Sol ${sim.sol} of ${sim.durationSols}`} value={sim.sol} max={sim.durationSols} tone="info" detail={`${Math.round((sim.sol / sim.durationSols) * 100)} %`} />
      </div>

      {sim.status === "awaiting-decision" && sim.pending ? <EventPanel sim={sim} analysis={analysis} computing={computing} /> : null}
      {done ? <OutcomePanel sim={sim} keyFactors={report?.keyFactors ?? []} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Panel eyebrow="Consumables & crew" title="Mission status" actions={<DataBadge type="SIMULATED" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <Metric label="Oxygen" value={fmt.n(sim.resources.oxygenKg)} unit="kg" tone={reserves.oxygen < 5 ? "bad" : reserves.oxygen < 10 ? "warn" : "default"} hint={`${reserves.oxygen.toFixed(1)} sols (no regen)`} />
            <Metric label="Water" value={fmt.n(sim.resources.waterKg)} unit="kg" tone={reserves.water < 5 ? "bad" : reserves.water < 10 ? "warn" : "default"} hint={`${reserves.water.toFixed(1)} sols (degraded loop)`} />
            <Metric label="Food" value={fmt.n(sim.resources.foodCrewDays)} unit="crew-days" hint={`${reserves.food.toFixed(0)} sols`} />
            <Metric label="Battery" value={fmt.n(sim.resources.batteryKWh)} unit={`/ ${fmt.n(sim.ctx.capacities.batteryKWh)} kWh`} />
            <Metric label="Crew health" value={Math.round(sim.crew.health)} unit="%" tone={scoreTone(sim.crew.health)} />
            <Metric label="Morale" value={Math.round(sim.crew.morale)} unit="%" tone={scoreTone(sim.crew.morale)} />
            <Metric label="Habitat temp." value={sim.habitatTempC.toFixed(1)} unit="°C" tone={sim.habitatTempC < 10 ? "bad" : sim.habitatTempC < 17 ? "warn" : "good"} />
            <Metric label="Crew dose" value={sim.crew.doseMsv.toFixed(1)} unit="mSv" hint={`${((sim.crew.doseMsv / RADIATION.careerLimitMsv) * 100).toFixed(0)} % of ${RADIATION.careerLimitMsv} mSv career limit`} />
            <Metric label="Science" value={sim.science.toFixed(1)} unit={`/ ${sim.scienceTarget}`} tone={sim.science >= sim.scienceTarget ? "good" : "default"} />
            <Metric label="Spare parts" value={sim.resources.spareParts} />
            <Metric label="Panels clean" value={Math.round(sim.panelCleanliness * 100)} unit="%" />
            <Metric label="EVA hours" value={sim.evaHours.toFixed(0)} unit="h" />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel eyebrow="Infrastructure" title="Systems health">
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(sim.systems) as SystemId[]).map((id) => (
                <Meter key={id} label={SYSTEM_LABEL[id]} value={sim.systems[id]} detail={`${Math.round(sim.systems[id])} %`} />
              ))}
            </div>
          </Panel>
          <Panel eyebrow={`Sol ${sim.sol} · modelled environment`} title="Today on Mars" actions={<DataBadge type="MODELLED" />}>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Ls" value={`${sim.env.ls.toFixed(0)}°`} />
              <Metric label="Dust opacity" value={sim.env.tau.toFixed(2)} tone={sim.env.tau >= 3 ? "bad" : sim.env.tau >= 1.5 ? "warn" : "default"} />
              <Metric label="Insolation" value={fmt.n(sim.env.insolationWm2)} unit="W/m²" />
              <Metric label="Air temp." value={`${fmt.n(sim.env.tempMinC)}…${fmt.n(sim.env.tempMaxC)}`} unit="°C" />
              <Metric label="Pressure" value={fmt.n(sim.env.pressurePa)} unit="Pa" />
              <Metric label="Dose rate" value={sim.env.doseRateMsv.toFixed(2)} unit="mSv/sol" tone={sim.env.sepActive ? "bad" : "default"} hint={sim.env.sepActive ? "SEP active" : sim.env.commsUp ? "Comms up" : "Comms down"} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <HistoryCharts sim={sim} />
        <ProtocolMonitor sim={sim} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <MissionLog sim={sim} />
        <Panel eyebrow="Ongoing effects" title={`${sim.effects.length} active`}>
          {sim.effects.length ? (
            <ul className="space-y-1.5">
              {sim.effects.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-line/70 px-2.5 py-1.5 text-[12px]">
                  <span className="text-bright">{e.label}</span>
                  <span className="font-mono text-[10.5px] text-fog">{e.remainingSols} sols left</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-fog">No ongoing event or action effects.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

function EventPanel({ sim, analysis, computing }: { sim: SimState; analysis: DecisionAnalysis | null; computing: boolean }) {
  const event = sim.pending!;
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [event.id]);
  const evalById = useMemo(() => new Map(analysis?.alternatives.map((a) => [a.optionId, a]) ?? []), [analysis]);
  return (
    <section className="mb-4 rounded-2xl border border-amber/40 bg-amber/[.06] p-4 shadow-[0_0_0_1px_rgba(245,158,11,.08)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-amber">
            <AlertTriangle className="size-3.5" /> Sol {event.sol} · event · severity {event.severity}/3
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-bright">{event.title}</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-fog">{event.description}</p>
          {event.eventEffect ? <p className="mt-1 text-[12px] text-amber">Ongoing: {event.eventEffect.label} for {event.eventEffect.sols} sols unless an action ends it.</p> : null}
        </div>
        <div className="shrink-0 rounded-xl border border-line bg-panel/80 px-3 py-2 text-[12px]">
          {computing || !analysis ? (
            <Loading text="Decision engine evaluating options…" />
          ) : (
            <div>
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">
                <BrainCircuit className="size-3.5 text-cyan" /> Engine recommends ({analysis.posture})
              </p>
              <p className="mt-0.5 font-display text-[14px] font-semibold text-cyan">{analysis.alternatives.find((a) => a.optionId === analysis.recommendedId)?.label}</p>
              <Link to="/decisions" className="font-mono text-[10.5px] text-amber hover:underline">
                Full analysis →
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-2 2xl:grid-cols-4">
        {event.options.map((option) => {
          const feas = optionFeasibility(sim, option);
          const ev = evalById.get(option.id);
          const recommended = analysis?.recommendedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={!feas.feasible}
              onClick={() => setSelected(option.id)}
              className={cn(
                "flex flex-col rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                selected === option.id ? "border-amber bg-amber/10" : recommended ? "border-cyan/50 bg-cyan/[.05]" : "border-line bg-panel/70 hover:border-amber/40",
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-display text-[14px] font-semibold text-bright">{option.label}</span>
                {recommended ? <Star className="size-4 shrink-0 fill-cyan text-cyan" aria-label="Recommended" /> : null}
              </span>
              <span className="mt-1 text-[11.5px] leading-snug text-fog">{option.summary}</span>
              <span className="mt-2 flex flex-wrap gap-1">
                {effectChips(option.immediate).map((c) => (
                  <span key={c.text} className={cn("rounded-full border px-1.5 py-0.5 font-mono text-[9.5px]", c.good ? "border-mint/30 text-mint" : "border-rose/30 text-rose")}>
                    {c.text}
                  </span>
                ))}
              </span>
              {optionSummary(option).map((s) => (
                <span key={s} className="mt-1 text-[10.5px] text-amber">
                  • {s}
                </span>
              ))}
              {!feas.feasible ? <span className="mt-1 text-[10.5px] text-rose">Not possible: {feas.reasons.join("; ")}</span> : null}
              {ev ? (
                <span className="mt-2 grid grid-cols-3 gap-1 border-t border-line/60 pt-2 font-mono text-[9.5px] text-fog">
                  <span>score {ev.feasible ? ev.score.toFixed(2) : "—"}</span>
                  <span>survival {fmt.pct(ev.metrics.survivalProbability)}</span>
                  <span>min res. {ev.metrics.minReserveSols.toFixed(0)} sols</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btn.primary} disabled={!selected} onClick={() => selected && dispatchMission({ type: "choose", optionId: selected })}>
          <CheckCircle2 className="size-4" /> Confirm decision{selected ? `: ${event.options.find((o) => o.id === selected)?.label}` : ""}
        </button>
        {analysis && selected && selected !== analysis.recommendedId ? <span className="text-[11.5px] text-amber">You are overriding the engine's recommendation; that will be recorded in the report.</span> : null}
      </div>
    </section>
  );
}

function OutcomePanel({ sim, keyFactors }: { sim: SimState; keyFactors: string[] }) {
  const tone = sim.status === "success" ? "border-mint/40 bg-mint/[.06]" : sim.status === "compromised" ? "border-amber/40 bg-amber/[.06]" : "border-rose/40 bg-rose/[.06]";
  return (
    <section className={cn("mb-4 rounded-2xl border p-4", tone)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-fog">Mission ended · sol {sim.sol}</p>
          <h2 className="mt-1 font-display text-2xl font-bold">{sim.status === "success" ? "Mission successful" : sim.status === "compromised" ? "Mission completed — compromised" : "Mission failed"}</h2>
          {sim.failureCause ? <p className="mt-1 text-[13px] text-rose">{sim.failureCause}</p> : null}
          {sim.status === "compromised" ? (
            <ul className="mt-1 space-y-0.5 text-[12.5px] text-amber">
              {compromisedReasons(sim).map((r) => (
                <li key={r}>⚠ {r}</li>
              ))}
            </ul>
          ) : null}
          <ul className="mt-2 space-y-0.5 text-[12px] text-fog">
            {keyFactors.slice(0, 5).map((k) => (
              <li key={k}>• {k}</li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          <Link to="/reports" className={btn.primary}>
            Open the mission report
          </Link>
          <Link to="/planner" className={btn.secondary}>
            Re-plan
          </Link>
        </div>
      </div>
    </section>
  );
}

type ChartTab = "reserves" | "crew" | "power" | "dose";

function HistoryCharts({ sim }: { sim: SimState }) {
  const [tab, setTab] = useState<ChartTab>("reserves");
  const data = sim.history;
  const lines: Record<ChartTab, Array<{ key: keyof (typeof data)[number]; name: string; color: string; axis?: "right" }>> = {
    reserves: [
      { key: "oxygenKg", name: "O₂ (kg)", color: "var(--cyan)" },
      { key: "waterKg", name: "Water (kg)", color: "#60a5fa" },
      { key: "foodCrewDays", name: "Food (crew-days)", color: "var(--amber)" },
    ],
    crew: [
      { key: "health", name: "Health (%)", color: "var(--mint)" },
      { key: "morale", name: "Morale (%)", color: "var(--amber)" },
      { key: "systemsMin", name: "Weakest system (%)", color: "var(--rose)" },
      { key: "integrity", name: "Habitat integrity (%)", color: "#a78bfa" },
    ],
    power: [
      { key: "batteryKWh", name: "Battery (kWh)", color: "var(--amber)" },
      { key: "energyBalanceKWh", name: "Energy balance (kWh/sol)", color: "var(--cyan)" },
      { key: "tau", name: "Dust τ", color: "var(--rose)", axis: "right" },
      { key: "habitatTempC", name: "Habitat °C", color: "var(--mint)", axis: "right" },
    ],
    dose: [
      { key: "doseMsv", name: "Cumulative dose (mSv)", color: "var(--rose)" },
      { key: "science", name: "Science", color: "var(--cyan)", axis: "right" },
    ],
  };
  return (
    <Panel
      eyebrow={`${data.length} sols recorded`}
      title="Mission history"
      actions={
        <div className="flex rounded-lg border border-line p-0.5">
          {(["reserves", "crew", "power", "dose"] as ChartTab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-2 py-1 font-mono text-[10px] capitalize", tab === t ? "bg-amber/15 text-amber" : "text-fog")}>
              {t}
            </button>
          ))}
        </div>
      }
    >
      {data.length < 2 ? (
        <p className="text-[12px] text-fog">Advance a few sols to see the trends.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
              <XAxis dataKey="sol" tick={{ fontSize: 10, fill: "var(--fog)" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--fog)" }} width={48} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--fog)" }} width={36} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }} labelFormatter={(s) => `Sol ${s}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {tab === "dose" ? <ReferenceLine yAxisId="left" y={RADIATION.careerLimitMsv} stroke="var(--rose)" strokeDasharray="4 4" label={{ value: "career limit", fontSize: 9, fill: "var(--rose)" }} /> : null}
              {sim.decisions.map((d) => (
                <ReferenceLine key={`${d.sol}-${d.optionId}`} yAxisId="left" x={d.sol} stroke="var(--amber)" strokeOpacity={0.35} />
              ))}
              {lines[tab].map((l) => (
                <Line key={l.key} yAxisId={l.axis ?? "left"} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} dot={false} strokeWidth={1.7} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-1 font-mono text-[9.5px] text-fog">Vertical amber lines mark decisions.</p>
    </Panel>
  );
}

function ProtocolMonitor({ sim }: { sim: SimState }) {
  const ended = sim.status === "success" || sim.status === "compromised" || sim.status === "failed";
  const alerts = ended ? [] : activeProtocols(sim);
  return (
    <Panel eyebrow="Rule-based · from the simulated state" title="Live protocols" actions={<Link to="/protocols" className={btn.ghost}>Reference</Link>}>
      {ended ? (
        <p className="text-[12px] text-fog">Mission ended: protocols are no longer monitored.</p>
      ) : !alerts.length ? (
        <Notice tone="good">All nominal: no survival protocol triggered.</Notice>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className={cn("rounded-xl border px-3 py-2", a.level === "danger" ? "border-rose/40 bg-rose/[.06]" : "border-amber/35 bg-amber/[.05]")}>
              <p className={cn("text-[12.5px] font-semibold", a.level === "danger" ? "text-rose" : "text-amber")}>{a.title}</p>
              <p className="text-[11.5px] leading-snug text-fog">{a.action}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const LOG_STYLE: Record<string, string> = { info: "text-fog", event: "text-amber", decision: "text-cyan", warning: "text-amber", critical: "text-rose", success: "text-mint" };

function MissionLog({ sim }: { sim: SimState }) {
  const entries = sim.log.slice(-120).reverse();
  return (
    <Panel eyebrow={`${sim.log.length} entries`} title="Mission log">
      <ol className="max-h-80 space-y-1 overflow-y-auto pr-1 font-mono text-[11px]">
        {entries.map((entry, i) => (
          <li key={`${entry.sol}-${i}`} className="flex gap-3">
            <span className="w-14 shrink-0 text-fog/70">sol {entry.sol}</span>
            <span className={LOG_STYLE[entry.kind] ?? "text-fog"}>{entry.text}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
