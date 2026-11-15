# RESOURCE_MANAGEMENT — Gestión de recursos de la misión

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md) · Relacionados: [ROUTING_ALGORITHM.md](ROUTING_ALGORITHM.md), [ASTRONAUT_HEALTH_STATE_MACHINE.md](ASTRONAUT_HEALTH_STATE_MACHINE.md), [DYNAMIC_COSTMAP.md](DYNAMIC_COSTMAP.md)

Este documento define qué recursos se siguen, cómo se estima su consumo según terreno, velocidad, carga y estado del astronauta, y cuándo un recurso deja de ser un costo y pasa a ser una restricción dura.

---

## 1. Punto de partida: dos modelos que ya existen

El repositorio tiene **dos** modelos de consumo en EVA, hechos por separado. Ambos funcionan y tienen pruebas o datos de referencia, pero no coinciden.

| Parámetro | Aplicación (`src/core/science/eva.ts`, `constants.ts`) | HUELLA (`generar_caminata_sintetica.py`) |
| --- | --- | --- |
| Velocidad en llano | 3.0 km/h (ASSUMPTION) | 2.0 km/h (el equipo la marca [NASA]) |
| Velocidad en pendiente | Función tipo Tobler normalizada | Reducción lineal con la pendiente **[diseño]**, mínimo 0.8 km/h |
| Gasto metabólico | 300 W + 12 W por grado (ASSUMPTION) | Ecuación de Pandolf (1977) con los términos de peso escalados a 0.38 g, calibrada a ≈ 1 000 kJ/h en llano (≈ 278 W) |
| Carga | No interviene | Masa corporal, traje de 104 kg, equipo y muestras |
| Energía por litro de O₂ | 20.1 kJ/L | 20.9 kJ/L |
| O₂ | kg consumidos | Presión de tanque: primario 950 psi, cae 2.13 psi/min por L/min de VO₂; secundario 6 000 psi |
| CO₂ | No se modela | VCO₂ = 0.85 · VO₂; capacidad del filtro **[diseño]** |
| Batería | Solo hábitat | 500 Wh, consumo 50 W **[diseño]** |
| Bajadas | Tobler distingue subir y bajar | Tratadas como llano |
| Paradas científicas | 20 min por punto de interés | Estaciones de 30–40 min a 1 024 kJ/h |

En llano los dos modelos dan un gasto parecido (278–300 W). Divergen en pendiente, con carga y en velocidad.

**Decisión D-M1.** Mars Trek no elige a ciegas. Define una interfaz única de modelo y dos implementaciones, y fija el modelo por defecto en BUILD con una comparación documentada:

```ts
interface LocomotionModel {
  id: 'tobler-linear' | 'pandolf-mars';
  speedMs(ctx: EdgeContext): number;          // pendiente con signo, terreno, carga, estado
  metabolicW(ctx: EdgeContext): number;
  provenance: Provenance;                     // MODELLED, con sus supuestos
}
```

Propuesta: **`pandolf-mars` por defecto** en Mars Trek, porque es el único que responde a la carga transportada, que el enunciado exige. `tobler-linear` se conserva sin cambios para el Explorer actual. La velocidad en llano (2 o 3 km/h) queda como pendiente P-05.

---

## 2. Recursos que se siguen

| Recurso | Unidad | Sujeto | Qué lo consume | ¿Restricción dura? | Regla HUELLA |
| --- | --- | --- | --- | --- | --- |
| Oxígeno primario | min restantes, kg, psi | Tripulante | Gasto metabólico | Sí | PRE-02, EVA-01 |
| Oxígeno secundario | min | Tripulante | Solo emergencia | Su uso es EMERGENCY | EVA-03 |
| Capacidad de retirar CO₂ | min restantes | Tripulante | Producción de CO₂ | Sí | PRE-02; EVA-04 por nivel |
| Agua de refrigeración | min restantes | Tripulante | Carga térmica | Sí | EVA-19 |
| Batería del traje | Wh, min | Tripulante | Consumo eléctrico | Sí | EVA-20 |
| Tiempo de EVA | min | Tripulante y equipo | Reloj | Sí (≤ 8 h) | PRE-09 |
| Luz diurna | min hasta el ocaso | Misión | Reloj solar | Sí | PRE-12, EVA-18 |
| Dosis de radiación | mSv acumulados | Tripulante | Tiempo a cielo abierto | Sí (límite de carrera) | PRE-14 |
| Agua de bebida | L | Tripulante | Tiempo y esfuerzo | No en v1; informativa | — |
| Capacidad de carga | kg | Tripulante o rover | Muestras y equipo | Sí (masa máxima) | PRE-10, PRE-17 |
| Energía del rover | Wh | Rover | Tracción y cargas fijas | Sí | — |
| Recursos del hábitat | O₂, agua, energía | Base | Ya modelados en `src/core/sim/` | Fuera del alcance de la ruta | — |

