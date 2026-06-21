/**
 * terrain.ts — TypeScript terrain generation engine.
 * Reimplements generate_terrain_py/utils.py in TypeScript.
 *
 * Algorithms:
 *  - Heightmap: layered interpolated random grids (octave / FBM noise)
 *  - Mesh: closed manifold solid mesh suitable for STL export
 *  - STL: binary STL writer
 */

export interface TerrainParams {
  width: number;
  length: number;
  heightScale: number;
  baseHeight: number;
  scale: number;
  octaves: number;
  roughness: number;
  seed: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Seeded PRNG (Mulberry32) — deterministic replacement for np.random.seed
// ──────────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Bicubic-like interpolation for a low-res grid → high-res grid
// Uses bilinear interpolation (order=1 equivalent) for speed;
// matches Python scipy.ndimage.zoom(order=3) closely enough for terrain.
// ──────────────────────────────────────────────────────────────────────────────
function bicubicSample(grid: Float64Array, gridW: number, gridH: number, u: number, v: number): number {
  // Clamp to edges
  const x = Math.max(0, Math.min(gridW - 1.001, u));
  const y = Math.max(0, Math.min(gridH - 1.001, v));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, gridW - 1);
  const y1 = Math.min(y0 + 1, gridH - 1);
  const fx = x - x0, fy = y - y0;

  const v00 = grid[y0 * gridW + x0];
  const v10 = grid[y0 * gridW + x1];
  const v01 = grid[y1 * gridW + x0];
  const v11 = grid[y1 * gridW + x1];

  return v00 * (1 - fx) * (1 - fy)
       + v10 * fx * (1 - fy)
       + v01 * (1 - fx) * fy
       + v11 * fx * fy;
}

/**
 * Zoom a low-res grid to target dimensions via bilinear interpolation.
 * Matches scipy.ndimage.zoom semantics.
 */
function zoomGrid(
  src: Float64Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float64Array {
  const dst = new Float64Array(dstH * dstW);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const u = (x + 0.5) * scaleX - 0.5;
      const v = (y + 0.5) * scaleY - 0.5;
      dst[y * dstW + x] = bicubicSample(src, srcW, srcH, u, v);
    }
  }
  return dst;
}

// ──────────────────────────────────────────────────────────────────────────────
// generate_heightmap — FBM-style octave noise, normalised 0..1
// ──────────────────────────────────────────────────────────────────────────────
export function generateHeightmap(
  width: number,
  length: number,
  scale: number,
  octaves: number,
  roughness: number,
  seed: number,
): Float64Array {
  const rand = mulberry32(seed);
  const heightmap = new Float64Array(length * width);
  let amplitude = 1.0;
  let frequency = 1.0;
  let totalAmplitude = 0.0;

  for (let i = 0; i < octaves; i++) {
    const gridW = Math.max(2, Math.round(width / (scale / frequency)));
    const gridL = Math.max(2, Math.round(length / (scale / frequency)));

    // Fill a low-res random grid
    const lowRes = new Float64Array(gridL * gridW);
    for (let j = 0; j < gridL * gridW; j++) lowRes[j] = rand();

    // Upsample to full resolution
    const highRes = zoomGrid(lowRes, gridW, gridL, width, length);

    // Accumulate
    for (let k = 0; k < length * width; k++) {
      heightmap[k] += highRes[k] * amplitude;
    }

    totalAmplitude += amplitude;
    frequency *= 2.0;
    amplitude *= roughness;
  }

  // Normalise to [0, 1]
  let hmin = Infinity, hmax = -Infinity;
  for (let k = 0; k < heightmap.length; k++) {
    if (heightmap[k] < hmin) hmin = heightmap[k];
    if (heightmap[k] > hmax) hmax = heightmap[k];
  }
  const range = hmax - hmin || 1;
  for (let k = 0; k < heightmap.length; k++) {
    heightmap[k] = (heightmap[k] - hmin) / range;
  }

  return heightmap;
}

