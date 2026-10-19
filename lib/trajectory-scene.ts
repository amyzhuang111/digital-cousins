import {
  add,
  cross,
  dot,
  norm,
  quatToMat,
  scale,
  sub,
  transformPoint,
  type Camera,
  type Light,
  type RGB,
  type Vec3,
} from "@/lib/math";
import type { Face, Mesh } from "@/lib/mesh";
import type { PoseSample, TrajectoryRow, TrajectoryStep } from "@/lib/trajectory";

const QUIET: RGB = [86, 176, 162];
const TELEPORT: RGB = [225, 91, 74];
const SPIKE: RGB = [230, 163, 34];
const GAP: RGB = [168, 148, 112];
const MARKER: RGB = [214, 206, 190];
const CURRENT: RGB = [246, 220, 150];
const BODY: RGB = [232, 196, 120];
const FAR: RGB = [120, 176, 166];

export type TrajectoryDraw = {
  mesh: Mesh;
  pose: null;
};

export type TrajectoryScene = {
  objects: TrajectoryDraw[];
  camera: Camera;
  light: Light;
  stage: { floorY: number; extent: number };
};

function quad(faces: Face[], a: number, b: number, c: number, d: number, color: RGB) {
  faces.push({ indices: [a, b, c], color });
  faces.push({ indices: [a, c, d], color });
  faces.push({ indices: [a, c, b], color });
  faces.push({ indices: [a, d, c], color });
}

function boxBetween(a: Vec3, b: Vec3, radius: number, color: RGB): Mesh {
  const dir = norm(sub(b, a));
  const hint: Vec3 = Math.abs(dot(dir, [0, 1, 0])) > 0.85 ? [1, 0, 0] : [0, 1, 0];
  const side = norm(cross(dir, hint));
  const up = norm(cross(side, dir));
  const s = scale(side, radius);
  const u = scale(up, radius);
  const ring = (p: Vec3): Vec3[] => [
    add(add(p, s), u),
    add(sub(p, s), u),
    sub(sub(p, s), u),
    sub(add(p, s), u),
  ];
  const vertices = [...ring(a), ...ring(b)];
  const faces: Face[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(faces, i, 4 + i, 4 + j, j, color);
  }
  return { vertices, faces };
}

function octahedron(center: Vec3, radius: number, color: RGB): Mesh {
  const vertices: Vec3[] = [
    add(center, [radius, 0, 0]),
    add(center, [-radius, 0, 0]),
    add(center, [0, radius, 0]),
    add(center, [0, -radius, 0]),
    add(center, [0, 0, radius]),
    add(center, [0, 0, -radius]),
  ];
  const tris: [number, number, number][] = [
    [4, 2, 0],
    [4, 0, 3],
    [4, 3, 1],
    [4, 1, 2],
    [5, 0, 2],
    [5, 3, 0],
    [5, 1, 3],
    [5, 2, 1],
  ];
  const faces: Face[] = [];
  for (const [a, b, c] of tris) {
    faces.push({ indices: [a, b, c], color });
    faces.push({ indices: [a, c, b], color });
  }
  return { vertices, faces };
}

