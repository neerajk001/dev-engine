import type { AgentEvent } from './events.js';
import type { Tool } from '../tools/types.js';
import type { TaskMode } from './task-mode.js';

export type AgentStatus = 'done' | 'failed' | 'blocked';

export type ApprovalMode = 'none' | 'plan' | 'all';

export interface AgentConfig {
  root: string;
  projectName: string;
  maxIterations: number;
  /** Maximum repair attempts after a failed verification (default 3). */
  maxRepairs?: number;
  /** Plan/command approval gating. 'none' = run plan without asking. */
  approvalMode?: ApprovalMode;
  /** Called with the command line when an un-allow-listed command needs approval. */
  onConfirmCommand: (command: string) => Promise<boolean>;
  /** Called when the agent proposes a plan and approvalMode requires sign-off. */
  onApprovePlan?: (plan: unknown) => Promise<boolean>;
  /** Called before an implementation task starts editing files. */
  onApproveTask?: (task: { prompt: string; mode: TaskMode; workspace: string }) => Promise<boolean>;
  /** Called with a short status step for the CLI to render (optional). */
  onStatus?: (status: string) => void;
  /** Called with structured events (replaces onStatus when present). */
  onEvent?: (event: AgentEvent) => void;
}

export interface AgentResult {
  status: AgentStatus;
  /** Final report text from the model, with the [done]/[failed]/[blocked] prefix. */
  report: string;
  /** Reason for termination when the loop was cut short. */
  terminationReason?: string;
  iterations: number;
  toolCallCount: number;
  /** Full event trace of the run. */
  events: AgentEvent[];
  /** The plan the agent proposed, when planning ran. */
  plan?: unknown;
  /** V4: unique run ID for this execution. */
  runId: string;
  /** V4: path to the persisted trace file, if saved. */
  tracePath?: string;
  /** V4: duration of the run in milliseconds. */
  durationMs: number;
  /** V4: token usage for the run. */
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  taskMode?: TaskMode;
  changedFiles?: string[];
  requirementVerified?: boolean;
}
