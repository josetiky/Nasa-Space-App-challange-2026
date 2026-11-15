# DYNAMIC_COSTMAP — Costmap multicapa y zonas

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md) · Relacionados: [ROUTING_ALGORITHM.md](ROUTING_ALGORITHM.md), [DATA_SOURCES.md](DATA_SOURCES.md), [SCIENTIFIC_CONFIDENCE.md](SCIENTIFIC_CONFIDENCE.md), [ARCHITECTURE.md](ARCHITECTURE.md)

El costmap es la representación del terreno y del entorno que consume el motor de rutas. Aquí se especifican sus capas, su estructura, cuándo se actualiza cada una y cómo se clasifican las zonas.

---

## 1. Principios

1. **Capas independientes, composición única.** Cada capa guarda una magnitud física con su unidad. La combinación en un costo ocurre en un solo sitio: la función de costo de ROUTING_ALGORITHM §3.
2. **Procedencia en cada valor.** Se mantiene la convención del proyecto: todo valor es `REAL`, `DERIVED`, `MODELLED` o `SIMULATED` (tipo `DataType` en `src/core/types.ts`), y además lleva su clase de confianza K1–K5.
3. **Sin dato no es cero.** Una celda sin dato es `NaN` más una clase K5. Nunca se rellena con un valor neutro (INV-R4).
4. **Instantáneas versionadas.** El motor de rutas lee una instantánea inmutable; las actualizaciones generan una versión nueva.
5. **Frecuencia según la naturaleza de la fuente.** No todo se recalcula a la vez (§4).

---

## 2. Catálogo de capas

`Frec.` indica la clase de actualización de §4. `Uso` indica dónde entra: **C** costo, **M** máscara, **I** información en la interfaz.

| ID | Capa | Magnitud y unidad | Fuente (ver DATA_SOURCES) | Tipo | Frec. | Uso |
| --- | --- | --- | --- | --- | --- | --- |
| L01 | Elevación | m sobre el areoide | MOLA, mezcla HRSC–MOLA, DTM HiRISE, malla Access Mars | REAL | Estática | C, M |
| L02 | Pendiente | grados, con su línea base en metros | Derivada de L01 | DERIVED | Estática | C, M |
| L03 | Rugosidad | 0–1 a la escala del vehículo | Residuo del DTM; rugosidad de pulso MOLA (regional) | DERIVED | Estática | C |
| L04 | Obstáculos | máscara y polígonos | Bordes de cráter, campos de rocas, exclusiones manuales | DERIVED / REAL | Lenta | M |
| L05 | Firmeza del suelo | probabilidad de suelo blando 0–1 | Inercia térmica (TES, THEMIS), índice de cobertura de polvo TES, campos de dunas | DERIVED | Estática | C |
| L06 | Riesgo climático | opacidad τ, temperatura, viento | REMS, MEDA, climatología de polvo, MCD; escenarios | REAL / MODELLED / SIMULATED | Lenta y dinámica | C, M |
| L07 | Tormentas | polígonos con vigencia | Escenario simulado; informes MARCI como semilla | SIMULATED / REAL | Dinámica | M |
| L08 | Radiación ambiental | tasa de dosis, mSv/sol | Modelo anclado a MSL-RAD y escalado por columna atmosférica (ya en `environment.ts`) | MODELLED | Estática | C |
| L09 | Alerta de partículas solares | estado global con vigencia | DONKI (SEP, CME con impacto previsto en Marte); escenario | REAL / SIMULATED | Dinámica | M |
| L10 | Iluminación | elevación solar, sombra | Mars24 (`marsTime.ts`) más relieve | MODELLED | Continua | C, M |
| L11 | Consumo energético estimado | por metro, según vehículo | Calculado por arista (RESOURCE_MANAGEMENT), en caché | MODELLED | Derivada | C |
| L12 | Confianza cartográfica | clase K1–K5 y puntuación 0–1 | SCIENTIFIC_CONFIDENCE | DERIVED | Lenta | C, M |
| L13 | Nivel de exploración | recorrido / observado / orbital / inferido / desconocido | Travesías MMGIS, huellas de observación, cobertura de productos | REAL | Lenta | C, I |
| L14 | Información científica | puntos de interés y detecciones | Catálogo del proyecto, minerales hidratados, nomenclatura IAU | REAL | Lenta | I (y meta) |
| L15 | Restricciones operativas | clase de zona Z0–Z5 | Reglas de §7 | DERIVED | Mixta | C, M |
| L16 | Refugios y puntos de asistencia | puntos con capacidad y tipo | Hábitat, rover presurizado, abrigos naturales validados | REAL / SIMULATED | Lenta | Meta de emergencia |
| L17 | Cobertura de comunicaciones | alcance desde hábitat o relé | Línea de vista sobre L01 más alcance configurado | MODELLED | Lenta | M, I |

