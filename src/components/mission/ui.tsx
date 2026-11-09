/** Shared mission-control primitives (dark-first, token based). */
import { Link } from "@tanstack/react-router";
import { Check, Circle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { DataType, SimStatus } from "@/core/types";
import { useMission } from "@/state/missionStore";
import { cn } from "@/lib/utils";

export const DATA_TYPE_INFO: Record<DataType, { label: string; className: string; title: string }> = {
  REAL: { label: "Real", className: "border-mint/35 bg-mint/10 text-mint", title: "Measured by a NASA mission instrument (see NASA Data for the source)." },
  DERIVED: { label: "Derived", className: "border-cyan/35 bg-cyan/10 text-cyan", title: "Computed from real data with a documented formula or literature regions." },
  MODELLED: { label: "Modelled", className: "border-amber/35 bg-amber/10 text-amber", title: "Physical/empirical model evaluated by the platform — not a measurement." },
  SIMULATED: { label: "Simulated", className: "border-rose/35 bg-rose/10 text-rose", title: "Output of the mission simulator (seeded scenario) — not real data." },
};

export function DataBadge({ type, className }: { type: DataType; className?: string }) {
  const info = DATA_TYPE_INFO[type];
  return (
    <span title={info.title} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[.12em]", info.className, className)}>
      {info.label}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions, badges }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode; badges?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[.24em] text-amber">{eyebrow}</p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-[-.03em] text-bright sm:text-4xl">{title}</h1>
        {description ? <div className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-fog">{description}</div> : null}
        {badges ? <div className="mt-3 flex flex-wrap gap-1.5">{badges}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, eyebrow, actions, children, className, bodyClassName }: { title?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("mc-panel rounded-2xl border border-line bg-panel/80 shadow-sm backdrop-blur-xl", className)}>
      {title || eyebrow || actions ? (
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div className="min-w-0">
            {eyebrow ? <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-fog">{eyebrow}</p> : null}
            {title ? <h2 className="mt-0.5 font-display text-[15px] font-semibold text-bright">{title}</h2> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const TONES = {
  default: "text-bright",
  good: "text-mint",
  warn: "text-amber",
  bad: "text-rose",
  info: "text-cyan",
} as const;
export type Tone = keyof typeof TONES;

export function Metric({ label, value, unit, tone = "default", hint, badge }: { label: string; value: ReactNode; unit?: string; tone?: Tone; hint?: ReactNode; badge?: DataType }) {
  return (
    <div className="min-w-0 rounded-xl border border-line/80 bg-ink2/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[9px] uppercase tracking-[.16em] text-fog">{label}</p>
        {badge ? <DataBadge type={badge} /> : null}
      </div>
      <p className={cn("mt-1 font-display text-xl font-semibold tabular-nums", TONES[tone])}>
        {value}
        {unit ? <span className="ml-1 font-mono text-[10px] font-normal text-fog">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-0.5 text-[10.5px] leading-snug text-fog">{hint}</p> : null}
    </div>
  );
}

export function Meter({ value, max = 100, tone, label, detail }: { value: number; max?: number; tone?: Tone; label?: string; detail?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const auto: Tone = tone ?? (pct >= 66 ? "good" : pct >= 33 ? "warn" : "bad");
  const bar = { default: "bg-bright", good: "bg-mint", warn: "bg-amber", bad: "bg-rose", info: "bg-cyan" }[auto];
  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px]">
          <span className="uppercase tracking-[.12em] text-fog">{label}</span>
          <span className="tabular-nums text-bright">{detail ?? `${Math.round(value)}`}</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-line/60" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<SimStatus | "idle", { label: string; className: string }> = {
  idle: { label: "No simulation", className: "border-line text-fog" },
  running: { label: "Running", className: "border-cyan/35 bg-cyan/10 text-cyan" },
  "awaiting-decision": { label: "Decision required", className: "border-amber/40 bg-amber/10 text-amber" },
  success: { label: "Success", className: "border-mint/40 bg-mint/10 text-mint" },
  compromised: { label: "Compromised", className: "border-amber/40 bg-amber/10 text-amber" },
  failed: { label: "Failed", className: "border-rose/40 bg-rose/10 text-rose" },
};

export function StatusPill({ status, className }: { status: SimStatus | "idle"; className?: string }) {
  const style = STATUS_STYLE[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[.12em]", style.className, className)}>{style.label}</span>;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-5 py-10 text-center">
      {icon ? <div className="text-fog">{icon}</div> : null}
      <p className="font-display text-base font-semibold text-bright">{title}</p>
      {text ? <p className="max-w-md text-[12.5px] leading-relaxed text-fog">{text}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-fog">
      <Loader2 className="size-3.5 animate-spin" /> {text}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "bad" | "good"; children: ReactNode; className?: string }) {
  const style = { info: "border-cyan/30 bg-cyan/[.07] text-cyan", warn: "border-amber/35 bg-amber/[.08] text-amber", bad: "border-rose/35 bg-rose/[.08] text-rose", good: "border-mint/30 bg-mint/[.07] text-mint" }[tone];
  return <div className={cn("rounded-xl border px-3 py-2 text-[12px] leading-relaxed", style, className)}>{children}</div>;
}

export const btn = {
  primary: "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber px-4 font-display text-[13px] font-semibold text-[#1a0f06] shadow-sm transition hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-ink2/70 px-3.5 font-display text-[13px] font-medium text-bright transition hover:border-amber/40 hover:bg-ink2 disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 font-mono text-[11px] text-fog transition hover:bg-ink2 hover:text-bright disabled:opacity-50",
  danger: "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose/40 bg-rose/10 px-3.5 font-display text-[13px] font-medium text-rose transition hover:bg-rose/20 disabled:opacity-50",
};

/** Mission flow progress, computed from the shared store (each step links to its module). */
export function FlowStepper({ compact = false }: { compact?: boolean }) {
  const state = useMission();
  const sim = state.sim;
  const steps: Array<{ label: string; to: string; done: boolean; active?: boolean; detail: string }> = [
    { label: "Site", to: "/explorer", done: !!state.selectedSite, detail: state.selectedSite?.name ?? "Select a location" },
    { label: "Analysis", to: "/atlas", done: !!state.analysis, detail: state.analysis ? `Habitability ${Math.round(state.analysis.scores.habitability)}` : "Analyse layers" },
    { label: "Plan", to: "/planner", done: !!state.plan, detail: state.plan ? `${state.plan.durationSols} sols · ${state.plan.crewSize} crew` : "Configure mission" },
    { label: "Simulate", to: "/simulator", done: !!sim && sim.sol > 0, active: sim?.status === "running", detail: sim ? `Sol ${sim.sol}/${sim.durationSols}` : "Not started" },
    { label: "Decide", to: "/decisions", done: !!sim && sim.decisions.length > 0, active: sim?.status === "awaiting-decision", detail: sim?.pending ? "Decision pending" : sim ? `${sim.decisions.length} decisions` : "—" },
    { label: "Report", to: "/reports", done: state.reports.length > 0, detail: state.reports.length ? `${state.reports.length} filed` : "—" },
  ];
  return (
    <ol className={cn("flex items-center gap-1 overflow-x-auto", compact ? "" : "rounded-2xl border border-line bg-panel/70 p-1.5")}>
      {steps.map((step, i) => (
        <li key={step.label} className="flex shrink-0 items-center gap-1">
          <Link
            to={step.to}
            className={cn(
              "group flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition hover:bg-ink2",
              step.active ? "bg-amber/10" : "",
            )}
            title={step.detail}
          >
            <span className={cn("grid size-5 place-items-center rounded-full border", step.done ? "border-mint/50 bg-mint/15 text-mint" : step.active ? "border-amber/60 text-amber" : "border-line text-fog")}>
              {step.done ? <Check className="size-3" /> : <Circle className="size-2" />}
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[12px] font-semibold text-bright">{step.label}</span>
              {!compact ? <span className="block max-w-[140px] truncate font-mono text-[9.5px] text-fog">{step.detail}</span> : null}
            </span>
          </Link>
          {i < steps.length - 1 ? <span className="h-px w-3 bg-line" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

export const fmt = {
  n: (v: number | null | undefined, digits = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })),
  pct: (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`,
  latLon: (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`,
};

export const scoreTone = (score: number): Tone => (score >= 66 ? "good" : score >= 40 ? "warn" : "bad");
