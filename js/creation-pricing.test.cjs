const { test } = require('node:test');
const assert = require('node:assert/strict');
const { creationCents } = require('./creation-pricing.js');

test('creación: montos fijos u otra cantidad estrictamente mayor a 200', () => {
  for (const amount of [50, 100, 150, 200, 200.01, 250, 1250.25]) assert.equal(creationCents(amount), Math.round(amount * 100));
  for (const amount of [undefined, null, '50', 0, .01, 49.99, 75, 199.99, 200.001, 250.999, NaN, Infinity, -50]) assert.equal(creationCents(amount), null, String(amount));
});