**Consumible limitante.** Como en HUELLA: el mínimo, en minutos restantes, entre O₂, agua de refrigeración, batería y capacidad de CO₂. Es el que gobierna el término `ε` del costo y la envolvente de alcanzabilidad.

---

## 3. Modelos de consumo

Todo lo de esta sección se etiqueta **MODELLED**. Los parámetros **[diseño]** no son datos de NASA.

### 3.1 Tripulación a pie

**Velocidad.** `v(e) = v_llano · f_pend(g) · f_terreno · f_estado`

- `f_pend`: del modelo de locomoción elegido.
- `f_terreno`: reduce la velocidad con rugosidad y suelo blando **[diseño]**.
- `f_estado`: `speedFactor` de la directiva de salud (1.0, 0.8, 0.7…).

**Gasto metabólico.** Con `pandolf-mars`, tal como lo implementa el equipo:

```
M = 1.5·W + 2.0·(W + L)·(L/W)²·γ + η·(W + L)·(1.5·v² + 0.35·v·G)·γ      [vatios]
```

`W` masa corporal (kg), `L` carga incluido el traje (kg), `v` velocidad (m/s), `G` pendiente en % (solo subidas), `η` factor de terreno, `γ = 0.38` fracción de gravedad. Después se aplica un factor de calibración para que el llano dé ≈ 1 000 kJ/h, la media de las EVA de Apolo (NASA TN D-7883).

Límites conocidos del modelo, que el equipo ya documentó: Pandolf no se diseñó para trajes presurizados ni modela bien las bajadas.

**Oxígeno y CO₂.**

```
VO₂ [L/min]  = M [kJ/min] / e_O2          e_O2 = 20.9 kJ/L (pendiente P-06: 20.1 o 20.9)
VCO₂ [L/min] = RQ · VO₂                   RQ = 0.85
```

**Refrigeración y batería.** El agua de refrigeración se consume en proporción a la carga térmica, que sigue al gasto metabólico; la batería, a potencia casi constante. Coeficientes **[diseño]** hasta tener fuente (P-06).

**Efecto del estado de salud.** El estado no cambia la fisiología del modelo; cambia las **entradas**: menor velocidad, descansos obligatorios y, en FATIGUE, un sobrecosto metabólico **[diseño]** que representa la pérdida de eficiencia. Todo ello llega por la directiva.

### 3.2 Rover

Modelo longitudinal estándar por metro recorrido:

```
E'(e) [J/m] = max(0, m·g·(C_rr·cos θ + sin θ)) / η_t  +  P_fija / v
```

`m` masa total, `g = 3.71 m/s²` (constante del proyecto), `C_rr` resistencia a la rodadura según el terreno (capa L05), `θ` pendiente con signo, `η_t` rendimiento de la tracción, `P_fija` potencia de sistemas, `v` velocidad. Sin recuperación de energía en bajada.

