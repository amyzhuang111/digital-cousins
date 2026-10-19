import {
  eulerToQuat,
  quatNormalize,
  rotationDeltaDeg,
  type Quat,
} from "@/lib/math";

export const TOOL_LABEL =
  "Works on exported pose trajectories — not a reconstruction model.";

export const SAMPLE_LABEL =
  "SAMPLE trajectory — synthetic numbers for trying the checker. Not a capture.";

export const DEFAULT_TELEPORT_M = 0.25;
export const DEFAULT_SPIKE_DEG = 20;

/** JSON export key. Same words as the checker control. */
export const TELEPORT_THRESHOLD_LABEL = "Teleport, file units";
/** JSON export key. Same words as the checker control. */
export const SPIKE_THRESHOLD_LABEL = "Rotation spike, degrees";

export const STORAGE_KEY = "pose-trajectory-tool-v1";

export type Thresholds = {
  teleportMeters: number;
  rotationSpikeDegrees: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  teleportMeters: DEFAULT_TELEPORT_M,
  rotationSpikeDegrees: DEFAULT_SPIKE_DEG,
};

export type PoseSample = {
  x: number;
  y: number;
  z: number;
  quat: Quat;
  roll: number | null;
  pitch: number | null;
  yaw: number | null;
  quaternion: Quat | null;
  rotationSource: "euler" | "quaternion";
};

export type TrajectoryRow = {
  line: number;
  frame: number | null;
  timestamp: number | null;
  objectId: string;
  pose: PoseSample | null;
  errors: string[];
  warnings: string[];
};

export type ParsedTrajectory = {
  filename: string;
  preamble: string[];
  rows: TrajectoryRow[];
  format: "csv" | "json";
};

export type FlagKind = "missing_frame" | "teleport" | "rotation_spike";

export type TrajectoryFlag = {
  frame: number;
  objectId: string;
  kind: FlagKind;
  fromFrame: number | null;
  toFrame: number | null;
  positionDelta: number | null;
  rotationDeltaDeg: number | null;
  detail: string;
};

export type TrajectoryStep = {
  objectId: string;
  fromFrame: number;
  toFrame: number;
  positionDelta: number;
  rotationDeltaDeg: number;
  teleport: boolean;
  rotationSpike: boolean;
};

export type InvalidRowReport = {
  line: number;
  frame: number | null;
  objectId: string;
  errors: string[];
};

export type CheckerReport = {
  note: string;
  filename: string;
  thresholds: Thresholds;
  flags: TrajectoryFlag[];
  steps: TrajectoryStep[];
  invalidRows: InvalidRowReport[];
  summary: {
    dataRows: number;
    validRows: number;
    invalidRows: number;
    meanRotationDeltaDeg: number | null;
    maxRotationDeltaDeg: number | null;
    flagCount: number;
  };
};

const HEADER_ALIASES: Record<string, string> = {
  frame: "frame",
  frame_id: "frame",
  frame_index: "frame",
  frameid: "frame",
  timestamp: "timestamp",
  time: "timestamp",
  t: "timestamp",
  x: "x",
  tx: "x",
  px: "x",
  y: "y",
  ty: "y",
  py: "y",
  z: "z",
  tz: "z",
  pz: "z",
  roll: "roll",
  rx: "roll",
  pitch: "pitch",
  ry: "pitch",
  yaw: "yaw",
  rz: "yaw",
  qw: "qw",
  qx: "qx",
  qy: "qy",
  qz: "qz",
  object_id: "objectId",
  object: "objectId",
  objectid: "objectId",
  camera_id: "objectId",
  image_id: "objectId",
  id: "objectId",
};

function canonicalHeader(name: string): string | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[key] ?? null;
}

type CsvRecord = {
  line: number;
  cells: string[];
  unclosed: boolean;
};

