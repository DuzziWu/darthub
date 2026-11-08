/** Error thrown when session configuration is invalid (weak/absent secret
 * or nonsensical lifetime). Kept separate from runtime verification errors
 * so configuration mistakes can't be mistaken for forged tokens. */

export class SessionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionConfigError";
  }
}
