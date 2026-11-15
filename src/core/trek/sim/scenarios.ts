/**
 * Mars Trek · Guiones deterministas de demostración y validación (Tarea 10, ARCHITECTURE §8 y TESTING_STRATEGY §3).
 */
import type {
  HealthState,
  LocalPoint,
  MissionProfileId,
  SimEvent,
  WeightProfileId,
} from "../contracts";

export interface TrekScenarioStep {
  readonly atS: number;
  readonly labelEs: string;
  readonly labelEn: string;
  readonly events: readonly SimEvent[];
}

export interface TrekScenarioScript {
  readonly id: string;
  readonly titleEs: string;
  readonly titleEn: string;
  readonly summaryEs: string;
  readonly summaryEn: string;
  readonly seed: number;
  readonly siteId: string;
  readonly missionProfile: MissionProfileId;
  readonly weightProfile: WeightProfileId;
  readonly origin?: LocalPoint;
  readonly goal?: LocalPoint;
  readonly steps: readonly TrekScenarioStep[];
  readonly expectedFinalState: HealthState;
}

export const TREK_SCENARIOS: readonly TrekScenarioScript[] = [
  {
    id: "demo-fatigue-corridors",
    titleEs: "T-06 · Fatiga y Cambio de Corredor (17° → 9° → Refugio)",
    titleEn: "T-06 · Fatigue & Corridor Switch (17° → 9° → Shelter)",
    summaryEs:
      "En NORMAL elige el corredor corto A (17°). Al acumular fatiga (límite 15°) descarta A y toma el rodeo B (≤ 9°). En CRITICAL redirige al refugio.",
    summaryEn:
      "In NORMAL selects short corridor A (17°). Under FATIGUE (15° limit) drops A for gentler corridor B (≤ 9°). In CRITICAL routes to shelter.",
    seed: 42,
    siteId: "synthetic_two_corridors",
    missionProfile: "team",
    weightProfile: "fastest",
    origin: { x: -42, z: 0 },
    goal: { x: 42, z: 0 },
    steps: [
      {
        atS: 60,
        labelEs: "Paso 1 · Subida con carga: entra en FATIGUE (límite baja de 20° a 15°)",
        labelEn: "Step 1 · Loaded climb: enters FATIGUE (slope limit drops 20° → 15°)",
        events: [{ kind: "health-incident", incident: "fatiga_progresiva", simulated: true }],
      },
      {
        atS: 180,
        labelEs: "Paso 2 · Fallo de ventilación: escala a CRITICAL (modo regreso a refugio)",
        labelEn: "Step 2 · Fan failure: escalates to CRITICAL (return-mode to shelter)",
        events: [{ kind: "health-incident", incident: "falla_ventilador", simulated: true }],
      },
    ],
    expectedFinalState: "CRITICAL",
  },
  {
    id: "demo-storm-and-sep",
    titleEs: "T-03 / T-04 · Tormenta de Polvo Local y Alerta Solar SEP en Gale",
    titleEn: "T-03 / T-04 · Local Dust Storm & Solar SEP Alert at Gale",
    summaryEs:
      "Inyecta un polígono de tormenta Z5 sobre la ruta en Murray Buttes forzando un rodeo seguro, seguido de una alerta solar SEP hacia el refugio blindado.",
    summaryEn:
      "Injects an active Z5 dust storm polygon across the Murray Buttes route forcing a safe detour, followed by an SEP solar storm alert to shielded shelter.",
    seed: 42,
    siteId: "murray_buttes",
    missionProfile: "team",
    weightProfile: "balanced",
    steps: [
      {
        atS: 60,
        labelEs: "Paso 1 · Tormenta local activa (Z5) entra sobre el corredor central",
        labelEn: "Step 1 · Active local dust storm (Z5) enters central corridor",
        events: [
          {
            kind: "storm-appear",
            storm: {
              id: "storm-gale-1",
              name: "Frente de Polvo Murray Buttes",
              center: { x: -4, z: -2 },
              radiusM: 18,
              tau: 2.8,
              active: true,
              dataType: "SIMULATED",
            },
            simulated: true,
          },
        ],
      },
      {
        atS: 180,
        labelEs: "Paso 2 · Alerta de Partículas Solares (SEP): desvío inmediato a refugio blindado",
        labelEn: "Step 2 · Solar Energetic Particle (SEP) Alert: immediate shelter redirect",
        events: [{ kind: "sep-alert", active: true, doseRateMultiplier: 4, simulated: true }],
      },
    ],
    expectedFinalState: "CRITICAL",
  },
  {
    id: "demo-simultaneous-stress",
    titleEs: "T-11 · Triple Contingencia Simultánea (Tormenta + Fatiga + Batería)",
    titleEn: "T-11 · Simultaneous Triple Contingency (Storm + Fatigue + Battery)",
    summaryEs:
      "Aplica en un mismo ciclo tormenta de polvo, fatiga del astronauta y caída de batería, componiendo la envolvente más restrictiva en una sola replanificación.",
    summaryEn:
      "Applies dust storm, astronaut fatigue, and battery drop in a single cycle, composing the strictest safety envelope in one deterministic replan.",
    seed: 42,
    siteId: "murray_buttes",
    missionProfile: "team",
    weightProfile: "balanced",
    steps: [
      {
        atS: 120,
        labelEs: "Contingencia triple simultánea (Tormenta Z5 + Fatiga + Caída de Batería 35 %)",
        labelEn: "Simultaneous triple contingency (Storm Z5 + Fatigue + 35 % Battery Drop)",
        events: [
          {
            kind: "storm-appear",
            storm: {
              id: "storm-simul",
              name: "Celda Convectiva de Polvo",
              center: { x: 0, z: 0 },
              radiusM: 14,
              tau: 2.4,
              active: true,
              dataType: "SIMULATED",
            },
            simulated: true,
          },
          { kind: "health-incident", incident: "fatiga_progresiva", simulated: true },
          { kind: "battery-drop", dropPct: 35, simulated: true },
        ],
      },
    ],
    expectedFinalState: "FATIGUE",
  },
  {
    id: "demo-sensor-cut-recovery",
    titleEs: "T-08 / T-09 · Pérdida de Sensores Biomédicos y Confirmación Humana",
    titleEn: "T-08 / T-09 · Biomedical Sensor Loss & Human Confirmation",
    summaryEs:
      "Simula un corte de telemetría biomédica (SEN-04 → CAUTION inmediato: sin datos no es sano) y el protocolo de confirmación humana auditada.",
    summaryEn:
      "Simulates a biomedical telemetry cut (SEN-04 → immediate CAUTION: missing data is never healthy) and audited human confirmation.",
    seed: 42,
    siteId: "murray_buttes",
    missionProfile: "team",
    weightProfile: "safest",
    steps: [
      {
        atS: 60,
        labelEs: "Corte de telemetría biomédica (SEN-04 → CAUTION conservador)",
        labelEn: "Biomedical telemetry cut (SEN-04 → conservative CAUTION)",
        events: [{ kind: "health-incident", incident: "perdida_sensores", simulated: true }],
      },
    ],
    expectedFinalState: "CAUTION",
  },
];
