/**
 * MarsWalk · Chips de procedencia (REAL | DERIVED | MODELLED | SIMULATED) y confianza (K1–K5)
 * con el lenguaje visual de mars-space-rockstars. Texto + forma + color (tres canales).
 */
import type { ConfidenceClass } from "@/core/trek/contracts";
import type { DataType } from "@/core/types";

const PROV_STYLE: Readonly<Record<DataType, { color: string; glyph: string; title: string }>> = {
  REAL: { color: "#8fd6b0", glyph: "●", title: "Medido por un instrumento de misión de la NASA" },
  DERIVED: {
    color: "#8fb3f0",
    glyph: "◆",
    title: "Calculado a partir de datos reales con fórmula documentada",
  },
  MODELLED: {
    color: "#df8a5d",
    glyph: "▲",
    title: "Modelo físico/empírico evaluado por la plataforma — no es medición",
  },
  SIMULATED: {
    color: "#ff6b4a",
    glyph: "■",
    title: "Salida del simulador (escenario sembrado) — no es dato real",
  },
};

export function ProvChip({ type }: { type: DataType }) {
  const s = PROV_STYLE[type];
  return (
    <span
      title={s.title}
      className="status"
      style={{ color: s.color, boxShadow: `inset 0 0 0 1px ${s.color}88`, padding: "2px 6px" }}
    >
      {s.glyph} {type}
    </span>
  );
}

export function ConfChip({ cls }: { cls: ConfidenceClass }) {
  const solid = cls === "K1" || cls === "K2";
  const weak = cls === "K4" || cls === "K5";
  const color = solid ? "#8fd6b0" : weak ? (cls === "K5" ? "#ff6b4a" : "#df8a5d") : "#aaa0dc";
  return (
    <span
      className="status"
      title="Clase de confianza científica (SCIENTIFIC_CONFIDENCE §2)"
      style={{
        color,
        padding: "2px 6px",
        boxShadow: solid ? `inset 0 0 0 1px ${color}99` : "none",
        outline: solid ? "none" : `1px ${weak ? "dotted" : "dashed"} ${color}aa`,
        outlineOffset: -1,
      }}
    >
      {cls}
    </span>
  );
}

export function UnavailableChip() {
  return (
    <span className="status status--pending" title="Sin ráster numérico local">
      no_disponible
    </span>
  );
}
