# ADR-002 — Mapas con ortofoto real y pesos fisiológicos dinámicos del A*

- **Fecha:** 2026-11-15
- **Estado:** Aceptado e implementado
- **Relacionado con:** [ADR-001](ADR-001-corte-minimo-mars-trek.md), [ROUTING_ALGORITHM.md](../ROUTING_ALGORITHM.md), [ASTRONAUT_HEALTH_STATE_MACHINE.md](../ASTRONAUT_HEALTH_STATE_MACHINE.md)

## Contexto

Los mapas de `/trek` (Planificador · pestaña 02 y "La ruta, el clima y tu pulso" · pestaña 03) pintaban la rejilla de elevación de 129 × 129 nodos ampliada, con tinte rojo por altura: se veía como manchas. Además, el A* solo reaccionaba a la salud del astronauta cuando la máquina de estados (FSM) cambiaba de estado, con multiplicadores fijos por estado, y la sesión no usaba los datos de `metricas de vida/`.

## Decisiones

1. **Ortofoto real por escena.** `scripts/trek/dump-site-meshes.mjs` (Draco → triángulos con UV) + `scripts/trek/build_site_orthophotos.py` (rasterizado cenital, superficie más alta, supermuestreo 2×) generan `public/data/trek/gale/<escena>/orthophoto.jpg` (2048 px, 6.25 cm/px) alineada nodo a nodo con `elevation.f32`, más `orthophoto.json` con procedencia y cobertura (100 % en las 5 escenas). Las zonas que el rover no vio llegan en gris desde Access Mars; el mapa las tiñe de ocre solo para continuidad visual y lo dice en la leyenda.
2. **Render del mapa por capas.** Ortofoto → relieve sombreado (Horn, luz NO 45°) en mezcla *overlay* → capa temática translúcida remuestreada sin escalones → curvas de nivel (marching squares, `contours.ts`) → retícula de 10 m → vectores (ruta con casco oscuro). Lienzo a 2× (planificador) y 1.5× (plano isométrico).
3. **Pesos fisiológicos dinámicos (`health/physio.ts`).** En cada ciclo, la fila de telemetría se convierte en ocho necesidades en [0, 1] (cardio, térmica, respiración, traje, consumibles, fatiga, exposición, navegación): 0 = percentil de la caminata **nominal** de `metricas de vida` (`huellaReference.ts`, generado), 1 = umbral de `reglas.json` / `motor_reglas.py`. Las necesidades (suavizadas: suben con τ = 20 s, bajan con τ = 120 s; zona muerta 15 %) dan multiplicadores ≥ 1 para H, T, E, R, U en pasos de 0.25, el factor φ, una capacidad metabólica sostenible reducida (término H) y una **pendiente cómoda blanda** (15° → 10°) que añade una bisagra cuadrática al término T.
4. **La FSM se mantiene como autoridad.** La directiva que usa el enrutador es la de la FSM con multiplicadores combinados por **máximo** (`applyPhysioToDirective`). Estado, límites duros, zonas, meta, escalera, protocolo, enclavamientos y confirmación humana no cambian (prueba INV-P2).
5. **Caminatas HUELLA como fuente de telemetría.** `scripts/trek/build-huella-replay.mjs` convierte los 6 CSV de `metricas de vida/huella_datos/` (EVA1, cada 5 s) en `public/data/trek/huella/*.json`. En la pestaña 03 se elige "Telemetría: generador" o una caminata; el nivel HUELLA filtrado y los eventos de `motor_reglas.py` alimentan la FSM (REGRESO no cuenta como regla; EVA-21 > 75 % se atribuye a carga térmica).
6. **Valores por defecto de Murray Buttes.** El origen (-38, -28) y el destino (28, 24) estaban sobre laderas de 24° y 23° (Z5): la pantalla abría sin ruta. Se movieron a (-40, -16) y (25, 34); una prueba garantiza ruta admisible por defecto en las 5 escenas.

## Consecuencias

- 243 pruebas en verde (antes 216) y `tsc --noEmit` limpio. Nuevas: `physio.test.ts` (línea base nominal neutra, 5 incidentes HUELLA, INV-P1..P3, cresta de 12° en la que el A* elige rutas cada vez más suaves al subir la FC sin que la FSM cambie de estado, sesión con enclavamiento CRITICAL a t = 7675 s), `contours.test.ts`, `sites.test.ts`.
- Regenerar datos: `node scripts/trek/build-huella-replay.mjs` y `node scripts/trek/dump-site-meshes.mjs ../access-mars/public/terrain <tmp> && python3 scripts/trek/build_site_orthophotos.py <tmp> ../access-mars/public/terrain`.
- Todos los parámetros del mapeo necesidades → pesos son **[diseño]** y viven en `PHYSIO_PARAMS`.
