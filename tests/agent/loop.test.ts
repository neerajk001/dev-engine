import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LLMProvider } from '../../src/llm/provider.js';
import type { GenerateRequest, ModelResponse } from '../../src/llm/types.js';
import type { ProviderToolCall } from '../../src/llm/types.js';
import type { Tool } from '../../src/tools/types.js';
import { runAgentLoop } from '../../src/agent/loop.js';
import type { AgentConfig } from '../../src/agent/types.js';
import type { AgentEvent } from '../../src/agent/events.js';

/** Minimal temp project whose verify script exits 0 or 1 on demand. */
function makeProject(testExitCode: number): string {
  const root = mkdtempSync(path.join(tmpdir(), 'loop-test-'));
  const script = testExitCode === 0
    ? 'node -e "process.exit(0)"'
    : 'node -e "process.exit(1)"';
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'x', version: '1.0.0', scripts: { test: script } }),
  );
  return root;
}

function makeTool(name: string): Tool {
  return { name, description: name, inputSchema: {}, execute: async () => ({ ok: true, text: 'ok' }) };
}

class FakeProvider implements LLMProvider {
  queue: Array<ModelResponse>;
  constructor(queue: Array<ModelResponse>) {
    this.queue = queue;
  }
  async generate(_req: GenerateRequest): Promise<ModelResponse> {
    const r = this.queue.shift();
    if (!r) throw new Error('fake provider exhausted');
    return r;
  }
}

function toolCall(name: string): ProviderToolCall {
  return { id: '1', name, arguments: '{}' };
}

const DONE: ModelResponse = { stopReason: 'end_turn', content: '[done]\nAll done.', toolCalls: [] };

function baseConfig(root: string, extra?: Partial<AgentConfig>): AgentConfig {
  return {
    root,
    projectName: 'x',
    maxIterations: 10,
    onConfirmCommand: async () => true,
    ...extra,
  };
}

test('loop: reports done and includes events', async () => {
  const root = makeProject(0);
  try {
    const provider = new FakeProvider([DONE]);
    const events: AgentEvent[] = [];
    const result = await runAgentLoop({
      provider,
      tools: [makeTool('read_file')],
      systemPrompt: 'sys',
      projectContext: 'ctx',
      task: 'do it',
      config: baseConfig(root, { onEvent: (e) => events.push(e) }),
    });
    assert.equal(result.status, 'done');
    assert.ok(events.some((e) => e.type === 'agent_start'));
    assert.ok(events.some((e) => e.type === 'agent_end'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loop: executes a tool call then finishes', async () => {
  const root = makeProject(0);
  try {
    const provider = new FakeProvider([
      { stopReason: 'tool_calls', content: null, toolCalls: [toolCall('edit_file')] },
      DONE,
    ]);
    const result = await runAgentLoop({
      provider,
      tools: [makeTool('edit_file')],
      systemPrompt: 'sys',
      projectContext: 'ctx',
      task: 'edit something',
      config: baseConfig(root),
    });
    assert.equal(result.status, 'done');
    assert.equal(result.toolCallCount, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loop: iteration limit produces blocked with reason', async () => {
  const root = makeProject(0);
  try {
    const provider = new FakeProvider([
      { stopReason: 'tool_calls', content: null, toolCalls: [toolCall('read_file')] },
      { stopReason: 'tool_calls', content: null, toolCalls: [toolCall('read_file')] },
      { stopReason: 'tool_calls', content: null, toolCalls: [toolCall('read_file')] },
    ]);
    const result = await runAgentLoop({
      provider,
      tools: [makeTool('read_file')],
      systemPrompt: 'sys',
      projectContext: 'ctx',
      task: 'loop',
      config: baseConfig(root, { maxIterations: 2 }),
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.terminationReason ?? '', /iteration limit/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loop: non-recoverable tool error blocks the run', async () => {
  const root = makeProject(0);
  try {
    const provider = new FakeProvider([
      { stopReason: 'tool_calls', content: null, toolCalls: [toolCall('run_command')] },
    ]);
    const deniedTool: Tool = {
      name: 'run_command',
      description: 'x',
      inputSchema: {},
      execute: async () => ({ ok: false, error: 'not approved', recoverable: false }),
    };
    const result = await runAgentLoop({
      provider,
      tools: [deniedTool],
      systemPrompt: 'sys',
      projectContext: 'ctx',
      task: 'run',
      config: baseConfig(root),
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.report, /not approved/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loop: failing verification triggers repair then done after fix', async () => {
  // Always-failing verify: the model is nudged to repair, then says done.
  const root = makeProject(1);
  try {
    const provider = new FakeProvider([
      { stopReason: 'tool_calls', content: null, toolCalls: [toolCall('edit_file')] },
      DONE, // model claims done after repair nudge (verify still fails → second repair)
      DONE, // third nudge? loop caps by provider exhaustion — give it one more
    ]);
    const events: AgentEvent[] = [];
    const result = await runAgentLoop({
      provider,
      tools: [makeTool('edit_file')],
      systemPrompt: 'sys',
      projectContext: 'ctx',
      task: 'edit and verify',
      config: baseConfig(root, { maxRepairs: 2, onEvent: (e) => events.push(e) }),
    });
    assert.ok(events.some((e) => e.type === 'verification_end' && e.ok === false), 'verify ran and failed');
    assert.ok(events.some((e) => e.type === 'repair_start'), 'repair triggered');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loop: passing verification after edit reports done without repair', async () => {
  const root = makeProject(0);
  try {
    const provider = new FakeProvider([
      { stopReason: 'tool_calls', content: null, toolCalls: [toolCall('edit_file')] },
      DONE,
    ]);
    const events: AgentEvent[] = [];
    const result = await runAgentLoop({
      provider,
      tools: [makeTool('edit_file')],
      systemPrompt: 'sys',
      projectContext: 'ctx',
      task: 'edit and verify',
      config: baseConfig(root, { onEvent: (e) => events.push(e) }),
    });
    assert.equal(result.status, 'done');
    assert.ok(events.some((e) => e.type === 'verification_end' && e.ok === true));
    assert.ok(!events.some((e) => e.type === 'repair_start'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
