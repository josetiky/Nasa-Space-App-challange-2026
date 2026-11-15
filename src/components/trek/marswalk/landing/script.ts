/**
 * M.I.Y.H. · Guion del aterrizaje (solo vista). Tiempos, fases, altitud/velocidad y llamadas de radio.
 *
 * Números de altitud y velocidad: aterrizaje de Curiosity en Gale (6 ago 2012) — interfaz de entrada
 * 125 km a 5.9 km/s; paracaídas ≈11 km a 450 m/s; escudo térmico fuera a 238 m/s; descenso con motores
 * desde 1.6–2 km a 120 m/s. Fuentes: Spaceflight101 (MSL EDL) y The Planetary Society.
 * La última parte es una nave tripulada (no la grúa celeste de Curiosity).
 * Las frases de radio imitan el estilo de las llamadas del Apolo 11.
 * Nada de este archivo participa en decisiones del motor.
 */
import type { TrekLang } from "../../i18n";

export const LANDING_TOTAL_S = 50;
export const ENTRY_START_S = 8;
export const GROUND_START_S = 20;
export const COCKPIT_START_S = 27;
export const TOUCHDOWN_S = 38.2;
export const FINAL_TEXT_S = 43.5;
export const FADE_OUT_S = 48.4;

type L10n = Readonly<Record<TrekLang, string>>;

interface Keyframe {
  readonly t: number;
  readonly altM: number;
  readonly velMs: number;
}

/** Altitud (m) y velocidad (m/s) por tiempo. La altitud se interpola en escala logarítmica. */
export const KEYFRAMES: readonly Keyframe[] = [
  { t: 0, altM: 400_000, velMs: 5600 },
  { t: ENTRY_START_S, altM: 125_000, velMs: 5900 },
  { t: GROUND_START_S, altM: 11_000, velMs: 450 },
  { t: 24, altM: 8_000, velMs: 238 },
  { t: 28, altM: 1_600, velMs: 120 },
  { t: 33, altM: 100, velMs: 3 },
  { t: 36, altM: 40, velMs: 1 },
  { t: TOUCHDOWN_S, altM: 0, velMs: 0 },
];

const lg = (a: number) => Math.log10(a + 1);

export function sampleFlight(t: number): { altM: number; velMs: number } {
  const k = KEYFRAMES;
  if (t <= k[0]!.t) return { altM: k[0]!.altM, velMs: k[0]!.velMs };
  for (let i = 1; i < k.length; i++) {
    const b = k[i]!;
    if (t <= b.t) {
      const a = k[i - 1]!;
      const f = (t - a.t) / (b.t - a.t);
      const alt = Math.pow(10, lg(a.altM) + (lg(b.altM) - lg(a.altM)) * f) - 1;
      return { altM: Math.max(0, alt), velMs: a.velMs + (b.velMs - a.velMs) * f };
    }
  }
  return { altM: 0, velMs: 0 };
}

export interface Phase {
  readonly start: number;
  readonly name: L10n;
  readonly note: L10n;
}

export const PHASES: readonly Phase[] = [
  {
    start: 0,
    name: { es: "Aproximación", en: "Approach" },
    note: { es: "Marte crece en la ventana. Destino: cráter Gale.", en: "Mars grows in the window. Target: Gale crater." },
  },
  {
    start: ENTRY_START_S,
    name: { es: "Entrada atmosférica", en: "Atmospheric entry" },
    note: { es: "El escudo térmico llega a unos 2,100 °C.", en: "The heat shield reaches about 2,100 °C." },
  },
  {
    start: GROUND_START_S,
    name: { es: "Paracaídas", en: "Parachute" },
    note: { es: "Se abre aún más rápido que el sonido.", en: "It opens while still faster than sound." },
  },
  {
    start: 28,
    name: { es: "Descenso con motores", en: "Powered descent" },
    note: { es: "Los motores frenan los últimos metros.", en: "Engines brake the last metres." },
  },
  {
    start: TOUCHDOWN_S,
    name: { es: "Contacto", en: "Touchdown" },
    note: { es: "Estás en el cráter Gale.", en: "You are in Gale crater." },
  },
];

export function phaseIndexAt(t: number): number {
  let i = 0;
  for (let k = 0; k < PHASES.length; k++) if (t >= PHASES[k]!.start) i = k;
  return i;
}

export interface Callout {
  /** Nombre del archivo opcional de voz grabada: /miyh/landing/vo/<lang>/<id>.mp3 */
  readonly id: string;
  readonly t: number;
  readonly who: "crew" | "capcom";
  readonly text: L10n;
}

