import type { LLMProvider } from '../llm/provider.js';
import { buildSystemPrompt } from '../llm/prompt.js';
import { buildProjectContext, renderProjectContext, validateRoot } from '../context/project.js';
import { createToolRegistry } from '../tools/registry.js';
import type { Tool } from '../tools/types.js';
import type { AgentEvent } from './events.js';
import { runAgentLoop } from './loop.js';
import type { AgentConfig, AgentResult } from './types.js';

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
    return runAgentLoop({
      provider: this.provider,
      tools: this.tools,
      systemPrompt: this.systemPrompt,
      projectContext: this.projectContext,
      task,
      config: {
        ...this.config,
        ...(onStatus !== undefined ? { onStatus } : {}),
        ...(onEvent !== undefined ? { onEvent } : {}),
      },
    });
  }
}
