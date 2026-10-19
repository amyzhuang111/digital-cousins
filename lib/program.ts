import { angleDelta, norm, roundTo, type Camera, type Light, type Pose, type RGB, type Vec3 } from "@/lib/math";

export const SIMULATION_LABEL =
  "Interactive simulation of the research idea — not a real model";

export const PROGRAM_ID = "mug.4d";
export const FRAME_COUNT = 48;
export const SOURCE_FPS = 24;
export const PLAYBACK_FPS = 8;
export const EXAMPLE_FRAME = 20;

export const SILHOUETTE_PASS = 0.9;
export const POSE_PASS_DEG = 2;
export const DEPTH_PASS_M = 0.15;
export const FLOOR_Y = -0.78;

export const INPUT_CAMERA: Camera = {
  azimuth: 0,
  elevation: 12,
  distance: 3.75,
  fov: 30,
  lookAt: [0, 0.05, 0],
};

export const INPUT_LIGHT: Light = {
  direction: norm([0.32, 0.86, 0.4]),
  color: [1, 0.97, 0.92],
  ambient: 0.42,
};

export const INPUT_BG: [RGB, RGB] = [
  [32, 42, 40],
  [92, 78, 62],
];

export const AUDIT_CAMERA: Camera = {
  azimuth: 38,
  elevation: 18,
  distance: 3.7,
  fov: 30,
  lookAt: [0, 0.05, 0],
};

const AUDIT_LIGHT: Light = {
  direction: norm([0.15, 0.9, 0.35]),
  color: [0.96, 0.97, 1],
  ambient: 0.46,
};

export function auditLight(): Light {
  return AUDIT_LIGHT;
}

function buildPoses(): Pose[] {
  const poses: Pose[] = [];
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const t = (frame / FRAME_COUNT) * Math.PI * 2;
    poses.push({
      frame,
      x: roundTo(0.62 * Math.sin(t), 3),
      y: roundTo(0.15 * Math.sin(2 * t), 3),
      z: roundTo(0.4 * Math.cos(t), 3),
      yaw: roundTo(-18 + 100 * (0.5 - 0.5 * Math.cos(t)), 2),
      pitch: roundTo(11 * Math.sin(t), 2),
      roll: roundTo(14 * Math.sin(2 * t), 2),
    });
  }
  return poses;
}

/** Hand-written trajectory. The table on the page prints these values. */
export const POSES: readonly Pose[] = buildPoses();

/**
 * Billboard fit at the example frame.
 * The sheet faces the input camera: yaw = azimuth, pitch = −elevation, roll = 0.
 * Position is the rigid program's position. Orientation is not.
 */
export const CARDBOARD_POSE: Pose = {
  frame: EXAMPLE_FRAME,
  x: POSES[EXAMPLE_FRAME].x,
  y: POSES[EXAMPLE_FRAME].y,
  z: POSES[EXAMPLE_FRAME].z,
  roll: 0,
  pitch: roundTo(-INPUT_CAMERA.elevation, 2),
  yaw: roundTo(INPUT_CAMERA.azimuth, 2),
};

export type Cousin = {
  id: string;
  name: string;
  blurb: string;
  camera: Camera;
  light: Light;
  background: [RGB, RGB];
  speed: number;
};

export const COUSINS: readonly Cousin[] = [
  {
    id: "cousin-a",
    name: "Side aisle",
    blurb: "Same clock. The camera steps to the side.",
    camera: {
      azimuth: -44,
      elevation: 14,
      distance: 3.85,
      fov: 30,
      lookAt: [0, 0.05, 0],
    },
    light: INPUT_LIGHT,
    background: INPUT_BG,
    speed: 1,
  },
  {
    id: "cousin-b",
    name: "Warm key",
    blurb: "Same path. A tungsten key from camera right.",
    camera: {
      azimuth: 8,
      elevation: 11,
      distance: 3.65,
      fov: 30,
      lookAt: [0, 0.05, 0],
    },
    light: {
      direction: norm([-0.62, 0.7, 0.35]),
      color: [1.28, 0.74, 0.42],
      ambient: 0.36,
    },
    background: [
      [42, 26, 18],
      [92, 58, 32],
    ],
    speed: 1,
  },
  {
    id: "cousin-c",
    name: "Half time",
    blurb: "Same camera and light. The clock runs at half speed.",
    camera: INPUT_CAMERA,
    light: INPUT_LIGHT,
    background: INPUT_BG,
    speed: 0.5,
  },
  {
    id: "cousin-d",
    name: "High three-quarter",
    blurb: "Looking down, with a cooler fill.",
    camera: {
      azimuth: 52,
      elevation: 40,
      distance: 4.05,
      fov: 32,
      lookAt: [0, 0.02, 0],
    },
    light: {
      direction: norm([0.2, 0.95, 0.2]),
      color: [0.76, 0.86, 1.14],
      ambient: 0.52,
    },
    background: [
      [20, 28, 38],
      [44, 52, 60],
    ],
    speed: 1,
  },
];

export function frameAtSpeed(playhead: number, speed: number): number {
  const raw = Math.round(playhead * speed);
  return ((raw % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
}

export function poseErrorDeg(a: Pose, b: Pose): number {
  return Math.max(
    angleDelta(a.roll, b.roll),
    angleDelta(a.pitch, b.pitch),
    angleDelta(a.yaw, b.yaw),
  );
}

export function timecode(frame: number): string {
  const seconds = frame / SOURCE_FPS;
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 100);
  return `00:${String(whole).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}

export function lightStamp(light: Light): Vec3 {
  return [
    roundTo(light.direction[0], 2),
    roundTo(light.direction[1], 2),
    roundTo(light.direction[2], 2),
  ];
}
