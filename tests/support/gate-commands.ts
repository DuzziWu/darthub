/**
 * The single execution point for the whole-repository gate commands.
 *
 * `npm run lint`, `npm run format:check` and `npm run typecheck` are the
 * slowest commands of the suite, and the suite runs each of them twice:
 * once in its own gate test and once more in the CI workflow replay. On a
 * shared machine that duplication is what pushes a suite run over its
 * budget, so the execution is shared and only the verdicts stay separate.
 *
 * The sharing has to work across Vitest workers, because every test file
 * runs in its own process: a module-level variable would not be seen by the
 * other files. The result therefore lives in a file, in the temporary
 * directory that `tests/support/global-setup.ts` publishes for this
 * invocation, and an exclusive lock file decides who executes the command.
 *
 * The result of a command is written atomically — into a temporary file
 * that is renamed into place — so a reader never sees a half-written file.
 * The first consumer to ask for a command executes it, every other consumer
 * waits for that result and reads it. A consumer that waits too long (the
 * lock holder died, or the machine is so slow that the deadline is reached)
 * executes the command itself rather than hanging: the wait is bounded.
 */

import { createHash } from "node:crypto";
import {
  closeSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { inject } from "vitest";
import { runCommand, type CommandResult } from "./run-command";

/**
 * The whole-repository gate commands the suite shares between the gate
 * tests and the CI workflow replay.
 *
 * A command outside this list is still executed through `runGateCommand`,
 * but the CI replay does not route it there: it runs such a step itself.
 */
export const SHARED_GATE_COMMANDS: readonly string[] = [
  "npm run lint",
  "npm run format:check",
  "npm run typecheck",
];

/** Whether the command is one of the shared whole-repository gate commands. */
export const isSharedGateCommand = (command: string): boolean =>
  SHARED_GATE_COMMANDS.includes(command);

/**
 * How long a consumer waits for the worker that holds the lock before it
 * executes the command itself.
 *
 * The gate commands take 95 s to 180 s on the shared machine, so five
 * minutes is a comfortable margin. The holder always publishes a result —
 * the execution itself is bounded — so the fallback stays reachable: the
 * wait plus the fallback run still fits inside the 900 s test budget.
 */
const WAIT_DEADLINE_MS = 300_000;

/** How often a waiting consumer looks for the result and for the lock. */
const POLL_INTERVAL_MS = 250;

/** The cache directory of this invocation, or undefined outside a suite run. */
const gateCacheDir = (): string | undefined => {
  try {
    const dir = inject("gateCacheDir");
    return typeof dir === "string" && dir.length > 0 ? dir : undefined;
  } catch {
    // `inject` is only available inside a Vitest worker. A test that runs
    // the helper outside a suite run gets no cache and no sharing.
    return undefined;
  }
};

/** The file name of a command: readable, and unique per command string. */
const cacheKey = (command: string): string => {
  const slug = command.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const digest = createHash("sha256").update(command).digest("hex").slice(0, 12);
  return `${slug}-${digest}`;
};

/** The cached result of a command, if it is there and readable. */
const readResult = (resultPath: string): CommandResult | undefined => {
  try {
    const parsed = JSON.parse(readFileSync(resultPath, "utf-8")) as Partial<CommandResult>;
    if (typeof parsed.exitCode !== "number" || typeof parsed.output !== "string") {
      return undefined;
    }
    return {
      exitCode: parsed.exitCode,
      output: parsed.output,
      ...(parsed.timedOut === true ? { timedOut: true } : {}),
    };
  } catch {
    return undefined;
  }
};

/** Writes the result atomically, so a reader never sees a half-written file. */
const writeResult = (resultPath: string, result: CommandResult): void => {
  const tempPath = `${resultPath}.${process.pid}.tmp`;
  try {
    writeFileSync(tempPath, JSON.stringify(result), "utf-8");
    renameSync(tempPath, resultPath);
  } catch {
    try {
      unlinkSync(tempPath);
    } catch {
      // The temporary file is already gone; nothing left to clean up.
    }
  }
};

/**
 * Takes the lock for a command.
 *
 * The exclusive create (`"wx"`) is the whole mechanism: exactly one worker
 * can create the file, so exactly one worker executes the command. The
 * holder writes its process id into the file, so a waiter can tell a dead
 * holder from a slow one.
 */
const acquireLock = (lockPath: string): number | undefined => {
  try {
    const fd = openSync(lockPath, "wx");
    try {
      writeSync(fd, String(process.pid));
    } catch {
      // The pid is a hint for the liveness check, not a requirement.
    }
    return fd;
  } catch {
    return undefined;
  }
};

/** Releases the lock: the file is removed so the next consumer may take it. */
const releaseLock = (lockPath: string, fd: number): void => {
  try {
    closeSync(fd);
  } catch {
    // The descriptor is already closed.
  }
  try {
    unlinkSync(lockPath);
  } catch {
    // Another consumer removed the lock already.
  }
};

/** Whether the worker that holds the lock is still alive. */
const lockHolderAlive = (lockPath: string): boolean => {
  let pid: number;
  try {
    pid = Number.parseInt(readFileSync(lockPath, "utf-8").trim(), 10);
  } catch {
    // No lock file: nobody holds the lock.
    return false;
  }
  if (!Number.isInteger(pid) || pid <= 0) {
    // The holder died before it could write its pid. The deadline is the
    // backstop for this case, so the lock is left alone.
    return true;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to somebody else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * The ceiling of a single gate command execution.
 *
 * `runCommand` runs the command with `execSync`, which blocks the event
 * loop: a command that hangs would block its worker forever, and no Vitest
 * timeout can fire while the loop is blocked. The timeout turns that hang
 * into a failure that is published like any other result, so every consumer
 * of the command sees the same failure instead of the suite hanging.
 *
 * The measured runtimes of the gate commands are 95 s (lint), 172 s
 * (typecheck) and 178 s (format:check) on an idle machine, roughly twice
 * that under heavy contention. Ten minutes is a generous ceiling.
 */
const EXECUTION_TIMEOUT_MS = 600_000;

/** Executes the command and publishes its result for the other consumers. */
const execute = (command: string, resultPath: string): CommandResult => {
  const result = runCommand(command, undefined, EXECUTION_TIMEOUT_MS);
  // The line goes to the raw stdout of the worker: the default reporter
  // swallows the intercepted console output of a passing test, and this line
  // is the evidence that the sharing works.
  process.stdout.write(`[gate] ${command} — executed\n`);
  writeResult(resultPath, result);
  return result;
};

/**
 * Runs a whole-repository gate command, sharing the execution with the other
 * test files of the same suite run.
 *
 * The first consumer executes the command; every other consumer waits for
 * that result and returns it. The returned value is the one `runCommand`
 * returns: the real exit code and the real output, so the verdicts of the
 * gate tests and of the CI replay stay truthful.
 */
export const runGateCommand = async (command: string): Promise<CommandResult> => {
  const dir = gateCacheDir();
  if (dir === undefined) {
    // No suite run around us: run the command and report it, exactly as
    // before — but bounded, like every other execution.
    return runCommand(command, undefined, EXECUTION_TIMEOUT_MS);
  }

  const key = cacheKey(command);
  const resultPath = join(dir, `${key}.result.json`);
  const lockPath = join(dir, `${key}.lock`);

  const cached = readResult(resultPath);
  if (cached) {
    return cached;
  }

  const fd = acquireLock(lockPath);
  if (fd !== undefined) {
    try {
      // The lock may have been taken after the first read: look again.
      const again = readResult(resultPath);
      if (again) {
        return again;
      }
      return execute(command, resultPath);
    } finally {
      releaseLock(lockPath, fd);
    }
  }

  // Another worker is executing the command. Wait for its result.
  const deadline = Date.now() + WAIT_DEADLINE_MS;
  while (Date.now() < deadline) {
    const waited = readResult(resultPath);
    if (waited) {
      return waited;
    }

    if (!lockHolderAlive(lockPath)) {
      // The holder died. Take the lock over and execute the command.
      const stolen = acquireLock(lockPath);
      if (stolen !== undefined) {
        try {
          const again = readResult(resultPath);
          if (again) {
            return again;
          }
          return execute(command, resultPath);
        } finally {
          releaseLock(lockPath, stolen);
        }
      }
    }

    await delay(POLL_INTERVAL_MS);
  }

  // The wait ran out: the holder is too slow or it died without releasing
  // the lock. Executing the command is slow but bounded, hanging is not.
  return execute(command, resultPath);
};
