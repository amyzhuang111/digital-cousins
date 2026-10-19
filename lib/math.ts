export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export type Pose = {
  frame: number;
  x: number;
  y: number;
  z: number;
  roll: number;
  pitch: number;
  yaw: number;
};

export type Camera = {
  azimuth: number;
  elevation: number;
  distance: number;
  fov: number;
  lookAt: Vec3;
};

export type Light = {
  direction: Vec3;
  color: Vec3;
  ambient: number;
};

export type Basis = {
  eye: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
};

export function roundTo(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function fmt(n: number, digits: number): string {
  const v = Number(n.toFixed(digits));
  const sign = v < 0 ? "-" : "+";
  return sign + Math.abs(v).toFixed(digits);
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function len(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function norm(a: Vec3): Vec3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function deg(d: number): number {
  return (d * Math.PI) / 180;
}

type Mat3 = [number, number, number, number, number, number, number, number, number];

function mul(a: Mat3, b: Mat3): Mat3 {
  const o = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Mat3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] =
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return o;
}

function rotX(pitchDeg: number): Mat3 {
  const a = deg(pitchDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

function rotY(yawDeg: number): Mat3 {
  const a = deg(yawDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

function rotZ(rollDeg: number): Mat3 {
  const a = deg(rollDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** yaw about Y, then pitch about X, then roll about Z. Degrees. */
export function objectRotation(pose: Pose): Mat3 {
  return mul(rotY(pose.yaw), mul(rotX(pose.pitch), rotZ(pose.roll)));
}

export function transformPoint(R: Mat3, p: Vec3, t: Vec3): Vec3 {
  return [
    R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + t[0],
    R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + t[1],
    R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + t[2],
  ];
}

export function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return norm(cross(sub(b, a), sub(c, a)));
}

export function cameraBasis(cam: Camera): Basis {
  const az = deg(cam.azimuth);
  const el = deg(cam.elevation);
  const eye = add(cam.lookAt, [
    cam.distance * Math.cos(el) * Math.sin(az),
    cam.distance * Math.sin(el),
    cam.distance * Math.cos(el) * Math.cos(az),
  ]);
  const forward = norm(sub(cam.lookAt, eye));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return { eye, right, up, forward };
}

export function worldToCamera(p: Vec3, basis: Basis): Vec3 {
  const d = sub(p, basis.eye);
  return [dot(d, basis.right), dot(d, basis.up), dot(d, basis.forward)];
}

export function cameraToWorld(p: Vec3, basis: Basis): Vec3 {
  return add(
    basis.eye,
    add(add(scale(basis.right, p[0]), scale(basis.up, p[1])), scale(basis.forward, p[2])),
  );
}

export type ScreenPt = { x: number; y: number; z: number };

export function project(
  pCam: Vec3,
  width: number,
  height: number,
  fovDeg: number,
): ScreenPt | null {
  if (pCam[2] < 0.05) return null;
  const f = 1 / Math.tan(deg(fovDeg) / 2);
  const aspect = width / height;
  const ndcX = (pCam[0] / pCam[2]) * (f / aspect);
  const ndcY = (pCam[1] / pCam[2]) * f;
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
    z: pCam[2],
  };
}

export function shade(
  albedo: RGB,
  normal: Vec3,
  centroid: Vec3,
  light: Light,
  eye: Vec3,
): RGB {
  const view = norm(sub(eye, centroid));
  const ndotl = Math.max(0, dot(normal, light.direction));
  const half = norm(add(light.direction, view));
  const spec = Math.pow(Math.max(0, dot(normal, half)), 42) * 0.28 * (ndotl > 0 ? 1 : 0);
  const lit = light.ambient + (1 - light.ambient) * ndotl;
  return [
    clamp255(albedo[0] * lit * light.color[0] + spec * 255),
    clamp255(albedo[1] * lit * light.color[1] + spec * 255),
    clamp255(albedo[2] * lit * light.color[2] + spec * 255),
  ];
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbCss(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export type Quat = { w: number; x: number; y: number; z: number };

export function quatNormalize(q: Quat): Quat | null {
  const n = Math.hypot(q.w, q.x, q.y, q.z);
  if (n < 1e-12) return null;
  return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

/** Rotation angle between two orientations, in degrees. q and −q are the same rotation. */
export function rotationDeltaDeg(a: Quat, b: Quat): number {
  const dot = Math.abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z);
  const clamped = Math.min(1, dot);
  return (2 * Math.acos(clamped) * 180) / Math.PI;
}

export function quatFromMat(R: readonly number[]): Quat {
  const m00 = R[0];
  const m01 = R[1];
  const m02 = R[2];
  const m10 = R[3];
  const m11 = R[4];
  const m12 = R[5];
  const m20 = R[6];
  const m21 = R[7];
  const m22 = R[8];
  const trace = m00 + m11 + m22;
  let w: number;
  let x: number;
  let y: number;
  let z: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return quatNormalize({ w, x, y, z }) ?? { w: 1, x: 0, y: 0, z: 0 };
}

export function quatToMat(q: Quat): [number, number, number, number, number, number, number, number, number] {
  const { w, x, y, z } = q;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    1 - 2 * (yy + zz),
    2 * (xy - wz),
    2 * (xz + wy),
    2 * (xy + wz),
    1 - 2 * (xx + zz),
    2 * (yz - wx),
    2 * (xz - wy),
    2 * (yz + wx),
    1 - 2 * (xx + yy),
  ];
}

/** Same convention as objectRotation: yaw about Y, then pitch about X, then roll about Z. */
export function eulerToQuat(roll: number, pitch: number, yaw: number): Quat {
  return quatFromMat(
    objectRotation({ frame: 0, x: 0, y: 0, z: 0, roll, pitch, yaw }),
  );
}

export function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
}
