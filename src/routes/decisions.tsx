import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuit, CheckCircle2, FlaskConical, MessageSquareText, ShieldAlert, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataBadge, Empty, Loading, Metric, Notice, PageHeader, Panel, btn, fmt } from "@/components/mission/ui";
import { CRITERIA, criterionLabel } from "@/core/decision/criteria";
import { analyzeDecision } from "@/core/decision/engine";
import { createInitialState, injectEvent } from "@/core/sim/engine";
import { EVENT_BASE_PROBABILITY } from "@/core/sim/config";
import { eventLabel } from "@/core/sim/events";
import { makePlan } from "@/core/sim/fixtures";
import type { CriterionId, DecisionAnalysis, EventType, RiskPosture, SimState } from "@/core/types";
import { findCatalogueSite } from "@/data/sites";
import { analyzeSite, useGrid } from "@/services/analysis";
import { dispatchMission, useMission } from "@/state/missionStore";
import { useAutoDecisionAnalysis } from "@/state/useDecisionAnalysis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/decisions")({
  ssr: false,
  head: () => ({ meta: [{ title: "Decision Intelligence — MARS // SURVIVE" }, { name: "description", content: "Deterministic, explainable decision engine: rules, Monte-Carlo look-ahead and multi-criteria analysis." }] }),
  component: DecisionsPage,
});

const CRITERION_COLOR: Record<CriterionId, string> = { survival: "#34d399", reserves: "#38bdf8", health: "#a3e635", morale: "#f472b6", cost: "#94a3b8", science: "#a78bfa", risk: "#f59e0b" };
const POSTURES: RiskPosture[] = ["conservative", "balanced", "aggressive"];

function DecisionsPage() {
  const sim = useMission((s) => s.sim);
  const { analysis, computing } = useAutoDecisionAnalysis();
  const pending = sim?.status === "awaiting-decision" && sim.pending;
  return (
    <>
      <PageHeader
        eyebrow="Module 5 · Decision Intelligence"
        title="Explainable mission decisions"
        description="Every recommendation comes from a deterministic engine: safety rules (vetoes, penalties, bonuses), a seeded Monte-Carlo look-ahead with common random numbers, and a weighted multi-criteria score. The same state and posture always produce the same answer. An optional LLM can narrate the result, but it never changes the decision or the data."
        badges={
          <>
            <DataBadge type="SIMULATED" />
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[.12em] text-fog">Deterministic · reproducible</span>
          </>
        }
      />
      {pending ? computing || !analysis ? <Panel><Loading text="Evaluating every option over the look-ahead horizon…" /></Panel> : <LiveDecision sim={sim} missionAnalysis={analysis} /> : null}
      {!pending ? <NoPending sim={sim} /> : null}
      <MethodPanel />
    </>
  );
}

function LiveDecision({ sim, missionAnalysis }: { sim: SimState; missionAnalysis: DecisionAnalysis }) {
  const [posture, setPosture] = useState<RiskPosture>(missionAnalysis.posture);
  const analysis = useMemo(() => (posture === missionAnalysis.posture ? missionAnalysis : analyzeDecision(sim, { posture })), [posture, missionAnalysis, sim]);
  return (
    <>
      <Notice tone="warn" className="mb-4">
        Decision pending on sol {sim.sol}: <span className="font-semibold text-bright">{sim.pending!.title}</span>. Choose here or in the{" "}
        <Link to="/simulator" className="underline">
          simulator
        </Link>
        .
      </Notice>
      <AnalysisView analysis={analysis} posture={posture} onPosture={setPosture} missionPosture={missionAnalysis.posture} onChoose={(id) => dispatchMission({ type: "choose", optionId: id })} />
    </>
  );
}

