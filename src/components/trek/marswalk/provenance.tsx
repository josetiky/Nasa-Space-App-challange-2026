/**
 * M.I.Y.H. · Procedencia de los datos: qué es REAL (NASA) y qué es SIMULATED, siempre a la vista.
 *
 * REAL     terreno de Curiosity (Navcam/Mastcam), hora solar y estación de Gale, último sol de REMS
 *          y estado de DONKI, tal como llegaron (o "sin respuesta" si la API falló).
 * SIMULATED telemetría del traje y eventos inyectados (texto de MW_TEXTS.simBand*).
 */
import { useTrek } from "@/state/trekStore";
import { MW_TEXTS } from "./i18n";

export function DataProvenance() {
  const state = useTrek();
  const es = state.lang === "es";
  const t = MW_TEXTS[state.lang];
  const { session, siteInfo } = state;
  const env = session.env;

  const dynamic =
    session.storms.some((s) => s.active) ||
    session.sepAlertActive ||
    session.telemetry.incident !== "nominal";
  const simNote = dynamic
    ? t.simBand
    : session.huellaReplay
      ? t.simBandReplay
      : session.live
        ? t.simBandLive
        : t.simBandNominal;

  const real: string[] = [];
  if (siteInfo.dataType === "REAL") {
    real.push(
      es
        ? `Terreno: ${siteInfo.name} (Curiosity Navcam/Mastcam, ${siteInfo.resolutionM} m)`
        : `Terrain: ${siteInfo.name} (Curiosity Navcam/Mastcam, ${siteInfo.resolutionM} m)`,
    );
  }
  if (env) {
    real.push(`Ls ${env.ls.value.toFixed(0)}° · MY${env.marsYear}`);
    real.push(
      env.rems
        ? `REMS sol ${env.rems.sol}${env.rems.ageDays !== null ? ` (${Math.round(env.rems.ageDays)} d)` : ""}`
        : es
          ? "REMS sin respuesta (valores modelados)"
          : "REMS no response (modelled values)",
    );
    real.push(
      env.sep.source === "REAL"
        ? env.sep.value
          ? es
            ? "DONKI: SEP reciente ⚠"
            : "DONKI: recent SEP ⚠"
          : es
            ? "DONKI: sin SEP reciente"
            : "DONKI: no recent SEP"
        : es
          ? "DONKI sin respuesta"
          : "DONKI no response",
    );
  }

  return (
    <div className="mwc__prov" role="note">
      {real.length ? (
        <p className="mwc__provline" data-kind="real">
          <b>REAL · NASA</b>
          <span>{real.join(" · ")}</span>
        </p>
      ) : null}
      <p className="mwc__provline" data-kind="sim">
        <span>{simNote}</span>
      </p>
    </div>
  );
}
