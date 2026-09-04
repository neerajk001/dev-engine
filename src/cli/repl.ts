import * as readline from 'node:readline/promises';
import type { Agent } from '../agent/agent.js';
import type { AgentResult } from '../agent/types.js';
import { errorLine, helpText, resultBlock } from './output.js';

export interface ReplOptions {
  agent: Agent;
  /** Injectable for tests. */
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

/** Render a live status line while a task is running. */
export function statusWriter(output: NodeJS.WritableStream) {
  return (status: string): void => {
    output.write(`● ${status}\n`);
  };
}

/**
 * Interactive read-eval-print loop: reads tasks, runs the agent, renders
 * results. Handles /help, /exit, and Ctrl+C.
 */
export async function runRepl(opts: ReplOptions): Promise<void> {
  const { agent } = opts;
  const input = opts.input ?? process.stdin;
  const output = opts.output ?? process.stdout;
  const rl = readline.createInterface({ input, output });

  const onSigint = (): void => {
    rl.close();
  };
  process.on('SIGINT', onSigint);

  try {
    while (true) {
      const line = await rl.question('> ');
      const text = line.trim();
      if (text === '') continue;
      if (text === '/exit' || text === '/quit') {
        break;
      }
      if (text === '/help') {
        output.write(helpText());
        continue;
      }

      const onStatus = statusWriter(output);
      try {
        const result: AgentResult = await agent.runWithHooks(text, onStatus);
        output.write(resultBlock(result.status, result.report));
        if (result.terminationReason) {
          output.write(`${errorLine(result.terminationReason)}\n`);
        }
      } catch (err) {
        output.write(`${errorLine(err instanceof Error ? err.message : String(err))}\n`);
      }
    }
  } finally {
    process.off('SIGINT', onSigint);
    rl.close();
  }
}
