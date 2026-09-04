import { statSync } from 'node:fs';
import { resolveProjectPath } from '../safety/paths.js';
import { isBinaryPath, readTextFile } from '../util/fs.js';
import type { Tool, ToolResult } from './types.js';

export const READ_MAX_CHARS = 40_000;

/** Read a text file inside the project workspace. */
export function readFileTool(root: string): Tool {
  return {
    name: 'read_file',
    description:
      'Read a text file from the project. Returns numbered lines. Use offset/limit to page through large files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file, relative to the project root or absolute inside it.' },
        offset: { type: 'number', description: '1-based line to start from. Negative counts back from the end.' },
        limit: { type: 'number', description: 'Maximum lines to return.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { path: relPath, offset, limit } = input as {
        path: string;
        offset?: number;
        limit?: number;
      };
      const resolved = resolveProjectPath(root, relPath);
      if (!resolved.ok) {
        return { ok: false, error: resolved.error, recoverable: true };
      }
      const abs = resolved.absolute;

      if (isBinaryPath(abs)) {
        return { ok: false, error: 'cannot read binary files', recoverable: true };
      }
      try {
        const stat = statSync(abs);
        if (stat.isDirectory()) {
          return { ok: false, error: `is a directory, not a file: ${relPath}`, recoverable: true };
        }
      } catch {
        return { ok: false, error: `file not found: ${relPath}`, recoverable: true };
      }

      const text = readTextFile(abs);
      if (text === null) {
        return { ok: false, error: 'file could not be read as text', recoverable: true };
      }

      // An empty file has zero lines (split('') would yield ['']).
      if (text === '') {
        return { ok: true, text: '(empty file)' };
      }
      const lines = text.split(/\r?\n/);
      // A trailing newline produces a phantom empty last element — drop it.
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      const total = lines.length;
      let start = offset ?? 1;
      let end = total;
      if (offset !== undefined && offset < 0) {
        // Negative offset counts back from the end: -1 = last line.
        start = Math.max(1, total + offset + 1);
        end = total;
      }
      if (limit !== undefined) {
        end = Math.min(total, start + limit - 1);
      }
      if (start < 1) start = 1;
      if (end < start) end = start;
      if (end > total) end = total;

      if (start > total) {
        return { ok: true, text: `(file has ${total} lines; offset ${offset} is past the end)` };
      }

      const slice = lines.slice(start - 1, end);
      const numbered = slice.map((line, i) => `${start + i}: ${line}`).join('\n');
      const truncated = end < total;
      const note = truncated
        ? `\n... [showing lines ${start}-${end} of ${total}. Read on with offset=${end + 1}.]`
        : '';

      let out = numbered + note;
      if (out.length > READ_MAX_CHARS) {
        const head = out.slice(0, Math.floor(READ_MAX_CHARS / 2));
        const tail = out.slice(out.length - Math.ceil(READ_MAX_CHARS / 2));
        out = `${head}\n... [read truncated at ${READ_MAX_CHARS} chars] ...\n${tail}`;
      }
      return { ok: true, text: out };
    },
  };
}
