import type { GenerateRequest, ModelResponse } from './types.js';

/** Abstraction over an LLM provider (ADR-008). */
export interface LLMProvider {
  /** Send a conversation and get a response, possibly with tool calls. */
  generate(request: GenerateRequest): Promise<ModelResponse>;
}
