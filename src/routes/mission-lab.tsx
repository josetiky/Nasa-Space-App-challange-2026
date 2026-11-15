import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Atom,
  Box,
  CheckCircle2,
  Crosshair,
  Database,
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
  Wind,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { MarsMissionAtlasWorkspace } from "@/components/atlas/MarsMissionAtlasWorkspace";
import { MarsExplorer } from "@/components/MarsExplorer";
import { SurvivalSimulator } from "@/components/SurvivalSimulator";

export const Route = createFileRoute("/mission-lab")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "M.I.Y.H. — Mars In Your Hands" },
      {
        name: "description",
        content:
          "M.I.Y.H. — Mars In Your Hands: Global Mars Explorer, Access Mars 3D Photogrammetry, 11 Robotic Missions, Sol-by-Sol Timeline, Terrain Intelligence and Georeferenced Scientific Discoveries.",
      },
    ],
  }),
  component: MissionLab,
});

type LabPage =
  | "atlas"
  | "terrain"
  | "regions"
  | "simulation"
  | "planner"
  | "research";

const navItems: { id: LabPage; label: string; icon: typeof Globe2; short: string }[] = [
  { id: "atlas", label: "Atlas de misiones (Global + 3D Access Mars)", icon: Rocket, short: "ATLAS" },
  { id: "terrain", label: "Regional 3D Models (DEM/GLB)", icon: Box, short: "3D DEM" },
  { id: "regions", label: "Mars Terrain Library (46)", icon: Layers3, short: "MAPS" },
  { id: "simulation", label: "Survival Simulator", icon: Play, short: "SIM" },
  { id: "planner", label: "Expedition Brief", icon: RouteIcon, short: "PLAN" },
  { id: "research", label: "Provenance & Notes", icon: Database, short: "DATA" },
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
  { name: "Kasei Valles", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/kasei_valles.png", filename: "kasei_valles.png" },
  { name: "Melas Chasma", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/melas_chasma.png", filename: "melas_chasma.png" },
  { name: "Noctis Labyrinthus", category: "Canyons & Valleys", image: "/mars-terrain-library/canyons_valleys/noctis_labyrinthus.png", filename: "noctis_labyrinthus.png" },
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
  { name: "Zhurong Lander Site", category: "Mission Sites", image: "/mars-terrain-library/mission_sites/zhurong_lander_site.png", filename: "zhurong_lander_site.png" },
] as const;

function MissionLab() {
  const [page, setPage] = useState<LabPage>("atlas");

  return (
    <div className="mission-lab-page min-h-[calc(100vh-65px)] bg-ink text-bright">
      <div className="mission-lab-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur-xl sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber/30 bg-amber/10">
            <Radio className="size-5 text-amber" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-sm font-bold tracking-[.08em] text-bright">
                M.I.Y.H. — MARS IN YOUR HANDS
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-mint">
                <span className="beacon-dot size-1.5 rounded-full bg-mint" /> Access Mars 3D + 11 Missions Integrated
              </span>
            </div>
            <p className="hidden font-mono text-[10px] uppercase tracking-[.16em] text-fog sm:block">
              NASA PDS · Mars Trek · ODE · Analyst's Notebook · USGS · Access Mars (Google Creative Lab / NASA JPL)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-line bg-ink2/70 px-3 py-2 lg:flex">
            <span className="size-1.5 rounded-full bg-cyan" />
            <span className="font-mono text-[10px] text-fog">CRS</span>
            <span className="font-mono text-[10px] text-bright">IAU MARS 2000</span>
          </div>
          <a
            href="/"
            className="rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[10px] uppercase tracking-[.1em] text-fog transition hover:border-amber/40 hover:text-bright"
          >
            Overview ↗
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
              <span className={`hidden font-mono text-[8px] tracking-[.12em] xl:inline ${active ? "text-amber" : "text-fog/70"}`}>
                {item.short}
              </span>
            </button>
          );
        })}
      </div>

      <div className={page === "terrain" ? "" : "mx-auto w-full max-w-[1720px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6"}>
        {page === "atlas" && <MarsMissionAtlasWorkspace />}
        {page === "terrain" && <TerrainPage />}
        {page === "simulation" && <SimulationPage />}
        {page === "regions" && <RegionsPage onNavigate={setPage} />}
        {page === "planner" && <PlannerPage />}
        {page === "research" && <ResearchPage />}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-amber">{children}</p>;
}

function TerrainPage() {
  return (
    <div className="mission-terrain-page rise-in">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-panel px-4 py-4 sm:px-6">
        <div>
          <Eyebrow>TIPO B / TIPO C · Modelos Regionales de Elevación (No Fotogrametría)</Eyebrow>
          <h1 className="font-display text-2xl font-bold text-bright sm:text-3xl">3D Regional DEM Explorer</h1>
          <p className="mt-1 text-sm text-fog">
            Inspecciona Marte a escala regional utilizando los 7 modelos GLB derivados de elevación. Para fotogrametría real de superficie de Curiosity, utiliza la pestaña Atlas de misiones.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2 font-mono text-[10px] text-sky-300">
          <span className="beacon-dot size-1.5 rounded-full bg-sky-400" /> TIPO B · DEM REGIONAL
        </div>
      </div>
      <MarsExplorer initialModelView="regional" immersive />
      <div className="grid gap-3 border-t border-line bg-panel p-4 sm:grid-cols-3 sm:p-5">
        <InfoTile icon={Mountain} title="Morfología regional" text="Compara provincias volcánicas, cuencas de impacto y casquetes polares." />
        <InfoTile icon={Crosshair} title="Distinción científica" text="Modelos derivados de altimetría orbital, diferenciados de la fotogrametría de Access Mars." />
        <InfoTile icon={ShieldCheck} title="Nota de planificación" text="Los modelos regionales son ayudas visuales; la altimetría cuantitativa proviene de la malla MOLA MEGDR." />
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
    </div>
  );
}

