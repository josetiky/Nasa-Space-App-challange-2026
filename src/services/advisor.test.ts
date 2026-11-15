import { describe, expect, it } from "vitest";
import { analyzeDecision } from "@/core/decision/engine";
import { createInitialState, injectEvent } from "@/core/sim/engine";
import { makePlan } from "@/core/sim/fixtures";
import { fallbackNarrative, narrationPrompt, summarizeAnalysis } from "./advisor";

const analysis = analyzeDecision(injectEvent(createInitialState(makePlan()), "dustStorm", 2), { samples: 6, horizonSols: 6, now: new Date("2026-11-09T00:00:00Z") });

describe("advisor narration", () => {
  it("summarises only engine outputs, with the recommendation first", () => {
    const s = summarizeAnalysis(analysis);
    expect(s.recommended).toBe(analysis.alternatives.find((a) => a.optionId === analysis.recommendedId)!.label);
    expect(s.alternatives).toHaveLength(analysis.alternatives.length);
    expect(s.alternatives[0]!.label).toBe(s.recommended);
    expect(s.deterministicKey).toBe(analysis.deterministicKey);
  });

  it("instructs the LLM not to invent data or change the decision", () => {
    const prompt = narrationPrompt(summarizeAnalysis(analysis));
    expect(prompt).toMatch(/only the numbers/i);
    expect(prompt).toMatch(/do not change/i);
    expect(prompt).toContain(analysis.deterministicKey);
  });

  it("falls back to a deterministic narrative built from the rationale", () => {
    const text = fallbackNarrative(summarizeAnalysis(analysis));
    expect(text).toContain(summarizeAnalysis(analysis).recommended);
    expect(text).toContain(analysis.rationale[0]!);
  });

  it("rejects payloads that are not an engine analysis", () => {
    expect(() => summarizeAnalysis({ foo: 1 } as never)).toThrow(/analysis/i);
  });
});
