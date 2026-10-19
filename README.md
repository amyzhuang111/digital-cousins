# Pose trajectory checker

Live: https://digital-cousins.vercel.app

Works on exported pose trajectories — not a reconstruction model.

Import a CSV or JSON pose trajectory exported from COLMAP, ARKit, Blender, or motion capture. The page draws that path and measures what a pose file can actually support:

- missing integer frames
- teleport jumps, when the position delta between consecutive valid frames is greater than a threshold (default 0.25 file units)
- rotation spikes, when the frame-to-frame rotation is greater than a threshold (default 20°)
- mean and max rotation delta, in degrees, from the quaternion angle `2·acos(|dot|)`

A pose file has no image, so silhouette overlap is not computed. This is not a monocular 3D reconstruction model.

An optional panel can show a hand-written mug animation (viewpoint, light, and speed variants). It is off by default, labelled as a sample, and not computed from the import.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm run verify
npm run lint
npm run build
```

`npm run verify` checks the hand-written mug geometry and the trajectory fixture.

## File format

Download the CSV or JSON template from the page, or copy `public/trajectory-template.csv` and `public/trajectory-template.json`.

| Field | Names |
| --- | --- |
| Frame | `frame` (integer) |
| Time | `timestamp` (seconds, or any file time unit) |
| Position | `x`, `y`, `z` (also `tx`/`ty`/`tz`) |
| Euler rotation | `roll`, `pitch`, `yaw` in degrees |
| Quaternion | `qw`, `qx`, `qy`, `qz` (used when both are present) |
| Object | `object_id` |

Euler order matches the viewer: yaw about Y, then pitch about X, then roll about Z. Units stay in file units. Bad rows are kept and listed. They are not used in the path.

The last import and the thresholds are stored in `localStorage` under `pose-trajectory-tool-v1`.

Export writes `checker-report.json` or `checker-report.csv` with each flagged frame and the measured deltas.

## Sample fixture

`public/sample-trajectory.csv` is synthetic. The page labels it SAMPLE. It is not a capture.

Ten rows, object `cam0`, frames 0, 1, 2, 3, 5, 6, 7, 8, 9, 10. At the default thresholds the checker flags exactly three issues:

| Flag | Frame | Measurement |
| --- | --- | --- |
| Missing frame | 4 | No row between frame 3 and frame 5 |
| Teleport | 7 | 2.0 file units from frame 6, rotation delta 2° |
| Rotation spike | 9 | 90° from frame 8 (yaw 16° to 106°), position delta 0.05 |

The step across the gap, frame 3 to 5, is 0.10 file units and 4°. That is under both thresholds, so it is not a teleport or a spike. The other seven steps are 0.05 file units and 2°.

## Demo, about 30 seconds

1. Open the page. It starts empty.
2. Choose **Load sample trajectory**. The banner says SAMPLE.
3. Press play, then scrub to the teleport and the rotation spike. The readout is the file.
4. Read the three flags: missing frame 4, teleport 2.0 at frame 7, rotation spike 90° at frame 9.
5. Export the checker report. The status line names the file and the flag count.

## Deploy

Packaging for Vercel is in [DEPLOY.md](DEPLOY.md): team `amys-projects-d3dfb125`, project `digital-cousins`, framework `nextjs`, build output `.next`. That note does not deploy the app.
