import type { Tool, ToolResult } from './types.js';
import { runGit } from './git-shared.js';

/** Show uncommitted diffs (read-only). */
export function gitDiffTool(root: string): Tool {
  return {
    name: 'git_diff',
    description: 'Show uncommitted changes (read-only). Pass a path to scope it.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Optional path to scope the diff to.' },
      },
      required: [],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { path } = input as { path?: string };
      const args = ['diff', '--no-color'];
      if (path) args.push('--', path);
      const r = await runGit(root, args);
      return r.ok
        ? { ok: true, text: r.text || '(no uncommitted changes)' }
        : { ok: false, error: r.text, recoverable: true };
    },
  };
}
