import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTask, isReadOnlyMode } from '../../src/agent/task-mode.js';

test('task mode: explicit commands win', () => {
  assert.deepEqual(classifyTask('/analyze change the border'), {
    mode: 'analyze', task: 'change the border', explicit: true,
  });
  assert.equal(classifyTask('/implement change the border').mode, 'implement');
});

test('task mode: natural language uses conservative modes', () => {
  assert.equal(classifyTask('what can I improve?').mode, 'analyze');
  assert.equal(classifyTask('how should I add auth?').mode, 'plan');
  assert.equal(classifyTask('check whether the tests pass').mode, 'verify');
  assert.equal(classifyTask('change the input border').mode, 'implement');
  assert.equal(isReadOnlyMode('analyze'), true);
  assert.equal(isReadOnlyMode('implement'), false);
});
