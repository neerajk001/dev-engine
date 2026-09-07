import chalk from 'chalk';
import type { AgentStatus } from '../agent/types.js';
import type { ClarificationQuestion, OptimizedTask } from '../optimizer/types.js';

/** Render helpers for the CLI. Kept side-effect free for testability. */

export function banner(project: string, model: string): string {
  return [
    '╭─────────────────────────────────────╮',
    '│          Dev Engine Agent           │',
    '╰─────────────────────────────────────╯',
    '',
    `Project: ${project}`,
    `Model: ${model}`,
    '',
  ].join('\n');
}

export function helpText(): string {
  return [
    'Commands:',
    '  /optimize   Convert a vague request into a clear task first',
    '  /status     Show the current workspace and model',
    '  /traces     List past execution traces',
    '  /evaluate   Run a benchmark task and score the agent',
    '  /help       Show this help',
    '  /exit       Exit the agent',
    '',
    'Type a task in natural language, e.g. "fix the failing test in src/math.ts",',
    'or start with /optimize for a project-aware task preview.',
    '',
  ].join('\n');
}

export function statusBlock(workspace: string, model: string): string {
  return `\nWorkspace: ${workspace}\nModel: ${model}\n\n`;
}

export function promptSymbol(): string {
  return '> ';
}

export function statusLine(status: string): string {
  return chalk.white(`● ${status}`);
}

export function resultBlock(status: AgentStatus, report: string): string {
  const label = { done: 'Done', failed: 'Failed', blocked: 'Blocked' }[status];
  return `\n${label}:\n${report}\n`;
}

export function errorLine(message: string): string {
  return chalk.red(`Error: ${message}`);
}

export function confirmPrompt(command: string): string {
  return chalk.blue(`Run '${command}'? [y/N] `);
}

export function renderClarify(q: ClarificationQuestion): string {
  const lines = [q.question, ''];
  q.options.forEach((opt, i) => {
    lines.push(`${i + 1}. ${opt}`);
  });
  lines.push('', 'Enter a number (or a free-text answer):');
  return lines.join('\n');
}

export function renderTaskPreview(task: OptimizedTask): string {
  const lines = ['✨ Optimized Task', '', `Intent: ${task.intent}`];
  if (task.relevantFiles.length > 0) {
    lines.push('', 'Likely relevant files:', ...task.relevantFiles.map((f) => `- ${f}`));
  }
  if (task.requirements.length > 0) {
    lines.push('', 'Requirements:', ...task.requirements.map((r) => `- ${r}`));
  }
  if (task.constraints.length > 0) {
    lines.push('', 'Constraints:', ...task.constraints.map((c) => `- ${c}`));
  }
  if (task.assumptions.length > 0) {
    lines.push('', 'Assumptions:', ...task.assumptions.map((a) => `- ${a}`));
  }
  if (task.ambiguities.length > 0) {
    lines.push('', 'Remaining ambiguities:', ...task.ambiguities.map((a) => `- ${a}`));
  }
  if (task.acceptanceCriteria.length > 0) {
    lines.push('', 'Acceptance criteria:', ...task.acceptanceCriteria.map((a) => `- ${a}`));
  }
  lines.push('', '[Execute] [Edit] [Cancel]');
  return lines.join('\n');
}
