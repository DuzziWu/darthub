# 004 — Runbook: actual topology, container variant as alternative, guard kept

## Scope

`AGENTS.md` (§ "Serving the live preview"), `docs/DEPLOYMENT.md` (§ "Publishing under a
path prefix") and the test that guards them.

## Files

- `AGENTS.md`
- `docs/DEPLOYMENT.md`
- `tests/unit/live-preview.test.ts`

## Acceptance criteria

1. Both documents describe the **actual** topology: the published preview is a host
   process started with `setsid -f env HOSTNAME=0.0.0.0 PORT=3000 node
.next-prefixed/standalone/server.js` from the prefixed build, and the Tailscale mount
   `/darthub` points at `http://127.0.0.1:3000` on the same host.
2. The container variant stays documented as an alternative — Compose plus `BASE_PATH` as
   a build argument, the proxy reaching the container on `172.18.0.2:3000`.
3. The lessons survive: port 3000 belongs to the preview alone (the E2E suite uses
   3100/3111; `reuseExistingServer` displaced the preview on 2026-11-14), the 502 shape
   ("broken for every user, every local check green"), a rebuild invalidates the running
   server (exact PID, never `pkill`), the proxy strips the prefix.
4. `tests/unit/live-preview.test.ts` keeps catching: the E2E suite does not take port
   3000, the bind address is documented, the 502 failure form is documented. The
   assertion that nailed the old container path is replaced by an assertion about the
   current topology — and the container variant gets its own assertion, so the guard
   grows instead of shrinking.

## Verification command

```bash
npm run test -- tests/unit/live-preview.test.ts tests/unit/docs/deploymentDocs.test.ts
```

## Result

(filled in after the verification run)

## Result — done

`AGENTS.md` § "Serving the live preview" now describes the actual topology: the
published preview is a **host process** (the standalone server of the prefixed
build, started with `setsid -f` in the main checkout), and the Tailscale mount
points at `http://127.0.0.1:3000` on the same host. The new subsection "The
container variant" keeps the image path documented — Compose plus `BASE_PATH` as
a build argument, the proxy reaching the container on `172.18.0.2:3000`.

`docs/DEPLOYMENT.md` § "Publishing under a path prefix" mirrors it: the build
variable (including the Docker build argument), the mount, the host process, the
bind address and the 502 shape, the container variant, the PID rule and the
gate.

`tests/unit/live-preview.test.ts` — the changed assertions and why:

| assertion         | before                                    | after                                                                                                              | why                                                                                                                        |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| bind address      | `toContain("HOSTNAME=0.0.0.0 PORT=3000")` | unchanged                                                                                                          | still the rule                                                                                                             |
| 502 shape         | `toMatch(/502/)`                          | unchanged                                                                                                          | still the failure form                                                                                                     |
| topology          | `toMatch(/172\.18\.0\.2/)`                | `toContain(".next-prefixed/standalone/server.js")`, `toContain("setsid -f")`, `toContain("http://127.0.0.1:3000")` | the old assertion nailed the container path, which is no longer the published topology; the new ones state the current one |
| container variant | —                                         | `toMatch(/172\.18\.0\.2/)`, `toContain("BASE_PATH=/darthub")` (AGENTS.md **and** DEPLOYMENT.md)                    | the alternative topology keeps its own guard — the guard grows, it does not shrink                                         |
| port 3000         | `not.toMatch(/PORT=3000\b/)`              | unchanged                                                                                                          | still the rule                                                                                                             |

The E2E-suite assertions are untouched.

Verification: `npm run test -- tests/unit/live-preview.test.ts tests/unit/docs/deploymentDocs.test.ts`
→ 6 passed; the Markdown lint in `deploymentDocs.test.ts` passes.

### Superseded by 005 (Owner-Entscheidung 2026-11-16)

The bind-address rule in this package is **superseded**: the owner corrected the
topology assumption — the published preview binds **`127.0.0.1`**, not `0.0.0.0`;
the `0.0.0.0` rule belongs to the **container** topology, where the proxy reaches
the container across the bridge on `172.18.0.2:3000`. The rows "bind address" and
the acceptance criterion 1 of this package therefore read as history. See
`005-bind-address-correction.md` for the current state.