Notas:

- **L11 no se almacena por celda**: depende de la dirección de marcha, del vehículo y de la carga. Se calcula por arista y se guarda en una caché indexada por `(versión de L01, perfil de vehículo)`.
- **L08 frente a exposición acumulada**: L08 es radiación **ambiental** (propiedad del lugar). La dosis acumulada de la tripulación es estado del tripulante y vive en el módulo de salud y recursos. No se mezclan.
- **L07 y L09 no tienen fuente de datos en tiempo real sobre Marte** con resolución espacial utilizable. En el producto se alimentan con escenarios simulados, claramente etiquetados, y con datos reales solo como contexto (informes semanales, eventos DONKI).

---

## 3. Estructura de datos

### 3.1 Celda y arista

```ts
// Contrato de especificación
interface LayerSpec {
  id: LayerId; title: string; unit: string;
  dataType: 'REAL' | 'DERIVED' | 'MODELLED' | 'SIMULATED';
  source: string; period: string; resolution: string;   // igual que LayerSpec del atlas actual
  updateClass: 'static' | 'slow' | 'dynamic' | 'continuous' | 'derived';
  storage: 'float32' | 'int16' | 'uint8' | 'vector';
  noData: number;
}

interface CostmapTile {
  tileId: string; level: 0 | 1 | 2 | 3;      // nivel de la pirámide (§5)
  originXY: [number, number]; cellM: number; nx: number; ny: number;
  layers: Record<LayerId, TypedArray>;
  versions: Record<LayerId, string>;          // versión de cada capa en la tesela
}

interface CostmapSnapshot {                   // inmutable
  snapshotId: string; createdAt: string;      // tiempo de misión
  frame: LocalFrame;                          // marco métrico local (§6)
  tiles: ReadonlyMap<string, CostmapTile>;
  dynamic: { storms: StormPolygon[]; sepAlert: SepAlert | null; sunElevationDeg: number };
  sample(layer: LayerId, x: number, y: number): number;   // NaN si no hay dato
}
```

Se reutilizan los patrones que ya existen: `HeightGrid` (`routing.ts`), `TerrainGrid` (`terrain.ts`) y `LayerSpec` (`data/layers.ts`). El costmap no los reemplaza; los envuelve.

### 3.2 Almacenamiento

| Dato | Formato en disco | Motivo |
| --- | --- | --- |
| Elevación | Binario `int16` little-endian en decímetros, o `float32`, por tesela | Mismo criterio que el recorte MOLA actual (`megt90n000cb_int16le.bin`) |
| Capas derivadas 0–1 | `uint8` (0–254, 255 = sin dato) | Tamaño |
| Clases (zona, confianza, exploración) | `uint8` | Tamaño |
| Polígonos y puntos | GeoJSON | Compatibilidad con Leaflet y con los datos MMGIS |
| Manifiesto | JSON con fuente, fecha de obtención, versión y suma de comprobación | Igual que `public/data/nasa/manifest.json` |

En el navegador: IndexedDB para teselas y Cache Storage para mosaicos WMTS (ARCHITECTURE §9).

---

## 4. Estrategia de actualización

| Clase | Qué cambia y cada cuánto | Capas | Mecanismo | Efecto en rutas |
| --- | --- | --- | --- | --- |
| **Estática** | Solo con una nueva versión del producto (años) | L01, L02, L03, L05, L08 | Pipeline fuera de línea; se publica una versión nueva del sitio | Ninguno en misión |
| **Lenta** | Por sol o por entrega de datos | L04, L06 (clima base), L12, L13, L14, L16, L17 | Adaptador al iniciar sesión o a petición; instantánea con fecha | Evento `E-MAP` o `E-COST` |
| **Dinámica** | Minutos u horas (en simulación, a voluntad) | L07, L09, L06 (opacidad en tormenta), L15 (zonas dinámicas) | Bus de eventos del simulador o del adaptador | `E-MASK` o `E-COST`: revalidar, reparar o replanificar |
| **Continua** | Función del tiempo de misión | L10 | Se recalcula al crear cada instantánea | `E-TIME` cuando cruza un umbral |
| **Derivada** | Cuando cambia una de sus entradas | L11, L15 | Caché invalidada por sello de versión | Según la entrada que cambió |

Frecuencias reales de las fuentes (detalle en DATA_SOURCES):

