import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listFilesTool } from '../../src/tools/list-files.js';

function makeProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'list-test-'));
  mkdirSync(path.join(root, 'src'));
  mkdirSync(path.join(root, 'node_modules'));
  writeFileSync(path.join(root, 'package.json'), '{}');
  writeFileSync(path.join(root, 'src', 'a.ts'), 'x');
  writeFileSync(path.join(root, 'src', 'b.ts'), 'y');
  writeFileSync(path.join(root, 'node_modules', 'dep.js'), 'z');
  writeFileSync(path.join(root, '.hidden'), 'secret');
  return root;
}

test('list_files: root listing excludes ignored dirs and hidden files', async () => {
  const root = makeProject();
  try {
    const tool = listFilesTool(root);
    const res = await tool.execute({});
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /package\.json/);
      assert.match(res.text, /src\//);
      assert.doesNotMatch(res.text, /node_modules/);
      assert.doesNotMatch(res.text, /\.hidden/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('list_files: includeHidden shows dotfiles', async () => {
  const root = makeProject();
  try {
    const tool = listFilesTool(root);
    const res = await tool.execute({ includeHidden: true });
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /\.hidden/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('list_files: depth 0 shows root entries only', async () => {
  const root = makeProject();
  try {
    const tool = listFilesTool(root);
    const res = await tool.execute({ depth: 0 });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.doesNotMatch(res.text, /a\.ts/); // nested under src/
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('list_files: scoped to a subdirectory', async () => {
  const root = makeProject();
  try {
    const tool = listFilesTool(root);
    const res = await tool.execute({ path: 'src' });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /a\.ts/);
      assert.doesNotMatch(res.text, /package\.json/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('list_files: missing directory is an error', async () => {
  const root = makeProject();
  try {
    const tool = listFilesTool(root);
    const res = await tool.execute({ path: 'nope' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
