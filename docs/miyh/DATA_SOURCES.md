# DATA_SOURCES — Fuentes científicas y datasets de Mars Trek

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha de verificación: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md) · Relacionados: [DYNAMIC_COSTMAP.md](DYNAMIC_COSTMAP.md), [SCIENTIFIC_CONFIDENCE.md](SCIENTIFIC_CONFIDENCE.md), [ARCHITECTURE.md](ARCHITECTURE.md)

> **Sobre este archivo.** El repositorio principal ya tiene `Nasa-Space-App-challange-2026/docs/DATA_SOURCES.md`, que documenta las fuentes **ya integradas** en la aplicación. Este documento no lo reemplaza: lo amplía con las fuentes que Mars Trek necesita y registra el estado de verificación de cada una.

**Regla:** aquí no se inventa ninguna API ni endpoint. Cada entrada indica de dónde sale la información y qué se comprobó.

---

## 1. Cómo leer el estado de verificación

| Marca | Significado |
| --- | --- |
| **V-F** | Verificada en esta fase (2026-11-14) leyendo la página o el documento oficial |
| **V-E** | Verificada por el equipo con una petición real (2026-11-09, registrada en `docs/PROJECT_AUDIT.md` y `docs/DATA_SOURCES.md` del repositorio principal) |
| **V-N** | Ejecutada con éxito en el notebook de la auditoría (`nasa-eva-data (1).ipynb`, 2026-11-14) |
| **AUD** | Citada en la *Auditoría Técnica Mars Trek* o en sus cuadernos; **pendiente** de verificación independiente |
| **NO** | No disponible, archivada o descartada |

Fuentes de este inventario: la *Auditoría Técnica Mars Trek – Grid Mars Mission Atlas* (PDF de 11 páginas), sus dos cuadernos (`nasa-eva-data (1).ipynb`, sobre datos para EVA, y `notebook1b77762d28.ipynb`, sobre sensores orbitales, **añadido a la carpeta el 2026-11-14 mientras se hacía esta fase**), la documentación del repositorio y la verificación web de esta fase.

---

## 2. Topografía y cartografía base

