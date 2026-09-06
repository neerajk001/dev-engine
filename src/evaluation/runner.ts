import type { Agent } from '../agent/agent.js';
import { runEvaluator } from './deterministic.js';
import { scoreRun } from './scoring.js';
import type { BenchmarkTask } from './benchmark.js';
import type { RunTrace } from '../tracing/trace.js';

export interface EvaluationOutput {
  taskId: string;
  score: number;
  passed: boolean;
  report: string;
}

/**
 * Run a single benchmark task against the agent and evaluate the outcome.
 */
export async function runBenchmark(
  agent: Agent,
  task: BenchmarkTask,
  root: string,
): Promise<EvaluationOutput> {
  const result = await agent.run(task.prompt);

  const evaluatorResults = [];
  for (const spec of task.evaluators) {
    evaluatorResults.push(await runEvaluator(root, spec));
  }

  const metrics = scoreRun({ task, result, root, evaluatorResults });

  const lines = [
    `Task: ${task.name}`,
    `Status: ${result.status}`,
    `Score: ${metrics.score}/100 (${metrics.passed ? 'PASS' : 'FAIL'})`,
    `Steps: ${metrics.steps}  Duration: ${metrics.durationMs}ms  Tokens: ${metrics.totalTokens}  Cost: $${metrics.estimatedCost.toFixed(4)}`,
    `Tool efficiency: ${Math.round(metrics.toolEfficiency * 100)}%  Recovered: ${metrics.recovered ? 'yes' : 'no'}`,
  ];
  for (const ev of evaluatorResults) {
    lines.push(`  [${ev.passed ? 'PASS' : 'FAIL'}] ${ev.spec.type}: ${ev.detail.slice(0, 120)}`);
  }
  if (metrics.failureCategories.length > 0) {
    lines.push(`  Failure categories: ${metrics.failureCategories.join(', ')}`);
  }

  return {
    taskId: task.id,
    score: metrics.score,
    passed: metrics.passed,
    report: lines.join('\n'),
  };
}

export type { RunTrace };