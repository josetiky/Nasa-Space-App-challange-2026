import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Footprints, Play, Save, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { DataBadge, Empty, Meter, Metric, Notice, PageHeader, Panel, btn, fmt } from "@/components/mission/ui";
import { SurvivalSimulator } from "@/components/SurvivalSimulator";
import { MARS, POWER } from "@/core/science/constants";
import { marsTimeFromDate } from "@/core/science/marsTime";
import { EVENT_BASE_PROBABILITY, SCENARIOS } from "@/core/sim/config";
import { createInitialState } from "@/core/sim/engine";
import { eventLabel } from "@/core/sim/events";
import { feasibilityPreview, sizeSupplies, type FeasibilityPreview } from "@/core/sim/planning";
import { combineMods, demandKw } from "@/core/sim/resources";
import type { EventType, HabitatType, MissionPlan, PowerSource, RiskPosture, ScenarioId } from "@/core/types";
import { CATALOGUE_SITES } from "@/data/sites";
import { analyzeSite, useGrid } from "@/services/analysis";
import { dispatchMission, useMission } from "@/state/missionStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mission Planner — MARS // SURVIVE" }, { name: "description", content: "Configure crew, habitat, power, supplies, ISRU and EVAs, validated against NASA consumption rates." }] }),
  component: PlannerPage,
});

const PlanSchema = z.object({
  name: z.string().trim().min(3, "Name needs at least 3 characters").max(60),
  objective: z.string().trim().max(240),
  durationSols: z.number().int().min(7, "At least 7 sols").max(669, "At most one Mars year (669 sols)"),
  crewSize: z.number().int().min(1).max(8, "Up to 8 crew"),
  habitat: z.enum(["surface", "regolith", "lavaTube"]),
  power: z
    .object({
      source: z.enum(["solar", "fission", "hybrid"]),
      solarAreaM2: z.number().min(0).max(5000),
      fissionUnits: z.number().int().min(0).max(6),
      batteryKWh: z.number().min(10, "Battery of at least 10 kWh").max(5000),
    })
    .refine((p) => (p.source === "solar" ? p.solarAreaM2 > 0 : p.source === "fission" ? p.fissionUnits > 0 : p.solarAreaM2 > 0 && p.fissionUnits > 0), { message: "The chosen power source needs matching hardware (panel area and/or fission units)." }),
  supplies: z.object({
    oxygenKg: z.number().min(0).max(50000),
    waterKg: z.number().min(0).max(100000),
    foodCrewDays: z.number().min(0).max(20000),
    spareParts: z.number().int().min(0).max(200),
  }),
  isru: z.object({ oxygenKgPerSol: z.number().min(0).max(50), waterKgPerSol: z.number().min(0).max(200) }),
  evaEverySols: z.number().int().min(0).max(60),
  attachEva: z.boolean(),
  riskPosture: z.enum(["conservative", "balanced", "aggressive"]),
  scenario: z.enum(["nominal", "dust-season", "harsh", "training"]),
  eventMultipliers: z.record(z.string(), z.number().min(0).max(5)),
  seed: z.number().int().min(0).max(2 ** 31 - 1),
});
type Draft = z.infer<typeof PlanSchema>;

const EVENT_TYPES = Object.keys(EVENT_BASE_PROBABILITY) as EventType[];

function defaultDraft(siteName: string): Draft {
  return {
    name: `Ares — ${siteName}`,
    objective: "Establish a habitat, prospect for water and return samples safely.",
    durationSols: 60,
    crewSize: 4,
    habitat: "regolith",
    power: { source: "hybrid", solarAreaM2: 250, fissionUnits: 1, batteryKWh: 300 },
    supplies: { oxygenKg: 0, waterKg: 0, foodCrewDays: 0, spareParts: 0 },
    isru: { oxygenKgPerSol: 2, waterKgPerSol: 8 },
    evaEverySols: 7,
    attachEva: true,
    riskPosture: "balanced",
    scenario: "nominal",
    eventMultipliers: {},
    seed: 20261003,
  };
}

