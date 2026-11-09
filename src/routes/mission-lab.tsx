import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Atom,
  Box,
  CheckCircle2,
  Compass,
  Crosshair,
  Database,
  Gauge,
  Globe2,
  Layers3,
  MapPinned,
  Mountain,
  Play,
  Radio,
  Rocket,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Target,
  Thermometer,
  Timer,
  Wind,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { MarsExplorer } from "@/components/MarsExplorer";
import { SurvivalSimulator } from "@/components/SurvivalSimulator";

export const Route = createFileRoute("/mission-lab")({
  head: () => ({
    meta: [
      { title: "Mission Lab — Martian Map" },
      {
        name: "description",
        content:
          "An immersive Mars mission workspace for terrain exploration, survival simulation, landing-site research and mission planning.",
      },
    ],
  }),
  component: MissionLab,
});

type LabPage =
  | "overview"
  | "terrain"
  | "simulation"
  | "regions"
  | "landing"
  | "planner"
  | "research";

const navItems: { id: LabPage; label: string; icon: typeof Globe2; short: string }[] = [
  { id: "overview", label: "Overview", icon: Gauge, short: "OPS" },
  { id: "terrain", label: "3D Terrain", icon: Box, short: "3D" },
  { id: "simulation", label: "Survival Sim", icon: Play, short: "SIM" },
  { id: "regions", label: "Region Library", icon: Layers3, short: "GEO" },
  { id: "landing", label: "Landing Sites", icon: MapPinned, short: "SITE" },
  { id: "planner", label: "Mission Planner", icon: RouteIcon, short: "PLAN" },
  { id: "research", label: "Research", icon: Database, short: "DATA" },
];

