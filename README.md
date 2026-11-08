# DartHub

DartHub is a modular, server-authoritative multiplayer dart game built with Next.js
(React), TypeScript, and a clean domain-driven backend.

## Getting started

```bash
npm install
npm run dev
```

## Common commands

| Command                | Purpose                        |
| ---------------------- | ------------------------------ |
| `npm run dev`          | Start the development server   |
| `npm test`             | Run unit/integration tests     |
| `npm run lint`         | Lint with ESLint               |
| `npm run lint:fix`     | Auto-fix lint errors           |
| `npm run format`       | Format with Prettier           |
| `npm run format:check` | Verify Prettier formatting     |
| `npm run typecheck`    | Type-check with `tsc --noEmit` |

## Git pre-commit hook

Before every commit, a pre-commit hook runs ESLint (`eslint . --max-warnings=0`)
and Prettier (`prettier . --check`). If either check fails, the commit is aborted
until the reported problems are fixed (warnings are treated as errors).

- The hook script lives in `.husky/pre-commit` and is plain POSIX `sh`, so it works
  on Windows (Git for Windows' bundled sh) and on Unix.
- Setup is automatic: running `npm install` triggers the `prepare` script, which
  executes `git config core.hooksPath .husky` for the cloned repository. To set it
  up manually: `git config core.hooksPath .husky`.
- On Unix, make sure the hook is executable after creating/cloning:
  `chmod +x .husky/pre-commit`.
- Bypassing with `git commit --no-verify` is possible but discouraged.
