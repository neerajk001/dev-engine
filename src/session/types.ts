import type { AgentStatus } from '../agent/types.js';
import type { TaskMode } from '../agent/task-mode.js';

export interface SessionTurn {
  prompt: string;
  mode: TaskMode;
  status: AgentStatus;
  changedFiles: string[];
  verification: string[];
  summary: string;
}

export interface SessionContext {
  sessionId: string;
  turns: SessionTurn[];
}
