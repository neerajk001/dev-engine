import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LLMProvider } from '../../src/llm/provider.js';
import type { GenerateRequest, ModelResponse } from '../../src/llm/types.js';
import { generatePlan, parseImplementationPlan } from '../../src/agent/planner.js';

class FakeProvider implements LLMProvider {
  content: string;
  constructor(content: string) {
    this.content = content;
  }
  async generate(_req: GenerateRequest): Promise<ModelResponse> {
    return { stopReason: 'end_turn', content: this.content, toolCalls: [] };
  }
}

test('parseImplementationPlan: accepts a valid plan', () => {
  const plan = parseImplementationPlan({
    steps: ['Fix multiply.', 'Run tests.'],
    verification: ['npm test'],
    relevantFiles: ['src/math.ts'],
  });
  assert.ok(plan);
  assert.equal(plan?.steps.length, 2);
});

test('parseImplementationPlan: rejects malformed plans', () => {
  assert.equal(parseImplementationPlan({ steps: [], verification: ['npm test'], relevantFiles: [] }), null);
  assert.equal(parseImplementationPlan({ steps: ['x'], verification: 'not-array', relevantFiles: [] }), null);
  assert.equal(parseImplementationPlan({ steps: ['x'], verification: [1], relevantFiles: [] }), null);
  assert.equal(parseImplementationPlan({}), null);
});

test('generatePlan: returns a parsed plan from JSON output', async () => {
  const provider = new FakeProvider(
    JSON.stringify({
      steps: ['Fix multiply.', 'Run tests.'],
      verification: ['npm test'],
      relevantFiles: ['src/math.ts'],
    }),
  );
  const plan = await generatePlan(provider, 'fix math', 'project context');
  assert.equal(plan.steps[0], 'Fix multiply.');
  assert.deepEqual(plan.verification, ['npm test']);
});

test('generatePlan: throws on invalid output', async () => {
  const provider = new FakeProvider('not json');
  await assert.rejects(() => generatePlan(provider, 'fix math', 'ctx'), /valid implementation plan/);
});