function draftFromPlan(plan: MissionPlan): Draft {
  return { name: plan.name, objective: plan.objective, durationSols: plan.durationSols, crewSize: plan.crewSize, habitat: plan.habitat, power: { ...plan.power }, supplies: { ...plan.supplies }, isru: { ...plan.isru }, evaEverySols: plan.evaEverySols, attachEva: !!plan.eva, riskPosture: plan.riskPosture, scenario: plan.scenario, eventMultipliers: { ...plan.eventMultipliers } as Record<string, number>, seed: plan.seed };
}

function PlannerPage() {
  const navigate = useNavigate();
  const { grid } = useGrid();
  const store = useMission();
  const [startMsd] = useState(() => Math.floor(marsTimeFromDate(new Date()).msd));

  const analysis = useMemo(() => {
    if (!store.analysis) return null;
    return grid && store.analysis.environment.elevationSource !== "mola" ? analyzeSite(store.analysis.site, grid) : store.analysis;
  }, [store.analysis, grid]);

  const [draft, setDraft] = useState<Draft>(() => {
    if (store.plan && (!store.selectedSite || store.plan.site.id === store.selectedSite.id)) return draftFromPlan(store.plan);
    const d = defaultDraft(store.selectedSite?.name ?? "Mars");
    const s = sizeSupplies({ crewSize: d.crewSize, durationSols: d.durationSols, isru: d.isru, iceLikelihood: store.analysis?.environment.iceLikelihood ?? 0.3, evaEverySols: d.evaEverySols, evaO2Kg: store.evaPlan?.o2Kg ?? 0.8 });
    return { ...d, supplies: { oxygenKg: s.oxygenKg, waterKg: s.waterKg, foodCrewDays: s.foodCrewDays, spareParts: s.spareParts } };
  });

  const parsed = PlanSchema.safeParse(draft);
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "plan"}: ${i.message}`);

  const plan: MissionPlan | null = useMemo(() => {
    if (!parsed.success || !analysis) return null;
    const d = parsed.data;
    return {
      id: store.plan?.id ?? `plan-${Date.now().toString(36)}`,
      name: d.name,
      objective: d.objective,
      site: analysis.site,
      environment: analysis.environment,
      durationSols: d.durationSols,
      crewSize: d.crewSize,
      habitat: d.habitat as HabitatType,
      power: { ...d.power, source: d.power.source as PowerSource },
      supplies: d.supplies,
      isru: d.isru,
      eva: d.attachEva ? store.evaPlan : null,
      evaEverySols: d.evaEverySols,
      riskPosture: d.riskPosture as RiskPosture,
      scenario: d.scenario as ScenarioId,
      eventMultipliers: d.eventMultipliers as Partial<Record<EventType, number>>,
      seed: d.seed,
      startMsd,
      createdAt: new Date().toISOString(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(draft), analysis, store.evaPlan, startMsd, parsed.success]);

  // Debounced multi-seed feasibility preview (12 seeded runs with the default autopilot).
  const [preview, setPreview] = useState<{ key: string; result: FeasibilityPreview; ms: number } | null>(null);
  const previewKey = plan ? JSON.stringify({ ...plan, id: "", createdAt: "" }) : "";
  useEffect(() => {
    if (!plan) return;
    const timer = setTimeout(() => {
      const t = performance.now();
      const result = feasibilityPreview(plan, 12);
      setPreview({ key: previewKey, result, ms: Math.round(performance.now() - t) });
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const autoSize = () => {
    const s = sizeSupplies({ crewSize: draft.crewSize, durationSols: draft.durationSols, isru: draft.isru, iceLikelihood: analysis?.environment.iceLikelihood ?? 0.3, evaEverySols: draft.evaEverySols, evaO2Kg: draft.attachEva && store.evaPlan ? store.evaPlan.o2Kg : 0.8 });
    set("supplies", { oxygenKg: s.oxygenKg, waterKg: s.waterKg, foodCrewDays: s.foodCrewDays, spareParts: s.spareParts });
  };
  const sizing = sizeSupplies({ crewSize: draft.crewSize, durationSols: draft.durationSols, isru: draft.isru, iceLikelihood: analysis?.environment.iceLikelihood ?? 0.3, evaEverySols: draft.evaEverySols, evaO2Kg: draft.attachEva && store.evaPlan ? store.evaPlan.o2Kg : 0.8 });

  const save = (launch: boolean) => {
    if (!plan) return;
    dispatchMission({ type: "savePlan", plan: { ...plan, createdAt: new Date().toISOString() } });
    if (launch) {
      dispatchMission({ type: "startSimulation" });
      void navigate({ to: "/simulator" });
    }
  };

  if (!analysis)
    return (
      <>
        <PageHeader eyebrow="Module 3 · Mission Planner" title="Plan the mission" />
        <Panel>
          <Empty title="Choose a mission site first" text="Every plan is anchored to a location analysed on NASA data: its elevation, radiation, temperature, solar resource and ice proxy drive the simulation." action={<SitePicker />} />
        </Panel>
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Mission Planner"
        title="Plan the mission"
        description={
          <>
            Site <span className="text-bright">{analysis.site.name}</span> · {fmt.latLon(analysis.site.point.lat, analysis.site.point.lon)} · habitability {Math.round(analysis.scores.habitability)}/100.{" "}
            <Link to="/atlas" className="text-amber hover:underline">
              Change site
            </Link>
          </>
        }
        actions={
          <>
            <button type="button" className={btn.secondary} onClick={() => save(false)} disabled={!plan}>
              <Save className="size-4" /> Save plan
            </button>
            <button type="button" className={btn.primary} onClick={() => save(true)} disabled={!plan}>
              <Play className="size-4" /> Save &amp; launch
            </button>
          </>
        }
      />
      {store.sim && store.sim.status !== "success" && store.sim.status !== "failed" && store.sim.status !== "compromised" ? (
        <Notice tone="warn" className="mb-4">
          A simulation is in progress (sol {store.sim.sol}). Launching a new plan replaces it; its report is kept only if it has finished.
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Panel eyebrow="1" title="Mission">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mission name">
                <input className="mission-input h-9 w-full rounded-lg px-2.5 text-[13px]" value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Duration (sols)" hint="Surface stay; up to one Mars year">
                <NumberInput value={draft.durationSols} min={7} max={669} onChange={(v) => set("durationSols", v)} />
              </Field>
              <Field label="Objective" className="sm:col-span-2">
                <input className="mission-input h-9 w-full rounded-lg px-2.5 text-[13px]" value={draft.objective} onChange={(e) => set("objective", e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="2" title="Crew & habitat">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Crew size">
                <NumberInput value={draft.crewSize} min={1} max={8} onChange={(v) => set("crewSize", v)} />
              </Field>
              <Field label="Habitat" hint="Shielding: surface 10 %, regolith-covered 40 %, lava tube 70 % of the GCR dose (assumption)">
                <Segmented value={draft.habitat} onChange={(v) => set("habitat", v as Draft["habitat"])} options={[["surface", "Surface"], ["regolith", "Regolith-covered"], ["lavaTube", "Lava tube"]]} />
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="3" title="Power" actions={<DataBadge type="MODELLED" />}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Source" className="lg:col-span-4">
                <Segmented
                  value={draft.power.source}
                  onChange={(v) => {
                    const source = v as PowerSource;
                    set("power", { ...draft.power, source, solarAreaM2: source === "fission" ? 0 : draft.power.solarAreaM2 || 250, fissionUnits: source === "solar" ? 0 : Math.max(1, draft.power.fissionUnits) });
                  }}
                  options={[["solar", "Solar"], ["fission", "Fission (Kilopower-class)"], ["hybrid", "Hybrid"]]}
                />
              </Field>
              <Field label="PV area (m²)" hint="25 % efficient arrays">
                <NumberInput value={draft.power.solarAreaM2} min={0} max={5000} step={10} disabled={draft.power.source === "fission"} onChange={(v) => set("power", { ...draft.power, solarAreaM2: v })} />
              </Field>
              <Field label="Fission units" hint="10 kWe each (assumption)">
                <NumberInput value={draft.power.fissionUnits} min={0} max={6} disabled={draft.power.source === "solar"} onChange={(v) => set("power", { ...draft.power, fissionUnits: v })} />
              </Field>
              <Field label="Battery (kWh)">
                <NumberInput value={draft.power.batteryKWh} min={10} max={5000} step={10} onChange={(v) => set("power", { ...draft.power, batteryKWh: v })} />
              </Field>
            </div>
            {plan ? <EnergyBudget plan={plan} /> : null}
          </Panel>

          <Panel
            eyebrow="4"
            title="Supplies & ISRU"
            actions={
              <button type="button" className={btn.secondary} onClick={autoSize}>
                <Wand2 className="size-3.5" /> Auto-size (BVAD)
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Oxygen (kg)" hint={`Sized: ${fmt.n(sizing.oxygenKg)} kg`}>
                <NumberInput value={draft.supplies.oxygenKg} min={0} max={50000} step={10} onChange={(v) => set("supplies", { ...draft.supplies, oxygenKg: v })} />
              </Field>
              <Field label="Water (kg)" hint={`Sized: ${fmt.n(sizing.waterKg)} kg`}>
                <NumberInput value={draft.supplies.waterKg} min={0} max={100000} step={10} onChange={(v) => set("supplies", { ...draft.supplies, waterKg: v })} />
              </Field>
              <Field label="Food (crew-days)" hint={`Sized: ${fmt.n(sizing.foodCrewDays)}`}>
                <NumberInput value={draft.supplies.foodCrewDays} min={0} max={20000} step={4} onChange={(v) => set("supplies", { ...draft.supplies, foodCrewDays: v })} />
              </Field>
              <Field label="Spare parts" hint="Consumed by repairs">
                <NumberInput value={draft.supplies.spareParts} min={0} max={200} onChange={(v) => set("supplies", { ...draft.supplies, spareParts: v })} />
              </Field>
              <Field label="ISRU O₂ (kg/sol)" hint="MOXIE peaked at 12 g/h; this is a scaled plant (assumption)">
                <NumberInput value={draft.isru.oxygenKgPerSol} min={0} max={50} step={0.5} onChange={(v) => set("isru", { ...draft.isru, oxygenKgPerSol: v })} />
              </Field>
              <Field label="ISRU water (kg/sol)" hint={`Yield × ${(0.2 + 0.8 * analysis.environment.iceLikelihood).toFixed(2)} at this site (ice proxy)`}>
                <NumberInput value={draft.isru.waterKgPerSol} min={0} max={200} step={1} onChange={(v) => set("isru", { ...draft.isru, waterKgPerSol: v })} />
              </Field>
            </div>
            <ul className="mt-3 space-y-0.5 text-[11px] leading-relaxed text-fog">
              {sizing.basis.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          </Panel>

          <Panel eyebrow="5" title="EVA programme" actions={<Link to="/explorer" search={{ mode: "surface" }} className={btn.ghost}><Footprints className="size-3.5" /> Plan on terrain</Link>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="EVA every N sols" hint="0 disables scheduled EVAs; EVAs are skipped when τ ≥ 3">
                <NumberInput value={draft.evaEverySols} min={0} max={60} onChange={(v) => set("evaEverySols", v)} />
              </Field>
              <Field label="Route">
                {store.evaPlan ? (
                  <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px]">
                    <input type="checkbox" className="accent-amber" checked={draft.attachEva} onChange={(e) => set("attachEva", e.target.checked)} />
                    <span>
                      <span className="text-bright">{store.evaPlan.siteName}</span> · {fmt.n(store.evaPlan.distanceM)} m · {fmt.n(store.evaPlan.durationMin)} min · {store.evaPlan.o2Kg.toFixed(2)} kg O₂ · science {store.evaPlan.scienceValue.toFixed(1)}
                    </span>
                  </label>
                ) : (
                  <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[12px] text-fog">No EVA route saved: the simulator uses a generic 3-hour EVA. Draw one on Curiosity's terrain or pick a stretch of its 2025 boxwork path in the Explorer.</p>
                )}
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="6" title="Scenario & decision posture" actions={<DataBadge type="SIMULATED" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Scenario">
                <select className="mission-input h-9 w-full rounded-lg px-2 text-[13px]" value={draft.scenario} onChange={(e) => set("scenario", e.target.value as Draft["scenario"])}>
                  {SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {s.description}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Risk posture" hint="Weights of the decision engine's criteria">
                <Segmented value={draft.riskPosture} onChange={(v) => set("riskPosture", v as Draft["riskPosture"])} options={[["conservative", "Conservative"], ["balanced", "Balanced"], ["aggressive", "Aggressive"]]} />
              </Field>
              <Field label="Random seed" hint="Same plan + same seed = same mission (reproducible)">
                <div className="flex gap-2">
                  <NumberInput value={draft.seed} min={0} max={2 ** 31 - 1} onChange={(v) => set("seed", v)} />
                  <button type="button" className={btn.secondary} onClick={() => set("seed", Math.floor(Math.random() * 2 ** 31))}>
                    <Sparkles className="size-3.5" />
                  </button>
                </div>
              </Field>
              <Field label="Start date" hint="Today's Mars Sol Date (sets the season)">
                <p className="mission-input flex h-9 items-center rounded-lg px-2.5 font-mono text-[12px]">MSD {startMsd}</p>
              </Field>
            </div>
            <EventRates draft={draft} onChange={(m) => set("eventMultipliers", m)} />
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">
          <Panel eyebrow={`${preview?.result.runs ?? 12} seeded runs · autopilot`} title="Feasibility preview" actions={<DataBadge type="SIMULATED" />}>
            {errors.length ? (
              <Notice tone="bad">
                <p className="font-semibold">Fix these fields:</p>
                <ul className="mt-1 list-disc pl-4">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Notice>
            ) : !preview || preview.key !== previewKey ? (
              <p className="font-mono text-[11px] text-fog">Computing…</p>
            ) : (
              <PreviewView preview={preview.result} ms={preview.ms} />
            )}
          </Panel>
          <Panel eyebrow="Site environment" title={analysis.site.name}>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Elevation" value={analysis.environment.elevationM === null ? "n/a" : fmt.n(analysis.environment.elevationM)} unit="m" badge="REAL" />
              <Metric label="GCR dose" value={analysis.environment.gcrDoseMsvPerSol.toFixed(2)} unit="mSv/sol" badge="MODELLED" />
              <Metric label="Solar" hint="annual mean at surface" value={fmt.n(analysis.environment.solarAnnualMeanWm2)} unit="W/m²" badge="MODELLED" />
              <Metric label="Ice proxy" value={analysis.environment.iceLikelihood.toFixed(2)} badge="DERIVED" />
            </div>
          </Panel>
        </div>
      </div>

      <details className="mt-6 rounded-2xl border border-line bg-panel/60">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[13px] text-bright">
          Quick estimator — original MARS // SURVIVE demonstration model <ChevronDown className="size-4 text-fog" />
        </summary>
        <div className="border-t border-line p-4">
          <Notice tone="warn" className="mb-3">
            Kept from the original project for quick what-ifs. It uses its own simplified model; the Mission Simulator above is the reference model.
          </Notice>
          <SurvivalSimulator />
        </div>
      </details>
    </>
  );
}

function SitePicker() {
  const { grid } = useGrid();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <select
        className="mission-input h-9 rounded-lg px-2 text-[13px]"
        defaultValue=""
        onChange={(e) => {
          const site = CATALOGUE_SITES.find((s) => s.id === e.target.value);
          if (site) dispatchMission({ type: "selectSite", analysis: analyzeSite(site, grid) });
        }}
        aria-label="Choose a catalogue site"
      >
        <option value="" disabled>
          Choose a catalogue site…
        </option>
        {CATALOGUE_SITES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Link to="/atlas" className={btn.secondary}>
        Open the Atlas
      </Link>
    </div>
  );
}

function EnergyBudget({ plan }: { plan: MissionPlan }) {
  const s0 = createInitialState(plan);
  const solHours = MARS.solSeconds / 3600;
  const d = demandKw(s0, combineMods([]), (s0.env.tempMinC + s0.env.tempMaxC) / 2);
  const solar = ((plan.power.solarAreaM2 * POWER.pvEfficiency * s0.env.insolationWm2) / 1000) * solHours;
  const fission = plan.power.fissionUnits * POWER.fissionKwePerUnit * solHours;
  const demand = (d.base + d.heating + d.isru) * solHours;
  const balance = solar + fission - demand;
  return (
    <div className="mt-3 rounded-xl border border-line/70 bg-ink2/40 p-3">
      <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">Sol-1 energy budget at Ls {s0.env.ls.toFixed(0)}° (insolation {fmt.n(s0.env.insolationWm2)} W/m², τ {s0.env.tau.toFixed(2)})</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metric label="Solar" value={fmt.n(solar)} unit="kWh" />
        <Metric label="Fission" value={fmt.n(fission)} unit="kWh" />
        <Metric label="Base + crew" value={fmt.n(d.base * solHours)} unit="kWh" />
        <Metric label="Heating + ISRU" value={fmt.n((d.heating + d.isru) * solHours)} unit="kWh" />
        <Metric label="Balance" value={`${balance >= 0 ? "+" : ""}${fmt.n(balance)}`} unit="kWh" tone={balance >= 0 ? "good" : "bad"} />
      </div>
      {balance < 0 ? <p className="mt-2 text-[11px] text-rose">Demand exceeds generation: the battery drains and load shedding cuts ISRU, then heating.</p> : null}
    </div>
  );
}

function PreviewView({ preview, ms }: { preview: FeasibilityPreview; ms: number }) {
  const causes = Object.entries(preview.failureCauses).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Success" value={fmt.pct(preview.successRate)} tone="good" />
        <Metric label="Compromised" value={fmt.pct(preview.compromisedRate)} tone="warn" />
        <Metric label="Failed" value={fmt.pct(preview.failureRate)} tone={preview.failureRate > 0 ? "bad" : "default"} />
      </div>
      <Meter label="Median final crew health" value={preview.medianFinalHealth} detail={`${Math.round(preview.medianFinalHealth)} %`} />
      <p className="text-[11.5px] text-fog">Median science {preview.medianScience.toFixed(0)} · computed in {ms} ms</p>
      {causes.length ? (
        <div>
          <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[.16em] text-rose">Failure causes</p>
          <ul className="space-y-1">
            {causes.map(([cause, n]) => (
              <li key={cause} className="text-[11.5px] text-bright">
                {n}× {cause}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[10.5px] leading-relaxed text-fog">Each run uses a different seed and resolves every event with its default option. In the simulator you choose, so outcomes can be better or worse.</p>
    </div>
  );
}

function EventRates({ draft, onChange }: { draft: Draft; onChange: (m: Record<string, number>) => void }) {
  const scenario = SCENARIOS.find((s) => s.id === draft.scenario)!;
  return (
    <details className="mt-3 rounded-xl border border-line/70">
      <summary className="cursor-pointer px-3 py-2 text-[12px] text-fog">Event rates (per sol) — scenario × your multiplier</summary>
      <div className="grid gap-x-4 gap-y-2 p-3 sm:grid-cols-2">
        {EVENT_TYPES.map((type) => {
          const user = draft.eventMultipliers[type] ?? 1;
          const rate = EVENT_BASE_PROBABILITY[type] * (scenario.multipliers[type] ?? 1) * user;
          return (
            <label key={type} className="text-[11.5px]">
              <span className="flex justify-between">
                <span className="text-bright">{eventLabel(type)}</span>
                <span className="font-mono text-fog">
                  ×{user.toFixed(1)} · {(rate * 100).toFixed(2)} %/sol
                </span>
              </span>
              <input type="range" min={0} max={3} step={0.1} value={user} onChange={(e) => onChange({ ...draft.eventMultipliers, [type]: Number(e.target.value) })} className="w-full accent-amber" />
            </label>
          );
        })}
      </div>
    </details>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10.5px] leading-snug text-fog/90">{hint}</span> : null}
    </label>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, disabled }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; disabled?: boolean }) {
  return (
    <input
      type="number"
      className="mission-input h-9 w-full rounded-lg px-2.5 font-mono text-[13px] disabled:opacity-40"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
    />
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line p-1" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("flex-1 rounded-md px-2.5 py-1.5 text-[12px] transition", value === v ? "bg-amber/15 text-amber" : "text-fog hover:text-bright")}>
          {label}
        </button>
      ))}
    </div>
  );
}
