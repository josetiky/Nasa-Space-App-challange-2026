import { Line, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { computeEvaPlan, metabolicRateW } from "@/core/science/eva";
import { buildWalkTimeline, sampleWalk, type WalkState, type WalkTimeline } from "@/core/science/evaWalk";
import { createHeightGrid, findSafePath, rasterizeTriangles, type HeightGrid } from "@/core/science/routing";
import { gcrDosePerSol, pressureAt } from "@/core/science/environment";
import { EVA } from "@/core/science/constants";
import type { EvaPlan, EvaWaypoint } from "@/core/types";
import type { EvaPoi, EvaSite } from "@/data/evaSites";

type Sample = { x: number; y: number; z: number };

interface TerrainInfo {
  ground: (x: number, z: number) => number | null;
  /** Height grid of the collision surface over a box (for safe-route search). */
  grid: (minX: number, maxX: number, minZ: number, maxZ: number, cell: number) => HeightGrid;
}

/** Node metadata written by the Access Mars Cinema 4D pipeline into glTF node names. */
function parseMeta(name: string): { type: "TILE" | "BACKGROUND" | "SIMPLE" | "OTHER"; id?: string | undefined; md?: boolean } {
  if (name.includes("TYPE_BACKGROUND")) return { type: "BACKGROUND" };
  if (name.includes("TYPE_SIMPLE")) return { type: "SIMPLE" };
  if (name.includes("TYPE_TILE")) return { type: "TILE", id: name.match(/ID_(\d+)___/)?.[1], md: /MD_1/.test(name) };
  return { type: "OTHER" };
}

const loader = new THREE.TextureLoader();
function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) =>
    loader.load(
      url,
      (texture) => {
        texture.flipY = false; // glTF UV convention (Access Mars samples at 1 − v with flipped textures)
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        resolve(texture);
      },
      undefined,
      reject,
    ),
  );
}

function Terrain({ site, onReady, onPick }: { site: EvaSite; onReady: (info: TerrainInfo) => void; onPick: (p: THREE.Vector3) => void }) {
  const gltf = useGLTF(`${site.basePath}/terrain.glb`, "/draco/");
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    const tiles: THREE.Mesh[] = [];
    let simple: THREE.Mesh | null = null;
    let cancelled = false;
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const meta = parseMeta(object.name || object.parent?.name || "");
      if (meta.type === "SIMPLE") {
        simple = object;
        object.visible = false;
        return;
      }
      if (meta.type === "BACKGROUND") {
        const material = new THREE.MeshBasicMaterial({ color: "#9c7a5c" });
        object.material = material;
        void loadTexture(`${site.basePath}/background.jpg`).then((t) => {
          if (cancelled) return;
          material.map = t;
          material.color.set("#ffffff");
          material.needsUpdate = true;
        });
        return;
      }
      if (meta.type !== "TILE" || !meta.id) return;
      const material = new THREE.MeshStandardMaterial({ color: "#8a6a52", roughness: 1, metalness: 0 });
      object.material = material;
      object.receiveShadow = true;
      tiles.push(object);
      // Progressive textures: extra-small first, then the base tile (tiles without a base only have _sm).
      const chain = meta.md ? [`${meta.id}_xsm`, meta.id] : [`${meta.id}_sm`];
      void (async () => {
        for (const name of chain) {
          try {
            const t = await loadTexture(`${site.basePath}/tiles/${name}.jpg`);
            if (cancelled) return t.dispose();
            const previous = material.map;
            material.map = t;
            material.color.set("#ffffff");
            material.needsUpdate = true;
            previous?.dispose();
          } catch {
            /* keep the lower level */
          }
        }
      })();
    });
    group.current?.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const targets: THREE.Object3D[] = simple ? [simple] : tiles;
    // World-space triangles of the collision surface (computed once, reused by every route search).
    let world: Array<{ positions: Float32Array; index: ArrayLike<number> | undefined }> | null = null;
    const worldTriangles = () => {
      if (world) return world;
      world = targets.map((object) => {
        const mesh = object as THREE.Mesh;
        const attr = mesh.geometry.getAttribute("position");
        const positions = new Float32Array(attr.count * 3);
        const v = new THREE.Vector3();
        for (let k = 0; k < attr.count; k += 1) {
          v.fromBufferAttribute(attr, k).applyMatrix4(mesh.matrixWorld);
          positions[k * 3] = v.x;
          positions[k * 3 + 1] = v.y;
          positions[k * 3 + 2] = v.z;
        }
        return { positions, index: mesh.geometry.getIndex()?.array };
      });
      return world;
    };
    onReady({
      ground: (x, z) => {
        raycaster.set(new THREE.Vector3(x, 400, z), down);
        const hit = raycaster.intersectObjects(targets, false)[0] ?? (simple ? raycaster.intersectObjects(tiles, false)[0] : undefined);
        return hit ? hit.point.y : null;
      },
      grid: (minX, maxX, minZ, maxZ, cell) => {
        const grid = createHeightGrid(minX, minZ, cell, Math.floor((maxX - minX) / cell) + 1, Math.floor((maxZ - minZ) / cell) + 1);
        for (const { positions, index } of worldTriangles()) rasterizeTriangles(grid, positions, index);
        return grid;
      },
    });
    return () => {
      cancelled = true;
    };
  }, [scene, site.basePath, onReady]);

  return (
    <group ref={group} scale={100}>
      <primitive
        object={scene}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onPick(e.point.clone());
        }}
      />
    </group>
  );
}

