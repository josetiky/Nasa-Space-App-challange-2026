/**
 * M.I.Y.H. · 05 Referencias y recursos (material de apoyo, no es parte principal de la experiencia).
 *
 * Reúne en un solo lugar las herramientas técnicas que ya existían como páginas aparte
 * (Explorer 3D, Survival Atlas, Atlas de misiones, Hazard Layers, Mars Trek, Datos NASA, Decisiones)
 * y las fuentes usadas. Cada herramienta se abre en una VENTANA FLOTANTE dentro de la cubierta
 * (iframe de la misma ruta; el AppShell se oculta solo cuando está embebido). Solo vista.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { MARS_MAPS } from "@/data/marsMaps";
import type { TrekLang } from "../i18n";
import { ensureReadableFonts } from "./landing/fonts";
import "./resources.css";

type ToolId =
  "topo" | "explorer" | "atlas" | "missions" | "hazards" | "trek" | "data" | "decisions";

/** Simulador topográfico de Marte del equipo (Unity WebGL), publicado aparte en Netlify. */
export const TOPO_SIM_URL = "https://harmonious-heliotrope-ea417f.netlify.app/";

export interface Tool {
  readonly id: ToolId;
  readonly href: string;
  /** Sitio externo (otro origen): se le conceden pantalla completa y audio en el iframe. */
  readonly external?: boolean;
  readonly title: string;
  readonly kind: Readonly<Record<TrekLang, string>>;
  readonly what: Readonly<Record<TrekLang, string>>;
  readonly icon: ReactNode;
}

const ICONS: Readonly<Record<ToolId, ReactNode>> = {
  topo: (
    <>
      <path d="M5 38 17 18l8 11 6-8 12 17Z" />
      <path d="M12 38c4-3 8-3 12 0s8 3 12 0M17 18v-7M17 11h6l-2 2.5 2 2.5h-6" />
    </>
  ),
  explorer: (
    <>
      <circle cx="24" cy="24" r="15" />
      <path d="M9 24h30M24 9c5 4.5 5 25.5 0 30M24 9c-5 4.5-5 25.5 0 30" />
    </>
  ),
  atlas: (
    <>
      <path d="M24 8 40 16 24 24 8 16Z" />
      <path d="m8 24 16 8 16-8M8 32l16 8 16-8" />
    </>
  ),
  missions: (
    <>
      <circle cx="24" cy="24" r="5" />
      <ellipse cx="24" cy="24" rx="17" ry="8" transform="rotate(-20 24 24)" />
      <circle cx="39" cy="18" r="2.2" />
    </>
  ),
  hazards: (
    <>
      <path d="M24 8 41 38H7Z" />
      <path d="M24 19v9M24 33v.5" />
    </>
  ),
  trek: (
    <>
      <path d="M8 38c6-2 7-10 13-12s9 4 14-1 4-11 5-15" />
      <circle cx="8" cy="38" r="2.5" />
      <path d="M38 6v8M38 6h7l-2.5 3 2.5 3h-7" />
    </>
  ),
  data: (
    <>
      <ellipse cx="24" cy="12" rx="13" ry="5" />
      <path d="M11 12v24c0 2.8 5.8 5 13 5s13-2.2 13-5V12M11 24c0 2.8 5.8 5 13 5s13-2.2 13-5" />
    </>
  ),
  decisions: (
    <>
      <circle cx="10" cy="24" r="4" />
      <circle cx="38" cy="12" r="4" />
      <circle cx="38" cy="36" r="4" />
      <path d="M14 24h8l12-10M22 24l12 10" />
    </>
  ),
};

const MAP_IDS: Readonly<Record<string, ToolId>> = {
  "/explorer": "explorer",
  "/atlas": "atlas",
  "/mission-lab": "missions",
  "/hazard-layers": "hazards",
  "/trek": "trek",
};

const KIND_MAP = { es: "Mapa técnico", en: "Technical map" } as const;

