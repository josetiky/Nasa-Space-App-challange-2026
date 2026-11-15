# AGENT_GUIDELINES — Guía para agentes que trabajan en Mars Trek

> Fase: PLANNING · Estado: propuesta para aprobación · Fecha: 2026-11-14
> Documento maestro: [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md)

Si eres un agente de IA (o una persona) que se incorpora al proyecto, **empieza aquí**. No necesitas la conversación en la que se escribió esto.

---

## 1. Antes de tocar nada

**Estado del proyecto:** PLANNING terminado y pendiente de aprobación. **BUILD no está autorizado** hasta que el usuario lo diga de forma explícita. Mientras tanto solo se pueden crear o editar documentos Markdown de planificación.

Orden de lectura (unos quince minutos):

1. [MARS_TREK_MASTER_PLAN.md](../MARS_TREK_MASTER_PLAN.md): visión, auditoría, decisiones y pendientes.
2. Este documento: reglas y reparto.
3. [ARCHITECTURE.md](ARCHITECTURE.md): módulos y contratos.
4. El documento de tu área (tabla de §5).
5. [TESTING_STRATEGY.md](TESTING_STRATEGY.md): qué cuenta como terminado.
6. [ROADMAP.md](ROADMAP.md): tu tarea y de qué depende.

---

## 2. Mapa del espacio de trabajo

Raíz: la carpeta `NASA Space App Challenge/`. **No es un repositorio git**; contiene tres.

