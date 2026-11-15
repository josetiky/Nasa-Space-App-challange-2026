#!/usr/bin/env node
/**
 * Ortofotos de Gale · paso 1 de 2 (lo usa scripts/trek/build_site_orthophotos.py).
 * Decodifica las mallas TYPE_TILE de Access Mars (glTF + Draco) con POSICIÓN y TEXCOORD_0 y las vuelca,
 * ya en coordenadas de mundo (escala de escena 0.01 × 100 = 1 m), a un binario por escena:
 *
 *   <out>/<siteId>.mesh.bin
 *     u32 nTiles
 *     por tile: u8[8] id (ASCII) · u32 nTriangles · f32[nTriangles·3·5] (x, y, z, u, v por vértice)
 *
 * Mismo descodificador Draco y misma escala que scripts/trek/build-site-tiles.mjs (elevación), así que
 * la ortofoto queda alineada nodo a nodo con public/data/trek/gale/<siteId>/elevation.f32.
 *
 * Uso: node scripts/trek/dump-site-meshes.mjs <dirTerrenoAccessMars> <dirSalida>
 *   p. ej. node scripts/trek/dump-site-meshes.mjs ../access-mars/public/terrain .cache/ortho
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const DRACO_DIR = path.join(ROOT, "public/draco");
const SITES = ["landing_site", "pahrump_hills", "marias_pass", "murray_buttes", "live_site"];

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
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("Not a valid GLB file");
  const jsonLen = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLen).toString("utf8"));
  return { gltf, binChunk: buffer.subarray(20 + jsonLen + 8) };
}

function mat4Multiply(a, b) {
  const out = new Float64Array(16);
  for (let col = 0; col < 4; col += 1)
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  return out;
}

function mat4FromNode(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16)
    return Float64Array.from(node.matrix);
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const x2 = qx + qx,
    y2 = qy + qy,
    z2 = qz + qz;
  const xx = qx * x2,
    xy = qx * y2,
    xz = qx * z2,
    yy = qy * y2,
    yz = qy * z2,
    zz = qz * z2;
  const wx = qw * x2,
    wy = qw * y2,
    wz = qw * z2;
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

function decode(draco, binChunk, bufferView, ext) {
  const off = bufferView.byteOffset ?? 0;
  const slice = binChunk.subarray(off, off + bufferView.byteLength);
  const decoder = new draco.Decoder();
  const buffer = new draco.DecoderBuffer();
  buffer.Init(new Int8Array(slice.buffer, slice.byteOffset, slice.byteLength), slice.byteLength);
  const mesh = new draco.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw new Error(`Draco decode failed: ${status.error_msg()}`);
  const n = mesh.num_points();
  const read = (uid, comps) => {
    const attr = decoder.GetAttributeByUniqueId(mesh, uid);
    const arr = new draco.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, attr, arr);
    const out = new Float32Array(n * comps);
    for (let i = 0; i < n * comps; i += 1) out[i] = arr.GetValue(i);
    draco.destroy(arr);
    return out;
  };
  const positions = read(ext.attributes.POSITION, 3);
  const uvs = read(ext.attributes.TEXCOORD_0, 2);
  const nf = mesh.num_faces();
  const face = new draco.DracoInt32Array();
  const indices = new Uint32Array(nf * 3);
  for (let f = 0; f < nf; f += 1) {
    decoder.GetFaceFromMesh(mesh, f, face);
    indices[f * 3] = face.GetValue(0);
    indices[f * 3 + 1] = face.GetValue(1);
    indices[f * 3 + 2] = face.GetValue(2);
  }
  draco.destroy(face);
  draco.destroy(mesh);
  draco.destroy(buffer);
  draco.destroy(decoder);
  return { positions, uvs, indices };
}

async function main() {
  const [inDir, outDir] = process.argv.slice(2);
  if (!inDir || !outDir) {
    console.error("Uso: node scripts/trek/dump-site-meshes.mjs <dirTerrenoAccessMars> <dirSalida>");
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const draco = await loadDracoDecoder();
  const rootScale = Float64Array.from([100, 0, 0, 0, 0, 100, 0, 0, 0, 0, 100, 0, 0, 0, 0, 1]);

  for (const siteId of SITES) {
    const { gltf, binChunk } = parseGlb(fs.readFileSync(path.join(inDir, siteId, "terrain.glb")));
    const tiles = [];
    const visit = (idx, parent) => {
      const node = gltf.nodes[idx];
      if (!node) return;
      const m = mat4Multiply(parent, mat4FromNode(node));
      const name = node.name || "";
      const id = /___ID_(\d{8})___/.exec(name)?.[1];
      if (name.includes("TYPE_TILE") && id && typeof node.mesh === "number") {
        const tris = [];
        for (const prim of gltf.meshes[node.mesh].primitives ?? []) {
          const ext = prim.extensions?.KHR_draco_mesh_compression;
          if (!ext) continue;
          const { positions, uvs, indices } = decode(
            draco,
            binChunk,
            gltf.bufferViews[ext.bufferView],
            ext,
          );
          for (const vi of indices) {
            const x = positions[vi * 3],
              y = positions[vi * 3 + 1],
              z = positions[vi * 3 + 2];
            tris.push(
              m[0] * x + m[4] * y + m[8] * z + m[12],
              m[1] * x + m[5] * y + m[9] * z + m[13],
              m[2] * x + m[6] * y + m[10] * z + m[14],
              uvs[vi * 2],
              uvs[vi * 2 + 1],
            );
          }
        }
        tiles.push({ id, data: Float32Array.from(tris) });
      }
      for (const c of node.children ?? []) visit(c, m);
    };
    const scene = gltf.scenes?.[gltf.scene ?? 0] ?? { nodes: [0] };
    for (const r of scene.nodes ?? []) visit(r, rootScale);

    const parts = [];
    const head = Buffer.alloc(4);
    head.writeUInt32LE(tiles.length, 0);
    parts.push(head);
    let nTri = 0;
    for (const t of tiles) {
      const h = Buffer.alloc(12);
      h.write(t.id, 0, 8, "ascii");
      h.writeUInt32LE(t.data.length / 15, 8);
      parts.push(h, Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength));
      nTri += t.data.length / 15;
    }
    fs.writeFileSync(path.join(outDir, `${siteId}.mesh.bin`), Buffer.concat(parts));
    console.log(`[dump-site-meshes] ${siteId}: ${tiles.length} tiles, ${nTri} triángulos`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