export const TOPO_SIM_TOOL: Tool = {
  id: "topo",
  href: TOPO_SIM_URL,
  external: true,
  title: "Mars Topographic EVA · Unity",
  kind: { es: "Simulador 3D · Unity WebGL", en: "3D simulator · Unity WebGL" },
  what: {
    es: "Nuestro simulador topográfico de Marte: recorre el relieve en 3D y siente el terreno de una caminata EVA.",
    en: "Our Mars topographic simulator: move across the relief in 3D and get a feel for the terrain of an EVA walk.",
  },
  icon: ICONS.topo,
};

// El simulador 3D (Unity) ya no es un botón suelto: se abre en la vista «Exploración».
const TOOLS: readonly Tool[] = [
  ...MARS_MAPS.map((m): Tool => {
    const id = MAP_IDS[m.to] ?? "explorer";
    return {
      id,
      href: m.search ? `${m.to}?ui=${m.search.ui}` : m.to,
      title: m.label,
      kind: KIND_MAP,
      what: { es: m.es, en: m.en },
      icon: ICONS[id],
    };
  }),
  {
    id: "data",
    href: "/nasa-data",
    title: "NASA Data Center",
    kind: { es: "Fuentes de datos", en: "Data sources" },
    what: {
      es: "Cada fuente de la NASA que usa la plataforma: estado en vivo, formato, términos y límites.",
      en: "Every NASA source the platform uses: live status, format, terms and limitations.",
    },
    icon: ICONS.data,
  },
  {
    id: "decisions",
    href: "/decisions",
    title: "Decision engine",
    kind: { es: "Cómo decide", en: "How it decides" },
    what: {
      es: "El motor de decisiones explicable: reglas, simulación de escenarios y análisis multicriterio.",
      en: "The explainable decision engine: rules, scenario look-ahead and multi-criteria analysis.",
    },
    icon: ICONS.decisions,
  },
];

interface Ref {
  readonly name: string;
  readonly use: Readonly<Record<TrekLang, string>>;
  readonly url: string;
}

interface RefGroup {
  readonly id: string;
  readonly title: Readonly<Record<TrekLang, string>>;
  readonly refs: readonly Ref[];
}

/**
 * Todo lo que usa M.I.Y.H., agrupado por para qué sirve. Refleja docs/DATA_SOURCES.md y
 * src/data/sources.ts; cada entrada dice qué se tomó y dónde se usa dentro del sitio.
 */
