/**
 * MarsWalk · Textos de la cubierta (pestañas, títulos y rótulos con el tono de mars-space-rockstars).
 */
import type { TrekLang } from "../i18n";

const es = {
  brandTab: ["Inicio", "MarsWalk", "Simulación", "Misiones", "Referencias", "Proyecto"],
  railTips: [
    "Inicio",
    "MarsWalk",
    "Simulación y consola",
    "Misiones y rovers",
    "Referencias y recursos (material de apoyo)",
    "Proyecto",
  ],
  prev: "Sección anterior",
  next: "Sección siguiente",
  classic: "Vista clásica",
  back: "Ir al inicio",
  // 01 · MarsWalk
  plannerEyebrow: "MarsWalk",
  plannerTitle: ["Planificador", "de caminatas"],
  plannerLead:
    "La ruta la traza el planificador A* sobre la malla real del cráter Gale, dentro de la envolvente de seguridad vigente. Elige origen y destino en el mapa: si la línea recta no es segura, te decimos por qué.",
  workspace: "Área de trabajo",
  engineLink: "Motor A* · local",
  send: "Enviar a simulación",
  routeDraft: "---[ RUTA · BLOQUEADA ]---",
  routeLoading: "---[ TESELA · GALE ]---",
  noRouteCard: "No hay ruta admisible bajo la envolvente actual.",
  // 02 · Ruta y porqués
  whyEyebrow: "Ruta y porqués",
  whyTitle: ["Por qué", "esta ruta"],
  whyLead:
    "Cada metro de la ruta tiene un costo explicado: distancia, terreno, riesgo, energía, incertidumbre y salud. Seguridad primero; la distancia mínima no manda.",
  layersTitle: "Capas y procedencia",
  // 03 · Simulación
  simEyebrow: "Simulación y consola",
  simTitle: ["La ruta, el clima y tu", "pulso en una pantalla"],
  simChip: "Simulado · telemetría HUELLA",
  simLead:
    "La ruta se dibuja sobre la elevación real de Gale. La telemetría del traje, las tormentas y las fallas son simuladas; las reglas de salud deciden sin mirar el terreno.",
  mapCard: "Mapa",
  returnMargin: "Margen de regreso",
  astronaut: "Astronauta",
  assistant: "Asistente",
  routeGuide: "Guía de ruta",
  // 04 · Salud
  healthEyebrow: "Salud y contingencias",
  healthTitle: ["Salud independiente", "del terreno"],
  healthLead:
    "La máquina de estados HUELLA evalúa signos y traje por su cuenta. En CRITICAL o EMERGENCY el descenso de estado queda bloqueado hasta que un operador lo confirme por escrito.",
  openWhy: "Por qué esta ruta →",
  plannerViews: "Vistas del planificador",
  plannerView: { chain: "Cadena", points: "Puntos", weights: "Prioridades A*" },
  openHealth: "Salud y contingencias →",
  credits:
    "Diseño: Space Rockstars (M.I.Y.H.). Texturas Marte/Vía Láctea: Solar System Scope (CC BY 4.0). Fuentes: Syncopate, Inter, JetBrains Mono (OFL).",
};

export type DeckTexts = typeof es;

const en: DeckTexts = {
  brandTab: ["Home", "MarsWalk", "Simulation", "Missions", "References", "Project"],
  railTips: [
    "Home",
    "MarsWalk",
    "Simulation and console",
    "Missions and rovers",
    "References & resources (supporting material)",
    "Project",
  ],
  prev: "Previous section",
  next: "Next section",
  classic: "Classic view",
  back: "Go to home",
  plannerEyebrow: "MarsWalk",
  plannerTitle: ["EVA route", "planner"],
  plannerLead:
    "The A* planner draws the route over Gale crater's real mesh, inside the current safety envelope. Pick origin and goal on the map: if the straight line is unsafe, we tell you why.",
  workspace: "Workspace",
  engineLink: "A* engine · local",
  send: "Send to simulation",
  routeDraft: "---[ ROUTE · BLOCKED ]---",
  routeLoading: "---[ TILE · GALE ]---",
  noRouteCard: "No admissible route under the current envelope.",
  whyEyebrow: "Route & whys",
  whyTitle: ["Why", "this route"],
  whyLead:
    "Every metre has an explained cost: distance, terrain, risk, energy, uncertainty and health. Safety first; shortest distance does not rule.",
  layersTitle: "Layers & provenance",
  simEyebrow: "Simulation and console",
  simTitle: ["The route, the weather and your", "pulse on a single screen"],
  simChip: "Simulated · HUELLA telemetry",
  simLead:
    "The route is drawn over Gale's real elevation. Suit telemetry, storms and failures are simulated; health rules decide without looking at the terrain.",
  mapCard: "Map",
  returnMargin: "Return margin",
  astronaut: "Astronaut",
  assistant: "Assistant",
  routeGuide: "Route guide",
  healthEyebrow: "Health and contingencies",
  healthTitle: ["Health, independent", "of terrain"],
  healthLead:
    "The HUELLA state machine evaluates vitals and suit on its own. In CRITICAL or EMERGENCY the state descent stays locked until an operator confirms it in writing.",
  openWhy: "Why this route →",
  plannerViews: "Planner views",
  plannerView: { chain: "Chain", points: "Points", weights: "A* priorities" },
  openHealth: "Health & contingencies →",
  credits:
    "Design: Space Rockstars (M.I.Y.H.). Mars/Milky Way textures: Solar System Scope (CC BY 4.0). Fonts: Syncopate, Inter, JetBrains Mono (OFL).",
};

export const DECK_TEXTS: Readonly<Record<TrekLang, DeckTexts>> = { es, en };
