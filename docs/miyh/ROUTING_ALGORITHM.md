# ROUTING_ALGORITHM — Motor de navegación y replanificación de Mars Trek

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md) · Relacionados: [DYNAMIC_COSTMAP.md](DYNAMIC_COSTMAP.md), [ASTRONAUT_HEALTH_STATE_MACHINE.md](ASTRONAUT_HEALTH_STATE_MACHINE.md), [RESOURCE_MANAGEMENT.md](RESOURCE_MANAGEMENT.md), [SCIENTIFIC_CONFIDENCE.md](SCIENTIFIC_CONFIDENCE.md), [TESTING_STRATEGY.md](TESTING_STRATEGY.md)

Este documento define **qué** debe calcular el motor de rutas y **por qué** es matemáticamente correcto. No contiene implementación. Las firmas en TypeScript son contratos de especificación.

---

## 1. Punto de partida: lo que ya existe

El repositorio ya tiene un planificador en `Nasa-Space-App-challange-2026/src/core/science/routing.ts` (7 pruebas en `routing.test.ts`, todas en verde):

| Aspecto | Planificador actual (`findSafePath`) | Lo que Mars Trek necesita |
| --- | --- | --- |
| Grafo | Rejilla 8-conexa rasterizada desde la malla de Access Mars (1 m) | Rejilla multirresolución sobre el costmap multicapa |
| Costo | `longitud · (1 + (pendiente/15°)²) · (×4 en banda de precaución)` | Seis términos (D, T, R, E, U, H) con pesos por perfil y estado |
| Restricción dura | Pendiente ≥ 25° o terreno desconocido = intransitable | Envolvente de seguridad compuesta: vehículo, zonas, salud, recursos, confianza |
| Heurística | Distancia euclídea (admisible porque el costo ≥ longitud) | La misma idea, generalizada y demostrada (§4) |
| Dinámica | Ninguna: se recalcula a mano | Replanificación por eventos (§6) |
| Explicación | Longitud y pendiente máxima | Desglose por término y motivo de descarte (§8) |

**Decisión D-R1.** `findSafePath` no se modifica ni se elimina: el Explorer actual depende de él. El motor nuevo vive en un módulo aparte (`src/core/trek/routing/`) y debe **reproducir las rutas del planificador actual** cuando se configura con una sola capa de pendiente (prueba de regresión PT-08 en TESTING_STRATEGY).

---

## 2. Tres categorías que no se mezclan

El enunciado del producto exige distinguir costos, restricciones duras y restricciones dinámicas. El motor las trata en tres lugares distintos del algoritmo:

| Categoría | Qué es | Dónde actúa | Ejemplo |
| --- | --- | --- | --- |
| **Costo** | Hace una ruta menos conveniente | Peso de la arista | Pendiente moderada, polvo, terreno poco conocido |
| **Restricción dura** | Hace una ruta inadmisible | **Máscara**: la arista o el nodo no existe en el grafo | Pendiente > límite del perfil, zona prohibida, sin margen de regreso |
| **Restricción dinámica** | Restricción dura (o costo) cuyo valor cambia durante la misión | Máscara y pesos **versionados**; cada cambio dispara revalidación (§6) | Tormenta que entra en la ruta, alerta SEP, estado de salud |