const REF_GROUPS: readonly RefGroup[] = [
  {
    id: "nasa",
    title: { es: "Datos de la NASA", en: "NASA data" },
    refs: [
      {
        name: "MOLA MEGDR · Mars Global Surveyor (PDS Geosciences)",
        use: {
          es: "Altimetría láser global de Marte (4 px/grado). De aquí salen la elevación, la pendiente regional y las capas de peligro del Atlas, además del relieve del globo 3D.",
          en: "Global laser altimetry of Mars (4 px/degree). It feeds elevation, regional slope and the Atlas hazard layers, plus the relief of the 3D globe.",
        },
        url: "https://pds-geosciences.wustl.edu/missions/mgs/megdr.html",
      },
      {
        name: "NASA Mars Trek · Solar System Treks (JPL)",
        use: {
          es: "Teselas WMTS del mosaico en color Viking MDIM 2.1 y del relieve sombreado MOLA: son los mapas base del Atlas y la textura del globo.",
          en: "WMTS tiles of the Viking MDIM 2.1 colour mosaic and the MOLA shaded relief: the Atlas basemaps and the globe texture.",
        },
        url: "https://trek.nasa.gov/mars/",
      },
      {
        name: "HiRISE · Mars Reconnaissance Orbiter (vía Mars Trek)",
        use: {
          es: "Mosaico de la zona que recorre Curiosity, hasta ≈0.64 m por píxel. Es el mapa base de la caminata por las crestas boxwork del monte Sharp.",
          en: "Mosaic of Curiosity's roving site, down to ≈0.64 m per pixel. It is the basemap of the walk across the Mount Sharp boxwork ridges.",
        },
        url: "https://www.uahirise.org/",
      },
      {
        name: "Recorridos y waypoints de rovers · MMGIS (JPL)",
        use: {
          es: "Trayectos reales de Curiosity y Perseverance, con sol, latitud, longitud y elevación. Dan las rutas de exploración del Atlas y las paradas científicas de la caminata boxwork (soles 4530–4711).",
          en: "Real Curiosity and Perseverance traverses, with sol, latitude, longitude and elevation. They give the Atlas exploration routes and the science stops of the boxwork walk (sols 4530–4711).",
        },
        url: "https://mars.nasa.gov/maps/location/?mission=M20",
      },
      {
        name: "MSL REMS · clima diario de Curiosity (NASA/JPL-Caltech/CAB)",
        use: {
          es: "Presión y temperatura medidas en el cráter Gale. Alimentan el panel de entorno de Marte y sirven de referencia para calibrar los modelos de presión y temperatura.",
          en: "Pressure and temperature measured at Gale crater. They feed the Mars environment panel and anchor the pressure and temperature models.",
        },
        url: "https://mars.nasa.gov/msl/weather/",
      },
      {
        name: "MSL REMS · archivo PDS Atmospheres",
        use: {
          es: "Archivo científico del mismo instrumento, usado para revisar los valores del feed diario.",
          en: "Science archive of the same instrument, used to cross-check the daily feed values.",
        },
        url: "https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/",
      },
      {
        name: "DONKI · eventos de partículas solares (NASA CCMC)",
        use: {
          es: "Registro de eventos SEP. Da el contexto de clima espacial del planificador (el aviso “DONKI” de la barra de misión). Se observan cerca de la Tierra, así que se usan como estadística, no como pronóstico para Marte.",
          en: "Record of SEP events. It gives the planner its space-weather context (the “DONKI” note in the mission bar). They are observed near Earth, so they are used as statistics, not as a forecast for Mars.",
        },
        url: "https://ccmc.gsfc.nasa.gov/tools/DONKI/",
      },
      {
        name: "MSL Analyst's Notebook (PDS Geosciences)",
        use: {
          es: "Recorrido y sitios de Curiosity sol a sol, para ubicar las zonas de trabajo en Gale.",
          en: "Curiosity's sol-by-sol traverse and sites, used to place the work areas in Gale.",
        },
        url: "https://an.rsl.wustl.edu/",
      },
      {
        name: "Blog de misión de Curiosity y Photojournal (NASA)",
        use: {
          es: "Qué hizo el rover en cada parada: de ahí salen los textos de las 8 paradas científicas, cada una con su enlace a la fuente.",
          en: "What the rover did at each stop: the source of the texts for the 8 science stops, each with its own link.",
        },
        url: "https://science.nasa.gov/mission/msl-curiosity/",
      },
      {
        name: "NASA Image and Video Library",
        use: {
          es: "Imágenes de los sitios de misión, buscadas por palabra clave.",
          en: "Imagery of the mission sites, found by keyword search.",
        },
        url: "https://images.nasa.gov/",
      },
    ],
  },
  {
    id: "terrain",
    title: { es: "Terreno 3D", en: "3D terrain" },
    refs: [
      {
        name: "Access Mars · NASA JPL & Google Creative Lab (Apache-2.0)",
        use: {
          es: "Mallas 3D reales de cuatro sitios del cráter Gale, reconstruidas con las cámaras de Curiosity, con sus texturas y sonidos. Sobre estas mallas traza la ruta el planificador MarsWalk.",
          en: "Real 3D meshes of four Gale crater sites, reconstructed from Curiosity's cameras, with their textures and sounds. MarsWalk plans its routes on these meshes.",
        },
        url: "https://github.com/googlecreativelab/access-mars",
      },
      {
        name: "Mars Topographic EVA · Space Rockstars (Unity WebGL)",
        use: {
          es: "Nuestro simulador topográfico de Marte, hecho en Unity y publicado como WebGL. Se abre en la vista «Exploración», después de la caminata simulada.",
          en: "Our Mars topographic simulator, built in Unity and published as WebGL. It opens in the “Exploration” view, right after the simulated walk.",
        },
        url: TOPO_SIM_URL,
      },
    ],
  },
  {
    id: "health",
    title: { es: "Salud y traje", en: "Crew health and suit" },
    refs: [
      {
        name: "NASA-STD-3001 Vol. 2 · Spacesuits",
        use: {
          es: "Estándar de la NASA para sistemas tripulados. De aquí salen los límites del traje y de salud que vigila la máquina de estados (NORMAL → FATIGUE → CAUTION → CRITICAL → EMERGENCY).",
          en: "NASA's standard for crewed systems. It sets the suit and health limits watched by the state machine (NORMAL → FATIGUE → CAUTION → CRITICAL → EMERGENCY).",
        },
        url: "https://www.nasa.gov/reference/11-0-spacesuits-vol-2/",
      },
      {
        name: "NASA SUITS · Telemetry Stream Server",
        use: {
          es: "Formato de la telemetría del traje. La telemetría HUELLA del sitio es simulada y sigue esta misma estructura; no son datos reales de un astronauta.",
          en: "Suit telemetry format. The site's HUELLA telemetry is simulated and follows this structure; it is not real astronaut data.",
        },
        url: "https://github.com/SUITS-Techteam/TSS_2024",
      },
    ],
  },
  {
    id: "software",
    title: { es: "Software", en: "Software" },
    refs: [
      {
        name: "React 19 · TanStack Start · Vite · TypeScript",
        use: {
          es: "Base de la aplicación web: interfaz, rutas, compilación y tipos.",
          en: "Foundation of the web app: interface, routing, build and types.",
        },
        url: "https://tanstack.com/start",
      },
      {
        name: "three.js · React Three Fiber · Draco",
        use: {
          es: "Motor 3D del globo de Marte, los terrenos de cada misión y la secuencia de aterrizaje; Draco descomprime las mallas de Gale.",
          en: "3D engine for the Mars globe, each mission's terrain and the landing sequence; Draco decompresses the Gale meshes.",
        },
        url: "https://threejs.org/",
      },
      {
        name: "Unity (WebGL)",
        use: {
          es: "Motor del simulador topográfico Mars Topographic EVA.",
          en: "Engine of the Mars Topographic EVA simulator.",
        },
        url: "https://unity.com/",
      },
      {
        name: "Leaflet",
        use: {
          es: "Mapas 2D por teselas del Atlas y de las capas de peligro.",
          en: "Tiled 2D maps for the Atlas and the hazard layers.",
        },
        url: "https://leafletjs.com/",
      },
      {
        name: "Planificador A* y motor HUELLA · código propio",
        use: {
          es: "El planificador de rutas, la envolvente de seguridad y la máquina de estados de salud los escribió el equipo y tienen pruebas automáticas (Vitest).",
          en: "The route planner, the safety envelope and the health state machine were written by the team and are covered by automated tests (Vitest).",
        },
        url: "https://vitest.dev/",
      },
      {
        name: "Netlify",
        use: {
          es: "Publicación del sitio y de las rutas de servidor que consultan a la NASA.",
          en: "Hosting for the site and for the server routes that query NASA.",
        },
        url: "https://www.netlify.com/",
      },
    ],
  },
  {
    id: "media",
    title: { es: "Imágenes, texturas y tipografía", en: "Images, textures and type" },
    refs: [
      {
        name: "Fotos de misiones · Wikimedia Commons",
        use: {
          es: "Fotos reales de cada misión: NASA/JPL-Caltech, MSSS, Cornell, Univ. of Arizona, ASU, CNSA/PEC (CC BY 4.0) y The Mars Society (CC BY-SA 4.0). El crédito aparece en cada ficha.",
          en: "Real photos of each mission: NASA/JPL-Caltech, MSSS, Cornell, Univ. of Arizona, ASU, CNSA/PEC (CC BY 4.0) and The Mars Society (CC BY-SA 4.0). Each profile shows its credit.",
        },
        url: "https://commons.wikimedia.org/",
      },
      {
        name: "Solar System Scope (CC BY 4.0)",
        use: {
          es: "Texturas de Marte y de la Vía Láctea del globo de inicio.",
          en: "Mars and Milky Way textures for the home globe.",
        },
        url: "https://www.solarsystemscope.com/textures/",
      },
      {
        name: "Syncopate · Inter · JetBrains Mono (OFL)",
        use: {
          es: "Tipografías de títulos, texto y datos.",
          en: "Typefaces for titles, text and data.",
        },
        url: "https://fonts.google.com/",
      },
      {
        name: "Atkinson Hyperlegible · Braille Institute (OFL)",
        use: {
          es: "Tipografía de lectura de esta sección y del aterrizaje, diseñada para leerse con baja visión.",
          en: "Reading typeface for this section and the landing, designed for low-vision legibility.",
        },
        url: "https://www.brailleinstitute.org/freefont/",
      },
    ],
  },
];

