import type { Tool, ToolResult } from './types.js';
import { readFileTool } from './read-file.js';
import { listFilesTool } from './list-files.js';
import { searchFilesTool } from './search-files.js';
import { editFileTool } from './edit-file.js';
import { runCommandTool, type ApprovalGate } from './run-command.js';

export interface RegistryOptions {
  approve: ApprovalGate;
}

/** Build the full set of agent tools bound to a workspace root. */
export function createToolRegistry(
  root: string,
  opts: RegistryOptions = { approve: { confirm: async () => false } },
): Tool[] {
  return [
    readFileTool(root),
    listFilesTool(root),
    searchFilesTool(root),
    editFileTool(root),
    runCommandTool(root, opts.approve),
  ];
}

export async function executeTool(
  tool: Tool,
  input: unknown,
): Promise<ToolResult> {
  return tool.execute(input);
}
