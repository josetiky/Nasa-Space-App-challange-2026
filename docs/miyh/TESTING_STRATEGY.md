# TESTING_STRATEGY — Pruebas y validación de Mars Trek

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md) · Relacionados: [ROUTING_ALGORITHM.md](ROUTING_ALGORITHM.md), [ASTRONAUT_HEALTH_STATE_MACHINE.md](ASTRONAUT_HEALTH_STATE_MACHINE.md), [ROADMAP.md](ROADMAP.md)

En PLANNING no se escribe ninguna prueba. Este documento define qué se probará, con qué datos y qué resultado cuenta como correcto, para que BUILD pueda trabajar con pruebas primero.

---

## 1. Línea base medida

Estado del repositorio principal antes de empezar, medido el 2026-11-14 sobre el árbol de trabajo actual (rama `feature/intelligent-mission-control`, **incluidos** los cambios sin confirmar):

| Comprobación | Resultado |
| --- | --- |
| `vitest run` | **19 archivos, 150 pruebas, todas en verde** (0.65 s) |
| `tsc --noEmit` (modo estricto) | **Sin errores** |
| Dependencias | 495 paquetes instalados con `npm ci` sin fallos |

Cómo se midió: el repositorio **no tiene `node_modules`**. Para no instalar dentro de la carpeta del usuario (se instalarían binarios de Linux en una carpeta de macOS), se copió el código fuente a un directorio temporal fuera de la carpeta, se instaló allí y se ejecutó. La carpeta del usuario no se modificó.

Nota: la hoja de ruta existente menciona 102 pruebas; hoy son 150, por las pruebas añadidas después (atlas de misiones, travesía de boxwork, tarjeta de EVA).

**Regla para BUILD (INV-T1):** ninguna tarea de Mars Trek puede dejar estas 150 pruebas en rojo ni introducir errores de tipos.

---

## 2. Niveles de prueba

| Nivel | Qué cubre | Herramienta | Cuándo corre |
| --- | --- | --- | --- |
| Unitarias | Funciones puras del núcleo: términos de costo, clasificación de zonas, puntuación de confianza, reglas, modelos de consumo | Vitest | En cada cambio |
| De propiedad | Invariantes con entradas aleatorias y semilla fija (§4) | Vitest con generadores propios sobre `src/core/rng.ts` | En cada cambio |
| De contrato | Que cada módulo produce y acepta exactamente los tipos de `contracts/` | `tsc` más pruebas de forma | En cada cambio |
| De paridad | El motor de salud en TypeScript frente a las salidas del motor Python | Vitest con los CSV de HUELLA como referencia | En cada cambio de `health/` |
| De escenario | Los doce escenarios del enunciado, ejecutados sin interfaz con guiones (§3) | Vitest más el simulador | En cada integración |
| De regresión | Equivalencia con `findSafePath` y las 150 pruebas existentes | Vitest | En cada cambio |
| De rendimiento | Presupuestos de tiempo de planificación y replanificación | Banco de pruebas en Node y en navegador | Por hito |
| De datos | Manifiestos, sumas de comprobación, rangos físicos, procedencia | Guion de validación del pipeline | Al regenerar datos |
| De extremo a extremo | Flujo en navegador: elegir, planificar, simular, replanificar, comparar | Playwright (ya usado por el equipo) | Por hito |
| De experiencia | Auditoría de accesibilidad, rendimiento y diseño; datos extremos | Skills de UX (UX_UI_GUIDELINES §8) | Por hito de interfaz |

No se añade ninguna dependencia de pruebas nueva en la versión 1: los generadores de propiedad se escriben sobre el generador con semilla que ya existe.

---

## 3. Escenarios de aceptación

Cada escenario es un guion (`ScenarioScript`, ARCHITECTURE §8) con resultado esperado. Formato: **Preparación → Estímulo → Resultado esperado**, más los invariantes que deben cumplirse en todo momento.

### T-01 · Ruta con terreno completamente conocido

- **Preparación:** sitio piloto; origen y destino dentro de una zona K1–K2; perfil "equilibrado"; estado NORMAL.
- **Estímulo:** planificar.
- **Esperado:** hay ruta; 100 % de su longitud en clases ≥ clase mínima del perfil; contribución del término U baja; todas las métricas con procedencia.
- **Invariantes:** PT-01, PT-04, PT-07.

### T-02 · Ruta con terreno desconocido

