import {
  cameraBasis,
  faceNormal,
  norm,
  objectRotation,
  project,
  scale,
  sub,
  transformPoint,
  worldToCamera,
  add,
  dot,
  type Camera,
  type Pose,
  type Vec3,
} from "@/lib/math";
import type { Mesh } from "@/lib/mesh";

export type FrameBuffer = {
  color: Uint8ClampedArray;
  width: number;
  height: number;
};

function edge(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function drawTriangle(
  s0: { x: number; y: number; z: number },
  s1: { x: number; y: number; z: number },
  s2: { x: number; y: number; z: number },
  color: Uint8ClampedArray,
  zbuf: Float32Array,
  w: number,
  h: number,
) {
  const area = edge(s0.x, s0.y, s1.x, s1.y, s2.x, s2.y);
  if (Math.abs(area) < 0.5) return;
  const minX = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(s0.x, s1.x, s2.x)));
  const minY = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(s0.y, s1.y, s2.y)));
  if (maxX < minX || maxY < minY) return;

  const dW0dx = s1.y - s2.y;
  const dW0dy = s2.x - s1.x;
  const dW1dx = s2.y - s0.y;
  const dW1dy = s0.x - s2.x;
  const dW2dx = s0.y - s1.y;
  const dW2dy = s1.x - s0.x;

  const startX = minX + 0.5;
  const startY = minY + 0.5;
  let w0row = edge(s1.x, s1.y, s2.x, s2.y, startX, startY);
  let w1row = edge(s2.x, s2.y, s0.x, s0.y, startX, startY);
  let w2row = edge(s0.x, s0.y, s1.x, s1.y, startX, startY);
  const iz0 = 1 / s0.z;
  const iz1 = 1 / s1.z;
  const iz2 = 1 / s2.z;

  for (let y = minY; y <= maxY; y++) {
    let w0 = w0row;
    let w1 = w1row;
    let w2 = w2row;
    const row = y * w;
    for (let x = minX; x <= maxX; x++) {
      const inside =
        (w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0);
      if (inside) {
        const b0 = w0 / area;
        const b1 = w1 / area;
        const b2 = w2 / area;
        const z = 1 / (b0 * iz0 + b1 * iz1 + b2 * iz2);
        const i = row + x;
        if (z < zbuf[i]) {
          zbuf[i] = z;
          const o = i * 4;
          color[o] = 255;
          color[o + 1] = 255;
          color[o + 2] = 255;
          color[o + 3] = 255;
        }
      }
      w0 += dW0dx;
      w1 += dW1dx;
      w2 += dW2dx;
    }
    w0row += dW0dy;
    w1row += dW1dy;
    w2row += dW2dy;
  }
}

/** Occupancy mask of a mesh. `pose` null means vertices are already in world space. */
export function rasterMask(
  mesh: Mesh,
  pose: Pose | null,
  camera: Camera,
  width: number,
  height: number,
): FrameBuffer {
  const color = new Uint8ClampedArray(width * height * 4);
  const zbuf = new Float32Array(width * height);
  zbuf.fill(Infinity);
  const basis = cameraBasis(camera);
  const R = pose ? objectRotation(pose) : null;
  const t: Vec3 | null = pose ? [pose.x, pose.y, pose.z] : null;
  const world = mesh.vertices.map((v) => (R && t ? transformPoint(R, v, t) : v));

  for (const face of mesh.faces) {
    const a = world[face.indices[0]];
    const b = world[face.indices[1]];
    const c = world[face.indices[2]];
    const n = faceNormal(a, b, c);
    const mid = scale(add(add(a, b), c), 1 / 3);
    if (dot(n, norm(sub(basis.eye, mid))) <= 0) continue;
    const ca = worldToCamera(a, basis);
    const cb = worldToCamera(b, basis);
    const cc = worldToCamera(c, basis);
    const sa = project(ca, width, height, camera.fov);
    const sb = project(cb, width, height, camera.fov);
    const sc = project(cc, width, height, camera.fov);
    if (!sa || !sb || !sc) continue;
    drawTriangle(sa, sb, sc, color, zbuf, width, height);
  }

  return { color, width, height };
}

export function iou(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let inter = 0;
  let union = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 3; i < n; i += 4) {
    const aa = a[i] > 0;
    const bb = b[i] > 0;
    if (aa || bb) union++;
    if (aa && bb) inter++;
  }
  return union === 0 ? 0 : inter / union;
}

export function depthExtent(mesh: Mesh, pose: Pose | null, camera: Camera): number {
  const basis = cameraBasis(camera);
  const R = pose ? objectRotation(pose) : null;
  const t: Vec3 | null = pose ? [pose.x, pose.y, pose.z] : null;
  let min = Infinity;
  let max = -Infinity;
  for (const v of mesh.vertices) {
    const world = R && t ? transformPoint(R, v, t) : v;
    const z = worldToCamera(world, basis)[2];
    if (z < min) min = z;
    if (z > max) max = z;
  }
  return max - min;
}
