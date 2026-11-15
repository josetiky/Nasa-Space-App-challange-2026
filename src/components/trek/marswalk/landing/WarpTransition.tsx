/**
 * M.I.Y.H. · Salto al hiperespacio (starfield warp) entre "Iniciar recorrido" y el video de la intro.
 * Canvas 2D: las estrellas aceleran desde el centro y se estiran en líneas; destello y fundido a negro.
 * ≈1.8 s. Con "reducir movimiento" es solo un fundido corto. Esc o clic lo terminan. Solo vista.
 */
import { useEffect, useRef } from "react";
import type { TrekLang } from "../../i18n";
import "./landing.css";

const DURATION_MS = 1800;
const REDUCED_MS = 450;

/** Silbido de salto: ruido filtrado que sube de tono (dentro del gesto de clic). */
function whoosh(): () => void {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return () => undefined;
    const ctx = new AC();
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    bp.frequency.setValueAtTime(180, now);
    bp.frequency.exponentialRampToValueAtTime(3200, now + 1.5);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.35, now + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
    // Golpe grave al "saltar"
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, now + 1.35);
    o.frequency.exponentialRampToValueAtTime(40, now + 1.9);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.setValueAtTime(0.0001, now + 1.35);
    og.gain.exponentialRampToValueAtTime(0.5, now + 1.4);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 1.95);
    src.connect(bp).connect(g).connect(ctx.destination);
    o.connect(og).connect(ctx.destination);
    src.start(now);
    o.start(now);
    src.stop(now + 2);
    o.stop(now + 2);
    return () => void ctx.close().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}

export function WarpTransition({
  lang,
  muted,
  onDone,
}: {
  lang: TrekLang;
  muted: boolean;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const finishedRef = useRef(false);
  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    done.current();
  };

  useEffect(() => {
    const finish = finishOnce;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stopSound = muted || reduced ? () => undefined : whoosh();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);

    if (reduced) {
      const id = window.setTimeout(finish, REDUCED_MS);
      return () => {
        window.clearTimeout(id);
        window.removeEventListener("keydown", onKey);
        stopSound();
      };
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      finish();
      return () => window.removeEventListener("keydown", onKey);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 900;
    const stars = Array.from({ length: N }, () => ({
      x: (Math.random() * 2 - 1) * 1.2,
      y: (Math.random() * 2 - 1) * 1.2,
      z: 0.15 + Math.random() * 0.85,
      pz: 0,
      hue: Math.random() < 0.15 ? 210 : Math.random() < 0.2 ? 24 : 45,
    }));
    for (const s of stars) s.pz = s.z;

    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      // velocidad: despega suave y acelera fuerte (ease-in)
      const speed = 0.002 + Math.pow(p, 2.6) * 0.09;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.max(w, h) * 0.5;
      // Borra parcialmente el cuadro anterior (estelas) sin tapar la página; el fondo oscuro lo pone CSS
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      for (const s of stars) {
        s.pz = s.z;
        s.z -= speed;
        if (s.z <= 0.02) {
          s.x = (Math.random() * 2 - 1) * 1.2;
          s.y = (Math.random() * 2 - 1) * 1.2;
          s.z = 1;
          s.pz = 1;
        }
        const x = cx + (s.x / s.z) * scale;
        const y = cy + (s.y / s.z) * scale;
        const px = cx + (s.x / s.pz) * scale;
        const py = cy + (s.y / s.pz) * scale;
        const a = Math.min(1, (1 - s.z) * 1.4);
        ctx.strokeStyle = `hsla(${s.hue}, 70%, ${80 + 15 * p}%, ${a})`;
        ctx.lineWidth = Math.max(0.6, (1 - s.z) * 2.6 * dpr);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      const root = rootRef.current;
      if (root) {
        root.style.setProperty("--warp-bg", Math.min(1, p * 1.6).toFixed(3));
        root.style.setProperty("--warp-flash", Math.max(0, (p - 0.78) / 0.22).toFixed(3));
      }
      if (p >= 1) {
        finish();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      stopSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className="warp"
      role="status"
      aria-live="polite"
      onClick={finishOnce}
    >
      <span className="warp__sr">{lang === "es" ? "Iniciando el recorrido" : "Starting the journey"}</span>
      <canvas ref={canvasRef} className="warp__canvas" aria-hidden="true" />
      <div className="warp__flash" aria-hidden="true" />
    </div>
  );
}
