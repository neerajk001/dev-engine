import 'dotenv/config';
import * as readline from 'node:readline/promises';
import { Agent } from '../agent/agent.js';
import { OpenAIProvider } from '../llm/openai.js';
import { OptimizeEngine } from '../optimizer/optimizer.js';
import { validateRoot } from '../context/project.js';
import { resolveRoot } from '../context/workspace.js';
import { banner, errorLine, helpText } from './output.js';
import { runRepl } from './repl.js';

const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_MAX_ITERATIONS = 25;

/** Parse --workspace from argv (kept tiny; no arg library in V1). */
export function parseArgv(argv: string[]): { workspaceFlag?: string } {
  const out: { workspaceFlag?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--workspace' || arg === '-w') {
      const value = argv[i + 1];
      if (value !== undefined) out.workspaceFlag = value;
      i += 1;
    } else if (arg.startsWith('--workspace=')) {
      out.workspaceFlag = arg.slice('--workspace='.length);
    }
  }
  return out;
}

export function configFromEnv(): {
  apiKey: string | undefined;
  model: string;
  maxIterations: number;
  maxRepairs: number;
  approvalMode: 'none' | 'plan' | 'all';
} {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MODEL ?? DEFAULT_MODEL;
  const iterations = Number(process.env.MAX_ITERATIONS ?? DEFAULT_MAX_ITERATIONS);
  const repairs = Number(process.env.MAX_REPAIRS ?? 3);
  const approval = (process.env.APPROVAL_MODE ?? 'none').toLowerCase();
  return {
    apiKey,
    model,
    maxIterations: Number.isFinite(iterations) && iterations > 0 ? iterations : DEFAULT_MAX_ITERATIONS,
    maxRepairs: Number.isFinite(repairs) && repairs >= 0 ? repairs : 3,
    approvalMode: approval === 'plan' || approval === 'all' ? approval : 'none',
  };
}

/** Ask the user a yes/no question on the terminal. */
async function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    const a = answer.trim().toLowerCase();
    return a === 'y' || a === 'yes';
  } finally {
    rl.close();
  }
}

export async function main(argv: string[]): Promise<number> {
  const { workspaceFlag } = parseArgv(argv);
  const { apiKey, model, maxIterations, maxRepairs, approvalMode } = configFromEnv();

  if (!apiKey) {
    process.stderr.write(
      `${errorLine('OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.')}\n`,
    );
    return 1;
  }

  const root = resolveRoot(process.env.WORKSPACE, workspaceFlag);
  const rootError = validateRoot(root);
  if (rootError) {
    process.stderr.write(`${errorLine(rootError)}\n`);
    return 1;
  }

  const provider = new OpenAIProvider({ apiKey, model });
  const agent = new Agent({
    provider,
    config: {
      root,
      projectName: root.split(/[\\/]/).pop() ?? root,
      maxIterations,
      maxRepairs,
      approvalMode,
      onConfirmCommand: (command: string) => askYesNo(`Run '${command}'? [y/N] `),
      onApprovePlan: async (plan) => {
        if (approvalMode === 'none') return true;
        // In line mode, plan approval reuses the command confirmation prompt.
        return askYesNo(`Approve this plan? [y/N] `);
      },
      onApproveTask: async ({ prompt, workspace }) => {
        process.stdout.write(`\nTask: ${prompt}\nWorkspace: ${workspace}\n`);
        return askYesNo('Allow implementation changes? [y/N] ');
      },
    },
  });
  const optimizer = new OptimizeEngine({ provider, root });

  // Interactive TTY sessions get the Ink TUI; piped/non-TTY keeps line mode.
  if (process.stdin.isTTY) {
    const { launchTui } = await import('../tui/launcher.js');
    await launchTui({ agent, optimizer, workspace: root, model });
    return 0;
  }

  process.stdout.write(banner(root, model));
  process.stdout.write(helpText());

  if (argv[0] === '/status') {
    const workspace = resolveRoot(process.env.WORKSPACE, workspaceFlag); // get current workspace
    const { model } = configFromEnv(); // get selected model
    process.stdout.write(`Current Workspace: ${workspace}\n`);
    process.stdout.write(`Selected Model: ${model}\n`);
    return 0;
}

  await runRepl({ agent, optimizer, workspace: root, model });
  return 0;
}

// Run only when executed directly (not when imported by tests).
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`${errorLine(err instanceof Error ? err.message : String(err))}\n`);
      process.exitCode = 1;
    },
  );
}
