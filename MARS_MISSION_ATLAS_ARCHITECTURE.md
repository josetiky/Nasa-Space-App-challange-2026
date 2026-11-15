# ARQUITECTURA TÉCNICA — PROJECT ARES: MARS MISSION ATLAS

## 1. Visión Arquitectónica y Flujo de Datos

**MARS MISSION ATLAS** unifica el ecosistema de planificación e inteligencia de misión del **Proyecto A (`Nasa-Space-App-challange-2026`)** con el motor y activos fotogramétricos 3D del **Proyecto B (`access-mars` — Google Creative Lab & NASA JPL OnSight)** bajo un único marco geodésico planetario (**IAU Mars 2000 Planetocentric / MOLA Areoid**).

```text
NASA PDS / Mars Trek / ODE / Analyst's Notebook / USGS / CNSA / azmth.space
                                    │
                                    ▼
                        1. DATA INGESTION LAYER
        (scripts/fetch-nasa-data.ts · public/data/nasa/ · public/eva/)
                                    │
                                    ▼
                       2. SCIENTIFIC VALIDATION
      (Etiquetado estricto: OFICIAL · DERIVADO · TERCEROS + Licencia/CRS)
                                    │
                                    ▼
                      3. GEODETIC NORMALIZATION
    (IAU Mars 2000 Planetocentric: Lat [-90°,+90°], Lon [-180°,+180°]/[0°,360°E],
         Elevación MOLA Areoid [m], Esfera métrica R = 3,396,190 m)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
           4A. VECTOR ENGINE               4B. RASTER & 3D ENGINE
   • Catálogo de 11 Misiones               • MOLA MEGDR (463 m/px)
   • 7 Trayectorias Móviles Sol a Sol      • NASA Mars Trek WMTS (Viking/MOLA/HiRISE)
   • 4 Estaciones Fijas (Landers)          • 5 Escenas Fotogramétricas Access Mars (.glb)
   • Descubrimientos Georreferenciados     • Rover Curiosity 3D (/eva/rover/scene.glb)
   • Regiones y Unidades Geológicas        • 7 Modelos Regionales DEM (.glb) + 46 Mapas
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                     5. UNIFIED MISSION ATLAS ENGINE
       (src/data/marsMissionAtlas.ts · MarsMissionAtlasWorkspace.tsx ·
        SurfaceEva.tsx · public/index.html & public/mars-mission-atlas.js)
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
      MODO 1: GLOBAL MARS EXPLORER    MODO 2: IMMERSIVE MISSION EXPLORER
      • Mapa Global 2D/3D Interactivo • Motor 3D Access Mars (5 Sitios Gale)
      • 10 Capas Terrain Intelligence • Modelo 3D Interactivo de Curiosity
      • Timeline Sol a Sol + Perfil   • Audio Original NASA JPL (Katie Stack Morgan)
      • Panel de Descubrimientos      • Caminata EVA con HUD y Ruteo Seguro A*
```

---

## 2. Estructura de Módulos Implementados

