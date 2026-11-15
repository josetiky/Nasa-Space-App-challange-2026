import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import {
  Activity,
  Award,
  Box,
  CalendarClock,
  CheckCircle2,
  Compass,
  Database,
  ExternalLink,
  Filter,
  Footprints,
  Globe2,
  Info,
  Layers,
  MapPin,
  Mountain,
  Pause,
  Play,
  Radio,
  Rocket,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Guarded3D } from "@/components/mission/Guarded3D";
import { Loading, btn, fmt } from "@/components/mission/ui";
import { MarsExplorer } from "@/components/MarsExplorer";
import type { EvaPlan } from "@/core/types";
import {
  CURIOSITY_ROVER_PARTS,
  EVA_SITES,
  type EvaPoi,
  type RoverPartPoi,
} from "@/data/evaSites";
import {
  ALL_SCIENTIFIC_DISCOVERIES,
  MARS_MISSIONS,
  PLANETARY_FEATURES,
  RECONSTRUCTION_LABELS,
  TERRAIN_INTELLIGENCE_SOURCES,
  computeMissionSolMetrics,
  type DiscoveryKind,
  type MarsMissionRecord,
  type MissionCategory,
  type PlanetaryFeature,
  type ScientificDiscovery,
  type ValidationLevel,
} from "@/data/marsMissionAtlas";
import { TREK_LAYERS, trekSnapshotTemplate, trekTemplate, type TrekLayerKey } from "@/services/nasa/adapters";
import { cn } from "@/lib/utils";

const SurfaceEva = lazy(() => import("@/components/explorer/SurfaceEva"));
const BoxworkTraverse = lazy(() => import("@/components/explorer/BoxworkTraverse"));

type ExperienceMode = "global" | "immersive" | "discoveries" | "terrain-intel" | "compare";
type ImmersiveSubmode = "access-mars" | "boxwork" | "regional-dem";

const VALIDATION_STYLE: Record<ValidationLevel, string> = {
  OFICIAL: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  DERIVADO: "border-sky-400/40 bg-sky-500/15 text-sky-300",
  TERCEROS: "border-amber-400/40 bg-amber-500/15 text-amber-300",
};

const CATEGORY_LABELS: Record<MissionCategory | "all", string> = {
  all: "Todas (11)",
  rover: "Rovers (6)",
  aerial: "Aérea (1)",
  lander: "Landers Fijos (4)",
};

const DISCOVERY_KIND_LABELS: Record<DiscoveryKind | "all", string> = {
  all: "Todos los hallazgos",
  sample: "Muestras recolectadas",
  drill: "Perforaciones",
  rock: "Rocas estudiadas",
  chemical: "Análisis químicos",
  experiment: "Experimentos",
  geology: "Formaciones geológicas",
  seismic: "Sismología (SEIS)",
  flight: "Vuelos atmosféricos",
};

interface TerrainOverlayToggles {
  missions: boolean;
  traverses: boolean;
  discoveries: boolean;
  craters: boolean;
  mountains: boolean;
  valleys: boolean;
  dunes: boolean;
  polar: boolean;
  mineralogy: boolean;
}