- **Preparación:** el camino directo cruza una franja K5; existe un rodeo conocido más largo.
- **Estímulo:** planificar con perfil tripulado y, después, con perfil de reconocimiento robótico.
- **Esperado:** el perfil tripulado toma el rodeo y **nunca** pisa K5; la explicación lista "confianza K5" como motivo de descarte del camino directo; el perfil robótico puede acortar por K4 pagando costo, pero tampoco pisa K5.
- **Variante:** si el destino está dentro de K5, el resultado es "sin ruta" con motivo, no una ruta degradada.

### T-03 · Tormenta de polvo que modifica los costos

- **Preparación:** ruta activa; guion con un polígono de tormenta que entra en la ruta.
- **Estímulo:** primero sube la opacidad en una región (cambio de costo); después la tormenta activa cubre un tramo (máscara).
- **Esperado:** con el cambio de costo, se propone alternativa solo si mejora más del umbral `δ`; con la máscara, la ruta actual se invalida, se **repara** y la nueva ruta no cruza el polígono; se registra `E-COST` y luego `E-MASK` con su región sucia.
- **Invariantes:** PT-03 (el resultado reparado cuesta lo mismo que planificar desde cero).

### T-04 · Incremento de radiación

- **Preparación:** ruta activa a cielo abierto; refugios definidos.
- **Estímulo:** (a) sube la tasa ambiental en una zona; (b) se activa una alerta de partículas solares.
- **Esperado:** (a) aumenta el término R y la dosis prevista; se replanifica si conviene. (b) toda celda sin abrigo pasa a prohibida para tripulación a pie, el estado sube según las reglas (EVA-13) y la meta pasa al refugio blindado más cercano; no se generan rutas que aumenten el tiempo a cielo abierto.
- **Métrica clave:** dosis acumulada prevista antes y después.

### T-05 · Cambio de batería disponible

- **Preparación:** ruta activa de ida y vuelta con margen de regreso del 30 %.
- **Estímulo:** la batería cae un 25 % de golpe.
- **Esperado:** evento `E-RES`; se recalcula la envolvente de alcanzabilidad; si el destino queda fuera, la ruta se acorta al punto alcanzable o se ordena el regreso; la interfaz muestra el nuevo contorno de alcance y el punto de no retorno. Si la batería ya no cubre regreso más reserva, el estado pasa a CRITICAL (regla EVA-20).

### T-06 · Astronauta con fatiga (ejemplo del enunciado)

- **Preparación:** dos corredores entre origen y destino: **A**, 5 km con tramos de 17°; **B**, 6 km con pendiente máxima de 9°.
- **Estímulo:** planificar en NORMAL; después inyectar `fatiga_progresiva` hasta entrar en FATIGUE; después forzar CRITICAL.
- **Esperado:**

| Estado | Resultado |
| --- | --- |
| NORMAL | Ambas rutas son admisibles; se elige por costo y se muestran las dos comparadas |
| FATIGUE | A deja de existir (17° > 15°); la ruta es B; la explicación cita el límite de pendiente impuesto por salud |
| CRITICAL | No se evalúan A ni B; se calcula ruta al refugio más cercano |

- **Variante:** con A limitada a 14°, sigue admisible en FATIGUE pero B gana por costo.

### T-07 · Astronauta en estado crítico

- **Preparación:** equipo de dos; ruta activa; refugios definidos.
- **Estímulo:** escenario `falla_ventilador` de HUELLA (PRECAUCIÓN → SUPERVIVENCIA → ABORTAR).
- **Esperado:** al llegar a CRITICAL se suspende la planificación ordinaria y la meta pasa a refugio; el compañero recibe la directiva de regresar con él; el estado queda enclavado aunque la señal mejore; al llegar a EMERGENCY se aplica el protocolo y el candado de autorización.
- **Invariantes:** PT-11 (enclavamientos, bajadas de un nivel).

### T-08 · Pérdida de sensores

- **Preparación:** ruta activa; estado NORMAL.
- **Estímulo:** (a) un sensor entrega valores imposibles; (b) se corta toda la telemetría biomédica; (c) se pierde la comunicación más de 5 min.
- **Esperado:** (a) la muestra se descarta y el sensor queda marcado, sin bajar el estado; (b) CAUTION inmediato por SEN-04; (c) CAUTION y regreso al último punto de paso. En ningún caso la ausencia de datos produce NORMAL.

### T-09 · Recuperación después de descanso

- **Preparación:** estado FATIGUE, ruta B activa, zona de descanso disponible.
- **Estímulo:** escenario `recuperacion_descanso`.
- **Esperado:** FATIGUE → NORMAL solo tras cumplir el umbral de salida durante el tiempo de salida; al volver a NORMAL se **propone** de nuevo A si mejora más de `δ` y el margen lo permite, sin imponer el cambio; el registro muestra la histéresis.

