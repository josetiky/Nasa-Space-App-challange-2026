import { createFileRoute } from "@tanstack/react-router";
import { trimRems } from "@/services/nasa/transform";

/** Server-side copy of the Curiosity REMS feed, trimmed to the fields the platform uses. */
const REMS_URL = "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json";

export const Route = createFileRoute("/api/nasa/rems")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const upstream = await fetch(REMS_URL, { signal: AbortSignal.timeout(20000) });
          if (!upstream.ok) return Response.json({ error: `mars.nasa.gov responded ${upstream.status}` }, { status: 502 });
          const snapshot = trimRems(await upstream.json(), REMS_URL, new Date().toISOString());
          if (!snapshot.count) return Response.json({ error: "REMS feed had no sols" }, { status: 502 });
          return Response.json(snapshot, { headers: { "cache-control": "public, max-age=21600" } });
        } catch (error) {
          return Response.json({ error: `REMS unreachable: ${(error as Error).message}` }, { status: 504 });
        }
      },
    },
  },
});
