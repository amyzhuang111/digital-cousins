# Deploy Digital Cousins

Works on exported pose trajectories — not a reconstruction model.

This file is the packaging note for a person on the team. Nothing here deploys the app by itself.

| | |
| --- | --- |
| Team | `amys-projects-d3dfb125` |
| Vercel project | `digital-cousins` |
| Framework | Next.js (`nextjs`), from the `next` dependency and `npm run build` (`next build`) in `package.json` |
| Build output | `.next` |

`vercel.json` sets the framework to `nextjs` and the build command to `npm run build`. It does not set `outputDirectory`. This app is a Next.js server app, not a static export, and Vercel’s Next.js builder reads `.next` itself. Pointing a static output directory at `.next` would skip that builder.

The sample trajectory and the CSV/JSON templates ship in `public/` and are part of the deploy.

## Login or token

Use one of these on the machine that will deploy. Do not commit a token, and do not put one in the repo. `.env*` and `.vercel/` are gitignored.

Interactive login:

```bash
npx vercel login
```

Or a token for this shell only, created at [vercel.com/account/tokens](https://vercel.com/account/tokens):

```bash
export VERCEL_TOKEN="paste-the-token-here"
```

When a token is set, add `--token "$VERCEL_TOKEN"` to `vercel link` and `vercel deploy`. `npx vercel` also reads `VERCEL_TOKEN` from the environment when `--token` is omitted.

## Link

From the repository root, after `npm install`:

```bash
npx vercel link --yes --scope amys-projects-d3dfb125 --project digital-cousins
```

With a token:

```bash
npx vercel link --yes --scope amys-projects-d3dfb125 --project digital-cousins --token "$VERCEL_TOKEN"
```

Link writes `.vercel/` on this machine. Leave that directory uncommitted.

## Production deploy

```bash
npx vercel deploy --prod --yes --scope amys-projects-d3dfb125
```

With a token:

```bash
npx vercel deploy --prod --yes --scope amys-projects-d3dfb125 --token "$VERCEL_TOKEN"
```

`--prod` promotes the deployment to the `digital-cousins` production URL. The linked project name comes from the `vercel link` step above. Run link first so the deploy targets `digital-cousins` in team `amys-projects-d3dfb125`.