function NoPending({ sim }: { sim: SimState | null }) {
  return (
    <div className="space-y-4">
      {sim && sim.decisions.length ? <DecisionHistory sim={sim} /> : <Panel><Empty icon={<BrainCircuit className="size-6" />} title="No decision pending" text="When an event interrupts the simulation, the engine evaluates every option here. Meanwhile, try the sandbox below." action={<Link to="/simulator" className={btn.secondary}>Open the simulator</Link>} /></Panel>}
      <Sandbox sim={sim} />
    </div>
  );
}

function DecisionHistory({ sim }: { sim: SimState }) {
  const followed = sim.decisions.filter((d) => d.followedRecommendation === true).length;
  const judged = sim.decisions.filter((d) => d.followedRecommendation !== null).length;
  return (
    <Panel eyebrow={`${sim.ctx.missionName} · ${sim.decisions.length} decisions`} title="Decision history" actions={judged ? <span className="font-mono text-[10.5px] text-fog">followed the engine {followed}/{judged}</span> : null}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead>
            <tr className="border-b border-line/60 text-left font-mono text-[9.5px] uppercase tracking-[.12em] text-fog">
              <th className="py-1.5">Sol</th>
              <th>Event</th>
              <th>Decision</th>
              <th>Engine</th>
              <th>Complication</th>
            </tr>
          </thead>
          <tbody>
            {sim.decisions.map((d) => (
              <tr key={`${d.sol}-${d.optionId}`} className="border-b border-line/40">
                <td className="py-1.5 font-mono text-fog">{d.sol}</td>
                <td className="text-bright">{d.eventTitle}</td>
                <td>{d.optionLabel}</td>
                <td className={d.followedRecommendation === true ? "text-mint" : d.followedRecommendation === false ? "text-amber" : "text-fog"}>{d.followedRecommendation === null ? "not consulted" : d.followedRecommendation ? "followed" : "overridden"}</td>
                <td className={d.complication ? "text-rose" : "text-fog"}>{d.complication ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const EVENT_TYPES = Object.keys(EVENT_BASE_PROBABILITY) as EventType[];

function Sandbox({ sim }: { sim: SimState | null }) {
  const { grid } = useGrid();
  const { plan, selectedSite } = useMission();
  const [type, setType] = useState<EventType>("dustStorm");
  const [severity, setSeverity] = useState<1 | 2 | 3>(2);
  const [posture, setPosture] = useState<RiskPosture>("balanced");
  const base = useMemo(() => {
    if (sim && sim.status === "running") return { state: sim, label: `your running mission (sol ${sim.sol})` };
    if (plan) return { state: createInitialState(plan), label: `your plan “${plan.name}” at sol 0` };
    const site = selectedSite ?? findCatalogueSite("jezero")!;
    const a = analyzeSite(site, grid);
    return { state: createInitialState(makePlan({ site: a.site, environment: a.environment, name: `Reference mission — ${site.name}` })), label: `a reference mission at ${site.name} (4 crew, 60 sols)` };
  }, [sim, plan, selectedSite, grid]);
  const analysis = useMemo(() => analyzeDecision(injectEvent(base.state, type, severity), { posture }), [base, type, severity, posture]);
  return (
    <section className="rounded-2xl border border-cyan/25 bg-cyan/[.03] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-cyan">
            <FlaskConical className="size-3.5" /> Decision sandbox · simulated scenario
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">What would the engine do?</h2>
          <p className="mt-1 text-[12.5px] text-fog">Injects an event into {base.label} without touching the mission. Try the dust storm: stay in the habitat, move to a protected zone, repair the panels, or reduce consumption.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="mission-input h-9 rounded-lg px-2 text-[12.5px]" value={type} onChange={(e) => setType(e.target.value as EventType)} aria-label="Event type">
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {eventLabel(t)}
              </option>
            ))}
          </select>
          <select className="mission-input h-9 rounded-lg px-2 text-[12.5px]" value={severity} onChange={(e) => setSeverity(Number(e.target.value) as 1 | 2 | 3)} aria-label="Severity">
            <option value={1}>Severity 1 — minor</option>
            <option value={2}>Severity 2 — major</option>
            <option value={3}>Severity 3 — extreme</option>
          </select>
        </div>
      </div>
      <AnalysisView analysis={analysis} posture={posture} onPosture={setPosture} />
    </section>
  );
}

function AnalysisView({ analysis, posture, onPosture, missionPosture, onChoose }: { analysis: DecisionAnalysis; posture: RiskPosture; onPosture: (p: RiskPosture) => void; missionPosture?: RiskPosture; onChoose?: (optionId: string) => void }) {
  const [selected, setSelected] = useState<string>(analysis.recommendedId);
  const [metric, setMetric] = useState<"oxygenSols" | "waterSols" | "batteryKWh" | "health">("oxygenSols");
  const recommended = analysis.alternatives.find((a) => a.optionId === analysis.recommendedId)!;
  const current = analysis.alternatives.find((a) => a.optionId === selected) ?? recommended;
  const ranked = [...analysis.alternatives].sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.score - a.score);

  const contributionData = ranked.map((a) => ({ name: a.label.length > 26 ? `${a.label.slice(0, 25)}…` : a.label, ...a.contributions, rules: a.ruleAdjustment }));
  const sols = analysis.alternatives[0]?.trajectory.map((p) => p.sol) ?? [];
  const trajectoryData = sols.map((sol, i) => Object.fromEntries([["sol", sol], ...analysis.alternatives.map((a) => [a.optionId, a.trajectory[i]?.[metric] ?? null])]));
  const palette = ["#f59e0b", "#38bdf8", "#34d399", "#f472b6", "#a78bfa", "#94a3b8"];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <Panel eyebrow={`Sol ${analysis.sol} · ${analysis.eventTitle}`} title={<span className="flex items-center gap-2"><Star className="size-4 fill-cyan text-cyan" /> Recommended: {recommended.label}</span>} actions={<DataBadge type="SIMULATED" />}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-fog">Posture</span>
            {POSTURES.map((p) => (
              <button key={p} type="button" onClick={() => onPosture(p)} className={cn("rounded-lg border px-2.5 py-1 text-[11.5px] capitalize", p === posture ? "border-amber/50 bg-amber/10 text-amber" : "border-line text-fog hover:text-bright")}>
                {p}
                {missionPosture === p ? " (mission)" : ""}
              </button>
            ))}
          </div>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-bright/90">
            {analysis.rationale.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
          {analysis.risks.length ? (
            <div className="mt-3 space-y-1">
              {analysis.risks.map((r) => (
                <p key={r.text} className={cn("flex items-start gap-1.5 text-[11.5px]", r.level === "danger" ? "text-rose" : r.level === "caution" ? "text-amber" : "text-cyan")}>
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> {r.text}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-3 font-mono text-[9.5px] text-fog">
            {analysis.samples} futures × {analysis.horizonSols} sols per option · key {analysis.deterministicKey}
          </p>
          <Narrative analysis={analysis} />
        </Panel>

        <Panel eyebrow="Weighted criteria + rule adjustment" title="Why this score">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contributionData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--fog)" }} domain={[0, "auto"]} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "var(--fog)" }} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }} formatter={(v: number, name: string) => [v.toFixed(3), name === "rules" ? "Rule adjustment" : criterionLabel(name as CriterionId)]} />
                <Legend wrapperStyle={{ fontSize: 10 }} formatter={(name: string) => (name === "rules" ? "Rules" : criterionLabel(name as CriterionId))} />
                {CRITERIA.map((c) => (
                  <Bar key={c.id} dataKey={c.id} stackId="s" fill={CRITERION_COLOR[c.id]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CRITERIA.map((c) => (
              <span key={c.id} className="rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] text-fog" title={c.description}>
                {c.label} {(analysis.weights[c.id] * 100).toFixed(0)} %
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel eyebrow="All options" title="Alternatives compared">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12px]">
            <thead>
              <tr className="border-b border-line/60 text-left font-mono text-[9.5px] uppercase tracking-[.12em] text-fog">
                <th className="py-1.5">Option</th>
                <th>Score</th>
                <th>Survival</th>
                <th>Min reserve</th>
                <th>Health</th>
                <th>Cost</th>
                <th>Science Δ</th>
                <th>Risk</th>
                <th>Complication</th>
                <th>Rules</th>
                {onChoose ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {ranked.map((a) => (
                <tr key={a.optionId} onClick={() => setSelected(a.optionId)} className={cn("cursor-pointer border-b border-line/40", a.optionId === current.optionId && "bg-amber/[.06]", !a.feasible && "opacity-55")}>
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-1.5 font-medium text-bright">
                      {a.optionId === analysis.recommendedId ? <Star className="size-3.5 fill-cyan text-cyan" /> : null}
                      {a.label}
                    </span>
                    {!a.feasible ? <span className="text-[10.5px] text-rose">not feasible</span> : null}
                  </td>
                  <td className="font-mono">{a.feasible ? a.score.toFixed(3) : "—"}</td>
                  <td className="font-mono">{fmt.pct(a.metrics.survivalProbability)}</td>
                  <td className="font-mono">{a.metrics.minReserveSols.toFixed(1)} sols</td>
                  <td className="font-mono">{a.metrics.expectedHealth.toFixed(0)} %</td>
                  <td className="font-mono">{a.metrics.resourceCost.toFixed(1)}</td>
                  <td className="font-mono">{a.metrics.scienceDelta.toFixed(1)}</td>
                  <td className="font-mono">{a.metrics.riskIndex.toFixed(2)}</td>
                  <td className="font-mono">{fmt.pct(a.metrics.complicationProbability)}</td>
                  <td className="font-mono text-[10.5px]">
                    {a.rules.filter((r) => r.effect !== "note").map((r) => (
                      <span key={r.ruleId} className={cn("mr-1", r.effect === "veto" ? "text-rose" : r.effect === "penalty" ? "text-amber" : "text-mint")}>
                        {r.effect === "veto" ? "✕" : r.effect === "penalty" ? "−" : "+"}
                        {r.ruleId}
                      </span>
                    ))}
                  </td>
                  {onChoose ? (
                    <td>
                      <button
                        type="button"
                        disabled={!a.feasible}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChoose(a.optionId);
                        }}
                        className={cn(btn.ghost, "border border-line")}
                      >
                        <CheckCircle2 className="size-3.5" /> Choose
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          eyebrow="Median of the Monte-Carlo futures"
          title="Projected trajectories"
          actions={
            <select className="mission-input h-8 rounded-lg px-2 text-[11.5px]" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} aria-label="Trajectory metric">
              <option value="oxygenSols">O₂ reserve (sols)</option>
              <option value="waterSols">Water reserve (sols)</option>
              <option value="batteryKWh">Battery (kWh)</option>
              <option value="health">Crew health (%)</option>
            </select>
          }
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectoryData} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
                <XAxis dataKey="sol" tick={{ fontSize: 10, fill: "var(--fog)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--fog)" }} width={44} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }} labelFormatter={(s) => `Sol ${s}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {analysis.alternatives.map((a, i) => (
                  <Line key={a.optionId} dataKey={a.optionId} name={a.label} stroke={palette[i % palette.length]} strokeWidth={a.optionId === current.optionId ? 2.6 : 1.3} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel eyebrow="Selected option" title={current.label}>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Survival" value={fmt.pct(current.metrics.survivalProbability)} tone={current.metrics.survivalProbability >= 0.95 ? "good" : current.metrics.survivalProbability >= 0.8 ? "warn" : "bad"} />
            <Metric label="Min reserve" value={current.metrics.minReserveSols.toFixed(1)} unit="sols" />
            <Metric label="Morale" value={current.metrics.expectedMorale.toFixed(0)} unit="%" />
          </div>
          <p className="mb-1 mt-3 font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">Consequences</p>
          <ul className="space-y-1 text-[12px] text-bright/90">
            {current.consequences.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
          <p className="mb-1 mt-3 font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">Rules triggered</p>
          <ul className="space-y-1 text-[11.5px]">
            {current.rules.length ? (
              current.rules.map((r) => (
                <li key={r.ruleId} className={r.effect === "veto" ? "text-rose" : r.effect === "penalty" ? "text-amber" : r.effect === "bonus" ? "text-mint" : "text-fog"}>
                  [{r.effect}
                  {r.weight ? ` ${r.weight > 0 ? "+" : ""}${r.weight.toFixed(2)}` : ""}] {r.message}
                </li>
              ))
            ) : (
              <li className="text-fog">None.</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Narrative({ analysis }: { analysis: DecisionAnalysis }) {
  const [state, setState] = useState<{ key: string; text: string; mode: string } | { key: string; error: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const current = state && state.key === analysis.deterministicKey ? state : null;
  const run = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mars-advisor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "narrate", analysis }) });
      const data = (await response.json()) as { answer?: string; mode?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error ?? `HTTP ${response.status}`);
      setState({ key: analysis.deterministicKey, text: data.answer, mode: data.mode ?? "fallback" });
    } catch (error) {
      setState({ key: analysis.deterministicKey, error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-line/70 bg-ink2/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">
          <MessageSquareText className="size-3.5" /> Plain-language briefing
        </p>
        <button type="button" className={btn.ghost} onClick={run} disabled={loading}>
          {loading ? "Writing…" : current ? "Regenerate" : "Generate"}
        </button>
      </div>
      {current && "text" in current ? (
        <>
          <p className="mt-2 text-[12.5px] leading-relaxed text-bright/90">{current.text}</p>
          <p className="mt-1 font-mono text-[9.5px] text-fog">{current.mode === "gemini" ? "LLM narration (Gemini, server-side): explanatory only. The numbers and the decision come from the deterministic engine." : "Deterministic narration (no LLM key configured)."}</p>
        </>
      ) : current && "error" in current ? (
        <p className="mt-2 text-[11.5px] text-rose">Briefing unavailable: {current.error}</p>
      ) : (
        <p className="mt-2 text-[11.5px] text-fog">Optional. Rephrases this analysis for the crew; it cannot change the decision.</p>
      )}
    </div>
  );
}

function MethodPanel() {
  return (
    <Panel className="mt-4" eyebrow="Method" title="How the engine decides">
      <ol className="grid gap-3 text-[12px] leading-relaxed text-fog md:grid-cols-2 xl:grid-cols-4">
        <li>
          <span className="font-semibold text-bright">1 · Feasibility.</span> Options needing unavailable systems, spare parts, comms or a safe EVA window are excluded.
        </li>
        <li>
          <span className="font-semibold text-bright">2 · Rules.</span> Safety rules veto unsafe options (e.g. EVA during a solar particle event) or add penalties and bonuses (low O₂ reserve, dust optical depth, crew health).
        </li>
        <li>
          <span className="font-semibold text-bright">3 · Look-ahead.</span> Each option is simulated over the horizon on many seeded futures with common random numbers, using the same physical model as the simulator.
        </li>
        <li>
          <span className="font-semibold text-bright">4 · Multi-criteria score.</span> Survival, reserves, health, morale, cost, science and risk are normalised and weighted by the mission's risk posture; rule adjustments are added. The highest feasible score wins; ties go to the higher survival probability, then the option id.
        </li>
      </ol>
      <p className="mt-3 text-[11px] text-fog">
        Full specification: docs/DECISION_ENGINE.md. Source: <code>src/core/decision</code> (unit-tested).
      </p>
    </Panel>
  );
}
