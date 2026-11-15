/**
 * Mars Trek · Eventos automáticos basados en precedentes reales.
 *
 * Mientras corre la caminata, cada tick evalúa un catálogo de incidentes que SÍ ocurrieron en
 * EVAs reales (ISS, Apollo, Gemini, Voskhod) o en la superficie de Marte (tormentas de polvo, SEP,
 * pérdida de energía por polvo). Cada incidente tiene una tasa (eventos por hora de misión) que
 * sube o baja según las condiciones actuales: estación de polvo (Ls), opacidad τ, SEP de DONKI,
 * tiempo de EVA y pendiente de la ruta.
 *
 * Determinista: la tirada usa una semilla derivada de (seed, id, segundo de misión), así que la
 * misma caminata a la misma velocidad produce los mismos eventos.
 *
 * Lo que se dispara es SIMULATED (la falla en el traje no es real); el precedente y, cuando aplica,
 * el dato de entorno (DONKI/REMS) sí son reales. Cada disparo lleva su referencia.
 */
import type { LocalPoint, SimEvent } from "../contracts";
import type { LivePatch } from "./session";

export type HistoricalIntensity = "realistic" | "demo";

export interface HistoricalContext {
  readonly clockS: number;
  readonly dtS: number;
  readonly seed: number;
  readonly solo: boolean;
  readonly evaElapsedMin: number;
  readonly routePoints: readonly LocalPoint[];
  readonly maxSlopeDeg: number;
  /** Longitud solar (°) del entorno de Marte, si se conoce. */
  readonly ls: number | null;
  /** Opacidad atmosférica τ. */
  readonly tau: number | null;
  /** Temperatura mínima del aire (°C) del último sol de REMS. */
  readonly airMinC: number | null;
  /** DONKI reporta un evento SEP reciente (dato real). */
  readonly sepRealActive: boolean;
  readonly sepAlreadyOn: boolean;
  readonly stormActive: boolean;
}

export interface HistoricalIncident {
  readonly id: string;
  readonly titleEs: string;
  readonly titleEn: string;
  /** Precedente real documentado. */
  readonly refEs: string;
  readonly refEn: string;
  /** Qué parte del disparo viene de un dato real en vivo (si aplica). */
  readonly liveDataEs?: string;
  readonly liveDataEn?: string;
  readonly soloOnly?: boolean;
  /** Eventos por hora de misión en las condiciones actuales (0 = no puede ocurrir). */
  hazardPerHour(ctx: HistoricalContext): number;
  events(ctx: HistoricalContext): readonly SimEvent[];
  livePatch?(ctx: HistoricalContext): LivePatch;
}

export interface HistoricalFiring {
  readonly id: string;
  readonly atS: number;
  readonly incident: HistoricalIncident;
  /** El disparo vino forzado por un dato real (p. ej. SEP de DONKI). */
  readonly realTrigger: boolean;
}

const inDustSeason = (ls: number | null) => ls !== null && ls >= 180 && ls <= 330;

function routeMidpoint(points: readonly LocalPoint[]): LocalPoint {
  if (points.length === 0) return { x: 0, z: 0 };
  return points[Math.floor(points.length / 2)]!;
}

