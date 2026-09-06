import type { Tool, ToolResult } from './types.js';
import { readFileTool } from './read-file.js';
import { listFilesTool } from './list-files.js';
import { searchFilesTool } from './search-files.js';
import { editFileTool } from './edit-file.js';
import { runCommandTool, type ApprovalGate } from './run-command.js';
import { gitStatusTool } from './git-status.js';
import { gitDiffTool } from './git-diff.js';
import { gitLogTool } from './git-log.js';
import { isGitRepo } from './git-shared.js';

export interface RegistryOptions {
  approve: ApprovalGate;
  /** Include read-only git tools when inside a repo (auto-detected). */
  git?: boolean;
}

/** Build the full set of agent tools bound to a workspace root. */
export function createToolRegistry(
  root: string,
  opts: RegistryOptions = { approve: { confirm: async () => false } },
): Tool[] {
  const base: Tool[] = [
    readFileTool(root),
    listFilesTool(root),
    searchFilesTool(root),
    editFileTool(root),
    runCommandTool(root, opts.approve),
  ];
  if (opts.git ?? true) {
    // Git tools are async-enabled only when the workspace is a repo, but
    // tool creation is sync; detect lazily inside each execute instead.
    base.push(gitStatusTool(root), gitDiffTool(root), gitLogTool(root));
  }
  return base;
}

export async function executeTool(
  tool: Tool,
  input: unknown,
): Promise<ToolResult> {
  return tool.execute(input);
}

export { isGitRepo };