export const CALLOUTS: readonly Callout[] = [
  {
    id: "01-inicio",
    t: 0.8,
    who: "crew",
    text: {
      es: "Control, aquí M.I.Y.H. Iniciamos secuencia de entrada a Gale.",
      en: "Control, this is M.I.Y.H. Beginning entry sequence to Gale.",
    },
  },
  {
    id: "02-copiado",
    t: 5,
    who: "capcom",
    text: { es: "Copiado, M.I.Y.H. Todo nominal. Adelante.", en: "Copy, M.I.Y.H. All nominal. Go ahead." },
  },
  {
    id: "03-entrada",
    t: ENTRY_START_S + 0.6,
    who: "crew",
    text: { es: "Interfaz de entrada. Escudo térmico al frente.", en: "Entry interface. Heat shield forward." },
  },
  {
    id: "04-calor",
    t: 14,
    who: "crew",
    text: { es: "Pico de calentamiento. Seguimos estables.", en: "Peak heating. Still stable." },
  },
  {
    id: "05-paracaidas",
    t: GROUND_START_S + 0.6,
    who: "crew",
    text: { es: "Paracaídas desplegado.", en: "Parachute deployed." },
  },
  {
    id: "06-radar",
    t: 24,
    who: "crew",
    text: { es: "Escudo térmico fuera. Radar con el suelo.", en: "Heat shield away. Radar has the ground." },
  },
  {
    id: "07-motores",
    t: 28.3,
    who: "crew",
    text: { es: "Motores encendidos. Mil seiscientos metros.", en: "Engines lit. Sixteen hundred metres." },
  },
  {
    id: "08-cien",
    t: 32.4,
    who: "crew",
    text: { es: "Cien metros, bajando tres.", en: "One hundred metres, down three." },
  },
  {
    id: "09-polvo",
    t: 35.4,
    who: "crew",
    text: { es: "Cuarenta metros, levantando polvo.", en: "Forty metres, picking up some dust." },
  },
  {
    id: "10-contacto",
    t: TOUCHDOWN_S + 0.1,
    who: "crew",
    text: { es: "Luz de contacto.", en: "Contact light." },
  },
  {
    id: "11-apagado",
    t: 40.2,
    who: "crew",
    text: { es: "Motor apagado.", en: "Shutdown." },
  },
  {
    id: "12-gale",
    t: 41.8,
    who: "crew",
    text: { es: "Control, M.I.Y.H. está en Gale.", en: "Control, M.I.Y.H. is down in Gale." },
  },
];

export const UI_TEXT: Readonly<Record<TrekLang, Record<string, string>>> = {
  es: {
    skip: "Saltar",
    mute: "Silenciar",
    unmute: "Activar sonido",
    altitude: "Altitud",
    crew: "TRIPULACIÓN",
    capcom: "CONTROL",
    finalKicker: "CONTACTO CONFIRMADO · 4.59° S 137.44° E",
    final1: "Aquí empieza",
    final2: "tu misión",
    dialog: "Aterrizaje en el cráter Gale",
  },
  en: {
    skip: "Skip",
    mute: "Mute",
    unmute: "Sound on",
    altitude: "Altitude",
    crew: "CREW",
    capcom: "CONTROL",
    finalKicker: "TOUCHDOWN CONFIRMED · 4.59° S 137.44° E",
    final1: "Your mission",
    final2: "starts here",
    dialog: "Landing in Gale crater",
  },
};

export function formatAltitude(m: number): { value: string; unit: string } {
  if (m >= 10_000) return { value: Math.round(m / 1000).toLocaleString("es-MX"), unit: "km" };
  if (m >= 1000) return { value: (m / 1000).toFixed(1), unit: "km" };
  if (m >= 10) return { value: Math.round(m).toString(), unit: "m" };
  return { value: m.toFixed(1), unit: "m" };
}

export function formatVelocity(v: number, lang: TrekLang): string {
  const loc = lang === "es" ? "es-MX" : "en-US";
  const kmh = Math.round(v * 3.6).toLocaleString(loc);
  const ms = v >= 10 ? Math.round(v).toLocaleString(loc) : v.toFixed(1);
  return `${kmh} km/h · ${ms} m/s`;
}

/** Envolventes 0..1 para efectos y sonido. */
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
export function envelope(t: number) {
  const plasma = smooth(ENTRY_START_S, 12.5, t) * (1 - smooth(17.5, GROUND_START_S, t));
  const wind = smooth(GROUND_START_S - 0.5, 21, t) * (1 - smooth(27, 29, t)) * 0.8;
  const jets = smooth(28, 28.6, t) * (1 - smooth(TOUCHDOWN_S + 0.4, 40.2, t));
  const dust = smooth(34, TOUCHDOWN_S + 0.6, t) * (1 - smooth(41, 47, t));
  const rumble = Math.max(plasma, jets * 0.7, wind * 0.5);
  const shake =
    plasma * 0.9 +
    jets * 0.35 +
    (t > GROUND_START_S && t < GROUND_START_S + 1.2 ? 1 - (t - GROUND_START_S) / 1.2 : 0) +
    (t > TOUCHDOWN_S && t < TOUCHDOWN_S + 1.4 ? 1.4 * (1 - (t - TOUCHDOWN_S) / 1.4) : 0);
  return { plasma, wind, jets, dust, rumble, shake };
}