- Dato verificado: la velocidad máxima de conducción de Perseverance es 4.2 cm/s, fijada por las relaciones de engranaje ([Rankin et al. 2023](https://www-robotics.jpl.nasa.gov/media/documents/2023-rapid-traverse.pdf)).
- `m`, `C_rr`, `η_t`, `P_fija` y la batería son **parámetros del perfil de vehículo**. Para rovers reales se documentará su fuente; para un rover tripulado conceptual son **[diseño]** de escenario (P-06).

### 3.3 Paradas

- Punto de interés científico: duración configurable (20 min en la aplicación; 30–40 min en HUELLA).
- Descanso por directiva de salud: duración y cadencia de `requiredRest`.
- En parada se consume al ritmo de reposo o de trabajo de estación, no de marcha.

---

## 4. Presupuesto, reservas y márgenes

### 4.1 Definiciones (heredadas de HUELLA)

```
consumible_limitante_min = mín(O₂, refrigeración, batería, CO₂)   en minutos restantes
margen_regreso_min       = consumible_limitante_min − t_regreso_min − reserva_min
margen_regreso_pct       = 100 · margen_regreso_min / consumible_limitante_min
```

`t_regreso_min` se calcula **por la ruta segura**, no en línea recta. Esto es exactamente lo que entrega el motor de rutas.

### 4.2 Reservas

| Reserva | Valor de partida | Etiqueta |
| --- | --- | --- |
| O₂ secundario | ≥ 30 min, intocable en planificación | Heredado (práctica EMU según el equipo) |
| Margen de regreso | ≥ 20 % para GO; < 20 % precaución; < 0 no-go | HUELLA PRE-01 |
| Luz | Regreso ≥ 120 min antes del ocaso para GO; < 60 min no-go | HUELLA PRE-12 **[diseño]** |
| Dosis | Precaución al 80 % del límite de carrera | HUELLA PRE-14 **[diseño]** |
| Margen de modelo | +25 % sobre tiempo y consumo previstos | **[diseño]**, ver §4.3 |

### 4.3 Por qué un margen de modelo

En la evaluación de campo del planificador SEXTANT del MIT en MDRS, el tiempo real de travesía y el consumo de energía fueron significativamente **mayores** que los previstos, mientras que la distancia sí coincidió ([Gilkey et al.](https://dspace.mit.edu/handle/1721.1/81410)). Los modelos de locomoción con traje tienden a ser optimistas. Mars Trek aplica un margen explícito, lo muestra en la interfaz y lo deja configurable. El 25 % coincide con la contingencia que ya usa `sizeSupplies()` en el simulador del proyecto.

---

## 5. Cuándo un recurso es restricción dura

| Condición | Momento | Efecto | Origen |
| --- | --- | --- | --- |
| El consumible limitante no cubre plan + reserva | Antes de salir | NO-GO: no se emite ruta | PRE-02 |
| Margen de regreso < 0 | Antes de salir | NO-GO | PRE-01 |
| Margen de regreso < 0 | En ruta | CRITICAL: regreso inmediato | EVA-01 |
| Margen de regreso < 20 % | En ruta | CAUTION | EVA-01 |
| Batería < regreso + reserva | En ruta | CRITICAL | EVA-20 |
| Luz < regreso + 30 min | En ruta | CRITICAL | EVA-18 |
| Agua de refrigeración en reserva | En ruta | CAUTION | EVA-19 |
| O₂ secundario en uso | En ruta | EMERGENCY | EVA-03 |
| Dosis prevista supera el límite de carrera | Antes de salir | NO-GO | PRE-14 |
| Celda fuera de la envolvente de alcanzabilidad | Planificación | La celda se excluye del grafo | ROUTING_ALGORITHM §5.3 |

Las condiciones "en ruta" las evalúa el **módulo de salud** con las variables derivadas que le entrega este módulo. El módulo de recursos calcula; no decide estados.

---

## 6. Envolvente de alcanzabilidad

Formaliza el punto de no retorno. Algoritmo y garantías en ROUTING_ALGORITHM §5.3. Aquí, qué produce:

| Salida | Uso |
| --- | --- |
| `Q_ida(n)` y `Q_regreso(n)` por celda, en unidades del consumible limitante | Máscara de celdas inadmisibles |
| Contorno de alcance ("hasta dónde puedo ir y volver con reserva") | Capa de la interfaz, equivalente a la autonomía de un navegador |
| Punto de no retorno a lo largo de la ruta | Marca en la ruta y en la línea de tiempo |
| Refugio de regreso asignado a cada celda | Meta de emergencia inmediata |

La envolvente se recalcula cuando cambia el estado de recursos más allá de una tolerancia (evento `E-RES`), cuando cambia la directiva de salud o cuando cambia el conjunto de refugios.

---

## 7. Plan frente a ejecución

| Elemento | Descripción |
| --- | --- |
| Plan de recursos | Perfil previsto de cada recurso a lo largo de la ruta (por tramo) |
| Seguimiento | Estado real (simulado) frente al previsto |
| Desviación | `E-RES` si un recurso se aparta > 10 % del plan **[diseño]** o si un margen cruza un umbral |
| Reestimación | Se recalculan tiempos y consumos del resto de la ruta con el ritmo observado |

```ts
interface ResourceState {
  subjectId: string; missionTimeS: number;
  o2PrimaryMin: number; o2SecondaryMin: number; co2CapacityMin: number;
  coolantMin: number; batteryWh: number; evaElapsedMin: number;
  doseCareerMSv: number; doseEvaMSv: number; payloadKg: number;
  limiting: { resource: string; minutes: number };
  simulated: boolean;
}
interface ResourcePlan {
  perSegment: Array<{ durationMin; energyWh; o2Kg; doseUSv; limitingAfterMin }>;
  totals: { durationMin; energyWh; o2Kg; doseUSv };
  returnMarginMin: number; returnMarginPct: number; pointOfNoReturnAtM: number | null;
  modelMarginPct: number; provenance: Provenance;
}
```

---

## 8. Perfiles de misión

| Perfil | Presupuesto que manda | Notas |
| --- | --- | --- |
| Astronauta individual | El suyo | Solo simulación y análisis |
| Equipo | El del miembro con **menor** margen | Velocidad del más lento; cada miembro conserva su estado |
| Rover autónomo | Energía del rover, luz si es solar | Sin oxígeno ni salud |
| Rover con tripulación | Ambos a la vez | Además, **alcance a pie**: en todo punto, la tripulación debe poder volver andando a un refugio si el rover falla |

La restricción de alcance a pie es la heredera del límite de caminata de regreso de Apolo, que HUELLA cita en PRE-01. NASA estudió la viabilidad de una caminata de regreso de 10 km con traje en el *EVA Walkback Test* (NASA/TP-2009-214796).

---

## 9. Radiación: ambiental frente a acumulada

| Concepto | Dónde vive | Unidad | Fuente |
| --- | --- | --- | --- |
| Tasa ambiental (rayos cósmicos) | Capa L08 del costmap | mSv/sol | Modelo del proyecto anclado a MSL-RAD: 0.64 ± 0.12 mSv/día en Gale (Hassler et al. 2014), escalado por la columna atmosférica |
| Evento de partículas solares | Capa L09 (alerta con vigencia) | estado | DONKI y escenarios |
| Dosis de la EVA | Estado del tripulante | mSv | Tasa ambiental × tiempo a cielo abierto |
| Dosis de carrera | Estado del tripulante | mSv | Acumulado; límite de 600 mSv (NASA-STD-3001 Vol. 1) |

El exponente con el que la dosis depende de la presión en el modelo actual (0.25) es un supuesto del proyecto, ya rotulado como tal en `constants.ts`.

---

## 10. Decisiones y pendientes

| ID | Tema | Estado |
| --- | --- | --- |
| D-M1 | Interfaz única de modelo de locomoción con dos implementaciones | Propuesta |
| D-M2 | Consumible limitante y margen de regreso definidos como en HUELLA | Propuesta |
| D-M3 | Margen de modelo explícito del 25 % | Propuesta |
| P-05 | Velocidad en llano: 2 km/h (HUELLA) o 3 km/h (aplicación) | **Pendiente del usuario** |
| P-06 | Energía por litro de O₂; coeficientes de refrigeración, batería y filtro; parámetros de los rovers | Pendiente de investigación en H5 |

## 11. Referencias

- Pandolf, K., Givoni, B., Goldman, R. (1977). *Predicting energy expenditure with loads while standing or walking very slowly*. J Appl Physiol 43(4).
- Santee, W. et al. (2001). *A proposed model for load carriage on sloped terrain*. Aviat Space Environ Med 72(6). Modelo usado por planificadores de travesía EVA; candidato para comparar en H5.
- NASA TN D-7883, tasas metabólicas en las EVA de Apolo: <https://www.nasa.gov/wp-content/uploads/static/history/alsj/tnD7883Metabolic.pdf>
- Norcross, J. et al. (2009). *Feasibility of Performing a Suited 10-km Ambulation: Final Report of the EVA Walkback Test*. NASA/TP-2009-214796.
- Gilkey, A. et al. *Evaluation of a Surface Exploration Traverse Analysis and Navigation Tool*. <https://dspace.mit.edu/handle/1721.1/81410>
- Rankin, A. et al. (2023). *Perseverance Rapid Traverse Campaign*. <https://www-robotics.jpl.nasa.gov/media/documents/2023-rapid-traverse.pdf>
- Anderson, M. et al. (2018). *Life Support Baseline Values and Assumptions Document*. NASA/TP-2015-218570 (ya usado en `constants.ts`).
- Hassler, D. et al. (2014). *Mars' surface radiation environment measured with the MSL Curiosity rover*. Science 343.
- Documentación del equipo: `metricas de vida/huella_datos/DOCUMENTACION_caminata_sintetica.md`.
