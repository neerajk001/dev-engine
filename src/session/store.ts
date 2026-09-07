import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SessionContext, SessionTurn } from './types.js';

function sessionPath(root: string): string {
  return path.join(root, '.dev-engine', 'session.json');
}

export function loadSession(root: string): SessionContext {
  const file = sessionPath(root);
  if (!existsSync(file)) return { sessionId: randomUUID().slice(0, 8), turns: [] };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as SessionContext;
    if (typeof parsed.sessionId === 'string' && Array.isArray(parsed.turns)) return parsed;
  } catch {
    // Start a fresh session when the persisted file is invalid.
  }
  return { sessionId: randomUUID().slice(0, 8), turns: [] };
}

export function saveSession(root: string, session: SessionContext): void {
  const dir = path.dirname(sessionPath(root));
  mkdirSync(dir, { recursive: true });
  writeFileSync(sessionPath(root), JSON.stringify(session, null, 2), 'utf8');
}

export function appendSessionTurn(root: string, turn: SessionTurn): SessionContext {
  const session = loadSession(root);
  session.turns = [...session.turns, turn].slice(-20);
  saveSession(root, session);
  return session;
}

export function renderSessionContext(session: SessionContext): string {
  if (session.turns.length === 0) return 'No previous work in this session.';
  return session.turns.slice(-6).map((turn, index) => [
    `Previous task ${index + 1} (${turn.mode}, ${turn.status}): ${turn.prompt}`,
    `Changed files: ${turn.changedFiles.join(', ') || 'none'}`,
    `Verification: ${turn.verification.join('; ') || 'none'}`,
    `Summary: ${turn.summary.slice(0, 500)}`,
  ].join('\n')).join('\n\n');
}
