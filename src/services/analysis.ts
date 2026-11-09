import { useMemo } from "react";
import { describeEnvironment } from "@/core/science/environment";
import { analyzeLocation } from "@/core/science/habitability";
import type { TerrainGrid } from "@/core/science/terrain";
import type { LocationAnalysis, SiteRef } from "@/core/types";
import { useMolaGrid } from "./nasa/hooks";

/** Location analysis from the data layers (MOLA when loaded; flagged otherwise). */
export function analyzeSite(site: SiteRef, grid: TerrainGrid | null): LocationAnalysis {
  return analyzeLocation(site, describeEnvironment(site.point, grid));
}

export type GridState = "loading" | "ready" | "unavailable";

export function useGrid(): { grid: TerrainGrid | null; state: GridState; origin: string | null; error: string | null } {
  const query = useMolaGrid();
  return {
    grid: query.data?.grid ?? null,
    state: query.isPending ? "loading" : query.data ? "ready" : "unavailable",
    origin: query.data?.origin ?? null,
    error: query.error ? (query.error as Error).message : null,
  };
}

export function useSiteAnalysis(site: SiteRef | null) {
  const { grid, state } = useGrid();
  const analysis = useMemo(() => (site ? analyzeSite(site, grid) : null), [site, grid]);
  return { analysis, gridState: state };
}
