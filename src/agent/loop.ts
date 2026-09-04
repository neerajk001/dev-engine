import type { LLMProvider } from '../llm/provider.js';
import type { ProviderMessage } from '../llm/types.js';
import { buildFormatNudge } from '../llm/prompt.js';
import type { Tool } from '../tools/types.js';
import { executeTool } from '../tools/registry.js';
import type { AgentConfig, AgentResult, AgentStatus } from './types.js';

const FINAL_PREFIXES: Record<AgentStatus, string> = {
  done: '[done]',
  failed: '[failed]',
  blocked: '[blocked]',
};

function detectStatus(text: string): AgentStatus | null {
  const firstLine = text.split('\n', 1)[0]?.trim() ?? '';
  for (const [status, prefix] of Object.entries(FINAL_PREFIXES)) {
    if (firstLine.startsWith(prefix)) {
      return status as AgentStatus;
    }
  }
  return null;
}

export interface RunAgentInput {
  provider: LLMProvider;
  tools: Tool[];
  /** System prompt already includes project context. */
  systemPrompt: string;
  task: string;
  config: AgentConfig;
}

/**
 * Run the agent loop: ask the model, execute any tool calls, repeat until
 * the model produces a final report or the iteration limit is hit.
 */
export async function runAgentLoop(input: RunAgentInput): Promise<AgentResult> {
  const { provider, tools, systemPrompt, task, config } = input;

  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  const messages: ProviderMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ];

  let iterations = 0;
  let toolCallCount = 0;
  let formatNudged = false;
  let lastAssistantText = '';

  config.onStatus?.('thinking…');

  while (iterations < config.maxIterations) {
    iterations += 1;

    const response = await provider.generate({ messages, tools: toolDefs });
    messages.push({
      role: 'assistant',
      content: response.content,
      ...(response.toolCalls.length > 0
        ? { toolCalls: response.toolCalls }
        : {}),
    });
    lastAssistantText = response.content ?? '';

    if (response.stopReason === 'tool_calls' && response.toolCalls.length > 0) {
      toolCallCount += 1;
      config.onStatus?.(`tool: ${response.toolCalls.map((t) => t.name).join(', ')}`);
      for (const call of response.toolCalls) {
        const tool = toolByName.get(call.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            content: `unknown tool: ${call.name}`,
            toolCallId: call.id,
          });
          continue;
        }
        let resultText: string;
        let parseError: string | null = null;
        let parsed: unknown;
        try {
          parsed = JSON.parse(call.arguments);
        } catch {
          parseError = `invalid JSON arguments: ${call.arguments}`;
        }
        if (parseError !== null) {
          messages.push({
            role: 'tool',
            content: parseError,
            toolCallId: call.id,
          });
          continue;
        }
        const result = await executeTool(tool, parsed);
        if (result.ok) {
          resultText = result.text;
        } else {
          const recoverableNote = result.recoverable
            ? ''
            : '\n(Not recoverable: this failure cannot be fixed by further tool calls.)';
          resultText = `Error: ${result.error}${recoverableNote}`;
          if (!result.recoverable) {
            // A non-recoverable failure (e.g. user denied a command) ends the run.
            const report = [
              '[blocked]',
              `A tool call could not complete: ${result.error}`,
            ].join('\n');
            return {
              status: 'blocked',
              report,
              iterations,
              toolCallCount,
              terminationReason: `non-recoverable tool failure in ${call.name}`,
            };
          }
        }
        messages.push({
          role: 'tool',
          content: resultText,
          toolCallId: call.id,
        });
      }
      continue;
    }

    // end_turn: model produced a final answer — check the report format.
    const status = detectStatus(lastAssistantText);
    if (status !== null) {
      return {
        status,
        report: lastAssistantText,
        iterations,
        toolCallCount,
      };
    }
    if (!formatNudged) {
      // Ask once for a properly formatted final report.
      formatNudged = true;
      messages.push({ role: 'user', content: buildFormatNudge() });
      continue;
    }
    return {
      status: 'blocked',
      report: lastAssistantText,
      iterations,
      toolCallCount,
      terminationReason: 'model did not produce a [done]/[failed]/[blocked] report',
    };
  }

  return {
    status: 'blocked',
    report: lastAssistantText,
    iterations,
    toolCallCount,
    terminationReason: `iteration limit exceeded (${config.maxIterations})`,
  };
}
