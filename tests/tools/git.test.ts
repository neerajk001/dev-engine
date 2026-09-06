import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitStatusTool } from '../../src/tools/git-status.js';
import { gitDiffTool } from '../../src/tools/git-diff.js';
import { gitLogTool } from '../../src/tools/git-log.js';

function isGitAvailable(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function makeGitRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'git-test-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'a.ts'), 'const x = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: root });
  return root;
}

test('git_status: reports a clean tree', { skip: !isGitAvailable() }, async () => {
  const root = makeGitRepo();
  try {
    const res = await gitStatusTool(root).execute({});
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /clean/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('git_status: shows a modified file', { skip: !isGitAvailable() }, async () => {
  const root = makeGitRepo();
  try {
    writeFileSync(path.join(root, 'src', 'a.ts'), 'const x = 2;\n');
    const res = await gitStatusTool(root).execute({});
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /a\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('git_diff: shows the diff after a change', { skip: !isGitAvailable() }, async () => {
  const root = makeGitRepo();
  try {
    writeFileSync(path.join(root, 'src', 'a.ts'), 'const x = 2;\n');
    const res = await gitDiffTool(root).execute({});
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.text, /const x = 2/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('git_log: shows recent commits', { skip: !isGitAvailable() }, async () => {
  const root = makeGitRepo();
  try {
    const res = await gitLogTool(root).execute({ count: 5 });
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /initial/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('git tools: fail gracefully outside a repo', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'git-norepo-'));
  try {
    const res = await gitStatusTool(root).execute({});
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