function slopeColor(deg: number): [number, number, number] {
  if (deg >= EVA.noGoSlopeDeg) return [0.94, 0.33, 0.29];
  if (deg >= EVA.cautionSlopeDeg) return [0.96, 0.62, 0.04];
  return [0.2, 0.83, 0.6];
}

class TerrainBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Text label as a camera-facing sprite (canvas texture) — no extra React roots inside the WebGL tree. */
function LabelSprite({ text, position, active, onClick }: { text: string; position: [number, number, number]; active: boolean; onClick: () => void }) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = "600 40px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(text).width) + 44;
    canvas.width = width;
    canvas.height = 68;
    ctx.font = font;
    ctx.fillStyle = active ? "rgba(245,158,11,0.92)" : "rgba(8,6,5,0.78)";
    ctx.beginPath();
    ctx.roundRect(0, 0, width, 68, 34);
    ctx.fill();
    ctx.fillStyle = active ? "#1a0f06" : "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 22, 36);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: width / 68 };
  }, [text, active]);
  useEffect(() => () => texture.dispose(), [texture]);
  const height = 1.5;
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10} onClick={(e) => (e.stopPropagation(), onClick())}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

/** Development-only handle for automated visual checks (stripped from production by the DEV guard). */
function DevHandle() {
  const { camera, scene } = useThree();
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __eva?: unknown }).__eva = { camera, scene };
  }, [camera, scene]);
  return null;
}

/** First-person camera along the EVA timeline (eye height 1.7 m), reporting HUD state ~10×/s. */
function WalkRig({ timeline, minutesPerSecond, paused, onUpdate, onDone }: { timeline: WalkTimeline; minutesPerSecond: number; paused: boolean; onUpdate: (s: WalkState) => void; onDone: (s: WalkState) => void }) {
  const { camera, controls } = useThree();
  const t = useRef(0);
  const look = useRef<THREE.Vector3 | null>(null);
  const lastReport = useRef(0);
  const finished = useRef(false);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const fov = cam.fov;
    cam.fov = 70;
    cam.updateProjectionMatrix();
    return () => {
      cam.fov = fov;
      cam.updateProjectionMatrix();
      const end = sampleWalk(timeline, t.current).position;
      camera.position.set(end[0] + 18, end[1] + 16, end[2] + 22);
      const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
      c?.target?.set(end[0], end[1], end[2]);
      c?.update?.();
    };
  }, [camera, controls, timeline]);
  useFrame((state, delta) => {
    if (!paused && !finished.current) t.current += Math.min(delta, 0.1) * minutesPerSecond;
    const s = sampleWalk(timeline, t.current);
    const [x, y, z] = s.position;
    // Look 6 m ahead along the route (or at the next frame while stopped).
    const ahead = sampleWalk(timeline, Math.min(timeline.totalMinutes, t.current + Math.max(0.05, 6 / 50)));
    const target = new THREE.Vector3(ahead.position[0], ahead.position[1] + 1.5, ahead.position[2]);
    if (target.distanceTo(new THREE.Vector3(x, y + 1.7, z)) < 0.5 && look.current) target.copy(look.current);
    look.current = look.current ? look.current.lerp(target, 0.08) : target;
    state.camera.position.set(x, y + 1.7, z);
    state.camera.lookAt(look.current);
    if (state.clock.elapsedTime - lastReport.current > 0.1 || s.done) {
      lastReport.current = state.clock.elapsedTime;
      onUpdate(s);
    }
    if (s.done && !finished.current) {
      finished.current = true;
      onDone(s);
    }
  });
  return null;
}