const terrainLibrary = [
  { name: "Acidalia Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/acidalia_planitia.png", filename: "acidalia_planitia.png" },
  { name: "Amazonis Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/amazonis_planitia.png", filename: "amazonis_planitia.png" },
  { name: "Arabia Terra", category: "Major Regions", image: "/mars-terrain-library/major_regions/arabia_terra.png", filename: "arabia_terra.png" },
  { name: "Arcadia Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/arcadia_planitia.png", filename: "arcadia_planitia.png" },
  { name: "Argyre Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/argyre_planitia.png", filename: "argyre_planitia.png" },
  { name: "Chryse Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/chryse_planitia.png", filename: "chryse_planitia.png" },
  { name: "Elysium Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/elysium_planitia.png", filename: "elysium_planitia.png" },
  { name: "Hellas Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/hellas_planitia.png", filename: "hellas_planitia.png" },
  { name: "Isidis Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/isidis_planitia.png", filename: "isidis_planitia.png" },
  { name: "Noachis Terra", category: "Major Regions", image: "/mars-terrain-library/major_regions/noachis_terra.png", filename: "noachis_terra.png" },
  { name: "Terra Cimmeria", category: "Major Regions", image: "/mars-terrain-library/major_regions/terra_cimmeria.png", filename: "terra_cimmeria.png" },
  { name: "Terra Sirenum", category: "Major Regions", image: "/mars-terrain-library/major_regions/terra_sirenum.png", filename: "terra_sirenum.png" },
  { name: "Tharsis Rise", category: "Major Regions", image: "/mars-terrain-library/major_regions/tharsis_rise.png", filename: "tharsis_rise.png" },
  { name: "Utopia Planitia", category: "Major Regions", image: "/mars-terrain-library/major_regions/utopia_planitia.png", filename: "utopia_planitia.png" },
  { name: "Vastitas Borealis", category: "Major Regions", image: "/mars-terrain-library/major_regions/vastitas_borealis.png", filename: "vastitas_borealis.png" },
  { name: "Alba Mons", category: "Volcanoes", image: "/mars-terrain-library/volcanoes/alba_mons.png", filename: "alba_mons.png" },
  { name: "Arsia Mons", category: "Volcanoes", image: "/mars-terrain-library/volcanoes/arsia_mons.png", filename: "arsia_mons.png" },
  { name: "Ascraeus Mons", category: "Volcanoes", image: "/mars-terrain-library/volcanoes/ascraeus_mons.png", filename: "ascraeus_mons.png" },
  { name: "Elysium Mons", category: "Volcanoes", image: "/mars-terrain-library/volcanoes/elysium_mons.png", filename: "elysium_mons.png" },
  { name: "Olympus Mons", category: "Volcanoes", image: "/mars-terrain-library/volcanoes/olympus_mons.png", filename: "olympus_mons.png" },
  { name: "Pavonis Mons", category: "Volcanoes", image: "/mars-terrain-library/volcanoes/pavonis_mons.png", filename: "pavonis_mons.png" },
  { name: "Ares Vallis", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/ares_vallis.png", filename: "ares_vallis.png" },
  { name: "Coprates Chasma", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/coprates_chasma.png", filename: "coprates_chasma.png" },
  { name: "Kasei Valles", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/kasei_valles.png", filename: "kasei_valles.png" },
  { name: "Maja Valles", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/maja_valles.png", filename: "maja_valles.png" },
  { name: "Melas Chasma", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/melas_chasma.png", filename: "melas_chasma.png" },
  { name: "Noctis Labyrinthus", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/noctis_labyrinthus.png", filename: "noctis_labyrinthus.png" },
  { name: "Valles Marineris", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/valles_marineris.png", filename: "valles_marineris.png" },
  { name: "Argyre Basin", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/argyre_basin.png", filename: "argyre_basin.png" },
  { name: "Endeavour Crater", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/endeavour_crater.png", filename: "endeavour_crater.png" },
  { name: "Gale Crater", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/gale_crater.png", filename: "gale_crater.png" },
  { name: "Gusev Crater", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/gusev_crater.png", filename: "gusev_crater.png" },
  { name: "Hellas Basin", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/hellas_basin.png", filename: "hellas_basin.png" },
  { name: "Isidis Basin", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/isidis_basin.png", filename: "isidis_basin.png" },
  { name: "Jezero Crater", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/jezero_crater.png", filename: "jezero_crater.png" },
  { name: "Korolev Crater", category: "Craters & Basins", image: "/mars-terrain-library/craters_basins/korolev_crater.png", filename: "korolev_crater.png" },
  { name: "Planum Australe South Pole", category: "Polar Regions", image: "/mars-terrain-library/polar_regions/planum_australe_south_pole.png", filename: "planum_australe_south_pole.png" },
  { name: "Planum Boreum North Pole", category: "Polar Regions", image: "/mars-terrain-library/polar_regions/planum_boreum_north_pole.png", filename: "planum_boreum_north_pole.png" },
  { name: "Curiosity Gale Crater", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/curiosity_gale_crater.png", filename: "curiosity_gale_crater.png" },
  { name: "Insight Lander Site", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/insight_lander_site.png", filename: "insight_lander_site.png" },
  { name: "Opportunity Endeavour Crater", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/opportunity_endeavour_crater.png", filename: "opportunity_endeavour_crater.png" },
  { name: "Perseverance Ingenuity", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/perseverance_ingenuity.png", filename: "perseverance_ingenuity.png" },
  { name: "Phoenix Lander Site", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/phoenix_lander_site.png", filename: "phoenix_lander_site.png" },
  { name: "Spirit Gusev Crater", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/spirit_gusev_crater.png", filename: "spirit_gusev_crater.png" },
  { name: "Viking Lander Sites", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/viking_lander_sites.png", filename: "viking_lander_sites.png" },
  { name: "Zhurong Lander Site", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/zhurong_lander_site.png", filename: "zhurong_lander_site.png" }
] as const;

const landingSites = [
  { name: "Jezero Crater", mission: "Perseverance · Ingenuity", status: "ACTIVE SCIENCE", detail: "Ancient lake basin and preserved delta deposits.", risk: "Moderate", color: "cyan" },
  { name: "Gale Crater", mission: "Curiosity", status: "ACTIVE SCIENCE", detail: "Layered Mount Sharp records long-term environmental change.", risk: "Moderate", color: "amber" },
  { name: "Gusev Crater", mission: "Spirit", status: "HISTORIC", detail: "Rocky plains and evidence of past aqueous alteration.", risk: "Elevated", color: "rose" },
  { name: "Utopia Planitia", mission: "Viking 2 · Zhurong", status: "HISTORIC / STUDY", detail: "Broad northern plain with ice-relevant subsurface clues.", risk: "Low–moderate", color: "mint" },
  { name: "Elysium Planitia", mission: "InSight", status: "HISTORIC", detail: "Flat volcanic plain selected for interior-structure science.", risk: "Low", color: "cyan" },
  { name: "Meridiani Planum", mission: "Opportunity", status: "HISTORIC", detail: "Hematite-rich terrain and sedimentary outcrops.", risk: "Moderate", color: "amber" },
];

function MissionLab() {
  const [page, setPage] = useState<LabPage>("overview");

  return (
    <div className="mission-lab-page min-h-[calc(100vh-65px)] bg-ink text-bright">
      <div className="mission-lab-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur-xl sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber/30 bg-amber/10">
            <Radio className="size-5 text-amber" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-sm font-bold tracking-[.08em] text-bright">MISSION LAB</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-mint">
                <span className="beacon-dot size-1.5 rounded-full bg-mint" /> Systems nominal
              </span>
            </div>
            <p className="hidden font-mono text-[10px] uppercase tracking-[.16em] text-fog sm:block">
              ARES-01 · Mars operations workspace · Observe / Analyze / Plan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-line bg-ink2/70 px-3 py-2 lg:flex">
            <span className="size-1.5 rounded-full bg-cyan" />
            <span className="font-mono text-[10px] text-fog">DATA LINK</span>
            <span className="font-mono text-[10px] text-bright">NOMINAL</span>
          </div>
          <a href="/" className="rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[10px] uppercase tracking-[.1em] text-fog transition hover:border-amber/40 hover:text-bright">
            Exit Lab ↗
          </a>
        </div>
      </div>

      <div className="mission-lab-nav flex gap-1 overflow-x-auto border-b border-line bg-ink2/85 px-3 py-2 sm:px-5 xl:px-8">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              aria-current={active ? "page" : undefined}
              className={`group inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition sm:px-4 ${
                active
                  ? "border-amber/35 bg-amber/10 text-bright shadow-sm"
                  : "border-transparent text-fog hover:border-line hover:bg-panel/70 hover:text-bright"
              }`}
            >
              <Icon className={`size-4 ${active ? "text-amber" : "text-fog group-hover:text-cyan"}`} />
              <span className="font-display text-xs font-semibold">{item.label}</span>
              <span className={`hidden font-mono text-[8px] tracking-[.12em] xl:inline ${active ? "text-amber" : "text-fog/70"}`}>{item.short}</span>
            </button>
          );
        })}
      </div>

      <div className={page === "terrain" ? "" : "mx-auto w-full max-w-[1720px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7"}>
        {page === "overview" && <Overview onNavigate={setPage} />}
        {page === "terrain" && <TerrainPage />}
        {page === "simulation" && <SimulationPage />}
        {page === "regions" && <RegionsPage onNavigate={setPage} />}
        {page === "landing" && <LandingSitesPage />}
        {page === "planner" && <PlannerPage />}
        {page === "research" && <ResearchPage />}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-amber">{children}</p>;
}

function Overview({ onNavigate }: { onNavigate: (page: LabPage) => void }) {
  const cards: { id: LabPage; title: string; description: string; icon: typeof Globe2; accent: string; meta: string }[] = [
    { id: "terrain", title: "3D Terrain Explorer", description: "Inspect regional terrain models, volcanic provinces, basins and polar surfaces.", icon: Globe2, accent: "cyan", meta: "07 REGIONAL DATASETS" },
    { id: "simulation", title: "Survival Simulator", description: "Run a mission scenario and monitor crew resources, system health and risk.", icon: Activity, accent: "amber", meta: "SOL-BY-SOL OPERATIONS" },
    { id: "regions", title: "Geology Library", description: "Browse the core terrain collection and compare geological environments.", icon: Mountain, accent: "rose", meta: "PLANETARY GEOLOGY" },
    { id: "landing", title: "Landing Site Atlas", description: "Review candidate destinations and notable robotic exploration sites.", icon: MapPinned, accent: "mint", meta: "SITE INTELLIGENCE" },
    { id: "planner", title: "Mission Planner", description: "Draft an expedition profile with objectives, duration and operational priorities.", icon: Target, accent: "cyan", meta: "MISSION DESIGN" },
    { id: "research", title: "Research & Data", description: "Explore science themes, evidence types and data provenance notes.", icon: Atom, accent: "amber", meta: "SCIENCE BRIEFING" },
  ];
  return (
    <div className="space-y-7 rise-in">
      <section className="mission-overview-hero relative overflow-hidden rounded-3xl border border-line p-6 sm:p-9 lg:p-12">
        <div className="mission-hero-orbit mission-hero-orbit-one" />
        <div className="mission-hero-orbit mission-hero-orbit-two" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.7fr)] lg:items-center">
          <div className="max-w-3xl">
            <Eyebrow>Interplanetary Survival Guide · ARES-01</Eyebrow>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.03] tracking-tight text-bright sm:text-5xl lg:text-7xl">
              Plan the mission.
              <span className="block text-amber">Understand the planet.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-fog sm:text-base">
              A unified Mars operations workspace for terrain exploration, landing-site research and crew survival planning. Move from planetary context to mission decisions in one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => onNavigate("terrain")} className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-3 font-display text-sm font-bold text-ink shadow-lg shadow-amber/15 transition hover:-translate-y-0.5 hover:brightness-105">
                <Box className="size-4" /> Open 3D Terrain <ArrowRight className="size-4" />
              </button>
              <button onClick={() => onNavigate("simulation")} className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel/80 px-5 py-3 font-display text-sm font-semibold text-bright transition hover:border-cyan/50">
                <Play className="size-4 text-cyan" /> Run Survival Simulation
              </button>
            </div>
          </div>
          <div className="mission-hero-planet relative mx-auto aspect-square w-full max-w-[390px]">
            <div className="mission-hero-planet-glow" />
            <div className="mission-hero-planet-image" />
            <div className="mission-hero-orbit-line" />
            <div className="absolute left-0 top-[23%] rounded-xl border border-line bg-panel/90 px-3 py-2 shadow-xl backdrop-blur">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-fog">Planetary body</p>
              <p className="mt-1 font-display text-sm font-bold text-bright">MARS · SOL 214</p>
            </div>
            <div className="absolute bottom-[16%] right-0 rounded-xl border border-mint/25 bg-panel/90 px-3 py-2 shadow-xl backdrop-blur">
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-fog">Workspace status</p>
              <p className="mt-1 flex items-center gap-2 font-display text-sm font-bold text-mint"><span className="beacon-dot size-1.5 rounded-full bg-mint" /> Ready for planning</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-9 grid grid-cols-2 gap-3 border-t border-line/80 pt-5 md:grid-cols-4">
          <Metric icon={Globe2} label="Terrain datasets" value="07" note="Regional models" />
          <Metric icon={MapPinned} label="Exploration sites" value="06" note="Reference locations" />
          <Metric icon={ShieldCheck} label="Mission systems" value="NOMINAL" note="Workspace status" />
          <Metric icon={Activity} label="Planning mode" value="ACTIVE" note="Decision support" />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><Eyebrow>Mission workspace</Eyebrow><h2 className="font-display text-2xl font-bold tracking-tight text-bright sm:text-3xl">Choose your next operation</h2></div>
          <p className="max-w-md text-xs leading-5 text-fog">Every module is connected through the navigation above. Start with terrain, then assess risk and plan the expedition.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <button key={card.id} onClick={() => onNavigate(card.id)} className="mission-module-card group relative flex min-h-[215px] flex-col rounded-2xl border border-line bg-panel p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-amber/40 hover:shadow-xl hover:shadow-black/5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className={`grid size-11 place-items-center rounded-xl border ${accentClasses(card.accent)}`}><Icon className="size-5" /></div>
                  <span className="font-mono text-[9px] text-fog/70">0{index + 1}</span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-bright">{card.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-fog">{card.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                  <span className="font-mono text-[9px] tracking-[.13em] text-fog">{card.meta}</span>
                  <ArrowRight className="size-4 text-fog transition group-hover:translate-x-1 group-hover:text-amber" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <Eyebrow>Operational checklist</Eyebrow>
          <h3 className="font-display text-xl font-bold text-bright">Before you commit the crew</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Checklist icon={CheckCircle2} title="Survey terrain" detail="Review elevation, slopes and access routes." />
            <Checklist icon={Thermometer} title="Assess environment" detail="Account for thermal extremes and dust." />
            <Checklist icon={Wind} title="Check resources" detail="Estimate power, oxygen and life support needs." />
            <Checklist icon={ShieldCheck} title="Review contingencies" detail="Keep a reserve plan for mission-critical systems." />
          </div>
        </div>
        <div className="rounded-2xl border border-amber/20 bg-amber/5 p-5 sm:p-6">
          <div className="flex items-center gap-2"><Sparkles className="size-4 text-amber" /><Eyebrow>Mission principle</Eyebrow></div>
          <p className="mt-2 font-display text-2xl font-semibold leading-snug text-bright">“Explore with evidence. Decide with context.”</p>
          <p className="mt-3 text-sm leading-6 text-fog">This interface is a planning and educational sandbox. Scientific interpretations and mission values should be verified against authoritative mission datasets before real-world use.</p>
          <button onClick={() => onNavigate("research")} className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-amber hover:text-bright">Review research notes <ArrowRight className="size-3.5" /></button>
        </div>
      </section>
    </div>
  );
}

function TerrainPage() {
  return (
    <div className="mission-terrain-page rise-in">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-panel px-4 py-4 sm:px-6">
        <div><Eyebrow>Planetary visualization</Eyebrow><h1 className="font-display text-2xl font-bold text-bright sm:text-3xl">3D Terrain Explorer</h1><p className="mt-1 text-sm text-fog">Inspect Mars at regional scale using the available terrain model library.</p></div>
        <div className="flex items-center gap-2 rounded-lg border border-mint/25 bg-mint/10 px-3 py-2 font-mono text-[10px] text-mint"><span className="beacon-dot size-1.5 rounded-full bg-mint" /> RENDER SYSTEM READY</div>
      </div>
      <MarsExplorer initialModelView="regional" immersive />
      <div className="grid gap-3 border-t border-line bg-panel p-4 sm:grid-cols-3 sm:p-5">
        <InfoTile icon={Mountain} title="Regional morphology" text="Compare volcanic, impact and polar landforms." />
        <InfoTile icon={Crosshair} title="Observe before selecting" text="Use the model controls to inspect terrain from different angles." />
        <InfoTile icon={ShieldCheck} title="Planning note" text="Terrain models are visual aids, not certified landing-safety products." />
      </div>
    </div>
  );
}

function SimulationPage() {
  return (
    <div className="mission-lab-simulator space-y-5 rise-in">
      <PageHeading eyebrow="Crew operations" title="Survival Simulator" description="Run a sol-by-sol scenario and track the systems that keep a crew alive." icon={Activity} />
      <div className="grid gap-3 sm:grid-cols-3">
        <SmallMetric icon={Thermometer} label="Thermal envelope" value="Monitor" detail="Habitat temperature" />
        <SmallMetric icon={Wind} label="Life support" value="Critical system" detail="Oxygen and air quality" />
        <SmallMetric icon={Wrench} label="Contingency" value="Stand by" detail="Repair and recovery plan" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-xl"><SurvivalSimulator /></div>
      <p className="text-xs leading-5 text-fog">Simulation values are illustrative and depend on the existing simulator implementation. Do not treat them as engineering guidance for a real mission.</p>
    </div>
  );
}

function RegionsPage({ onNavigate }: { onNavigate: (page: LabPage) => void }) {
  const [category, setCategory] = useState("All");
  const categories = ["All", "Major Regions", "Volcanoes", "Canyons & Valleys", "Craters & Basins", "Polar Regions", "Mission Sites"];
  const visible = category === "All" ? terrainLibrary : terrainLibrary.filter((item) => item.category === category);
  return (
    <div className="space-y-6 rise-in">
      <PageHeading eyebrow="Geological index · 46 visuals" title="Mars Terrain Library" description="Browse the complete image library by geological family. These visual references complement the seven bundled 3D regional models." icon={Layers3} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={`rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-[.08em] transition ${category === item ? "border-amber/40 bg-amber/10 text-bright" : "border-line bg-ink2/60 text-fog hover:text-bright"}`}>{item}</button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-fog">{visible.length} / {terrainLibrary.length} VISUALS</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visible.map((region, index) => (
          <article key={region.filename} className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-1 hover:border-amber/40 hover:shadow-xl">
            <div className="relative aspect-[16/10] overflow-hidden bg-ink2">
              <img src={region.image} alt={`${region.name} Mars terrain visualization`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              <span className="absolute left-3 top-3 rounded-md border border-white/20 bg-black/65 px-2 py-1 font-mono text-[9px] tracking-[.1em] text-white backdrop-blur">{region.category.toUpperCase()}</span>
              <span className="absolute bottom-3 right-3 rounded-md bg-black/65 px-2 py-1 font-mono text-[9px] text-white">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="p-4">
              <h3 className="font-display text-base font-bold text-bright">{region.name}</h3>
              <p className="mt-1 break-all font-mono text-[9px] text-fog">{region.filename}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-[10px] text-fog">Terrain reference image</span>
                <a href={region.image} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.08em] text-cyan hover:text-bright">Open image <ArrowRight className="size-3" /></a>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-panel/70 p-4 text-xs leading-5 text-fog"><strong className="text-bright">Dataset note:</strong> the 46 images are visual references, not 46 interactive 3D meshes. The 3D Terrain Explorer continues to use the seven bundled regional GLB models.</div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan/20 bg-cyan/5 p-5">
        <div><p className="font-display text-base font-bold text-bright">Want to inspect the terrain in 3D?</p><p className="mt-1 text-sm text-fog">Switch from image references to the interactive regional terrain viewer.</p></div>
        <button onClick={() => onNavigate("terrain")} className="inline-flex items-center gap-2 rounded-xl bg-cyan px-4 py-3 font-display text-sm font-bold text-white hover:brightness-105"><Box className="size-4" /> Launch 3D Explorer</button>
      </div>
    </div>
  );
}

function LandingSitesPage() {
  return (
    <div className="space-y-6 rise-in">
      <PageHeading eyebrow="Surface exploration atlas" title="Landing Sites & Missions" description="A quick reference to notable robotic exploration regions and the science context they represent." icon={MapPinned} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {landingSites.map((site, index) => (
          <article key={site.name} className="rounded-2xl border border-line bg-panel p-5 transition hover:border-amber/35 hover:shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className={`grid size-10 place-items-center rounded-xl border ${accentClasses(site.color)}`}><MapPinned className="size-4" /></div>
              <span className="rounded-full border border-line bg-ink2 px-2.5 py-1 font-mono text-[8px] tracking-[.1em] text-fog">{site.status}</span>
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-bright">{site.name}</h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[.12em] text-amber">{site.mission}</p>
            <p className="mt-3 min-h-12 text-sm leading-6 text-fog">{site.detail}</p>
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="font-mono text-[9px] uppercase tracking-[.12em] text-fog">Terrain risk · qualitative</span>
              <span className="rounded-lg bg-ink2 px-2.5 py-1.5 font-mono text-[10px] text-bright">{site.risk}</span>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-fog/80">Reference card {String(index + 1).padStart(2, "0")} · risk labels are illustrative, not official landing assessments.</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function PlannerPage() {
  const [missionName, setMissionName] = useState("ARES Surface Expedition");
  const [destination, setDestination] = useState("Jezero Crater");
  const [duration, setDuration] = useState("30");
  const [priority, setPriority] = useState("Science return");
  const [crew, setCrew] = useState("4");
  const [saved, setSaved] = useState(false);
  const summary = `MISSION BRIEF\nName: ${missionName || "Untitled mission"}\nDestination: ${destination}\nDuration: ${duration} sols\nCrew: ${crew}\nPrimary priority: ${priority}\n\nPlanning sandbox only. Validate all parameters with mission engineering and authoritative data.`;
  return (
    <div className="space-y-6 rise-in">
      <PageHeading eyebrow="Expedition design" title="Mission Planner" description="Build a lightweight mission brief and keep the main decisions visible. This local planner does not submit data to a server." icon={RouteIcon} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-7">
          <Eyebrow>Mission configuration</Eyebrow>
          <h2 className="font-display text-xl font-bold text-bright">Define the expedition</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Mission name"><input value={missionName} onChange={(e) => { setMissionName(e.target.value); setSaved(false); }} className="mission-input" /></Field>
            <Field label="Destination"><select value={destination} onChange={(e) => { setDestination(e.target.value); setSaved(false); }} className="mission-input">{["Jezero Crater", "Gale Crater", "Tharsis Rise", "Valles Marineris", "Utopia Planitia", "Elysium Planitia", "Hellas Basin"].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Mission duration (sols)"><input type="number" min="1" max="1000" value={duration} onChange={(e) => { setDuration(e.target.value); setSaved(false); }} className="mission-input" /></Field>
            <Field label="Crew size"><select value={crew} onChange={(e) => { setCrew(e.target.value); setSaved(false); }} className="mission-input">{["2", "3", "4", "6", "8"].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Primary mission priority"><select value={priority} onChange={(e) => { setPriority(e.target.value); setSaved(false); }} className="mission-input">{["Science return", "Geological survey", "Technology demonstration", "Resource prospecting", "Habitat deployment"].map((x) => <option key={x}>{x}</option>)}</select></Field></div>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => setSaved(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-3 font-display text-sm font-bold text-ink hover:brightness-105"><CheckCircle2 className="size-4" /> Generate mission brief</button>
            <button onClick={() => { setMissionName("ARES Surface Expedition"); setDestination("Jezero Crater"); setDuration("30"); setCrew("4"); setPriority("Science return"); setSaved(false); }} className="rounded-xl border border-line px-4 py-3 font-display text-sm font-semibold text-fog hover:text-bright">Reset</button>
          </div>
          {saved && <p className="mt-4 flex items-center gap-2 text-xs text-mint"><CheckCircle2 className="size-4" /> Mission brief generated below. Copy it into your project notes as needed.</p>}
        </section>
        <aside className="rounded-2xl border border-line bg-ink2/70 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3"><Eyebrow>Brief preview</Eyebrow><span className="font-mono text-[9px] text-fog">LOCAL DRAFT</span></div>
          <h2 className="font-display text-xl font-bold text-bright">Operational summary</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SummaryBox label="Duration" value={`${duration || "—"} sols`} />
            <SummaryBox label="Crew" value={crew} />
            <SummaryBox label="Destination" value={destination} />
            <SummaryBox label="Priority" value={priority} />
          </div>
          <pre className="mission-brief mt-5 whitespace-pre-wrap rounded-xl border border-line bg-panel p-4 font-mono text-[11px] leading-6 text-fog">{summary}</pre>
          <button onClick={() => { void navigator.clipboard?.writeText(summary); setSaved(true); }} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2.5 font-mono text-[10px] uppercase tracking-[.1em] text-bright hover:border-cyan/40"><Database className="size-3.5 text-cyan" /> Copy brief</button>
        </aside>
      </div>
    </div>
  );
}

function ResearchPage() {
  const topics = [
    { title: "Geological context", icon: Mountain, detail: "Volcanism, impact processes, sediment transport and long-term surface modification shape the terrain encountered by explorers." },
    { title: "Water & ice", icon: Atom, detail: "Ancient channels, delta deposits, hydrated minerals and polar or subsurface ice are key targets for planetary science." },
    { title: "Environmental hazards", icon: Wind, detail: "Dust, radiation, thermal variation, terrain slope and communication constraints all influence surface operations." },
    { title: "Mission systems", icon: Wrench, detail: "Power, thermal control, mobility, life support and fault recovery must be assessed together rather than as isolated systems." },
  ];
  return (
    <div className="space-y-6 rise-in">
      <PageHeading eyebrow="Science desk" title="Research & Data Notes" description="A concise guide to the evidence categories behind the terrain and survival-planning experience." icon={Database} />
      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((topic, index) => {
          const Icon = topic.icon;
          return <article key={topic.title} className="rounded-2xl border border-line bg-panel p-5 sm:p-6"><div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan"><Icon className="size-5" /></div><span className="font-mono text-[10px] text-fog">SCI-{String(index + 1).padStart(2, "0")}</span></div><h3 className="mt-5 font-display text-xl font-bold text-bright">{topic.title}</h3><p className="mt-2 text-sm leading-7 text-fog">{topic.detail}</p></article>;
        })}
      </div>
      <section className="rounded-2xl border border-line bg-panel p-5 sm:p-7">
        <Eyebrow>Data provenance</Eyebrow>
        <h2 className="font-display text-xl font-bold text-bright">Interpretation and limitations</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-fog">
          <li className="flex gap-3"><CheckCircle2 className="mt-1 size-4 shrink-0 text-mint" /><span>Bundled terrain meshes and preview images are included as visual assets in this project.</span></li>
          <li className="flex gap-3"><CheckCircle2 className="mt-1 size-4 shrink-0 text-mint" /><span>Location descriptions are concise educational summaries; they are not substitutes for peer-reviewed papers or official mission documentation.</span></li>
          <li className="flex gap-3"><CheckCircle2 className="mt-1 size-4 shrink-0 text-mint" /><span>Risk scores and mission-planning values shown in the interface are illustrative unless a source is explicitly identified.</span></li>
        </ul>
      </section>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: typeof Globe2 }) {
  return <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-end"><div><Eyebrow>{eyebrow}</Eyebrow><h1 className="font-display text-3xl font-bold tracking-tight text-bright sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-fog">{description}</p></div><div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-amber/25 bg-amber/10 text-amber"><Icon className="size-5" /></div></div>;
}
function Metric({ icon: Icon, label, value, note }: { icon: typeof Globe2; label: string; value: string; note: string }) { return <div className="border-l-2 border-amber/30 pl-3"><div className="flex items-center gap-2 text-fog"><Icon className="size-3.5" /><span className="font-mono text-[9px] uppercase tracking-[.13em]">{label}</span></div><p className="mt-1 font-display text-lg font-bold text-bright">{value}</p><p className="text-[10px] text-fog">{note}</p></div>; }
function Checklist({ icon: Icon, title, detail }: { icon: typeof Globe2; title: string; detail: string }) { return <div className="flex gap-3 rounded-xl border border-line bg-ink2/60 p-3"><Icon className="mt-0.5 size-4 shrink-0 text-mint" /><div><p className="text-sm font-semibold text-bright">{title}</p><p className="mt-1 text-xs leading-5 text-fog">{detail}</p></div></div>; }
function InfoTile({ icon: Icon, title, text }: { icon: typeof Globe2; title: string; text: string }) { return <div className="flex gap-3 rounded-xl border border-line bg-panel p-4"><Icon className="mt-0.5 size-4 shrink-0 text-cyan" /><div><p className="text-sm font-semibold text-bright">{title}</p><p className="mt-1 text-xs leading-5 text-fog">{text}</p></div></div>; }
function SmallMetric({ icon: Icon, label, value, detail }: { icon: typeof Globe2; label: string; value: string; detail: string }) { return <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4"><div className="grid size-10 place-items-center rounded-lg bg-amber/10 text-amber"><Icon className="size-4" /></div><div><p className="font-mono text-[9px] uppercase tracking-[.12em] text-fog">{label}</p><p className="mt-1 text-sm font-bold text-bright">{value}</p><p className="text-[10px] text-fog">{detail}</p></div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-fog">{label}</span>{children}</label>; }
function SummaryBox({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-line bg-panel p-3"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-fog">{label}</p><p className="mt-1 break-words font-display text-sm font-bold text-bright">{value}</p></div>; }
function accentClasses(accent: string) { const map: Record<string, string> = { cyan: "border-cyan/25 bg-cyan/10 text-cyan", amber: "border-amber/25 bg-amber/10 text-amber", rose: "border-rose/25 bg-rose/10 text-rose", mint: "border-mint/25 bg-mint/10 text-mint" }; return map[accent] ?? map["amber"]!; }
