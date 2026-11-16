# 003 — Regression test: the Docker build must carry the prefix and the gate must be armed

## Scope

A new unit test that reads the deployment files and checks their structure. No Docker
daemon, no image build — the assertions are about the files, which is what the defect
was.

## Files

- `tests/unit/docker-prefix.test.ts`

## Acceptance criteria

1. The `Dockerfile` builder stage **declares** `BASE_PATH` as an `ARG` and **exports**
   it before `npm run build` — the order in the file is checked, not just the presence
   of the strings.
2. The gate instruction inherits the same `BASE_PATH` the build used: the effective
   value of the variable at the gate is the one the build saw, and it is not an empty
   literal — a gate without a prefix must not count as armed.
3. `docker-compose.yml` passes `BASE_PATH` as a build argument, with an empty default
   so the root build stays the default.
4. The test fails against the old state. Proof: the old files are written to a
   temporary directory, the same test is run against them, and it goes red. The
   temporary directory is never committed.

## Verification command

```bash
npm run test -- tests/unit/docker-prefix.test.ts
```

## Result

(filled in after the verification run)

## Result — done

`tests/unit/docker-prefix.test.ts` (5 tests) reads the two deployment files,
parses the Dockerfile into stages and checks:

1. the builder stage declares `BASE_PATH` as an `ARG` (default empty);
2. it exports the prefix as an `ENV` **after** the `ARG` and **before**
   `npm run build`, and the exported value is the build argument
   (`${BASE_PATH}`), not a literal;
3. the gate instruction inherits that same value — the effective value at the
   gate equals the one at the build and is not empty, so the gate is not
   disarmed;
4. `docker-compose.yml` passes `BASE_PATH` as a build argument with an empty
   default;
5. behaviourally: the gate script fails a prefixed build whose asset URLs lost
   the prefix, and passes the same build when it is not told about a prefix —
   which is why the Dockerfile has to hand it the value.

Red against the old state (proof, the temporary copy is not committed):

```
$ DARTHUB_ROOT=/tmp/darthub-oldstate npx vitest run tests/unit/docker-prefix.test.ts
 × declares BASE_PATH as a build argument in the builder stage
 × exports the prefix to the build, not only declares it
 × runs the prefix gate with the same prefix the build used
 × passes the prefix through in docker-compose.yml
 Test Files  1 failed (1)
      Tests  4 failed | 1 passed (5)
```

The fifth test passes against the old state as well: the gate script itself was
never the defect, only its wiring was.

`DARTHUB_ROOT` exists for exactly this replay; the default is the repository.
