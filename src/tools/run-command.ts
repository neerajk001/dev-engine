import { resolveProjectPath } from '../safety/paths.js';
import { parseCommand, decideCommand, commandLine } from '../safety/commands.js';
import { runCommand } from '../util/process.js';
import { isDirectory } from '../util/fs.js';
import type { Tool, ToolResult } from './types.js';

export interface ApprovalGate {
  /** Ask the user whether an un-allowlisted command may run. */
  confirm(command: string): Promise<boolean>;
}

/**
 * Run a development command inside the project workspace.
 * `confirm` is invoked when the command is not on the allow-list.
 */
export function runCommandTool(root: string, approve: ApprovalGate): Tool {
  return {
    name: 'run_command',
    description:
      'Run a development command in the project root: tests, builds, type checks, git status/diff. Uses no shell. Examples: "npm test", "tsc --noEmit", "npm run build", "git status".',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run, e.g. "npm test".' },
        timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds.' },
      },
      required: ['command'],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { command, timeoutMs } = input as { command: string; timeoutMs?: number };
      if (typeof command !== 'string' || command.trim() === '') {
        return { ok: false, error: 'command must be a non-empty string', recoverable: true };
      }

      const argv = parseCommand(command);
      const decision = decideCommand(argv);
      if (decision.decision === 'reject') {
        return { ok: false, error: `command rejected: ${decision.reason}`, recoverable: true };
      }

      const line = commandLine(argv);
      if (decision.decision === 'confirm') {
        const ok = await approve.confirm(line);
        if (!ok) {
          return { ok: false, error: `command not approved by the user: ${line}`, recoverable: false };
        }
      }

      const resolved = resolveProjectPath(root, '.');
      if (!resolved.ok) {
        return { ok: false, error: resolved.error, recoverable: false };
      }
      if (!isDirectory(resolved.absolute)) {
        return { ok: false, error: `workspace is not a directory: ${root}`, recoverable: false };
      }

      const exe = argv[0]!;
      const args = argv.slice(1);
      const result = await runCommand({
        command: exe,
        args,
        cwd: resolved.absolute,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });

      if (result.exitCode !== 0) {
        const detail = result.output ? `\n${result.output}` : '';
        return {
          ok: false as const,
          error: `command failed with ${result.exitCode ?? 'no exit code (killed by signal or timeout)'}${detail}`,
          recoverable: true,
        };
      }
      return { ok: true as const, text: result.output ? `${result.output}\n(exit 0)` : '(exit 0)' };
    },
  };
}
