/**
 * MarsWalk · Traducción al inglés de los textos que produce el motor (core/trek).
 *
 * El motor escribe sus avisos en español (mensajes del planificador, motivos de bloqueo, bitácora
 * de replanificación, fuentes de la envolvente, reglas HUELLA y de misión). Cambiarlos a claves
 * rompería las pruebas de paridad con HUELLA y la trazabilidad de la bitácora, así que se traducen
 * al mostrarlos: plantillas con expresiones regulares que se aplican en orden (de la más específica
 * a la más general) sobre todo el texto, de modo que también se traducen líneas compuestas como
 * "[A* · REPLAN] Ruta calculada (…)". Lo que no coincide se muestra tal cual.
 * engineText.test.ts recorre las plantillas del código del motor para que ninguna quede sin traducir.
 */
export type Lang = "es" | "en";

type Rule = readonly [RegExp, string];

const N = "([-+]?[\\d.,]+)";
const W = "([^\\s)]+)";
const rx = (src: string) => new RegExp(src.replace(/\{N\}/g, N).replace(/\{W\}/g, W), "g");

const RULES: readonly Rule[] = [
  // ---- Planificador y A* ----
  [
    rx(String.raw`El origen \({N}, {N}\) está fuera de los límites de la rejilla\.`),
    "The start ($1, $2) is outside the grid.",
  ],
  [
    rx(String.raw`El destino \({N}, {N}\) está fuera de los límites de la rejilla\.`),
    "The goal ($1, $2) is outside the grid.",
  ],
  [rx(String.raw`El origen es inadmisible: `), "The start is inadmissible: "],
  [rx(String.raw`El destino es inadmisible: `), "The goal is inadmissible: "],
  [rx(String.raw`El origen no tiene dato de elevación\.`), "The start has no elevation data."],
  [rx(String.raw`El destino no tiene dato de elevación\.`), "The goal has no elevation data."],
  [rx(String.raw`Origen fuera de la rejilla`), "Start outside the grid"],
  [rx(String.raw`Destino fuera de la rejilla`), "Goal outside the grid"],
  [rx(String.raw`Origen con elevación NaN`), "Start with NaN elevation"],
  [rx(String.raw`Destino con elevación NaN`), "Goal with NaN elevation"],
  [
    rx(String.raw`Pendiente local {N}° supera el límite {N}°`),
    "Local slope $1° exceeds the $2° limit",
  ],
  [
    rx(String.raw`Zona {W} excluida por la envolvente de seguridad`),
    "Zone $1 excluded by the safety envelope",
  ],
  [rx(String.raw`Pendiente de celda {N}° > límite {N}°`), "Cell slope $1° > $2° limit"],
  [rx(String.raw`Terreno sin dato de elevación \(NaN\)`), "Terrain without elevation data (NaN)"],
  [rx(String.raw`Pendiente de arista {N}° >= {N}°`), "Edge slope $1° >= $2°"],
  [
    rx(String.raw`Pendiente máxima {N}° supera el límite {N}° impuesto por salud \({W}\)`),
    "Max slope $1° exceeds the $2° limit set by health ($3)",
  ],
  [
    rx(String.raw`Pendiente máxima {N}° supera el límite {N}° \({W}\)`),
    "Max slope $1° exceeds the $2° limit ($3)",
  ],
  [
    rx(String.raw`Descartada: pendiente de {N}° > {N}° \({W}\)\.`),
    "Discarded: $1° slope > $2° ($3).",
  ],
  [rx(String.raw`Admisible: `), "Admissible: "],
  [rx(String.raw`Punto fuera de la rejilla en \(`), "Point outside the grid at ("],
  [rx(String.raw`Muestra de segmento fuera de la rejilla`), "Segment sample outside the grid"],
  [rx(String.raw`La línea directa sale de la rejilla`), "The straight line leaves the grid"],
  [
    rx(String.raw`Celda sin elevación válida \(NaN / clase K5\) en \(`),
    "Cell without valid elevation (NaN / class K5) at (",
  ],
  [
    rx(String.raw`Confianza {W} inferior al mínimo requerido {W}`),
    "Confidence $1 below the required minimum $2",
  ],
  [
    rx(String.raw`Dentro de tormenta activa '([^']+)' \(zona Z5\)`),
    "Inside active storm '$1' (zone Z5)",
  ],
  [
    rx(String.raw`Directiva hold-position activa: mantener posición actual y solicitar rescate\.`),
    "Hold-position directive active: stay in place and request rescue.",
  ],
  [
    rx(String.raw`No se especificó ningún destino ni refugio disponible\.`),
    "No goal or available shelter was given.",
  ],
  [
    rx(String.raw`La ruta calculada no superó la validación final de la envolvente de seguridad\.`),
    "The computed route failed the final safety-envelope check.",
  ],
  [
    rx(String.raw`No se encontró ninguna ruta segura tras agotar la escalera de degradación\.`),
    "No safe route found after exhausting the fallback ladder.",
  ],
  [
    rx(
      String.raw`La envolvente de seguridad no coincide con la versión de la instantánea del costmap\.`,
    ),
    "The safety envelope does not match the costmap snapshot version.",
  ],
  [
    rx(
      String.raw`La envolvente de seguridad no corresponde a la versión actual de la instantánea del costmap\.`,
    ),
    "The safety envelope does not match the current costmap snapshot version.",
  ],
  [
    rx(
      String.raw`No existe ningún corredor admisible entre origen y destino que cumpla la envolvente de seguridad\.`,
    ),
    "There is no admissible corridor between start and goal that meets the safety envelope.",
  ],
  [
    rx(String.raw`Corredor Directo A \(Descartado por Salud\)`),
    "Direct corridor A (discarded for health)",
  ],
  [
    rx(String.raw`Corredor Alternativo B \(Menor Pendiente\)`),
    "Alternative corridor B (lower slope)",
  ],
  [rx(String.raw`Perfil Más Rápido`), "Fastest profile"],
  [rx(String.raw`Perfil Más Seguro`), "Safest profile"],
  [rx(String.raw`Perfil Más Conocido`), "Best-known profile"],
  // ---- Recorrido con paradas ----
  [
    rx(String.raw`Sin corredor admisible hasta la parada «([^»]+)»\.`),
    "No admissible corridor to stop “$1”.",
  ],
  [rx(String.raw`Regreso al punto de partida`), "Return to start"],
  [rx(String.raw`Directiva {W}: refugio`), "$1 directive: shelter"],
  // ---- Replanificación ----
  [
    rx(String.raw`Modo {W}: ruta impuesta hacia refugio \({N} m, máx {N}°\)\.`),
    "$1 mode: route forced to a shelter ($2 m, max $3°).",
  ],
  [
    rx(String.raw`Ruta calculada \({N} m, costo {N} m-eq\)\.`),
    "Route computed ($1 m, cost $2 m-eq).",
  ],
  [
    rx(String.raw`Ruta anterior invalidada \((.+?)\) → nueva ruta segura \({N} m, máx {N}°\)\.`),
    "Previous route invalidated ($1) → new safe route ($2 m, max $3°).",
  ],
  [
    rx(
      String.raw`Propuesta de desvío: mejora el costo en {N} % \(> {N} %\)\. Ruta actual sigue siendo válida\.`,
    ),
    "Detour proposal: improves the cost by $1 % (> $2 %). The current route is still valid.",
  ],
  [
    rx(String.raw`Ruta actual conservada \(mejora de alternativa {N} % ≤ umbral {N} %\)\.`),
    "Current route kept (alternative improves $1 % ≤ $2 % threshold).",
  ],
  [
    rx(String.raw`Ruta al destino inadmisible → regreso al punto de partida \({N} m, máx {N}°\)\.`),
    "Route to the goal inadmissible → returning to start ($1 m, max $2°).",
  ],
  [
    rx(
      String.raw`Sin corredor A\* admisible → continúa el regreso por el camino recorrido \({N} m restantes\)\.`,
    ),
    "No admissible A* corridor → continuing the return along the walked path ($1 m left).",
  ],
  [
    rx(
      String.raw`Sin corredor A\* admisible → regreso por el camino recorrido \({N} m de terreno conocido\)\.`,
    ),
    "No admissible A* corridor → returning along the walked path ($1 m of known terrain).",
  ],
  // ---- Fuentes de la envolvente ----
  [
    rx(String.raw`Límite de pendiente {N}° impuesto por estado {W}`),
    "Slope limit $1° set by state $2",
  ],
  [
    rx(String.raw`Límite físico de pendiente {N}° del vehículo`),
    "Vehicle physical slope limit $1°",
  ],
  [
    rx(String.raw`Zonas admitidas: (.*?) \(Z5 prohibida siempre\)`),
    "Allowed zones: $1 (Z5 always forbidden)",
  ],
  [rx(String.raw`Confianza mínima requerida {W}`), "Minimum required confidence $1"],
  [
    rx(String.raw`Alerta de partículas solares activa: desvío obligatorio a refugio blindado`),
    "Solar particle alert active: mandatory diversion to a shielded shelter",
  ],
  [
    rx(String.raw`Recurso limitante crítico \({W}: {N} min\)`),
    "Critical limiting resource ($1: $2 min)",
  ],
  [rx(String.raw`Estado operativo {W}`), "Operating state $1"],
  [
    rx(
      String.raw`Límite de pendiente \({N}°\) impuesto por (.+?); velocidad \(×{N}\) impuesta por (.+)$`,
    ),
    "Slope limit ($1°) set by $2; speed (×$3) set by $4",
  ],
  // ---- Reglas HUELLA (traje y fisiología) ----
  [
    rx(String.raw`Presi[oó]n del traje {N} kPa \(ajuste {N}\)`),
    "Suit pressure $1 kPa (setpoint $2)",
  ],
  [
    rx(String.raw`Respirando del tanque secundario de O(?:2|₂)`),
    "Breathing from the secondary O₂ tank",
  ],
  [rx(String.raw`CO(?:2|₂) en casco {N} mmHg`), "Helmet CO₂ $1 mmHg"],
  [
    rx(String.raw`Ventilador primario bajo \(< 20 000 rpm\): flujo insuficiente`),
    "Primary fan low (< 20,000 rpm): insufficient flow",
  ],
  [rx(String.raw`Ventilador activo a {N} rpm`), "Fan running at $1 rpm"],
  [rx(String.raw`Ventilador a {N} rpm`), "Fan at $1 rpm"],
  [rx(String.raw`FC {N} lpm sostenida`), "HR $1 bpm sustained"],
  [
    rx(String.raw`FC {N} lpm sobre lo que explica el esfuerzo`),
    "HR $1 bpm above what the effort explains",
  ],
  [rx(String.raw`FC {N} lpm \(FCmáx {N}\)`), "HR $1 bpm (HRmax $2)"],
  [
    rx(String.raw`Temperatura central elevada \({N} °C\) por fallo LCVG`),
    "High core temperature ($1 °C) from an LCVG failure",
  ],
  [
    rx(String.raw`Hipertermia crítica: Temperatura central {N} °C`),
    "Critical hyperthermia: core temperature $1 °C",
  ],
  [rx(String.raw`Temperatura central {N} °C`), "Core temperature $1 °C"],
  [rx(String.raw`Hipoxia crítica: SpO2 {N} % \(< 85 %\)`), "Critical hypoxia: SpO2 $1 % (< 85 %)"],
  [rx(String.raw`Indice de estres fisiologico {N}/10`), "Physiological strain index $1/10"],
  [
    rx(String.raw`El ECG muestra ritmo cardíaco irregular sostenido`),
    "The ECG shows a sustained irregular heart rhythm",
  ],
  [rx(String.raw`El ECG muestra un ritmo irregular`), "The ECG shows an irregular rhythm"],
  [
    rx(String.raw`Más de 5 min sin contacto con el hábitat: regresar al último waypoint`),
    "More than 5 min without contact with the habitat: return to the last waypoint",
  ],
  [
    rx(String.raw`M[aá]s de 5 min sin contacto: regresar al [uú]ltimo waypoint`),
    "More than 5 min without contact: return to the last waypoint",
  ],
  [
    rx(String.raw`Fuga de presión en traje espacial \(> 1\.72 kPa bajo setpoint\)`),
    "Spacesuit pressure leak (> 1.72 kPa below setpoint)",
  ],
  [rx(String.raw`Humedad del traje {N} %`), "Suit humidity $1 %"],
  [
    rx(String.raw`Respiracion {N} rpm sin esfuerzo que la explique`),
    "Breathing $1 /min with no effort to explain it",
  ],
  [
    rx(String.raw`Evento de partículas solares: refugio obligatorio`),
    "Solar particle event: mandatory shelter",
  ],
  [rx(String.raw`Dos o más reglas en SUPERVIVENCIA`), "Two or more rules at SUPERVIVENCIA"],
  [
    rx(String.raw`Pérdida o degradación de telemetría biomédica: sin datos nunca se asume NORMAL`),
    "Biomedical telemetry lost or degraded: no data is never assumed NORMAL",
  ],
  // ---- Reglas de misión y fatiga ----
  [
    rx(String.raw`Te queda {N} min de margen\. Hora de regresar\.`),
    "You have $1 min of margin left. Time to head back.",
  ],
  [rx(String.raw`Margen de regreso bajo \({N} % < 20 %\)\.`), "Low return margin ($1 % < 20 %)."],
  [
    rx(String.raw`Alerta de evento solar\. Ve al refugio blindado más cercano\.`),
    "Solar event alert. Go to the nearest shielded shelter.",
  ],
  [
    rx(String.raw`Tormenta de polvo activa\. Sigue la ruta al refugio más cercano\.`),
    "Active dust storm. Follow the route to the nearest shelter.",
  ],
  [
    rx(
      String.raw`Incertidumbre de posición alta \(±{N} m > 150 m\)\. Regresa a la última referencia\.`,
    ),
    "High position uncertainty (±$1 m > 150 m). Go back to the last reference.",
  ],
  [
    rx(String.raw`Incertidumbre de posición moderada \(±{N} m > 50 m\)\.`),
    "Moderate position uncertainty (±$1 m > 50 m).",
  ],
  [
    rx(String.raw`Si no regresas ahora, llegarás de noche\.`),
    "If you don't head back now, you'll arrive after dark.",
  ],
  [
    rx(String.raw`Tu agua de enfriamiento pasó a reserva\.`),
    "Your cooling water is now on reserve.",
  ],
  [
    rx(String.raw`La batería solo alcanza para regresar\.`),
    "The battery only has enough to get back.",
  ],
  [
    rx(String.raw`Índice de fatiga acumulada F={N} \(umbral entrada {N}, salida {N}\) \[diseño\]`),
    "Accumulated fatigue index F=$1 (enter $2, exit $3) [design]",
  ],
  [
    rx(String.raw`Índice de estrés fisiológico moderado \({N}/10\) \[diseño\]`),
    "Moderate physiological strain index ($1/10) [design]",
  ],
  [
    rx(String.raw`Capacidad de movilidad reducida \({N} % de la velocidad prevista\) \[diseño\]`),
    "Reduced mobility ($1 % of the planned speed) [design]",
  ],
  [
    rx(String.raw`Tiempo acumulado de EVA {N} h supera las 6 h nominales`),
    "Accumulated EVA time $1 h exceeds the nominal 6 h",
  ],
  [
    rx(String.raw`Autoinforme de fatiga o esfuerzo elevado del tripulante`),
    "Crew self-report of fatigue or high exertion",
  ],
  // ---- Piezas sueltas (al final: solo lo que quede) ----
  [rx(String.raw` · confirmado por `), " · confirmed by "],
  [rx(String.raw`\bninguna\b`), "none"],
  [rx(String.raw`máx `), "max "],
];

/** Texto del motor en el idioma de la interfaz (sin cambios en español). */
export function engineText(text: string, lang: Lang): string {
  if (lang === "es" || !text) return text;
  let out = text;
  for (const [re, to] of RULES) {
    re.lastIndex = 0;
    out = out.replace(re, to);
  }
  return out;
}