function RegionsPage({ onNavigate }: { onNavigate: (page: LabPage) => void }) {
  const [category, setCategory] = useState("All");
  const categories = ["All", "Major Regions", "Volcanoes", "Canyons & Valleys", "Craters & Basins", "Polar Regions", "Mission Sites"];
  const visible = category === "All" ? terrainLibrary : terrainLibrary.filter((item) => item.category === category);
  return (
    <div className="space-y-6 rise-in">
      <PageHeading eyebrow="Geological index · Visual Library" title="Mars Terrain Library" description="Browse the complete regional & mission-site cartographic library by geological family." icon={Layers3} />
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
                <span className="text-[10px] text-fog">TIPO D · Ortoimagen regional</span>
                <a href={region.image} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.08em] text-cyan hover:text-bright">Open image <ArrowRight className="size-3" /></a>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan/20 bg-cyan/5 p-5">
        <div><p className="font-display text-base font-bold text-bright">¿Quieres volver al Atlas de Misiones e Inspección 3D de Access Mars?</p><p className="mt-1 text-sm text-fog">Explora las 11 misiones, sus trayectorias y los terrenos fotogramétricos de Curiosity.</p></div>
        <button onClick={() => onNavigate("atlas")} className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-3 font-display text-sm font-bold text-[#1a0f06] hover:brightness-105"><Rocket className="size-4" /> Abrir Atlas de misiones</button>
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
      <PageHeading eyebrow="Expedition design" title="Mission Planner" description="Build a lightweight mission brief and keep the main decisions visible." icon={RouteIcon} />
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
          </div>
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
        </aside>
      </div>
    </div>
  );
}

function ResearchPage() {
  const topics = [
    { title: "Integración Access Mars (Tipo A)", icon: Mountain, detail: "Las 5 escenas del cráter Gale (Bradbury Landing, Pahrump Hills, Marias Pass, Murray Buttes y Vera Rubin Ridge) provienen de pares estereoscópicos Navcam/Mastcam procesados por NASA JPL OnSight y Google Creative Lab (Apache-2.0)." },
    { title: "Normalización Geodésica IAU Mars 2000", icon: Atom, detail: "Todas las misiones, trayectorias y descubrimientos utilizan latitud planetocéntrica (-90° a +90°), longitud Este (0°–360°E / -180° a +180°) y cota altimétrica sobre el areoide MGS MOLA." },
    { title: "Trazabilidad Científica (OFICIAL / DERIVADO / TERCEROS)", icon: Wind, detail: "Cada registro documenta su fuente institucional (NASA PDS, Mars Trek, ODE, Analyst's Notebook, USGS, CNSA), instrumento, resolución y nivel de validación." },
    { title: "Misiones Estáticas vs. Móviles", icon: Wrench, detail: "Los 4 landers fijos (Viking 1, Viking 2, Phoenix e InSight) se representan estrictamente en sus coordenadas de aterrizaje y área de trabajo del brazo robótico, sin inventar recorridos móviles." },
  ];
  return (
    <div className="space-y-6 rise-in">
      <PageHeading eyebrow="Arquitectura & Procedencia Científica" title="Documentación de Integración" description="Síntesis de reglas de calidad científica, normalización planetaria y fuentes primarias." icon={Database} />
      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((topic, index) => {
          const Icon = topic.icon;
          return <article key={topic.title} className="rounded-2xl border border-line bg-panel p-5 sm:p-6"><div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan"><Icon className="size-5" /></div><span className="font-mono text-[10px] text-fog">ARES-{String(index + 1).padStart(2, "0")}</span></div><h3 className="mt-5 font-display text-xl font-bold text-bright">{topic.title}</h3><p className="mt-2 text-sm leading-7 text-fog">{topic.detail}</p></article>;
        })}
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: typeof Globe2 }) {
  return <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-end"><div><Eyebrow>{eyebrow}</Eyebrow><h1 className="font-display text-3xl font-bold tracking-tight text-bright sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-fog">{description}</p></div><div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-amber/25 bg-amber/10 text-amber"><Icon className="size-5" /></div></div>;
}
function InfoTile({ icon: Icon, title, text }: { icon: typeof Globe2; title: string; text: string }) { return <div className="flex gap-3 rounded-xl border border-line bg-panel p-4"><Icon className="mt-0.5 size-4 shrink-0 text-cyan" /><div><p className="text-sm font-semibold text-bright">{title}</p><p className="mt-1 text-xs leading-5 text-fog">{text}</p></div></div>; }
function SmallMetric({ icon: Icon, label, value, detail }: { icon: typeof Globe2; label: string; value: string; detail: string }) { return <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4"><div className="grid size-10 place-items-center rounded-lg bg-amber/10 text-amber"><Icon className="size-4" /></div><div><p className="font-mono text-[9px] uppercase tracking-[.12em] text-fog">{label}</p><p className="mt-1 text-sm font-bold text-bright">{value}</p><p className="text-[10px] text-fog">{detail}</p></div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-fog">{label}</span>{children}</label>; }
function SummaryBox({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-line bg-panel p-3"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-fog">{label}</p><p className="mt-1 break-words font-display text-sm font-bold text-bright">{value}</p></div>; }
