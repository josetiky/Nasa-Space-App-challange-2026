import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, BrainCircuit, ClipboardList, CloudSun, Database, FileText, Globe2, Layers, Play, Sparkles, Box } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DataBadge, Empty, FlowStepper, Loading, Metric, Panel, StatusPill, btn, fmt, scoreTone } from "@/components/mission/ui";
import { localTrueSolarTime, formatHours, marsTimeFromDate, seasonName } from "@/core/science/marsTime";
import { findCatalogueSite } from "@/data/sites";
import { useSiteAnalysis } from "@/services/analysis";
import { latestValidSol } from "@/services/nasa/transform";
import { useRems } from "@/services/nasa/hooks";
import { useMission } from "@/state/missionStore";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MARS // SURVIVE — Intelligent Mission Control" },
      {
        name: "description",
        content:
          "Interactive Martian mission-control interface combining NASA data provenance, layered hazard/resource planning, and a survival simulator.",
      },
      { property: "og:title", content: "Martian Map — Interplanetary Survival Guide" },
      {
        property: "og:description",
        content:
          "Interactive Martian mission-control interface combining NASA data provenance, layered hazard/resource planning, and a survival simulator.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function HomeMarsGlobe() {
  const { scene } = useGLTF("/models/scene.gltf");
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = Math.max(material.roughness, 0.72);
          material.metalness = Math.min(material.metalness, 0.04);
        }
      });
    });
  }, [model]);

  return (
    <>
      <color attach="background" args={["#08111b"]} />
      <ambientLight intensity={0.65} color="#b9d8e4" />
      <directionalLight position={[4, 3, 5]} intensity={3.2} color="#ffd0b1" />
      <directionalLight position={[-4, 0, -3]} intensity={0.85} color="#55d5e8" />
      <Environment>
        <Lightformer intensity={1.2} color="#ffb58f" position={[4, 2, 4]} scale={[5, 5, 1]} />
        <Lightformer intensity={0.5} color="#63c8dc" position={[-4, 0, -2]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
      </Environment>
      <group rotation={[0.05, -0.42, 0]}>
        <primitive object={model} scale={0.026} />
        <mesh scale={1.012}>
          <sphereGeometry args={[1.05, 48, 48]} />
          <meshBasicMaterial color="#f2b49b" wireframe transparent opacity={0.035} />
        </mesh>
      </group>
      <mesh scale={1.18}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#d7f5ff" transparent opacity={0.045} side={THREE.BackSide} />
      </mesh>
    </>
  );
}


const MODULES = [
  { to: "/explorer", icon: Globe2, title: "Mars Explorer", text: "3D globe on NASA Trek imagery and MOLA relief, plus real Curiosity terrain for EVA route planning." },
  { to: "/atlas", icon: Layers, title: "Survival Atlas", text: "Ten switchable layers with source, period, resolution and data-type labels; compare up to three sites." },
  { to: "/planner", icon: ClipboardList, title: "Mission Planner", text: "Crew, habitat, power, supplies, ISRU and EVA cadence, validated and sized against BVAD consumption rates." },
  { to: "/simulator", icon: Activity, title: "Mission Simulator", text: "Sol-by-sol resources, health, morale and systems with seeded, reproducible events." },
  { to: "/decisions", icon: BrainCircuit, title: "Decision Intelligence", text: "Rules + Monte-Carlo look-ahead + MCDA: every recommendation is explained and reproducible." },
  { to: "/nasa-data", icon: Database, title: "NASA Data Center", text: "Every integrated source with live health checks, formats, terms and limitations." },
  { to: "/reports", icon: FileText, title: "Mission Reports", text: "Outcome, decisions, incidents and consumption for every completed simulation." },
] as const;