const hhmm = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/** GCR dose-equivalent rate at the Access Mars sites (Gale floor), mSv per minute — MODELLED. */
const GALE_DOSE_PER_MIN = gcrDosePerSol(pressureAt(-4450)) / (24.6597 * 60);

function Hud({ state, timeline, plan, speed, paused, onSpeed, onPause, onExit }: { state: WalkState | null; timeline: WalkTimeline; plan: EvaPlan; speed: number; paused: boolean; onSpeed: (v: number) => void; onPause: () => void; onExit: () => void }) {
  if (!state) return null;
  const slopeTone = state.slopeDeg >= EVA.noGoSlopeDeg ? "text-rose-400" : state.slopeDeg >= EVA.cautionSlopeDeg ? "text-amber-300" : "text-emerald-300";
  const watts = state.stop ? EVA.metabolicBaseW : metabolicRateW(state.slopeDeg);
  const progress = Math.min(1, state.minutes / Math.max(1e-6, timeline.totalMinutes));
  const stopFrame = state.stop ? timeline.frames.find((f) => f.stop === state.stop) : null;
  const stopLeft = stopFrame ? stopFrame.minutes + EVA.stopMinutes - state.minutes : 0;
  // Values stay in normal case: uppercasing "µSv" would read as "MSV".
  const panel = "rounded-lg border border-cyan-300/30 bg-black/35 px-3 py-2 font-mono text-[11px] tracking-[.06em] text-cyan-100 backdrop-blur-[2px]";
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute inset-0 shadow-[inset_0_0_140px_40px_rgba(0,0,0,.75)]" style={{ borderRadius: "48% / 38%" }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(56,189,248,.08)_100%)]" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-200/70">
        <div className="relative size-10">
          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current" />
          <span className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-current" />
          <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
          <span className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
        </div>
      </div>
      <div className={`absolute left-5 top-5 ${panel}`}>
        <p className="text-[9px] uppercase tracking-[.16em] text-cyan-300/80">EVA · {plan.siteName} · simulated</p>
        <p className="mt-1 text-lg tracking-normal text-white">
          {hhmm(state.minutes)} <span className="text-[11px] text-cyan-200/70">/ {hhmm(timeline.totalMinutes)}</span>
        </p>
        <div className="mt-1 h-1 w-44 rounded bg-cyan-900/60">
          <div className="h-full rounded bg-cyan-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className={`absolute right-5 top-5 text-right ${panel}`}>
        {state.stop ? (
          <>
            <p className="text-[9px] uppercase tracking-[.16em] text-amber-200/90">Science stop</p>
            <p className="mt-1 normal-case tracking-normal text-white">{state.stop}</p>
            <p className="text-[10px] text-cyan-200/70">{hhmm(stopLeft)} left</p>
          </>
        ) : (
          <>
            <p className="text-[9px] uppercase tracking-[.16em] text-cyan-300/80">Next</p>
            <p className="mt-1 normal-case tracking-normal text-white">{state.done ? "Route complete" : state.nextLabel}</p>
            <p className="text-[10px] text-cyan-200/70">{state.done ? "" : `${state.toNextM.toFixed(0)} m`}</p>
          </>
        )}
      </div>
      {!state.stop && state.slopeDeg >= EVA.cautionSlopeDeg ? (
        <div className={`absolute left-1/2 top-[22%] -translate-x-1/2 rounded-md border px-4 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-[.2em] ${state.slopeDeg >= EVA.noGoSlopeDeg ? "border-rose-400/70 bg-rose-950/50 text-rose-300" : "border-amber-300/60 bg-amber-950/40 text-amber-200"}`}>
          {state.slopeDeg >= EVA.noGoSlopeDeg ? "No-go slope" : "Caution slope"} {state.slopeDeg.toFixed(0)}°
        </div>
      ) : null}
      <div className={`absolute bottom-16 left-5 ${panel}`}>
        <p className="text-[9px] uppercase tracking-[.16em] text-cyan-300/80">Suit · crew of 2</p>
        <p className="mt-1">O₂ used <span className="text-white">{state.o2Kg.toFixed(3)}</span> / {plan.o2Kg.toFixed(3)} kg</p>
        <p>Metabolic <span className="text-white">{watts.toFixed(0)} W</span> each</p>
        <p>GCR dose <span className="text-white">{(state.minutes * GALE_DOSE_PER_MIN * 1000).toFixed(1)} µSv</span> (model)</p>
      </div>
      <div className={`absolute bottom-16 right-5 text-right ${panel}`}>
        <p className="text-[9px] uppercase tracking-[.16em] text-cyan-300/80">Terrain</p>
        <p className="mt-1">
          Slope <span className={slopeTone}>{state.slopeDeg.toFixed(1)}°</span>
        </p>
        <p>Height {state.position[1].toFixed(1)} m (site frame)</p>
        <p>
          Walked <span className="text-white">{state.distanceM.toFixed(0)}</span> / {timeline.totalDistanceM.toFixed(0)} m
        </p>
      </div>
      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-cyan-300/30 bg-black/55 px-2 py-1.5 font-mono text-[10.5px] text-cyan-100">
        <button type="button" onClick={onPause} className="rounded px-2 py-0.5 hover:bg-cyan-400/15">
          {paused ? "Resume" : "Pause"}
        </button>
        {[0.5, 1, 2, 5].map((v) => (
          <button key={v} type="button" onClick={() => onSpeed(v)} className={`rounded px-2 py-0.5 ${speed === v ? "bg-cyan-400/25 text-white" : "hover:bg-cyan-400/15"}`}>
            ×{v * 60}
          </button>
        ))}
        <button type="button" onClick={onExit} className="rounded px-2 py-0.5 text-rose-200 hover:bg-rose-400/15">
          Exit HUD
        </button>
      </div>
    </div>
  );
}

