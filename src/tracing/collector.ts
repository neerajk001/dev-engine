import type { AgentEvent } from '../agent/events.js';
import type { AgentStatus } from '../agent/types.js';
import type { RunTrace, TimestampedEvent, TokenUsage } from './trace.js';
import { generateRunId } from './trace.js';

/**
 * Accumulates events for a single agent run, producing a persistable trace.
 */
export class TraceCollector {
  readonly runId: string;
  private readonly events: TimestampedEvent[] = [];
  private sequence = 0;
  private startTime = 0;
  private task = '';
  private tokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor() {
    this.runId = generateRunId();
  }

  /** Called when the agent starts. */
  start(task: string): void {
    this.startTime = Date.now();
    this.task = task;
  }

  /** Record an event with a timestamp. */
  record(event: AgentEvent): void {
    this.sequence += 1;
    this.events.push({
      sequence: this.sequence,
      timestamp: Date.now(),
      event,
    });
  }

  /** Add token usage from a model response. */
  addTokens(prompt: number, completion: number): void {
    this.tokenUsage.promptTokens += prompt;
    this.tokenUsage.completionTokens += completion;
    this.tokenUsage.totalTokens = this.tokenUsage.promptTokens + this.tokenUsage.completionTokens;
  }

  /** Finalize and return the trace. */
  finalize(
    status: AgentStatus,
    durationMs: number,
    toolCallCount: number,
    iterationCount: number,
    repairCount: number,
  ): RunTrace {
    return {
      runId: this.runId,
      task: this.task,
      startTime: this.startTime,
      endTime: this.startTime + durationMs,
      durationMs,
      status,
      events: this.events,
      tokenUsage: this.tokenUsage,
      toolCallCount,
      iterationCount,
      repairCount,
    };
  }
}
