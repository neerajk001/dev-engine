import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, summarizeProject, truncateToTokens } from '../../src/util/format.js';
test('estimateTokens: empty is 0', () => {
    assert.equal(estimateTokens(''), 0);
});
test('estimateTokens: short text is small', () => {
    assert.ok(estimateTokens('hello world') < 10);
});
test('truncateToTokens: short text unchanged', () => {
    const s = 'a'.repeat(100);
    assert.equal(truncateToTokens(s, 1000), s);
});
test('truncateToTokens: long text truncates with head+tail', () => {
    const s = 'a'.repeat(10_000);
    const out = truncateToTokens(s, 100);
    assert.ok(out.length < s.length, 'output shorter than input');
    assert.ok(out.includes('[truncated]'), 'has truncation marker');
    assert.ok(out.startsWith('aaa'), 'keeps head');
    assert.ok(out.endsWith('aaa'), 'keeps tail');
});
test('truncateToTokens: appends note', () => {
    const s = 'b'.repeat(10_000);
    const out = truncateToTokens(s, 50, 'Read the rest at src/foo.ts:200');
    assert.ok(out.includes('Read the rest at src/foo.ts:200'));
});
test('summarizeProject: single line project summary', () => {
    const out = summarizeProject('my-app', 12, '/repo');
    assert.match(out, /Project: my-app/);
    assert.match(out, /Root: \/repo/);
    assert.match(out, /Tracked source files: 12/);
});
//# sourceMappingURL=format.test.js.map