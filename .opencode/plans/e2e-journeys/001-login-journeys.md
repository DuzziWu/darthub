# 001 — Login journeys: sign up, sign in, and convert a guest

**Owning agents:** `backend` (E1.1) → `frontend` (E1.2) → `qa-engineer` (E1.3)
**Plan:** `.opencode/plans/e2e-journeys/_plan.md` → E1.1, E1.2, E1.3
**Created:** 2026-11-16
**Branch:** `cez/005e0185` · base `integration/opencode-team` `9343787`

---

## Scope

Turn the two `test.skip` placeholders in `e2e/login.spec.ts` into real journeys, and build the
minimum product surface they drive.

**In scope**

- A **registration transport** — a thin route over the `authService.registerUser` that
  already exists (`src/auth/authService.ts:58-83`), following the repository's thin-handler
  convention (`src/auth/linkGuestRoutes.ts` + `app/api/auth/link-guest/route.ts`).
- The **one-time migration token** made reachable: it is minted
  (`src/auth/guest.ts:125-130`) but no route hands it to the client, so
  `POST /api/auth/link-guest` cannot be called by a browser today.
- A **sign-in surface** — `app/login/page.tsx`, with one labelled email field and one
  labelled password field, a guest-session control and a guest → account conversion
  control; an entry point to it on the home page and in the navigation; and a dashboard that
  shows the signed-in player's name instead of only an empty state.
- The **two journeys** in `e2e/login.spec.ts`, written against that surface, with the
  mock paths corrected to the routes the product actually has.

**Out of scope**

- The Auth.js **provider** set. The `email` provider (`src/auth/nextauth.ts:34-50`) and the
  `guest` provider (`:51-61`) stay as they are; registration is added as a thin route, not
  as a third provider.
- Any **session model** change. `src/auth/session.ts` keeps its JWT claims and its TTLs.
- The **other** six spec files, the matchmaking journey (`002`) and the career journey
  (`003`).
- `docs/ROADMAP.md` — the parallel documentation task owns it.

---

## Files

### Step E1.1 — owned by `backend`

The registration transport.

| File                                                  | What changes                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/auth/registerRoutes.ts` (**create**)             | The route logic, with **injected** dependencies — following `src/auth/linkGuestRoutes.ts:16-21,49` — so the handler can be tested with no database. It validates the input and returns the created user **without** the password hash.                                                                     |
| `app/api/auth/register/route.ts` (**create**)         | The thin wiring: the production runtime (`src/auth/runtime.ts:38-48`) supplies the service. One `POST` export, like `app/api/auth/link-guest/route.ts`.                                                                                                                                                    |
| `src/auth/nextauth.ts`                                | The **`guest`** credentials provider (`:51-61`) must surface the **one-time migration token** to the client. Today the token is minted (`src/auth/guest.ts:125-130`) and never handed out, so `POST /api/auth/link-guest` is unreachable from a browser. The **`email`** provider (`:34-50`) is unchanged. |
| `tests/integration/registerUser.test.ts` (**create**) | The seam is proved here, against an injected in-memory repository — the repository pattern of `tests/support/inMemoryAuthRepository.ts`. Covers the happy path **and** the rejected input.                                                                                                                 |

**No other file may be touched by this step.**

### Step E1.2 — owned by `frontend`

The sign-in surface.

| File                                      | What changes                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/login/page.tsx` (**create**)         | The sign-in **and** sign-up form. **One** element labelled for the email and **one** for the password, so `getByLabel(/email/i)` and `getByLabel(/password/i)` each resolve to exactly one node. A guest-session control and a guest → account conversion control. The controls use the token vocabulary (`src/components/game/classes.ts`) — no raw Tailwind colour classes. |
| `app/page.tsx`                            | The entry point to the auth flow (a link named for sign-up / sign-in).                                                                                                                                                                                                                                                                                                        |
| `src/components/shell/navDestinations.ts` | The auth destination, so the flow is reachable from the shell. The five existing destinations stay; the nav keeps its `aria-current` behaviour and its `min-h-11` touch target.                                                                                                                                                                                               |
| `app/dashboard/page.tsx`                  | The signed-in player's **name** next to the existing empty state. The empty state itself stays — there is no signed-in player behind the page in the general case.                                                                                                                                                                                                            |

