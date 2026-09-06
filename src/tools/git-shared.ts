import { runCommand } from '../util/process.js';
import { resolveProjectPath } from '../safety/paths.js';

/** Run a read-only git command in the workspace root. */
export async function runGit(
  root: string,
  args: string[],
): Promise<{ ok: boolean; text: string }> {
  const resolved = resolveProjectPath(root, '.');
  if (!resolved.ok) {
    return { ok: false, text: resolved.error };
  }
  const result = await runCommand({
    command: 'git',
    args,
    cwd: resolved.absolute,
    maxOutputChars: 16_000,
  });
  return {
    ok: result.exitCode === 0,
    text: result.exitCode === 0 ? result.output.trim() : `(exit ${result.exitCode})`,
  };
}

/** True when the workspace is inside a git repository. */
export async function isGitRepo(root: string): Promise<boolean> {
  const r = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
  return r.ok && r.text.trim() === 'true';
}
