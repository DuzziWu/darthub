import { execSync } from "node:child_process";

export type CommandResult = {
  exitCode: number;
  output: string;
};

/**
 * Runs a shell command from the project root and captures its status and
 * combined output, so failing commands can be asserted on instead of thrown.
 */
export const runCommand = (command: string, env?: NodeJS.ProcessEnv): CommandResult => {
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      ...(env ? { env: { ...process.env, ...env } } : {}),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: unknown; stderr?: unknown };
    return {
      exitCode: err.status ?? 1,
      output: `${String(err.stdout ?? "")}${String(err.stderr ?? "")}`,
    };
  }
};