| Ruta / Archivo | Rol Arquitectónico |
| :--- | :--- |
| `INTEGRATION_AUDIT.md` | Auditoría técnica comparativa entre el Proyecto A (`Nasa-Space-App-challange-2026`) y el Proyecto B (`access-mars`), inventario de activos 3D, evaluación de riesgos y plan de implementación. |
| `src/data/marsMissionAtlas.ts` | Fundación de datos científicos tipados: catálogo maestro de las **11 misiones**, **7 fuentes de Terrain Intelligence** (MOLA, HiRISE, CTX, THEMIS, CRISM, HRSC, USGS), **formaciones planetarias**, **descubrimientos científicos georreferenciados**, **taxonomía de reconstrucción 3D (`TYPE_A` a `TYPE_D`)** y motor matemático `computeMissionSolMetrics()`. |
| `src/data/evaSites.ts` | Definición de las **5 escenas fotogramétricas 3D de Access Mars** en el cráter Gale (*Bradbury Landing*, *Pahrump Hills*, *Marias Pass*, *Murray Buttes* y *Vera Rubin Ridge / Live Site*) ancladas a coordenadas planetocéntricas reales, más los **6 subsistemas interactivos del rover Curiosity** (`CURIOSITY_ROVER_PARTS`) y las **19 locuciones originales de NASA JPL** (`/eva/vo/*.mp3`). |
| `src/components/explorer/SurfaceEva.tsx` | Visor 3D en `@react-three/fiber` + `@react-three/drei` con decodificación Draco (`/draco/`), carga progresiva de mosaicos de textura (`_xsm.jpg` → `_sm.jpg` → `.jpg`), renderizado del modelo 3D real `/eva/rover/scene.glb`, marcadores de instrumentos del rover, planificación de rutas seguras con algoritmo **A*** y simulación de caminata EVA en primera persona con casco HUD. |
| `src/components/atlas/MarsMissionAtlasWorkspace.tsx` | Interfaz principal unificada con selector de las 11 misiones, **Timeline Sol a Sol** con reproducción automática, **Modo 1 (Global Mars Explorer)** con capas GIS y perfil topográfico en vivo, **Modo 2 (Immersive 3D Explorer)** con audio de NASA JPL, **Catálogo de Descubrimientos Científicos**, **Matriz de Terrain Intelligence** y **Comparador de 11 Misiones**. |
| `src/routes/mission-lab.tsx` y `src/routes/explorer.tsx` | Integración de rutas en TanStack Router conectando el Atlas de Misiones, el Globo 3D, las 5 escenas de Access Mars y el recorrido Boxwork 2025. |
| `public/index.html` y `public/mars-mission-atlas.js` | Aplicación web autónoma de ejecución inmediata servida en `http://localhost:8790/` que conecta en vivo el mapa global, el catálogo de 11 misiones, el timeline por Sol, los descubrimientos, las 46 cartas regionales y el motor 3D interactivo de Access Mars (`/access-mars-engine/` y `/eva/`). |

---

## 3. Reglas de Rigor Científico y Trazabilidad Aplicadas

1. **Diferenciación estricta de tipos de reconstrucción 3D**:
   - **Tipo A (`TYPE_A_PHOTOGRAMMETRY`)**: Reconstrucción fotogramétrica 3D real basada en imágenes estereoscópicas Navcam y Mastcam de Curiosity (exclusivo para las 5 escenas de Access Mars / NASA JPL OnSight en el cráter Gale).
   - **Tipo B (`TYPE_B_DEM`)**: Terreno generado mediante Modelos Digitales de Elevación orbitales (MOLA MEGDR, HRSC-MOLA Blended DEM, CTX y HiRISE DTMs).
   - **Tipo C (`TYPE_C_MODEL`)**: Modelos tridimensionales de ingeniería (`/eva/rover/scene.glb`) y bloques regionales (`.glb`).
   - **Tipo D (`TYPE_D_ORBITAL_DRAPE`)**: Proyección de ortoimágenes orbitales sobre superficies 3D.
2. **Representación honesta de misiones fijas vs. móviles**:
   - Las **7 misiones móviles** (*Sojourner*, *Spirit*, *Opportunity*, *Curiosity*, *Perseverance*, *Zhurong* e *Ingenuity*) cuentan con trayectorias reales Sol a Sol, cálculo de odometría, desnivel acumulado y pendiente.
   - Los **4 landers fijos** (*Viking 1*, *Viking 2*, *Phoenix* e *InSight*) tienen `hasMobileTraverse: false` y `waypoints: []`, mostrando su estación de aterrizaje y descubrimientos in situ sin fabricar trayectorias móviles.
3. **Tres niveles de validación documental**:
   - **`OFICIAL`**: Datos primarios procedentes de [NASA PDS](https://pds.nasa.gov/), [NASA Mars Trek](https://trek.nasa.gov/mars/), [Mars ODE](https://ode.rsl.wustl.edu/mars/), [Analyst's Notebook](https://an.rsl.wustl.edu/), [USGS Astrogeology](https://astrogeology.usgs.gov/) y CNSA/GRAS.
   - **`DERIVADO`**: Datos procesados a partir de mediciones científicas (pendientes MOLA, perfiles altimétricos, tiempo solar Mars24 y compilaciones normalizadas como [`azmth.space/mars/data`](https://azmth.space/mars/data) bajo CC BY 4.0).
   - **`TERCEROS`**: Recopilaciones externas e interpretaciones geológicas documentadas.
