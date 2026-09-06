import { buildProjectContext } from '../context/project.js';
import type { ProjectContext } from '../context/project.js';
import { findRelevantFiles, snippetFor } from './relevance.js';
import type { OptimizerContext } from './types.js';

/**
 * Collect bounded project context for the optimizer: the project summary,
 * tree, package.json, README, and files relevant to the user's prompt.
 */
export function collectContext(root: string, prompt: string): OptimizerContext {
  const project: ProjectContext = buildProjectContext(root);

  const relevantFiles = findRelevantFiles(root, prompt);
  const fileSnippets: Record<string, string> = {};
  for (const rel of relevantFiles) {
    const snip = snippetFor(root, rel, prompt);
    if (snip.trim() !== '') {
      fileSnippets[rel] = snip;
    }
  }

  return {
    projectName: project.name,
    fileTree: project.tree,
    packageJson: project.packageJson,
    readme: project.readme,
    relevantFiles,
    fileSnippets,
  };
}

/** Render the optimizer context into a compact prompt block. */
export function renderOptimizerContext(ctx: OptimizerContext): string {
  const parts: string[] = [`Project: ${ctx.projectName}`];
  parts.push(`\nFile tree:\n${ctx.fileTree}`);
  if (ctx.packageJson) {
    parts.push(`\npackage.json:\n${ctx.packageJson}`);
  }
  if (ctx.readme) {
    parts.push(`\nREADME excerpt:\n${ctx.readme}`);
  }
  if (ctx.relevantFiles.length > 0) {
    parts.push('\nFiles likely relevant to the request:');
    for (const rel of ctx.relevantFiles) {
      const snip = ctx.fileSnippets[rel];
      parts.push(`- ${rel}`);
      if (snip) {
        parts.push(indent(snip, '    '));
      }
    }
  }
  return parts.join('\n');
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((l) => `${prefix}${l}`)
    .join('\n');
}
