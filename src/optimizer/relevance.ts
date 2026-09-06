import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage']);

/** Words too common to be useful as relevance keywords. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'make', 'better', 'fix', 'add', 'improve', 'change', 'update', 'please', 'can',
  'you', 'i', 'we', 'it', 'this', 'that', 'there', 'is', 'are', 'was', 'were',
  'be', 'been', 'do', 'does', 'did', 'have', 'has', 'had', 'my', 'our', 'your',
  'at', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'so', 'just',
  'like', 'would', 'should', 'could', 'help', 'need', 'want', 'let', 'us', 'all',
]);

function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s_-]/g, ' ');
  return cleaned.split(/[\s_-]+/).filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Deterministic keyword scan for files likely relevant to a prompt. */
export function findRelevantFiles(root: string, prompt: string, max = 10): string[] {
  const keywords = tokenize(prompt);
  if (keywords.length === 0) return [];

  const scored = new Map<string, number>();
  const headCache = new Map<string, string>();
  const files: string[] = [];

  const getHead = (p: string): string => {
    const cached = headCache.get(p);
    if (cached !== undefined) return cached;
    // Read only the first chunk of the file.
    let head = '';
    try {
      const buf = readFileChunk(p);
      head = buf;
    } catch {
      head = '';
    }
    headCache.set(p, head);
    return head;
  };

  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  };

  walk(root);
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (rel.endsWith('.env')) continue;
    const head = getHead(file);
    const haystack = `${path.basename(file)}\n${head}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (haystack.includes(kw)) {
        // Keywords in the filename count double.
        const inName = path.basename(file).toLowerCase().includes(kw) ? 2 : 1;
        score += inName;
      }
    }
    if (score > 0) {
      scored.set(rel, score);
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([rel]) => rel);
}

function readFileChunk(p: string): string {
  const stat = statSync(p);
  if (!stat.isFile() || stat.size === 0) return '';
  const fd = openSync(p, 'r');
  try {
    const len = Math.min(stat.size, 3000);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, 0);
    return buf.toString('utf8').split('\n').slice(0, 40).join('\n');
  } finally {
    closeSync(fd);
  }
}

/** Return a short snippet of a file around the first keyword match. */
export function snippetFor(
  root: string,
  relPath: string,
  prompt: string,
  maxLines = 6,
): string {
  const keywords = tokenize(prompt);
  const abs = path.join(root, relPath);
  let text = '';
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return '';
  }
  const lines = text.split(/\r?\n/);
  const lower = lines.map((l) => l.toLowerCase());
  let start = 0;
  for (const kw of keywords) {
    const idx = lower.findIndex((l) => l.includes(kw));
    if (idx !== -1) {
      start = Math.max(0, idx - 1);
      break;
    }
  }
  return lines.slice(start, start + maxLines).join('\n');
}
