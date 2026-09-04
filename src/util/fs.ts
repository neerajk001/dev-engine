import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** Directories always excluded from project walks. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'out', 'build', '.git', 'coverage']);

/** Files always excluded from project walks. */
const IGNORED_FILES = new Set(['.env', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.wasm', '.o', '.obj',
  '.pyc', '.class', '.jar', '.map',
]);

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

function isIgnoredFile(name: string): boolean {
  return IGNORED_FILES.has(name) || name.endsWith('.env');
}

/** True when a path looks like a binary file (by extension). */
export function isBinaryPath(p: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(p).toLowerCase());
}

/**
 * Walk a project directory and return a text tree of its contents.
 * Skips ignored directories/files (node_modules, .git, .env, …).
 */
export function walkProjectTree(
  root: string,
  opts: { includeHidden?: boolean; maxEntries?: number } = {},
): string {
  const { includeHidden = false, maxEntries = 500 } = opts;
  const lines: string[] = [];
  let count = 0;
  let truncated = false;

  function walk(dir: string, prefix: string): void {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (truncated) return;
      const isDir = entry.isDirectory();
      const name = entry.name;
      if (!includeHidden && name.startsWith('.')) continue;
      if (isDir ? isIgnoredDir(name) : isIgnoredFile(name)) continue;
      if (count >= maxEntries) {
        truncated = true;
        lines.push(`${prefix}... [tree truncated at ${maxEntries} entries]`);
        return;
      }
      count += 1;
      lines.push(`${prefix}${isDir ? name + '/' : name}`);
      if (isDir) {
        walk(path.join(dir, name), `${prefix}  `);
      }
    }
  }

  walk(root, '');
  return lines.join('\n');
}

/** Number of non-ignored files under a directory (sync, bounded). */
export function countProjectFiles(root: string, max = 10_000): number {
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (count >= max) return count;
      const name = entry.name;
      if (name.startsWith('.') || isIgnoredDir(name) || isIgnoredFile(name)) continue;
      if (entry.isDirectory()) {
        stack.push(path.join(dir, name));
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }
  return count;
}

/** Read a text file, returning null when it is binary or unreadable. */
export function readTextFile(p: string): string | null {
  try {
    const buf = readFileSync(p);
    if (buf.includes(0)) return null; // NUL byte → binary
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

export interface ListEntry {
  name: string;
  isDirectory: boolean;
}

/** Immediate entries of a directory (files + dirs), or null on error. */
export function listDirEntries(p: string): ListEntry[] | null {
  try {
    const entries = readdirSync(p, { withFileTypes: true });
    return entries
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return null;
  }
}

/** True when a path exists (file or directory). */
export function pathExists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

export function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
