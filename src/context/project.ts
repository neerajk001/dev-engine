import path from 'node:path';
import { readFileSync } from 'node:fs';
import { countProjectFiles, walkProjectTree, isDirectory } from '../util/fs.js';
import { truncateToTokens } from '../util/format.js';

export interface ProjectContext {
  root: string;
  name: string;
  tree: string;
  packageJson: string | null;
  readme: string | null;
  fileCount: number;
}

/**
 * Build a bounded text context describing a project: name, file tree,
 * package.json scripts, and a README excerpt. Used as system-prompt fodder.
 */
export function buildProjectContext(root: string): ProjectContext {
  const name = path.basename(root);
  const tree = walkProjectTree(root, { maxEntries: 300 });
  const fileCount = countProjectFiles(root);
  const packageJson = readOptional(root, 'package.json', 2000);
  const readme = readOptional(root, 'README.md', 1500);

  return { root, name, tree, packageJson, readme, fileCount };
}

function readOptional(root: string, file: string, maxTokens: number): string | null {
  const p = path.join(root, file);
  try {
    const text = readFileSync(p, 'utf8');
    return truncateToTokens(text, maxTokens);
  } catch {
    return null;
  }
}

/** Render the project context into a compact string for the system prompt. */
export function renderProjectContext(ctx: ProjectContext): string {
  const parts: string[] = [];
  parts.push(`Project name: ${ctx.name}`);
  parts.push(`Source files (approx): ${ctx.fileCount}`);
  if (ctx.packageJson) {
    parts.push(`\npackage.json:\n${ctx.packageJson}`);
  }
  if (ctx.readme) {
    parts.push(`\nREADME excerpt:\n${ctx.readme}`);
  }
  parts.push(`\nFile tree:\n${ctx.tree}`);
  return truncateToTokens(parts.join('\n\n'), 4000);
}

/** Validate that the root exists and is a directory. */
export function validateRoot(root: string): string | null {
  if (!isDirectory(root)) {
    return `workspace is not a directory: ${root}`;
  }
  return null;
}
