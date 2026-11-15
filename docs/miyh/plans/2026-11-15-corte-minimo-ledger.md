# SDD ledger — plan: docs/plans/2026-11-15-corte-minimo.md

Registro de avance y de decisiones de la ejecución. Una línea por tarea terminada (con la orden de prueba y su resultado real) y una por decisión (`Ruling`).

## Decisiones previas a la tarea 1

- Ruling: ejecución en línea sin esperar revisión del plan — el usuario pidió explícitamente hacer el trabajo según la documentación — si se equivoca: retrabajo de lo construido.
- Ruling: sin `git worktree`, sin rama nueva y sin commits; se copian al repositorio solo archivos con pruebas en verde — el usuario no ha pedido commits y hay cambios previos sin confirmar.
- Ruling: decisiones abiertas del plan tomadas por su recomendación: P-02 Gale; P-04 20°; P-05 se conservan los dos modelos y Mars Trek usa `pandolf-mars` (2 km/h); P-08 una emergencia no cruza Z4; P-12 referencia `huella_datos/`; P-19 español e inglés (español por defecto); P-20 "Mars Trek · Navegador" con aviso de que no es el portal de NASA; además se habilita `/martian-map` como alias de `/trek`.
- Ruling: P-21 las skills de UX no se instalan (instalar ejecuta código de terceros en la máquina del usuario); se aplican leyendo `docs/UX_UI_GUIDELINES.md`.
- Ruling: la elevación sale de las mallas `TYPE_TILE` a 1 m — son la reconstrucción estéreo densa y dan cobertura 100 % en las 5 escenas de Gale.
- Ruling: la máscara de pendiente usa el máximo entre la pendiente de la arista y la pendiente de la celda de llegada [diseño], con opción `edge` para equivalencia exacta (`PT-08`) con `findSafePath`.
- Ruling: una alerta de partículas solares cambia la meta a refugio (`nearest-shelter`), y la regla `EVA-14` solo escala el estado de salud a `CRITICAL` cuando el polígono de tormenta activa cubre la posición del astronauta (una tormenta delante en la ruta actúa como máscara `Z5` del costmap para `T-03` y `T-11`).
- Ruling: el campo sintético de dos corredores (`T-06`) se puede cargar en la aplicación, rotulado `SIMULATED` y nunca como terreno real de Marte.
- Ruling: la prueba de paridad `PT-09` lee los 6 CSV de `metricas de vida/huella_datos/` y verifica paridad exacta evento por evento.

## Tareas completadas

- Task 1: complete (`scripts/trek/build-site-tiles.mjs`, `public/data/trek/gale/<escena>/{elevation.f32,manifest.json}`, `src/services/trek/tiles.ts`, `src/services/trek/sites.ts`, `src/services/trek/tiles.test.ts` → 4/4 pruebas en verde). Teselas: 5 escenas de Gale, 129×129 a 1 m, cobertura 100 %, `sha256` verificado.
- Task 2: complete (`src/core/trek/contracts/index.ts`, `src/core/trek/params.ts`, `src/core/trek/contracts/contracts.test.ts` → 5/5 pruebas en verde).
- Task 3: complete (`src/core/trek/resources/locomotion.ts`, `src/core/trek/resources/consumables.ts`, `src/core/trek/resources/resources.test.ts` → 6/6 pruebas en verde).
- Task 4: complete (`src/core/trek/confidence/score.ts`, `src/core/trek/costmap/terrain.ts`, `src/core/trek/costmap/snapshot.ts`, `src/core/trek/costmap/synthetic.ts`, `src/core/trek/costmap/costmap.test.ts` → 5/5 pruebas en verde).
- Task 5: complete (`src/core/trek/cost/weights.ts`, `src/core/trek/cost/terms.ts`, `src/core/trek/safety/envelope.ts`, `src/core/trek/cost/cost.test.ts` → 3/3 suites de propiedad PT-15, PT-02 [500 casos], PT-05 en verde).
- Task 6: complete (`src/core/trek/routing/heap.ts`, `src/core/trek/routing/astar.ts`, `src/core/trek/routing/trace.ts`, `src/core/trek/routing/planner.ts`, `src/core/trek/routing/routing.test.ts` → 6/6 suites PT-01 [200 rejillas], PT-04 & PT-06 [300 casos], PT-07, T-10, T-06 y PT-08 en verde).
- Task 7: complete (`src/core/trek/health/rules.ts`, `src/core/trek/health/missionRules.ts`, `src/core/trek/health/rules.test.ts` → 3/3 suites en verde, incluyendo paridad exacta PT-09 en los 6 CSV de `huella_datos/`).
- Task 8: complete (`src/core/trek/health/fatigue.ts`, `src/core/trek/health/fsm.ts`, `src/core/trek/health/directive.ts`, `src/core/trek/health/health.test.ts` → 4/4 suites PT-11 [300 pasos], histéresis de fatiga, tabla de directivas y T-12 en verde).
- Task 9: complete (`src/core/trek/health/telemetry.ts`, `src/core/trek/health/telemetry.test.ts` → 3/3 pruebas deterministas en verde).
- Task 10: complete (`src/core/trek/sim/replanner.ts`, `src/core/trek/sim/scenarios.ts`, `src/core/trek/sim/session.ts`, `src/core/trek/sim/session.test.ts` → 5/5 suites T-07, T-03, regla de estabilidad 10 %, Foco 5 / T-11 y EVA-01 en verde).
- Task 11: complete (`src/state/trekStore.ts`, `src/components/trek/i18n.ts`, `src/components/trek/viewHelpers.ts`, `src/components/trek/TrekWorkspace.tsx`, `src/components/trek/viewHelpers.test.ts`, `src/routes/trek.tsx`, `src/routes/martian-map.tsx`, `src/components/shell/AppShell.tsx`, `src/routeTree.gen.ts` → 5/5 pruebas de vista en verde).
- Task 12: complete (30 archivos de prueba en verde: 19 existentes + 11 nuevos de Mars Trek; documentación y ADR-001 actualizados).

