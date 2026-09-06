import type { BenchmarkMetrics, BenchmarkTask } from './benchmark.js';

/** Aggregated metrics for a set of runs. */
export interface RunAggregate {
  taskId: string;
  runs: number;
  passRate: number;
  avgScore: number;
  avgDurationMs: number;
  avgTokens: number;
  avgCost: number;
  avgToolEfficiency: number;
  failureCategories: Record<string, number>;
}

/** Compare two runs side by side (e.g. older agent version vs newer). */
export interface RunComparison {
  /** Aspect → [left, right, winner]. winner: -1 = left, 0 = tie, 1 = right. */
  aspects: Array<{ label: string; left: string; right: string; winner: -1 | 0 | 1 }>;
  /** Overall better run: 'left' | 'right' | 'tie'. */
  overall: 'left' | 'right' | 'tie';
}

/** Aggregate multiple benchmark metrics into a summary. */
export function aggregateRuns(metrics: BenchmarkMetrics[]): RunAggregate {
  const n = metrics.length;
  if (n === 0) {
    return {
      taskId: '',
      runs: 0,
      passRate: 0,
      avgScore: 0,
      avgDurationMs: 0,
      avgTokens: 0,
      avgCost: 0,
      avgToolEfficiency: 0,
      failureCategories: {},
    };
  }
  const failCats: Record<string, number> = {};
  for (const m of metrics) {
    for (const cat of m.failureCategories) {
      failCats[cat] = (failCats[cat] ?? 0) + 1;
    }
  }
  return {
    taskId: metrics[0]!.taskId,
    runs: n,
    passRate: metrics.filter((m) => m.passed).length / n,
    avgScore: avg(metrics.map((m) => m.score)),
    avgDurationMs: avg(metrics.map((m) => m.durationMs)),
    avgTokens: avg(metrics.map((m) => m.totalTokens)),
    avgCost: avg(metrics.map((m) => m.estimatedCost)),
    avgToolEfficiency: avg(metrics.map((m) => m.toolEfficiency)),
    failureCategories: failCats,
  };
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Compare two runs (e.g. agent version A vs B) across common metrics. */
export function compareRuns(left: BenchmarkMetrics, right: BenchmarkMetrics): RunComparison {
  const aspects: RunComparison['aspects'] = [];

  const addAspect = (label: string, leftVal: number, rightVal: number, higherIsBetter: boolean): void => {
    let winner: -1 | 0 | 1 = 0;
    if (leftVal !== rightVal) {
      winner = leftVal > rightVal === higherIsBetter ? -1 : 1;
    }
    aspects.push({ label, left: fmtNum(leftVal), right: fmtNum(rightVal), winner });
  };

  addAspect('Score (0-100)', left.score, right.score, true);
  addAspect('Duration (ms)', left.durationMs, right.durationMs, false);
  addAspect('Token usage', left.totalTokens, right.totalTokens, false);
  addAspect('Tool efficiency', left.toolEfficiency, right.toolEfficiency, true);
  addAspect('Estimated cost ($)', left.estimatedCost, right.estimatedCost, false);

  const leftWins = aspects.filter((a) => a.winner === -1).length;
  const rightWins = aspects.filter((a) => a.winner === 1).length;
  const overall: RunComparison['overall'] = leftWins === rightWins ? 'tie' : leftWins > rightWins ? 'left' : 'right';

  return { aspects, overall };
}

function fmtNum(n: number): string {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(2);
}

/** Human-readable rendering of an aggregate for the CLI. */
export function formatAggregate(agg: RunAggregate): string {
  const lines = [
    `Task: ${agg.taskId}`,
    `Runs: ${agg.runs}`,
    `Pass rate: ${Math.round(agg.passRate * 100)}%`,
    `Avg score: ${Math.round(agg.avgScore)}/100`,
    `Avg duration: ${Math.round(agg.avgDurationMs)}ms`,
    `Avg tokens: ${Math.round(agg.avgTokens)}`,
    `Avg cost: $${agg.avgCost.toFixed(4)}`,
    `Avg tool efficiency: ${Math.round(agg.avgToolEfficiency * 100)}%`,
  ];
  const catEntries = Object.entries(agg.failureCategories);
  if (catEntries.length > 0) {
    lines.push('', 'Failure categories:');
    for (const [cat, count] of catEntries) {
      lines.push(`  ${cat}: ${count}`);
    }
  }
  return lines.join('\n');
}

/** Human-readable rendering of a comparison. */
export function formatComparison(c: RunComparison): string {
  const lines = [
    `${'Aspect'.padEnd(24)} ${'A'.padEnd(12)} ${'B'.padEnd(12)} Winner`,
  ];
  for (const a of c.aspects) {
    const winner = a.winner === -1 ? 'A' : a.winner === 1 ? 'B' : '—';
    lines.push(`${a.label.padEnd(24)} ${a.left.padEnd(12)} ${a.right.padEnd(12)} ${winner}`);
  }
  lines.push('', `Overall winner: ${c.overall === 'left' ? 'A' : c.overall === 'right' ? 'B' : 'tie'}`);
  return lines.join('\n');
}

/** Minimal agent-version registry. */
export interface AgentVersion {
  version: string;
  /** When this version was introduced. */
  introducedAt: number;
  /** Metrics collected under this version (per benchmark task). */
  history: BenchmarkMetrics[];
}

/** Track historical metrics per agent version. */
export class AgentRegistry {
  private versions = new Map<string, AgentVersion>();

  constructor(private readonly agentName: string) {}

  /** Record a run's metrics under a version (creating the version if new). */
  record(version: string, metrics: BenchmarkMetrics): void {
    const existing = this.versions.get(version);
    if (existing) {
      existing.history.push(metrics);
    } else {
      this.versions.set(version, {
        version,
        introducedAt: Date.now(),
        history: [metrics],
      });
    }
  }

  /** List versions with aggregate metrics per task. */
  summarize(): Array<{ version: string; byTask: RunAggregate[] }> {
    const out: Array<{ version: string; byTask: RunAggregate[] }> = [];
    for (const v of this.versions.values()) {
      const taskIds = [...new Set(v.history.map((h) => h.taskId))];
      out.push({
        version: v.version,
        byTask: taskIds.map((taskId) => aggregateRuns(v.history.filter((h) => h.taskId === taskId))),
      });
    }
    return out;
  }

  name(): string {
    return this.agentName;
  }
}

/** Render the version registry for the CLI. */
export function formatRegistry(agentName: string, summary: Array<{ version: string; byTask: RunAggregate[] }>): string {
  const lines: string[] = [`Agent: ${agentName}`];
  for (const v of summary) {
    lines.push('', `Version: ${v.version}`);
    for (const agg of v.byTask) {
      lines.push(`  ${agg.taskId}: pass ${Math.round(agg.passRate * 100)}%  avg ${Math.round(agg.avgScore)}/100  ${agg.runs} runs`);
    }
  }
  return lines.join('\n');
}