export interface SurfaceEvaProps {
  site: EvaSite;
  initial: EvaPlan | null;
  onPlan: (plan: EvaPlan | null) => void;
  onPoi: (poi: EvaPoi | null) => void;
  activePoi: EvaPoi | null;
}

export default function SurfaceEva({ site, initial, onPlan, onPoi, activePoi }: SurfaceEvaProps) {
  const [terrain, setTerrain] = useState<TerrainInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<EvaWaypoint[]>(() => (initial && initial.siteId === site.id ? initial.waypoints : []));
  const onReady = useMemo(() => (info: TerrainInfo) => setTerrain(info), []);
  const [walking, setWalking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [walkState, setWalkState] = useState<WalkState | null>(null);
  const [routeNote, setRouteNote] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [beforeRoute, setBeforeRoute] = useState<EvaWaypoint[] | null>(null);

  /** Replace each straight leg by an A* path that avoids caution slopes and never crosses no-go terrain. */
  const planSafeRoute = () => {
    if (!terrain || waypoints.length < 2) return;
    const next: EvaWaypoint[] = [waypoints[0]!];
    let rerouted = 0;
    const failed: number[] = [];
    let maxSlope = 0;
    waypoints.slice(1).forEach((b, i) => {
      const a = waypoints[i]!;
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      const margin = Math.max(25, span * 0.5);
      const minX = Math.min(a.x, b.x) - margin;
      const maxX = Math.max(a.x, b.x) + margin;
      const minZ = Math.min(a.z, b.z) - margin;
      const maxZ = Math.max(a.z, b.z) + margin;
      const cell = Math.max(1, Math.sqrt(((maxX - minX) * (maxZ - minZ)) / 60000));
      const result = findSafePath(terrain.grid(minX, maxX, minZ, maxZ, cell), a, b);
      if (!result.found) {
        failed.push(i + 1);
        next.push(b);
        return;
      }
      maxSlope = Math.max(maxSlope, result.maxSlopeDeg);
      if (result.points.length > 2) rerouted += 1;
      result.points.slice(1, -1).forEach((p, k) => next.push({ id: `safe-${Date.now().toString(36)}-${i}-${k}`, x: p.x, y: terrain.ground(p.x, p.z) ?? a.y, z: p.z }));
      next.push(b);
    });
    setBeforeRoute(waypoints);
    setWaypoints(next);
    setRouteNote(
      failed.length
        ? { tone: "warn", text: `No path under 25° found for leg${failed.length > 1 ? "s" : ""} ${failed.join(", ")} — kept straight; move the waypoints.` }
        : { tone: "ok", text: `Safe route: ${rerouted} leg${rerouted === 1 ? "" : "s"} rerouted · steepest ${maxSlope.toFixed(1)}° (A* on the terrain mesh; caution ≥ ${EVA.cautionSlopeDeg}°, no-go ≥ ${EVA.noGoSlopeDeg}°).` },
    );
  };

  useEffect(() => {
    setWaypoints(initial && initial.siteId === site.id ? initial.waypoints : []);
    setTerrain(null);
    setLoadError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

  const pois = useMemo(() => site.pois.map((poi) => ({ poi, y: terrain?.ground(poi.position[0], poi.position[2]) ?? 0 })), [site.pois, terrain]);

  // Dense, terrain-following samples for every leg (1 m spacing).
  const samples = useMemo<Sample[][]>(() => {
    if (!terrain) return [];
    return waypoints.slice(1).map((b, i) => {
      const a = waypoints[i]!;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(2, Math.ceil(d / 1));
      const out: Sample[] = [];
      for (let k = 0; k <= n; k += 1) {
        const t = k / n;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        out.push({ x, y: terrain.ground(x, z) ?? a.y + (b.y - a.y) * t, z });
      }
      return out;
    });
  }, [waypoints, terrain]);

  const plan = useMemo(() => {
    if (waypoints.length < 2 || !samples.length) return null;
    const visited = waypoints.filter((w) => w.poiId).map((w) => site.pois.find((p) => p.id === w.poiId)!).filter(Boolean);
    return computeEvaPlan({ siteId: site.id, siteName: site.name, waypoints, segmentSamples: samples, pois: visited.map((p) => ({ id: p.id, title: p.title, weight: p.weight })), crew: 2 });
  }, [waypoints, samples, site]);

  useEffect(() => onPlan(plan), [plan, onPlan]);

  const timeline = useMemo(() => {
    if (!plan || !samples.length) return null;
    const visited = waypoints.filter((w) => w.poiId).map((w) => site.pois.find((p) => p.id === w.poiId)).filter((p): p is EvaPoi => !!p);
    return buildWalkTimeline(samples, waypoints, visited.map((p) => ({ id: p.id, title: p.title })), 2);
  }, [plan, samples, waypoints, site.pois]);
  useEffect(() => {
    if (!timeline) setWalking(false);
  }, [timeline]);

  const addWaypoint = (point: THREE.Vector3) => {
    const snap = pois.find(({ poi }) => Math.hypot(poi.position[0] - point.x, poi.position[2] - point.z) < 5);
    const wp: EvaWaypoint = snap ? { id: `wp-${Date.now()}`, x: snap.poi.position[0], y: snap.y, z: snap.poi.position[2], poiId: snap.poi.id } : { id: `wp-${Date.now()}`, x: point.x, y: point.y, z: point.z };
    setWaypoints((prev) => [...prev, wp]);
    setRouteNote(null);
    setBeforeRoute(null);
  };

  const line = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const colors: Array<[number, number, number]> = [];
    samples.forEach((leg) =>
      leg.forEach((s, i) => {
        const prev = leg[i - 1];
        const slope = prev ? (Math.atan2(Math.abs(s.y - prev.y), Math.hypot(s.x - prev.x, s.z - prev.z) || 1e-6) * 180) / Math.PI : 0;
        points.push(new THREE.Vector3(s.x, s.y + 0.2, s.z));
        colors.push(slopeColor(slope));
      }),
    );
    return points.length >= 2 ? { points, colors } : null;
  }, [samples]);

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [30, 26, 42], fov: 50, near: 0.1, far: 5000 }} dpr={[1, 1.6]} shadows={false}>
        <color attach="background" args={["#c99a74"]} />
        <fog attach="fog" args={["#c99a74", 400, 2600]} />
        <hemisphereLight args={["#f3dcc4", "#5a3a26", 0.9]} />
        <directionalLight position={[120, 160, 60]} intensity={1.6} color="#fff0de" />
        <TerrainBoundary onError={setLoadError}>
          <Suspense fallback={null}>
            <Terrain site={site} onReady={onReady} onPick={addWaypoint} />
          </Suspense>
        </TerrainBoundary>
        {pois.filter(({ poi }) => !walking || !walkState || Math.hypot(poi.position[0] - walkState.position[0], poi.position[2] - walkState.position[2]) > 3).map(({ poi, y }) => (
          <group key={poi.id} position={[poi.position[0], y, poi.position[2]]}>
            <mesh position={[0, 1.2, 0]} onClick={(e) => (e.stopPropagation(), onPoi(poi))}>
              <coneGeometry args={[0.45, 1.4, 12]} />
              <meshBasicMaterial color={activePoi?.id === poi.id ? "#fbbf24" : "#38bdf8"} toneMapped={false} />
            </mesh>
            <LabelSprite text={poi.title} position={[0, 3.2, 0]} active={activePoi?.id === poi.id} onClick={() => onPoi(poi)} />
          </group>
        ))}
        <mesh position={[0, (terrain?.ground(0, 0) ?? 0) + 0.6, 0]}>
          <boxGeometry args={[2.8, 1.2, 2.2]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        {waypoints.map((w, i) =>
          walking && walkState && Math.hypot(w.x - walkState.position[0], w.z - walkState.position[2]) <= 3 ? null : (
          <mesh key={w.id} position={[w.x, w.y + 0.4, w.z]}>
            <sphereGeometry args={[0.45, 14, 14]} />
            <meshBasicMaterial color={i === 0 ? "#34d399" : "#f59e0b"} toneMapped={false} />
          </mesh>
        )
        )}
        {line ? <Line points={line.points} vertexColors={line.colors} lineWidth={4} /> : null}
        <DevHandle />
        {walking && timeline ? <WalkRig timeline={timeline} minutesPerSecond={speed} paused={paused} onUpdate={setWalkState} onDone={() => setPaused(true)} /> : null}
        <OrbitControls makeDefault enabled={!walking} maxPolarAngle={Math.PI / 2 - 0.06} minDistance={4} maxDistance={700} enableDamping dampingFactor={0.08} />
      </Canvas>
      {!terrain || loadError ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={loadError ? "rounded-lg bg-black/75 px-3 py-2 font-mono text-[11px] text-rose" : "rounded-full bg-black/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[.16em] text-white"}>
            {loadError ? `Terrain failed to load (${site.basePath}/terrain.glb): ${loadError}` : "Decoding Curiosity terrain…"}
          </div>
        </div>
      ) : null}
      {walking && timeline && plan ? (
        <Hud state={walkState} timeline={timeline} plan={plan} speed={speed} paused={paused} onSpeed={setSpeed} onPause={() => setPaused((p) => !p)} onExit={() => (setWalking(false), setWalkState(null), setPaused(false))} />
      ) : null}
      <div className={`pointer-events-auto absolute left-3 top-3 flex flex-wrap gap-1.5 ${walking ? "hidden" : ""}`}>
        <button type="button" className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-2.5 py-1 font-mono text-[10.5px] text-cyan-50 disabled:opacity-40" disabled={!timeline} onClick={() => (setWalkState(null), setPaused(false), setWalking(true))}>
          Walk route (helmet HUD)
        </button>
        <button type="button" className="rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-1 font-mono text-[10.5px] text-emerald-50 disabled:opacity-40" disabled={!terrain || waypoints.length < 2} onClick={planSafeRoute} title="Reroute every leg with A* over the terrain mesh, avoiding slopes ≥ 15° where possible and never crossing ≥ 25°">
          Safe route (A*)
        </button>
        {beforeRoute ? (
          <button type="button" className="rounded-lg border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[10.5px] text-white" onClick={() => (setWaypoints(beforeRoute), setBeforeRoute(null), setRouteNote(null))}>
            Revert route
          </button>
        ) : null}
        <button type="button" className="rounded-lg border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[10.5px] text-white disabled:opacity-40" disabled={!waypoints.length} onClick={() => setWaypoints((w) => w.slice(0, -1))}>
          Undo waypoint
        </button>
        <button type="button" className="rounded-lg border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[10.5px] text-white disabled:opacity-40" disabled={!waypoints.length} onClick={() => setWaypoints([])}>
          Clear route
        </button>
        <span className="rounded-lg border border-white/15 bg-black/55 px-2.5 py-1 font-mono text-[10.5px] text-white/80">Click the ground to add waypoints · click a blue marker for the POI card</span>
        {routeNote ? (
          <span className={`basis-full rounded-lg border px-2.5 py-1 font-mono text-[10.5px] ${routeNote.tone === "ok" ? "border-emerald-300/40 bg-black/70 text-emerald-200" : "border-amber-300/50 bg-black/70 text-amber-200"}`}>{routeNote.text}</span>
        ) : null}
      </div>
    </div>
  );
}
