/**
 * M.I.Y.H. · Pantalla entre la intro y el aterrizaje: "¿Listo para aterrizar?".
 * ATERRIZAR → onLand() (dentro del clic se desbloquea el audio). Saltar / Esc → onSkip().
 */
import { useEffect, useRef } from "react";
import type { TrekLang } from "../../i18n";
import { ensureReadableFonts } from "./fonts";
import "./landing.css";

const T = {
  es: {
    kicker: "Llegando a Marte · altitud 400 km",
    title1: "¿Listo para",
    title2: "aterrizar?",
    lead: "Vas a bajar al cráter Gale siguiendo los pasos del rover Curiosity.",
    land: "Aterrizar",
    skip: "Saltar al planeador",
    sound: "Mejor con sonido",
    hint: "Esc para saltar en cualquier momento",
    gale: "Cráter Gale · 4.59° S 137.44° E",
  },
  en: {
    kicker: "Arriving at Mars · altitude 400 km",
    title1: "Ready to",
    title2: "land?",
    lead: "You will descend into Gale crater following in the footsteps of the Curiosity rover.",
    land: "Land",
    skip: "Skip to the planner",
    sound: "Best with sound",
    hint: "Esc to skip at any time",
    gale: "Gale crater · 4.59° S 137.44° E",
  },
} as const;

export function ReadyToLand({
  lang,
  onLand,
  onSkip,
}: {
  lang: TrekLang;
  onLand: () => void;
  onSkip: () => void;
}) {
  const t = T[lang];
  const landRef = useRef<HTMLButtonElement | null>(null);
  const skip = useRef(onSkip);
  skip.current = onSkip;

  useEffect(() => {
    ensureReadableFonts();
    landRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="rtl" role="dialog" aria-modal="true" aria-labelledby="rtl-title">
      <div className="rtl__planet" aria-hidden="true">
        <span className="rtl__target" />
      </div>
      <p className="rtl__gale" aria-hidden="true">
        {t.gale}
      </p>
      <header className="rtl__top">
        <span className="rtl__brand">M.I.Y.H.</span>
        <span className="rtl__sound">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
          {t.sound}
        </span>
      </header>
      <div className="rtl__center">
        <p className="rtl__kicker">{t.kicker}</p>
        <h2 id="rtl-title" className="rtl__title">
          {t.title1}
          <br />
          {t.title2}
        </h2>
        <p className="rtl__lead">{t.lead}</p>
        <div className="rtl__cta">
          <button ref={landRef} type="button" className="rtl__land" onClick={onLand}>
            {t.land}
          </button>
          <button type="button" className="rtl__skip" onClick={onSkip}>
            {t.skip}
          </button>
        </div>
        <p className="rtl__hint">{t.hint}</p>
      </div>
    </div>
  );
}
