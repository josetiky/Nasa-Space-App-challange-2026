/**
 * M.I.Y.H. · Módulos de mapas de Marte que quedan en la navegación (shell y cubierta).
 * Los demás módulos (planificador, simulador, decisiones, reportes, datos NASA, recursos,
 * protocolos, sol a sol) siguen en el código pero ya no aparecen en la navegación.
 */
export interface MarsMapModule {
  readonly to: "/explorer" | "/atlas" | "/mission-lab" | "/hazard-layers" | "/trek";
  readonly search?: { readonly ui: "classic" };
  readonly label: string;
  readonly es: string;
  readonly en: string;
}

export const MARS_MAPS: readonly MarsMapModule[] = [
  {
    to: "/explorer",
    label: "Mars Explorer (3D / EVA)",
    es: "Globo 3D sobre imágenes NASA Trek y relieve MOLA, con terreno real de Curiosity.",
    en: "3D globe on NASA Trek imagery and MOLA relief, with real Curiosity terrain.",
  },
  {
    to: "/atlas",
    label: "Survival Atlas (GIS)",
    es: "Diez capas de supervivencia con datos NASA, procedencia y leyendas.",
    en: "Ten NASA-sourced survival layers with provenance and legends.",
  },
  {
    to: "/mission-lab",
    label: "Atlas de misiones",
    es: "Mapa global de las misiones a Marte y DEM 3D regionales.",
    en: "Global map of Mars missions and regional 3D DEMs.",
  },
  {
    to: "/hazard-layers",
    label: "Hazard Layers",
    es: "Capas de peligro: polvo, radiación, pendiente y terreno.",
    en: "Hazard layers: dust, radiation, slope and terrain.",
  },
  {
    to: "/trek",
    search: { ui: "classic" },
    label: "Mars Trek · Navegador",
    es: "Consola clásica del navegador A* sobre las mallas de Gale.",
    en: "Classic A* navigator console over the Gale meshes.",
  },
];
