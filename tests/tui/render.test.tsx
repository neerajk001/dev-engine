import React from 'react';
import { renderToString } from 'ink';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityPane } from '../../src/tui/ActivityPane.js';
import { StatusBar } from '../../src/tui/StatusBar.js';
import { Menu } from '../../src/tui/Menu.js';
import type { AgentEvent } from '../../src/agent/events.js';
import type { MenuItem } from '../../src/tui/Menu.js';

test('tui: StatusBar renders workspace and model', () => {
  const out = renderToString(<StatusBar workspace="/repo" model="gpt-4o-mini" phase="idle" />);
  assert.match(out, /dev-engine/);
  assert.match(out, /gpt-4o-mini/);
  assert.match(out, /\/repo/);
});

test('tui: ActivityPane renders events as colored lines', () => {
  const events: AgentEvent[] = [
    { type: 'agent_start', task: 'fix math' },
    { type: 'tool_start', name: 'edit_file', input: { path: 'math.ts' } },
    { type: 'verification_end', command: 'npm test', ok: true, output: 'pass' },
  ];
  const out = renderToString(<ActivityPane events={events} />);
  assert.match(out, /fix math/);
  assert.match(out, /edit_file/);
  assert.match(out, /passed npm test/);
});

test('tui: ActivityPane renders file changes as a colored diff', () => {
  const events: AgentEvent[] = [
    { type: 'file_diff', path: 'src/math.ts', removed: ['return 1;'], added: ['return 2;'] },
  ];
  const out = renderToString(<ActivityPane events={events} />);
  assert.match(out, /src\/math\.ts/);
  assert.match(out, /- return 1;/);
  assert.match(out, /\+ return 2;/);
});

test('tui: ActivityPane shows waiting when empty', () => {
  const out = renderToString(<ActivityPane events={[]} />);
  assert.match(out, /waiting/);
});

test('tui: Menu renders items with correct selection', () => {
  const items: MenuItem[] = [
    { id: 'optimize', label: 'Optimize', shortcut: 'O' },
    { id: 'run', label: 'Run Direct', shortcut: 'R' },
    { id: 'exit', label: 'Exit', shortcut: 'X' },
  ];
  const out = renderToString(<Menu items={items} selectedIndex={1} focused={true} />);
  assert.match(out, /Optimize/);
  assert.match(out, /Run Direct/);
  assert.match(out, /Exit/);
  assert.match(out, /▸/); // selection indicator
});

test('tui: Menu shows unfocused state', () => {
  const items: MenuItem[] = [
    { id: 'optimize', label: 'Optimize', shortcut: 'O' },
  ];
  const out = renderToString(<Menu items={items} selectedIndex={0} focused={false} />);
  assert.match(out, /Actions/);
  assert.match(out, /Optimize/);
});
