import { readFileSync, writeFileSync } from 'node:fs';
import { resolveProjectPath } from '../safety/paths.js';
import { isBinaryPath } from '../util/fs.js';
import type { Tool, ToolResult } from './types.js';

/** Edit a file with an anchored text replacement. */
export function editFileTool(root: string): Tool {
  return {
    name: 'edit_file',
    description:
      'Replace text in a file. oldText must appear exactly once in the current file content. Returns a summary of the change. Use read_file first.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to edit, relative to the project root.' },
        oldText: { type: 'string', description: 'Exact text to find and replace.' },
        newText: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'oldText', 'newText'],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { path: relPath, oldText, newText } = input as {
        path: string;
        oldText: string;
        newText: string;
      };

      if (typeof oldText !== 'string' || oldText.length === 0) {
        return { ok: false, error: 'oldText must be a non-empty string', recoverable: true };
      }
      if (typeof newText !== 'string') {
        return { ok: false, error: 'newText must be a string', recoverable: true };
      }

      const resolved = resolveProjectPath(root, relPath);
      if (!resolved.ok) {
        return { ok: false, error: resolved.error, recoverable: true };
      }
      const abs = resolved.absolute;

      if (isBinaryPath(abs)) {
        return { ok: false, error: 'cannot edit binary files', recoverable: true };
      }
      let original: string;
      try {
        original = readFileSync(abs, 'utf8');
      } catch {
        return { ok: false, error: `file not found: ${relPath}`, recoverable: true };
      }

      const idx = original.indexOf(oldText);
      if (idx === -1) {
        return {
          ok: false,
          error: 'oldText not found in the file. Re-read the file and match the content exactly.',
          recoverable: true,
        };
      }
      if (original.indexOf(oldText, idx + 1) !== -1) {
        return {
          ok: false,
          error: 'oldText matches more than once. Include more surrounding context to make it unique.',
          recoverable: true,
        };
      }

      const updated = original.slice(0, idx) + newText + original.slice(idx + oldText.length);
      try {
        writeFileSync(abs, updated, 'utf8');
      } catch {
        return { ok: false, error: 'failed to write the file', recoverable: true };
      }

      const beforeLine = original.slice(0, idx).split('\n').length;
      const linesChanged = newText.split('\n').length + oldText.split('\n').length;
      return {
        ok: true,
        text: `edited ${relPath} (replacement at line ${beforeLine}, ${linesChanged} lines affected)`,
      };
    },
  };
}
