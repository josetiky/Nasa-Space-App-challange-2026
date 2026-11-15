/**
 * M.I.Y.H. · Escena 3D del aterrizaje (three.js imperativo, igual que MarsGlobe). Solo vista.
 *
 *  0–20 s   ESPACIO: Marte (misma textura /miyh/2k_mars.jpg), atmósfera fresnel, estrellas,
 *           estelas de plasma. La cámara se acerca y entra sobre el cráter Gale.
 *  20–50 s  SUELO: terreno low-poly procedural (ilustrativo: borde del cráter + Monte Sharp) y,
 *           en el punto de aterrizaje, la malla REAL de 128 m del sitio landing_site
 *           (/data/trek/gale/landing_site/elevation.f32, Curiosity/Access Mars).
 *  27 s →   CABINA: ventana con marco naranja estilo Cupola, consola con luces y pasamanos azules,
 *           pegada a la cámara.
 *  34 s →   POLVO levantado por los motores que tapa la ventana en el contacto.
 */
import * as THREE from "three";
import {
  COCKPIT_START_S,
  ENTRY_START_S,
  GROUND_START_S,
  TOUCHDOWN_S,
  envelope,
  sampleFlight,
} from "./script";

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const ATMO_FRAG = /* glsl */ `
  uniform float uHeat;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
    vec3 col = mix(vec3(0.93, 0.62, 0.45), vec3(1.0, 0.55, 0.2), uHeat);
    gl_FragColor = vec4(col * f * (1.1 + uHeat * 2.0), f * 0.85);
  }
`;

/** Dirección en la esfera de three.js para una latitud/longitud (mismo mapeo UV de SphereGeometry). */
function surfaceDir(latDeg: number, lonDeg: number): THREE.Vector3 {
  const u = (lonDeg + 180) / 360;
  const v = (90 - latDeg) / 180;
  const phi = u * Math.PI * 2;
  const theta = v * Math.PI;
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(theta),
    Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
  ).normalize();
}

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

