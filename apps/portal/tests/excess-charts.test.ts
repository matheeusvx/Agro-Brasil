import test from "node:test";
import assert from "node:assert/strict";
import { axisTicks, splitTicks } from "../src/components/excess-charts";
test("traços: parte positiva mínima ganha um traço e a soma fecha", () => {
  const b = splitTicks([496, 360, 310, 2160, 4], 109);
  assert.equal(b[0], 0);
  assert.equal(b[b.length - 1], 109);
  for (let i = 0; i < 5; i++) assert.ok(b[i + 1] > b[i], "cada parte tem ao menos um traço");
  const zero = splitTicks([10, 0, 5], 12);
  assert.equal(zero[2] - zero[1], 0);
});
test("eixo usa passos redondos e cobre o maior valor", () => {
  assert.deepEqual(axisTicks(4297.5), [0, 1000, 2000, 3000, 4000, 5000]);
  assert.deepEqual(axisTicks(20), [0, 5, 10, 15, 20]);
  assert.deepEqual(axisTicks(0), [0]);
});
