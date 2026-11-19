# 001 — Dockerfile: prefix as a build argument, gate armed

## Scope

The builder stage of `Dockerfile` only.

## Files

- `Dockerfile`

## Acceptance criteria

1. The builder stage declares `BASE_PATH` as an `ARG` with an empty default.
2. An `ENV BASE_PATH=${BASE_PATH}` appears **after** the `ARG` and **before**
   `RUN npm run build`, because `next.config.ts` reads the variable when it loads the
   config — an `ARG` alone is invisible to `next build`.
3. `RUN node scripts/check-asset-prefix.mjs` inherits that `ENV`: it is the last
   instruction of the builder stage and nothing in between resets `BASE_PATH`.
4. A comment explains **why** the value reaches the gate, so the next refactor does not
   drop it again.
5. The runner stage, `prisma`, and the order `npm ci` → `prisma generate` → `build` →
   gate stay untouched.

## Verification command

```bash
npm run test -- tests/unit/docker-prefix.test.ts
```

## Result

(filled in after the verification run)

## Result — done

The builder stage now reads:

```dockerfile
ENV NEXT_TELEMETRY_DISABLED=1
# The path prefix the app is published under, e.g. `/darthub`. Empty (the
# default) means the app is served from the root.
ARG BASE_PATH=""
# `next.config.ts` reads BASE_PATH when it loads the config, so the value has
# to be in the environment of the build — an ARG on its own is invisible to
# `next build`. The same ENV then applies to the prefix gate below, so the
# build and the gate cannot disagree about the prefix.
ENV BASE_PATH=${BASE_PATH}
RUN npx prisma generate
RUN npm run build
RUN node scripts/check-asset-prefix.mjs
```

The runner stage, `prisma` and the order `npm ci` → `prisma generate` → `build`
→ gate are untouched.

The value reaches the gate through the `ENV`, so the gate and the build cannot
disagree: a prefixed build whose asset URLs lost the prefix fails the **image
build** (the gate exits 1), and a root build (empty `ARG`) still passes, because
the gate then checks against `/_next/`.

Verification: `npm run test -- tests/unit/docker-prefix.test.ts` → 5 passed; the
real image build with `--build-arg BASE_PATH=/darthub` and the real image build
without it both succeed (see `_plan.md` → "Image build evidence").
