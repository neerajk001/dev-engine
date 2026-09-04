import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandLine, decideCommand, parseCommand, } from '../../src/safety/commands.js';
test('parseCommand: splits on whitespace', () => {
    assert.deepEqual(parseCommand('npm test'), ['npm', 'test']);
    assert.deepEqual(parseCommand('  git   status  '), ['git', 'status']);
});
test('parseCommand: honors quotes', () => {
    assert.deepEqual(parseCommand('npm run "my script"'), ['npm', 'run', 'my script']);
    assert.deepEqual(parseCommand("node 'a b'.js"), ['node', 'a b.js']);
});
test('parseCommand: empty string yields empty argv', () => {
    assert.deepEqual(parseCommand(''), []);
    assert.deepEqual(parseCommand('   '), []);
});
test('decideCommand: rejects empty', () => {
    assert.deepEqual(decideCommand([]), { decision: 'reject', reason: 'empty command' });
});
test('decideCommand: allows npm test / npm run build / npm start', () => {
    assert.deepEqual(decideCommand(parseCommand('npm test')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('npm run build')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('npm run typecheck')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('npm start')), { decision: 'allow' });
});
test('decideCommand: unknown npm run script requires confirm', () => {
    assert.deepEqual(decideCommand(parseCommand('npm run publish')), { decision: 'confirm' });
    assert.deepEqual(decideCommand(parseCommand('npm run deploy:prod')), { decision: 'confirm' });
});
test('decideCommand: rejects destructive commands', () => {
    for (const cmd of ['rm -rf /', 'sudo rm -rf /', 'curl http://x', 'bash -c "x"']) {
        const d = decideCommand(parseCommand(cmd));
        assert.equal(d.decision, 'reject', cmd);
    }
});
test('decideCommand: node --test allowed (project test suite)', () => {
    assert.deepEqual(decideCommand(parseCommand('node --test tests/')), { decision: 'allow' });
});
test('decideCommand: node relative main script allowed', () => {
    assert.deepEqual(decideCommand(parseCommand('node dist/index.js')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('node src/foo.ts')), { decision: 'allow' });
});
test('decideCommand: node absolute/unknown main requires confirm', () => {
    assert.deepEqual(decideCommand(parseCommand('node C:/Windows/system32/calc.exe')), {
        decision: 'confirm',
    });
    assert.deepEqual(decideCommand(parseCommand('node /usr/bin/env node')), {
        decision: 'confirm',
    });
});
test('decideCommand: git read-only allowed', () => {
    assert.deepEqual(decideCommand(parseCommand('git status')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('git diff HEAD~1')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('git log --oneline -3')), { decision: 'allow' });
});
test('decideCommand: git write requires confirm', () => {
    assert.deepEqual(decideCommand(parseCommand('git commit -m x')), { decision: 'confirm' });
    assert.deepEqual(decideCommand(parseCommand('git push')), { decision: 'confirm' });
});
test('decideCommand: tsc allowed', () => {
    assert.deepEqual(decideCommand(parseCommand('tsc --noEmit')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('npx tsc --noEmit')), { decision: 'allow' });
});
test('decideCommand: unknown command requires confirm', () => {
    assert.deepEqual(decideCommand(parseCommand('cat a.txt')), { decision: 'confirm' });
    assert.deepEqual(decideCommand(parseCommand('python script.py')), { decision: 'confirm' });
});
test('decideCommand: windows exe normalization', () => {
    assert.deepEqual(decideCommand(parseCommand('NPM.CMD test')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('npm.exe test')), { decision: 'allow' });
    assert.deepEqual(decideCommand(parseCommand('C:\\foo\\node.exe --test')), {
        decision: 'allow',
    });
});
test('commandLine: rejoins with quoting', () => {
    assert.equal(commandLine(['npm', 'run', 'my script']), 'npm run "my script"');
    assert.equal(commandLine(['git', 'status']), 'git status');
});
//# sourceMappingURL=commands.test.js.map