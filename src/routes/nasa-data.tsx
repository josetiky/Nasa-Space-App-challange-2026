import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DATA_TYPE_INFO, DataBadge, Loading, Notice, PageHeader, Panel, btn, fmt } from "@/components/mission/ui";
import { NasaDataAtlas } from "@/components/NasaDataAtlas";
import type { DataType } from "@/core/types";
import { DATA_SOURCES, type DataSource } from "@/data/sources";
import { checkSource, type SourceHealth } from "@/services/nasa/adapters";
import { useNasaImages, useRems, useSepEpisodes, useTraverse } from "@/services/nasa/hooks";
import { useMission } from "@/state/missionStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nasa-data")({
  ssr: false,
  head: () => ({ meta: [{ title: "NASA Data Center — MARS // SURVIVE" }, { name: "description", content: "Every NASA source used by the platform: live health checks, formats, terms and limitations." }] }),
  component: NasaDataPage,
});

const INTEGRATION_LABEL: Record<DataSource["integration"], { label: string; className: string }> = {
  "live+snapshot": { label: "Live + offline snapshot", className: "border-mint/35 text-mint" },
  live: { label: "Live", className: "border-mint/35 text-mint" },
  snapshot: { label: "Snapshot", className: "border-cyan/35 text-cyan" },
  "bundled-asset": { label: "Bundled asset", className: "border-cyan/35 text-cyan" },
  metadata: { label: "Metadata only", className: "border-line text-fog" },
  "not-used": { label: "Not integrated", className: "border-line text-fog" },
};