### Step E1.3 — owned by `qa-engineer`

The journeys.

| File                | What changes                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/login.spec.ts` | Both `test.skip` placeholders (`:15`, `:44`) become real tests. The mock paths are corrected to the **real** endpoints; the blanket `**/api/auth/**` pattern is narrowed so it does **not** swallow the Auth.js session probe `/api/auth/session`; the URL expectation becomes the shipped `/login`; the stale header comment about `npm run dev` is removed. |

**No other file may be touched by this step.** In particular **not**
`playwright.config.ts` — the harness is not this plan's business.

---

## Dependencies (Abhängigkeit)

- **E1.1** depends on nothing. It is the first step of the plan.
- **E1.2** depends on **E1.1** — the form posts to the route E1.1 shipped. A form whose
  endpoint does not exist is a dead control.
- **E1.3** depends on **E1.2** — the spec asserts the surface, so the surface must exist
  first. A spec written against a surface that does not exist yet is a guess.
- **E1.3 is a prerequisite of E2.1** (the matchmaking queue joins two signed-in players)
  and of **E3.1** (the career page needs a signed-in player).

---

## Acceptance criteria (Akzeptanzkriterien)

### E1.1 — registration transport

1. `app/api/auth/register/route.ts` exports a `POST` handler and `src/auth/registerRoutes.ts`
   holds the logic with **injected** dependencies — the `app/api/**/route.ts` file wires the
   production runtime, the `src/**/route*.ts` file holds the behaviour
   (`AGENTS.md`, "Testing conventions").
2. The route creates the user through the **existing** `authService.registerUser`
   (`src/auth/authService.ts:58-83`); it does not write to the database itself and does not
   duplicate the password hashing.
3. The response never contains the password hash, and a malformed or missing email or
   password is rejected with a **4xx** — not a 500.
4. The `guest` credentials provider hands the **one-time migration token** to the client,
   so `POST /api/auth/link-guest` becomes reachable. The token is shown **once** and never
   logged.
5. The integration test proves the seam against an injected repository and covers **both**
   the accepted and the rejected input.
6. `src/auth/nextauth.ts` keeps its two providers; no third provider is added.

### E1.2 — sign-in surface

7. `app/login/page.tsx` exists and renders **exactly one** element labelled for the email
   and **exactly one** labelled for the password. The labels are real `<label>` elements
   bound to the inputs, not placeholder text.
8. The page offers three distinct actions — sign in / sign up, **continue as guest**, and
   **convert the guest session** — each reachable by an accessible role and name, and each
   with a visible focus state.
9. The controls use the DartHub token vocabulary; no raw Tailwind colour class appears in
   the file. Colour is not the only indicator of any state.
10. The auth entry point is reachable from the home page and from the navigation; the nav's
    five existing destinations and their `aria-current` behaviour are unchanged.
11. `app/dashboard/page.tsx` shows the signed-in player's name; the existing empty state
    stays for the case where there is no signed-in player.
12. The page keeps the session the server issued. **No application code writes a cookie
    today** — `grep -rn "cookies()\|next/headers\|Set-Cookie" app/ src/` returns zero
    hits — so the page holds the session token itself and sends it on every request. The
    token is never rendered into the DOM as a readable attribute.

### E1.3 — the journeys

12. `e2e/login.spec.ts` contains **0** `test.skip`
    (`grep -c "test.skip(" e2e/login.spec.ts` → `0`).
13. The sign-up journey fills the labelled email and password fields, submits, and ends on
    `/dashboard` with the player's name visible.
14. The guest-conversion journey starts from the guest state, converts, and shows the
    registered state — and the guest label is **gone** afterwards.
15. Every mocked endpoint is a route the product actually has (`/api/auth/register`,
    `/api/auth/session`); the blanket `**/api/auth/**` pattern is gone.
16. The spec carries **no** stale comment about `npm run dev`; the suite runs against the
    production build that `playwright.config.ts` owns.
17. The two tests share no state — no account, no cookie, no row — so they pass under
    `fullyParallel: true` (`playwright.config.ts:5`).
18. The guest-conversion journey uses the **migration token** the guest session handed
    out — the flow the product actually has (`src/auth/guest.ts:125-130,146-179`) — not an
    invented one.

---

## Verification command (Verifikationskommando)

```bash
# the seam (backend half)
npx vitest run tests/integration/registerUser.test.ts

# the page (frontend half)
npm run typecheck && npm run lint && npm run format:check

# the journeys (qa half) — against the production build that playwright.config.ts owns
npx playwright test e2e/login.spec.ts
```

The Playwright command builds and serves the production build itself
(`playwright.config.ts:46-61`); the browser must be installed once locally with
`npx playwright install chromium` — it is **not** part of `npm ci`.

---

## Result (Ergebnis)

**The vertical is in flight. None of the three steps is merged yet.** Each step is recorded
separately, with the command output that proves it.

| Step                                  | Owner         | State                   | Branch         |
| ------------------------------------- | ------------- | ----------------------- | -------------- |
| **E1.1** — the registration transport | `backend`     | **in Arbeit**           | `cez/d411ba19` |
| **E1.2** — the sign-in surface        | `frontend`    | geplant — **nach E1.1** | —              |
| **E1.3** — the login journeys         | `qa-engineer` | geplant — **nach E1.2** | —              |

The order is fixed: E1.2 posts to the route E1.1 ships, and E1.3 is written against the
surface E1.2 ships.

**Checked on 2026-11-16 against `integration/opencode-team` at `59df0e3` — the E1.1 merge is
not visible.**

```text
$ git log --oneline -3 integration/opencode-team
59df0e3 merge: E2E-Journeys-Plan (Login, Matchmaking, Karriere) — 9 sequenzierte Schritte, kein Produktcode
f2134d1 plan(e2e): E2E-Lücken als Workpackage planen — Login, Matchmaking, Karriere
907863e docs(plans): Finale Verifikationszahlen nachtragen

$ git cat-file -e integration/opencode-team:src/auth/registerRoutes.ts
fatal: path 'src/auth/registerRoutes.ts' does not exist in 'integration/opencode-team'

$ git cat-file -e integration/opencode-team:app/api/auth/register/route.ts
fatal: path 'app/api/auth/register/route.ts' does not exist in 'integration/opencode-team'

$ git cat-file -e integration/opencode-team:tests/integration/registerUser.test.ts
fatal: path 'tests/integration/registerUser.test.ts' does not exist in 'integration/opencode-team'

$ git cat-file -e integration/opencode-team:app/login/page.tsx
fatal: path 'app/login/page.tsx' does not exist in 'integration/opencode-team'

$ git for-each-ref --format='%(refname:short)' | grep d411ba19
(no output — the branch cez/d411ba19 is not in the repository's ref list)
```

**No result numbers are recorded here yet — they are to be filled in.** The merge commit, the
list of changed files and the test counts of E1.1 belong to the merge; they must be read from
that commit and are **nachzutragen**, never estimated. The same holds for E1.2 and E1.3,
whose results are recorded after their own merges.

| Still open                                          | Filled in after |
| --------------------------------------------------- | --------------- |
| E1.1 — merge commit, changed files, test counts     | the E1.1 merge  |
| E1.2 — the sign-in surface, its verification output | the E1.2 merge  |
| E1.3 — the two journeys, their verification output  | the E1.3 merge  |
