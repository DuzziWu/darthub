<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository layout

- The git repository root is `darthub/` (remote: `https://github.com/DuzziWu/darthub.git`, branch `main`). The parent `/projects` directory is a separate, empty git repo that merely contains it — do not run git commands there expecting the project history.
- The `nextjs-agent-rules` block at the top of this file is re-added automatically by `next dev`. Removing it from a diff only re-creates the uncommitted change, so commit it together with your work.

## Environment setup notes

- npm 12 blocks **dependency** install scripts unless they are allowlisted, so `npm install` and `npm ci` never run `@prisma/client`'s postinstall and the Prisma client is not generated. Run `npx prisma generate` explicitly after every install; esbuild ships its platform binary as an optional dependency and works without the script. The root project's own scripts (like `prepare`) still run — only the dependencies' scripts are blocked.
- The Prisma client is **not** checked in, and `npm ci` does not generate it either. Any environment that compiles the app from a clean install must run `npx prisma generate` first — including the Dockerfile's builder stage and both CI jobs, which do this explicitly. `prisma generate` needs no database: it reads the schema, not the datasource URL, so it succeeds without `DATABASE_URL` set. Without it, `npm run typecheck` and `npm run build` both fail with `Module '"@prisma/client"' has no exported member 'PrismaClient'`.
- The build is **green**: typecheck, lint, format check and the full Vitest suite (97 files, 456 tests) all pass.

Two checks are conditional on the environment and skip rather than fail:

- `tests/unit/dockerignore.test.ts` needs a running Docker **daemon** — the CLI alone is not enough, and the test probes this with `docker info`.
- `tests/unit/tailwind/tailwindToolchain.test.ts` asserts against a production build in `.next/`, so it needs `npm run build` to succeed first.

`tests/unit/ci-workflow.test.ts` runs the CI steps locally, so it fails whenever typecheck or the test suite fails.

## Development server origins

Next.js 16 blocks cross-origin requests to dev-only assets and answers a refused request with **403**. The refused request breaks the app in a way that looks alive but is not: the server HTML still renders, so the setup form and the "Start match" button appear, but the client bundle never hydrates, so React attaches no handler and the button does nothing.

This is why the app must be reached through an origin in `allowedDevOrigins` in `next.config.ts`:

- `localhost` and its subdomains are allowed by Next.js itself.
- `127.0.0.1`, `[::1]` and `0.0.0.0` are allowlisted explicitly.
- The machine's own network addresses are allowlisted automatically, so the "Network:" URL the dev server prints is usable.
- Anything else — a LAN hostname, a tunnel — goes in the `ALLOWED_DEV_ORIGINS` environment variable, as a comma-separated list of hostnames with no scheme and no port.

Only the hostname of the `Origin` header is matched, so entries are written as bare hostnames. IPv6 addresses are bracketed, because that is the form Next.js parses an `Origin` hostname into.

Diagnosing this: a page that renders but does not respond is the symptom. Compare `Object.keys(button).some((key) => key.startsWith("__react"))` on the button — a hydrated React element has a fiber key on its DOM node, an unhydrated one does not. The dev server logs the refused request with the host it wants allowlisted.

`tests/unit/devOrigins.test.ts` guards this with Next.js's own `blockCrossSiteDEV`, and `e2e/start-match.spec.ts` guards the behaviour end to end.

### The HMR WebSocket is what blocks hydration

The refused request that matters is `/_next/hmr`. The Turbopack dev client connects to it **before** it hydrates, and a refused connection leaves the page rendered from the server HTML but never hydrated — so "Start match" is visible, un-disabled and completely inert.

This is reproducible without any proxy: block the WebSocket with Playwright's `page.routeWebSocket("**/_next/hmr**", ws => ws.close())` and the button loses its `__react` fiber key while every `_next/static/chunks/*` request still answers 200. Nothing in the network panel points at the cause, because the failing request is a WebSocket handshake and the HTML and the chunks are fine.

Two consequences worth remembering:

- The allowlist must cover the host the **browser** uses, not the host the server binds. `allowedDevOrigins` is matched against the `Origin` header's hostname, so a Tailscale MagicDNS name (`<host>.<tailnet>.ts.net`) has to be in it; the loopback and container addresses being there does not help.
- A production build is immune: `blockCrossSiteDEV` only runs in development (`node_modules/next/dist/server/lib/router-server.js`), and the production server hydrates through the prefix proxy without trouble.

To see which host Next.js refused, read `.next/dev/logs/next-development.log` — it logs one `Blocked cross-origin request to Next.js dev resource /_next/hmr from "<host>"` warning naming the exact host to add.

## End-to-end tests

`npm run test:e2e` runs the Playwright suite in `e2e/`. Two things about it are easy to get wrong:

- It runs against a **production build**, not `next dev`. `playwright.config.ts` owns the server: it runs `npm run build`, copies `public/` and `.next/static/` next to the standalone server the way the Dockerfile's runner stage does, and starts `node .next/standalone/server.js` with `HOSTNAME=127.0.0.1`. Against `next dev` the visual QC specs took 8+ minutes and failed on timeouts, because the dev server recompiles every route on demand and keeps the page busy enough to stall Playwright's actionability checks; against the production build the same specs pass in about 40 seconds.
- `next.config.ts` sets `output: "standalone"`, so `next start` prints a warning ("does not work with output: standalone"), but it **does** serve the app and all the routes work. For the production-like server the suite runs against, use the standalone server directly as `playwright.config.ts` does — it is what the Docker image runs.

The browsers are not installed by `npm ci`. Run `npx playwright install chromium` once before the first local e2e run (`npx playwright install --with-deps chromium` needs root, so it is the CI job that does it).

Seven tests are `test.skip(...)` placeholders for features that are not built yet — the career, login and matchmaking flows. They are skipped by design, not by an environment check.

## Publishing under a path prefix

`BASE_PATH` publishes the app under a sub-path, e.g. `/darthub` behind Tailscale Serve. It is read when `next.config.ts` is loaded, so it must be set **for the build**, not only for the server.

- `assetPrefix` moves the asset URLs under the prefix; `basePath` is deliberately **not** set. Tailscale Serve strips the mount prefix before it forwards the request (`http.StripPrefix` in `ipn/ipnlocal/serve.go`), so the backend sees `/game` for a browser that asked for `/darthub/game`. Next.js answers 404 for a path that does not start with the `basePath`, so moving the routes would break them.
- The app's own links are prefixed through `NEXT_PUBLIC_BASE_PATH` and `src/lib/basePath.ts`. `next/link` cannot be used for this, because it derives the prefix from `basePath`.
- `usePathname()` reports the path **without** the prefix, so the comparisons in `ShellNav` and `ShellBrand` stay unprefixed. Compare them against the unprefixed route.
- `npm run build:prefixed` builds `/darthub` into `.next-prefixed/`. The standalone server then lives at `.next-prefixed/standalone/server.js` and its assets under `.next-prefixed/standalone/.next-prefixed/static/` — the dist directory is repeated inside the standalone tree, because the server resolves `.next-prefixed` relative to its own directory.
- The proxy must strip **only** the path and forward the query string as it is. Tailscale keeps it, and the client router asks for `?_rsc=…`; a proxy that swallows the query breaks every client-side navigation. `e2e/subpath-preview.spec.ts` reproduces this and is the regression test.

### Serving the live preview

The preview is served by the standalone server of the prefixed build, not by `next dev`:

```bash
cd /projects/darthub
npm run build:prefixed
cp -r public .next-prefixed/standalone/public
cp -r .next-prefixed/static .next-prefixed/standalone/.next-prefixed/static
setsid -f env HOSTNAME=0.0.0.0 PORT=3000 node .next-prefixed/standalone/server.js
```

`next dev` compiles on demand, so a cold route drops requests while it compiles and the preview flickers. The standalone server is the same server the Docker runner stage uses, and it is stable under a proxy.

The server must be started with `setsid -f`. Without the `-f` the process stays a child of the shell that started it, and it dies with the session. With it, the process is adopted by PID 1 and outlives the agent session:

