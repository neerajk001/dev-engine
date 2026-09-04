import { realpathSync } from 'node:fs';
import path from 'node:path';

export type PathResolution =
  | { ok: true; absolute: string }
  | { ok: false; error: string };

function normalizeAbsolute(p: string): string {
  return path.normalize(p);
}

/**
 * Resolve a model/user-supplied path against the workspace root.
 *
 * Absolute paths are allowed only when they stay inside the project.
 * Relative paths are resolved against the root. The resolved path is
 * normalized and containment-checked so `../` escapes are rejected.
 */
export function resolveProjectPath(
  root: string,
  input: string,
): PathResolution {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return { ok: false, error: 'path must be a non-empty string' };
  }

  let candidate: string;
  if (path.isAbsolute(input)) {
    candidate = normalizeAbsolute(input);
  } else {
    candidate = normalizeAbsolute(path.resolve(root, input));
  }

  if (!isPathInsideProject(root, candidate)) {
    return {
      ok: false,
      error: `path is outside the project workspace: ${candidate}`,
    };
  }
  return { ok: true, absolute: candidate };
}

/**
 * True when `candidate` is the project root itself or nested inside it.
 * Symlinks are resolved on both sides so a symlinked-in file that points
 * outside the real root is not treated as inside.
 */
export function isPathInsideProject(root: string, candidate: string): boolean {
  const rootReal = safeRealpath(root);
  const candidateReal = safeRealpath(candidate);
  const effectiveRoot = rootReal ?? normalizeAbsolute(root);
  const effectiveCandidate = candidateReal ?? normalizeAbsolute(candidate);
  const rel = path.relative(effectiveRoot, effectiveCandidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeRealpath(p: string): string | null {
  try {
    return realpathSync.native(p);
  } catch {
    return null;
  }
}
