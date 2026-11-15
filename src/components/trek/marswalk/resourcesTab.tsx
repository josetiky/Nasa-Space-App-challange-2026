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

type ToolId = "explorer" | "atlas" | "missions" | "hazards" | "trek" | "data" | "decisions";

interface Tool {
  readonly id: ToolId;
  readonly href: string;
  readonly title: string;
  readonly kind: Readonly<Record<TrekLang, string>>;
  readonly what: Readonly<Record<TrekLang, string>>;
  readonly icon: ReactNode;
}

const ICONS: Readonly<Record<ToolId, ReactNode>> = {
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

const REFS: readonly Ref[] = [
  {
    name: "NASA Mars Trek",
    use: { es: "Mosaicos orbitales y relieve de Marte", en: "Orbital mosaics and Mars relief" },
    url: "https://trek.nasa.gov/mars/",
  },
  {
    name: "Access Mars · NASA/JPL & Google Creative Lab",
    use: { es: "Mallas reales del terreno de Gale (Curiosity) y sonidos", en: "Real Gale terrain meshes (Curiosity) and sounds" },
    url: "https://github.com/googlecreativelab/access-mars",
  },
  {
    name: "MSL Analyst's Notebook (PDS)",
    use: { es: "Recorrido y sitios de Curiosity", en: "Curiosity traverse and sites" },
    url: "https://an.rsl.wustl.edu/",
  },
  {
    name: "MSL REMS · PDS Atmospheres",
    use: { es: "Presión y temperatura reales en Gale", en: "Real pressure and temperature at Gale" },
    url: "https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/",
  },
  {
    name: "NASA-STD-3001 Vol. 2 · Spacesuits",
    use: { es: "Límites del traje y de salud del astronauta", en: "Suit and crew health limits" },
    url: "https://www.nasa.gov/reference/11-0-spacesuits-vol-2/",
  },
  {
    name: "NASA SUITS · Telemetry Stream Server",
    use: { es: "Formato de la telemetría del traje", en: "Suit telemetry format" },
    url: "https://github.com/SUITS-Techteam/TSS_2024",
  },
  {
    name: "Solar System Scope",
    use: { es: "Texturas de Marte y Vía Láctea (CC BY 4.0)", en: "Mars and Milky Way textures (CC BY 4.0)" },
    url: "https://www.solarsystemscope.com/textures/",
  },
  {
    name: "Atkinson Hyperlegible · Braille Institute",
    use: { es: "Tipografía de lectura (OFL)", en: "Reading typeface (OFL)" },
    url: "https://www.brailleinstitute.org/freefont/",
  },
];

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
    window: "External window",
    support: "Supporting material",
    newTab: "Open in new tab",
    close: "Close",
    loading: "Loading…",
  },
} as const;

function ToolWindow({ tool, lang, onClose }: { tool: Tool; lang: TrekLang; onClose: () => void }) {
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
      <button type="button" className="resw__backdrop" aria-label={t.close} tabIndex={-1} onClick={onClose} />
      <section className="resw__win">
        <header className="resw__bar">
          <span className="resw__icon" aria-hidden="true">
            <svg viewBox="0 0 48 48">{tool.icon}</svg>
          </span>
          <div className="resw__titles">
            <span className="resw__kicker">
              {t.window} · <b>{t.support}</b>
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
          <button ref={closeRef} type="button" className="resw__close" onClick={onClose} aria-label={t.close}>
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
          <iframe title={tool.title} src={tool.href} onLoad={() => setLoaded(true)} data-loaded={loaded ? "true" : undefined} />
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
                <button type="button" className="res__card" onClick={() => setOpen(tool)} aria-haspopup="dialog">
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
            <h3 id="res-refs">{t.refs}</h3>
          </div>
          <ol className="res__reflist">
            {REFS.map((r) => (
              <li key={r.url}>
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
