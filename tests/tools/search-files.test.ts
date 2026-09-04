import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchFilesTool } from '../../src/tools/search-files.js';

function makeProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'search-test-'));
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'a.ts'), 'const x = 1;\nfunction hello() {}\n');
  writeFileSync(path.join(root, 'src', 'b.js'), 'hello world\n');
  writeFileSync(path.join(root, 'src', 'note.md'), '# Hello\nno match here\n');
  mkdirSync(path.join(root, 'node_modules'));
  writeFileSync(path.join(root, 'node_modules', 'dep.js'), 'hello from dep\n');
  writeFileSync(path.join(root, '.hidden.ts'), 'const hidden = true;\n');
  return root;
}

test('search_files: finds matches across files', async () => {
  const root = makeProject();
  try {
    const tool = searchFilesTool(root);
    const res = await tool.execute({ pattern: 'hello' });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /src\/a\.ts:2/);
      assert.match(res.text, /src\/b\.js:1/);
      assert.doesNotMatch(res.text, /node_modules/);
      assert.doesNotMatch(res.text, /\.hidden/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('search_files: invalid pattern is an error', async () => {
  const root = makeProject();
  try {
    const tool = searchFilesTool(root);
    const res = await tool.execute({ pattern: '(' });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.recoverable, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('search_files: scoped to a path', async () => {
  const root = makeProject();
  try {
    const tool = searchFilesTool(root);
    const res = await tool.execute({ pattern: 'hello', path: 'src' });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /a\.ts/);
      assert.doesNotMatch(res.text, /node_modules/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('search_files: glob filter', async () => {
  const root = makeProject();
  try {
    const tool = searchFilesTool(root);
    const res = await tool.execute({ pattern: 'hello', glob: '*.md' });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /note\.md/);
      assert.doesNotMatch(res.text, /a\.ts/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('search_files: maxResults caps output', async () => {
  const root = makeProject();
  try {
    mkdirSync(path.join(root, 'many'));
    for (let i = 0; i < 5; i++) {
      writeFileSync(path.join(root, 'many', `f${i}.ts`), 'needle\n');
    }
    const tool = searchFilesTool(root);
    const res = await tool.execute({ pattern: 'needle', maxResults: 3 });
    assert.equal(res.ok, true);
    if (res.ok) {
      const lines = res.text.split('\n').filter(Boolean);
      assert.ok(lines.length <= 3, `expected <= 3 lines, got ${lines.length}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('search_files: no match', async () => {
  const root = makeProject();
  try {
    const tool = searchFilesTool(root);
    const res = await tool.execute({ pattern: 'zzz_nothing_zzz' });
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /no matches/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('search_files: rejects outside path', async () => {
  const root = makeProject();
  try {
    const tool = searchFilesTool(root);
    const res = await tool.execute({ pattern: 'x', path: '../outside' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
