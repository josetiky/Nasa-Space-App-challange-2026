/**
 * GENERADO por scripts/trek/build-huella-replay.mjs — no editar a mano.
 * Línea base fisiológica medida en la caminata NOMINAL de "metricas de vida" (HUELLA):
 * percentiles de EVA1 + EVA2 (23216 filas de 1 s) de caminata_nominal_huella.csv
 * (sha256 8d39164c426be451…).
 * Lo que queda por debajo de estos valores es "lo que el cuerpo hace en una EVA sin incidentes" y
 * no cambia los pesos del A*; los umbrales de 1.0 son los de reglas.json / motor_reglas.py.
 */
export const HUELLA_NOMINAL_BASELINE = {
  hrResidualP95: 4.2,
  hrP95: 103,
  coreTempP95: 37.44,
  psiP95: 2.46,
  co2P95: 5.02,
  spo2P5: 97.7,
  respRateP95: 17.7,
  suitPressureDevP95: 0.3,
  humidityP95: 47.5,
  lcvgInletP95: 22.33,
  metabolicP50: 1024,
  metabolicP95: 1285,
  samples: 23216,
} as const;

export const HUELLA_BASELINE_SOURCE =
  "metricas de vida/huella_datos/caminata_nominal_huella.csv (EVA1 + EVA2, percentiles p5/p50/p95)";