| ID | Nombre · Institución | URL | Tipo · Formato | Resolución · Cobertura | Actualización | Disponibilidad · Restricciones | Integración propuesta | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | MOLA MEGDR · NASA PDS Geosciences (WUSTL) | `pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.img` | Elevación · imagen PDS, `int16` MSB, 1440×720 | 4 px/grado (≈ 14.8 km) · global | Estática | Pública, dominio público; **sin CORS** | **Ya integrada**: instantánea más proxy `/api/nasa/mola`. Nivel N0 | V-E |
| S02 | MOLA DEM global 463 m · USGS Astrogeology / GSFC | Catálogo: <https://fdp.astrogeology.usgs.gov/fdp/mars/> (URL del archivo por confirmar) | Elevación · IMG, Cube, GeoTIFF | 463 m (128 px/grado) · global | Estática | Pública | Recorte fuera de línea si no se usa S03 | AUD + V-F (catálogo) |
| S03 | Mezcla HRSC–MOLA 200 m v2 · USGS Astrogeology (DLR, NASA GSFC) | Ficha: <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m> · Archivo: <https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif> | Elevación · GeoTIFF de 11 GB, 106 694 × 53 347 | 200 m · global | Estática (v2, 2018) | Pública. MOLA CC0; HRSC **CC BY-SA 3.0 IGO**: exige atribución y compartir igual | Recorte regional fuera de línea con GDAL. Nivel N1 | **V-F** |
| S04 | DTM de HiRISE · Univ. de Arizona, USGS, PDS | <https://www.uahirise.org/dtm/about.php> | Elevación y ortoimagen · IMG PDS y JPEG2000 | Puntos cada 1–2 m, precisión vertical de decenas de cm · **regional, cobertura limitada** | Se publican según se producen | Pública. Artefactos conocidos; mapa de figura de mérito por punto | Fuera de línea, por sitio piloto. Nivel N3 | **V-F** |
| S05 | Mosaicos DTM HiRISE de Jezero · USGS Astrogeology | Léame del conjunto: <https://astrogeology.usgs.gov/ckan/dataset/5da0038e-df6e-4c12-919f-7219ba8059aa/resource/060bd5aa-cf60-4cbd-9c71-e3a52191b0b7/download/readme.txt> | Elevación, ortoimagen y confianza · GeoTIFF | 1 m (DTM) y 0.25 m (imagen) · Jezero | Estática | Pública | Candidato para el sitio piloto de Jezero | V-F (existencia) |
| S06 | DEM de 1 m de Gale · USGS | Por localizar en el catálogo del USGS | Elevación · GeoTIFF | 1 m · Gale | Estática | Por confirmar | Candidato para el sitio piloto de Gale | **Pendiente** |
| S07 | Mosaico global CTX · Murray Lab, Caltech | <https://murray-lab.caltech.edu/CTX/> · Teselas: <https://murray-lab.caltech.edu/CTX/V01/tiles/> | **Imagen** (sin elevación) · TIFF en zip, teselas de 4°×4° | 5 m · 88°S–88°N | Estática (V01) | Uso libre de la V01. 5.7 terapíxeles: piden descargar **una tesela cada vez** | Solo las teselas de los sitios piloto, como contexto visual. Nivel N2 | **V-F** |
| S08 | Mars Trek WMTS · NASA SSERVI y JPL | Plantilla: `https://trek.nasa.gov/tiles/Mars/EQ/{capa}/1.0.0/default/default028mm/{z}/{fila}/{col}.{jpg\|png}` · Doc.: <https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars> | Mosaicos · teselas OGC WMTS | Según capa · proyecciones EQ, NP y SP | Estática por capa | Pública, sin clave, con CORS | **Ya integrada** para mapas base. Ver §2.1 | V-E |
| S09 | Terreno de Access Mars · Google Creative Lab y NASA JPL | <https://github.com/googlecreativelab/access-mars> | Mallas de superficie · glTF 2.0 con Draco | ≈ 1 m · cinco escenas en Gale | Estática | Apache-2.0; atribución | **Ya integrada** en `public/eva/`. Clase K2 | V-E |
| S10 | Travesías y puntos de paso · NASA/JPL MMGIS | `https://mars.nasa.gov/mmgis-maps/{M20\|MSL}/Layers/json/{…}_traverse.json` y `…_waypoints.json` | Vectores · GeoJSON | Localización del rover (m) · Jezero y Gale | Tras cada conducción | Pública, con CORS | **Ya integrada**. Clase K1 | V-E |
| S11 | Mosaico HiRISE del área de Curiosity · Mars Trek | `…/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{fila}/{col}.png` | Imagen · teselas PNG | Hasta ≈ 0.64 m/px · 137.12–137.73°E, 4.25–4.93°S | Estática | Pública | **Ya integrada** como mapa base | V-E |

### 2.1 Capas de Mars Trek citadas en la auditoría

La auditoría inventaría 2 038 productos del catálogo de Mars Trek y propone estas capas para el costmap. Todas están **pendientes** de confirmar su identificador exacto en `WMTSCapabilities.xml`. La documentación de Trek (S08) indica que la extensión de tesela correcta, `.jpg` o `.png`, figura en el elemento `ResourceURL` de ese mismo documento. La lista de productos de esa página se carga de forma dinámica y no pudo leerse en esta fase, así que los identificadores siguen sin confirmar.

