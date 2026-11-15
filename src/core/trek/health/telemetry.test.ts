import { describe, expect, it } from "vitest";
import { createRuleEngine, evaluateRows, PSI_TO_KPA, type HuellaRow } from "./rules";
import { createInitialFsmState, stepFsm } from "./fsm";
import { createTelemetry, stepTelemetry } from "./telemetry";

describe("Mars Trek telemetry simulator (Task 9)", () => {
  it("is deterministic with seed, labels every row SIMULATED, and produces zero alerts in 20 min nominal", () => {
    let t1 = createTelemetry({ evId: "EVA1" }, 42);
    let t2 = createTelemetry({ evId: "EVA1" }, 42);

    const rows1: HuellaRow[] = [];
    const rows2: HuellaRow[] = [];

    for (let s = 0; s < 1200; s += 1) {
      const r1 = stepTelemetry(t1, { incident: "nominal" });
      const r2 = stepTelemetry(t2, { incident: "nominal" });
      t1 = r1.state;
      t2 = r2.state;
      expect(r1.row.simulated).toBe(true);
      expect(r1.row.dataType).toBe("SIMULATED");
      rows1.push(r1.row);
      rows2.push(r2.row);
    }

    expect(rows1).toEqual(rows2);
    const engine = createRuleEngine(4.3 * PSI_TO_KPA);
    const events = evaluateRows(rows1, engine);
    expect(events).toHaveLength(0);
  });

  it("escalates falla_ventilador through PRECAUCION -> SUPERVIVENCIA -> ABORTAR", () => {
    let tel = createTelemetry({ evId: "EVA1" }, 42);
    const rows: HuellaRow[] = [];
    for (let s = 0; s < 400; s += 1) {
      const res = stepTelemetry(tel, { incident: "falla_ventilador" });
      tel = res.state;
      rows.push(res.row);
    }
    const engine = createRuleEngine(4.3 * PSI_TO_KPA);
    const events = evaluateRows(rows, engine);
    const levels = events.map((e) => e.nivel);
    expect(levels).toContain("PRECAUCION");
    expect(levels).toContain("SUPERVIVENCIA");
    expect(levels).toContain("ABORTAR");
  });

  it("Foco 4: triggers immediate CAUTION on sensor cut (perdida_sensores) and never produces NORMAL", () => {
    const tel = createTelemetry({ evId: "EVA1" }, 42);
    const { row } = stepTelemetry(tel, { incident: "perdida_sensores" });
    expect(row.telemetryCut).toBe(true);

    const fsm = stepFsm(createInitialFsmState("EVA1"), {
      missionTimeS: row.t_s,
      telemetryCut: row.telemetryCut,
      dataQuality: row.dataQuality,
    });
    expect(fsm.state).toBe("CAUTION");
    expect(fsm.causes).toContain("sensores");
  });
});
