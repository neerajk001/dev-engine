import type { Tool, ToolResult } from './types.js';
import { runGit } from './git-shared.js';

/** Report working-tree status (read-only). */
export function gitStatusTool(root: string): Tool {
  return {
    name: 'git_status',
    description: 'Show the working tree status (read-only). Returns changed/untracked files.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    async execute(): Promise<ToolResult> {
      const r = await runGit(root, ['status', '--short']);
      return r.ok
        ? { ok: true, text: r.text || '(clean working tree)' }
        : { ok: false, error: r.text, recoverable: true };
    },
  };
}
