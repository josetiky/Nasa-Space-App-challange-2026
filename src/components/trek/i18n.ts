/**
 * Mars Trek · Diccionario bilingüe centralizado ES/EN (Tarea 11, Decisión P-19 y P-20).
 * Español por defecto. Incluye aviso explícito de que Mars Trek · Navegador es el prototipo de
 * planificación del equipo y no el portal web oficial NASA Solar System Treks.
 */
import type { CostTermId, HealthState, WeightProfileId, ZoneClass } from "@/core/trek/contracts";

export type TrekLang = "es" | "en";

export interface TrekTranslations {
  readonly brandTitle: string;
  readonly brandSubtitle: string;
  readonly portalDisclaimer: string;
  readonly simulationBanner: string;
  readonly siteLabel: string;
  readonly profileLabel: string;
  readonly missionModeLabel: string;
  readonly pickModeLabel: string;
  readonly pickModes: {
    readonly inspect: string;
    readonly origin: string;
    readonly goal: string;
    readonly storm: string;
  };
  readonly layersTitle: string;
  readonly layers: {
    readonly elevation: string;
    readonly slope: string;
    readonly zones: string;
    readonly confidence: string;
    readonly dust: string;
    readonly radiation: string;
  };
  readonly unavailableLayersTitle: string;
  readonly healthTitle: string;
  readonly healthStates: Record<HealthState, string>;
  readonly zoneLabels: Record<ZoneClass, string>;
  readonly weightProfiles: Record<WeightProfileId, string>;
  readonly costTerms: Record<CostTermId, { readonly short: string; readonly label: string }>;
  readonly activeRouteTitle: string;
  readonly whyThisRouteTitle: string;
  readonly directPathBlockedTitle: string;
  readonly alternativesTitle: string;
  readonly resourcesTitle: string;
  readonly simConsoleTitle: string;
  readonly humanAuthTitle: string;
  readonly humanAuthByPlaceholder: string;
  readonly humanAuthReasonPlaceholder: string;
  readonly humanAuthButton: string;
  readonly exportToMissionButton: string;
  readonly acceptProposalButton: string;
  readonly clearStormsButton: string;
  readonly resetSessionButton: string;
}

