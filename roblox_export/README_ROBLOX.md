# PROJECT ARES — MARS MISSION ATLAS
## Guía de Importación en Roblox Studio (Entornos 3D y Física Planetaria)

Esta carpeta contiene todos los modelos 3D y scripts listos para construir el simulador de Marte en **Roblox Studio**.

---

### 1. Archivos Disponibles en esta Carpeta

#### A. Modelos 3D de Terreno (Wavefront `.obj`)
Listos para importar en Roblox Studio como `MeshPart`:
1. `perseverance_jezero.obj` — Escarpe deltaico y piso del cráter Jezero.
2. `curiosity_gale_boxwork.obj` — Estratigrafía de Aeolis Mons y red de fracturas boxwork.
3. `opportunity_meridiani.obj` — Cuenco del cráter Eagle y borde de Endeavour.
4. `spirit_gusev_homeplate.obj` — Meseta hidrovolcánica Home Plate en Gusev.
5. `ingenuity_airfield.obj` — Campo de dunas Valinor Hills y zona de despegue.
6. `zhurong_utopia.obj` — Llanura de Utopia Planitia con corteza eólica.
7. `sojourner_ares_vallis.obj` — Llanura aluvial de megainundación y colinas Twin Peaks.
8. `viking1_chryse.obj` — Campo de bloques basálticos y dunas de deriva en Chryse.
9. `viking2_utopia.obj` — Llanura con surcos de contracción poligonal.
10. `phoenix_green_valley.obj` — Terreno ártico poligonal con montículos periglaciares.
11. `insight_homestead_hollow.obj` — Depresión de impacto degradada en Elysium.

#### B. Scripts de Servidor (Luau)
1. `MarsEnvironmentInit.lua` — Ajusta la gravedad marciana real a **74.35 studs/s²** (38% de la gravedad terrestre), iluminación atmosférica ocre/rojiza y densidad de partículas en `Lighting`.
2. `OpportunityStormLandmark.lua` — Genera el rover Opportunity atrapado en Perseverance Valley, duna de enterramiento, partículas volumétricas de tormenta de polvo y `ProximityPrompt` interactivo al acercarse.

---

### 2. Pasos para Importar en Roblox Studio

1. **Abrir Roblox Studio** y crear un lugar nuevo (`Baseplate`).
2. **Configurar Física y Atmósfera**:
   - En el explorador, ve a `ServerScriptService`.
   - Crea un `Script` y copia el contenido de `MarsEnvironmentInit.lua`.
   - Al pulsar *Play*, la gravedad se ajustará automáticamente a la gravedad de Marte (0.379 g) y el cielo adoptará la colorimetría de polvo marciano.
3. **Importar Terrenos 3D**:
   - En el menú superior de Roblox Studio, ve a **View > Asset Manager** (o pulsa `Shift + F10`).
   - Haz clic en **Bulk Import** (icono de carpeta con flecha) y selecciona los archivos `.obj` de esta carpeta.
   - Arrastra cualquiera de las mallas importadas al `Workspace`. Se creará un `MeshPart`.
   - En la ventana de *Properties* del `MeshPart`, activa `Anchored = true` y ajusta el material a `Sandstone`, `Slate` o `Basalt` con color `#9C5234`.
4. **Instanciar el Landmark de Opportunity (Tormenta de Polvo 2018)**:
   - En `ServerScriptService`, crea un segundo `Script` y pega el código de `OpportunityStormLandmark.lua`.
   - Al ejecutar el juego, el rover Opportunity aparecerá semienterrado con sus paneles solares cubiertos de polvo, vórtice de partículas en suspensión y una baliza roja que abre la ficha de la misión al acercarse y presionar la tecla `E`.
