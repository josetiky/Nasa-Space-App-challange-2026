/**
 * Mars Trek · Consumibles, tasas de agotamiento, consumible limitante y margen de regreso (RESOURCE_MANAGEMENT §2–§5).
 */
import type { LocomotionModel, ResourceState } from "../contracts";
import { TREK_PARAMS } from "../params";

const KJ_PER_L_O2 = TREK_PARAMS.kjPerLiterO2.value;
const RQ = TREK_PARAMS.respiratoryQuotient.value;
const PSI_PER_MIN_PER_L_O2 = TREK_PARAMS.psiPerMinPerLiterO2.value;
const PRI_TANK_PSI = TREK_PARAMS.primaryO2TankPsi.value;
const SEC_RESERVE_MIN = TREK_PARAMS.secondaryO2ReserveMin.value;
const BATTERY_WH = TREK_PARAMS.suitBatteryWh.value;
const BATTERY_DRAW_W = TREK_PARAMS.suitBatteryDrawW.value;
const CO2_CAPACITY_L = TREK_PARAMS.co2ScrubberCapacityL.value;
const COOLANT_LOSS_PCT_PER_KJ = TREK_PARAMS.coolantLossPctPerKj.value;
const CAUTION_MARGIN_PCT = TREK_PARAMS.returnMarginCautionPct.value;
const GALE_DOSE_MSV_PER_SOL = 0.64;
const SOL_SECONDS = 88_775.244;

export interface ConsumptionRates {
  readonly metabolicW: number;
  readonly metabolicKjPerH: number;
  readonly metabolicKjPerMin: number;
  readonly vo2LPerMin: number;
  readonly vco2LPerMin: number;
  readonly o2PsiPerMin: number;
  readonly o2KgPerMin: number;
  readonly co2PctPerMin: number;
  readonly coolantPctPerMin: number;
  readonly batteryWhPerMin: number;
}

/**
 * Calcula las tasas instantáneas de consumo a partir de la potencia metabólica (W).
 * O2: 2.13 psi/min por cada L/min de VO2; 1 L O2 ≈ 20.9 kJ (HUELLA).
 */
export function consumptionRates(metabolicW: number, _model?: LocomotionModel): ConsumptionRates {
  const watts = Math.max(80, metabolicW);
  const metabolicKjPerH = watts * 3.6;
  const metabolicKjPerMin = metabolicKjPerH / 60;
  const vo2LPerMin = metabolicKjPerMin / KJ_PER_L_O2;
  const vco2LPerMin = RQ * vo2LPerMin;
  const o2PsiPerMin = PSI_PER_MIN_PER_L_O2 * vo2LPerMin;
  // 1 L O2 STP ≈ 1.429 g = 0.001429 kg
  const o2KgPerMin = vo2LPerMin * 0.001429;
  const co2PctPerMin = (vco2LPerMin / CO2_CAPACITY_L) * 100;
  // En generar_caminata_sintetica.py: st["agua"] -= 0.003 * (met_kj_h / 1000) por segundo => * 60 por minuto
  const coolantPctPerMin = COOLANT_LOSS_PCT_PER_KJ * (metabolicKjPerH / 1000) * 60;
  const batteryWhPerMin = BATTERY_DRAW_W / 60;

  return {
    metabolicW: watts,
    metabolicKjPerH,
    metabolicKjPerMin,
    vo2LPerMin,
    vco2LPerMin,
    o2PsiPerMin,
    o2KgPerMin,
    co2PctPerMin,
    coolantPctPerMin,
    batteryWhPerMin,
  };
}

/** Calcula el consumible limitante (mínimo en minutos restantes entre O2, CO2, agua y batería). */
export function limitingConsumable(
  state: Pick<ResourceState, "o2PrimaryPsi" | "co2ScrubberPct" | "coolantStoragePct" | "batteryWh">,
  planningMetabolicW = TREK_PARAMS.flatMetabolicRefKjH.value / 3.6,
): {
  o2PrimaryMin: number;
  co2CapacityMin: number;
  coolantMin: number;
  batteryMin: number;
  limiting: { resource: "o2" | "co2" | "coolant" | "battery"; minutes: number };
} {
  const rates = consumptionRates(planningMetabolicW);
  const o2PrimaryMin = Math.max(0, state.o2PrimaryPsi / Math.max(1e-9, rates.o2PsiPerMin));
  const co2RemainingPct = Math.max(0, 100 - state.co2ScrubberPct);
  const co2CapacityMin = co2RemainingPct / Math.max(1e-9, rates.co2PctPerMin);
  const coolantMin = Math.max(0, state.coolantStoragePct) / Math.max(1e-9, rates.coolantPctPerMin);
  const batteryMin = Math.max(0, state.batteryWh) / Math.max(1e-9, rates.batteryWhPerMin);

  const candidates: Array<{ resource: "o2" | "co2" | "coolant" | "battery"; minutes: number }> = [
    { resource: "o2", minutes: o2PrimaryMin },
    { resource: "co2", minutes: co2CapacityMin },
    { resource: "coolant", minutes: coolantMin },
    { resource: "battery", minutes: batteryMin },
  ];
  candidates.sort((a, b) => a.minutes - b.minutes);
  return {
    o2PrimaryMin,
    co2CapacityMin,
    coolantMin,
    batteryMin,
    limiting: candidates[0]!,
  };
}

