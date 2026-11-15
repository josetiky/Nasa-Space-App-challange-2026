import { createFileRoute } from "@tanstack/react-router";

/**
 * Proxy for the MOLA MEGDR grid (PDS Geosciences Node does not send CORS headers).
 * Streams the original big-endian bytes unchanged; the client decodes them.
 */
const MEGDR_URL = "https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.img";
const EXPECTED_BYTES = 1440 * 720 * 2;

export const Route = createFileRoute("/api/nasa/mola")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const upstream = await fetch(MEGDR_URL, { signal: AbortSignal.timeout(45000) });
          if (!upstream.ok) return Response.json({ error: `PDS responded ${upstream.status}` }, { status: 502 });
          const bytes = await upstream.arrayBuffer();
          if (bytes.byteLength !== EXPECTED_BYTES) return Response.json({ error: `Unexpected MEGDR size ${bytes.byteLength}` }, { status: 502 });
          return new Response(bytes, {
            headers: {
              "content-type": "application/octet-stream",
              "cache-control": "public, max-age=604800, immutable",
              "x-source": MEGDR_URL,
              "x-byte-order": "big-endian int16, 1440x720, 4 px/deg",
            },
          });
        } catch (error) {
          return Response.json({ error: `PDS unreachable: ${(error as Error).message}` }, { status: 504 });
        }
      },
    },
  },
});
