import { createFileRoute } from "@tanstack/react-router";
import { donkiEpisodes } from "@/services/nasa/transform";

/**
 * DONKI solar energetic particle events for the last 365 days, grouped into
 * episodes. The api.nasa.gov key stays on the server (NASA_API_KEY env var).
 */
export const Route = createFileRoute("/api/nasa/donki")({
  server: {
    handlers: {
      GET: async () => {
        const end = new Date();
        const start = new Date(end.getTime() - 365 * 864e5);
        const day = (d: Date) => d.toISOString().slice(0, 10);
        const key = process.env["NASA_API_KEY"] || "DEMO_KEY";
        const url = `https://api.nasa.gov/DONKI/SEP?startDate=${day(start)}&endDate=${day(end)}&api_key=${encodeURIComponent(key)}`;
        try {
          const upstream = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (!upstream.ok) return Response.json({ error: `api.nasa.gov responded ${upstream.status}${key === "DEMO_KEY" ? " (DEMO_KEY is rate-limited; set NASA_API_KEY)" : ""}` }, { status: 502 });
          const episodes = donkiEpisodes(await upstream.json());
          return Response.json({ episodes, period: `${day(start)} → ${day(end)}`, keyType: key === "DEMO_KEY" ? "demo" : "personal" }, { headers: { "cache-control": "public, max-age=43200" } });
        } catch (error) {
          return Response.json({ error: `DONKI unreachable: ${(error as Error).message}` }, { status: 504 });
        }
      },
    },
  },
});
