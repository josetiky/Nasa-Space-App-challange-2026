/**
 * Mars Trek · Selector de variante de interfaz para /trek y /martian-map.
 * Ambas variantes comparten el mismo trekStore (misma sesión, ruta y FSM): cambiar de vista no
 * reinicia ni duplica la simulación.
 *   ?ui=classic  → TrekWorkspace (vista operativa original)
 *   ?ui=marswalk → MarsWalkWorkspace (diseño adaptado de mars-space-rockstars) · por defecto
 */
import { Link } from "@tanstack/react-router";
import TrekWorkspace from "./TrekWorkspace";
import MarsWalkWorkspace from "./marswalk/MarsWalkWorkspace";

export type TrekUiVariant = "classic" | "marswalk";

export function parseTrekUi(search: Record<string, unknown>): { ui?: TrekUiVariant } {
  const ui = search["ui"];
  return ui === "classic" || ui === "marswalk" ? { ui } : {};
}

export function TrekVariantPage({
  ui,
  path,
}: {
  ui: TrekUiVariant;
  path: "/trek" | "/martian-map";
}) {
  if (ui === "marswalk") {
    return (
      <MarsWalkWorkspace
        initialTab="marswalk"
        variantSwitch={
          <Link to={path} search={{ ui: "classic" }} hash="">
            Consola clásica / Classic console →
          </Link>
        }
      />
    );
  }
  return (
    <div>
      <div className="flex justify-end border-b border-line bg-panel/70 px-4 py-1 font-mono text-[10.5px]">
        <Link to={path} search={{ ui: "marswalk" }} className="text-amber hover:underline">
          ← Volver a M.I.Y.H. (Mars In Your Hands)
        </Link>
      </div>
      <TrekWorkspace />
    </div>
  );
}
