/**
 * MarsWalk · Entorno de Marte en la simulación: reloj real (Mars24), REMS de Curiosity en Gale y
 * partículas solares de DONKI. Muestra cada valor dinámico con su procedencia y antigüedad, y ofrece
 * ejemplos (atardecer, temporada de polvo, SEP real) que se aplican a la sesión. El cálculo vive en
 * core/trek/env/marsEnv.ts; aquí solo se cargan las fuentes y se despacha `setMarsEnv`.
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  ambientCoolingFactor,
  buildMarsEnv,
  envAtMissionTime,
  type EnvSource,
  type MarsEnvExample,
} from "@/core/trek/env/marsEnv";
import { formatHours, seasonName } from "@/core/science/marsTime";
import { latestValidSol } from "@/services/nasa/transform";
import { bundledSepIso2024 } from "@/services/nasa/adapters";
import { useRecentSep, useRems } from "@/services/nasa/hooks";
import { dispatchTrek, trekStore, useTrek } from "@/state/trekStore";

type Lang = "es" | "en";
const L = (lang: Lang, es: string, en: string) => (lang === "es" ? es : en);

const SOURCE_COLOR: Readonly<Record<EnvSource | "SIMULATED", string>> = {
  REAL: "#8fd6b0",
  DERIVED: "#8fb3f0",
  MODELLED: "#f3c27a",
  SIMULATED: "#ff8a70",
};

function Src({ s }: { s: EnvSource | "SIMULATED" }) {
  return (
    <span className="env-src" style={{ color: SOURCE_COLOR[s], borderColor: SOURCE_COLOR[s] }}>
      {s}
    </span>
  );
}

/** Construye el entorno con lo que hayan devuelto REMS y DONKI (o sin ellos) y lo aplica. */
function useBuildEnv() {
  const rems = useRems();
  const donki = useRecentSep();
  const siteInfo = useTrek((s) => s.siteInfo);
  const ready = !rems.isLoading && !donki.isLoading;
  const build = (example: MarsEnvExample) => {
    const sol = rems.data ? latestValidSol(rems.data.snapshot) : null;
    const sep = donki.data ? donki.data.eventsIso : null;
    return buildMarsEnv({
      historicSepIso: bundledSepIso2024(),
      historicSepLabel: "DONKI 2024, respaldo incluido",
      now: new Date(),
      site: {
        lat: siteInfo.coord.lat,
        lon: siteInfo.coord.lon,
        elevationM: siteInfo.coord.elevationM,
      },
      rems: sol,
      sepEventsIso: sep,
      example,
    });
  };
  return { ready, build, rems, donki };
}

