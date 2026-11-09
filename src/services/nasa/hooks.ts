import { useQuery } from "@tanstack/react-query";
import { checkSource, loadMolaGrid, loadRems, loadSepEpisodes, loadTraverse, searchNasaImages, type TraverseId } from "./adapters";

const HOUR = 3600_000;

export function useMolaGrid() {
  return useQuery({ queryKey: ["nasa", "mola"], queryFn: loadMolaGrid, staleTime: Infinity, gcTime: Infinity, retry: 0 });
}

export function useRems() {
  return useQuery({ queryKey: ["nasa", "rems"], queryFn: loadRems, staleTime: 6 * HOUR, retry: 0 });
}

export function useTraverse(id: TraverseId, enabled = true) {
  return useQuery({ queryKey: ["nasa", "traverse", id], queryFn: () => loadTraverse(id), staleTime: 12 * HOUR, retry: 0, enabled });
}

export function useSepEpisodes() {
  return useQuery({ queryKey: ["nasa", "donki"], queryFn: loadSepEpisodes, staleTime: 12 * HOUR, retry: 0 });
}

export function useNasaImages(query: string | null, limit = 8) {
  return useQuery({ queryKey: ["nasa", "images", query, limit], queryFn: () => searchNasaImages(query!, limit), enabled: !!query, staleTime: 24 * HOUR, retry: 0 });
}

export function useSourceHealth(id: string, enabled = true) {
  return useQuery({ queryKey: ["nasa", "health", id], queryFn: () => checkSource(id), staleTime: 10 * 60_000, retry: 0, enabled });
}