- Travesías de rover (MMGIS): se actualizan tras cada conducción.
- Clima de Curiosity (REMS): un registro por sol en el feed público.
- MEDA y REMS calibrados en PDS: entregas periódicas (la más reciente de MEDA, agosto de 2026).
- DONKI: eventos casi en tiempo real, observados desde el entorno terrestre.
- Informes MARCI: semanales, en texto y vídeo, no legibles por máquina.

### 4.1 Regiones sucias

Cada actualización dinámica declara el **rectángulo afectado**. El controlador de replanificación usa esa región para decidir entre reparar y replanificar (ROUTING_ALGORITHM §6.4) y la interfaz la usa para resaltar qué cambió.

### 4.2 Caducidad

Toda capa lenta o dinámica lleva `validAt` y `staleAfter`. Un dato caducado **no se borra**: baja su confianza (SCIENTIFIC_CONFIDENCE §4.3) y la interfaz lo marca como antiguo.

---

## 5. Pirámide multirresolución

| Nivel | Tamaño de celda | Cobertura | Fuente de elevación | Uso |
| --- | --- | --- | --- | --- |
| N0 | ≈ 14.8 km (4 px/grado) | Global | MOLA MEGDR, ya integrado | Vista global, modelos ambientales |
| N1 | 200–463 m | Global o regional | Mezcla HRSC–MOLA 200 m; MOLA 463 m | Planificación regional y corredor |
| N2 | 5–20 m | Sitio | DEM de CTX donde existan; imagen CTX 5 m como contexto | Transición; contexto visual |
| N3 | 1–2 m | Sitio piloto | DTM HiRISE; malla Access Mars | Ruta a pie y de rover |

Reglas:

- La pendiente se calcula **en el nivel en que se va a usar** y se guarda con su línea base. Una pendiente de N1 no dice nada de la pendiente que encuentra una persona: el propio repositorio lo advierte para MOLA ("demasiado gruesa para pendientes a escala EVA").
- **Regla de honestidad de escala (INV-C1).** Solo se ofrece ruta a pie donde hay elevación de nivel N3. En N1–N2 la interfaz ofrece "corredor regional" y lo rotula como tal.
- Búsqueda jerárquica: ruta en N1 → corredor ensanchado → búsqueda fina en N3 dentro del corredor.

---

## 6. Marco de referencia

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Datum | Esfera IAU de Marte, radio 3 396 190 m, coordenadas planetocéntricas, longitud este positiva (`IAU_2015:49900`) | Es el marco de los productos USGS y de MMGIS; el repositorio ya usa ese radio en `roverTraverse.ts` |
| Cálculo métrico local | Marco local en metros (este, norte, altura) centrado en el sitio | Rejilla regular para el grafo; evita distorsión en ventanas pequeñas |
| Distancias regionales | Círculo máximo con radio de Marte (`geo.ts`) | Ya implementado y probado |
| Visualización 2D | Leaflet con `CRS.EPSG4326` **solo como esquema de teselas en grados** | Las teselas de Mars Trek son equirectangulares; no se usa ningún elipsoide terrestre para medir |
| Reproyección fuera de línea | GDAL/PROJ con códigos `IAU_2015` | Recomendación explícita de la auditoría técnica |

> **Aclaración sobre la advertencia de la auditoría.** El informe pide no usar `EPSG:4326` para evitar errores métricos. El uso actual en Leaflet es correcto porque solo direcciona teselas; toda medida pasa por funciones con radio marciano. Se añade una prueba (PT-10) que lo vigila: ninguna distancia del núcleo puede depender de constantes terrestres.

> **Inconsistencia menor heredada.** `geo.ts` usa el radio medio (3 389 500 m) para círculos máximos y los productos cartográficos usan 3 396 190 m. La diferencia es del 0.2 %. Se documenta y se unifica en el marco local de Mars Trek; no se toca `geo.ts`.

---

## 7. Zonas

### 7.1 Clases

| Clase | Nombre | Tratamiento en el grafo |
| --- | --- | --- |
| Z0 | Transitable | Arista normal, `κ = 1` |
| Z1 | Transitable con precaución | Arista con `κ = 4` |
| Z2 | Alto riesgo | Arista con `κ = 12` solo si el perfil la admite; si no, máscara |
| Z3 | Desconocida | Máscara para perfiles tripulados; costo por incertidumbre para exploración robótica |
| Z4 | Restringida | Máscara salvo autorización explícita registrada |
| Z5 | Prohibida | **Excluida del grafo siempre.** Ningún perfil ni estado la habilita |

### 7.2 Reglas de clasificación

La clase de una celda es la **más restrictiva** de todas las reglas que le aplican.

