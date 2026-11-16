# 002 — docker-compose.yml: pass the prefix through, document the switch

## Scope

The build section of the `app` service and the header comment.

## Files

- `docker-compose.yml`

## Acceptance criteria

1. `services.app.build.args.BASE_PATH` exists and carries the environment value
   (`${BASE_PATH:-}`), so the prefix can be switched on from the environment.
2. The default is the **root** build: an unset `BASE_PATH` yields an empty build
   argument. Existing deployments keep their behaviour.
3. The header comment explains how to publish the image under `/darthub` and how the
   root operation stays the default.
4. `POSTGRES_PASSWORD` stays fail-fast, `DATABASE_URL` wiring unchanged, no secrets in
   the file.

## Verification command

```bash
npm run test -- tests/unit/docker.test.ts tests/unit/docker-prefix.test.ts
```

## Result

(filled in after the verification run)

## Result — done

`docker-compose.yml` gained the build argument and a header comment:

```yaml
args:
  # The path prefix the app is published under, e.g. `/darthub`. Empty by
  # default, so the image is built for the root. See the header comment.
  BASE_PATH: "${BASE_PATH:-}"
```

`docker compose config` proves both states:

- `BASE_PATH` unset → `args: BASE_PATH: ""` → root build (unchanged behaviour).
- `BASE_PATH=/darthub` → `args: BASE_PATH: /darthub` → prefixed build.

`POSTGRES_PASSWORD` stays fail-fast (`${POSTGRES_PASSWORD:?…}`), the
`DATABASE_URL` wiring is unchanged and no secret is in the file.

Verification: `npm run test -- tests/unit/docker.test.ts tests/unit/docker-prefix.test.ts`
→ 8 passed; `docker compose config` → exit 0 in both states.