function parseCsvDocument(text: string): { preamble: string[]; records: CsvRecord[] } {
  const src = text.replace(/^\uFEFF/, "");
  const preamble: string[] = [];
  const records: CsvRecord[] = [];
  let i = 0;
  let line = 1;

  const consumeBreak = () => {
    if (src[i] === "\r") {
      i += 1;
      if (src[i] === "\n") i += 1;
      line += 1;
      return;
    }
    if (src[i] === "\n") {
      i += 1;
      line += 1;
    }
  };

  const skipCommentsAndBlanks = () => {
    while (i < src.length) {
      let j = i;
      while (src[j] === " " || src[j] === "\t") j += 1;
      if (j >= src.length) {
        i = j;
        return;
      }
      if (src[j] === "\n" || src[j] === "\r") {
        i = j;
        consumeBreak();
        continue;
      }
      if (src[j] === "#") {
        const start = j;
        while (j < src.length && src[j] !== "\n" && src[j] !== "\r") j += 1;
        preamble.push(src.slice(start, j).trim().replace(/^#\s?/, ""));
        i = j;
        consumeBreak();
        continue;
      }
      return;
    }
  };

  while (i < src.length) {
    skipCommentsAndBlanks();
    if (i >= src.length) break;
    const recordLine = line;
    const cells: string[] = [];
    let field = "";
    let quoted = false;
    let closedRecord = false;
    while (i < src.length) {
      const c = src[i];
      if (quoted) {
        if (c === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            quoted = false;
            i += 1;
          }
        } else if (c === "\n" || c === "\r") {
          field += "\n";
          consumeBreak();
        } else {
          field += c;
          i += 1;
        }
      } else if (c === '"') {
        if (field.trim() === "") {
          field = "";
          quoted = true;
          i += 1;
        } else {
          field += c;
          i += 1;
        }
      } else if (c === ",") {
        cells.push(field.trim());
        field = "";
        i += 1;
      } else if (c === "\n" || c === "\r") {
        cells.push(field.trim());
        consumeBreak();
        closedRecord = true;
        break;
      } else {
        field += c;
        i += 1;
      }
    }
    if (!closedRecord) cells.push(field.trim());
    records.push({ line: recordLine, cells, unclosed: quoted });
  }

  return { preamble, records };
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function cell(record: Record<string, string>, key: string): string | undefined {
  return record[key];
}

function buildPose(
  record: Record<string, string>,
  errors: string[],
  warnings: string[],
): PoseSample | null {
  const xRaw = cell(record, "x");
  const yRaw = cell(record, "y");
  const zRaw = cell(record, "z");
  const x = finiteOrNull(xRaw);
  const y = finiteOrNull(yRaw);
  const z = finiteOrNull(zRaw);
  if (xRaw === undefined || yRaw === undefined || zRaw === undefined) {
    errors.push("Missing position. Need x, y, and z (or tx/ty/tz).");
  } else if (x === null || y === null || z === null) {
    errors.push("Position x, y, z must be finite numbers.");
  }

  const hasQuat = ["qw", "qx", "qy", "qz"].some((key) => cell(record, key) !== undefined);
  const hasEuler = ["roll", "pitch", "yaw"].some((key) => cell(record, key) !== undefined);

  let quat: Quat | null = null;
  let roll: number | null = null;
  let pitch: number | null = null;
  let yaw: number | null = null;
  let rotationSource: "euler" | "quaternion" = "euler";
  let fileQuat: Quat | null = null;

  if (hasQuat) {
    rotationSource = "quaternion";
    const qw = finiteOrNull(cell(record, "qw"));
    const qx = finiteOrNull(cell(record, "qx"));
    const qy = finiteOrNull(cell(record, "qy"));
    const qz = finiteOrNull(cell(record, "qz"));
    if (qw === null || qx === null || qy === null || qz === null) {
      errors.push("Quaternion needs finite qw, qx, qy, and qz.");
    } else {
      const normalized = quatNormalize({ w: qw, x: qx, y: qy, z: qz });
      if (!normalized) {
        errors.push("Quaternion length is zero.");
      } else {
        const length = Math.hypot(qw, qx, qy, qz);
        if (Math.abs(length - 1) > 1e-3) {
          warnings.push("Quaternion was not unit length. It was normalized before the rotation delta.");
        }
        quat = normalized;
        fileQuat = { w: qw, x: qx, y: qy, z: qz };
      }
    }
    if (hasEuler) warnings.push("Both quaternion and euler columns are present. The quaternion is used.");
  } else if (hasEuler) {
    roll = finiteOrNull(cell(record, "roll"));
    pitch = finiteOrNull(cell(record, "pitch"));
    yaw = finiteOrNull(cell(record, "yaw"));
    if (roll === null || pitch === null || yaw === null) {
      errors.push("Euler rotation needs finite roll, pitch, and yaw in degrees.");
    } else {
      quat = eulerToQuat(roll, pitch, yaw);
    }
  } else {
    errors.push("Missing rotation. Provide roll, pitch, yaw or qw, qx, qy, qz.");
  }

  if (x === null || y === null || z === null || !quat) return null;
  return {
    x,
    y,
    z,
    quat,
    roll,
    pitch,
    yaw,
    quaternion: fileQuat,
    rotationSource,
  };
}

function rowFromRecord(
  record: Record<string, string>,
  line: number,
): TrajectoryRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const frameRaw = cell(record, "frame");
  const frameNum = finiteOrNull(frameRaw);
  let frame: number | null = null;
  if (frameRaw === undefined) errors.push("Missing frame.");
  else if (frameNum === null) errors.push("Frame must be a finite number.");
  else if (!Number.isInteger(frameNum)) errors.push("Frame must be an integer.");
  else frame = frameNum;

  const timestampRaw = cell(record, "timestamp");
  const timestamp = finiteOrNull(timestampRaw);
  if (timestampRaw === undefined) errors.push("Missing timestamp.");
  else if (timestamp === null) errors.push("Timestamp must be a finite number.");

  const objectId = (cell(record, "objectId") ?? "").trim() || "object";
  const pose = buildPose(record, errors, warnings);
  return { line, frame, timestamp, objectId, pose, errors, warnings };
}

function recordsFromCsv(text: string): { preamble: string[]; rows: TrajectoryRow[] } {
  const { preamble, records } = parseCsvDocument(text);
  let header: string[] | null = null;
  const rows: TrajectoryRow[] = [];
  for (const csvRecord of records) {
    if (!header) {
      header = csvRecord.cells.map((name) => canonicalHeader(name) ?? "");
      const known = header.filter(Boolean);
      if (!known.includes("frame") || !known.includes("x") || csvRecord.unclosed) {
        rows.push({
          line: csvRecord.line,
          frame: null,
          timestamp: null,
          objectId: "object",
          pose: null,
          errors: [
            csvRecord.unclosed
              ? "Unclosed quote. This row was kept and left out of the path."
              : "Header must include frame and position columns. See the template for euler or quaternion names.",
          ],
          warnings: [],
        });
        header = null;
      }
      continue;
    }
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      if (key) record[key] = csvRecord.cells[index] ?? "";
    });
    const row = rowFromRecord(record, csvRecord.line);
    if (csvRecord.unclosed) {
      row.errors.push("Unclosed quote. This row was kept and left out of the path.");
      row.pose = null;
    }
    rows.push(row);
  }
  if (!header && rows.length === 0) {
    rows.push({
      line: 1,
      frame: null,
      timestamp: null,
      objectId: "object",
      pose: null,
      errors: ["The file has no header and no data rows."],
      warnings: [],
    });
  }
  return { preamble, rows };
}

function asRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const canon = canonicalHeader(key);
    if (!canon) continue;
    if (raw === null || raw === undefined) record[canon] = "";
    else record[canon] = String(raw);
  }
  return record;
}

function recordsFromJson(text: string): { preamble: string[]; rows: TrajectoryRow[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      preamble: [],
      rows: [
        {
          line: 1,
          frame: null,
          timestamp: null,
          objectId: "object",
          pose: null,
          errors: [`JSON did not parse: ${error instanceof Error ? error.message : "invalid JSON"}.`],
          warnings: [],
        },
      ],
    };
  }
  const preamble: string[] = [];
  let list: unknown[] = [];
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.note === "string") preamble.push(obj.note);
    if (typeof obj.label === "string") preamble.push(obj.label);
    const candidate = obj.rows ?? obj.poses ?? obj.frames;
    if (Array.isArray(candidate)) list = candidate;
    else {
      return {
        preamble,
        rows: [
          {
            line: 1,
            frame: null,
            timestamp: null,
            objectId: "object",
            pose: null,
            errors: ["JSON object needs a rows array."],
            warnings: [],
          },
        ],
      };
    }
  }
  const rows = list.map((item, index) => {
    const record = asRecord(item);
    if (!record) {
      return {
        line: index + 1,
        frame: null,
        timestamp: null,
        objectId: "object",
        pose: null,
        errors: ["Row is not an object."],
        warnings: [],
      } satisfies TrajectoryRow;
    }
    return rowFromRecord(record, index + 1);
  });
  return { preamble, rows };
}