## Después del corte mínimo

- Ruling: mapas con ortofoto real de Gale y pesos fisiológicos dinámicos del A* calculados con los datos de `metricas de vida/` — ver [ADR-002](../decisions/ADR-002-mapas-ortofoto-y-pesos-fisiologicos.md). La FSM no se modificó; la fisiología solo endurece pesos blandos (combinación por máximo).
- Complete: `npx vitest run` → 37 archivos, 243 pruebas en verde; `npx tsc --noEmit` limpio; ESLint limpio en los archivos tocados.
- Ruling: misión individual con astronauta en vivo, fallas durante la caminata y máquina de estados visible — ver [ADR-003](../decisions/ADR-003-mision-individual-astronauta-en-vivo.md).
- Ruling: entorno de Marte con procedencia por valor (REMS, Mars24, DONKI) y velocidad ×1–×300 — ver [ADR-004](../decisions/ADR-004-entorno-de-marte-y-velocidad-de-simulacion.md). Un enclavamiento conserva la causa que lo disparó.
- Complete: `npx vitest run` → 39 archivos, 261 pruebas en verde; `npx tsc --noEmit` limpio; ESLint limpio en los archivos tocados (queda un `prefer-const` previo en `telemetry.ts`).

## Revisión tipo jurado (2026-11-15, consola 02 MarsWalk)

- Ruling: BUILD autorizado por el usuario para corregir lo que un juez de Space Apps penalizaría en `/#marswalk`. Sin commits. Solo presentación y el proxy de DONKI; `src/core/trek/**` no se tocó.
- Fix: en pantallas de ≤1280 px de ancho y poca altura (1024×768, 1280×720) la primera fila de `.mwc__body` medía 0 px: "Tu misión" desaparecía y el mapa se encimaba con "Estado de la ruta". Filas `max-content` en `planner-console.css`. Comprobado en el navegador a 1024×768 y 1440×900.
- Fix: `DONKI sin respuesta` con `DEMO_KEY` (HTTP 429). `src/routes/api/nasa/donki.ts` cae ahora al servicio sin clave de CCMC (`https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP`, verificado con petición real: 200; ventanas de más de ~30 días devuelven 400, así que se pide en tramos de 30 días). 365 días → 37 eventos SEP, 7 episodios; 30 días → 0. `kauai.ccmc.gsfc.nasa.gov/DONKI/WS` ya no resuelve desde esta red; queda como tercer intento.
- Nuevo: `src/components/trek/marswalk/scienceCard.tsx` ("Ciencia en la ruta"): objetivos reales de Curiosity con foto, desvío respecto de la ruta y botón "Ir al punto de observación". El punto de observación se valida con `planRoute` (solo lectura) para no proponer celdas inalcanzables. Parámetros [diseño]: `ON_ROUTE_RADIUS_M = 5`, `APPROACH_SEARCH_M = 12`, `APPROACH_MAX_PROBES = 10`.
- Verificación: `npx tsc --noEmit` limpio; ESLint sin errores en los archivos nuevos. **Pendiente:** `npx vitest run` no se pudo ejecutar desde el entorno del agente (binario nativo de rolldown para otro sistema); ejecutar en la Mac, incluye `scienceCard.test.ts` (7 pruebas nuevas).
- Nuevo (pedido del usuario): terreno 3D por misión en la pestaña 04. `missionTerrains.ts` (mapa misión → malla), `MissionTerrain3D.tsx` (three.js, carga diferida; malla + alambre, órbita, exageración vertical rotulada ×1/×2/×4, aviso sin WebGL) y botón **Explorar** en la ficha y en el carrusel ("Explorar terreno 3D"). Curiosity y Ares I usan la malla REAL de Gale (elevación 1 m + ortofoto de Access Mars) y ofrecen "Planear caminata aquí" (carga el sitio en MarsWalk). Las otras 9 usan las teselas de `public/models/missions_3d/*.glb`, generadas por el proyecto en formato Access Mars: se rotulan `MODELLED` y "No es elevación medida" (R6/R7). Comprobado en el navegador: Perseverance (MODELLED) y Curiosity (REAL), ficha y modo Explorar. `tsc --noEmit` limpio.
- Verificación: `npx vitest run` ejecutado tras la revisión tipo jurado → 42 archivos, 281 pruebas en verde (incluye las 7 de `scienceCard.test.ts`).
- Ruling: pendientes del jurado resueltos — recorrido con varias paradas científicas, caminata por defecto de ~2.6 h con riesgo (incidentes «Realista» por defecto) y avisos del motor en inglés — ver [ADR-005](../decisions/ADR-005-recorrido-con-paradas-cientificas.md).
- Complete: `npx vitest run` → 46 archivos, 299 pruebas en verde; `npx tsc --noEmit` limpio; ESLint limpio en los archivos tocados. Comprobado en el navegador en ES/EN y a 1024×768.
