import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LLMProvider } from '../../src/llm/provider.js';
import type { GenerateRequest, ModelResponse } from '../../src/llm/types.js';
import { OptimizeEngine } from '../../src/optimizer/optimizer.js';
import type { OptimizedTask } from '../../src/optimizer/types.js';

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'project');

/** Fake provider returning scripted JSON responses, recording requests. */
class FakeProvider implements LLMProvider {
  responses: string[];
  requests: GenerateRequest[] = [];

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generate(request: GenerateRequest): Promise<ModelResponse> {
    this.requests.push(request);
    const content = this.responses.shift() ?? '{}';
    return { stopReason: 'end_turn', content, toolCalls: [] };
  }
}

const CLEAR_INTENT = JSON.stringify({
  intent: 'Fix the multiply function in the math module.',
  ambiguityLevel: 'clear',
});

const AMBIGUOUS_INTENT = JSON.stringify({
  intent: 'Improve the math module.',
  ambiguityLevel: 'ambiguous',
  question: 'What should be improved?',
  options: ['Correctness', 'Performance', 'API shape'],
});

const VALID_TASK: OptimizedTask = {
  intent: 'Fix the multiply function.',
  requirements: ['Correct the multiply implementation.', 'Run the tests.'],
  constraints: ['Do not change the add function.'],
  relevantFiles: ['src/math.ts'],
  assumptions: ['The tests define expected behavior.'],
  ambiguities: [],
  acceptanceCriteria: ['npm test passes.'],
};

test('optimize: clear intent goes straight to a task', async () => {
  const provider = new FakeProvider([CLEAR_INTENT, JSON.stringify(VALID_TASK)]);
  const engine = new OptimizeEngine({ provider, root: FIXTURE });

  const session = engine.collect('fix the multiply function');
  const outcome = await engine.optimize(session);

  assert.equal(outcome.kind, 'task');
  if (outcome.kind === 'task') {
    assert.equal(outcome.task.intent, VALID_TASK.intent);
  }
  // Both calls asked for JSON mode.
  assert.ok(provider.requests.every((r) => r.json === true));
  assert.equal(provider.requests.length, 2);
});

test('optimize: ambiguous intent returns a clarify question', async () => {
  const provider = new FakeProvider([AMBIGUOUS_INTENT]);
  const engine = new OptimizeEngine({ provider, root: FIXTURE });

  const session = engine.collect('make the math module better');
  const outcome = await engine.optimize(session);

  assert.equal(outcome.kind, 'clarify');
  if (outcome.kind === 'clarify') {
    assert.equal(outcome.question.question, 'What should be improved?');
    assert.deepEqual(outcome.question.options, ['Correctness', 'Performance', 'API shape']);
  }
  assert.equal(provider.requests.length, 1);
});

test('optimize: clarify then answer produces a task', async () => {
  const provider = new FakeProvider([AMBIGUOUS_INTENT, JSON.stringify(VALID_TASK)]);
  const engine = new OptimizeEngine({ provider, root: FIXTURE });

  const session = engine.collect('make the math module better');
  const first = await engine.optimize(session);
  assert.equal(first.kind, 'clarify');
  if (first.kind !== 'clarify') return;

  const answered: typeof session = {
    ...session,
    clarification: first.question,
    clarificationAnswer: 'Correctness',
  };
  const second = await engine.optimize(answered);
  assert.equal(second.kind, 'task');
  if (second.kind === 'task') {
    assert.equal(second.task.intent, VALID_TASK.intent);
  }
});

test('optimize: invalid JSON output throws a clear error', async () => {
  const provider = new FakeProvider([CLEAR_INTENT, 'not json at all']);
  const engine = new OptimizeEngine({ provider, root: FIXTURE });

  const session = engine.collect('fix the multiply function');
  await assert.rejects(() => engine.optimize(session), /model did not return valid JSON/);
});

test('optimize: JSON missing the task shape throws a clear error', async () => {
  const provider = new FakeProvider([CLEAR_INTENT, JSON.stringify({ nope: true })]);
  const engine = new OptimizeEngine({ provider, root: FIXTURE });

  const session = engine.collect('fix the multiply function');
  await assert.rejects(() => engine.optimize(session), /task generation returned unparseable/);
});

test('optimize: fenced JSON is parsed', async () => {
  const provider = new FakeProvider([
    CLEAR_INTENT,
    `Here is the task:\n\`\`\`json\n${JSON.stringify(VALID_TASK)}\n\`\`\``,
  ]);
  const engine = new OptimizeEngine({ provider, root: FIXTURE });

  const session = engine.collect('fix the multiply function');
  const outcome = await engine.optimize(session);
  assert.equal(outcome.kind, 'task');
  if (outcome.kind === 'task') {
    assert.equal(outcome.task.intent, VALID_TASK.intent);
  }
});

test('optimize: context is project-aware (fixture math files surfaced)', async () => {
  const provider = new FakeProvider([CLEAR_INTENT, JSON.stringify(VALID_TASK)]);
  const engine = new OptimizeEngine({ provider, root: FIXTURE });

  const session = engine.collect('fix the multiply function in math');
  // Context collection is deterministic and synchronous.
  assert.ok(session.context.relevantFiles.includes('src/math.ts'));
  assert.ok(session.context.fileTree.includes('math.ts'));
});