function NasaDataPage() {
  const [health, setHealth] = useState<Record<string, SourceHealth | "checking">>({});
  const check = async (id: string) => {
    setHealth((h) => ({ ...h, [id]: "checking" }));
    const result = await checkSource(id);
    setHealth((h) => ({ ...h, [id]: result }));
  };
  const checkAll = () => DATA_SOURCES.filter((s) => s.integration !== "not-used" && s.integration !== "metadata").forEach((s) => void check(s.id));

  return (
    <>
      <PageHeader
        eyebrow="Module 6 · NASA Data Center"
        title="Where every number comes from"
        description="Each integrated source with its endpoint, format, access route, terms and known limitations. Health checks perform the same requests the platform depends on. Nothing is mocked: an unreachable source is reported as such, and the app falls back to an offline snapshot only if you saved one with npm run data:fetch."
        actions={
          <button type="button" className={btn.primary} onClick={checkAll}>
            <RefreshCw className="size-4" /> Check all sources
          </button>
        }
      />

      <section className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(DATA_TYPE_INFO) as DataType[]).map((t) => (
          <div key={t} className="rounded-xl border border-line bg-panel/70 p-3">
            <DataBadge type={t} />
            <p className="mt-1.5 text-[11.5px] leading-snug text-fog">{DATA_TYPE_INFO[t].title}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {DATA_SOURCES.map((source) => (
          <SourceCard key={source.id} source={source} health={health[source.id]} onCheck={() => void check(source.id)} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RemsTable />
        <div className="space-y-4">
          <TraverseStatus />
          <SepPanel />
        </div>
      </div>
      <ImageGallery />
      <SnapshotManifest />

      <details className="mt-4 rounded-2xl border border-line bg-panel/60">
        <summary className="cursor-pointer px-4 py-3 text-[13px] text-bright">Original project dataset registry (team archive)</summary>
        <div className="border-t border-line p-4">
          <NasaDataAtlas />
        </div>
      </details>
    </>
  );
}

function SourceCard({ source, health, onCheck }: { source: DataSource; health: SourceHealth | "checking" | undefined; onCheck: () => void }) {
  const integration = INTEGRATION_LABEL[source.integration];
  const checkable = source.integration !== "not-used" && source.integration !== "metadata";
  return (
    <article className={cn("min-w-0 rounded-2xl border bg-panel/80 p-4", source.integration === "not-used" ? "border-line/60 opacity-75" : "border-line")}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">{source.mission}</p>
          <h3 className="mt-0.5 font-display text-[15px] font-semibold text-bright">{source.name}</h3>
          <p className="text-[11.5px] text-fog">{source.provider}</p>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[.1em]", integration.className)}>{integration.label}</span>
      </div>
      <dl className="mt-3 grid gap-1 text-[11.5px]">
        <Row label="Endpoint">
          <code className="break-all text-[10.5px] text-cyan">{source.endpoint}</code>
        </Row>
        <Row label="Format">{source.format}</Row>
        <Row label="Access">{source.access}</Row>
        <Row label="Terms">{source.terms}</Row>
        {source.usedFor.length ? <Row label="Used for">{source.usedFor.join(" · ")}</Row> : null}
        <Row label="Limitations">{source.limitations.join(" · ")}</Row>
        {source.snapshot ? (
          <Row label="Snapshot">
            <code className="break-all text-[10.5px]">public{source.snapshot}</code>
          </Row>
        ) : null}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {checkable ? (
          <button type="button" className={btn.secondary} onClick={onCheck} disabled={health === "checking"}>
            <RefreshCw className={cn("size-3.5", health === "checking" && "animate-spin")} /> Check
          </button>
        ) : null}
        <a href={source.docs} target="_blank" rel="noreferrer" className={btn.ghost}>
          Docs <ExternalLink className="size-3" />
        </a>
        {health && health !== "checking" ? (
          <span className={cn("text-[11.5px]", health.state === "online" ? "text-mint" : health.state === "fallback" ? "text-amber" : "text-rose")}>
            ● {health.state === "online" ? "Online" : health.state === "fallback" ? "Fallback" : "Unavailable"}
            {health.origin ? ` (${health.origin})` : ""} — {health.detail}
            {health.latencyMs !== null ? ` · ${health.latencyMs} ms` : ""}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="font-mono text-[9.5px] uppercase tracking-[.12em] text-fog/80">{label}</dt>
      <dd className="min-w-0 text-bright/90 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function RemsTable() {
  const rems = useRems();
  const rows = rems.data ? rems.data.snapshot.soles.slice(-12).reverse() : [];
  return (
    <Panel eyebrow="Curiosity · REMS" title="Latest sols at Gale crater" actions={<DataBadge type="REAL" />}>
      {rems.isPending ? (
        <Loading />
      ) : !rems.data ? (
        <Notice tone="bad">REMS unavailable: {(rems.error as Error)?.message}</Notice>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] font-mono text-[11px]">
            <thead>
              <tr className="border-b border-line/60 text-left text-[9.5px] uppercase tracking-[.12em] text-fog">
                <th className="py-1">Sol</th>
                <th>Date</th>
                <th>Ls</th>
                <th>Air min/max °C</th>
                <th>Ground min/max °C</th>
                <th>Pa</th>
                <th>Sky</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.sol} className="border-b border-line/30">
                  <td className="py-1 text-bright">{s.sol}</td>
                  <td className="text-fog">{s.date ?? "—"}</td>
                  <td>{s.ls ?? "—"}</td>
                  <td>
                    {s.minT ?? "—"} / {s.maxT ?? "—"}
                  </td>
                  <td>
                    {s.minGroundT ?? "—"} / {s.maxGroundT ?? "—"}
                  </td>
                  <td>{s.pressurePa ?? "—"}</td>
                  <td className="text-fog">{s.opacity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 font-mono text-[9.5px] text-fog">
            Source: {rems.data.origin} · {rems.data.snapshot.count} sols in feed · {rems.data.snapshot.credit}
          </p>
        </div>
      )}
    </Panel>
  );
}

function TraverseStatus() {
  const m20 = useTraverse("m20");
  const msl = useTraverse("msl");
  return (
    <Panel eyebrow="MMGIS GeoJSON" title="Rover traverses" actions={<DataBadge type="REAL" />}>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["Perseverance", m20],
          ["Curiosity", msl],
        ] as const).map(([name, q]) => (
          <div key={name} className="rounded-xl border border-line/70 p-3">
            <p className="font-display text-[13px] font-semibold">{name}</p>
            {q.isPending ? <Loading /> : q.data ? <p className="font-mono text-[11px] text-fog">{q.data.lines.length} segments · latest sol {q.data.latestSol ?? "—"} · {q.data.origin}</p> : <p className="text-[11px] text-rose">{(q.error as Error)?.message}</p>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SepPanel() {
  const sep = useSepEpisodes();
  return (
    <Panel eyebrow="DONKI · CCMC" title="Solar energetic particle episodes" actions={<DataBadge type="REAL" />}>
      {sep.isPending ? (
        <Loading />
      ) : sep.data ? (
        <>
          <p className="text-[12px] text-fog">
            {sep.data.episodes.length} episodes · {sep.data.period} · {sep.data.origin === "bundled" ? "2024 record bundled with the original Sol-by-Sol simulator (live DONKI unreachable)" : sep.data.origin}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {sep.data.episodes.slice(0, 40).map((e, i) => (
              <span key={`${e.time}-${i}`} className={cn("rounded px-1.5 py-0.5 font-mono text-[9.5px]", e.tier === 3 ? "bg-rose/20 text-rose" : e.tier === 2 ? "bg-amber/15 text-amber" : "bg-line/60 text-fog")} title={`Day ${e.dayOfYear} · tier ${e.tier}`}>
                d{e.dayOfYear}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-fog">Observed near Earth: the simulator uses their frequency and severity mix statistically, not their dates.</p>
        </>
      ) : null}
    </Panel>
  );
}

function ImageGallery() {
  const site = useMission((s) => s.selectedSite);
  const query = site ? site.name.replace(/\s*\(.*\)/, "") : "Jezero crater";
  const images = useNasaImages(query, 8);
  return (
    <Panel className="mt-4" eyebrow={`NASA Image and Video Library · “${query}”`} title="Imagery for the mission site" actions={<DataBadge type="REAL" />}>
      {images.isPending ? (
        <Loading />
      ) : !images.data?.length ? (
        <p className="text-[12px] text-fog">{images.error ? `Unavailable: ${(images.error as Error).message}` : "No results for this site."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {images.data.map((img) => (
            <a key={img.nasaId} href={img.page} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-line bg-black">
              <img src={img.thumb} alt={img.title} loading="lazy" className="aspect-[4/3] w-full object-cover opacity-90 transition group-hover:opacity-100" />
              <div className="p-2">
                <p className="line-clamp-2 text-[11.5px] text-bright">{img.title}</p>
                <p className="font-mono text-[9.5px] text-fog">
                  {img.center} · {img.date}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10.5px] text-fog">Keyword search: results are related imagery, not georeferenced to the coordinates.</p>
    </Panel>
  );
}

function SnapshotManifest() {
  const manifest = useQuery({
    queryKey: ["nasa", "manifest"],
    queryFn: async () => {
      const response = await fetch("/data/nasa/manifest.json");
      if (!response.ok) throw new Error("no manifest");
      return (await response.json()) as { generatedAt: string; entries: Array<{ id: string; ok: boolean; detail: string }> };
    },
    retry: 0,
  });
  return (
    <Panel className="mt-4" eyebrow="public/data/nasa" title="Offline snapshots">
      {manifest.data ? (
        <>
          <p className="text-[12px] text-fog">Saved {fmt.n((Date.now() - Date.parse(manifest.data.generatedAt)) / 864e5)} days ago ({manifest.data.generatedAt}).</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {manifest.data.entries.map((e) => (
              <li key={e.id} className={cn("text-[11.5px]", e.ok ? "text-mint" : "text-rose")}>
                {e.ok ? "✓" : "✕"} {e.id} — <span className="text-fog">{e.detail}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[12px] leading-relaxed text-fog">
          No snapshot saved yet. Run <code className="text-amber">npm run data:fetch</code> on a machine with internet access. It downloads MOLA, REMS, both traverses, DONKI and Mars Trek tiles (zoom 0–2) into <code>public/data/nasa/</code>, so the platform also works offline. Live sources are always tried first.
        </p>
      )}
    </Panel>
  );
}
