/**
 * Mars Trek · Entorno de Marte para la simulación, atado a fuentes reales cuando existen.
 *
 * Cada valor declara su procedencia:
 *  - REAL     medido por un instrumento (REMS de Curiosity en Gale; DONKI de NASA para partículas solares)
 *  - DERIVED  calculado a partir de un dato real (reloj UTC real → hora solar en Gale con Mars24;
 *             presión REMS → dosis GCR con el modelo anclado a MSL/RAD)
 *  - MODELLED climatología o modelo (τ estacional cuando no hay medición numérica de polvo)
 *
 * Importante: no existe un flujo público "en vivo" de sensores de superficie de Marte. El último sol de
 * REMS publicado llega con días o meses de retraso, y DONKI mide partículas solares cerca de la Tierra.
 * Por eso cada valor lleva la fecha de su medición y su antigüedad.
 */
import { gcrDosePerSol, backgroundTau } from "@/core/science/environment";
import { solarDeclinationDeg } from "@/core/science/insolation";
import { localTrueSolarTime, marsTimeFromDate } from "@/core/science/marsTime";

export type EnvSource = "REAL" | "DERIVED" | "MODELLED";

export interface EnvValue<T> {
  readonly value: T;
  readonly source: EnvSource;
  readonly note: string;
}

/** Un sol del feed REMS (mismo formato que services/nasa/transform.ts → RemsSol). */
export interface RemsSolLike {
  readonly sol: number;
  readonly date: string | null;
  readonly minT: number | null;
  readonly maxT: number | null;
  readonly pressurePa: number | null;
  readonly opacity: string | null;
  readonly uv: string | null;
  readonly sunrise: string | null;
  readonly sunset: string | null;
}

export type MarsEnvExample = "now" | "sunset" | "dusty" | "sep";

export interface MarsEnvSnapshot {
  readonly example: MarsEnvExample;
  /** Instante UTC real que corresponde a T+0 de la misión. */
  readonly epochIso: string;
  readonly site: { readonly lat: number; readonly lonEast: number; readonly elevationM: number };
  readonly ls: EnvValue<number>;
  readonly marsYear: number;
  readonly msd: number;
  /** Hora solar verdadera local (h) en T+0. */
  readonly ltstAtStart: EnvValue<number>;
  readonly pressurePa: EnvValue<number>;
  readonly airMinC: EnvValue<number> | null;
  readonly airMaxC: EnvValue<number> | null;
  readonly tau: EnvValue<number>;
  /** Dosis ambiental GCR (mSv/sol) sin eventos solares. */
  readonly doseRateMsvPerSol: EnvValue<number>;
  readonly sep: EnvValue<boolean> & { readonly lastEventIso: string | null };
  readonly rems: {
    readonly sol: number;
    readonly date: string | null;
    readonly ageDays: number | null;
    readonly opacity: string | null;
    readonly uv: string | null;
  } | null;
}

export interface BuildMarsEnvInput {
  readonly now: Date;
  readonly site: { readonly lat: number; readonly lon: number; readonly elevationM: number };
  readonly rems: RemsSolLike | null;
  /** Episodios SEP de DONKI (ISO). null si DONKI no respondió. */
  readonly sepEventsIso: readonly string[] | null;
  readonly example?: MarsEnvExample;
  /** Episodios SEP históricos reales para el ejemplo "sep" cuando no hay eventos recientes. */
  readonly historicSepIso?: readonly string[];
  /** Etiqueta de la fuente histórica (p. ej. "DONKI 2024, respaldo incluido"). */
  readonly historicSepLabel?: string;
}

const DEG = Math.PI / 180;
/** Ventana en la que un episodio SEP de DONKI se considera activo [diseño]. */
export const SEP_ACTIVE_WINDOW_H = 48;

/** Elevación del Sol (°) para una latitud, Ls y hora solar verdadera local. */
export function sunElevationDeg(latDeg: number, ls: number, ltstHours: number): number {
  const phi = latDeg * DEG;
  const delta = solarDeclinationDeg(ls) * DEG;
  const h = (ltstHours - 12) * 15 * DEG;
  return (
    Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(h)) / DEG
  );
}

