/**
 * MarsWalk · Canal mínimo entre el botón "Calcular ruta óptima" y el mapa (encuadre + tarjeta de resultado).
 * Solo eventos de vista: el cálculo lo hace el motor vía dispatchTrek({ simEvent: request-replan }).
 */
import { dispatchTrek } from "@/state/trekStore";

type Listener = () => void;
const listeners = new Set<Listener>();

export function onRouteComputed(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Pide al motor recalcular la ruta óptima con la envolvente y los pesos vigentes y avisa al mapa. */
export function computeOptimalRoute(): void {
  dispatchTrek({ type: "simEvent", event: { kind: "request-replan", simulated: false } });
  listeners.forEach((l) => l());
}