function Index() {
  const selected = useMission((s) => s.selectedSite);
  const site = selected ?? findCatalogueSite("jezero")!;
  const { analysis, gridState } = useSiteAnalysis(site);
  const env = analysis?.environment;

  return (
    <>
      <section className="hero-mars rise-in rounded-[28px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <div className="hero-orbit" aria-hidden="true" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-mint">
                <span className="size-1.5 rounded-full bg-mint" /> NASA Space Apps 2026
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink2/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-fog">
                <Sparkles className="size-3.5 text-amber" /> Intelligent Mission Control
              </span>
            </div>
            <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[.24em] text-amber">Interplanetary Survival Guide</p>
            <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold leading-[.98] tracking-[-.04em] text-bright sm:text-5xl lg:text-7xl">
              Plan a Mars mission
              <span className="block text-amber">before Mars plans for you.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fog sm:text-base">
              Choose a site on real NASA data, read its hazards and resources layer by layer, plan crew and supplies, then live the mission sol by sol, with a deterministic decision engine that explains every recommendation.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/explorer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber px-5 text-sm font-semibold text-[#1a0f06] shadow-lg shadow-amber/20 transition-transform hover:-translate-y-0.5">
                Open Mars Explorer <ArrowRight className="size-4" />
              </Link>
              <Link to="/planner" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-ink2/70 px-5 text-sm font-semibold text-bright transition-colors hover:border-amber/40">
                <Play className="size-4 text-cyan" /> Plan &amp; simulate
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              <DataBadge type="REAL" />
              <DataBadge type="DERIVED" />
              <DataBadge type="MODELLED" />
              <DataBadge type="SIMULATED" />
              <span className="font-mono text-[10px] text-fog">Every value in the platform carries one of these labels.</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[500px]">
            <div className="soft-card relative overflow-hidden rounded-[24px] p-3">
              <div className="relative aspect-[1.08/1] overflow-hidden rounded-[18px] bg-[#0b0806]">
                <div className="absolute inset-0">
                  <Canvas camera={{ position: [0, 0.15, 3.65], fov: 40 }} dpr={[1, 1.6]}>
                    <Suspense fallback={null}>
                      <HomeMarsGlobe />
                    </Suspense>
                    <OrbitControls enablePan={false} minDistance={2.55} maxDistance={4.8} autoRotate autoRotateSpeed={0.42} enableDamping dampingFactor={0.06} />
                  </Canvas>
                </div>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0_30%,rgba(7,5,4,.08)_58%,rgba(7,5,4,.7)_100%)]" />
                <ModelLoading />
                <div className="absolute left-4 top-4 rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white backdrop-blur-md">
                  <div className="flex items-center gap-2"><Box className="size-3 text-cyan" /><p className="font-mono text-[8px] uppercase tracking-[.2em] text-white/60">{selected ? "Selected site" : "Example site"}</p></div>
                  <p className="mt-1 font-display text-sm font-semibold">{site.name}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-cyan">{fmt.latLon(site.point.lat, site.point.lon)}</p>
                </div>
                <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
                  <HeroMetric label="MOLA elevation" value={env?.elevationM != null ? `${fmt.n(env.elevationM)} m` : gridState === "loading" ? "…" : "n/a"} tag="REAL" />
                  <HeroMetric label="GCR dose" value={env ? `${env.gcrDoseMsvPerSol.toFixed(2)} mSv/sol` : "…"} tag="MODELLED" />
                  <HeroMetric label="Habitability" value={analysis ? `${Math.round(analysis.scores.habitability)}/100` : "…"} tag="DERIVED" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-2 pb-1 pt-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[.16em] text-fog">Mission flow</p>
                  <p className="mt-1 font-display text-sm font-semibold text-bright">Select → Analyse → Plan → Simulate → Decide → Report</p>
                </div>
                <Link to="/atlas" className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 font-mono text-[9px] text-amber">ANALYSE</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <FlowStepper />
      </div>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.1fr_.9fr]">
        <MissionStatusPanel />
        <RemsPanel />
        <MarsNowPanel siteLon={site.point.lon} siteName={site.name} />
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="group rounded-2xl border border-line bg-panel/70 p-4 transition hover:-translate-y-0.5 hover:border-amber/35">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl border border-amber/25 bg-amber/10 text-amber"><Icon className="size-4" /></span>
              <ArrowRight className="size-4 text-fog transition group-hover:translate-x-0.5 group-hover:text-amber" />
            </div>
            <h3 className="mt-3 font-display text-[15px] font-semibold text-bright">{title}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-fog">{text}</p>
          </Link>
        ))}
      </section>

      <section aria-label="Mars facts" className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/70 bg-line/70 md:grid-cols-5">
        <PlanetFact label="Gravity" value="3.71 m/s²" note="38% of Earth" />
        <PlanetFact label="Solar day" value="24h 39m 35s" note="One sol" />
        <PlanetFact label="Atmosphere" value="95% CO₂" note="~6 hPa mean surface pressure" />
        <PlanetFact label="Year" value="668.6 sols" note="687 Earth days" />
        <PlanetFact label="Surface dose (Gale)" value="0.64 mSv/d" note="MSL-RAD, Hassler et al. 2014" />
      </section>
    </>
  );
}

