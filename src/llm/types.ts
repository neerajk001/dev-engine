/** Provider-agnostic message and response types. */

export type ProviderRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ProviderToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments string from the model. */
  arguments: string;
}

export interface ProviderMessage {
  role: ProviderRole;
  /** Assistant tool_call message may have null content. */
  content: string | null;
  toolCalls?: ProviderToolCall[];
  /** tool result message role 'tool' — id of the call it answers. */
  toolCallId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface GenerateRequest {
  messages: ProviderMessage[];
  tools: ToolDefinition[];
  /** Ask the model to respond with a single JSON object (no tool calls). */
  json?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelResponse {
  stopReason: 'tool_calls' | 'end_turn';
  /** Assistant text content, if any. */
  content: string | null;
  toolCalls: ProviderToolCall[];
  /** Token usage from this request, if available. */
  tokenUsage?: TokenUsage;
}
