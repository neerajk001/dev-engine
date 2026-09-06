import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { LLMProvider } from './provider.js';
import type { GenerateRequest, ModelResponse } from './types.js';

export interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  /** Request timeout in ms. */
  timeoutMs?: number;
}

/** OpenAI chat-completions provider with tool calling. */
export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: OpenAIProviderOptions) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs ?? 300_000;
  }

  async generate(request: GenerateRequest): Promise<ModelResponse> {
    const messages = toOpenAIMessages(request.messages);
    const tools = request.tools.map(toOpenAITool);

    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
        ...(request.json === true
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      },
      { timeout: this.timeoutMs },
    );

    const choice = completion.choices[0];
    if (!choice) {
      throw new Error('LLM returned no choices');
    }
    const msg = choice.message;
    const finish = choice.finish_reason;

    const toolCalls = (msg.tool_calls ?? []).flatMap((tc) => {
      // We only register `function` tools, so narrow the union variant.
      if (tc.type === 'function') {
        return [{
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments ?? '{}',
        }];
      }
      return [];
    });

    const hasToolCalls = toolCalls.length > 0;
    const tokenUsage = completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined;
    return {
      stopReason: hasToolCalls ? 'tool_calls' : 'end_turn',
      content: msg.content,
      toolCalls,
      ...(tokenUsage !== undefined ? { tokenUsage } : {}),
    };
  }
}

function toOpenAITool(tool: { name: string; description: string; inputSchema: Record<string, unknown> }): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  };
}

function toOpenAIMessages(
  messages: GenerateRequest['messages'],
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [];
  for (const m of messages) {
    switch (m.role) {
      case 'system':
        out.push({ role: 'system', content: m.content ?? '' });
        break;
      case 'user':
        out.push({ role: 'user', content: m.content ?? '' });
        break;
      case 'assistant':
        out.push({
          role: 'assistant',
          content: m.content,
          ...(m.toolCalls && m.toolCalls.length > 0
            ? {
                tool_calls: m.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: tc.arguments },
                })),
              }
            : {}),
        });
        break;
      case 'tool':
        out.push({
          role: 'tool',
          tool_call_id: m.toolCallId ?? '',
          content: m.content ?? '',
        });
        break;
    }
  }
  return out;
}
