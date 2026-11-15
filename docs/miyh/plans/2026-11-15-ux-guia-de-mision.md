# UX · Guía de misión y nuevo recorrido (2026-11-15)

Alcance: **solo interfaz, transiciones y textos**. No se tocó `src/core`, `src/services` ni `src/state`.

## Hecho
- **Orden nuevo de vistas** (`DECK_TAB_IDS`): Inicio → 1 Planea tu caminata → 2 Caminata simulada → **3 Exploración (nueva)** → 4 Historia de los rovers → 5 Cómo lo hicimos → Fuentes.
- **Exploración** (`marswalk/explorationTab.tsx`, `exploration.css`): compuerta de la nave que se abre con animación (luz + hojas que se separan), después carga el simulador Unity dentro de la vista; botón «Terminar exploración» → historia de los rovers. Respeta `prefers-reduced-motion`. El iframe solo se monta al abrir la compuerta y se descarga al salir.
- **Quitado**: «Abrir ficha completa» (carrusel) y todos los botones «Simulador topográfico» (Inicio, Misiones, Proyecto, tarjeta de Recursos). Unity solo se abre desde Exploración.
- **Guía de misión** (`marswalk/missionGuide.tsx`, `guide.css`):
  - Bienvenida en la primera visita (localStorage `miyh.guide.v1`) que ofrece el recorrido.
  - Recorrido guiado de 15 pasos con foco sobre cada control (barra de pasos, etapas, flechas, «Comenzar la misión», «Tu misión», mapa, «Empezar caminata», Ayuda, velocidad, signos vitales, compuerta, carrusel, cómo lo hicimos). Teclas ← → y Esc.
  - Barra superior «Paso X de 5 · …» con botón al siguiente paso y botón «Guía»; late cuando la caminata simulada termina («Salir a explorar»).
- **Textos puente**: carrusel «La historia de los rovers» con instrucción de arrastrar y botón «¿Quieres ver cómo lo hicimos? ↓»; Proyecto con eyebrow «¿Quieres ver cómo lo hicimos?»; Inicio «Desliza ↓ para empezar».
- **Nombres obvios**: «Comenzar la misión», «Recalcular la ruta», «Empezar de nuevo», «Ver su terreno en 3D», «Ver las fuentes y los datos», etapas del rail «Paso N · …».
- Verificado en Chrome (ES/EN): bienvenida, recorrido, compuerta + Unity, terminar exploración, rovers, cómo lo hicimos. 299 pruebas, `tsc` y ESLint limpios.

## Pendiente / ideas
- Probar el recorrido guiado en pantallas ≤ 860 px (la barra de pasos baja al pie).
- Opcional: animación de cierre de compuerta de vuelta al pasar a los rovers (hoy se cierra en 0.9 s y cambia de vista).
- Opcional: voz para la guía (ya existe audio en las cinemáticas).
