#!/usr/bin/env node
/**
 * Tarea 1 · Decodifica las mallas TYPE_TILE de Access Mars (glTF + Draco) para las 5 escenas de Gale,
 * aplica la escala de escena (0.01 × 100 = 1.0) y rasteriza la elevación a 1 m sobre [-64, 64]² (129×129).
 * Genera public/data/trek/gale/<siteId>/{elevation.f32,manifest.json}.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const DRACO_DIR = path.join(ROOT, "public/draco");
const GALE_IN_DIR = path.join(ROOT, "public/eva/gale");
const GALE_OUT_DIR = path.join(ROOT, "public/data/trek/gale");

const SITES = [
  "landing_site",
  "pahrump_hills",
  "marias_pass",
  "murray_buttes",
  "live_site",
];

async function loadDracoDecoder() {
  const code = fs.readFileSync(path.join(DRACO_DIR, "draco_decoder.js"), "utf8");
  const wasmBinary = fs.readFileSync(path.join(DRACO_DIR, "draco_decoder.wasm"));
  const sandbox = {
    require,
    console,
    process,
    Buffer,
    Uint8Array,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
    ArrayBuffer,
    DataView,
    WebAssembly,
    Math,
    Date,
     __dirname: DRACO_DIR,
    __filename: path.join(DRACO_DIR, "draco_decoder.js"),
  };
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.DracoDecoderModule = DracoDecoderModule;`, sandbox);
  return await sandbox.DracoDecoderModule({ wasmBinary });
}

function parseGlb(buffer) {
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error("Not a valid GLB file");
  const jsonLen = buffer.readUInt32LE(12);
  const jsonStr = buffer.subarray(20, 20 + jsonLen).toString("utf8");
  const gltf = JSON.parse(jsonStr);
  const binOffset = 20 + jsonLen + 8;
  const binChunk = buffer.subarray(binOffset);
  return { gltf, binChunk };
}

function mat4Multiply(a, b) {
  const out = new Float64Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function mat4FromNode(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return Float64Array.from(node.matrix);
  }
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];

  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;

  return Float64Array.from([
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ]);
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function decodeDracoPrimitive(draco, binChunk, bufferView, dracoExt) {
  const byteOffset = bufferView.byteOffset ?? 0;
  const byteLength = bufferView.byteLength;
  const slice = binChunk.subarray(byteOffset, byteOffset + byteLength);

  const decoder = new draco.Decoder();
  const buffer = new draco.DecoderBuffer();
  buffer.Init(new Int8Array(slice.buffer, slice.byteOffset, slice.byteLength), slice.byteLength);

  const geomType = decoder.GetEncodedGeometryType(buffer);
  if (geomType !== draco.TRIANGULAR_MESH) {
    draco.destroy(buffer);
    draco.destroy(decoder);
    throw new Error("Expected Draco TRIANGULAR_MESH");
  }

  const mesh = new draco.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) {
    const msg = status.error_msg();
    draco.destroy(mesh);
    draco.destroy(buffer);
    draco.destroy(decoder);
    throw new Error(`Draco decode failed: ${msg}`);
  }

  const posId = dracoExt.attributes.POSITION;
  const posAttr = decoder.GetAttributeByUniqueId(mesh, posId);
  const numPoints = mesh.num_points();
  const numFaces = mesh.num_faces();

  const posArray = new draco.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(mesh, posAttr, posArray);
  const positions = new Float32Array(numPoints * 3);
  for (let i = 0; i < numPoints * 3; i += 1) {
    positions[i] = posArray.GetValue(i);
  }
  draco.destroy(posArray);

  const faceIndices = new draco.DracoInt32Array();
  const indices = new Uint32Array(numFaces * 3);
  for (let f = 0; f < numFaces; f += 1) {
    decoder.GetFaceFromMesh(mesh, f, faceIndices);
    indices[f * 3] = faceIndices.GetValue(0);
    indices[f * 3 + 1] = faceIndices.GetValue(1);
    indices[f * 3 + 2] = faceIndices.GetValue(2);
  }
  draco.destroy(faceIndices);
  draco.destroy(mesh);
  draco.destroy(buffer);
  draco.destroy(decoder);

  return { positions, indices };
}

function rasterizeTriangles(grid, positions, index) {
  const count = index ? index.length : positions.length / 3;
  const vertex = (k) => {
    const v = (index ? index[k] : k) * 3;
    return [positions[v], positions[v + 1], positions[v + 2]];
  };
  for (let t = 0; t + 2 < count; t += 3) {
    const [ax, ay, az] = vertex(t);
    const [bx, by, bz] = vertex(t + 1);
    const [cx, cy, cz] = vertex(t + 2);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-12) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - grid.x0) / grid.cell - 1e-9));
    const i1 = Math.min(grid.nx - 1, Math.floor((Math.max(ax, bx, cx) - grid.x0) / grid.cell + 1e-9));
    const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - grid.z0) / grid.cell - 1e-9));
    const j1 = Math.min(grid.nz - 1, Math.floor((Math.max(az, bz, cz) - grid.z0) / grid.cell + 1e-9));
    for (let j = j0; j <= j1; j += 1) {
      const z = grid.z0 + j * grid.cell;
      for (let i = i0; i <= i1; i += 1) {
        const x = grid.x0 + i * grid.cell;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        const y = l1 * ay + l2 * by + l3 * cy;
        const k = j * grid.nx + i;
        const prev = grid.h[k];
        if (Number.isNaN(prev) || y > prev) grid.h[k] = y;
      }
    }
  }
}

async function main() {
  const draco = await loadDracoDecoder();
  // Escala de escena en SurfaceEva.tsx: <group scale={100}>
  const rootScale = Float64Array.from([
    100, 0, 0, 0,
    0, 100, 0, 0,
    0, 0, 100, 0,
    0, 0, 0, 1,
  ]);

  for (const siteId of SITES) {
    const glbPath = path.join(GALE_IN_DIR, siteId, "terrain.glb");
    const glbBuf = fs.readFileSync(glbPath);
    const { gltf, binChunk } = parseGlb(glbBuf);

    const grid = {
      x0: -64,
      z0: -64,
      cell: 1,
      nx: 129,
      nz: 129,
      h: new Float32Array(129 * 129).fill(Number.NaN),
    };

    const edgeLengths = [];
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const visitNode = (nodeIdx, parentMat) => {
      const node = gltf.nodes[nodeIdx];
      if (!node) return;
      const worldMat = mat4Multiply(parentMat, mat4FromNode(node));
      const name = node.name || "";

      if (name.includes("TYPE_TILE") && typeof node.mesh === "number") {
        const meshDef = gltf.meshes[node.mesh];
        for (const prim of meshDef.primitives ?? []) {
          const dracoExt = prim.extensions?.KHR_draco_mesh_compression;
          if (!dracoExt) continue;
          const bv = gltf.bufferViews[dracoExt.bufferView];
          const { positions, indices } = decodeDracoPrimitive(draco, binChunk, bv, dracoExt);

          const worldPos = new Float32Array(positions.length);
          for (let k = 0; k < positions.length; k += 3) {
            const [wx, wy, wz] = transformPoint(
              worldMat,
              positions[k],
              positions[k + 1],
              positions[k + 2],
            );
            worldPos[k] = wx;
            worldPos[k + 1] = wy;
            worldPos[k + 2] = wz;
            if (wy < minY) minY = wy;
            if (wy > maxY) maxY = wy;
          }

          // Muestra de espaciado entre vértices de triángulos
          const step = Math.max(3, Math.floor(indices.length / 600) * 3);
          for (let t = 0; t + 2 < indices.length; t += step) {
            const a = indices[t] * 3;
            const b = indices[t + 1] * 3;
            const d = Math.hypot(
              worldPos[b] - worldPos[a],
              worldPos[b + 1] - worldPos[a + 1],
              worldPos[b + 2] - worldPos[a + 2],
            );
            if (d > 1e-4) edgeLengths.push(d);
          }

          rasterizeTriangles(grid, worldPos, indices);
        }
      }

      for (const childIdx of node.children ?? []) {
        visitNode(childIdx, worldMat);
      }
    };

    const scene = gltf.scenes?.[gltf.scene ?? 0] ?? { nodes: [0] };
    for (const rootNodeIdx of scene.nodes ?? []) {
      visitNode(rootNodeIdx, rootScale);
    }

    edgeLengths.sort((a, b) => a - b);
    const vMin = Number((edgeLengths[0] ?? 0.2).toFixed(3));
    const vMed = Number((edgeLengths[Math.floor(edgeLengths.length / 2)] ?? 0.5).toFixed(3));
    const vMax = Number((edgeLengths[edgeLengths.length - 1] ?? 1.3).toFixed(3));

    let validNodes = 0;
    for (let i = 0; i < grid.h.length; i += 1) {
      if (!Number.isNaN(grid.h[i])) validNodes += 1;
    }
    const coveragePct = (100 * validNodes) / grid.h.length;

    const outSiteDir = path.join(GALE_OUT_DIR, siteId);
    fs.mkdirSync(outSiteDir, { recursive: true });

    const f32Bytes = Buffer.from(grid.h.buffer, grid.h.byteOffset, grid.h.byteLength);
    const f32Path = path.join(outSiteDir, "elevation.f32");
    fs.writeFileSync(f32Path, f32Bytes);

    const sha256 = crypto.createHash("sha256").update(f32Bytes).digest("hex");
    const manifest = {
      siteId,
      grid: { x0: grid.x0, z0: grid.z0, cell: grid.cell, nx: grid.nx, nz: grid.nz },
      file: `/data/trek/gale/${siteId}/elevation.f32`,
      encoding: "float32-le",
      noData: "NaN",
      sha256,
      source: `NASA/JPL-Caltech MSL Curiosity stereo photogrammetry via Access Mars (${siteId})`,
      license: "Apache-2.0 (Access Mars · Google Creative Lab) / NASA-JPL public domain imagery",
      generatedAt: "2026-11-15T00:00:00Z",
      meshNodes: "TYPE_TILE",
      vertexSpacingM: { min: vMin, median: vMed, max: vMax },
      elevationRangeM: [Number(minY.toFixed(3)), Number(maxY.toFixed(3))],
    };

    fs.writeFileSync(
      path.join(outSiteDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    console.log(
      `[build-site-tiles] ${siteId}: ${grid.nx}x${grid.nz} (${coveragePct.toFixed(1)}% coverage), elev=[${manifest.elevationRangeM[0]}, ${manifest.elevationRangeM[1]}] m, sha256=${sha256.slice(0, 12)}…`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
