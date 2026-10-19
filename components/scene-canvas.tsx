"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { drawBeauty } from "@/lib/draw";
import type { Camera, Light, Pose, RGB, Vec3 } from "@/lib/math";
import { FLOOR_Y } from "@/lib/program";
import { CARDBOARD, MUG } from "@/lib/scene";
import { cn } from "cn";

export function SceneCanvas({
  subject,
  pose,
  camera,
  light,
  background,
  shadowX,
  shadowZ,
  showShadow = true,
  label,
  className,
}: {
  subject: "mug" | "cardboard";
  pose: Pose | null;
  camera: Camera;
  light: Light;
  background: [RGB, RGB];
  shadowX?: number;
  shadowZ?: number;
  showShadow?: boolean;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const objects = useMemo(
    () =>
      subject === "mug"
        ? [{ mesh: MUG, pose }]
        : [{ mesh: CARDBOARD, pose: null }],
    [subject, pose],
  );

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
    const shadow: Vec3 | null =
      showShadow && shadowX !== undefined && shadowZ !== undefined
        ? [shadowX, FLOOR_Y + 0.004, shadowZ]
        : null;
    canvas.width = size.w;
    canvas.height = size.h;
    drawBeauty(ctx, size.w, size.h, {
      camera,
      light,
      background,
      objects,
      shadow,
    });
  }, [size, objects, camera, light, background, shadowX, shadowZ, showShadow]);

  return (
    <>
      <canvas
        ref={ref}
        role="img"
        aria-label={label}
        className={cn("absolute inset-0 h-full w-full", className)}
      />
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141816] p-4 text-center text-sm text-[#f4efe6]">
          This view could not draw. Canvas is unavailable in this browser.
        </div>
      ) : null}
    </>
  );
}
