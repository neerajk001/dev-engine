import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  banner,
  confirmPrompt,
  errorLine,
  helpText,
  renderClarify,
  renderTaskPreview,
  resultBlock,
  statusLine,
  statusBlock,
} from '../../src/cli/output.js';
import type { ClarificationQuestion, OptimizedTask } from '../../src/optimizer/types.js';

test('output: banner shows project and model', () => {
  const b = banner('my-app', 'gpt-4o-mini');
  assert.match(b, /my-app/);
  assert.match(b, /gpt-4o-mini/);
});

test('output: help lists /help and /exit', () => {
  const h = helpText();
  assert.match(h, /\/help/);
  assert.match(h, /\/exit/);
  assert.match(h, /\/optimize/);
});

test('output: status line renders a bullet', () => {
  assert.equal(statusLine('reading files'), '● reading files');
});

test('output: status block shows workspace and model', () => {
  const out = statusBlock('C:/repo', 'gpt-4o-mini');
  assert.match(out, /Workspace: C:\/repo/);
  assert.match(out, /Model: gpt-4o-mini/);
});

test('output: result block labels the status', () => {
  const b = resultBlock('done', 'fixed it');
  assert.match(b, /Done:/);
  assert.match(b, /fixed it/);
});

test('output: error and confirm helpers', () => {
  assert.equal(errorLine('boom'), 'Error: boom');
  assert.equal(confirmPrompt('npm test'), "Run 'npm test'? [y/N] ");
});

test('output: renderClarify shows a numbered question', () => {
  const q: ClarificationQuestion = {
    question: 'What should be improved?',
    options: ['Visual design', 'UX', 'Performance'],
  };
  const out = renderClarify(q);
  assert.match(out, /What should be improved\?/);
  assert.match(out, /1\. Visual design/);
  assert.match(out, /3\. Performance/);
});

test('output: renderTaskPreview shows the optimized task + actions', () => {
  const task: OptimizedTask = {
    intent: 'Improve the login experience.',
    requirements: ['Add a loading state.'],
    constraints: ['Preserve the auth flow.'],
    relevantFiles: ['src/components/Login.tsx'],
    assumptions: ['UI library unchanged.'],
    ambiguities: [],
    acceptanceCriteria: ['Loading appears during requests.'],
  };
  const out = renderTaskPreview(task);
  assert.match(out, /✨ Optimized Task/);
  assert.match(out, /Intent: Improve the login experience\./);
  assert.match(out, /src\/components\/Login\.tsx/);
  assert.match(out, /- Add a loading state\./);
  assert.match(out, /Acceptance criteria:/);
  assert.match(out, /\[Execute\] \[Edit\] \[Cancel\]/);
});