function frustumMesh(pose: PoseSample, length: number): Mesh {
  const R = quatToMat(pose.quat);
  const origin: Vec3 = [pose.x, pose.y, pose.z];
  const hw = length * 0.46;
  const hh = length * 0.32;
  const body = length * 0.34;
  const local: Vec3[] = [
    [0, 0, 0],
    [-hw, -hh, length],
    [hw, -hh, length],
    [hw, hh, length],
    [-hw, hh, length],
    [-body * 0.55, -body * 0.4, -body],
    [body * 0.55, -body * 0.4, -body],
    [body * 0.55, body * 0.4, -body],
    [-body * 0.55, body * 0.4, -body],
    [-body * 0.55, -body * 0.4, 0],
    [body * 0.55, -body * 0.4, 0],
    [body * 0.55, body * 0.4, 0],
    [-body * 0.55, body * 0.4, 0],
  ];
  const vertices = local.map((p) => transformPoint(R, p, origin));
  const faces: Face[] = [];
  const side = (a: number, b: number, color: RGB) => {
    faces.push({ indices: [0, a, b], color });
    faces.push({ indices: [0, b, a], color });
  };
  side(1, 2, FAR);
  side(2, 3, FAR);
  side(3, 4, FAR);
  side(4, 1, FAR);
  quad(faces, 1, 2, 3, 4, FAR);
  quad(faces, 5, 6, 10, 9, BODY);
  quad(faces, 6, 7, 11, 10, BODY);
  quad(faces, 7, 8, 12, 11, BODY);
  quad(faces, 8, 5, 9, 12, BODY);
  quad(faces, 9, 10, 11, 12, BODY);
  quad(faces, 8, 7, 6, 5, BODY);
  return { vertices, faces };
}

function pointOf(row: TrajectoryRow): Vec3 {
  const pose = row.pose!;
  return [pose.x, pose.y, pose.z];
}

function stepColor(step: TrajectoryStep | undefined): RGB {
  if (!step) return QUIET;
  if (step.teleport) return TELEPORT;
  if (step.rotationSpike) return SPIKE;
  if (step.toFrame > step.fromFrame + 1) return GAP;
  return QUIET;
}

export function buildTrajectoryScene(
  chain: TrajectoryRow[],
  steps: TrajectoryStep[],
  index: number,
  azimuth: number,
): TrajectoryScene | null {
  const posed = chain.filter((row) => row.pose && row.frame !== null);
  if (posed.length === 0) return null;
  const points = posed.map(pointOf);
  const min: Vec3 = [...points[0]];
  const max: Vec3 = [...points[0]];
  for (const p of points) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let radius = 0;
  for (const p of points) radius = Math.max(radius, Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]));
  if (radius < 1e-4) radius = 1;
  const tube = radius * 0.034;
  const marker = radius * 0.07;
  const glyph = radius * 0.2;
  const objects: TrajectoryDraw[] = [];

  for (let i = 1; i < posed.length; i++) {
    const prev = posed[i - 1];
    const next = posed[i];
    const step = steps.find(
      (item) => item.objectId === next.objectId && item.fromFrame === prev.frame && item.toFrame === next.frame,
    );
    const a = pointOf(prev);
    const b = pointOf(next);
    if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-8) continue;
    objects.push({ mesh: boxBetween(a, b, tube, stepColor(step)), pose: null });
  }

  const safeIndex = Math.min(Math.max(index, 0), posed.length - 1);
  posed.forEach((row, i) => {
    const step = steps.find((item) => item.objectId === row.objectId && item.toFrame === row.frame);
    const flagged = step?.teleport ? TELEPORT : step?.rotationSpike ? SPIKE : MARKER;
    const here = i === safeIndex;
    objects.push({
      mesh: octahedron(pointOf(row), here ? marker * 1.35 : marker * 0.72, here ? CURRENT : flagged),
      pose: null,
    });
    if (row.pose && i !== safeIndex) {
      const tick = glyph * 0.55;
      const tip = transformPoint(quatToMat(row.pose.quat), [0, 0, tick], pointOf(row));
      objects.push({ mesh: boxBetween(pointOf(row), tip, tube * 0.7, flagged), pose: null });
    }
  });

  const current = posed[safeIndex];
  if (current.pose) objects.push({ mesh: frustumMesh(current.pose, glyph), pose: null });

  return {
    objects,
    camera: {
      azimuth,
      elevation: 22,
      distance: radius * 2.85,
      fov: 28,
      lookAt: [center[0], center[1] + radius * 0.04, center[2]],
    },
    light: {
      direction: norm([0.35, 0.86, 0.38]),
      color: [1, 0.97, 0.9],
      ambient: 0.48,
    },
    stage: {
      floorY: min[1] - radius * 0.18,
      extent: radius * 1.85,
    },
  };
}
