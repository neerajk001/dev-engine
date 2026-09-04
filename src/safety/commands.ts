export type CommandDecision =
  | { decision: 'allow' }
  | { decision: 'confirm' }
  | { decision: 'reject'; reason: string };

/** Parse a command string into argv. Split on whitespace honoring quotes. */
export function parseCommand(command: string): string[] {
  const argv: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let started = false;

  for (const ch of command) {
    if (quote !== null) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) {
        argv.push(current);
        current = '';
        started = false;
      }
    } else {
      current += ch;
      started = true;
    }
  }
  if (started) {
    argv.push(current);
  }
  return argv;
}

/**
 * Truly destructive, out-of-scope, or shell-escaping commands.
 * These are rejected outright — the user is never asked to approve them.
 */
const REJECTED = new Set([
  // file destruction / mutation
  'rm', 'rmdir', 'del', 'erase', 'rd', 'mv', 'move', 'cp', 'copy',
  'xcopy', 'robocopy', 'shred', 'truncate', 'dd',
  // filesystem-level ops
  'mkdir', 'md', 'touch', 'mkfs', 'mount', 'umount', 'format', 'chmod', 'chown',
  // system control
  'shutdown', 'reboot', 'halt', 'systemctl', 'service',
  // process control
  'taskkill', 'kill', 'pkill',
  // registry / configuration
  'reg', 'regedit', 'sc',
  // privilege / secrets
  'sudo', 'doas', 'su', 'passwd', 'env',
  // shell wrappers (defeat argv-level validation)
  'bash', 'sh', 'zsh', 'fish', 'cmd', 'powershell', 'pwsh', 'wsl',
  // network (exfiltration / downloads out of scope for V1)
  'curl', 'wget', 'nc', 'netcat', 'telnet', 'ssh', 'scp', 'sftp', 'ftp',
]);

/** npm subcommands runnable without confirmation. */
const NPM_ALLOWED = new Set(['test', 'start', 'run', 'exec', 'ls', 'install', 'ci', 'i']);

/** npm run <script> names runnable without confirmation. */
const NPM_RUN_SCRIPTS = new Set([
  'test', 'start', 'build', 'typecheck', 'lint', 'dev', 'check', 'preview',
]);

const GIT_READ_ONLY = new Set(['status', 'diff', 'log', 'show']);

function normalizeExe(exe: string): string {
  const base = exe.includes('\\') || exe.includes('/')
    ? exe.slice(Math.max(exe.lastIndexOf('/'), exe.lastIndexOf('\\')) + 1)
    : exe;
  return base.toLowerCase().replace(/\.(exe|cmd|bat)$/, '');
}

function isRelativeMainPath(arg: string): boolean {
  return (
    arg === '.' ||
    arg === '..' ||
    arg.startsWith('./') ||
    arg.startsWith('.\\') ||
    arg.startsWith('../') ||
    arg.startsWith('..\\') ||
    !/^[a-zA-Z]:[\\/]/.test(arg) && !arg.startsWith('/') && !arg.startsWith('\\')
  );
}

/**
 * Decide whether a parsed command may run without asking the user.
 *
 * Dev commands (tests, builds, typechecks) run in the workspace are
 * allowed. Truly destructive or out-of-scope commands are rejected
 * outright. Everything else requires explicit user confirmation.
 */
export function decideCommand(argv: string[]): CommandDecision {
  if (argv.length === 0) {
    return { decision: 'reject', reason: 'empty command' };
  }

  const exe = normalizeExe(argv[0]!);
  const rest = argv.slice(1);
  const first = rest[0]?.toLowerCase();

  if (REJECTED.has(exe)) {
    return { decision: 'reject', reason: `command is not allowed: ${exe}` };
  }

  switch (exe) {
    case 'npm':
      if (first === undefined) return { decision: 'confirm' };
      if (!NPM_ALLOWED.has(first)) return { decision: 'confirm' };
      if (first === 'run' || first === 'exec') {
        const script = rest[1]?.toLowerCase();
        return script && NPM_RUN_SCRIPTS.has(script)
          ? { decision: 'allow' }
          : { decision: 'confirm' };
      }
      return { decision: 'allow' }; // npm test / start / install / ci / ls

    case 'npx':
      // `npx tsc ...` type checks are allowed; anything else confirmed.
      if (first === 'tsc' || (first === '--no-install' && rest[1] === 'tsc')) {
        return { decision: 'allow' };
      }
      return { decision: 'confirm' };

    case 'tsc':
      return { decision: 'allow' };

    case 'node':
      // `node --test ...` runs the project's own test suite (same trust
      // level as `npm test`); a bare or relative-main node also runs
      // project code within the workspace. Anything else is confirmed.
      if (first === '--test' || first === undefined) {
        return { decision: 'allow' };
      }
      return isRelativeMainPath(rest[0]!)
        ? { decision: 'allow' }
        : { decision: 'confirm' };

    case 'git':
      if (first === 'rev-parse' && rest[1] === '--is-inside-work-tree') {
        return { decision: 'allow' };
      }
      return GIT_READ_ONLY.has(first ?? '')
        ? { decision: 'allow' }
        : { decision: 'confirm' };

    case 'ls':
    case 'dir':
    case 'get-childitem':
    case 'where':
      return { decision: 'allow' };

    default:
      return { decision: 'confirm' };
  }
}

/** Join argv back into a single quoted command string for display. */
export function commandLine(argv: string[]): string {
  return argv.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
}
