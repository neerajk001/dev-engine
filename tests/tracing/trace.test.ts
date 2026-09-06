import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRunId,
  saveTrace,
  loadTrace,
  listTraces,
  formatTraceSummary,
  formatTraceDetail,
  tracesDir,
} from '../../src/tracing/trace.js';
import type { RunTrace } from '../../src/tracing/trace.js';
import { TraceCollector } from '../../src/tracing/collector.js';
import type { AgentEvent } from '../../src/agent/events.js';

function makeTrace(overrides?: Partial<RunTrace>): RunTrace {
  return {
    runId: generateRunId(),
    task: 'fix the bug',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    durationMs: 5000,
    status: 'done',
    events: [
      { sequence: 1, timestamp: Date.now() - 4000, event: { type: 'agent_start', task: 'fix the bug' } },
      { sequence: 2, timestamp: Date.now() - 3000, event: { type: 'tool_start', name: 'read_file', input: {} } },
      { sequence: 3, timestamp: Date.now() - 2000, event: { type: 'tool_end', name: 'read_file', ok: true, summary: 'ok' } },
      { sequence: 4, timestamp: Date.now(), event: { type: 'agent_end', status: 'done', report: 'fixed' } },
    ],
    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    toolCallCount: 1,
    iterationCount: 2,
    repairCount: 0,
    ...overrides,
  };
}

test('generateRunId: produces unique 8-char IDs', () => {
  const id1 = generateRunId();
  const id2 = generateRunId();
  assert.equal(id1.length, 8);
  assert.equal(id2.length, 8);
  assert.notEqual(id1, id2);
});

test('saveTrace + loadTrace: round-trips a trace', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trace-test-'));
  try {
    const trace = makeTrace();
    const filepath = saveTrace(root, trace);
    assert.ok(filepath.endsWith('.json'));

    const loaded = loadTrace(root, trace.runId);
    assert.ok(loaded);
    assert.equal(loaded?.runId, trace.runId);
    assert.equal(loaded?.task, trace.task);
    assert.equal(loaded?.status, 'done');
    assert.equal(loaded?.events.length, 4);
    assert.equal(loaded?.tokenUsage.totalTokens, 150);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadTrace: returns null for missing trace', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trace-test-'));
  try {
    assert.equal(loadTrace(root, 'nonexistent'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('listTraces: returns traces sorted newest first', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trace-test-'));
  try {
    saveTrace(root, makeTrace({ runId: 'aaaa1111', startTime: 1000 }));
    saveTrace(root, makeTrace({ runId: 'bbbb2222', startTime: 2000 }));
    saveTrace(root, makeTrace({ runId: 'cccc3333', startTime: 3000 }));

    const traces = listTraces(root);
    assert.equal(traces.length, 3);
    assert.equal(traces[0]!.runId, 'cccc3333');
    assert.equal(traces[1]!.runId, 'bbbb2222');
    assert.equal(traces[2]!.runId, 'aaaa1111');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('listTraces: returns empty when no traces exist', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'trace-test-'));
  try {
    assert.deepEqual(listTraces(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('formatTraceSummary: produces a one-line summary', () => {
  const trace = makeTrace({ runId: 'abc12345' });
  const summary = formatTraceSummary(trace);
  assert.match(summary, /abc12345/);
  assert.match(summary, /✓/); // done status checkmark
  assert.match(summary, /5000ms/);
  assert.match(summary, /150 tokens/);
  assert.match(summary, /fix the bug/);
});

test('formatTraceDetail: produces a multi-line detail with events', () => {
  const trace = makeTrace({ runId: 'abc12345' });
  const detail = formatTraceDetail(trace);
  assert.match(detail, /Run #abc12345/);
  assert.match(detail, /Task: fix the bug/);
  assert.match(detail, /Events:/);
  assert.match(detail, /agent_start/);
  assert.match(detail, /tool_start: read_file/);
  assert.match(detail, /agent_end: done/);
});

test('tracesDir: resolves to .dev-engine/traces under root', () => {
  assert.equal(tracesDir('/my/project'), path.join('/my/project', '.dev-engine', 'traces'));
});

test('TraceCollector: records events and finalizes a trace', () => {
  const collector = new TraceCollector();
  collector.start('test task');
  const event: AgentEvent = { type: 'agent_start', task: 'test task' };
  collector.record(event);
  collector.addTokens(100, 50);

  const trace = collector.finalize('done', 5000, 2, 1, 0);
  assert.equal(trace.runId, collector.runId);
  assert.equal(trace.task, 'test task');
  assert.equal(trace.events.length, 1);
  assert.equal(trace.events[0]!.sequence, 1);
  assert.equal(trace.tokenUsage.totalTokens, 150);
  assert.equal(trace.status, 'done');
});

test('TraceCollector: addTokens accumulates', () => {
  const collector = new TraceCollector();
  collector.start('test');
  collector.addTokens(100, 50);
  collector.addTokens(200, 100);
  const trace = collector.finalize('done', 1000, 1, 1, 0);
  assert.equal(trace.tokenUsage.promptTokens, 300);
  assert.equal(trace.tokenUsage.completionTokens, 150);
  assert.equal(trace.tokenUsage.totalTokens, 450);
});
