# SCIENTIFIC_CONFIDENCE — Confianza científica y conocimiento del terreno

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md) · Relacionados: [DYNAMIC_COSTMAP.md](DYNAMIC_COSTMAP.md), [ROUTING_ALGORITHM.md](ROUTING_ALGORITHM.md), [DATA_SOURCES.md](DATA_SOURCES.md), [UX_UI_GUIDELINES.md](UX_UI_GUIDELINES.md)

Mars Trek prefiere el terreno respaldado por observaciones y exploraciones anteriores. Este documento define cómo se clasifica lo que se sabe de cada lugar, cómo se convierte en un número y cómo lo usan el motor de rutas y la interfaz.

---

## 1. Principios

1. **La evidencia es categórica antes que numérica.** Primero se pregunta "¿cómo sabemos esto?" (clase) y después "¿cuán bien?" (puntuación). Un terreno visto desde órbita no alcanza nunca la clase de uno recorrido, por buena que sea la imagen.
2. **La confianza depende del uso.** Un modelo de elevación de 200 m es excelente para un corredor regional e inútil para decidir si una persona puede subir una ladera. La puntuación se calcula **para una escala requerida**.
3. **La incertidumbre se muestra, no se esconde.** Aparece en el mapa, en el perfil de la ruta y en la explicación.
4. **Nunca se sube de clase por cálculo.** Derivar, interpolar o modelar puede bajar la clase, nunca subirla.
5. **Es complementario a la etiqueta de procedencia.** El proyecto ya rotula cada valor como `REAL`, `DERIVED`, `MODELLED` o `SIMULATED`. Eso dice **de dónde viene el número**. La clase K dice **cuánto se conoce el lugar**.

---

## 2. Clases de conocimiento

| Clase | Definición | Cómo se determina | Ejemplos con datos del proyecto |
| --- | --- | --- | --- |
| **K1** Recorrido | Un rover pasó físicamente por ahí | Corredor alrededor de la travesía real: semiancho del vehículo más la incertidumbre de localización (3 m **[diseño]**) | Travesías de Curiosity y Perseverance (MMGIS); puntos de paso con elevación e inclinación en `src/data/boxwork.ts` |
| **K2** Observado en superficie | Instrumentos en el suelo lo midieron en estéreo | Huella de las reconstrucciones de superficie | Las cinco escenas de Access Mars en Gale (tipo A, fotogrametría, en `marsMissionAtlas.ts`) |
| **K3** Cartografiado desde órbita | Hay un producto orbital con elevación | Cobertura del producto; subclase por resolución | Ver tabla de subclases |
| **K4** Inferido | Valor de un modelo o de una interpolación | Zonas interpoladas de un DTM; huecos entre trazas de altímetro; campos climáticos | Temperatura y presión del modelo del proyecto fuera de Gale; proxies de hielo y polvo |
| **K5** Insuficiente o desconocido | Sin dato, sombra, correlación estéreo fallida | Sin valor o indicador de calidad malo | Zonas sin DTM de alta resolución; celdas `NaN` |

Subclases de K3:

