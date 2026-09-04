import type { AgentStatus } from '../agent/types.js';

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
    '  /help       Show this help',
    '  /exit       Exit the agent',
    '',
    'Type a task in natural language, e.g. "fix the failing test in src/math.ts".',
    '',
  ].join('\n');
}

export function promptSymbol(): string {
  return '> ';
}

export function statusLine(status: string): string {
  return `● ${status}`;
}

export function resultBlock(status: AgentStatus, report: string): string {
  const label = { done: 'Done', failed: 'Failed', blocked: 'Blocked' }[status];
  return `\n${label}:\n${report}\n`;
}

export function errorLine(message: string): string {
  return `Error: ${message}`;
}

export function confirmPrompt(command: string): string {
  return `Run '${command}'? [y/N] `;
}
