/**
 * M.I.Y.H. · Menú "Mapas de Marte" de la cubierta: acceso a los módulos de mapas existentes
 * (Explorer 3D, Survival Atlas, Atlas de misiones, Hazard Layers, consola clásica de Mars Trek).
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MARS_MAPS } from "@/data/marsMaps";
import type { TrekLang } from "../i18n";

export function MapsMenu({ lang }: { lang: TrekLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const es = lang === "es";
  return (
    <div className="mw-maps" ref={ref}>
      <button
        type="button"
        className="chip mw-maps__btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M1.5 3.5 5.5 2l5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5Z" />
          <path d="M5.5 2v10.5M10.5 3.5V14" />
        </svg>
        {es ? "Mapas de Marte" : "Mars maps"}
      </button>
      {open ? (
        <div className="mw-maps__menu glass" role="menu">
          <p className="t-label" style={{ padding: "4px 6px 8px" }}>
            {es ? "Módulos de mapas" : "Map modules"}
          </p>
          {MARS_MAPS.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              search={m.search ?? {}}
              role="menuitem"
              className="mw-maps__item"
              onClick={() => setOpen(false)}
            >
              <b>{m.label}</b>
              <span>{es ? m.es : m.en}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
