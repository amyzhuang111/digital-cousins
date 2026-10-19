"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { SceneCanvas } from "@/components/scene-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fmt } from "@/lib/math";
import {
  COUSINS,
  FRAME_COUNT,
  PLAYBACK_FPS,
  POSES,
  SIMULATION_LABEL,
  frameAtSpeed,
  lightStamp,
} from "@/lib/program";

export function SampleCousins() {
  const [frame, setFrame] = useState(20);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrame((current) => (current + 1) % FRAME_COUNT);
    }, 1000 / PLAYBACK_FPS);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#171b18] p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#e6a322]">
            Sample comparison · off the imported file
          </p>
          <h2 className="font-display text-3xl text-[#f6f1e7]">Hand-written mug variants</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#c9c2b4]">
            Four re-renders of a hand-written 48-frame mug program: viewpoint, light, and speed only.
            They are not computed from the imported trajectory, and they are not a reconstruction.
            {" "}
            {SIMULATION_LABEL}.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setPlaying((current) => !current)}>
          {playing ? <Pause /> : <Play />}
          {playing ? "Pause sample" : "Play sample"}
        </Button>
      </div>
      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        {COUSINS.map((cousin) => {
          const shown = frameAtSpeed(frame, cousin.speed);
          const pose = POSES[shown];
          const light = lightStamp(cousin.light);
          return (
            <Card key={cousin.id} className="min-w-0 gap-0 overflow-hidden border-white/10 bg-[#101410] py-0 text-[#f6f1e7] ring-white/10">
              <div className="relative aspect-[16/10]">
                <SceneCanvas
                  subject="mug"
                  pose={pose}
                  camera={cousin.camera}
                  light={cousin.light}
                  background={cousin.background}
                  shadowX={pose.x}
                  shadowZ={pose.z}
                  label={`${cousin.name}, hand-written mug sample, frame ${shown}`}
                />
              </div>
              <CardHeader className="pt-3">
                <CardTitle className="font-display text-2xl">{cousin.name}</CardTitle>
                <CardDescription>{cousin.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <dl className="space-y-1 font-mono text-[11px] leading-relaxed text-[#efe6d4]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#8f887c]">view</dt>
                    <dd>
                      az {fmt(cousin.camera.azimuth, 2)}° el {fmt(cousin.camera.elevation, 2)}°
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#8f887c]">light</dt>
                    <dd>
                      {fmt(light[0], 2)} {fmt(light[1], 2)} {fmt(light[2], 2)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#8f887c]">speed</dt>
                    <dd>
                      {cousin.speed.toFixed(2)}× · f{String(frame).padStart(2, "0")}→f{String(shown).padStart(2, "0")}
                    </dd>
                  </div>
                </dl>
                <Separator className="my-2 bg-white/10" />
                <p className="font-mono text-[11px] leading-relaxed">
                  x {fmt(pose.x, 3)} y {fmt(pose.y, 3)} z {fmt(pose.z, 3)}
                  <br />
                  r {fmt(pose.roll, 2)} p {fmt(pose.pitch, 2)} y {fmt(pose.yaw, 2)}
                </p>
                <p className="mt-2 text-[11px] leading-snug text-[#e6a322]">{SIMULATION_LABEL}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
