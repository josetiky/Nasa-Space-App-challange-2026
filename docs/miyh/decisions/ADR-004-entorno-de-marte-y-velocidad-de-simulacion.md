# ADR-004 — Entorno de Marte con datos reales y velocidad de simulación

- **Fecha:** 2026-11-15
- **Estado:** Aceptado e implementado
- **Relacionado con:** [ADR-002](ADR-002-mapas-ortofoto-y-pesos-fisiologicos.md), [ADR-003](ADR-003-mision-individual-astronauta-en-vivo.md), `DATA_SOURCES.md` (S12 REMS, S21 DONKI)

## Contexto

Se pidió que los valores dinámicos de la simulación dependan de sensores de Marte en tiempo real y que la velocidad de la simulación sea ajustable. No existe un flujo público en tiempo real desde la superficie de Marte: REMS (Curiosity) publica un registro por sol con semanas o meses de retraso, y DONKI mide partículas solares desde el entorno terrestre. Por eso cada valor lleva su procedencia en la interfaz.

## Decisiones

1. **Velocidad.** Botones ×1 · ×5 · ×15 · ×60 · ×300 (segundos de misión por segundo real) en el mapa de la simulación.
2. **Módulo puro `core/trek/env/marsEnv.ts`.** `buildMarsEnv` arma una instantánea con procedencia por valor: **REAL** (dato medido), **DERIVED** (calculado a partir de datos reales o del reloj real), **MODELLED** (climatología o supuesto), y los sensores del astronauta siguen **SIMULATED**.
   - Hora solar verdadera (LTST), Ls y año marciano: Mars24 con el reloj UTC real (DERIVED). Elevación del Sol: latitud de Gale + declinación por Ls (DERIVED). Avanzan con el reloj de la simulación.
   - Presión, mínima y máxima del aire: último sol válido de REMS, con su antigüedad (REAL). La temperatura del instante se interpola con un ciclo diario entre esas dos medidas (DERIVED).
   - Dosis GCR: escalada con la presión de REMS (columna de CO₂) y anclada a MSL/RAD en Gale, 0.64 mSv/día (DERIVED).
   - τ del polvo: climatología estacional por Ls (MODELLED); REMS solo publica opacidad categórica.
   - SEP: eventos de DONKI de los últimos 30 días; activo si hubo uno en las últimas 48 h (REAL). Sin respuesta → sin alerta (MODELLED).
   - Enfriamiento del traje: PRE-07, la presión ambiente reduce la eficacia del sublimador por encima de 7 Torr.
3. **Efecto en la sesión.** La elevación del Sol alimenta el término R (luz) del A*; τ y dosis, el costmap y los recursos; SEP activo dispara EVA-13 en la FSM (refugio obligatorio, dosis ×4); el factor de enfriamiento entra al astronauta en vivo.
4. **Ejemplos.** «Ahora en Gale», «Atardecer» (T+0 ≈ 55 min antes de la puesta de Sol geométrica del día), «Temporada de polvo» (Ls 255), «SEP real (DONKI)» (el último episodio real; si no hubo en 30 días, el último de los episodios DONKI 2024 incluidos con el simulador Sol-by-Sol) y «Valores fijos».
5. **Acceso a DONKI.** El proxy `/api/nasa/donki` acepta `?days=` (1–365) y devuelve también las fechas crudas. La consulta del entorno usa 30 días: primero el proxy (que usa `NASA_API_KEY` si está definida), luego `api.nasa.gov` directo con `DEMO_KEY`. La respuesta se guarda 3 h en `localStorage` porque `DEMO_KEY` admite unas 30 peticiones por hora por IP. Con 365 días y `DEMO_KEY` la API respondía 400.
6. **FSM.** Un enclavamiento CRITICAL/EMERGENCY sin disparadores nuevos conserva la causa que lo provocó, para que el protocolo (p. ej. refugio SEP) no cambie cuando se apaga el disparador.

## Consecuencias

- 261 pruebas en verde (39 archivos); nuevas en `marsEnv.test.ts` y `health.test.ts`.
- Sin `NASA_API_KEY`, DONKI puede quedar sin respuesta hasta una hora tras muchas recargas; la interfaz lo dice y sugiere definir la clave en el servidor.
- La hora del atardecer sale de la geometría (Mars24), no de la hora de puesta que publica REMS, que está en hora solar media y difiere de la verdadera por la ecuación del tiempo.
