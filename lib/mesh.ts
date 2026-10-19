import {
  add,
  cameraBasis,
  cameraToWorld,
  cross,
  dot,
  faceNormal,
  norm,
  objectRotation,
  scale,
  sub,
  transformPoint,
  worldToCamera,
  type Camera,
  type Pose,
  type RGB,
  type Vec3,
} from "@/lib/math";

export type Face = {
  indices: [number, number, number];
  color: RGB;
};

export type Mesh = {
  vertices: Vec3[];
  faces: Face[];
};

const SIDES = 24;

function ring(vertices: Vec3[], y: number, radius: number): number[] {
  const ids: number[] = [];
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2;
    ids.push(vertices.length);
    vertices.push([Math.cos(a) * radius, y, Math.sin(a) * radius]);
  }
  return ids;
}

function tri(faces: Face[], a: number, b: number, c: number, color: RGB) {
  faces.push({ indices: [a, b, c], color });
}

function addTube(
  vertices: Vec3[],
  faces: Face[],
  path: Vec3[],
  radius: number,
  radial: number,
  color: RGB,
) {
  const rings: number[][] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const tangent = norm(sub(next, prev));
    const hint: Vec3 = Math.abs(dot(tangent, [0, 0, 1])) > 0.9 ? [0, 1, 0] : [0, 0, 1];
    const side = norm(cross(tangent, hint));
    const bin = norm(cross(side, tangent));
    const ids: number[] = [];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const p = add(
        path[i],
        add(scale(side, Math.cos(a) * radius), scale(bin, Math.sin(a) * radius)),
      );
      ids.push(vertices.length);
      vertices.push(p);
    }
    rings.push(ids);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      const a = rings[i][j];
      const b = rings[i][j2];
      const c = rings[i + 1][j2];
      const d = rings[i + 1][j];
      tri(faces, a, d, b, color);
      tri(faces, b, d, c, color);
    }
  }
}

/** Closed field mug: tapered body, dark lid, teal front label, handle on +X. */
export function buildMug(): Mesh {
  const vertices: Vec3[] = [];
  const faces: Face[] = [];
  const clay: RGB = [214, 184, 148];
  const clayDeep: RGB = [176, 142, 108];
  const lip: RGB = [236, 224, 206];
  const teal: RGB = [28, 118, 112];
  const lid: RGB = [58, 40, 32];
  const handle: RGB = [196, 158, 122];

  const levels = [
    { y: -0.46, r: 0.32 },
    { y: -0.18, r: 0.345 },
    { y: 0.06, r: 0.365 },
    { y: 0.28, r: 0.378 },
    { y: 0.46, r: 0.36 },
  ];
  const rings = levels.map((level) => ring(vertices, level.y, level.r));

  for (let b = 0; b < rings.length - 1; b++) {
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      const ang = ((i + 0.5) / SIDES) * Math.PI * 2;
      const facingZ = Math.cos(ang - Math.PI / 2);
      let color = clay;
      if (b === 0) color = clayDeep;
      if (b === 3) color = lip;
      if (b === 2 && facingZ > 0.55) color = teal;
      const a0 = rings[b][i];
      const a1 = rings[b][j];
      const b0 = rings[b + 1][i];
      const b1 = rings[b + 1][j];
      tri(faces, a0, b0, a1, color);
      tri(faces, a1, b0, b1, color);
    }
  }

  const bottom = vertices.length;
  vertices.push([0, levels[0].y, 0]);
  for (let i = 0; i < SIDES; i++) {
    const j = (i + 1) % SIDES;
    tri(faces, bottom, rings[0][j], rings[0][i], clayDeep);
  }

  const top = vertices.length;
  vertices.push([0, levels[levels.length - 1].y, 0]);
  const topRing = rings[rings.length - 1];
  for (let i = 0; i < SIDES; i++) {
    const j = (i + 1) % SIDES;
    tri(faces, top, topRing[i], topRing[j], lid);
  }

  const path: Vec3[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const ang = (110 - (i / steps) * 220) * (Math.PI / 180);
    path.push([0.4 + Math.cos(ang) * 0.2, Math.sin(ang) * 0.3, 0]);
  }
  addTube(vertices, faces, path, 0.048, 8, handle);

  return { vertices, faces };
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function silhouetteEdges(faces: Face[], facing: boolean[]): [number, number][] {
  const any = new Map<string, number>();
  const front = new Map<string, number>();
  for (let i = 0; i < faces.length; i++) {
    const [a, b, c] = faces[i].indices;
    const pairs: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of pairs) {
      const key = edgeKey(u, v);
      any.set(key, (any.get(key) ?? 0) + 1);
      if (facing[i]) front.set(key, (front.get(key) ?? 0) + 1);
    }
  }
  const edges: [number, number][] = [];
  for (const [key, count] of any) {
    if (count >= 1 && (front.get(key) ?? 0) === 1) {
      const [a, b] = key.split(":").map(Number);
      edges.push([a, b]);
    }
  }
  return edges;
}

function toPrint(c: RGB): RGB {
  return [
    Math.round(c[0] * 0.7 + 198 * 0.3),
    Math.round(c[1] * 0.7 + 178 * 0.3),
    Math.round(c[2] * 0.7 + 148 * 0.3),
  ];
}

/**
 * Flat cutout of `mug` at `pose`, seen by `camera`.
 * Front vertices lie on the camera-depth plane through the object center,
 * so the input camera sees the same outline. Thickness is a kraft rim.
 */
export function buildCardboard(mug: Mesh, pose: Pose, camera: Camera): Mesh {
  const R = objectRotation(pose);
  const t: Vec3 = [pose.x, pose.y, pose.z];
  const basis = cameraBasis(camera);
  const planeZ = worldToCamera(t, basis)[2];
  const thickness = 0.045;
  const world = mug.vertices.map((v) => transformPoint(R, v, t));
  const flat = world.map((v) => {
    const cam = worldToCamera(v, basis);
    const s = planeZ / cam[2];
    return cameraToWorld([cam[0] * s, cam[1] * s, planeZ], basis);
  });

  const facing = mug.faces.map((face) => {
    const a = world[face.indices[0]];
    const b = world[face.indices[1]];
    const c = world[face.indices[2]];
    const n = faceNormal(a, b, c);
    const mid = scale(add(add(a, b), c), 1 / 3);
    return dot(n, norm(sub(basis.eye, mid))) > 0;
  });

  const vertices = flat.slice();
  const faces: Face[] = [];
  for (let i = 0; i < mug.faces.length; i++) {
    if (!facing[i]) continue;
    faces.push({
      indices: mug.faces[i].indices,
      color: toPrint(mug.faces[i].color),
    });
  }

  const back = new Map<number, number>();
  const backOf = (index: number) => {
    const found = back.get(index);
    if (found !== undefined) return found;
    const id = vertices.length;
    vertices.push(add(flat[index], scale(basis.forward, thickness)));
    back.set(index, id);
    return id;
  };

  const kraft: RGB = [156, 108, 64];
  for (const [a, b] of silhouetteEdges(mug.faces, facing)) {
    const a2 = backOf(a);
    const b2 = backOf(b);
    const outward = norm(cross(sub(flat[b], flat[a]), basis.forward));
    const mid = scale(add(flat[a], flat[b]), 0.5);
    const fromCenter = norm(sub(mid, t));
    if (dot(outward, fromCenter) >= 0) {
      tri(faces, a, b, b2, kraft);
      tri(faces, a, b2, a2, kraft);
    } else {
      tri(faces, a, b2, b, kraft);
      tri(faces, a, a2, b2, kraft);
    }
  }

  return { vertices, faces };
}
