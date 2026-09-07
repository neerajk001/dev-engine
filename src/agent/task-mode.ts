export type TaskMode = 'analyze' | 'plan' | 'implement' | 'verify';

export interface ClassifiedTask {
  mode: TaskMode;
  task: string;
  explicit: boolean;
}

/** Classify explicit commands first, then use conservative read-only heuristics. */
export function classifyTask(input: string): ClassifiedTask {
  const trimmed = input.trim();
  const explicit = /^(\/analyze|\/plan|\/implement|\/verify)\b/i.exec(trimmed);
  if (explicit) {
    const mode = explicit[1]!.slice(1).toLowerCase() as TaskMode;
    return { mode, task: trimmed.slice(explicit[0].length).trim(), explicit: true };
  }

  const lower = trimmed.toLowerCase();
  if (/^(what|why|which|can you suggest|suggest|evaluate|identify|list|explain|describe)\b/.test(lower)) {
    return { mode: 'analyze', task: trimmed, explicit: false };
  }
  if (/^(how should|how can|plan|design|propose)\b/.test(lower)) {
    return { mode: 'plan', task: trimmed, explicit: false };
  }
  if (/^(check|verify|test|does .* work|is .* working)\b/.test(lower)) {
    return { mode: 'verify', task: trimmed, explicit: false };
  }
  return { mode: 'implement', task: trimmed, explicit: false };
}

export function isReadOnlyMode(mode: TaskMode): boolean {
  return mode === 'analyze' || mode === 'plan' || mode === 'verify';
}
