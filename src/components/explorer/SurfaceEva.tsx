import { Line, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { computeEvaPlan } from "@/core/science/eva";
import { EVA } from "@/core/science/constants";
import type { EvaPlan, EvaWaypoint } from "@/core/types";
import type { EvaPoi, EvaSite } from "@/data/evaSites";

type Sample = { x: number; y: number; z: number };

interface TerrainInfo {
  ground: (x: number, z: number) => number | null;
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
    onReady({
      ground: (x, z) => {
        raycaster.set(new THREE.Vector3(x, 400, z), down);
        const hit = raycaster.intersectObjects(targets, false)[0] ?? (simple ? raycaster.intersectObjects(tiles, false)[0] : undefined);
        return hit ? hit.point.y : null;
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

  const addWaypoint = (point: THREE.Vector3) => {
    const snap = pois.find(({ poi }) => Math.hypot(poi.position[0] - point.x, poi.position[2] - point.z) < 5);
    const wp: EvaWaypoint = snap ? { id: `wp-${Date.now()}`, x: snap.poi.position[0], y: snap.y, z: snap.poi.position[2], poiId: snap.poi.id } : { id: `wp-${Date.now()}`, x: point.x, y: point.y, z: point.z };
    setWaypoints((prev) => [...prev, wp]);
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
        {pois.map(({ poi, y }) => (
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
        {waypoints.map((w, i) => (
          <mesh key={w.id} position={[w.x, w.y + 0.4, w.z]}>
            <sphereGeometry args={[0.45, 14, 14]} />
            <meshBasicMaterial color={i === 0 ? "#34d399" : "#f59e0b"} toneMapped={false} />
          </mesh>
        ))}
        {line ? <Line points={line.points} vertexColors={line.colors} lineWidth={4} /> : null}
        <DevHandle />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.06} minDistance={4} maxDistance={700} enableDamping dampingFactor={0.08} />
      </Canvas>
      {!terrain || loadError ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={loadError ? "rounded-lg bg-black/75 px-3 py-2 font-mono text-[11px] text-rose" : "rounded-full bg-black/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[.16em] text-white"}>
            {loadError ? `Terrain failed to load (${site.basePath}/terrain.glb): ${loadError}` : "Decoding Curiosity terrain…"}
          </div>
        </div>
      ) : null}
      <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap gap-1.5">
        <button type="button" className="rounded-lg border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[10.5px] text-white disabled:opacity-40" disabled={!waypoints.length} onClick={() => setWaypoints((w) => w.slice(0, -1))}>
          Undo waypoint
        </button>
        <button type="button" className="rounded-lg border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[10.5px] text-white disabled:opacity-40" disabled={!waypoints.length} onClick={() => setWaypoints([])}>
          Clear route
        </button>
        <span className="rounded-lg border border-white/15 bg-black/55 px-2.5 py-1 font-mono text-[10.5px] text-white/80">Click the ground to add waypoints · click a blue marker for the POI card</span>
      </div>
    </div>
  );
}
