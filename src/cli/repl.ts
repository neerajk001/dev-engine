import * as readline from 'node:readline';
import type { Agent } from '../agent/agent.js';
import type { AgentResult } from '../agent/types.js';
import type { OptimizeEngine } from '../optimizer/optimizer.js';
import type { ClarificationQuestion, OptimizedTask } from '../optimizer/types.js';
import { taskToString } from '../optimizer/types.js';
import { errorLine, helpText, renderClarify, renderTaskPreview, resultBlock, statusBlock } from './output.js';
import { listTraces, loadTrace, formatTraceSummary, formatTraceDetail } from '../tracing/trace.js';

export interface ReplOptions {
  agent: Agent;
  workspace?: string;
  model?: string;
  /** Present when the /optimize flow is enabled. */
  optimizer?: OptimizeEngine;
  /** Injectable for tests. */ 
  input?: NodeJS.ReadableStream; 
  output?: NodeJS.WritableStream; 
}

/**
 * Line-event-driven prompt queue. Unlike readline's question(), which can
 * lose piped lines that arrive while a prompt is pending, this buffers every
 * line and hands it to the next ask().
 */
export class LinePrompter {
  private readonly queue: string[] = [];
  private waiting: ((line: string | null) => void) | null = null;
  private closed = false;
  private readonly rl: readline.Interface;

  constructor(input: NodeJS.ReadableStream) {
    this.rl = readline.createInterface({ input });
    this.rl.on('line', (line) => {
      if (this.waiting) {
        const w = this.waiting;
        this.waiting = null;
        w(line);
      } else {
        this.queue.push(line);
      }
    });
    this.rl.on('close', () => {
      this.closed = true;
      if (this.waiting) {
        const w = this.waiting;
        this.waiting = null;
        w(null);
      }
    });
  }

  /** Resolve with the next line, or null when the input closed. */
  next(): Promise<string | null> {
    if (this.queue.length > 0) {
      return Promise.resolve(this.queue.shift()!);
    }
    if (this.closed) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }

  close(): void {
    this.rl.close();
  }
}

/** Render a live status line while a task is running. */
export function statusWriter(output: NodeJS.WritableStream) {
  return (status: string): void => {
    output.write(`● ${status}\n`);
  };
}

/**
 * Interactive read-eval-print loop driven by a LinePrompter. Handles
 * /help, /optimize, /exit, and Ctrl+C. Works on both TTY and piped stdin.
 */