/** Hora solar verdadera (h) de la puesta de Sol para una latitud y Ls. */
export function sunsetLtstHours(latDeg: number, ls: number): number {
  const cosH = -Math.tan(latDeg * DEG) * Math.tan(solarDeclinationDeg(ls) * DEG);
  const h0 = Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG;
  return 12 + h0 / 15;
}

function formatHm(hours: number): string {
  const m = Math.round(hours * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Construye el entorno de la misión a partir del reloj real y de las fuentes disponibles.
 * Los "ejemplos" mueven solo lo que su nombre dice (hora local, estación o SEP) y lo marcan.
 */
export function buildMarsEnv(input: BuildMarsEnvInput): MarsEnvSnapshot {
  const example = input.example ?? "now";
  const mt = marsTimeFromDate(input.now);
  const lonEast = ((input.site.lon % 360) + 360) % 360;
  const realLtst = localTrueSolarTime(mt.mtcHours, lonEast, mt.eotDeg);

  // Puesta de Sol geométrica (hora solar verdadera) para la latitud y la Ls del día. REMS reporta
  // amanecer/ocaso en hora media (LMST), que difiere de la verdadera por la ecuación del tiempo.
  const lsForSunset = example === "dusty" ? 255 : mt.ls;
  const sunsetLtst = sunsetLtstHours(input.site.lat, lsForSunset);
  const ltstAtStart: EnvValue<number> =
    example === "sunset"
      ? {
          value: sunsetLtst - 0.9,
          source: "DERIVED",
          note: `Ejemplo: T+0 ≈ 55 min antes de la puesta de Sol de hoy en Gale (${formatHm(sunsetLtst)} hora solar)`,
        }
      : {
          value: realLtst,
          source: "DERIVED",
          note: "Hora solar verdadera en Gale ahora mismo (Mars24 con el reloj UTC real)",
        };

  const ls: EnvValue<number> =
    example === "dusty"
      ? {
          value: 255,
          source: "MODELLED",
          note: "Ejemplo: temporada de polvo (Ls 255, cerca del perihelio)",
        }
      : { value: mt.ls, source: "DERIVED", note: "Longitud solar Ls de hoy (Mars24)" };

  const r = input.rems;
  const ageDays = r?.date
    ? Math.max(0, Math.round((input.now.getTime() - Date.parse(`${r.date}T12:00:00Z`)) / 864e5))
    : null;
  const pressurePa: EnvValue<number> =
    r?.pressurePa !== null && r?.pressurePa !== undefined
      ? {
          value: r.pressurePa,
          source: "REAL",
          note: `REMS · Curiosity · sol ${r.sol} (${r.date ?? "?"}, hace ${ageDays ?? "?"} d)`,
        }
      : { value: 750, source: "MODELLED", note: "Sin dato REMS: presión típica de Gale" };

  const airMinC: EnvValue<number> | null =
    r?.minT !== null && r?.minT !== undefined
      ? { value: r.minT, source: "REAL", note: `REMS sol ${r.sol}` }
      : null;
  const airMaxC: EnvValue<number> | null =
    r?.maxT !== null && r?.maxT !== undefined
      ? { value: r.maxT, source: "REAL", note: `REMS sol ${r.sol}` }
      : null;

  const tauValue = backgroundTau(ls.value);
  const opacity = r?.opacity ?? null;
  const dustyOpacity = opacity !== null && /dust|cloud/i.test(opacity);
  const tau: EnvValue<number> = {
    value: dustyOpacity ? Math.max(tauValue, 1.0) : tauValue,
    source: "MODELLED",
    note:
      example === "dusty"
        ? "Climatología estacional en temporada de polvo"
        : `Climatología estacional (REMS no publica τ numérico; opacidad: ${opacity ?? "—"})`,
  };

  const dose = gcrDosePerSol(pressurePa.value);
  const doseRateMsvPerSol: EnvValue<number> = {
    value: dose,
    source: pressurePa.source === "REAL" ? "DERIVED" : "MODELLED",
    note: "Dosis GCR con la presión (columna de CO₂), anclada a MSL/RAD en Gale (0.64 mSv/día)",
  };

  const toTimes = (list: readonly string[]) =>
    list
      .map((e) => Date.parse(e))
      .filter(Number.isFinite)
      .sort((a, b) => b - a);
  const times = toTimes(input.sepEventsIso ?? []);
  const lastRecent = times[0] ?? null;
  const recent =
    lastRecent !== null && input.now.getTime() - lastRecent <= SEP_ACTIVE_WINDOW_H * 3600e3;
  const historic = toTimes(input.historicSepIso ?? []);
  const useHistoric = example === "sep" && lastRecent === null && historic.length > 0;
  const last = useHistoric ? historic[0]! : lastRecent;
  const lastLabel = useHistoric ? (input.historicSepLabel ?? "DONKI histórico") : "DONKI";
  const sep =
    example === "sep"
      ? {
          value: true,
          source: (last !== null ? "REAL" : "MODELLED") as EnvSource,
          note:
            last !== null
              ? `Ejemplo: se reproduce el último episodio SEP real (${lastLabel}, ${new Date(last).toISOString().slice(0, 10)}, medido cerca de la Tierra)`
              : "Ejemplo: evento solar (sin episodios DONKI disponibles)",
          lastEventIso: last !== null ? new Date(last).toISOString() : null,
        }
      : {
          value: recent,
          source: (input.sepEventsIso === null ? "MODELLED" : "REAL") as EnvSource,
          note:
            input.sepEventsIso === null
              ? "DONKI no respondió: sin alerta"
              : recent
                ? `DONKI: episodio SEP en las últimas ${SEP_ACTIVE_WINDOW_H} h`
                : `DONKI: sin episodios SEP en las últimas ${SEP_ACTIVE_WINDOW_H} h`,
          lastEventIso: last !== null ? new Date(last).toISOString() : null,
        };

  return {
    example,
    epochIso: input.now.toISOString(),
    site: { lat: input.site.lat, lonEast, elevationM: input.site.elevationM },
    ls,
    marsYear: mt.marsYear,
    msd: mt.msd,
    ltstAtStart,
    pressurePa,
    airMinC,
    airMaxC,
    tau,
    doseRateMsvPerSol,
    sep,
    rems: r ? { sol: r.sol, date: r.date, ageDays, opacity: r.opacity, uv: r.uv } : null,
  };
}

const SOL_S = 88_775.244;

/** Entorno en el instante T+elapsedS de la misión (la hora local avanza con el reloj de simulación). */
export function envAtMissionTime(
  env: MarsEnvSnapshot,
  elapsedS: number,
): { readonly ltst: number; readonly sunElevationDeg: number; readonly airTempC: number | null } {
  const ltst = (((env.ltstAtStart.value + (24 * elapsedS) / SOL_S) % 24) + 24) % 24;
  const elev = sunElevationDeg(env.site.lat, env.ls.value, ltst);
  let airTempC: number | null = null;
  if (env.airMinC && env.airMaxC) {
    // Ciclo diario [diseño]: mínimo a las 06 h, máximo a las 14 h (interpolación coseno)
    const min = env.airMinC.value;
    const max = env.airMaxC.value;
    const rising = ltst >= 6 && ltst < 14;
    const f = rising ? (ltst - 6) / 8 : ((ltst - 14 + 24) % 24) / 16;
    const w = rising ? (1 - Math.cos(Math.PI * f)) / 2 : (1 + Math.cos(Math.PI * f)) / 2;
    airTempC = min + (max - min) * w;
  }
  return { ltst, sunElevationDeg: elev, airTempC };
}

/**
 * PRE-07 (reglas.json): la presión local limita el enfriamiento por sublimación del traje.
 * ≤ 7 Torr sin efecto; entre 7 y 8 Torr baja linealmente a 0.7; > 8 Torr 0.5 [diseño].
 */
export function ambientCoolingFactor(pressurePa: number): number {
  const torr = pressurePa / 133.322;
  if (torr <= 7) return 1;
  if (torr <= 8) return 1 - 0.3 * (torr - 7);
  return 0.5;
}
