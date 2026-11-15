# ADR-001 — Decisiones de Implementación del Corte Mínimo de Mars Trek

- **Fecha:** 2026-11-15
- **Estado:** Aceptado e implementado
- **Relacionado con:** [MARS_TREK_MASTER_PLAN.md](../../MARS_TREK_MASTER_PLAN.md), [2026-11-15-corte-minimo.md](../plans/2026-11-15-corte-minimo.md)

## Contexto

Para completar el navegador de rutas en Marte (*Mars Trek · Navegador*) dentro de la aplicación principal `Nasa-Space-App-challange-2026` sin romper las 150 pruebas existentes ni introducir dependencias externas nuevas, fue necesario cerrar las decisiones abiertas `P-01..P-21` y documentar las reglas de diseño adoptadas en código.

## Decisiones Tomadas

1. **Rutas de interfaz (`/trek` y `/martian-map`):** Se habilitaron tanto `/trek` (especificada en `ARCHITECTURE.md` y `2026-11-15-corte-minimo.md`) como `/martian-map` (alias directo al mismo espacio de trabajo `TrekWorkspace`) para garantizar compatibilidad total con ambos flujos de demostración.
2. **Sitio piloto y teselas reales de Gale (`P-02`):** Se extrajeron las 5 escenas fotogramétricas `TYPE_TILE` de Curiosity en el Cráter Gale (`landing_site`, `pahrump_hills`, `marias_pass`, `murray_buttes`, `live_site`) mediante `scripts/trek/build-site-tiles.mjs` a rejillas binarias `129×129` a `1 m` con cobertura del `100 %` y verificación `sha256`.
3. **Límite de pendiente y modo de evaluación (`P-04`):** El límite duro de pendiente a pie en `NORMAL` es `20°` (`EVA-EXP-0042`), bajando a `15°` en `FATIGUE`/`CRITICAL` y a `10°` en `CAUTION` fisiológico. La máscara por defecto evalúa `max(pendiente_arista, pendiente_celda)` y ofrece `slopeMode: "edge"` para equivalencia exacta (`PT-08`) con `findSafePath`.
4. **Modelos de locomoción (`P-05`, `D-M1`):** Se implementaron `pandolf-mars` (`2.0 km/h` en llano, calibrado a `1000 kJ/h` para el tripulante de referencia `65 kg + 104 kg + 3.4 kg`) y `tobler-linear` (compatible con `src/core/science/eva.ts`) bajo la interfaz común `LocomotionModel`.
5. **Paridad con HUELLA y máquina de estados (`P-12`, `D-H1..H4`):** `src/core/trek/health/rules.ts` reproduce exactamente los 6 archivos `caminata_*_eventos.csv` de `metricas de vida/huella_datos/` (`PT-09`), incluyendo redondeo *round-half-to-even*, filtro `3 s / 30 s`, escalamiento por 2 reglas en `SUPERVIVENCIA → ABORTAR`, regla de pareja `EVA-17` y enclavamientos `return-mode` / `iv-lock` con confirmación humana y justificación registrada.
6. **Honestidad de datos y capas `no_disponible` (`INV-R4`, `INV-C1`):** Ningún dato sin valor se rellena con `0` (`NaN → K5 → Z3`), la telemetría simulada conserva `simulated: true` hasta la interfaz, y las capas orbitales que carecen de ráster numérico a escala EVA en el repositorio (MOLA/HRSC 200 m, THEMIS TI WMTS RGB, CRISM/OMEGA sin archivo PDS local) se muestran desacopladas como `no_disponible`.

## Consecuencias

- Las 30 suites de pruebas del repositorio (19 originales + 11 de Mars Trek) pasan en verde sin alterar `src/core/science/**`, `src/core/sim/**`, `src/core/decision/**` ni `src/state/missionStore.ts`.
