/**
 * Optional LLM narration of a deterministic decision analysis. The LLM only
 * rephrases the engine's outputs: it receives no state, cannot change the
 * decision, and the app falls back to a deterministic narrative without a key.
 */
import type { DecisionAnalysis } from "@/core/types";

export interface AnalysisSummary {
  event: string;
  sol: number;
  posture: string;
  recommended: string;
  alternatives: Array<{ label: string; feasible: boolean; score: number; survival: number; minReserveSols: number; complication: number; consequences: string[] }>;
  risks: string[];
  rationale: string[];
  deterministicKey: string;
}

const clip = (s: unknown, n = 220) => String(s ?? "").slice(0, n);

export function summarizeAnalysis(analysis: DecisionAnalysis): AnalysisSummary {
  if (!analysis || !Array.isArray(analysis.alternatives) || typeof analysis.recommendedId !== "string" || !Array.isArray(analysis.rationale)) throw new Error("Payload is not a decision analysis");
  const sorted = [...analysis.alternatives].sort((a, b) => (a.optionId === analysis.recommendedId ? -1 : b.optionId === analysis.recommendedId ? 1 : b.score - a.score));
  const recommended = sorted[0];
  if (!recommended || recommended.optionId !== analysis.recommendedId) throw new Error("Decision analysis has no recommended alternative");
  return {
    event: clip(analysis.eventTitle, 120),
    sol: Number(analysis.sol) || 0,
    posture: clip(analysis.posture, 20),
    recommended: clip(recommended.label, 120),
    alternatives: sorted.slice(0, 6).map((a) => ({
      label: clip(a.label, 120),
      feasible: !!a.feasible,
      score: Number(a.score.toFixed(3)),
      survival: Number(a.metrics.survivalProbability.toFixed(3)),
      minReserveSols: Number(a.metrics.minReserveSols.toFixed(1)),
      complication: Number(a.metrics.complicationProbability.toFixed(3)),
      consequences: (a.consequences ?? []).slice(0, 4).map((c) => clip(c)),
    })),
    risks: (analysis.risks ?? []).slice(0, 6).map((r) => clip(r.text)),
    rationale: analysis.rationale.slice(0, 8).map((r) => clip(r, 300)),
    deterministicKey: clip(analysis.deterministicKey, 80),
  };
}

export function narrationPrompt(summary: AnalysisSummary): string {
  return `You narrate the output of a deterministic Mars-mission decision engine (rules + Monte-Carlo look-ahead + multi-criteria scoring) for astronauts.
Rules: use only the numbers and facts in the JSON below; do not add measurements, probabilities or NASA facts; do not change the recommendation; mention the main trade-off against the runner-up; say that values are simulation outputs. At most 150 words, plain language, no lists.
Analysis key: ${summary.deterministicKey}

${JSON.stringify(summary, null, 2)}`;
}

export function fallbackNarrative(summary: AnalysisSummary): string {
  const runnerUp = summary.alternatives.find((a) => a.label !== summary.recommended && a.feasible);
  const best = summary.alternatives[0]!;
  const parts = [
    `For “${summary.event}” on sol ${summary.sol}, the engine recommends “${summary.recommended}” under a ${summary.posture} posture (score ${best.score.toFixed(2)}, ${Math.round(best.survival * 100)} % of simulated futures without loss, lowest reserve ${best.minReserveSols} sols).`,
    runnerUp ? `The runner-up, “${runnerUp.label}”, scores ${runnerUp.score.toFixed(2)} with ${Math.round(runnerUp.survival * 100)} % survival and a ${Math.round(runnerUp.complication * 100)} % complication risk.` : "",
    ...summary.rationale,
  ];
  return parts.filter(Boolean).join(" ");
}