### T-10 · Ruta bloqueada por una restricción de seguridad

- **Preparación:** el único corredor al destino cruza una zona Z5 o una pendiente por encima del límite.
- **Estímulo:** planificar.
- **Esperado:** resultado "sin ruta" con el motivo y la restricción que lo causa; **nunca** una ruta que cruce la zona; se sugieren destinos alternativos alcanzables. Se repite con el peso de seguridad en cero para comprobar que ningún peso habilita la zona.
- **Invariantes:** PT-04, PT-05.

### T-11 · Cambio simultáneo de varias condiciones

- **Preparación:** ruta activa.
- **Estímulo:** en el mismo instante: entra una tormenta, el astronauta pasa a FATIGUE y la batería cae.
- **Esperado:** una sola replanificación coherente con la envolvente compuesta (lo más restrictivo de todo); el registro lista las tres causas; el resultado no depende del orden de llegada de los eventos.

### T-12 · Misión con varios astronautas

- **Preparación:** equipo de tres con perfiles distintos.
- **Estímulo:** uno entra en FATIGUE; después otro en CAUTION.
- **Esperado:** la ruta del equipo cumple los límites del miembro más restrictivo en cada momento; la velocidad es la del más lento; el margen de regreso es el del miembro con menos margen; la interfaz indica qué miembro impone cada límite; el promedio del equipo no interviene en ninguna decisión.

---

## 4. Pruebas de propiedad

Entradas aleatorias con semilla fija. Cada propiedad se ejecuta sobre cientos de casos.

| ID | Propiedad | Garantiza |
| --- | --- | --- |
| PT-01 | El costo de A\* es igual al de Dijkstra en rejillas aleatorias | Optimalidad |
| PT-02 | Para toda arista, `h(a) ≤ c(a→b) + h(b)`, con pesos y capas aleatorios válidos | Heurística consistente |
| PT-03 | Tras cualquier secuencia de cambios locales, D\* Lite da el mismo costo que A\* desde cero | Reparación correcta |
| PT-04 | Ninguna ruta devuelta viola su envolvente; sin directiva no hay ruta | No evasión de la seguridad |
| PT-05 | Endurecer cualquier límite nunca produce una ruta que lo incumpla; la envolvente compuesta es al menos tan restrictiva como cada entrada | Composición monótona |
| PT-06 | El suavizado no aumenta el costo ni la pendiente máxima, ni cruza máscaras | Postproceso seguro |
| PT-07 | Mismas entradas, misma ruta, misma explicación y misma clave | Determinismo |
| PT-08 | Con una sola capa de pendiente, el motor nuevo reproduce las rutas de `findSafePath` en los casos de `routing.test.ts` | Compatibilidad |
| PT-09 | El motor de salud en TypeScript reproduce los `*_eventos.csv` de los seis escenarios de HUELLA | Paridad con la referencia |
| PT-10 | Ninguna distancia del núcleo usa constantes terrestres | Geodesia correcta |
| PT-11 | En secuencias aleatorias de niveles: bajadas de un nivel, enclavamientos respetados, un sensor fallado nunca baja el estado | Máquina de estados |
| PT-12 | Todo valor que llega a la interfaz tiene procedencia; lo simulado conserva su etiqueta | Honestidad de datos |
| PT-13 | En búsqueda anytime, el costo es ≤ `ε` × óptimo y no empeora al dar más tiempo | Cota de subóptimo |
| PT-14 | La ruta validada nunca supera presupuesto más reserva; toda celda admitida tiene ida y regreso de consumo mínimo dentro del presupuesto | Alcanzabilidad |
| PT-15 | Pesos inválidos (negativos, `w_d` por debajo del mínimo, no finitos) se rechazan en el punto de entrada | Validación de pesos |

---

## 5. Métricas de evaluación

Las que pide el enunciado, con unidad y definición. Todas salen de `RouteExplanation` y `ResourcePlan`.

| Métrica | Unidad | Definición |
| --- | --- | --- |
| Distancia | m | Suma de longitudes 3D de los tramos |
| Tiempo estimado | min | Tiempo de marcha por tramo más paradas, con el margen de modelo aparte |
| Consumo energético | Wh, y kg de O₂ para tripulación | Integral del modelo de consumo sobre la ruta |
| Riesgo acumulado | m equivalentes | Contribución del término R al costo |
| Exposición | µSv, y min a cielo abierto | Tasa ambiental × tiempo; tiempo fuera de abrigo |
| Incertidumbre | % de la ruta por clase K; confianza media ponderada por longitud | Histograma de `ConfidenceService` |
| Exigencia física | % de VO₂ pico medio y máximo; desnivel positivo; pendiente máxima | Modelo de locomoción |
| Viabilidad de la ruta | Sí o no, más márgenes | Resultado de `validateRoute`; margen de regreso en min y % |
| Tiempo de recálculo | ms | Desde el evento hasta la ruta nueva, medido en el worker |

