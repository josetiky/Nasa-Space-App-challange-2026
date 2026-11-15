/**
 * Mars Trek · Intensidades por arista y función de costo multicapa (ROUTING_ALGORITHM §3.2–§3.4).
 *
 * Fórmula de costo por arista en metros equivalentes:
 * c(e) = ℓ(e) · κ(e) · [ w_d + w_t·t(e) + w_r·r(e) + w_e·ε(e) + w_u·u(e) + w_h·h(e) ]
 */
import type { CostTermId, LocomotionModel, WeightVector, ZoneClass } from "../contracts";
import { TREK_PARAMS } from "../params";
import { pandolfMars } from "../resources/locomotion";
import { consumptionRates } from "../resources/consumables";
import { zoneMultiplier } from "./weights";

export interface EdgeCostInput {
  /** Longitud 3D de la arista en metros (ℓ > 0). */
  readonly length3dM: number;
  /** Pendiente con signo en grados (+ subida, - bajada). */
  readonly slopeDeg: number;
  /** Pendiente de referencia del perfil (por defecto 15°). */
  readonly cautionSlopeDeg?: number;
  /** Rugosidad normalizada [0, 1]. */
  readonly roughness?: number;
  /** Probabilidad de suelo blando [0, 1]. */
  readonly softSoilProb?: number;
  /** Opacidad atmosférica de polvo τ. */
  readonly dustTau?: number;
  /** Tasa de dosis ambiental (mSv/sol). */
  readonly doseRateMsvPerSol?: number;
  /** Elevación solar (deg). */
  readonly sunElevationDeg?: number;
  /** Puntuación de confianza científica C en [0, 1]. */
  readonly confidenceScore: number;
  /** Clase de zona en la celda destino. */
  readonly zone: ZoneClass;
  /** Factor de velocidad de la directiva de salud (<= 1). */
  readonly speedFactor?: number;
  /** Factor φ de exigencia fisiológica de la directiva de salud (>= 1). */
  readonly strainFactor?: number;
  /** Carga útil transportada (kg). */
  readonly payloadKg?: number;
  /** Modelo de locomoción activo (por defecto pandolf-mars). */
  readonly locomotion?: LocomotionModel;
  /** Si es misión sin tripulación, h(e) = 0. */
  readonly uncrewed?: boolean;
}

export interface EdgeIntensities {
  readonly t: number;
  readonly r: number;
  readonly e: number;
  readonly u: number;
  readonly h: number;
  readonly kappa: number;
  readonly speedMs: number;
  readonly metabolicW: number;
}

export interface EdgeCostBreakdown {
  readonly totalCostM: number;
  readonly contributions: Record<CostTermId, number>;
  readonly intensities: EdgeIntensities;
}

const DEFAULT_LOCOMOTION = pandolfMars();
const FLAT_REF_WATTS = TREK_PARAMS.flatMetabolicRefKjH.value / 3.6;
const FLAT_REF_SPEED_MS = TREK_PARAMS.flatSpeedPandolfKmh.value / 3.6;
const FLAT_REF_O2_PER_M = consumptionRates(FLAT_REF_WATTS).o2PsiPerMin / (FLAT_REF_SPEED_MS * 60);
const SUSTAINABLE_W = TREK_PARAMS.sustainableMetabolicW.value;

