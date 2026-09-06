import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVerificationCommand, pickVerifyCommand, verifyProject } from '../../src/verification/runner.js';

test('pickVerifyCommand: prefers test over build over typecheck', () => {
  assert.equal(pickVerifyCommand({ test: 'node --test', build: 'tsc', typecheck: 'tsc --noEmit' }), 'npm run test');
  assert.equal(pickVerifyCommand({ build: 'tsc' }), 'npm run build');
  assert.equal(pickVerifyCommand({ typecheck: 'tsc --noEmit' }), 'npm run typecheck');
  assert.equal(pickVerifyCommand(undefined), null);
  assert.equal(pickVerifyCommand({}), null);
});

test('isVerificationCommand: npm test / tsc are allowed', () => {
  assert.equal(isVerificationCommand('npm test'), true);
  assert.equal(isVerificationCommand('npm run build'), true);
  assert.equal(isVerificationCommand('tsc --noEmit'), true);
  assert.equal(isVerificationCommand('rm -rf /'), false);
});
