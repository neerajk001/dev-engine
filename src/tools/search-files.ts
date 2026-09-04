import { readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveProjectPath } from '../safety/paths.js';
import { isBinaryPath, readTextFile } from '../util/fs.js';
import type { Tool, ToolResult } from './types.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage']);

/** Search file contents with a regular expression. */
export function searchFilesTool(root: string): Tool {
  return {
    name: 'search_files',
    description:
      'Search file contents in the project with a regular expression. Returns matching files and line numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regular expression to search for.' },
        path: { type: 'string', description: 'Subdirectory to search. Defaults to the project root.' },
        glob: { type: 'string', description: 'Filename glob filter, e.g. "*.ts".' },
        caseSensitive: { type: 'boolean', description: 'Case-sensitive match (default false).' },
        maxResults: { type: 'number', description: 'Maximum matches to return (default 200).' },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { pattern, path: relPath, glob, caseSensitive, maxResults } = input as {
        pattern: string;
        path?: string;
        glob?: string;
        caseSensitive?: boolean;
        maxResults?: number;
      };

      let re: RegExp;
      try {
        re = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      } catch {
        return { ok: false, error: `invalid regular expression: ${pattern}`, recoverable: true };
      }

      const resolved = relPath
        ? resolveProjectPath(root, relPath)
        : { ok: true as const, absolute: root };
      if (!resolved.ok) {
        return { ok: false, error: resolved.error, recoverable: true };
      }
      const abs = resolved.absolute;

      const limit = maxResults ?? 200;
      const matches: string[] = [];
      let count = 0;

      function fileMatchesGlob(p: string): boolean {
        if (!glob) return true;
        const rel = path.relative(root, p).split(path.sep).join('/');
        const base = path.basename(p);
        return simpleGlobMatch(glob, rel) || simpleGlobMatch(glob, base);
      }

      function walk(dir: string): void {
        if (count >= limit) return;
        let entries;
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (count >= limit) return;
          const name = entry.name;
          if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
          const full = path.join(dir, name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile() && fileMatchesGlob(full)) {
            if (isBinaryPath(full)) continue;
            const text = readTextFile(full);
            if (text === null) continue;
            for (const [i, line] of text.split(/\r?\n/).entries()) {
              if (count >= limit) return;
              re.lastIndex = 0;
              if (re.test(line)) {
                const relPathOut = path.relative(root, full).split(path.sep).join('/');
                matches.push(`${relPathOut}:${i + 1}: ${line.trim().slice(0, 200)}`);
                count += 1;
              }
            }
          }
        }
      }

      walk(abs);
      return {
        ok: true,
        text:
          matches.length > 0
            ? matches.join('\n')
            : '(no matches)',
      };
    },
  };
}

/** Minimal glob: `*` (within a segment), `**` (across segments), `?`, `{a,b}`. */
export function simpleGlobMatch(glob: string, value: string): boolean {
  // Convert glob to a regular expression.
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i]!;
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 2;
        if (glob[i] === '/') i += 1; // swallow trailing slash of **/
        continue;
      }
      re += '[^/]*';
    } else if (ch === '?') {
      re += '[^/]';
    } else if (ch === '{') {
      const end = glob.indexOf('}', i);
      if (end !== -1) {
        const alts = glob.slice(i + 1, end).split(',');
        re += `(?:${alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
        i = end;
      } else {
        re += '\\{';
      }
    } else if ('.[]\\^$+?()|'.includes(ch)) {
      re += `\\${ch}`;
    } else {
      re += ch;
    }
    i += 1;
  }
  return new RegExp(`^${re}$`).test(value);
}
