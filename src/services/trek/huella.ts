/**
 * Mars Trek · Carga de las caminatas HUELLA ("metricas de vida") preparadas por
 * scripts/trek/build-huella-replay.mjs en public/data/trek/huella/.
 */
import { parseHuellaReplay, type HuellaReplayTrace } from "@/core/trek/health/huellaReplay";

export interface HuellaCatalogEntry {
  readonly id: string;
  readonly titleEs: string;
  readonly titleEn: string;
  readonly file: string;
  readonly durationS: number;
  readonly firstEventS: number | null;
  readonly events: number;
}

/** Catálogo fijo (coincide con public/data/trek/huella/index.json). */
export const HUELLA_REPLAYS: readonly HuellaCatalogEntry[] = [
  {
    id: "nominal",
    titleEs: "Caminata nominal",
    titleEn: "Nominal walk",
    file: "/data/trek/huella/nominal.json",
    durationS: 11607,
    firstEventS: null,
    events: 0,
  },
  {
    id: "estres_termico",
    titleEs: "Estrés térmico (falla LCVG)",
    titleEn: "Heat stress (LCVG failure)",
    file: "/data/trek/huella/estres_termico.json",
    durationS: 11247,
    firstEventS: 7294,
    events: 7,
  },
  {
    id: "falla_ventilador",
    titleEs: "Falla de ventilador → CO₂",
    titleEn: "Fan failure → CO₂",
    file: "/data/trek/huella/falla_ventilador.json",
    durationS: 10527,
    firstEventS: 6853,
    events: 10,
  },
  {
    id: "fuga_traje",
    titleEs: "Fuga de presión del traje",
    titleEn: "Suit pressure leak",
    file: "/data/trek/huella/fuga_traje.json",
    durationS: 10347,
    firstEventS: 6913,
    events: 5,
  },
  {
    id: "arritmia",
    titleEs: "Arritmia sostenida",
    titleEn: "Sustained arrhythmia",
    file: "/data/trek/huella/arritmia.json",
    durationS: 10407,
    firstEventS: 6848,
    events: 4,
  },
  {
    id: "perdida_comunicacion",
    titleEs: "Pérdida de comunicación",
    titleEn: "Loss of comms",
    file: "/data/trek/huella/perdida_comunicacion.json",
    durationS: 10647,
    firstEventS: 7148,
    events: 2,
  },
];

const cache = new Map<string, Promise<HuellaReplayTrace>>();

export function loadHuellaReplay(id: string): Promise<HuellaReplayTrace> {
  const entry = HUELLA_REPLAYS.find((e) => e.id === id);
  if (!entry) return Promise.reject(new Error(`Caminata HUELLA desconocida: ${id}`));
  let p = cache.get(id);
  if (!p) {
    p = fetch(entry.file)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar ${entry.file} (${r.status})`);
        return r.json();
      })
      .then((json) => parseHuellaReplay(json));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
