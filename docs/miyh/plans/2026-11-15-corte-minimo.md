# Mars Trek · Corte mínimo demostrable — Plan de implementación

> **Para agentes:** se ejecuta tarea por tarea con `superpowers:executing-plans` (ejecución en línea, sin subagentes) y `superpowers:test-driven-development`. El avance y las decisiones tomadas sobre la marcha están en [2026-11-15-corte-minimo-ledger.md](2026-11-15-corte-minimo-ledger.md). Los pasos usan casillas `- [ ]`.

**Objetivo:** que `/trek` sea un navegador tipo Waze para Marte: calcula la ruta sobre terreno real de Gale y la recalcula cuando cambian el estado del astronauta, el polvo, la radiación, los recursos o los peligros, explicando por qué.

**Arquitectura:** núcleo puro y probado en `src/core/trek/` (contratos → costmap → costo → envolvente de seguridad → A\* → salud → recursos → sesión de simulación) y una pantalla de mapa en `src/routes/trek.tsx` que solo lee el estado de la sesión. Las restricciones duras son máscara del grafo; el motor de rutas no acepta peticiones sin envolvente de seguridad.

**Pila:** la del repositorio (TanStack Start, React 19, TypeScript estricto, Tailwind 4, Leaflet 1.9, Vitest 5). **Sin dependencias nuevas.**

**Especificación:** [MARS_TREK_MASTER_PLAN.md](../../MARS_TREK_MASTER_PLAN.md) y `docs/` — sobre todo [ROADMAP.md](../ROADMAP.md) §4, [ARCHITECTURE.md](../ARCHITECTURE.md), [ROUTING_ALGORITHM.md](../ROUTING_ALGORITHM.md), [DYNAMIC_COSTMAP.md](../DYNAMIC_COSTMAP.md), [ASTRONAUT_HEALTH_STATE_MACHINE.md](../ASTRONAUT_HEALTH_STATE_MACHINE.md), [RESOURCE_MANAGEMENT.md](../RESOURCE_MANAGEMENT.md), [TESTING_STRATEGY.md](../TESTING_STRATEGY.md), [UX_UI_GUIDELINES.md](../UX_UI_GUIDELINES.md).

## Restricciones globales

- Línea base intacta: las 150 pruebas existentes y `tsc --noEmit` en verde tras cada tarea (INV-T1).
- No se modifica `src/core/science/**`, `src/core/sim/**`, `src/core/decision/**` ni `src/state/missionStore.ts`. Archivos existentes con cambio **aditivo**: `src/components/shell/AppShell.tsx`, `src/data/sources.ts`, `src/routeTree.gen.ts` (generado).
- `src/core/trek/**` no importa React, el store ni la red. `routing/` no importa `health/` (solo tipos de `contracts/`).
- Lo inadmisible se elimina del grafo; nunca se penaliza (INV-R3). Sin dato no es cero: `NaN` (INV-R4).
- Pesos: `w_k ≥ 0`, `w_d ≥ 0.05`, `Σw = 1` tras validar (INV-R1, INV-R5).
- Todo valor mostrado lleva procedencia `REAL | DERIVED | MODELLED | SIMULATED`; lo simulado conserva su etiqueta hasta la pantalla.
- Ningún umbral clínico nuevo: los heredados de HUELLA se portan tal cual; los parámetros propios se marcan **[diseño]**.
- Límite de pendiente a pie: 20° (precaución 15°). Estados: NORMAL 20°, FATIGUE 15°, CAUTION 10° o 15° según causa, CRITICAL 15° con escalera hasta 20°.
- Git: sin commits ni cambios de rama (el usuario no los ha pedido y hay trabajo suyo sin confirmar).

## Foco de revisión

Entradas que la especificación implica y que más fácilmente rompen el producto:

1. **Origen o destino sobre una celda inadmisible o fuera de la rejilla** → resultado "sin ruta" con motivo, nunca excepción (prueba en la tarea 6).
2. **Destino inalcanzable por una zona Z5 aunque todos los pesos de seguridad sean cero** → "sin ruta"; ningún peso habilita la zona (tarea 6, T-10).
3. **Directiva de salud más laxa que el vehículo, o envolvente de otra instantánea** → la envolvente compuesta nunca es más laxa que cada entrada; una envolvente de otra versión se rechaza (tarea 5).
4. **Telemetría ausente o corte total de sensores** → nunca produce NORMAL; un sensor fallado no baja el estado (tarea 9).
5. **Eventos simultáneos en un mismo ciclo (tormenta + fatiga + recurso)** → una sola replanificación, resultado independiente del orden (tarea 10).

