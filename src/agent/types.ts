import type { Tool } from '../tools/types.js';

export type AgentStatus = 'done' | 'failed' | 'blocked';

export interface AgentConfig {
  root: string;
  projectName: string;
  maxIterations: number;
  /** Called with the command line when an un-allow-listed command needs approval. */
  onConfirmCommand: (command: string) => Promise<boolean>;
  /** Called with a short status step for the CLI to render (optional). */
  onStatus?: (status: string) => void;
}

export interface AgentResult {
  status: AgentStatus;
  /** Final report text from the model, with the [done]/[failed]/[blocked] prefix. */
  report: string;
  /** Reason for termination when the loop was cut short. */
  terminationReason?: string;
  iterations: number;
  toolCallCount: number;
}