export const HISTORICAL_INCIDENTS: readonly HistoricalIncident[] = [
  {
    id: "mars-dust-storm",
    titleEs: "Tormenta de polvo local sobre la ruta",
    titleEn: "Local dust storm over the route",
    refEs:
      "Marte, tormenta global de 2018 (MY34, Ls≈185°): τ > 8 en Gale (REMS/Curiosity) y fin de la misión Opportunity. Las tormentas locales se concentran en Ls 180°–330°.",
    refEn:
      "Mars, 2018 global dust storm (MY34, Ls≈185°): τ > 8 at Gale (REMS/Curiosity) and the end of Opportunity. Local storms cluster in Ls 180°–330°.",
    liveDataEs: "Estación (Ls) y opacidad τ del entorno real de Gale",
    liveDataEn: "Season (Ls) and opacity τ from the real Gale environment",
    hazardPerHour: (c) => {
      if (c.stormActive) return 0;
      let h = 0.08;
      if (inDustSeason(c.ls)) h += 0.6;
      if (c.tau !== null && c.tau > 1) h += 1.2 * Math.min(3, c.tau);
      return h;
    },
    events: (c) => {
      const mid = routeMidpoint(c.routePoints);
      return [
        {
          kind: "storm-appear",
          storm: {
            id: `storm-hist-${Math.round(c.clockS)}`,
            name: "Dust front (2018 MY34 analog)",
            center: { x: mid.x + 3, z: mid.z - 2 },
            radiusM: 14,
            tau: Math.max(2.2, c.tau ?? 0),
            active: true,
            dataType: "SIMULATED",
          },
          simulated: true,
        },
      ];
    },
  },
  {
    id: "sep-donki",
    titleEs: "Evento de partículas solares (SEP)",
    titleEn: "Solar Energetic Particle (SEP) event",
    refEs:
      "Curiosity/RAD registró SEP en la superficie (p. ej. septiembre de 2017, dosis varias veces la de fondo). DONKI (NASA CCMC) cataloga los SEP en tiempo casi real.",
    refEn:
      "Curiosity/RAD recorded SEPs at the surface (e.g. September 2017, several times the background dose). DONKI (NASA CCMC) catalogues SEPs in near real time.",
    liveDataEs: "Si DONKI reporta un SEP reciente, se dispara de inmediato",
    liveDataEn: "If DONKI reports a recent SEP, it fires immediately",
    hazardPerHour: (c) => (c.sepAlreadyOn ? 0 : c.sepRealActive ? 1e6 : 0.04),
    events: () => [{ kind: "sep-alert", active: true, doseRateMultiplier: 4, simulated: true }],
  },
  {
    id: "dust-power-loss",
    titleEs: "Caída de energía por polvo y frío",
    titleEn: "Power drop from dust and cold",
    refEs:
      "Spirit y Opportunity perdieron energía por polvo en paneles y noches frías; en 2018 Opportunity quedó sin energía por la tormenta global.",
    refEn:
      "Spirit and Opportunity lost power to dust on panels and cold nights; in 2018 Opportunity ran out of power in the global storm.",
    liveDataEs: "Opacidad τ y temperatura mínima de REMS",
    liveDataEn: "Opacity τ and REMS minimum temperature",
    hazardPerHour: (c) => {
      let h = 0.03;
      if (c.tau !== null && c.tau > 1) h += 0.5;
      if (c.airMinC !== null && c.airMinC < -80) h += 0.3;
      if (c.stormActive) h += 0.6;
      return h;
    },
    events: () => [{ kind: "battery-drop", dropPct: 15, simulated: true }],
  },
  {
    id: "parmitano-2013",
    titleEs: "Agua en el casco / falla del ventilador-separador",
    titleEn: "Water in helmet / fan-separator failure",
    refEs:
      "ISS US EVA-23 (16 jul 2013, Luca Parmitano): entró agua del sistema de enfriamiento al casco y la EVA se abortó a los ~44 min.",
    refEn:
      "ISS US EVA-23 (16 Jul 2013, Luca Parmitano): cooling-loop water entered the helmet and the EVA was aborted after ~44 min.",
    hazardPerHour: (c) => 0.06 * (c.evaElapsedMin > 30 ? 2 : 1),
    events: () => [{ kind: "health-incident", incident: "falla_ventilador", simulated: true }],
    livePatch: () => ({ faults: { fanPct: 35, coolPct: 55 } }),
  },
  {
    id: "leonov-1965",
    titleEs: "Sobrecalentamiento del traje",
    titleEn: "Suit overheating",
    refEs:
      "Voskhod 2 (18 mar 1965, Alexéi Leonov): el traje se infló y se sobrecalentó; tuvo que bajar la presión para volver a entrar.",
    refEn:
      "Voskhod 2 (18 Mar 1965, Alexei Leonov): the suit ballooned and overheated; he had to bleed pressure to get back in.",
    hazardPerHour: (c) => 0.05 * (1 + c.evaElapsedMin / 60) * (c.maxSlopeDeg > 12 ? 1.6 : 1),
    events: () => [{ kind: "health-incident", incident: "estres_termico", simulated: true }],
    livePatch: () => ({ faults: { coolPct: 40 } }),
  },
  {
    id: "cernan-1966",
    titleEs: "Agotamiento por carga de trabajo",
    titleEn: "Workload exhaustion",
    refEs:
      "Gemini 9A (5 jun 1966, Gene Cernan): sobreesfuerzo, pulso ~180 lpm y visor empañado; la EVA se acortó.",
    refEn:
      "Gemini 9A (5 Jun 1966, Gene Cernan): overexertion, heart rate ~180 bpm and a fogged visor; the EVA was cut short.",
    hazardPerHour: (c) =>
      c.evaElapsedMin < 5 ? 0 : 0.12 * (c.evaElapsedMin / 30) * (c.maxSlopeDeg > 12 ? 2 : 1),
    events: () => [{ kind: "health-incident", incident: "fatiga_progresiva", simulated: true }],
    livePatch: () => ({ scare: true, faults: { coolPct: 70 } }),
  },
  {
    id: "irwin-1971",
    titleEs: "Arritmia cardiaca",
    titleEn: "Cardiac arrhythmia",
    refEs:
      "Apollo 15 (1971, James Irwin): arritmias (bigeminismo) durante las EVAs lunares, atribuidas a déficit de potasio y esfuerzo.",
    refEn:
      "Apollo 15 (1971, James Irwin): arrhythmias (bigeminy) during lunar EVAs, attributed to potassium deficit and exertion.",
    soloOnly: true,
    hazardPerHour: (c) => (c.evaElapsedMin < 10 ? 0 : 0.04 * (c.evaElapsedMin > 60 ? 3 : 1)),
    events: () => [],
    livePatch: () => ({ faults: { arrhythmiaPct: 20 } }),
  },
  {
    id: "relay-gap",
    titleEs: "Pérdida de enlace con el hábitat",
    titleEn: "Loss of link with the habitat",
    refEs:
      "Curiosity depende de pases de orbitadores (MRO, Odyssey) para enviar datos; fuera de esas ventanas el enlace es limitado.",
    refEn:
      "Curiosity relies on orbiter passes (MRO, Odyssey) to relay data; outside those windows the link is limited.",
    soloOnly: true,
    hazardPerHour: () => 0.05,
    events: () => [],
    livePatch: () => ({ faults: { commLoss: true } }),
  },
];

