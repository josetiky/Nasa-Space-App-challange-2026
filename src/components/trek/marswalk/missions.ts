/**
 * M.I.Y.H. · Las 11 misiones del carrusel (tabs/04-misiones/data/missions.js de mars-space-rockstars).
 * Fuentes: NASA/JPL, CNSA. Fotos: Wikimedia Commons (créditos en cada ficha). Texto EN original; ES traducido.
 */
import type { TrekLang } from "../i18n";

interface MissionText {
  readonly type: string;
  readonly short: string;
  readonly launch: string;
  readonly landing: string;
  readonly end: string;
  readonly site: string;
  readonly facts: readonly string[];
  readonly trivia: string;
}

export interface Mission {
  readonly id: string;
  readonly name: string;
  readonly agency: string;
  readonly year: number;
  readonly yearLabel?: string;
  readonly img: string;
  readonly imgPos: string;
  readonly concept?: boolean;
  readonly credit: string;
  readonly text: Readonly<Record<TrekLang, MissionText>>;
}

const img = (id: string) => `/miyh/missions/${id}.jpg`;

export const MISSIONS: readonly Mission[] = [
  {
    id: "viking1",
    name: "Viking 1",
    agency: "NASA",
    year: 1976,
    img: img("viking1"),
    imgPos: "50% 60%",
    credit: "NASA/JPL",
    text: {
      en: {
        type: "Lander",
        short: "The first US spacecraft to land on Mars and send back photos from its surface.",
        launch: "Aug 20, 1975",
        landing: "Jul 20, 1976",
        end: "Nov 1982",
        site: "Chryse Planitia",
        facts: [
          "Took the first color photograph from the surface of Mars.",
          "Carried biology experiments to look for life in the soil; their results are still debated.",
          "Measured Martian weather for more than six years.",
        ],
        trivia: "It was planned for 90 days; the lander worked for more than 2,200.",
      },
      es: {
        type: "Módulo de aterrizaje",
        short:
          "La primera nave de EE. UU. en aterrizar en Marte y enviar fotos desde su superficie.",
        launch: "20 ago 1975",
        landing: "20 jul 1976",
        end: "nov 1982",
        site: "Chryse Planitia",
        facts: [
          "Tomó la primera fotografía a color desde la superficie de Marte.",
          "Llevó experimentos de biología para buscar vida en el suelo; sus resultados aún se debaten.",
          "Midió el clima marciano durante más de seis años.",
        ],
        trivia: "Estaba planeado para 90 días; el módulo funcionó más de 2 200.",
      },
    },
  },
  {
    id: "sojourner",
    name: "Sojourner",
    agency: "NASA",
    year: 1997,
    img: img("sojourner"),
    imgPos: "50% 55%",
    credit: "NASA/JPL",
    text: {
      en: {
        type: "Rover",
        short: "The first rover to drive on another planet — about the size of a microwave oven.",
        launch: "Dec 4, 1996",
        landing: "Jul 4, 1997",
        end: "Sep 1997",
        site: "Ares Vallis",
        facts: [
          "Rode aboard Mars Pathfinder, which landed by bouncing on airbags.",
          "Analyzed nearby rocks with an X-ray spectrometer.",
          "Operated for 83 sols on a 7-sol mission.",
        ],
        trivia: "It weighed 10.6 kg and never went more than 12 meters from the lander.",
      },
      es: {
        type: "Rover",
        short: "El primer rover en recorrer otro planeta, del tamaño de un horno de microondas.",
        launch: "4 dic 1996",
        landing: "4 jul 1997",
        end: "sep 1997",
        site: "Ares Vallis",
        facts: [
          "Viajó a bordo de Mars Pathfinder, que aterrizó rebotando sobre bolsas de aire.",
          "Analizó rocas cercanas con un espectrómetro de rayos X.",
          "Operó 83 soles en una misión planeada para 7.",
        ],
        trivia: "Pesaba 10,6 kg y nunca se alejó más de 12 metros del módulo.",
      },
    },
  },
  {
    id: "spirit",
    name: "Spirit",
    agency: "NASA",
    year: 2004,
    img: img("spirit"),
    imgPos: "50% 50%",
    credit: "NASA/JPL-Caltech/Cornell",
    text: {
      en: {
        type: "Rover",
        short: "Opportunity’s twin; found signs of ancient hot springs in Gusev crater.",
        launch: "Jun 10, 2003",
        landing: "Jan 4, 2004",
        end: "Mar 2010",
        site: "Gusev crater",
        facts: [
          "Found nearly pure silica, a sign of ancient hydrothermal activity.",
          "Drove 7.7 km on a mission planned for 90 sols.",
          "Got stuck in soft sand in 2009 and kept working as a stationary station.",
        ],
        trivia: "Dust devils cleaned its solar panels several times, extending its life.",
      },
      es: {
        type: "Rover",
        short:
          "Gemelo de Opportunity; halló señales de antiguas fuentes termales en el cráter Gusev.",
        launch: "10 jun 2003",
        landing: "4 ene 2004",
        end: "mar 2010",
        site: "Cráter Gusev",
        facts: [
          "Encontró sílice casi pura, señal de antigua actividad hidrotermal.",
          "Recorrió 7,7 km en una misión planeada para 90 soles.",
          "Quedó atascado en arena suelta en 2009 y siguió trabajando como estación fija.",
        ],
        trivia:
          "Los remolinos de polvo limpiaron sus paneles solares varias veces y alargaron su vida.",
      },
    },
  },
  {
    id: "opportunity",
    name: "Opportunity",
    agency: "NASA",
    year: 2004,
    img: img("opportunity"),
    imgPos: "50% 50%",
    credit: "NASA/JPL-Caltech",
    text: {
      en: {
        type: "Rover",
        short: "Drove more than 45 km and confirmed that liquid water once flowed at Meridiani.",
        launch: "Jul 7, 2003",
        landing: "Jan 25, 2004",
        end: "Jun 2018",
        site: "Meridiani Planum",
        facts: [
          'Found hematite spherules ("blueberries") that formed in water.',
          "Drove 45.16 km, a distance record on another world.",
          "Worked for almost 15 years until a global dust storm covered its panels.",
        ],
        trivia: "Its planned mission was 90 sols; it lasted more than 5,000.",
      },
      es: {
        type: "Rover",
        short: "Recorrió más de 45 km y confirmó que en Meridiani alguna vez fluyó agua líquida.",
        launch: "7 jul 2003",
        landing: "25 ene 2004",
        end: "jun 2018",
        site: "Meridiani Planum",
        facts: [
          "Encontró esférulas de hematita («arándanos») formadas en agua.",
          "Recorrió 45,16 km, récord de distancia en otro mundo.",
          "Trabajó casi 15 años hasta que una tormenta global de polvo cubrió sus paneles.",
        ],
        trivia: "Su misión prevista era de 90 soles; duró más de 5 000.",
      },
    },
  },
  {
    id: "phoenix",
    name: "Phoenix",
    agency: "NASA",
    year: 2008,
    img: img("phoenix"),
    imgPos: "50% 50%",
    credit: "NASA/JPL-Caltech/Univ. of Arizona",
    text: {
      en: {
        type: "Lander",
        short: "Dug into the Martian arctic and touched water ice for the first time.",
        launch: "Aug 4, 2007",
        landing: "May 25, 2008",
        end: "Nov 2008",
        site: "Vastitas Borealis",
        facts: [
          "Confirmed water ice beneath the soil near the north pole.",
          "Detected perchlorates, salts that matter for understanding habitability.",
          "Watched snow falling from Martian clouds.",
        ],
        trivia: "The photo is real: the MRO orbiter caught Phoenix descending under its parachute.",
      },
      es: {
        type: "Módulo de aterrizaje",
        short: "Excavó en el ártico marciano y tocó hielo de agua por primera vez.",
        launch: "4 ago 2007",
        landing: "25 may 2008",
        end: "nov 2008",
        site: "Vastitas Borealis",
        facts: [
          "Confirmó hielo de agua bajo el suelo cerca del polo norte.",
          "Detectó percloratos, sales clave para entender la habitabilidad.",
          "Observó nieve cayendo de las nubes marcianas.",
        ],
        trivia: "La foto es real: el orbitador MRO captó a Phoenix descendiendo con su paracaídas.",
      },
    },
  },
  {
    id: "curiosity",
    name: "Curiosity",
    agency: "NASA",
    year: 2012,
    img: img("curiosity"),
    imgPos: "50% 40%",
    credit: "NASA/JPL-Caltech/MSSS",
    text: {
      en: {
        type: "Rover",
        short: "Showed that Gale crater once held a lake that could have supported microbial life.",
        launch: "Nov 26, 2011",
        landing: "Aug 6, 2012",
        end: "Active",
        site: "Gale crater",
        facts: [
          "Was lowered by a sky crane, a maneuver never tried before.",
          "Found organic molecules in 3-billion-year-old rocks.",
          "Measured surface radiation, key for future crewed missions.",
        ],
        trivia: "Its stereo cameras built the Gale terrain meshes that MarsWalk plans routes on.",
      },
      es: {
        type: "Rover",
        short: "Demostró que el cráter Gale tuvo un lago que pudo sostener vida microbiana.",
        launch: "26 nov 2011",
        landing: "6 ago 2012",
        end: "Activa",
        site: "Cráter Gale",
        facts: [
          "Fue bajado por una grúa aérea, una maniobra nunca antes intentada.",
          "Encontró moléculas orgánicas en rocas de 3 000 millones de años.",
          "Midió la radiación en superficie, clave para futuras misiones tripuladas.",
        ],
        trivia:
          "Sus cámaras estéreo generaron las mallas de terreno de Gale sobre las que MarsWalk planifica rutas.",
      },
    },
  },
  {
    id: "insight",
    name: "InSight",
    agency: "NASA",
    year: 2018,
    img: img("insight"),
    imgPos: "50% 50%",
    credit: "NASA/JPL-Caltech",
    text: {
      en: {
        type: "Lander",
        short: "Listened to the inside of Mars: it recorded more than 1,300 marsquakes.",
        launch: "May 5, 2018",
        landing: "Nov 26, 2018",
        end: "Dec 2022",
        site: "Elysium Planitia",
        facts: [
          "Its SEIS seismometer measured the size of the Martian core.",
          "Detected meteorite impacts from the waves they produced.",
          "Its seismometer even picked up the sound of Martian wind.",
        ],
        trivia: "Dust building up on its solar panels eventually shut it down.",
      },
      es: {
        type: "Módulo de aterrizaje",
        short: "Escuchó el interior de Marte: registró más de 1 300 martemotos.",
        launch: "5 may 2018",
        landing: "26 nov 2018",
        end: "dic 2022",
        site: "Elysium Planitia",
        facts: [
          "Su sismómetro SEIS midió el tamaño del núcleo marciano.",
          "Detectó impactos de meteoritos por las ondas que produjeron.",
          "Su sismómetro incluso captó el sonido del viento marciano.",
        ],
        trivia: "El polvo acumulado en sus paneles solares terminó por apagarlo.",
      },
    },
  },
  {
    id: "perseverance",
    name: "Perseverance",
    agency: "NASA",
    year: 2021,
    img: img("perseverance"),
    imgPos: "50% 50%",
    credit: "NASA/JPL-Caltech/MSSS",
    text: {
      en: {
        type: "Rover",
        short: "Jezero crater. Searching for signs of ancient life in a dry river delta.",
        launch: "Jul 30, 2020",
        landing: "Feb 18, 2021",
        end: "Active",
        site: "Jezero crater",
        facts: [
          "Seals rock samples in tubes so they can be brought back to Earth.",
          "Its MOXIE experiment produced oxygen from atmospheric CO₂.",
          "Carries microphones that recorded the sounds of Mars.",
        ],
        trivia:
          "MOXIE made about 122 g of oxygen — enough for a small dog to breathe for 10 hours.",
      },
      es: {
        type: "Rover",
        short: "Cráter Jezero. Busca señales de vida antigua en el delta de un río seco.",
        launch: "30 jul 2020",
        landing: "18 feb 2021",
        end: "Activa",
        site: "Cráter Jezero",
        facts: [
          "Sella muestras de roca en tubos para poder traerlas a la Tierra.",
          "Su experimento MOXIE produjo oxígeno a partir del CO₂ de la atmósfera.",
          "Lleva micrófonos que grabaron los sonidos de Marte.",
        ],
        trivia:
          "MOXIE produjo unos 122 g de oxígeno: lo que respira un perro pequeño durante 10 horas.",
      },
    },
  },
  {
    id: "ingenuity",
    name: "Ingenuity",
    agency: "NASA",
    year: 2021,
    img: img("ingenuity"),
    imgPos: "50% 50%",
    credit: "NASA/JPL-Caltech/ASU/MSSS",
    text: {
      en: {
        type: "Helicopter",
        short: "The first powered, controlled flight on another planet. It flew 72 times.",
        launch: "Jul 30, 2020",
        landing: "Feb 18, 2021",
        end: "Jan 2024",
        site: "Jezero crater",
        facts: [
          "First flew on April 19, 2021.",
          "Went from a 5-flight demo to an aerial scout with 72 flights.",
          "Its rotors spin at about 2,400 rpm to stay up in air 100 times thinner than Earth’s.",
        ],
        trivia: "It carries a small swatch of fabric from the Wright brothers’ airplane.",
      },
      es: {
        type: "Helicóptero",
        short: "El primer vuelo propulsado y controlado en otro planeta. Voló 72 veces.",
        launch: "30 jul 2020",
        landing: "18 feb 2021",
        end: "ene 2024",
        site: "Cráter Jezero",
        facts: [
          "Voló por primera vez el 19 de abril de 2021.",
          "Pasó de una demostración de 5 vuelos a explorador aéreo con 72 vuelos.",
          "Sus rotores giran a unas 2 400 rpm para sostenerse en un aire 100 veces más tenue que el de la Tierra.",
        ],
        trivia: "Lleva un pequeño trozo de tela del avión de los hermanos Wright.",
      },
    },
  },
  {
    id: "zhurong",
    name: "Zhurong",
    agency: "CNSA",
    year: 2021,
    img: img("zhurong"),
    imgPos: "50% 55%",
    credit: "CNSA/PEC (CC BY 4.0)",
    text: {
      en: {
        type: "Rover",
        short: "China’s first Mars rover, part of the Tianwen-1 mission.",
        launch: "Jul 23, 2020",
        landing: "May 14, 2021",
        end: "May 2022",
        site: "Utopia Planitia",
        facts: [
          "Made China the second country to operate a rover on Mars.",
          "Its radar probed the layers beneath Utopia Planitia.",
          "Drove more than 1.9 km before hibernating for the Martian winter.",
        ],
        trivia: 'For its "selfie" it dropped a camera on the ground and drove a few meters away.',
      },
      es: {
        type: "Rover",
        short: "El primer rover marciano de China, parte de la misión Tianwen-1.",
        launch: "23 jul 2020",
        landing: "14 may 2021",
        end: "may 2022",
        site: "Utopia Planitia",
        facts: [
          "Convirtió a China en el segundo país en operar un rover en Marte.",
          "Su radar sondeó las capas bajo Utopia Planitia.",
          "Recorrió más de 1,9 km antes de hibernar durante el invierno marciano.",
        ],
        trivia: "Para su «selfie» dejó una cámara en el suelo y se alejó unos metros.",
      },
    },
  },
  {
    id: "ares",
    name: "Ares I",
    agency: "Space Rockstars",
    year: 2040,
    yearLabel: "20XX",
    img: img("ares"),
    imgPos: "50% 55%",
    concept: true,
    credit: "Photo: The Mars Society / MDRS (CC BY-SA 4.0)",
    text: {
      en: {
        type: "Base · concept",
        short:
          "This journey’s fictional base. The first walk planned with MarsWalk would start here.",
        launch: "—",
        landing: "—",
        end: "Concept",
        site: "Gale crater (fictional)",
        facts: [
          "An imagined base used to tell the future of human exploration.",
          "The photo is real: the Mars Desert Research Station in Utah, an analog habitat where crews rehearse living on Mars.",
          "Astronaut walks would be planned with MarsWalk before leaving the habitat.",
        ],
        trivia: "At MDRS, crews simulate suits, schedules and walks as if they were on Mars.",
      },
      es: {
        type: "Base · concepto",
        short:
          "La base ficticia de este recorrido. Aquí empezaría la primera caminata planeada con MarsWalk.",
        launch: "—",
        landing: "—",
        end: "Concepto",
        site: "Cráter Gale (ficticio)",
        facts: [
          "Una base imaginada para contar el futuro de la exploración humana.",
          "La foto es real: la Mars Desert Research Station en Utah, un hábitat análogo donde las tripulaciones ensayan vivir en Marte.",
          "Las caminatas de los astronautas se planearían con MarsWalk antes de salir del hábitat.",
        ],
        trivia:
          "En MDRS las tripulaciones simulan trajes, horarios y caminatas como si estuvieran en Marte.",
      },
    },
  },
];
