import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configFromEnv, parseArgv } from '../../src/cli/index.js';

test('parseArgv: extracts --workspace forms', () => {
  assert.deepEqual(parseArgv(['--workspace', '/x']), { workspaceFlag: '/x' });
  assert.deepEqual(parseArgv(['--workspace=/x']), { workspaceFlag: '/x' });
  assert.deepEqual(parseArgv(['-w', '/x']), { workspaceFlag: '/x' });
  assert.deepEqual(parseArgv(['--other']), {});
});

test('configFromEnv: defaults when unset', () => {
  const old = { ...process.env };
  try {
    delete process.env.OPENAI_API_KEY;
    delete process.env.MODEL;
    delete process.env.MAX_ITERATIONS;
    delete process.env.MAX_REPAIRS;
    delete process.env.APPROVAL_MODE;
    const c = configFromEnv();
    assert.equal(c.model, 'gpt-4o-mini');
    assert.equal(c.maxIterations, 25);
    assert.equal(c.maxRepairs, 3);
    assert.equal(c.approvalMode, 'none');
  } finally {
    process.env = { ...old };
  }
});

test('configFromEnv: reads overrides', () => {
  const old = { ...process.env };
  try {
    process.env.MODEL = 'gpt-4o';
    process.env.MAX_ITERATIONS = '5';
    process.env.MAX_REPAIRS = '1';
    process.env.APPROVAL_MODE = 'plan';
    const c = configFromEnv();
    assert.equal(c.model, 'gpt-4o');
    assert.equal(c.maxIterations, 5);
    assert.equal(c.maxRepairs, 1);
    assert.equal(c.approvalMode, 'plan');
  } finally {
    process.env = { ...old };
  }
});

test('configFromEnv: invalid values fall back to defaults', () => {
  const old = { ...process.env };
  try {
    process.env.MAX_ITERATIONS = 'abc';
    process.env.MAX_REPAIRS = '-2';
    process.env.APPROVAL_MODE = 'bogus';
    const c = configFromEnv();
    assert.equal(c.maxIterations, 25);
    assert.equal(c.maxRepairs, 3);
    assert.equal(c.approvalMode, 'none');
  } finally {
    process.env = { ...old };
  }
});
