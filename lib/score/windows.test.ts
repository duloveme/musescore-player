import assert from "node:assert/strict";
import test from "node:test";
import { fitScoreWidth, windowForMeasure } from "./windows.ts";

test("4-bar windows preview the next downbeat without including it in the body", () => {
  const first = windowForMeasure(0, 4, 9);
  assert.deepEqual(first.body, [0, 1, 2, 3]);
  assert.equal(first.preview, 4);

  const atEndOfScreen = windowForMeasure(3, 4, 9);
  assert.deepEqual(atEndOfScreen.body, [0, 1, 2, 3]);
  assert.equal(atEndOfScreen.preview, 4);

  const next = windowForMeasure(4, 4, 9);
  assert.deepEqual(next.body, [4, 5, 6, 7]);
  assert.equal(next.preview, 8);
});

test("the last screen has no preview measure", () => {
  const last = windowForMeasure(8, 4, 9);
  assert.deepEqual(last.body, [8]);
  assert.equal(last.preview, null);
});

test("dense measures scroll instead of scaling notes below the floor", () => {
  const comfortable = fitScoreWidth(800, 600, 0.55);
  assert.equal(comfortable.scroll, false);
  assert.ok(comfortable.scale >= 0.55);

  const dense = fitScoreWidth(2000, 400, 0.55);
  assert.equal(dense.scroll, true);
  assert.equal(dense.scale, 0.55);
});
