/**
 * Mars Trek · Parámetros centralizados con procedencia y origen explícito.
 * Cada parámetro declara su origen ("diseño" | "HUELLA" | "verificado" | "proyecto") y nota.
 */

export type ParamOrigin = "diseño" | "HUELLA" | "verificado" | "proyecto";

export interface TrekParam<T = number> {
  readonly value: T;
  readonly unit?: string;
  readonly origin: ParamOrigin;
  readonly note: string;
  readonly source?: string;
}

export const TREK_PARAMS = {
  // Geodesia y gravedad
  marsRadiusIauM: {
    value: 3_396_190,
    unit: "m",
    origin: "verificado",
    note: "Radio ecuatorial esférico IAU_2015:49900 usado en cartografía USGS y MMGIS.",
    source: "IAU_2015:49900 / USGS Astrogeology",
  },
  marsGravityRatio: {
    value: 0.38,
    unit: "g",
    origin: "HUELLA",
    note: "Fracción de gravedad terrestre usada en el modelo metabólico de Pandolf para Marte.",
    source: "NASA Mars Fact Sheet / HUELLA",
  },
  marsGravityMs2: {
    value: 3.71,
    unit: "m/s²",
    origin: "proyecto",
    note: "Aceleración gravitatoria superficial marciana en constants.ts.",
    source: "NASA Mars Fact Sheet",
  },

  // Límites de pendiente (P-04: 20° a pie)
  maxSlopeFootNormalDeg: {
    value: 20,
    unit: "deg",
    origin: "verificado",
    note: "Límite duro de pendiente a pie en estado NORMAL (capacidad del sistema xEVA).",
    source: "NASA EVA-EXP-0042 Rev. B / HUELLA PRE-10",
  },
  cautionSlopeFootDeg: {
    value: 15,
    unit: "deg",
    origin: "proyecto",
    note: "Umbral de precaución de pendiente a pie (Z1) y límite duro en FATIGUE/CRITICAL.",
    source: "HUELLA PRE-10 / EVA.cautionSlopeDeg",
  },
  cautionSlopeLoadedDeg: {
    value: 10,
    unit: "deg",
    origin: "HUELLA",
    note: "Umbral de precaución con carga y límite de pendiente en CAUTION fisiológico.",
    source: "HUELLA PRE-10 [diseño]",
  },
  maxSlopeRoverCrewedDeg: {
    value: 30,
    unit: "deg",
    origin: "verificado",
    note: "Límite operativo de inclinación para rover conducido.",
    source: "NASA Perseverance Rover Components",
  },
  maxSlopeRoverAutoDeg: {
    value: 20,
    unit: "deg",
    origin: "diseño",
    note: "Límite operativo conservador para conducción autónoma de rover.",
    source: "[diseño] sobre AutoNav Perseverance",
  },

  // Locomoción y metabolismo (P-05: 2 km/h en pandolf-mars, 3 km/h en tobler-linear)
  flatSpeedPandolfKmh: {
    value: 2.0,
    unit: "km/h",
    origin: "HUELLA",
    note: "Velocidad nominal en llano del modelo pandolf-mars.",
    source: "HUELLA generar_caminata_sintetica.py",
  },
  minSpeedPandolfKmh: {
    value: 0.8,
    unit: "km/h",
    origin: "HUELLA",
    note: "Velocidad mínima de marcha en pendiente del modelo pandolf-mars.",
    source: "HUELLA generar_caminata_sintetica.py [diseño]",
  },
  flatMetabolicRefKjH: {
    value: 1000.0,
    unit: "kJ/h",
    origin: "verificado",
    note: "Gasto metabólico de referencia en llano calibrado con la media de EVAs Apolo (~277.78 W).",
    source: "NASA TN D-7883 / HUELLA",
  },
  sustainableMetabolicW: {
    value: 350.0,
    unit: "W",
    origin: "diseño",
    note: "Gasto metabólico sostenible de referencia para el término fisiológico H y modelo de fatiga.",
    source: "[diseño] anclado a 30-40 % VO2 pico (NTRS 20230014953)",
  },
  refBodyMassKg: {
    value: 65.0,
    unit: "kg",
    origin: "HUELLA",
    note: "Masa corporal del tripulante de referencia (EVA1 en HUELLA).",
    source: "HUELLA generar_caminata_sintetica.py [diseño]",
  },
  refSuitMassKg: {
    value: 104.0,
    unit: "kg",
    origin: "verificado",
    note: "Masa objetivo del traje espacial marciano MxEMU.",
    source: "NASA Mars PLSS Status and Plan (ICES-2026)",
  },
  refEquipmentKg: {
    value: 3.4,
    unit: "kg",
    origin: "HUELLA",
    note: "Masa de herramientas geológicas de referencia (martillo 0.9 kg + XRF 2.5 kg).",
    source: "HUELLA generar_caminata_sintetica.py (Smithsonian / BASALT)",
  },

  // Consumibles
  kjPerLiterO2: {
    value: 20.9,
    unit: "kJ/L",
    origin: "HUELLA",
    note: "Equivalente energético por litro de O2 consumido en HUELLA.",
    source: "Gernhardt & Dervay / HUELLA",
  },
  respiratoryQuotient: {
    value: 0.85,
    unit: "adim",
    origin: "HUELLA",
    note: "Cociente respiratorio VCO2 / VO2.",
    source: "HUELLA generar_caminata_sintetica.py",
  },
  psiPerMinPerLiterO2: {
    value: 2.13,
    unit: "psi/L",
    origin: "HUELLA",
    note: "Caída de presión del tanque primario EMU (psi/min) por cada L/min de VO2.",
    source: "HUELLA generar_caminata_sintetica.py",
  },
  primaryO2TankPsi: {
    value: 950.0,
    unit: "psi",
    origin: "HUELLA",
    note: "Presión inicial nominal del tanque primario de O2.",
    source: "EMU / HUELLA",
  },
  secondaryO2ReserveMin: {
    value: 30.0,
    unit: "min",
    origin: "HUELLA",
    note: "Reserva mínima del tanque secundario de O2 (intocable en planificación).",
    source: "EMU / HUELLA PRE-02",
  },
  suitBatteryWh: {
    value: 500.0,
    unit: "Wh",
    origin: "HUELLA",
    note: "Capacidad nominal de batería del traje.",
    source: "EMU Li-ion ~450-540 Wh / HUELLA",
  },
  suitBatteryDrawW: {
    value: 50.0,
    unit: "W",
    origin: "diseño",
    note: "Potencia eléctrica constante consumida por el traje.",
    source: "HUELLA generar_caminata_sintetica.py [diseño]",
  },
  co2ScrubberCapacityL: {
    value: 400.0,
    unit: "L",
    origin: "diseño",
    note: "Capacidad total del filtro de CO2 del traje.",
    source: "HUELLA generar_caminata_sintetica.py [diseño]",
  },
  coolantLossPctPerKj: {
    value: 0.003,
    unit: "%/kJ",
    origin: "diseño",
    note: "Consumo porcentual de agua de enfriamiento por kJ metabólico.",
    source: "HUELLA generar_caminata_sintetica.py [diseño]",
  },
  modelMarginPct: {
    value: 25,
    unit: "%",
    origin: "diseño",
    note: "Margen explícito del 25 % sobre tiempo y consumo previstos por optimismo de modelos EVA.",
    source: "Gilkey et al. (SEXTANT MDRS) / RESOURCE_MANAGEMENT §4.3",
  },
  returnMarginCautionPct: {
    value: 20,
    unit: "%",
    origin: "HUELLA",
    note: "Por debajo del 20 % de margen de regreso se activa PRECAUCION (PRE-01 / EVA-01).",
    source: "HUELLA reglas.json PRE-01 / EVA-01",
  },

  // Costos, zonas y pesos
  minDistanceWeight: {
    value: 0.05,
    unit: "adim",
    origin: "diseño",
    note: "Cota inferior obligatoria w_d,min para preservar admisibilidad de la heurística A* (INV-R1).",
    source: "ROUTING_ALGORITHM §4.1 [diseño]",
  },
  zoneMultiplierZ0: {
    value: 1,
    unit: "adim",
    origin: "proyecto",
    note: "Multiplicador de costo κ para zona Z0 transitable.",
    source: "ROUTING_ALGORITHM §3.4",
  },
  zoneMultiplierZ1: {
    value: 4,
    unit: "adim",
    origin: "proyecto",
    note: "Multiplicador de costo κ para zona Z1 de precaución (cautionWeight de findSafePath).",
    source: "src/core/science/routing.ts / ROUTING_ALGORITHM §3.4",
  },
  zoneMultiplierZ2: {
    value: 12,
    unit: "adim",
    origin: "diseño",
    note: "Multiplicador de costo κ para zona Z2 de alto riesgo cuando el perfil la admite.",
    source: "ROUTING_ALGORITHM §3.4 [diseño]",
  },
  roughnessCostCoeff: {
    value: 0.8,
    unit: "adim",
    origin: "diseño",
    note: "Coeficiente k_rug de rugosidad topográfica en el término t(e).",
    source: "ROUTING_ALGORITHM §3.3 [diseño]",
  },
  softSoilCostCoeff: {
    value: 1.0,
    unit: "adim",
    origin: "diseño",
    note: "Coeficiente k_blando de probabilidad de suelo blando en el término t(e).",
    source: "ROUTING_ALGORITHM §3.3 [diseño]",
  },
  dustRiskCoeff: {
    value: 0.6,
    unit: "adim",
    origin: "diseño",
    note: "Coeficiente k_polvo de opacidad atmosférica en el término r(e).",
    source: "ROUTING_ALGORITHM §3.3 [diseño]",
  },
  radiationRiskCoeff: {
    value: 0.4,
    unit: "adim",
    origin: "diseño",
    note: "Coeficiente k_rad de tasa de dosis ambiental en el término r(e).",
    source: "ROUTING_ALGORITHM §3.3 [diseño]",
  },
  replanImprovementThresholdPct: {
    value: 10,
    unit: "%",
    origin: "diseño",
    note: "Mejora mínima δ del costo (10 %) para proponer cambio cuando la ruta actual sigue válida.",
    source: "ROUTING_ALGORITHM §6.5 [diseño]",
  },

  // Salud y persistencia
  persistenceRiseS: {
    value: 3,
    unit: "s",
    origin: "HUELLA",
    note: "Segundos consecutivos requeridos para subir el nivel de una alerta en el filtro anti-ruido.",
    source: "HUELLA motor_reglas.py SUBIDA_S [diseño]",
  },
  persistenceFallS: {
    value: 30,
    unit: "s",
    origin: "HUELLA",
    note: "Segundos consecutivos resueltos requeridos para bajar el nivel de una alerta.",
    source: "HUELLA motor_reglas.py BAJADA_S [diseño]",
  },
  fatigueEnterThreshold: {
    value: 0.6,
    unit: "adim",
    origin: "diseño",
    note: "Umbral de entrada a FATIGUE para el índice de fatiga acumulada F (FAT-06).",
    source: "ASTRONAUT_HEALTH_STATE_MACHINE §10.4 [diseño]",
  },
  fatigueExitThreshold: {
    value: 0.4,
    unit: "adim",
    origin: "diseño",
    note: "Umbral de salida de FATIGUE con histéresis para el índice F (FAT-06).",
    source: "ASTRONAUT_HEALTH_STATE_MACHINE §10.4 [diseño]",
  },
  sensorStaleTimeoutS: {
    value: 10,
    unit: "s",
    origin: "diseño",
    note: "Tiempo máximo sin actualización antes de marcar una variable crítica como antigua (SEN-01).",
    source: "ASTRONAUT_HEALTH_STATE_MACHINE §5.3 [diseño]",
  },
} as const satisfies Record<string, TrekParam<number>>;
