# Task 101: Make the guest-to-account migration atomic

**Status**: pending
**Depends on**: 100
**Retry count**: 0

## Description
`/api/auth/link-guest` registers the real user first and migrates the guest second, in two separate transactions. If the migration fails, the registered user row survives: the client is told the signup failed, but the account now exists and permanently blocks that email from being registered again. This task makes registration and migration one transaction, so a failed migration leaves no orphan user.

## Context
- Related files: `src/auth/linkGuestRoutes.ts`, `src/auth/authService.ts`, `src/auth/guest.ts`, `src/auth/repository.ts`, `src/auth/prismaAuthRepository.ts`, `tests/support/inMemoryAuthRepository.ts`, `tests/integration/linkGuest.test.ts`
- `linkGuestRoutes.ts` — the route calls `authService.registerUser(...)` then `guestService.migrateGuestToUser(...)`.
- `authService.ts:70` — `registerUser` wraps its work in `repository.runInTransaction`.
- `guest.ts:130` — `migrateGuestToUser` wraps its work in a *separate* `repository.runInTransaction`.
- `repository.ts` — `AuthRepository.runInTransaction<T>(fn: (tx: AuthUnitOfWork) => Promise<T>)`; `AuthUnitOfWork` exposes `users`, `guests` and `progress` stores.
- `prismaAuthRepository.ts:196` — `unitFor(client)` builds the stores over any client, so a transaction-scoped Prisma client yields transaction-scoped stores. `runInTransaction` passes `tx` through `unitFor(tx)`.
- `prismaAuthRepository.ts:130` — `reassign` documents that `updateMany` can hit a unique violation on the same `(mode)` or `(sessionId)`, deferring the merge to "task 004". That failure is real and happens **after** the user row is committed.
- `tests/support/inMemoryAuthRepository.ts:141` — the double's `runInTransaction` calls `fn(unitForStore(store))` against the live maps. **A throw mid-transaction leaves every write in place.** The double does not roll back.

## Requirements (Test Descriptions)
- [ ] `it leaves no user row when the guest migration fails`
- [ ] `it leaves no user row when the migration token is wrong`
- [ ] `it leaves no user row when the guest does not exist`
- [ ] `it registers the user and migrates the guest in one transaction`
- [ ] `it rolls back the created user when the migration fails`
- [ ] `it restores the users, guests and progress stores when a transaction fails`
- [ ] `it keeps the registered user when the migration succeeds`
- [ ] `it migrates the guest progress to the newly registered user`
- [ ] `it returns a session token for the linked account`

## Acceptance Criteria
- A failed migration leaves **no** orphan user row, and the same email can be registered again immediately afterwards.
- Registration and migration execute inside **one** transaction, not two.
- The in-memory repository double performs a real rollback, so the atomicity assertions are meaningful.
- The test must **fail against the pre-fix code**. Prove it: write the assertion, watch it fail against the old `linkGuestRoutes`, then fix.
- The existing `linkGuest.test.ts` cases keep passing unchanged.

## Implementation Notes

**The fix is one transaction, not a compensating delete.** A `deleteUser` compensation would work, but it is weaker: it can itself fail, it races with anything else that touched the row, and it leaves an audit trail showing a user was created and destroyed. A single transaction has none of those problems.

**Refactor to separate the operation from the transaction wrapper.** Both services currently hide their transaction inside a public method. Expose the inner operations so they can be composed:

```ts
// src/auth/authService.ts
export async function registerUserIn(
  tx: AuthUnitOfWork,
  input: RegisterInput,
): Promise<UserRow> { /* the body of registerUser, without runInTransaction */ }
```

and the same for `migrateGuestToUserIn(tx, input)` in `src/auth/guest.ts`. The existing public methods then become thin wrappers that open their own transaction and call the inner operation — so `registerUser` keeps its current behaviour and its current callers are unaffected.

Then add a single service method that owns both steps inside one transaction. It needs access to both services' inner operations, so it belongs in a module that can import both — `src/auth/linkGuestRoutes.ts` is the route, not the service, so put the orchestration in a service module (e.g. `src/auth/linkGuestService.ts`) that the route calls.

**The email check must happen inside the same transaction.** `authService.ts:73` refuses an email that already exists. That check must run inside the shared transaction, or a concurrent registration can slip between the check and the create. The inner operation must therefore take the transaction's store, not the repository.

**The in-memory double must actually roll back.** This is the part most likely to be faked by accident. Implement snapshot/restore in `createInMemoryAuthRepository`:

- On `runInTransaction` entry, copy the three maps (`users`, `guests`, `progress`) into shallow copies of their contents.
- Run the callback.
- If it throws, restore the maps from the snapshot and rethrow.
- If it succeeds, keep the writes.

The maps hold mutable row objects, so a shallow `new Map(old)` is **not** enough if a row is mutated in place. Check the stores: `createGuestStore.update` does `guests.set(guest.id, { ...guest })` — it replaces the entry with a new object, so a shallow map copy survives. `createProgressStore.reassign` replaces arrays in the map rather than mutating rows. Verify this for every store rather than assuming; if any store mutates a row in place, the snapshot must copy the rows too.

**Test the rollback of the double directly**, not only through the route. `it restores the users, guests and progress stores when a transaction fails` should write a row inside a transaction that throws and then assert the store is unchanged. Without that, the atomicity test could pass because the double never wrote anything at all.

**The route's error mapping stays as it is.** `GuestMigrationError`, `InvalidEmailError` and `EmailAlreadyRegisteredError` all map to 400. A failed migration must still return 400 — the difference is that no orphan row exists afterwards.
