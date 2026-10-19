"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { SceneCanvas } from "@/components/scene-canvas";
import { measureChecks, MEASURE_H, MEASURE_W, type CheckReport } from "@/lib/checks";
import { fmt, type Camera, type Pose } from "@/lib/math";
import {
  AUDIT_CAMERA,
  CARDBOARD_POSE,
  COUSINS,
  DEPTH_PASS_M,
  EXAMPLE_FRAME,
  FRAME_COUNT,
  INPUT_BG,
  INPUT_CAMERA,
  INPUT_LIGHT,
  PLAYBACK_FPS,
  POSE_PASS_DEG,
  POSES,
  PROGRAM_ID,
  SILHOUETTE_PASS,
  SIMULATION_LABEL,
  SOURCE_FPS,
  auditLight,
  frameAtSpeed,
  lightStamp,
  timecode,
} from "@/lib/program";
import { CARDBOARD, MUG } from "@/lib/scene";
import { cn } from "cn";

const EXAMPLE_POSE = POSES[EXAMPLE_FRAME];

export function Bench() {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const pose = POSES[frame];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!media.matches) return;
    const id = window.setTimeout(() => setPlaying(false), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrame((current) => (current + 1) % FRAME_COUNT);
    }, 1000 / PLAYBACK_FPS);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((current) => !current);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setFrame((current) => (current + 1) % FRAME_COUNT);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setFrame((current) => (current - 1 + FRAME_COUNT) % FRAME_COUNT);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hold = (next: number) => {
    setPlaying(false);
    setFrame(next);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-40 border-b border-black/10 bg-[#e6a322] text-[#1c1406]">
        <p className="mx-auto max-w-6xl px-4 py-2 text-center text-sm font-semibold tracking-tight sm:text-[15px]">
          {SIMULATION_LABEL}
        </p>
      </div>

      <header className="mx-auto max-w-6xl px-4 pt-8 pb-2 sm:pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e6a322]">
          Agentic 3D / 4D reconstruction
        </p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-[2.6rem] leading-none text-[#f6f1e7] sm:text-6xl">
              Rebuild, as code
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[#e7e0d4] sm:text-lg">
              An AI agent rebuilds the 3D world from video, as code. Monocular frames in. A rigid shape and six pose numbers out, on every frame.
            </p>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-[#c9c2b4] md:text-right">
            Amy Zhuang
            <span className="text-[#8f887c]"> · </span>
            collaborator research direction with Mutian Tong
          </p>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#b7b1a4]">
          The bench below acts the idea out. A field mug is drawn in the browser, the trajectory is a list in the source, and every number on the page is that list. {SIMULATION_LABEL}.
        </p>
      </header>

      <main className="mx-auto flex min-w-0 max-w-6xl flex-col gap-10 px-4 py-8">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Monocular video", "One camera. One rigid mug. Forty-eight frames."],
            ["02", "4D program", "Shape, plus x y z and roll pitch yaw."],
            ["03", "Digital cousins", "Same motion, new view, light, or speed."],
            ["04", "Checker", "A silhouette can pass while the pose fails."],
          ].map(([index, title, copy]) => (
            <li
              key={index}
              className="rounded-xl border border-white/10 bg-[#171b18]/80 px-3 py-3"
            >
              <p className="font-mono text-[11px] text-[#e6a322]">{index}</p>
              <p className="mt-1 text-sm font-medium text-[#f6f1e7]">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#b7b1a4]">{copy}</p>
            </li>
          ))}
        </ol>

        <section id="video" className="scroll-mt-14 grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.92fr)]">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e6a322]">
                  01 · Monocular input
                </p>
                <h2 className="font-display text-3xl text-[#f6f1e7]">Video</h2>
              </div>
              <Badge variant="outline" className="border-[#e6a322]/40 text-[#f0d7a0]">
                {PROGRAM_ID}
              </Badge>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#101410] ring-1 ring-white/10">
              <SceneCanvas
                subject="mug"
                pose={pose}
                camera={INPUT_CAMERA}
                light={INPUT_LIGHT}
                background={INPUT_BG}
                shadowX={pose.x}
                shadowZ={pose.z}
                label={`Simulated monocular frame ${frame} of a field mug`}
              />
              <FrameChrome frame={frame} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="lg" onClick={() => setPlaying((current) => !current)} aria-pressed={playing}>
                {playing ? <Pause /> : <Play />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => hold((frame - 1 + FRAME_COUNT) % FRAME_COUNT)} aria-label="Previous frame">
                <ChevronLeft />
                Step
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => hold((frame + 1) % FRAME_COUNT)} aria-label="Next frame">
                Step
                <ChevronRight />
              </Button>
              <p className="w-full font-mono text-xs text-[#c9c2b4] sm:ml-auto sm:w-auto">
                frame {String(frame).padStart(2, "0")} / {FRAME_COUNT - 1}
                <span className="text-[#8f887c]"> · </span>
                {timecode(frame)}
                <span className="text-[#8f887c]"> · </span>
                {SOURCE_FPS} fps labels
              </p>
            </div>
            <div className="mt-3 px-1">
              <Slider
                aria-label="Frame"
                min={0}
                max={FRAME_COUNT - 1}
                step={1}
                value={[frame]}
                onValueChange={(next) => {
                  const value = Array.isArray(next) ? next[0] : next;
                  if (typeof value === "number") hold(value);
                }}
              />
            </div>
            <div className="mt-2 flex gap-px" aria-hidden="true">
              {POSES.map((item) => (
                <span
                  key={item.frame}
                  className={cn(
                    "h-1.5 flex-1 rounded-[1px]",
                    item.frame === frame ? "bg-[#e6a322]" : item.frame === EXAMPLE_FRAME ? "bg-[#e15b4a]/80" : "bg-white/15",
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-[#8f887c]">
              Space plays and pauses. Arrow keys step one frame. The red tick is the checker example, frame {EXAMPLE_FRAME}. Playback is {PLAYBACK_FPS} fps so the motion can be read; the labels stay on the {SOURCE_FPS} fps clock.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[#e6a322]">{SIMULATION_LABEL}</p>
          </div>

          <PosePanel frame={frame} pose={pose} />
        </section>

        <section id="cousins" className="min-w-0 scroll-mt-14">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e6a322]">
                03 · Same program, new picture
              </p>
              <h2 className="font-display text-3xl text-[#f6f1e7] sm:text-4xl">Digital cousins</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[#c9c2b4]">
              Four re-renders of the mug and its trajectory. Viewpoint, light, and speed change. Each card is stamped with the exact labels of the frame it is showing.
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {COUSINS.map((cousin) => {
              const shown = frameAtSpeed(frame, cousin.speed);
              const cousinPose = POSES[shown];
              const light = lightStamp(cousin.light);
              return (
                <Card key={cousin.id} className="min-w-0 bg-[#141816] py-0 ring-white/10">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl bg-[#101410]">
                    <SceneCanvas
                      subject="mug"
                      pose={cousinPose}
                      camera={cousin.camera}
                      light={cousin.light}
                      background={cousin.background}
                      shadowX={cousinPose.x}
                      shadowZ={cousinPose.z}
                      label={`${cousin.name} cousin, frame ${shown}`}
                    />
                    <span className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-[#f6f1e7]">
                      {cousin.id}
                    </span>
                  </div>
                  <CardHeader className="pt-3">
                    <CardTitle className="font-display text-[1.35rem] text-[#f6f1e7]">{cousin.name}</CardTitle>
                    <CardDescription>{cousin.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <dl className="space-y-1 font-mono text-[11px] leading-relaxed text-[#efe6d4]">
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#8f887c]">view</dt>
                        <dd className="text-right break-words">
                          az {fmt(cousin.camera.azimuth, 2)}° el {fmt(cousin.camera.elevation, 2)}°
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#8f887c]">light</dt>
                        <dd className="text-right">
                          {fmt(light[0], 2)} {fmt(light[1], 2)} {fmt(light[2], 2)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#8f887c]">speed</dt>
                        <dd className="text-right">
                          {cousin.speed.toFixed(2)}× · f{String(frame).padStart(2, "0")}→f{String(shown).padStart(2, "0")}
                        </dd>
                      </div>
                    </dl>
                    <Separator className="my-2 bg-white/10" />
                    <p className="font-mono text-[11px] leading-relaxed text-[#f6f1e7]">
                      x {fmt(cousinPose.x, 3)} y {fmt(cousinPose.y, 3)} z {fmt(cousinPose.z, 3)}
                      <br />
                      r {fmt(cousinPose.roll, 2)} p {fmt(cousinPose.pitch, 2)} y {fmt(cousinPose.yaw, 2)}
                    </p>
                    <p className="mt-2 text-[10px] leading-snug text-[#e6a322]">{SIMULATION_LABEL}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Checker onShowExample={() => hold(EXAMPLE_FRAME)} playhead={frame} />
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-sm font-semibold text-[#f6f1e7]">{SIMULATION_LABEL}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#b7b1a4]">
            Amy Zhuang, collaborator research direction with Mutian Tong. The shape lives in the mesh code, the 48 poses live in the program list, and the checker measures those meshes with a software rasterizer. The page has no model, no video file, and no network call.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FrameChrome({ frame }: { frame: number }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <span className="absolute top-3 left-3 h-4 w-4 border-t-2 border-l-2 border-[#f0d7a0]/90" />
      <span className="absolute top-3 right-3 h-4 w-4 border-t-2 border-r-2 border-[#f0d7a0]/90" />
      <span className="absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-[#f0d7a0]/90" />
      <span className="absolute right-3 bottom-3 h-4 w-4 border-r-2 border-b-2 border-[#f0d7a0]/90" />
      <div className="absolute top-3 right-8 left-8 flex items-start justify-between gap-2 font-mono text-[10px] tracking-wide text-[#f6f1e7] sm:text-[11px]">
        <span className="rounded bg-black/50 px-1.5 py-0.5">CAM-01 · MONO · {PROGRAM_ID}</span>
        <span className="rounded bg-black/50 px-1.5 py-0.5">
          f{String(frame).padStart(2, "0")} · {timecode(frame)}
        </span>
      </div>
    </div>
  );
}

function PosePanel({ frame, pose }: { frame: number; pose: Pose }) {
  const scroller = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const row = active.current;
    const box = scroller.current;
    if (!row || !box) return;
    const rowRect = row.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    if (rowRect.top < boxRect.top) box.scrollTop -= boxRect.top - rowRect.top;
    else if (rowRect.bottom > boxRect.bottom) box.scrollTop += rowRect.bottom - boxRect.bottom;
  }, [frame]);

  const cells = [
    ["x", "m", fmt(pose.x, 3)],
    ["y", "m", fmt(pose.y, 3)],
    ["z", "m", fmt(pose.z, 3)],
    ["roll", "deg", fmt(pose.roll, 2)],
    ["pitch", "deg", fmt(pose.pitch, 2)],
    ["yaw", "deg", fmt(pose.yaw, 2)],
  ];

  return (
    <div id="labels" className="min-w-0 scroll-mt-14 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e6a322]">
        02 · Agent-written 4D program
      </p>
      <h2 className="font-display text-3xl text-[#f6f1e7]">Exact pose labels</h2>
      <p className="mt-1 text-sm leading-relaxed text-[#c9c2b4]">
        The picture is a render of this table. Rotation order is yaw about Y, then pitch about X, then roll about Z. Axes: +X right, +Y up, +Z toward the input camera.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0e110f] p-3 font-mono text-[11px] leading-relaxed text-[#efe6d4] sm:text-xs">
        {`shape = RigidMug(body, handle, teal_label)
pose[${String(frame).padStart(2, "0")}] = SE3(
  x=${fmt(pose.x, 3)}, y=${fmt(pose.y, 3)}, z=${fmt(pose.z, 3)},
  roll=${fmt(pose.roll, 2)}, pitch=${fmt(pose.pitch, 2)}, yaw=${fmt(pose.yaw, 2)}
)`}
      </pre>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {cells.map(([name, unit, value]) => (
          <div key={name} className="rounded-lg bg-[#0e110f] px-2 py-2 ring-1 ring-white/10">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#8f887c]">
              {name}
              <span className="text-[#5c574e]"> · {unit}</span>
            </p>
            <p className="font-mono text-lg text-[#f6f1e7] tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div ref={scroller} data-pose-scroll className="mt-3 max-h-72 overflow-auto rounded-lg ring-1 ring-white/10">
        {POSES.length === 0 ? (
          <p className="p-4 text-sm text-[#c9c2b4]">No frames in the program.</p>
        ) : (
          <table className="w-full border-collapse font-mono text-[11px] tabular-nums sm:text-xs">
            <caption className="sr-only">
              Exact 6-DoF labels for all {FRAME_COUNT} frames of {PROGRAM_ID}
            </caption>
            <thead className="sticky top-0 bg-[#222824] text-[#b7b1a4]">
              <tr>
                {["frame", "x", "y", "z", "roll", "pitch", "yaw"].map((heading) => (
                  <th key={heading} scope="col" className="px-2 py-2 text-left font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {POSES.map((item) => {
                const on = item.frame === frame;
                return (
                  <tr
                    key={item.frame}
                    ref={on ? active : undefined}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "border-t border-white/5",
                      on ? "bg-[#e6a322]/15 text-[#f6f1e7]" : "text-[#d9d2c6]",
                    )}
                  >
                    <td className="px-2 py-1.5">{String(item.frame).padStart(2, "0")}</td>
                    <td className="px-2 py-1.5">{fmt(item.x, 3)}</td>
                    <td className="px-2 py-1.5">{fmt(item.y, 3)}</td>
                    <td className="px-2 py-1.5">{fmt(item.z, 3)}</td>
                    <td className="px-2 py-1.5">{fmt(item.roll, 2)}</td>
                    <td className="px-2 py-1.5">{fmt(item.pitch, 2)}</td>
                    <td className="px-2 py-1.5">{fmt(item.yaw, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#e6a322]">{SIMULATION_LABEL}</p>
    </div>
  );
}

function Checker({ onShowExample, playhead }: { onShowExample: () => void; playhead: number }) {
  const [report, setReport] = useState<CheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      try {
        setReport(measureChecks(MUG, CARDBOARD));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Measurement failed.");
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return (
    <section id="checker" className="min-w-0 scroll-mt-14 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e15b4a]">
            04 · Known failure mode
          </p>
          <h2 className="font-display text-3xl text-[#f6f1e7] sm:text-4xl">Checker</h2>
        </div>
        <Button type="button" variant="outline" size="lg" onClick={onShowExample}>
          Show frame {EXAMPLE_FRAME} in the video
        </Button>
      </div>
      <div className="mt-4 rounded-xl border border-[#e15b4a]/40 bg-[#e15b4a]/10 px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f0a598]">Known failure mode</p>
        <p className="mt-1 text-lg leading-snug text-[#f6f1e7] sm:text-xl">
          A flat cardboard shape passes the silhouette check and fails the pose check.
        </p>
        <p className="mt-1 text-sm text-[#e7d2ce]">
          Locked to frame {EXAMPLE_FRAME}. The cutout is a sheet fitted to that frame’s outline.{" "}
          {playhead === EXAMPLE_FRAME ? "The video playhead is on this frame." : `The video playhead is on frame ${playhead}.`}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CheckView
          title="Input camera · rigid program"
          subject="mug"
          camera={INPUT_CAMERA}
          pose={EXAMPLE_POSE}
          stamp={`pose ${stampPose(EXAMPLE_POSE)}`}
        />
        <CheckView
          title="Input camera · cardboard cutout"
          subject="cardboard"
          camera={INPUT_CAMERA}
          pose={null}
          stamp={`pose ${stampPose(CARDBOARD_POSE)}`}
        />
        <CheckView
          title={`Audit camera · az ${fmt(AUDIT_CAMERA.azimuth, 2)}° el ${fmt(AUDIT_CAMERA.elevation, 2)}° · rigid`}
          subject="mug"
          camera={AUDIT_CAMERA}
          pose={EXAMPLE_POSE}
          stamp={`pose ${stampPose(EXAMPLE_POSE)}`}
        />
        <CheckView
          title={`Audit camera · az ${fmt(AUDIT_CAMERA.azimuth, 2)}° el ${fmt(AUDIT_CAMERA.elevation, 2)}° · cardboard`}
          subject="cardboard"
          camera={AUDIT_CAMERA}
          pose={null}
          stamp={`pose ${stampPose(CARDBOARD_POSE)}`}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-white/10">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            Silhouette and pose checks for the rigid program and the cardboard cutout at frame {EXAMPLE_FRAME}
          </caption>
          <thead className="bg-[#222824] text-left text-xs uppercase tracking-wider text-[#b7b1a4]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Check</th>
              <th scope="col" className="px-3 py-2 font-medium">Threshold</th>
              <th scope="col" className="px-3 py-2 font-medium">Rigid program</th>
              <th scope="col" className="px-3 py-2 font-medium">Cardboard cutout</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px] text-[#f6f1e7]">
            <tr className="border-t border-white/10">
              <th scope="row" className="px-3 py-3 text-left font-sans text-sm font-medium">
                Silhouette IoU
                <span className="mt-0.5 block font-mono text-[10px] font-normal text-[#8f887c]">
                  vs input frame, {MEASURE_W}×{MEASURE_H}
                </span>
              </th>
              <td className="px-3 py-3 text-[#c9c2b4]">≥ {SILHOUETTE_PASS.toFixed(2)}</td>
              <td className="px-3 py-3">
                <Metric pending={!report} error={error} text={report ? report.rigidIou.toFixed(3) : ""} pass={report?.rigidSilhouettePass} />
              </td>
              <td className="px-3 py-3">
                <Metric pending={!report} error={error} text={report ? report.cardIou.toFixed(3) : ""} pass={report?.cardSilhouettePass} />
              </td>
            </tr>
            <tr className="border-t border-white/10">
              <th scope="row" className="px-3 py-3 text-left font-sans text-sm font-medium">
                Pose error
                <span className="mt-0.5 block font-mono text-[10px] font-normal text-[#8f887c]">
                  max of |Δroll|, |Δpitch|, |Δyaw| vs rigid labels
                </span>
              </th>
              <td className="px-3 py-3 text-[#c9c2b4]">≤ {POSE_PASS_DEG.toFixed(2)}°</td>
              <td className="px-3 py-3">
                <Metric pending={!report} error={error} text={report ? `${report.rigidPoseError.toFixed(2)}°` : ""} pass={report ? report.rigidPoseError <= POSE_PASS_DEG : undefined} />
              </td>
              <td className="px-3 py-3">
                <Metric pending={!report} error={error} text={report ? `${report.cardPoseError.toFixed(2)}°` : ""} pass={report ? report.cardPoseError <= POSE_PASS_DEG : undefined} />
              </td>
            </tr>
            <tr className="border-t border-white/10">
              <th scope="row" className="px-3 py-3 text-left font-sans text-sm font-medium">
                Depth extent
                <span className="mt-0.5 block font-mono text-[10px] font-normal text-[#8f887c]">
                  camera-space thickness of the shape
                </span>
              </th>
              <td className="px-3 py-3 text-[#c9c2b4]">≥ {DEPTH_PASS_M.toFixed(2)} m</td>
              <td className="px-3 py-3">
                <Metric pending={!report} error={error} text={report ? `${report.rigidDepth.toFixed(3)} m` : ""} pass={report ? report.rigidDepth >= DEPTH_PASS_M : undefined} />
              </td>
              <td className="px-3 py-3">
                <Metric pending={!report} error={error} text={report ? `${report.cardDepth.toFixed(3)} m` : ""} pass={report ? report.cardDepth >= DEPTH_PASS_M : undefined} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-[#0e110f] p-3 ring-1 ring-white/10">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#8f887c]">Rigid labels · frame {EXAMPLE_FRAME}</p>
          <p className="mt-1 font-mono text-sm text-[#f6f1e7]">{stampPose(EXAMPLE_POSE)}</p>
          <div className="mt-2">
            <Verdict pass={report?.rigidPosePass} pending={!report && !error} label="Pose check" />
          </div>
        </div>
        <div className="rounded-lg bg-[#0e110f] p-3 ring-1 ring-[#e15b4a]/30">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#f0a598]">Cardboard labels · frame {EXAMPLE_FRAME}</p>
          <p className="mt-1 font-mono text-sm text-[#f6f1e7]">{stampPose(CARDBOARD_POSE)}</p>
          <p className="mt-1 text-xs text-[#c9c2b4]">
            Billboard fit: yaw {fmt(CARDBOARD_POSE.yaw, 2)}°, pitch {fmt(CARDBOARD_POSE.pitch, 2)}°, roll {fmt(CARDBOARD_POSE.roll, 2)}°. Position matches. Orientation does not.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Verdict pass={report?.cardSilhouettePass} pending={!report && !error} label="Silhouette" />
            <Verdict pass={report?.cardPosePass} pending={!report && !error} label="Pose check" />
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[#f0a598]" role="alert">
          The silhouette measurement could not run. {error}
        </p>
      ) : null}
      {!report && !error ? (
        <p className="mt-3 text-sm text-[#c9c2b4]">Measuring silhouette overlap against the input frame…</p>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-[#e6a322]">{SIMULATION_LABEL}</p>
    </section>
  );
}

function CheckView({
  title,
  subject,
  camera,
  pose,
  stamp,
}: {
  title: string;
  subject: "mug" | "cardboard";
  camera: Camera;
  pose: Pose | null;
  stamp: string;
}) {
  const shadow = pose ?? EXAMPLE_POSE;
  return (
    <figure className="overflow-hidden rounded-xl bg-[#101410] ring-1 ring-white/10">
      <div className="relative aspect-[16/10]">
        <SceneCanvas
          subject={subject}
          pose={pose}
          camera={camera}
          light={camera === AUDIT_CAMERA ? auditLight() : INPUT_LIGHT}
          background={INPUT_BG}
          shadowX={shadow.x}
          shadowZ={shadow.z}
          label={title}
        />
      </div>
      <figcaption className="space-y-1 px-3 py-2">
        <p className="text-sm text-[#f6f1e7]">{title}</p>
        <p className="font-mono text-[11px] leading-relaxed text-[#e7e0d4]">{stamp}</p>
      </figcaption>
    </figure>
  );
}

function stampPose(pose: Pose): string {
  return `x ${fmt(pose.x, 3)}  y ${fmt(pose.y, 3)}  z ${fmt(pose.z, 3)}  roll ${fmt(pose.roll, 2)}  pitch ${fmt(pose.pitch, 2)}  yaw ${fmt(pose.yaw, 2)}`;
}

function Metric({
  pending,
  error,
  text,
  pass,
}: {
  pending: boolean;
  error: string | null;
  text: string;
  pass: boolean | undefined;
}) {
  if (error) return <span className="text-[#f0a598]">—</span>;
  if (pending || pass === undefined) {
    return <span className="inline-block h-4 w-16 animate-pulse rounded bg-white/10" aria-hidden="true" />;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">{text}</span>
      <Verdict pass={pass} pending={false} label="" />
    </span>
  );
}

function Verdict({
  pass,
  pending,
  label,
}: {
  pass: boolean | undefined;
  pending: boolean;
  label: string;
}) {
  if (pending || pass === undefined) {
    return <span className="inline-block h-5 w-14 animate-pulse rounded-full bg-white/10" />;
  }
  return (
    <Badge
      variant={pass ? "outline" : "destructive"}
      className={pass ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : ""}
    >
      {label ? `${label} ` : ""}
      {pass ? "pass" : "fail"}
    </Badge>
  );
}