| Subclase | Escala de elevación | Producto típico |
| --- | --- | --- |
| K3a | 1–2 m | DTM de HiRISE: separación de puntos de 1–2 m y precisión vertical de decenas de centímetros ([uahirise.org](https://www.uahirise.org/dtm/about.php)) |
| K3b | 5–20 m | DEM derivados de CTX (regionales); estéreo de CaSSIS (TGO), pendiente de verificar |
| K3c | 50–200 m | Mezcla HRSC–MOLA a 200 m (USGS) |
| K3d | ≥ 463 m | MOLA MEGDR |

### 2.1 Matices que la clase no debe ocultar

- **K1 no significa "seguro para una persona".** Prueba que un vehículo de casi una tonelada pasó sin quedar bloqueado ni hundirse. Un rover y una persona fallan de formas distintas. K1 sube la confianza; no sustituye a los límites de pendiente.
- **K1 es un corredor estrecho.** A diez metros de la huella ya no es K1.
- **K2 se degrada con la distancia al punto de observación.** La resolución en profundidad del estéreo empeora al alejarse. En Access Mars hay teselas en blanco y negro donde solo llegó la cámara de navegación.
- **K3a tiene artefactos conocidos.** Los DTM de HiRISE pueden traer "cajas", costuras de CCD, zonas facetadas e interpolaciones manuales, y se distribuyen con un mapa de calidad por punto (figura de mérito). Hay que usarlo (§3).
- **El terreno cambia.** Dunas y polvo se mueven; un dato antiguo sobre terreno activo vale menos.

---

## 3. Factores de la puntuación

El enunciado pide considerar resolución, antigüedad, calidad, cobertura, tipo de instrumento e incertidumbre del modelo.

| Factor | Símbolo | Qué mide | Cómo se obtiene |
| --- | --- | --- | --- |
| Tipo de instrumento y evidencia | `C_K` | Valor base de la clase | Tabla §4.1 |
| Resolución espacial | `q_res` | Adecuación de la escala del dato a la escala requerida | Fórmula §4.2 |
| Antigüedad | `q_edad` | Vigencia del dato según lo cambiante que sea la capa | Decaimiento §4.3 |
| Calidad de la medición | `q_cal` | Indicadores propios del producto | Figura de mérito de HiRISE, error cuadrático declarado, indicadores de interpolación |
| Cobertura | `q_cob` | Fracción del entorno de la celda con dato válido | Ventana de 3×3 o 5×5 celdas |
| Incertidumbre del modelo | `q_mod` | Solo para capas `MODELLED` | Residuo de calibración declarado y distancia al dominio calibrado |

---

## 4. Puntuación de confianza

```
C = C_K · q_res · q_edad · q_cal · q_cob · q_mod          0 ≤ C ≤ 1
u = 1 − C                                                  intensidad de incertidumbre del costo
```

Se elige una forma **multiplicativa** porque un solo factor muy malo debe hundir la confianza: una imagen excelente pero de escala inadecuada no sirve. Todos los valores numéricos de esta sección son **[diseño]** y se calibran en H2.

### 4.1 Valor base por clase

| Clase | `C_K` |
| --- | --- |
| K1 | 0.95 |
| K2 | 0.85 |
| K3a | 0.75 |
| K3b | 0.55 |
| K3c | 0.35 |
| K3d | 0.20 |
| K4 | 0.15 |
| K5 | 0 |

### 4.2 Adecuación de escala

```
q_res = min(1, s_req / s_dato) ^ p          p = 0.5
```

`s_req` es la escala que exige el perfil y `s_dato` la del producto.

| Perfil | `s_req` | Consecuencia |
| --- | --- | --- |
| Tripulación a pie | 2 m | Un DEM de 200 m da `q_res = 0.1`: inservible para EVA, como debe ser |
| Rover local | 5 m | |
| Corredor regional | 200 m | La mezcla HRSC–MOLA da `q_res = 1` |

### 4.3 Antigüedad

```
q_edad = 0.5 ^ (edad / vida_media)
```

| Tipo de capa | Vida media |
| --- | --- |
| Relieve en roca firme | Sin decaimiento |
| Relieve en dunas o mantos de polvo | 10 años marcianos |
| Travesía de rover (estado del suelo) | 10 años marcianos |
| Clima medido (un sol) | 3 soles |
| Tormenta o alerta | Su vigencia declarada; después, 0 |

Un dato caducado no desaparece: baja su puntuación y la interfaz lo marca.

### 4.4 Calidad

| Indicador del producto | `q_cal` |
| --- | --- |
| DTM HiRISE, buena correlación | 1.0 |
| DTM HiRISE, zona sospechosa o facetada | 0.5 |
| DTM HiRISE, interpolación manual | Pasa a K4 |
| DTM HiRISE, sombra o sin correlación | Pasa a K5 |
| Altimetría interpolada entre trazas | Pasa a K4 |
| Sin indicador disponible | 0.8 y se anota como "calidad no declarada" |

### 4.5 Clase efectiva para navegar

La magnitud crítica para la seguridad es la **pendiente**, que sale de la elevación. Por eso la clase que usa la envolvente de seguridad es la de la **mejor fuente de elevación adecuada a la escala del perfil**, corregida por sus indicadores de calidad. Las demás capas tienen su propia clase, visible en la interfaz.

---

## 5. Uso en el motor de navegación

| Mecanismo | Cómo actúa | Dónde se define |
| --- | --- | --- |
| **Costo** | `u(e) = 1 − C` entra en el término U con peso `w_u` | ROUTING_ALGORITHM §3 |
| **Restricción dura** | Clase mínima por perfil: por debajo, la celda no existe en el grafo | Envolvente de seguridad |
| **Estado de salud** | La directiva puede subir `w_u` y endurecer la clase mínima | ASTRONAUT_HEALTH_STATE_MACHINE §7 |
| **Perfil "más conocido"** | `w_u = 0.40` | ROUTING_ALGORITHM §3.5 |

Clase mínima por perfil (**[diseño]**):

| Perfil | Clase mínima |
| --- | --- |
| Tripulación a pie | K3a |
| Rover con tripulación | K3a |
| Rover autónomo (local) | K3b |
| Corredor regional (cualquier vehículo) | K3c, y se rotula "no apto para EVA" |
| Exploración robótica de reconocimiento | K4 con costo alto; K5 excluida |

**Efecto buscado.** Con estas reglas, "una ruta conocida resulta más segura que una alternativa desconocida" deja de ser una intuición: entre dos rutas de longitud parecida, la que pisa K1–K2 tiene menor término U; y una alternativa que cruza K5 no existe para un perfil tripulado.

---

## 6. Uso en la interfaz

La incertidumbre debe verse sin leer una leyenda. Reglas, coherentes con UX_UI_GUIDELINES:

| Elemento | Codificación |
| --- | --- |
| Capa de confianza | Terreno desconocido con **trama** (no solo color); confianza baja con desaturación |
| Trazo de la ruta | Continuo en K1–K2, discontinuo en K3, punteado en K4 |
| Perfil de la ruta | Franja de confianza bajo el perfil de elevación, alineada por distancia |
| Ficha de evidencia | Al pulsar una celda: fuente, instrumento, resolución, fecha, clase, puntuación, indicadores de calidad y enlace al origen |
| Explicación de la ruta | Porcentaje de la ruta en cada clase y contribución del término U |
| Alternativa descartada | "Cruza 340 m de terreno K5" como motivo explícito |
| Corredor regional | Rótulo permanente "planificación regional: no apta para EVA" |

Nunca se usa solo el color para comunicar confianza: debe sobrevivir a daltonismo e impresión en gris.

---

## 7. Modelo de datos

```ts
type ConfidenceClass = 'K1' | 'K2' | 'K3a' | 'K3b' | 'K3c' | 'K3d' | 'K4' | 'K5';

interface Evidence {
  layer: LayerId; cls: ConfidenceClass; score: number;           // 0..1
  source: string; instrument: string; mission: string;
  resolutionM: number; acquiredAt?: string; retrievedAt: string;
  quality: { indicator: string; value: string | number } | null;
  factors: { cK: number; qRes: number; qAge: number; qQual: number; qCov: number; qMod: number };
  dataType: 'REAL' | 'DERIVED' | 'MODELLED' | 'SIMULATED';
  url?: string;
}

interface ConfidenceService {
  classAt(x: number, y: number, profile: MissionProfile): ConfidenceClass;
  scoreAt(x: number, y: number, profile: MissionProfile): number;
  evidenceAt(x: number, y: number): Evidence[];       // para la ficha de evidencia
  histogramAlong(route: Route): Record<ConfidenceClass, number>;   // metros por clase
}
```

Se almacena por tesela: una capa `uint8` con la clase y otra con la puntuación cuantizada. La lista de evidencias se resuelve bajo demanda desde el manifiesto de cada producto.

---

## 8. Validación

No hay verdad de campo para todo, así que la puntuación se trata como **ordinal** (sirve para ordenar, no como probabilidad). Experimentos concretos para H2, donde coinciden datos orbitales y de superficie:

| Experimento | Datos | Qué valida |
| --- | --- | --- |
| Pendiente del DTM frente a inclinación medida del rover | DTM HiRISE de Gale y los 62 puntos de paso con inclinación de `boxwork.ts` | Si la pendiente K3a predice la que encontró el rover |
| Elevación orbital frente a elevación del rover | Mismo conjunto | Error vertical real del producto en el sitio |
| Malla de Access Mars frente a DTM HiRISE | Las cinco escenas de Gale | Coherencia entre K2 y K3a |
| Orden de clases | Los anteriores | Que el error observado crece de K1 a K4 |

Si el orden observado no coincide con `C_K`, se corrige la tabla y se registra el cambio.

---

## 9. Qué se reutiliza

| Existente | Ruta | Reutilización |
| --- | --- | --- |
| Etiquetas de procedencia | `DataType` y `Provenance` en `src/core/types.ts` | Se mantienen; la clase K se añade |
| Taxonomía de reconstrucción 3D (tipos A a D) | `src/data/marsMissionAtlas.ts` | Tipo A corresponde a K2; tipos B y D a K3 |
| Niveles de validación documental (oficial, derivado, terceros) | `MARS_MISSION_ATLAS_ARCHITECTURE.md` | Entra como parte de la evidencia |
| Registro de fuentes con limitaciones | `src/data/sources.ts` | Origen de `resolutionM`, `retrievedAt` y limitaciones |
| Terreno desconocido como intransitable | `findSafePath` | Mismo criterio para K5 |

## 10. Decisiones y pendientes

| ID | Tema | Estado |
| --- | --- | --- |
| D-K1 | Clases K1–K5 con subclases de K3 por resolución | Propuesta |
| D-K2 | Puntuación multiplicativa dependiente de la escala requerida | Propuesta |
| D-K3 | Clase mínima por perfil como restricción dura | Propuesta |
| P-14 | Calibrar `C_K`, `p` y vidas medias con los experimentos de §8 | Pendiente, H2 |
| P-15 | Huella exacta de observación en superficie (K2) fuera de las escenas de Access Mars | Pendiente de investigación |

## 11. Referencias

- HiRISE DTM, descripción y artefactos conocidos: <https://www.uahirise.org/dtm/about.php>
- Kirk, R. et al. (2008). *Ultrahigh resolution topographic mapping of Mars with MRO HiRISE stereo images*. JGR 113, E00A24.
- Fergason, R., Hare, T., Laura, J. (2018). *HRSC and MOLA Blended Digital Elevation Model at 200m v2*. USGS. <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m>
- Catálogo de productos de Marte del USGS: <https://fdp.astrogeology.usgs.gov/fdp/mars/>
