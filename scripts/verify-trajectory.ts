import { readFileSync } from "node:fs";
import { eulerToQuat, rotationDeltaDeg } from "../lib/math";
import {
  DEFAULT_THRESHOLDS,
  SPIKE_THRESHOLD_LABEL,
  TELEPORT_THRESHOLD_LABEL,
  checkTrajectory,
  parseTrajectory,
  reportToCsv,
  reportToJson,
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

const exported = JSON.parse(reportToJson(report)) as {
  thresholds: Record<string, number>;
};
assert(exported.thresholds[TELEPORT_THRESHOLD_LABEL] === DEFAULT_THRESHOLDS.teleportMeters, "export teleport label value");
assert(exported.thresholds[SPIKE_THRESHOLD_LABEL] === DEFAULT_THRESHOLDS.rotationSpikeDegrees, "export spike label value");
assert(!Object.prototype.hasOwnProperty.call(exported.thresholds, "teleportMeters"), "export does not say teleportMeters");
assert(reportToJson(report).includes(`"${TELEPORT_THRESHOLD_LABEL}"`), "export label string");
assert(report.thresholds.teleportMeters === 0.25, "threshold value unchanged");

const crlf = parseTrajectory(sampleText.replace(/\n/g, "\r\n"), "sample-crlf.csv");
const crlfFlags = checkTrajectory(crlf, DEFAULT_THRESHOLDS).flags.map((flag) => `${flag.kind}:${flag.frame}`).sort();
assert(crlfFlags.join(",") === "missing_frame:4,rotation_spike:9,teleport:7", `crlf flags ${crlfFlags.join(",")}`);

const quotedText = readFileSync("scripts/fixtures/quoted-multiline.csv", "utf8");
const quoted = parseTrajectory(quotedText, "quoted-multiline.csv");
assert(quoted.rows.length === 3, `quoted multiline kept ${quoted.rows.length} rows`);
assert(quoted.preamble.length === 1 && quoted.preamble[0].includes("Quoted multiline"), "quoted preamble ignores embedded hash");
assert(quoted.rows[0].line === 3 && quoted.rows[1].line === 5 && quoted.rows[2].line === 7, "multiline row numbers are the start line");
const quotedId = "cam\n# not a comment";
assert(quoted.rows[0].objectId === quotedId && quoted.rows[1].objectId === quotedId, "newline stays inside the object id");
assert(quoted.rows[0].errors.length === 0 && quoted.rows[0].pose !== null, "first multiline row is valid");
assert(quoted.rows[2].pose === null && quoted.rows[2].errors.some((error) => error.includes("Position")), "bad quoted position is flagged");
const quotedReport = checkTrajectory(quoted, DEFAULT_THRESHOLDS);
assert(quotedReport.invalidRows.length === 1 && quotedReport.invalidRows[0].line === 7, "bad multiline row listed at its start line");
assert(quotedReport.invalidRows[0].frame === 2, "bad multiline frame kept");
assert(quotedReport.summary.validRows + quotedReport.summary.invalidRows === quotedReport.summary.dataRows, "quoted rows are not dropped");
assert(quotedReport.flags.length === 0, "invalid multiline frame is not also a missing frame");
assert(quotedReport.steps.length === 1, "path uses the two valid multiline rows");

const commaText = readFileSync("scripts/fixtures/embedded-comma.csv", "utf8").replace(/\n/g, "\r\n");
const commaDoc = parseTrajectory(commaText, "embedded-comma.csv");
assert(commaDoc.rows.length === 3, `embedded comma kept ${commaDoc.rows.length} rows`);
assert(commaDoc.rows.every((row) => row.objectId === "alpha,beta"), "comma stays inside the object id");
assert(commaDoc.rows[1].line === 3 && commaDoc.rows[1].pose === null, "bad quoted number stays one row");
const commaReport = checkTrajectory(commaDoc, DEFAULT_THRESHOLDS);
assert(commaReport.invalidRows.length === 1 && commaReport.invalidRows[0].line === 3, "embedded comma bad row listed");
assert(commaReport.summary.dataRows === 3 && commaReport.summary.validRows === 2, "embedded comma drops nothing");
assert(commaReport.flags.length === 0 && commaReport.steps.length === 1, "invalid comma row is off the path");

const TOTAL = 4000;
const BAD_FRAME = 10;
const MISSING_FRAME = 20;
const TELEPORT_FRAME = 30;
const SPIKE_FRAME = 40;
const largeLines = ["frame,timestamp,x,y,z,roll,pitch,yaw,object_id"];
let x = 0;
let yaw = 0;
for (let frame = 0; frame < TOTAL; frame++) {
  if (frame === MISSING_FRAME) continue;
  if (frame === BAD_FRAME) {
    largeLines.push(`${frame},${frame},bad,0,0,0,0,0,"unit,A"`);
    continue;
  }
  if (frame === TELEPORT_FRAME) x += 1;
  else x += 0.05;
  if (frame === SPIKE_FRAME) yaw += 90;
  else yaw += 1;
  largeLines.push(`${frame},${frame},${x},0,0,0,0,${yaw},"unit,A"`);
}
const large = parseTrajectory(largeLines.join("\r\n") + "\r\n", "large.csv");
assert(large.rows.length === TOTAL - 1, `large row count ${large.rows.length}`);
assert(large.rows.every((row) => row.objectId === "unit,A"), "large file object ids survived embedded commas");
const largeReport = checkTrajectory(large, DEFAULT_THRESHOLDS);
assert(largeReport.summary.dataRows === large.rows.length, "large summary counts every row");
assert(largeReport.summary.validRows + largeReport.summary.invalidRows === largeReport.summary.dataRows, "large file drops nothing");
assert(largeReport.invalidRows.length === 1, "large file lists the one bad row");
assert(largeReport.invalidRows[0].frame === BAD_FRAME && largeReport.invalidRows[0].line === BAD_FRAME + 2, "large bad row number");
const largeFlags = largeReport.flags.map((flag) => `${flag.kind}:${flag.frame}`).sort();
assert(
  largeFlags.join(",") === `missing_frame:${MISSING_FRAME},rotation_spike:${SPIKE_FRAME},teleport:${TELEPORT_FRAME}`,
  `large flags ${largeFlags.join(",")}`,
);
const largeTeleport = largeReport.flags.find((flag) => flag.kind === "teleport");
const largeSpike = largeReport.flags.find((flag) => flag.kind === "rotation_spike");
assert(largeTeleport && largeSpike, "large planted flags");
close(largeTeleport.positionDelta ?? NaN, 1, "large teleport distance");
close(largeTeleport.rotationDeltaDeg ?? NaN, 1, "large teleport rotation");
close(largeSpike.rotationDeltaDeg ?? NaN, 90, "large spike");
close(largeSpike.positionDelta ?? NaN, 0.05, "large spike translation");
assert(largeReport.steps.length === largeReport.summary.validRows - 1, "large steps follow the valid chain");

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
