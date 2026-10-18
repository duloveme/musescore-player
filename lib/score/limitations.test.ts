import assert from "node:assert/strict";
import test from "node:test";
import { fileVersionLimitation, limitationsFromXml } from "./limitations.ts";

test("names repeats and jumps instead of ignoring them", () => {
  const found = limitationsFromXml('<Repeat><endRepeat/> D.S. al Coda');
  assert.deepEqual(found.map((item) => item.code), ["repeats", "jumps"]);
});

test("flags files newer than the engine", () => {
  assert.equal(fileVersionLimitation(460, 400)?.code, "newer-file");
  assert.equal(fileVersionLimitation(400, 400), null);
});
