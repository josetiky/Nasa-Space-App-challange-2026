import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  Line,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import {
  AlertTriangle,
  Crosshair,
  Database,
  LocateFixed,
  MapPinned,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Route as RouteIcon,
  ShieldAlert,
  Thermometer,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import * as THREE from "three";

import marsMapImage from "@/assets/mars-jezero-map.jpg";
import { Button } from "@/components/ui/button";

type LayerKey = "terrain" | "hazards" | "resources" | "rovers" | "route";

export type MarsSite = {
  id: string;
  name: string;
  region: string;
  coordinates: string;
  latitude: number;
  longitude: number;
  terrain: string;
  significance: string;
  hazard: string;
  resources: string;
  score: number;
  elevation: string;
  slope: string;
  radiation: string;
  temperature: string;
  waterIce: string;
  rover: string;
  scienceTargets: number;
};

const LOCAL_MARS_MODEL = "/models/scene.gltf";

type ModelView = "globe" | "regional";

const REGIONAL_MODELS = [
  { id: "tharsis", name: "Tharsis", file: "/models/regions/01_Tharsis.glb", preview: "/models/regions/previews/01_Tharsis_3D_Model.png" },
  { id: "valles", name: "Valles Marineris", file: "/models/regions/02_Valles_Marineris.glb", preview: "/models/regions/previews/02_Valles_Marineris_3D_Model.png" },
  { id: "hellas", name: "Hellas / Isidis", file: "/models/regions/03_Hellas_Isidis.glb", preview: "/models/regions/previews/03_Hellas_Isidis_3D_Model.png" },
  { id: "elysium", name: "Elysium / Utopia", file: "/models/regions/04_Elysium_Utopia.glb", preview: "/models/regions/previews/04_Elysium_Utopia_3D_Model.png" },
  { id: "arabia", name: "Arabia / Meridiani", file: "/models/regions/05_Arabia_Meridiani.glb", preview: "/models/regions/previews/05_Arabia_Meridiani_3D_Model.png" },
  { id: "north-pole", name: "North Pole", file: "/models/regions/06_North_Pole.glb", preview: "/models/regions/previews/06_North_Pole_3D_Model.png" },
  { id: "south-pole", name: "South Pole", file: "/models/regions/07_South_Pole.glb", preview: "/models/regions/previews/07_South_Pole_3D_Model.png" },
] as const;


const defaultMarsSite: MarsSite = {
  id: "jezero",
  name: "Jezero Crater",
  region: "Isidis Planitia",
  coordinates: "18.4°N, 77.5°E",
  latitude: 18.4,
  longitude: 77.5,
  terrain: "Ancient crater lake and river delta with layered sedimentary rock.",
  significance: "Perseverance rover site; preserves evidence of an ancient wet environment.",
  hazard: "Broken delta scarps, loose sand, and elevated surface radiation.",
  resources: "Hydrated minerals, clay-bearing rock, and possible shallow ground ice.",
  score: 82,
  elevation: "−2,480 m",
  slope: "3.2°",
  radiation: "0.67 mSv/day",
  temperature: "−63°C",
  waterIce: "High",
  rover: "Perseverance",
  scienceTargets: 8,
};

export const marsSites: MarsSite[] = [
  defaultMarsSite,
  {
    id: "olympus",
    name: "Olympus Mons",
    region: "Tharsis Montes",
    coordinates: "18.7°N, 226.2°E",
    latitude: 18.7,
    longitude: 226.2,
    terrain: "Shield volcano rising about 22 km above the Martian datum.",
    significance: "The largest known volcano in the Solar System.",
    hazard: "Extreme altitude, steep escarpments, and exceptionally thin air.",
    resources: "Basaltic rock for construction and lava-tube shelter potential.",
    score: 48,
    elevation: "+21,000 m",
    slope: "8.6°",
    radiation: "0.74 mSv/day",
    temperature: "−70°C",
    waterIce: "Low",
    rover: "Survey drone",
    scienceTargets: 4,
  },
  {
    id: "valles",
    name: "Valles Marineris",
    region: "Equatorial canyon system",
    coordinates: "14.0°S, 290.0°E",
    latitude: -14,
    longitude: 290,
    terrain: "A canyon network over 4,000 km long and locally up to 7 km deep.",
    significance: "Exposes a vast record of Martian geology and possible hydrated deposits.",
    hazard: "Cliffs, landslides, deep shadow, and difficult surface communications.",
    resources: "Exposed mineral layers and natural radiation-shielding terrain.",
    score: 58,
    elevation: "−4,100 m",
    slope: "11.4°",
    radiation: "0.61 mSv/day",
    temperature: "−58°C",
    waterIce: "Moderate",
    rover: "Orbital relay",
    scienceTargets: 11,
  },
  {
    id: "gale",
    name: "Gale Crater",
    region: "Aeolis quadrangle",
    coordinates: "5.4°S, 137.8°E",
    latitude: -5.4,
    longitude: 137.8,
    terrain: "Impact basin containing the 5.5 km-high layered Mount Sharp.",
    significance: "Curiosity rover found evidence of a long-lived ancient lake environment.",
    hazard: "Rocky slopes, dust accumulation, and limited accessible water ice.",
    resources: "Clay minerals, sulfates, and a well-studied geological record.",
    score: 67,
    elevation: "−4,500 m",
    slope: "4.8°",
    radiation: "0.65 mSv/day",
    temperature: "−59°C",
    waterIce: "Moderate",
    rover: "Curiosity",
    scienceTargets: 9,
  },
  {
    id: "utopia",
    name: "Utopia Planitia",
    region: "Northern lowlands",
    coordinates: "46.7°N, 117.5°E",
    latitude: 46.7,
    longitude: 117.5,
    terrain: "Broad, relatively flat impact basin covered by patterned ground.",
    significance: "Radar observations indicate extensive buried ice deposits.",
    hazard: "Seasonal frost, severe cold, and dust-driven power loss.",
    resources: "Abundant subsurface water ice and low-slope landing terrain.",
    score: 88,
    elevation: "−4,000 m",
    slope: "1.7°",
    radiation: "0.59 mSv/day",
    temperature: "−69°C",
    waterIce: "Very high",
    rover: "Relay beacon",
    scienceTargets: 6,
  },
];

const layers: Array<{ id: LayerKey; label: string; icon: LucideIcon; detail: string }> = [
  { id: "terrain", label: "Terrain", icon: Waves, detail: "Topography + slope" },
  { id: "hazards", label: "Hazards", icon: ShieldAlert, detail: "Radiation + thermal risk" },
  { id: "resources", label: "Resources", icon: LocateFixed, detail: "Ice + mineral targets" },
  { id: "rovers", label: "Rovers", icon: Radio, detail: "Active surface assets" },
  { id: "route", label: "Route", icon: RouteIcon, detail: "Mission path overlay" },
];

function positionFromCoordinates(latitude: number, longitude: number, radius = 1.36) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Selected-site label as a camera-facing canvas sprite (drei <Html> created a React root per label and raced unmounts). */
function SiteNameSprite({ text }: { text: string }) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = "600 36px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.font = font;
    const label = text.toUpperCase();
    const width = Math.ceil(ctx.measureText(label).width) + 40;
    canvas.width = width;
    canvas.height = 60;
    ctx.font = font;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(217,119,6,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(2, 2, width - 4, 56, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b45309";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 20, 32);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: width / 60 };
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  const height = 0.08;
  return (
    <sprite position={[0, 0.13, 0]} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

/** In-scene loading placeholder (a drei <Html> fallback here raced React 19 unmounts: removeChild errors). */
function ModelLoader() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += Math.min(delta, 0.05) * 1.5;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.9, 18, 12]} />
      <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.35} />
    </mesh>
  );
}

