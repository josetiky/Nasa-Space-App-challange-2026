import { createFileRoute } from "@tanstack/react-router";
import { donkiEpisodes } from "@/services/nasa/transform";

/**
 * DONKI solar energetic particle events for the last `days` days (default 365, max 365),
 * grouped into episodes, plus the raw event times. The api.nasa.gov key stays on the
 * server (NASA_API_KEY env var). With DEMO_KEY, long windows are often refused: the
 * Mars environment asks for `?days=30`.
 */
export const Route = createFileRoute("/api/nasa/donki")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const asked = Number(new URL(request.url).searchParams.get("days"));
        const days = Number.isFinite(asked) && asked >= 1 ? Math.min(365, Math.round(asked)) : 365;
        const end = new Date();
        const start = new Date(end.getTime() - days * 864e5);
        const day = (d: Date) => d.toISOString().slice(0, 10);
        const key = process.env["NASA_API_KEY"] || "DEMO_KEY";
        const parse = async (res: Response): Promise<unknown[]> => {
          // DONKI devuelve cuerpo vacío (no "[]") cuando no hay eventos en el periodo.
          const text = (await res.text()).trim();
          const json: unknown = text.length ? JSON.parse(text) : [];
          return Array.isArray(json) ? json : [];
        };
        const get = async (url: string): Promise<unknown[]> => {
          const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
          if (!res.ok) throw new Error(`responded ${res.status}`);
          return parse(res);
        };
        /** CCMC rechaza (HTTP 400) ventanas de más de ~30 días: se pide en tramos de 30 y se unen. */
        const chunked = async (base: string): Promise<unknown[]> => {
          const spans: Array<[Date, Date]> = [];
          for (let a = start.getTime(); a < end.getTime(); a += 30 * 864e5)
            spans.push([new Date(a), new Date(Math.min(end.getTime(), a + 30 * 864e5))]);
          const parts = await Promise.all(
            spans.map(([a, b]) => get(`${base}?startDate=${day(a)}&endDate=${day(b)}`)),
          );
          const seen = new Set<string>();
          return parts.flat().filter((r) => {
            const rec = r as { sepID?: string; eventTime?: string };
            const id = rec.sepID ?? rec.eventTime ?? JSON.stringify(r);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        };
        const range = `startDate=${day(start)}&endDate=${day(end)}`;
        // 1) api.nasa.gov (con clave). 2) y 3) DONKI en CCMC, el mismo catálogo sin clave:
        //    DEMO_KEY se agota (HTTP 429) y la consola mostraba "DONKI sin respuesta" en plena demo.
        //    Verificado el 2026-11-15: ccmc.gsfc.nasa.gov/DONKI-API/get/SEP responde 200 sin clave.
        const sources: Array<{ id: string; load: () => Promise<unknown[]> }> = [
          {
            id: "api.nasa.gov",
            load: () =>
              get(`https://api.nasa.gov/DONKI/SEP?${range}&api_key=${encodeURIComponent(key)}`),
          },
          {
            id: "ccmc.gsfc.nasa.gov",
            load: () => chunked("https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP"),
          },
          {
            id: "kauai.ccmc.gsfc.nasa.gov",
            load: () => chunked("https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP"),
          },
        ];
        const failures: string[] = [];
        try {
          let raw: unknown = null;
          let source: string | null = null;
          for (const s of sources) {
            try {
              raw = await s.load();
              source = s.id;
              break;
            } catch (error) {
              failures.push(`${s.id}: ${(error as Error).message}`);
            }
          }
          if (source === null)
            return Response.json(
              {
                error: `${failures.join("; ")}${key === "DEMO_KEY" ? " (DEMO_KEY is rate-limited; set NASA_API_KEY)" : ""}`,
              },
              { status: 502 },
            );
          const episodes = donkiEpisodes(raw);
          const events = (Array.isArray(raw) ? (raw as Array<{ eventTime?: string }>) : [])
            .map((r) => r.eventTime ?? "")
            .filter((t) => t.length > 0);
          return Response.json(
            {
              episodes,
              events,
              period: `${day(start)} → ${day(end)}`,
              keyType: key === "DEMO_KEY" ? "demo" : "personal",
              source,
            },
            { headers: { "cache-control": "public, max-age=10800" } },
          );
        } catch (error) {
          return Response.json(
            { error: `DONKI unreachable: ${(error as Error).message}` },
            { status: 504 },
          );
        }
      },
    },
  },
});
