import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectContext, renderOptimizerContext } from '../../src/optimizer/context.js';

// Tests run from the repo root (npm test), so resolve the fixture via cwd.
const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'project');

test('collectContext: assembles project summary and relevance', () => {
  const ctx = collectContext(FIXTURE, 'fix the multiply function in the math module');
  assert.equal(ctx.projectName, 'project');
  assert.match(ctx.fileTree, /math\.ts/);
  assert.ok(ctx.packageJson !== null, 'reads package.json');
  assert.ok(ctx.relevantFiles.includes('src/math.ts'), 'relevance finds math.ts');
});

test('renderOptimizerContext: compact block includes tree and relevant files', () => {
  const ctx = collectContext(FIXTURE, 'multiply');
  const rendered = renderOptimizerContext(ctx);
  assert.match(rendered, /Project: project/);
  assert.match(rendered, /File tree:/);
  assert.match(rendered, /src\/math\.ts/);
  assert.match(rendered, /Files likely relevant/);
});
