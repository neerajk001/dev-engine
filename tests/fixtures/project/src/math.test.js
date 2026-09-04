import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, multiply } from './math.js';
test('add returns the sum', () => {
    assert.equal(add(2, 3), 5);
});
test('multiply returns the product', () => {
    assert.equal(multiply(4, 5), 20);
});
//# sourceMappingURL=math.test.js.map