Regla de diseño **INV-R3**: una restricción dura **nunca** se representa con un costo muy alto. Un costo alto todavía permite cruzar cuando no hay alternativa, rompe la comparación entre rutas y degrada la heurística. Si algo es inadmisible, se elimina del grafo. Esto ya lo hace el planificador actual con el terreno desconocido (`NaN` = intransitable) y coincide con cómo trabaja el rover Perseverance: su planificador ENav devuelve costo infinito cuando la comprobación cinemática ACE detecta que se violan los límites del vehículo, y los operadores marcan a mano zonas de exclusión para peligros que la geometría no ve ([Abcouwer et al., arXiv:2011.06022](https://arxiv.org/pdf/2011.06022); [Rankin et al. 2023](https://www-robotics.jpl.nasa.gov/media/documents/2023-rapid-traverse.pdf)).

---

## 3. Modelo de costos

### 3.1 Grafo

- **Nodos**: celdas del costmap en la resolución de trabajo (ver DYNAMIC_COSTMAP §5). Valor de partida en nivel local: celdas de 1 m, como el planificador actual, que ya usa celdas más gruesas en tramos largos.
- **Aristas dirigidas** `e = (a → b)` entre celdas 8-conexas. Dirigidas porque subir y bajar no cuestan lo mismo.
- Longitud horizontal `ℓh`, desnivel `Δz`, longitud 3D `ℓ = √(ℓh² + Δz²)`, pendiente `θ = atan(|Δz|/ℓh)`.
- Las diagonales no pueden cortar la esquina de una celda intransitable (regla ya presente en `findSafePath`).

### 3.2 Función de costo

La fórmula del enunciado, `C = w_d·D + w_t·T + w_r·R + w_e·E + w_u·U + w_h·H`, se concreta por arista así:

```
c(e) = ℓ(e) · κ(e) · [ w_d + w_t·t(e) + w_r·r(e) + w_e·ε(e) + w_u·u(e) + w_h·h(e) ]
```

con `D = ℓ`, `T = ℓ·t`, `R = ℓ·r`, etc. Cada término es una **longitud equivalente**: el costo total de una ruta se lee en "metros equivalentes", lo que permite explicarla ("la ruta B cuesta 7.4 km-eq frente a 9.1 km-eq").

| Símbolo | Significado | Rango | Fuente del dato |
| --- | --- | --- | --- |
| `ℓ(e)` | Longitud 3D de la arista (m) | > 0 | Capa de elevación |
| `κ(e)` | Multiplicador por clase de zona (§3.4) | ≥ 1 | Capa de zonas |
| `t(e)` | Dificultad topográfica | ≥ 0 | Pendiente, rugosidad, firmeza |
| `r(e)` | Riesgo ambiental y radiológico **por tiempo de exposición** | ≥ 0 | Polvo, tormenta, dosis, temperatura, luz |
| `ε(e)` | Consumo relativo del recurso limitante | ≥ 0 | Modelos de RESOURCE_MANAGEMENT |
| `u(e)` | Incertidumbre geográfica, `1 − confianza` | [0, 1] | SCIENTIFIC_CONFIDENCE |
| `h(e)` | Exigencia fisiológica dado el estado del astronauta | ≥ 0 | Directiva de salud |
| `w_*` | Pesos del perfil activo | ≥ 0, `w_d ≥ w_d,min > 0` | §3.5 |

### 3.3 Definición de cada intensidad

Las intensidades son adimensionales. Los parámetros marcados **[diseño]** son elecciones del equipo que deben calibrarse; no son requisitos de NASA.

**Topografía `t(e)`**

```
t(e) = (θ/θ_ref)² + k_rug·ρ(e) + k_blando·σ(e)
```

- `θ_ref`: pendiente de precaución del perfil (15° en el planificador actual). El término cuadrático conserva el comportamiento ya probado.
- `ρ(e)`: rugosidad normalizada 0–1 a la escala del vehículo (DYNAMIC_COSTMAP capa L03).
- `σ(e)`: probabilidad de suelo blando 0–1 (inercia térmica baja e índice de polvo alto; capa L05). Motivo: Spirit quedó atrapado en arena suelta y Opportunity registró 99.9 % de deslizamiento en 2005.
- `k_rug`, `k_blando`: **[diseño]**.

**Riesgo ambiental `r(e)`** — el riesgo crece con el **tiempo** que se pasa expuesto, no con la distancia, así que se divide por la velocidad esperada:

```
r(e) = [ k_polvo·f_τ(e) + k_rad·f_D(e) + k_term·f_T(e) + k_luz·f_L(e) ] · v_ref / v(e)
```

- `f_τ`: opacidad de polvo normalizada; `f_D`: tasa de dosis respecto de la referencia (0.64 mSv/día en Gale, MSL-RAD); `f_T`: salida del rango térmico de diseño; `f_L`: falta de iluminación.
- `v(e)`: velocidad esperada en la arista (modelo de RESOURCE_MANAGEMENT §3); `v_ref`: velocidad en llano del perfil.
- Las tormentas activas y las alertas SEP **no** entran aquí: son restricciones dinámicas (§5).

**Recursos `ε(e)`**

```
ε(e) = q'(e) / q'_ref
```

`q'(e)` es el consumo por metro del **consumible limitante** (el que se agota antes: O₂, batería, agua de enfriamiento, capacidad de CO₂), y `q'_ref` el mismo consumo en llano. Siempre es positivo. El control del presupuesto total no se hace con este término sino con la envolvente de alcanzabilidad (§5.3).

**Incertidumbre `u(e)`**: `u = 1 − C(e)`, con `C` la confianza de la celda (SCIENTIFIC_CONFIDENCE §4).

**Salud `h(e)`**

```
h(e) = φ(estado) · max(0, M(e)/M_sost − 1)
```

- `M(e)`: gasto metabólico previsto en la arista; `M_sost`: gasto sostenible del tripulante.
- `φ(estado)`: factor que crece con la severidad (NORMAL = 1). Lo fija la directiva de salud, nunca el motor de rutas.
- En perfiles sin tripulación, `h = 0` y `w_h = 0`.

### 3.4 Multiplicador de zona `κ`

| Clase de zona | `κ` por defecto | Nota |
| --- | --- | --- |
| Z0 Transitable | 1 | |
| Z1 Precaución | 4 | Valor del planificador actual (`cautionWeight`) |
| Z2 Alto riesgo | 12 **[diseño]** | Solo si el perfil la admite; si no, es máscara |
| Z3 Desconocida, Z4 Restringida, Z5 Prohibida | — | No son costo: son máscara según el perfil (§5.1) |

`κ ≥ 1` siempre. Esto es lo que permite demostrar la admisibilidad en §4.

### 3.5 Pesos y perfiles

Un **perfil de pesos** es un vector `(w_d, w_t, w_r, w_e, w_u, w_h)` validado. Se parte de un perfil base por tipo de misión y la directiva de salud aplica multiplicadores que **solo pueden aumentar** los pesos de seguridad (`w_t`, `w_r`, `w_u`, `w_h`).

Perfiles base propuestos (**[diseño]**, suman 1):

| Perfil | `w_d` | `w_t` | `w_r` | `w_e` | `w_u` | `w_h` | Intención |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Equilibrado (por defecto) | 0.25 | 0.20 | 0.15 | 0.15 | 0.15 | 0.10 | Compromiso general |
| Más rápido | 0.45 | 0.15 | 0.10 | 0.10 | 0.10 | 0.10 | Minimiza distancia y tiempo |
| Más seguro | 0.10 | 0.25 | 0.25 | 0.10 | 0.20 | 0.10 | Minimiza exposición y terreno difícil |
| Más conocido | 0.10 | 0.15 | 0.15 | 0.10 | 0.40 | 0.10 | Prefiere terreno recorrido u observado |
| Ahorro de recursos | 0.15 | 0.15 | 0.10 | 0.40 | 0.10 | 0.10 | Margen de consumibles escaso |
| Rover autónomo | 0.25 | 0.30 | 0.10 | 0.20 | 0.15 | 0.00 | Sin término de salud |
| Emergencia | 0.60 | 0.15 | 0.15 | 0.05 | 0.05 | 0.00 | Tiempo al refugio; la protección la dan las restricciones duras |

Multiplicadores por estado de salud: ver ASTRONAUT_HEALTH_STATE_MACHINE §7. Después de aplicar multiplicadores, el vector se renormaliza y se revalida.

---

## 4. Admisibilidad y consistencia de la heurística

### 4.1 Invariantes

| ID | Invariante | Motivo |
| --- | --- | --- |
| INV-R1 | `w_k ≥ 0` para todo `k`; `w_d ≥ w_d,min` con `w_d,min = 0.05` **[diseño]** | Costos no negativos; `w_d > 0` evita ciclos de costo cero y mantiene una heurística informativa |
| INV-R2 | Toda intensidad es finita y `≥ 0`; `κ ≥ 1` | Garantiza la cota inferior de §4.2 |
| INV-R3 | Lo inadmisible se elimina del grafo, no se penaliza | Ver §2 |
| INV-R4 | Un valor desconocido (`NaN`, sin dato) **nunca** se convierte en 0 | Sin dato no significa sin riesgo. Va a `u(e)` o a la máscara |
| INV-R5 | Los pesos se validan y renormalizan (`Σw = 1`) en un único punto de entrada | Impide combinaciones inconsistentes introducidas desde la interfaz |
| INV-R6 | El costo escalar solo se usa para ordenar rutas **dentro de un mismo perfil** | Entre perfiles se comparan métricas físicas (m, min, Wh, kg O₂, µSv), nunca el costo |
| INV-R7 | La planificación trabaja sobre una **instantánea versionada** del costmap | Evita mezclar costos de instantes distintos dentro de una búsqueda (§5.4) |

### 4.2 Demostración

Sea `d(n, g)` la distancia en línea recta (o de círculo máximo a escala regional) entre el nodo `n` y la meta `g`. Se define:

```
h(n) = w_d · d(n, g)
```

**Admisible.** Para cualquier arista, por INV-R1 e INV-R2:

```
c(e) = ℓ(e)·κ(e)·[w_d + Σ_k w_k·x_k(e)]  ≥  ℓ(e)·1·w_d  ≥  w_d · d(a, b)
```

El costo de cualquier ruta de `n` a `g` es la suma de sus aristas, que es al menos `w_d` por la longitud de la poligonal, y esta nunca es menor que la recta `d(n, g)`. Luego `h(n) ≤ h*(n)`: la heurística nunca sobreestima.

**Consistente.** Por la desigualdad triangular, `d(a, g) ≤ d(a, b) + d(b, g)`, de donde `h(a) ≤ w_d·d(a, b) + h(b) ≤ c(a → b) + h(b)`. Con una heurística consistente, A\* no necesita reabrir nodos y la primera vez que extrae la meta el costo es óptimo (Hart, Nilsson y Raphael, 1968).

**Válida para cualquier combinación de pesos.** La demostración solo usa `w_d` y la no negatividad del resto. Por tanto cambiar de perfil, o que la directiva de salud suba pesos, **no puede** romper la optimalidad. Es la respuesta directa al requisito de "evitar que la combinación de pesos produzca rutas matemáticamente inconsistentes".

### 4.3 Heurística más ajustada (opcional)

Una cota mejor acelera la búsqueda sin perder optimalidad:

```
h⁺(n) = (w_d + Σ_k w_k · x_k,min) · d(n, g)
```

donde `x_k,min` es el mínimo de la intensidad `k` sobre las celdas transitables. Solo es válida si esos mínimos son **cotas inferiores verdaderas en todo momento**: se calculan sobre capas estáticas y se usa 0 para las dinámicas. Si un mínimo deja de ser cota (por ejemplo, tras recalibrar una capa), `h⁺` deja de ser admisible. Por eso `h⁺` es una optimización de BUILD que entra solo con su prueba de propiedad (PT-02).

### 4.4 Rejilla y distancia

En rejilla 8-conexa, la distancia euclídea es admisible pero subestima la longitud real de los caminos de rejilla (hasta un 8 %). La distancia octil sería más ajustada, pero **deja de ser admisible si después se suaviza la ruta** con atajos en línea de vista. Como el planificador actual suaviza (y Mars Trek también lo hará, §7), se mantiene la euclídea.

### 4.5 Lo que la heurística no cubre

- **Costos dependientes del tiempo** (una tormenta que avanza). A\* no garantiza el óptimo en grafos con costos temporales salvo condiciones adicionales. Se resuelve con INV-R7: instantánea más replanificación (§5.4).
- **Presupuestos acumulados** (O₂ total, dosis total). No son propiedades de una arista. Se tratan en §5.3.

---

## 5. Restricciones

### 5.1 Envolvente de seguridad

Todas las restricciones duras se componen en un único objeto, la **envolvente de seguridad**. El motor de rutas solo acepta este objeto; no acepta límites sueltos.

```ts
// Contrato de especificación
interface SafetyEnvelope {            // tipo opaco: solo lo construye composeEnvelope()
  readonly envelopeId: string;
  readonly costmapVersion: string;    // instantánea a la que aplica
  readonly maxSlopeDeg: number;
  readonly allowedZones: ReadonlySet<ZoneClass>;
  readonly minConfidence: ConfidenceClass;
  readonly dynamicMasks: readonly MaskRef[];        // tormenta, SEP, noche, fuera de cobertura
  readonly reachability: ReachabilityField | null;  // §5.3
  readonly goalPolicy: 'keep-goal' | 'nearest-safe-waypoint' | 'nearest-shelter' | 'hold-position';
  readonly sources: readonly ConstraintSource[];    // quién impuso cada límite (trazabilidad)
}

function composeEnvelope(
  mission: MissionProfile, vehicle: VehicleLimits, zones: ZoneRules,
  health: NavigationDirective,        // obligatorio: no hay valor por defecto
  resources: ResourceState, costmap: CostmapSnapshot
): SafetyEnvelope;
```

**Regla de composición (INV-S1): gana siempre lo más restrictivo.** Para límites numéricos se toma el mínimo; para conjuntos permitidos, la intersección; las máscaras se unen. Ningún módulo puede relajar un límite impuesto por otro.

**Regla de no evasión (INV-S2).** El requisito "el sistema de navegación nunca debe poder ignorar una restricción de seguridad impuesta por el estado fisiológico" se garantiza por construcción y con defensa en profundidad:

1. `planRoute()` exige un `SafetyEnvelope`; no existe sobrecarga sin él.
2. `SafetyEnvelope` solo se obtiene de `composeEnvelope()`, que exige una `NavigationDirective` vigente.
3. Toda ruta pasa por `validateRoute(route, envelope)` antes de salir del módulo. Una ruta que no valida no se devuelve nunca: se devuelve un resultado "sin ruta" con el motivo.
4. Prueba de propiedad PT-04: con entradas aleatorias, ninguna ruta devuelta viola su envolvente.

### 5.2 Predicados de máscara

Una arista `a → b` existe solo si se cumplen **todos**:

| Predicado | Origen del límite |
| --- | --- |
| `θ(e) ≤ maxSlopeDeg` | Vehículo, perfil y estado de salud |
| `zona(b) ∈ allowedZones` | Reglas de zonas, misión, salud |
| `claseConfianza(b) ≥ minConfidence` | Perfil (tripulado exige más que robótico) |
| `b ∉` máscaras dinámicas activas | Tormenta, SEP, noche, cobertura de comunicaciones |
| `b` dentro de la envolvente de alcanzabilidad | Recursos |
| Elevación de `a` y `b` conocida | INV-R4 |

Valores de partida para `maxSlopeDeg` (detalle y procedencia en ASTRONAUT_HEALTH_STATE_MACHINE §7 y DYNAMIC_COSTMAP §7):

| Sujeto | Límite duro | Procedencia |
| --- | --- | --- |
| Tripulación a pie, estado NORMAL | 20° | Capacidad del sistema xEVA: caminar en pendientes de hasta 20° ([EVA-EXP-0042](https://ntrs.nasa.gov/citations/20205008200)); Artemis III limita las EVA a pendientes < 20° |
| Rover (conducción humana) | 30° | Los conductores evitan inclinaciones > 30°; el vehículo soporta 45° ([NASA, Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/)) |
| Rover autónomo | 20° **[diseño]** | AutoNav se usó por primera vez por encima de 20° de inclinación en 2024 |

> **Inconsistencia heredada (pendiente P-04).** El planificador actual usa 25° como no-go (`EVA.noGoSlopeDeg`, marcado ASSUMPTION), HUELLA usa 20° (regla PRE-10) y el notebook de la auditoría usa 20°. Mars Trek adopta **20°** para tripulación por tener respaldo documental. El valor de 25° se conserva solo en el planificador heredado hasta decidir su migración.

### 5.3 Presupuestos acumulados: envolvente de alcanzabilidad

El oxígeno, la batería, el tiempo de luz o la dosis son **acumulados**: dependen del camino completo. El problema de camino mínimo con restricción de recursos es NP-difícil en general (Handler y Zang, 1980), así que no se resuelve de forma exacta dentro de A\*. Estrategia en tres capas:

1. **Condición necesaria por nodo (máscara).** Con dos pasadas de Dijkstra usando el consumo del recurso como costo:
   - `Q_ida(n)`: consumo mínimo desde el origen hasta `n`.
   - `Q_regreso(n)`: consumo mínimo desde `n` hasta el refugio válido más cercano.
   - `n` es admisible solo si `Q_ida(n) + Q_regreso(n) + reserva ≤ disponible`.

   Es la formalización del "punto de no retorno" (regla EVA-01 de HUELLA) y del margen de regreso a pie (PRE-01). Además produce el **mapa de alcance** que la interfaz dibuja.
2. **Validación exacta de la ruta elegida.** `validateRoute()` integra el consumo real a lo largo de la ruta, incluidas paradas, y lo compara con el presupuesto y la reserva.
3. **Si la validación falla**: se sube `w_e` y se replanifica (búsqueda paramétrica sobre el multiplicador, a lo sumo `N_λ = 6` iteraciones **[diseño]**). Si sigue sin haber ruta, el resultado es "inalcanzable con el margen actual" y se proponen metas alternativas dentro del alcance.

La capa 1 usa caminos de consumo mínimo, así que es optimista: descarta lo imposible pero no garantiza lo posible. Por eso la capa 2 es obligatoria.

### 5.4 Restricciones dinámicas y tiempo

- Cada capa dinámica tiene `version` y `validAt`. Una búsqueda usa **una** instantánea (INV-R7).
- Para peligros con pronóstico (frente de tormenta, llegada estimada de una eyección de masa coronal), la máscara de la instantánea es la **envolvente conservadora** del peligro durante la ventana de tiempo de la ruta: la unión de las posiciones previstas entre ahora y la hora estimada de llegada más un margen.
- La búsqueda en grafo expandido en el tiempo queda **fuera de alcance** en la versión 1 (decisión D-R4): multiplica el tamaño del grafo y el pronóstico disponible no justifica esa precisión.

---

## 6. Replanificación dinámica

### 6.1 Alternativas evaluadas

| Algoritmo | Qué aporta | Limitación en Mars Trek | Referencia |
| --- | --- | --- | --- |
| **A\*** desde cero | Óptimo, simple, ya probado en el repo | Recalcula todo ante cualquier cambio | Hart, Nilsson y Raphael (1968) |
| **D\* Lite** | Repara la solución anterior cuando cambian costos locales; mismo resultado que A\* | No ayuda si cambia la meta o si cambian **todos** los costos a la vez | [Koenig y Likhachev, AAAI 2002](https://aaai.org/papers/00476-aaai02-072-d-lite/); IEEE T-RO 21(3), 2005 |
| **ARA\*** (anytime) | Primera solución rápida con cota de subóptimo `ε`, que mejora con el tiempo | No reutiliza trabajo cuando cambia el mapa | Likhachev, Gordon y Thrun (2003) |
| **Anytime D\*** (AD\*) | Combina ARA\* y D\* Lite: anytime e incremental | El más complejo de implementar y de probar | [Likhachev et al., ICAPS 2005](https://www.ri.cmu.edu/publications/anytime-dynamic-a-an-anytime-replanning-algorithm) |
| **Field D\*** | Rutas de ángulo libre por interpolación; usado en rovers | Complejidad extra; el suavizado posterior cubre la necesidad | Ferguson y Stentz (2006) |

### 6.2 Observación clave

Los cambios que Mars Trek debe absorber son de dos naturalezas muy distintas:

- **Locales**: una tormenta cubre una región, aparece una zona prohibida, llega cartografía nueva de un recuadro. Cambian pocas aristas. Aquí D\* Lite repara mucho más rápido que empezar de cero.
- **Globales**: el astronauta pasa a FATIGUE (cambian los pesos de **todas** las aristas y el límite de pendiente), cambia el perfil o cambia la meta (CRITICAL manda al refugio). Aquí la reparación incremental no ahorra nada: prácticamente todo el grafo queda inconsistente, y D\* Lite además busca desde la meta, así que un cambio de meta lo reinicia.

### 6.3 Arquitectura elegida (decisión D-R2)

Un **controlador de replanificación** con una sola interfaz y tres estrategias, incorporadas por fases:

```ts
interface RoutePlanner {
  plan(req: RouteRequest, env: SafetyEnvelope, snap: CostmapSnapshot): RouteResult;
}
interface Replanner {
  onEvent(ev: ReplanEvent): ReplanDecision;   // revalidar | reparar | replanificar | emergencia | nada
}
```

| Fase | Estrategia | Cuándo se usa | Garantía |
| --- | --- | --- | --- |
| **A** (H3) | A\* multicapa, jerárquico (corredor grueso y búsqueda fina dentro de él) | Plan inicial y cambios globales | Óptimo (`ε = 1`) en la resolución de trabajo |
| **B** (H4) | D\* Lite sobre el mismo grafo dirigido | Cambios locales con misma meta, mismo perfil y misma envolvente salvo máscaras | Mismo costo que A\* desde cero (prueba PT-03) |
| **B** (H4) | Búsqueda multi-meta anytime (ARA\*) | CRITICAL / EMERGENCY: ruta al refugio válido más cercano | Primera ruta factible dentro del presupuesto de tiempo, con `ε` informado; mejora hasta `ε = 1` |
| **C** (opcional) | AD\* unificado | Solo si las mediciones de H4 muestran que hace falta | Cota `ε` más reparación incremental |

Motivos:

1. A\* es el **oráculo**: cualquier estrategia posterior se valida contra él. Sin oráculo, un error en D\* Lite pasa inadvertido.
2. D\* Lite se aplica donde de verdad rinde (cambios locales) y no se fuerza donde no (cambios globales).
3. En emergencia importa **tener una ruta segura ya**, no la óptima dentro de un segundo. Eso es exactamente lo que da un algoritmo anytime.
4. AD\* queda como opción medida, no como apuesta inicial.

### 6.4 Eventos y decisión

| Evento | Ejemplo | Decisión |
| --- | --- | --- |
| `E-MASK` cambio local de máscara | Tormenta que entra, nueva zona prohibida | Revalidar ruta actual; si sigue válida, comparar; si no, **reparar** (D\* Lite) |
| `E-COST` cambio local de costo | Sube el polvo en una región | **Reparar** si las celdas afectadas ≤ 15 % del grafo activo **[diseño]**; si no, replanificar |
| `E-MAP` cartografía nueva | Recuadro de mayor resolución | Reconstruir el grafo del recuadro y **replanificar** en esa ventana |
| `E-HEALTH` nueva directiva | NORMAL → FATIGUE | **Replanificar** (cambio global); si `goalPolicy` cambia, modo emergencia |
| `E-RES` desviación de consumo | Batería 12 % por debajo del plan | Recalcular alcanzabilidad; revalidar; replanificar si falla |
| `E-POS` fuera de ruta | > 15 m de la ruta **[diseño]** | Replanificar desde la posición actual |
| `E-GOAL` cambio de meta | El usuario elige otro destino | Replanificar |
| `E-TIME` deriva de horario | El regreso ya no cabe antes del anochecer | Revalidar; aplicar regla de luz (HUELLA EVA-18) |

### 6.5 Estabilidad: no cambiar de ruta por nada

Un navegador que cambia de ruta a cada actualización es inservible. Reglas:

- Si la ruta actual **deja de ser válida**: cambio inmediato y aviso con el motivo.
- Si sigue siendo válida: solo se **propone** una alternativa cuando mejora el costo en más de `δ = 10 %` **[diseño]** o mejora un margen de seguridad (más margen de regreso, menos exposición).
- Tiempo mínimo entre propuestas no críticas: 60 s **[diseño]**.
- En CRITICAL y EMERGENCY no hay propuestas: la ruta se impone.

---

## 7. Postproceso de la ruta

1. **Suavizado por línea de vista**, como en `findSafePath`: se eliminan nodos intermedios si el segmento directo no supera la pendiente máxima de la ruta original ni cruza una máscara. El suavizado **no puede** aumentar el costo ni empeorar ninguna métrica de seguridad (PT-06).
2. **Revalidación** del resultado suavizado con `validateRoute()`.
3. **Segmentación** para la interfaz y el HUD: tramos con longitud, pendiente, tiempo, consumo, clase de zona y clase de confianza.
4. **Paradas**: las que exija la directiva de salud (descansos) y los puntos de interés científico.

---

## 8. Explicabilidad

La interfaz debe decir por qué se eligió una ruta y por qué se descartó otra. El motor entrega los datos; no redacta.

```ts
interface RouteExplanation {
  totals: { distanceM; durationMin; energyWh; o2Kg; doseUSv; maxSlopeDeg; minConfidence; equivalentCostM };
  contributions: Record<'D'|'T'|'R'|'E'|'U'|'H', number>;  // metros equivalentes, suman el costo
  bindingConstraints: ConstraintSource[];   // límites que acotaron la búsqueda
  blockedDirectPath: BlockReason[];         // por qué la línea directa no vale
  alternatives: AlternativeSummary[];       // §8.2
  envelopeId: string; costmapVersion: string; deterministicKey: string;
}
```

### 8.1 Por qué no la ruta directa

Se recorre la recta origen–destino y se listan los primeros tramos que violan la envolvente, con su causa (`pendiente 27° > 20°`, `zona Z5`, `confianza K5`, `fuera de alcance`). Es la respuesta más frecuente a "¿por qué da este rodeo?".

### 8.2 Alternativas comparables

Las alternativas no se generan con *k* caminos más cortos (suelen diferir en pocos metros y no aportan decisión). Se generan **por intención**:

- La misma envolvente con los perfiles "más rápido", "más seguro" y "más conocido".
- Una ruta con penalización sobre las aristas de la mejor, para forzar un corredor distinto.

Cada alternativa lleva sus métricas físicas y la diferencia de contribuciones frente a la elegida. El ejemplo del enunciado (ruta A de 5 km con pendiente considerable frente a ruta B de 6 km moderada) es el caso de prueba T-06.

### 8.3 Determinismo

Misma instantánea, misma envolvente y misma petición ⇒ misma ruta y misma explicación. Los empates se rompen por un orden fijo (menor `g`, luego índice de nodo). `deterministicKey` es un resumen de las entradas, igual que hace el motor de decisiones existente.

---

## 9. Escala y rendimiento

Planificar a escala de EVA en todo el planeta no es viable ni honesto: los datos globales (MOLA, 463 m) no resuelven pendientes a escala humana. Se trabaja en dos niveles:

| Nivel | Resolución | Cobertura | Uso | Confianza típica |
| --- | --- | --- | --- | --- |
| Regional | 200–463 m | Global | Corredor entre sitios; rover; viabilidad general | K3c–K3d: **no** apta para EVA |
| Local | 1–5 m | Sitios piloto con DTM o malla | Ruta a pie y de rover a escala real | K1–K3a |

Presupuestos objetivo (**[diseño]**, se miden en H3–H4, en Web Worker, portátil de gama media):

| Operación | Tamaño | Objetivo |
| --- | --- | --- |
| Plan inicial local | ventana de 250 000 nodos | ≤ 300 ms |
| Reparación por cambio local | ≤ 15 % de celdas afectadas | ≤ 100 ms |
| Primera ruta de emergencia | multi-meta | ≤ 50 ms |
| Replanificación global | 1 000 000 nodos | ≤ 1.5 s |
| Campo de alcanzabilidad | 250 000 nodos | ≤ 400 ms |

Referencia interna: el motor de decisiones existente tarda 15–30 ms por análisis en navegador.

---

## 10. Antecedentes

- **SEXTANT (MIT)**: planificador de travesías EVA que calcula la ruta más eficiente entre puntos sobre un modelo de elevación, minimizando distancia, tiempo o energía metabólica, y avisa cuando se violan límites de pendiente, energía y duración ([Johnson, 2010](https://dspace.mit.edu/handle/1721.1/59560)). En una prueba de campo en MDRS, el tiempo y la energía reales fueron significativamente **mayores** que los previstos ([Gilkey et al.](https://dspace.mit.edu/handle/1721.1/81410)). Consecuencia para Mars Trek: los modelos de tiempo y consumo llevan márgenes explícitos y se etiquetan MODELLED.
- **ENav y ACE (Perseverance)**: costmap, árbol de arcos candidatos, Dijkstra hasta la meta y comprobación cinemática con costo infinito ([arXiv:2011.06022](https://arxiv.org/pdf/2011.06022); [Verma et al., Science Robotics 2023](https://doi.org/10.1126/scirobotics.adi3099)).
- **Trazado de Curiosity en el Monte Sharp**: citado en la auditoría técnica como referencia de fusión de HiRISE, CRISM, CTX y HRSC para elegir ruta.

---

## 11. Decisiones y pendientes

| ID | Decisión | Estado |
| --- | --- | --- |
| D-R1 | No tocar `findSafePath`; motor nuevo en `src/core/trek/routing/` con prueba de equivalencia | Propuesta |
| D-R2 | A\* como base y oráculo; D\* Lite para cambios locales; anytime multi-meta para emergencia; AD\* opcional | Propuesta |
| D-R3 | Restricciones duras como máscara, nunca como costo alto | Propuesta |
| D-R4 | Instantánea más replanificación; sin grafo expandido en el tiempo en v1 | Propuesta |
| D-R5 | Presupuestos acumulados por envolvente de alcanzabilidad más validación exacta | Propuesta |
| P-04 | Unificar el límite de pendiente a pie (20° frente a 25°) | **Pendiente del usuario** |
| P-07 | Valores de `k_*`, `κ`, `δ` y pesos de los perfiles | Pendiente de calibración en H3 |
| P-08 | ¿Una emergencia puede cruzar zonas Z4 (restringidas por ciencia o protección planetaria)? | **Pendiente del usuario** |

## 12. Referencias

- Hart, P., Nilsson, N., Raphael, B. (1968). *A Formal Basis for the Heuristic Determination of Minimum Cost Paths*. IEEE Trans. SSC 4(2).
- Koenig, S., Likhachev, M. (2002). *D\* Lite*. AAAI-02. <https://aaai.org/papers/00476-aaai02-072-d-lite/> · (2005) *Fast Replanning for Navigation in Unknown Terrain*. IEEE T-RO 21(3), doi:10.1109/TRO.2004.838026.
- Likhachev, M., Gordon, G., Thrun, S. (2003). *ARA\*: Anytime A\* with Provable Bounds on Sub-Optimality*. NIPS.
- Likhachev, M., Ferguson, D., Gordon, G., Stentz, A., Thrun, S. (2005). *Anytime Dynamic A\**. ICAPS. <https://www.ri.cmu.edu/publications/anytime-dynamic-a-an-anytime-replanning-algorithm>
- Ferguson, D., Stentz, A. (2006). *Using Interpolation to Improve Path Planning: The Field D\* Algorithm*. J. Field Robotics 23(2).
- Handler, G., Zang, I. (1980). *A dual algorithm for the constrained shortest path problem*. Networks 10.
- Abcouwer, N. et al. (2021). *Machine Learning Based Path Planning for Improved Rover Navigation*. <https://arxiv.org/pdf/2011.06022>
- Verma, V. et al. (2023). *Autonomous robotics is driving Perseverance rover's progress on Mars*. Science Robotics 8(80). doi:10.1126/scirobotics.adi3099
- Johnson, A. W. (2010). *An Integrated Traverse Planner and Analysis Tool for Future Lunar Surface Exploration*. MIT. <https://dspace.mit.edu/handle/1721.1/59560>
- NASA (2020). *Exploration EVA System Concept of Operations*, EVA-EXP-0042 Rev. B. <https://ntrs.nasa.gov/citations/20205008200>
