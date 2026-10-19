"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { drawBeauty } from "@/lib/draw";
import { INPUT_BG } from "@/lib/program";
import type { TrajectoryScene } from "@/lib/trajectory-scene";

export function TrajectoryCanvas({
  scene,
  label,
}: {
  scene: TrajectoryScene | null;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const measure = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      setSize({
        w: Math.max(2, Math.floor(rect.width * dpr)),
        h: Math.max(2, Math.floor(rect.height * dpr)),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || size.w < 2 || size.h < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setFailed(true);
      return;
    }
    canvas.width = size.w;
    canvas.height = size.h;
    if (!scene) {
      ctx.fillStyle = "#141816";
      ctx.fillRect(0, 0, size.w, size.h);
      return;
    }
    drawBeauty(ctx, size.w, size.h, {
      camera: scene.camera,
      light: scene.light,
      background: INPUT_BG,
      objects: scene.objects,
      shadow: null,
      stage: scene.stage,
    });
  }, [scene, size]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={failed ? `${label}. The canvas could not draw.` : label}
    />
  );
}