export async function runRepl(opts: ReplOptions): Promise<void> {
  const { agent, optimizer } = opts;
  const workspace = opts.workspace ?? (agent as unknown as { config?: { root?: string } }).config?.root ?? process.cwd();
  const model = opts.model ?? 'unknown';
  const input = opts.input ?? process.stdin;
  const output = opts.output ?? process.stdout;
  const prompter = new LinePrompter(input);

  const ask = async (query: string): Promise<string | null> => {
    output.write(query);
    return prompter.next();
  };

  let running = true;
  const onSigint = (): void => {
    running = false;
    prompter.close();
  };
  process.on('SIGINT', onSigint);

  try {
    while (running) {
      const line = await ask('> ');
      if (line === null || !running) break;
      const text = line.trim();
      if (text === '') continue;
      if (text === '/exit' || text === '/quit') {
        break;
      }
      if (text === '/help') {
        output.write(helpText());
        continue;
      }
      if (text === '/status') {
        output.write(statusBlock(workspace, model));
        continue;
      }
      if (text === '/optimize') {
        if (!optimizer) {
          output.write(`${errorLine('/optimize is not available in this session')}\n`);
          continue;
        }
        await optimizeFlow(ask, output, agent, optimizer);
        continue;
      }

      if (text === '/traces') {
        const root = (agent as unknown as { config: { root: string } }).config.root;
        const traces = listTraces(root);
        if (traces.length === 0) {
          output.write('No traces found. Run a task first.\n');
        } else {
          output.write(`\n${traces.length} trace(s) found:\n\n`);
          for (const t of traces) {
            output.write(`${formatTraceSummary(t)}\n`);
          }
          output.write('\nUse /traces <runId> to view details.\n\n');
        }
        continue;
      }
      if (text.startsWith('/traces ')) {
        const runId = text.slice('/traces '.length).trim();
        const root = (agent as unknown as { config: { root: string } }).config.root;
        const trace = loadTrace(root, runId);
        if (!trace) {
          output.write(`${errorLine(`trace not found: ${runId}`)}\n`);
        } else {
          output.write(`${formatTraceDetail(trace)}\n\n`);
        }
        continue;
      }

      if (text.startsWith('/evaluate')) {
        const { runBenchmark } = await import('../evaluation/runner.js');
        const { defineBenchmarks } = await import('../evaluation/benchmark.js');
        const taskId = text.slice('/evaluate'.length).trim();
        try {
          const tasks = defineBenchmarks();
          const task = taskId ? tasks.find((t) => t.id === taskId) : tasks[0];
          if (!task) {
            output.write(`${errorLine(`unknown task: ${taskId}. Available: ${tasks.map((t) => t.id).join(', ')}`)}\n`);
          } else {
            const root = (agent as unknown as { config: { root: string } }).config.root;
            const result = await runBenchmark(agent, task, root);
            output.write(`\n${result.report}\n\n`);
          }
        } catch (err) {
          output.write(`${errorLine(err instanceof Error ? err.message : String(err))}\n`);
        }
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
    prompter.close();
  }
}

type AskFn = (query: string) => Promise<string | null>;

/** Runs the /optimize flow: clarify → preview → Execute/Edit/Cancel. */
async function optimizeFlow(
  ask: AskFn,
  output: NodeJS.WritableStream,
  agent: Agent,
  optimizer: OptimizeEngine,
): Promise<void> {
  output.write('Describe the task (vague is fine):\n');
  const prompt = (await ask('> '))?.trim() ?? '';
  if (prompt === '') return;

  const session = optimizer.collect(prompt);
  const onStatus = statusWriter(output);
  onStatus('analyzing intent…');

  let outcome;
  try {
    outcome = await optimizer.optimize(session);
  } catch (err) {
    output.write(`${errorLine(err instanceof Error ? err.message : String(err))}\n`);
    output.write('Tip: try rephrasing the request or run /optimize again.\n');
    return;
  }

  if (outcome.kind === 'clarify') {
    await askClarification(ask, output, optimizer, session, outcome.question, agent);
    return;
  }

  await previewAndRun(ask, output, agent, outcome.task);
}

/** Ask the user to resolve ambiguity, then generate + preview the task. */
async function askClarification(
  ask: AskFn,
  output: NodeJS.WritableStream,
  optimizer: OptimizeEngine,
  session: Parameters<OptimizeEngine['optimize']>[0],
  question: ClarificationQuestion,
  agent: Agent,
): Promise<void> {
  output.write('\n');
  output.write(renderClarify(question));
  output.write('\n> ');
  const rawAnswer = (await ask('')) ?? '';
  const answer = resolveChoice(rawAnswer, question.options);

  const answered = {
    ...session,
    clarification: question,
    clarificationAnswer: answer,
  };
  const status = statusWriter(output);
  status('generating optimized task…');

  try {
    const outcome = await optimizer.optimize(answered);
    if (outcome.kind === 'clarify') {
      output.write(`${errorLine('the request still needs clarification; try again')}\n`);
      return;
    }
    await previewAndRun(ask, output, agent, outcome.task);
  } catch (err) {
    output.write(`${errorLine(err instanceof Error ? err.message : String(err))}\n`);
  }
}

/** If the user typed a number, map it to the matching option. */
function resolveChoice(answer: string, options: string[]): string {
  const n = Number(answer.trim());
  if (Number.isInteger(n) && n >= 1 && n <= options.length) {
    return options[n - 1]!;
  }
  return answer.trim();
}

/** Show the preview and honor Execute / Edit / Cancel. */
async function previewAndRun(
  ask: AskFn,
  output: NodeJS.WritableStream,
  agent: Agent,
  task: OptimizedTask,
): Promise<void> {
  output.write('\n');
  output.write(renderTaskPreview(task));
  output.write('\n> ');
  const action = ((await ask('')) ?? '').trim().toLowerCase();

  if (action === '' || action === 'execute' || action === 'e' || action === 'run') {
    const onStatus = statusWriter(output);
    output.write('\n● running the coding agent…\n');
    try {
      const result: AgentResult = await agent.runWithHooks(taskToString(task), onStatus);
      output.write(resultBlock(result.status, result.report));
      if (result.terminationReason) {
        output.write(`${errorLine(result.terminationReason)}\n`);
      }
    } catch (err) {
      output.write(`${errorLine(err instanceof Error ? err.message : String(err))}\n`);
    }
    return;
  }

  if (action === 'edit') {
    output.write('Edit the task text (leave unchanged to keep):\n');
    const edited = ((await ask('> ')) ?? '').trim();
    if (edited !== '') {
      output.write('\n● running the coding agent with your edited task…\n');
      const onStatus = statusWriter(output);
      try {
        const result: AgentResult = await agent.runWithHooks(edited, onStatus);
        output.write(resultBlock(result.status, result.report));
        if (result.terminationReason) {
          output.write(`${errorLine(result.terminationReason)}\n`);
        }
      } catch (err) {
        output.write(`${errorLine(err instanceof Error ? err.message : String(err))}\n`);
      }
    }
    return;
  }

  // cancel (anything else)
  output.write('Cancelled.\n');
}
