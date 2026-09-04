import path from 'node:path';
import { resolveProjectPath, isPathInsideProject } from '../safety/paths.js';

/** Workspace-scoped path and command guard. */
export class Workspace {
  constructor(readonly root: string) {}

  /** Resolve a model-supplied path inside the workspace. */
  resolve(input: string): string {
    const r = resolveProjectPath(this.root, input);
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.absolute;
  }

  /** True when a path resolves inside the workspace root. */
  contains(p: string): boolean {
    return isPathInsideProject(this.root, p);
  }
}

/** Resolve the workspace root from env, flag, or cwd. */
export function resolveRoot(workspaceEnv: string | undefined, workspaceFlag: string | undefined): string {
  if (workspaceFlag) {
    return path.resolve(workspaceFlag);
  }
  if (workspaceEnv) {
    return path.resolve(workspaceEnv);
  }
  return process.cwd();
}
