import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileJson, FileText, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataBadge, Empty, Metric, PageHeader, Panel, StatusPill, btn, fmt, scoreTone } from "@/components/mission/ui";
import type { MissionReport } from "@/core/types";
import { historyToCsv, reportToMarkdown } from "@/services/reportExport";
import { dispatchMission, useMission } from "@/state/missionStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mission Reports — MARS // SURVIVE" }, { name: "description", content: "Outcome, decisions, incidents and consumption of every simulated mission, with exports." }] }),
  component: ReportsPage,
});

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function ReportsPage() {
  const reports = useMission((s) => s.reports);
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);
  const selected = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  return (
    <>
      <PageHeader eyebrow="Module 7 · Mission Reports" title="Mission reports" description="A report is filed automatically when a simulation reaches an outcome. Reports stay in this browser (localStorage); export them to keep or share." badges={<DataBadge type="SIMULATED" />} />
      {!reports.length ? (
        <Panel>
          <Empty icon={<FileText className="size-6" />} title="No reports yet" text="Complete a simulation (success, compromised or failed) and its report appears here." action={<Link to="/simulator" className={btn.primary}>Open the simulator</Link>} />
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-2">
            {reports.map((r) => (
              <button key={r.id} type="button" onClick={() => setSelectedId(r.id)} className={cn("w-full rounded-xl border p-3 text-left transition", selected?.id === r.id ? "border-amber/40 bg-amber/[.06]" : "border-line bg-panel/70 hover:border-amber/25")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-[13px] font-semibold text-bright">{r.missionName}</span>
                  <StatusPill status={r.outcome} className="scale-90" />
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-fog">
                  {r.siteName} · {r.solsCompleted}/{r.durationSols} sols · {new Date(r.generatedAt).toLocaleString()}
                </p>
              </button>
            ))}
          </aside>
          {selected ? <ReportDetail report={selected} /> : null}
        </div>
      )}
    </>
  );
}

function ReportDetail({ report: r }: { report: MissionReport }) {
  const base = `mars-survive-${slug(r.missionName)}-${r.seed}`;
  return (
    <div className="space-y-4">
      <Panel
        eyebrow={`${r.siteName} · ${r.crewSize} crew · seed ${r.seed}`}
        title={r.missionName}
        actions={
          <div className="flex flex-wrap gap-1.5 print:hidden">
            <button type="button" className={btn.ghost} onClick={() => download(`${base}.md`, reportToMarkdown(r), "text/markdown")}>
              <FileText className="size-3.5" /> Markdown
            </button>
            <button type="button" className={btn.ghost} onClick={() => download(`${base}-history.csv`, historyToCsv(r.history), "text/csv")}>
              <Download className="size-3.5" /> CSV
            </button>
            <button type="button" className={btn.ghost} onClick={() => download(`${base}.json`, JSON.stringify(r, null, 2), "application/json")}>
              <FileJson className="size-3.5" /> JSON
            </button>
            <button type="button" className={btn.ghost} onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print
            </button>
            <button type="button" className={cn(btn.ghost, "hover:text-rose")} onClick={() => dispatchMission({ type: "deleteReport", id: r.id })}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={r.outcome} />
          {r.failureCause ? <p className="text-[13px] text-rose">{r.failureCause}</p> : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Sols" value={`${r.solsCompleted}/${r.durationSols}`} />
          <Metric label="Crew health" value={Math.round(r.finalHealth)} unit="%" tone={scoreTone(r.finalHealth)} />
          <Metric label="Morale" value={Math.round(r.finalMorale)} unit="%" tone={scoreTone(r.finalMorale)} />
          <Metric label="Dose" value={r.doseMsv.toFixed(1)} unit="mSv" />
          <Metric label="Science" value={r.science.toFixed(1)} unit={`/ ${r.scienceTarget}`} tone={r.science >= r.scienceTarget ? "good" : "warn"} />
          <Metric label="Decisions" value={r.decisions.length} hint={`${r.decisions.filter((d) => d.followedRecommendation).length} followed the engine`} />
        </div>
        {r.keyFactors.length ? (
          <ul className="mt-3 space-y-0.5 text-[12.5px] text-bright/90">
            {r.keyFactors.map((k) => (
              <li key={k}>• {k}</li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Totals over the mission" title="Consumption & production">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="O₂ consumed" value={fmt.n(r.consumption.oxygenKg, 1)} unit="kg" />
            <Metric label="O₂ from ISRU" value={fmt.n(r.consumption.producedOxygenKg, 1)} unit="kg" tone="good" />
            <Metric label="Water used" value={fmt.n(r.consumption.waterKg)} unit="kg" />
            <Metric label="Water from ISRU" value={fmt.n(r.consumption.producedWaterKg, 1)} unit="kg" tone="good" />
            <Metric label="Food" value={fmt.n(r.consumption.foodCrewDays)} unit="crew-days" />
            <Metric label="Energy" value={fmt.n(r.consumption.energyKWh)} unit="kWh" />
          </div>
          <p className="mt-2 text-[11.5px] text-fog">
            Left at the end: O₂ {fmt.n(r.finalResources.oxygenKg, 1)} kg · water {fmt.n(r.finalResources.waterKg)} kg · food {fmt.n(r.finalResources.foodCrewDays)} crew-days · spares {r.finalResources.spareParts} ({r.consumption.sparePartsUsed} used)
          </p>
        </Panel>
        <Panel eyebrow="Recorded each sol" title="Trajectory">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={r.history} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
                <XAxis dataKey="sol" tick={{ fontSize: 10, fill: "var(--fog)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--fog)" }} width={44} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }} labelFormatter={(s) => `Sol ${s}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line dataKey="health" name="Health %" stroke="var(--mint)" dot={false} isAnimationActive={false} />
                <Line dataKey="morale" name="Morale %" stroke="var(--amber)" dot={false} isAnimationActive={false} />
                <Line dataKey="systemsMin" name="Weakest system %" stroke="var(--rose)" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel eyebrow={`${r.decisions.length} decisions · ${r.incidents.length} incidents`} title="Decision log">
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
              {r.decisions.map((d) => (
                <tr key={`${d.sol}-${d.optionId}`} className="border-b border-line/40">
                  <td className="py-1.5 font-mono text-fog">{d.sol}</td>
                  <td className="text-bright">{d.eventTitle}</td>
                  <td>{d.optionLabel}</td>
                  <td className={d.followedRecommendation ? "text-mint" : d.followedRecommendation === false ? "text-amber" : "text-fog"}>{d.followedRecommendation === null ? "not consulted" : d.followedRecommendation ? "followed" : "overridden"}</td>
                  <td className={d.complication ? "text-rose" : "text-fog"}>{d.complication ?? "—"}</td>
                </tr>
              ))}
              {!r.decisions.length ? (
                <tr>
                  <td colSpan={5} className="py-2 text-fog">
                    No decisions were needed.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