| Capa citada | Uso propuesto | Resolución según la auditoría |
| --- | --- | --- |
| Índice de cobertura de polvo de TES | Firmeza del suelo (L05) | 16 px/grado (≈ 3.5 km) |
| Inercia térmica (TES y THEMIS) | Firmeza del suelo (L05) | ≈ 3 km (TES); 100 m (THEMIS) |
| Capas de pendiente (20) y pendiente coloreada (20) | Referencia visual | Según el DEM fuente |
| Rugosidad vertical MOLA | Rugosidad regional (L03) | ≈ 300 m entre disparos |
| Campos de dunas; escarcha de CO₂ | Peligros (L04, L05) | Temáticas |
| Minerales hidratados (OMEGA, CRISM); formas glaciares; cárcavas | Información científica y recursos (L14) | Temáticas |
| Zonas de exploración (NASA EMC y USGS) | Sitios candidatos (L14, L16) | Vectoriales |
| Nomenclatura IAU (1 783 registros); sitios de aterrizaje; travesías | Referencia (L14) | Vectorial |
| Mosaico infrarrojo diurno de THEMIS (segundo cuaderno) | Contexto térmico del suelo (L05) | 100 m. **La petición del cuaderno devolvió error 404**: el identificador o la ruta usados no son válidos tal cual. Producto original para análisis: mosaicos controlados de THEMIS del USGS, a 100 m/px, publicados como GeoTIFF en la nube con catálogo STAC (<https://registry.opendata.aws/nasa-usgs-themis-mosaics/>); V-F de existencia |

> **Limitación importante.** Las teselas WMTS son **imágenes de 8 bits para visualizar**, no datos numéricos. Sirven de mapa base y de capa informativa. Para el costo hacen falta los productos originales (GeoTIFF o PDS). El repositorio ya lo comprobó con las teselas `Gale_DEM_SMG_1m`: un nivel de gris equivale a varios metros, así que no se usan como elevación.

Herramientas de análisis del portal Mars Trek (ángulo solar, perfil de elevación, distancia, pendiente, detección de cráteres y rocas, recorte): son funciones de su interfaz web. La auditoría no documenta una API para ellas, así que **no se integran**; sirven para contrastar resultados a mano.

---

## 3. Clima y atmósfera

| ID | Nombre · Institución | URL | Tipo · Formato | Resolución · Cobertura | Actualización | Disponibilidad · Restricciones | Integración propuesta | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S12 | Clima diario de Curiosity (REMS) · NASA/JPL y CAB (CSIC-INTA) | `https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json` | Temperatura, presión, UV, opacidad · JSON, un registro por sol | Un punto: Gale | Por sol | Pública, con CORS. Opacidad **categórica**, no profundidad óptica | **Ya integrada**. Calibra el modelo de temperatura y presión | V-E |
| S13 | REMS calibrado · PDS Atmospheres (NMSU) | `https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/` | Series ambientales · tablas con etiquetas PDS4 | Alta cadencia · Gale | Entregas periódicas | Pública | Fuera de línea, si se necesita ciclo diurno real | AUD |
| S14 | MEDA de Perseverance · PDS Atmospheres | Entregas: `https://pds.nasa.gov/data/pds4/releases/atmos/mars2020_meda-AAAAMMDD/` (vista la de 2026-08-11) | Aire, suelo, presión, viento, humedad, polvo y radiación · CSV con etiquetas XML | Alta cadencia · Jezero | Entregas periódicas | Pública. Colecciones `data_calibrated_env` y `data_derived_env`; huecos por restricciones del rover | Fuera de línea, para el sitio de Jezero | **V-F** |
| S15 | Mars Climate Database v6.1 · LMD, con ESA y CNES | Portal: <https://www-mars.lmd.jussieu.fr/> · Interfaz: <https://www-mars.lmd.jussieu.fr/mcd_python/> | Campos climáticos de modelo · interfaz web; versión completa en netCDF | Global, estadístico por estación y hora local | Por versión | Interfaz web "solo para uso moderado". Versión completa bajo petición. **Sin uso comercial** sin autorización | Consultas manuales para los sitios piloto, guardadas como tablas con fecha. **Sin extracción automática.** Clase K4 | **V-F** |
| S16 | Climatología de polvo · Montabone et al., LMD | <http://www-mars.lmd.jussieu.fr/mars/dust_climatology/> · doi:10.1016/j.icarus.2014.12.034 | Profundidad óptica de polvo en columna · mapas diarios en rejilla | 6°×3° a 6°×5° · global, años marcianos 24 en adelante | Por año marciano | Acceso abierto con atribución | Estadística de polvo por estación y lugar (L06). Clase K3–K4 | **V-F** |
| S17 | Mars Dust Activity Database · Battalio y Wang (2021) | doi:10.1016/j.icarus.2020.114059 | Catálogo de tormentas | Años marcianos 24–32 | Estática | Datos por localizar | Ya citada en la capa de polvo del atlas actual | V-F (artículo) |
| S18 | Informes semanales MARCI · Malin Space Science Systems | Patrón: `http://www.msss.com/msss_images/AAAA/MM/DD/` | Texto y vídeo de tormentas y nubes | 1–2 km en nadir · global | Semanal; se interrumpe en conjunción solar | Pública con atribución. **No legible por máquina**; continuidad actual por confirmar | Semilla manual de escenarios de tormenta | V-F (formato) |
| S19 | MEDA curado · Kaggle (comunidad) | `kaggle.com/datasets/nikitamanaenkov/meda-mars-weather-and-atmosphere-sensor-data` | CSV por sensor | Jezero | Estática | Terceros; licencia por revisar | Solo prototipado; rotular como fuente de terceros | AUD |

### 3.1 Otros orbitadores citados en el segundo cuaderno

El cuaderno `notebook1b77762d28.ipynb` cataloga sensores orbitales de ESA y de la misión Hope de Emiratos Árabes Unidos. En esta fase se comprobó que ambos archivos existen y por dónde se accede a ellos. **No se ha descargado ningún producto**, y las cifras de resolución de la tabla son las del cuaderno.

| ID | Nombre · Institución | URL | Qué aportaría | Estado |
| --- | --- | --- | --- | --- |
| S38 | Planetary Science Archive · ESA (ExoMars TGO: ACS, NOMAD, CaSSIS; Mars Express: HRSC, OMEGA, MARSIS) | Interfaz: <https://psa.esa.int> · Servicio TAP y EPN-TAP: `https://psa.esa.int/psa-tap/tap/`, tabla `psa.epn_core` (resumen EPSC2024-105 del equipo del archivo, <https://doi.org/10.5194/epsc2024-105>) · El cuaderno cita además `https://archives.esac.esa.int/psa/` | HRSC: relieve en estéreo. CaSSIS: estéreo en color a unos 4.6 m/px, candidato a elevación de clase K3b. OMEGA: mineralogía. ACS y NOMAD: atmósfera | **V-F** (existencia y servicio de consulta). El cuaderno consultó `https://psa.esa.int/tap/sync`, sin el tramo `psa-tap/`, y recibió un 404. Falta una petición real y revisar licencia y formatos (P-16) |
| S39 | Emirates Mars Mission (Hope) · Centro de datos científicos de la misión | <https://sdc.emiratesmarsmission.ae> (enlazado desde la página de la misión en LASP, <https://lasp.colorado.edu/missions/emm-hope/>) | EMIRS: temperatura y distribución de polvo, vapor de agua y nubes de hielo. EXI: imágenes globales de nubes y polvo (< 8 km/px según el cuaderno). Formato FITS según el cuaderno | **V-F** (existencia y URL). Según declaraciones de la misión recogidas en prensa, el acceso es libre y publica datos cada tres meses aproximadamente. Registro, licencia, niveles y formato por comprobar (P-16). Candidata a contexto real de polvo (L06) |

---

## 4. Radiación y clima espacial

| ID | Nombre · Institución | URL | Tipo · Formato | Resolución · Cobertura | Actualización | Disponibilidad · Restricciones | Integración propuesta | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S20 | MSL-RAD · SwRI y PDS | Identificador citado: `MSL-M-RAD-3-RDR-V1.0` en <https://pds.nasa.gov/> | Tasa de dosis en superficie · tablas | Un punto: Gale | Entregas periódicas | Pública | El proyecto ya usa el valor de referencia de 0.64 ± 0.12 mSv/día (Hassler et al. 2014) | AUD + V-E (valor) |
| S21 | DONKI · NASA CCMC y oficina M2M | Doc.: <https://ccmc.gsfc.nasa.gov/tools/DONKI> · API: `https://api.nasa.gov/DONKI/{CME\|CMEAnalysis\|GST\|IPS\|FLR\|SEP\|MPC\|RBE\|HSS\|WSAEnlilSimulations\|notifications}` | Eventos de clima espacial · JSON | Global heliosférico | Casi en tiempo real | Clave de `api.nasa.gov`. `DEMO_KEY` dio errores 503 en las pruebas del equipo | **SEP ya integrada** por proxy. Ampliar a `notifications` y `CMEAnalysis` para alertas | **V-F** + V-E |
| S22 | Deep Space Network Now · NASA | Citada en la auditoría; endpoint por confirmar | Estado de enlaces | — | Segundos | Por confirmar | Opcional: contexto de comunicaciones | AUD |

**Limitación de DONKI para Marte.** Los eventos se observan desde el entorno terrestre. La auditoría propone filtrar las simulaciones WSA-ENLIL por impacto en Marte para estimar la llegada de una eyección. Las simulaciones ENLIL incluyen cronologías para Marte (V-F), pero la estructura exacta de los campos debe comprobarse con una petición real antes de usarla (pendiente P-16). El simulador actual ya trata la frecuencia de eventos de forma estadística.

**Dato de referencia verificado.** El 20 de mayo de 2024, RAD midió 8 100 µGy, la mayor dosis de un evento desde el aterrizaje de Curiosity ([JPL](https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm)).

---

## 5. Imágenes y contexto de superficie

| ID | Nombre · Institución | URL | Tipo · Formato | Actualización | Disponibilidad · Restricciones | Integración propuesta | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S23 | Feed de imágenes crudas · NASA/JPL | `https://mars.nasa.gov/api/v1/raw_image_items` | Metadatos e imágenes · JSON | Diaria | Sin clave. El notebook obtuvo el sol 5073 el 2026-11-14 | Contexto visual del sitio. No aporta datos para el costo | **V-N** |
| S24 | NASA Image and Video Library | `https://images-api.nasa.gov/search?q=…&media_type=image` | Imágenes · JSON | Continua | Pública, con CORS. Búsqueda por palabra, sin georreferencia | **Ya integrada** | V-E |
| S25 | Analyst's Notebook · PDS Geosciences | `https://an.rsl.wustl.edu/msl/AN/an3.aspx` | Registros por sol · interfaz web | Por entrega | Pública; manual | Consulta manual para validar travesías | AUD |
| S26 | Mars Rover Photos API · api.nasa.gov | `https://api.nasa.gov/mars-photos/…` | — | — | **Archivada.** El portal lo avisa en su cabecera y el repositorio de origen se archivó el 2025-10-08 | **No usar.** Sustituir por S23 | **NO** (V-F) |
| S27 | InSight Weather API | `https://api.nasa.gov/insight_weather/` | — | — | Misión terminada en 2022; datos estáticos | No usar | NO (V-E) |

---

## 6. Salud, factores humanos y operaciones

Son fuentes documentales: aportan límites y contexto, no datos en línea.

| ID | Nombre · Institución | URL | Qué aporta | Estado |
| --- | --- | --- | --- | --- |
| S28 | NASA-STD-3001 Vol. 1 y 2, y resúmenes técnicos OCHMO · NASA | Radiación: <https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf> · CO₂: <https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf> · Vol. 2, sección 6: <https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2> | Límite de carrera de 600 mSv; límite de diseño por evento de 250 mSv; principio ALARA; CO₂ en hábitat ≤ 3 mmHg en media de una hora; requisitos de medición de gasto metabólico en EVA | **V-F** |
| S29 | Concepto de operaciones xEVA (EVA-EXP-0042) · NASA | <https://ntrs.nasa.gov/citations/20205008200> | Caminar en pendientes de hasta 20°; EVA de hasta 8 h | **V-F** |
| S30 | Informes de evidencia del Human Research Program · NASA | EVA: <https://ntrs.nasa.gov/citations/20220004017> · Sueño y carga de trabajo: <https://ntrs.nasa.gov/api/citations/20150016964/downloads/20150016964.pdf> | El riesgo de lesión y bajo rendimiento en EVA está clasificado en rojo para misiones de superficie; fatiga y sobrecarga | **V-F** |
| S31 | Salud y rendimiento en EVA de superficie · NASA | <https://ntrs.nasa.gov/citations/20230015332> · <https://ntrs.nasa.gov/citations/20230014953> | Cargas observadas en simulaciones; VO₂ pico ≥ 36.5 mL/kg/min; rango sostenible | **V-F** |
| S32 | EVA Walkback Test e Integrated Suit Test · NASA JSC | NASA/TP-2009-214796 · <https://ntrs.nasa.gov/citations/20080013604> | Costo metabólico de la marcha con traje en gravedad parcial | V-F (cita) |
| S33 | Tasas metabólicas de Apolo (NASA TN D-7883) | <https://www.nasa.gov/wp-content/uploads/static/history/alsj/tnD7883Metabolic.pdf> | Calibración del gasto en llano usada por HUELLA | V-E (equipo) |
| S34 | Simulador de telemetría NASA SUITS (TSS) | <https://github.com/SUITS-Techteam/TSS_2024> | Formato de la telemetría de traje | V-E (equipo) |
| S35 | Caminatas sintéticas HUELLA · equipo | `metricas de vida/huella_datos/` | Telemetría **simulada** y resultados de referencia | Local |
| S36 | Valores de soporte vital (BVAD) · NASA | NASA/TP-2015-218570 | Consumos de la tripulación, ya en `constants.ts` | V-E |
| S37 | SEXTANT · MIT | <https://dspace.mit.edu/handle/1721.1/59560> | Antecedente de planificador de travesías EVA | **V-F** |

---

## 7. Correcciones a la auditoría técnica y al notebook

Al contrastar los documentos del equipo con las fuentes aparecieron estas diferencias. Ninguna invalida la auditoría; todas afectan a la integración.

| # | Lo que dice el documento | Lo comprobado | Acción |
| --- | --- | --- | --- |
| 1 | La auditoría (§5.3) y el notebook proponen la Mars Rover Photos API | Está **archivada** | Usar el feed de imágenes crudas (S23) |
| 2 | El notebook descarga MEDA de `…/mars2020_meda_bundle/data_calibrated/` y obtiene un error 404 | La colección se llama `data_calibrated_env` y las entregas se publican por fecha | Corregir la ruta (S14) |
| 3 | La auditoría pide el sistema de referencia `IAU:49900` | El código vigente en PROJ, GDAL y QGIS es **`IAU_2015:49900`** (esfera de 3 396 190 m, planetocéntrico) | Usar ese código en el pipeline |
| 4 | La auditoría trata las capas WMTS como entradas del grid | Las teselas son imágenes de visualización | Datos numéricos desde GeoTIFF o PDS (§2.1) |
| 5 | La auditoría lista la API de InSight como histórico útil | Estática desde 2022 | No integrar; REMS y MEDA cubren la necesidad |
| 6 | La auditoría describe MOLA a 463 m | El repositorio usa hoy el producto de 4 px/grado (≈ 14.8 km) | Añadir S03 para el nivel regional |
| 7 | Identificadores de capa Trek con y sin el prefijo `Mars_` | El repositorio usa `Mars_Viking_MDIM21_ClrMosaic_global_232m`, comprobado por el equipo | Confirmar cada identificador nuevo en su `WMTSCapabilities.xml` |
| 8 | El segundo cuaderno compara tres capas de Mars Trek | En su propia ejecución solo cargó el mosaico Viking. La capa THEMIS devolvió 404. El relieve sombreado MOLA devolvió 404 al pedirlo como `.png`; el repositorio principal lo pide como `.jpg`, y el equipo registró respuesta 200 en su `docs/PROJECT_AUDIT.md` | No dar por válido un identificador ni una extensión sin comprobarlos. La extensión correcta figura en el `ResourceURL` del `WMTSCapabilities.xml` de cada capa |
| 9 | El segundo cuaderno consulta el archivo de ESA por TAP | La consulta devolvió 404; la ruta usada no es la que documenta el archivo (S38). El cuaderno muestra entonces **cuatro registros de ejemplo escritos a mano** y una gráfica titulada como distribución de observaciones de ESA | Esos registros y esa gráfica **no son datos de ESA**. En Mars Trek, si una fuente falla se dice que no está disponible; no se sustituye por una muestra |
| 10 | El segundo cuaderno describe sensores de TGO, Mars Express y Hope | Son descripciones generales de instrumentos; no hay descarga de datos comprobada | S38 y S39 existen y su acceso está documentado (§3.1), pero son **candidatas**, no fuentes integradas |

---

## 8. Método de integración

### 8.1 Estrategia de acceso (se mantiene la existente)

Cada adaptador prueba, en orden: **directo** (si el servicio tiene CORS) → **proxy** del servidor (si no tiene CORS o necesita clave) → **instantánea** guardada con fecha. La interfaz muestra el origen realmente usado. Si todo falla, se dice que la fuente no está disponible: **nunca se inventan valores**.

### 8.2 Pipeline fuera de línea para Mars Trek

```
Fuente original (GeoTIFF / PDS / GeoJSON)
   │  1. Descarga con registro de URL, fecha y suma de comprobación
   ▼
Recorte a la ventana del sitio piloto (GDAL, sistema IAU_2015)
   │  2. Reproyección al marco local métrico
   ▼
Derivados: pendiente, rugosidad, firmeza, clase de confianza
   │  3. Cada derivado guarda su fórmula y su línea base
   ▼
Teselas binarias + manifiesto JSON (fuente, licencia, versión, procedencia)
   │  4. Publicación como recursos estáticos de la aplicación
   ▼
Costmap en el navegador (IndexedDB)
```

El paso 1 amplía el guion existente `scripts/fetch-nasa-data.ts` (`npm run data:fetch`). Las herramientas del pipeline (GDAL) son de desarrollo y no se añaden a la aplicación.

### 8.3 Tamaño

| Producto | Tamaño de origen | Lo que se toma |
| --- | --- | --- |
| Mezcla HRSC–MOLA | 11 GB | Ventana regional de cada sitio |
| Mosaico CTX | 5.7 terapíxeles | Una o dos teselas de 4°×4° por sitio |
| DTM HiRISE | Cientos de MB por par estéreo | Los que cubran la zona de operación |

### 8.4 Licencias y atribución

| Fuente | Condición |
| --- | --- |
| Datos de NASA y PDS | En general, dominio público en EE. UU.; se da crédito a cada instrumento |
| HRSC (dentro de S03) | CC BY-SA 3.0 IGO: atribución a ESA/DLR/FU Berlin y compartir igual los derivados |
| Mosaico CTX | Uso libre de la V01; crédito NASA/JPL/MSSS/The Murray Lab |
| Mars Climate Database | Sin uso comercial sin autorización; citar el MCD |
| Climatología de polvo | Acceso abierto; el resumen de los autores de 2014 indica CC BY-SA 3.0. Confirmar en la página de descarga |
| Access Mars | Apache-2.0; aviso en `public/eva/NOTICE.md` |

El manifiesto de cada tesela guarda la licencia para que la interfaz pueda mostrar el crédito correcto.

---

## 9. Fuentes sugeridas por el enunciado: cobertura

| Fuente pedida | Entradas |
| --- | --- |
| NASA | S01, S08, S10, S12, S14, S21, S23, S24, S28–S34, S36 |
| ESA | S03 (HRSC de Mars Express), S15 (contrato ESA), S38 (candidata) |
| Mars Reconnaissance Orbiter | S04, S05, S07, S11, S18 |
| Mars Global Surveyor | S01, S02, S03, capas TES de §2.1 |
| Mars Odyssey | Capas THEMIS de §2.1 |
| Mars Express | S03 |
| Curiosity | S09, S10, S12, S13, S20, S23 |
| Perseverance | S05, S10, S14, S23 |
| Mars Climate Database | S15, S16 |
| MOLA | S01, S02, S03 |
| HiRISE | S04, S05, S11 |
| CTX | S07 |
| TES | Capas de §2.1 (pendientes) |
| NASA Human Research Program | S30, S31, S32 |
| Actividad solar y radiación | S20, S21, S28 |

## 10. Pendientes

| ID | Tema |
| --- | --- |
| P-02 | Elegir sitio piloto; de ello depende qué DTM se descargan |
| P-16 | Comprobar con peticiones reales: estructura de `CMEAnalysis` para impactos en Marte; identificadores de las capas Trek de §2.1, incluida la de THEMIS; localización de S06; vigencia de S18; una petición real al servicio TAP de S38; registro, licencia y formato de S39 |
| P-17 | Solicitar la versión completa del Mars Climate Database si se quiere algo más que consultas manuales |
| P-18 | Clave propia de `api.nasa.gov` para el servidor (la de demostración es insuficiente) |
