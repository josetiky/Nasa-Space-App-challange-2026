/**
 * M.I.Y.H. · Marte 3D compartido (equivalente a shared/js/scene/mars.js + presets.js del front):
 * esfera con textura de Solar System Scope, atmósfera fresnel, arrastre con inercia y presets por pestaña
 * (hero · corner · behind · hidden) animados con CSS. Solo decorativo: no muestra datos.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type GlobePreset = "hero" | "corner" | "behind" | "hidden";

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
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(vNormal, vView)), 4.0);
    gl_FragColor = vec4(vec3(0.93, 0.62, 0.45) * f * 1.1, f * 0.8);
  }
`;

export function MarsGlobe({ preset }: { preset: GlobePreset }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const presetRef = useRef(preset);
  presetRef.current = preset;

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
      wrap.dataset["fallback"] = "true"; // sin WebGL: se muestra la esfera CSS de respaldo
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 4.15);

    const tex = new THREE.TextureLoader().load("/miyh/2k_mars.jpg");
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }),
    );
    planet.rotation.z = 0.44; // inclinación axial ~25°
    const group = new THREE.Group();
    group.add(planet);
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(atmo);
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    const sun = new THREE.DirectionalLight(0xfff2e6, 2.4);
    sun.position.set(-3, 2, 3);
    scene.add(sun);

    const resize = () => {
      const size = Math.max(64, Math.round(wrap.clientWidth)); // tamaño de maqueta (sin la escala CSS del preset)
      renderer.setSize(size, size, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);

    // Arrastre con inercia (solo en el preset hero)
    let velocity = 0;
    let drag: { x: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (presetRef.current !== "hero") return;
      drag = { x: e.clientX, t: performance.now() };
      wrap.setPointerCapture(e.pointerId);
      wrap.classList.add("is-dragging");
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const now = performance.now();
      const dx = e.clientX - drag.x;
      const dRot = (dx / Math.max(1, wrap.clientWidth)) * Math.PI * 1.6;
      planet.rotation.y += dRot;
      velocity = dRot / Math.max(1, now - drag.t);
      drag = { x: e.clientX, t: now };
    };
    const onUp = () => {
      drag = null;
      wrap.classList.remove("is-dragging");
    };
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden || presetRef.current === "hidden") return;
      if (!drag) {
        planet.rotation.y += velocity * 16 + (reduce ? 0 : dt * 0.05);
        velocity *= 0.94;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      tex.dispose();
      planet.geometry.dispose();
      (planet.material as THREE.Material).dispose();
      atmo.geometry.dispose();
      (atmo.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={wrapRef} className="mw-globe" data-preset={preset} aria-hidden="true" />;
}
