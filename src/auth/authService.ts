/** Registration and login. All persistence goes through the injected
 * {@link AuthRepository}; token issuance is injected so this service stays
 * free of JWT details (see `session.ts` for the HS256 implementation). */

import { EmailAlreadyRegisteredError, InvalidCredentialsError, InvalidEmailError } from "./errors";
import { isReservedGuestDomainEmail } from "./guest";
import { hashPassword, verifyPassword as verifyPasswordDefault } from "./password";
import type { AuthRepository, UserRow } from "./repository";
import { createSessionToken, readSessionSecret } from "./session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthServiceDeps {
  repository: AuthRepository;
  /** Signing secret; falls back to `process.env.AUTH_SECRET` in production. */
  sessionSecret?: string;
  hashPassword?(plain: string): Promise<string>;
  verifyPassword?(plain: string, passwordHash: string): Promise<boolean>;
  issueUserSession?(user: UserRow): Promise<string>;
}

export interface AuthService {
  registerUser(input: RegisterInput): Promise<{ user: UserRow; sessionToken: string }>;
  loginUser(input: LoginInput): Promise<{ user: UserRow; sessionToken: string }>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function defaultIssueUserSession(user: UserRow, secret: string): Promise<string> {
  return createSessionToken({ sub: user.id, kind: "user", nickname: user.displayName }, secret);
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const {
    repository,
    hashPassword: hashPasswordImpl = hashPassword,
    verifyPassword: verifyPasswordImpl = verifyPasswordDefault,
    issueUserSession: issueUserSessionImpl,
  } = deps;
  const issueUserSession =
    issueUserSessionImpl ??
    (async (user: UserRow) =>
      defaultIssueUserSession(user, deps.sessionSecret ?? readSessionSecret()));
  return {
    async registerUser(input: RegisterInput): Promise<{ user: UserRow; sessionToken: string }> {
      const email = normalizeEmail(input.email);
      if (!EMAIL_PATTERN.test(email)) {
        throw new InvalidEmailError();
      }
      // Synthetic guest identities live here; a real account must never be
      // able to claim one (it would inherit the guest's progress).
      if (isReservedGuestDomainEmail(email)) {
        throw new EmailAlreadyRegisteredError();
      }

      return repository.runInTransaction(async (tx) => {
        const existing = await tx.users.findByEmail(email);
        if (existing !== null) {
          throw new EmailAlreadyRegisteredError();
        }

        const user = await tx.users.create({
          email,
          passwordHash: await hashPasswordImpl(input.password),
          displayName: input.displayName,
        });

        return { user, sessionToken: await issueUserSession(user) };
      });
    },

    async loginUser(input: LoginInput): Promise<{ user: UserRow; sessionToken: string }> {
      const email = normalizeEmail(input.email);
      const user = await repository.users.findByEmail(email);

      // The same generic failure surfaces for unknown emails and wrong
      // passwords so responses never enumerate accounts.
      if (user === null) {
        await verifyPasswordImpl(input.password, "$invalid-placeholder-hash$");
        throw new InvalidCredentialsError();
      }

      const passwordMatches = await verifyPasswordImpl(input.password, user.passwordHash);
      if (!passwordMatches) {
        throw new InvalidCredentialsError();
      }

      return { user, sessionToken: await issueUserSession(user) };
    },
  };
}
