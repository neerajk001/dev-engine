import { test } from 'node:test';
import assert from 'node:assert/strict';
import { banner, confirmPrompt, errorLine, helpText, resultBlock, statusLine } from '../../src/cli/output.js';

test('output: banner shows project and model', () => {
  const b = banner('my-app', 'gpt-4o-mini');
  assert.match(b, /my-app/);
  assert.match(b, /gpt-4o-mini/);
});

test('output: help lists /help and /exit', () => {
  const h = helpText();
  assert.match(h, /\/help/);
  assert.match(h, /\/exit/);
});

test('output: status line renders a bullet', () => {
  assert.equal(statusLine('reading files'), '● reading files');
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
