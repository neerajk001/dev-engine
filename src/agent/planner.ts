import type { LLMProvider } from '../llm/provider.js';
import { parseJsonObject } from '../optimizer/types.js';

export interface ImplementationPlan {
  steps: string[];
  verification: string[];
  relevantFiles: string[];
}

const PLAN_SYSTEM = `You are the implementation planner for a coding agent.

Given the user's task and the project context, produce a short, concrete implementation plan the agent will execute.

Output JSON with this exact shape:
{"steps": ["..."], "verification": ["..."], "relevantFiles": ["..."]}

Rules:
- steps: ordered, actionable, minimal. One step per logical change. Do not expand scope beyond the task.
- verification: the commands/checks that prove the task is done (e.g. "npm test", "tsc --noEmit").
- relevantFiles: project-relative paths most likely involved. Only files that plausibly exist.
- Keep the plan small — this is a plan, not the implementation.`;

/** Parse a plan from model JSON output; null when malformed. */
export function parseImplementationPlan(
  obj: Record<string, unknown>,
): ImplementationPlan | null {
  const steps = stringArray(obj.steps);
  const verification = stringArray(obj.verification);
  const relevantFiles = stringArray(obj.relevantFiles);
  if (!steps || steps.length === 0 || !verification || !relevantFiles) return null;
  return { steps, verification, relevantFiles };
}

function stringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  for (const item of v) {
    if (typeof item !== 'string') return null;
  }
  return v as string[];
}

/** Generate an implementation plan from a task + project context. */
export async function generatePlan(
  provider: LLMProvider,
  task: string,
  projectContext: string,
): Promise<ImplementationPlan> {
  const response = await provider.generate({
    messages: [
      { role: 'system', content: PLAN_SYSTEM },
      {
        role: 'user',
        content: `Task:\n${task}\n\nProject context:\n${projectContext}\n\nProduce the implementation plan as JSON.`,
      },
    ],
    tools: [],
    json: true,
  });
  const parsed = parseJsonObject(response.content ?? '');
  const plan = parsed === null ? null : parseImplementationPlan(parsed);
  if (plan === null) {
    throw new Error('planner: model did not return a valid implementation plan');
  }
  return plan;
}