---

## Estructura de archivos

```
scripts/trek/build-site-tiles.mjs            malla Access Mars (glb + Draco) → rejilla de elevación + manifiesto
public/data/trek/gale/<escena>/              elevation.f32 + manifest.json (5 escenas, 129×129 nodos, 1 m)
src/core/trek/
  contracts/index.ts                         tipos compartidos
  params.ts                                  parámetros [diseño] con procedencia, en un solo lugar
  resources/locomotion.ts                    modelos tobler-linear y pandolf-mars
  resources/consumables.ts                   O₂, CO₂, refrigeración, batería; consumible limitante; márgenes
  confidence/score.ts                        clases K y puntuación
  costmap/terrain.ts                         capas estáticas derivadas de la elevación
  costmap/snapshot.ts                        instantánea versionada: capas dinámicas + zonas
  costmap/synthetic.ts                       campo sintético de dos corredores (T-06), rotulado SIMULATED
  cost/weights.ts                            validación, perfiles, multiplicadores
  cost/terms.ts                              intensidades por arista y costo
  safety/envelope.ts                         composeEnvelope (gana lo más restrictivo)
  routing/heap.ts · astar.ts                 búsqueda
  routing/trace.ts                           integración de una polilínea: métricas, validación, bloqueo del camino directo
  routing/planner.ts                         planRoute: escalera, refugios, suavizado, explicación, alternativas
  health/rules.ts                            port de motor_reglas.py + filtro de persistencia
  health/missionRules.ts                     reglas derivadas (EVA-01, 13, 14, 15, 18, 19, 20)
  health/fatigue.ts                          índice de fatiga y reglas FAT
  health/fsm.ts · directive.ts               máquina de estados y directiva
  health/telemetry.ts                        simulador de telemetría (escenarios)
  sim/session.ts                             ciclo: costmap → recursos → salud → seguridad → replanificación
  sim/replanner.ts                           decisión ante eventos y regla de estabilidad
  sim/scenarios.ts                           guiones deterministas
src/services/trek/sites.ts                   catálogo de sitios y carga de teselas
src/state/trekStore.ts                       store de la pantalla (patrón de missionStore)
src/components/trek/                         mapa, paneles, barra de porqués, consola de simulación, textos es/en
src/routes/trek.tsx                          ruta cliente (ssr: false)
```

---

## Tareas

Orden de prueba en todas: escribir la prueba → verla fallar → implementar → verla pasar → suite completa + `tsc`.
Órdenes: `npx vitest run <archivo>` · `npx vitest run` · `npx tsc --noEmit`.

### Tarea 1 · Teselas reales de Gale

**Archivos:** crear `scripts/trek/build-site-tiles.mjs`, `public/data/trek/gale/<escena>/{elevation.f32,manifest.json}`, `src/services/trek/sites.ts`, `src/services/trek/sites.test.ts`.

**Interfaces — produce:**
- `decodeElevationTile(buffer: ArrayBuffer, manifest: SiteManifest): HeightGrid` (reutiliza `HeightGrid` de `core/science/routing.ts`; `NaN` = sin dato).
- `SiteManifest { siteId; grid: GridSpec; file; encoding: "float32-le"; noData: "NaN"; sha256; source; license; generatedAt; meshNodes: "TYPE_TILE"; vertexSpacingM: {min, median, max}; elevationRangeM: [min, max] }`.
- `TREK_SITES: TrekSiteInfo[]` (cinco escenas de Gale + campo sintético).

- [ ] Prueba: `decodeElevationTile` devuelve 129×129 nodos y rechaza un búfer de tamaño distinto al del manifiesto; el manifiesto de `murray_buttes` declara `sha256` y este coincide con el archivo.
- [ ] Guion: decodifica las mallas `TYPE_TILE` con el descodificador Draco incluido en `three`, aplica la escala de la escena (0.01 × 100) y rasteriza a 1 m sobre `[-64, 64]²` con el mismo algoritmo que `rasterizeTriangles`.
- [ ] Ejecutar el guion y comprobar cobertura 100 % y rango de elevación frente al de los accesores del glb.

### Tarea 2 · Contratos y parámetros

**Archivos:** crear `src/core/trek/contracts/index.ts`, `src/core/trek/params.ts`, `src/core/trek/contracts/contracts.test.ts`.

