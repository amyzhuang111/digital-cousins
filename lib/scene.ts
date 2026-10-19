import { buildCardboard, buildMug } from "@/lib/mesh";
import { EXAMPLE_FRAME, INPUT_CAMERA, POSES } from "@/lib/program";

export const MUG = buildMug();
export const CARDBOARD = buildCardboard(MUG, POSES[EXAMPLE_FRAME], INPUT_CAMERA);