function MissionStatusPanel() {
  const { plan, sim, reports, selectedSite } = useMission();
  return (
    <Panel eyebrow="Shared mission state" title="Current mission" actions={<StatusPill status={sim?.status ?? "idle"} />}>
      {!plan && !sim ? (
        <Empty title={selectedSite ? `Site selected: ${selectedSite.name}` : "No mission yet"} text={selectedSite ? "Analyse its layers in the Survival Atlas, then configure crew, power and supplies in the Planner." : "Start in the Explorer or the Atlas: pick a location on real NASA data."} action={<Link to={selectedSite ? "/planner" : "/explorer"} className={btn.primary}>{selectedSite ? "Plan the mission" : "Choose a site"}</Link>} />
      ) : (
        <div className="space-y-3">
          <div>
            <p className="font-display text-lg font-semibold text-bright">{plan?.name ?? sim?.ctx.missionName}</p>
            <p className="font-mono text-[10.5px] text-fog">{plan?.site.name ?? sim?.ctx.siteName} · {plan?.crewSize ?? sim?.ctx.crewSize} crew · {plan?.durationSols ?? sim?.durationSols} sols</p>
          </div>
          {sim ? (
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Sol" value={`${sim.sol}/${sim.durationSols}`} badge="SIMULATED" />
              <Metric label="Crew health" value={Math.round(sim.crew.health)} unit="/100" tone={scoreTone(sim.crew.health)} />
              <Metric label="Science" value={sim.science.toFixed(0)} unit={`/${sim.scienceTarget}`} />
            </div>
          ) : (
            <p className="text-[12.5px] text-fog">Plan saved. The simulator is ready to start.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to={sim?.status === "awaiting-decision" ? "/decisions" : "/simulator"} className={btn.primary}>{sim ? (sim.status === "awaiting-decision" ? "Resolve decision" : "Open simulator") : "Start simulation"}</Link>
            {reports.length ? <Link to="/reports" className={btn.secondary}>{reports.length} report{reports.length > 1 ? "s" : ""}</Link> : null}
          </div>
        </div>
      )}
    </Panel>
  );
}

function RemsPanel() {
  const rems = useRems();
  const latest = rems.data ? latestValidSol(rems.data.snapshot) : null;
  const series = rems.data ? rems.data.snapshot.soles.filter((s) => s.minT !== null && s.maxT !== null).slice(-60) : [];
  return (
    <Panel eyebrow="Curiosity · REMS · Gale crater" title={<span className="flex items-center gap-2"><CloudSun className="size-4 text-amber" /> Latest Mars weather</span>} actions={<DataBadge type="REAL" />}>
      {rems.isPending ? (
        <Loading text="Contacting mars.nasa.gov…" />
      ) : !latest ? (
        <Empty title="REMS feed unavailable" text={`${(rems.error as Error)?.message ?? "No data"}. Run npm run data:fetch to save an offline snapshot.`} />
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-2">
            <Metric label={`Sol ${latest.sol}`} value={`${latest.maxT}°`} unit="max °C" hint={latest.date ?? undefined} />
            <Metric label="Min air" value={`${latest.minT}°`} unit="°C" tone="info" />
            <Metric label="Pressure" value={latest.pressurePa} unit="Pa" hint={latest.opacity ? `Sky: ${latest.opacity}` : undefined} />
          </div>
          <div className="mt-3 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="sol" tick={{ fontSize: 9, fill: "var(--fog)" }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 9, fill: "var(--fog)" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }} labelFormatter={(sol) => `Sol ${sol}`} />
                <Line type="monotone" dataKey="maxT" name="Max °C" stroke="var(--amber)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line type="monotone" dataKey="minT" name="Min °C" stroke="var(--cyan)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 font-mono text-[9.5px] text-fog">Last {series.length} sols · {rems.data!.origin === "live" ? "live feed" : rems.data!.origin === "proxy" ? "via server proxy" : "offline snapshot"} · NASA/JPL-Caltech/CAB(CSIC-INTA)</p>
        </div>
      )}
    </Panel>
  );
}

function MarsNowPanel({ siteLon, siteName }: { siteLon: number; siteName: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);
  const t = now ? marsTimeFromDate(now) : null;
  return (
    <Panel eyebrow="Mars24 algorithm" title="Mars right now" actions={<DataBadge type="DERIVED" />}>
      {!t ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Mars year" value={t.marsYear} hint="Clancy et al. numbering" />
          <Metric label="Solar longitude" value={`${t.ls.toFixed(1)}°`} hint={`${seasonName(t.ls)} (north)`} />
          <Metric label="Coordinated Mars Time" value={formatHours(t.mtcHours)} hint={`MSD ${t.msd.toFixed(2)}`} />
          <Metric label={`Local solar time`} value={formatHours(localTrueSolarTime(t.mtcHours, siteLon, t.eotDeg))} hint={siteName} />
        </div>
      )}
    </Panel>
  );
}

function HeroMetric({ label, value, tag }: { label: string; value: string; tag: "REAL" | "MODELLED" | "DERIVED" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-white backdrop-blur-md" title={`${tag.toLowerCase()} value`}>
      <p className="font-mono text-[8px] uppercase tracking-[.15em] text-white/55">{label}</p>
      <p className="mt-1 font-display text-[13px] font-bold">{value}</p>
      <p className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[.14em] text-amber/80">{tag}</p>
    </div>
  );
}

function PlanetFact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-panel/80 p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fog">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-bright">{value}</p>
      <p className="mt-0.5 text-[10px] text-fog">{note}</p>
    </div>
  );
}

/** DOM overlay while the globe model streams in (kept outside the WebGL tree). */
function ModelLoading() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="rounded-full border border-white/20 bg-black/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[.16em] text-white">Loading Mars model… {Math.round(progress)} %</div>
    </div>
  );
}
