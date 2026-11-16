import { execSync } from "node:child_process";

export type CommandResult = {
  exitCode: number;
  output: string;
  /** True when the command was killed because it exceeded its timeout. */
  timedOut?: boolean;
};

/**
 * Runs a shell command from the project root and captures its status and
 * combined output, so failing commands can be asserted on instead of thrown.
 *
 * The optional timeout is in milliseconds: `execSync` blocks the event loop,
 * so a command that hangs forever would block the whole worker — past every
 * vitest timeout, because none of them can fire while the loop is blocked.
 * A command that exceeds its timeout is killed and reported as a failure with
 * the output it produced so far.
 */
export const runCommand = (
  command: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs?: number,
): CommandResult => {
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      ...(env ? { env: { ...process.env, ...env } } : {}),
      stdio: ["pipe", "pipe", "pipe"],
      ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
    });
    return { exitCode: 0, output };
  } catch (error) {
    const err = error as {
      status?: number | null;
      stdout?: unknown;
      stderr?: unknown;
      code?: string;
    };
    return {
      exitCode: err.status ?? 1,
      output: `${String(err.stdout ?? "")}${String(err.stderr ?? "")}`,
      ...(err.code === "ETIMEDOUT" ? { timedOut: true } : {}),
    };
  }
};
