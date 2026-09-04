import path from 'node:path';
import { resolveProjectPath } from '../safety/paths.js';
import { isDirectory, listDirEntries } from '../util/fs.js';
import type { Tool, ToolResult } from './types.js';

/** List files in the project workspace as an indented tree. */
export function listFilesTool(root: string): Tool {
  return {
    name: 'list_files',
    description:
      'List files and directories in the project. Returns an indented tree. Use path to scope to a subdirectory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Subdirectory to list. Defaults to the project root.' },
        depth: { type: 'number', description: 'Maximum recursion depth (default unlimited).' },
        includeHidden: { type: 'boolean', description: 'Include dotfiles and dot-directories (default false).' },
      },
      required: [],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { path: relPath, depth, includeHidden } = input as {
        path?: string;
        depth?: number;
        includeHidden?: boolean;
      };

      const resolved = relPath
        ? resolveProjectPath(root, relPath)
        : { ok: true as const, absolute: root };
      if (!resolved.ok) {
        return { ok: false, error: resolved.error, recoverable: true };
      }
      const abs = resolved.absolute;
      if (!isDirectory(abs)) {
        return { ok: false, error: `not a directory: ${relPath ?? '.'}`, recoverable: true };
      }

      const maxDepth = depth ?? 20;
      const maxEntries = 500;
      const lines: string[] = [];
      let count = 0;
      let truncated = false;

      function walk(dir: string, prefix: string, currentDepth: number): void {
        if (truncated) return;
        const entries = listDirEntries(dir);
        if (entries === null) return;
        for (const entry of entries) {
          if (truncated) return;
          const name = entry.name;
          if (!includeHidden && name.startsWith('.')) continue;
          if (entry.isDirectory && (name === 'node_modules' || name === '.git' || name === 'dist')) {
            continue;
          }
          if (count >= maxEntries) {
            truncated = true;
            lines.push(`${prefix}... [listing truncated at ${maxEntries} entries]`);
            return;
          }
          count += 1;
          lines.push(`${prefix}${entry.isDirectory ? `${name}/` : name}`);
          if (entry.isDirectory && currentDepth < maxDepth) {
            walk(path.join(dir, name), `${prefix}  `, currentDepth + 1);
          }
        }
      }

      walk(abs, '', 0);
      return { ok: true, text: lines.length > 0 ? lines.join('\n') : '(empty directory)' };
    },
  };
}
