import type { ToolDefinition } from './types.js';
import type { TaskMode } from '../agent/task-mode.js';

export interface SystemPromptInput {
  root: string;
  projectName: string;
  projectContext: string;
  tools: ToolDefinition[];
  taskMode?: TaskMode;
  sessionContext?: string;
}

/**
 * Build the system prompt describing the environment, tools, and
 * final-report protocol the agent must follow.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const toolLines = input.tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
  return `You are a coding agent operating inside a local project.

PROJECT ROOT: ${input.root}
Project name: ${input.projectName}

${input.projectContext}

TASK MODE: ${input.taskMode ?? 'implement'}
${input.sessionContext ? `PREVIOUS SESSION CONTEXT:\n${input.sessionContext}\n` : ''}

AVAILABLE TOOLS:
${toolLines}

RULES:
- All file paths are relative to the project root (absolute paths inside the project also work).
- Inspect the repository before making changes: use list_files and read_file to understand the code.
- Make minimal, targeted edits. Read a file before editing it.
- edit_file replaces exact text. If the replacement is rejected because the text was not found or is ambiguous, re-read the file and retry with a unique anchor.
- After changing code, verify with run_command (e.g. "npm test", "tsc --noEmit", "npm run build") and report the actual output as evidence.
- run_command executes without a shell; pass commands exactly like "npm test" or "node --test tests/".
- Never claim success without running the relevant verification.
- If a command requires approval you do not have, say so and stop.
- In analyze, plan, and verify modes, do not call edit_file. These modes are read-only.
- In analyze mode, answer the question without changing files.
- In plan mode, provide an implementation plan without changing files.
- In verify mode, inspect and test the existing implementation without changing files.
- In implement mode, make the requested code changes and verify them.

FINAL REPORT FORMAT:
End your final message with one of these exact prefixes on its own first line:
- [done] — task completed and verified.
- [failed] — the task could not be completed.
- [blocked] — you are stuck and need user input or permission.

After the prefix, summarize what you changed, what you ran, and the result — honestly, including failures.`;
}

/** Build a re-prompt nudging a non-conforming final response into shape. */
export function buildFormatNudge(): string {
  return 'Your previous message was not a valid final report. Start your final message with exactly one of [done], [failed], or [blocked] on its own first line, then give the report.';
}
