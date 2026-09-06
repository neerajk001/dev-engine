import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { parseCommand, decideCommand, commandLine } from '../safety/commands.js';
import { runCommand } from '../util/process.js';
import type { Verdict } from './types.js';

/** Pick a verification command from a package.json scripts map. */
export function pickVerifyCommand(
  scripts: Record<string, string> | undefined,
): string | null {
  if (!scripts) return null;
  for (const name of ['test', 'build', 'typecheck', 'check']) {
    if (typeof scripts[name] === 'string' && scripts[name]!.trim() !== '') {
      return `npm run ${name}`;
    }
  }
  return null;
}

export interface VerificationOptions {
  root: string;
  /** Fall back to `tsc --noEmit` even when no script exists. */
  preferTscFallback?: boolean;
}

/**
 * Run the project's verification command (test/build/typecheck) and return
 * a structured verdict. When no script exists, only falls back to `tsc --noEmit`
 * if the project actually has a tsconfig.json — never invent a TypeScript
 * verification target for a project that doesn't use one (that would create an
 * artificial constraint the agent cannot satisfy).
 */
export async function verifyProject(
  opts: VerificationOptions,
): Promise<Verdict | null> {
  const { root } = opts;
  let scripts: Record<string, string> | undefined;
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    scripts = pkg.scripts;
  } catch {
    scripts = undefined;
  }

  let command = pickVerifyCommand(scripts);
  if (command === null && opts.preferTscFallback) {
    // Only use tsc if a tsconfig.json exists; otherwise there's no real
    // type-checking target and running `tsc --noEmit` would fabricate failures.
    try {
      if (existsSync(path.join(root, 'tsconfig.json'))) {
        command = 'tsc --noEmit';
      }
    } catch {
      command = null;
    }
  }
  if (command === null) {
    return null; // no verification available for this project
  }

  const argv = parseCommand(command);
  const started = Date.now();
  const result = await runCommand({
    command: argv[0]!,
    args: argv.slice(1),
    cwd: root,
  });
  return {
    ok: result.exitCode === 0,
    command,
    exitCode: result.exitCode,
    output: result.output,
    durationMs: Date.now() - started,
  };
}

/** True when a verification command is allow-listed to run. */
export function isVerificationCommand(command: string): boolean {
  return decideCommand(parseCommand(command)).decision === 'allow';
}
