# Caminatas sintéticas de HUELLA: documentación

## Para qué sirven

Son datos de prueba para el motor de reglas y la interfaz de HUELLA: caminatas (EVA) completas en Marte con dos astronautas (EV1 y EV2), en el mismo formato que la telemetría grabada del simulador **NASA SUITS (TSS)**.

Los datos biomédicos de trajes en EVAs reales **no son públicos** (NASA los entrega solo por solicitud formal), por eso se simulan. Cada valor sale de un modelo con fuente o está marcado como **[diseño]** cuando no existe un dato público.

Todas las caminatas comparten la misma ruta, los mismos astronautas y **un susto de EV1 que no debe alertar**. Cada **escenario** agrega un incidente distinto a EV1, a los 15 minutos de trabajo en el boxwork.

## Cómo generarlas

Los archivos `motor_reglas.py`, `generar_caminata_sintetica.py` y `convertir_a_huella.py` van en la misma carpeta. Solo usan la biblioteca estándar de Python.

```
python3 generar_caminata_sintetica.py                          # todos los escenarios
python3 generar_caminata_sintetica.py --escenario fuga_traje   # solo uno
python3 generar_caminata_sintetica.py --lista                  # ver escenarios
```

Por escenario se generan `caminata_<escenario>_huella.csv` (1 fila por segundo y por astronauta) y `caminata_<escenario>_eventos.csv` (cada cambio de nivel). Con la misma semilla (42 por defecto), el resultado es idéntico.

## Ruta común

| Tiempo aprox. | Fase (`event_label`) | Qué pasa |
|---|---|---|
| 0:00 – 0:19 | `traslado_wp1` | Hábitat → punto 1, pendiente 5 %, ~1.75 km/h |
| 0:19 – 0:49 | `trabajo_wp1` | 30 min de geología, 4 muestras |
| 0:49 – 1:39 | `traslado_wp2` | Subida al boxwork, pendiente 20 %, ~1 km/h |
| 1:09 | `susto_ev1` | EV1 se resbala: +35 lpm durante segundos (**no debe alertar**) |
| 1:39 – … | `trabajo_wp2` | Trabajo en el boxwork; el incidente empieza a los 15 min (1:54) |
| … – fin | `regreso` / `regreso_abortado` | Regreso al hábitat, bajada de 14 % |

## Escenarios y resultado del motor

| Escenario | Incidente en EV1 | Lo que hizo el motor | ¿Correcto? |
|---|---|---|---|
| `nominal` | Ninguno (solo el susto) | **Cero alertas** en 3 h 13 min | ✓ el susto y la subida no alertan |
| `falla_ventilador` | El ventilador se apaga en 45 s; el CO₂ sube ~3 mmHg/min; a los 6 min, ventilador secundario | Ventilador → PRECAUCIÓN → SUPERVIVENCIA (modo regreso); EV2 regresa con ella; CO₂ 15 → PRECAUCIÓN, 20 mmHg → SUPERVIVENCIA → **ABORTAR** (dos reglas) | ✓ |
| `fuga_traje` | La presión baja 0.6 kPa/min; al caer 1.9 kPa entra el O₂ secundario, que la sostiene 2.4 kPa abajo | Presión → PRECAUCIÓN → SUPERVIVENCIA; tanque secundario → **ABORTAR** | ✓ |
| `estres_termico` | El agua de enfriamiento sube a 32 °C; la temperatura central sube ~0.08 °C/min; la FC deriva; la humedad sube; a los 18 min, enfriamiento de respaldo | Temperatura 38.0 °C → PRECAUCIÓN; humedad > 75 % → PRECAUCIÓN; 38.5 °C → SUPERVIVENCIA (modo regreso); después se recupera | ✓ |
| `arritmia` | Ritmo irregular durante 2.5 min | Ritmo → PRECAUCIÓN; sostenido 60 s → SUPERVIVENCIA (modo regreso) | ✓ |
| `perdida_comunicacion` | 8 min sin contacto con el hábitat (las dos) | A los 5 min → PRECAUCIÓN: regresar al último waypoint | ✓ |

## Cómo decide el motor (`motor_reglas.py`)

- Cada regla da un nivel: **NORMAL < PRECAUCIÓN < SUPERVIVENCIA < ABORTAR**. Gana el más grave.
- **Dos o más reglas en SUPERVIVENCIA = ABORTAR.**
- **Filtro de persistencia [diseño]:** una alerta sube si la condición dura 3 s y baja si la condición resuelta dura 30 s. Sin este filtro, el ruido normal de los sensores hace que las alertas parpadeen cerca del umbral.
- **Modo regreso [diseño]:** al llegar a SUPERVIVENCIA, la EVA no se reanuda sola, aunque el problema se resuelva. Solo el IV1 podría reanudarla.
- **Pareja (EVA-17):** si una astronauta entra en emergencia, la otra regresa con ella.

## Modelos y parámetros

