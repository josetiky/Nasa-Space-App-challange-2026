# INTEGRATION_AUDIT.md — PROJECT ARES: MARS MISSION ATLAS

## 1. Arquitectura de Ambos Proyectos

### A. Proyecto A (`Nasa-Space-App-challange-2026`)
- **Ubicación**: `/Users/tiky/Desktop/NASA Space App Challenge/Nasa-Space-App-challange-2026`
- **Framework y Runtime**: React 19 (`19.2.0`), TypeScript (`5.8.3`), TanStack Start / Router (`@tanstack/react-router`, `@tanstack/react-start`), `@tanstack/react-query`, Vite (`8.1.5`), Tailwind CSS v4 (`@tailwindcss/vite`), Vitest (`5.1.0`).
- **Motor Gráfico y Cartografía**:
  - **Globo 3D y Escenas Superficiales**: `three` (`^0.186.0`), `@react-three/fiber` (`^9`), `@react-three/drei` (`^10`) con decodificadores Draco locales en `public/draco/`.
  - **Cartografía 2D**: `leaflet` (`^1.9.4`) en proyección `CRS.EPSG4326` conectado a servicios WMTS de [NASA Mars Trek](https://trek.nasa.gov/mars/) con respaldo local (`public/data/nasa/`).
  - **Visualización Analítica**: `recharts` (`^2.15.4`) para perfiles de elevación, telemetría y series por Sol.
- **Núcleo Científico (`src/core/science/`)**:
  - `marsTime.ts`: Algoritmo Mars24 (Allison & McEwen, 2000) para cálculo en tiempo real de Mars Year (`MY`), longitud solar (`Ls`), Mars Sol Date (`MSD`) y Coordinated Mars Time (`MTC`).
  - `geo.ts` y `terrain.ts`: Conversión planetocéntrica (`[-180°, 180°)` / `[0°, 360° E)`), distancias ortodrómicas y muestreo altimétrico sobre la malla [MOLA MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/mola.html).
  - `roverTraverse.ts`: Planificación y proyección métrica local (`MMGIS_SPHERE_RADIUS_M = 3,396,190 m`) sobre trayectorias reales de rovers.
  - `routing.ts`, `eva.ts`, `evaWalk.ts`: Rasterización de triángulos sobre mallas 3D glTF, búsqueda de rutas seguras mediante algoritmo A* evitando pendientes `>= 15°` (precaución) y `>= 25°` (no-go), y modelo metabólico de caminatas EVA.
  - `environment.ts`, `insolation.ts`, `habitability.ts`, `calibration/remsGale.ts`: Modelos atmosféricos calibrados con datos reales de la estación REMS de Curiosity en el cráter Gale.

### B. Proyecto B (`access-mars` — Google Creative Lab & NASA JPL)
- **Ubicación**: `/Users/tiky/Desktop/NASA Space App Challenge/access-mars` (sirviendo `access-mars/public` en `http://localhost:8765/`).
- **Repositorio original**: [googlecreativelab/access-mars](https://github.com/googlecreativelab/access-mars) (licencia Apache-2.0), desarrollado en colaboración con el equipo de [NASA JPL OnSight](https://www.jpl.nasa.gov/news/take-a-walk-on-mars-in-your-own-living-room/).
- **Arquitectura**:
  - Aplicación WebVR/WebGL empaquetada originalmente con Browserify y Budo (`package.json`), construida sobre A-Frame y un fork de Three.js.
  - **Reconstrucción 3D del terreno de Curiosity**: 5 directorios de escenas en `access-mars/public/terrain/` (`landing_site/`, `pahrump_hills/`, `marias_pass/`, `murray_buttes/`, `live_site/`), cada uno con `terrain.glb` comprimido con Draco, `background.jpg` y mosaicos progresivos en `tiles/` (`<id>_xsm.jpg`, `<id>_sm.jpg`, `<id>.jpg`).
  - **Convención de Nodos Cinema 4D -> glTF**: Los nombres de nodo en `terrain.glb` codifican metadatos (`TYPE_BACKGROUND`, `TYPE_SIMPLE` para malla de colisión rápida, y `TYPE_TILE` con `ID_<n>___` y flag `MD_1` para carga progresiva de texturas).
  - **Modelo 3D del Rover Curiosity (`public/rover/`)**: `scene.glb` (57 KB) con texturas en `tex/` y `xref/`.
  - **Narrativa Científica (`public/vo/` y `public/markers/`)**: 19 pistas de audio (`.mp3` y `.ogg`) narradas por Katie Stack Morgan (NASA JPL): `intro1-2`, `ls1-3` (*Landing Site*), `ph1-4` (*Pahrump Hills*), `mp1-4` (*Marias Pass*), `mb1-4` (*Murray Buttes*) y `rover1-6` (instrumentos de Curiosity).

---

## 2. Tecnologías Utilizadas y Compatibilidad

| Capa | Proyecto A (`Nasa-Space-App-challange-2026`) | Proyecto B (`access-mars`) | Estado de Compatibilidad |
| :--- | :--- | :--- | :--- |
| **Renderizado 3D** | Three.js `0.186.0` + `@react-three/fiber` + `@react-three/drei` | A-Frame + fork legado de Three.js | **Alta (vía activos glTF/Draco)**: `SurfaceEva.tsx` ya decodifica el esquema `TYPE_TILE` / `TYPE_SIMPLE` / `TYPE_BACKGROUND` de `terrain.glb` usando `useGLTF` y `/draco/`. |
| **Terrenos de Access Mars** | Ya monta parcialmente escenas en `public/eva/gale/` | Posee las 5 escenas completas (`landing_site`, `pahrump_hills`, `marias_pass`, `murray_buttes`, `live_site`) + `rover/scene.glb` + `vo/` | **Directa**: Podemos exponer las 5 escenas completas, el modelo `rover/scene.glb` y las locuciones `vo/` directamente en el Proyecto A sin necesidad de A-Frame. |
| **Cartografía Global y Regional** | `Globe.tsx` (3D MOLA + Mars Trek) y `AtlasMap.tsx` (2D Leaflet EPSG:4326) | Mapa SVG/2D estático de Gale Crater (`public/map/`) | **Complementaria**: El globo 3D y el mapa Leaflet sirven como **Modo 1 (Global Mars Explorer)** y conectan directamente con el **Modo 2 (Immersive Mission Explorer)**. |
| **Trayectorias de Misiones** | Actualmente carga `m20` (Perseverance) y `msl` (Curiosity) + Boxwork (soles 4530–4711) | Solo puntos fijos de Curiosity en Gale | **Expansible a las 11 misiones**: Integraremos las 7 trayectorias móviles reales (`perseverance`, `curiosity`, `ingenuity`, `opportunity`, `spirit`, `sojourner`, `zhurong`) y los 4 landers fijos (`viking1`, `viking2`, `phoenix`, `insight`). |

---

## 3. Recursos 3D, Audio y Datos Reutilizables

1. **Escenas Fotogramétricas de Access Mars (`access-mars/public/terrain/`)**:
   - `landing_site/terrain.glb` + `background.jpg` + `tiles/` (*Bradbury Landing*, Sol 0–60).
   - `pahrump_hills/terrain.glb` + `background.jpg` + `tiles/` (*Pahrump Hills*, Sol 750–950).
   - `marias_pass/terrain.glb` + `background.jpg` + `tiles/` (*Marias Pass*, Sol 990–1070).
   - `murray_buttes/terrain.glb` + `background.jpg` + `tiles/` (*Murray Buttes*, Sol 1420–1480).
   - `live_site/terrain.glb` + `background.jpg` + `tiles/` (Escena adicional de campaña en Mount Sharp).
2. **Modelo 3D del Rover Curiosity (`access-mars/public/rover/`)**:
   - `scene.glb` (57 KB) y texturas asociadas para inspección 3D interactiva de sus instrumentos (Mastcam, ChemCam, APXS, MAHLI, CheMin, SAM, RAD, REMS, DAN, RTG).
3. **Locuciones Oficiales de NASA JPL (`access-mars/public/vo/`)**:
   - Archivos `.mp3`/`.ogg` de Katie Stack Morgan integrables en los puntos de interés 3D y fichas de misión.
4. **Biblioteca Topográfica y Regional (`public/mars-terrain-library/`)**:
   - 39 mapas de alta resolución divididos en `major_regions/`, `volcanoes/`, `mission_sites/`, `craters_basins/`, `canyons_valleys/` y `polar_regions/`.

---

## 4. Formatos de Datos y Normalización Planetaria

- **Sistema de Referencia Unificado**: **IAU Mars 2000** planetocéntrico:
  - Latitud areocéntrica `[-90°, +90°]` (Norte positivo).
  - Longitud Este `[-180°, +180°)` internamente en `GeoPoint` y mostrada también en convención planetaria `[0°, 360° E)` (`lon360 = (lon + 360) % 360`).
  - Elevación referida al areoide equipotencial [MOLA MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/mola.html) en metros (`m`).
  - Radio ecuatorial de referencia para conversiones métricas locales: `3,396,190 m` (`MMGIS_SPHERE_RADIUS_M`).
- **Categorías de Trazabilidad Científica**:
  - `OFICIAL` (`REAL`): Datos primarios de [NASA PDS](https://pds.nasa.gov/), [NASA Mars Trek](https://trek.nasa.gov/mars/), [Mars ODE](https://ode.rsl.wustl.edu/mars/), [Analyst's Notebook](https://an.rsl.wustl.edu/), [USGS Astrogeology](https://astrogeology.usgs.gov/) y CNSA/GRAS.
  - `DERIVADO` (`DERIVED`): Perfiles altimétricos, pendientes, desnivel acumulado, tiempo solar Mars24 y compilaciones normalizadas como [`azmth.space/mars/data`](https://azmth.space/mars/data) (CC BY 4.0).
  - `TERCEROS` (`MODELLED` / `THIRD_PARTY`): Índices compuestos, estimaciones ambientales o recopilaciones externas documentadas.

---

## 5. Riesgos Técnicos y Mitigaciones

1. **Incompatibilidad entre A-Frame legado y React 19**:
   - *Riesgo*: Importar el bundle antiguo de A-Frame de `access-mars` provocaría colisiones de instancia de Three.js y manipulación directa del DOM.
   - *Mitigación*: Reutilizar directamente los activos `.glb`, `tiles/*.jpg`, `rover/scene.glb` y `vo/*.mp3` sobre el motor `@react-three/fiber` (`Three.js 0.186.0`) que ya decodifica la convención de nodos de Access Mars.
2. **Distinción entre Fotogrametría Real y Terreno DEM**:
   - *Riesgo*: Confundir al usuario presentando un DEM orbital como si fuera una reconstrucción fotogramétrica de superficie.
   - *Mitigación*: Etiquetar cada escena 3D con un badge explícito de **Tipo de Reconstrucción** (`Tipo A: Fotogrametría Real Navcam/Mastcam`, `Tipo B: Modelo Digital de Elevación MOLA/HRSC/HiRISE`, `Tipo C: Modelo 3D de Ingeniería`, `Tipo D: Ortoimagen Orbital sobre DEM`).
3. **Misiones Estáticas (Landers)**:
   - *Riesgo*: Representar trayectorias ficticias para Viking 1, Viking 2, Phoenix o InSight.
   - *Mitigación*: Restringir los vectores de recorrido a las 7 misiones móviles (Sojourner, Spirit, Opportunity, Curiosity, Perseverance, Zhurong, Ingenuity) y representar los 4 landers mediante su estación de aterrizaje, área de trabajo del brazo robótico y descubrimientos in situ.

---

## 6. Arquitectura Propuesta e Implementación por Fases

1. **Copia/Sincronización No Destructiva de Activos de Access Mars**:
   - Conservar `/Users/tiky/Desktop/NASA Space App Challenge/access-mars` intacto.
   - Sincronizar `live_site`, `rover/` y `vo/` hacia `public/eva/gale/` y `public/access-mars/` en el Proyecto A.
2. **Data Foundation (`src/data/marsMissionAtlas.ts` y `public/data/nasa/traverses/`)**:
   - Catálogo completo y tipado de las **11 misiones** (Sojourner, Spirit, Opportunity, Curiosity, Perseverance, Zhurong, Ingenuity, Viking 1, Viking 2, Phoenix, InSight) con coordenadas IAU/MOLA, estado, objetivos, instrumentos, hitos por Sol, descubrimientos científicos georreferenciados y metadatos `OFICIAL` / `DERIVADO` / `TERCEROS`.
   - Descarga e integración de los datasets reales de trayectorias desde [`azmth.space/mars/data`](https://azmth.space/mars/data) y [NASA MMGIS / PDS](https://pds.nasa.gov/).
   - Catálogo técnico de las **7 fuentes de Terrain Intelligence** (MOLA, HiRISE, CTX, THEMIS, CRISM, HRSC, USGS).
3. **Plataforma Unificada MARS MISSION ATLAS (`/mission-atlas` e integración con `/explorer` y `/atlas`)**:
   - **Modo 1 — Global Mars Explorer (2D Leaflet + 3D Globe)**: Visualización interactiva de las 11 misiones, regiones geográficas, cráteres, volcanes, valles, trayectorias reales coloreadas por misión y puntos de descubrimiento científico.
   - **Modo 2 — Immersive Mission Explorer (3D Access Mars + DEM Regional + Inspector del Rover)**: Exploración 3D de las 5 escenas fotogramétricas de Curiosity en Gale Crater con audio real de JPL (`vo/*.mp3`), modelo 3D interactivo de Curiosity (`rover/scene.glb`), caminatas EVA y reconstrucción topográfica DEM (Tipo B/D) para el resto de misiones.
   - **Timeline Interactivo Sol a Sol y Perfil Topográfico**: Selector cronológico de Sol que actualiza la posición del vehículo, dibuja la trayectoria acumulada, calcula distancia recorrida, desnivel y pendiente, y filtra los descubrimientos científicos y fotografías hasta ese Sol.
   - **Comparador Multidisciplinario de Misiones**: Tabla y gráficos comparativos de recorrido, desnivel, duración en soles, instrumentos y hallazgos entre cualquiera de las 11 misiones.
