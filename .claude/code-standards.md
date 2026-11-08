# Code Standards

## Style Guide
TypeScript strict mode, ESLint recommended rules, Prettier formatting. Follow established Next.js and React best practices.

## Linting
```bash
npm run lint
```

## Formatting
```bash
npm run lint -- --fix
```

## Pre-commit Checks
- Run linter before commits
- All tests must pass
- Code must conform to ESLint/Prettier rules

## Naming Conventions
- Files: `PascalCase` for components, `camelCase` for utilities
- Variables & functions: `camelCase`
- Types & interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- React components: `PascalCase`
- Hooks: `useCamelCase`

## Additional Guidelines
- Use absolute imports (`@/` alias) where possible
- Prefer functional components and React hooks
- Keep component files focused; extract shared logic to services or domain layer
- Follow Next.js file‑system routing conventions