**Produce:** `LocalPoint {x,z}`, `GridSpec`, `ZoneClass` (Z0…Z5), `ConfidenceClass` (K1…K5 con K3a–K3d), `HealthState`, `CauseFlag`, `WeightVector`, `WeightProfileId`, `NavigationDirective`, `SafetyEnvelope` (opaco), `RouteRequest`, `RouteResult`, `RouteExplanation`, `ResourceState`, `ResourcePlan`, `LocomotionModel`, `EdgeContext`, `SimEvent`, `ReplanRecord`, `HealthTransition`; orden total `confidenceRank()` y `zoneRank()`.

- [ ] Prueba: orden de clases (`K1 > K2 > K3a > … > K5`), `Z5` es la más restrictiva; cada parámetro de `params.ts` tiene `origin` (`"diseño" | "HUELLA" | "verificado" | "proyecto"`) y nota.

### Tarea 3 · Locomoción y consumibles

**Archivos:** crear `src/core/trek/resources/{locomotion,consumables}.ts` y sus pruebas.

**Produce:** `toblerLinear`, `pandolfMars(params?)` (`LocomotionModel`); `consumptionRates(metabolicW, model)`; `stepResources(state, dtS, metabolicW)`; `limitingConsumable(state, planningMetabolicW)`; `returnMargin({limitingMin, returnMin, reserveMin})`.

- [ ] Pruebas: `pandolf-mars` en llano da 1000 kJ/h ± 0.5 % para el tripulante de referencia (65 kg + 104 kg + 3.4 kg) y 2.0 km/h; con pendiente de 20 % baja a 1.0 km/h; nunca menos de 0.8 km/h; las bajadas gastan como el llano. `tobler-linear` coincide con `walkingSpeedKmh` y `metabolicRateW`. O₂: 2.13 psi/min por L/min; margen negativo ⇒ `noGo`.

### Tarea 4 · Costmap, confianza y zonas

**Archivos:** crear `src/core/trek/confidence/score.ts`, `src/core/trek/costmap/{terrain,snapshot,synthetic}.ts` y pruebas.

**Produce:** `confidenceScore()`, `buildStaticTerrain()`, `buildSnapshot(terrain, dynamic, zoneRules)` → `CostmapSnapshot { snapshotId; version; terrain; dynamic; dustTau; doseRate; zone; sample() }`, `twoCorridorField()`.

- [ ] Pruebas: una celda sin elevación es `NaN`, clase K5 y zona Z3 (nunca 0); pendiente > 20° ⇒ Z5 y 15–20° ⇒ Z1 para tripulación a pie; polígono de tormenta ⇒ Z5 solo mientras está activo; exclusión manual ⇒ Z5; zona restringida ⇒ Z4; `buildSnapshot` no muta la entrada y cambia de `version` cuando cambia la dinámica; el campo sintético tiene el corredor A con tramos de 17° y el B con máximo de 9°.

### Tarea 5 · Pesos, costo y envolvente

**Archivos:** crear `src/core/trek/cost/{weights,terms}.ts`, `src/core/trek/safety/envelope.ts` y pruebas.

**Produce:** `validateWeights(raw): WeightVector` (lanza `WeightError`), `WEIGHT_PROFILES`, `applyMultipliers()`, `edgeCost()`, `composeEnvelope(mission, vehicle, zoneRules, directive, resources, snapshot): SafetyEnvelope`.

- [ ] Pruebas: PT-15 (negativos, no finitos y `w_d < 0.05` se rechazan; el resultado suma 1); los multiplicadores de salud solo suben `t, r, u, h`; PT-02 (`h(a) ≤ c(a→b) + h(b)` con pesos y capas aleatorios, 500 casos con semilla); PT-05 (la envolvente compuesta es al menos tan restrictiva como cada entrada; endurecer una entrada nunca la relaja); sin directiva no compila ni se construye; `Z5` nunca entra en `allowedZones`.

### Tarea 6 · A\*, traza y planificador

**Archivos:** crear `src/core/trek/routing/{heap,astar,trace,planner}.ts` y pruebas.

**Produce:** `searchPath()`, `tracePolyline()`, `planRoute(request, envelopes, snapshot, context): RouteResult`, `planAlternatives()`.

