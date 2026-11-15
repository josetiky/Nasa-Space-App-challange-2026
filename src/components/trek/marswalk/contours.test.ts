import { describe, expect, it } from "vitest";
import { buildContours, contourInterval } from "./contours";

describe("Curvas de nivel (marching squares)", () => {
  it("un plano inclinado da curvas rectas a la altura exacta", () => {
    const nx = 11;
    const nz = 11;
    const elevation = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j += 1) for (let i = 0; i < nx; i += 1) elevation[j * nx + i] = i * 0.5; // sube hacia +x
    const c = buildContours({ x0: 0, z0: 0, cell: 1, nx, nz, elevation }, 1, 2);
    expect(c.intervalM).toBe(1);
    const all = [...c.minor, ...c.major];
    expect(all.length).toBeGreaterThan(0);
    for (let k = 0; k < all.length; k += 4) {
      // cada segmento es vertical (x constante) y su x es par (curvas de 1 m sobre 0.5 m/celda)
      expect(all[k]).toBeCloseTo(all[k + 2]!, 6);
      expect(Math.abs(all[k]! % 2)).toBeLessThan(1e-6);
    }
    // curvas maestras cada 2 m → x múltiplo de 4
    for (let k = 0; k < c.major.length; k += 4)
      expect(Math.abs(c.major[k]! % 4)).toBeLessThan(1e-6);
  });

  it("no dibuja curvas sobre celdas sin dato", () => {
    const elevation = new Float32Array([0, 1, 2, Number.NaN, 1, 2, 0, 1, 2]);
    const c = buildContours({ x0: 0, z0: 0, cell: 1, nx: 3, nz: 3, elevation }, 0.5);
    // solo las celdas (1,0)-(2,1) y (1,1)-(2,2) tienen los cuatro nodos: x ≥ 1
    const all = [...c.minor, ...c.major];
    for (let k = 0; k < all.length; k += 2) expect(all[k]).toBeGreaterThanOrEqual(1 - 1e-6);
  });

  it("elige una equidistancia redonda", () => {
    expect(contourInterval(18)).toBe(1);
    expect(contourInterval(4)).toBe(0.25);
    expect(contourInterval(90)).toBe(5);
  });
});
