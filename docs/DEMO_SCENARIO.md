# DEMO_SCENARIO — Flujo de Demostración de Mars Trek (`/trek` y `/martian-map`)

> **Proyecto:** MARS // SURVIVE — Mars Trek · Navegador EVA Multicapa A\*  
> **Rutas activas:** `/trek` y `/martian-map`  
> **Ejecución rápida:** `npm install && npm run dev` → abrir `http://localhost:8080/trek` o `http://localhost:8080/martian-map`

---

## 1. Propósito de la demostración

Demostrar en menos de 3 minutos que el navegador de rutas en Marte **no calcula simplemente la distancia más corta**, sino la **ruta más conveniente y segura** sujeta a una **Envolvente de Seguridad (`SafetyEnvelope`)** donde **la seguridad domina sobre la distancia mínima** y la ruta cambia dinámicamente cuando varían:

1. **El estado fisiológico del astronauta** (`NORMAL → FATIGUE → CAUTION → CRITICAL → EMERGENCY`, motor HUELLA + FSM, independiente del terreno).
2. **Las condiciones del terreno y del entorno** (pendiente topográfica a 1 m en el Cráter Gale, rugosidad, suelo blando, tormentas de polvo activas `Z5` y alertas solares `SEP`).
3. **La confianza científica del dato** (`K1` recorrido por Curiosity > `K2` fotogrametría estéreo > `K3a` DTM orbital > `K5` sin dato / `NaN`).
4. **Los recursos y el margen de regreso (*walkback*)** ($\text{O}_2$ primario/secundario, $\text{CO}_2$, agua LCVG y batería del traje).

---

## 2. Paso a paso en `/trek` o `/martian-map`

### Paso 1 · Inspección del terreno real de Gale (`Murray Buttes`, `1 m/nodo`)
1. Abre `/trek` o `/martian-map`. Por defecto se carga **Murray Buttes** (reconstrucción fotogramétrica estéreo `TYPE_TILE` de Curiosity a `1 m`, rejilla `129×129`, cobertura `100 %`, etiqueta `REAL`).
2. Mueve el cursor sobre el mapa 2D interactivo para verificar en el HUD inferior:
   - **Coordenadas planetocéntricas (`IAU_2015:49900`):** latitud sur, longitud este sobre la esfera marciana ($R = 3\,396\,190\text{ m}$).
   - **Coordenadas métricas locales:** $X, Z$ en metros respecto al centro de la escena.
   - **Elevación, pendiente local, clase de zona (`Z0–Z5`) y confianza científica (`K1–K5`).**
3. En el panel izquierdo (**Capas Científicas y Costmap**), alterna entre:
   - `L01 · Elevación + Sombreado (m)` (`REAL`)
   - `L02 · Pendiente Topográfica (°)` (`DERIVED`)
   - `L15 · Clasificación de Zonas (Z0–Z5)` (`DERIVED`)
   - `L12 · Confianza Científica (K1–K5)` (`DERIVED`)
   - `L06 · Polvo / Opacidad τ` (`MODELLED`)
   - `L08 · Dosis Ambiental (mSv/sol)` (`MODELLED`)
   - Despliega **Capas Desacopladas (`no_disponible`)** para mostrar por qué los productos regionales o WMTS RGB (MOLA/HRSC 200 m, THEMIS TI RGB, CRISM/OMEGA sin ráster PDS local) se declaran explícitamente como `no_disponible` para cálculo numérico a escala EVA en lugar de inventar mediciones.

