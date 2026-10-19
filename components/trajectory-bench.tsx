"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, Pause, Play, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { SampleCousins } from "@/components/sample-cousins";
import { TrajectoryCanvas } from "@/components/trajectory-canvas";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { buildTrajectoryScene } from "@/lib/trajectory-scene";
import {
  DEFAULT_THRESHOLDS,
  SAMPLE_LABEL,
  SPIKE_THRESHOLD_LABEL,
  STORAGE_KEY,
  TELEPORT_THRESHOLD_LABEL,
  TOOL_LABEL,
  chainForObject,
  checkTrajectory,
  objectIds,
  parseTrajectory,
  reportToCsv,
  reportToJson,
  type CheckerReport,
  type ParsedTrajectory,
  type Thresholds,
  type TrajectoryFlag,
  type TrajectoryRow,
} from "@/lib/trajectory";
import { cn } from "cn";

type Stored = {
  version: 1;
  filename: string;
  text: string;
  thresholds: Thresholds;
};

const PLAY_MS = 140;

function num(value: number | readonly number[] | undefined): number | null {
  const next = Array.isArray(value) ? value[0] : value;
  return typeof next === "number" ? next : null;
}

function fixed(value: number | null, digits: number): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function rotationText(row: TrajectoryRow): string {
  const pose = row.pose;
  if (!pose) return "—";
  if (pose.rotationSource === "quaternion" && pose.quaternion) {
    const q = pose.quaternion;
    return `qw ${q.w.toFixed(4)} qx ${q.x.toFixed(4)} qy ${q.y.toFixed(4)} qz ${q.z.toFixed(4)}`;
  }
  return `roll ${fixed(pose.roll, 2)}°  pitch ${fixed(pose.pitch, 2)}°  yaw ${fixed(pose.yaw, 2)}°`;
}

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isSample(doc: ParsedTrajectory): boolean {
  return (
    doc.filename.toLowerCase().includes("sample") ||
    doc.preamble.some((line) => line.toUpperCase().includes("SAMPLE"))
  );
}