| Qué | Cómo se calcula | Origen |
|---|---|---|
| Gasto metabólico caminando | Pandolf (1977), términos de peso × 0.38 g; calibrado para que el plano dé ~1,000 kJ/h | Pandolf et al. 1977; calibración con media Apolo ~980–1,030 kJ/h [NASA TN D-7883] |
| Gasto en estación geológica | 1,024 kJ/h | [NASA TN D-7883] |
| Masa del traje | 104 kg (objetivo del traje marciano MxEMU) | [NASA, ICES-2026] |
| Equipo | Martillo 0.9 kg; XRF o vis-NIR ~2.5 kg; muestras 0.5 kg c/u | Smithsonian; BASALT; [diseño] muestras |
| Velocidad | 2 km/h en plano; baja con la pendiente | [NASA] 2 km/h; [diseño] la reducción |
| VO₂ y VCO₂ | VO₂ = gasto ÷ 20.9 kJ/L; VCO₂ = 0.85 × VO₂ | [NASA] Gernhardt y Dervay |
| Tanques de O₂ | Primario 950 psi, baja 2.13 psi/min por L/min de VO₂; secundario 6,000 psi | [NASA] EMU |
| Presión del traje | 29.6 kPa (4.3 psid), ruido 0.15 kPa | [NASA] EMU; NASA-STD-3001 Vol. 2 |
| FC esperada | %FC de reserva ≈ %VO₂ de reserva; FCmáx = 208 − 0.7 × edad; retraso ~45 s | Swain y Leutholtz 1997; Tanaka et al. 2001 |
| Perfiles | EV1: 38 años, 65 kg, VO₂máx 40. EV2: 34 años, 72 kg, VO₂máx 44 | [diseño], cumplen NASA-STD-3001 (≥ 36.5) |
| SpO₂ | ~98 % estable (O₂ puro a ~30 kPa); no baja con fallas de CO₂ | [fisiología] |
| Frecuencia respiratoria | Sube con el esfuerzo y con el CO₂ | [fisiología] cualitativa; coeficientes [diseño] |
| Humedad del traje | 45 % nominal | [NASA] rango 25–75 % tolerable indefinidamente |
| Agua de enfriamiento | Entrada 22 °C | [NASA] ensayos con entrada ~21–24 °C |
| Radiación | 0.64 mSv/día | [NASA] RAD, Hassler et al. 2014 |
| Ventilador | 30,000 rpm nominal | [SUITS TSS] |
| Batería | 500 Wh, consumo 50 W | [NASA] 450–540 Wh; consumo [diseño] |
| Incertidumbre de ubicación | 1 m + 2 % de lo caminado desde la última referencia | [diseño] |
| Susto | +35 lpm que sube en segundos y baja en ~2 min | [diseño]; el estrés eleva la FC sin aumentar el gasto |
| Falla de ventilador | Subida de CO₂ ~3 mmHg/min; 6 min de diagnóstico | [diseño], ilustrativo: no hay dato público |
| Fuga | 0.6 kPa/min; secundario regula 2.4 kPa abajo | [diseño]; que el secundario entre al caer la presión es [NASA] EMU |
| Estrés térmico | +0.08 °C/min; deriva de FC 20 lpm por °C; agua a 32 °C | [diseño] |
| Arritmia | 2.5 min irregular | [diseño], inspirado en las arritmias registradas en Apolo 15 |
| Persistencia de alertas | 3 s para subir, 30 s para bajar | [diseño] |

## Variables: qué se incluyó y qué no (decisiones)

| Variable | Decisión | Por qué / dónde vive |
|---|---|---|
| Humedad del traje | **Sí** (`suit_humidity_pct`, regla EVA-21) | NASA da rangos con tiempos de tolerancia: es una regla real |
| Temperatura del agua de enfriamiento | **Sí** (`lcvg_inlet_temp_c`) | Explica el estrés térmico; sensor actual en el EMU |
| Comunicación | **Sí** (`comm_ok`, regla EVA-16) | Regla de pérdida de contacto |
| Presión arterial | **Sí, pero en el hábitat** (checklist del cap. 4) | Hoy solo se mide en el hábitat |
| Fatiga de manos | **Sí, pero autoevaluación** (check-in del cap. 6) | No hay sensor; es la lesión más común en EVA |
| ECG crudo | **No en la telemetría**; sí `rhythm_irregular` | El ECG va a cientos de muestras por segundo; el motor usa el resultado |
| Contaminantes traza | **No** | Sensores aún en desarrollo; sin umbrales numéricos en la investigación |

## Diccionario de columnas que agrega HUELLA