export function createInitialResourceState(
  subjectId = "EVA1",
  overrides: Partial<ResourceState> = {},
): ResourceState {
  const base = {
    o2PrimaryPsi: overrides.o2PrimaryPsi ?? PRI_TANK_PSI,
    co2ScrubberPct: overrides.co2ScrubberPct ?? 0,
    coolantStoragePct: overrides.coolantStoragePct ?? 100,
    batteryWh: overrides.batteryWh ?? BATTERY_WH,
  };
  const lim = limitingConsumable(base);
  return {
    subjectId,
    missionTimeS: overrides.missionTimeS ?? 0,
    o2PrimaryPsi: base.o2PrimaryPsi,
    o2PrimaryMin: overrides.o2PrimaryMin ?? lim.o2PrimaryMin,
    o2SecondaryPsi: overrides.o2SecondaryPsi ?? 6000,
    o2SecondaryMin: overrides.o2SecondaryMin ?? SEC_RESERVE_MIN,
    o2Source: overrides.o2Source ?? "PRI",
    co2ScrubberPct: base.co2ScrubberPct,
    co2CapacityMin: overrides.co2CapacityMin ?? lim.co2CapacityMin,
    coolantStoragePct: base.coolantStoragePct,
    coolantMin: overrides.coolantMin ?? lim.coolantMin,
    batteryWh: base.batteryWh,
    batteryMin: overrides.batteryMin ?? lim.batteryMin,
    evaElapsedMin: overrides.evaElapsedMin ?? 0,
    doseCareerMSv: overrides.doseCareerMSv ?? 12.0,
    doseEvaMSv: overrides.doseEvaMSv ?? 0,
    payloadKg: overrides.payloadKg ?? TREK_PARAMS.refEquipmentKg.value,
    limiting: overrides.limiting ?? lim.limiting,
    simulated: overrides.simulated ?? true,
  };
}

/** Avanza el estado de recursos durante dtS segundos a una potencia metabólica dada. */
export function stepResources(
  state: ResourceState,
  dtS: number,
  metabolicW: number,
  doseRateMsvPerSol = GALE_DOSE_MSV_PER_SOL,
): ResourceState {
  if (dtS <= 0) return state;
  const dtMin = dtS / 60;
  const rates = consumptionRates(metabolicW);
  const nextPriPsi =
    state.o2Source === "PRI"
      ? Math.max(0, state.o2PrimaryPsi - rates.o2PsiPerMin * dtMin)
      : state.o2PrimaryPsi;
  const nextO2Source: "PRI" | "SEC" = nextPriPsi <= 0 ? "SEC" : state.o2Source;
  const nextSecPsi =
    nextO2Source === "SEC" ? Math.max(0, state.o2SecondaryPsi - 20 * dtMin) : state.o2SecondaryPsi;
  const nextCo2Pct = Math.min(100, state.co2ScrubberPct + rates.co2PctPerMin * dtMin);
  const nextCoolantPct = Math.max(0, state.coolantStoragePct - rates.coolantPctPerMin * dtMin);
  const nextBatteryWh = Math.max(0, state.batteryWh - rates.batteryWhPerMin * dtMin);
  const nextDoseEva = state.doseEvaMSv + (doseRateMsvPerSol / SOL_SECONDS) * dtS;

  const lim = limitingConsumable(
    {
      o2PrimaryPsi: nextPriPsi,
      co2ScrubberPct: nextCo2Pct,
      coolantStoragePct: nextCoolantPct,
      batteryWh: nextBatteryWh,
    },
    metabolicW,
  );

  return {
    ...state,
    missionTimeS: state.missionTimeS + dtS,
    o2PrimaryPsi: nextPriPsi,
    o2PrimaryMin: lim.o2PrimaryMin,
    o2SecondaryPsi: nextSecPsi,
    o2SecondaryMin: Math.max(0, (nextSecPsi / 6000) * SEC_RESERVE_MIN),
    o2Source: nextO2Source,
    co2ScrubberPct: nextCo2Pct,
    co2CapacityMin: lim.co2CapacityMin,
    coolantStoragePct: nextCoolantPct,
    coolantMin: lim.coolantMin,
    batteryWh: nextBatteryWh,
    batteryMin: lim.batteryMin,
    evaElapsedMin: state.evaElapsedMin + dtMin,
    doseEvaMSv: nextDoseEva,
    limiting: lim.limiting,
  };
}

export interface ReturnMarginInput {
  readonly limitingMin: number;
  readonly returnMin: number;
  readonly reserveMin?: number;
}

export interface ReturnMarginResult {
  readonly marginMin: number;
  readonly marginPct: number;
  readonly status: "go" | "caution" | "noGo";
  readonly noGo: boolean;
  readonly caution: boolean;
}

/**
 * Calcula el margen de regreso (walkback) según HUELLA PRE-01 / EVA-01:
 * margen_regreso_min = consumible_limitante_min - t_regreso_min - reserva_min
 * margen_regreso_pct = 100 * margen_regreso_min / consumible_limitante_min
 */
export function returnMargin(input: ReturnMarginInput): ReturnMarginResult {
  const reserveMin = input.reserveMin ?? 0;
  const limitingMin = Math.max(0, input.limitingMin);
  const marginMin = limitingMin - input.returnMin - reserveMin;
  const marginPct = limitingMin > 0 ? (100 * marginMin) / limitingMin : -100;
  const noGo = marginMin < 0 || limitingMin <= 0;
  const caution = !noGo && marginPct < CAUTION_MARGIN_PCT;
  const status: "go" | "caution" | "noGo" = noGo ? "noGo" : caution ? "caution" : "go";
  return {
    marginMin,
    marginPct,
    status,
    noGo,
    caution,
  };
}