| Carpeta | Qué es | Git | Regla |
| --- | --- | --- | --- |
| `Nasa-Space-App-challange-2026/` | Aplicación principal (MARS // SURVIVE). TanStack Start, React 19, Vite 8, TypeScript estricto, Tailwind 4, three.js, Leaflet, Vitest | Rama `feature/intelligent-mission-control`; remotos `origin` (lshtiaq) y `fork` (josetiky); conectado a Lovable | **Aquí se construye Mars Trek** |
| `metricas de vida/` | HUELLA: motor de reglas biomédicas en Python, caminatas sintéticas y simuladores HTML | No | Referencia. **No modificar** |
| `access-mars/` | Copia de `googlecreativelab/access-mars` (Apache-2.0) | Sí | Fuente de recursos. **No modificar** |
| `Nasa/` | Sitio estático "Space Rockstars" del equipo, con la sección MarsWalk en desarrollo | Sí (Noc-00/Nasa) | Presentación. Tocar solo si lo decide P-03 |
| `Auditoría Técnica Mars Trek - Grid Mars Mission Atlas/` | Informe PDF y dos cuadernos de fuentes de datos | No | Fuente de investigación. Puede recibir material nuevo: revísala al empezar |
| `Claude outputs/` | Paquete git de una entrega anterior | No | No tocar |
| `server.js`, `server.py`, `start-server.command` | Servidores estáticos locales | No | No tocar |
| `MARS_TREK_MASTER_PLAN.md`, `docs/` | **Esta documentación** | No (ver P-01) | Editable en PLANNING |

Documentación ya existente del proyecto principal, que debes conocer: `Nasa-Space-App-challange-2026/README.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/SIMULATION_MODEL.md`, `docs/DECISION_ENGINE.md`, `docs/DATA_SOURCES.md`, `INTEGRATION_AUDIT.md`.

---

## 3. Reglas que no se negocian

| # | Regla | Por qué |
| --- | --- | --- |
| R1 | **Respeta la fase.** Sin autorización de BUILD no se escribe código, no se instala nada y no se modifica ninguna función | Instrucción del usuario |
| R2 | **No rompas la línea base.** 150 pruebas en verde y `tsc --noEmit` sin errores, siempre | INV-T1 |
| R3 | **No elimines ni reemplaces trabajo existente** sin justificarlo por escrito y sin aprobación | Instrucción del usuario |
| R4 | **No inventes APIs, endpoints ni identificadores de capa.** Si no está verificado en DATA_SOURCES, verifícalo con una petición real y regístralo | Rigor científico |
| R5 | **No inventes umbrales clínicos.** Todo límite lleva su fuente o la etiqueta **[diseño]** | Instrucción del usuario |
| R6 | **Todo valor lleva procedencia**: `REAL`, `DERIVED`, `MODELLED` o `SIMULATED` | Convención del proyecto |
| R7 | **Lo simulado nunca se presenta como medido.** La etiqueta viaja del origen a la pantalla | Instrucción del usuario |
| R8 | **Sin dato no es cero.** Un valor desconocido es `NaN` y clase K5 | INV-R4 |
| R9 | **Las restricciones duras son máscara, no costo alto** | INV-R3 |
| R10 | **El motor de rutas nunca se llama sin envolvente de seguridad**, y esta nunca se construye sin directiva de salud | INV-S2 |
| R11 | **Un propietario por directorio.** No edites fuera de tu ámbito; pide el cambio | Evita soluciones incompatibles |
| R12 | **Los contratos de `contracts/` no se cambian por cuenta propia** después de H1 | §6 |
| R13 | **Pruebas primero.** La prueba falla antes de que exista el código | TESTING_STRATEGY §9 |
| R14 | **No afirmes que algo funciona sin haberlo ejecutado.** Pega la salida real | Verificación antes de dar por terminado |
| R15 | **Git:** nunca reescribas historia publicada (el proyecto está conectado a Lovable); confirmaciones pequeñas; no confirmes ni envíes sin que el usuario lo pida | `AGENTS.md` del repositorio |
| R16 | **Claves solo en servidor.** Ninguna en el navegador ni en el repositorio | Seguridad |
| R17 | **Sin dependencias nuevas** salvo decisión registrada | Instrucción del usuario |
| R18 | **Declara los supuestos.** Un parámetro elegido por ti se marca **[diseño]** y se anota en el documento de tu área | Trazabilidad |

---

## 4. Reparto: quién es dueño de qué

Rutas relativas a `Nasa-Space-App-challange-2026/`. "Dueño" significa: único agente que edita ese directorio.

| Agente | Área | Es dueño de | Lee de | No toca |
| --- | --- | --- | --- | --- |
| **A1** Cartografía y geoespacial | Costmap, zonas, marco de referencia, almacenamiento | `src/core/trek/costmap/`, `src/core/trek/zones/`, `src/services/trek/storage/`, `src/services/trek/ingest/` | `contracts/`, `confidence/`, `core/science/terrain.ts`, `geo.ts` | `routing/`, `health/` |
| **A2** Datos NASA y ESA | Fuentes, pipeline, confianza, proxies | `scripts/trek/`, `public/data/trek/`, `src/core/trek/confidence/`, `src/routes/api/` (solo lo nuevo), `docs/DATA_SOURCES.md` | `contracts/`, `services/nasa/` | `routing/`, `health/`, interfaz |
| **A3** Algoritmos de navegación | Costo, pesos, envolvente, A\*, replanificación, explicación | `src/core/trek/cost/`, `src/core/trek/safety/`, `src/core/trek/routing/`, `src/services/trek/worker/` | `contracts/`, `costmap/`, `zones/`, `resources/` | `health/` (solo usa el tipo de la directiva), `core/science/routing.ts` |
| **A4** Salud y factores humanos | Reglas, máquina de estados, directiva, equipo, simulador de telemetría | `src/core/trek/health/`, `docs/ASTRONAUT_HEALTH_STATE_MACHINE.md` | `contracts/`, variables derivadas de `resources/`, `metricas de vida/` | `routing/`, `costmap/`, `metricas de vida/` (solo lectura) |
| **A5** Gestión de recursos | Modelos de consumo, presupuestos, alcanzabilidad | `src/core/trek/resources/`, `docs/RESOURCE_MANAGEMENT.md` | `contracts/`, `costmap/`, `core/science/eva.ts`, `constants.ts` | `health/`, `routing/`, `core/science/eva.ts` |
| **A6** Frontend y UX | Pantalla, mapa, paneles, store de interfaz | `src/routes/trek.tsx`, `src/components/trek/`, `src/state/trekStore.ts`, `docs/UX_UI_GUIDELINES.md` | Todo `contracts/`; resultados de todos los módulos | Cualquier `src/core/trek/**` |
| **A7** Integración y pruebas | Contratos, bus, simulador de misión, escenarios, rendimiento, entrega | `src/core/trek/contracts/`, `src/core/trek/sim/`, pruebas de escenario, `docs/TESTING_STRATEGY.md`, `docs/ROADMAP.md` | Todo | La implementación interna de los demás |

Archivos compartidos, solo con cambios aditivos y avisando a A7: `src/components/shell/AppShell.tsx` (una entrada de navegación), `src/data/sources.ts` (fuentes nuevas), `package.json` (solo con decisión registrada).

Archivos existentes que **nadie** modifica en Mars Trek: `src/core/science/**`, `src/core/sim/**`, `src/core/decision/**`, `src/state/missionStore.ts`. Si crees que hace falta, abre una solicitud (§6).

---

## 5. Fichas de agente

### A1 · Cartografía y geoespacial

- **Misión:** que exista un costmap correcto, versionado y honesto sobre su escala.
- **Lee:** [DYNAMIC_COSTMAP.md](DYNAMIC_COSTMAP.md), [SCIENTIFIC_CONFIDENCE.md](SCIENTIFIC_CONFIDENCE.md).
- **Entrega:** `CostmapSnapshot`, `ZoneClass` por celda, regiones sucias, almacenamiento de teselas.
- **Depende de:** contratos (H1); datos de A2.
- **Terminado cuando:** pendiente con línea base declarada; ninguna celda sin dato vale cero; reglas ZN con pruebas; PT-10 y PT-12 en verde.
- **Primera tarea:** H2-8 (teselas e instantáneas) con rejillas sintéticas, sin esperar a los datos reales.

### A2 · Investigación de datos NASA y ESA

- **Misión:** que cada dato tenga fuente verificada, licencia y clase de confianza.
- **Lee:** [DATA_SOURCES.md](DATA_SOURCES.md), [SCIENTIFIC_CONFIDENCE.md](SCIENTIFIC_CONFIDENCE.md), la auditoría técnica en PDF.
- **Entrega:** pipeline fuera de línea, manifiestos, teselas del sitio piloto, `ConfidenceService`.
- **Depende de:** decisión P-02 (sitio piloto).
- **Terminado cuando:** no queda ninguna fuente usada con estado "pendiente"; sumas de comprobación; créditos y licencias completos.
- **Primera tarea:** H2-1, cerrar las verificaciones de P-16 con peticiones reales.

### A3 · Algoritmos de navegación

- **Misión:** rutas óptimas, seguras por construcción y explicables.
- **Lee:** [ROUTING_ALGORITHM.md](ROUTING_ALGORITHM.md).
- **Entrega:** `planRoute`, `composeEnvelope`, `validateRoute`, controlador de replanificación, `RouteExplanation`.
- **Depende de:** contratos; costmap (puede empezar con rejillas sintéticas); tipo de la directiva.
- **Terminado cuando:** PT-01 a PT-08, PT-13 y PT-15 en verde; T-02, T-03, T-10 y T-11 en verde; presupuestos medidos.
- **Primera tarea:** H3-1 y H3-3 sobre las rejillas sintéticas de H1-5.

### A4 · Salud y factores humanos

- **Misión:** una máquina de estados fiel a HUELLA que comunique restricciones claras a la navegación.
- **Lee:** [ASTRONAUT_HEALTH_STATE_MACHINE.md](ASTRONAUT_HEALTH_STATE_MACHINE.md), `metricas de vida/huella_datos/`.
- **Entrega:** reglas, filtro, estados, `NavigationDirective`, compositor de equipo, simulador de telemetría.
- **Depende de:** contratos; variables derivadas de A5.
- **Terminado cuando:** PT-09 (paridad con los seis CSV), PT-11 y PT-12 en verde; T-07, T-08, T-09 y T-12 en verde; cada umbral con su etiqueta.
- **Primera tarea:** H5-2, portar el motor y reproducir `caminata_nominal_eventos.csv` (cero alertas).

### A5 · Gestión de recursos

- **Misión:** consumos creíbles, márgenes explícitos y un mapa de alcance correcto.
- **Lee:** [RESOURCE_MANAGEMENT.md](RESOURCE_MANAGEMENT.md).
- **Entrega:** `LocomotionModel` (dos implementaciones), `ResourceState`, `ResourcePlan`, `ReachabilityField`.
- **Depende de:** contratos; costmap para pendientes.
- **Terminado cuando:** PT-14 y T-05 en verde; cada parámetro con fuente o etiqueta de diseño; comparación de modelos documentada.
- **Primera tarea:** H5-8, las dos implementaciones del modelo de locomoción con sus pruebas.

### A6 · Frontend y UX

- **Misión:** una pantalla que deje claro por dónde ir, por qué y qué ha cambiado.
- **Lee:** [UX_UI_GUIDELINES.md](UX_UI_GUIDELINES.md), [ARCHITECTURE.md](ARCHITECTURE.md) §7.
- **Entrega:** ruta `/trek`, mapa, paneles, comparación, consola de simulación, vista 3D y vista de campo.
- **Depende de:** contratos (puede empezar con datos de ejemplo en H1); maquetas aprobadas.
- **Terminado cuando:** lista de aceptación de UX_UI_GUIDELINES §8 completa; pruebas de extremo a extremo en verde.
- **Skills obligatorias:** las de UX_UI_GUIDELINES §1, con las reglas de precedencia de su §4.
- **Primera tarea:** H6-1 y H6-2, documentos de producto y diseño, y maquetas para aprobación.

### A7 · Integración y pruebas

- **Misión:** que las piezas encajen y que lo que se afirma esté comprobado.
- **Lee:** todo.
- **Entrega:** contratos, bus, reloj, guiones, pruebas de escenario, banco de rendimiento, demostración.
- **Terminado cuando:** T-01 a T-12 en verde; PT-04 con diez mil casos; honestidad de datos auditada.
- **Primera tarea:** H1-1, tipos de `contracts/`.

---

## 6. Coordinación

### 6.1 Cambiar un contrato

1. Escribe una solicitud: qué tipo, qué cambio, por qué, a quién afecta.
2. A7 la revisa con los agentes afectados.
3. Si se aprueba, se registra la decisión y **todos** los afectados actualizan en la misma tanda.
4. Nunca se adapta un contrato "en local" para salir del paso.

### 6.2 Registro de decisiones

- Las decisiones de PLANNING están en MASTER_PLAN §11 con identificadores `D-…` (propuestas) y `P-…` (pendientes).
- En BUILD, cada decisión nueva se escribe en `docs/decisions/ADR-NNN-titulo.md` con: contexto, opciones, decisión, consecuencias.
- Un pendiente `P-…` solo lo cierra el usuario o quien él designe.

### 6.3 Nota de traspaso

Al terminar una tarea, deja una nota con: qué hiciste, archivos tocados, pruebas ejecutadas con su salida, supuestos **[diseño]** introducidos, y qué queda abierto.

### 6.4 Si dos agentes chocan

Manda, por este orden: las reglas de §3, los contratos, el documento del área, el propietario del directorio. Si sigue sin resolverse, se detiene el trabajo y decide el usuario.

---

## 7. Flujo de trabajo por tarea

El usuario trabaja con el flujo de superpowers. Para cada tarea de BUILD:

1. **Entender**: leer el documento del área y la tarea de ROADMAP; preguntar lo que no esté decidido.
2. **Planificar**: plan corto de la tarea con sus pruebas.
3. **Pruebas primero**: escribir la prueba y verla fallar.
4. **Implementar** lo mínimo para que pase.
5. **Verificar**: `npm test` y `npm run typecheck`, con la salida real.
6. **Revisar**: contra los invariantes de tu área y la definición de terminado.
7. **Documentar** y dejar nota de traspaso.

---

## 8. Órdenes útiles

Desde `Nasa-Space-App-challange-2026/`:

| Orden | Para qué |
| --- | --- |
| `npm install` | Instalar dependencias. **En la máquina del usuario**, no desde un entorno Linux sobre su carpeta |
| `npm test` | Pruebas (Vitest) |
| `npm run typecheck` | Tipos (`tsc --noEmit`) |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run data:fetch` | Guardar instantáneas de datos de NASA en `public/data/nasa/` |
| `npm run lint` | Lint |

Desde `metricas de vida/huella_datos/` (solo biblioteca estándar de Python):

| Orden | Para qué |
| --- | --- |
| `python3 generar_caminata_sintetica.py --lista` | Ver escenarios |
| `python3 generar_caminata_sintetica.py --escenario fuga_traje` | Regenerar un escenario (semilla 42) |
| `python3 motor_reglas.py caminata_nominal_huella.csv --setpoint-psi 4.3` | Ejecutar el motor de referencia |

---

## 9. Trampas conocidas

Encontradas durante la auditoría. Te ahorran horas.

| Trampa | Qué hacer |
| --- | --- |
| El repositorio principal no tiene `node_modules` | Instalar antes de nada, en la máquina del usuario |
| Hay 5 archivos modificados y 25 entradas sin seguimiento sin confirmar en git | No crear rama ni cambiar de rama hasta que el usuario lo confirme (H0-2) |
| `public/data/nasa/` solo contiene un léame | Las capas que dependen de MOLA no funcionan sin `npm run data:fetch` |
| Dos copias distintas de `motor_reglas.py` y del generador en `metricas de vida/` | La referencia es `huella_datos/` (P-12) |
| Ya existe `docs/DATA_SOURCES.md` en el repositorio principal | No sobrescribirlo al mover esta documentación (P-01) |
| MOLA a 4 px/grado no resuelve pendientes a escala humana | Ruta a pie solo con elevación de 1–2 m |
| Las teselas WMTS son imágenes, no datos | Para el costo, usar GeoTIFF o PDS |
| La Mars Rover Photos API está archivada | Usar el feed de imágenes crudas |
| El segundo cuaderno de la auditoría muestra registros y una gráfica de ejemplo cuando falla la consulta a ESA | No son datos reales. No copiar ese patrón: si una fuente falla, se dice |
| Identificadores y extensiones de teselas de Mars Trek que parecen correctos devuelven 404 | Comprobar cada capa en su `WMTSCapabilities.xml` antes de usarla; la extensión figura en su elemento `ResourceURL` |
| `drei <Html>` dentro de escenas 3D provocó errores con React 19 | Etiquetas como texturas de lienzo |
| Leaflet usa `CRS.EPSG4326` | Es solo el esquema de teselas; toda medida va con radio marciano |
| Límite de pendiente distinto en cada sitio (25°, 20°) | Mars Trek usa 20° a pie (P-04) |
| Dos modelos metabólicos y dos velocidades en llano | Ver RESOURCE_MANAGEMENT §1 (P-05) |
| "Mars Trek" es también el portal de NASA | En textos, distinguir el producto del portal (P-20) |
| El proyecto se sincroniza con Lovable | No forzar envíos ni reescribir historia |

---

## 10. Glosario

| Término | Significado |
| --- | --- |
| Costmap | Mapa en capas con las magnitudes que determinan el costo y la admisibilidad de moverse |
| Envolvente de seguridad | Conjunto compuesto de restricciones duras que el motor de rutas debe respetar |
| Directiva de navegación | Lo único que el módulo de salud comunica a la navegación |
| HUELLA | Motor de reglas biomédicas del equipo |
| K1…K5 | Clases de conocimiento del terreno, de recorrido a desconocido |
| Z0…Z5 | Clases de zona, de transitable a prohibida |
| S1…S5 | Estados de salud: NORMAL, FATIGUE, CAUTION, CRITICAL, EMERGENCY |
| D, T, R, E, U, H | Términos del costo: distancia, topografía, riesgo, energía, incertidumbre, salud |
| INV-… | Invariante que el sistema debe cumplir siempre |
| D-… / P-… | Decisión propuesta / pendiente |
| T-… / PT-… | Escenario de aceptación / prueba de propiedad |
| H0…H8 | Hitos de la hoja de ruta |
| [diseño] | Parámetro elegido por el equipo, sin dato público que lo respalde |
| Margen de regreso | Minutos del consumible limitante que sobran tras volver por la ruta segura con la reserva |
| Sol, Ls | Día marciano; longitud solar (estación) |
