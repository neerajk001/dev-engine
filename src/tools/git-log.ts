import type { Tool, ToolResult } from './types.js';
import { runGit } from './git-shared.js';

/** Show recent commit history (read-only). */
export function gitLogTool(root: string): Tool {
  return {
    name: 'git_log',
    description: 'Show recent commit history (read-only), newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of commits to show (default 10).' },
      },
      required: [],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { count } = input as { count?: number };
      const n = Math.min(Math.max(count ?? 10, 1), 50);
      const r = await runGit(root, ['log', '--oneline', `-${n}`]);
      return r.ok
        ? { ok: true, text: r.text || '(no commits yet)' }
        : { ok: false, error: r.text, recoverable: true };
    },
  };
}
