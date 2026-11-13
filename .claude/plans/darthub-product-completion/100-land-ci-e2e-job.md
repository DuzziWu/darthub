# Task 100: Land the CI e2e job and get `main` green

**Status**: pending
**Depends on**: none
**Retry count**: 0

## Description
The repository is green locally and red on GitHub. Every CI run since `4695efe` concludes `failure` at the `Test` step, because `tests/unit/ci-workflow.test.ts` asserts that a CI job runs the Playwright suite, and the workflow file that adds that job was never committed. This task lands the workflow and restores a green `main`. It is first in the plan because every later task is validated by the same gate.

## Context
- Related files: `.github/workflows/ci.yml`, `tests/unit/ci-workflow.test.ts`, `playwright.config.ts`, `package.json`, `Dockerfile`
- The guard test asserts two things: that a job's steps include `npm run test:e2e`, and that that job has a step whose `run` contains `playwright install`. It also replays every non-test `npm run` step of the workflow locally.
- The working tree already contains the `e2e` job (uncommitted). It installs Chromium with `npx playwright install --with-deps chromium` and uploads the Playwright report as an artifact.
- The token in use has scopes `read:user, repo`. GitHub refuses workflow-file writes without `workflow` scope: *"refusing to allow a Personal Access Token to create or update workflow"*. The REST API answers `404` for the same reason — it is a scope limitation, not a repository permission.

## Requirements (Test Descriptions)
- [ ] `it defines a workflow that triggers on push` (existing — must stay green)
- [ ] `it runs the end-to-end suite in its own job, with the browsers installed` (existing — must turn green)
- [ ] `it runs the CI workflow successfully on push` (existing — must stay green)
- [ ] `it generates the Prisma client before the e2e build` (new)
- [ ] `it provides a database service to the e2e job` (new)

## Acceptance Criteria
- `.github/workflows/ci.yml` on `main` contains the `e2e` job with the Playwright browser install and the `npm run test:e2e` step.
- `npm test` passes locally with all 96 test files green.
- The GitHub Actions run for the commit that lands the workflow reports `success` for both jobs.
- The guard test is **not** weakened, skipped, or excluded to make the run green.
- The e2e job runs `npx prisma generate` before `npm run test:e2e`, because the Prisma client is not checked in and `npm ci` does not generate it — the same trap the Dockerfile's builder stage already handles.

**Do not** delete or edit the `ci-workflow` assertions. They are the mechanism this task satisfies, not an obstacle to it.

## Implementation Notes

**The order of operations matters.** The workflow change must be committed and pushed for the guard test to pass, but the push requires a `workflow`-scoped token. Sequence:

1. Verify the workflow file locally against the guard test: `npx vitest run tests/unit/ci-workflow.test.ts`.
2. Add `npx prisma generate` to the e2e job before the build, and a `services: postgres:` block with `DATABASE_URL` — the e2e job will need a database for the later auth and matchmaking specs, and adding the service now avoids a second workflow change under the same token constraint.
3. Commit the workflow change.
4. Push with a `workflow`-scoped token. If none is available, request one through the secret-request mechanism and stop — do not work around it.

**The first push will be red, and that is expected.** The guard test asserts the e2e job is present in the committed workflow. The commit that adds the job cannot pass its own guard until it is on GitHub, so the run for that commit fails and the next commit goes green. This is inherent to adding a CI job that its own guard requires. It resolves on the following commit, so land a small follow-up commit (for example the plan document itself) right after.

**Do not add `if: always()` or any other conditional to the guard test.** The guard is a real gate. A conditional that lets it skip in CI would defeat the purpose.

**The e2e job needs a PostgreSQL service.** GitHub Actions supports service containers:

```yaml
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: darthub
          POSTGRES_PASSWORD: darthub
          POSTGRES_DB: darthub
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U darthub"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
```

with `DATABASE_URL: postgresql://darthub:darthub@localhost:5432/darthub` in the job's `env`. The migration at `prisma/migrations/20260101000000_init` must then be applied with `npm run db:deploy` before the specs run.

**The Playwright report artifact path.** The reporter is `html`, which writes to `playwright-report/`. The existing job uploads that path with a 7-day retention — correct as written, but verify the directory exists after a failed run or `upload-artifact@v4` warns about a missing path. Setting `if: ${{ !cancelled() }}` (already present) is right: the report is most valuable precisely when the run failed.
