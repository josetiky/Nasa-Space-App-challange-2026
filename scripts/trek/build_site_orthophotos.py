#!/usr/bin/env python3
"""
Ortofotos de Gale · paso 2 de 2.

Proyecta en vista cenital las mallas texturizadas de Access Mars (fotogrametría estéreo de Curiosity con
sus texturas de color) y escribe una ortofoto alineada con la rejilla de elevación del motor:

    public/data/trek/gale/<siteId>/orthophoto.jpg   (2048 × 2048 px, 6.25 cm/px, norte = +Z arriba)
    public/data/trek/gale/<siteId>/orthophoto.json  (procedencia, extensión, cobertura)

Cada píxel toma el color de la superficie más alta (mismo criterio "máximo" que la elevación de
build-site-tiles.mjs), con supermuestreo 2× y filtro Lanczos. No inventa color: lo que ninguna malla
cubre queda en gris neutro y se reporta como falta de cobertura.

Uso (desde la raíz del repositorio):
    node scripts/trek/dump-site-meshes.mjs ../access-mars/public/terrain .cache/ortho
    python3 scripts/trek/build_site_orthophotos.py .cache/ortho ../access-mars/public/terrain
Requiere: numpy, Pillow.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SITES = ["landing_site", "pahrump_hills", "marias_pass", "murray_buttes", "live_site"]
X0, X1 = -64.0, 64.0  # misma extensión que manifest.grid (129 nodos × 1 m)
OUT_PX = 2048
SS = 2  # supermuestreo
RENDER_PX = OUT_PX * SS
M_PER_PX = (X1 - X0) / RENDER_PX
NO_COVER = np.array([34, 34, 40], dtype=np.float32)  # mismo gris que NaN en el ráster de elevación


def read_dump(path: Path):
    buf = path.read_bytes()
    (n_tiles,) = struct.unpack_from("<I", buf, 0)
    off = 4
    tiles = []
    for _ in range(n_tiles):
        tid = buf[off : off + 8].decode("ascii")
        (n_tri,) = struct.unpack_from("<I", buf, off + 8)
        off += 12
        data = np.frombuffer(buf, dtype="<f4", count=n_tri * 15, offset=off).reshape(n_tri, 3, 5)
        off += n_tri * 15 * 4
        tiles.append((tid, data))
    return tiles


def load_texture(tiles_dir: Path, tid: str, target_px: int) -> np.ndarray:
    # Textura base de Access Mars (la que la app carga por defecto); se reduce con Lanczos a la
    # resolución que de verdad se va a muestrear para no generar aliasing.
    img = Image.open(tiles_dir / f"{tid}.jpg").convert("RGB")
    if img.width > target_px:
        img = img.resize((target_px, target_px), Image.LANCZOS)
    return np.asarray(img, dtype=np.float32)


def sample_bilinear(tex: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    # Convención del shader de Access Mars: píxel = (u·W, v·H) desde la esquina superior izquierda.
    h, w, _ = tex.shape
    fx = np.clip(u * w - 0.5, 0, w - 1)
    fy = np.clip(v * h - 0.5, 0, h - 1)
    x0 = np.floor(fx).astype(np.int32)
    y0 = np.floor(fy).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    ax = (fx - x0)[:, None]
    ay = (fy - y0)[:, None]
    top = tex[y0, x0] * (1 - ax) + tex[y0, x1] * ax
    bot = tex[y1, x0] * (1 - ax) + tex[y1, x1] * ax
    return top * (1 - ay) + bot * ay


def render_site(dump: Path, tiles_dir: Path):
    color = np.zeros((RENDER_PX * RENDER_PX, 3), dtype=np.float32)
    zbuf = np.full(RENDER_PX * RENDER_PX, -np.inf, dtype=np.float32)
    tile_px = int(round(16.0 / M_PER_PX))  # baldosa de 16 m → píxeles de render
    for tid, tris in read_dump(dump):
        tex = load_texture(tiles_dir, tid, min(1024, max(64, tile_px * 2)))
        for tri in tris:
            (ax, ay, az, au, av), (bx, by, bz, bu, bv), (cx, cy, cz, cu, cv) = tri
            # columna ← x (este), fila ← −z (norte = +Z arriba), centros de píxel
            pa = ((ax - X0) / M_PER_PX - 0.5, (X1 - az) / M_PER_PX - 0.5)
            pb = ((bx - X0) / M_PER_PX - 0.5, (X1 - bz) / M_PER_PX - 0.5)
            pc = ((cx - X0) / M_PER_PX - 0.5, (X1 - cz) / M_PER_PX - 0.5)
            det = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1])
            if abs(det) < 1e-9:
                continue
            c0 = max(0, int(np.ceil(min(pa[0], pb[0], pc[0]))))
            c1 = min(RENDER_PX - 1, int(np.floor(max(pa[0], pb[0], pc[0]))))
            r0 = max(0, int(np.ceil(min(pa[1], pb[1], pc[1]))))
            r1 = min(RENDER_PX - 1, int(np.floor(max(pa[1], pb[1], pc[1]))))
            if c1 < c0 or r1 < r0:
                continue
            cols = np.arange(c0, c1 + 1, dtype=np.float32)
            rows = np.arange(r0, r1 + 1, dtype=np.float32)
            gc, gr = np.meshgrid(cols, rows)
            gc = gc.ravel()
            gr = gr.ravel()
            l1 = ((pb[1] - pc[1]) * (gc - pc[0]) + (pc[0] - pb[0]) * (gr - pc[1])) / det
            l2 = ((pc[1] - pa[1]) * (gc - pc[0]) + (pa[0] - pc[0]) * (gr - pc[1])) / det
            l3 = 1 - l1 - l2
            inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
            if not inside.any():
                continue
            l1, l2, l3 = l1[inside], l2[inside], l3[inside]
            idx = gr[inside].astype(np.int64) * RENDER_PX + gc[inside].astype(np.int64)
            y = l1 * ay + l2 * by + l3 * cy
            win = y > zbuf[idx]
            if not win.any():
                continue
            idx = idx[win]
            zbuf[idx] = y[win]
            u = l1[win] * au + l2[win] * bu + l3[win] * cu
            v = l1[win] * av + l2[win] * bv + l3[win] * cv
            color[idx] = sample_bilinear(tex, u, v)
    covered = np.isfinite(zbuf)
    color[~covered] = NO_COVER
    img = Image.fromarray(np.clip(color, 0, 255).astype(np.uint8).reshape(RENDER_PX, RENDER_PX, 3))
    img = img.resize((OUT_PX, OUT_PX), Image.LANCZOS)
    return img, float(covered.mean() * 100)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    dump_dir = Path(sys.argv[1])
    terrain_dir = Path(sys.argv[2])
    only = sys.argv[3:] or SITES
    for site in only:
        out_dir = Path("public/data/trek/gale") / site
        img, coverage = render_site(dump_dir / f"{site}.mesh.bin", terrain_dir / site / "tiles")
        img.save(out_dir / "orthophoto.jpg", quality=84, optimize=True, progressive=True)
        meta = {
            "siteId": site,
            "file": f"/data/trek/gale/{site}/orthophoto.jpg",
            "widthPx": OUT_PX,
            "heightPx": OUT_PX,
            "extentM": {"x0": X0, "z0": X0, "x1": X1, "z1": X1},
            "metersPerPx": (X1 - X0) / OUT_PX,
            "orientation": "north-up: fila 0 = z máx (+Z arriba), columna 0 = x mín",
            "coveragePct": round(coverage, 2),
            "method": "Proyección cenital de las mallas TYPE_TILE texturizadas (superficie más alta), supermuestreo 2× + Lanczos",
            "source": f"NASA/JPL-Caltech MSL Curiosity imagery and stereo meshes via Access Mars ({site})",
            "notes": "Zonas en color: imágenes del rover proyectadas sobre la malla. Zonas en escala de grises: relleno que trae Access Mars fuera del campo de visión del rover (sin color real). Radios estirados cerca del borde = textura del rover vista a ángulo rasante.",
            "license": "Apache-2.0 (Access Mars · Google Creative Lab) / NASA-JPL public domain imagery",
            "dataType": "REAL",
            "generatedAt": "2026-11-15T00:00:00Z",
        }
        (out_dir / "orthophoto.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", "utf8")
        print(f"[build_site_orthophotos] {site}: {OUT_PX}px, cobertura {coverage:.1f} %")


if __name__ == "__main__":
    main()
