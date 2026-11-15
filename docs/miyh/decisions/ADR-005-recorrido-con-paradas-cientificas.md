# ADR-005 — Recorrido con paradas científicas, caminata por defecto con riesgo y avisos del motor en inglés

- **Fecha:** 2026-11-15
- **Estado:** Aceptado e implementado
- **Relacionado con:** [ADR-004](ADR-004-entorno-de-marte-y-velocidad-de-simulacion.md), revisión tipo jurado del ledger (2026-11-15)

## Contexto

La revisión tipo jurado dejó tres pendientes: (1) la caminata por defecto duraba 2.7 min y sobraban 523 min de oxígeno, sin historia de riesgo; (2) en inglés los avisos del motor salían en español; (3) la ruta admitía un solo destino, sin recorrido por varias paradas científicas.

## Decisiones

1. **Paradas en el motor (`core/trek/routing/tour.ts`).** `RouteRequest.stops` (id, nombre, punto, minutos de trabajo). `planRoute` encadena tramos A* origen → paradas → destino bajo la misma envolvente: ninguna parada relaja un límite. Una parada sin corredor admisible se omite con su motivo. El trabajo en una parada no mueve al astronauta pero consume (1000 kJ/h, referencia HUELLA): entra en totales, en el margen de regreso y en el punto de no retorno. En CRITICAL/EMERGENCY la directiva manda al refugio y las paradas se ignoran.
2. **Sesión.** `stops`, `stopIdx`, `stopLog` (hecha/omitida/interrumpida) y `dwell`. El astronauta se detiene en cada parada el tiempo de trabajo; si se emprende el regreso o la directiva manda al refugio, el trabajo se interrumpe. Evento `set-stops` para editar el itinerario. `walkComplete` detecta el fin de la EVA; la interfaz pausa el reloj para que el traje no siga gastando con la caminata terminada. El margen EVA-01 incluye el trabajo pendiente.
3. **Caminata por defecto.** Murray Buttes (sitio inicial), Pahrump Hills y Marias Pass abren con rover → 3 estaciones junto a objetivos reales de Curiosity → rover (~2.2–2.6 h de EVA). Los tiempos de trabajo son [diseño], del orden de las estaciones de Apollo 15–17; los puntos de observación están validados con A* (`defaultTour.test.ts`).
4. **Riesgo.** Los incidentes históricos pasan a intensidad «Realista» por defecto: en 2.6 h dan ~2 incidentes esperados (con «Demo ×12» serían ~7, pensado para caminatas de 3 min). Comprobado en el navegador: un SEP simulado interrumpió la estación 2 y el equipo volvió al rover.
5. **Interfaz.** Planificador: tarjeta «Itinerario científico» (reordenar, quitar, ±5 min, restaurar, tiempos T+ por parada, consumible al regresar) y «Añadir como parada» en «Ciencia en la ruta». Mapa: estaciones numeradas. Caminata: fila compacta de estaciones bajo el mapa 3D y avance por tiempo de EVA.
6. **Avisos del motor en inglés (`marswalk/engineText.ts`).** El motor sigue escribiendo en español (paridad HUELLA y trazabilidad); la traducción se hace al mostrar con plantillas ordenadas. `engineText.test.ts` recorre las plantillas del código del motor y falla si alguna queda en español.

## Consecuencias

- 299 pruebas en verde (46 archivos), `tsc` limpio, ESLint limpio en los archivos tocados.
- Si se agrega un aviso nuevo al motor sin su plantilla en inglés, la prueba lo detecta.