| Columna | Unidad | Qué es |
|---|---|---|
| `spo2_pct` | % | Saturación de oxígeno |
| `core_temp_c` | °C | Temperatura central |
| `resp_rate_rpm` | resp/min | Frecuencia respiratoria |
| `rhythm_irregular` | 0/1 | Ritmo del ECG irregular |
| `pos_uncertainty_m` | m | Radio de incertidumbre de la ubicación |
| `suit_humidity_pct` | % | Humedad relativa dentro del traje |
| `lcvg_inlet_temp_c` | °C | Temperatura de entrada del agua de enfriamiento |
| `comm_ok` | 0/1 | Contacto con el hábitat |
| `metabolic_rate_kj_h` | kJ/h | Gasto metabólico del modelo |
| `vo2_l_min`, `vco2_l_min` | L/min | Consumo de O₂ y producción de CO₂ |
| `hr_expected_bpm` | lpm | FC que explica el esfuerzo |
| `dose_eva_msv` | mSv | Dosis acumulada en esta EVA |
| `event_label` | texto | **Verdad del escenario**, solo para validar. El motor **no** la lee |
| `nivel_huella` | texto | Decisión del motor |

## Cómo agregar un escenario nuevo

1. En `generar_caminata_sintetica.py`, agrega una entrada al diccionario `ESCENARIOS`:
   ```python
   "mi_escenario": {"respuesta_s": 300, "desc": "Qué pasa, en una línea."},
   ```
   `respuesta_s` = segundos desde el incidente hasta que la tripulación responde y empieza a regresar.
2. En la función `aplicar_escenario()`, agrega un bloque que cambie las variables de EV1 según `dt` (segundos desde que empezó el incidente). Por ejemplo, para que la SpO₂ baje:
   ```python
   elif esc == "mi_escenario":
       v["spo2"] = 98 - dt / 30      # baja 2 puntos por minuto
   ```
   Si usas una variable nueva (como `spo2`), agrégala también en el diccionario `v` de valores nominales y en la columna correspondiente de `fila.update(...)`.
3. Documenta en esta tabla de qué fuente sale cada número, o márcalo como [diseño].
4. Corre: `python3 generar_caminata_sintetica.py --escenario mi_escenario`
5. Revisa que los eventos impresos sean los que esperabas.

## Limitaciones (dígalas en la presentación)

- Son **datos simulados**, no telemetría real de un traje en Marte.
- La ruta usa coordenadas locales y pendientes fijas por tramo; se reemplaza por la ruta calculada del DEM de Gale.
- Pandolf no fue diseñado para trajes presurizados ni modela bien las bajadas; se calibra con datos del Apolo y las bajadas se tratan como plano.
- Los valores **[diseño]** son ilustrativos y ajustables; no existe un dato público de NASA para ellos.
- Falta el entorno (`entorno.csv` con datos reales de REMS): temperatura, presión, polvo, UV y hora solar. Las reglas de tormenta y evento solar se probarán con él.

## Referencias

- NASA TN D-7883, tasas metabólicas en las EVAs del Apolo: https://www.nasa.gov/wp-content/uploads/static/history/alsj/tnD7883Metabolic.pdf
- NASA-STD-3001 Vol. 2, cap. 11 (trajes espaciales): https://www.nasa.gov/reference/11-0-spacesuits-vol-2/
- Gernhardt y Dervay, operaciones médicas de EVA (NASA): https://www.nasa.gov/wp-content/uploads/2023/03/gernhardt-eva-ops-chp-5.4-2013.pdf
- NASA, Mars PLSS Status and Plan (ICES-2026): https://ntrs.nasa.gov/api/citations/20260003024/downloads/Final_ICES2026_Mars_PLSS_Plan.pdf
- NASA NSSDC, Mars Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- Hassler et al. (2014), radiación en la superficie de Marte (MSL/RAD), Science 343. Resumen: https://phys.org/news/2013-12-scientists-publish-surface-mars.amp
- BASALT, instrumentos portátiles para EVAs en Marte (Astrobiology): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6442242/
- Smithsonian NASM, martillo del Apolo: https://airandspace.si.edu/collection-objects/hammer-apollo/nasm_A19850612000
- NASA SUITS, Telemetry Stream Server: https://github.com/SUITS-Techteam/TSS_2024
- Pandolf KB, Givoni B, Goldman RF (1977). Predicting energy expenditure with loads while standing or walking very slowly. J Appl Physiol 43(4):577–581.
- Swain DP, Leutholtz BC (1997). Heart rate reserve is equivalent to %VO2 reserve, not to %VO2max. Med Sci Sports Exerc 29(3):410–414.
- Tanaka H, Monahan KD, Seals DR (2001). Age-predicted maximal heart rate revisited. J Am Coll Cardiol 37(1):153–156.
- Moran DS, Shitzer A, Pandolf KB (1998). A physiological strain index to evaluate heat stress. Am J Physiol 275(1):R129–R134.
- Investigación del equipo: *Parámetros Go/No-Go y monitoreo biomédico para EVAs en Marte* (fuente de los valores del EMU, humedad y agua de enfriamiento citados arriba).

*Hecho con apoyo de IA (Claude); declararlo en el campo "Use of Artificial Intelligence" de la entrega de Space Apps.*