// Ruido de valor simple (determinista) para el terreno procedural
function hash(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}
function fbm(x: number, y: number): number {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    s += amp * vnoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

/** Altura (m) del terreno ilustrativo de Gale; el punto de aterrizaje queda en (0, 0, 0). */
function rawHeight(x: number, z: number): number {
  const r = Math.hypot(x, z + 2000);
  const rim = 2200 * Math.exp(-(((r - 22000) / 3000) ** 2));
  const sharp = 4800 * Math.exp(-(x * x + (z + 11000) ** 2) / (2 * 5000 * 5000));
  const flat = smoothstep(120, 900, Math.hypot(x, z));
  const n = (fbm(x / 2500, z / 2500) * 220 + fbm(x / 380, z / 380) * 30) * flat;
  return rim + sharp + n;
}
const BASE_H = rawHeight(0, 0);
const terrainHeight = (x: number, z: number) => rawHeight(x, z) - BASE_H;

function roundedRect(p: THREE.Shape | THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
}

function dustSprite(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LandingScene {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private space = new THREE.Scene();
  private ground = new THREE.Scene();
  private atmoMat!: THREE.ShaderMaterial;
  private streaks!: THREE.LineSegments;
  private streakPos!: Float32Array;
  private cockpit = new THREE.Group();
  private blinkers: THREE.Mesh[] = [];
  private dust!: THREE.Points;
  private dustSeed!: Float32Array;
  private galeDir = surfaceDir(-4.6, 137.4);
  private side: THREE.Vector3;
  private up: THREE.Vector3;
  private reduced: boolean;
  private inGround = false;
  private skyHigh = new THREE.Color("#7a4c33");
  private skyLow = new THREE.Color("#c9a07a");
  private tmpColor = new THREE.Color();

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    this.reduced = opts.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.001, 200);
    this.side = new THREE.Vector3().crossVectors(this.galeDir, new THREE.Vector3(0, 1, 0)).normalize();
    this.up = new THREE.Vector3().crossVectors(this.side, this.galeDir).normalize();

    this.buildSpace();
    this.buildGround();
    this.buildCockpit();
    this.space.add(this.camera);
    this.precompile();
  }

  /**
   * Compila de una vez todos los shaders (espacio, suelo, cabina, polvo) para que el cambio de
   * escena no se trabe compilando a mitad de la animación.
   */
  private precompile() {
    try {
      this.cockpit.visible = true;
      this.dust.visible = true;
      this.streaks.visible = true;
      this.renderer.compile(this.space, this.camera);
      this.space.remove(this.camera);
      this.ground.add(this.camera);
      this.renderer.compile(this.ground, this.camera);
      this.ground.remove(this.camera);
      this.space.add(this.camera);
    } catch {
      /* si falla, se compila al primer uso como antes */
    } finally {
      this.cockpit.visible = false;
      this.dust.visible = false;
      this.streaks.visible = false;
    }
  }

  /* ---------------------------------------------------------------- */
  private buildSpace() {
    const s = this.space;
    s.background = new THREE.Color("#020308");
    const tex = new THREE.TextureLoader().load("/miyh/2k_mars.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mars = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 96),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }),
    );
    s.add(mars);

    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { uHeat: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 64), this.atmoMat));

    const n = 2600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(80);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    s.add(
      new THREE.Points(
        sg,
        new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false }),
      ),
    );

    const sun = new THREE.DirectionalLight(0xfff1e0, 2.6);
    sun.position
      .copy(this.galeDir)
      .multiplyScalar(5)
      .addScaledVector(this.side, -3)
      .addScaledVector(this.up, 2);
    s.add(sun, new THREE.AmbientLight(0x6b6f80, 0.35));

    // Estelas de plasma (pegadas a la cámara)
    const m = 260;
    this.streakPos = new Float32Array(m * 6);
    for (let i = 0; i < m; i++) this.resetStreak(i, true);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(this.streakPos, 3));
    this.streaks = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({
        color: 0xffa25a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.streaks.frustumCulled = false;
    this.camera.add(this.streaks);
  }

  private resetStreak(i: number, anyZ: boolean) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.25 + Math.random() * 2.2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const z = anyZ ? -2 - Math.random() * 28 : -30;
    this.streakPos.set([x, y, z, x * 1.04, y * 1.04, z + 1.2 + Math.random() * 1.5], i * 6);
  }

  /* ---------------------------------------------------------------- */
  private buildGround() {
    const g = this.ground;
    g.background = this.skyLow.clone();
    g.fog = new THREE.Fog(this.skyLow.clone(), 3000, 40000);

    const SIZE = 60000;
    const SEG = 200;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes["position"] as THREE.BufferAttribute;
    const colors = new Float32Array(p.count * 3);
    const cLow = new THREE.Color("#6e3a22");
    const cMid = new THREE.Color("#a8653e");
    const cHigh = new THREE.Color("#c98d5e");
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const h = terrainHeight(x, z);
      p.setY(i, h);
      const k = clamp01((h + 300) / 4500) + (hash(Math.floor(x / 300), Math.floor(z / 300)) - 0.5) * 0.15;
      c.copy(cLow).lerp(cMid, clamp01(k * 2)).lerp(cHigh, clamp01(k * 2 - 1));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    );
    g.add(terrain);

    // Malla real del sitio de aterrizaje (128 m × 128 m, 1 m por celda)
    void fetch("/data/trek/gale/landing_site/elevation.f32")
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => {
        if (!buf || buf.byteLength < 129 * 129 * 4) return;
        const elev = new Float32Array(buf);
        let sum = 0;
        let cnt = 0;
        for (const v of elev)
          if (Number.isFinite(v)) {
            sum += v;
            cnt++;
          }
        const mean = cnt ? sum / cnt : 0;
        const pg = new THREE.PlaneGeometry(128, 128, 128, 128);
        pg.rotateX(-Math.PI / 2);
        const pp = pg.attributes["position"] as THREE.BufferAttribute;
        for (let i = 0; i < pp.count; i++) {
          const ix = Math.round(pp.getX(i) + 64);
          const iz = Math.round(pp.getZ(i) + 64);
          const v = elev[iz * 129 + ix];
          pp.setY(i, Number.isFinite(v) ? (v as number) - mean : 0);
        }
        const flat = pg.toNonIndexed();
        flat.computeVertexNormals();
        const patch = new THREE.Mesh(
          flat,
          new THREE.MeshStandardMaterial({ color: "#b07a52", flatShading: true, roughness: 0.95 }),
        );
        patch.position.y = 0.05;
        g.add(patch);
      })
      .catch(() => undefined);

    // Rocas low-poly alrededor del punto de aterrizaje
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: "#6b3b24", flatShading: true, roughness: 1 }),
      320,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < rocks.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.pow(Math.random(), 1.6) * 300;
      const s = 0.12 + Math.random() * 1.1;
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, s * 0.25, Math.sin(a) * r),
        q,
        new THREE.Vector3(s, s * 0.7, s),
      );
      rocks.setMatrixAt(i, m);
    }
    g.add(rocks);

    const sun = new THREE.DirectionalLight(0xffe2c4, 2.3);
    sun.position.set(-4000, 6000, 2500);
    g.add(sun, new THREE.HemisphereLight(0xd8b18c, 0x5a3020, 0.9));

    // Polvo de los motores
    const n = 1800;
    const pos = new Float32Array(n * 3);
    this.dustSeed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      this.dustSeed.set(
        [Math.random() * Math.PI * 2, 4 + Math.random() * 22, Math.random(), Math.random()],
        i * 4,
      );
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        color: "#cfa883",
        size: 9,
        map: dustSprite(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.dust.frustumCulled = false;
    g.add(this.dust);
  }

  /* ---------------------------------------------------------------- */
  private buildCockpit() {
    const metal = new THREE.MeshStandardMaterial({ color: "#1f242c", metalness: 0.55, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: "#14181e", metalness: 0.4, roughness: 0.7 });

    // Marco con ventana (agujero) — estilo Cupola
    const outer = new THREE.Shape();
    roundedRect(outer, -3, -2.2, 6, 4.4, 0.1);
    const hole = new THREE.Path();
    roundedRect(hole, -0.74, -0.3, 1.48, 0.76, 0.18);
    outer.holes.push(hole);
    const frame = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outer, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 3,
        curveSegments: 16,
      }),
      metal,
    );
    frame.position.z = -1.12;
    this.cockpit.add(frame);

    // Franja naranja interior
    const trimShape = new THREE.Shape();
    roundedRect(trimShape, -0.79, -0.35, 1.58, 0.86, 0.21);
    const trimHole = new THREE.Path();
    roundedRect(trimHole, -0.755, -0.315, 1.51, 0.79, 0.185);
    trimShape.holes.push(trimHole);
    const trim = new THREE.Mesh(
      new THREE.ShapeGeometry(trimShape, 16),
      new THREE.MeshStandardMaterial({ color: "#c2452d", emissive: "#5a160a", roughness: 0.5 }),
    );
    trim.position.z = -0.965;
    this.cockpit.add(trim);

    // Tornillos alrededor de la ventana
    const screwGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10);
    screwGeo.rotateX(Math.PI / 2);
    const screwMat = new THREE.MeshStandardMaterial({ color: "#7d8591", metalness: 0.8, roughness: 0.35 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = new THREE.Mesh(screwGeo, screwMat);
      s.position.set(Math.cos(a) * 0.9, 0.08 + Math.sin(a) * 0.5, -0.96);
      this.cockpit.add(s);
    }

    // Consola inferior con luces
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 0.08), dark);
    desk.position.set(0, -0.43, -0.9);
    desk.rotation.x = -0.5;
    this.cockpit.add(desk);
    const lightColors = ["#8fd6b0", "#ffb347", "#8fb3f0", "#8fd6b0", "#ff6b4a"];
    for (let i = 0; i < 18; i++) {
      const col = lightColors[i % lightColors.length]!;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.018, 0.02),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6 }),
      );
      const row = Math.floor(i / 9);
      b.position.set(-0.62 + (i % 9) * 0.155, -0.37 - row * 0.045, -0.855 + row * 0.02);
      b.rotation.x = -0.5;
      this.cockpit.add(b);
      if (i % 3 === 0) this.blinkers.push(b);
    }

    // Pasamanos azules (como en la estación espacial)
    const railMat = new THREE.MeshStandardMaterial({ color: "#3f6fd0", emissive: "#0c1e44", metalness: 0.3, roughness: 0.35 });
    for (const x of [-0.9, 0.9]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 16), railMat);
      rail.position.set(x, 0.05, -0.93);
      this.cockpit.add(rail);
      for (const y of [-0.26, 0.36]) {
        const mount = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.05), screwMat);
        mount.position.set(x, y, -0.95);
        this.cockpit.add(mount);
      }
    }

    const warm = new THREE.PointLight(0xffd9b0, 1.2, 3, 1.5);
    warm.position.set(0, 0.35, -0.4);
    const cool = new THREE.PointLight(0x8fb3f0, 0.5, 3, 1.5);
    cool.position.set(0, -0.4, -0.5);
    this.cockpit.add(warm, cool);
    this.cockpit.visible = false;
    this.camera.add(this.cockpit);
  }

  /* ---------------------------------------------------------------- */
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // En pantallas verticales se abre el campo de visión para que la ventana quepa
    this.camera.fov = this.camera.aspect < 1 ? 75 : 55;
    this.camera.updateProjectionMatrix();
  }

  render(t: number, dt: number) {
    const env = envelope(t);
    const cam = this.camera;

    if (t < GROUND_START_S) {
      if (this.inGround) this.enterSpace();
      const d = this.galeDir;
      const entryStart = d.clone().addScaledVector(this.side, 0.25).normalize().multiplyScalar(1.12);
      if (t < ENTRY_START_S) {
        const e = easeInOut(clamp01(t / ENTRY_START_S));
        const start = d.clone().multiplyScalar(5.5).addScaledVector(this.side, 1.2).addScaledVector(this.up, 0.5);
        cam.position.lerpVectors(start, entryStart, e);
        const look = new THREE.Vector3().lerpVectors(
          new THREE.Vector3(),
          d.clone().addScaledVector(this.side, 0.1).normalize(),
          e,
        );
        cam.up.copy(this.up);
        cam.lookAt(look);
      } else {
        const f = easeInOut(clamp01((t - ENTRY_START_S) / (GROUND_START_S - ENTRY_START_S)));
        const h = 0.12 + (0.004 - 0.12) * f;
        const pos = d.clone().addScaledVector(this.side, 0.25 * (1 - f)).normalize().multiplyScalar(1 + h);
        const look = d.clone().addScaledVector(this.side, 0.25 * (1 - f) - 0.15).normalize();
        cam.position.copy(pos);
        cam.up.copy(pos.clone().normalize());
        cam.lookAt(look);
      }
      this.atmoMat.uniforms["uHeat"]!.value = env.plasma;
      // Estelas
      const mat = this.streaks.material as THREE.LineBasicMaterial;
      mat.opacity = env.plasma * 0.85;
      this.streaks.visible = env.plasma > 0.01;
      if (this.streaks.visible) {
        const speed = 40 * dt;
        for (let i = 0; i < this.streakPos.length / 6; i++) {
          const za = (this.streakPos[i * 6 + 2] ?? 0) + speed;
          this.streakPos[i * 6 + 2] = za;
          this.streakPos[i * 6 + 5] = (this.streakPos[i * 6 + 5] ?? 0) + speed;
          if (za > -1) this.resetStreak(i, false);
        }
        (this.streaks.geometry.attributes["position"] as THREE.BufferAttribute).needsUpdate = true;
      }
    } else {
      if (!this.inGround) this.enterGround();
      const { altM } = sampleFlight(t);
      const span = TOUCHDOWN_S - GROUND_START_S;
      const k = clamp01((TOUCHDOWN_S - t) / span);
      const zc = 9000 * Math.pow(k, 1.6);
      const eye = altM + 2.4;
      const sway = t < 28 ? Math.sin(t * 1.7) * altM * 0.012 : 0;
      cam.position.set(sway, eye, zc);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, zc - Math.max(60, altM * 1.1));
      if (t < 28) cam.rotateZ(Math.sin(t * 1.3) * 0.04 * (1 - clamp01((t - 20) / 8)));

      // Cielo y niebla según altitud
      const hk = clamp01(Math.log10(altM + 1) / Math.log10(11000));
      this.tmpColor.copy(this.skyLow).lerp(this.skyHigh, hk * 0.8);
      (this.ground.background as THREE.Color).copy(this.tmpColor);
      const fog = this.ground.fog as THREE.Fog;
      fog.color.copy(this.tmpColor);
      fog.near = Math.max(800, altM * 0.6);
      fog.far = Math.min(45000, 9000 + altM * 3);

      // Polvo
      const pm = this.dust.material as THREE.PointsMaterial;
      pm.opacity = env.dust * 0.9;
      this.dust.visible = env.dust > 0.01;
      if (this.dust.visible) {
        const age = Math.max(0, t - 33.5);
        const arr = (this.dust.geometry.attributes["position"] as THREE.BufferAttribute).array as Float32Array;
        for (let i = 0; i < arr.length / 3; i++) {
          const a = this.dustSeed[i * 4]!;
          const sp = this.dustSeed[i * 4 + 1]!;
          const lift = this.dustSeed[i * 4 + 2]!;
          const delay = this.dustSeed[i * 4 + 3]! * 2.5;
          const tt = Math.max(0, age - delay);
          const r = 2 + sp * tt * (t > TOUCHDOWN_S ? 0.8 : 1);
          arr[i * 3] = Math.cos(a) * r;
          arr[i * 3 + 1] = 0.4 + lift * tt * 2.2;
          arr[i * 3 + 2] = Math.sin(a) * r;
        }
        (this.dust.geometry.attributes["position"] as THREE.BufferAttribute).needsUpdate = true;
      }
    }

    // Cabina: en vez de un corte, el marco "se cierra" alrededor de la cámara en 1.6 s
    const ck = smoothstep(COCKPIT_START_S - 1.6, COCKPIT_START_S, t);
    this.cockpit.visible = ck > 0;
    if (this.cockpit.visible) {
      const grow = 1 + (1 - ck) * 3.2;
      this.cockpit.scale.set(grow, grow, 1);
      const on = Math.floor(t * 2.2) % 2 === 0;
      this.blinkers.forEach((b, i) => (b.visible = (i % 2 === 0) === on || t > TOUCHDOWN_S + 3));
    }

    // Vibración (desactivada con "reducir movimiento")
    if (!this.reduced && env.shake > 0) {
      const a = 0.006 * env.shake;
      cam.rotateX(Math.sin(t * 47) * a + Math.sin(t * 23) * a * 0.6);
      cam.rotateY(Math.sin(t * 39 + 1) * a);
      cam.rotateZ(Math.sin(t * 31 + 2) * a * 0.7);
    }

    this.renderer.render(this.inGround ? this.ground : this.space, cam);
  }

  private enterGround() {
    this.inGround = true;
    this.space.remove(this.camera);
    this.ground.add(this.camera);
    this.streaks.visible = false;
    this.camera.near = 0.05;
    this.camera.far = 90000;
    this.camera.updateProjectionMatrix();
  }

  private enterSpace() {
    this.inGround = false;
    this.ground.remove(this.camera);
    this.space.add(this.camera);
    this.camera.near = 0.001;
    this.camera.far = 200;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    const free = (o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    };
    this.space.traverse(free);
    this.ground.traverse(free);
    // Sin forceContextLoss: en modo estricto de React el efecto se monta dos veces sobre el mismo canvas.
    this.renderer.dispose();
  }
}
