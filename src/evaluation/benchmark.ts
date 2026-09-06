/** V5 — Benchmark definitions and task schema. */

export interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  /** The task prompt given to the agent. */
  prompt: string;
  /** Files the task is allowed to modify or read. */
  workspace?: string;
  /** Deterministic checks the task must pass to be considered successful. */
  evaluators: EvaluatorSpec[];
  /** Optional LLM judge criteria for qualitative scoring. */
  judgeCriteria?: string[];
  /** Expected difficulty level for weighting. */
  difficulty: 'easy' | 'medium' | 'hard';
}

export type EvaluatorSpec =
  | { type: 'test'; command: string }
  | { type: 'build'; command: string }
  | { type: 'requirement'; file: string; pattern: string; description: string };

export interface EvaluatorResult {
  spec: EvaluatorSpec;
  passed: boolean;
  detail: string;
  durationMs: number;
}

export interface BenchmarkMetrics {
  taskId: string;
  /** Composite score 0-100. */
  score: number;
  /** All checks passed. */
  passed: boolean;
  /** Steps taken by the agent. */
  steps: number;
  /** Time taken in ms. */
  durationMs: number;
  /** Token usage across the run. */
  totalTokens: number;
  /** Estimated cost in currency units. */
  estimatedCost: number;
  /** Tool efficiency = steps / expected steps (1.0 = optimal). */
  toolEfficiency: number;
  /** Whether the run required repairs to recover. */
  recovered: boolean;
  evaluatorResults: EvaluatorResult[];
  failureCategories: string[];
  /** Qualitative judge scores 0-100 (empty if not judged). */
  judgeScores: number[];
}

/** Define the standard benchmark suite. */
export function defineBenchmarks(): BenchmarkTask[] {
  return [
    {
      id: 'fix-multiply-bug',
      name: 'Fix multiply bug',
      description: 'Fix a bug in a multiply function and verify with tests.',
      prompt: 'find the bug in src/math.ts that makes the multiply function return the wrong result, fix it, and verify with the project tests.',
      evaluators: [
        { type: 'requirement', file: 'src/math.ts', pattern: 'return a \\* b', description: 'multiply should multiply' },
        { type: 'test', command: 'npm test' },
      ],
      difficulty: 'easy',
    },
    {
      id: 'add-subtract-function',
      name: 'Add subtract function',
      description: 'Add a subtract function and test coverage.',
      prompt: 'add a subtract(a, b) function to src/math.ts that returns a - b, and add a passing test for it.',
      evaluators: [
        { type: 'requirement', file: 'src/math.ts', pattern: 'subtract', description: 'subtract function exists' },
        { type: 'requirement', file: 'src/math.test.ts', pattern: 'subtract', description: 'test covers subtract' },
        { type: 'test', command: 'npm test' },
      ],
      difficulty: 'medium',
    },
    {
      id: 'implement-verify-loop',
      name: 'Implement + verify loop',
      description: 'Implement a feature with a verification/repair loop.',
      prompt: 'implement a fibonacci function in src/math.ts, add tests that verify it, and make sure all tests pass before reporting done.',
      evaluators: [
        { type: 'requirement', file: 'src/math.ts', pattern: 'fibonacci', description: 'fibonacci function exists' },
        { type: 'requirement', file: 'src/math.test.ts', pattern: 'fibonacci', description: 'tests cover fibonacci' },
        { type: 'test', command: 'npm test' },
      ],
      judgeCriteria: ['clear step-by-step planning', 'correct implementation', 'good test coverage'],
      difficulty: 'hard',
    },
  ];
}