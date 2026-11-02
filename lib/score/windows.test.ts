import assert from "node:assert/strict";
import test from "node:test";
import {
  fitScoreWidth,
  previewInSameSystem,
  sheetViewportSize,
  systemIdsFromYs,
  windowForMeasure,
} from "./windows.ts";

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

test("system ids cluster measures that share a staff-system Y", () => {
  assert.deepEqual(
    systemIdsFromYs([717, 717, 718, 1399, 1400, 1398]),
    [0, 0, 0, 1, 1, 1],
  );
});

test("system-aware windows do not cross MuseScore staff systems", () => {
  // Five bars on system 0, three on system 1 — mirrors the synthetic fixture layout.
  const systems = systemIdsFromYs([717, 717, 717, 717, 717, 1399, 1399, 1399]);
  assert.deepEqual(systems, [0, 0, 0, 0, 0, 1, 1, 1]);

  const first = windowForMeasure(0, 4, 8, systems);
  assert.deepEqual(first.body, [0, 1, 2, 3]);
  assert.equal(first.preview, 4);

  const leftover = windowForMeasure(4, 4, 8, systems);
  assert.deepEqual(leftover.body, [4]);
  assert.equal(leftover.preview, 5);

  const secondSystem = windowForMeasure(5, 4, 8, systems);
  assert.deepEqual(secondSystem.body, [5, 6, 7]);
  assert.equal(secondSystem.preview, null);
});

test("preview is omitted from the crop when it sits on the next staff system", () => {
  const systems = [0, 0, 0, 0, 0, 1, 1, 1];
  const leftover = windowForMeasure(4, 4, 8, systems);
  assert.equal(leftover.preview, 5);
  assert.equal(previewInSameSystem(leftover.preview, leftover.body, systems), null);

  const first = windowForMeasure(0, 4, 8, systems);
  assert.equal(previewInSameSystem(first.preview, first.body, systems), 4);
});

test("scroll viewport stays at container width while inner keeps content width", () => {
  const fit = fitScoreWidth(2000, 400, 0.55);
  assert.equal(fit.scroll, true);
  const viewport = sheetViewportSize(2000, 300, fit.scale, 400, fit.scroll);
  assert.ok(viewport.viewportWidth <= 400);
  assert.ok(viewport.innerWidth > viewport.viewportWidth);
  assert.equal(viewport.innerWidth, 2000 * 0.55);
});

test("non-scroll viewport matches the scaled content width", () => {
  const fit = fitScoreWidth(800, 600, 0.55);
  assert.equal(fit.scroll, false);
  const viewport = sheetViewportSize(800, 300, fit.scale, 600, fit.scroll);
  assert.equal(viewport.viewportWidth, viewport.innerWidth);
  assert.ok(viewport.viewportWidth <= 600 + 1e-9);
});
