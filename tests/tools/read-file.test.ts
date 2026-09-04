import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileTool } from '../../src/tools/read-file.js';

function makeProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'read-file-test-'));
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'a.ts'), 'line1\nline2\nline3\nline4\nline5\n');
  writeFileSync(path.join(root, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
  writeFileSync(path.join(root, 'empty.txt'), '');
  return root;
}

test('read_file: reads a file with line numbers', async () => {
  const root = makeProject();
  try {
    const tool = readFileTool(root);
    const res = await tool.execute({ path: 'src/a.ts' });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /1: line1/);
      assert.match(res.text, /5: line5/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('read_file: offset and limit page through a file', async () => {
  const root = makeProject();
  try {
    const tool = readFileTool(root);
    const res = await tool.execute({ path: 'src/a.ts', offset: 2, limit: 2 });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /2: line2/);
      assert.match(res.text, /3: line3/);
      assert.doesNotMatch(res.text, /1: line1/);
      assert.match(res.text, /offset=4/); // continuation hint
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('read_file: negative offset counts from end', async () => {
  const root = makeProject();
  try {
    const tool = readFileTool(root);
    // File content: 'line1\nline2\nline3\nline4\nline5\n' → 5 content lines.
    const res = await tool.execute({ path: 'src/a.ts', offset: -2, limit: 1 });
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /4: line4/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('read_file: rejects paths outside the project', async () => {
  const root = makeProject();
  try {
    const tool = readFileTool(root);
    const res = await tool.execute({ path: '../secret.txt' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('read_file: missing file is a recoverable error', async () => {
  const root = makeProject();
  try {
    const tool = readFileTool(root);
    const res = await tool.execute({ path: 'nope.ts' });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.recoverable, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('read_file: binary files refused', async () => {
  const root = makeProject();
  try {
    const tool = readFileTool(root);
    const res = await tool.execute({ path: 'binary.png' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('read_file: empty file handled', async () => {
  const root = makeProject();
  try {
    const tool = readFileTool(root);
    const res = await tool.execute({ path: 'empty.txt' });
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.text, '(empty file)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
