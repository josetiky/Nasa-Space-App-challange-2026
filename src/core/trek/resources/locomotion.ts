/**
 * Mars Trek · Modelos de locomoción en EVA (RESOURCE_MANAGEMENT §1 y §3).
 * Implementa tobler-linear (compatible con src/core/science/eva.ts) y pandolf-mars (HUELLA).
 */
import { EVA } from "@/core/science/constants";
import { metabolicRateW, walkingSpeedKmh } from "@/core/science/eva";
import type { EdgeContext, LocomotionModel } from "../contracts";
import { TREK_PARAMS } from "../params";

const G_MARS = TREK_PARAMS.marsGravityRatio.value;
const REF_W = TREK_PARAMS.refBodyMassKg.value;
const REF_SUIT = TREK_PARAMS.refSuitMassKg.value;
const REF_EQUIP = TREK_PARAMS.refEquipmentKg.value;
const FLAT_SPEED_KMH = TREK_PARAMS.flatSpeedPandolfKmh.value;
const MIN_SPEED_KMH = TREK_PARAMS.minSpeedPandolfKmh.value;
const FLAT_MET_KJH = TREK_PARAMS.flatMetabolicRefKjH.value;

/**
 * Ecuación de Pandolf et al. (1977) en vatios con los términos de peso escalados a 0.38 g.
 * Las bajadas se tratan como llano (G = max(gradePct, 0)), igual que en HUELLA.
 */
function rawPandolfWatts(W: number, L: number, vMs: number, gradePct: number, eta = 1.2): number {
  const G = Math.max(0, gradePct);
  return (
    1.5 * W +
    2.0 * (W + L) * (L / W) ** 2 * G_MARS +
    eta * (W + L) * (1.5 * vMs ** 2 + 0.35 * vMs * G) * G_MARS
  );
}

const K_CAL_DEFAULT =
  FLAT_MET_KJH / (rawPandolfWatts(REF_W, REF_SUIT + REF_EQUIP, FLAT_SPEED_KMH / 3.6, 0, 1.2) * 3.6);

/** Convierte EdgeContext a pendiente porcentual coherente con HUELLA. */
function resolveGradePct(ctx: EdgeContext): number {
  if (ctx.gradePct !== undefined && Number.isFinite(ctx.gradePct)) {
    return ctx.gradePct;
  }
  const rad = (ctx.slopeDeg * Math.PI) / 180;
  return Math.tan(rad) * 100;
}

export interface PandolfMarsOptions {
  readonly bodyMassKg?: number;
  readonly suitMassKg?: number;
  readonly basePayloadKg?: number;
  readonly flatSpeedKmh?: number;
  readonly minSpeedKmh?: number;
}

export function pandolfMars(options: PandolfMarsOptions = {}): LocomotionModel {
  const defaultW = options.bodyMassKg ?? REF_W;
  const defaultSuit = options.suitMassKg ?? REF_SUIT;
  const defaultPayload = options.basePayloadKg ?? REF_EQUIP;
  const flatKmh = options.flatSpeedKmh ?? FLAT_SPEED_KMH;
  const minKmh = options.minSpeedKmh ?? MIN_SPEED_KMH;

  return {
    id: "pandolf-mars",
    provenance: {
      dataType: "MODELLED",
      source:
        "Pandolf et al. (1977) escalado a 0.38 g · calibrado con NASA TN D-7883 (~1000 kJ/h en llano)",
      notes:
        "Las bajadas gastan como el llano; responde a masa corporal, traje (104 kg) y carga transportada.",
    },
    speedMs(ctx: EdgeContext): number {
      const p = ctx.gradePct !== undefined ? ctx.gradePct : ctx.slopeDeg;
      const fSlope = p >= 0 ? 1 - p / 40 : 1 - Math.abs(p) / 60;
      const baseKmh = Math.max(minKmh, flatKmh * fSlope);
      const roughPenalty = 1 - 0.15 * Math.max(0, Math.min(1, ctx.roughness ?? 0));
      const softPenalty = 1 - 0.2 * Math.max(0, Math.min(1, ctx.softSoilProb ?? 0));
      const stateFactor = Math.max(0.1, Math.min(1, ctx.speedFactor ?? 1));
      const speedKmh = Math.max(
        minKmh * stateFactor,
        baseKmh * roughPenalty * softPenalty * stateFactor,
      );
      return speedKmh / 3.6;
    },
    metabolicW(ctx: EdgeContext): number {
      const W = ctx.bodyMassKg ?? defaultW;
      const suit = ctx.suitMassKg ?? defaultSuit;
      const payload = ctx.payloadKg ?? defaultPayload;
      const L = suit + payload;
      const grade = resolveGradePct(ctx);
      // Para la evaluación nominal sin penalización de estado en velocidad base:
      const vNominalMs =
        ctx.gradePct !== undefined
          ? Math.max(
              minKmh,
              flatKmh *
                (ctx.gradePct >= 0 ? 1 - ctx.gradePct / 40 : 1 - Math.abs(ctx.gradePct) / 60),
            ) / 3.6
          : Math.max(
              minKmh,
              flatKmh *
                (ctx.slopeDeg >= 0 ? 1 - ctx.slopeDeg / 40 : 1 - Math.abs(ctx.slopeDeg) / 60),
            ) / 3.6;
      const vMs = vNominalMs * Math.max(0.1, Math.min(1, ctx.speedFactor ?? 1));
      const eta =
        1.2 +
        0.3 * Math.max(0, Math.min(1, ctx.softSoilProb ?? 0)) +
        0.15 * Math.max(0, Math.min(1, ctx.roughness ?? 0));
      return rawPandolfWatts(W, L, vMs, grade, eta) * K_CAL_DEFAULT;
    },
  };
}

export const toblerLinear: LocomotionModel = {
  id: "tobler-linear",
  provenance: {
    dataType: "MODELLED",
    source: "Tobler hiking function normalizada + tasa metabólica lineal (src/core/science/eva.ts)",
    notes: `Velocidad base ${EVA.baseSpeedKmh} km/h; gasto base ${EVA.metabolicBaseW} W + ${EVA.metabolicPerSlopeDegW} W/deg.`,
  },
  speedMs(ctx: EdgeContext): number {
    const uphill = ctx.slopeDeg >= 0;
    const kmh = walkingSpeedKmh(Math.abs(ctx.slopeDeg), uphill);
    const stateFactor = Math.max(0.1, Math.min(1, ctx.speedFactor ?? 1));
    return (kmh * stateFactor) / 3.6;
  },
  metabolicW(ctx: EdgeContext): number {
    return metabolicRateW(Math.abs(ctx.slopeDeg));
  },
};
