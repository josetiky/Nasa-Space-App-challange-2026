# UX_UI_GUIDELINES — Experiencia e interfaz de Mars Trek

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md) · Relacionados: [ARCHITECTURE.md](ARCHITECTURE.md), [SCIENTIFIC_CONFIDENCE.md](SCIENTIFIC_CONFIDENCE.md), [AGENT_GUIDELINES.md](AGENT_GUIDELINES.md)

Este documento existe porque el usuario pidió que el UX/UI se haga con un conjunto concreto de skills. En PLANNING **no se construye interfaz ni se instala nada**: aquí queda el encargo de diseño, el papel de cada skill y las reglas para que el agente de frontend las use sin contradicciones.

---

## 1. Skills indicadas por el usuario

Revisadas el 2026-11-14 leyendo sus repositorios. Se anota la revisión vista para poder fijarla.

| Skill | Origen · licencia · revisión vista | Qué es | Papel en Mars Trek |
| --- | --- | --- | --- |
| **Apple UI Designer** | [aiuxplayground.com](https://aiuxplayground.com/skills/apple-ui-designer) → `heyman333/atelier-ui`, `skills/apple-ui-designer` · **sin archivo de licencia** · `92b76bf` (2026-01-15) | Rediseño de interfaces móviles al estilo de las guías de Apple: claridad, jerarquía por tamaño y peso, materiales translúcidos con mesura, hojas inferiores, movimiento sereno | Vistas de **campo** en tableta y móvil (HUD, tarjeta de EVA). Aporta principios, no la paleta |
| **emilkowalski/skills** | <https://github.com/emilkowalski/skills> · MIT · `0f2e23b` (2026-11-13) | 19 skills de ingeniería de diseño: animación, gestos, pulido, rendimiento de animación, pruebas con datos extremos | **Movimiento e interacción** de toda la interfaz |
| **Impeccable** | <https://github.com/pbakaus/impeccable> · Apache-2.0 · v4.9.1, `1b2aa57` (2026-11-14) | Vocabulario y revisión de diseño: `shape`, `init`, `document`, `critique`, `audit`, `polish`, `harden`, `adapt`, `optimize`, más un detector determinista de patrones genéricos | **Dirección y control de calidad** de la pantalla operativa |
| **Taste Skill** | <https://github.com/Leonxlnx/taste-skill> · MIT · v2.5.1, `f6b7657` (2026-11-07) | Skill `design-taste-frontend` para sitios de empresa y páginas de aterrizaje, con verificación en navegador | Solo la **página de presentación** del proyecto |
| **threejs-skills** | <https://github.com/CloudAI-X/threejs-skills> · MIT · `0e18186` (2026-10-19) | 13 skills de three.js verificadas contra three r186, React Three Fiber 9.8 y drei 10.7 | Todo el código **3D** |
| **ascii-skills** | <https://github.com/full-stack-skills/ascii-skills> · Apache-2.0 · `360553d` (2026-10-04) | 13 skills de arte y visualización ASCII para terminal: minigráficas, tablas, barras de progreso, diagramas de cajas, rótulos | **Detalle distintivo** tipográfico y salida de las herramientas de línea de comandos |

Coincidencias útiles con lo que ya hay:

- threejs-skills apunta exactamente a las versiones del proyecto (`three ^0.186.0`, `@react-three/fiber ^9`, `@react-three/drei ^10`).
- El sitio Space Rockstars ya usa las curvas de aceleración que recomienda Emil Kowalski (`cubic-bezier(.23,1,.32,1)` y `cubic-bezier(.77,0,.175,1)`), el `scale(.97)` al pulsar y una barra de viabilidad en ASCII. Las skills formalizan un gusto que el equipo ya tiene.
- El proyecto ya incluye `sonner` para avisos; la colección de Emil trae una skill específica (`ask-sonner`).

---

## 2. Instalación (tarea de BUILD, con aprobación del usuario)

No se instala en PLANNING. Órdenes documentadas por cada proyecto, para ejecutar desde la raíz del repositorio principal:

| Skill | Orden | Qué conviene saber antes |
| --- | --- | --- |
| emilkowalski/skills | `npx skills@latest add emilkowalski/skills` | Instala las 19; se pueden elegir |
| Impeccable | `npx impeccable install` y después `/impeccable init` | Descarga un binario en el primer uso; escribe `PRODUCT.md` y `DESIGN.md`; activa un detector tras editar interfaz, que se desactiva con `/impeccable hooks off` |
| Taste Skill | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` | Requiere Node 22 o superior y Chrome; registra una verificación al terminar cada turno. Instalar solo donde se trabaje la página de presentación |
| threejs-skills | `npx skills add cloudai-x/threejs-skills` | Sin efectos secundarios; solo documentación |
| ascii-skills | `npx skills add full-stack-skills/ascii-skills` o `--skill <nombre>` | Algunas traen guiones de Python de ejemplo |
| Apple UI Designer | `claude plugin marketplace add heyman333/atelier-ui` y `claude plugin install heyman333@atelier-ui` | El repositorio no publica licencia: usar como plugin, **no copiar** su contenido al repositorio |

Recomendaciones:

1. Instalar a nivel de proyecto y **fijar la revisión** anotada arriba, para que todos los agentes trabajen con las mismas reglas.
2. Son instrucciones de terceros que el agente ejecutará: revisar lo instalado antes de confirmar el cambio en git.
3. Registrar en `AGENT_GUIDELINES.md` qué skills están instaladas y con qué revisión.

---

## 3. Encargo de diseño

Redactado con la estructura de `impeccable shape`: un encargo sin código que debe confirmarse antes de construir.

### 3.1 Trabajo y audiencia

- **Quién:** quien planifica o supervisa una salida a pie o en rover en Marte: tripulación antes de salir, responsable en el hábitat durante la salida y, en el concurso, el jurado que evalúa el prototipo.
- **En qué situación:** con tiempo limitado y consecuencias serias; necesita decidir, no explorar por placer.
- **Modo de la superficie:** **Operate** (en el vocabulario de Impeccable): la persona viene a completar una tarea. Mandan la legibilidad, la consistencia y los controles conocidos; la identidad vive en los detalles.

### 3.2 Resultado y prueba

- **Tarea principal:** obtener una ruta admisible y entender **por qué esa** y **por qué no otra**.
- **Éxito:** en menos de diez segundos la persona sabe si puede salir, por dónde, con qué margen y qué manda en la decisión.
- **Lo que solo Mars Trek puede afirmar:** la ruta respeta el estado del astronauta y distingue lo que se sabe del terreno de lo que se supone.

### 3.3 Dirección

- **Autoridad visual:** el tema oscuro de control de misión que ya tiene la aplicación (tokens `ink`, `panel`, `line`, `fog`, `bright`, `amber`, `cyan`, `rose`, `mint`) y la tipografía del sitio del equipo (Syncopate para rótulos, Inter para texto, JetBrains Mono para datos).
- **Tesis:** el mapa es el protagonista; todo lo demás responde a "¿qué ha cambiado y qué hago?".
- **Detalle distintivo:** la **barra de porqués**: una barra segmentada con la contribución de cada término (D, T, R, E, U, H) al costo de la ruta. Aparece idéntica en la ficha de ruta, en la comparación y en el informe. Se acompaña de lecturas monoespaciadas con minigráficas ASCII para la telemetría.
- **Consecuencia de implementación:** el motor debe entregar el desglose por término (ya previsto en `RouteExplanation`).

### 3.4 Alcance y límites

- **Dentro:** la pantalla `/trek` (planificar, comparar, simular, replanificar), su vista 3D del sitio y su vista de campo.
- **Fuera:** rediseñar las pantallas existentes; el sitio Space Rockstars, salvo la página de presentación si se decide (P-03).
- **Lo que haría que estuviera mal aunque fuera bonito:** que un riesgo quede oculto por estética; que algo simulado parezca medido; que el aspecto de "cabina" sustituya a controles reconocibles.

### 3.5 Estados y rangos

| Estado de la interfaz | Qué debe mostrar |
| --- | --- |
| Sin sitio elegido | Invitación a elegir sitio; qué sitios tienen datos a escala de caminata |
| Cargando teselas | Progreso real por capa; el mapa base utilizable mientras tanto |
| Sin ruta posible | El motivo, la restricción que lo causa y destinos alcanzables |
| Ruta activa | Métricas, márgenes, barra de porqués, alternativas |
| Replanificando | Qué cambió, ruta anterior atenuada, ruta nueva |
| CRITICAL o EMERGENCY | Modo dedicado: ruta al refugio, protocolo, nada accesorio |
| Datos caducados o sin red | Fecha del dato y origen (directo, proxy o instantánea) |
| Sin WebGL | Mapa 2D completo; la vista 3D se sustituye por un aviso (ya resuelto en `Guarded3D.tsx`) |

Rangos realistas: 0 a 3 rutas comparadas; 1 a 4 tripulantes; 6 a 17 capas; rutas de 50 m a 20 km; registros de hasta cientos de eventos.

### 3.6 Interacción y disposición

Disposición propuesta de la pantalla principal en escritorio:

```
+----------------------------------------------------------------------------------------------+
| MARS TREK   Gale - Monte Sharp    Sol 5073 - 14:22    [ SIMULACION ]    Perfil: Equipo EVA   |
+---------------------+------------------------------------------------+-----------------------+
| CAPAS               |                                                | RUTA ACTIVA           |
| [x] Pendiente       |                                                | 6.0 km   2 h 48 min   |
| [x] Zonas           |                MAPA DEL SITIO                  | O2 0.41 kg   max 9 gr |
| [ ] Confianza       |                                                | Margen regreso  31 %  |
| [ ] Polvo           |     ruta elegida  =====   alternativa  - - -   +-----------------------+
| [ ] Radiacion       |     tormenta  ::::    prohibida  ####          | POR QUE ESTA RUTA     |
| [ ] Alcance         |     desconocida  ....                          | D  ########..  52 %   |
+---------------------+                                                | T  ###.......  18 %   |
| SALUD   EV1         |     (o) origen    <> refugio    |> destino     | U  ##........  12 %   |
| Estado  FATIGUE     |                                                | Descartada: ruta A    |
| Pendiente max 15 gr |                                                | 17 gr > 15 gr (salud) |
| lo impone: EV1      +------------------------------------------------+-----------------------+
| Descanso en 12 min  | PERFIL   elevacion  _.-~^~-._     confianza  K1 K1 K3a K3a K3a K1      |
+---------------------+------------------------------------------------------------------------+
| TIEMPO  00:00 ----o---------- 01:12 tormenta ---- 01:40 FATIGUE > replan ----    [>] x10     |
+----------------------------------------------------------------------------------------------+
```

Boceto en ASCII puro, sin acentos ni símbolos especiales, para conservar la alineación. No fija colores ni medidas.

- **Tres zonas fijas:** qué veo (capas y salud, izquierda), dónde (mapa, centro), qué decido (ruta y porqués, derecha). La línea de tiempo abajo.
- **Controles estándar:** casillas, pestañas, selectores y tablas de shadcn. Nada de imitaciones de consola como control.
- **Selección directa en el mapa:** origen, destino y puntos de paso con clic; tecla Escape cancela.
- **Comparación:** hasta tres rutas en columnas con las mismas métricas y la misma barra.
- **Ficha de evidencia:** al pulsar una celda, de dónde sale lo que se sabe de ese punto.
- **Tableta y móvil:** el panel derecho pasa a hoja inferior arrastrable; zonas táctiles cómodas; áreas seguras.

### 3.7 Restricciones y decisiones abiertas

- Sin dependencias nuevas de interfaz en la versión 1.
- Idioma de la interfaz por decidir (P-19).
- Nombre visible del producto por decidir (P-20).
- La apariencia final se valida con maquetas antes del hito H6.

---

## 4. Reglas de precedencia entre skills

Cuando dos skills se contradicen, manda la de arriba.

| Orden | Regla | Motivo |
| --- | --- | --- |
| 1 | **La información de seguridad y su veracidad** mandan sobre cualquier criterio estético | Filosofía del producto |
| 2 | El **encargo** de §3 manda sobre el gusto de cualquier skill | Impeccable: "el encargo gana" |
| 3 | **Impeccable en modo Operate** gobierna estructura, densidad y revisión de `/trek` | Es una herramienta de trabajo, no una página de venta |
| 4 | **Emil Kowalski** gobierna movimiento e interacción | Especialización |
| 5 | **threejs-skills** gobierna cualquier código 3D | Versiones verificadas |
| 6 | **Apple UI Designer**, `apple-design` y `mobile-native` gobiernan la vista de campo | Especialización móvil |
| 7 | **Taste Skill** solo en la página de presentación | Sus reglas (una sección por pantalla, entrada animada del encabezado, fotografías) no sirven en una pantalla operativa |
| 8 | **ASCII** como detalle tipográfico; nunca como control ni como disfraz | Impeccable advierte contra convertir una herramienta en imitación de terminal |

Conflictos ya resueltos:

- *Fondo claro de Apple UI Designer frente al tema oscuro:* se conserva el oscuro. De Apple se toman claridad, jerarquía y contención.
- *"Momentos" animados de Taste frente a "no animar lo frecuente" de Emil:* en `/trek` gana Emil.
- *Estética de cabina frente a controles estándar:* controles estándar. La identidad entra por tipografía, paleta, densidad y la barra de porqués.

---

## 5. Sistema visual de partida

### 5.1 Significado antes que color

Cada estado, zona y clase de confianza se comunica con **tres canales a la vez**: texto, forma y color. Propuesta, por validar en maquetas:

| Concepto | Texto | Forma | Color (token existente) |
| --- | --- | --- | --- |
| NORMAL | NORMAL | Círculo lleno | `mint` |
| FATIGUE | FATIGA | Medio círculo | `cyan` |
| CAUTION | PRECAUCIÓN | Triángulo | `amber` |
| CRITICAL | CRÍTICO | Rombo | `rose` |
| EMERGENCY | EMERGENCIA | Cuadrado lleno, a todo el ancho | `rose` sobre fondo invertido |
| Zona prohibida | PROHIBIDA | Trama cruzada | `rose` |
| Zona desconocida | DESCONOCIDA | Trama de puntos | `fog` |
| Confianza K1–K2 | Clase visible | Trazo continuo | `bright` |
| Confianza K3 | Clase visible | Trazo discontinuo | `bright` atenuado |
| Confianza K4 | Clase visible | Trazo punteado | `fog` |
| Dato simulado | SIMULADO | Banda superior fija | `amber` |

### 5.2 Tipografía y números

- Datos en monoespaciada con cifras tabulares para que no salten al cambiar.
- Unidades siempre visibles y siempre las mismas (m, km, min, Wh, kg, µSv, grados).
- Etiqueta de procedencia junto a cada valor con el componente existente `DataBadge`.

---

## 6. Movimiento e interacción

Reglas tomadas de `emil-design-eng`, `animate`, `choreograph` y `animation-performance`:

| Situación | Regla |
| --- | --- |
| Acciones por teclado y acciones muy frecuentes (activar capa, mover el mapa) | **Sin animación** |
| Aparición de paneles, hojas y avisos | Curva de salida rápida; entre 150 y 250 ms; las hojas y diálogos, hasta 500 ms |
| Cambio de ruta por replanificación | Animación **con propósito**: la ruta anterior se atenúa y la nueva se dibuja desde la posición actual. Es la única animación larga permitida, porque explica un cambio de estado |
| Pulsación de botones | Respuesta inmediata con `scale(0.97)` |
| Salidas | Más rápidas que las entradas |
| Propiedades animadas | Solo `transform` y `opacity`; nunca `transition: all` |
| Estados de alerta | **Sin parpadeo ni rebote.** Un cambio a CRITICAL se comunica con cambio de modo, no con efectos |
| Movimiento reducido | Se respetan las preferencias del sistema: se conservan fundidos, se quita el desplazamiento |
| Puntero y táctil | Efectos al pasar el cursor solo con puntero fino |

Avisos: `sonner` para lo informativo. Lo crítico **no** va en un aviso efímero: va en un panel persistente.

---

## 7. 3D y ASCII

### 7.1 Vista 3D (threejs-skills)

| Tema | Regla |
| --- | --- |
| Skills aplicables | `threejs-react-three-fiber`, `threejs-performance`, `threejs-interaction`, `threejs-loaders`, `threejs-textures`, `threejs-geometry`, `threejs-shaders` |
| Reutilización | La escena de `SurfaceEva.tsx` (mallas Draco, texturas progresivas, HUD) |
| Costmap sobre el terreno | Como textura o sombreador sobre la malla; nunca geometría por celda |
| Selección | Trazado de rayos para elegir puntos, como ya hace el Explorer |
| Rendimiento | Presupuesto de fotogramas definido en H6; liberar geometrías y texturas al cambiar de sitio |
| Sin WebGL | Degradación a 2D ya resuelta en el repositorio |
| Texto en escena | Etiquetas como texturas de lienzo, no HTML dentro del árbol 3D (lección ya registrada en la arquitectura existente) |

### 7.2 ASCII (ascii-skills)

| Uso | Skill | Dónde |
| --- | --- | --- |
| Minigráficas de telemetría | `ascii-mini-charts` | Lecturas monoespaciadas del panel de salud y de la línea de tiempo |
| Tablas alineadas | `ascii-table-renderer` | Informe exportable y tarjeta de EVA en texto |
| Barras de progreso | `ascii-progress-and-spinner` | Carga de teselas; guiones del pipeline de datos |
| Diagramas de cajas | `ascii-diagram-boxflow` | Documentación técnica |
| Rótulos | `ascii-cli-logo-banner`, `ascii-text-art-library` | Herramientas de línea de comandos del pipeline |

Reglas: alineación segura con fuente monoespaciada; siempre con alternativa accesible (el dato también como texto para lectores de pantalla); ASCII como detalle, nunca como control.

---

## 8. Revisión y control de calidad

Flujo propuesto para el hito de interfaz, en este orden:

| Paso | Herramienta | Resultado |
| --- | --- | --- |
| 1 | `/impeccable init` y `/impeccable document` | `PRODUCT.md` y `DESIGN.md` a partir de este encargo y de los tokens existentes |
| 2 | Maquetas de la pantalla principal y de la vista de emergencia | Aprobación del usuario antes de construir |
| 3 | Construcción por secciones, con `emil-design-eng` y las skills de three.js | Pantalla funcional |
| 4 | `break-ui` | Comportamiento con datos extremos |
| 5 | `/impeccable critique` y `/impeccable audit` | Informe con hallazgos priorizados |
| 6 | `review-animations` y `remove-animations` | Movimiento con propósito |
| 7 | `/impeccable harden` y `/impeccable adapt` | Errores, casos límite, tamaños de pantalla |
| 8 | `/impeccable polish` y `npx impeccable detect src/` | Cierre |

Lista de aceptación de la interfaz:

- [ ] La ruta elegida explica sus motivos con la barra de porqués.
- [ ] Cada ruta descartada muestra la causa concreta.
- [ ] La incertidumbre se ve en el mapa y en el perfil sin leer la leyenda.
- [ ] El estado de salud y la restricción que impone están siempre visibles.
- [ ] Lo simulado está rotulado en todo momento.
- [ ] Ningún significado depende solo del color.
- [ ] Toda la pantalla se puede usar con teclado.
- [ ] Una replanificación dice qué cambió y por qué.
- [ ] En CRITICAL y EMERGENCY desaparece lo accesorio.
- [ ] La auditoría de Impeccable no deja hallazgos de prioridad máxima.

---

## 9. Pendientes

| ID | Tema |
| --- | --- |
| P-03 | Relación con el sitio Space Rockstars y su sección MarsWalk |
| P-19 | Idioma de la interfaz |
| P-20 | Nombre visible del producto |
| P-21 | Aprobar la instalación de las skills y su ámbito |
| P-22 | Maquetas de la pantalla principal y de la vista de emergencia antes del hito de interfaz |
