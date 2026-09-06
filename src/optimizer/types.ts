/** Optimizer data model — mirrors PROMPT_OPTIMIZER.md's OptimizedTask. */

export interface OptimizedTask {
  intent: string;
  requirements: string[];
  constraints: string[];
  relevantFiles: string[];
  assumptions: string[];
  ambiguities: string[];
  acceptanceCriteria: string[];
}

export interface ClarificationQuestion {
  question: string;
  options: string[];
}

export interface OptimizerContext {
  projectName: string;
  fileTree: string;
  packageJson: string | null;
  readme: string | null;
  /** Project-relative paths of files likely relevant to the prompt. */
  relevantFiles: string[];
  /** Matched snippet per relevant file (basename/head lines). */
  fileSnippets: Record<string, string>;
}

export interface OptimizeSession {
  prompt: string;
  context: OptimizerContext;
  /** Present when intent analysis found ambiguity and asked for input. */
  clarification?: ClarificationQuestion;
  /** Answer chosen by the user, fed into task generation. */
  clarificationAnswer?: string;
}

export type OptimizeOutcome =
  | { kind: 'task'; task: OptimizedTask }
  | { kind: 'clarify'; question: ClarificationQuestion };

/** Raw JSON intent-analysis output from the LLM. */
export interface IntentAnalysis {
  intent: string;
  ambiguityLevel: 'clear' | 'ambiguous';
  question?: string;
  options?: string[];
}

/** Robustly parse a JSON object from an LLM response. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text.trim();
  // Strip a possible ```json fence.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function stringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  for (const item of v) {
    if (typeof item !== 'string') return null;
  }
  return v as string[];
}

/** Validate a parsed object has the OptimizedTask shape. */
export function parseOptimizedTask(obj: Record<string, unknown>): OptimizedTask | null {
  if (typeof obj.intent !== 'string' || obj.intent.trim() === '') return null;
  const requirements = stringArray(obj.requirements);
  const constraints = stringArray(obj.constraints);
  const relevantFiles = stringArray(obj.relevantFiles);
  const assumptions = stringArray(obj.assumptions);
  const ambiguities = stringArray(obj.ambiguities);
  const acceptanceCriteria = stringArray(obj.acceptanceCriteria);
  if (!requirements || !constraints || !relevantFiles || !assumptions || !ambiguities || !acceptanceCriteria) {
    return null;
  }
  return {
    intent: obj.intent,
    requirements,
    constraints,
    relevantFiles,
    assumptions,
    ambiguities,
    acceptanceCriteria,
  };
}

/** Validate a parsed object has the IntentAnalysis shape. */
export function parseIntentAnalysis(obj: Record<string, unknown>): IntentAnalysis | null {
  if (typeof obj.intent !== 'string' || obj.intent.trim() === '') return null;
  const level = obj.ambiguityLevel;
  if (level !== 'clear' && level !== 'ambiguous') return null;
  const question = typeof obj.question === 'string' ? obj.question : undefined;
  const options = stringArray(obj.options) ?? undefined;
  if (level === 'ambiguous' && (!question || question.trim() === '')) return null;
  if (level === 'ambiguous' && (!options || options.length === 0)) return null;
  return {
    intent: obj.intent,
    ambiguityLevel: level,
    ...(question !== undefined ? { question } : {}),
    ...(options !== undefined ? { options } : {}),
  };
}

/** Serialize an OptimizedTask into a plain task string for the coding agent. */
export function taskToString(task: OptimizedTask): string {
  const lines: string[] = [`Intent: ${task.intent}`];
  if (task.requirements.length > 0) {
    lines.push('', 'Requirements:', ...task.requirements.map((r) => `- ${r}`));
  }
  if (task.constraints.length > 0) {
    lines.push('', 'Constraints:', ...task.constraints.map((c) => `- ${c}`));
  }
  if (task.relevantFiles.length > 0) {
    lines.push('', 'Likely relevant files:', ...task.relevantFiles.map((f) => `- ${f}`));
  }
  if (task.assumptions.length > 0) {
    lines.push('', 'Assumptions:', ...task.assumptions.map((a) => `- ${a}`));
  }
  if (task.acceptanceCriteria.length > 0) {
    lines.push('', 'Acceptance criteria:', ...task.acceptanceCriteria.map((a) => `- ${a}`));
  }
  return lines.join('\n');
}