export function TrajectoryBench() {
  const [doc, setDoc] = useState<ParsedTrajectory | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [objectId, setObjectId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [azimuth, setAzimuth] = useState(32);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showCousins, setShowCousins] = useState(false);
  const [activeFlag, setActiveFlag] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Stored;
          if (parsed.version === 1 && typeof parsed.text === "string" && parsed.text.length > 0) {
            setRaw(parsed.text);
            setDoc(parseTrajectory(parsed.text, parsed.filename || "saved-trajectory.csv"));
            if (
              parsed.thresholds &&
              Number.isFinite(parsed.thresholds.teleportMeters) &&
              Number.isFinite(parsed.thresholds.rotationSpikeDegrees)
            ) {
              setThresholds(parsed.thresholds);
            }
          }
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!restored) return;
    if (!doc || raw === null) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: Stored = { version: 1, filename: doc.filename, text: raw, thresholds };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [doc, raw, thresholds, restored]);

  const ids = useMemo(() => (doc ? objectIds(doc) : []), [doc]);
  const activeObject = objectId && ids.includes(objectId) ? objectId : ids[0] ?? null;
  const chain = useMemo(
    () => (doc && activeObject ? chainForObject(doc, activeObject) : []),
    [doc, activeObject],
  );
  const report: CheckerReport | null = useMemo(
    () => (doc ? checkTrajectory(doc, thresholds) : null),
    [doc, thresholds],
  );
  const safeIndex = chain.length === 0 ? 0 : Math.min(index, chain.length - 1);
  const current = chain[safeIndex] ?? null;
  const scene = useMemo(
    () => (report ? buildTrajectoryScene(chain, report.steps, safeIndex, azimuth) : null),
    [chain, report, safeIndex, azimuth],
  );

  useEffect(() => {
    if (!playing || chain.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % chain.length);
    }, PLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, chain.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!doc || chain.length === 0) return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setIndex((value) => (value + 1) % chain.length);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setIndex((value) => (value - 1 + chain.length) % chain.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, chain.length]);

  function applyImport(text: string, filename: string, autoplay: boolean) {
    const parsed = parseTrajectory(text, filename);
    setRaw(text);
    setDoc(parsed);
    setObjectId(null);
    setIndex(0);
    setActiveFlag(null);
    setExportNote("");
    setError(null);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(autoplay && !reduce && chainForObject(parsed, objectIds(parsed)[0] ?? "").length > 1);
  }

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(`Reading ${file.name}…`);
    setError(null);
    try {
      const text = await file.text();
      applyImport(text, file.name, true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The file could not be read.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function loadSample() {
    setBusy("Reading sample-trajectory.csv…");
    setError(null);
    try {
      const response = await fetch("/sample-trajectory.csv");
      if (!response.ok) throw new Error(`The sample file returned ${response.status}.`);
      const text = await response.text();
      applyImport(text, "sample-trajectory.csv", true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sample file could not be read.");
    } finally {
      setBusy(null);
    }
  }

  function clearImport() {
    setDoc(null);
    setRaw(null);
    setPlaying(false);
    setIndex(0);
    setObjectId(null);
    setActiveFlag(null);
    setExportNote("");
    setError(null);
    setThresholds(DEFAULT_THRESHOLDS);
  }

  function seekFlag(flag: TrajectoryFlag) {
    setPlaying(false);
    setActiveFlag(`${flag.kind}:${flag.frame}:${flag.objectId}`);
    const target = flag.kind === "missing_frame" ? (flag.toFrame ?? flag.frame) : flag.frame;
    if (flag.objectId !== activeObject) setObjectId(flag.objectId);
    const nextChain = doc ? chainForObject(doc, flag.objectId) : chain;
    const exact = nextChain.findIndex((row) => row.frame === target);
    if (exact >= 0) {
      setIndex(exact);
      return;
    }
    const after = nextChain.findIndex((row) => (row.frame ?? -1) > flag.frame);
    if (after >= 0) setIndex(after);
  }

  function exportReport(kind: "json" | "csv") {
    if (!report) return;
    if (kind === "json") {
      download("checker-report.json", reportToJson(report), "application/json");
      setExportNote(`Exported checker-report.json · ${report.flags.length} flagged frames`);
    } else {
      download("checker-report.csv", reportToCsv(report), "text/csv");
      setExportNote(`Exported checker-report.csv · ${report.flags.length} flagged frames`);
    }
  }

  const sample = doc ? isSample(doc) : false;
  const objectFlags = report?.flags.filter((flag) => !activeObject || flag.objectId === activeObject) ?? [];

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-40 border-b border-black/10 bg-[#e6a322] text-[#1c1406]">
        <p className="mx-auto max-w-6xl px-4 py-2 text-center text-sm font-semibold tracking-tight sm:text-[15px]">
          {TOOL_LABEL}
        </p>
      </div>

      <header className="mx-auto max-w-6xl px-4 pt-8 pb-2 sm:pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e6a322]">
          Pose trajectory checker
        </p>
        <h1 className="mt-2 font-display text-[2.5rem] leading-none text-[#f6f1e7] sm:text-6xl">
          Imported poses, measured
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#e7e0d4] sm:text-lg">
          Bring a pose trajectory exported from COLMAP, ARKit, Blender, or motion capture.
          The viewer draws that file. The checker measures gaps, teleport jumps, and rotation spikes in that file.
          {" "}
          {TOOL_LABEL}
        </p>
      </header>

      <main className="mx-auto flex min-w-0 max-w-6xl flex-col gap-8 px-4 py-8">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl text-[#f6f1e7]">Import</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#c9c2b4]">
                CSV or JSON. Each row needs frame, timestamp, position x/y/z, rotation as roll/pitch/yaw degrees or a quaternion, and an object id.
                Bad rows stay in the table. Nothing is dropped.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/trajectory-template.csv" download className={buttonVariants({ variant: "outline" })}>
                <Download />
                CSV template
              </a>
              <a href="/trajectory-template.json" download className={buttonVariants({ variant: "outline" })}>
                <Download />
                JSON template
              </a>
            </div>
          </div>

          <div
            className={cn(
              "mt-4 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
              dragOver ? "border-[#e6a322] bg-[#e6a322]/10" : "border-white/15 bg-[#101410]",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void onFiles(event.dataTransfer.files);
            }}
          >
            <FileUp className="mx-auto text-[#e6a322]" />
            <p className="mt-3 text-sm text-[#f6f1e7]">Drop a trajectory file here, or choose one.</p>
            <p className="mt-1 text-xs text-[#8f887c]">The file stays in this browser. Nothing is uploaded.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                Choose file
              </Button>
              <Button type="button" variant="secondary" data-testid="load-sample" onClick={() => void loadSample()} disabled={busy !== null}>
                Load sample trajectory
              </Button>
              {doc ? (
                <Button type="button" variant="ghost" onClick={clearImport}>
                  <RotateCcw />
                  Clear
                </Button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,.txt,text/csv,application/json"
              className="sr-only"
              aria-label="Pose trajectory file"
              onChange={(event) => void onFiles(event.target.files)}
            />
          </div>
          {busy ? <p className="mt-3 text-sm text-[#c9c2b4]">{busy}</p> : null}
          {error ? (
            <p className="mt-3 text-sm text-[#f0a598]" role="alert">
              {error}
            </p>
          ) : null}
          {!doc && restored ? (
            <p className="mt-4 text-sm leading-relaxed text-[#c9c2b4]">
              Nothing is loaded. The sample file is synthetic and labelled SAMPLE. It is not a capture.
              A real export uses the same columns as the template.
            </p>
          ) : null}
        </section>

        {doc && report ? (
          <>
            {sample ? (
              <div className="rounded-xl border border-[#e6a322]/40 bg-[#e6a322]/10 px-4 py-3" role="status">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#e6a322]">Sample</p>
                <p className="mt-1 text-sm leading-relaxed text-[#f6f1e7]">{SAMPLE_LABEL}</p>
              </div>
            ) : (
              <p className="text-sm text-[#c9c2b4]">
                Loaded <span className="text-[#f6f1e7]">{doc.filename}</span>. Poses and checks below come from this file.
              </p>
            )}

            <section className="min-w-0 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7dcec2]">Path</p>
                  <h2 className="font-display text-3xl text-[#f6f1e7]">Imported trajectory</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#c9c2b4]">
                    The line is the sequence of positions in the file. The glyph is that frame’s stored orientation, local +Z forward, drawn in the file’s axes. It is not a reconstructed camera.
                    Orbit only changes this view.
                  </p>
                </div>
                {ids.length > 1 ? (
                  <label className="text-sm text-[#c9c2b4]">
                    Object
                    <select
                      className="mt-1 block h-8 rounded-lg border border-input bg-input/30 px-2 text-sm text-[#f6f1e7]"
                      value={activeObject ?? ""}
                      onChange={(event) => {
                        setObjectId(event.target.value);
                        setIndex(0);
                        setPlaying(false);
                      }}
                    >
                      {ids.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="font-mono text-xs text-[#c9c2b4]">object {activeObject ?? "—"}</p>
                )}
              </div>

              <div className="relative mt-4 aspect-[16/10] overflow-hidden rounded-xl bg-[#101410] ring-1 ring-white/10">
                <TrajectoryCanvas
                  scene={scene}
                  label={
                    current
                      ? `Imported path for ${activeObject}, frame ${current.frame}`
                      : "No valid pose to draw"
                  }
                />
                {!scene ? (
                  <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[#c9c2b4]">
                    No valid pose to draw. Invalid rows stay in the table below.
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous frame"
                  disabled={chain.length === 0}
                  onClick={() => {
                    setPlaying(false);
                    setIndex((value) => (value - 1 + chain.length) % chain.length);
                  }}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  data-testid="play"
                  disabled={chain.length < 2}
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing ? <Pause /> : <Play />}
                  {playing ? "Pause" : "Play"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next frame"
                  disabled={chain.length === 0}
                  onClick={() => {
                    setPlaying(false);
                    setIndex((value) => (value + 1) % chain.length);
                  }}
                >
                  <ChevronRight />
                </Button>
                <p className="font-mono text-xs text-[#c9c2b4]" data-testid="frame-label">
                  {current
                    ? `frame ${current.frame} · ${safeIndex + 1} / ${chain.length} valid poses`
                    : "no valid pose"}
                </p>
              </div>
              <div className="mt-3 px-1">
                <Slider
                  aria-label="Scrub imported frames"
                  data-testid="frame-slider"
                  min={0}
                  max={Math.max(chain.length - 1, 0)}
                  step={1}
                  disabled={chain.length === 0}
                  value={[safeIndex]}
                  onValueChange={(next) => {
                    const value = num(next);
                    if (value === null) return;
                    setPlaying(false);
                    setIndex(value);
                  }}
                />
              </div>
              <label className="mt-4 block text-sm text-[#c9c2b4]">
                View orbit {azimuth.toFixed(0)}°. Does not edit the file.
                <Slider
                  className="mt-2"
                  aria-label="View orbit"
                  min={-180}
                  max={180}
                  step={1}
                  value={[azimuth]}
                  onValueChange={(next) => {
                    const value = num(next);
                    if (value !== null) setAzimuth(value);
                  }}
                />
              </label>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="pose-readout">
                <Readout label="frame" value={current?.frame === null || current?.frame === undefined ? "—" : String(current.frame)} />
                <Readout label="timestamp" value={current ? fixed(current.timestamp, 3) : "—"} />
                <Readout
                  label="position"
                  value={
                    current?.pose
                      ? `${current.pose.x.toFixed(3)}, ${current.pose.y.toFixed(3)}, ${current.pose.z.toFixed(3)}`
                      : "—"
                  }
                />
                <Readout label="rotation" value={current ? rotationText(current) : "—"} />
              </div>
              <p className="mt-2 text-xs text-[#8f887c]">
                Readout is the imported row. Position is in file units. Euler order, when the file used euler angles, is yaw about Y, then pitch about X, then roll about Z.
              </p>
              <ul className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#c9c2b4]">
                <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#56b0a2]" /> quiet step</li>
                <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#a89470]" /> frame gap</li>
                <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#e15b4a]" /> teleport</li>
                <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#e6a322]" /> rotation spike</li>
              </ul>
            </section>

            <section className="min-w-0 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-5" id="checker">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e15b4a]">Checker</p>
                  <h2 className="font-display text-3xl text-[#f6f1e7]">Measured from the file</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#c9c2b4]">
                    A pose file has no image, so silhouette overlap is not computed.
                    These checks use consecutive valid poses of the same object: missing integer frames, a position jump above the teleport threshold, and a rotation delta above the spike threshold. Thresholds are strict greater-than.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" data-testid="export-json" variant="outline" onClick={() => exportReport("json")}>
                    <Download />
                    Export JSON
                  </Button>
                  <Button type="button" data-testid="export-csv" variant="outline" onClick={() => exportReport("csv")}>
                    <Download />
                    Export CSV
                  </Button>
                </div>
              </div>
              <p className="mt-3 min-h-5 font-mono text-sm text-[#e6a322]" role="status" data-testid="export-status">
                {exportNote}
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="rounded-lg bg-[#0e110f] p-3 ring-1 ring-white/10">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#8f887c]">{TELEPORT_THRESHOLD_LABEL}</span>
                  <Input
                    className="mt-2"
                    type="number"
                    min={0}
                    step="0.01"
                    aria-label="Teleport threshold in file units"
                    value={thresholds.teleportMeters}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value) || value < 0) return;
                      setThresholds((current) => ({ ...current, teleportMeters: value }));
                    }}
                  />
                </label>
                <label className="rounded-lg bg-[#0e110f] p-3 ring-1 ring-white/10">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#8f887c]">{SPIKE_THRESHOLD_LABEL}</span>
                  <Input
                    className="mt-2"
                    type="number"
                    min={0}
                    step="1"
                    aria-label="Rotation spike threshold in degrees"
                    value={thresholds.rotationSpikeDegrees}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value) || value < 0) return;
                      setThresholds((current) => ({ ...current, rotationSpikeDegrees: value }));
                    }}
                  />
                </label>
                <Stat label="Mean rotation delta" value={report.summary.meanRotationDeltaDeg === null ? "—" : `${report.summary.meanRotationDeltaDeg.toFixed(2)}°`} />
                <Stat label="Max rotation delta" value={report.summary.maxRotationDeltaDeg === null ? "—" : `${report.summary.maxRotationDeltaDeg.toFixed(2)}°`} />
              </div>
              <p className="mt-3 text-sm text-[#e7e0d4]" data-testid="flag-count">
                {report.summary.validRows} valid rows, {report.summary.invalidRows} invalid, {report.flags.length} flags.
              </p>

              {objectFlags.length === 0 ? (
                <p className="mt-3 text-sm text-[#c9c2b4]">No gaps, teleports, or rotation spikes at these thresholds.</p>
              ) : (
                <ul className="mt-3 space-y-2" data-testid="flag-list">
                  {objectFlags.map((flag) => {
                    const key = `${flag.kind}:${flag.frame}:${flag.objectId}`;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => seekFlag(flag)}
                          className={cn(
                            "w-full rounded-lg px-3 py-2 text-left ring-1 ring-white/10 transition-colors hover:bg-white/5",
                            activeFlag === key ? "bg-[#e6a322]/10" : "bg-[#0e110f]",
                          )}
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge variant={flag.kind === "rotation_spike" ? "default" : "destructive"}>
                              {flag.kind === "missing_frame" ? "missing frame" : flag.kind === "teleport" ? "teleport" : "rotation spike"}
                            </Badge>
                            <span className="font-mono text-sm text-[#f6f1e7]">frame {flag.frame}</span>
                            <span className="font-mono text-xs text-[#c9c2b4]">{flag.objectId}</span>
                          </span>
                          <span className="mt-1 block font-mono text-[12px] text-[#e7e0d4]">
                            {flag.positionDelta === null ? "no pose on this frame" : `position Δ ${flag.positionDelta.toFixed(6)}`}
                            {flag.rotationDeltaDeg === null ? "" : ` · rotation Δ ${flag.rotationDeltaDeg.toFixed(6)}°`}
                            {flag.fromFrame !== null && flag.toFrame !== null ? ` · ${flag.fromFrame} → ${flag.toFrame}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-5">
              <h2 className="font-display text-3xl text-[#f6f1e7]">Every row</h2>
              <p className="mt-1 text-sm text-[#c9c2b4]">
                {doc.rows.length} data rows from {doc.filename}. Invalid rows are flagged here and left out of the path.
              </p>
              <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg ring-1 ring-white/10">
                <table className="w-full min-w-[760px] border-collapse text-left font-mono text-[11px] text-[#e7e0d4]">
                  <caption className="sr-only">Imported trajectory rows and validation</caption>
                  <thead className="sticky top-0 bg-[#222824] text-[#b7b1a4]">
                    <tr>
                      {["line", "frame", "time", "object", "position", "rotation", "status"].map((heading) => (
                        <th key={heading} scope="col" className="px-2 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {doc.rows.map((row, rowIndex) => {
                      const on = current?.line === row.line && current.objectId === row.objectId;
                      const bad = row.errors.length > 0;
                      return (
                        <tr
                          key={`${row.line}-${rowIndex}`}
                          className={cn("border-t border-white/5", on && "bg-[#e6a322]/15", bad && "text-[#f0a598]")}
                        >
                          <td className="px-2 py-1.5">{row.line}</td>
                          <td className="px-2 py-1.5">{row.frame ?? "—"}</td>
                          <td className="px-2 py-1.5">{fixed(row.timestamp, 3)}</td>
                          <td className="px-2 py-1.5">{row.objectId}</td>
                          <td className="px-2 py-1.5">
                            {row.pose ? `${row.pose.x.toFixed(3)}, ${row.pose.y.toFixed(3)}, ${row.pose.z.toFixed(3)}` : "—"}
                          </td>
                          <td className="px-2 py-1.5">{rotationText(row)}</td>
                          <td className="px-2 py-1.5">
                            {bad ? row.errors.join(" ") : row.warnings.length > 0 ? row.warnings.join(" ") : "ok"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <section className="min-w-0">
          <Button
            type="button"
            variant={showCousins ? "secondary" : "outline"}
            aria-expanded={showCousins}
            onClick={() => setShowCousins((value) => !value)}
          >
            {showCousins ? "Hide sample cousins" : "Show sample cousins"}
          </Button>
          <p className="mt-2 max-w-2xl text-sm text-[#c9c2b4]">
            Optional. A hand-written mug animation for comparison. Off by default, and not derived from an import.
          </p>
          {showCousins ? (
            <div className="mt-4">
              <SampleCousins />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[#0e110f] px-3 py-2 ring-1 ring-white/10">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#8f887c]">{label}</p>
      <p className="mt-1 font-mono text-sm break-words text-[#f6f1e7]">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#0e110f] p-3 ring-1 ring-white/10">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#8f887c]">{label}</p>
      <p className="mt-2 font-mono text-lg text-[#f6f1e7]">{value}</p>
    </div>
  );
}
