/**
 * PROJECT ARES — MARS MISSION ATLAS
 * Motor de Exploración 3D Multi-Misión (Access Mars WebGL / A-Frame / Three.js)
 *
 * Incluye diferenciación real por misión y sitio:
 * 1. Esculpido geomorfológico 3D de los vértices del terreno (tileMeshes, background y collision):
 *    cráteres cóncavos (Eagle, Homestead Hollow), escarpes deltaicos de 40 m (Jezero, Three Forks),
 *    cañón fluvial (Neretva Vallis / Cheyava Falls), meseta escalonada (Home Plate), colinas gemelas
 *    (Twin Peaks / Ares Vallis), dunas barján (Utopia / Ingenuity) y montículos poligonales árticos (Phoenix).
 * 2. Shaders GLSL específicos por misión para colorear regolito, afloramientos, escarcha invernal (H2O/CO2),
 *    esférulas de hematita gris, basalto olivínico y domo atmosférico.
 * 3. Hallazgos científicos físicos en 3D (rocas perforadas, tubos de titanio, trincheras de hielo y sílice,
 *    corte estratigráfico de radar RoPeR, ondas sísmicas SEIS) con etiquetas 3D interactivas sobre el terreno.
 */
(function () {
  'use strict';

  var MISSION_SITES_CATALOG = [
    {
      missionId: 'perseverance',
      missionName: 'Perseverance (Mars 2020)',
      agency: 'NASA / JPL',
      type: 'Rover Nuclear MMRTG',
      region: 'Cráter Jezero (18.38°N, 77.58°E)',
      evidenceType: 'Tipo B — DEM HiRISE + Relieve Deltaico 3D y Hallazgos In Situ',
      fogColor: '#d9a97c',
      skyTop: '#4a2c1d',
      skyBot: '#d9a97c',
      soilTint: [1.06, 0.91, 0.78],
      rockTint: [0.72, 0.76, 0.68], // Olivine-bearing Maaz/Seitah tone
      frostAmount: 0.0,
      reliefMode: 'jezero_delta',
      sites: [
        { id: 'perseverance_jezero', label: 'Octavia E. Butler Landing', sol: 'Sol 0–15', dist: '0.0 km', relief: 'jezero_landing' },
        { id: 'perseverance_three_forks', label: 'Three Forks Sample Depot', sol: 'Sol 623–690', dist: '14.3 km', relief: 'three_forks_depot' },
        { id: 'perseverance_cheyava', label: 'Cheyava Falls (Neretva Vallis)', sol: 'Sol 1215', dist: '28.9 km', relief: 'cheyava_canyon' }
      ],
      instruments: [
        { title: 'SuperCam & Mastcam-Z', sub: 'Mástil Remoto', desc: 'Espectroscopía LIBS láser hasta 7 m, Raman, luminiscencia e imágenes estéreo con zoom 3D de alta definición.', img: 'cards/rm1.jpg' },
        { title: 'Torreta PIXL & SHERLOC', sub: 'Brazo Robótico 2.1 m', desc: 'Fluorescencia de rayos X submilimétrica (PIXL) y espectrómetro Raman UV (SHERLOC) que detectaron manchas de leopardo en Cheyava Falls.', img: 'cards/rm4.jpg' },
        { title: 'MOXIE & Caché de Muestras', sub: 'Chasis Interno', desc: 'MOXIE produjo 122 g de oxígeno respirable (O2) a partir del CO2 marciano; el carrusel sella tubos de titanio para Mars Sample Return.', img: 'cards/rm2.jpg' },
        { title: 'Generador Nuclear MMRTG', sub: 'Potencia 110 W', desc: 'Generador termoeléctrico de radioisótopos alimentado con 4.8 kg de dióxido de plutonio-238.', img: 'cards/rm3.jpg' }
      ]
    },
    {
      missionId: 'curiosity',
      missionName: 'Curiosity (MSL)',
      agency: 'NASA / JPL',
      type: 'Rover Nuclear MMRTG',
      region: 'Cráter Gale / Aeolis Mons (-4.5895°N, 137.4417°E)',
      evidenceType: 'Tipo A — Fotogrametría 3D Real Navcam/Mastcam (NASA JPL OnSight)',
      fogColor: '#e1cbb2',
      skyTop: '#543c2c',
      skyBot: '#e1cbb2',
      soilTint: [1.0, 1.0, 1.0],
      rockTint: [1.0, 1.0, 1.0],
      frostAmount: 0.0,
      reliefMode: 'gale_native',
      sites: [
        { id: 'landing_site', label: 'Bradbury Landing', sol: 'Sol 0–20', dist: '0.0 km', relief: 'gale_bradbury' },
        { id: 'pahrump_hills', label: 'Pahrump Hills', sol: 'Sol 753–920', dist: '9.7 km', relief: 'gale_pahrump' },
        { id: 'marias_pass', label: 'Marias Pass (Buckskin)', sol: 'Sol 992–1067', dist: '10.8 km', relief: 'gale_marias' },
        { id: 'murray_buttes', label: 'Murray Buttes', sol: 'Sol 1448–1452', dist: '14.1 km', relief: 'gale_buttes' },
        { id: 'live_site', label: 'Vera Rubin Ridge & Boxwork', sol: 'Sol 1834–4718', dist: '36.2 km', relief: 'gale_boxwork' }
      ],
      instruments: [
        { title: 'ChemCam & Mastcam', sub: 'Mástil Remoto', desc: 'Siete cámaras y láser LIBS que vaporiza roca hasta 7 m para analizar su composición química.', img: 'cards/rm1.jpg' },
        { title: 'Brazo Robótico APXS/MAHLI', sub: 'Torreta de Perforación', desc: 'Taladro percutor rotativo, cepillo DRT, cámara microscópica MAHLI y espectrómetro APXS.', img: 'cards/rm4.jpg' },
        { title: 'Laboratorios SAM & CheMin', sub: 'Interior del Chasis', desc: 'Difracción de rayos X (CheMin) y cromatógrafo/espectrómetro de masas (SAM) que identificaron arcillas y moléculas orgánicas.', img: 'cards/rm2.jpg' }
      ]
    },
    {
      missionId: 'ingenuity',
      missionName: 'Ingenuity (Mars Helicopter)',
      agency: 'NASA / JPL / AeroVironment',
      type: 'Helicóptero Coaxial Autónomo',
      region: 'Jezero Airfield A → Valinor Hills (18.38°N, 77.58°E)',
      evidenceType: 'Tipo B — Campo de Dunas 3D Valinor Hills + Trayectoria Aérea de 72 Vuelos',
      fogColor: '#e6be8a',
      skyTop: '#3d2817',
      skyBot: '#e6be8a',
      soilTint: [1.14, 0.96, 0.72],
      rockTint: [0.95, 0.82, 0.65],
      frostAmount: 0.0,
      reliefMode: 'ingenuity_dunes',
      sites: [
        { id: 'ingenuity_airfield', label: 'Wright Brothers Field & Airfield Chi', sol: 'Vuelos 1–72 (Sol 58–1036)', dist: '17.24 km volados', relief: 'ingenuity_dunes' }
      ],
      instruments: [
        { title: 'Rotores Coaxiales de Fibra de Carbono', sub: '2,400–2,900 RPM', desc: 'Dos rotores contrarrotatorios de 1.21 m de envergadura diseñados para generar sustentación en una atmósfera con 1% de la densidad terrestre.', img: 'cards/ls1.jpg' },
        { title: 'Panel Solar & Antena UHF', sub: 'Células GaAs', desc: 'Recarga las 6 baterías Sony Li-ion y transmite telemetría por enlace radio ZigBee de 900 MHz hacia el rover Perseverance.', img: 'cards/rm5.jpg' },
        { title: 'Fuselaje Aviónico & Cámaras RTE/Navcam', sub: 'Procesador Snapdragon 801', desc: 'Cámara a color RTE de 13 MP y cámara de navegación nadir B/N a 30 fps acoplada a altímetro láser Garmin.', img: 'cards/ls2.jpg' }
      ]
    },
    {
      missionId: 'opportunity',
      missionName: 'Opportunity (MER-B)',
      agency: 'NASA / JPL',
      type: 'Rover Solar MER',
      region: 'Meridiani Planum → Cráter Endeavour (-1.9462°N, 354.4734°E)',
      evidenceType: 'Tipo B — Llanura Oscura de Hematita + Cráter Eagle 3D y Vena Homestake',
      fogColor: '#b8b2bd',
      skyTop: '#2b2836',
      skyBot: '#b8b2bd',
      soilTint: [0.62, 0.64, 0.72], // Dark gray Meridiani hematite plains!
      rockTint: [1.25, 1.12, 0.78], // Bright buff-yellow Burns sulfate outcrop!
      frostAmount: 0.0,
      reliefMode: 'eagle_crater',
      sites: [
        { id: 'opportunity_eagle', label: 'Eagle Crater (Esférulas de Hematita)', sol: 'Sol 1–60', dist: '0.0 km', relief: 'eagle_crater' },
        { id: 'opportunity_endeavour', label: 'Endeavour Crater (Cape York & Homestake)', sol: 'Sol 2681–5111', dist: '45.16 km', relief: 'endeavour_rim' }
      ],
      instruments: [
        { title: 'Mástil Pancam & Mini-TES', sub: 'Visión Estereoscópica e IR', desc: 'Cámaras panorámicas multiespectrales y espectrómetro de emisión térmica que mapearon sulfatos y hematita gris.', img: 'cards/ph1.jpg' },
        { title: 'Paneles Solares Gull-Wing', sub: 'Triple Unión GaInP/GaAs/Ge', desc: 'Alas solares desplegadas que operaron durante casi 15 años gracias a eventos de limpieza eólica.', img: 'cards/ph2.jpg' },
        { title: 'Brazo IDD (Mössbauer / APXS / RAT)', sub: 'Instrument Deployment Device', desc: 'Identificó jarosita hidratada y esférulas ricas en hematita ("blueberries") formadas en aguas subterráneas ácidas.', img: 'cards/ph3.jpg' }
      ]
    },
    {
      missionId: 'spirit',
      missionName: 'Spirit (MER-A)',
      agency: 'NASA / JPL',
      type: 'Rover Solar MER',
      region: 'Cráter Gusev / Columbia Hills (-14.5684°N, 175.4726°E)',
      evidenceType: 'Tipo B — Meseta Hidrovolcánica Home Plate 3D + Trinchera de Sílice 90%',
      fogColor: '#e09a6c',
      skyTop: '#4f2412',
      skyBot: '#e09a6c',
      soilTint: [1.18, 0.78, 0.55], // Rusty Columbia Hills ochre-red
      rockTint: [1.15, 1.05, 0.92], // Layered volcaniclastic Home Plate beds
      frostAmount: 0.0,
      reliefMode: 'home_plate',
      sites: [
        { id: 'spirit_gusev', label: 'Home Plate & Trinchera de Sílice (Columbia Hills)', sol: 'Sol 744–2210', dist: '7.73 km', relief: 'home_plate' }
      ],
      instruments: [
        { title: 'Rueda Delantera Derecha & Trinchera de Sílice', sub: 'Descubrimiento Hidrotermal', desc: 'Al arrastrar su rueda inmovilizada en el Sol 1148, Spirit dejó al descubierto un suelo con 90% de sílice opalina pura de origen hidrotermal.', img: 'cards/mp2.jpg' },
        { title: 'Mástil Pancam & Mini-TES', sub: 'Columbia Hills Panorama', desc: 'Capturó el mosaico McMurdo de 360° y caracterizó las capas piroclásticas de Home Plate.', img: 'cards/mp1.jpg' },
        { title: 'Brazo Robótico IDD', sub: 'Mössbauer / APXS / MI / RAT', desc: 'Descubrió carbonatos de magnesio-hierro en el afloramiento Comanche, prueba de aguas neutras antiguas.', img: 'cards/mp3.jpg' }
      ]
    },
    {
      missionId: 'zhurong',
      missionName: 'Zhurong (Tianwen-1)',
      agency: 'CNSA (China)',
      type: 'Rover Solar con Suspensión Activa',
      region: 'Utopia Planitia Sur (25.066°N, 109.925°E)',
      evidenceType: 'Tipo B — Dunas Eólicas Cementadas + Corte Subsuperficial Radar RoPeR 3D',
      fogColor: '#e8b882',
      skyTop: '#47301a',
      skyBot: '#e8b882',
      soilTint: [1.12, 0.94, 0.74],
      rockTint: [0.92, 0.86, 0.78],
      frostAmount: 0.08,
      reliefMode: 'utopia_radar',
      sites: [
        { id: 'zhurong_utopia', label: 'Plataforma Tianwen-1 & Corte Radar RoPeR', sol: 'Sol 1–358', dist: '1.921 km', relief: 'utopia_radar' }
      ],
      instruments: [
        { title: 'Radar Subsuperficial RoPeR (GPR)', sub: 'Doble Frecuencia 15–95 MHz y 450–2150 MHz', desc: 'Sondeó hasta 80 m de profundidad en Utopia Planitia, revelando paleopolígonos enterrados a 35 m y estratos de inundaciones episódicas.', img: 'cards/mb1.jpg' },
        { title: 'Mástil NaTeCam & Láser MarSCoDe', sub: 'Espectroscopía LIBS', desc: 'Detectó sulfatos hidratados y sílice hidratada en dunas cementadas recientes, indicando actividad de agua salina reciente.', img: 'cards/mb2.jpg' },
        { title: '4 Paneles Solares tipo Mariposa', sub: 'Recubrimiento Anti-Polvo', desc: 'Cuatro alas solares articuladas inspiradas en la mariposa azul Morpho con tratamiento oleofóbico anti-polvo.', img: 'cards/mb3.jpg' }
      ]
    },
    {
      missionId: 'sojourner',
      missionName: 'Sojourner (Mars Pathfinder)',
      agency: 'NASA / JPL',
      type: 'Micro-Rover + Estación Carl Sagan',
      region: 'Ares Vallis (19.13°N, 326.78°E)',
      evidenceType: 'Tipo B — Jardín de Rocas de Megainundación + Colinas Twin Peaks 3D',
      fogColor: '#e89d78',
      skyTop: '#592516',
      skyBot: '#e89d78',
      soilTint: [1.22, 0.76, 0.56],
      rockTint: [0.68, 0.62, 0.60],
      frostAmount: 0.0,
      reliefMode: 'ares_flood',
      sites: [
        { id: 'sojourner_ares', label: 'Carl Sagan Station (Barnacle Bill, Yogi & Twin Peaks)', sol: 'Sol 1–83', dist: '0.100 km', relief: 'ares_flood' }
      ],
      instruments: [
        { title: 'Micro-Rover Sojourner & Espectrómetro APXS', sub: '10.6 kg · 6 Ruedas Rocker-Bogie', desc: 'Primer rover en otro planeta. Su sensor APXS analizó las rocas Barnacle Bill (andesítica) y Yogi (basáltica) arrastradas por megainundaciones.', img: 'cards/ls2.jpg' },
        { title: 'Estación Carl Sagan & Bolsas de Aire', sub: 'Tetraedro con 3 Pétalos Solares', desc: 'Aterrizador tetraédrico amortiguado por bolsas de aire que desplegó tres pétalos solares y dos rampas metálicas.', img: 'cards/ls1.jpg' },
        { title: 'Mástil Estéreo IMP & Meteorología ASI/MET', sub: 'Imager for Mars Pathfinder', desc: 'Cámara estereoscópica desplegable a 1.8 m de altura y mástil meteorológico que registró remolinos de polvo (dust devils).', img: 'cards/ls3.jpg' }
      ]
    },
    {
      missionId: 'viking1',
      missionName: 'Viking 1 Lander',
      agency: 'NASA / Langley / Martin Marietta',
      type: 'Aterrizador Fijo Nuclear (2x RTG)',
      region: 'Chryse Planitia (22.27°N, 312.05°E)',
      evidenceType: 'Tipo B — Campo de Bloques Chryse + Roca Big Joe y Trincheras BIOLAB',
      fogColor: '#eb9b6a',
      skyTop: '#5e2810',
      skyBot: '#eb9b6a',
      soilTint: [1.26, 0.74, 0.48], // Classic vivid Viking orange-red Chryse regolith
      rockTint: [0.58, 0.52, 0.50], // Dark vesicular basalt boulders ("Big Joe")
      frostAmount: 0.0,
      reliefMode: 'viking1_chryse',
      sites: [
        { id: 'viking1_chryse', label: 'Thomas Mutch Station (Roca Big Joe & Trincheras)', sol: 'Sol 1–2245 (Estación Fija)', dist: '0.0 km', relief: 'viking1_chryse' }
      ],
      instruments: [
        { title: 'Brazo Colector de Muestras de 3 m', sub: 'Surface Sampler Boom', desc: 'Brazo extensible que excavó trincheras en el regolito de Chryse Planitia para alimentar los tres experimentos biológicos y el espectrómetro XRF.', img: 'cards/ph3.jpg' },
        { title: 'Laboratorios Biológicos & GCMS', sub: 'LR / GEX / PR', desc: 'El experimento Labeled Release detectó liberación de 14CO2 al añadir nutrientes, atribuida a oxidantes superóxidos y percloratos del suelo.', img: 'cards/ph2.jpg' },
        { title: 'Cámaras Facsímil Estéreo & Escudos RTG', sub: '6 Años de Operación Continua', desc: 'Capturaron la primera fotografía desde la superficie de Marte el 20 de julio de 1976 y monitorearon la roca gigante "Big Joe".', img: 'cards/ph1.jpg' }
      ]
    },
    {
      missionId: 'viking2',
      missionName: 'Viking 2 Lander',
      agency: 'NASA / Langley / Martin Marietta',
      type: 'Aterrizador Fijo Nuclear (2x RTG)',
      region: 'Utopia Planitia Norte (47.64°N, 134.29°E)',
      evidenceType: 'Tipo B — Llanura Boreal Cubierta de Escarcha Invernal H2O/CO2 + Basaltos Vesiculares',
      fogColor: '#cfd8e3',
      skyTop: '#2c3847',
      skyBot: '#cfd8e3',
      soilTint: [0.95, 0.88, 0.86],
      rockTint: [0.65, 0.68, 0.74],
      frostAmount: 0.55, // Strong winter water-ice & CO2 frost blanket on ground!
      reliefMode: 'viking2_frost',
      sites: [
        { id: 'viking2_utopia', label: 'Gerald Soffen Station (Escarcha Invernal & Surcos)', sol: 'Sol 1–1281 (Estación Fija)', dist: '0.0 km', relief: 'viking2_frost' }
      ],
      instruments: [
        { title: 'Chasis Inclinado 8.2° & Escarcha Estacional', sub: '47.64°N Utopia Planitia', desc: 'Una pata se posó sobre un bloque de basalto vesicular; durante los inviernos marcianos fotografió una capa blanca de escarcha de H2O y CO2.', img: 'cards/mp1.jpg' },
        { title: 'Brazo Excavador bajo Rocas ("Bonneville")', sub: 'Muestreo Protegido UV', desc: 'Empujó rocas superficiales para recolectar suelo protegido de la radiación solar ultravioleta para análisis orgánicos y químicos.', img: 'cards/mp3.jpg' },
        { title: 'Sismómetro de Cubierta & Mástil Meteorológico', sub: 'Registro de Vientos Boreales', desc: 'Midió velocidades de viento, presión estacional por condensación polar de CO2 y temperaturas de hasta -120 °C.', img: 'cards/mp4.jpg' }
      ]
    },
    {
      missionId: 'phoenix',
      missionName: 'Phoenix Mars Lander',
      agency: 'NASA / JPL / Univ. of Arizona / CSA',
      type: 'Aterrizador Polar Solar',
      region: 'Vastitas Borealis / Green Valley (68.2188°N, 234.2508°E)',
      evidenceType: 'Tipo B — Permafrost Poligonal Ártico 3D + Trincheras de Hielo de Agua Subsuperficial',
      fogColor: '#bfdbf7',
      skyTop: '#1b324d',
      skyBot: '#bfdbf7',
      soilTint: [0.92, 0.78, 0.74],
      rockTint: [0.85, 0.94, 1.05],
      frostAmount: 0.72, // Intense Arctic polygonal ice troughs & snow!
      reliefMode: 'phoenix_polygons',
      sites: [
        { id: 'phoenix_arctic', label: 'Green Valley Permafrost (Dodo-Goldilocks & Snow White)', sol: 'Sol 1–157 (Estación Fija)', dist: '0.0 km', relief: 'phoenix_polygons' }
      ],
      instruments: [
        { title: 'Brazo Robótico de 2.35 m & Trincheras de Hielo', sub: 'Dodo-Goldilocks & Snow White', desc: 'Excavó a solo 5 cm de profundidad dejando al descubierto hielo de agua brillante que sublimó a lo largo de 4 soles.', img: 'cards/ls2.jpg' },
        { title: 'Hornos TEGA & Laboratorio Químico MECA', sub: 'Descubrimiento de Percloratos y CaCO3', desc: 'Confirmó vapor de H2O a 0 °C mediante calorimetría diferencial y descubrió percloratos (ClO4-) y carbonato de calcio en el suelo polar.', img: 'cards/rm2.jpg' },
        { title: 'Lidar Atmosférico Canadiense (MET)', sub: 'Nubes y Nieve Marciana', desc: 'Su láser verde apuntando al cenit detectó cristales de nieve de agua precipitándose desde nubes cirros a 4 km de altitud.', img: 'cards/rm1.jpg' }
      ]
    },
    {
      missionId: 'insight',
      missionName: 'InSight Discovery Lander',
      agency: 'NASA / JPL / CNES / DLR',
      type: 'Aterrizador Geofísico Fijo',
      region: 'Elysium Planitia / Homestead Hollow (4.5024°N, 135.6234°E)',
      evidenceType: 'Tipo B — Cráter Degradado Homestead Hollow 3D + Sismómetro SEIS, Topo HP3 y Ondas Sísmicas',
      fogColor: '#d9b38c',
      skyTop: '#3b2818',
      skyBot: '#d9b38c',
      soilTint: [1.05, 0.88, 0.72],
      rockTint: [0.75, 0.68, 0.62],
      frostAmount: 0.0,
      reliefMode: 'insight_hollow',
      sites: [
        { id: 'insight_homestead', label: 'Homestead Hollow Geophysical Station (SEIS & HP3)', sol: 'Sol 1–1440 (Estación Fija)', dist: '0.0 km', relief: 'insight_hollow' }
      ],
      instruments: [
        { title: 'Sismómetro SEIS con Escudo Domo WTS', sub: '1,319 Martemotos Detectados', desc: 'Colocado directamente en el suelo por el brazo robótico IDA; registró el sismo récord S1222a (M 4.7) y midió el núcleo líquido de Marte (radio ~1,830 km).', img: 'cards/mb1.jpg' },
        { title: 'Sonda de Flujo Térmico HP3 ("El Topo")', sub: 'DLR Heat Flow Probe', desc: 'Desplegada a 1.2 m del sismómetro; el brazo robótico utilizó su pala para presionar el regolito cohesivo (duricrust) y enterrar la sonda.', img: 'cards/mb2.jpg' },
        { title: 'Paneles Solares UltraFlex & Antenas RISE', sub: '2.15 m de Diámetro cada Ala', desc: 'Dos abanicos solares circulares y transpondedores de banda X (RISE) que midieron la nutación del eje de rotación de Marte.', img: 'cards/mb3.jpg' }
      ]
    }
  ];

  function findMissionBySite(siteId) {
    for (var i = 0; i < MISSION_SITES_CATALOG.length; i++) {
      var m = MISSION_SITES_CATALOG[i];
      for (var j = 0; j < m.sites.length; j++) {
        if (m.sites[j].id === siteId) {
          return { mission: m, site: m.sites[j] };
        }
      }
    }
    return { mission: MISSION_SITES_CATALOG[1], site: MISSION_SITES_CATALOG[1].sites[0] };
  }

  function getActiveSiteFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('site') || 'perseverance_jezero';
  }

  // ============================================================================
  // 1. ESCULPIDO GEOMORFOLÓGICO 3D DEL TERRENO REAL Y SHADERS GLSL POR MISIÓN
  // ============================================================================
  function computeElevationDeltaMeters(wx, wz, reliefType) {
    // Keep a smooth flat landing pad around the spacecraft/player origin (radius < 4.5 m)
    var r = Math.sqrt(wx * wx + wz * wz);
    var padMask = Math.min(1.0, Math.max(0.0, (r - 4.2) / 5.0));
    if (padMask <= 0.001) return 0.0;

    var dy = 0.0;

    if (reliefType === 'eagle_crater') {
      // 22-meter bowl-shaped Eagle Crater: depression inside r < 14m, raised circular rim at r = 15m!
      var craterRing = Math.exp(-Math.pow((r - 15.5) / 5.2, 2)) * 3.8;
      var craterBowl = r < 15.0 ? -1.45 * (1.0 - Math.pow(r / 15.0, 2)) : 0.0;
      // NW Sulfate Outcrop ridge along inner wall
      var nwOutcrop = (wx < -3 && wz < -3) ? 1.6 * Math.exp(-Math.pow((r - 11.5) / 3.0, 2)) : 0.0;
      dy = craterRing + craterBowl + nwOutcrop;
    } else if (reliefType === 'endeavour_rim') {
      // Steep Cape York / Matijevic Hill ridge on the west (wx < -6), deep Endeavour Crater basin to the east (wx > 8)
      var ridge = wx < -4 ? Math.min(14.0, Math.abs(wx + 4) * 0.42) : -Math.min(8.0, Math.max(0, wx - 6) * 0.28);
      var valley = Math.sin(wz * 0.18) * 1.4;
      dy = ridge + valley;
    } else if (reliefType === 'jezero_landing') {
      // Towering 40-m Western Jezero Delta escarpment in the NW background (wz < -18) + Kodiak flat-topped mesa + Seitah dunes
      var deltaCliff = wz < -16 ? Math.min(18.0, Math.pow(Math.abs(wz + 16) * 0.25, 1.35)) : 0.0;
      var kodiak = Math.exp(-((wx - 22) * (wx - 22) + (wz + 26) * (wz + 26)) / 65.0) * 9.5;
      var seitahRipples = Math.sin(wx * 0.55 + wz * 0.35) * 0.55;
      dy = deltaCliff + kodiak + seitahRipples;
    } else if (reliefType === 'three_forks_depot') {
      // Flat depot terrace in foreground (|wz| < 14), steep delta front wall behind (wz < -14)
      var deltaWall = wz < -13 ? Math.min(16.0, (Math.abs(wz + 13) * 0.55)) : 0.0;
      dy = deltaWall + Math.cos(wx * 0.25) * 0.3;
    } else if (reliefType === 'cheyava_canyon') {
      // Deep Neretva Vallis river channel walls rising on both left and right sides (|wx| > 9)
      var canyonWalls = Math.abs(wx) > 8.5 ? Math.min(14.0, Math.pow((Math.abs(wx) - 8.5) * 0.38, 1.25)) : -0.4 * Math.cos(wx * 0.3);
      var terraces = Math.floor(Math.max(0, dy) * 1.5) * 0.35;
      dy = canyonWalls + Math.sin(wz * 0.22) * 0.6;
    } else if (reliefType === 'ingenuity_dunes') {
      // Sweeping golden transverse sand dunes of Valinor Hills & Wright Brothers helipad
      var duneWave = Math.sin(wx * 0.38 + Math.sin(wz * 0.18) * 2.0) * 1.85 + Math.cos(wz * 0.28) * 0.9;
      dy = duneWave;
    } else if (reliefType === 'home_plate') {
      // Raised circular volcaniclastic plateau (Home Plate) with steep step at r = 13m + Columbia Hills in background
      var plateau = (r > 6.5 && r < 18.0 && wz > -4) ? 2.1 : 0.0;
      var husbandHill = wz < -15 ? Math.exp(-Math.pow((wx - 12) / 18.0, 2)) * Math.min(16.0, Math.abs(wz + 15) * 0.48) : 0.0;
      dy = plateau + husbandHill;
    } else if (reliefType === 'utopia_radar') {
      // Smooth Utopia Planitia with bright barchan dunes and a depressed radar trench on the right
      var barchan = Math.max(0, Math.sin(wx * 0.32 + wz * 0.2)) * 1.35;
      dy = barchan;
    } else if (reliefType === 'ares_flood') {
      // Ares Vallis megaflood channel: undulating flood bars + Twin Peaks on the western horizon
      var twinPeak1 = Math.exp(-((wx + 28) * (wx + 28) + (wz + 18) * (wz + 18)) / 42.0) * 8.5;
      var twinPeak2 = Math.exp(-((wx + 19) * (wx + 19) + (wz + 26) * (wz + 26)) / 48.0) * 7.8;
      var floodWaves = Math.sin((wx + wz) * 0.4) * 0.65;
      dy = twinPeak1 + twinPeak2 + floodWaves;
    } else if (reliefType === 'viking1_chryse') {
      // Chryse Planitia wind-drifted dune fields and boulder mounds
      var driftDunes = Math.sin(wx * 0.45) * Math.cos(wz * 0.35) * 1.25;
      dy = driftDunes;
    } else if (reliefType === 'viking2_frost') {
      // Very flat northern Utopia plain with polygonal thermal contraction troughs
      var polyTrough = (Math.abs(Math.sin(wx * 0.65)) < 0.14 || Math.abs(Math.cos(wz * 0.65)) < 0.14) ? -0.38 : 0.15;
      dy = polyTrough;
    } else if (reliefType === 'phoenix_polygons') {
      // Unmistakable Arctic Polygonal Permafrost mounds (4m cells bordered by deep ice-wedge troughs!)
      var cellX = Math.sin(wx * 0.85);
      var cellZ = Math.sin(wz * 0.85);
      var mound = (Math.abs(cellX) * Math.abs(cellZ)) * 0.65 - 0.22;
      dy = mound;
    } else if (reliefType === 'insight_hollow') {
      // 27-meter circular degraded impact crater (Homestead Hollow) with low rim at r = 13.5m
      var hollowRim = Math.exp(-Math.pow((r - 13.5) / 3.8, 2)) * 1.45;
      var hollowFloor = r < 12.5 ? -0.55 * (1.0 - Math.pow(r / 12.5, 2)) : 0.0;
      dy = hollowRim + hollowFloor;
    } else if (reliefType === 'gale_boxwork') {
      // Polygonal boxwork fracture ridges on Mount Sharp + Gediz Vallis channel slope
      var boxRidge = (Math.abs(Math.sin(wx * 0.5 + wz * 0.2)) < 0.18 || Math.abs(Math.cos(wz * 0.5 - wx * 0.2)) < 0.18) ? 1.15 : 0.0;
      var mountSharpSlope = wz < -10 ? Math.min(12.0, Math.abs(wz + 10) * 0.32) : 0.0;
      dy = boxRidge + mountSharpSlope;
    }

    return dy * padMask;
  }

  function applyMissionTerrainSculptAndShader(siteId) {
    var THREE = window.THREE;
    if (!THREE) return;

    var info = findMissionBySite(siteId);
    var mission = info.mission;
    var site = info.site;
    var reliefType = site.relief || mission.reliefMode;

    var terrainEl = document.getElementById('terrain_' + siteId);
    if (!terrainEl || !terrainEl.components || !terrainEl.components['terrain']) return;
    var tComp = terrainEl.components['terrain'];
    if (terrainEl.dataset.aresSculpted === siteId) return;
    terrainEl.dataset.aresSculpted = siteId;

    // 1. Sculpt vertex geometry of all TileMeshes, BackgroundMesh, and CollisionMesh (unless native Curiosity 1-4)
    var isNativeCuriosity = (
      siteId === 'landing_site' ||
      siteId === 'pahrump_hills' ||
      siteId === 'marias_pass' ||
      siteId === 'murray_buttes'
    );

    function sculptGeometry(geom, scaleFactor) {
      if (!geom || !geom.attributes || !geom.attributes.position) return;
      var pos = geom.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var lx = pos.getX(i);
        var ly = pos.getY(i);
        var lz = pos.getZ(i);
        var wx = lx * scaleFactor;
        var wz = lz * scaleFactor;
        var deltaM = computeElevationDeltaMeters(wx, wz, reliefType);
        pos.setY(i, ly + deltaM / scaleFactor);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
    }

    if (!isNativeCuriosity) {
      if (tComp.tileMeshes && tComp.tileMeshes.length) {
        tComp.tileMeshes.forEach(function (tm) {
          if (tm && tm.mesh && tm.mesh.geometry) {
            sculptGeometry(tm.mesh.geometry, 100.0);
          }
        });
      }
      if (tComp.background && tComp.background.mesh && tComp.background.mesh.geometry) {
        sculptGeometry(tComp.background.mesh.geometry, 100.0);
      }
      if (tComp.collision && tComp.collision.mesh && tComp.collision.mesh.geometry) {
        sculptGeometry(tComp.collision.mesh.geometry, 100.0);
      }
    }

    // 2. Apply custom GLSL fragment shader tint, rock contrast, polygonal frost/ice & fog color per mission!
    var fogCol = new THREE.Color(mission.fogColor);
    var sr = mission.soilTint[0].toFixed(3);
    var sg = mission.soilTint[1].toFixed(3);
    var sb = mission.soilTint[2].toFixed(3);
    var rr = mission.rockTint[0].toFixed(3);
    var rg = mission.rockTint[1].toFixed(3);
    var rb = mission.rockTint[2].toFixed(3);
    var frostVal = mission.frostAmount.toFixed(3);

    var customFragShader = [
      'uniform sampler2D terrainTex;',
      'uniform sampler2D triangleTex;',
      'uniform sampler2D gridTex;',
      'uniform float gridOpacity;',
      'uniform float animIn;',
      'uniform vec3 fogColor;',
      'uniform float fogDensity;',
      'varying float fogDepth;',
      'varying vec2 vUV;',
      'varying vec2 gridUV;',
      'varying vec2 vLocalUV;',
      'void main() {',
      '  vec2 uv = vec2( vUV.x, 1.0 + -vUV.y );',
      '  float triangle = texture2D( triangleTex, fract( vLocalUV ) ).r;',
      '  if ( triangle >= animIn ) discard;',
      '  vec3 texCol = texture2D( terrainTex, uv ).rgb;',
      '  float lum = dot(texCol, vec3(0.299, 0.587, 0.114));',
      '  vec3 soilCol = texCol * vec3(' + sr + ', ' + sg + ', ' + sb + ');',
      '  vec3 rockCol = texCol * vec3(' + rr + ', ' + rg + ', ' + rb + ');',
      '  vec3 graded = mix(soilCol, rockCol, smoothstep(0.32, 0.68, lum));',
      '  float frostAmt = ' + frostVal + ';',
      '  if (frostAmt > 0.01) {',
      '    float polyPattern = abs(sin(vLocalUV.x * 18.0)) * abs(cos(vLocalUV.y * 18.0));',
      '    float frostMask = smoothstep(0.45, 0.78, lum + (1.0 - polyPattern) * 0.35) * frostAmt;',
      '    graded = mix(graded, vec3(0.90, 0.96, 1.0), frostMask);',
      '  }',
      '  vec3 gridCol = texture2D( gridTex, gridUV ).rgb * gridOpacity;',
      '  gl_FragColor = vec4( graded + gridCol, 1.0 );',
      '  float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );',
      '  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );',
      '}'
    ].join('\n');

    if (!isNativeCuriosity) {
      if (tComp.tileMeshes && tComp.tileMeshes.length) {
        tComp.tileMeshes.forEach(function (tm) {
          if (tm && tm.mesh && tm.mesh.material) {
            tm.mesh.material.fragmentShader = customFragShader;
            if (tm.mesh.material.uniforms && tm.mesh.material.uniforms.fogColor) {
              tm.mesh.material.uniforms.fogColor.value.copy(fogCol);
            }
            tm.mesh.material.needsUpdate = true;
          }
        });
      }
      if (tComp.background && tComp.background.mesh && tComp.background.mesh.material) {
        tComp.background.mesh.material.fragmentShader = customFragShader;
        if (tComp.background.mesh.material.uniforms && tComp.background.mesh.material.uniforms.fogColor) {
          tComp.background.mesh.material.uniforms.fogColor.value.copy(fogCol);
        }
        tComp.background.mesh.material.needsUpdate = true;
      }
    }

    // Update sky dome colors if sky-gradient component is loaded
    var skyEl = document.getElementById('sky');
    if (skyEl && skyEl.components && skyEl.components['sky-gradient']) {
      var skyMat = skyEl.components['sky-gradient'].material;
      if (skyMat && skyMat.uniforms) {
        if (skyMat.uniforms.colorTop) skyMat.uniforms.colorTop.value.set(mission.skyTop);
        if (skyMat.uniforms.colorBottom) skyMat.uniforms.colorBottom.value.set(mission.skyBot);
        skyMat.needsUpdate = true;
      }
    }
  }

  // ============================================================================
  // 2. ETIQUETAS 3D FLOTANTES EN CANVAS + HALLAZGOS FÍSICOS EN EL TERRENO
  // ============================================================================
  function make3DLabelSprite(titleText, subtitleText, accentHex) {
    var THREE = window.THREE;
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    var ctx = canvas.getContext('2d');

    // Rounded glassmorphic pill
    ctx.fillStyle = 'rgba(10, 14, 22, 0.88)';
    ctx.strokeStyle = accentHex || '#f59e0b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 128, 22);
    ctx.fill();
    ctx.stroke();

    // Badge bar
    ctx.fillStyle = accentHex || '#f59e0b';
    ctx.font = 'bold 21px -apple-system, BlinkMacSystemFont, Roboto, monospace';
    ctx.fillText('◆ HALLAZGO 3D EN SUPERFICIE', 28, 44);

    // Main title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 27px -apple-system, BlinkMacSystemFont, Roboto, sans-serif';
    ctx.fillText(titleText.slice(0, 30), 28, 84);

    // Subtitle
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px -apple-system, BlinkMacSystemFont, Roboto, monospace';
    ctx.fillText((subtitleText || '').slice(0, 42), 28, 116);

    var tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.3, 0.65, 1);
    return sprite;
  }

  // Create physical 3D geological formations, craters, trenches, sample tubes & discoveries on the surface!
  function createSiteDiscoveriesAndReliefProps(missionId, siteId) {
    var THREE = window.THREE;
    if (!THREE) return null;

    var group = new THREE.Group();
    group.name = 'ares_site_discoveries_' + siteId;

    var rustMat = new THREE.MeshStandardMaterial({ color: 0x9c5234, roughness: 0.88, metalness: 0.08 });
    var darkBasaltMat = new THREE.MeshStandardMaterial({ color: 0x2f333a, roughness: 0.75, metalness: 0.22 });
    var sulfateMat = new THREE.MeshStandardMaterial({ color: 0xd9c296, roughness: 0.65, metalness: 0.1 });
    var silicaWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf5faff, roughness: 0.25, metalness: 0.15, emissive: 0x1c3545 });
    var iceBlueMat = new THREE.MeshStandardMaterial({ color: 0xd4f1ff, roughness: 0.15, metalness: 0.3, emissive: 0x16426b });
    var titaniumMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.88 });
    var goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.8, emissive: 0x3d2200 });
    var cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.45 });

    // Helper to add a physical 3D discovery landmark + floating label + ground beacon ring
    function addDiscoveryLandmark(x, y, z, title, sub, accentColor, meshNode) {
      var wrapper = new THREE.Group();
      wrapper.position.set(x, y, z);
      if (meshNode) wrapper.add(meshNode);

      // Glowing ground target ring
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.58, 28),
        new THREE.MeshBasicMaterial({ color: accentColor || 0xf59e0b, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      wrapper.add(ring);

      // Floating 3D label above the physical discovery
      var sprite = make3DLabelSprite(title, sub, accentColor || '#f59e0b');
      sprite.position.set(0, 1.75, 0);
      wrapper.add(sprite);

      group.add(wrapper);
    }

    //Helper to draw a 3D Rover Traverse Ribbon on the ground with Sol milestones
    function addTraverseRibbon(points, hexColor) {
      var curvePoints = points.map(function (p) { return new THREE.Vector3(p[0], p[1] + 0.06, p[2]); });
      var curve = new THREE.CatmullRomCurve3(curvePoints);
      var tubeGeo = new THREE.TubeGeometry(curve, 48, 0.08, 8, false);
      var tubeMat = new THREE.MeshBasicMaterial({ color: hexColor });
      group.add(new THREE.Mesh(tubeGeo, tubeMat));
    }


    // Helper to build the 3D Landmark: Opportunity Trapped in the 2018 Global Dust Storm (Sol 5111)
    function buildOpportunity2018DustStormLandmark(posX, posZ) {
      var stormLandmark = new THREE.Group();

      // Wind-drifted ferric dust dune burying the wheels and lower chassis
      var burialDune = new THREE.Mesh(
        new THREE.ConeGeometry(2.1, 0.65, 24),
        new THREE.MeshStandardMaterial({ color: 0x8f4322, roughness: 0.95, metalness: 0.05 })
      );
      burialDune.scale.set(1.4, 0.65, 1.1);
      burialDune.position.set(0, 0.18, 0);
      stormLandmark.add(burialDune);

      // Opportunity Rover tilted 12 deg on Perseverance Valley slope with dust-covered solar panels
      var buriedRover = new THREE.Group();
      buriedRover.position.set(0, 0.12, 0);
      buriedRover.rotation.z = 0.19;
      buriedRover.rotation.x = -0.08;

      var dustCoatMat = new THREE.MeshStandardMaterial({ color: 0x9e4b28, roughness: 0.96, metalness: 0.04 });
      var dimSolarMat = new THREE.MeshStandardMaterial({ color: 0x5c3422, roughness: 0.88, metalness: 0.12 });
      var darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x3a322d, roughness: 0.7, metalness: 0.4 });

      var bWeb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.40, 0.9), dustCoatMat);
      bWeb.position.y = 0.42;
      buriedRover.add(bWeb);

      // Gull-wing solar panels covered by thick 2018 dust blanket
      var bDeck = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.04, 1.02), dimSolarMat);
      bDeck.position.y = 0.65;
      buriedRover.add(bDeck);

      var panelDustDrift = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 0.075, 16), dustCoatMat);
      panelDustDrift.scale.set(1.3, 1.0, 1.1);
      panelDustDrift.position.set(0.05, 0.68, 0.0);
      buriedRover.add(panelDustDrift);

      [-0.85, 0.85].forEach(function (zOff) {
        var bWing = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 0.72), dustCoatMat);
        bWing.position.set(-0.05, 0.65, zOff);
        buriedRover.add(bWing);
      });

      // Drooping Pancam mast in low-power fault / clock fault mode
      var bMast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.82, 14), darkMetalMat);
      bMast.position.set(0.42, 1.02, 0.18);
      buriedRover.add(bMast);
      var bHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.34), dustCoatMat);
      bHead.position.set(0.42, 1.44, 0.18);
      bHead.rotation.z = 0.38;
      buriedRover.add(bHead);

      [-0.65, 0.0, 0.65].forEach(function (xPos) {
        [-0.62, 0.62].forEach(function (zPos) {
          var bWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 16), dustCoatMat);
          bWheel.rotation.x = Math.PI / 2;
          bWheel.position.set(xPos, 0.08, zPos);
          buriedRover.add(bWheel);
        });
      });

      stormLandmark.add(buriedRover);

      // Animated 3D Swirling Dust Vortex Rings & Particles around the trapped rover
      var vortexRings = [];
      [1.35, 1.95, 2.55].forEach(function (r, idx) {
        var torus = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.035 + idx * 0.015, 10, 36),
          new THREE.MeshBasicMaterial({ color: 0xd97736, transparent: true, opacity: 0.44 - idx * 0.08 })
        );
        torus.rotation.x = Math.PI / 2 + (idx - 1) * 0.12;
        torus.position.y = 0.45 + idx * 0.55;
        stormLandmark.add(torus);
        vortexRings.push(torus);
      });

      var pGeo = new THREE.BufferGeometry();
      var pCount = 280;
      var pPositions = new Float32Array(pCount * 3);
      for (var pi = 0; pi < pCount; pi++) {
        var pAng = Math.random() * Math.PI * 2;
        var pRad = 0.4 + Math.random() * 2.8;
        pPositions[pi * 3] = Math.cos(pAng) * pRad;
        pPositions[pi * 3 + 1] = 0.15 + Math.random() * 2.6;
        pPositions[pi * 3 + 2] = Math.sin(pAng) * pRad;
      }
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      var pMat = new THREE.PointsMaterial({ color: 0xe08245, size: 0.09, transparent: true, opacity: 0.80 });
      var dustCloud = new THREE.Points(pGeo, pMat);
      stormLandmark.add(dustCloud);

      // Pulsing Red/Amber "Loss of Signal · Sol 5111" vertical telemetry beacon
      var beaconBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.14, 4.6, 12),
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.45 })
      );
      beaconBeam.position.y = 2.3;
      stormLandmark.add(beaconBeam);

      setInterval(function () {
        dustCloud.rotation.y += 0.035;
        vortexRings.forEach(function (vr, idx) {
          vr.rotation.z += (idx % 2 === 0 ? 0.04 : -0.05);
          vr.position.y = 0.45 + idx * 0.55 + Math.sin(Date.now() * 0.003 + idx) * 0.12;
        });
      }, 35);

      addDiscoveryLandmark(
        posX, 0, posZ,
        'LANDMARK · Tormenta Polvo 2018 (Sol 5111)',
        'Paneles Solares Cubiertos · Opacidad τ=10.8 · Fin de Misión',
        '#ef4444',
        stormLandmark
      );
    }

    if (siteId === 'perseverance_jezero') {
      // 1. Rochette basanite boulder with white abrasion patch & drill core hole
      var rochette = new THREE.Group();
      var rRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), rustMat);
      rRock.scale.set(1.3, 0.7, 1.0);
      rRock.position.y = 0.3;
      rochette.add(rRock);
      var abrasion = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20), silicaWhiteMat);
      abrasion.position.set(0.1, 0.55, 0.15);
      rochette.add(abrasion);
      var drillHole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), darkBasaltMat);
      drillHole.position.set(-0.12, 0.55, 0.1);
      rochette.add(drillHole);
      addDiscoveryLandmark(3.8, 0, -2.8, 'Roca Rochette (Montdenier)', '1er Núcleo Perforado · Sol 190', '#38bdf8', rochette);

      // 2. Kodiak Delta Mesa 3D formation in NW distance
      var kodiakMesa = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 10.5, 6.2, 7), sulfateMat);
      kodiakMesa.position.set(-16, 2.8, -22);
      group.add(kodiakMesa);
      addDiscoveryLandmark(-12.5, 2.5, -17.5, 'Meseta Deltaica Kodiak', 'Estratificación Fluvial Lacustre', '#f59e0b', null);

      // 3. Traverse ribbon
      addTraverseRibbon([[0, 0, 0], [1.8, 0, -1.2], [3.8, 0, -2.8], [7.5, 0, -6.5], [12.0, 0, -12.0]], 0x38bdf8);
    } else if (siteId === 'perseverance_three_forks') {
      // 10 Titanium Sample Tubes arranged in the real Three Forks zigzag depot on the ground!
      var tubeNames = [
        ['#1 Malay', -2.5, -2.5], ['#2 Skyland', -0.5, -3.8], ['#3 Bearwallow', 1.8, -2.6],
        ['#4 Montdenier', 3.9, -4.1], ['#5 Coulettes', 6.1, -2.8], ['#6 Roubion', -3.8, -6.2],
        ['#7 Crosswind', -1.2, -7.5], ['#8 Mageik', 1.5, -6.4], ['#9 Atsah', 4.2, -7.8],
        ['#10 Amalik', 6.8, -6.5]
      ];
      tubeNames.forEach(function (t) {
        var tGroup = new THREE.Group();
        var cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 16), titaniumMat);
        cyl.rotation.z = Math.PI / 2;
        cyl.position.y = 0.06;
        tGroup.add(cyl);
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 16), goldMat);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(0.2, 0.06, 0);
        tGroup.add(cap);
        addDiscoveryLandmark(t[1], 0, t[2], 'Tubo Titanio ' + t[0], 'Depósito Three Forks · MSR', '#38bdf8', tGroup);
      });
      addTraverseRibbon([[-4, 0, -1], [-2.5, 0, -2.5], [-0.5, 0, -3.8], [1.8, 0, -2.6], [3.9, 0, -4.1], [6.1, 0, -2.8]], 0x38bdf8);
    } else if (siteId === 'perseverance_cheyava') {
      // Arrowhead-shaped Cheyava Falls outcrop covered with white-and-black Leopard Spots & Calcium Sulfate veins!
      var cheyava = new THREE.Group();
      var baseRock = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.25, 4), rustMat);
      baseRock.rotation.x = Math.PI / 3;
      baseRock.position.y = 0.38;
      cheyava.add(baseRock);

      // White Calcium Sulfate veins + Leopard Spots (Vivianite/Greigite rims)
      for (var s = 0; s < 14; s++) {
        var spotRim = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 14), darkBasaltMat);
        spotRim.position.set((s % 4 - 1.5) * 0.22, 0.52 + (s % 3) * 0.08, (Math.floor(s / 4) - 1) * 0.22);
        cheyava.add(spotRim);
        var spotCore = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.025, 14), silicaWhiteMat);
        spotCore.position.copy(spotRim.position);
        spotCore.position.y += 0.005;
        cheyava.add(spotCore);
      }
      addDiscoveryLandmark(2.8, 0, -2.4, 'Roca Cheyava Falls', 'Manchas de Leopardo (Posible Biofirma · Sol 1215)', '#34d399', cheyava);

      // Neretva Vallis canyon walls on left & right
      [-11, 11].forEach(function (xWall) {
        var wall = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.2, 26), sulfateMat);
        wall.position.set(xWall, 1.8, -6);
        group.add(wall);
      });
    } else if (siteId === 'ingenuity_airfield') {
      // 3D Helical Flight Path Arc + Second Hovering Ingenuity Helicopter 3.5m in the air with laser beam!
      var flightPts = [
        [1.8, 0.1, -1.6], [1.8, 3.2, -1.6], [0.0, 4.5, -5.0],
        [-3.5, 5.2, -9.0], [-7.0, 3.8, -13.0], [-9.0, 0.2, -15.5]
      ];
      addTraverseRibbon(flightPts, 0x2dd4bf);

      // Hovering Ingenuity in mid-air at (0, 3.6, -5.0) with green Garmin laser altimeter beam
      var hoverHelo = createMissionCraftMesh('ingenuity', siteId);
      if (hoverHelo) {
        hoverHelo.position.set(-1.8, 3.4, -3.4);
        var laserBeam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.18, 3.4, 12),
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.35 })
        );
        laserBeam.position.set(1.8, -1.7, -1.6);
        hoverHelo.add(laserBeam);
        group.add(hoverHelo);
      }
      addDiscoveryLandmark(0.0, 0, -5.0, 'Zona de Vuelo Wright Bros Field', '72 Vuelos · 17.24 km · Altímetro Láser', '#2dd4bf', null);
    } else if (siteId === 'opportunity_eagle') {
      // 1. 360-degree Eagle Crater Rim & Layered Burns Sulfate Outcrop Wall + 80 Hematite Blueberries on the floor!
      for (var seg = 0; seg < 10; seg++) {
        var ang = -Math.PI * 0.85 + (seg / 9) * Math.PI * 0.95;
        var slab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.85), sulfateMat);
        slab.position.set(Math.cos(ang) * 9.5, 0.42, Math.sin(ang) * 9.5);
        slab.rotation.y = -ang + Math.PI / 2;
        slab.rotation.z = 0.18;
        group.add(slab);
      }
      addDiscoveryLandmark(-6.2, 0.4, -6.2, 'Afloramiento de Sulfatos Eagle Crater', 'Jarosita y Estratificación Cruzada (Sol 1–60)', '#eab308', null);

      // Hematite Spherules ("Blueberries") cluster
      var berryCluster = new THREE.Group();
      for (var b = 0; b < 45; b++) {
        var bx = (Math.sin(b * 12.7) * 1.4);
        var bz = (Math.cos(b * 9.3) * 1.4);
        var berry = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.85, roughness: 0.2 }));
        berry.position.set(bx, 0.045, bz);
        berryCluster.add(berry);
      }
      addDiscoveryLandmark(3.2, 0, -2.6, 'Esférulas de Hematita ("Blueberries")', 'Concreciones Diagenéticas Acuosas · Mössbauer', '#38bdf8', berryCluster);
      buildOpportunity2018DustStormLandmark(4.6, 1.8);
    } else if (siteId === 'opportunity_endeavour') {
      // 1. Bright White Homestake Gypsum Vein snaking across the dark bedrock
      var vein = new THREE.Group();
      for (var v = 0; v < 8; v++) {
        var segV = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.14), silicaWhiteMat);
        segV.position.set(v * 0.38 - 1.2, 0.04, Math.sin(v * 0.8) * 0.25);
        segV.rotation.y = Math.cos(v * 0.8) * 0.3;
        vein.add(segV);
      }
      addDiscoveryLandmark(3.0, 0, -2.5, 'Vena de Yeso "Homestake"', 'Sulfato de Calcio Hidratado Puro · Cape York', '#eab308', vein);

      // 2. Heat Shield Rock (Iron-Nickel Meteorite)
      var meteorite = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 1),
        new THREE.MeshStandardMaterial({ color: 0x3f444c, metalness: 0.92, roughness: 0.22 })
      );
      meteorite.position.y = 0.32;
      addDiscoveryLandmark(-3.5, 0, -3.8, 'Meteorito Heat Shield Rock', '1er Meteorito de Hierro-Níquel en Marte', '#38bdf8', meteorite);
      buildOpportunity2018DustStormLandmark(4.2, 1.8);
    } else if (siteId === 'spirit_gusev') {
      // 1. Home Plate Layered Hydrovolcanic Plateau Cliff + Dazzling White 90% Opaline Silica Trench!
      var homePlateMesa = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 1.4, 8), sulfateMat);
      homePlateMesa.position.set(-6.5, 0.65, -7.5);
      group.add(homePlateMesa);
      addDiscoveryLandmark(-5.0, 1.1, -5.8, 'Meseta Hidrovolcánica Home Plate', 'Depósitos Piroclásticos Estratificados · Sol 744', '#fb923c', null);

      // 2. Gertrude Weise 90% Opaline Silica White Trench right next to Spirit
      var silicaGroup = new THREE.Group();
      var trenchBed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.55), silicaWhiteMat);
      trenchBed.position.y = 0.04;
      silicaGroup.add(trenchBed);
      for (var n = 0; n < 8; n++) {
        var nodule = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), silicaWhiteMat);
        nodule.position.set((n - 3.5) * 0.18, 0.1, (n % 2 - 0.5) * 0.2);
        silicaGroup.add(nodule);
      }
      addDiscoveryLandmark(2.8, 0, -1.1, 'Trinchera de Sílice Opalina (90% SiO2)', 'Manantial Hidrotermal Antiguo · Gertrude Weise', '#34d399', silicaGroup);

      // 3. Comanche Mg-Fe Carbonate Outcrop
      var comanche = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), rustMat);
      comanche.scale.set(1.5, 0.8, 1.1);
      comanche.position.y = 0.35;
      addDiscoveryLandmark(-2.8, 0, 2.6, 'Afloramiento de Carbonatos Comanche', '16–34% Carbonato de Mg-Fe · Aguas Neutras', '#f59e0b', comanche);
    } else if (siteId === 'zhurong_utopia') {
      // 1. 3D Cutaway Subsurface Radar Trench (RoPeR GPR Cross-Section showing 35m buried polygons & 80m flood layers!)
      var radarCutaway = new THREE.Group();
      var layer1 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.9), rustMat);
      layer1.position.y = 0.95;
      radarCutaway.add(layer1);
      var layer2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.45, 0.9), sulfateMat);
      layer2.position.y = 0.55;
      radarCutaway.add(layer2);
      var layer3 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.45, 0.9), darkBasaltMat);
      layer3.position.y = 0.15;
      radarCutaway.add(layer3);
      var radarWire = new THREE.Mesh(new THREE.BoxGeometry(3.68, 1.25, 0.95), cyanGlowMat);
      radarWire.position.y = 0.55;
      radarCutaway.add(radarWire);
      addDiscoveryLandmark(-2.8, 0, 2.2, 'Corte 3D Radar Subsuperficial RoPeR', 'Paleopolígonos Enterrados (-35m) e Inundaciones (-80m)', '#f43f5e', radarCutaway);

      // 2. Cemented Hydrated Transverse Eolian Ridge (Barchan Dune)
      var dune = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.85, 16), sulfateMat);
      dune.scale.set(1.8, 0.6, 0.9);
      dune.position.y = 0.25;
      addDiscoveryLandmark(4.5, 0, 2.8, 'Duna Eólica Hidratada (MarSCoDe)', 'Sulfatos y Sílice por Escarcha Salina Moderna', '#38bdf8', dune);
    } else if (siteId === 'sojourner_ares') {
      // Ares Vallis Rock Garden: Barnacle Bill, Yogi, Couch, Half Dome + Deflated Landing Airbags!
      var yogi = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), rustMat);
      yogi.scale.set(1.4, 1.1, 1.2);
      yogi.position.y = 0.55;
      addDiscoveryLandmark(3.8, 0, -3.5, 'Roca "Yogi" (Basalto Primitivo)', 'Inspeccionada por Sojourner APXS · Sol 10', '#fbbf24', yogi);

      var barnacle = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), darkBasaltMat);
      barnacle.position.y = 0.28;
      addDiscoveryLandmark(2.1, 0, -1.2, 'Roca "Barnacle Bill" (Andesita)', 'Rica en Sílice · 1er Análisis APXS (Sol 3)', '#34d399', barnacle);

      // Deflated airbags around Carl Sagan Station
      var airbags = new THREE.Group();
      for (var a = 0; a < 6; a++) {
        var lobe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), sulfateMat);
        lobe.scale.set(1.3, 0.35, 1.1);
        lobe.position.set(Math.cos(a) * 1.5, 0.12, Math.sin(a) * 1.5);
        airbags.add(lobe);
      }
      addDiscoveryLandmark(-2.5, 0, -2.5, 'Estación Carl Sagan & Airbags', '3 Pétalos Solares Desplegados · 4 jul 1997', '#f59e0b', airbags);
    } else if (siteId === 'viking1_chryse') {
      // 1. Giant 2-meter "Big Joe" vesicular basalt boulder
      var bigJoe = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), darkBasaltMat);
      bigJoe.scale.set(1.5, 0.95, 1.2);
      bigJoe.position.y = 0.85;
      addDiscoveryLandmark(-4.2, 0, -5.2, 'Roca Gigante "Big Joe" (2 m)', 'Bloque Basáltico Vesicular en Chryse Planitia', '#f87171', bigJoe);

      // 2. Three excavated Surface Sampler trenches in front of Viking 1
      var vTrenches = new THREE.Group();
      [-0.35, 0.0, 0.35].forEach(function (zOff) {
        var tr = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.18), darkBasaltMat);
        tr.position.set(0, 0.03, zOff);
        vTrenches.add(tr);
      });
      addDiscoveryLandmark(3.5, 0, -1.6, 'Trincheras de Muestreo BIOLAB', 'Experimento Labeled Release (14CO2) · Sol 8', '#fbbf24', vTrenches);
    } else if (siteId === 'viking2_utopia') {
      // 1. Frost-covered vesicular basalt field & pushed rock "Bonneville"
      var frostField = new THREE.Group();
      for (var r = 0; r < 14; r++) {
        var angR = r * 0.9;
        var distR = 1.2 + (r % 4) * 0.85;
        var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), darkBasaltMat);
        rock.position.set(Math.cos(angR) * distR, 0.18, Math.sin(angR) * distR);
        frostField.add(rock);
        var iceCap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.03, 10), silicaWhiteMat);
        iceCap.position.set(Math.cos(angR) * distR, 0.02, Math.sin(angR) * distR);
        frostField.add(iceCap);
      }
      addDiscoveryLandmark(3.6, 0, -1.4, 'Escarcha Invernal H2O/CO2 y Roca Bonneville', 'Muestreo Bajo Rocas Protegido de UV · 47.64°N', '#38bdf8', frostField);
    } else if (siteId === 'phoenix_arctic') {
      // 1. Dodo-Goldilocks & Snow White Water-Ice Trenches + Polygonal Ice-Wedge Troughs + Falling Martian Snow!
      var iceTrenches = new THREE.Group();
      var soilRim = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.95), rustMat);
      soilRim.position.y = 0.04;
      iceTrenches.add(soilRim);
      var exposedIce = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.62), iceBlueMat);
      exposedIce.position.y = 0.06;
      iceTrenches.add(exposedIce);
      addDiscoveryLandmark(3.6, 0, -1.5, 'Trincheras Dodo-Goldilocks & Snow White', 'Hielo de Agua Subsuperficial a 5 cm (68.22°N)', '#38bdf8', iceTrenches);

      // 2. Canadian LiDAR Green Laser Zenith Beam detecting Martian Snowfall!
      var lidarBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 18.0, 12),
        new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.55 })
      );
      lidarBeam.position.set(1.65, 9.5, -2.05);
      group.add(lidarBeam);
      addDiscoveryLandmark(-3.2, 0, -3.5, 'Permafrost Poligonal & LiDAR Nieve', 'Percloratos (0.6% ClO4-), CaCO3 y Nieve en Cirros', '#60a5fa', null);
    } else if (siteId === 'insight_homestead') {
      // 1. SEIS Seismometer Dome emitting animated 3D Seismic Wave Rings (1,319 Marsquakes / M4.7 S1222a!)
      var seisWaveGroup = new THREE.Group();
      var waveRings = [];
      [0.8, 1.5, 2.2].forEach(function (rad) {
        var wRing = new THREE.Mesh(
          new THREE.RingGeometry(rad, rad + 0.08, 36),
          new THREE.MeshBasicMaterial({ color: 0xc084fc, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
        );
        wRing.rotation.x = -Math.PI / 2;
        wRing.position.y = 0.04;
        seisWaveGroup.add(wRing);
        waveRings.push(wRing);
      });
      setInterval(function () {
        waveRings.forEach(function (wr, idx) {
          var s = 1.0 + ((Date.now() * 0.001 + idx * 0.33) % 1.0) * 1.4;
          wr.scale.set(s, s, 1);
          wr.material.opacity = Math.max(0.05, 0.85 * (1.0 - (s - 1.0) / 1.4));
        });
      }, 40);
      addDiscoveryLandmark(3.85, 0, -0.95, 'Sismómetro SEIS & Ondas Sísmicas', '1,319 Martemotos · Núcleo Líquido 1,830 km', '#c084fc', seisWaveGroup);

      // 2. HP3 Heat Flow Probe ("El Topo") & Duricrust Trench
      addDiscoveryLandmark(4.15, 0, -2.35, 'Sonda Térmica HP3 ("El Topo")', 'Costra Cementada (Duricrust) en Homestead Hollow', '#f59e0b', null);
    } else if (siteId === 'live_site') {
      // Curiosity Vera Rubin Ridge & Mount Sharp Boxwork + Gediz Vallis Pure Elemental Sulfur!
      var sulfurCluster = new THREE.Group();
      for (var sc = 0; sc < 7; sc++) {
        var sRock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.18, 0),
          new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.3, metalness: 0.1, emissive: 0x3b2f00 })
        );
        sRock.position.set((sc - 3) * 0.22, 0.14, (sc % 2) * 0.22);
        sulfurCluster.add(sRock);
      }
      addDiscoveryLandmark(3.5, 0, -2.5, 'Cristales de Azufre Elemental Puro', 'Canal Gediz Vallis & Red Boxwork · Mount Sharp', '#fde047', sulfurCluster);
    }

    return group;
  }

  // ============================================================================
  // 3. CONSTRUCCIÓN DE LOS VEHÍCULOS / ROVERS / LANDERS / HELICÓPTERO EN 3D
  // ============================================================================
  function createMissionCraftMesh(missionId, siteId) {
    var THREE = window.THREE;
    if (!THREE) return null;

    var group = new THREE.Group();
    group.name = 'mission_custom_craft_' + missionId;

    var goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a238, metalness: 0.75, roughness: 0.28 });
    var alumMat = new THREE.MeshStandardMaterial({ color: 0xdce2e8, metalness: 0.65, roughness: 0.35 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x22272e, metalness: 0.5, roughness: 0.5 });
    var solarMat = new THREE.MeshStandardMaterial({ color: 0x162b4d, metalness: 0.8, roughness: 0.2 });
    var whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, metalness: 0.25, roughness: 0.45 });
    var copperMat = new THREE.MeshStandardMaterial({ color: 0xb86b35, metalness: 0.6, roughness: 0.35 });
    var rustMat = new THREE.MeshStandardMaterial({ color: 0x9c5a3c, metalness: 0.1, roughness: 0.88 });
    var iceMat = new THREE.MeshStandardMaterial({ color: 0xe6f5ff, metalness: 0.15, roughness: 0.2, emissive: 0x183048 });

    var sunLight = new THREE.DirectionalLight(0xfff0dd, 1.35);
    sunLight.position.set(8, 16, 10);
    group.add(sunLight);
    var ambLight = new THREE.AmbientLight(0xd9b392, 0.75);
    group.add(ambLight);

    if (missionId === 'ingenuity') {
      var helo = new THREE.Group();
      helo.position.set(1.8, 0.0, -1.6);
      helo.scale.set(1.5, 1.5, 1.5);

      var body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.28), alumMat);
      body.position.y = 0.42;
      helo.add(body);

      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 16), darkMat);
      mast.position.y = 0.75;
      helo.add(mast);

      var rotor1 = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.012, 0.11), darkMat);
      rotor1.position.y = 0.86;
      helo.add(rotor1);

      var rotor2 = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.012, 0.11), darkMat);
      rotor2.position.y = 0.96;
      rotor2.rotation.y = Math.PI / 3;
      helo.add(rotor2);

      var panel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.015, 0.18), solarMat);
      panel.position.y = 1.05;
      helo.add(panel);

      var legAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
      legAngles.forEach(function (ang) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 8), darkMat);
        leg.position.set(Math.cos(ang) * 0.25, 0.21, Math.sin(ang) * 0.25);
        leg.rotation.z = -Math.cos(ang) * 0.52;
        leg.rotation.x = Math.sin(ang) * 0.52;
        helo.add(leg);
      });

      setInterval(function () {
        rotor1.rotation.y += 0.18;
        rotor2.rotation.y -= 0.18;
      }, 30);

      group.add(helo);
    } else if (missionId === 'opportunity' || missionId === 'spirit') {
      var mer = new THREE.Group();
      mer.position.set(2.2, 0.0, -1.8);
      mer.rotation.y = -0.6;

      var web = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.9), goldMat);
      web.position.y = 0.62;
      mer.add(web);

      var deckCenter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 1.0), solarMat);
      deckCenter.position.y = 0.85;
      mer.add(deckCenter);

      [-0.85, 0.85].forEach(function (zOff) {
        var wing = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.025, 0.72), solarMat);
        wing.position.set(-0.05, 0.85, zOff);
        mer.add(wing);
      });

      var tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.025, 0.65), solarMat);
      tailWing.position.set(-0.88, 0.85, 0);
      mer.add(tailWing);

      var pMast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.85, 16), alumMat);
      pMast.position.set(0.42, 1.25, 0.18);
      mer.add(pMast);
      var pHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.34), whiteMat);
      pHead.position.set(0.42, 1.68, 0.18);
      mer.add(pHead);

      var arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 12), alumMat);
      arm1.position.set(0.75, 0.45, 0.15);
      arm1.rotation.z = 0.75;
      mer.add(arm1);
      var turret = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 16), darkMat);
      turret.position.set(1.02, 0.22, 0.15);
      mer.add(turret);

      [-0.65, 0.0, 0.65].forEach(function (xPos) {
        [-0.62, 0.62].forEach(function (zPos) {
          var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 20), darkMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(xPos, 0.18, zPos);
          mer.add(wheel);
          var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.17, 16), goldMat);
          hub.rotation.x = Math.PI / 2;
          hub.position.set(xPos, 0.18, zPos);
          mer.add(hub);
        });
      });

      group.add(mer);
    } else if (missionId === 'zhurong') {
      var zhu = new THREE.Group();
      zhu.position.set(2.3, 0.0, -1.5);
      zhu.rotation.y = -0.5;

      var zBody = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.48, 0.95), goldMat);
      zBody.position.y = 0.65;
      zhu.add(zBody);

      [
        [0.2, 0.72, 0.3],
        [0.2, -0.72, -0.3],
        [-0.55, 0.62, 0.5],
        [-0.55, -0.62, -0.5]
      ].forEach(function (cfg) {
        var bWing = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.02, 8), solarMat);
        bWing.position.set(cfg[0], 0.91, cfg[1]);
        bWing.rotation.y = cfg[2];
        zhu.add(bWing);
      });

      var zMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 16), alumMat);
      zMast.position.set(0.48, 1.32, 0.0);
      zhu.add(zMast);
      var zHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.36), whiteMat);
      zHead.position.set(0.48, 1.75, 0.0);
      zhu.add(zHead);

      [-0.68, 0.0, 0.68].forEach(function (xPos) {
        [-0.64, 0.64].forEach(function (zPos) {
          var w = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.17, 20), alumMat);
          w.rotation.x = Math.PI / 2;
          w.position.set(xPos, 0.19, zPos);
          zhu.add(w);
        });
      });
      group.add(zhu);

      var tLander = new THREE.Group();
      tLander.position.set(-4.5, 0.0, -5.5);
      var deck = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.55, 8), alumMat);
      deck.position.y = 0.65;
      tLander.add(deck);
      var ramp1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.32), goldMat);
      ramp1.position.set(1.9, 0.32, 0.42);
      ramp1.rotation.z = -0.28;
      tLander.add(ramp1);
      var ramp2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.32), goldMat);
      ramp2.position.set(1.9, 0.32, -0.42);
      ramp2.rotation.z = -0.28;
      tLander.add(ramp2);
      group.add(tLander);
    } else if (missionId === 'sojourner') {
      var soj = new THREE.Group();
      soj.position.set(1.6, 0.0, -1.2);
      soj.rotation.y = 0.4;

      var sBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.48), goldMat);
      sBody.position.y = 0.24;
      soj.add(sBody);
      var sSolar = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.02, 0.46), solarMat);
      sSolar.position.y = 0.34;
      soj.add(sSolar);

      [-0.24, 0.0, 0.24].forEach(function (xPos) {
        [-0.26, 0.26].forEach(function (zPos) {
          var sw = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 16), alumMat);
          sw.rotation.x = Math.PI / 2;
          sw.position.set(xPos, 0.08, zPos);
          soj.add(sw);
        });
      });
      group.add(soj);

      var pathfinder = new THREE.Group();
      pathfinder.position.set(-2.5, 0.0, -2.5);
      for (var p = 0; p < 3; p++) {
        var ang = (p * 2 * Math.PI) / 3;
        var petal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.05, 3), solarMat);
        petal.position.set(Math.cos(ang) * 1.15, 0.12, Math.sin(ang) * 1.15);
        petal.rotation.y = -ang;
        pathfinder.add(petal);
      }
      var impMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 12), alumMat);
      impMast.position.set(0, 0.85, 0);
      pathfinder.add(impMast);
      var impHead = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 16), whiteMat);
      impHead.position.set(0, 1.65, 0);
      pathfinder.add(impHead);
      group.add(pathfinder);
    } else if (missionId === 'viking1' || missionId === 'viking2') {
      var vik = new THREE.Group();
      vik.position.set(2.0, 0.0, -1.8);
      if (missionId === 'viking2') {
        vik.rotation.z = 0.14;
      }

      var hexBody = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.46, 6), whiteMat);
      hexBody.position.y = 0.72;
      vik.add(hexBody);

      [-0.45, 0.45].forEach(function (zPos) {
        var rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.58, 12), alumMat);
        rtg.position.set(-0.35, 1.18, zPos);
        vik.add(rtg);
      });

      [-0.32, 0.32].forEach(function (zPos) {
        var fCam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 16), whiteMat);
        fCam.position.set(0.62, 1.16, zPos);
        vik.add(fCam);
      });

      var dish = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.18, 20, 1, true), whiteMat);
      dish.position.set(-0.55, 1.62, 0.0);
      dish.rotation.z = -0.6;
      vik.add(dish);

      for (var l = 0; l < 3; l++) {
        var lAng = (l * 2 * Math.PI) / 3;
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 1.05, 10), alumMat);
        leg.position.set(Math.cos(lAng) * 1.1, 0.45, Math.sin(lAng) * 1.1);
        leg.rotation.z = -Math.cos(lAng) * 0.45;
        leg.rotation.x = Math.sin(lAng) * 0.45;
        vik.add(leg);
        var pad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.06, 16), goldMat);
        pad.position.set(Math.cos(lAng) * 1.35, 0.03, Math.sin(lAng) * 1.35);
        vik.add(pad);
      }

      var boom = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 12), goldMat);
      boom.position.set(1.65, 0.42, 0.1);
      boom.rotation.z = 1.32;
      vik.add(boom);

      group.add(vik);
    } else if (missionId === 'phoenix') {
      var phx = new THREE.Group();
      phx.position.set(2.0, 0.0, -1.8);

      var pDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.42, 8), copperMat);
      pDeck.position.y = 0.68;
      phx.add(pDeck);

      [-1.75, 1.75].forEach(function (zPos) {
        var fan = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.025, 10), solarMat);
        fan.position.set(0.0, 0.85, zPos);
        phx.add(fan);
      });

      var pArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.85, 12), alumMat);
      pArm.position.set(1.35, 0.52, 0.25);
      pArm.rotation.z = 1.15;
      phx.add(pArm);

      var metMast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 12), whiteMat);
      metMast.position.set(-0.35, 1.4, -0.25);
      phx.add(metMast);

      group.add(phx);
    } else if (missionId === 'insight') {
      var ins = new THREE.Group();
      ins.position.set(2.0, 0.0, -1.8);

      var iDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.42, 12), goldMat);
      iDeck.position.y = 0.68;
      ins.add(iDeck);

      [-1.85, 1.85].forEach(function (zPos) {
        var uFlex = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.025, 24), solarMat);
        uFlex.position.set(0.0, 0.85, zPos);
        ins.add(uFlex);
      });

      var idaArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.65, 12), alumMat);
      idaArm.position.set(1.1, 0.95, 0.15);
      idaArm.rotation.z = 0.85;
      ins.add(idaArm);

      var seisDome = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.28, 12), whiteMat);
      seisDome.position.set(1.85, 0.14, 0.85);
      ins.add(seisDome);
      var seisSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.06, 12), goldMat);
      seisSkirt.position.set(1.85, 0.03, 0.85);
      ins.add(seisSkirt);

      var hp3Box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), darkMat);
      hp3Box.position.set(2.15, 0.22, -0.55);
      ins.add(hp3Box);

      group.add(ins);
    }

    return group;
  }

  function spawnMission3DCraftOnScene() {
    var sceneEl = document.getElementById('scene');
    var terrainContainer = document.getElementById('terrain-container');
    var roverMarkers = document.getElementById('rover-markers');
    if (!sceneEl || !terrainContainer) return;

    var siteId = getActiveSiteFromUrl();
    var info = findMissionBySite(siteId);
    var mission = info.mission;

    // 1. Update atmospheric exponential fog
    sceneEl.setAttribute('fog', 'type: exponential; color: ' + mission.fogColor + '; density: 0.011');

    // 2. Sculpt 3D terrain vertices & apply custom mission GLSL shader
    applyMissionTerrainSculptAndShader(siteId);

    // 3. Remove previous custom craft & discoveries if switching
    ['custom-mission-craft-entity', 'custom-mission-discoveries-entity'].forEach(function (id) {
      var prev = document.getElementById(id);
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    });

    // 4. Spawn 3D Spacecraft / Rover / Lander / Helicopter
    if (mission.missionId === 'curiosity' || mission.missionId === 'perseverance') {
      var roverEl = document.getElementById('rover');
      if (!roverEl) {
        roverEl = document.createElement('a-entity');
        roverEl.id = 'rover';
        roverEl.setAttribute('rover', '');
        roverEl.setAttribute('rotation', '0 90 0');
        terrainContainer.appendChild(roverEl);
      }
      roverEl.setAttribute('visible', true);
      setTimeout(function () {
        roverEl.addState('complete');
        if (roverMarkers) {
          roverMarkers.setAttribute('visible', true);
          roverMarkers.classList.remove('invisible');
        }
      }, 900);
    } else {
      var existingRover = document.getElementById('rover');
      if (existingRover) existingRover.setAttribute('visible', false);
      if (roverMarkers) roverMarkers.setAttribute('visible', false);

      var craftMesh = createMissionCraftMesh(mission.missionId, siteId);
      if (craftMesh) {
        var craftEl = document.createElement('a-entity');
        craftEl.id = 'custom-mission-craft-entity';
        craftEl.setObject3D('mesh', craftMesh);
        terrainContainer.appendChild(craftEl);
      }
    }

    // 5. Spawn physical 3D Geological Discoveries & Relief Landmarks on the surface!
    var discGroup = createSiteDiscoveriesAndReliefProps(mission.missionId, siteId);
    if (discGroup) {
      var discEl = document.createElement('a-entity');
      discEl.id = 'custom-mission-discoveries-entity';
      discEl.setObject3D('mesh', discGroup);
      terrainContainer.appendChild(discEl);
    }
  }

  // Minimalist, non-intrusive collapsible drawer that NEVER blocks the 3D VR raycaster or camera drag
  function buildFloating3DMissionHud() {
    var siteId = getActiveSiteFromUrl();
    var info = findMissionBySite(siteId);
    var activeMission = info.mission;
    var activeSite = info.site;
    var isEmbedded = false;
    try { isEmbedded = (window.self !== window.top); } catch (e) { isEmbedded = true; }

    var hud = document.createElement('div');
    hud.id = 'ares-3d-mission-hud';
    hud.innerHTML =
      '<style>' +
      '#ares-3d-mission-hud { position: fixed; bottom: 16px; left: 16px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f8fafc; user-select: none; pointer-events: none; }' +
      '.ares-fab-row { display: flex; align-items: center; gap: 8px; pointer-events: auto; }' +
      '.ares-fab-btn { display: inline-flex; align-items: center; gap: 8px; background: rgba(10, 14, 23, 0.78); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(245, 158, 11, 0.45); color: #f8fafc; padding: 7px 13px; border-radius: 999px; font-size: 11.5px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.45); transition: all 0.18s ease; }' +
      '.ares-fab-btn:hover { background: rgba(245, 158, 11, 0.22); border-color: #f59e0b; transform: translateY(-1px); }' +
      '.ares-fab-chip { display: inline-flex; align-items: center; gap: 6px; background: rgba(10, 14, 23, 0.68); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.14); color: #cbd5e1; padding: 6px 11px; border-radius: 999px; font-size: 11px; font-weight: 600; pointer-events: auto; }' +
      '.ares-drawer { display: none; margin-bottom: 10px; width: min(460px, calc(100vw - 32px)); max-height: min(68vh, 520px); overflow-y: auto; background: rgba(10, 14, 22, 0.92); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 16px; padding: 14px; box-shadow: 0 20px 48px rgba(0,0,0,0.7); pointer-events: auto; }' +
      '.ares-drawer.open { display: block; }' +
      '.ares-drawer-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 10px; }' +
      '.ares-drawer-sec { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; margin: 10px 0 6px; }' +
      '.ares-grid-pills { display: flex; flex-wrap: wrap; gap: 5px; }' +
      '.ares-mission-pill { background: rgba(30, 41, 59, 0.85); color: #e2e8f0; border: 1px solid rgba(148, 163, 184, 0.24); border-radius: 8px; padding: 5px 9px; font-size: 11px; font-weight: 600; cursor: pointer; transition: 0.15s; }' +
      '.ares-mission-pill:hover { border-color: #f59e0b; color: #fff; }' +
      '.ares-mission-pill.active { background: #f59e0b; border-color: #fbbf24; color: #190e04; font-weight: 700; }' +
      '.ares-site-btn { background: rgba(15, 23, 42, 0.9); color: #cbd5e1; border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 7px; padding: 5px 9px; font-size: 11px; cursor: pointer; }' +
      '.ares-site-btn.active { background: rgba(56, 189, 248, 0.22); color: #38bdf8; border-color: #38bdf8; font-weight: 700; }' +
      '.ares-inst-btn { background: rgba(234, 179, 8, 0.14); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 7px; padding: 5px 9px; font-size: 11px; font-weight: 600; cursor: pointer; }' +
      '.ares-inst-btn:hover { background: rgba(234, 179, 8, 0.28); }' +
      '</style>' +
      '<div class="ares-drawer" id="ares-3d-drawer">' +
        '<div class="ares-drawer-header">' +
          '<div>' +
            '<div style="font-size:13px;font-weight:700;color:#fff;">' + activeMission.missionName + ' — ' + activeSite.label + '</div>' +
            '<div style="font-size:10.5px;color:#94a3b8;">' + activeMission.agency + ' · ' + activeMission.region + '</div>' +
          '</div>' +
          '<button id="ares-drawer-close" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#cbd5e1;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">✕ Cerrar</button>' +
        '</div>' +
        '<div class="ares-drawer-sec">Inspeccionar Instrumentos 3D en Escena</div>' +
        '<div class="ares-grid-pills" id="ares-inst-pills-row"></div>' +
        '<div class="ares-drawer-sec">Sitios 3D de ' + activeMission.missionName.split(' (')[0] + '</div>' +
        '<div class="ares-grid-pills" id="ares-site-pills-row"></div>' +
        '<div class="ares-drawer-sec">Cambiar de Misión (11 Misiones)</div>' +
        '<div class="ares-grid-pills" id="ares-mission-pills-row"></div>' +
      '</div>' +
      '<div class="ares-fab-row">' +
        '<button class="ares-fab-btn" id="ares-fab-toggle" title="Abrir selector de misiones e instrumentos 3D (Tecla M)">' +
          '<span>🧭 ' + (isEmbedded ? 'Instrumentos & Sitios 3D' : 'Menú 3D · ' + activeMission.missionName.split(' (')[0]) + '</span>' +
          '<span style="font-size:10px;opacity:0.8;">▲</span>' +
        '</button>' +
        (activeMission.missionId === 'opportunity'
          ? '<button id="ares-storm-2018-btn" onclick="window.toggleOpportunityDustStorm2018()" style="background:rgba(239,68,68,0.24);border:1px solid #ef4444;color:#fecaca;padding:7px 13px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,0.45);pointer-events:auto;">🌪️ Simular Tormenta Polvo 2018 (Sol 5111 · τ=10.8)</button>'
          : '') +
        '<div class="ares-fab-chip">' +
          '<span style="width:7px;height:7px;border-radius:50%;background:#34d399;display:inline-block;"></span>' +
          '<span>' + activeSite.label + ' · Relieve & Hallazgos 3D Activos</span>' +
        '</div>' +
      '</div>';

    ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'wheel'].forEach(function (evtName) {
      hud.addEventListener(evtName, function (e) {
        e.stopPropagation();
      });
    });

    document.body.appendChild(hud);

    var drawer = document.getElementById('ares-3d-drawer');
    var toggleBtn = document.getElementById('ares-fab-toggle');
    var closeBtn = document.getElementById('ares-drawer-close');

    toggleBtn.onclick = function (e) {
      e.stopPropagation();
      drawer.classList.toggle('open');
    };
    closeBtn.onclick = function (e) {
      e.stopPropagation();
      drawer.classList.remove('open');
    };

    window.addEventListener('keydown', function (e) {
      if (e.key === 'm' || e.key === 'M') {
        drawer.classList.toggle('open');
      } else if (e.key === 'Escape') {
        drawer.classList.remove('open');
      }
    });

    var missionRow = document.getElementById('ares-mission-pills-row');
    MISSION_SITES_CATALOG.forEach(function (m) {
      var btn = document.createElement('button');
      btn.className = 'ares-mission-pill' + (m.missionId === activeMission.missionId ? ' active' : '');
      btn.textContent = m.missionName.split(' (')[0];
      btn.onclick = function (e) {
        e.stopPropagation();
        window.location.href = window.location.pathname + '?site=' + m.sites[0].id + '&mission=' + m.missionId + '&modeType=360&hasSeenOrientation=true';
      };
      missionRow.appendChild(btn);
    });

    var siteRow = document.getElementById('ares-site-pills-row');
    activeMission.sites.forEach(function (s) {
      var sBtn = document.createElement('button');
      sBtn.className = 'ares-site-btn' + (s.id === activeSite.id ? ' active' : '');
      sBtn.textContent = s.label + ' (' + s.sol + ')';
      sBtn.onclick = function (e) {
        e.stopPropagation();
        window.location.href = window.location.pathname + '?site=' + s.id + '&mission=' + activeMission.missionId + '&modeType=360&hasSeenOrientation=true';
      };
      siteRow.appendChild(sBtn);
    });

    var instRow = document.getElementById('ares-inst-pills-row');
    activeMission.instruments.forEach(function (inst, idx) {
      var iBtn = document.createElement('button');
      iBtn.className = 'ares-inst-btn';
      iBtn.textContent = '🔬 ' + inst.title;
      iBtn.onclick = function (e) {
        e.stopPropagation();
        drawer.classList.remove('open');
        open3DInfoCard(inst.title, inst.desc, inst.img, idx + 1);
      };
      instRow.appendChild(iBtn);
    });
  }


  // Global 2018 Dust Storm Interactive Simulation (Sol 5111 · Tau = 10.8)
  var stormActive = false;
  var globalStormParticles = null;
  var globalStormTimer = null;

  window.toggleOpportunityDustStorm2018 = function (forceState) {
    var THREE = window.THREE;
    var sceneEl = document.getElementById('scene');
    var terrainContainer = document.getElementById('terrain-container');
    if (!THREE || !sceneEl || !terrainContainer) return;

    stormActive = (typeof forceState === 'boolean') ? forceState : !stormActive;

    var btn = document.getElementById('ares-storm-2018-btn');
    if (btn) {
      btn.innerHTML = stormActive
        ? '☀️ Desactivar Tormenta 2018 (Restaurar Sol)'
        : '🌪️ Simular Tormenta Polvo 2018 (Sol 5111 · τ=10.8)';
      btn.style.background = stormActive ? '#ef4444' : 'rgba(239, 68, 68, 0.24)';
      btn.style.color = stormActive ? '#ffffff' : '#fecaca';
    }

    if (stormActive) {
      sceneEl.setAttribute('fog', 'type: exponential; color: #5c220e; density: 0.055');
      var skyEl = document.getElementById('sky');
      if (skyEl && skyEl.components && skyEl.components['sky-gradient']) {
        var skyMat = skyEl.components['sky-gradient'].material;
        if (skyMat && skyMat.uniforms) {
          if (skyMat.uniforms.colorTop) skyMat.uniforms.colorTop.value.set('#1a0703');
          if (skyMat.uniforms.colorBottom) skyMat.uniforms.colorBottom.value.set('#5c220e');
          skyMat.needsUpdate = true;
        }
      }

      if (!globalStormParticles) {
        var sGeo = new THREE.BufferGeometry();
        var sCount = 1500;
        var sPos = new Float32Array(sCount * 3);
        for (var i = 0; i < sCount; i++) {
          sPos[i * 3] = (Math.random() - 0.5) * 45;
          sPos[i * 3 + 1] = Math.random() * 14;
          sPos[i * 3 + 2] = (Math.random() - 0.5) * 45;
        }
        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        var sMat = new THREE.PointsMaterial({ color: 0xd96b27, size: 0.14, transparent: true, opacity: 0.85 });
        globalStormParticles = new THREE.Points(sGeo, sMat);
        var stormEl = document.createElement('a-entity');
        stormEl.id = 'global-dust-storm-2018-entity';
        stormEl.setObject3D('mesh', globalStormParticles);
        terrainContainer.appendChild(stormEl);

        globalStormTimer = setInterval(function () {
          if (!globalStormParticles) return;
          var posAttr = globalStormParticles.geometry.attributes.position;
          for (var j = 0; j < posAttr.count; j++) {
            var x = posAttr.getX(j) + 0.32;
            var y = posAttr.getY(j) - 0.03;
            if (x > 22.5) x = -22.5;
            if (y < 0.1) y = 13.5;
            posAttr.setX(j, x);
            posAttr.setY(j, y);
          }
          posAttr.needsUpdate = true;
        }, 30);
      }

      open3DInfoCard(
        'TORMENTA GLOBAL DE POLVO 2018 (SOL 5111)',
        'En junio de 2018 una severa tormenta de polvo global envolvio Marte y elevo la opacidad atmosferica en Perseverance Valley a tau = 10.8, bloqueando el 99.998% de la luz solar. El polvo cubrio los paneles solares de Opportunity y termino con su mision tras 14 anos y 45.16 km recorridos.',
        'cards/mb3.jpg',
        4
      );
    } else {
      var siteId = getActiveSiteFromUrl();
      var info = findMissionBySite(siteId);
      sceneEl.setAttribute('fog', 'type: exponential; color: ' + info.mission.fogColor + '; density: 0.011');
      var skyEl2 = document.getElementById('sky');
      if (skyEl2 && skyEl2.components && skyEl2.components['sky-gradient']) {
        var skyMat2 = skyEl2.components['sky-gradient'].material;
        if (skyMat2 && skyMat2.uniforms) {
          if (skyMat2.uniforms.colorTop) skyMat2.uniforms.colorTop.value.set(info.mission.skyTop);
          if (skyMat2.uniforms.colorBottom) skyMat2.uniforms.colorBottom.value.set(info.mission.skyBot);
          skyMat2.needsUpdate = true;
        }
      }
      var stormEnt = document.getElementById('global-dust-storm-2018-entity');
      if (stormEnt && stormEnt.parentNode) stormEnt.parentNode.removeChild(stormEnt);
      globalStormParticles = null;
      if (globalStormTimer) { clearInterval(globalStormTimer); globalStormTimer = null; }
    }
  };

  window.addEventListener('message', function (ev) {
    if (ev && ev.data && ev.data.type === 'TOGGLE_OPP_STORM_2018') {
      window.toggleOpportunityDustStorm2018(ev.data.forceState);
    }
  });

  function open3DInfoCard(title, text, imgUrl, index) {
    var infoCard = document.getElementById('info-card');
    if (infoCard && infoCard.components && infoCard.components['info-card']) {
      infoCard.setAttribute('info-card', {
        url: imgUrl || 'cards/ls2.jpg',
        title: title,
        text: text,
        type: 'poi',
        index: String(index || 1)
      });
      infoCard.addState('visible');
      infoCard.components['info-card'].update();
    }
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        var utter = new SpeechSynthesisUtterance(title + '. ' + text);
        utter.lang = 'es-ES';
        utter.rate = 1.02;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  }

  window.addEventListener('DOMContentLoaded', function () {
    buildFloating3DMissionHud();
    var sceneEl = document.getElementById('scene');
    if (sceneEl) {
      sceneEl.addEventListener('initial-load-complete', function () {
        spawnMission3DCraftOnScene();
      });
      setTimeout(spawnMission3DCraftOnScene, 1800);
      setTimeout(spawnMission3DCraftOnScene, 3400);
    }
  });
})();
