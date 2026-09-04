import 'dotenv/config';
import * as readline from 'node:readline/promises';
import { Agent } from '../agent/agent.js';
import { OpenAIProvider } from '../llm/openai.js';
import { validateRoot } from '../context/project.js';
import { resolveRoot } from '../context/workspace.js';
import { banner, errorLine, helpText } from './output.js';
import { runRepl } from './repl.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
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
} {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MODEL ?? DEFAULT_MODEL;
  const parsed = Number(process.env.MAX_ITERATIONS ?? DEFAULT_MAX_ITERATIONS);
  return {
    apiKey,
    model,
    maxIterations: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ITERATIONS,
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
  const { apiKey, model, maxIterations } = configFromEnv();

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
      onConfirmCommand: (command: string) => askYesNo(`Run '${command}'? [y/N] `),
    },
  });

  process.stdout.write(banner(root, model));
  process.stdout.write(helpText());

  await runRepl({ agent });
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
