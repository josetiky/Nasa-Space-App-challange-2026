import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { engineText } from "./engineText";

/** Archivos del motor cuyos textos llegan a la interfaz. */
const ENGINE_FILES = [
  "routing/astar.ts",
  "routing/planner.ts",
  "routing/trace.ts",
  "routing/tour.ts",
  "safety/envelope.ts",
  "sim/session.ts",
  "sim/replanner.ts",
  "health/rules.ts",
  "health/missionRules.ts",
  "health/fatigue.ts",
  "health/liveSuit.ts",
  "health/fsm.ts",
  "health/directive.ts",
];

const SPANISH =
  /[áéíóúñ¿¡]|\b(el|la|los|las|del|de|en|por|sin|con|para|que|una|ruta|destino|origen|pendiente|limite|refugio|regreso|camino|tormenta|zona|zonas|parada|confianza|celda|rejilla|muestra|ventilador|presion|temperatura|humedad|traje|casco|tanque|bajo|alta|moderada|ninguna)\b/i;

/** Sustituye cada ${…} (con llaves anidadas) por un valor de ejemplo. */
function fillTemplate(src: string): string {
  let out = "";
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === "$" && src[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth += 1;
        else if (src[j] === "}") depth -= 1;
        j += 1;
      }
      out += "7";
      i = j - 1;
    } else {
      out += src[i];
    }
  }
  return out;
}

function engineStrings(): string[] {
  const root = path.resolve(process.cwd(), "src/core/trek");
  const re = /\b(?:message|summary|detail|label)\s*:\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*")/g;
  const out = new Set<string>();
  for (const file of ENGINE_FILES) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    for (const m of src.matchAll(re)) {
      const lit = m[1]!.slice(1, -1);
      const text = m[1]!.startsWith("`") ? fillTemplate(lit) : lit;
      if (!/\s/.test(text)) continue; // códigos, no frases
      out.add(text.replace(/\\"/g, '"'));
    }
  }
  return [...out];
}

describe("engineText: avisos del motor en inglés", () => {
  it("traduce el aviso del jurado y conserva los números", () => {
    expect(
      engineText("El destino es inadmisible: Pendiente local 24.3° supera el límite 20.0°", "en"),
    ).toBe("The goal is inadmissible: Local slope 24.3° exceeds the 20.0° limit");
    expect(engineText("[A* · REPLAN] Ruta calculada (191 m, costo 412 m-eq).", "en")).toBe(
      "[A* · REPLAN] Route computed (191 m, cost 412 m-eq).",
    );
  });

  it("traduce los motivos del itinerario científico", () => {
    expect(engineText("Sin corredor admisible hasta la parada «Buckskin».", "en")).toBe(
      "No admissible corridor to stop “Buckskin”.",
    );
    expect(engineText("Regreso al punto de partida", "en")).toBe("Return to start");
    expect(engineText("Directiva CRITICAL: refugio", "en")).toBe("CRITICAL directive: shelter");
  });

  it("en español no cambia nada", () => {
    const s = "El destino es inadmisible: Zona Z5 excluida por la envolvente de seguridad";
    expect(engineText(s, "es")).toBe(s);
  });

  it("ninguna plantilla de texto del motor queda en español al mostrarse en inglés", () => {
    const strings = engineStrings();
    expect(strings.length).toBeGreaterThan(80);
    const leftovers = strings
      .map((s) => ({ s, en: engineText(s, "en") }))
      .filter(({ en }) => SPANISH.test(en));
    expect(leftovers).toEqual([]);
  });
});
