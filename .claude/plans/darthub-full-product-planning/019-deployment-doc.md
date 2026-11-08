# Task 019: Write deployment documentation (install, update, self‑host guide)

**Status**: completed
**Depends on**: 018
**Retry count**: 0

## Description
Document step‑by‑step instructions for developers to set up the project locally and for operators to deploy on a VPS using Docker Compose. Include update procedure and troubleshooting.

## Context
- Files: `docs/DEPLOYMENT.md`.
- Use existing project README as reference.

## Requirements (Test Descriptions)
- [x] `it contains sections: prerequisites, environment variables, docker compose commands, data migration`
- [x] `it provides a rollback guide`
- [x] `it lists required ports and firewall rules`
- [x] `it is lint‑checked for Markdown style`

## Acceptance Criteria
- Documentation builds without broken links.
- New developer can follow it to get a running instance.

## Implementation Notes
- Wrote `docs/DEPLOYMENT.md` (`#` title plus `##` sections: Prerequisites, Local
  Development, Environment Variables, Docker Compose Commands, Data Migration,
  Updating the Deployment, Rollback, Ports and Firewall Rules, Troubleshooting,
  Verification Status, Related Documents) and `tests/unit/docs/deploymentDocs.test.ts`
  with the four requirement tests plus anchor-aware link and lint checks.
- Content is grounded in the actual `Dockerfile` (node:22-alpine, runner stage without
  Prisma CLI, port 3000), `docker-compose.yml` (app + postgres:16-alpine,
  POSTGRES_PASSWORD fail-fast interpolation, postgres-data named volume, pg_isready
  healthcheck), `package.json` scripts (`db:migrate`/`db:deploy`), `prisma/migrations/`
  (initial migration), and the README command table.
- Reflects review finding S-4: recommends binding postgres to 127.0.0.1 or dropping the
  5432 host mapping on a VPS, and firewall rules ufw allow 3000 / deny 5432.
- The `runner` image lacks the Prisma CLI, so the data-migration section instructs
  running `npm run db:deploy` from the host against the published 5432 port; includes a
  "Verification Status" honesty note that a live Docker build/serve run has been deferred.
- `.env.example` is referenced by name only (no link/content dependence) because task 033
  writes it concurrently; `tests/unit/docs/docs.test.ts` was NOT modified (owned by
  another worker).
- Validation: `npx vitest run tests/unit/docs/deploymentDocs.test.ts` — 5 passed / 5
  (after RED confirmation with 5 failures on the pre-doc run). Both new files pass
  `npx prettier --check`. No commits made.
