/**
 * M.I.Y.H. — MARS IN YOUR HANDS
 * Master scientific catalogue of all 11 Martian surface & aerial missions,
 * georeferenced discoveries, real multi-sol trajectories, Terrain Intelligence
 * instruments, and planetary cartographic features.
 *
 * Coordinate Reference System: IAU Mars 2000 Planetocentric
 * - Latitude: degrees North [-90, +90]
 * - Longitude: degrees East [-180, +180) and [0, 360)
 * - Elevation: metres relative to the MGS MOLA equipotential areoid (MEGDR)
 */

export type ValidationLevel = "OFICIAL" | "DERIVADO" | "TERCEROS";

export type ReconstructionCategory =
  | "TYPE_A_PHOTOGRAMMETRY"
  | "TYPE_B_DEM"
  | "TYPE_C_MODEL"
  | "TYPE_D_ORBITAL_DRAPE";

export type MissionCategory = "rover" | "aerial" | "lander";
export type MissionStatus = "ACTIVE" | "COMPLETED" | "HIBERNATING";

export interface ScientificMetadata {
  validation: ValidationLevel;
  sourceName: string;
  sourceUrl: string;
  acquisitionDate: string;
  instrument: string;
  crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)";
  resolution: string;
  knownPrecision: string;
  license: string;
}

export interface MissionInstrument {
  id: string;
  acronym: string;
  name: string;
  role: string;
  specs: string;
}

export interface MissionWaypoint {
  sol: number;
  dateUtc?: string;
  lat: number;
  lon: number;
  lon360: number;
  elevationM: number;
  odometerKm: number;
  label: string;
  summary: string;
  accessMarsSceneId?: string;
}

export type DiscoveryKind =
  | "sample"
  | "drill"
  | "rock"
  | "chemical"
  | "experiment"
  | "geology"
  | "seismic"
  | "flight";

export interface ScientificDiscovery {
  id: string;
  missionId: string;
  title: string;
  kind: DiscoveryKind;
  sol: number;
  dateUtc: string;
  locationName: string;
  lat: number;
  lon: number;
  lon360: number;
  elevationM: number;
  instrument: string;
  description: string;
  geologicalContext: string;
  imageUrl: string;
  publicationTitle: string;
  sourceUrl: string;
  metadata: ScientificMetadata;
}

export interface MarsMissionRecord {
  id: string;
  name: string;
  fullName: string;
  agency: "NASA / JPL" | "NASA" | "NASA / UArizona / JPL" | "NASA / JPL / CNES / DLR" | "CNSA";
  category: MissionCategory;
  status: MissionStatus;
  launchDateUtc: string;
  landingDateUtc: string;
  endDateUtc: string | null;
  maxSol: number;
  landingSiteName: string;
  region: string;
  lat: number;
  lon: number;
  lon360: number;
  elevationM: number;
  hasMobileTraverse: boolean;
  totalTraverseKm: number | null;
  odometryNote: string;
  color: string;
  terrainImage: string;
  regionalGlb?: string;
  reconstructionTypes: ReconstructionCategory[];
  accessMarsSiteIds?: string[];
  objectives: string[];
  instruments: MissionInstrument[];
  waypoints: MissionWaypoint[];
  discoveries: ScientificDiscovery[];
  officialSources: Array<{ label: string; url: string; validation: ValidationLevel }>;
  metadata: ScientificMetadata;
}

export interface TerrainIntelligenceProduct {
  id: "mola" | "hirise" | "ctx" | "themis" | "crism" | "hrsc" | "usgs";
  acronym: string;
  name: string;
  spacecraft: string;
  agency: string;
  spatialResolution: string;
  spectralRange: string;
  swathCoverage: string;
  application: string;
  layerCapabilities: string[];
  dataDistinction: "OBSERVED" | "PROCESSED" | "INTERPRETED";
  validation: ValidationLevel;
  officialUrl: string;
  secondaryUrl?: string;
}

export interface PlanetaryFeature {
  id: string;
  name: string;
  kind: "region" | "crater" | "mountain" | "valley" | "dune" | "polar";
  lat: number;
  lon: number;
  lon360: number;
  elevationM: number;
  diameterOrLengthKm: number;
  geologicalUnit: string;
  mineralogyNote: string;
  imageUrl: string;
  regionalGlb?: string;
  description: string;
  sourceUrl: string;
}

export const RECONSTRUCTION_LABELS: Record<
  ReconstructionCategory,
  { badge: string; title: string; detail: string; color: string }
> = {
  TYPE_A_PHOTOGRAMMETRY: {
    badge: "TIPO A · FOTOGRAMETRÍA 3D REAL",
    title: "Reconstrucción 3D fotogramétrica basada en imágenes estereoscópicas de superficie",
    detail:
      "Mallas 3D generadas por NASA JPL OnSight / Access Mars a partir de pares estereoscópicos reales de las cámaras Navcam y Mastcam del rover Curiosity en el cráter Gale.",
    color: "#34d399",
  },
  TYPE_B_DEM: {
    badge: "TIPO B · TERRENO DEM ORBITAL",
    title: "Terreno generado mediante Modelos Digitales de Elevación (DEM)",
    detail:
      "Geometría topográfica derivada de altimetría láser MOLA (463 m/px), HRSC-MOLA Blended DEM (200 m/px), CTX estéreo (20 m/px) o HiRISE DTMs (0.5–1 m/px). No es fotogrametría de superficie.",
    color: "#38bdf8",
  },
  TYPE_C_MODEL: {
    badge: "TIPO C · MODELO 3D DE INGENIERÍA",
    title: "Modelo tridimensional de vehículo o bloque regional aproximado",
    detail:
      "Mallas CAD/glTF de ingeniería (como el rover Curiosity en /eva/rover/scene.glb) o bloques regionales de referencia visual.",
    color: "#f59e0b",
  },
  TYPE_D_ORBITAL_DRAPE: {
    badge: "TIPO D · ORTOIMAGEN ORBITAL SOBRE 3D",
    title: "Visualización de imágenes orbitales proyectadas sobre superficies 3D",
    detail:
      "Mosaicos orbitales Viking MDIM 2.1, CTX, THEMIS y HiRISE proyectados sobre el relieve del areoide marciano.",
    color: "#a78bfa",
  },
};

export const TERRAIN_INTELLIGENCE_SOURCES: TerrainIntelligenceProduct[] = [
  {
    id: "mola",
    acronym: "MOLA",
    name: "Mars Orbiter Laser Altimeter",
    spacecraft: "Mars Global Surveyor (MGS)",
    agency: "NASA / GSFC",
    spatialResolution: "Huella ~168 m · MEGDR global 463 m/px (128 px/grado) · precisión vertical ~1 m",
    spectralRange: "Láser activo Nd:YAG a 1,064 nm",
    swathCoverage: "Cobertura global de Marte (±87° latitud)",
    application: "Topografía global, elevación sobre el areoide, pendiente regional y perfiles altimétricos",
    layerCapabilities: ["Elevación", "Pendiente", "Relieve"],
    dataDistinction: "OBSERVED",
    validation: "OFICIAL",
    officialUrl: "https://pds-geosciences.wustl.edu/missions/mgs/mola.html",
    secondaryUrl: "https://ode.rsl.wustl.edu/mars/",
  },
  {
    id: "hirise",
    acronym: "HiRISE",
    name: "High Resolution Imaging Science Experiment",
    spacecraft: "Mars Reconnaissance Orbiter (MRO)",
    agency: "NASA / JPL / UArizona",
    spatialResolution: "0.25 a 0.30 m/píxel (30 cm/px) · DTMs estéreo de 0.5 a 1.0 m/píxel",
    spectralRange: "3 bandas: Rojo (550–850 nm), Azul-Verde (400–600 nm), NIR (800–1,000 nm)",
    swathCoverage: "Barrido >6 km en canal Rojo (>1.2 km en 3 colores); >103,000 imágenes (~3.5% de Marte)",
    application: "Imágenes de alta resolución sub-métrica de sitios de aterrizaje, dunas, rocas y trazas de rovers",
    layerCapabilities: ["Formaciones rocosas", "Dunas", "Cráteres"],
    dataDistinction: "OBSERVED",
    validation: "OFICIAL",
    officialUrl: "https://www.uahirise.org/specs/",
    secondaryUrl: "https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/",
  },
  {
    id: "ctx",
    acronym: "CTX",
    name: "Context Camera",
    spacecraft: "Mars Reconnaissance Orbiter (MRO)",
    agency: "NASA / JPL / MSSS",
    spatialResolution: "~6 m/píxel · DTMs estereoscópicos de ~20 m/píxel",
    spectralRange: "Pancromático ancho: 500 a 800 nm",
    swathCoverage: "Barrido de ~30 km de ancho · cobertura >94% de la superficie marciana",
    application: "Contexto geomorfológico regional continuo para cráteres, canales fluviales, deltas y abanicos",
    layerCapabilities: ["Cráteres", "Valles", "Dunas", "Relieve"],
    dataDistinction: "OBSERVED",
    validation: "OFICIAL",
    officialUrl: "https://pds-imaging.jpl.nasa.gov/portal/mro_mission.html",
    secondaryUrl: "https://ode.rsl.wustl.edu/mars/",
  },
  {
    id: "themis",
    acronym: "THEMIS",
    name: "Thermal Emission Imaging System",
    spacecraft: "2001 Mars Odyssey",
    agency: "NASA / JPL / Arizona State University",
    spatialResolution: "100 m/píxel en Infrarrojo Térmico (TIR) · 18 m/píxel en Visible/NIR",
    spectralRange: "10 bandas TIR (6.3–15.5 µm) + 5 bandas VIS/NIR (0.425–0.860 µm)",
    swathCoverage: "Cobertura global diurna y nocturna en infrarrojo térmico",
    application: "Inercia térmica, consolidación del terreno, abundancia de rocas y mapeo físico del regolito",
    layerCapabilities: ["Formaciones rocosas", "Unidades geológicas", "Dunas"],
    dataDistinction: "PROCESSED",
    validation: "OFICIAL",
    officialUrl: "https://themis.asu.edu/factsheet",
    secondaryUrl: "https://pds-geosciences.wustl.edu/missions/odyssey/themis.html",
  },
  {
    id: "crism",
    acronym: "CRISM",
    name: "Compact Reconnaissance Imaging Spectrometer for Mars",
    spacecraft: "Mars Reconnaissance Orbiter (MRO)",
    agency: "NASA / JHU Applied Physics Laboratory",
    spatialResolution: "18 a 36 m/píxel (modo hiperespectral dirigido) · 100 a 200 m/píxel (modo survey)",
    spectralRange: "544 canales hiperespectrales de 364 a 3,920 nm (6.55 nm/canal)",
    swathCoverage: "9.5 a 12 km de ancho en modo gimbal dirigido",
    application: "Identificación mineralógica de filosilicatos (arcillas), sulfatos hidratados, carbonatos y óxidos",
    layerCapabilities: ["Información mineralógica", "Unidades geológicas"],
    dataDistinction: "PROCESSED",
    validation: "OFICIAL",
    officialUrl: "https://pds-geosciences.wustl.edu/missions/mro/crism.htm",
    secondaryUrl: "https://ode.rsl.wustl.edu/mars/",
  },
  {
    id: "hrsc",
    acronym: "HRSC",
    name: "High Resolution Stereo Camera",
    spacecraft: "Mars Express (MEX)",
    agency: "ESA / DLR / FU Berlin",
    spatialResolution: "10 a 20 m/píxel (color/estéreo) · 2.5 m/píxel (canal SRC) · DTMs estéreo de 50 m/píxel",
    spectralRange: "9 canales CCD simultáneos (5 pancromáticos estéreo + 4 bandas color R/G/B/NIR)",
    swathCoverage: "Cobertura >97% de Marte a <100 m/px y >70% a 10–20 m/px en estéreo",
    application: "Modelos digitales de elevación estéreo regionales, volcanes, cañones y cuencas",
    layerCapabilities: ["Elevación", "Pendiente", "Montañas", "Valles"],
    dataDistinction: "PROCESSED",
    validation: "OFICIAL",
    officialUrl: "https://www.dlr.de/en/research-and-transfer/projects-and-missions/mars-express/hrsc-high-resolution-stereo-camera",
    secondaryUrl: "https://pds-imaging.jpl.nasa.gov/portal/mex_mission.html",
  },
  {
    id: "usgs",
    acronym: "USGS",
    name: "USGS Astrogeology Science Center & SIM 3292",
    spacecraft: "Multi-mission synthesis (Viking, MGS, Odyssey, MRO, MEX)",
    agency: "U.S. Geological Survey / NASA",
    spatialResolution: "Viking MDIM 2.1 (232 m/px) · HRSC-MOLA Blended DEM (200 m/px) · Mapa Geológico 1:20M",
    spectralRange: "Integración pancromática, color, térmica y altimétrica en marco IAU Mars 2000",
    swathCoverage: "Cobertura global estandarizada (COG, STAC ARD, PDS3/PDS4)",
    application: "Cartografía geológica global (Noéico, Hespérico, Amazónico), nomenclatura IAU y redes de control",
    layerCapabilities: ["Unidades geológicas", "Cráteres", "Montañas", "Valles"],
    dataDistinction: "INTERPRETED",
    validation: "OFICIAL",
    officialUrl: "https://astrogeology.usgs.gov/",
    secondaryUrl: "http://pubs.usgs.gov/sim/3292/pdf/sim3292_map.pdf",
  },
];

