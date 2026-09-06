import type { LLMProvider } from '../llm/provider.js';
import type { ProviderMessage } from '../llm/types.js';
import { collectContext, renderOptimizerContext } from './context.js';
import {
  parseIntentAnalysis,
  parseJsonObject,
  parseOptimizedTask,
} from './types.js';
import type {
  ClarificationQuestion,
  OptimizeOutcome,
  OptimizeSession,
  OptimizedTask,
} from './types.js';

const INTENT_SYSTEM = `You are the intent analyzer of a prompt optimizer for a coding agent.

Given the user's request and the project context, decide whether the request is clear enough to implement, or whether one focused clarifying question would materially change what gets built.

Output JSON with this exact shape:
{"intent": "...", "ambiguityLevel": "clear" | "ambiguous", "question": "...", "options": ["...", ...]}

Rules:
- intent: a one-sentence restatement of what the user wants.
- "ambiguous" only when the request could mean materially different work AND the project context does not already disambiguate it.
- When ambiguous, ask ONE question with 2-5 short options that resolve the ambiguity. Do not ask about things the repository already makes clear (language, framework, file locations).
- Never invent requirements. Preserve the user's actual intent; do not expand scope.`;

const TASK_SYSTEM = `You are the task generator of a prompt optimizer for a coding agent.

Convert the user's request into a precise, project-aware implementation task that a coding agent can execute without further clarification.

Output JSON with this exact shape:
{"intent": "...", "requirements": ["..."], "constraints": ["..."], "relevantFiles": ["..."], "assumptions": ["..."], "ambiguities": ["..."], "acceptanceCriteria": ["..."]}

Rules:
- requirements: explicit, minimal, actionable. Preserve the user's actual intent — never expand scope into unrelated work.
- constraints: things that must NOT change (existing architecture, auth flow, conventions, dependencies), plus any user-stated limits.
- relevantFiles: project-relative paths from the context most likely involved. Use only files that plausibly exist.
- assumptions: anything you are assuming but the user did not state. NEVER silently treat an assumption as a requirement.
- ambiguities: what remains uncertain after your best interpretation (empty if none remain).
- acceptanceCriteria: concrete, verifiable outcomes (e.g. "tests pass", "loading state appears"). A criterion like "tests pass" should only appear when the project has tests.
- Prefer the smallest reasonable scope.`;

export interface OptimizeEngineDeps {
  provider: LLMProvider;
  root: string;
}

/** Structured prompt optimizer: intent → ambiguity → task. */
export class OptimizeEngine {
  private readonly provider: LLMProvider;
  private readonly root: string;

  constructor(deps: OptimizeEngineDeps) {
    this.provider = deps.provider;
    this.root = deps.root;
  }

  /** Build a session with project context for a user prompt. */
  collect(prompt: string): OptimizeSession {
    const context = collectContext(this.root, prompt);
    return { prompt, context };
  }

  /**
   * Run the pipeline for a session. When the intent is ambiguous the first
   * call returns { kind: 'clarify' }; pass the user's answer back in the
   * session and call again to get the task.
   */
  async optimize(session: OptimizeSession): Promise<OptimizeOutcome> {
    if (session.clarificationAnswer === undefined && session.clarification === undefined) {
      // First pass: analyze intent.
      const analysis = await this.analyzeIntent(session);
      if (analysis === null) {
        throw new Error('optimizer: intent analysis returned unparseable output');
      }
      if (analysis.ambiguityLevel === 'ambiguous' && analysis.question) {
        const question: ClarificationQuestion = {
          question: analysis.question,
          options: analysis.options ?? [],
        };
        return { kind: 'clarify', question };
      }
      const task = await this.generateTask(session, analysis.intent, []);
      return { kind: 'task', task };
    }

    // Second pass: the user answered the clarifying question.
    const answer = session.clarificationAnswer ?? '';
    const task = await this.generateTask(session, session.prompt, [answer]);
    return { kind: 'task', task };
  }

  private async analyzeIntent(session: OptimizeSession) {
    const contextText = renderOptimizerContext(session.context);
    const user = [
      `User request:\n${session.prompt}`,
      '',
      'Project context:',
      contextText,
      '',
      'Analyze intent and output JSON.',
    ].join('\n');
    const raw = await this.askJson([
      { role: 'system', content: INTENT_SYSTEM },
      { role: 'user', content: user },
    ]);
    return parseIntentAnalysis(raw);
  }

  private async generateTask(
    session: OptimizeSession,
    intent: string,
    extraContext: string[],
  ): Promise<OptimizedTask> {
    const contextText = renderOptimizerContext(session.context);
    const clarificationNote =
      extraContext.length > 0
        ? `\nUser clarification on the request:\n${extraContext.join('\n')}`
        : '';
    const user = [
      `User request:\n${session.prompt}`,
      '',
      `Analyzed intent:\n${intent}`,
      clarificationNote,
      '',
      'Project context:',
      contextText,
      '',
      'Generate the optimized implementation task as JSON.',
    ].join('\n');
    const raw = await this.askJson([
      { role: 'system', content: TASK_SYSTEM },
      { role: 'user', content: user },
    ]);
    const task = parseOptimizedTask(raw);
    if (task === null) {
      throw new Error('optimizer: task generation returned unparseable output');
    }
    return task;
  }

  /** Ask the provider for JSON, parse, and normalize the object. */
  private async askJson(messages: ProviderMessage[]): Promise<Record<string, unknown>> {
    const response = await this.provider.generate({
      messages,
      tools: [],
      json: true,
    });
    const parsed = parseJsonObject(response.content ?? '');
    if (parsed === null) {
      throw new Error('optimizer: model did not return valid JSON');
    }
    return parsed;
  }
}
