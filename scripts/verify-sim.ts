import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { measureChecks } from "../lib/checks";
import { depthExtent, rasterMask } from "../lib/raster";
import { CARDBOARD, MUG } from "../lib/scene";
import {
  CARDBOARD_POSE,
  DEPTH_PASS_M,
  EXAMPLE_FRAME,
  FRAME_COUNT,
  INPUT_CAMERA,
  POSES,
  SILHOUETTE_PASS,
  frameAtSpeed,
  poseErrorDeg,
} from "../lib/program";

function png(path: string, width: number, height: number, rgba: Uint8ClampedArray) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeInt32BE(crc32(body), 4 + body.length);
  return out;
  };
  const idat = deflateSync(raw);
  writeFileSync(path, Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]));
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const example = POSES[EXAMPLE_FRAME];
assert(POSES.length === FRAME_COUNT, "frame count");
assert(poseErrorDeg(example, CARDBOARD_POSE) > 20, `pose gap too small: ${poseErrorDeg(example, CARDBOARD_POSE)}`);
assert(frameAtSpeed(20, 1) === 20, "speed 1");
assert(frameAtSpeed(20, 0.5) === 10, "speed 0.5");
assert(example.yaw !== CARDBOARD_POSE.yaw || example.pitch !== CARDBOARD_POSE.pitch, "euler differs");

const started = performance.now();
const report = measureChecks(MUG, CARDBOARD);
const ms = performance.now() - started;

const rigidMask = rasterMask(MUG, example, INPUT_CAMERA, 360, 240);
const cardMask = rasterMask(CARDBOARD, null, INPUT_CAMERA, 360, 240);
png("/tmp/mask-rigid.png", 360, 240, rigidMask.color);
png("/tmp/mask-card.png", 360, 240, cardMask.color);

console.log(JSON.stringify({ ms: Math.round(ms), report, example, cardboard: CARDBOARD_POSE }, null, 2));

assert(report.rigidSilhouettePass, `rigid silhouette ${report.rigidIou}`);
assert(report.cardSilhouettePass, `card silhouette ${report.cardIou} < ${SILHOUETTE_PASS}`);
assert(report.rigidPosePass, "rigid pose should pass");
assert(!report.cardPosePass, "cardboard pose should fail");
assert(report.cardDepth < DEPTH_PASS_M, `card depth ${report.cardDepth}`);
assert(report.rigidDepth > DEPTH_PASS_M, `rigid depth ${report.rigidDepth}`);
assert(report.cardPoseError > 20, "card pose error");

let pixels = 0;
for (let i = 3; i < rigidMask.color.length; i += 4) if (rigidMask.color[i]) pixels++;
assert(pixels > 1500, `mug mask too small: ${pixels}`);
const extent = depthExtent(MUG, example, INPUT_CAMERA);
assert(extent === report.rigidDepth, "depth mismatch");

console.log("verify-sim: ok");