```bash
ps -o pid,ppid,sid,cmd -p <pid>   # PPID 1 and a SID of its own means it is detached
```

`HOSTNAME=0.0.0.0` binds every interface. The container reaches itself at `172.18.0.2`, which is the address Tailscale Serve forwards to, so `curl http://172.18.0.2:3000/` is the check that the host side can reach the server.

The server answers the routes at the root, not at `/darthub`: Tailscale Serve strips the mount prefix before it forwards. `/darthub` on the backend answers 404, and that is correct — it is the proxy that turns `/darthub` into `/`. The assets are served under both paths, so either direction resolves them.

## Continuous integration

`.github/workflows/ci.yml` has two jobs. `Lint, format, typecheck, test` runs the gates above. `End-to-end (Playwright)` installs the Chromium browser and runs `npm run test:e2e`. Both jobs run `npx prisma generate` after `npm ci`, so the build does not depend on npm's install-script policy: CI's Node 22 ships npm 10, which runs the Prisma postinstall, but a local npm 12 blocks it, and the typecheck and the build both fail on an ungenerated client.

The e2e job was missing from the committed workflow until 2026-11-13, while `tests/unit/ci-workflow.test.ts` already required one, so every push ran red on that test alone.

`tests/unit/ci-workflow.test.ts` guards both jobs: it asserts an e2e job exists and installs the browsers, and it replays the workflow's `npm run` steps locally so a broken gate fails before it reaches GitHub. The e2e step is excluded from that replay, because the replay environment has no browsers.

The lint gate was red for a long time without anybody noticing: ESLint does not honour `.gitignore`, and the generated `.next/**` bundles were being linted as if they were source, which produced ~9 300 errors in `tests/unit/linting.test.ts` and `tests/unit/ci-workflow.test.ts`. `eslint.config.mjs` now ignores `.next-prefixed/**` as well, and the source tree lints clean. **A build output directory must be added to `eslint.config.mjs` when one is introduced** — otherwise the gate goes red with errors that have nothing to do with the code.

Pushing a change to `.github/workflows/` needs a GitHub token with the `workflow` scope. A token with only `repo` is rejected by GitHub with _"refusing to allow a Personal Access Token to create or update workflow"_, and the REST API answers `404` for the same reason — the scope is not a repository permission, so a repository admin token still cannot write workflow files without it.

## Testing conventions

- Component tests need a per-file `// @vitest-environment jsdom` docblock; the global environment stays `"node"`.
- The Testing Library `cleanup()` is registered globally in `tests/setup.ts` (via `setupFiles` in `vitest.config.ts`). Do not add per-file `afterEach(cleanup)` calls, and do not remove the setup file — without it a React root outlives the jsdom environment and React's `setImmediate`-based scheduler throws `window is not defined`.
- Route handlers take injected services so tests need no database. Follow `src/auth/linkGuestRoutes.ts` and `src/rating/ratingRoutes.ts`: the `app/api/**/route.ts` file wires the production runtime, the `src/**/route*.ts` file holds the logic.
- Shared test doubles live in `tests/support/` (for example `tests/support/inMemoryAuthRepository.ts`).

## AI development workflows

`docs/ai-skills/` holds the plan for DartHub's project-specific AI skills:

- `docs/ai-skills/README.md` — the upstream skill evaluation, the architecture analysis, and the six `darthub-*` skills with their trigger design.
- `docs/ai-skills/skills/` — the source of truth for the six skills (`darthub-architect`, `darthub-backend`, `darthub-code-review`, `darthub-frontend`, `darthub-game-engine`, `darthub-qa`), each with a `SKILL.md` and its `references/`.

The skills are **installed** in `.agents/skills/` — the OpenHands 1.61.0 project-scoped location — and are byte-identical to `docs/ai-skills/skills/`. Edit `docs/ai-skills/skills/` and copy across, or the two will drift. `.claude/skills/` holds Claude Code format skills, which OpenHands does not read.

The skills encode the architectural invariants documented in `docs/ai-skills/README.md` §2.3. Read that section before making a structural change.
