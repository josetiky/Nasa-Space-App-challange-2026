/**
 * M.I.Y.H. · Terreno 3D de cada misión del carrusel (pestaña 04).
 *
 * Dos orígenes, y la ficha dice siempre cuál es (R6/R7: lo modelado nunca se presenta como medido):
 *   REAL      Curiosity y la base Ares I (cráter Gale): elevación a 1 m y ortofoto de las mallas
 *             estéreo de Curiosity publicadas por Access Mars (public/data/trek/gale/<sitio>).
 *   MODELLED  El resto: mallas ilustrativas de 120 m × 120 m (las reales miden 128 m) en el formato de tesela de Access Mars
 *             (public/models/missions_3d/*.glb, "Project Ares Mars Mission Atlas GLB Builder").
 *             Representan el tipo de relieve del sitio; NO son elevación medida.
 */
export type MissionTerrain =
  | { readonly kind: "real"; readonly siteId: string; readonly place: string }
  | { readonly kind: "modelled"; readonly glb: string; readonly place: string };

const glb = (name: string) => `/models/missions_3d/${name}.glb`;

export const MISSION_TERRAINS: Readonly<Record<string, MissionTerrain>> = {
  viking1: { kind: "modelled", glb: glb("viking1_chryse"), place: "Chryse Planitia" },
  sojourner: { kind: "modelled", glb: glb("sojourner_ares_vallis"), place: "Ares Vallis" },
  spirit: { kind: "modelled", glb: glb("spirit_gusev_homeplate"), place: "Home Plate · Gusev" },
  opportunity: { kind: "modelled", glb: glb("opportunity_meridiani"), place: "Meridiani Planum" },
  phoenix: {
    kind: "modelled",
    glb: glb("phoenix_green_valley"),
    place: "Green Valley · Vastitas Borealis",
  },
  curiosity: { kind: "real", siteId: "landing_site", place: "Bradbury Landing · Gale" },
  insight: {
    kind: "modelled",
    glb: glb("insight_homestead_hollow"),
    place: "Homestead Hollow · Elysium",
  },
  perseverance: { kind: "modelled", glb: glb("perseverance_jezero"), place: "Jezero" },
  ingenuity: { kind: "modelled", glb: glb("ingenuity_airfield"), place: "Jezero" },
  zhurong: { kind: "modelled", glb: glb("zhurong_utopia"), place: "Utopia Planitia" },
  ares: { kind: "real", siteId: "murray_buttes", place: "Murray Buttes · Gale" },
};