export const MARS_MISSIONS: MarsMissionRecord[] = [
  /* ========================================================================
   * 1. SOJOURNER — MARS PATHFINDER (Rover)
   * ======================================================================== */
  {
    id: "sojourner",
    name: "Sojourner",
    fullName: "Mars Pathfinder — Sojourner Microrover",
    agency: "NASA / JPL",
    category: "rover",
    status: "COMPLETED",
    launchDateUtc: "1996-12-04T06:58:07Z",
    landingDateUtc: "1997-07-04T16:56:55Z",
    endDateUtc: "1997-09-27T10:23:00Z",
    maxSol: 83,
    landingSiteName: "Carl Sagan Memorial Station",
    region: "Ares Vallis, Chryse Planitia",
    lat: 19.13,
    lon: -33.22,
    lon360: 326.78,
    elevationM: -3500,
    hasMobileTraverse: true,
    totalTraverseKm: 0.1,
    odometryNote: "~100 m recorridos en radio máximo de 12 m alrededor del lander (navegación a estima / dead reckoning).",
    color: "#fbbf24",
    terrainImage: "/mars-terrain-library/major_regions/chryse_planitia.png",
    regionalGlb: "/models/regions/05_Arabia_Meridiani.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Demostrar el sistema de entrada directa, descenso y aterrizaje con bolsas de aire (airbags).",
      "Operar el primer vehículo robótico con ruedas (rover) sobre la superficie de Marte.",
      "Analizar con APXS la geoquímica de rocas transportadas por las megainundaciones de Ares Vallis.",
    ],
    instruments: [
      { id: "mpf-apxs", acronym: "APXS", name: "Alpha Proton X-Ray Spectrometer", role: "Composición elemental de rocas y suelos", specs: "Despliegue frontal en Sojourner" },
      { id: "mpf-imp", acronym: "IMP", name: "Imager for Mars Pathfinder", role: "Cámara estereoscópica multiespectral en mástil del lander", specs: "12 filtros geológicos y 8 solares" },
      { id: "mpf-asimet", acronym: "ASI/MET", name: "Atmospheric Structure Instrument / Meteorology Package", role: "Perfil atmosférico de entrada y meteorología superficial", specs: "8.5 millones de mediciones de P, T y viento" },
    ],
    waypoints: [
      { sol: 1, dateUtc: "1997-07-04", lat: 19.1300, lon: -33.2200, lon360: 326.7800, elevationM: -3500.0, odometerKm: 0.0, label: "Carl Sagan Memorial Station", summary: "Aterrizaje con airbags en la llanura de inundación de Ares Vallis." },
      { sol: 2, dateUtc: "1997-07-05", lat: 19.13002, lon: -33.21998, lon360: 326.78002, elevationM: -3500.0, odometerKm: 0.002, label: "Rampa de despliegue", summary: "Sojourner desciende por la rampa sur hacia el suelo marciano." },
      { sol: 3, dateUtc: "1997-07-06", lat: 19.13005, lon: -33.21995, lon360: 326.78005, elevationM: -3499.9, odometerKm: 0.006, label: "Barnacle Bill", summary: "Integración APXS de 10 horas sobre roca rica en sílice (tipo andesita)." },
      { sol: 10, dateUtc: "1997-07-14", lat: 19.13009, lon: -33.21990, lon360: 326.78010, elevationM: -3499.8, odometerKm: 0.018, label: "Roca Yogi", summary: "Análisis APXS de bloque basáltico primitivo recubierto de polvo." },
      { sol: 18, dateUtc: "1997-07-22", lat: 19.13004, lon: -33.21996, lon360: 326.78004, elevationM: -3500.1, odometerKm: 0.032, label: "Scooby-Doo", summary: "Suelo indurado / depósito sedimentario cementado resistente al raspado de ruedas." },
      { sol: 38, dateUtc: "1997-08-12", lat: 19.12995, lon: -33.22006, lon360: 326.77994, elevationM: -3500.2, odometerKm: 0.061, label: "Moe & Mermaid Dune", summary: "Estudio de ventifactos tallados por abrasión eólica." },
      { sol: 76, dateUtc: "1997-09-20", lat: 19.12989, lon: -33.22012, lon360: 326.77988, elevationM: -3500.4, odometerKm: 0.096, label: "Rock Garden", summary: "Exploración del jardín de rocas imbricadas por paleocorrientes y dunas semilunares." },
      { sol: 83, dateUtc: "1997-09-27", lat: 19.12988, lon: -33.22014, lon360: 326.77986, elevationM: -3500.4, odometerKm: 0.100, label: "Fin de contacto", summary: "Última transmisión recibida de la estación base tras 83 soles." },
    ],
    discoveries: [
      {
        id: "disc-soj-barnacle-bill",
        missionId: "sojourner",
        title: "Composición andesítica rica en sílice en Barnacle Bill",
        kind: "chemical",
        sol: 3,
        dateUtc: "1997-07-06",
        locationName: "Barnacle Bill, Ares Vallis",
        lat: 19.13005,
        lon: -33.21995,
        lon360: 326.78005,
        elevationM: -3500,
        instrument: "APXS",
        description: "Primer espectro químico in situ de una roca marciana por un rover, revelando un elevado contenido de sílice comparable a las andesitas terrestres.",
        geologicalContext: "Bloque alóctono depositado por las inundaciones catastróficas del canal de salida Ares Vallis (transición Hespérico-Amazónico).",
        imageUrl: "/mars-terrain-library/major_regions/chryse_planitia.png",
        publicationTitle: "Rieder et al. (1997), Determination of the chemical composition of Martian soil and rocks: The mineralized Barnacle Bill, Science",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/mpf/index.htm",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — Mars Pathfinder",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/mpf/index.htm",
          acquisitionDate: "1997-07-06",
          instrument: "Sojourner APXS",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Contacto puntual (~50 mm diámetro de haz)",
          knownPrecision: "±0.05° posición de aterrizaje; ±0.1 m relativo al lander",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-soj-rock-garden",
        missionId: "sojourner",
        title: "Cantos imbricados y conglomerados fluviales en Rock Garden",
        kind: "geology",
        sol: 76,
        dateUtc: "1997-09-20",
        locationName: "Rock Garden, Carl Sagan Memorial Station",
        lat: 19.12989,
        lon: -33.22012,
        lon360: 326.77988,
        elevationM: -3500,
        instrument: "IMP + Rover Cameras",
        description: "Identificación de bloques subredondeados e imbricados en dirección de la corriente junto con dunas barchan activas.",
        geologicalContext: "Depósitos de megainundación de Ares Vallis retrabajados por procesos eólicos modernos.",
        imageUrl: "/mars-terrain-library/major_regions/chryse_planitia.png",
        publicationTitle: "Golombek et al. (1997), Overview of the Mars Pathfinder Mission and Assessment of Landing Site Predictions, Science",
        sourceUrl: "https://pds-imaging.jpl.nasa.gov/portal/mpf_mission.html",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Imaging Node — Mars Pathfinder",
          sourceUrl: "https://pds-imaging.jpl.nasa.gov/portal/mpf_mission.html",
          acquisitionDate: "1997-09-20",
          instrument: "IMP / Sojourner Cameras",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Milimétrica a centimétrica en campo cercano",
          knownPrecision: "±0.2 m en marco local del lander",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Mars Pathfinder Mission Page", url: "https://science.nasa.gov/mission/mars-pathfinder/", validation: "OFICIAL" },
      { label: "PDS Geosciences Node — MPF Archive", url: "https://pds-geosciences.wustl.edu/missions/mpf/index.htm", validation: "OFICIAL" },
      { label: "azmth Traverse Dataset (sojourner.json)", url: "https://azmth.space/mars/data", validation: "DERIVADO" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA PDS Geosciences & Imaging Nodes",
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/mpf/index.htm",
      acquisitionDate: "1997-07-04 / 1997-09-27",
      instrument: "MPF Radio Science / IMP / APXS",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "4,800 vértices de navegación a estima (sol 1–78)",
      knownPrecision: "±100 m global; ±0.1 m local",
      license: "Public Domain (NASA) / CC BY 4.0 (azmth compilation)",
    },
  },

  /* ========================================================================
   * 2. SPIRIT — MARS EXPLORATION ROVER A (Rover)
   * ======================================================================== */
  {
    id: "spirit",
    name: "Spirit (MER-A)",
    fullName: "Mars Exploration Rover — Spirit (MER-A)",
    agency: "NASA / JPL",
    category: "rover",
    status: "COMPLETED",
    launchDateUtc: "2003-06-10T17:58:47Z",
    landingDateUtc: "2004-01-04T04:35:00Z",
    endDateUtc: "2010-03-22T00:00:00Z",
    maxSol: 2210,
    landingSiteName: "Columbia Memorial Station",
    region: "Cráter Gusev y Columbia Hills",
    lat: -14.5684,
    lon: 175.4726,
    lon360: 175.4726,
    elevationM: -1900,
    hasMobileTraverse: true,
    totalTraverseKm: 7.73,
    odometryNote: "7.73 km por odometría de rueda (7.08 km de traza cartográfica sobre terreno en Analyst's Notebook).",
    color: "#fb923c",
    terrainImage: "/mars-terrain-library/mission_sites/spirit_gusev_crater.png",
    regionalGlb: "/models/regions/04_Elysium_Utopia.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Caracterizar las rocas y suelos del cráter Gusev para buscar evidencias de acción pasada de agua líquida.",
      "Ascender las Columbia Hills para estudiar unidades estratigráficas pre-volcánicas y depósitos hidrotermales.",
    ],
    instruments: [
      { id: "mer-pancam", acronym: "Pancam", name: "Panoramic Camera", role: "Imagen estereoscópica multiespectral de alta resolución", specs: "1024×1024 px, 14 filtros (400–1100 nm)" },
      { id: "mer-minites", acronym: "Mini-TES", name: "Miniature Thermal Emission Spectrometer", role: "Mineralogía infrarroja a distancia", specs: "5 a 29 µm" },
      { id: "mer-mb", acronym: "MB", name: "Mössbauer Spectrometer", role: "Mineralogía de fases con hierro y estados de oxidación", specs: "Fuente 57Co en brazo IDD" },
      { id: "mer-apxs", acronym: "APXS", name: "Alpha Particle X-Ray Spectrometer", role: "Abundancia elemental de elementos mayores y menores", specs: "Desplegado en brazo robótico IDD" },
      { id: "mer-mi-rat", acronym: "MI + RAT", name: "Microscopic Imager & Rock Abrasion Tool", role: "Textura a 30 µm/px y abrasión de corteza alterada (45 mm)", specs: "Montados en torreta IDD" },
    ],
    waypoints: [
      { sol: 1, dateUtc: "2004-01-04", lat: -14.5684, lon: 175.4726, lon360: 175.4726, elevationM: -1900, odometerKm: 0.0, label: "Columbia Memorial Station", summary: "Aterrizaje sobre las llanuras basálticas Hespéricas del cráter Gusev." },
      { sol: 33, dateUtc: "2004-02-06", lat: -14.5681, lon: 175.4729, lon360: 175.4729, elevationM: -1899, odometerKm: 0.02, label: "Roca Adirondack", summary: "Primera abrasión RAT en Marte sobre basalto olivínico fresco." },
      { sol: 66, dateUtc: "2004-03-11", lat: -14.5651, lon: 175.4765, lon360: 175.4765, elevationM: -1893, odometerKm: 0.37, label: "Cráter Bonneville", summary: "Inspección del borde de un cráter de impacto de 210 m excavado en regolito basáltico." },
      { sol: 156, dateUtc: "2004-06-11", lat: -14.5820, lon: 175.5050, lon360: 175.5050, elevationM: -1888, odometerKm: 3.12, label: "West Spur (Columbia Hills)", summary: "Llegada a la base de Columbia Hills; hallazgo de goethita en Clovis y Pot of Gold." },
      { sol: 619, dateUtc: "2005-08-21", lat: -14.5912, lon: 175.5240, lon360: 175.5240, elevationM: -1818, odometerKm: 4.81, label: "Cumbre de Husband Hill", summary: "Spirit alcanza la cima de Husband Hill (+82 m sobre la llanura de aterrizaje)." },
      { sol: 744, dateUtc: "2006-02-07", lat: -14.5975, lon: 175.5262, lon360: 175.5262, elevationM: -1858, odometerKm: 6.89, label: "Home Plate", summary: "Llegada a la meseta volcanoclástica estratificada de 80 m de diámetro." },
      { sol: 1150, dateUtc: "2007-03-30", lat: -14.5980, lon: 175.5270, lon360: 175.5270, elevationM: -1859, odometerKm: 7.12, label: "Gertrude Weise (Valle de Sílice)", summary: "Suelo expuesto por la rueda bloqueada con ~90% de sílice opalina hidrotermal." },
      { sol: 2210, dateUtc: "2010-03-22", lat: -14.5994, lon: 175.5218, lon360: 175.5218, elevationM: -1861, odometerKm: 7.73, label: "Troy (Posición Final)", summary: "Atrapado en arenas ricas en sulfatos férricos al oeste de Home Plate; última señal." },
    ],
    discoveries: [
      {
        id: "disc-spirit-silica",
        missionId: "spirit",
        title: "Depósito de ~90% de sílice opalina hidrotermal en Gertrude Weise (Home Plate)",
        kind: "chemical",
        sol: 1150,
        dateUtc: "2007-05-01",
        locationName: "Home Plate (Eastern Valley), Columbia Hills",
        lat: -14.5980,
        lon: 175.5270,
        lon360: 175.5270,
        elevationM: -1859,
        instrument: "APXS + Mini-TES",
        description: "La trinchera excavada involuntariamente por la rueda derecha inmovilizada de Spirit dejó al descubierto sílice opalina casi pura (~90% SiO2), evidencia de antiguas fumarolas ácidas o manantiales hidrotermales.",
        geologicalContext: "Secuencia volcanoclástica e hidrovolcánica de Home Plate en la cuenca interna de Columbia Hills.",
        imageUrl: "/mars-terrain-library/mission_sites/spirit_gusev_crater.png",
        publicationTitle: "Squyres et al. (2008), Detection of Silica-Rich Deposits on Mars, Science 320(5879)",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/mer/index.htm",
        metadata: {
          validation: "OFICIAL",
          sourceName: "MER Analyst's Notebook / NASA PDS Geosciences Node",
          sourceUrl: "https://an.rsl.wustl.edu/",
          acquisitionDate: "2007-05-01",
          instrument: "MER-A APXS & Mini-TES",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Medición in situ sobre trinchera de rueda",
          knownPrecision: "±1 m localización orbital HiRISE",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-spirit-carbonates",
        missionId: "spirit",
        title: "Carbonatos de magnesio y hierro en el afloramiento Comanche",
        kind: "rock",
        sol: 700,
        dateUtc: "2005-12-20",
        locationName: "Comanche Spur, Columbia Hills",
        lat: -14.5945,
        lon: 175.5252,
        lon360: 175.5252,
        elevationM: -1842,
        instrument: "Mössbauer + Mini-TES + APXS",
        description: "Detección de entre 16% y 34% de carbonatos de Mg-Fe precipitados a partir de soluciones hidrotermales de pH cercano a neutro.",
        geologicalContext: "Unidad rica en olivino y carbonato entre Husband Hill y Home Plate.",
        imageUrl: "/mars-terrain-library/craters_basins/gusev_crater.png",
        publicationTitle: "Morris et al. (2010), Identification of Carbonate-Rich Outcrops on Mars by the Spirit Rover, Science",
        sourceUrl: "https://an.rsl.wustl.edu/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — MER Archive",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/mer/index.htm",
          acquisitionDate: "2005-12-20",
          instrument: "Mössbauer + Mini-TES + APXS",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Contacto en afloramiento",
          knownPrecision: "±1 m",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Spirit (MER-A) Official Page", url: "https://science.nasa.gov/mission/mer-spirit/", validation: "OFICIAL" },
      { label: "MER Analyst's Notebook (WashU PDS)", url: "https://an.rsl.wustl.edu/", validation: "OFICIAL" },
      { label: "azmth Traverse Dataset (spirit.json)", url: "https://azmth.space/mars/data", validation: "DERIVADO" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA PDS Geosciences Node / MER Analyst's Notebook",
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/mer/index.htm",
      acquisitionDate: "2004-01-04 / 2010-03-22",
      instrument: "MER Navigation & Athena Payload",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "7,871 vértices de trayectoria (Sol 2 a Sol 2,209)",
      knownPrecision: "±1 m geolocalización sobre ortomosaico HiRISE",
      license: "Public Domain (NASA) / CC BY 4.0",
    },
  },

  /* ========================================================================
   * 3. OPPORTUNITY — MARS EXPLORATION ROVER B (Rover)
   * ======================================================================== */
  {
    id: "opportunity",
    name: "Opportunity (MER-B)",
    fullName: "Mars Exploration Rover — Opportunity (MER-B)",
    agency: "NASA / JPL",
    category: "rover",
    status: "COMPLETED",
    launchDateUtc: "2003-07-07T03:18:15Z",
    landingDateUtc: "2004-01-25T05:05:00Z",
    endDateUtc: "2018-06-10T00:00:00Z",
    maxSol: 5111,
    landingSiteName: "Challenger Memorial Station (Eagle Crater)",
    region: "Meridiani Planum a Cráter Endeavour",
    lat: -1.9462,
    lon: -5.5266,
    lon360: 354.4734,
    elevationM: -1400,
    hasMobileTraverse: true,
    totalTraverseKm: 45.16,
    odometryNote: "45.16 km (28.06 millas) recorridos entre los cráteres Eagle, Endurance, Victoria y Endeavour.",
    color: "#eab308",
    terrainImage: "/mars-terrain-library/mission_sites/opportunity_endeavour_crater.png",
    regionalGlb: "/models/regions/05_Arabia_Meridiani.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Investigar el origen de la extensa unidad de hematita cristalina gris de Meridiani Planum.",
      "Reconstruir la evolución de los ambientes acuosos desde dunas evaporíticas ácidas hasta arcillas neutras noéicas en el borde del cráter Endeavour.",
    ],
    instruments: [
      { id: "merb-pancam", acronym: "Pancam", name: "Panoramic Camera", role: "Estereoscopía multiespectral y fotogrametría de borde de cráteres", specs: "1024×1024 px, 14 filtros" },
      { id: "merb-mb", acronym: "MB", name: "Mössbauer Spectrometer", role: "Identificación de jarosita y hematita en concreciones", specs: "Espectroscopía gamma de Fe" },
      { id: "merb-apxs", acronym: "APXS", name: "Alpha Particle X-Ray Spectrometer", role: "Geoquímica de sulfatos, arcillas y meteoritos", specs: "Torreta IDD" },
      { id: "merb-mi-rat", acronym: "MI + RAT", name: "Microscopic Imager & Rock Abrasion Tool", role: "Microtexturas sedimentarias y laminación cruzada festoneada", specs: "Resolución 30 µm/px" },
    ],
    waypoints: [
      { sol: 1, dateUtc: "2004-01-25", lat: -1.9462, lon: -5.5266, lon360: 354.4734, elevationM: -1400, odometerKm: 0.0, label: "Cráter Eagle (Aterrizaje)", summary: "Aterrizaje directo frente al primer afloramiento sedimentario observado en Marte; hallazgo de 'blueberries' de hematita." },
      { sol: 95, dateUtc: "2004-04-30", lat: -1.9482, lon: -5.5180, lon360: 354.4820, elevationM: -1398, odometerKm: 0.81, label: "Cráter Endurance", summary: "Descenso al interior de un cráter de 130 m para perfilar 7 m de la formación evaporítica Burns." },
      { sol: 325, dateUtc: "2004-12-22", lat: -1.9502, lon: -5.5175, lon360: 354.4825, elevationM: -1399, odometerKm: 2.1, label: "Heat Shield Rock", summary: "Primer meteorito metálico de hierro-níquel (Meridiani Planum) identificado en otro planeta." },
      { sol: 951, dateUtc: "2006-09-26", lat: -2.0500, lon: -5.5000, lon360: 354.5000, elevationM: -1392, odometerKm: 9.28, label: "Cráter Victoria (Duck Bay)", summary: "Llegada al cráter Victoria (750 m de diámetro); estudio de paleodunas diagenéticas en Cape Verde y descenso al cráter." },
      { sol: 2681, dateUtc: "2011-08-09", lat: -2.2800, lon: -5.2300, lon360: 354.7700, elevationM: -1415, odometerKm: 33.49, label: "Cape York (Cráter Endeavour)", summary: "Llegada al borde occidental del cráter Noéico Endeavour (22 km de diámetro); hallazgo de la vena de yeso Homestake." },
      { sol: 3060, dateUtc: "2012-09-01", lat: -2.2292, lon: -5.3507, lon360: 354.6493, elevationM: -1395, odometerKm: 35.3, label: "Matijevic Hill", summary: "Detección de arcillas esmectitas ricas en Al/Fe formadas en aguas antiguas de pH casi neutro." },
      { sol: 5111, dateUtc: "2018-06-10", lat: -2.2845, lon: -5.2312, lon360: 354.7688, elevationM: -1382, odometerKm: 45.16, label: "Perseverance Valley (Fin)", summary: "Última comunicación durante la tormenta global de polvo de 2018 (tau > 10.8) tras 45.16 km." },
    ],
    discoveries: [
      {
        id: "disc-opp-blueberries",
        missionId: "opportunity",
        title: "Concreciones esféricas de hematita ('Blueberries') y jarosita en Eagle Crater",
        kind: "rock",
        sol: 28,
        dateUtc: "2004-02-22",
        locationName: "Outcrop Opportunity Ledge, Eagle Crater",
        lat: -1.9462,
        lon: -5.5266,
        lon360: 354.4734,
        elevationM: -1400,
        instrument: "Mössbauer + MI + APXS",
        description: "Confirmación de esférulas diagenéticas de hematita precipitadas por aguas subterráneas junto con sulfato de hierro hidratado (jarosita) y laminación festoneada subacuática.",
        geologicalContext: "Areniscas evaporíticas ricas en sulfatos de la formación Burns (Hespérico).",
        imageUrl: "/mars-terrain-library/mission_sites/opportunity_endeavour_crater.png",
        publicationTitle: "Squyres et al. (2004), In Situ Evidence for an Ancient Aqueous Environment at Meridiani Planum, Mars, Science",
        sourceUrl: "https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — MER-B",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/mer/index.htm",
          acquisitionDate: "2004-02-22",
          instrument: "Mössbauer / Microscopic Imager / APXS",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "30 µm/px (MI)",
          knownPrecision: "±1 m",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-opp-matijevic",
        missionId: "opportunity",
        title: "Filosilicatos (esmectitas) de agua neutra y vena de yeso Homestake en Endeavour",
        kind: "chemical",
        sol: 3060,
        dateUtc: "2012-09-01",
        locationName: "Matijevic Hill, Cape York, Endeavour Crater",
        lat: -2.22923,
        lon: -5.35068,
        lon360: 354.64932,
        elevationM: -1395,
        instrument: "APXS + Pancam",
        description: "Análisis de la matriz fina de Whitewater Lake y la vena de sulfato de calcio puro (yeso) Homestake, documentando un ambiente acuoso Noéico más benigno previo a los sulfatos ácidos.",
        geologicalContext: "Basamento Noéico del anillo del cráter de impacto Endeavour (22 km).",
        imageUrl: "/mars-terrain-library/craters_basins/endeavour_crater.png",
        publicationTitle: "Arvidson et al. (2014), Ancient Aqueous Environments at Endeavour Crater, Mars, Science 343",
        sourceUrl: "https://an.rsl.wustl.edu/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "MER Analyst's Notebook / NASA PDS",
          sourceUrl: "https://an.rsl.wustl.edu/",
          acquisitionDate: "2012-09-01",
          instrument: "APXS / Pancam",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Contacto in situ",
          knownPrecision: "±1 m",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA MER Spirit & Opportunity Portal", url: "https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/", validation: "OFICIAL" },
      { label: "MER Analyst's Notebook", url: "https://an.rsl.wustl.edu/", validation: "OFICIAL" },
      { label: "azmth Traverse Dataset (opportunity.json)", url: "https://azmth.space/mars/data", validation: "DERIVADO" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA PDS Geosciences Node / MER Analyst's Notebook",
      sourceUrl: "https://an.rsl.wustl.edu/",
      acquisitionDate: "2004-01-25 / 2018-06-10",
      instrument: "MER-B Navigation & Athena Payload",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "19,721 vértices de trayectoria (Sol 1 a Sol 5,111)",
      knownPrecision: "±1 m sobre ortoimagen HiRISE",
      license: "Public Domain (NASA) / CC BY 4.0",
    },
  },

  /* ========================================================================
   * 4. CURIOSITY — MARS SCIENCE LABORATORY (Rover)
   * ======================================================================== */
  {
    id: "curiosity",
    name: "Curiosity (MSL)",
    fullName: "Mars Science Laboratory — Curiosity Rover",
    agency: "NASA / JPL",
    category: "rover",
    status: "ACTIVE",
    launchDateUtc: "2011-11-26T15:02:00Z",
    landingDateUtc: "2012-08-06T05:17:57Z",
    endDateUtc: null,
    maxSol: 5056,
    landingSiteName: "Bradbury Landing",
    region: "Cráter Gale y Aeolis Mons (Mount Sharp)",
    lat: -4.5895,
    lon: 137.4417,
    lon360: 137.4417,
    elevationM: -4501,
    hasMobileTraverse: true,
    totalTraverseKm: 38.48,
    odometryNote: "38.48 km acumulados al Sol 5,045 (>1,000 m de ascenso vertical sobre Aeolis Mons / Mount Sharp).",
    color: "#a78bfa",
    terrainImage: "/mars-terrain-library/mission_sites/curiosity_gale_crater.png",
    regionalGlb: "/models/regions/04_Elysium_Utopia.glb",
    reconstructionTypes: [
      "TYPE_A_PHOTOGRAMMETRY",
      "TYPE_B_DEM",
      "TYPE_C_MODEL",
      "TYPE_D_ORBITAL_DRAPE",
    ],
    accessMarsSiteIds: [
      "landing_site",
      "pahrump_hills",
      "marias_pass",
      "murray_buttes",
      "live_site",
    ],
    objectives: [
      "Determinar si el cráter Gale ofreció condiciones ambientales favorables para la vida microbiana.",
      "Caracterizar la estratigrafía de 5 km de espesor de Aeolis Mons (transición de arcillas a sulfatos).",
      "Evaluar los ciclos del agua, carbono y azufre y medir el espectro de radiación superficial (RAD) para futuras misiones tripuladas.",
    ],
    instruments: [
      { id: "msl-mastcam", acronym: "Mastcam", name: "Mast Camera", role: "Mosaicos estereoscópicos en color verdadero y fotogrametría 3D", specs: "34 mm (M-34) y 100 mm (M-100)" },
      { id: "msl-chemcam", acronym: "ChemCam", name: "Chemistry and Camera Complex", role: "Espectroscopía de ablación láser LIBS y microimagen remota RMI", specs: "Alcance hasta 7 m" },
      { id: "msl-chemin", acronym: "CheMin", name: "Chemistry and Mineralogy", role: "Difracción y fluorescencia de rayos X en muestras perforadas", specs: "Identificación mineralógica cuantitativa" },
      { id: "msl-sam", acronym: "SAM", name: "Sample Analysis at Mars", role: "GCMS, espectrómetro de masas cuadrupolar y láser TLS", specs: "Detección de orgánicos, isótopos y metano" },
      { id: "msl-mahli-apxs", acronym: "MAHLI + APXS", name: "Mars Hand Lens Imager & APXS", role: "Microfotografía a 14 µm/px y composición elemental en brazo robótico", specs: "Torreta de 2.1 m" },
      { id: "msl-rems-rad-dan", acronym: "REMS + RAD + DAN", name: "Rover Environmental Monitoring, Radiation & Neutron Albedo", role: "Meteorología continua, dosis GCR/SEP y agua subsuperficial", specs: "Monitoreo ambiental Sol a Sol" },
    ],
    waypoints: [
      { sol: 1, dateUtc: "2012-08-06", lat: -4.5895, lon: 137.4417, lon360: 137.4417, elevationM: -4501, odometerKm: 0.0, label: "Bradbury Landing", summary: "Aterrizaje con Sky Crane en Aeolis Palus; escena fotogramétrica Access Mars #1.", accessMarsSceneId: "landing_site" },
      { sol: 182, dateUtc: "2013-02-09", lat: -4.5880, lon: 137.4445, lon360: 137.4445, elevationM: -4519, odometerKm: 0.72, label: "Yellowknife Bay (John Klein)", summary: "Primera perforación en lutitas lacustres de la formación Sheepbed; confirmación de antiguo lago habitable de pH neutro." },
      { sol: 753, dateUtc: "2014-09-18", lat: -4.6712, lon: 137.4021, lon360: 137.4021, elevationM: -4442, odometerKm: 9.7, label: "Pahrump Hills", summary: "Afloramientos basales de la formación Murray en Mount Sharp; escena fotogramétrica Access Mars #2.", accessMarsSceneId: "pahrump_hills" },
      { sol: 992, dateUtc: "2015-05-22", lat: -4.6778, lon: 137.3974, lon360: 137.3974, elevationM: -4428, odometerKm: 10.8, label: "Marias Pass (Buckskin)", summary: "Contacto discordante arenisca/lutita y hallazgo de tridimita volcánica; escena fotogramétrica Access Mars #3.", accessMarsSceneId: "marias_pass" },
      { sol: 1421, dateUtc: "2016-08-05", lat: -4.7031, lon: 137.3912, lon360: 137.3912, elevationM: -4404, odometerKm: 14.1, label: "Murray Buttes", summary: "Mesetas de arenisca eólica con estratificación cruzada (formación Stimson); escena Access Mars #4.", accessMarsSceneId: "murray_buttes" },
      { sol: 1834, dateUtc: "2017-10-03", lat: -4.7215, lon: 137.3948, lon360: 137.3948, elevationM: -4175, odometerKm: 17.5, label: "Vera Rubin Ridge", summary: "Ascenso de la cresta rica en hematita diagenética; escena fotogramétrica Access Mars #5.", accessMarsSceneId: "live_site" },
      { sol: 2400, dateUtc: "2019-05-09", lat: -4.7289, lon: 137.3964, lon360: 137.3964, elevationM: -4135, odometerKm: 20.6, label: "Glen Torridon (Clay-Bearing Unit)", summary: "Máxima abundancia de arcillas esmectitas (~30%) y compuestos orgánicos sulfurados/aromáticos." },
      { sol: 3800, dateUtc: "2023-04-16", lat: -4.7820, lon: 137.3860, lon360: 137.3860, elevationM: -3790, odometerKm: 30.1, label: "Marker Band & Gediz Vallis", summary: "Estructuras de rizaduras de oleaje simétricas y canal de escombros ricos en azufre elemental puro." },
      { sol: 4711, dateUtc: "2025-11-06", lat: -4.8057, lon: 137.3802, lon360: 137.3802, elevationM: -3605, odometerKm: 36.2, label: "Mount Sharp Boxwork Unit", summary: "Exploración de la red poligonal de crestas diagenéticas (Boxwork) y perforaciones Valle de la Luna y Nevado Sajama." },
      { sol: 5045, dateUtc: "2026-10-15", lat: -4.8190, lon: 137.3765, lon360: 137.3765, elevationM: -3485, odometerKm: 38.48, label: "Posición Operativa (Sol 5045)", summary: "Ascenso continuado por encima de +1,015 m respecto a Bradbury Landing." },
    ],
    discoveries: [
      {
        id: "disc-msl-yellowknife",
        missionId: "curiosity",
        title: "Antiguo sistema lacustre habitable de agua dulce en Yellowknife Bay",
        kind: "drill",
        sol: 182,
        dateUtc: "2013-02-09",
        locationName: "John Klein & Cumberland Drill Holes, Yellowknife Bay",
        lat: -4.5880,
        lon: 137.4445,
        lon360: 137.4445,
        elevationM: -4519,
        instrument: "CheMin + SAM + MAHLI",
        description: "Las primeras perforaciones (John Klein y Cumberland) identificaron ~20% de arcillas esmectitas trioctaédricas, magnetita, sulfatos de calcio, pH neutro, baja salinidad y elementos CHNOPS biodisponibles.",
        geologicalContext: "Lutitas lacustres de grano fino de la formación Sheepbed en Aeolis Palus.",
        imageUrl: "/eva/cards/ph2.jpg",
        publicationTitle: "Grotzinger et al. (2014), A Habitable Fluvio-Lacustrine Environment at Yellowknife Bay, Gale Crater, Mars, Science",
        sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8981195/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — MSL",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/msl/",
          acquisitionDate: "2013-02-09",
          instrument: "CheMin / SAM",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Difracción de rayos X y GCMS en polvo perforado",
          knownPrecision: "±0.5 m",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-msl-buckskin",
        missionId: "curiosity",
        title: "Tridimita de alta temperatura y ~80% de sílice en Buckskin (Marias Pass)",
        kind: "drill",
        sol: 1060,
        dateUtc: "2015-07-30",
        locationName: "Buckskin Drill Target, Marias Pass",
        lat: -4.6778,
        lon: 137.3974,
        lon360: 137.3974,
        elevationM: -4428,
        instrument: "CheMin + APXS + ChemCam",
        description: "Detección inesperada de tridimita cristalina (polimorfo de SiO2 de alta temperatura y baja presión), evidenciando vulcanismo silícico evolucionado en el Marte primitivo.",
        geologicalContext: "Zona de contacto entre la formación Murray (lacustre) y la formación Stimson (eólica).",
        imageUrl: "/eva/cards/mp2.jpg",
        publicationTitle: "Morris et al. (2016), Silicic volcanism on Mars evidenced by tridymite detection in high-SiO2 sedimentary rock at Gale crater, PNAS",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/msl/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "MSL Analyst's Notebook / Access Mars Marias Pass",
          sourceUrl: "https://an.rsl.wustl.edu/",
          acquisitionDate: "2015-07-30",
          instrument: "CheMin XRD",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Muestra perforada #7",
          knownPrecision: "±0.5 m",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-msl-boxwork",
        missionId: "curiosity",
        title: "Red de crestas diagenéticas Boxwork y perforaciones Valle de la Luna / Nevado Sajama",
        kind: "drill",
        sol: 4718,
        dateUtc: "2025-11-13",
        locationName: "Mount Sharp Boxwork Unit, Gale Crater",
        lat: -4.8057,
        lon: 137.3802,
        lon360: 137.3802,
        elevationM: -3605,
        instrument: "Mastcam + ChemCam + SAM + CheMin",
        description: "Muestreo pareado de fracturas mineralizadas (Valle de la Luna y Nevado Sajama) formadas por circulación de aguas subterráneas tardías a través de la unidad de sulfatos de Mount Sharp.",
        geologicalContext: "Red de fracturas cementadas de 10–20 km de extensión en las laderas medias de Aeolis Mons.",
        imageUrl: "/mars-terrain-library/craters_basins/gale_crater.png",
        publicationTitle: "NASA JPL MSL Mission Updates — Boxwork Campaign (Sols 4530–4805)",
        sourceUrl: "https://science.nasa.gov/mission/msl-curiosity/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA/JPL-Caltech MMGIS & MSL Analyst's Notebook",
          sourceUrl: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json",
          acquisitionDate: "2025-11-13",
          instrument: "MSL Drill / SAM / CheMin",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Waypoints MMGIS en metros",
          knownPrecision: "±0.5 m",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Curiosity (MSL) Official Page", url: "https://science.nasa.gov/mission/msl-curiosity/", validation: "OFICIAL" },
      { label: "NASA/JPL MMGIS MSL Traverse JSON", url: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json", validation: "OFICIAL" },
      { label: "Access Mars (Google Creative Lab / NASA JPL)", url: "https://github.com/googlecreativelab/access-mars", validation: "OFICIAL" },
      { label: "azmth Traverse Dataset (curiosity.json)", url: "https://azmth.space/mars/data", validation: "DERIVADO" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA/JPL-Caltech MMGIS & PDS Geosciences Node",
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/msl/",
      acquisitionDate: "2012-08-06 / Present",
      instrument: "MSL Navcam, Mastcam, Odometry & MMGIS Localization",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "21,990 vértices de trayectoria + 5 escenas 3D fotogramétricas",
      knownPrecision: "±0.2 m en escenas fotogramétricas; ±0.5 m en trayectoria MMGIS",
      license: "Public Domain (NASA) / Apache-2.0 (Access Mars)",
    },
  },

  /* ========================================================================
   * 5. PERSEVERANCE — MARS 2020 (Rover)
   * ======================================================================== */
  {
    id: "perseverance",
    name: "Perseverance (Mars 2020)",
    fullName: "Mars 2020 — Perseverance Rover",
    agency: "NASA / JPL",
    category: "rover",
    status: "ACTIVE",
    launchDateUtc: "2020-07-30T11:50:00Z",
    landingDateUtc: "2021-02-18T20:55:00Z",
    endDateUtc: null,
    maxSol: 2022,
    landingSiteName: "Octavia E. Butler Landing",
    region: "Cráter Jezero, Delta Occidental y Neretva Vallis",
    lat: 18.4447,
    lon: 77.4508,
    lon360: 77.4508,
    elevationM: -2570,
    hasMobileTraverse: true,
    totalTraverseKm: 45.25,
    odometryNote: "45.25 km al Sol 2,022 (récord histórico de distancia conducida en otro planeta superado en el Sol 2,006 con 45.22 km).",
    color: "#38bdf8",
    terrainImage: "/mars-terrain-library/mission_sites/perseverance_ingenuity.png",
    regionalGlb: "/models/regions/03_Hellas_Isidis.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Explorar el sistema lacustre-deltaico antiguo del cráter Jezero y buscar biofirmas microbianas preservadas.",
      "Recolectar, documentar y sellar muestras de núcleos de roca y regolito en tubos de titanio (33 de 43 tubos sellados, incluyendo el depósito Three Forks).",
      "Demostrar la producción in situ de oxígeno (MOXIE) a partir del CO2 atmosférico marciano.",
    ],
    instruments: [
      { id: "m20-mastcamz", acronym: "Mastcam-Z", name: "Mastcam-Z Zoomable Panoramic Cameras", role: "Estereoscopía con zoom óptico 4:1 y filtros multiespectrales", specs: "26 a 110 mm focal" },
      { id: "m20-supercam", acronym: "SuperCam", name: "SuperCam Laser Micro-Imager & Spectrometer", role: "LIBS, espectroscopía Raman, VISIR y micrófono acústico", specs: "Análisis químico y mineralógico hasta 7–12 m" },
      { id: "m20-pixl", acronym: "PIXL", name: "Planetary Instrument for X-ray Lithochemistry", role: "Fluorescencia de rayos X a escala submilimétrica en brazo robótico", specs: "Haz de 120 µm para mapeo elemental fino" },
      { id: "m20-sherloc", acronym: "SHERLOC + WATSON", name: "Scanning Habitable Environments with Raman & Luminescence", role: "Detección de compuestos orgánicos y minerales acuosos en UV profundo", specs: "Láser UV 248.6 nm + macrocámara WATSON" },
      { id: "m20-rimfax", acronym: "RIMFAX", name: "Radar Imager for Mars' Subsurface Experiment", role: "Radar de penetración terrestre (GPR) de 150–1200 MHz", specs: "Perfil estratigráfico hasta >20 m de profundidad" },
      { id: "m20-moxie-meda", acronym: "MOXIE + MEDA", name: "Mars Oxygen ISRU Experiment & Environmental Analyzer", role: "Electrólisis de CO2 (122 g de O2 producidos) y meteorología completa", specs: "16 campañas exitosas de generación de O2" },
    ],
    waypoints: [
      { sol: 1, dateUtc: "2021-02-18", lat: 18.4447, lon: 77.4508, lon360: 77.4508, elevationM: -2570, odometerKm: 0.0, label: "Octavia E. Butler Landing", summary: "Aterrizaje guiado por TRN entre la unidad ígnea Máaz y Séítah." },
      { sol: 190, dateUtc: "2021-09-01", lat: 18.4310, lon: 77.4420, lon360: 77.4420, elevationM: -2578, odometerKm: 2.18, label: "Citadelle (Rochette — Montdenier)", summary: "Primer núcleo de roca sellado exitosamente en tubo de titanio (Montdenier / Montagnac)." },
      { sol: 377, dateUtc: "2022-03-13", lat: 18.4420, lon: 77.4310, lon360: 77.4310, elevationM: -2562, odometerKm: 6.4, label: "Fin de Campaña Crater Floor", summary: "8 núcleos ígneos recolectados en las formaciones Séítah (cumulados de olivino) y Máaz." },
      { sol: 690, dateUtc: "2023-01-28", lat: 18.4525, lon: 77.4085, lon360: 77.4085, elevationM: -2548, odometerKm: 14.3, label: "Depósito Three Forks", summary: "Construcción completada del primer depósito de muestras en otro planeta (10 tubos de titanio en la base del delta)." },
      { sol: 860, dateUtc: "2023-07-22", lat: 18.4780, lon: 77.3810, lon360: 77.3810, elevationM: -2420, odometerKm: 20.4, label: "Upper Fan & Margin Unit", summary: "Exploración de la unidad marginal rica en carbonatos a lo largo del borde interno de Jezero." },
      { sol: 1215, dateUtc: "2024-07-21", lat: 18.4960, lon: 77.3490, lon360: 77.3490, elevationM: -2365, odometerKm: 28.9, label: "Cheyava Falls (Neretva Vallis)", summary: "Perforación del núcleo Sapphire Canyon en una roca con manchas tipo 'leopardo', orgánicos y fosfato/hierro reducido (posible biofirma)." },
      { sol: 1650, dateUtc: "2025-10-10", lat: 18.4680, lon: 77.3180, lon360: 77.3180, elevationM: -2050, odometerKm: 37.8, label: "Ascenso al Borde del Cráter Jezero", summary: "Escalada de más de +500 m hacia la cresta occidental del cráter Jezero; hallazgo de rocas con corindón." },
      { sol: 2022, dateUtc: "2026-10-30", lat: 18.4470, lon: 77.4020, lon360: 77.4020, elevationM: -1980, odometerKm: 45.25, label: "Récord Planetario (Sol 2022)", summary: "Perseverance alcanza 45.25 km, superando la marca histórica de Opportunity (45.16 km) con 33 tubos sellados." },
    ],
    discoveries: [
      {
        id: "disc-m20-cheyava",
        missionId: "perseverance",
        title: "Posible biofirma en Cheyava Falls (Muestra Sapphire Canyon, Neretva Vallis)",
        kind: "sample",
        sol: 1215,
        dateUtc: "2024-07-18",
        locationName: "Bright Angel Unit, Neretva Vallis, Jezero Crater",
        lat: 18.4960,
        lon: 77.3490,
        lon360: 77.3490,
        elevationM: -2365,
        instrument: "SHERLOC + WATSON + PIXL + SuperCam",
        description: "Núcleo #25 (Sapphire Canyon) extraído de la roca Cheyava Falls, una lutita atravesada por venas de sulfato de calcio que presenta manchas milimétricas blanquecinas con halos negros ('leopard spots') ricas en hierro/fosfato reducido (vivianita/greigita) y compuestos orgánicos.",
        geologicalContext: "Depósitos fluviales/lacustres de grano fino en el canal de entrada Neretva Vallis.",
        imageUrl: "/mars-terrain-library/craters_basins/jezero_crater.png",
        publicationTitle: "NASA Mars 2020 Science Team (2024), Perseverance Finds Rock With Possible Biosignature Features at Cheyava Falls (PIA26368)",
        sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA/JPL-Caltech Mars 2020 & Analyst's Notebook",
          sourceUrl: "https://an.rsl.wustl.edu/",
          acquisitionDate: "2024-07-18",
          instrument: "SHERLOC / PIXL / WATSON",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Mapeo micro-XRF de 120 µm",
          knownPrecision: "±0.2 m",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-m20-three-forks",
        missionId: "perseverance",
        title: "Primer depósito de muestras interplanetario en Three Forks (10 tubos de titanio)",
        kind: "sample",
        sol: 690,
        dateUtc: "2023-01-28",
        locationName: "Three Forks Sample Depot, Jezero Crater Floor",
        lat: 18.4525,
        lon: 77.4085,
        lon360: 77.4085,
        elevationM: -2548,
        instrument: "Sampling and Caching Subsystem (SCS)",
        description: "Despliegue georreferenciado de 10 tubos de respaldo en patrón en zigzag (Mageik, Crosswind Lake, Roubion, Coulettes, Montdenier, Bearwallow, Skyland, Atsah, Malay y Amalik Witness).",
        geologicalContext: "Planicie nivelada en la base del frente del delta occidental de Jezero.",
        imageUrl: "/mars-terrain-library/mission_sites/perseverance_ingenuity.png",
        publicationTitle: "WashU PDS Analyst's Notebook — Mars 2020 Three Forks Sample Depot Documentation",
        sourceUrl: "https://an.rsl.wustl.edu/help/Content/About%20the%20mission/M20/Return%20sample%20science/Three%20Forks%20Depot.htm",
        metadata: {
          validation: "OFICIAL",
          sourceName: "Mars 2020 Analyst's Notebook (PDS Geosciences Node)",
          sourceUrl: "https://an.rsl.wustl.edu/help/Content/About%20the%20mission/M20/Return%20sample%20science/Three%20Forks%20Depot.htm",
          acquisitionDate: "2023-01-28",
          instrument: "Mars 2020 SCS / Watson",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Posición centimétrica de cada tubo",
          knownPrecision: "±0.05 m",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-m20-moxie",
        missionId: "perseverance",
        title: "Generación in situ de 122 gramos de oxígeno respirable por MOXIE",
        kind: "experiment",
        sol: 905,
        dateUtc: "2023-09-06",
        locationName: "Jezero Crater Campaign",
        lat: 18.4780,
        lon: 77.3810,
        lon360: 77.3810,
        elevationM: -2420,
        instrument: "MOXIE",
        description: "Culminación de 16 ejecuciones de electrólisis de óxido sólido de CO2 atmosférico, alcanzando tasas de hasta 12 g/h con >98% de pureza.",
        geologicalContext: "Atmósfera superficial en el cráter Jezero a través de todas las estaciones del año marciano.",
        imageUrl: "/mars-terrain-library/mission_sites/perseverance_ingenuity.png",
        publicationTitle: "Hoffman et al. (2022), Mars Oxygen ISRU Experiment (MOXIE) — Preparing for human Mars exploration, Science Advances",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/mars2020/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — Mars 2020 MOXIE",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/mars2020/",
          acquisitionDate: "2023-09-06",
          instrument: "MOXIE SOXE",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Telemetría de proceso ISRU",
          knownPrecision: "±0.1 g O2",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Perseverance Location Map", url: "https://science.nasa.gov/mission/mars-2020-perseverance/location-map/", validation: "OFICIAL" },
      { label: "NASA/JPL MMGIS M20 Traverse JSON", url: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json", validation: "OFICIAL" },
      { label: "PDS Geosciences Node — Mars 2020", url: "https://pds-geosciences.wustl.edu/missions/mars2020/", validation: "OFICIAL" },
      { label: "azmth Traverse Dataset (perseverance.json)", url: "https://azmth.space/mars/data", validation: "DERIVADO" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA/JPL-Caltech MMGIS & PDS Geosciences Node",
      sourceUrl: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json",
      acquisitionDate: "2021-02-18 / Present",
      instrument: "Mars 2020 VisOdom / HiRISE Localization",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "35,270 vértices de trayectoria (Sol 14 a Sol 2,022)",
      knownPrecision: "±0.2 m",
      license: "Public Domain (NASA)",
    },
  },

  /* ========================================================================
   * 6. ZHURONG — TIANWEN-1 (Rover)
   * ======================================================================== */
  {
    id: "zhurong",
    name: "Zhurong (Tianwen-1)",
    fullName: "Tianwen-1 — Zhurong Mars Rover",
    agency: "CNSA",
    category: "rover",
    status: "HIBERNATING",
    launchDateUtc: "2020-07-23T04:41:15Z",
    landingDateUtc: "2021-05-14T23:18:00Z",
    endDateUtc: "2022-05-18T00:00:00Z",
    maxSol: 358,
    landingSiteName: "Tianwen-1 Landing Platform (Southern Utopia Planitia)",
    region: "Sur de Utopia Planitia",
    lat: 25.066,
    lon: 109.925,
    lon360: 109.925,
    elevationM: -4099,
    hasMobileTraverse: true,
    totalTraverseKm: 1.921,
    odometryNote: "1,921 m (1.921 km) recorridos hacia el sur a través de la unidad Vastitas Borealis antes de entrar en hibernación invernal.",
    color: "#f43f5e",
    terrainImage: "/mars-terrain-library/mission_sites/zhurong_lander_site.png",
    regionalGlb: "/models/regions/04_Elysium_Utopia.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Perfilar la estructura estratigráfica subsuperficial de Utopia Planitia mediante radar de doble frecuencia (RoPeR).",
      "Buscar evidencias de minerales hidratados, antiguos episodios de inundación u océano boreal y medir el campo magnético local.",
    ],
    instruments: [
      { id: "tw1-roper", acronym: "RoPeR", name: "Rover Penetrating Radar", role: "Radar de subsuelo de doble canal (CH1: 15–95 MHz; CH2: 450–2150 MHz)", specs: "Penetración hasta ~80–100 m (CH1) y ~4.5 m de alta resolución (CH2)" },
      { id: "tw1-marscode", acronym: "MarSCoDe", name: "Mars Surface Composition Detector", role: "Espectroscopía LIBS + infrarrojo cercano pasivo (850–2400 nm)", specs: "Detección de sulfatos/sílice hidratada" },
      { id: "tw1-mscam-natecam", acronym: "MSCam + NaTeCam", name: "Multispectral & Navigation Terrain Cameras", role: "Fotogrametría estereoscópica y mineralogía en 8 bandas", specs: "2048×2048 px" },
      { id: "tw1-romag-mcs", acronym: "RoMAG + MCS", name: "Rover Magnetometer & Mars Climate Station", role: "Magnetometría de superficie a lo largo de la travesía y meteorología/sonido", specs: "Sensibilidad 0.01 nT" },
    ],
    waypoints: [
      { sol: 1, dateUtc: "2021-05-15", lat: 25.0660, lon: 109.9250, lon360: 109.9250, elevationM: -4099.4, odometerKm: 0.0, label: "Plataforma Tianwen-1", summary: "Aterrizaje suave en el sur de Utopia Planitia (25.066° N, 109.925° E)." },
      { sol: 8, dateUtc: "2021-05-22", lat: 25.0659, lon: 109.9250, lon360: 109.9250, elevationM: -4099.3, odometerKm: 0.005, label: "Descenso de rampa", summary: "Zhurong rueda sobre el suelo de Utopia Planitia a las 02:40 UTC." },
      { sol: 56, dateUtc: "2021-07-12", lat: 25.0628, lon: 109.9248, lon360: 109.9248, elevationM: -4096.8, odometerKm: 0.410, label: "Paracaídas y escudo trasero", summary: "Inspección cercana del escudo térmico trasero y paracaídas supersónico eyectados durante el descenso." },
      { sol: 113, dateUtc: "2021-09-06", lat: 25.0565, lon: 109.9255, lon360: 109.9255, elevationM: -4091.4, odometerKm: 1.171, label: "Perfil RoPeR (1,171 m)", summary: "Fin del transepto principal del radar RoPeR que reveló dos secuencias sedimentarias graduadas hasta 80 m de profundidad." },
      { sol: 222, dateUtc: "2022-01-01", lat: 25.0538, lon: 109.9261, lon360: 109.9261, elevationM: -4089.5, odometerKm: 1.400, label: "Dunas transversales eólicas (TARs)", summary: "Análisis MarSCoDe de duricrust cementado con sulfatos hidratados." },
      { sol: 358, dateUtc: "2022-05-18", lat: 25.0498, lon: 109.9268, lon360: 109.9268, elevationM: -4087.0, odometerKm: 1.921, label: "Sitio de Hibernación (1,921 m)", summary: "Posición final documentada tras recorrer 1,921 m hacia el sur en Utopia Planitia." },
    ],
    discoveries: [
      {
        id: "disc-zhu-radar",
        missionId: "zhurong",
        title: "Estratigrafía multicapa de inundaciones episódicas hasta 80 m de profundidad en Utopia Planitia",
        kind: "geology",
        sol: 113,
        dateUtc: "2021-09-06",
        locationName: "Southern Utopia Planitia Traverse (Sol 11–113)",
        lat: 25.0565,
        lon: 109.9255,
        lon360: 109.9255,
        elevationM: -4091,
        instrument: "RoPeR (Rover Penetrating Radar)",
        description: "El perfil de baja frecuencia del radar RoPeR a lo largo de 1,171 m identificó bajo ~10 m de regolito dos capas estratificadas con secuencias de grano fino hacia arriba (10–30 m y 30–80 m), interpretadas como episodios de inundación acuosa rápida durante el Hespérico tardío y Amazónico.",
        geologicalContext: "Unidad Vastitas Borealis en la cuenca de impacto de Utopia.",
        imageUrl: "/mars-terrain-library/mission_sites/zhurong_lander_site.png",
        publicationTitle: "Li et al. (2022), Layered subsurface in Utopia Basin of Mars revealed by Zhurong rover radar, Nature 610",
        sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9556330/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "CNSA / GRAS & Nature Peer-Reviewed Publication",
          sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9556330/",
          acquisitionDate: "2021-09-06",
          instrument: "RoPeR (15–95 MHz & 450–2150 MHz)",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Perfil continuo de 1,171 m × 80 m de profundidad",
          knownPrecision: "±1 m horizontal; ±0.5 m vertical",
          license: "CC BY 4.0",
        },
      },
      {
        id: "disc-zhu-hydrated",
        missionId: "zhurong",
        title: "Minerales sulfatados/silícicos hidratados en duricrust Amazónico joven",
        kind: "chemical",
        sol: 196,
        dateUtc: "2021-12-01",
        locationName: "Southern Utopia Planitia Duricrust Slabs",
        lat: 25.0545,
        lon: 109.9259,
        lon360: 109.9259,
        elevationM: -4090,
        instrument: "MarSCoDe (LIBS + SWIR)",
        description: "Bandas de absorción de H2O/OH a 1.9 y 2.2 µm en placas de suelo cementado (duricrust), demostrando actividad de agua líquida salina o deshielo subsuperficial durante la época Amazónica.",
        geologicalContext: "Llanuras del norte en Utopia Planitia.",
        imageUrl: "/mars-terrain-library/major_regions/utopia_planitia.png",
        publicationTitle: "Liu et al. (2022), Zhurong reveals recent aqueous activities in Utopia Planitia, Mars, Science Advances",
        sourceUrl: "https://azmth.space/mars/data",
        metadata: {
          validation: "OFICIAL",
          sourceName: "CNSA Lunar and Planetary Data Release System (GRAS)",
          sourceUrl: "https://azmth.space/mars/data",
          acquisitionDate: "2021-12-01",
          instrument: "MarSCoDe SWIR / LIBS",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Espectro puntual a 2–5 m",
          knownPrecision: "±1 m",
          license: "CC BY 4.0",
        },
      },
    ],
    officialSources: [
      { label: "Nature Study — Zhurong RoPeR Radar in Utopia Basin", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9556330/", validation: "OFICIAL" },
      { label: "Tianwen-1 Landing Site Characterization", url: "https://www.researchgate.net/publication/359471368_Landing_Site_Selection_and_Characterization_of_Tianwen-1_Zhurong_Rover_on_Mars", validation: "OFICIAL" },
      { label: "azmth Traverse Dataset (zhurong.json, CC BY 4.0)", url: "https://azmth.space/mars/data", validation: "DERIVADO" },
    ],
    metadata: {
      validation: "DERIVADO",
      sourceName: "CNSA/GRAS NaTeCam Labels & Peer-Reviewed Literature",
      sourceUrl: "https://azmth.space/mars/data",
      acquisitionDate: "2021-05-15 / 2022-05-18",
      instrument: "NaTeCam & HiRIC Orbital Localization",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "110 vértices de trayectoria (Sol 1 a Sol 325)",
      knownPrecision: "±2 m",
      license: "CC BY 4.0",
    },
  },

  /* ========================================================================
   * 7. INGENUITY — MARS HELICOPTER (Exploración Aérea)
   * ======================================================================== */
  {
    id: "ingenuity",
    name: "Ingenuity",
    fullName: "Mars Helicopter — Ingenuity (Technology Demonstrator & Aerial Scout)",
    agency: "NASA / JPL",
    category: "aerial",
    status: "COMPLETED",
    launchDateUtc: "2020-07-30T11:50:00Z",
    landingDateUtc: "2021-02-18T20:55:00Z",
    endDateUtc: "2024-01-25T00:00:00Z",
    maxSol: 1036,
    landingSiteName: "Wright Brothers Field (Airfield A)",
    region: "Cráter Jezero a Neretva Vallis (Valinor Hills)",
    lat: 18.44486,
    lon: 77.45102,
    lon360: 77.45102,
    elevationM: -2570,
    hasMobileTraverse: true,
    totalTraverseKm: 17.24,
    odometryNote: "72 vuelos completados (17.0–17.24 km en bitácora oficial de vuelo y 18.1 km en traza MMGIS; 128.8 minutos acumulados de vuelo; altitud máx. 24 m).",
    color: "#2dd4bf",
    terrainImage: "/mars-terrain-library/mission_sites/perseverance_ingenuity.png",
    regionalGlb: "/models/regions/03_Hellas_Isidis.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Demostrar el primer vuelo aerodinámico propulsado, autónomo y controlado en la atmósfera de otro planeta (~1% de la densidad terrestre).",
      "Ejecutar reconocimiento aéreo de rutas, campos de dunas y afloramientos inaccesibles para el rover Perseverance.",
    ],
    instruments: [
      { id: "ing-navcam", acronym: "Navcam", name: "Nadir Black-and-White Navigation Camera", role: "Seguimiento óptico de características del terreno para control de vuelo", specs: "640×480 px a 30 Hz" },
      { id: "ing-rte", acronym: "RTE", name: "Return-to-Earth High-Resolution Color Camera", role: "Fotografía aérea oblicua en color de formaciones geológicas y hardware", specs: "4208×3120 px (13 MP)" },
      { id: "ing-alt-imu", acronym: "Garmin LiDAR + IMU", name: "Laser Altimeter & Inertial Measurement Unit", role: "Altimetría sobre el suelo y estimación de estado a 500 Hz", specs: "Rotores coaxiales de fibra de carbono de 1.2 m a ~2,400–2,900 rpm" },
    ],
    waypoints: [
      { sol: 58, dateUtc: "2021-04-19", lat: 18.44486, lon: 77.45102, lon360: 77.45102, elevationM: -2570, odometerKm: 0.0, label: "Vuelo 1 · Wright Brothers Field", summary: "Primer vuelo propulsado en otro planeta: ascenso a 3 m de altura durante 39.1 segundos." },
      { sol: 76, dateUtc: "2021-05-07", lat: 18.44360, lon: 77.45120, lon360: 77.45120, elevationM: -2571, odometerKm: 0.50, label: "Vuelo 5 · Airfield B", summary: "Primer vuelo de traslado unidireccional (129 m) e inicio de la fase de demostración de operaciones." },
      { sol: 133, dateUtc: "2021-07-05", lat: 18.42650, lon: 77.44300, lon360: 77.44300, elevationM: -2579, odometerKm: 1.62, label: "Vuelo 9 · Cruce de Séítah", summary: "Vuelo de 625 m a 5 m/s cruzando directamente sobre el campo de dunas de Séítah." },
      { sol: 396, dateUtc: "2022-04-08", lat: 18.44850, lon: 77.41900, lon360: 77.41900, elevationM: -2555, odometerKm: 6.90, label: "Vuelo 25 · Récord de Distancia (704 m)", summary: "Mayor distancia cubierta en un solo vuelo marciano: 704 m a 5.5 m/s." },
      { sol: 933, dateUtc: "2023-10-05", lat: 18.49392, lon: 77.34511, lon360: 77.34511, elevationM: -2375, odometerKm: 14.90, label: "Vuelo 61 · Récord de Altitud (24 m)", summary: "Ascenso a 24 m sobre el suelo para perfilado de vientos en el delta superior." },
      { sol: 1036, dateUtc: "2024-01-18", lat: 18.49920, lon: 77.33850, lon360: 77.33850, elevationM: -2358, odometerKm: 17.24, label: "Vuelo 72 · Airfield Chi (Valinor Hills)", summary: "Vuelo final en Neretva Vallis; daño en las puntas de las palas al descender sobre dunas sin textura tras 72 vuelos." },
    ],
    discoveries: [
      {
        id: "disc-ing-flight1",
        missionId: "ingenuity",
        title: "Primer vuelo aerodinámico controlado en otro planeta (Wright Brothers Field, Sol 58)",
        kind: "flight",
        sol: 58,
        dateUtc: "2021-04-19",
        locationName: "Wright Brothers Field (Airfield A), Jezero Crater",
        lat: 18.44486,
        lon: 77.45102,
        lon360: 77.45102,
        elevationM: -2570,
        instrument: "Navcam + Altimeter + Coaxial Rotors",
        description: "Demostración histórica de sustentación y control autónomo a 3 m de altitud en una atmósfera de CO2 con densidad superficial de ~0.015 kg/m³.",
        geologicalContext: "Planicie basáltica nivelada de la unidad Máaz al este de Octavia E. Butler Landing.",
        imageUrl: "/mars-terrain-library/mission_sites/perseverance_ingenuity.png",
        publicationTitle: "Balaram et al. (2021), Ingenuity Mars Helicopter: From Technology Demonstration to Extraterrestrial Scout, NASA/JPL",
        sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA/JPL-Caltech Ingenuity Flight Log",
          sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/",
          acquisitionDate: "2021-04-19",
          instrument: "Ingenuity Avionics & Altimeter",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Telemetría de vuelo a 500 Hz",
          knownPrecision: "±0.2 m",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-ing-wind-profile",
        missionId: "ingenuity",
        title: "Perfilado anemométrico vertical hasta 24 m de altura en la capa límite marciana",
        kind: "experiment",
        sol: 933,
        dateUtc: "2023-10-05",
        locationName: "Airfield Tau / Upper Delta, Jezero Crater",
        lat: 18.49392,
        lon: 77.34511,
        lon360: 77.34511,
        elevationM: -2375,
        instrument: "Actuator Attitude & IMU Telemetry",
        description: "Inferencia directa de perfiles verticales de velocidad y cizalladura del viento entre 3 y 24 m de altura a partir de la actitud del rotor en vuelo estacionario, superando el alcance de los mástiles meteorológicos de superficie.",
        geologicalContext: "Cañón de entrada Neretva Vallis y frente superior del delta de Jezero.",
        imageUrl: "/mars-terrain-library/craters_basins/jezero_crater.png",
        publicationTitle: "Lorenz et al. (2024), Boundary Layer Wind Profiling on Mars using the Ingenuity Helicopter, Planetary Science Journal",
        sourceUrl: "https://arxiv.org/html/2410.19132",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA/JPL & Planetary Science Journal",
          sourceUrl: "https://arxiv.org/html/2410.19132",
          acquisitionDate: "2023-10-05",
          instrument: "Ingenuity IMU / Flight Control",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Perfiles de 3 m a 24.28 m AGL",
          knownPrecision: "±0.5 m/s velocidad de viento",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Ingenuity Mars Helicopter Portal", url: "https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/", validation: "OFICIAL" },
      { label: "NASA/JPL MMGIS Helicopter Flight Path", url: "https://science.nasa.gov/mission/mars-2020-perseverance/location-map/", validation: "OFICIAL" },
      { label: "azmth Traverse Dataset (ingenuity.json — 72 flights)", url: "https://azmth.space/mars/data", validation: "DERIVADO" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA/JPL-Caltech MMGIS & Flight Log",
      sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/",
      acquisitionDate: "2021-04-19 / 2024-01-18",
      instrument: "Ingenuity Navcam / MMGIS HiRISE Localization",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "7,647 vértices en 72 vuelos (Sol 58 a Sol 1,036)",
      knownPrecision: "±0.5 m",
      license: "Public Domain (NASA) / CC BY 4.0",
    },
  },

  /* ========================================================================
   * 8. VIKING 1 — LANDER DE SUPERFICIE (Fijo, sin trayectoria móvil)
   * ======================================================================== */
  {
    id: "viking1",
    name: "Viking 1 Lander",
    fullName: "Viking 1 Lander — Thomas A. Mutch Memorial Station",
    agency: "NASA",
    category: "lander",
    status: "COMPLETED",
    launchDateUtc: "1975-08-20T21:22:00Z",
    landingDateUtc: "1976-07-20T11:53:06Z",
    endDateUtc: "1982-11-13T00:00:00Z",
    maxSol: 2245,
    landingSiteName: "Thomas A. Mutch Memorial Station",
    region: "Oeste de Chryse Planitia",
    lat: 22.27,
    lon: -47.95,
    lon360: 312.05,
    elevationM: -3627,
    hasMobileTraverse: false,
    totalTraverseKm: null,
    odometryNote: "Misión estática de superficie (Lander fijo). Representada por su estación de aterrizaje y área de muestreo del brazo robótico (3 m), sin fabricar trayectorias móviles.",
    color: "#f87171",
    terrainImage: "/mars-terrain-library/mission_sites/viking_lander_sites.png",
    regionalGlb: "/models/regions/01_Tharsis.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Obtener las primeras fotografías de alta resolución e in situ desde la superficie de Marte.",
      "Ejecutar tres experimentos metabólicos biológicos (LR, GEX, PR) y análisis orgánico GCMS en el regolito.",
      "Monitorear la meteorología marciana a lo largo de múltiples ciclos anuales y fijar la red geodésica del planeta.",
    ],
    instruments: [
      { id: "vk1-bio", acronym: "BIOLAB (LR/GEX/PR)", name: "Viking Biological Experiments", role: "Pruebas de liberación marcada (14C), intercambio gaseoso y liberación pirolítica", specs: "Incubación de suelo marciano" },
      { id: "vk1-gcms", acronym: "GCMS", name: "Gas Chromatograph — Mass Spectrometer", role: "Búsqueda de compuestos orgánicos volátiles y análisis atmosférico", specs: "Hornos de pirólisis hasta 500 °C" },
      { id: "vk1-xrfs", acronym: "XRFS", name: "X-Ray Fluorescence Spectrometer", role: "Composición elemental inorgánica del regolito (Fe, Si, S, Cl, Ca, Ti)", specs: "Fuentes 55Fe y 109Cd" },
      { id: "vk1-cams", acronym: "Facsimile Cameras (1 & 2)", name: "Stereoscopic Scanning Facsimile Cameras", role: "Panoramas estereoscópicos en color, blanco y negro e infrarrojo cercano", specs: "Resolución angular 0.04°–0.12°" },
    ],
    waypoints: [],
    discoveries: [
      {
        id: "disc-vk1-biolab",
        missionId: "viking1",
        title: "Reactividad oxidante del regolito marciano en los experimentos Labeled Release y GCMS",
        kind: "experiment",
        sol: 8,
        dateUtc: "1976-07-28",
        locationName: "Sandy Flats Sample Trench, Chryse Planitia",
        lat: 22.27,
        lon: -47.95,
        lon360: 312.05,
        elevationM: -3627,
        instrument: "BIOLAB (LR/GEX) + GCMS + XRFS",
        description: "El experimento Labeled Release liberó CO2 marcado con 14C tras inyectar nutrientes acuosos, mientras que el GCMS no detectó moléculas orgánicas a nivel de ppb (explicado décadas después por la presencia de percloratos oxidantes descubiertos por Phoenix).",
        geologicalContext: "Llanuras volcánicas y aluviales Hespéricas de Chryse Planitia recubiertas por regolito rico en hierro, azufre (~7% SO3) y cloro.",
        imageUrl: "/mars-terrain-library/mission_sites/viking_lander_sites.png",
        publicationTitle: "Klein et al. (1976), The Viking Biological Investigation: Preliminary Results, Science 194(4260)",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — Viking Lander Archive",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm",
          acquisitionDate: "1976-07-28",
          instrument: "Viking 1 Biology Instrument & GCMS",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Muestreo de zanja a <3 m del lander",
          knownPrecision: "±0.0001° (define la longitud de referencia marciana 47.95137° W)",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-vk1-pressure-cycle",
        missionId: "viking1",
        title: "Descubrimiento del ciclo estacional global de condensación/sublimación del 25–30% de la atmósfera de CO2",
        kind: "experiment",
        sol: 700,
        dateUtc: "1978-07-10",
        locationName: "Thomas A. Mutch Memorial Station, Chryse Planitia",
        lat: 22.27,
        lon: -47.95,
        lon360: 312.05,
        elevationM: -3627,
        instrument: "Viking Meteorology Instrument System (VMIS)",
        description: "El registro barométrico continuo a lo largo de más de tres años marcianos (2,245 soles) demostró que la presión atmosférica oscila entre ~6.8 y ~9.0 hPa debido al intercambio estacional de masa de CO2 con los casquetes polares.",
        geologicalContext: "Cuenca topográfica de Chryse Planitia (-3,627 m MOLA).",
        imageUrl: "/mars-terrain-library/major_regions/chryse_planitia.png",
        publicationTitle: "Hess et al. (1980), The Annual Cycle of Pressure on Mars Measured by Viking Landers 1 and 2, GRL",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — Viking Lander Meteorology",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm",
          acquisitionDate: "1976-07-20 / 1982-11-13",
          instrument: "Viking 1 Barometer",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Serie temporal de 2,245 soles",
          knownPrecision: "±0.05 hPa",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Viking 1 Mission Page", url: "https://science.nasa.gov/mission/viking-1/", validation: "OFICIAL" },
      { label: "PDS Geosciences Node — Viking Lander", url: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm", validation: "OFICIAL" },
      { label: "PDS Imaging Node — Viking Lander", url: "https://pds-imaging.jpl.nasa.gov/portal/vikingl_mission.html", validation: "OFICIAL" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA PDS Geosciences Node & USGS Astrogeology",
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm",
      acquisitionDate: "1976-07-20 / 1982-11-13",
      instrument: "Viking 1 Radio Tracking & HiRISE Localization",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "Estación fija de referencia geodésica",
      knownPrecision: "±1 m (HiRISE) / 47.95137° W datum anchor",
      license: "Public Domain (NASA)",
    },
  },

  /* ========================================================================
   * 9. VIKING 2 — LANDER DE SUPERFICIE (Fijo, sin trayectoria móvil)
   * ======================================================================== */
  {
    id: "viking2",
    name: "Viking 2 Lander",
    fullName: "Viking 2 Lander — Gerald Soffen Memorial Station",
    agency: "NASA",
    category: "lander",
    status: "COMPLETED",
    launchDateUtc: "1975-09-09T18:39:00Z",
    landingDateUtc: "1976-09-03T22:58:20Z",
    endDateUtc: "1980-04-11T00:00:00Z",
    maxSol: 1281,
    landingSiteName: "Gerald Soffen Memorial Station",
    region: "Utopia Planitia (Oeste del cráter Mie)",
    lat: 47.64,
    lon: 134.29,
    lon360: 134.29,
    elevationM: -4495,
    hasMobileTraverse: false,
    totalTraverseKm: null,
    odometryNote: "Misión estática de superficie (Lander fijo, inclinado 8.2° sobre una roca). Sin trayectoria móvil.",
    color: "#fb7185",
    terrainImage: "/mars-terrain-library/mission_sites/viking_lander_sites.png",
    regionalGlb: "/models/regions/04_Elysium_Utopia.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Analizar el suelo y buscar biofirmas en una latitud subpolar norte (47.64° N) con mayor humedad estacional.",
      "Documentar el ciclo de heladas invernales y operar el sismómetro de a bordo durante 1,281 soles.",
    ],
    instruments: [
      { id: "vk2-bio-gcms", acronym: "BIOLAB + GCMS", name: "Biological Package & Gas Chromatograph Mass Spectrometer", role: "Análisis de muestras tomadas incluso debajo de rocas desplazadas (roca Bonneville)", specs: "Muestreo protegido de UV solar" },
      { id: "vk2-xrfs", acronym: "XRFS", name: "X-Ray Fluorescence Spectrometer", role: "Análisis elemental de costras cementadas por sales (duricrust)", specs: "Detección de enriquecimiento en S y Cl" },
      { id: "vk2-seis-met", acronym: "Seismometer + VMIS", name: "3-Axis Short-Period Seismometer & Meteorology", role: "Monitoreo sísmico/eólico y observación térmica de escarcha invernal", specs: "Montado sobre el chasis del lander" },
    ],
    waypoints: [],
    discoveries: [
      {
        id: "disc-vk2-frost",
        missionId: "viking2",
        title: "Observación directa in situ de escarcha superficial de H2O y CO2 durante el invierno boreal",
        kind: "geology",
        sol: 380,
        dateUtc: "1977-09-25",
        locationName: "Gerald Soffen Memorial Station, Utopia Planitia",
        lat: 47.64,
        lon: 134.29,
        lon360: 134.29,
        elevationM: -4495,
        instrument: "Facsimile Cameras + VMIS",
        description: "Documentación fotográfica de una fina capa blanca de escarcha de agua y hielo seco cubriendo los bloques vesiculares y zanjas de Utopia Planitia durante dos inviernos marcianos consecutivos.",
        geologicalContext: "Llanuras poligonales periglaciares en la cuenca norte de Utopia Planitia, al oeste del cráter Mie.",
        imageUrl: "/mars-terrain-library/major_regions/utopia_planitia.png",
        publicationTitle: "Wall (1981), Analysis of condensates formed at the Viking 2 lander site: The first winter, Icarus 47",
        sourceUrl: "https://science.gsfc.nasa.gov/attic/mola/viking2.html",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA GSFC MOLA & PDS Viking Lander Archive",
          sourceUrl: "https://science.gsfc.nasa.gov/attic/mola/viking2.html",
          acquisitionDate: "1977-09-25",
          instrument: "Viking 2 Facsimile Camera",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Campo cercano estereoscópico",
          knownPrecision: "±1 m (HiRISE)",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Viking 2 Mission Page", url: "https://science.nasa.gov/mission/viking-2/", validation: "OFICIAL" },
      { label: "NASA GSFC MOLA Viking 2 Topography", url: "https://science.gsfc.nasa.gov/attic/mola/viking2.html", validation: "OFICIAL" },
      { label: "PDS Geosciences Node — Viking Lander", url: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm", validation: "OFICIAL" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA PDS Geosciences Node",
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/vlander/index.htm",
      acquisitionDate: "1976-09-03 / 1980-04-11",
      instrument: "Viking 2 Lander Instruments",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "Estación fija (1,281 soles)",
      knownPrecision: "±1 m",
      license: "Public Domain (NASA)",
    },
  },

  /* ========================================================================
   * 10. PHOENIX — MARS POLAR LANDER (Fijo, sin trayectoria móvil)
   * ======================================================================== */
  {
    id: "phoenix",
    name: "Phoenix",
    fullName: "Phoenix Mars Scout Lander",
    agency: "NASA / UArizona / JPL",
    category: "lander",
    status: "COMPLETED",
    launchDateUtc: "2007-08-04T09:26:34Z",
    landingDateUtc: "2008-05-25T23:53:44Z",
    endDateUtc: "2008-11-02T00:00:00Z",
    maxSol: 157,
    landingSiteName: "Green Valley (Vastitas Borealis)",
    region: "Vastitas Borealis (Ártico Marciano, 68.22° N)",
    lat: 68.2188,
    lon: -125.7492,
    lon360: 234.2508,
    elevationM: -4100,
    hasMobileTraverse: false,
    totalTraverseKm: null,
    odometryNote: "Misión estática polar (Lander fijo). Excavó 12 trincheras con su brazo robótico de 2.35 m hasta la tabla de hielo subsuperficial.",
    color: "#60a5fa",
    terrainImage: "/mars-terrain-library/mission_sites/phoenix_lander_site.png",
    regionalGlb: "/models/regions/06_North_Pole.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Excavar hasta la capa de hielo de agua subsuperficial detectada por Mars Odyssey GRS en el ártico marciano.",
      "Analizar la química húmeda del suelo polar (pH, sales solubles, percloratos y carbonatos) y evaluar su habitabilidad.",
    ],
    instruments: [
      { id: "phx-ra", acronym: "RA + RAC", name: "Robotic Arm & Robotic Arm Camera", role: "Excavación de zanjas hasta la tabla de hielo a 3–5 cm de profundidad", specs: "Alcance 2.35 m" },
      { id: "phx-tega", acronym: "TEGA", name: "Thermal and Evolved Gas Analyzer", role: "Calorimetría diferencial de barrido y espectrometría de masas de gases desprendidos", specs: "8 hornos hasta 1,000 °C" },
      { id: "phx-meca", acronym: "MECA (WCL + OM/AFM)", name: "Microscopy, Electrochemistry, and Conductivity Analyzer", role: "4 celdas de química húmeda (WCL) y microscopio óptico/fuerza atómica", specs: "Medición directa de pH (7.7) y ClO4-" },
      { id: "phx-ssi-met", acronym: "SSI + MET LiDAR", name: "Surface Stereo Imager & Meteorological Station with LiDAR", role: "Estereoscopía multiespectral y perfilado láser de nubes y nieve", specs: "LiDAR Nd:YAG 532/1064 nm" },
    ],
    waypoints: [],
    discoveries: [
      {
        id: "disc-phx-ice",
        missionId: "phoenix",
        title: "Confirmación directa de hielo de agua subsuperficial en la zanja Dodo-Goldilocks",
        kind: "sample",
        sol: 24,
        dateUtc: "2008-06-19",
        locationName: "Dodo-Goldilocks & Snow White Trenches, Green Valley",
        lat: 68.2188,
        lon: -125.7492,
        lon360: 234.2508,
        elevationM: -4100,
        instrument: "RA + SSI + TEGA",
        description: "Fragmentos brillantes del tamaño de dados excavados en la trinchera Dodo-Goldilocks en el Sol 20 se sublimaron y desaparecieron completamente en el Sol 24, confirmando que eran hielo de agua puro (posteriormente fundido y medido en el horno TEGA).",
        geologicalContext: "Terreno poligonal de contracción térmica sobre permafrost rico en hielo en Vastitas Borealis.",
        imageUrl: "/mars-terrain-library/mission_sites/phoenix_lander_site.png",
        publicationTitle: "Smith et al. (2009), H2O at the Phoenix Landing Site, Science 325(5936)",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/phoenix/index.htm",
        metadata: {
          validation: "OFICIAL",
          sourceName: "Phoenix Analyst's Notebook / NASA PDS Geosciences Node",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/phoenix/index.htm",
          acquisitionDate: "2008-06-19",
          instrument: "SSI / TEGA / Robotic Arm",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Trinchera a 4–5 cm de profundidad",
          knownPrecision: "±0.5 m",
          license: "Public Domain (NASA)",
        },
      },
      {
        id: "disc-phx-perchlorate",
        missionId: "phoenix",
        title: "Descubrimiento de percloratos (0.4–0.6% ClO4-), pH alcalino (7.7) y precipitación de nieve",
        kind: "chemical",
        sol: 99,
        dateUtc: "2008-09-03",
        locationName: "Rosy Red & Sorceress Trenches, Green Valley",
        lat: 68.2188,
        lon: -125.7492,
        lon360: 234.2508,
        elevationM: -4100,
        instrument: "MECA (Wet Chemistry Lab) + TEGA + MET LiDAR",
        description: "El laboratorio húmedo MECA detectó ~0.6% de sales de perclorato, carbonato de calcio (3–5%) y pH 7.7±0.5, mientras el LiDAR MET observó cortinas de nieve de agua precipitando desde nubes cirros a 4 km de altitud.",
        geologicalContext: "Suelo ártico alcalino-salino de Vastitas Borealis.",
        imageUrl: "/mars-terrain-library/polar_regions/planum_boreum_north_pole.png",
        publicationTitle: "Hecht et al. (2009), Detection of Perchlorate and the Soluble Chemistry of Martian Soil at the Phoenix Lander Site, Science",
        sourceUrl: "https://an.rsl.wustl.edu/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node — Phoenix MECA/TEGA",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/phoenix/index.htm",
          acquisitionDate: "2008-09-03",
          instrument: "MECA WCL / MET LiDAR",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Electroquímica en solución acuosa",
          knownPrecision: "±0.1 unidades de pH",
          license: "Public Domain (NASA)",
        },
      },
    ],
    officialSources: [
      { label: "NASA Phoenix Mission Page", url: "https://science.nasa.gov/mission/mars-phoenix/", validation: "OFICIAL" },
      { label: "PDS Geosciences Node — Phoenix Archive", url: "https://pds-geosciences.wustl.edu/missions/phoenix/index.htm", validation: "OFICIAL" },
      { label: "Phoenix Analyst's Notebook", url: "https://an.rsl.wustl.edu/", validation: "OFICIAL" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA PDS Geosciences Node",
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/phoenix/index.htm",
      acquisitionDate: "2008-05-25 / 2008-11-02",
      instrument: "Phoenix Lander Payload",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "Estación fija (157 soles)",
      knownPrecision: "±0.5 m (HiRISE)",
      license: "Public Domain (NASA)",
    },
  },

  /* ========================================================================
   * 11. INSIGHT — LANDER GEOFÍSICO DE SUPERFICIE (Fijo, sin trayectoria móvil)
   * ======================================================================== */
  {
    id: "insight",
    name: "InSight",
    fullName: "Interior Exploration using Seismic Investigations, Geodesy and Heat Transport",
    agency: "NASA / JPL / CNES / DLR",
    category: "lander",
    status: "COMPLETED",
    launchDateUtc: "2018-05-05T11:05:01Z",
    landingDateUtc: "2018-11-26T19:52:59Z",
    endDateUtc: "2022-12-15T00:00:00Z",
    maxSol: 1440,
    landingSiteName: "Homestead hollow (Western Elysium Planitia)",
    region: "Oeste de Elysium Planitia",
    lat: 4.5024,
    lon: 135.6234,
    lon360: 135.6234,
    elevationM: -2613,
    hasMobileTraverse: false,
    totalTraverseKm: null,
    odometryNote: "Estación geofísica fija de superficie (Lander fijo). Desplegó el sismómetro SEIS y la sonda térmica HP3 directamente sobre el suelo.",
    color: "#c084fc",
    terrainImage: "/mars-terrain-library/mission_sites/insight_lander_site.png",
    regionalGlb: "/models/regions/04_Elysium_Utopia.glb",
    reconstructionTypes: ["TYPE_B_DEM", "TYPE_D_ORBITAL_DRAPE"],
    objectives: [
      "Determinar el espesor y estratificación de la corteza, la estructura del manto y el radio y estado físico del núcleo de Marte.",
      "Medir la tasa de sismicidad interna (marsquakes) y la frecuencia de impactos meteoríticos sobre el planeta.",
    ],
    instruments: [
      { id: "ins-seis", acronym: "SEIS", name: "Seismic Experiment for Interior Structure", role: "Sismómetro de banda muy ancha y periodo corto colocado en el suelo con escudo WTS", specs: "Provisto por CNES; detectó 1,319 martemotos" },
      { id: "ins-hp3", acronym: "HP³", name: "Heat Flow and Physical Properties Package", role: "Sonda térmica percusiva ('Mole') y radiómetro infrarrojo de superficie", specs: "Provisto por DLR; penetró hasta 37 cm" },
      { id: "ins-rise", acronym: "RISE", name: "Rotation and Interior Structure Experiment", role: "Seguimiento Doppler en banda X de la nutación y precesión del eje marciano", specs: "Restricción directa del núcleo líquido" },
      { id: "ins-apss", acronym: "APSS + IDA", name: "Auxiliary Payload Sensor Suite & Instrument Deployment Arm", role: "Microbarómetro, vientos TWINS, magnetómetro IFG y cámaras IDC/ICC", specs: "Muestreo continuo de presión, viento y campo magnético" },
    ],
    waypoints: [],
    discoveries: [
      {
        id: "disc-ins-core-crust",
        missionId: "insight",
        title: "Estructura interna de Marte: núcleo líquido rico en elementos ligeros y corteza de 24–72 km (1,319 martemotos)",
        kind: "seismic",
        sol: 1222,
        dateUtc: "2022-05-04",
        locationName: "Homestead hollow, Elysium Planitia (y epicentros en Cerberus Fossae)",
        lat: 4.5024,
        lon: 135.6234,
        lon360: 135.6234,
        elevationM: -2613,
        instrument: "SEIS + RISE",
        description: "El catálogo de 1,319 martemotos (incluyendo el evento S1222a de magnitud 4.7 del 4 de mayo de 2022 y sismos focalizados en el sistema de grabens de Cerberus Fossae) permitió medir el radio del núcleo líquido (~1,830 km) y la estratificación cortical.",
        geologicalContext: "Cráter degradado de 27 m (Homestead hollow) sobre lavas Hespéricas/Amazónicas de Elysium Planitia.",
        imageUrl: "/mars-terrain-library/mission_sites/insight_lander_site.png",
        publicationTitle: "Stähler et al. (2021) / Knapmeyer-Endrun et al. (2021) / Khan et al. (2021), Science 373 — Seismic detection of the Martian core, crust and mantle",
        sourceUrl: "https://pds-geosciences.wustl.edu/missions/insight/",
        metadata: {
          validation: "OFICIAL",
          sourceName: "NASA PDS Geosciences Node & IRIS Mars Seismic Service",
          sourceUrl: "https://pds-geosciences.wustl.edu/missions/insight/",
          acquisitionDate: "2018-11-26 / 2022-12-15",
          instrument: "SEIS VBB/SP & RISE",
          crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
          resolution: "Catálogo sísmico global de 1,319 eventos",
          knownPrecision: "±0.5 m posición del lander",
          license: "Public Domain (NASA / CNES / DLR)",
        },
      },
    ],
    officialSources: [
      { label: "NASA InSight Mission Science Page", url: "https://science.nasa.gov/mission/insight/science/", validation: "OFICIAL" },
      { label: "PDS Geosciences Node — InSight Archive", url: "https://pds-geosciences.wustl.edu/missions/insight/", validation: "OFICIAL" },
      { label: "InSight Analyst's Notebook", url: "https://an.rsl.wustl.edu/", validation: "OFICIAL" },
    ],
    metadata: {
      validation: "OFICIAL",
      sourceName: "NASA PDS Geosciences Node",
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/insight/",
      acquisitionDate: "2018-11-26 / 2022-12-15",
      instrument: "SEIS / HP3 / RISE / APSS",
      crs: "IAU Mars 2000 Planetocentric (MOLA Areoid)",
      resolution: "Estación geofísica fija (1,440 soles)",
      knownPrecision: "±0.5 m (HiRISE)",
      license: "Public Domain (NASA)",
    },
  },
];

export const PLANETARY_FEATURES: PlanetaryFeature[] = [
  {
    id: "feat-olympus-mons",
    name: "Olympus Mons",
    kind: "mountain",
    lat: 18.65,
    lon: -133.8,
    lon360: 226.2,
    elevationM: 21229,
    diameterOrLengthKm: 624,
    geologicalUnit: "Amazónico — Escudo volcánico basáltico de Tharsis",
    mineralogyNote: "Basaltos toleíticos recubiertos por polvo férrico de alta reflectancia (baja inercia térmica THEMIS).",
    imageUrl: "/mars-terrain-library/volcanoes/olympus_mons.png",
    regionalGlb: "/models/regions/01_Tharsis.glb",
    description: "El volcán en escudo más grande del Sistema Solar (+21.2 km sobre el areoide MOLA), rodeado por un escarpe basal de hasta 8 km de altura.",
    sourceUrl: "https://astrogeology.usgs.gov/",
  },
  {
    id: "feat-valles-marineris",
    name: "Valles Marineris (Melas & Candor Chasma)",
    kind: "valley",
    lat: -10.4,
    lon: -72.3,
    lon360: 287.7,
    elevationM: -4500,
    diameterOrLengthKm: 4000,
    geologicalUnit: "Noéico–Hespérico — Sistema tectónico de grabens y depósitos estratificados interiores (ILDs)",
    mineralogyNote: "Sulfatos polihidratados y monohidratados (kieserita) y óxidos férricos detectados por CRISM y OMEGA.",
    imageUrl: "/mars-terrain-library/canyons_valleys/melas_chasma.png",
    regionalGlb: "/models/regions/02_Valles_Marineris.glb",
    description: "Sistema de cañones tectónicos de 4,000 km de longitud y hasta 7–10 km de profundidad que expone la corteza superior de Marte.",
    sourceUrl: "https://pds-geosciences.wustl.edu/missions/mro/crism.htm",
  },
  {
    id: "feat-jezero-crater",
    name: "Cráter Jezero & Neretva Vallis",
    kind: "crater",
    lat: 18.4447,
    lon: 77.4508,
    lon360: 77.4508,
    elevationM: -2570,
    diameterOrLengthKm: 45,
    geologicalUnit: "Noéico tardío — Cuenca paleolacustre abierta y abanico deltaico",
    mineralogyNote: "Esmectitas de Fe/Mg, carbonatos marginales de magnesio y olivino detectados por CRISM e in situ por Perseverance.",
    imageUrl: "/mars-terrain-library/craters_basins/jezero_crater.png",
    regionalGlb: "/models/regions/03_Hellas_Isidis.glb",
    description: "Cráter de impacto de 45 km en el borde occidental de Isidis Planitia que albergó un lago con canales de entrada (Neretva) y salida (Pliva).",
    sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/",
  },
  {
    id: "feat-gale-crater",
    name: "Cráter Gale & Aeolis Mons (Mount Sharp)",
    kind: "crater",
    lat: -4.5895,
    lon: 137.4417,
    lon360: 137.4417,
    elevationM: -4501,
    diameterOrLengthKm: 154,
    geologicalUnit: "Noéico–Hespérico — Cuenca en la dicotomía cortical con montículo sedimentario central de 5.5 km",
    mineralogyNote: "Transición estratigráfica vertical desde lutitas con esmectitas (Glen Torridon) hacia unidades de sulfatos y redes boxwork.",
    imageUrl: "/mars-terrain-library/craters_basins/gale_crater.png",
    regionalGlb: "/models/regions/04_Elysium_Utopia.glb",
    description: "Cráter de 154 km explorado por Curiosity; cuenta con las 5 escenas fotogramétricas 3D de Access Mars.",
    sourceUrl: "https://science.nasa.gov/mission/msl-curiosity/",
  },
  {
    id: "feat-hellas-basin",
    name: "Cuenca de Impacto Hellas Planitia",
    kind: "crater",
    lat: -42.4,
    lon: 70.5,
    lon360: 70.5,
    elevationM: -7152,
    diameterOrLengthKm: 2300,
    geologicalUnit: "Noéico temprano — Mayor estructura de impacto visible en Marte",
    mineralogyNote: "Depósitos glaciares lobulados en el margen oriental (SHARAD) y evaporitas/arcillas en el fondo.",
    imageUrl: "/mars-terrain-library/craters_basins/hellas_basin.png",
    regionalGlb: "/models/regions/03_Hellas_Isidis.glb",
    description: "La depresión más profunda de Marte (hasta -8,200 m MOLA), donde la presión atmosférica superficial supera los 11–12 hPa.",
    sourceUrl: "https://pds-geosciences.wustl.edu/missions/mgs/mola.html",
  },
  {
    id: "feat-kasei-valles",
    name: "Kasei Valles",
    kind: "valley",
    lat: 24.6,
    lon: -65.0,
    lon360: 295.0,
    elevationM: -2900,
    diameterOrLengthKm: 1580,
    geologicalUnit: "Hespérico — Mayor sistema de canales de desbordamiento (outflow channel)",
    mineralogyNote: "Terrenos basálticos esculpidos por cataratas gigantes e islas en forma de lágrima hacia Chryse Planitia.",
    imageUrl: "/mars-terrain-library/canyons_valleys/kasei_valles.png",
    regionalGlb: "/models/regions/01_Tharsis.glb",
    description: "Canal de megainundación de hasta 480 km de ancho que drenó desde Echus Chasma hacia la cuenca de Chryse.",
    sourceUrl: "https://astrogeology.usgs.gov/",
  },
  {
    id: "feat-bagnold-dunes",
    name: "Campo de Dunas Bagnold & Olympia Undae",
    kind: "dune",
    lat: -4.64,
    lon: 137.41,
    lon360: 137.41,
    elevationM: -4460,
    diameterOrLengthKm: 35,
    geologicalUnit: "Amazónico moderno — Dunas barchan y lineales activas",
    mineralogyNote: "Arenas basálticas oscuras enriquecidas en olivino y piroxeno (bajo contenido de polvo hidratado).",
    imageUrl: "/mars-terrain-library/mission_sites/curiosity_gale_crater.png",
    regionalGlb: "/models/regions/04_Elysium_Utopia.glb",
    description: "Primer campo de dunas extraterrestre activo estudiado in situ (Curiosity, Sol 1180–1260), bordeando el flanco noroeste de Mount Sharp.",
    sourceUrl: "https://pds-geosciences.wustl.edu/missions/msl/",
  },
  {
    id: "feat-planum-boreum",
    name: "Planum Boreum & Chasma Boreale (Polo Norte)",
    kind: "polar",
    lat: 85.0,
    lon: 0.0,
    lon360: 0.0,
    elevationM: -2100,
    diameterOrLengthKm: 1000,
    geologicalUnit: "Amazónico tardío — Depósitos Polares Estratificados del Norte (NPLD)",
    mineralogyNote: "Capas alternas de hielo de H2O y polvo silicatado coronadas por un mar circunpolar de dunas ricas en yeso (Olympia Undae).",
    imageUrl: "/mars-terrain-library/polar_regions/planum_boreum_north_pole.png",
    regionalGlb: "/models/regions/06_North_Pole.glb",
    description: "Domo de hielo de agua de 3 km de espesor surcado por depresiones en espiral esculpidas por vientos catabáticos.",
    sourceUrl: "https://astrogeology.usgs.gov/",
  },
];

export const ALL_SCIENTIFIC_DISCOVERIES: ScientificDiscovery[] = MARS_MISSIONS.flatMap(
  (m) => m.discoveries,
);

export function getMissionById(id: string): MarsMissionRecord | undefined {
  return MARS_MISSIONS.find((m) => m.id === id);
}

/**
 * Compute cumulative geospatial metrics for a mobile mission up to `targetSol`.
 * Returns null for stationary landers without mobile traverses.
 */
export function computeMissionSolMetrics(mission: MarsMissionRecord, targetSol: number) {
  if (!mission.hasMobileTraverse || mission.waypoints.length === 0) {
    return {
      currentSol: Math.min(targetSol, mission.maxSol),
      lat: mission.lat,
      lon: mission.lon,
      lon360: mission.lon360,
      elevationM: mission.elevationM,
      distanceKm: 0,
      cumulativeGainM: 0,
      cumulativeLossM: 0,
      netElevationChangeM: 0,
      meanSlopeDeg: 0,
      maxSlopeDeg: 0,
      activeWaypoint: null as MissionWaypoint | null,
      reachedWaypoints: [] as MissionWaypoint[],
      discoveriesUpToSol: mission.discoveries.filter((d) => d.sol <= targetSol),
      profile: [] as Array<{ sol: number; distanceKm: number; elevationM: number; slopeDeg: number; label: string }>,
    };
  }

  const clampedSol = Math.max(1, Math.min(targetSol, mission.maxSol));
  const wps = mission.waypoints;
  const reached = wps.filter((w) => w.sol <= clampedSol);
  const active = reached.at(-1) ?? wps[0]!;

  let cumulativeGainM = 0;
  let cumulativeLossM = 0;
  let maxSlopeDeg = 0;
  let slopeSum = 0;
  let slopeCount = 0;

  const profile = wps.map((w, idx) => {
    if (idx === 0) {
      return { sol: w.sol, distanceKm: w.odometerKm, elevationM: w.elevationM, slopeDeg: 0, label: w.label };
    }
    const prev = wps[idx - 1]!;
    const dz = w.elevationM - prev.elevationM;
    const dxMeters = Math.max(1, (w.odometerKm - prev.odometerKm) * 1000);
    const slope = (Math.atan2(Math.abs(dz), dxMeters) * 180) / Math.PI;
    if (w.sol <= clampedSol) {
      if (dz > 0) cumulativeGainM += dz;
      else cumulativeLossM += Math.abs(dz);
      if (slope > maxSlopeDeg) maxSlopeDeg = slope;
      slopeSum += slope;
      slopeCount += 1;
    }
    return {
      sol: w.sol,
      distanceKm: w.odometerKm,
      elevationM: w.elevationM,
      slopeDeg: Number(slope.toFixed(2)),
      label: w.label,
    };
  });

  // Interpolate position and odometer if clampedSol is between two waypoints
  const nextWp = wps.find((w) => w.sol > clampedSol);
  let lat = active.lat;
  let lon = active.lon;
  let elevationM = active.elevationM;
  let distanceKm = active.odometerKm;

  if (nextWp && nextWp.sol > active.sol) {
    const t = (clampedSol - active.sol) / (nextWp.sol - active.sol);
    lat = active.lat + (nextWp.lat - active.lat) * t;
    lon = active.lon + (nextWp.lon - active.lon) * t;
    elevationM = active.elevationM + (nextWp.elevationM - active.elevationM) * t;
    distanceKm = active.odometerKm + (nextWp.odometerKm - active.odometerKm) * t;
  }

  return {
    currentSol: clampedSol,
    lat,
    lon,
    lon360: ((lon % 360) + 360) % 360,
    elevationM: Number(elevationM.toFixed(1)),
    distanceKm: Number(distanceKm.toFixed(3)),
    cumulativeGainM: Math.round(cumulativeGainM),
    cumulativeLossM: Math.round(cumulativeLossM),
    netElevationChangeM: Math.round(elevationM - wps[0]!.elevationM),
    meanSlopeDeg: slopeCount > 0 ? Number((slopeSum / slopeCount).toFixed(2)) : 0,
    maxSlopeDeg: Number(maxSlopeDeg.toFixed(2)),
    activeWaypoint: active,
    reachedWaypoints: reached.length ? reached : [wps[0]!],
    discoveriesUpToSol: mission.discoveries.filter((d) => d.sol <= clampedSol),
    profile,
  };
}