- [ ] Pruebas: PT-01 (costo de A\* = Dijkstra en 200 rejillas aleatorias); PT-04 (ninguna ruta devuelta viola su envolvente, 300 casos); PT-07 (mismas entradas ⇒ misma ruta y misma clave); T-10 y foco 1–2 (destino tras una franja Z5 ⇒ `ok: false` con motivo, también con pesos de seguridad en cero; origen inadmisible ⇒ motivo, sin excepción); T-06 (NORMAL: A y B admisibles; FATIGUE: A desaparece y la explicación cita el límite de salud; CRITICAL: ruta al refugio); el suavizado no sube el costo ni la pendiente máxima (PT-06); `contributions` suma el costo equivalente; `blockedDirectPath` nombra la primera violación de la recta.

### Tarea 7 · Reglas de salud (port de HUELLA)

**Archivos:** crear `src/core/trek/health/{rules,missionRules}.ts` y pruebas.

**Produce:** `createRuleEngine(setpointKpa, profiles)`, `evaluateRows(rows, engine): HuellaEvent[]`, `evaluateMissionRules(vars)`.

- [ ] Pruebas: PT-09 — el motor en TypeScript reproduce los seis `caminata_*_eventos.csv` (lee los CSV de `metricas de vida/huella_datos/`; se omite con aviso si la carpeta no está). Unitarias: filtro (sube en 3 s, baja en 30 s), dos reglas en SUPERVIVENCIA ⇒ ABORTAR, pareja EVA-17, modo regreso.

### Tarea 8 · Fatiga, máquina de estados y directiva

**Archivos:** crear `src/core/trek/health/{fatigue,fsm,directive}.ts` y pruebas.

**Produce:** `stepFatigue()`, `evaluateFatigueRules()`, `stepFsm(state, input): FsmState`, `directiveFor(fsm, context): NavigationDirective`.

- [ ] Pruebas: PT-11 (bajadas de un nivel; CRITICAL y EMERGENCY enclavados; sin datos nunca es NORMAL); FATIGUE entra con `F ≥ 0.6` y sale con `F ≤ 0.4`; directivas por estado según la tabla de la especificación; todos los multiplicadores ≥ 1; la escalera de CRITICAL termina en `hold-position`.

### Tarea 9 · Simulador de telemetría

**Archivos:** crear `src/core/trek/health/telemetry.ts` y prueba.

**Produce:** `createTelemetry(profile, seed)`, `stepTelemetry(state, input): { state, row }` con los incidentes de HUELLA y los nuevos (`fatiga_progresiva`, `perdida_sensores`, `emergencia_medica`).

- [ ] Pruebas: determinista con semilla; nominal ⇒ cero alertas en 20 min; `falla_ventilador` ⇒ PRECAUCIÓN → SUPERVIVENCIA; corte de sensores ⇒ CAUTION (foco 4); toda fila lleva `simulated: true`.

### Tarea 10 · Sesión y replanificación

**Archivos:** crear `src/core/trek/sim/{session,replanner,scenarios}.ts` y pruebas.

**Produce:** `createSession(config)`, `dispatch(session, event)`, `tick(session, dtS)`, `decideReplan()`.

- [ ] Pruebas: T-07 (al llegar a CRITICAL la meta pasa a refugio y queda enclavado); tormenta sobre la ruta ⇒ ruta nueva que no cruza el polígono y registro con la causa; cambio de costo ⇒ propuesta solo si mejora > 10 %; foco 5 (tres eventos simultáneos ⇒ una replanificación; mismo resultado en cualquier orden); margen de regreso < 0 ⇒ CRITICAL por EVA-01.

### Tarea 11 · Pantalla `/trek`

**Archivos:** crear `src/state/trekStore.ts`, `src/components/trek/*`, `src/routes/trek.tsx`; modificar `AppShell.tsx` (entrada de navegación y `FULL_BLEED`), `src/data/sources.ts`, `src/routeTree.gen.ts`.

- [ ] Funciones puras de vista con prueba: color y trama por zona, sombreado de relieve, segmentos de la barra de porqués (suman 100 %), textos es/en completos.
- [ ] Componentes según UX_UI_GUIDELINES §3.6 y §5: mapa primero; estado, zona y confianza con texto + forma + color; banda de simulación; controles estándar; sin `transition: all`.
- [ ] Verificación: `tsc --noEmit`, suite completa, `vite build`.

### Tarea 12 · Cierre

- [ ] Suite completa, `tsc`, build; copiar al repositorio; comprobar que el trabajo existente sigue intacto.
- [ ] Revisión final propia contra esta lista y el foco de revisión; actualizar `AGENT_GUIDELINES.md` y `ROADMAP.md`; ADR con las decisiones tomadas.
