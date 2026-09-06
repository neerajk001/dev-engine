import type { AgentStatus } from './types.js';
import type { ImplementationPlan } from './planner.js';

/** Structured events emitted by the agent loop. V4's trace reuses these. */
export type AgentEvent =
  | { type: 'agent_start'; task: string }
  | { type: 'model_request' }
  | { type: 'model_response'; toolCalls: number }
  | { type: 'tool_start'; name: string; input: unknown }
  | { type: 'tool_end'; name: string; ok: boolean; summary: string }
  | { type: 'file_diff'; path: string; removed: string[]; added: string[] }
  | { type: 'verification_start'; command: string }
  | { type: 'verification_end'; command: string; ok: boolean; output: string }
  | { type: 'repair_start'; attempt: number; maxAttempts: number; reason: string }
  | { type: 'plan_ready'; plan: ImplementationPlan }
  | { type: 'agent_end'; status: AgentStatus; report: string };

/** Sink for agent events. */
export type AgentEventSink = (event: AgentEvent) => void;

/** Render a single event as a short human-readable line (for line-mode CLI). */
export function eventToLine(event: AgentEvent): string {
  switch (event.type) {
    case 'agent_start':
      return `task: ${event.task}`;
    case 'model_request':
      return 'thinking…';
    case 'model_response':
      return event.toolCalls > 0
        ? `model requested ${event.toolCalls} tool call(s)`
        : 'model responded';
    case 'tool_start':
      return `tool: ${event.name}`;
    case 'tool_end':
      return `${event.ok ? 'ok' : 'error'}: ${event.name}${event.summary ? ` — ${event.summary}` : ''}`;
    case 'file_diff':
      return `changed: ${event.path}`;
    case 'verification_start':
      return `verify: ${event.command}`;
    case 'verification_end':
      return event.ok
        ? `verify passed: ${event.command}`
        : `verify failed: ${event.command}`;
    case 'repair_start':
      return `repair ${event.attempt}/${event.maxAttempts}: ${event.reason}`;
    case 'plan_ready':
      return `plan ready (${event.plan.steps.length} steps)`;
    case 'agent_end':
      return `agent ${event.status}`;
  }
}
