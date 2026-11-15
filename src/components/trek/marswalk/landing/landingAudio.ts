/**
 * M.I.Y.H. · Sonido del aterrizaje (Web Audio). Solo vista.
 *
 *  - Tonos "Quindar" de la radio del Apolo: 2525 Hz al empezar a hablar y 2475 Hz al terminar (250 ms).
 *  - Estruendo de entrada: /eva/sfx/atmosphere.mp3 (Access Mars, Apache-2.0) + ruido filtrado.
 *  - Motores: /eva/sfx/jets.mp3 en bucle.
 *  - Voz: si existe /miyh/landing/vo/<lang>/<id>.mp3 se reproduce con filtro de radio.
 *    Si no hay grabación NO se usa la voz sintética del navegador (sonaba robótica): se oye solo
 *    la transmisión (bip + estática suave) y la frase aparece como subtítulo.
 *
 * El AudioContext se crea dentro del clic de "Aterrizar" (unlock) para que el navegador permita sonido.
 */
import type { TrekLang } from "../../i18n";

type Ctx = AudioContext;

/** Volumen general (más bajo que antes para que no se sature). */
const MASTER = 0.7;

function noiseBuffer(ctx: Ctx, seconds = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // ruido café: más grave, como viento/estruendo
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

export class LandingAudio {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private radio: AudioNode | null = null;
  private beds: { gain: GainNode; src: AudioScheduledSourceNode }[] = [];
  private rumbleGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private atmoGain: GainNode | null = null;
  private jetsGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private vo = new Map<string, AudioBuffer>();
  private muted = false;
  private disposed = false;
  private started = false;

  /** Llamar SOLO dentro de un clic del usuario. */
  unlock(muted: boolean): void {
    this.muted = muted;
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      void this.ctx.resume();
      this.master = this.ctx.createGain();
      this.master.gain.value = muted ? 0 : MASTER;
      this.master.connect(this.ctx.destination);
      // Speech synthesis también necesita "despertar" dentro del gesto en algunos navegadores
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      this.ctx = null;
    }
  }

  /** Carga sonidos y arranca las capas de fondo (en silencio). */
  async start(lang: TrekLang, voiceIds: readonly string[]): Promise<void> {
    if (this.started) return; // el efecto de React puede correr dos veces en desarrollo
    this.started = true;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    // Bus de radio: pasa-banda 300–3400 Hz + saturación ligera
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 320;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(1.3 * x) / Math.tanh(1.3);
    }
    shaper.curve = curve;
    const radioGain = ctx.createGain();
    radioGain.gain.value = 0.85;
    hp.connect(lp).connect(shaper).connect(radioGain).connect(master);
    this.radio = hp;

    // Zumbido de cabina
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0.025;
    this.humGain.connect(master);
    for (const [f, type] of [
      [55, "sine"],
      [110, "triangle"],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(this.humGain);
      o.start();
      this.beds.push({ gain: this.humGain, src: o });
    }

    // Viento / plasma: ruido café filtrado
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx);
    n.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 400;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    n.connect(this.windFilter).connect(this.windGain).connect(master);
    n.start();
    this.beds.push({ gain: this.windGain, src: n });

    // Estruendo grave
    const r = ctx.createBufferSource();
    r.buffer = noiseBuffer(ctx, 2);
    r.loop = true;
    const rlp = ctx.createBiquadFilter();
    rlp.type = "lowpass";
    rlp.frequency.value = 90;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    r.connect(rlp).connect(this.rumbleGain).connect(master);
    r.start();
    this.beds.push({ gain: this.rumbleGain, src: r });

    const [atmo, jets] = await Promise.all([
      this.fetchBuffer("/eva/sfx/atmosphere.mp3"),
      this.fetchBuffer("/eva/sfx/jets.mp3"),
    ]);
    if (this.disposed || !this.ctx) return;
    if (atmo) this.atmoGain = this.loop(atmo);
    if (jets) this.jetsGain = this.loop(jets);

    // Voz grabada opcional (si no existe el archivo, solo se oye la transmisión de radio)
    await Promise.all(
      voiceIds.map(async (id) => {
        const b = await this.fetchBuffer(`/miyh/landing/vo/${lang}/${id}.mp3`);
        if (b) this.vo.set(id, b);
      }),
    );
  }

  private loop(buf: AudioBuffer): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(g).connect(this.master);
    s.start();
    this.beds.push({ gain: g, src: s });
    return g;
  }

  private async fetchBuffer(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("text/html")) return null; // fallback SPA: el archivo no existe
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  /** Intensidades 0..1 por cuadro (se suavizan con setTargetAtTime). */
  setLevels(l: { rumble: number; wind: number; jets: number; plasma: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.rumbleGain?.gain.setTargetAtTime(0.6 * l.rumble, now, 0.15);
    this.windGain?.gain.setTargetAtTime(0.35 * Math.max(l.wind, l.plasma * 0.8), now, 0.2);
    this.windFilter?.frequency.setTargetAtTime(300 + 1400 * l.plasma + 500 * l.wind, now, 0.2);
    this.atmoGain?.gain.setTargetAtTime(0.6 * l.plasma, now, 0.25);
    this.jetsGain?.gain.setTargetAtTime(0.55 * l.jets, now, 0.12);
  }

  /** Golpe del contacto con el suelo. */
  thud(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(80, now);
    o.frequency.exponentialRampToValueAtTime(32, now + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(1.1, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 1);
  }

  private quindar(start: boolean): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.master) return Promise.resolve();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = start ? 2525 : 2475;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.045, now + 0.015);
    g.gain.setValueAtTime(0.045, now + 0.23);
    g.gain.linearRampToValueAtTime(0, now + 0.25);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.26);
    return new Promise((r) => window.setTimeout(r, 270));
  }

  /** Bip + frase (grabada o sintetizada) + bip. No bloquea la animación. */
  async say(id: string, text: string, who: "crew" | "capcom"): Promise<void> {
    if (this.disposed) return;
    if (this.muted) return;
    await this.quindar(true);
    const buf = this.vo.get(id);
    if (buf && this.ctx && this.radio) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(this.radio);
      await new Promise<void>((resolve) => {
        s.onended = () => resolve();
        s.start();
      });
    } else {
      // Sin grabación: transmisión de radio suave (la frase se lee en el subtítulo)
      await this.radioStatic(who === "capcom" ? 0.45 : 0.6, text.length);
    }
    if (!this.disposed) await this.quindar(false);
  }

  /** Estática de radio breve y suave (sin voz). */
  private radioStatic(seconds: number, textLen: number): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.master) return Promise.resolve();
    const dur = Math.min(0.9, seconds + textLen * 0.004);
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 1);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1600;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.03, now + 0.05);
    g.gain.setValueAtTime(0.03, now + dur - 0.08);
    g.gain.linearRampToValueAtTime(0, now + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.05);
    return new Promise((r) => window.setTimeout(r, dur * 1000));
  }

  setMuted(m: boolean): void {
    this.muted = m;
    const ctx = this.ctx;
    if (ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : MASTER, ctx.currentTime, 0.05);
    if (m && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  /** Baja todo en ~1 s (final de la secuencia). */
  fadeOut(): void {
    const ctx = this.ctx;
    if (ctx && this.master) this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    for (const b of this.beds) {
      try {
        b.src.stop();
      } catch {
        /* ya detenido */
      }
    }
    this.beds = [];
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