/** Calcula las intensidades adimensionales no negativas (t, r, ε, u, h) de una arista (INV-R2). */
export function computeEdgeIntensities(input: EdgeCostInput): EdgeIntensities {
  const model = input.locomotion ?? DEFAULT_LOCOMOTION;
  const cautionDeg = Math.max(1, input.cautionSlopeDeg ?? TREK_PARAMS.cautionSlopeFootDeg.value);
  const absSlope = Math.abs(input.slopeDeg);
  const rough = Math.max(0, Math.min(1, Number.isFinite(input.roughness) ? input.roughness! : 0));
  const soft = Math.max(
    0,
    Math.min(1, Number.isFinite(input.softSoilProb) ? input.softSoilProb! : 0),
  );

  // Topografía t(e) = (θ/θ_ref)² + k_rug·ρ(e) + k_blando·σ(e)
  const t =
    (absSlope / cautionDeg) ** 2 +
    TREK_PARAMS.roughnessCostCoeff.value * rough +
    TREK_PARAMS.softSoilCostCoeff.value * soft;

  const speedMs = Math.max(
    0.05,
    model.speedMs({
      slopeDeg: input.slopeDeg,
      roughness: rough,
      softSoilProb: soft,
      payloadKg: input.payloadKg ?? TREK_PARAMS.refEquipmentKg.value,
      speedFactor: input.speedFactor ?? 1,
    }),
  );

  const metabolicW = model.metabolicW({
    slopeDeg: input.slopeDeg,
    roughness: rough,
    softSoilProb: soft,
    payloadKg: input.payloadKg ?? TREK_PARAMS.refEquipmentKg.value,
    speedFactor: input.speedFactor ?? 1,
  });

  // Riesgo ambiental r(e) = [k_polvo·f_τ + k_rad·f_D + k_luz·f_L] · (v_ref / v(e))
  const tau = Math.max(0, Number.isFinite(input.dustTau) ? input.dustTau! : 0.5);
  const fTau = Math.max(0, (tau - 0.3) / 1.5);
  const dose = Math.max(
    0,
    Number.isFinite(input.doseRateMsvPerSol) ? input.doseRateMsvPerSol! : 0.64,
  );
  const fRad = dose / 0.64;
  const sunDeg = input.sunElevationDeg ?? 35;
  const fLight = sunDeg < 10 ? Math.max(0, (10 - sunDeg) / 10) : 0;
  const vRefMs = model.id === "tobler-linear" ? 3.0 / 3.6 : FLAT_REF_SPEED_MS;
  const r =
    (TREK_PARAMS.dustRiskCoeff.value * fTau +
      TREK_PARAMS.radiationRiskCoeff.value * fRad +
      0.5 * fLight) *
    (vRefMs / speedMs);

  // Recursos ε(e) = max(0, q'(e) / q'_ref - 1) o cociente positivo acotado >= 0
  const rates = consumptionRates(metabolicW, model);
  const qPerM = rates.o2PsiPerMin / (speedMs * 60);
  const e = Math.max(0, qPerM / Math.max(1e-9, FLAT_REF_O2_PER_M) - 0.5);

  // Incertidumbre u(e) = 1 - C(e)
  const cScore = Math.max(
    0,
    Math.min(1, Number.isFinite(input.confidenceScore) ? input.confidenceScore : 0),
  );
  const u = 1 - cScore;

  // Exigencia fisiológica h(e) = φ(estado) · max(0, M(e)/M_sost - 1)
  const phi = Math.max(1, input.strainFactor ?? 1);
  const h = input.uncrewed ? 0 : phi * Math.max(0, metabolicW / SUSTAINABLE_W - 1);

  const kappa = Math.max(1, zoneMultiplier(input.zone));

  return {
    t: Math.max(0, t),
    r: Math.max(0, r),
    e: Math.max(0, e),
    u: Math.max(0, u),
    h: Math.max(0, h),
    kappa,
    speedMs,
    metabolicW,
  };
}

/**
 * Calcula el costo equivalente en metros de una arista y el desglose exacto por término (D, T, R, E, U, H).
 * La suma de contributions.{D,T,R,E,U,H} es exactamente igual a totalCostM.
 */
export function edgeCost(input: EdgeCostInput, weights: WeightVector): EdgeCostBreakdown {
  const len = Math.max(0, input.length3dM);
  const inten = computeEdgeIntensities(input);
  const baseFactor = len * inten.kappa;

  const D = baseFactor * weights.d;
  const T = baseFactor * weights.t * inten.t;
  const R = baseFactor * weights.r * inten.r;
  const E = baseFactor * weights.e * inten.e;
  const U = baseFactor * weights.u * inten.u;
  const H = baseFactor * weights.h * inten.h;
  const totalCostM = D + T + R + E + U + H;

  return {
    totalCostM,
    contributions: { D, T, R, E, U, H },
    intensities: inten,
  };
}
