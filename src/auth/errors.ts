/** Typed auth errors. Error messages stay coarse so login failures never
 * reveal whether an email is registered (no user enumeration). */

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class InvalidEmailError extends AuthError {
  constructor() {
    super("A valid email address is required.");
    this.name = "InvalidEmailError";
  }
}

export class EmailAlreadyRegisteredError extends AuthError {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class GuestMigrationError extends AuthError {
  constructor(message = "This guest could not be migrated.") {
    super(message);
    this.name = "GuestMigrationError";
  }
}
