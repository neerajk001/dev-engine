import { execFile } from 'node:child_process';

export interface RunCommandOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs?: number;
  maxOutputChars?: number;
}

export interface RunCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string; // capped combined output
  truncated: boolean;
  signal: NodeJS.Signals | null;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_OUTPUT_CHARS = 12_000;

/**
 * Run a command with no shell (`shell: false`). The command must already be
 * split into argv — no shell interpolation, pipes, or redirection.
 * Output is capped so a chatty command cannot blow up the model context.
 */
export function runCommand(opts: RunCommandOptions): Promise<RunCommandResult> {
  const timeoutMs = Math.min(
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
  );
  const maxChars = opts.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;

  return new Promise((resolve) => {
    execFile(
      opts.command,
      opts.args,
      { cwd: opts.cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const stdoutStr = stdout?.toString() ?? '';
        const stderrStr = stderr?.toString() ?? '';
        const combined = [stdoutStr, stderrStr].filter(Boolean).join('\n');
        const capped = capOutput(combined, maxChars);
        const exitCode =
          error === null
            ? 0
            : typeof error.code === 'number'
              ? error.code
              : null; // killed by signal / timeout: no numeric code
        resolve({
          exitCode,
          stdout: stdoutStr,
          stderr: stderrStr,
          output: capped.text,
          truncated: capped.truncated,
          signal: error === null ? null : (error.signal ?? null),
        });
      },
    );
  });
}

export function capOutput(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  const keep = Math.max(0, maxChars - 80);
  const head = text.slice(0, Math.floor(keep / 2));
  const tail = text.slice(text.length - Math.ceil(keep / 2));
  return {
    text: `${head}\n... [output truncated: ${text.length} chars > ${maxChars}] ...\n${tail}`,
    truncated: true,
  };
}