/** PRNG determinista (mulberry32). */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Factor de compresión: "demo" hace probables los eventos en caminatas cortas de demostración. */
export const INTENSITY_FACTOR: Record<HistoricalIntensity, number> = { realistic: 1, demo: 12 };

/**
 * Tira los dados de cada incidente para el intervalo [clockS − dtS, clockS].
 * Cada incidente se dispara a lo sumo una vez por caminata (alreadyFired).
 */
export function rollHistoricalIncidents(
  ctx: HistoricalContext,
  alreadyFired: ReadonlySet<string>,
  intensity: HistoricalIntensity,
): HistoricalFiring[] {
  const out: HistoricalFiring[] = [];
  for (const inc of HISTORICAL_INCIDENTS) {
    if (alreadyFired.has(inc.id)) continue;
    if (inc.soloOnly && !ctx.solo) continue;
    const realTrigger = inc.id === "sep-donki" && ctx.sepRealActive && !ctx.sepAlreadyOn;
    const hazard = inc.hazardPerHour(ctx) * (realTrigger ? 1 : INTENSITY_FACTOR[intensity]);
    if (hazard <= 0) continue;
    const p = 1 - Math.exp(-(hazard * ctx.dtS) / 3600);
    const rand = mulberry32(hashStr(`${ctx.seed}:${inc.id}:${Math.floor(ctx.clockS)}`))();
    if (rand < p) out.push({ id: inc.id, atS: ctx.clockS, incident: inc, realTrigger });
  }
  return out;
}
