import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRelevantFiles, snippetFor } from '../../src/optimizer/relevance.js';

// Tests run from the repo root (npm test), so resolve the fixture via cwd.
const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'project');

test('findRelevantFiles: finds a file by its content keyword', () => {
  const hits = findRelevantFiles(FIXTURE, 'multiply function is wrong');
  assert.ok(hits.includes('src/math.ts'), `expected src/math.ts in ${hits}`);
});

test('findRelevantFiles: matches filename keywords', () => {
  const hits = findRelevantFiles(FIXTURE, 'package scripts');
  assert.ok(hits.includes('package.json'), `expected package.json in ${hits}`);
});

test('findRelevantFiles: skips ignored directories', () => {
  const hits = findRelevantFiles(FIXTURE, 'node_modules dependency');
  assert.ok(!hits.some((h) => h.includes('node_modules')));
});

test('findRelevantFiles: caps results and is stable', () => {
  const hits = findRelevantFiles(FIXTURE, 'math add multiply test');
  assert.ok(hits.length <= 10);
  // Deterministic ordering.
  assert.deepEqual(hits, findRelevantFiles(FIXTURE, 'math add multiply test'));
});

test('findRelevantFiles: empty prompt yields nothing', () => {
  assert.deepEqual(findRelevantFiles(FIXTURE, ''), []);
  assert.deepEqual(findRelevantFiles(FIXTURE, 'the and or a'), []);
});

test('snippetFor: returns lines near the keyword', () => {
  const snip = snippetFor(FIXTURE, 'src/math.ts', 'multiply');
  assert.match(snip, /multiply/);
});
