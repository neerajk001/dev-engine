import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AgentResult } from '../../src/agent/types.js';
import type { AgentEvent } from '../../src/agent/events.js';
import { scoreRun, categorizeFailure, estimateCost } from '../../src/evaluation/scoring.js';
import { aggregateRuns, compareRuns, AgentRegistry, formatAggregate, formatComparison } from '../../src/evaluation/compare.js';
import { defineBenchmarks } from '../../src/evaluation/benchmark.js';
import type { BenchmarkTask, EvaluatorResult } from '../../src/evaluation/benchmark.js';

function makeTask(overrides?: Partial<BenchmarkTask>): BenchmarkTask {
  return {
    id: 'test-task',
    name: 'Test task',
    description: 'desc',
    prompt: 'do the thing',
    evaluators: [
      { type: 'requirement', file: 'math.ts', pattern: 'a \\* b', description: '' },
      { type: 'test', command: 'npm test' },
    ],
    difficulty: 'easy',
    ...overrides,
  };
}

function makeResult(overrides?: Partial<AgentResult>): AgentResult {
  const events: AgentEvent[] = [
    { type: 'agent_start', task: 'do the thing' },
    { type: 'tool_start', name: 'search_files', input: {} },
    { type: 'tool_end', name: 'search_files', ok: true, summary: 'ok' },
  ];
  return {
    status: 'done',
    report: '[done]\nDone.',
    iterations: 2,
    toolCallCount: 1,
    runId: 'abc12345',
    durationMs: 5000,
    events,
    tokenUsage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    ...overrides,
  };
}

function makeEvaluators(allPass: boolean): EvaluatorResult[] {
  const base = (spec: EvaluatorResult['spec']): EvaluatorResult => ({
    spec,
    passed: allPass,
    detail: allPass ? 'pass' : 'fail',
    durationMs: 10,
  });
  return [
    base({ type: 'requirement', file: 'math.ts', pattern: 'a \\* b', description: '' }),
    base({ type: 'test', command: 'npm test' }),
  ];
}

test('defineBenchmarks: has three tasks with evaluators', () => {
  const tasks = defineBenchmarks();
  assert.equal(tasks.length, 3);
  assert.ok(tasks.every((t) => t.evaluators.length > 0));
});

test('scoreRun: perfect run scores high', () => {
  const task = makeTask();
  const result = makeResult();
  const metrics = scoreRun({ task, result, root: '/tmp', evaluatorResults: makeEvaluators(true) });
  assert.equal(metrics.passed, true);
  assert.ok(metrics.score >= 70);
  assert.equal(metrics.failureCategories.length, 0);
});

test('scoreRun: failing evaluators score low and categorize', () => {
  const task = makeTask();
  const result = makeResult({ status: 'failed' });
  const metrics = scoreRun({ task, result, root: '/tmp', evaluatorResults: makeEvaluators(false) });
  assert.equal(metrics.passed, false);
  assert.ok(metrics.score < 50);
  assert.ok(metrics.failureCategories.includes('requirements_not_met'));
  assert.ok(metrics.failureCategories.includes('verification_failed'));
});

test('categorizeFailure: iteration limit', () => {
  const result = makeResult({ status: 'blocked', terminationReason: 'iteration limit exceeded (25)' });
  const cats = categorizeFailure(result, makeEvaluators(false));
  assert.ok(cats.includes('iterations_exceeded'));
});

test('categorizeFailure: user denied', () => {
  const result = makeResult({ status: 'blocked', terminationReason: 'command not approved by the user' });
  const cats = categorizeFailure(result, makeEvaluators(true));
  assert.ok(cats.includes('user_denied'));
});

test('estimateCost: scales with tokens', () => {
  assert.equal(estimateCost(0), 0);
  assert.ok(estimateCost(1_000_000) > 0);
  assert.equal(estimateCost(1_000_000).toFixed(2), '2.50');
});

test('aggregateRuns: computes averages and pass rate', () => {
  const metrics = [
    scoreRun({ task: makeTask(), result: makeResult(), root: '/tmp', evaluatorResults: makeEvaluators(true) }),
    scoreRun({ task: makeTask(), result: makeResult({ status: 'failed' }), root: '/tmp', evaluatorResults: makeEvaluators(true) }),
  ];
  const agg = aggregateRuns(metrics);
  assert.equal(agg.runs, 2);
  assert.equal(agg.passRate, 0.5);
  assert.ok(agg.avgScore > 0 && agg.avgScore <= 100);
});

test('aggregateRuns: empty input', () => {
  const agg = aggregateRuns([]);
  assert.equal(agg.runs, 0);
  assert.equal(agg.passRate, 0);
});

test('compareRuns: determines winner by metrics', () => {
  const left = scoreRun({ task: makeTask(), result: makeResult({ durationMs: 10_000, tokenUsage: { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 } }), root: '/tmp', evaluatorResults: makeEvaluators(true) });
  const right = scoreRun({ task: makeTask(), result: makeResult({ durationMs: 2_000, tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } }), root: '/tmp', evaluatorResults: makeEvaluators(true) });
  const cmp = compareRuns(left, right);
  assert.equal(cmp.overall, 'right'); // right is faster + cheaper
  assert.ok(cmp.aspects.some((a) => a.label === 'Duration (ms)' && a.winner === 1));
});

test('AgentRegistry: tracks versions and history', () => {
  const registry = new AgentRegistry('test-agent');
  registry.record('v1', scoreRun({ task: makeTask(), result: makeResult(), root: '/tmp', evaluatorResults: makeEvaluators(true) }));
  registry.record('v1', scoreRun({ task: makeTask(), result: makeResult(), root: '/tmp', evaluatorResults: makeEvaluators(true) }));
  registry.record('v2', scoreRun({ task: makeTask(), result: makeResult({ status: 'failed' }), root: '/tmp', evaluatorResults: makeEvaluators(false) }));

  const summary = registry.summarize();
  assert.equal(summary.length, 2);
  const v1 = summary.find((s) => s.version === 'v1');
  assert.equal(v1?.byTask[0]?.runs, 2);
  const v2 = summary.find((s) => s.version === 'v2');
  assert.equal(v2?.byTask[0]?.passRate, 0);
});

test('formatAggregate and formatComparison render text', () => {
  const metrics = scoreRun({ task: makeTask(), result: makeResult(), root: '/tmp', evaluatorResults: makeEvaluators(true) });
  const agg = aggregateRuns([metrics]);
  assert.match(formatAggregate(agg), /Pass rate/);

  const left = scoreRun({ task: makeTask(), result: makeResult({ durationMs: 10_000 }), root: '/tmp', evaluatorResults: makeEvaluators(true) });
  const right = scoreRun({ task: makeTask(), result: makeResult({ durationMs: 2_000 }), root: '/tmp', evaluatorResults: makeEvaluators(true) });
  assert.match(formatComparison(compareRuns(left, right)), /Overall winner/);
});

test('runBenchmark: no LLM, uses scoreRun deterministically', () => {
  // This is just a type-level check that the pieces compose together.
  const task = makeTask();
  const result = makeResult();
  const metrics = scoreRun({ task, result, root: '/tmp', evaluatorResults: makeEvaluators(true) });
  assert.equal(typeof metrics.score, 'number');
  assert.equal(typeof metrics.passed, 'boolean');
});