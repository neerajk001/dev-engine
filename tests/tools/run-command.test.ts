import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCommandTool, type ApprovalGate } from '../../src/tools/run-command.js';

function makeProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'cmd-test-'));
  // .js fixtures run via `node script.js` — spawnable without a shell.
  writeFileSync(
    path.join(root, 'ok.js'),
    "console.log('hello-from-script');\n",
  );
  writeFileSync(
    path.join(root, 'fail.js'),
    "console.log('about to fail');\nprocess.exit(3);\n",
  );
  writeFileSync(
    path.join(root, 'slow.js'),
    "setTimeout(() => console.log('done'), 5000);\n",
  );
  return root;
}

function approving(): ApprovalGate {
  return { confirm: async () => true };
}

function denying(): ApprovalGate {
  return { confirm: async () => false };
}

test('run_command: runs an allowed command and reports exit 0', async () => {
  const root = makeProject();
  try {
    const tool = runCommandTool(root, approving());
    const res = await tool.execute({ command: 'node ok.js' });
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.text, /hello-from-script/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_command: non-zero exit is a recoverable failure with output', async () => {
  const root = makeProject();
  try {
    const tool = runCommandTool(root, approving());
    const res = await tool.execute({ command: 'node fail.js' });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.recoverable, true);
      assert.match(res.error, /about to fail/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_command: rejected command returns error', async () => {
  const root = makeProject();
  try {
    const tool = runCommandTool(root, approving());
    const res = await tool.execute({ command: 'rm -rf /' });
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /rejected/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_command: denied confirmation returns non-recoverable error', async () => {
  const root = makeProject();
  try {
    const tool = runCommandTool(root, denying());
    const res = await tool.execute({ command: 'node ok.js' });
    // `node ok.js` is allow-listed (relative main), so no confirmation needed.
    assert.equal(res.ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_command: confirmation is requested for non-allow-listed commands', async () => {
  const root = makeProject();
  try {
    let asked = false;
    const gate: ApprovalGate = {
      confirm: async () => {
        asked = true;
        return true;
      },
    };
    const tool = runCommandTool(root, gate);
    // `node C:/absolute/path.js` requires confirm.
    const res = await tool.execute({ command: `node ${path.join(root, 'ok.js')}` });
    assert.equal(asked, true);
    assert.equal(res.ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_command: denied confirmation returns non-recoverable error', async () => {
  const root = makeProject();
  try {
    const tool = runCommandTool(root, denying());
    const absScript = path.join(root, 'ok.js');
    const res = await tool.execute({ command: `node ${absScript}` });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.recoverable, false);
      assert.match(res.error, /not approved/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_command: allow-listed npm test runs without confirmation', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cmd-test-npm-'));
  try {
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
    let confirmCalled = false;
    const gate: ApprovalGate = {
      confirm: async () => {
        confirmCalled = true;
        return true;
      },
    };
    const tool = runCommandTool(root, gate);
    // Fixture has no test script → expect a recoverable failure, not a prompt.
    const res = await tool.execute({ command: 'npm test' });
    assert.equal(confirmCalled, false);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.recoverable, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_command: empty command rejected', async () => {
  const root = makeProject();
  try {
    const tool = runCommandTool(root, approving());
    const res = await tool.execute({ command: '   ' });
    assert.equal(res.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
