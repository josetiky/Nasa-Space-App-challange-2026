import { useEffect, useState } from "react";
import { analyzeDecision } from "@/core/decision/engine";
import type { DecisionAnalysis } from "@/core/types";
import { dispatchMission, useMission } from "./missionStore";

/**
 * Runs the deterministic decision engine once per pending event (with the
 * mission's posture) and stores the result in the shared mission state.
 */
export function useAutoDecisionAnalysis(): { analysis: DecisionAnalysis | null; computing: boolean } {
  const sim = useMission((s) => s.sim);
  const last = useMission((s) => s.lastAnalysis);
  const pendingId = sim?.status === "awaiting-decision" ? (sim.pending?.id ?? null) : null;
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!sim || !pendingId || (last && last.eventId === pendingId)) return;
    setComputing(true);
    const timer = setTimeout(() => {
      try {
        dispatchMission({ type: "setDecisionAnalysis", analysis: analyzeDecision(sim) });
      } finally {
        setComputing(false);
      }
    }, 20);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId, last?.eventId]);

  return { analysis: last && last.eventId === pendingId ? last : null, computing };
}
