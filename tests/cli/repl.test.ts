import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRepl } from '../../src/cli/repl.js';
import type { Agent } from '../../src/agent/agent.js';
import type { AgentResult } from '../../src/agent/types.js';
import type { OptimizeEngine } from '../../src/optimizer/optimizer.js';
import type { OptimizedTask } from '../../src/optimizer/types.js';

/** Collect output written by the REPL. */
function collectOutput(): { stream: PassThrough; read: () => string } {
  const stream = new PassThrough();
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
  });
  return {
    stream,
    read: () => buf,
  };
}

/** Feed scripted lines with delays so readline sees them as separate lines. */
function feedInput(lines: string[]): PassThrough {
  const input = new PassThrough();
  let i = 0;
  const next = (): void => {
    if (i >= lines.length) {
      input.end();
      return;
    }
    input.write(`${lines[i]}\n`);
    i += 1;
    setImmediate(next);
  };
  next();
  return input;
}

/** Minimal fake Agent whose runWithHooks records the task and returns done. */
function fakeAgent(): { agent: Agent; ran: string[] } {
  const ran: string[] = [];
  const agent = {
    run: async (task: string) => agent.runWithHooks(task),
    runWithHooks: async (task: string): Promise<AgentResult> => {
      ran.push(task);
      return {
        status: 'done',
        report: 'did it',
        iterations: 1,
        toolCallCount: 0,
        events: [],
        runId: 'test',
        durationMs: 0,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    },
  } as unknown as Agent;
  return { agent, ran };
}

/** Fake OptimizeEngine: clear intent → returns a fixed task. */
function fakeOptimizer(task: OptimizedTask): { engine: OptimizeEngine; collected: string[] } {
  const collected: string[] = [];
  const engine = {
    collect: (prompt: string) => {
      collected.push(prompt);
      return {
        prompt,
        context: { projectName: 'x', fileTree: '', packageJson: null, readme: null, relevantFiles: [], fileSnippets: {} },
      };
    },
    optimize: async () => ({ kind: 'task' as const, task }),
  } as unknown as OptimizeEngine;
  return { engine, collected };
}

const SAMPLE_TASK: OptimizedTask = {
  intent: 'Improve the math module.',
  requirements: ['Fix multiply.'],
  constraints: [],
  relevantFiles: ['src/math.ts'],
  assumptions: [],
  ambiguities: [],
  acceptanceCriteria: ['npm test passes.'],
};

test('repl: runs the agent for a plain task', async () => {
  const { agent, ran } = fakeAgent();
  const { stream, read } = collectOutput();
  const input = feedInput(['/help', 'fix the bug', '/exit']);

  await runRepl({ agent, input, output: stream });

  assert.deepEqual(ran, ['fix the bug']);
  assert.match(read(), /\/optimize/);
  assert.match(read(), /Done:/);
});

test('repl: /status shows workspace and model without running the agent', async () => {
  const { agent, ran } = fakeAgent();
  const { stream, read } = collectOutput();
  const input = feedInput(['/status', '/exit']);

  await runRepl({ agent, workspace: 'C:/repo', model: 'gpt-4o-mini', input, output: stream });

  assert.deepEqual(ran, []);
  assert.match(read(), /Workspace: C:\/repo/);
  assert.match(read(), /Model: gpt-4o-mini/);
});

test('repl: /optimize previews then executes on Enter', async () => {
  const { agent, ran } = fakeAgent();
  const { engine, collected } = fakeOptimizer(SAMPLE_TASK);
  const { stream, read } = collectOutput();
  // /optimize → task prompt "make math better" → preview → "" (execute) → /exit
  const input = feedInput(['/optimize', 'make the math module better', '', '/exit']);

  await runRepl({ agent, optimizer: engine, input, output: stream });

  assert.deepEqual(collected, ['make the math module better']);
  assert.equal(ran.length, 1);
  assert.match(ran[0]!, /Intent: Improve the math module\./);
  const out = read();
  assert.match(out, /✨ Optimized Task/);
  assert.match(out, /\[Execute\] \[Edit\] \[Cancel\]/);
  assert.match(out, /Done:/);
});

test('repl: /optimize cancel returns without running', async () => {
  const { agent, ran } = fakeAgent();
  const { engine } = fakeOptimizer(SAMPLE_TASK);
  const { stream } = collectOutput();
  const input = feedInput(['/optimize', 'make math better', 'cancel', '/exit']);

  await runRepl({ agent, optimizer: engine, input, output: stream });

  assert.equal(ran.length, 0);
});

test('repl: /optimize without engine reports unavailable', async () => {
  const { agent, ran } = fakeAgent();
  const { stream, read } = collectOutput();
  const input = feedInput(['/optimize', '/exit']);

  await runRepl({ agent, input, output: stream });

  assert.equal(ran.length, 0);
  assert.match(read(), /not available/);
});
