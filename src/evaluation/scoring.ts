import type { AgentResult } from '../agent/types.js';
import type { AgentEvent } from '../agent/events.js';
import type { BenchmarkMetrics, BenchmarkTask, EvaluatorResult } from './benchmark.js';

/** Known failure categories for explaining failed runs. */
export const FAILURE_CATEGORIES = [
  'verification_failed',
  'requirements_not_met',
  'iterations_exceeded',
  'tool_error',
  'user_denied',
  'model_blocked',
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export interface RunInput {
  task: BenchmarkTask;
  result: AgentResult;
  /** Workspace root that was operated on. */
  root: string;
  /** Deterministic evaluator outcomes for this run. */
  evaluatorResults: EvaluatorResult[];
  /** Persisted trace run ID, when available. */
  traceRunId?: string;
}

/** Categorize why a run failed based on its result and events. */
export function categorizeFailure(
  result: AgentResult,
  evaluatorResults: EvaluatorResult[],
): FailureCategory[] {
  const cats: FailureCategory[] = [];
  if (result.status === 'blocked' && /iteration limit/i.test(result.terminationReason ?? '')) {
    cats.push('iterations_exceeded');
  }
  if (result.status === 'blocked' && /not approved|denied/i.test(result.terminationReason ?? '')) {
    cats.push('user_denied');
  }
  if (result.status === 'blocked' && /no \[done\]|did not produce/i.test(result.terminationReason ?? '')) {
    cats.push('model_blocked');
  }
  if (result.status === 'failed' && /non-recoverable tool|tool failure/i.test(result.terminationReason ?? '')) {
    cats.push('tool_error');
  }
  if (evaluatorResults.some((e) => e.spec.type === 'test' && !e.passed)) {
    cats.push('verification_failed');
  }
  if (evaluatorResults.some((e) => e.spec.type === 'requirement' && !e.passed)) {
    cats.push('requirements_not_met');
  }
  if (cats.length === 0 && result.status !== 'done') {
    cats.push('model_blocked');
  }
  return cats;
}

/** Estimate cost from token usage (rough blended-rate model). */
export function estimateCost(totalTokens: number): number {
  return (totalTokens / 1_000_000) * 2.5;
}

/** Count tool-call rounds and whether any repair happened. */
function analyzeEvents(events: AgentEvent[]): { toolRounds: number; repairs: number; recovered: boolean } {
  let toolRounds = 0;
  let repairs = 0;
  let recovered = false;
  for (const e of events) {
    if (e.type === 'tool_start') toolRounds += 1;
    if (e.type === 'repair_start') {
      repairs += 1;
      if (e.attempt === e.maxAttempts) recovered = true;
    }
  }
  return { toolRounds, repairs, recovered };
}

/**
 * Score a single run against its benchmark task.
 * Score components (0-100):
 *  - 50% evaluator pass rate
 *  - 25% completion bonus (agent reported done AND all evaluators passed)
 *  - 15% efficiency (fewer tool calls than expected is better)
 *  - 10% recovery bonus (recovered after a verification failure)
 */
export function scoreRun(input: RunInput): BenchmarkMetrics {
  const { task, result, evaluatorResults } = input;
  const { toolRounds, recovered } = analyzeEvents(result.events);

  const expectedSteps = task.difficulty === 'easy' ? 4 : task.difficulty === 'medium' ? 6 : 10;
  const toolEfficiency = Math.min(1, expectedSteps / Math.max(1, toolRounds));

  const passRate =
    evaluatorResults.length > 0
      ? evaluatorResults.filter((e) => e.passed).length / evaluatorResults.length
      : result.status === 'done' ? 1 : 0;

  const completed = result.status === 'done' && evaluatorResults.every((e) => e.passed);

  const score = Math.round(
    50 * passRate + 25 * (completed ? 1 : 0) + 15 * toolEfficiency + 10 * (recovered ? 1 : 0),
  );

  return {
    taskId: task.id,
    score,
    passed: completed,
    steps: toolRounds,
    durationMs: result.durationMs,
    totalTokens: result.tokenUsage.totalTokens,
    estimatedCost: estimateCost(result.tokenUsage.totalTokens),
    toolEfficiency: Math.round(toolEfficiency * 100) / 100,
    recovered,
    evaluatorResults,
    failureCategories: categorizeFailure(result, evaluatorResults),
    judgeScores: [],
  };
}