export const TREK_TEXTS: Readonly<Record<TrekLang, TrekTranslations>> = {
  es: {
    brandTitle: "MARS TREK · NAVEGADOR",
    brandSubtitle: "Planificador EVA Multicapa A* · Seguridad > Distancia",
    portalDisclaimer:
      "Prototipo educativo de navegación EVA (NASA Space Apps 2026). No es el portal oficial NASA Solar System Treks.",
    simulationBanner:
      "SIMULACIÓN ACTIVA: la telemetría fisiológica y los eventos dinámicos inyectados son simulados (no son mediciones clínicas reales).",
    siteLabel: "Sitio de Marte",
    profileLabel: "Perfil de Pesos",
    missionModeLabel: "Modo de Misión",
    pickModeLabel: "Clic en Mapa",
    pickModes: {
      inspect: "Inspeccionar Celda",
      origin: "Fijar Origen",
      goal: "Fijar Destino",
      storm: "Inyectar Tormenta Z5",
    },
    layersTitle: "Capas Científicas y Costmap",
    layers: {
      elevation: "L01 · Ortofoto + relieve + curvas",
      slope: "L02 · Pendiente Topográfica (°)",
      zones: "L15 · Clasificación de Zonas (Z0–Z5)",
      confidence: "L12 · Confianza Científica (K1–K5)",
      dust: "L06 · Polvo / Opacidad τ",
      radiation: "L08 · Dosis Ambiental (mSv/sol)",
    },
    unavailableLayersTitle: "Capas Desacopladas (No disponibles como ráster numérico local)",
    healthTitle: "Salud del Astronauta (HUELLA + FSM)",
    healthStates: {
      NORMAL: "NORMAL",
      FATIGUE: "FATIGA",
      CAUTION: "PRECAUCIÓN",
      CRITICAL: "CRÍTICO",
      EMERGENCY: "EMERGENCIA",
    },
    zoneLabels: {
      Z0: "Z0 · Transitable",
      Z1: "Z1 · Precaución (15–20°)",
      Z2: "Z2 · Alto Riesgo",
      Z3: "Z3 · Desconocida (K5/NaN)",
      Z4: "Z4 · Restringida (COSPAR)",
      Z5: "Z5 · Prohibida (Máscara)",
    },
    weightProfiles: {
      balanced: "Equilibrado",
      fastest: "Más Rápido",
      safest: "Más Seguro",
      known: "Más Conocido (K1/K2)",
      "resource-saving": "Ahorro de Recursos",
      "autonomous-rover": "Rover Autónomo",
      emergency: "Emergencia (Refugio)",
    },
    costTerms: {
      D: { short: "D", label: "Distancia 3D" },
      T: { short: "T", label: "Topografía y Pendiente" },
      R: { short: "R", label: "Riesgo Ambiental" },
      E: { short: "E", label: "Consumo Energético/O₂" },
      U: { short: "U", label: "Incertidumbre (1 − C)" },
      H: { short: "H", label: "Exigencia Fisiológica" },
    },
    activeRouteTitle: "Ruta Activa y Envolvente",
    whyThisRouteTitle: "Por Qué Esta Ruta (Barra de Porqués)",
    directPathBlockedTitle: "Por Qué No la Línea Directa",
    alternativesTitle: "Comparación de Alternativas",
    resourcesTitle: "Recursos y Margen de Regreso (Walkback)",
    simConsoleTitle: "Consola de Simulación y Línea de Tiempo",
    humanAuthTitle: "Candado de Seguridad (Confirmación Humana Requerida)",
    humanAuthByPlaceholder: "Rol autorizador (ej. HAB-IV1 / Cirujano de Vuelo)",
    humanAuthReasonPlaceholder: "Justificación técnica registrada para desescalar estado…",
    humanAuthButton: "Confirmar y Registrar Desescalamiento",
    exportToMissionButton: "Enviar Ruta al Planificador de Misión",
    acceptProposalButton: "Aceptar Ruta Propuesta (> 10 % mejora)",
    clearStormsButton: "Limpiar Tormentas",
    resetSessionButton: "Reiniciar Sesión",
  },
  en: {
    brandTitle: "MARS TREK · NAVIGATOR",
    brandSubtitle: "Multi-Layer A* EVA Planner · Safety > Distance",
    portalDisclaimer:
      "Educational EVA navigation prototype (NASA Space Apps 2026). Distinct from the official NASA Solar System Treks portal.",
    simulationBanner:
      "ACTIVE SIMULATION: physiological telemetry and injected dynamic hazards are simulated (not real clinical measurements).",
    siteLabel: "Mars Site",
    profileLabel: "Weight Profile",
    missionModeLabel: "Mission Mode",
    pickModeLabel: "Map Click Action",
    pickModes: {
      inspect: "Inspect Cell",
      origin: "Set Origin",
      goal: "Set Destination",
      storm: "Inject Z5 Storm",
    },
    layersTitle: "Scientific & Costmap Layers",
    layers: {
      elevation: "L01 · Orthophoto + relief + contours",
      slope: "L02 · Terrain Slope (°)",
      zones: "L15 · Zone Classification (Z0–Z5)",
      confidence: "L12 · Scientific Confidence (K1–K5)",
      dust: "L06 · Dust Opacity τ",
      radiation: "L08 · Ambient Dose (mSv/sol)",
    },
    unavailableLayersTitle: "Decoupled Layers (Not bundled as local numeric rasters)",
    healthTitle: "Astronaut Health (HUELLA + FSM)",
    healthStates: {
      NORMAL: "NORMAL",
      FATIGUE: "FATIGUE",
      CAUTION: "CAUTION",
      CRITICAL: "CRITICAL",
      EMERGENCY: "EMERGENCY",
    },
    zoneLabels: {
      Z0: "Z0 · Passable",
      Z1: "Z1 · Caution (15–20°)",
      Z2: "Z2 · High Risk",
      Z3: "Z3 · Unknown (K5/NaN)",
      Z4: "Z4 · Restricted (COSPAR)",
      Z5: "Z5 · Forbidden (Mask)",
    },
    weightProfiles: {
      balanced: "Balanced",
      fastest: "Fastest",
      safest: "Safest",
      known: "Best Known (K1/K2)",
      "resource-saving": "Resource Saving",
      "autonomous-rover": "Autonomous Rover",
      emergency: "Emergency (Shelter)",
    },
    costTerms: {
      D: { short: "D", label: "3D Distance" },
      T: { short: "T", label: "Topography & Slope" },
      R: { short: "R", label: "Environmental Risk" },
      E: { short: "E", label: "Energy/O₂ Consumption" },
      U: { short: "U", label: "Uncertainty (1 − C)" },
      H: { short: "H", label: "Physiological Strain" },
    },
    activeRouteTitle: "Active Route & Safety Envelope",
    whyThisRouteTitle: "Why This Route (Contribution Breakdown)",
    directPathBlockedTitle: "Why Not the Straight Line",
    alternativesTitle: "Route Alternatives Comparison",
    resourcesTitle: "Resources & Walkback Margin",
    simConsoleTitle: "Simulation Console & Event Timeline",
    humanAuthTitle: "Safety Interlock (Human Confirmation Required)",
    humanAuthByPlaceholder: "Authorizing role (e.g. HAB-IV1 / Flight Surgeon)",
    humanAuthReasonPlaceholder: "Recorded technical justification to step down state…",
    humanAuthButton: "Confirm & Record Step-Down",
    exportToMissionButton: "Send Route to Mission Planner",
    acceptProposalButton: "Accept Proposed Route (> 10 % gain)",
    clearStormsButton: "Clear Storms",
    resetSessionButton: "Reset Session",
  },
};
