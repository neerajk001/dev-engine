import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventToLine } from '../../src/agent/events.js';
import type { AgentEvent } from '../../src/agent/events.js';

test('eventToLine: renders each event type compactly', () => {
  const cases: Array<[AgentEvent, RegExp]> = [
    [{ type: 'agent_start', task: 'fix x' }, /task: fix x/],
    [{ type: 'model_request' }, /thinking/],
    [{ type: 'model_response', toolCalls: 2 }, /2 tool call/],
    [{ type: 'tool_start', name: 'edit_file', input: {} }, /tool: edit_file/],
    [{ type: 'tool_end', name: 'edit_file', ok: true, summary: 'edited a.ts' }, /ok: edit_file/],
    [{ type: 'verification_start', command: 'npm test' }, /verify: npm test/],
    [{ type: 'verification_end', command: 'npm test', ok: true, output: '' }, /verify passed/],
    [{ type: 'repair_start', attempt: 1, maxAttempts: 3, reason: 'tests failed' }, /repair 1\/3/],
    [{ type: 'plan_ready', plan: { steps: ['a', 'b'], verification: ['npm test'], relevantFiles: [] } }, /plan ready \(2 steps\)/],
    [{ type: 'agent_end', status: 'done', report: 'did it' }, /agent done/],
  ];
  for (const [ev, re] of cases) {
    assert.match(eventToLine(ev), re);
  }
});
