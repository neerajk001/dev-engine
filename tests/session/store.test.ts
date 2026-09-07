import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendSessionTurn, loadSession, renderSessionContext } from '../../src/session/store.js';

test('session: persists and renders compact previous context', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'session-test-'));
  try {
    assert.equal(loadSession(root).turns.length, 0);
    appendSessionTurn(root, {
      prompt: 'change the border',
      mode: 'implement',
      status: 'done',
      changedFiles: ['src/tui/app.tsx'],
      verification: ['npm test: passed'],
      summary: '[done] border changed',
    });
    const session = loadSession(root);
    assert.equal(session.turns.length, 1);
    const context = renderSessionContext(session);
    assert.match(context, /src\/tui\/app\.tsx/);
    assert.match(context, /npm test: passed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
