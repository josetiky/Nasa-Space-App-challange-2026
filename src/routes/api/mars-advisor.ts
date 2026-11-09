import { createFileRoute } from "@tanstack/react-router";
import type { DecisionAnalysis } from "@/core/types";
import { fallbackNarrative, narrationPrompt, summarizeAnalysis } from "@/services/advisor";

type Mission = {
  site?: string;
  crew?: number;
  habitat?: string;
  seed?: number;
  solarEventSource?: string;
  result?: {
    survived?: boolean;
    score?: number;
    runSols?: number;
    doseMsv?: number;
    maxDustOpticalDepth?: number;
    solarParticleEvents?: number;
    lowPowerSols?: number;
    oxygenRemainingKg?: number;
    waterRemainingL?: number;
    cause?: string | null;
  };
};

function fallbackAnswer(question: string, mission: Mission) {
  const result = mission.result;
  const score = result?.score ?? null;
  const risk: string[] = [];
  if ((result?.doseMsv ?? 0) > 300) risk.push("radiation exposure is becoming a major constraint");
  if ((result?.maxDustOpticalDepth ?? 0) > 3) risk.push("dust-storm opacity is strongly affecting solar power");
  if ((result?.lowPowerSols ?? 0) > 20) risk.push("the power system spends many sols below demand");
  if ((result?.waterRemainingL ?? 99999) < 100) risk.push("water reserve is getting tight");
  if ((result?.oxygenRemainingKg ?? 99999) < 25) risk.push("oxygen reserve is getting tight");

  const lead = result
    ? `Mission state: ${result.survived ? "survived" : "failed"}, score ${score}/100 after ${result.runSols ?? "—"} sols.`
    : "No completed run is available yet; this is a setup-level assessment.";
  const site = mission.site ?? "selected site";
  const habitat = mission.habitat ?? "selected habitat";
  const concerns = risk.length ? `Main signals: ${risk.join("; ")}.` : "No major threshold breach is visible in the supplied snapshot.";

  return `${lead}\n\nFor ${site} with ${mission.crew ?? "—"} crew in ${habitat}: ${concerns}\n\nRecommended next step: ${result?.survived ? "compare the three habitat options with the same seed, then test a higher dust intensity or longer mission duration." : "reduce the dominant failure mode first—typically dust/power, water/oxygen reserve, or shielding—then rerun with the same seed so the change is attributable."}\n\nQuestion addressed: ${question}`;
}

async function callGemini(question: string, mission: Mission) {
  const prompt = `You are the Mars Mission Advisor inside the NASA Space Apps 2026 project “Interplanetary Survival Guide: Martian Map”. Give concise, scientifically cautious mission-planning guidance. Treat the supplied simulator numbers as model outputs, not NASA-certified mission requirements. Do not invent NASA measurements. Explain uncertainty and distinguish NASA-sourced context from model assumptions.

Mission JSON:
${JSON.stringify(mission, null, 2)}

User question:
${question}`;

  return geminiText(prompt, 500);
}

/** Server-side Gemini call (the key never reaches the browser). Returns null without a key. */
async function geminiText(prompt: string, maxOutputTokens: number): Promise<string | null> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;
  const model = process.env["GEMINI_MODEL"] || "gemini-2.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens, temperature: 0.3 },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 180)}`);
  }

  const data = (await response.json()) as any;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text)
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim();

  return text || "The AI provider returned no text.";
}

export const Route = createFileRoute("/api/mars-advisor")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          service: "mars-advisor",
          provider: process.env["GEMINI_API_KEY"] ? "gemini" : "local-fallback",
        }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { question?: string; mission?: Mission; mode?: string; analysis?: DecisionAnalysis };
          if (body.mode === "narrate") {
            let summary;
            try {
              summary = summarizeAnalysis(body.analysis as DecisionAnalysis);
            } catch (error) {
              return Response.json({ error: (error as Error).message }, { status: 400 });
            }
            const ai = await geminiText(narrationPrompt(summary), 320).catch((error: Error) => {
              console.error(error);
              return null;
            });
            return Response.json({ answer: ai ?? fallbackNarrative(summary), mode: ai ? "gemini" : "fallback", key: summary.deterministicKey });
          }
          const question = typeof body.question === "string" ? body.question.trim() : "";
          if (!question) return Response.json({ error: "question is required" }, { status: 400 });
          const mission = body.mission ?? {};
          const ai = await callGemini(question, mission);
          return Response.json({ answer: ai ?? fallbackAnswer(question, mission), mode: ai ? "gemini" : "fallback" });
        } catch (error) {
          console.error(error);
          return Response.json({ error: "Mission advisor failed. Check the server logs." }, { status: 500 });
        }
      },
    },
  },
});