const REF_COUNT = REF_GROUPS.reduce((n, g) => n + g.refs.length, 0);

const T = {
  es: {
    eyebrow: "Referencias y recursos",
    title1: "Cómo funciona",
    title2: "por dentro",
    notice: "Material de apoyo",
    noticeText:
      "Esta sección no es parte principal de la experiencia. Aquí están las herramientas técnicas, los datos y las fuentes con las que construimos M.I.Y.H., por si quieres ver el detalle.",
    tools: "Herramientas técnicas",
    toolsHint: "Cada una se abre en una ventana flotante, sin salir de aquí.",
    open: "Abrir",
    refs: "Fuentes y créditos",
    refsHint: "Qué usamos y para qué.",
    realNote:
      "Los datos de terreno, clima y misiones son reales de la NASA. La telemetría del traje, las tormentas y las fallas son simuladas y así se etiquetan. Prototipo educativo, no respaldado por la NASA.",
    window: "Ventana externa",
    support: "Material de apoyo",
    newTab: "Abrir en pestaña nueva",
    close: "Cerrar",
    loading: "Cargando…",
  },
  en: {
    eyebrow: "References & resources",
    title1: "How it works",
    title2: "under the hood",
    notice: "Supporting material",
    noticeText:
      "This section is not a main part of the experience. Here are the technical tools, data and sources we used to build M.I.Y.H., in case you want the details.",
    tools: "Technical tools",
    toolsHint: "Each one opens in a floating window, without leaving this page.",
    open: "Open",
    refs: "Sources & credits",
    refsHint: "What we used and what for.",
    realNote:
      "Terrain, weather and mission data are real NASA data. Suit telemetry, storms and failures are simulated and labelled as such. Educational prototype, not endorsed by NASA.",
    window: "External window",
    support: "Supporting material",
    newTab: "Open in new tab",
    close: "Close",
    loading: "Loading…",
  },
} as const;

