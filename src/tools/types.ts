/** Shared tool types. A tool is a named, schema-described operation. */

export type ToolSchema = Record<string, unknown>;

export interface TextResult {
  text: string;
}

export interface ErrorResult {
  error: string;
  recoverable: boolean;
}

/** Success returns text; failure returns an error plus recoverability. */
export type ToolResult = ({ ok: true } & TextResult) | ({ ok: false } & ErrorResult);

export interface Tool {
  name: string;
  description: string;
  inputSchema: ToolSchema;
  execute(input: unknown): Promise<ToolResult>;
}