### Paso 2 · Selección de Origen/Destino y Barra de Porqués (`D, T, R, E, U, H`)
1. En la barra superior del mapa, pulsa **Fijar Origen** o **Fijar Destino** y haz clic en cualquier punto del mapa (o pulsa `Escape` para volver a **Inspeccionar Celda**).
2. En el panel derecho (**Ruta Activa y Envolvente**), revisa:
   - Distancia 3D, duración con margen SEXTANT (`+25 %`), pendiente máxima frente al límite de la envolvente (`20°`), consumo de $\text{O}_2$ y dosis en $\mu\text{Sv}$.
   - **Barra de Porqués (`Σ = 100 %`):** contribución exacta en metros equivalentes (`m-eq`) y porcentaje de los 6 términos (`D` distancia, `T` topografía, `R` riesgo ambiental, `E` recursos, `U` incertidumbre, `H` exigencia fisiológica).
   - **Por Qué No la Línea Directa:** lista las violaciones de pendiente o zona `Z5` que impiden ir en línea recta.

### Paso 3 · Escenario `T-06` · Fatiga y Cambio de Corredor (`17° → 9° → Refugio`)
1. En la consola inferior, pulsa **`▶ T-06 (Fatiga A→B)`** o selecciona el sitio **`Banco de Pruebas T-06 · Dos Corredores (Simulado)`** y el perfil **`Más Rápido`**.
   - **En `NORMAL` (límite `20°`):** Tanto el **Corredor Directo A** (paso corto de `17°`) como el **Corredor Norte B** (pendiente $\le 9^\circ$) son admisibles. A\* elige **A** por menor costo equivalente y muestra **B** como alternativa admisible.
2. Pulsa **`+ Fatiga (15°)`** (o el botón del escenario `T-06`):
   - El estado cambia a **`◐ FATIGUE`**, el límite duro de pendiente de la directiva baja de `20°` a **`15°`** y los multiplicadores suben (`t×2`, `e×1.5`, `h×3`).
   - El paso de `17°` del Corredor A queda **eliminado del grafo (máscara dura)**; el navegador recalcula automáticamente por el **Corredor B ($\le 9^\circ$)** y registra al Corredor A como **`DESCARTADA`** explicando: *`Pendiente máxima 17.0° supera el límite 15.0° impuesto por salud (FATIGUE)`*.
3. Pulsa **`+ Falla Ventilador (CRITICAL)`**:
   - El estado sube a **`◆ CRITICAL`**, se activa el enclavamiento `return-mode` y la directiva cambia `goalPolicy` a **`nearest-shelter`**.
   - El navegador suspende el destino ordinario y traza de inmediato la ruta hacia el **Refugio Hábitat**.

### Paso 4 · Confirmación Humana Auditada (Enclavamiento `CRITICAL` / `EMERGENCY`)
1. Mientras el astronauta está en `CRITICAL` o `EMERGENCY`, observa que el estado permanece **enclavado** (no vuelve solo a `NORMAL` aunque cesen los incidentes).
2. En el panel izquierdo aparece el **Candado de Seguridad (Confirmación Humana Requerida)**:
   - Ingresa el rol autorizador (p. ej. `HAB-IV1`) y la justificación técnica (p. ej. `Ventilador secundario estable en refugio`).
   - Al confirmar, el estado desescala **un solo nivel** (`CRITICAL → CAUTION`) y registra la firma y justificación en la bitácora histórica.

### Paso 5 · Escenarios `T-03 / T-04` (Tormenta `Z5` + Alerta `SEP`) y `T-11` (Triple Contingencia)
1. En cualquier escena real de Gale (p. ej. **Murray Buttes**), selecciona **Inyectar Tormenta Z5** en la barra del mapa y haz clic sobre un tramo de la ruta activa (o pulsa **`▶ T-03 / T-04 (Tormenta+SEP)`**):
   - El polígono de tormenta entra como máscara `Z5` (trama cruzada rosa), invalida la ruta previa y A\* traza un rodeo seguro sin cruzar la tormenta.
2. Pulsa **`▶ T-11 (Triple Contingencia)`**:
   - Aplica simultáneamente tormenta `Z5` + fatiga + caída de batería del `35 %` en un único ciclo determinista, registrando las tres causas en una sola replanificación.