export function ToolWindow({
  tool,
  lang,
  onClose,
}: {
  tool: Tool;
  lang: TrekLang;
  onClose: () => void;
}) {
  const t = T[lang];
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div className="resw" role="dialog" aria-modal="true" aria-labelledby="resw-title">
      <button
        type="button"
        className="resw__backdrop"
        aria-label={t.close}
        tabIndex={-1}
        onClick={onClose}
      />
      <section className="resw__win">
        <header className="resw__bar">
          <span className="resw__icon" aria-hidden="true">
            <svg viewBox="0 0 48 48">{tool.icon}</svg>
          </span>
          <div className="resw__titles">
            <span className="resw__kicker">
              {tool.external ? (
                <b>{tool.kind[lang]}</b>
              ) : (
                <>
                  {t.window} · <b>{t.support}</b>
                </>
              )}
            </span>
            <h2 id="resw-title" className="resw__title">
              {tool.title}
            </h2>
          </div>
          <a className="resw__btn" href={tool.href} target="_blank" rel="noreferrer">
            {t.newTab}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9" />
            </svg>
          </a>
          <button
            ref={closeRef}
            type="button"
            className="resw__close"
            onClick={onClose}
            aria-label={t.close}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div className="resw__body">
          {loaded ? null : (
            <p className="resw__loading" role="status">
              <span aria-hidden="true" />
              {t.loading}
            </p>
          )}
          <iframe
            title={tool.title}
            src={tool.href}
            onLoad={() => setLoaded(true)}
            data-loaded={loaded ? "true" : undefined}
            {...(tool.external
              ? {
                  allow: "fullscreen; autoplay; gamepad; xr-spatial-tracking",
                  allowFullScreen: true,
                }
              : {})}
          />
        </div>
      </section>
    </div>
  );
}