export function MarsMissionAtlasWorkspace({ initialMode = "global" }: { initialMode?: ExperienceMode }) {
  const [mode, setMode] = useState<ExperienceMode>(initialMode);
  const [immersiveSubmode, setImmersiveSubmode] = useState<ImmersiveSubmode>("access-mars");
  const [categoryFilter, setCategoryFilter] = useState<MissionCategory | "all">("all");
  const [selectedMissionId, setSelectedMissionId] = useState<string>("perseverance");
  const mission = useMemo(
    () => MARS_MISSIONS.find((m) => m.id === selectedMissionId) ?? MARS_MISSIONS[4]!,
    [selectedMissionId],
  );

  // Sol Timeline state synchronized with selected mission
  const [selectedSol, setSelectedSol] = useState<number>(mission.maxSol);
  const [playingTimeline, setPlayingTimeline] = useState<boolean>(false);

  useEffect(() => {
    setSelectedSol(mission.maxSol);
    setPlayingTimeline(false);
    if (mission.id === "curiosity") {
      setImmersiveSubmode("access-mars");
    }
  }, [mission.id, mission.maxSol]);

  useEffect(() => {
    if (!playingTimeline) return;
    const step = Math.max(1, Math.ceil(mission.maxSol / 120));
    const timer = window.setInterval(() => {
      setSelectedSol((prev) => {
        if (prev >= mission.maxSol) {
          setPlayingTimeline(false);
          return mission.maxSol;
        }
        return Math.min(mission.maxSol, prev + step);
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [playingTimeline, mission.maxSol]);

  const solMetrics = useMemo(
    () => computeMissionSolMetrics(mission, selectedSol),
    [mission, selectedSol],
  );

  // Selected discovery / feature / Access Mars scene
  const [selectedDiscovery, setSelectedDiscovery] = useState<ScientificDiscovery | null>(
    mission.discoveries[0] ?? null,
  );
  const [selectedFeature, setSelectedFeature] = useState<PlanetaryFeature | null>(null);
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryKind | "all">("all");

  useEffect(() => {
    setSelectedDiscovery(mission.discoveries[0] ?? null);
  }, [mission]);

  // Access Mars 3D state
  const [accessMarsSiteId, setAccessMarsSiteId] = useState<string>("landing_site");
  const accessMarsSite = useMemo(
    () => EVA_SITES.find((s) => s.id === accessMarsSiteId) ?? EVA_SITES[0]!,
    [accessMarsSiteId],
  );
  const [evaPlan, setEvaPlan] = useState<EvaPlan | null>(null);
  const [activeEvaPoi, setActiveEvaPoi] = useState<EvaPoi | null>(EVA_SITES[0]!.pois[0] ?? null);
  const [activeRoverPart, setActiveRoverPart] = useState<RoverPartPoi | null>(null);

  // Global Map state
  const [basemap, setBasemap] = useState<TrekLayerKey>("viking");
  const [basemapStatus, setBasemapStatus] = useState<"live" | "snapshot" | "offline">("live");
  const [overlays, setOverlays] = useState<TerrainOverlayToggles>({
    missions: true,
    traverses: true,
    discoveries: true,
    craters: true,
    mountains: true,
    valleys: true,
    dunes: true,
    polar: true,
    mineralogy: true,
  });

  const filteredMissions = useMemo(
    () =>
      categoryFilter === "all"
        ? MARS_MISSIONS
        : MARS_MISSIONS.filter((m) => m.category === categoryFilter),
    [categoryFilter],
  );

  const openImmersiveForMission = useCallback(
    (targetMission: MarsMissionRecord, sceneId?: string) => {
      setSelectedMissionId(targetMission.id);
      if (targetMission.id === "curiosity") {
        setAccessMarsSiteId(sceneId ?? "landing_site");
        setImmersiveSubmode("access-mars");
      } else {
        setImmersiveSubmode("regional-dem");
      }
      setMode("immersive");
    },
    [],
  );

  return (
    <div className="space-y-5">
      {/* Top Command Banner */}
      <section className="rounded-3xl border border-line bg-panel/90 p-4 shadow-xl backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/35 bg-amber/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-amber">
                <Rocket className="size-3.5" /> M.I.Y.H. · MARS IN YOUR HANDS
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 font-mono text-[9.5px] text-emerald-300">
                <CheckCircle2 className="size-3" /> 11 Misiones · 7 Fuentes Terrain Intelligence · Access Mars 3D
              </span>
              <span className="rounded-full border border-line bg-ink2/80 px-2.5 py-1 font-mono text-[9.5px] text-fog">
                CRS: IAU Mars 2000 Planetocentric · MOLA Areoid
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-bright sm:text-4xl">
              Atlas Interactivo de la Exploración Planetaria de Marte
            </h1>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-fog sm:text-sm">
              Explora en un solo sistema geoespacial las 11 misiones de superficie y aéreas (NASA, ESA, CNSA), sus trayectorias reales Sol a Sol, las reconstrucciones 3D fotogramétricas de <strong className="text-bright">Access Mars (NASA JPL OnSight)</strong> y el catálogo de descubrimientos científicos con trazabilidad oficial.
            </p>
          </div>

          {/* Primary Experience Switcher */}
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-ink2/90 p-1.5" role="tablist">
            {(
              [
                ["global", "Modo 1 · Global Mars Explorer", Globe2],
                ["immersive", "Modo 2 · Immersive 3D Explorer", Box],
                ["discoveries", "Scientific Discoveries", Sparkles],
                ["terrain-intel", "Terrain Intelligence (7)", Layers],
                ["compare", "Comparar 11 Misiones", Award],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 font-display text-xs font-semibold transition",
                  mode === id
                    ? "bg-amber text-[#1a0f06] shadow-md shadow-amber/20"
                    : "text-fog hover:bg-panel hover:text-bright",
                )}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mission Selector Strip (11 Missions) */}
        <div className="mt-5 border-t border-line/70 pt-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[.16em] text-fog">
                Catálogo de Misiones:
              </span>
              {(Object.keys(CATEGORY_LABELS) as Array<MissionCategory | "all">).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.1em] transition",
                    categoryFilter === cat
                      ? "border-cyan/50 bg-cyan/15 text-cyan"
                      : "border-line bg-ink2/60 text-fog hover:text-bright",
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-fog">
              <span className="inline-flex items-center gap-1 rounded border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                OFICIAL
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                DERIVADO
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                TERCEROS
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-11">
            {filteredMissions.map((m) => {
              const active = m.id === mission.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMissionId(m.id)}
                  className={cn(
                    "group flex flex-col justify-between rounded-xl border p-2.5 text-left transition",
                    active
                      ? "border-amber/60 bg-amber/15 ring-1 ring-amber/35"
                      : "border-line/80 bg-ink2/60 hover:border-amber/30 hover:bg-panel",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="font-mono text-[8.5px] uppercase tracking-[.1em] text-fog">
                      {m.category === "rover" ? "ROVER" : m.category === "aerial" ? "HELI" : "LANDER"}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate font-display text-xs font-bold text-bright">
                    {m.name}
                  </p>
                  <p className="truncate font-mono text-[9px] text-fog">{m.region.split(",")[0]}</p>
                  <div className="mt-1.5 flex items-center justify-between border-t border-line/50 pt-1 font-mono text-[8.5px]">
                    <span className={m.status === "ACTIVE" ? "text-mint" : "text-fog"}>
                      {m.status === "ACTIVE" ? "● ACTIVA" : `Sol ${m.maxSol}`}
                    </span>
                    <span className="text-bright">
                      {m.totalTraverseKm !== null ? `${m.totalTraverseKm} km` : "Fijo"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Mission Sol Timeline Bar */}
        <div className="mt-4 rounded-2xl border border-cyan/25 bg-ink2/85 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="size-4 text-cyan" />
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[.18em] text-cyan">
                  Mission Sol Timeline · {mission.fullName}
                </p>
                <p className="text-xs text-fog">
                  {mission.hasMobileTraverse
                    ? `Selecciona un Sol (1 – ${mission.maxSol}) para actualizar posición, trayectoria acumulada, perfil topográfico y descubrimientos.`
                    : `Estación fija de superficie (${mission.maxSol} soles operativos). Filtra cronológicamente los experimentos documentados sin fabricar trayectorias móviles.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedSol >= mission.maxSol) setSelectedSol(1);
                  setPlayingTimeline((p) => !p);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/40 bg-cyan/15 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-cyan hover:bg-cyan/25"
              >
                {playingTimeline ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {playingTimeline ? "Pausar Sol" : "Reproducir Misión"}
              </button>
              <span className="rounded-lg border border-line bg-panel px-3 py-1.5 font-mono text-xs font-bold text-bright">
                Sol <span className="text-amber">{solMetrics.currentSol}</span> / {mission.maxSol}
              </span>
              <button
                type="button"
                onClick={() => openImmersiveForMission(mission, solMetrics.activeWaypoint?.accessMarsSceneId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#1a0f06] hover:brightness-105"
              >
                <Box className="size-3.5" />
                {mission.id === "curiosity"
                  ? "Abrir Terreno 3D Access Mars"
                  : "Explorar Región en 3D"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="font-mono text-[10px] text-fog">Sol 1</span>
            <input
              type="range"
              min={1}
              max={Math.max(1, mission.maxSol)}
              value={solMetrics.currentSol}
              onChange={(e) => {
                setPlayingTimeline(false);
                setSelectedSol(Number(e.target.value));
              }}
              className="h-2 flex-1 cursor-pointer accent-amber"
              aria-label="Selector de Sol de la misión"
            />
            <span className="font-mono text-[10px] text-fog">Sol {mission.maxSol}</span>
          </div>

          {/* Waypoint Quick-Jump Chips */}
          {mission.waypoints.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">
                Hitos del recorrido:
              </span>
              {mission.waypoints.map((wp) => {
                const reached = wp.sol <= solMetrics.currentSol;
                const current = solMetrics.activeWaypoint?.sol === wp.sol;
                return (
                  <button
                    key={wp.sol}
                    type="button"
                    onClick={() => {
                      setPlayingTimeline(false);
                      setSelectedSol(wp.sol);
                    }}
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-mono text-[9.5px] transition",
                      current
                        ? "border-amber bg-amber/20 font-semibold text-amber"
                        : reached
                          ? "border-cyan/35 bg-cyan/10 text-cyan hover:border-cyan"
                          : "border-line bg-panel/60 text-fog hover:text-bright",
                    )}
                  >
                    Sol {wp.sol} · {wp.label}
                    {wp.accessMarsSceneId ? " ★ 3D" : ""}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* ====================================================================
       * MODO 1 — GLOBAL MARS EXPLORER
       * ==================================================================== */}
      {mode === "global" ? (
        <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)_390px]">
          {/* Left Panel: Terrain Intelligence Layers & Filters */}
          <aside className="space-y-4 rounded-2xl border border-line bg-panel/85 p-4">
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-[.2em] text-amber">
                Control Cartográfico
              </p>
              <h2 className="mt-0.5 font-display text-base font-bold text-bright">
                Mapa Base &amp; Capas Planetarias
              </h2>
            </div>

            <div className="space-y-1.5">
              <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">
                Mosaico Orbital (NASA Mars Trek WMTS)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(TREK_LAYERS) as TrekLayerKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBasemap(key)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left font-mono text-[10px] transition",
                      basemap === key
                        ? "border-amber/50 bg-amber/15 text-amber"
                        : "border-line bg-ink2/60 text-fog hover:text-bright",
                    )}
                  >
                    <p className="font-semibold">
                      {key === "viking" ? "Viking MDIM 2.1" : "MOLA Shaded Relief"}
                    </p>
                    <p className="text-[8.5px] opacity-80">
                      {key === "viking" ? "232 m/px Color" : "463 m/px Altimetry"}
                    </p>
                  </button>
                ))}
              </div>
              <p className="font-mono text-[9px] text-fog">
                Estado WMTS:{" "}
                <span className={basemapStatus === "live" ? "text-mint" : "text-amber"}>
                  {basemapStatus === "live"
                    ? "NASA Mars Trek (En vivo)"
                    : basemapStatus === "snapshot"
                      ? "Snapshot Offline Local"
                      : "Mosaico de respaldo"}
                </span>
              </p>
            </div>

            <div className="space-y-2 border-t border-line/70 pt-3">
              <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">
                Capas Vectoriales y Geomorfológicas
              </p>
              {(
                [
                  ["missions", "11 Sitios de Aterrizaje (NASA/CNSA)", "OFICIAL", "#f4f1ea"],
                  ["traverses", "Trayectorias Reales por Sol (MMGIS/PDS)", "OFICIAL", mission.color],
                  ["discoveries", "Descubrimientos & Muestras", "OFICIAL", "#38bdf8"],
                  ["craters", "Cráteres y Cuencas de Impacto", "OFICIAL", "#f59e0b"],
                  ["mountains", "Volcanes y Montes (Tharsis/Elysium)", "OFICIAL", "#ef4444"],
                  ["valleys", "Valles y Canales de Desbordamiento", "OFICIAL", "#22d3ee"],
                  ["dunes", "Campos de Dunas Eólicas Activas", "OBSERVED", "#eab308"],
                  ["polar", "Depósitos Estratificados Polares", "OFICIAL", "#93c5fd"],
                  ["mineralogy", "Unidades Geológicas y Mineralogía CRISM", "DERIVADO", "#c084fc"],
                ] as const
              ).map(([key, label, badge, dotColor]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line/60 bg-ink2/50 px-2.5 py-1.5 text-xs hover:border-amber/30"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={overlays[key]}
                      onChange={(e) =>
                        setOverlays((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="accent-amber"
                    />
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="text-[11.5px] text-bright">{label}</span>
                  </span>
                  <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[8px] text-fog">
                    {badge}
                  </span>
                </label>
              ))}
            </div>

            {/* Geomorphological Feature Quick-Jump */}
            <div className="space-y-1.5 border-t border-line/70 pt-3">
              <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">
                Regiones y Formaciones Destacadas
              </p>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {PLANETARY_FEATURES.map((feat) => (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={() => setSelectedFeature(feat)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition",
                      selectedFeature?.id === feat.id
                        ? "border-cyan/50 bg-cyan/15 text-cyan"
                        : "border-transparent bg-ink2/40 text-fog hover:border-line hover:text-bright",
                    )}
                  >
                    <span className="truncate font-medium text-bright">{feat.name}</span>
                    <span className="ml-2 shrink-0 font-mono text-[9px] uppercase text-fog">
                      {feat.elevationM > 0 ? `+${feat.elevationM}m` : `${feat.elevationM}m`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Center: Interactive Global Mars Map + Elevation Profile */}
          <div className="flex flex-col gap-4">
            <div className="relative h-[58vh] min-h-[430px] overflow-hidden rounded-2xl border border-line bg-black">
              <GlobalMarsLeafletMap
                basemap={basemap}
                overlays={overlays}
                selectedMission={mission}
                solMetrics={solMetrics}
                selectedDiscovery={selectedDiscovery}
                selectedFeature={selectedFeature}
                onSelectMission={(mId) => setSelectedMissionId(mId)}
                onSelectDiscovery={(d) => setSelectedDiscovery(d)}
                onSelectFeature={(f) => setSelectedFeature(f)}
                onBasemapStatus={setBasemapStatus}
              />
              <div className="pointer-events-none absolute left-3 top-3 z-[500] flex flex-wrap gap-1.5">
                <span className="rounded-lg border border-white/15 bg-black/75 px-2.5 py-1 font-mono text-[10px] text-white backdrop-blur">
                  Misión activa: <strong className="text-amber">{mission.name}</strong> ·{" "}
                  { `${Math.abs(solMetrics.lat).toFixed(4)}°${solMetrics.lat >= 0 ? "N" : "S"}, ${solMetrics.lon360.toFixed(4)}°E` }{" "}
                  · Cota MOLA: <strong className="text-cyan">{solMetrics.elevationM} m</strong>
                </span>
              </div>
            </div>

            {/* Geospatial Traverse Analysis & Topographic Profile */}
            <section className="rounded-2xl border border-line bg-panel/85 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[9.5px] uppercase tracking-[.18em] text-amber">
                    Análisis Geoespacial y Perfil Topográfico (Sol 1 → Sol {solMetrics.currentSol})
                  </p>
                  <h3 className="font-display text-base font-bold text-bright">
                    {mission.hasMobileTraverse
                      ? `Recorrido y Altimetría de ${mission.name} en ${mission.region}`
                      : `${mission.name} — Estación Fija en ${mission.landingSiteName} (Sin trayectoria móvil)`}
                  </h3>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 font-mono text-[9.5px]",
                    VALIDATION_STYLE[mission.metadata.validation],
                  )}
                >
                  {mission.metadata.validation} · {mission.metadata.instrument}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                <div className="rounded-xl border border-line bg-ink2/70 p-2.5">
                  <p className="font-mono text-[9px] uppercase text-fog">Distancia al Sol {solMetrics.currentSol}</p>
                  <p className="mt-1 font-display text-base font-bold text-bright">
                    {mission.hasMobileTraverse ? `${solMetrics.distanceKm} km` : "0 km (Lander fijo)"}
                  </p>
                  <p className="font-mono text-[8.5px] text-fog">
                    Total misión: {mission.totalTraverseKm !== null ? `${mission.totalTraverseKm} km` : "Estático"}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-ink2/70 p-2.5">
                  <p className="font-mono text-[9px] uppercase text-fog">Cota Actual (MOLA)</p>
                  <p className="mt-1 font-display text-base font-bold text-cyan">
                    {solMetrics.elevationM} m
                  </p>
                  <p className="font-mono text-[8.5px] text-fog">Sobre el areoide MOLA</p>
                </div>
                <div className="rounded-xl border border-line bg-ink2/70 p-2.5">
                  <p className="font-mono text-[9px] uppercase text-fog">Desnivel Acumulado</p>
                  <p className="mt-1 font-display text-base font-bold text-mint">
                    +{solMetrics.cumulativeGainM} m / -{solMetrics.cumulativeLossM} m
                  </p>
                  <p className="font-mono text-[8.5px] text-fog">
                    Cambio neto: {solMetrics.netElevationChangeM >= 0 ? `+${solMetrics.netElevationChangeM}` : solMetrics.netElevationChangeM} m
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-ink2/70 p-2.5">
                  <p className="font-mono text-[9px] uppercase text-fog">Pendiente Media / Máx</p>
                  <p className="mt-1 font-display text-base font-bold text-amber">
                    {solMetrics.meanSlopeDeg}° / {solMetrics.maxSlopeDeg}°
                  </p>
                  <p className="font-mono text-[8.5px] text-fog">Calculada entre waypoints</p>
                </div>
                <div className="rounded-xl border border-line bg-ink2/70 p-2.5">
                  <p className="font-mono text-[9px] uppercase text-fog">Hallazgos al Sol {solMetrics.currentSol}</p>
                  <p className="mt-1 font-display text-base font-bold text-bright">
                    {solMetrics.discoveriesUpToSol.length} / {mission.discoveries.length}
                  </p>
                  <p className="font-mono text-[8.5px] text-fog">Georreferenciados</p>
                </div>
              </div>

              {mission.hasMobileTraverse && solMetrics.profile.length > 1 ? (
                <div className="mt-3 h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={solMetrics.profile}
                      margin={{ top: 8, right: 14, bottom: 0, left: -10 }}
                    >
                      <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
                      <XAxis
                        dataKey="distanceKm"
                        type="number"
                        domain={[0, "dataMax"]}
                        tick={{ fontSize: 10, fill: "var(--fog)" }}
                        tickFormatter={(v: number) => `${v.toFixed(1)} km`}
                      />
                      <YAxis
                        dataKey="elevationM"
                        tick={{ fontSize: 10, fill: "var(--fog)" }}
                        domain={["auto", "auto"]}
                        tickFormatter={(v: number) => `${Math.round(v)} m`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--panel)",
                          border: "1px solid var(--line)",
                          fontSize: 11,
                        }}
                        formatter={(v: number) => [`${v} m MOLA`, "Elevación"]}
                        labelFormatter={(d: number) => `Km ${Number(d).toFixed(2)} del recorrido`}
                      />
                      <Area
                        type="monotone"
                        dataKey="elevationM"
                        stroke={mission.color}
                        fill={mission.color}
                        fillOpacity={0.18}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      <ReferenceLine
                        x={solMetrics.distanceKm}
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-line/60 bg-ink2/40 px-3 py-2 text-xs text-fog">
                  {mission.odometryNote}
                </p>
              )}
            </section>
          </div>

          {/* Right Panel: Mission Details, Instruments & Active Discovery */}
          <aside className="space-y-4">
            <MissionDossierCard
              mission={mission}
              solMetrics={solMetrics}
              onOpenImmersive={(sceneId) => openImmersiveForMission(mission, sceneId)}
              onSelectDiscovery={(d) => setSelectedDiscovery(d)}
            />
            {selectedDiscovery ? (
              <DiscoveryDetailCard
                discovery={selectedDiscovery}
                onClose={() => setSelectedDiscovery(null)}
              />
            ) : null}
            {selectedFeature ? (
              <FeatureDetailCard
                feature={selectedFeature}
                onClose={() => setSelectedFeature(null)}
                onOpen3D={() => {
                  setImmersiveSubmode("regional-dem");
                  setMode("immersive");
                }}
              />
            ) : null}
          </aside>
        </div>
      ) : null}

      {/* ====================================================================
       * MODO 2 — IMMERSIVE MISSION EXPLORER (Access Mars 3D + Rover + DEM)
       * ==================================================================== */}
      {mode === "immersive" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel/85 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  [
                    "access-mars",
                    "Curiosity · 5 Escenas Fotogramétricas Access Mars + Rover 3D",
                    "TYPE_A_PHOTOGRAMMETRY",
                  ],
                  [
                    "boxwork",
                    "Curiosity · Mount Sharp Boxwork Traverse (HiRISE + MMGIS 2025)",
                    "TYPE_D_ORBITAL_DRAPE",
                  ],
                  [
                    "regional-dem",
                    "Modelos Regionales 3D & Misiones (DEM / Bloques GLB)",
                    "TYPE_B_DEM",
                  ],
                ] as const
              ).map(([sub, label, recType]) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setImmersiveSubmode(sub)}
                  className={cn(
                    "rounded-xl border px-3.5 py-2 text-left transition",
                    immersiveSubmode === sub
                      ? "border-amber/60 bg-amber/15 text-bright"
                      : "border-line bg-ink2/60 text-fog hover:text-bright",
                  )}
                >
                  <p className="font-display text-xs font-bold">{label}</p>
                  <p
                    className="font-mono text-[9px]"
                    style={{ color: RECONSTRUCTION_LABELS[recType].color }}
                  >
                    {RECONSTRUCTION_LABELS[recType].badge}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {immersiveSubmode === "access-mars" ? (
            <div className="space-y-3">
              {/* 5 Photogrammetric Scenes Selector */}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {EVA_SITES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setAccessMarsSiteId(s.id);
                      setActiveEvaPoi(s.pois[0] ?? null);
                      setActiveRoverPart(null);
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      s.id === accessMarsSite.id
                        ? "border-emerald-400/50 bg-emerald-500/10"
                        : "border-line bg-panel/70 hover:border-amber/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] uppercase text-emerald-300">
                        {s.solRange}
                      </span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[8px] text-emerald-200">
                        TIPO A · 3D REAL
                      </span>
                    </div>
                    <p className="mt-1 font-display text-sm font-bold text-bright">{s.name}</p>
                    <p className="font-mono text-[9.5px] text-fog">
                      {s.traverseDistance} · {s.capturedDate}
                    </p>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
                <div className="relative h-[66vh] min-h-[460px] overflow-hidden rounded-2xl border border-line bg-black">
                  <Suspense
                    fallback={
                      <div className="grid h-full place-items-center">
                        <Loading text="Cargando malla fotogramétrica Draco y rover 3D de Access Mars…" />
                      </div>
                    }
                  >
                    <Guarded3D what="El motor 3D de Access Mars">
                      <SurfaceEva
                        key={accessMarsSite.id}
                        site={accessMarsSite}
                        initial={evaPlan}
                        onPlan={setEvaPlan}
                        onPoi={(poi) => {
                          setActiveRoverPart(null);
                          setActiveEvaPoi(poi);
                        }}
                        activePoi={activeEvaPoi}
                        activeRoverPart={activeRoverPart}
                        onSelectRoverPart={(part) => {
                          setActiveEvaPoi(null);
                          setActiveRoverPart(part);
                        }}
                      />
                    </Guarded3D>
                  </Suspense>
                </div>

                {/* Right Sidebar: Katie Stack Morgan Audio + POI / Rover Inspector */}
                <aside className="space-y-4">
                  {/* Reconstruction Transparency Notice */}
                  <section className="rounded-2xl border border-emerald-400/35 bg-emerald-950/20 p-3.5">
                    <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[.16em] text-emerald-300">
                      {RECONSTRUCTION_LABELS.TYPE_A_PHOTOGRAMMETRY.badge}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-fog">
                      {RECONSTRUCTION_LABELS.TYPE_A_PHOTOGRAMMETRY.detail} Coordenadas ancladas en Gale:{" "}
                      <strong className="text-bright">
                        {accessMarsSite.planetocentricCoord.lat}°N,{" "}
                        {accessMarsSite.planetocentricCoord.lon}°E (
                        {accessMarsSite.planetocentricCoord.elevationM} m MOLA)
                      </strong>
                      .
                    </p>
                  </section>

                  {/* Active Terrain POI or Rover Part Card with Real JPL Voiceover */}
                  {activeEvaPoi ? (
                    <section className="overflow-hidden rounded-2xl border border-cyan/40 bg-panel/90">
                      <img
                        src={activeEvaPoi.image}
                        alt={activeEvaPoi.title}
                        className="h-40 w-full object-cover"
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-cyan">
                              Punto de Interés Fotogramétrico · {accessMarsSite.name}
                            </p>
                            <h3 className="mt-0.5 font-display text-base font-bold text-bright">
                              {activeEvaPoi.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveEvaPoi(null)}
                            className="text-fog hover:text-bright"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-fog">
                          {activeEvaPoi.text}
                        </p>
                        {activeEvaPoi.vo ? (
                          <div className="mt-3 rounded-xl border border-line bg-ink2/80 p-2.5">
                            <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] text-amber">
                              <Volume2 className="size-3.5" /> Narración original NASA JPL — Katie Stack Morgan:
                            </p>
                            <audio
                              key={activeEvaPoi.vo}
                              controls
                              preload="none"
                              className="h-8 w-full"
                              src={activeEvaPoi.vo}
                            />
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {activeRoverPart ? (
                    <section className="overflow-hidden rounded-2xl border border-amber/40 bg-panel/90">
                      <img
                        src={activeRoverPart.image}
                        alt={activeRoverPart.title}
                        className="h-40 w-full object-cover"
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-amber">
                              Subsistema 3D del Rover Curiosity (/eva/rover/scene.glb)
                            </p>
                            <h3 className="mt-0.5 font-display text-base font-bold text-bright">
                              {activeRoverPart.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveRoverPart(null)}
                            className="text-fog hover:text-bright"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-fog">
                          {activeRoverPart.text}
                        </p>
                        <div className="mt-3 rounded-xl border border-line bg-ink2/80 p-2.5">
                          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] text-amber">
                            <Volume2 className="size-3.5" /> Locución de instrumento (Katie Stack Morgan · JPL):
                          </p>
                          <audio
                            key={activeRoverPart.vo}
                            controls
                            preload="none"
                            className="h-8 w-full"
                            src={activeRoverPart.vo}
                          />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {/* Interactive Selector for the 6 Curiosity Rover Subsystems */}
                  <section className="rounded-2xl border border-line bg-panel/85 p-4">
                    <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-amber">
                      Inspector 3D del Rover Curiosity (Access Mars)
                    </p>
                    <p className="mt-1 text-xs text-fog">
                      Selecciona cualquier subsistema del modelo 3D de Curiosity para escuchar la explicación de NASA JPL y ver su fotografía técnica:
                    </p>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {CURIOSITY_ROVER_PARTS.map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => {
                            setActiveEvaPoi(null);
                            setActiveRoverPart(part);
                          }}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-left font-mono text-[10px] transition",
                            activeRoverPart?.id === part.id
                              ? "border-amber bg-amber/15 text-amber"
                              : "border-line bg-ink2/60 text-fog hover:text-bright",
                          )}
                        >
                          ⚙ {part.title.split(" (")[0]}
                        </button>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          ) : immersiveSubmode === "boxwork" ? (
            <Suspense
              fallback={
                <div className="grid h-[60vh] place-items-center">
                  <Loading text="Cargando Boxwork Traverse…" />
                </div>
              }
            >
              <BoxworkTraverse />
            </Suspense>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-sky-400/35 bg-sky-950/25 p-3.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-sky-300">
                  {RECONSTRUCTION_LABELS.TYPE_B_DEM.badge} · DISTINCIÓN CIENTÍFICA ESTRICTA
                </p>
                <p className="mt-1 text-xs text-fog">
                  {RECONSTRUCTION_LABELS.TYPE_B_DEM.detail} Nunca se presenta un modelo regional DEM como si fuera una reconstrucción fotogramétrica de superficie.
                </p>
              </div>
              <MarsExplorer initialModelView="regional" immersive />
            </div>
          )}
        </div>
      ) : null}

      {/* ====================================================================
       * MODO 3 — SCIENTIFIC DISCOVERIES CATALOGUE
       * ==================================================================== */}
      {mode === "discoveries" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel/85 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="mr-1 size-4 text-amber" />
              {(Object.keys(DISCOVERY_KIND_LABELS) as Array<DiscoveryKind | "all">).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDiscoveryFilter(k)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase transition",
                    discoveryFilter === k
                      ? "border-amber/50 bg-amber/15 text-amber"
                      : "border-line bg-ink2/60 text-fog hover:text-bright",
                  )}
                >
                  {DISCOVERY_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <span className="font-mono text-[10.5px] text-fog">
              {
                ALL_SCIENTIFIC_DISCOVERIES.filter(
                  (d) => discoveryFilter === "all" || d.kind === discoveryFilter,
                ).length
              }{" "}
              descubrimientos georreferenciados con trazabilidad
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ALL_SCIENTIFIC_DISCOVERIES.filter(
              (d) => discoveryFilter === "all" || d.kind === discoveryFilter,
            ).map((disc) => {
              const parentMission = MARS_MISSIONS.find((m) => m.id === disc.missionId)!;
              return (
                <article
                  key={disc.id}
                  className="flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-panel/85 transition hover:border-amber/40"
                >
                  <div>
                    <div className="relative h-40 w-full overflow-hidden bg-ink2">
                      <img
                        src={disc.imageUrl}
                        alt={disc.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span
                        className={cn(
                          "absolute left-3 top-3 rounded-full border px-2.5 py-0.5 font-mono text-[9px] backdrop-blur",
                          VALIDATION_STYLE[disc.metadata.validation],
                        )}
                      >
                        {disc.metadata.validation}
                      </span>
                      <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 font-mono text-[9.5px] text-white">
                        {parentMission.name} · Sol {disc.sol}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-amber">
                        {DISCOVERY_KIND_LABELS[disc.kind]} · {disc.instrument}
                      </p>
                      <h3 className="mt-1 font-display text-base font-bold text-bright">
                        {disc.title}
                      </h3>
                      <p className="mt-1 font-mono text-[10px] text-cyan">
                        {disc.locationName} ({disc.lat.toFixed(4)}°N, {disc.lon360.toFixed(4)}°E ·{" "}
                        {disc.elevationM} m MOLA)
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-fog">{disc.description}</p>
                      <p className="mt-2 rounded-lg border border-line/60 bg-ink2/60 p-2 text-[11px] text-fog">
                        <strong className="text-bright">Contexto geológico:</strong>{" "}
                        {disc.geologicalContext}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-line/60 bg-ink2/40 px-4 py-3">
                    <p className="truncate font-mono text-[9.5px] text-fog" title={disc.publicationTitle}>
                      Ref: {disc.publicationTitle}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMissionId(disc.missionId);
                          setSelectedSol(disc.sol);
                          setSelectedDiscovery(disc);
                          setMode("global");
                        }}
                        className="font-mono text-[10px] font-semibold text-amber hover:underline"
                      >
                        Ver en Mapa Global (Sol {disc.sol}) →
                      </button>
                      <a
                        href={disc.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan hover:underline"
                      >
                        Fuente PDS/NASA <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ====================================================================
       * MODO 4 — TERRAIN INTELLIGENCE (7 FUENTES ORBITALES & REGLAS DE INTEGRACIÓN)
       * ==================================================================== */}
      {mode === "terrain-intel" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-panel/85 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-amber">
              Inteligencia del Terreno Planetario
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-bright">
              Fuentes Orbitales, Espectrales y Topográficas Integradas
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-fog sm:text-sm">
              Cada producto de terreno se clasifica explícitamente entre <strong className="text-emerald-300">DATOS OBSERVADOS</strong> (mediciones instrumentales directas), <strong className="text-sky-300">DATOS PROCESADOS</strong> (modelos digitales de elevación, inercia térmica, cubos hiperespectrales) e <strong className="text-amber-300">INTERPRETACIONES CIENTÍFICAS</strong> (unidades cronoestratigráficas).
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">
                    <th className="py-2.5 pr-3">Instrumento</th>
                    <th className="px-3 py-2.5">Nave / Agencia</th>
                    <th className="px-3 py-2.5">Resolución Espacial / Vertical</th>
                    <th className="px-3 py-2.5">Rango Espectral</th>
                    <th className="px-3 py-2.5">Aplicación en el Atlas</th>
                    <th className="px-3 py-2.5">Naturaleza del Dato</th>
                    <th className="py-2.5 pl-3">Fuente Oficial</th>
                  </tr>
                </thead>
                <tbody>
                  {TERRAIN_INTELLIGENCE_SOURCES.map((src) => (
                    <tr key={src.id} className="border-b border-line/50">
                      <td className="py-3 pr-3">
                        <p className="font-display text-sm font-bold text-bright">{src.acronym}</p>
                        <p className="text-[11px] text-fog">{src.name}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-bright">
                        {src.spacecraft}
                        <br />
                        <span className="text-[10px] text-fog">{src.agency}</span>
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-fog">{src.spatialResolution}</td>
                      <td className="px-3 py-3 text-[11.5px] text-fog">{src.spectralRange}</td>
                      <td className="px-3 py-3 text-[11.5px] text-bright">
                        {src.application}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {src.layerCapabilities.map((cap) => (
                            <span
                              key={cap}
                              className="rounded border border-line bg-ink2 px-1.5 py-0.5 font-mono text-[9px] text-amber"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 font-mono text-[9px]",
                            src.dataDistinction === "OBSERVED"
                              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                              : src.dataDistinction === "PROCESSED"
                                ? "border-sky-400/40 bg-sky-500/15 text-sky-300"
                                : "border-amber-400/40 bg-amber-500/15 text-amber-300",
                          )}
                        >
                          {src.dataDistinction} ({src.validation})
                        </span>
                      </td>
                      <td className="py-3 pl-3">
                        <a
                          href={src.officialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[10.5px] text-cyan hover:underline"
                        >
                          Archivo Oficial <ExternalLink className="size-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ====================================================================
       * MODO 5 — COMPARACIÓN DE LAS 11 MISIONES
       * ==================================================================== */}
      {mode === "compare" ? (
        <div className="rounded-2xl border border-line bg-panel/85 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-amber">
            Matriz Comparativa Multidisciplinaria
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-bright">
            Catálogo Completo de las 11 Misiones Marcianas (1976 – 2026)
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead>
                <tr className="border-b border-line font-mono text-[9.5px] uppercase tracking-[.14em] text-fog">
                  <th className="py-2.5 pr-3">Misión</th>
                  <th className="px-3 py-2.5">Agencia / Tipo</th>
                  <th className="px-3 py-2.5">Aterrizaje (UTC)</th>
                  <th className="px-3 py-2.5">Estado / Soles</th>
                  <th className="px-3 py-2.5">Coordenadas IAU Mars 2000</th>
                  <th className="px-3 py-2.5">Cota MOLA</th>
                  <th className="px-3 py-2.5">Recorrido Real</th>
                  <th className="px-3 py-2.5">Reconstrucción 3D</th>
                  <th className="py-2.5 pl-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {MARS_MISSIONS.map((m) => (
                  <tr key={m.id} className="border-b border-line/50 hover:bg-ink2/40">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        <div>
                          <p className="font-display text-sm font-bold text-bright">{m.name}</p>
                          <p className="text-[10.5px] text-fog">{m.landingSiteName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[10.5px] text-bright">
                      {m.agency}
                      <br />
                      <span className="uppercase text-fog">{m.category}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[10.5px] text-fog">
                      {m.landingDateUtc.slice(0, 10)}
                    </td>
                    <td className="px-3 py-3 font-mono text-[10.5px]">
                      <span className={m.status === "ACTIVE" ? "text-mint" : "text-bright"}>
                        {m.status}
                      </span>
                      <br />
                      <span className="text-fog">{m.maxSol} soles</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[10.5px] text-cyan">
                      {Math.abs(m.lat).toFixed(4)}°{m.lat >= 0 ? "N" : "S"},{" "}
                      {m.lon360.toFixed(4)}°E
                    </td>
                    <td className="px-3 py-3 font-mono text-[10.5px] text-bright">
                      {m.elevationM} m
                    </td>
                    <td className="px-3 py-3 font-mono text-[10.5px] text-bright">
                      {m.totalTraverseKm !== null ? `${m.totalTraverseKm} km` : "Lander fijo"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.reconstructionTypes.map((rt) => (
                          <span
                            key={rt}
                            className="rounded border border-line bg-ink2 px-1.5 py-0.5 font-mono text-[8.5px]"
                            style={{ color: RECONSTRUCTION_LABELS[rt].color }}
                          >
                            {RECONSTRUCTION_LABELS[rt].badge.split(" · ")[0]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pl-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMissionId(m.id);
                          setMode("global");
                        }}
                        className="rounded-lg border border-amber/40 bg-amber/15 px-2.5 py-1 font-mono text-[10px] text-amber hover:bg-amber/25"
                      >
                        Inspeccionar →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================================
 * SUBCOMPONENTS: Global Leaflet Map, Mission Dossier, Discovery & Feature Cards
 * ============================================================================ */

function GlobalMarsLeafletMap({
  basemap,
  overlays,
  selectedMission,
  solMetrics,
  selectedDiscovery,
  selectedFeature,
  onSelectMission,
  onSelectDiscovery,
  onSelectFeature,
  onBasemapStatus,
}: {
  basemap: TrekLayerKey;
  overlays: TerrainOverlayToggles;
  selectedMission: MarsMissionRecord;
  solMetrics: ReturnType<typeof computeMissionSolMetrics>;
  selectedDiscovery: ScientificDiscovery | null;
  selectedFeature: PlanetaryFeature | null;
  onSelectMission: (id: string) => void;
  onSelectDiscovery: (d: ScientificDiscovery) => void;
  onSelectFeature: (f: PlanetaryFeature) => void;
  onBasemapStatus: (s: "live" | "snapshot" | "offline") => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const baseLayer = useRef<Leaflet.TileLayer | null>(null);
  const vectorGroup = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      const lib =
        (mod as unknown as { default?: typeof Leaflet }).default ??
        (mod as unknown as typeof Leaflet);
      L.current = lib;
      const m = lib.map(el.current, {
        crs: lib.CRS.EPSG4326,
        center: [selectedMission.lat, selectedMission.lon],
        zoom: 3,
        minZoom: 1,
        maxZoom: 8,
        worldCopyJump: false,
      });
      m.attributionControl.setPrefix("Leaflet · IAU Mars 2000");
      vectorGroup.current = lib.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switcher
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    baseLayer.current?.remove();
    const spec = TREK_LAYERS[basemap];
    let loaded = 0;
    let errors = 0;
    let usingSnapshot = false;
    const layer = lib.tileLayer(trekTemplate(basemap), {
      tileSize: 256,
      noWrap: true,
      bounds: [
        [-90, -180],
        [90, 180],
      ],
      maxNativeZoom: spec.maxNativeZoom,
      maxZoom: 8,
      attribution: `${spec.label} · NASA Mars Trek`,
    });
    layer.on("tileload", () => {
      loaded += 1;
      onBasemapStatus(usingSnapshot ? "snapshot" : "live");
    });
    layer.on("tileerror", () => {
      errors += 1;
      if (!usingSnapshot && loaded === 0 && errors >= 3) {
        usingSnapshot = true;
        errors = 0;
        layer.setUrl(trekSnapshotTemplate(basemap));
        layer.options.maxNativeZoom = 3;
      } else if (usingSnapshot && loaded === 0 && errors >= 3) {
        onBasemapStatus("offline");
      }
    });
    layer.addTo(m);
    layer.bringToBack();
    baseLayer.current = layer;
  }, [ready, basemap, onBasemapStatus]);

  // Fly to selected mission when mission changes
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.flyTo([selectedMission.lat, selectedMission.lon], 4, { duration: 0.7 });
  }, [ready, selectedMission.id, selectedMission.lat, selectedMission.lon]);

  // Render vector overlays (11 missions, active Sol trajectory, discoveries, planetary features)
  useEffect(() => {
    const lib = L.current;
    const group = vectorGroup.current;
    if (!ready || !lib || !group) return;
    group.clearLayers();

    // 1. Planetary features (Craters, Mountains, Valleys, Dunes, Polar)
    for (const feat of PLANETARY_FEATURES) {
      const enabled =
        (feat.kind === "crater" && overlays.craters) ||
        (feat.kind === "mountain" && overlays.mountains) ||
        (feat.kind === "valley" && overlays.valleys) ||
        (feat.kind === "dune" && overlays.dunes) ||
        (feat.kind === "polar" && overlays.polar);
      if (!enabled) continue;
      const color =
        feat.kind === "mountain"
          ? "#ef4444"
          : feat.kind === "valley"
            ? "#22d3ee"
            : feat.kind === "dune"
              ? "#eab308"
              : feat.kind === "polar"
                ? "#93c5fd"
                : "#f59e0b";
      lib
        .circleMarker([feat.lat, feat.lon], {
          radius: selectedFeature?.id === feat.id ? 8 : 5,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.35,
        })
        .bindTooltip(
          `<b>${feat.name}</b> (${feat.kind.toUpperCase()})<br/>Cota MOLA: ${feat.elevationM} m · ${feat.geologicalUnit}`,
        )
        .on("click", () => onSelectFeature(feat))
        .addTo(group);
    }

    // 2. All 11 Missions Landing Sites & Traverses
    for (const m of MARS_MISSIONS) {
      const isSelected = m.id === selectedMission.id;
      if (overlays.traverses && m.hasMobileTraverse && m.waypoints.length > 1) {
        if (isSelected) {
          // Full planned/historical path in dashed line
          lib
            .polyline(
              m.waypoints.map((w) => [w.lat, w.lon] as [number, number]),
              { color: m.color, weight: 2, opacity: 0.45, dashArray: "4 4" },
            )
            .addTo(group);
          // Cumulative path up to selectedSol in solid bright line
          const reachedCoords = solMetrics.reachedWaypoints.map(
            (w) => [w.lat, w.lon] as [number, number],
          );
          reachedCoords.push([solMetrics.lat, solMetrics.lon]);
          lib
            .polyline(reachedCoords, { color: m.color, weight: 4, opacity: 0.95 })
            .bindTooltip(`${m.name} · Recorrido al Sol ${solMetrics.currentSol} (${solMetrics.distanceKm} km)`)
            .addTo(group);
        } else {
          lib
            .polyline(
              m.waypoints.map((w) => [w.lat, w.lon] as [number, number]),
              { color: m.color, weight: 2.5, opacity: 0.7 },
            )
            .bindTooltip(`Trayectoria de ${m.name} (${m.totalTraverseKm} km)`)
            .addTo(group);
        }
      }

      if (overlays.missions) {
        lib
          .circleMarker([m.lat, m.lon], {
            radius: isSelected ? 9 : 6,
            color: isSelected ? "#ffffff" : m.color,
            weight: isSelected ? 2.5 : 1.5,
            fillColor: m.color,
            fillOpacity: isSelected ? 0.95 : 0.75,
          })
          .bindTooltip(
            `<b>${m.fullName}</b> (${m.agency})<br/>${m.landingSiteName} · ${m.elevationM} m MOLA<br/>${
              m.totalTraverseKm !== null ? `Recorrido: ${m.totalTraverseKm} km` : "Lander fijo"
            }`,
          )
          .on("click", () => onSelectMission(m.id))
          .addTo(group);
      }
    }

    // 3. Current Sol Rover Position Marker (for mobile missions)
    if (selectedMission.hasMobileTraverse) {
      lib
        .circleMarker([solMetrics.lat, solMetrics.lon], {
          radius: 7,
          color: "#fbbf24",
          weight: 3,
          fillColor: "#1a0f06",
          fillOpacity: 1,
        })
        .bindTooltip(
          `<b>${selectedMission.name} · Sol ${solMetrics.currentSol}</b><br/>Odómetro: ${solMetrics.distanceKm} km · Cota: ${solMetrics.elevationM} m`,
        )
        .addTo(group);
    }

    // 4. Georeferenced Scientific Discoveries
    if (overlays.discoveries) {
      for (const disc of ALL_SCIENTIFIC_DISCOVERIES) {
        if (disc.missionId === selectedMission.id && disc.sol > solMetrics.currentSol) continue;
        const active = selectedDiscovery?.id === disc.id;
        lib
          .circleMarker([disc.lat, disc.lon], {
            radius: active ? 7 : 4.5,
            color: active ? "#fbbf24" : "#38bdf8",
            weight: 2,
            fillColor: "#0284c7",
            fillOpacity: 0.85,
          })
          .bindTooltip(`<b>🔬 ${disc.title}</b><br/>Sol ${disc.sol} · ${disc.instrument}`)
          .on("click", () => onSelectDiscovery(disc))
          .addTo(group);
      }
    }
  }, [
    ready,
    overlays,
    selectedMission,
    solMetrics,
    selectedDiscovery,
    selectedFeature,
    onSelectMission,
    onSelectDiscovery,
    onSelectFeature,
  ]);

  return (
    <div
      ref={el}
      className="mc-map h-full w-full"
      role="application"
      aria-label="Mapa global de misiones a Marte"
    />
  );
}

function MissionDossierCard({
  mission,
  solMetrics,
  onOpenImmersive,
  onSelectDiscovery,
}: {
  mission: MarsMissionRecord;
  solMetrics: ReturnType<typeof computeMissionSolMetrics>;
  onOpenImmersive: (sceneId?: string) => void;
  onSelectDiscovery: (d: ScientificDiscovery) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel/90">
      <div className="relative h-36 w-full overflow-hidden bg-ink2">
        <img
          src={mission.terrainImage}
          alt={mission.fullName}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-amber">
              {mission.agency} · {mission.category.toUpperCase()}
            </p>
            <h2 className="font-display text-lg font-bold text-white">{mission.fullName}</h2>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[9px]",
              VALIDATION_STYLE[mission.metadata.validation],
            )}
          >
            {mission.metadata.validation}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 font-mono text-[10.5px]">
          <div className="rounded-lg border border-line/60 bg-ink2/60 p-2">
            <span className="text-[9px] uppercase text-fog">Lanzamiento / Aterrizaje</span>
            <p className="mt-0.5 text-bright">
              {mission.launchDateUtc.slice(0, 10)} → {mission.landingDateUtc.slice(0, 10)}
            </p>
          </div>
          <div className="rounded-lg border border-line/60 bg-ink2/60 p-2">
            <span className="text-[9px] uppercase text-fog">Coordenadas IAU / MOLA</span>
            <p className="mt-0.5 text-cyan">
              {Math.abs(mission.lat).toFixed(3)}°{mission.lat >= 0 ? "N" : "S"},{" "}
              {mission.lon360.toFixed(3)}°E ({mission.elevationM} m)
            </p>
          </div>
        </div>

        {/* Access Mars Direct 3D Scene Buttons for Curiosity */}
        {mission.id === "curiosity" ? (
          <div className="rounded-xl border border-emerald-400/35 bg-emerald-950/25 p-3">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[.14em] text-emerald-300">
              Escenas 3D Fotogramétricas de Access Mars Disponibles:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EVA_SITES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenImmersive(s.id)}
                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] text-emerald-200 hover:bg-emerald-500/30"
                >
                  ★ {s.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">
            Instrumentación Científica ({mission.instruments.length})
          </p>
          <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto pr-1">
            {mission.instruments.map((inst) => (
              <div
                key={inst.id}
                className="rounded-lg border border-line/50 bg-ink2/50 px-2.5 py-1.5 text-[11px]"
              >
                <span className="font-mono font-semibold text-amber">{inst.acronym}</span> ·{" "}
                <span className="font-medium text-bright">{inst.name}</span>
                <p className="text-[10.5px] text-fog">{inst.role}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-fog">
            Descubrimientos hasta el Sol {solMetrics.currentSol} (
            {solMetrics.discoveriesUpToSol.length})
          </p>
          <div className="mt-1.5 space-y-1">
            {solMetrics.discoveriesUpToSol.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDiscovery(d)}
                className="flex w-full items-center justify-between rounded-lg border border-line/60 bg-ink2/60 px-2.5 py-1.5 text-left text-[11px] hover:border-cyan/40"
              >
                <span className="truncate text-bright">🔬 {d.title}</span>
                <span className="ml-2 shrink-0 font-mono text-[9.5px] text-cyan">
                  Sol {d.sol}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-line/60 pt-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-fog">
            Fuentes Institucionales Verificadas:
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {mission.officialSources.map((s) => (
              <a
                key={s.url + s.label}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan hover:underline"
              >
                {s.label} <ExternalLink className="size-2.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DiscoveryDetailCard({
  discovery,
  onClose,
}: {
  discovery: ScientificDiscovery;
  onClose: () => void;
}) {
  return (
    <section className="rounded-2xl border border-cyan/40 bg-panel/90 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span
            className={cn(
              "inline-block rounded-full border px-2 py-0.5 font-mono text-[8.5px]",
              VALIDATION_STYLE[discovery.metadata.validation],
            )}
          >
            {discovery.metadata.validation} · {discovery.metadata.sourceName}
          </span>
          <h3 className="mt-1.5 font-display text-sm font-bold text-bright">
            {discovery.title}
          </h3>
        </div>
        <button type="button" onClick={onClose} className="text-fog hover:text-bright">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 font-mono text-[10px] text-cyan">
        Sol {discovery.sol} ({discovery.dateUtc}) · {discovery.instrument}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-fog">{discovery.description}</p>
      <dl className="mt-2.5 space-y-1 border-t border-line/60 pt-2 font-mono text-[9.5px] text-fog">
        <div>
          <span className="text-bright">Coordenadas:</span> {discovery.lat.toFixed(4)}°N,{" "}
          {discovery.lon360.toFixed(4)}°E ({discovery.elevationM} m MOLA)
        </div>
        <div>
          <span className="text-bright">Precisión / Resolución:</span>{" "}
          {discovery.metadata.knownPrecision} · {discovery.metadata.resolution}
        </div>
        <div>
          <span className="text-bright">Publicación:</span> {discovery.publicationTitle}
        </div>
      </dl>
      <a
        href={discovery.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 inline-flex items-center gap-1 font-mono text-[10px] text-amber hover:underline"
      >
        Consultar archivo primario <ExternalLink className="size-3" />
      </a>
    </section>
  );
}

function FeatureDetailCard({
  feature,
  onClose,
  onOpen3D,
}: {
  feature: PlanetaryFeature;
  onClose: () => void;
  onOpen3D: () => void;
}) {
  return (
    <section className="rounded-2xl border border-amber/40 bg-panel/90 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.16em] text-amber">
            Formación Planetaria · {feature.kind.toUpperCase()}
          </p>
          <h3 className="mt-0.5 font-display text-base font-bold text-bright">{feature.name}</h3>
        </div>
        <button type="button" onClick={onClose} className="text-fog hover:text-bright">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 font-mono text-[10px] text-cyan">
        {feature.lat.toFixed(2)}°N, {feature.lon360.toFixed(2)}°E · Cota MOLA: {feature.elevationM} m
        · Extensión: {feature.diameterOrLengthKm} km
      </p>
      <p className="mt-2 text-xs leading-relaxed text-fog">{feature.description}</p>
      <p className="mt-1.5 text-[11px] text-fog">
        <strong className="text-bright">Unidad Geológica:</strong> {feature.geologicalUnit}
      </p>
      <p className="mt-1 text-[11px] text-fog">
        <strong className="text-bright">Mineralogía (CRISM/THEMIS):</strong>{" "}
        {feature.mineralogyNote}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpen3D}
          className="rounded-lg bg-amber px-3 py-1.5 font-mono text-[10px] font-semibold text-[#1a0f06]"
        >
          Inspeccionar Bloque 3D DEM
        </button>
        <a
          href={feature.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan hover:underline"
        >
          USGS / PDS <ExternalLink className="size-3" />
        </a>
      </div>
    </section>
  );
}
