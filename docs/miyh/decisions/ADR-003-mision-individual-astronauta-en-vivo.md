# ADR-003 — Misión individual: astronauta en vivo, fallas en el camino y máquina de estados visible

- **Fecha:** 2026-11-15
- **Estado:** Aceptado e implementado
- **Relacionado con:** [ADR-002](ADR-002-mapas-ortofoto-y-pesos-fisiologicos.md), `metricas de vida/huella_datos/simulador_huella.html`

## Decisiones

1. **Astronauta en vivo (`core/trek/health/liveSuit.ts`).** Port determinista (PRNG con estado) del modelo por segundo de `simulador_huella.html`: Pandolf a 0.38 g con masa y carga del tripulante, FC esperada por reserva de VO₂ (FCmáx de Tanaka), disipación del LCVG escalada por BSA de Mosteller, ventilador → CO₂, fuga → presión y O₂ secundario, arritmia, pérdida de enlace, susto (+35 lpm) y dosis. SpO₂ y frecuencia respiratoria no existían en el simulador: se añaden como valores plausibles **[diseño]**.
2. **Reglas y filtro.** Reglas HUELLA instantáneas del simulador (EVA-02/03/04/05/07/09/12/13/16/21, 2+ SUPERVIVENCIA ⇒ ABORTAR) con el setpoint configurado. Filtro: sube si dura ≥ 3 s; de SUPERVIVENCIA/ABORTAR baja a PRECAUCIÓN al resolverse; de PRECAUCIÓN a ESTABLE solo tras *n* s de observación (editable).
3. **La FSM no cambia.** El nivel filtrado y las reglas que lo justifican entran a `fsm.ts` como cualquier otra fuente. CRITICAL sigue enclavado (refugio o IV) y EMERGENCY con candado IV1 permanente: el interruptor del simulador se muestra activo y bloqueado.
4. **Solo en misión individual (`solo`).** La sesión crea el astronauta en vivo (perfil EVA1 por defecto) y conserva parámetros y fallas al cambiar de sitio o reiniciar. La pendiente del modelo es la del tramo de la ruta A* en curso (o una manual). Carga y dosis de carrera pasan a los recursos; edad, setpoint y dosis de carrera (PRE-14) alimentan los pesos fisiológicos del A*.
5. **UI.** Planificador → pestaña «Astronauta» (parámetros + radiación). Simulación → tres columnas: mapa · vitales + diagrama de la máquina de estados (estado activo, transiciones, cuenta de confirmación/observación, enclavamiento, últimas transiciones) · consola (Fallas y protocolo · Astronauta · Radiación · Asistente). SPE en vivo usa ×150 [diseño] como el simulador.

## Consecuencias

- 252 pruebas en verde; nuevas en `liveSuit.test.ts` (nominal estable, determinismo, susto sin escalar, ventilador → SUPERVIVENCIA → ABORTAR, observación *n*, efecto de los parámetros, matriz de radiación, sesión individual que llega a EMERGENCY y no se libera sola).