export function ResourcesTab({
  lang,
  onWindowChange,
}: {
  lang: TrekLang;
  /** Avisa a la cubierta para pausar la navegación con rueda/teclado mientras hay ventana abierta. */
  onWindowChange: (open: boolean) => void;
}) {
  const t = T[lang];
  const [open, setOpen] = useState<Tool | null>(null);
  useEffect(() => ensureReadableFonts(), []);
  useEffect(() => onWindowChange(open !== null), [open, onWindowChange]);

  return (
    <div className="res" data-scroll-lock>
      <header className="res__head">
        <p className="res__eyebrow">
          <b>05</b> / {t.eyebrow}
        </p>
        <h2 className="res__title">
          {t.title1} <em>{t.title2}</em>
        </h2>
        <p className="res__notice">
          <span className="res__noticetag">{t.notice}</span>
          {t.noticeText}
        </p>
      </header>

      <div className="res__grid">
        <section className="res__tools" aria-labelledby="res-tools">
          <div className="res__sechead">
            <h3 id="res-tools">{t.tools}</h3>
            <p>{t.toolsHint}</p>
          </div>
          <ul className="res__cards">
            {TOOLS.map((tool, i) => (
              <li key={tool.id}>
                <button
                  type="button"
                  className="res__card"
                  onClick={() => setOpen(tool)}
                  aria-haspopup="dialog"
                >
                  <span className="res__num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="res__ico" aria-hidden="true">
                    <svg viewBox="0 0 48 48">{tool.icon}</svg>
                  </span>
                  <span className="res__kind">{tool.kind[lang]}</span>
                  <span className="res__name">{tool.title}</span>
                  <span className="res__what">{tool.what[lang]}</span>
                  <span className="res__open">
                    {t.open}
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="res__refs" aria-labelledby="res-refs">
          <div className="res__sechead">
            <h3 id="res-refs">
              {t.refs} <span className="res__count">{REF_COUNT}</span>
            </h3>
            <p>{t.refsHint}</p>
          </div>
          <div className="res__reflist">
            <p className="res__real">{t.realNote}</p>
            {REF_GROUPS.map((g) => (
              <section key={g.id} className="res__refgroup" aria-labelledby={`res-g-${g.id}`}>
                <h4 id={`res-g-${g.id}`}>{g.title[lang]}</h4>
                <ol>
                  {g.refs.map((r) => (
                    <li key={r.name}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        <span className="res__refname">{r.name}</span>
                        <span className="res__refuse">{r.use[lang]}</span>
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </aside>
      </div>

      {open
        ? createPortal(
            <ToolWindow tool={open} lang={lang} onClose={() => setOpen(null)} />,
            // Se monta sobre la cubierta (encima del riel y la marca), no dentro de la pestaña
            document.querySelector<HTMLElement>(".mw-deck") ?? document.body,
          )
        : null}
    </div>
  );
}
