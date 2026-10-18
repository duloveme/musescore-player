import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "./safe-next.ts";

test("keeps relative paths and drops external redirects", () => {
  assert.equal(safeNextPath("/songs/1"), "/songs/1");
  assert.equal(safeNextPath("https://evil.example"), "/songs");
  assert.equal(safeNextPath("//evil.example"), "/songs");
  assert.equal(safeNextPath(null), "/songs");
});
