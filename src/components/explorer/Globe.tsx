import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MARS } from "@/core/science/constants";
import { greatCirclePoints, latLonToXYZ, xyzToLatLon } from "@/core/science/geo";
import { solarDeclinationDeg } from "@/core/science/insolation";
import { localTrueSolarTime, marsTimeFromDate } from "@/core/science/marsTime";
import { LANDING_SITES } from "@/core/science/regions";
import { sampleElevation, type TerrainGrid } from "@/core/science/terrain";
import type { GeoPoint } from "@/core/types";
import { CATALOGUE_SITES } from "@/data/sites";
import { colorAt, ELEVATION_STOPS } from "@/data/layers";
import { trekGlobeTexture, type Origin } from "@/services/nasa/adapters";

export type TextureSource = { kind: "trek"; zoom: number; origin: Origin } | { kind: "mola" } | { kind: "none" };

/** Lat/lon grid sphere displaced by MOLA heights (same mapping as latLonToXYZ and the texture UVs). */
function buildGeometry(grid: TerrainGrid | null, exaggeration: number, segLon = 360, segLat = 180) {
  const positions = new Float32Array((segLon + 1) * (segLat + 1) * 3);
  const uvs = new Float32Array((segLon + 1) * (segLat + 1) * 2);
  let p = 0;
  let u = 0;
  for (let i = 0; i <= segLat; i += 1) {
    const lat = 90 - (i / segLat) * 180;
    for (let j = 0; j <= segLon; j += 1) {
      const lon = -180 + (j / segLon) * 360;
      const h = grid ? sampleElevation(grid, { lat, lon: j === segLon ? 179.999 : lon }) : 0;
      const [x, y, z] = latLonToXYZ({ lat, lon }, 1 + (h / MARS.radiusM) * exaggeration);
      positions[p++] = x;
      positions[p++] = y;
      positions[p++] = z;
      uvs[u++] = j / segLon;
      uvs[u++] = 1 - i / segLat;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < segLat; i += 1) {
    for (let j = 0; j < segLon; j += 1) {
      const a = i * (segLon + 1) + j;
      const b = a + segLon + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Offline texture: MOLA colour-coded elevation with simple hillshade (REAL data, no imagery). */
function molaTexture(grid: TerrainGrid): THREE.CanvasTexture {
  const w = 1440;
  const h = 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const e = grid.data[i] ?? 0;
      const ex = grid.data[y * w + Math.min(w - 1, x + 1)] ?? e;
      const ey = grid.data[Math.min(h - 1, y + 1) * w + x] ?? e;
      const shade = Math.max(0.55, Math.min(1.25, 1 + ((e - ex) + (e - ey)) / 1500));
      const [r, g, b] = colorAt(ELEVATION_STOPS, e);
      img.data[i * 4] = Math.min(255, r * shade);
      img.data[i * 4 + 1] = Math.min(255, g * shade);
      img.data[i * 4 + 2] = Math.min(255, b * shade);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function subsolarPoint(date: Date): GeoPoint {
  const t = marsTimeFromDate(date);
  const guess = (12 - t.mtcHours) * 15;
  const lt = localTrueSolarTime(t.mtcHours, guess, t.eotDeg);
  const lon = ((((guess + (12 - lt) * 15 + 180) % 360) + 360) % 360) - 180;
  return { lat: solarDeclinationDeg(t.ls), lon };
}

function Marker({ point, radius, color, lift = 1.012, onClick, label, onHover }: { point: GeoPoint; radius: number; color: string; lift?: number; onClick?: () => void; label?: string; onHover?: (label: string | null) => void }) {
  const position = useMemo(() => new THREE.Vector3(...latLonToXYZ(point, lift)), [point, lift]);
  return (
    <mesh
      position={position}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (label) onHover?.(label);
      }}
      onPointerOut={() => onHover?.(null)}
    >
      <sphereGeometry args={[radius, 12, 12]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function Pulse({ point }: { point: GeoPoint }) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => new THREE.Vector3(...latLonToXYZ(point, 1.014)), [point]);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()), [position]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + 0.35 * Math.sin(clock.elapsedTime * 3);
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={position} quaternion={quaternion}>
      <ringGeometry args={[0.022, 0.03, 32]} />
      <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

/** Smoothly moves the camera to look at a location (OrbitControls keep the origin as target). */
function CameraRig({ focus }: { focus: GeoPoint | null }) {
  const { camera } = useThree();
  const target = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    if (!focus) return;
    const distance = Math.max(2.2, camera.position.length());
    target.current = new THREE.Vector3(...latLonToXYZ(focus, Math.min(distance, 3.6)));
  }, [focus, camera]);
  useFrame(() => {
    if (!target.current) return;
    camera.position.lerp(target.current, 0.08);
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(target.current) < 0.01) target.current = null;
  });
  return null;
}

interface GlobeProps {
  grid: TerrainGrid | null;
  exaggeration: number;
  realSun: boolean;
  hd: boolean;
  selected: GeoPoint | null;
  probe: GeoPoint | null;
  traverse: GeoPoint[];
  focus: GeoPoint | null;
  showLanders: boolean;
  onPick: (p: GeoPoint) => void;
  onHover: (p: GeoPoint | null) => void;
  onTextureSource: (s: TextureSource) => void;
}

function GlobeScene({ grid, exaggeration, realSun, hd, selected, probe, traverse, focus, showLanders, onPick, onHover, onTextureSource }: GlobeProps) {
  const geometry = useMemo(() => buildGeometry(grid, exaggeration), [grid, exaggeration]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [sun, setSun] = useState<GeoPoint>(() => subsolarPoint(new Date()));

  useEffect(() => {
    const timer = setInterval(() => setSun(subsolarPoint(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Progressive imagery: Trek zoom 1 → 2 (→ 3 in HD); MOLA colour relief when Trek is unreachable.
  const [trekFailed, setTrekFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const zooms = hd ? [1, 2, 3] : [1, 2];
    (async () => {
      let any = false;
      for (const z of zooms) {
        try {
          const { canvas, origin } = await trekGlobeTexture("viking", z);
          if (cancelled) return;
          const t = new THREE.CanvasTexture(canvas);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 4;
          setTexture((prev) => {
            prev?.dispose();
            return t;
          });
          onTextureSource({ kind: "trek", zoom: z, origin });
          any = true;
        } catch {
          break;
        }
      }
      if (!cancelled) setTrekFailed(!any);
    })();
    return () => {
      cancelled = true;
    };
  }, [hd, onTextureSource]);

  useEffect(() => {
    if (!trekFailed) return;
    if (grid) {
      setTexture(molaTexture(grid));
      onTextureSource({ kind: "mola" });
    } else onTextureSource({ kind: "none" });
  }, [trekFailed, grid, onTextureSource]);

  const sunPosition = useMemo(() => new THREE.Vector3(...latLonToXYZ(sun, 12)), [sun]);
  const legs = useMemo(
    () =>
      traverse.slice(1).map((p, i) =>
        greatCirclePoints(traverse[i]!, p, 64).map((q) => {
          const h = grid ? sampleElevation(grid, q) : 0;
          return new THREE.Vector3(...latLonToXYZ(q, 1.008 + (h / MARS.radiusM) * exaggeration));
        }),
      ),
    [traverse, grid, exaggeration],
  );

  const toPoint = (e: ThreeEvent<PointerEvent | MouseEvent>) => xyzToLatLon(e.point.x, e.point.y, e.point.z);

  return (
    <>
      <color attach="background" args={["#030202"]} />
      <ambientLight intensity={realSun ? 0.18 : 0.9} />
      {realSun ? <directionalLight position={sunPosition} intensity={2.6} color="#fff1e0" /> : <directionalLight position={[3, 2, 4]} intensity={0.6} />}
      <mesh
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation();
          onPick(toPoint(e));
        }}
        onPointerMove={(e) => onHover(toPoint(e))}
        onPointerOut={() => onHover(null)}
      >
        <meshStandardMaterial map={texture} color={texture ? "#ffffff" : "#b5653a"} roughness={0.95} metalness={0} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="#e8a274" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      {CATALOGUE_SITES.map((s) => (
        <Marker key={s.id} point={s.point} radius={0.009} color="#f59e0b" onClick={() => onPick(s.point)} label={s.name} onHover={setLabel} />
      ))}
      {showLanders ? LANDING_SITES.map((s) => <Marker key={s.id} point={s.point} radius={0.006} color="#f4f1ea" lift={1.016} label={`${s.mission} (${s.year})`} onHover={setLabel} />) : null}
      {selected ? <Pulse point={selected} /> : null}
      {probe ? <Marker point={probe} radius={0.007} color="#38bdf8" lift={1.016} /> : null}
      {legs.map((points, i) => (
        <Line key={i} points={points} color="#f59e0b" lineWidth={2.5} dashed={false} />
      ))}
      {traverse.map((p, i) => (
        <Marker key={`wp-${i}`} point={p} radius={0.008} color="#fbbf24" lift={1.012} label={`Waypoint ${i + 1}`} onHover={setLabel} />
      ))}
      <CameraRig focus={focus} />
      <OrbitControls enablePan={false} minDistance={1.25} maxDistance={4.5} enableDamping dampingFactor={0.08} rotateSpeed={0.5} zoomSpeed={0.6} />
      <LabelSync label={label} />
    </>
  );
}

/** Pushes the hovered marker label to the DOM overlay without re-rendering the scene. */
function LabelSync({ label }: { label: string | null }) {
  useEffect(() => {
    const el = document.getElementById("globe-hover-label");
    if (el) {
      el.textContent = label ?? "";
      el.style.opacity = label ? "1" : "0";
    }
  }, [label]);
  return null;
}

export default function Globe(props: GlobeProps) {
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0.9, 0.7, 3.4], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
        <GlobeScene {...props} />
      </Canvas>
      <div id="globe-hover-label" className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 px-2.5 py-1 font-mono text-[10.5px] text-white opacity-0 transition-opacity" />
    </div>
  );
}
