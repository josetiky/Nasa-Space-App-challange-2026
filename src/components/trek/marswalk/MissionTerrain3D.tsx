/**
 * M.I.Y.H. · Visor 3D del terreno de una misión (ficha de la pestaña 04).
 * three.js directo, como MarsGlobe: malla topográfica + rejilla de alambre, órbita con el ratón o el
 * dedo y exageración vertical rotulada. Sin WebGL muestra un aviso en lugar de romper la ficha.
 * El origen del terreno (REAL / MODELLED) lo define missionTerrains.ts y se muestra siempre.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadSiteElevationGrid } from "@/services/trek/sites";
import { dispatchTrek } from "@/state/trekStore";
import type { TrekLang } from "../i18n";
import { MISSION_TERRAINS, type MissionTerrain } from "./missionTerrains";
import { ProvChip } from "./ui";

const EXAGGERATIONS = [1, 2, 4] as const;

interface Built {
  readonly mesh: THREE.Mesh;
  readonly reliefM: number;
  /** Lado de la tesela en metros. */
  readonly spanM: number;
  dispose(): void;
}

/** Malla REAL: rejilla de elevación a 1 m de Curiosity + ortofoto (fila 0 = z máx, columna 0 = x mín). */
async function buildReal(siteId: string): Promise<Built> {
  const { grid, site } = await loadSiteElevationGrid(siteId);
  const { nx, nz, cell, x0, z0, h } = grid;
  let min = Infinity;
  let max = -Infinity;
  for (const v of h) {
    if (Number.isNaN(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) throw new Error("empty elevation tile");
  const pos = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const v = h[k]!;
      pos[k * 3] = x0 + i * cell;
      pos[k * 3 + 1] = (Number.isNaN(v) ? min : v) - min; // sin dato: se dibuja a la cota mínima
      pos[k * 3 + 2] = -(z0 + j * cell); // +Z del mapa (norte) = -Z de three
      uv[k * 2] = i / (nx - 1);
      uv[k * 2 + 1] = j / (nz - 1);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const tex = site.orthophotoUrl
    ? await new THREE.TextureLoader().loadAsync(site.orthophotoUrl)
    : null;
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
  }
  const mat = new THREE.MeshStandardMaterial({
    ...(tex ? { map: tex } : { color: 0xb5694a }),
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  return {
    mesh: new THREE.Mesh(geo, mat),
    reliefM: max - min,
    spanM: (nx - 1) * cell,
    dispose: () => {
      geo.dispose();
      mat.dispose();
      tex?.dispose();
    },
  };
}

/** Malla MODELLED: tesela ilustrativa en GLB (colores por vértice, sin textura). */
async function buildModelled(url: string): Promise<Built> {
  const gltf = await new GLTFLoader().loadAsync(url);
  let found: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  if (!found) throw new Error("GLB without mesh");
  const mesh = found as THREE.Mesh;
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.applyMatrix4(mesh.matrixWorld);
  mesh.removeFromParent();
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  mesh.geometry.translate(0, -box.min.y, 0);
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.side = THREE.DoubleSide;
  return {
    mesh,
    reliefM: box.max.y - box.min.y,
    spanM: box.max.x - box.min.x,
    dispose: () => {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

function TerrainCanvas({
  terrain,
  wire,
  exaggeration,
  interactive,
  onRelief,
  onState,
}: {
  terrain: MissionTerrain;
  wire: boolean;
  exaggeration: number;
  interactive: boolean;
  onRelief: (reliefM: number, spanM: number) => void;
  onState: (s: "loading" | "ready" | "error" | "nowebgl") => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const live = useRef({ wire, exaggeration, interactive });
  live.current = { wire, exaggeration, interactive };
  const apply = useRef<() => void>(() => {});

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      onState("nowebgl");
      return;
    }
    onState("loading");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
    camera.position.set(110, 88, 140);
    scene.add(new THREE.HemisphereLight(0xffe9d6, 0x2a1a12, 1.1));
    const sun = new THREE.DirectionalLight(0xfff2e6, 2.2);
    sun.position.set(-120, 160, 80);
    scene.add(sun);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 60;
    controls.maxDistance = 420;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.6;
    controls.target.set(0, 0, 0);
    const stopSpin = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stopSpin);

    const group = new THREE.Group();
    scene.add(group);
    let built: Built | null = null;
    let wireMesh: THREE.LineSegments | null = null;
    let disposed = false;

    apply.current = () => {
      const s = live.current;
      group.scale.set(1, s.exaggeration, 1);
      if (wireMesh) wireMesh.visible = s.wire;
      controls.enableZoom = s.interactive; // en la ficha la rueda desplaza el texto, no el modelo
    };

    (terrain.kind === "real" ? buildReal(terrain.siteId) : buildModelled(terrain.glb))
      .then((b) => {
        if (disposed) {
          b.dispose();
          return;
        }
        built = b;
        group.add(b.mesh);
        wireMesh = new THREE.LineSegments(
          new THREE.WireframeGeometry(b.mesh.geometry),
          new THREE.LineBasicMaterial({ color: 0xeee5ca, transparent: true, opacity: 0.3 }),
        );
        wireMesh.position.y = 0.03;
        group.add(wireMesh);
        apply.current();
        onRelief(b.reliefM, b.spanM);
        onState("ready");
      })
      .catch(() => {
        if (!disposed) onState("error");
      });

    const resize = () => {
      const w = Math.max(64, wrap.clientWidth);
      const hgt = Math.max(64, wrap.clientHeight);
      renderer.setSize(w, hgt, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / hgt;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      controls.removeEventListener("start", stopSpin);
      controls.dispose();
      if (wireMesh) {
        wireMesh.geometry.dispose();
        (wireMesh.material as THREE.Material).dispose();
      }
      built?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      apply.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la escena se monta una vez por terreno
  }, [terrain]);

  useEffect(() => apply.current(), [wire, exaggeration, interactive]);

  return <div ref={wrapRef} className="mis-terrain__canvas" />;
}

export function MissionTerrain3D({
  missionId,
  missionName,
  lang,
  expanded,
  onToggleExpanded,
  onLeave,
}: {
  missionId: string;
  missionName: string;
  lang: TrekLang;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Se llama al saltar a MarsWalk para que la ficha se cierre. */
  onLeave: () => void;
}) {
  const terrain = MISSION_TERRAINS[missionId];
  const es = lang === "es";
  const [wire, setWire] = useState(true);
  const [exIdx, setExIdx] = useState(1);
  const [relief, setRelief] = useState(Number.NaN);
  const [span, setSpan] = useState(Number.NaN);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "nowebgl">("loading");
  if (!terrain) return null;
  const ex = EXAGGERATIONS[exIdx]!;
  const real = terrain.kind === "real";

  return (
    <section className="mis-terrain" data-expanded={expanded ? "true" : undefined}>
      <div className="mis-terrain__head">
        <p className="t-label">
          {es ? "Terreno 3D" : "3D terrain"} · <b>{terrain.place}</b>
        </p>
        <ProvChip type={real ? "REAL" : "MODELLED"} />
      </div>
      <div className="mis-terrain__stage">
        <TerrainCanvas
          terrain={terrain}
          wire={wire}
          exaggeration={ex}
          interactive={expanded}
          onRelief={(r, sp) => {
            setRelief(r);
            setSpan(sp);
          }}
          onState={setStatus}
        />
        {status !== "ready" ? (
          <p className="mis-terrain__msg" role="status">
            {status === "loading"
              ? es
                ? "Cargando la malla…"
                : "Loading the mesh…"
              : status === "nowebgl"
                ? es
                  ? "Este navegador no tiene WebGL: no se puede mostrar el modelo 3D."
                  : "This browser has no WebGL: the 3D model cannot be shown."
                : es
                  ? "No se pudo cargar la malla."
                  : "The mesh could not be loaded."}
          </p>
        ) : null}
        <p className="mis-terrain__scale t-label">
          {Number.isFinite(span) ? `${span.toFixed(0)} m × ${span.toFixed(0)} m` : "—"}
          {Number.isFinite(relief)
            ? ` · ${es ? "desnivel" : "relief"} ${relief.toFixed(1)} m`
            : ""}{" "}
          · {es ? "vertical" : "vertical"} ×{ex}
        </p>
      </div>
      <div className="mis-terrain__tools">
        <button
          type="button"
          className="btn btn--primary mis-terrain__explore"
          onClick={onToggleExpanded}
        >
          {expanded
            ? es
              ? "← Volver a la ficha"
              : "← Back to profile"
            : es
              ? "Explorar"
              : "Explore"}
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={wire}
          onClick={() => setWire((v) => !v)}
        >
          {es ? "Malla" : "Mesh"}
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => setExIdx((i) => (i + 1) % EXAGGERATIONS.length)}
          title={es ? "Exageración vertical" : "Vertical exaggeration"}
        >
          {es ? "Relieve" : "Relief"} ×{ex}
        </button>
        {real && expanded ? (
          <button
            type="button"
            className="chip"
            onClick={() => {
              dispatchTrek({ type: "setSiteLoading", siteId: terrain.siteId });
              window.location.hash = "#marswalk";
              onLeave();
            }}
          >
            {es ? "Planear caminata aquí →" : "Plan a walk here →"}
          </button>
        ) : null}
      </div>
      <p className="mis-terrain__note">
        {real
          ? es
            ? "Malla real: fotogrametría estéreo de Curiosity (Navcam/Mastcam) a 1 m, con su ortofoto. NASA/JPL-Caltech · Access Mars."
            : "Real mesh: Curiosity stereo photogrammetry (Navcam/Mastcam) at 1 m, with its orthophoto. NASA/JPL-Caltech · Access Mars."
          : es
            ? `Malla ilustrativa del tipo de relieve donde trabajó ${missionName}, en el formato de tesela de Access Mars. No es elevación medida.`
            : `Illustrative mesh of the kind of relief where ${missionName} worked, in the Access Mars tile format. Not measured elevation.`}{" "}
        {expanded
          ? es
            ? "Arrastra para girar; rueda o pellizco para acercar."
            : "Drag to rotate; scroll or pinch to zoom."
          : es
            ? "Arrastra para girar."
            : "Drag to rotate."}
      </p>
    </section>
  );
}

export default MissionTerrain3D;