| Regla | Condición | Clase | Procedencia |
| --- | --- | --- | --- |
| ZN-01 | Sin elevación de nivel adecuado al perfil | Z3 | INV-C1 |
| ZN-02 | Confianza K5 | Z3 | SCIENTIFIC_CONFIDENCE |
| ZN-03 | Pendiente > límite absoluto del vehículo | Z5 | Límite físico (tabla 7.3) |
| ZN-04 | Pendiente entre precaución y límite | Z1 | Planificador actual |
| ZN-05 | Suelo blando probable con carga | Z1 o Z2 | HUELLA PRE-17 **[diseño]** |
| ZN-06 | Dentro de polígono de tormenta activa | Z5 mientras dure | HUELLA EVA-14 **[diseño]** |
| ZN-07 | Alerta SEP activa y celda sin abrigo | Z5 para tripulación a pie | HUELLA PRE-06 y EVA-13 |
| ZN-08 | Región Especial candidata (protección planetaria) | Z4 | COSPAR, HUELLA PRE-16 |
| ZN-09 | Exclusión manual del planificador de misión | Z5 | Práctica de los operadores de rover |
| ZN-10 | Fuera del alcance de comunicaciones | Z1 | HUELLA PRE-15 |
| ZN-11 | Sin luz en la ventana prevista de paso | Z2 o Z5 según perfil | HUELLA PRE-12 y EVA-18 |
| ZN-12 | Fuera de la envolvente de alcanzabilidad | Z5 para esa salida | ROUTING_ALGORITHM §5.3 |

### 7.3 Límites por vehículo y estado

Límite de pendiente que convierte una celda en inadmisible. El detalle por estado de salud está en ASTRONAUT_HEALTH_STATE_MACHINE §7.

| Sujeto | Precaución | Inadmisible | Procedencia |
| --- | --- | --- | --- |
| Tripulación a pie (NORMAL) | 15° | > 20° | Precaución: valor del proyecto. Límite: capacidad xEVA de 20° ([EVA-EXP-0042](https://ntrs.nasa.gov/citations/20205008200)) |
| Tripulación con carga | 10° | > 20° | HUELLA PRE-10 **[diseño]** |
| Rover conducido | 20° **[diseño]** | > 30° | Los conductores evitan > 30° ([NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/)) |
| Rover autónomo | 15° **[diseño]** | > 20° **[diseño]** | Margen sobre la práctica de AutoNav |
| Rover con tripulación | El más restrictivo de rover y tripulación | Ídem | INV-S1 |

### 7.4 Zonas y estado de salud

El estado de salud **reduce** el conjunto de clases admitidas; nunca lo amplía.

| Estado | Clases admitidas (tripulación a pie) |
| --- | --- |
| NORMAL | Z0, Z1; Z2 solo con aprobación en el plan |
| FATIGUE | Z0, Z1 |
| CAUTION | Z0, Z1 con `κ` aumentado |
| CRITICAL | Z0, Z1 hacia refugio |
| EMERGENCY | Z0, Z1 hacia refugio; Z4 solo si se decide P-08 |

---

## 8. Qué se reutiliza del repositorio

| Existente | Ruta | Reutilización |
| --- | --- | --- |
| Rejilla de alturas y rasterizado de mallas | `src/core/science/routing.ts` | Construcción de L01 en sitios Access Mars |
| Muestreo MOLA, pendiente y relieve | `src/core/science/terrain.ts` | Nivel N0 |
| Presión, temperatura, dosis, polvo de fondo | `src/core/science/environment.ts` | L06 y L08 |
| Tiempo solar y Ls | `src/core/science/marsTime.ts`, `insolation.ts` | L10 |
| Especificación de capas con leyenda y fuente | `src/data/layers.ts` | Patrón de `LayerSpec` |
| Campos ráster y coloreado | `src/services/atlas/rasters.ts` | Visualización de capas |
| Travesías reales | `src/services/nasa/adapters.ts`, `src/data/boxwork.ts` | L13 |
| Índice de peligro geológico | `hazardIndex()` en `rasters.ts` | Referencia; no sustituye a las reglas de zona |

## 9. Decisiones y pendientes

| ID | Decisión | Estado |
| --- | --- | --- |
| D-C1 | Capas independientes con procedencia y confianza por valor | Propuesta |
| D-C2 | Pirámide N0–N3; ruta a pie solo en N3 | Propuesta |
| D-C3 | Marco local métrico sobre esfera `IAU_2015:49900` | Propuesta |
| D-C4 | Tormentas y alertas SEP como escenarios simulados, con datos reales de contexto | Propuesta |
| P-02 | Sitio o sitios piloto (Gale, Jezero) | **Pendiente del usuario** |
| P-09 | Umbrales de firmeza del suelo a partir de inercia térmica | Pendiente de investigación en H2 |
