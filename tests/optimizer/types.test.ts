import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIntentAnalysis,
  parseJsonObject,
  parseOptimizedTask,
  taskToString,
} from '../../src/optimizer/types.js';

const VALID_TASK = {
  intent: 'Improve the login experience.',
  requirements: ['Add a loading state.', 'Show errors.'],
  constraints: ['Preserve the existing auth flow.'],
  relevantFiles: ['src/components/Login.tsx', 'src/api/auth.ts'],
  assumptions: ['The UI library stays the same.'],
  ambiguities: ['"better" is unspecified.'],
  acceptanceCriteria: ['Loading shows during requests.', 'Tests pass.'],
};

test('parseJsonObject: parses plain JSON', () => {
  const out = parseJsonObject('{"a":1}');
  assert.deepEqual(out, { a: 1 });
});

test('parseJsonObject: strips a code fence', () => {
  const out = parseJsonObject('```json\n{"a":1}\n```');
  assert.deepEqual(out, { a: 1 });
});

test('parseJsonObject: returns null on invalid or non-object', () => {
  assert.equal(parseJsonObject('not json'), null);
  assert.equal(parseJsonObject('[1,2]'), null);
  assert.equal(parseJsonObject(''), null);
  assert.equal(parseJsonObject('"str"'), null);
});

test('parseOptimizedTask: accepts a valid task', () => {
  const task = parseOptimizedTask(VALID_TASK);
  assert.ok(task);
  assert.equal(task?.intent, VALID_TASK.intent);
  assert.deepEqual(task?.requirements, VALID_TASK.requirements);
});

test('parseOptimizedTask: rejects malformed tasks', () => {
  assert.equal(parseOptimizedTask({ ...VALID_TASK, intent: '' }), null);
  assert.equal(parseOptimizedTask({ ...VALID_TASK, requirements: 'not-array' }), null);
  assert.equal(parseOptimizedTask({ ...VALID_TASK, requirements: [1, 2] }), null);
  assert.equal(parseOptimizedTask({ ...VALID_TASK, acceptanceCriteria: undefined }), null);
});

test('parseIntentAnalysis: accepts clear', () => {
  const a = parseIntentAnalysis({ intent: 'fix login button', ambiguityLevel: 'clear' });
  assert.ok(a);
  assert.equal(a?.ambiguityLevel, 'clear');
});

test('parseIntentAnalysis: ambiguous requires question and options', () => {
  const a = parseIntentAnalysis({
    intent: 'make the login better',
    ambiguityLevel: 'ambiguous',
    question: 'What should be improved?',
    options: ['Visual design', 'UX'],
  });
  assert.ok(a);
  assert.equal(a?.ambiguityLevel, 'ambiguous');
  assert.equal(a?.question, 'What should be improved?');
  assert.deepEqual(a?.options, ['Visual design', 'UX']);
});

test('parseIntentAnalysis: rejects malformed analyses', () => {
  assert.equal(parseIntentAnalysis({ intent: '', ambiguityLevel: 'clear' }), null);
  assert.equal(parseIntentAnalysis({ intent: 'x', ambiguityLevel: 'maybe' }), null);
  assert.equal(
    parseIntentAnalysis({ intent: 'x', ambiguityLevel: 'ambiguous' }), // no question/options
    null,
  );
  assert.equal(
    parseIntentAnalysis({ intent: 'x', ambiguityLevel: 'ambiguous', question: 'q' }),
    null,
  );
});

test('taskToString: serializes into a runnable task string', () => {
  const s = taskToString(parseOptimizedTask(VALID_TASK)!);
  assert.match(s, /Intent: Improve the login experience\./);
  assert.match(s, /Requirements:/);
  assert.match(s, /- Add a loading state\./);
  assert.match(s, /Acceptance criteria:/);
  assert.match(s, /- Tests pass\./);
});
