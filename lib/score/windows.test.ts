import assert from "node:assert/strict";
import test from "node:test";
import {
  fitScoreWidth,
  measuresOnSystem,
  measuresPerScreenFromCount,
  nextSystemPreview,
  preferredSystemViewportWidth,
  sheetViewportSize,
  systemIdsFromYs,
  windowForMeasure,
} from "./windows.ts";

test("without system ids, 4-bar windows still preview the next downbeat", () => {
  const first = windowForMeasure(0, 4, 9);
  assert.deepEqual(first.body, [0, 1, 2, 3]);
  assert.equal(first.preview, 4);

  const next = windowForMeasure(4, 4, 9);
  assert.deepEqual(next.body, [4, 5, 6, 7]);
  assert.equal(next.preview, 8);
});

test("the last fixed window has no preview measure", () => {
  const last = windowForMeasure(8, 4, 9);
  assert.deepEqual(last.body, [8]);
  assert.equal(last.preview, null);
});

test("dense measures scroll only below the scale floor", () => {
  const comfortable = fitScoreWidth(800, 600, 0.42);
  assert.equal(comfortable.scroll, false);
  assert.ok(comfortable.scale >= 0.42);

  const dense = fitScoreWidth(2000, 400, 0.42);
  assert.equal(dense.scroll, true);
  assert.equal(dense.scale, 0.42);
});

test("system ids cluster measures that share a staff-system Y", () => {
  assert.deepEqual(
    systemIdsFromYs([717, 717, 718, 1399, 1400, 1398]),
    [0, 0, 0, 1, 1, 1],
  );
});

test("practice windows follow MuseScore staff systems", () => {
  // Synthetic fixture: 5 bars then 3 bars.
  const systems = systemIdsFromYs([717, 717, 717, 717, 717, 1399, 1399, 1399]);
  assert.deepEqual(systems, [0, 0, 0, 0, 0, 1, 1, 1]);
  assert.deepEqual(measuresOnSystem(systems, 0), [0, 1, 2, 3, 4]);
  assert.equal(nextSystemPreview(systems, 0), 5);

  const first = windowForMeasure(0, 4, 8, systems);
  assert.deepEqual(first.body, [0, 1, 2, 3, 4]);
  assert.equal(first.preview, 5);

  const mid = windowForMeasure(4, 4, 8, systems);
  assert.deepEqual(mid.body, [0, 1, 2, 3, 4]);

  const second = windowForMeasure(5, 4, 8, systems);
  assert.deepEqual(second.body, [5, 6, 7]);
  assert.equal(second.preview, null);
});

test("settings enum snaps from system length without driving layout", () => {
  assert.equal(measuresPerScreenFromCount(5), 8);
  assert.equal(measuresPerScreenFromCount(3), 4);
  assert.equal(measuresPerScreenFromCount(2), 2);
});

test("preferred viewport widens so a five-bar system stays readable", () => {
  const widened = preferredSystemViewportWidth(2500, 1000, 0.55);
  assert.equal(widened, Math.ceil(2500 * 0.55));
  assert.ok(widened > 1000);
});

test("scroll viewport can grow to the full scaled system width", () => {
  const fit = fitScoreWidth(2000, 400, 0.42);
  assert.equal(fit.scroll, true);
  const viewport = sheetViewportSize(2000, 300, fit.scale, 400, fit.scroll);
  assert.equal(viewport.innerWidth, 2000 * 0.42);
  assert.ok(viewport.viewportWidth >= viewport.innerWidth);
});

test("fitted viewport uses the container width", () => {
  const fit = fitScoreWidth(800, 600, 0.42);
  assert.equal(fit.scroll, false);
  const viewport = sheetViewportSize(800, 300, fit.scale, 600, fit.scroll);
  assert.equal(viewport.viewportWidth, 600);
  assert.ok(Math.abs(viewport.innerWidth - 800 * fit.scale) < 1e-6);
});
