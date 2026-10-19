import {
  add,
  cameraBasis,
  faceNormal,
  norm,
  objectRotation,
  project,
  rgbCss,
  scale,
  shade,
  sub,
  transformPoint,
  worldToCamera,
  dot,
  type Camera,
  type Light,
  type Pose,
  type RGB,
  type Vec3,
} from "@/lib/math";
import type { Mesh } from "@/lib/mesh";
import { FLOOR_Y } from "@/lib/program";

export type DrawObject = {
  mesh: Mesh;
  pose: Pose | null;
};

type Tri = {
  depth: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  color: string;
};

function pushMesh(
  tris: Tri[],
  mesh: Mesh,
  pose: Pose | null,
  camera: Camera,
  light: Light,
  width: number,
  height: number,
) {
  const basis = cameraBasis(camera);
  const R = pose ? objectRotation(pose) : null;
  const t: Vec3 | null = pose ? [pose.x, pose.y, pose.z] : null;
  const world = mesh.vertices.map((v) => (R && t ? transformPoint(R, v, t) : v));

  for (const face of mesh.faces) {
    const a = world[face.indices[0]];
    const b = world[face.indices[1]];
    const c = world[face.indices[2]];
    const n = faceNormal(a, b, c);
    if (n[0] === 0 && n[1] === 0 && n[2] === 0) continue;
    const mid = scale(add(add(a, b), c), 1 / 3);
    if (dot(n, norm(sub(basis.eye, mid))) <= 0) continue;
    const sa = project(worldToCamera(a, basis), width, height, camera.fov);
    const sb = project(worldToCamera(b, basis), width, height, camera.fov);
    const sc = project(worldToCamera(c, basis), width, height, camera.fov);
    if (!sa || !sb || !sc) continue;
    const rgb = shade(face.color, n, mid, light, basis.eye);
    tris.push({
      depth: (sa.z + sb.z + sc.z) / 3,
      ax: sa.x,
      ay: sa.y,
      bx: sb.x,
      by: sb.y,
      cx: sc.x,
      cy: sc.y,
      color: rgbCss(rgb),
    });
  }
}

function pushDisc(
  tris: Tri[],
  center: Vec3,
  radius: number,
  color: RGB,
  camera: Camera,
  light: Light,
  width: number,
  height: number,
  segments: number,
) {
  const mesh: Mesh = { vertices: [center], faces: [] };
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    mesh.vertices.push([
      center[0] + Math.cos(a) * radius,
      center[1],
      center[2] + Math.sin(a) * radius,
    ]);
  }
  for (let i = 0; i < segments; i++) {
    const j = (i % segments) + 1;
    const k = ((i + 1) % segments) + 1;
    mesh.faces.push({ indices: [0, k, j], color });
  }
  pushMesh(tris, mesh, null, camera, light, width, height);
}

function pushGrid(
  tris: Tri[],
  camera: Camera,
  light: Light,
  width: number,
  height: number,
  floorY: number,
  extent: number,
) {
  const y = floorY + Math.max(extent * 0.004, 0.008);
  const color: RGB = [108, 100, 86];
  const step = extent / 4;
  const half = Math.max(extent * 0.003, 0.006);
  for (let x = -extent; x <= extent + 1e-6; x += step) {
    const mesh: Mesh = {
      vertices: [
        [x - half, y, -extent],
        [x + half, y, -extent],
        [x + half, y, extent],
        [x - half, y, extent],
      ],
      faces: [
        { indices: [0, 1, 2], color },
        { indices: [0, 2, 3], color },
      ],
    };
    pushMesh(tris, mesh, null, camera, light, width, height);
  }
  for (let z = -extent; z <= extent + 1e-6; z += step) {
    const mesh: Mesh = {
      vertices: [
        [-extent, y, z - half],
        [extent, y, z - half],
        [extent, y, z + half],
        [-extent, y, z + half],
      ],
      faces: [
        { indices: [0, 1, 2], color },
        { indices: [0, 2, 3], color },
      ],
    };
    pushMesh(tris, mesh, null, camera, light, width, height);
  }
}

export function drawBeauty(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: {
    camera: Camera;
    light: Light;
    background: [RGB, RGB];
    objects: DrawObject[];
    shadow: Vec3 | null;
    stage?: { floorY: number; extent: number };
  },
) {
  const floorY = opts.stage?.floorY ?? FLOOR_Y;
  const gridExtent = opts.stage?.extent ?? 1.5;
  const floorSpan = opts.stage ? opts.stage.extent * 4 : 8;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, rgbCss(opts.background[0]));
  sky.addColorStop(1, rgbCss(opts.background[1]));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const tris: Tri[] = [];
  const floor: Mesh = {
    vertices: [
      [-floorSpan, floorY, -floorSpan],
      [floorSpan, floorY, -floorSpan],
      [floorSpan, floorY, floorSpan],
      [-floorSpan, floorY, floorSpan],
    ],
    faces: [
      { indices: [0, 1, 2], color: [78, 70, 58] },
      { indices: [0, 2, 3], color: [68, 62, 52] },
    ],
  };
  pushMesh(tris, floor, null, opts.camera, opts.light, width, height);
  pushGrid(tris, opts.camera, opts.light, width, height, floorY, gridExtent);
  if (opts.shadow) {
    pushDisc(
      tris,
      [opts.shadow[0], floorY + Math.max(gridExtent * 0.002, 0.004), opts.shadow[2]],
      0.42,
      [24, 26, 22],
      opts.camera,
      opts.light,
      width,
      height,
      18,
    );
  }
  for (const object of opts.objects) {
    pushMesh(tris, object.mesh, object.pose, opts.camera, opts.light, width, height);
  }
  tris.sort((a, b) => b.depth - a.depth);

  for (const tri of tris) {
    ctx.beginPath();
    ctx.moveTo(tri.ax, tri.ay);
    ctx.lineTo(tri.bx, tri.by);
    ctx.lineTo(tri.cx, tri.cy);
    ctx.closePath();
    ctx.fillStyle = tri.color;
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    width * 0.18,
    width * 0.5,
    height * 0.45,
    width * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
