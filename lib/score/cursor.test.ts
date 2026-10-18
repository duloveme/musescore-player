import assert from "node:assert/strict";
import test from "node:test";
import { clusterColumns, parseNoteAnchors, placeCursor } from "./cursor.ts";

test("reads notehead x from the SVG matrix and ignores equal spacing", () => {
  const svg =
    '<path class="Note" transform="matrix(1,0,0,1,100,40)"/>' +
    '<path class="Note" transform="matrix(1,0,0,1,100,70)"/>' +
    '<path class="Note" transform="matrix(1,0,0,1,400,40)"/>';
  const anchors = parseNoteAnchors(svg);
  const columns = clusterColumns(anchors);
  assert.deepEqual(columns.map((column) => column.x), [100, 400]);

  const early = placeCursor({
    scoreMs: 250,
    measure: { x: 80, y: 0, sx: 500, sy: 100, timeMs: 0 },
    measureEndMs: 2000,
    columns: [
      { x: 100, y: 40, timeMs: 0 },
      { x: 400, y: 40, timeMs: 1000 },
    ],
  });
  assert.equal(early.reliable, true);
  assert.equal(early.x, 175);
});