/** Aplica el entorno real ("ahora") en cuanto REMS y DONKI responden (o fallan). Una vez por carga. */
export function MarsEnvLoader() {
  const { ready, build } = useBuildEnv();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    if (trekStore.getState().session.env) return;
    dispatchTrek({ type: "setMarsEnv", env: build("now") });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Chip compacto para la cabecera de la simulación. */
export function MarsEnvChip({ onOpen }: { onOpen: () => void }) {
  const state = useTrek();
  const lang = state.lang;
  const env = state.session.env;
  if (!env) {
    return (
      <button type="button" className="chip env-chip" onClick={onOpen}>
        <span className="chip__dot" aria-hidden="true" />{" "}
        {L(lang, "Marte: valores fijos", "Mars: fixed values")}
      </button>
    );
  }
  const now = envAtMissionTime(env, state.session.clockS);
  return (
    <button
      type="button"
      className="chip env-chip"
      onClick={onOpen}
      title={L(
        lang,
        "Entorno de Marte y procedencia de cada valor",
        "Mars environment and provenance of each value",
      )}
    >
      <span className="chip__dot chip__dot--pulse" aria-hidden="true" />
      {L(lang, "Marte", "Mars")} · {formatHours(now.ltst).slice(0, 5)} · ☀{" "}
      {now.sunElevationDeg.toFixed(0)}° · {env.pressurePa.value.toFixed(0)} Pa
      {env.sep.value ? " · SEP" : ""}
      {env.example !== "now" ? ` · ${L(lang, "ejemplo", "example")}` : ""}
    </button>
  );
}

const EXAMPLES: ReadonlyArray<{
  id: MarsEnvExample;
  es: string;
  en: string;
  whyEs: string;
  whyEn: string;
}> = [
  {
    id: "now",
    es: "Ahora en Gale",
    en: "Gale right now",
    whyEs: "Hora solar real de Gale, último sol de REMS y estado de DONKI.",
    whyEn: "Real Gale solar time, latest REMS sol and DONKI status.",
  },
  {
    id: "sunset",
    es: "Atardecer",
    en: "Sunset",
    whyEs:
      "La caminata empieza ~55 min antes de la puesta de Sol de hoy en Gale (Mars24): el Sol baja de 10° durante la marcha y el término R (luz) del A* encarece la exposición.",
    whyEn:
      "The walk starts ~55 min before today's Gale sunset (Mars24): the Sun drops below 10° during the walk and the A* R (light) term makes exposure costlier.",
  },
  {
    id: "dusty",
    es: "Temporada de polvo",
    en: "Dust season",
    whyEs: "Ls 255 (perihelio): τ climatológico más alto → más riesgo ambiental en el costo.",
    whyEn: "Ls 255 (perihelion): higher climatological τ → more environmental risk in the cost.",
  },
  {
    id: "sep",
    es: "SEP real (DONKI)",
    en: "Real SEP (DONKI)",
    whyEs:
      "Reproduce el último episodio SEP real de DONKI (si no hubo en 30 días, uno de 2024): EVA-13 → refugio obligatorio y dosis ×4.",
    whyEn:
      "Replays the latest real DONKI SEP episode (a 2024 one if none in 30 days): EVA-13 → mandatory shelter and dose ×4.",
  },
];

export function MarsEnvPanel() {
  const state = useTrek();
  const lang = state.lang;
  const { session } = state;
  const env = session.env;
  const { ready, build, rems, donki } = useBuildEnv();
  const now = env ? envAtMissionTime(env, session.clockS) : null;
  const cooling = env ? ambientCoolingFactor(env.pressurePa.value) : 1;
  const row = (label: ReactNode, value: ReactNode, src: EnvSource | "SIMULATED", note: string) => (
    <tr>
      <td>{label}</td>
      <td className="t-mono">{value}</td>
      <td>
        <Src s={src} />
      </td>
      <td className="env-note">{note}</td>
    </tr>
  );

  return (
    <section className="env-panel" aria-label={L(lang, "Entorno de Marte", "Mars environment")}>
      <header className="env-panel__head">
        <p className="t-label">
          <b>
            {L(lang, "Entorno de Marte · valores dinámicos", "Mars environment · dynamic values")}
          </b>
        </p>
        <span className="mw__muted">
          REMS:{" "}
          {rems.isLoading
            ? "…"
            : rems.data
              ? rems.data.origin
              : L(lang, "sin respuesta", "no answer")}{" "}
          · DONKI:{" "}
          {donki.isLoading
            ? "…"
            : donki.data
              ? `${donki.data.origin} · ${donki.data.period} · ${donki.data.eventsIso.length} SEP`
              : L(
                  lang,
                  "sin respuesta (DEMO_KEY limitado: define NASA_API_KEY)",
                  "no answer (DEMO_KEY rate-limited: set NASA_API_KEY)",
                )}
        </span>
      </header>

      <div className="env-examples" role="group" aria-label={L(lang, "Ejemplos", "Examples")}>
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            className="chip solo-chip-btn"
            aria-pressed={env?.example === e.id}
            disabled={!ready}
            title={lang === "es" ? e.whyEs : e.whyEn}
            onClick={() => dispatchTrek({ type: "setMarsEnv", env: build(e.id) })}
          >
            {lang === "es" ? e.es : e.en}
          </button>
        ))}
        <button
          type="button"
          className="chip solo-chip-btn"
          aria-pressed={env === null}
          onClick={() => dispatchTrek({ type: "setMarsEnv", env: null })}
        >
          {L(lang, "Valores fijos", "Fixed values")}
        </button>
      </div>
      {env ? (
        <p className="env-why">
          {EXAMPLES.find((e) => e.id === env.example)?.[lang === "es" ? "whyEs" : "whyEn"]}
        </p>
      ) : null}

      {env && now ? (
        <table className="env-table">
          <thead>
            <tr>
              <th>{L(lang, "Variable", "Variable")}</th>
              <th>{L(lang, "Valor en T+", "Value at T+")}</th>
              <th>{L(lang, "Origen", "Source")}</th>
              <th>
                {L(lang, "De dónde sale / qué mueve", "Where it comes from / what it drives")}
              </th>
            </tr>
          </thead>
          <tbody>
            {row(
              L(lang, "Hora solar local (Gale)", "Local solar time (Gale)"),
              formatHours(now.ltst).slice(0, 5),
              env.ltstAtStart.source,
              `${env.ltstAtStart.note}. ${L(lang, "Avanza con el reloj de la simulación.", "Advances with the simulation clock.")}`,
            )}
            {row(
              L(lang, "Elevación del Sol", "Sun elevation"),
              `${now.sunElevationDeg.toFixed(1)}°`,
              "DERIVED",
              L(
                lang,
                "Mars24 + declinación por Ls. Bajo 10° sube el término R (luz) del A*.",
                "Mars24 + Ls declination. Below 10° the A* R (light) term rises.",
              ),
            )}
            {row(
              "Ls",
              `${env.ls.value.toFixed(1)}° · ${seasonName(env.ls.value, env.site.lat)}`,
              env.ls.source,
              `${env.ls.note} · MY ${env.marsYear}`,
            )}
            {row(
              L(lang, "Presión", "Pressure"),
              `${env.pressurePa.value.toFixed(0)} Pa (${(env.pressurePa.value / 133.322).toFixed(2)} Torr)`,
              env.pressurePa.source,
              `${env.pressurePa.note}. PRE-07 → ${L(lang, "eficacia de enfriamiento del traje", "suit cooling efficacy")} ×${cooling.toFixed(2)}`,
            )}
            {row(
              L(lang, "Temperatura del aire", "Air temperature"),
              now.airTempC === null
                ? "—"
                : `${now.airTempC.toFixed(0)} °C (${env.airMinC?.value} / ${env.airMaxC?.value})`,
              env.airMinC ? "DERIVED" : "MODELLED",
              env.airMinC
                ? `${L(lang, "Mín./máx. REAL de REMS; ciclo diario interpolado.", "REAL REMS min/max; interpolated daily cycle.")} ${env.airMinC.note}`
                : L(lang, "Sin dato REMS", "No REMS data"),
            )}
            {row(
              L(lang, "Polvo τ", "Dust τ"),
              env.tau.value.toFixed(2),
              env.tau.source,
              `${env.tau.note}. → R (polvo)`,
            )}
            {row(
              L(lang, "Dosis GCR", "GCR dose"),
              `${env.doseRateMsvPerSol.value.toFixed(3)} mSv/sol`,
              env.doseRateMsvPerSol.source,
              `${env.doseRateMsvPerSol.note}. → R (rad.) ${L(lang, "y dosis del traje", "and suit dose")}`,
            )}
            {row(
              L(lang, "Partículas solares (SEP)", "Solar particles (SEP)"),
              env.sep.value ? L(lang, "ACTIVO", "ACTIVE") : L(lang, "no", "no"),
              env.sep.source,
              `${env.sep.note}${env.sep.lastEventIso ? ` · ${L(lang, "último", "last")}: ${env.sep.lastEventIso.slice(0, 10)}` : ""}. → EVA-13`,
            )}
            {row(
              L(lang, "Sensores del astronauta", "Astronaut sensors"),
              session.huellaReplay
                ? "HUELLA CSV"
                : session.live
                  ? L(lang, "en vivo", "live")
                  : L(lang, "generador", "generator"),
              "SIMULATED",
              L(
                lang,
                "No hay astronautas en Marte: FC, temperatura, CO₂, presión del traje… son simulados.",
                "There are no astronauts on Mars: HR, temperature, CO₂, suit pressure… are simulated.",
              ),
            )}
          </tbody>
        </table>
      ) : (
        <p className="mw__muted">
          {ready
            ? L(
                lang,
                "Entorno apagado: Sol 35°, τ 0.5, 0.64 mSv/sol fijos.",
                "Environment off: fixed Sun 35°, τ 0.5, 0.64 mSv/sol.",
              )
            : L(lang, "Consultando REMS y DONKI…", "Querying REMS and DONKI…")}
        </p>
      )}
      <p className="mw__muted">
        {L(
          lang,
          "No existe un flujo público en tiempo real desde la superficie de Marte: REMS publica cada sol con retraso (se muestra la antigüedad) y DONKI mide partículas solares cerca de la Tierra. La hora solar y la elevación del Sol sí se calculan en tiempo real.",
          "There is no public real-time feed from the Martian surface: REMS publishes each sol with a delay (age shown) and DONKI measures solar particles near Earth. Solar time and Sun elevation are computed in real time.",
        )}
      </p>
    </section>
  );
}