Cada escenario de §3 registra estas métricas antes y después del estímulo; la comparación forma parte del resultado esperado.

---

## 6. Datos de prueba

| Dato | Tipo | Origen | Uso |
| --- | --- | --- | --- |
| Rejillas sintéticas: llano, acantilado con paso, montículo | Sintético | Ya existen en `routing.test.ts` | PT-01, PT-08 |
| Rejilla de dos corredores A y B | Sintético | Nuevo | T-06 |
| Rejilla con franja desconocida | Sintético | Nuevo | T-02 |
| Malla real de un sitio de Access Mars | Real | `public/eva/` | T-01, rendimiento |
| Puntos de paso de Curiosity con inclinación | Real | `src/data/boxwork.ts` | Validación de confianza |
| CSV de HUELLA, seis escenarios | Simulado, determinista | `metricas de vida/huella_datos/` | PT-09, T-07, T-08 |
| Guiones nuevos de fatiga, descanso, sensores | Simulado | Nuevo | T-06, T-08, T-09 |

Los datos sintéticos de prueba se rotulan como tales y **nunca** se cargan en la aplicación como si fueran terreno real.

---

## 7. Rendimiento

Presupuestos en ROUTING_ALGORITHM §9. Método:

- Banco reproducible con rejillas de 250 000 y 1 000 000 de nodos.
- Se mide en Node y en navegador dentro del worker.
- Se registra la mediana y el percentil 95 de 30 ejecuciones.
- Un presupuesto incumplido no se oculta: se documenta y se decide entre optimizar, reducir la ventana o ajustar el objetivo.

---

## 8. Interfaz y extremo a extremo

| Prueba | Criterio |
| --- | --- |
| Flujo principal | Elegir sitio, fijar origen y destino, ver ruta y explicación, sin errores de consola |
| Replanificación visible | Al inyectar una tormenta, la ruta cambia y la interfaz dice qué cambió y por qué |
| Cambio de estado de salud | La directiva activa y el motivo se muestran; la ruta refleja el nuevo límite |
| Comparación | Dos o tres rutas con métricas lado a lado |
| Incertidumbre | La capa de confianza y la franja del perfil coinciden con los datos |
| Simulación rotulada | Banda de simulación presente mientras haya fuente simulada |
| Sin WebGL | La página sigue siendo utilizable (el repositorio ya trata este caso) |
| Accesibilidad | Navegable con teclado; avisos por `aria-live`; movimiento reducido |
| Datos extremos | Nombres largos, cero rutas, veinte alternativas, valores límite |

---

## 9. Definición de terminado

Una tarea de BUILD está terminada cuando:

1. Sus pruebas se escribieron **antes** que el código y fallaron por el motivo correcto.
2. `vitest run` en verde, incluidas las 150 existentes.
3. `tsc --noEmit` sin errores.
4. Las propiedades y escenarios que le corresponden (según §10) pasan.
5. Todo valor nuevo tiene procedencia y, si es un parámetro de diseño, está rotulado.
6. No modificó archivos fuera de su ámbito (AGENT_GUIDELINES §4).
7. La documentación afectada está actualizada.
8. Se pegó la salida real de las comprobaciones en el informe de la tarea; no se afirma que algo pasa sin haberlo ejecutado.

---

## 10. Trazabilidad

| Requisito del enunciado | Pruebas |
| --- | --- |
| Heurística admisible con pesos cambiantes | PT-01, PT-02, PT-15 |
| Costos, restricciones duras y dinámicas separados | T-03, T-10, PT-04 |
| Zonas prohibidas excluidas del grafo | T-10, PT-04 |
| La navegación no ignora la salud | T-06, T-07, PT-04, PT-05 |
| Histéresis, persistencia, sensores, datos faltantes | T-08, T-09, PT-09, PT-11 |
| Equipo regido por el más restrictivo | T-12 |
| Recursos como restricción dura | T-05, PT-14 |
| Terreno conocido preferido; incertidumbre explícita | T-01, T-02 |
| Replanificación dinámica | T-03, T-04, T-05, T-11, PT-03 |
| Simulación diferenciada de datos reales | PT-12, prueba de banda de simulación |
| Explicación de la ruta elegida y de la descartada | T-02, T-06, T-10 |
