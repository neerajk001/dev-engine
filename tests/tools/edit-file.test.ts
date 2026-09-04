import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editFileTool } from '../../src/tools/edit-file.js';

function makeProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'edit-test-'));
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'a.ts'), 'const x = 1;\nconst y = 2;\n');
  writeFileSync(path.join(root, 'src', 'dup.ts'), 'same\nsame\n');
  return root;
}

test('edit_file: applies an anchored replacement', async () => {
  const root = makeProject();
  try {
    const tool = editFileTool(root);
    const res = await tool.execute({
      path: 'src/a.ts',
      oldText: 'const y = 2;',
      newText: 'const y = 3;',
    });
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /src\/a\.ts/);
    assert.match(readFileSync(path.join(root, 'src', 'a.ts'), 'utf8'), /const y = 3;/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('edit_file: oldText not found is a recoverable error', async () => {
  const root = makeProject();
  try {
    const tool = editFileTool(root);
    const res = await tool.execute({ path: 'src/a.ts', oldText: 'nope', newText: 'x' });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.recoverable, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('edit_file: ambiguous oldText rejected', async () => {
  const root = makeProject();
  try {
    const tool = editFileTool(root);
    const res = await tool.execute({ path: 'src/dup.ts', oldText: 'same', newText: 'x' });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /more than once/);
      assert.equal(res.recoverable, true);
    }
    // File unchanged.
    assert.equal(readFileSync(path.join(root, 'src', 'dup.ts'), 'utf8'), 'same\nsame\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('edit_file: rejects paths outside the project', async () => {
  const root = makeProject();
  try {
    const tool = editFileTool(root);
    const res = await tool.execute({ path: '../outside.ts', oldText: 'a', newText: 'b' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('edit_file: missing file is an error', async () => {
  const root = makeProject();
  try {
    const tool = editFileTool(root);
    const res = await tool.execute({ path: 'nope.ts', oldText: 'a', newText: 'b' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('edit_file: empty oldText rejected', async () => {
  const root = makeProject();
  try {
    const tool = editFileTool(root);
    const res = await tool.execute({ path: 'src/a.ts', oldText: '', newText: 'x' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