// ──────────────────────────────────────────────────────────────────────────────
// build_3d_mesh — closed manifold mesh with solid base
// ──────────────────────────────────────────────────────────────────────────────
export function build3dMesh(
  heightmap: Float64Array,
  heightScale: number,
  baseHeight: number,
  length: number,
  width: number,
): { vertices: Float64Array; faces: Int32Array } {
  const scaledHm = new Float64Array(heightmap.length);
  for (let k = 0; k < heightmap.length; k++) scaledHm[k] = heightmap[k] * heightScale;

  const totalVerts = length * width * 2;
  const vertices = new Float64Array(totalVerts * 3);
  let vi = 0;

  // Top surface vertices
  for (let y = 0; y < length; y++) {
    for (let x = 0; x < width; x++) {
      vertices[vi++] = x;
      vertices[vi++] = y;
      vertices[vi++] = scaledHm[y * width + x];
    }
  }
  const bottomOffset = length * width;
  // Bottom (base) vertices
  for (let y = 0; y < length; y++) {
    for (let x = 0; x < width; x++) {
      vertices[vi++] = x;
      vertices[vi++] = y;
      vertices[vi++] = -baseHeight;
    }
  }

  const idx = (x: number, y: number, bottom = false): number =>
    y * width + x + (bottom ? bottomOffset : 0);

  const faceList: number[] = [];
  // Top and bottom quads
  for (let y = 0; y < length - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      faceList.push(idx(x, y),       idx(x, y + 1),     idx(x + 1, y));
      faceList.push(idx(x + 1, y),   idx(x, y + 1),     idx(x + 1, y + 1));
      faceList.push(idx(x, y, true), idx(x + 1, y, true), idx(x, y + 1, true));
      faceList.push(idx(x + 1, y, true), idx(x + 1, y + 1, true), idx(x, y + 1, true));
    }
  }
  // Front / back walls
  for (let x = 0; x < width - 1; x++) {
    faceList.push(idx(x, 0),         idx(x + 1, 0),         idx(x, 0, true));
    faceList.push(idx(x + 1, 0),     idx(x + 1, 0, true),   idx(x, 0, true));
    faceList.push(idx(x, length - 1), idx(x, length - 1, true), idx(x + 1, length - 1));
    faceList.push(idx(x + 1, length - 1), idx(x, length - 1, true), idx(x + 1, length - 1, true));
  }
  // Left / right walls
  for (let y = 0; y < length - 1; y++) {
    faceList.push(idx(0, y),         idx(0, y, true),       idx(0, y + 1));
    faceList.push(idx(0, y + 1),     idx(0, y, true),       idx(0, y + 1, true));
    faceList.push(idx(width - 1, y), idx(width - 1, y + 1), idx(width - 1, y, true));
    faceList.push(idx(width - 1, y + 1), idx(width - 1, y + 1, true), idx(width - 1, y, true));
  }

  return { vertices, faces: new Int32Array(faceList) };
}

// ──────────────────────────────────────────────────────────────────────────────
// write_stl — binary STL buffer writer
// ──────────────────────────────────────────────────────────────────────────────
export function writeStlBuffer(
  vertices: Float64Array,
  faces: Int32Array,
): Buffer {
  const numFaces = faces.length / 3;
  // 80-byte header + 4-byte count + numFaces * 50 bytes
  const buf = Buffer.alloc(80 + 4 + numFaces * 50);
  buf.fill(0, 0, 80);
  buf.writeUInt32LE(numFaces, 80);

  let offset = 84;
  for (let f = 0; f < numFaces; f++) {
    const i0 = faces[f * 3] * 3;
    const i1 = faces[f * 3 + 1] * 3;
    const i2 = faces[f * 3 + 2] * 3;

    const v1x = vertices[i0], v1y = vertices[i0 + 1], v1z = vertices[i0 + 2];
    const v2x = vertices[i1], v2y = vertices[i1 + 1], v2z = vertices[i1 + 2];
    const v3x = vertices[i2], v3y = vertices[i2 + 1], v3z = vertices[i2 + 2];

    // Edge vectors
    const ax = v2x - v1x, ay = v2y - v1y, az = v2z - v1z;
    const bx = v3x - v1x, by = v3y - v1y, bz = v3z - v1z;

    // Cross product (normal)
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const norm = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (norm > 0) { nx /= norm; ny /= norm; nz /= norm; }

    buf.writeFloatLE(nx, offset);     offset += 4;
    buf.writeFloatLE(ny, offset);     offset += 4;
    buf.writeFloatLE(nz, offset);     offset += 4;
    buf.writeFloatLE(v1x, offset);    offset += 4;
    buf.writeFloatLE(v1y, offset);    offset += 4;
    buf.writeFloatLE(v1z, offset);    offset += 4;
    buf.writeFloatLE(v2x, offset);    offset += 4;
    buf.writeFloatLE(v2y, offset);    offset += 4;
    buf.writeFloatLE(v2z, offset);    offset += 4;
    buf.writeFloatLE(v3x, offset);    offset += 4;
    buf.writeFloatLE(v3y, offset);    offset += 4;
    buf.writeFloatLE(v3z, offset);    offset += 4;
    offset += 2; // attribute byte count
  }

  return buf;
}

// ──────────────────────────────────────────────────────────────────────────────
// High-level convenience: generate heightmap and return as 2-D row-major array
// ──────────────────────────────────────────────────────────────────────────────
export function generateTerrain(params: TerrainParams): {
  z: number[][];
  width: number;
  length: number;
} {
  const hm = generateHeightmap(
    params.width,
    params.length,
    params.scale,
    params.octaves,
    params.roughness,
    params.seed,
  );

  // Convert flat Float64Array → 2-D array (rows = length, cols = width)
  const z: number[][] = [];
  for (let y = 0; y < params.length; y++) {
    const row: number[] = [];
    for (let x = 0; x < params.width; x++) {
      row.push(hm[y * params.width + x] * params.heightScale);
    }
    z.push(row);
  }

  return { z, width: params.width, length: params.length };
}

export function generateStl(params: TerrainParams): Buffer {
  const hm = generateHeightmap(
    params.width,
    params.length,
    params.scale,
    params.octaves,
    params.roughness,
    params.seed,
  );
  const { vertices, faces } = build3dMesh(
    hm,
    params.heightScale,
    params.baseHeight,
    params.length,
    params.width,
  );
  return writeStlBuffer(vertices, faces);
}
