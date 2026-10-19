import { depthExtent, iou, rasterMask } from "@/lib/raster";
import type { Mesh } from "@/lib/mesh";
import {
  CARDBOARD_POSE,
  DEPTH_PASS_M,
  EXAMPLE_FRAME,
  INPUT_CAMERA,
  POSE_PASS_DEG,
  POSES,
  SILHOUETTE_PASS,
  poseErrorDeg,
} from "@/lib/program";

export const MEASURE_W = 360;
export const MEASURE_H = 240;

export type CheckReport = {
  rigidIou: number;
  cardIou: number;
  rigidDepth: number;
  cardDepth: number;
  rigidPoseError: number;
  cardPoseError: number;
  rigidSilhouettePass: boolean;
  cardSilhouettePass: boolean;
  rigidPosePass: boolean;
  cardPosePass: boolean;
};

export function measureChecks(mug: Mesh, cardboard: Mesh): CheckReport {
  const pose = POSES[EXAMPLE_FRAME];
  const rigid = rasterMask(mug, pose, INPUT_CAMERA, MEASURE_W, MEASURE_H);
  const card = rasterMask(cardboard, null, INPUT_CAMERA, MEASURE_W, MEASURE_H);
  const rigidIou = iou(rigid.color, rigid.color);
  const cardIou = iou(rigid.color, card.color);
  const rigidDepth = depthExtent(mug, pose, INPUT_CAMERA);
  const cardDepth = depthExtent(cardboard, null, INPUT_CAMERA);
  const rigidPoseError = poseErrorDeg(pose, pose);
  const cardPoseError = poseErrorDeg(pose, CARDBOARD_POSE);
  const rigidPosePass = rigidPoseError <= POSE_PASS_DEG && rigidDepth >= DEPTH_PASS_M;
  const cardPosePass = cardPoseError <= POSE_PASS_DEG && cardDepth >= DEPTH_PASS_M;
  return {
    rigidIou,
    cardIou,
    rigidDepth,
    cardDepth,
    rigidPoseError,
    cardPoseError,
    rigidSilhouettePass: rigidIou >= SILHOUETTE_PASS,
    cardSilhouettePass: cardIou >= SILHOUETTE_PASS,
    rigidPosePass,
    cardPosePass,
  };
}
