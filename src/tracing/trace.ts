import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { AgentEvent } from '../agent/events.js';
import type { AgentStatus } from '../agent/types.js';

export interface RunTrace {
  runId: string;
  task: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: AgentStatus;
  events: TimestampedEvent[];
  tokenUsage: TokenUsage;
  toolCallCount: number;
  iterationCount: number;
  repairCount: number;
}

export interface TimestampedEvent {
  sequence: number;
  timestamp: number;
  event: AgentEvent;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

function eventLabel(event: AgentEvent): string {
  switch (event.type) {
    case 'agent_start': return `agent_start: ${event.task}`;
    case 'model_request': return 'model_request';
    case 'model_response': return `model_response (${event.toolCalls} tool calls)`;
    case 'tool_start': return `tool_start: ${event.name}`;
    case 'tool_end': return `tool_end: ${event.name} ${event.ok ? 'ok' : 'error'}`;
    case 'file_diff': return `file_diff: ${event.path}`;
    case 'verification_start': return `verification_start: ${event.command}`;
    case 'verification_end': return `verification_end: ${event.command} ${event.ok ? 'passed' : 'failed'}`;
    case 'repair_start': return `repair_start: ${event.attempt}/${event.maxAttempts}`;
    case 'plan_ready': return `plan_ready (${event.plan.steps.length} steps)`;
    case 'agent_end': return `agent_end: ${event.status}`;
  }
}

export function generateRunId(): string {
  return randomUUID().slice(0, 8);
}

export function tracesDir(root: string): string {
  return path.join(root, '.dev-engine', 'traces');
}

export function saveTrace(root: string, trace: RunTrace): string {
  const dir = tracesDir(root);
  mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, `${trace.runId}.json`);
  writeFileSync(filepath, JSON.stringify(trace, null, 2), 'utf8');
  return filepath;
}

export function loadTrace(root: string, runId: string): RunTrace | null {
  const filepath = path.join(tracesDir(root), `${runId}.json`);
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, 'utf8')) as RunTrace;
  } catch {
    return null;
  }
}

export function listTraces(root: string): RunTrace[] {
  const dir = tracesDir(root);
  if (!existsSync(dir)) return [];
  const traces: RunTrace[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    try {
      traces.push(JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as RunTrace);
    } catch {
      // Skip corrupted trace files.
    }
  }
  return traces.sort((a, b) => b.startTime - a.startTime);
}

export function formatTraceSummary(trace: RunTrace): string {
  const date = new Date(trace.startTime).toISOString().slice(0, 19);
  const status = trace.status === 'done' ? '✓' : trace.status === 'failed' ? '✗' : '⊘';
  return `${status} ${trace.runId}  ${date}  ${trace.durationMs}ms  ${trace.iterationCount} iters  ${trace.toolCallCount} tools  ${trace.tokenUsage.totalTokens} tokens  ${trace.task.slice(0, 60)}`;
}

export function formatTraceDetail(trace: RunTrace): string {
  const lines = [
    `Run #${trace.runId}`,
    `Task: ${trace.task}`,
    `Status: ${trace.status}`,
    `Duration: ${trace.durationMs}ms`,
    `Iterations: ${trace.iterationCount}`,
    `Tool calls: ${trace.toolCallCount}`,
    `Repairs: ${trace.repairCount}`,
    `Tokens: ${trace.tokenUsage.totalTokens} (prompt: ${trace.tokenUsage.promptTokens}, completion: ${trace.tokenUsage.completionTokens})`,
    '',
    'Events:',
  ];
  for (const event of trace.events) {
    const time = new Date(event.timestamp).toISOString().slice(11, 23);
    lines.push(`  ${event.sequence.toString().padStart(3)}. [${time}] ${eventLabel(event.event)}`);
  }
  return lines.join('\n');
}
