import { readFileSync } from "node:fs";
import { eulerToQuat, rotationDeltaDeg } from "../lib/math";
import {
  DEFAULT_THRESHOLDS,
  checkTrajectory,
  parseTrajectory,
  reportToCsv,
} from "../lib/trajectory";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function close(actual: number, expected: number, label: string) {
  const err = Math.abs(actual - expected);
  assert(err < 1e-6, `${label}: expected ${expected}, got ${actual} (err ${err})`);
}

const sampleText = readFileSync("public/sample-trajectory.csv", "utf8");
const doc = parseTrajectory(sampleText, "sample-trajectory.csv");
assert(doc.rows.length === 10, `sample row count ${doc.rows.length}`);
assert(doc.rows.every((row) => row.errors.length === 0), "sample rows should be valid");
assert(doc.preamble.some((line) => line.includes("SAMPLE")), "sample preamble");

const report = checkTrajectory(doc, DEFAULT_THRESHOLDS);
const kinds = report.flags.map((flag) => `${flag.kind}:${flag.frame}`).sort();
assert(
  kinds.join(",") === "missing_frame:4,rotation_spike:9,teleport:7",
  `flags ${kinds.join(",")}`,
);
assert(report.invalidRows.length === 0, "sample has no invalid rows");

const teleport = report.flags.find((flag) => flag.kind === "teleport");
const spike = report.flags.find((flag) => flag.kind === "rotation_spike");
const gap = report.flags.find((flag) => flag.kind === "missing_frame");
assert(teleport && spike && gap, "three flag kinds");
close(teleport.positionDelta ?? NaN, 2, "teleport distance");
close(teleport.rotationDeltaDeg ?? NaN, 2, "teleport rotation stays smooth");
assert(teleport.fromFrame === 6 && teleport.toFrame === 7, "teleport endpoints");

const independent = rotationDeltaDeg(eulerToQuat(0, 0, 16), eulerToQuat(0, 0, 106));
close(independent, 90, "independent yaw delta");
close(spike.rotationDeltaDeg ?? NaN, independent, "spike matches quaternion delta");
close(spike.positionDelta ?? NaN, 0.05, "spike translation");
assert(spike.fromFrame === 8 && spike.frame === 9, "spike frame");
assert(gap.fromFrame === 3 && gap.toFrame === 5 && gap.frame === 4, "gap endpoints");

const gapStep = report.steps.find((step) => step.fromFrame === 3 && step.toFrame === 5);
assert(gapStep, "gap step recorded");
close(gapStep.positionDelta, 0.1, "gap position step");
close(gapStep.rotationDeltaDeg, 4, "gap rotation step");
assert(!gapStep.teleport && !gapStep.rotationSpike, "gap step is not a jump or a spike");

const quiet = report.steps.filter((step) => !step.teleport && !step.rotationSpike);
assert(quiet.length === 7, `quiet steps ${quiet.length}`);

const csv = reportToCsv(report);
assert(csv.includes("teleport") && csv.includes("rotation_spike") && csv.includes("missing_frame"), "csv kinds");
assert(!csv.includes("invalid_row"), "sample csv has no invalid rows");

const bad = parseTrajectory(
  "frame,timestamp,x,y,z,roll,pitch,yaw,object_id\n1,0,0,0,0,0,0,0,a\n2,0,nope,0,0,0,0,0,a\n3,0,0.1,0,0,0,0,1,a\n",
  "bad.csv",
);
assert(bad.rows.length === 3, "bad file keeps every row");
assert(bad.rows[1].errors.length > 0 && bad.rows[1].pose === null, "bad position flagged and not posed");
const badReport = checkTrajectory(bad, DEFAULT_THRESHOLDS);
assert(badReport.invalidRows.length === 1, "invalid row is reported");
assert(badReport.invalidRows[0].line === 3, "invalid line number");
assert(badReport.flags.length === 0, `bad file flags ${badReport.flags.map((f) => f.kind).join(",")}`);
assert(badReport.steps.length === 1, "one step between the two valid rows");

const quatDoc = parseTrajectory(
  JSON.stringify({
    note: "quaternion pair",
    rows: [
      { frame: 0, timestamp: 0, x: 0, y: 0, z: 0, qw: 1, qx: 0, qy: 0, qz: 0, object_id: "q" },
      { frame: 1, timestamp: 1, x: 0, y: 0, z: 0, qw: Math.SQRT1_2, qx: 0, qy: Math.SQRT1_2, qz: 0, object_id: "q" },
    ],
  }),
  "quat.json",
);
const quatReport = checkTrajectory(quatDoc, DEFAULT_THRESHOLDS);
assert(quatReport.flags.length === 1 && quatReport.flags[0].kind === "rotation_spike", "90 degree quat is a spike");
close(quatReport.flags[0].rotationDeltaDeg ?? NaN, 90, "quat yaw 90");

const dup = parseTrajectory(
  "frame,timestamp,x,y,z,roll,pitch,yaw,object_id\n1,0,0,0,0,0,0,0,a\n1,1,1,0,0,0,0,0,a\n",
  "dup.csv",
);
const dupReport = checkTrajectory(dup, DEFAULT_THRESHOLDS);
assert(dup.rows[0].errors.length === 0, "earliest duplicate stays on the path");
assert(dup.rows[1].errors.some((error) => error.startsWith("Duplicate frame")), "later duplicate is flagged");
assert(dupReport.invalidRows.length === 1 && dupReport.steps.length === 0, "duplicate is reported and not a step");
const dupAgain = checkTrajectory(dup, DEFAULT_THRESHOLDS);
assert(dupAgain.summary.validRows === 1, "a second check still keeps the earliest row");

console.log(
  JSON.stringify(
    {
      flags: report.flags.map((flag) => ({
        kind: flag.kind,
        frame: flag.frame,
        fromFrame: flag.fromFrame,
        toFrame: flag.toFrame,
        positionDelta: flag.positionDelta,
        rotationDeltaDeg: flag.rotationDeltaDeg,
      })),
      meanRotationDeltaDeg: report.summary.meanRotationDeltaDeg,
    },
    null,
    2,
  ),
);
console.log("verify-trajectory: ok");
