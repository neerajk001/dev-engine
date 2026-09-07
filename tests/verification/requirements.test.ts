import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRequirements } from '../../src/verification/requirements.js';
import type { AgentEvent } from '../../src/agent/events.js';

test('requirements: analysis does not require edits', () => {
  const check = checkRequirements('what can improve?', 'analyze', []);
  assert.equal(check.verified, true);
});

test('requirements: implementation needs an observed edit', () => {
  const check = checkRequirements('change the border', 'implement', []);
  assert.equal(check.verified, false);
  assert.match(check.reason, /without an observed file edit/);
});

test('requirements: explicit file paths must be among changed files', () => {
  const events: AgentEvent[] = [
    { type: 'file_diff', path: 'src/other.ts', removed: ['a'], added: ['b'] },
  ];
  const check = checkRequirements('change src/tui/app.tsx', 'implement', events);
  assert.equal(check.verified, false);
  assert.match(check.reason, /src\/tui\/app\.tsx/);
});

test('requirements: changed files are re-read from the workspace', () => {
  const events: AgentEvent[] = [
    { type: 'file_diff', path: 'missing.ts', removed: ['a'], added: ['b'] },
  ];
  const check = checkRequirements('change the file', 'implement', events, process.cwd());
  assert.equal(check.verified, false);
  assert.match(check.reason, /could not be re-read/);
});