export function parseTrajectory(text: string, filename: string): ParsedTrajectory {
  const format = filename.toLowerCase().endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("[")
    ? "json"
    : "csv";
  const parsed = format === "json" ? recordsFromJson(text) : recordsFromCsv(text);
  return { filename, format, ...parsed };
}

function positionDelta(a: PoseSample, b: PoseSample): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

export function checkTrajectory(
  doc: ParsedTrajectory,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): CheckerReport {
  const flags: TrajectoryFlag[] = [];
  const steps: TrajectoryStep[] = [];
  const groups = new Map<string, TrajectoryRow[]>();
  for (const row of doc.rows) {
    if (!row.pose || row.frame === null || row.errors.length > 0) continue;
    const list = groups.get(row.objectId) ?? [];
    list.push(row);
    groups.set(row.objectId, list);
  }

  for (const [objectId, rows] of groups) {
    const sorted = [...rows].sort((a, b) => a.frame! - b.frame! || a.line - b.line);
    const chain: TrajectoryRow[] = [];
    const seen = new Set<number>();
    const duplicateFrames = new Set<number>();
    for (const row of sorted) {
      const frame = row.frame!;
      if (seen.has(frame)) duplicateFrames.add(frame);
      else {
        seen.add(frame);
        chain.push(row);
      }
    }
    const duplicateNote = "Duplicate frame. The earliest row for this object is the one used in the path.";
    if (duplicateFrames.size > 0) {
      for (const row of sorted) {
        if (row.frame === null || !duplicateFrames.has(row.frame)) continue;
        const first = sorted.find((other) => other.frame === row.frame);
        if (!first || first === row || row.errors.includes(duplicateNote)) continue;
        row.errors.push(duplicateNote);
      }
    }

    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const next = chain[i];
      const fromFrame = prev.frame!;
      const toFrame = next.frame!;
      const pos = positionDelta(prev.pose!, next.pose!);
      const rot = rotationDeltaDeg(prev.pose!.quat, next.pose!.quat);
      const teleport = pos > thresholds.teleportMeters;
      const rotationSpike = rot > thresholds.rotationSpikeDegrees;
      if (toFrame > fromFrame + 1) {
        for (let missing = fromFrame + 1; missing < toFrame; missing++) {
          const occupied = doc.rows.some((row) => row.objectId === objectId && row.frame === missing);
          if (occupied) continue;
          flags.push({
            frame: missing,
            objectId,
            kind: "missing_frame",
            fromFrame,
            toFrame,
            positionDelta: null,
            rotationDeltaDeg: null,
            detail: `No row for frame ${missing} between ${fromFrame} and ${toFrame}.`,
          });
        }
      }
      steps.push({
        objectId,
        fromFrame,
        toFrame,
        positionDelta: pos,
        rotationDeltaDeg: rot,
        teleport,
        rotationSpike,
      });
      if (teleport) {
        flags.push({
          frame: toFrame,
          objectId,
          kind: "teleport",
          fromFrame,
          toFrame,
          positionDelta: pos,
          rotationDeltaDeg: rot,
          detail: `Position jump ${pos.toFixed(6)} file units from frame ${fromFrame} to ${toFrame}. Threshold is ${thresholds.teleportMeters}.`,
        });
      }
      if (rotationSpike) {
        flags.push({
          frame: toFrame,
          objectId,
          kind: "rotation_spike",
          fromFrame,
          toFrame,
          positionDelta: pos,
          rotationDeltaDeg: rot,
          detail: `Rotation delta ${rot.toFixed(6)}° from frame ${fromFrame} to ${toFrame}. Threshold is ${thresholds.rotationSpikeDegrees}°.`,
        });
      }
    }
  }

  const invalidRows: InvalidRowReport[] = doc.rows
    .filter((row) => row.errors.length > 0)
    .map((row) => ({
      line: row.line,
      frame: row.frame,
      objectId: row.objectId,
      errors: [...row.errors],
    }));

  const rotations = steps.map((step) => step.rotationDeltaDeg);
  const meanRotationDeltaDeg = rotations.length
    ? rotations.reduce((sum, value) => sum + value, 0) / rotations.length
    : null;
  const maxRotationDeltaDeg = rotations.length ? Math.max(...rotations) : null;

  return {
    note: TOOL_LABEL,
    filename: doc.filename,
    thresholds,
    flags,
    steps,
    invalidRows,
    summary: {
      dataRows: doc.rows.length,
      validRows: doc.rows.filter((row) => row.errors.length === 0 && row.pose).length,
      invalidRows: invalidRows.length,
      meanRotationDeltaDeg,
      maxRotationDeltaDeg,
      flagCount: flags.length,
    },
  };
}

