import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPathInsideProject, resolveProjectPath } from '../../src/safety/paths.js';
function makeProject() {
    const root = mkdtempSync(path.join(tmpdir(), 'paths-test-'));
    writeFileSync(path.join(root, 'a.txt'), 'a');
    writeFileSync(path.join(root, '.env'), 'x');
    return root;
}
test('resolveProjectPath: relative path resolves inside root', () => {
    const root = makeProject();
    try {
        const r = resolveProjectPath(root, 'a.txt');
        assert.equal(r.ok, true);
        if (r.ok)
            assert.equal(r.absolute, path.join(root, 'a.txt'));
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('resolveProjectPath: subdirectory relative path', () => {
    const root = makeProject();
    try {
        const r = resolveProjectPath(root, 'sub/dir/file.ts');
        assert.equal(r.ok, true);
        if (r.ok)
            assert.equal(r.absolute, path.join(root, 'sub', 'dir', 'file.ts'));
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('resolveProjectPath: rejects .. escape', () => {
    const root = makeProject();
    try {
        const r = resolveProjectPath(root, '../outside.txt');
        assert.equal(r.ok, false);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('resolveProjectPath: rejects absolute path outside root', () => {
    const root = makeProject();
    try {
        const outside = path.join(root, '..', 'sibling.txt');
        const r = resolveProjectPath(root, outside);
        assert.equal(r.ok, false);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('resolveProjectPath: rejects empty / non-string input', () => {
    const root = makeProject();
    try {
        assert.equal(resolveProjectPath(root, '').ok, false);
        assert.equal(resolveProjectPath(root, '   ').ok, false);
        assert.equal(resolveProjectPath(root, '  ').ok, false);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('isPathInsideProject: root itself is inside', () => {
    const root = makeProject();
    try {
        assert.equal(isPathInsideProject(root, root), true);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('isPathInsideProject: nested path is inside', () => {
    const root = makeProject();
    try {
        assert.equal(isPathInsideProject(root, path.join(root, 'sub')), true);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test('isPathInsideProject: sibling is outside', () => {
    const root = makeProject();
    try {
        const sibling = path.join(root, '..', 'sibling');
        assert.equal(isPathInsideProject(root, sibling), false);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=paths.test.js.map