function MarsModel() {
  const { scene } = useGLTF(LOCAL_MARS_MODEL);
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
          material.metalness = 0.05;
        }
      });
    });
  }, [model]);

  return <primitive object={model} scale={0.026} />;
}

function RegionalMarsModel({ modelId }: { modelId: (typeof REGIONAL_MODELS)[number]["id"] }) {
  const config = REGIONAL_MODELS.find((item) => item.id === modelId) ?? REGIONAL_MODELS[0];
  const { scene } = useGLTF(config.file);
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.15 / maxDimension;

    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = Math.max(material.roughness, 0.78);
          material.metalness = 0.02;
        }
      });
    });
  }, [model]);

  return <primitive object={model} rotation={[-0.28, 0.08, 0]} />;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    // The downloaded project may not include Lovable's hosted GLB asset.
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ProceduralMars() {
  const craters = useMemo(
    () =>
      [
        [0.3, 0.6, 0.09],
        [-0.52, 0.42, 0.06],
        [0.2, -0.35, 0.08],
        [-0.28, -0.56, 0.05],
        [0.62, -0.14, 0.045],
        [-0.68, -0.1, 0.07],
      ] as Array<[number, number, number]>,
    [],
  );
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.05, 64, 64]} />
        <meshStandardMaterial color="#9a452f" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh scale={1.012}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshBasicMaterial color="#f2b49b" wireframe transparent opacity={0.06} />
      </mesh>
      {craters.map(([x, y, size], index) => {
        const z = Math.sqrt(Math.max(0.01, 1 - x * x - y * y));
        return (
          <mesh key={index} position={[x, y, z * 0.99]} rotation={[Math.atan2(y, z), -Math.atan2(x, z), 0]}>
            <circleGeometry args={[size, 24]} />
            <meshBasicMaterial color="#5f291f" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

function Stars() {
  const positions = useMemo(() => {
    const values = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i += 1) {
      const radius = 7 + (i % 19) * 0.27;
      const angle = i * 2.399963;
      values[i * 3] = Math.cos(angle) * radius;
      values[i * 3 + 1] = Math.sin(i * 1.71) * 6;
      values[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return values;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#71879a" size={0.014} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function LocationMarkers({
  selectedId,
  onSelect,
  enabledLayers,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  enabledLayers: Record<LayerKey, boolean>;
}) {
  return (
    <group rotation={[0, 0.1, 0]}>
      {marsSites.map((site) => {
        const selected = site.id === selectedId;
        const position = positionFromCoordinates(site.latitude, site.longitude);
        const riskColor = site.score >= 80 ? "#7be0b1" : site.score >= 60 ? "#f4bd68" : "#ef7c7c";
        return (
          <group key={site.id} position={position}>
            <mesh
              aria-label={`Select ${site.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(site.id);
              }}
              scale={selected ? 1.3 : 1}
            >
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshBasicMaterial color={enabledLayers.hazards ? riskColor : selected ? "#f4bd68" : "#87e6ee"} />
            </mesh>
            <mesh scale={selected ? 1.45 : 1}>
              <ringGeometry args={[0.06, 0.075, 24]} />
              <meshBasicMaterial
                color={enabledLayers.resources && site.waterIce !== "Low" ? "#87e6ee" : selected ? "#f4bd68" : "#87e6ee"}
                transparent
                opacity={0.72}
                side={THREE.DoubleSide}
              />
            </mesh>
            {enabledLayers.rovers && (
              <mesh position={[0, 0.08, 0]}>
                <boxGeometry args={[0.025, 0.025, 0.025]} />
                <meshBasicMaterial color="#c4fff5" />
              </mesh>
            )}
            {selected && (
              <SiteNameSprite text={site.name} />
            )}
          </group>
        );
      })}
    </group>
  );
}

function RouteArc({ selectedId, visible }: { selectedId: string; visible: boolean }) {
  if (!visible) return null;
  const startSite = marsSites.find((site) => site.id === selectedId) ?? defaultMarsSite;
  const destination = marsSites.find((site) => site.id !== selectedId) ?? defaultMarsSite;
  const start = positionFromCoordinates(startSite.latitude, startSite.longitude, 1.405);
  const end = positionFromCoordinates(destination.latitude, destination.longitude, 1.405);
  const midpoint = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.56);
  const curve = new THREE.CatmullRomCurve3([start, midpoint, end]);
  const points = curve.getPoints(48);
  return <Line points={points} color="#f4bd68" lineWidth={2.2} dashed dashSize={0.045} gapSize={0.03} transparent opacity={0.9} />;
}

function MarsBody({
  active,
  selectedId,
  onSelect,
  enabledLayers,
  modelView,
  regionalModelId,
}: {
  active: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  enabledLayers: Record<LayerKey, boolean>;
  modelView: ModelView;
  regionalModelId: (typeof REGIONAL_MODELS)[number]["id"];
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, rawDelta) => {
    if (!active || !group.current) return;
    group.current.rotation.y += Math.min(rawDelta, 0.05) * 0.055;
  });
  return (
    <group ref={group}>
      <ModelBoundary fallback={<ProceduralMars />}>
        <Suspense fallback={<ModelLoader />}>
          {modelView === "regional" ? <RegionalMarsModel modelId={regionalModelId} /> : <MarsModel />}
        </Suspense>
      </ModelBoundary>
      {modelView === "globe" && (
        <>
          {enabledLayers.terrain && (
            <mesh scale={1.015}>
              <sphereGeometry args={[1.05, 24, 24]} />
              <meshBasicMaterial color="#f5c9a8" wireframe transparent opacity={0.035} />
            </mesh>
          )}
          <LocationMarkers selectedId={selectedId} onSelect={onSelect} enabledLayers={enabledLayers} />
          <RouteArc selectedId={selectedId} visible={enabledLayers.route} />
        </>
      )}
    </group>
  );
}

function MarsScene({
  selectedId,
  onSelect,
  spinning,
  viewKey,
  enabledLayers,
  modelView,
  regionalModelId,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  spinning: boolean;
  viewKey: number;
  enabledLayers: Record<LayerKey, boolean>;
  modelView: ModelView;
  regionalModelId: (typeof REGIONAL_MODELS)[number]["id"];
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);

  useEffect(() => {
    if (viewKey === 0) return;
    controls.current?.reset();
  }, [viewKey]);

  return (
    <>
      <color attach="background" args={[modelView === "regional" ? "#101b27" : "#eaf0f5"]} />
      <Stars />
      <ambientLight intensity={0.55} color="#9ab8c7" />
      <directionalLight position={[-4, 2.5, 5]} intensity={3.2} color="#ffd1a1" />
      <pointLight position={[3, -2, -3]} intensity={1.1} color="#6db6ce" />
      <Environment>
        <Lightformer intensity={1.8} position={[0, 4, 4]} scale={[8, 8, 1]} />
        <Lightformer intensity={0.7} color="#8bc8d4" position={[-5, 0, -2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
      </Environment>
      <MarsBody
        active={spinning}
        selectedId={selectedId}
        onSelect={onSelect}
        enabledLayers={enabledLayers}
        modelView={modelView}
        regionalModelId={regionalModelId}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={2.45}
        maxDistance={5.4}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
      />
    </>
  );
}

export function MarsExplorer({ initialModelView = "globe", immersive = false }: { initialModelView?: ModelView; immersive?: boolean } = {}) {
  const [selectedId, setSelectedId] = useState(defaultMarsSite.id);
  const [spinning, setSpinning] = useState(true);
  const [viewKey, setViewKey] = useState(0);
  const [marswalk, setMarswalk] = useState(false);
  const [modelView, setModelView] = useState<ModelView>(initialModelView);
  const [regionalModelId, setRegionalModelId] = useState<(typeof REGIONAL_MODELS)[number]["id"]>("tharsis");
  const [enabledLayers, setEnabledLayers] = useState<Record<LayerKey, boolean>>({
    terrain: true,
    hazards: true,
    resources: true,
    rovers: true,
    route: true,
  });
  const selected = marsSites.find((site) => site.id === selectedId) ?? defaultMarsSite;
  const destination = marsSites.find((site) => site.id !== selectedId) ?? defaultMarsSite;

  const toggleLayer = (layer: LayerKey) => {
    setEnabledLayers((current) => ({ ...current, [layer]: !current[layer] }));
  };

  return (
    <section aria-labelledby="mars-explorer-heading" className={immersive ? "mission-lab-explorer rise-in" : "rise-in"}>
      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 text-mint">
              <span className="beacon-dot size-1.5 rounded-full bg-mint" /> Mission systems nominal
            </span>
            <span className="text-fog">ARES-01 · SOL 214</span>
          </div>
          <h1 id="mars-explorer-heading" className="mt-3 max-w-4xl font-display text-4xl font-bold leading-[1.02] sm:text-5xl lg:text-6xl">
            Interplanetary Survival Guide<span className="text-amber">.</span>
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-fog">
            A mission-control interface for exploring Martian terrain, comparing hazards, locating resources,
            and planning a science-first Marswalk from a single layered view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant="outline" size="sm" onClick={() => setSpinning((value) => !value)} aria-label={spinning ? "Pause globe rotation" : "Resume globe rotation"}>
            {spinning ? <Pause /> : <Play />}
            {spinning ? "Pause" : "Rotate"}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewKey((value) => value + 1)} aria-label="Reset globe view" title="Reset view">
            <RotateCcw />
          </Button>
          <div className="inline-flex overflow-hidden rounded-lg border border-line bg-panel/80 p-0.5">
            <button
              type="button"
              onClick={() => setModelView("globe")}
              className={`px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] transition ${modelView === "globe" ? "bg-cyan/15 text-cyan" : "text-fog hover:text-bright"}`}
            >
              Globe
            </button>
            <button
              type="button"
              onClick={() => setModelView("regional")}
              className={`px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] transition ${modelView === "regional" ? "bg-amber/15 text-amber" : "text-fog hover:text-bright"}`}
            >
              3D Terrain
            </button>
          </div>
          <Button size="sm" onClick={() => setMarswalk(true)} className="bg-amber text-ink hover:bg-amber/90">
            <Crosshair />
            Enter Marswalk
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <TelemetryChip icon={<Zap />} label="Suit power" value="78%" tone="mint" />
        <TelemetryChip icon={<Waves />} label="Water reserve" value="81%" tone="cyan" />
        <TelemetryChip icon={<Thermometer />} label="Surface temp" value={selected.temperature} tone="amber" />
        <TelemetryChip icon={<ShieldAlert />} label="Radiation" value={selected.radiation} tone="rose" />
        <TelemetryChip icon={<Wind />} label="Wind" value="18 km/h" tone="cyan" />
        <TelemetryChip icon={<MapPinned />} label="Slope" value={selected.slope} tone="mint" />
        <TelemetryChip icon={<Database />} label="Science targets" value={String(selected.scienceTargets)} tone="amber" />
        <TelemetryChip icon={<Radio />} label="Relay" value="98%" tone="mint" />
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-line/70 bg-panel/30 shadow-2xl shadow-black/20 lg:grid-cols-[minmax(0,1.5fr)_minmax(330px,0.7fr)]">
        <div className={`relative overflow-hidden bg-ink2 ${modelView === "regional" ? "h-[720px] min-h-[620px]" : "h-[610px] min-h-[520px]"}`}>
          <Canvas camera={{ position: modelView === "regional" ? [0, 1.15, 3.05] : [0, 0.2, 3.45], fov: modelView === "regional" ? 48 : 43 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: false }}>
            <MarsScene
              selectedId={selectedId}
              onSelect={setSelectedId}
              spinning={spinning}
              viewKey={viewKey}
              enabledLayers={enabledLayers}
              modelView={modelView}
              regionalModelId={regionalModelId}
            />
          </Canvas>

          <div className="pointer-events-none absolute left-4 top-4 right-4 flex items-start justify-between gap-3">
            <div className="rounded-xl border border-line/70 bg-[#0a1420]/82 p-3 text-white shadow-lg backdrop-blur-xl">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fog">{modelView === "regional" ? "Regional terrain" : "Surface survey"}</p>
              <p className="mt-1 font-display text-sm font-semibold text-bright">{modelView === "regional" ? (REGIONAL_MODELS.find((m) => m.id === regionalModelId)?.name ?? "Terrain model") : selected.region}</p>
              <p className="mt-0.5 font-mono text-[10px] text-cyan">{selected.coordinates} · elev {selected.elevation}</p>
            </div>
            <div className="rounded-xl border border-amber/25 bg-[#0a1420]/82 px-3 py-2 text-right text-white shadow-lg backdrop-blur-xl">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber">Data mode</p>
              <p className="mt-1 font-mono text-[10px] text-bright">DEMO SCORES · NOT NASA DATA</p>
            </div>
          </div>

          {modelView === "regional" && (
            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl border border-white/15 bg-[#0a1420]/88 p-3 shadow-2xl backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan">Regional terrain library</p>
                  <p className="mt-0.5 font-display text-sm font-semibold text-white">Choose a dataset to inspect</p>
                </div>
                <span className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] text-amber">7 regional 3D models (visual reference)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {REGIONAL_MODELS.map((model) => {
                  const active = model.id === regionalModelId;
                  return (
                    <button key={model.id} type="button" onClick={() => setRegionalModelId(model.id)}
                      className={`group overflow-hidden rounded-xl border text-left transition-all ${active ? "border-amber/80 bg-amber/10 ring-1 ring-amber/30" : "border-white/10 bg-white/[.04] hover:border-cyan/50 hover:bg-white/[.08]"}`}>
                      <img src={model.preview} alt="" className="h-16 w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                      <span className={`block truncate px-2 py-2 font-mono text-[8px] uppercase tracking-[0.06em] ${active ? "text-amber" : "text-white/80"}`}>{model.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`absolute left-4 ${modelView === "regional" ? "top-[350px]" : "top-24"} w-[180px] space-y-2 sm:w-[200px]`}>
            <div className="rounded-xl border border-line/70 bg-[#0a1420]/82 p-3 text-white shadow-lg backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fog">Map layers</p>
                <span className="font-mono text-[9px] text-cyan">5 channels</span>
              </div>
              <div className="space-y-1.5">
                {layers.map((layer) => {
                  const Icon = layer.icon;
                  const active = enabledLayers[layer.id];
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => toggleLayer(layer.id)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        active ? "border-cyan/20 bg-cyan/10 text-bright" : "border-transparent text-fog hover:bg-panel"
                      }`}
                    >
                      <Icon className={active ? "text-cyan" : "text-fog"} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[10px] uppercase tracking-[0.12em]">{layer.label}</span>
                        <span className="mt-0.5 block truncate text-[9px] text-fog/75">{layer.detail}</span>
                      </span>
                      <span className={`size-1.5 rounded-full ${active ? "bg-mint" : "bg-fog/40"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3">
            <div className="rounded-xl border border-line/70 bg-white/95 px-3 py-2 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-fog">
                <span>● drag to orbit</span>
                <span>● scroll to zoom</span>
                <span className="hidden sm:inline">● click a waypoint to inspect</span>
              </div>
            </div>
            <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 backdrop-blur-xl">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber">{modelView === "regional" ? "3D terrain dataset" : "Current mission leg"}</p>
              <p className="mt-1 font-display text-sm font-semibold text-bright">
                {modelView === "regional" ? (REGIONAL_MODELS.find((m) => m.id === regionalModelId)?.name ?? "Regional terrain") : <>{selected.name} <span className="text-fog">→</span> {destination.name}</>}
              </p>
            </div>
          </div>
        </div>

        <aside className={`flex flex-col border-t border-line/70 bg-ink/35 p-5 lg:border-l lg:border-t-0 ${modelView === "regional" ? "min-h-[720px]" : "min-h-[610px]"}`} aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">Selected waypoint</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-bright">{selected.name}</h2>
              <p className="mt-1 font-mono text-[10px] text-cyan">{selected.coordinates} · {selected.region}</p>
            </div>
            <div className="rounded-xl border border-mint/20 bg-mint/10 px-3 py-2 text-right">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-fog">Viability</p>
              <p className="font-display text-2xl font-bold text-mint">{selected.score}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <DataTile label="Terrain" value={selected.slope} sub="mean slope" tone="cyan" />
            <DataTile label="Ice" value={selected.waterIce} sub="resource access" tone="cyan" />
            <DataTile label="Rover" value={selected.rover} sub="surface asset" tone="amber" />
            <DataTile label="Targets" value={String(selected.scienceTargets)} sub="science sites" tone="mint" />
          </div>

          <div className="mt-5 space-y-4">
            <Detail label="Terrain profile" value={selected.terrain} />
            <Detail label="Why it matters" value={selected.significance} tone="cyan" />
            <Detail label="Primary hazard" value={selected.hazard} tone="rose" />
            <Detail label="Survival resources" value={selected.resources} tone="cyan" />
          </div>

          <div className="mt-5 rounded-xl border border-line/70 bg-panel/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fog">Route planner</p>
                <p className="mt-1 font-display text-base font-semibold text-bright">{selected.name} → {destination.name}</p>
              </div>
              <RouteIcon className="text-amber" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Distance" value="4.8 km" />
              <MiniMetric label="ETA" value="2h 14m" />
              <MiniMetric label="Risk" value={selected.score >= 75 ? "LOW" : selected.score >= 55 ? "MED" : "HIGH"} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-[10px] leading-relaxed text-fog">
              <AlertTriangle className="text-amber" /> Planning values are simulated UI data; connect mission feeds before operational use.
            </p>
          </div>

          <div className="mt-5 border-t border-line/70 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">Survey waypoints</p>
              <span className="font-mono text-[9px] text-cyan">{marsSites.length} indexed</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {marsSites.map((site) => (
                <Button
                  key={site.id}
                  variant={site.id === selectedId ? "secondary" : "ghost"}
                  className="h-auto min-h-10 justify-between whitespace-normal px-3 py-2 text-left"
                  onClick={() => setSelectedId(site.id)}
                >
                  <span>
                    <span className="block">{site.name}</span>
                    <span className="block font-mono text-[9px] text-fog">{site.coordinates}</span>
                  </span>
                  <span className={site.id === selectedId ? "font-mono text-[10px] text-amber" : "font-mono text-[10px] text-fog"}>{site.score}/100</span>
                </Button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-panel/30">
          <div className="grid gap-0 sm:grid-cols-[0.95fr_1.05fr]">
            <div className="relative min-h-[240px] overflow-hidden">
              <img src={marsMapImage} alt="Mars Jezero regional map" className="absolute inset-0 size-full object-cover opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-tr from-ink via-transparent to-ink/30" />
              <div className="absolute left-4 top-4 rounded-lg border border-cyan/20 bg-white/90 px-2.5 py-2 backdrop-blur-xl">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan">Surface reference</p>
                <p className="mt-1 font-display text-sm font-semibold">Jezero Sector</p>
              </div>
            </div>
            <div className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog">Science brief</p>
              <h3 className="mt-2 font-display text-xl font-bold">Keep the route useful, not just safe.</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-fog">
                Mission routes should balance terrain risk with science yield. The interface therefore treats rover observations,
                resources, communications, and hazard context as a single planning surface.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <DataTile label="Science yield" value={selected.scienceTargets > 7 ? "High" : "Medium"} sub="candidate targets" tone="mint" />
                <DataTile label="Comm link" value="98%" sub="relay availability" tone="cyan" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line/70 bg-panel/30 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog">Mission checklist</p>
              <h3 className="mt-1 font-display text-xl font-bold">Before the EVA window</h3>
            </div>
            <div className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 font-mono text-[9px] text-mint">7/8 READY</div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              ["Suit power", "78%", true],
              ["Water reserve", "81%", true],
              ["Relay lock", "98%", true],
              ["Dust corridor", "3 days out", true],
              ["Primary sample kit", "Loaded", true],
              ["Emergency shelter", "Within 0.9 km", true],
              ["Route confidence", "91%", true],
              ["Return leg", "Not locked", false],
            ].map(([label, value, ready]) => (
              <div key={label as string} className="flex items-center justify-between rounded-lg border border-line/50 bg-white/70 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fog">{label}</span>
                <span className={`font-mono text-[10px] ${ready ? "text-mint" : "text-amber"}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-right font-mono text-[9px] text-fog/70">
        3D model source: “Mars” by Nestaeric, CC BY 4.0 · This build bundles the local Mars GLTF asset and keeps a procedural fallback if WebGL/model loading fails.
      </p>

      {marswalk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl rounded-2xl border border-amber/30 bg-white/95 p-5 shadow-2xl shadow-black/50 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber">Mission mode · ARES-01</p>
                <h2 className="mt-2 font-display text-3xl font-bold">Marswalk briefing</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fog">
                  Navigation overlay for the current EVA leg. Use this screen as a presentation/demo mode for the route, hazards,
                  and science targets you want to show during the judging session.
                </p>
              </div>
              <Button variant="outline" onClick={() => setMarswalk(false)}>Close</Button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <MissionGauge label="O₂ reserve" value="92%" fill={92} tone="mint" />
              <MissionGauge label="Battery" value="78%" fill={78} tone="amber" />
              <MissionGauge label="Route confidence" value="91%" fill={91} tone="cyan" />
              <MissionGauge label="Science yield" value={selected.scienceTargets > 7 ? "HIGH" : "MED"} fill={Math.min(100, selected.scienceTargets * 11)} tone="mint" />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
              <div className="rounded-xl border border-line/70 bg-panel/40 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fog">Next 3 actions</p>
                <div className="mt-3 space-y-2">
                  {[
                    "Hold 40 s at waypoint A to scan the delta wall.",
                    "Collect sample from the highest-confidence science target.",
                    "Return to the relay corridor before solar output drops.",
                  ].map((item, index) => (
                    <div key={item} className="flex gap-3 rounded-lg border border-line/50 bg-white/75 p-3">
                      <span className="font-mono text-[10px] text-amber">0{index + 1}</span>
                      <p className="text-[12px] leading-relaxed text-fog">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-line/70 bg-panel/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fog">Live mission leg</p>
                    <p className="mt-1 font-display text-lg font-semibold">{selected.name} → {destination.name}</p>
                  </div>
                  <span className="font-mono text-[10px] text-mint">NAV LINK STABLE</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full w-[38%] rounded-full bg-amber" />
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-fog">
                  <span>1.8 / 4.8 km</span>
                  <span>ETA 32 min</span>
                </div>
                <div className="mt-5 rounded-lg border border-rose/20 bg-rose/5 p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 text-rose" />
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-rose">Safety note</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-fog">
                        Avoid the eastern scarp on the return leg; current route confidence assumes the selected hazard layer remains enabled.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TelemetryChip({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "mint" | "cyan" | "amber" | "rose" }) {
  const toneClass = { mint: "text-mint", cyan: "text-cyan", amber: "text-amber", rose: "text-rose" }[tone];
  return (
    <div className="rounded-xl border border-line/70 bg-panel/40 p-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 text-fog">
        <span className={toneClass}>{icon}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className={`mt-2 font-display text-base font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function DataTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "mint" | "cyan" | "amber" }) {
  const toneClass = tone === "mint" ? "text-mint" : tone === "cyan" ? "text-cyan" : "text-amber";
  return (
    <div className="rounded-lg border border-line/60 bg-white/70 p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-fog">{label}</p>
      <p className={`mt-1 font-display text-sm font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[9px] text-fog">{sub}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-white/70 px-2 py-2">
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-fog">{label}</p>
      <p className="mt-1 font-display text-xs font-semibold text-bright">{value}</p>
    </div>
  );
}

function MissionGauge({ label, value, fill, tone }: { label: string; value: string; fill: number; tone: "mint" | "cyan" | "amber" }) {
  const toneClass = tone === "mint" ? "bg-mint" : tone === "cyan" ? "bg-cyan" : "bg-amber";
  return (
    <div className="rounded-xl border border-line/70 bg-panel/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-fog">{label}</span>
        <span className="font-mono text-[10px] text-bright">{value}</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-line">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function Detail({ label, value, tone = "bright" }: { label: string; value: string; tone?: "bright" | "rose" | "cyan" }) {
  const color = tone === "rose" ? "text-rose" : tone === "cyan" ? "text-cyan" : "text-bright";
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">{label}</dt>
      <dd className={`mt-1 text-[12px] leading-relaxed ${color}`}>{value}</dd>
    </div>
  );
}