export function reportToJson(report: CheckerReport): string {
  const exported = {
    ...report,
    thresholds: {
      [TELEPORT_THRESHOLD_LABEL]: report.thresholds.teleportMeters,
      [SPIKE_THRESHOLD_LABEL]: report.thresholds.rotationSpikeDegrees,
    },
  };
  return JSON.stringify(exported, null, 2);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function reportToCsv(report: CheckerReport): string {
  const lines = [
    "frame,object_id,kind,from_frame,to_frame,position_delta,rotation_delta_deg,detail",
  ];
  for (const flag of report.flags) {
    lines.push(
      [
        String(flag.frame),
        csvEscape(flag.objectId),
        flag.kind,
        flag.fromFrame === null ? "" : String(flag.fromFrame),
        flag.toFrame === null ? "" : String(flag.toFrame),
        flag.positionDelta === null ? "" : String(flag.positionDelta),
        flag.rotationDeltaDeg === null ? "" : String(flag.rotationDeltaDeg),
        csvEscape(flag.detail),
      ].join(","),
    );
  }
  for (const row of report.invalidRows) {
    lines.push(
      [
        row.frame === null ? "" : String(row.frame),
        csvEscape(row.objectId),
        "invalid_row",
        "",
        "",
        "",
        "",
        csvEscape(`line ${row.line}: ${row.errors.join(" ")}`),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function chainForObject(doc: ParsedTrajectory, objectId: string): TrajectoryRow[] {
  return doc.rows
    .filter((row) => row.objectId === objectId && row.pose && row.frame !== null && row.errors.length === 0)
    .sort((a, b) => a.frame! - b.frame! || a.line - b.line)
    .filter((row, index, list) => list.findIndex((other) => other.frame === row.frame) === index);
}

export function objectIds(doc: ParsedTrajectory): string[] {
  const ids: string[] = [];
  for (const row of doc.rows) {
    if (!ids.includes(row.objectId)) ids.push(row.objectId);
  }
  return ids;
}
