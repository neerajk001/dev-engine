import { existsSync, readFileSync } from 'node:fs';
import { resolveProjectPath } from '../safety/paths.js';
import type { AgentEvent } from '../agent/events.js';
import type { TaskMode } from '../agent/task-mode.js';

export interface RequirementCheck {
  verified: boolean;
  reason: string;
  changedFiles: string[];
}

/** Deterministic checks for the minimum evidence behind an implementation result. */
export function checkRequirements(task: string, mode: TaskMode, events: AgentEvent[], root?: string): RequirementCheck {
  const changedFiles = [...new Set(events
    .filter((event): event is Extract<AgentEvent, { type: 'file_diff' }> => event.type === 'file_diff')
    .map((event) => event.path))];
  if (mode !== 'implement') {
    return { verified: true, reason: `${mode} mode does not require edits`, changedFiles };
  }
  if (changedFiles.length === 0) {
    return { verified: false, reason: 'implementation task completed without an observed file edit', changedFiles };
  }

  if (root !== undefined) {
    const unreadable = changedFiles.filter((file) => {
      const resolved = resolveProjectPath(root, file);
      if (!resolved.ok || !existsSync(resolved.absolute)) return true;
      try {
        readFileSync(resolved.absolute, 'utf8');
        return false;
      } catch {
        return true;
      }
    });
    if (unreadable.length > 0) {
      return { verified: false, reason: `changed file(s) could not be re-read: ${unreadable.join(', ')}`, changedFiles };
    }
  }

  const mentionedPaths = [...task.matchAll(/(?:^|[\s`])((?:src|test|tests|app|lib|components)[/\\][\w./\\-]+\.[\w]+)/gi)]
    .map((match) => match[1]!.replaceAll('\\', '/'));
  const missing = mentionedPaths.filter((file) => !changedFiles.includes(file));
  if (missing.length > 0) {
    return {
      verified: false,
      reason: `requested file(s) were not edited: ${missing.join(', ')}`,
      changedFiles,
    };
  }
  return { verified: true, reason: `observed edits in ${changedFiles.join(', ')}`, changedFiles };
}
