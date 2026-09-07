import type { LLMProvider } from '../llm/provider.js';
import { buildSystemPrompt } from '../llm/prompt.js';
import { buildProjectContext, renderProjectContext, validateRoot } from '../context/project.js';
import { createToolRegistry } from '../tools/registry.js';
import type { Tool } from '../tools/types.js';
import type { AgentEvent } from './events.js';
import { runAgentLoop } from './loop.js';
import type { AgentConfig, AgentResult } from './types.js';
import { classifyTask, isReadOnlyMode } from './task-mode.js';
import { appendSessionTurn, loadSession, renderSessionContext } from '../session/store.js';

export interface AgentDeps {
  provider: LLMProvider;
  config: AgentConfig;
}

/** One agent session bound to a workspace root and an LLM provider. */
export class Agent {
  private readonly provider: LLMProvider;
  private readonly config: AgentConfig;
  private readonly tools: Tool[];
  private readonly systemPrompt: string;
  private readonly projectContext: string;

  constructor(deps: AgentDeps) {
    const rootError = validateRoot(deps.config.root);
    if (rootError) {
      throw new Error(rootError);
    }
    this.provider = deps.provider;
    this.config = deps.config;

    const ctx = buildProjectContext(deps.config.root);
    this.projectContext = renderProjectContext(ctx);
    this.tools = createToolRegistry(deps.config.root, {
      approve: { confirm: deps.config.onConfirmCommand },
    });
    this.systemPrompt = buildSystemPrompt({
      root: deps.config.root,
      projectName: deps.config.projectName,
      projectContext: this.projectContext,
      tools: this.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }

  /** Run a single natural-language task to completion. */
  async run(task: string): Promise<AgentResult> {
    return this.runWithHooks(task, undefined, undefined);
  }

  /** Run a task, forwarding live status to an optional hook. */
  async runWithHooks(
    task: string,
    onStatus?: (status: string) => void,
    onEvent?: (event: AgentEvent) => void,
  ): Promise<AgentResult> {
    const classified = classifyTask(task);
    if (classified.mode === 'implement' && this.config.onApproveTask !== undefined) {
      const approved = await this.config.onApproveTask({
        prompt: classified.task,
        mode: classified.mode,
        workspace: this.config.root,
      });
      if (!approved) {
        return {
          status: 'blocked',
          report: '[blocked]\nImplementation was cancelled before any files were changed.',
          iterations: 0,
          toolCallCount: 0,
          events: [],
          runId: 'cancelled',
          durationMs: 0,
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          taskMode: classified.mode,
          changedFiles: [],
          requirementVerified: false,
        };
      }
    }
    const session = loadSession(this.config.root);
    const availableTools = isReadOnlyMode(classified.mode)
      ? this.tools.filter((tool) => !['edit_file', 'run_command'].includes(tool.name))
      : this.tools;
    const systemPrompt = buildSystemPrompt({
      root: this.config.root,
      projectName: this.config.projectName,
      projectContext: this.projectContext,
      tools: availableTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      taskMode: classified.mode,
      sessionContext: renderSessionContext(session),
    });
    const result = await runAgentLoop({
      provider: this.provider,
      tools: availableTools,
      systemPrompt,
      projectContext: this.projectContext,
      task: classified.task,
      taskMode: classified.mode,
      sessionContext: renderSessionContext(session),
      config: {
        ...this.config,
        ...(onStatus !== undefined ? { onStatus } : {}),
        ...(onEvent !== undefined ? { onEvent } : {}),
      },
    });
    appendSessionTurn(this.config.root, {
      prompt: classified.task,
      mode: classified.mode,
      status: result.status,
      changedFiles: result.changedFiles ?? [],
      verification: result.events
        .filter((event) => event.type === 'verification_end')
        .map((event) => `${event.command}: ${event.ok ? 'passed' : 'failed'}`),
      summary: result.report,
    });
    return result;
  }
}
