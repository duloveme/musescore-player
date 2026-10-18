import assert from "node:assert/strict";
import test from "node:test";
import { objectFileName, validateUpload } from "./validate.ts";

test("accepts mscz and common audio extensions", () => {
  assert.equal(validateUpload({ name: "악보.MSCZ", size: 1200 }).kind, "score");
  assert.equal(validateUpload({ name: "song.m4a", size: 10 }).extension, "m4a");
  assert.equal(objectFileName("mp3"), "original.mp3");
});

test("rejects musicxml and oversized audio", () => {
  assert.throws(() => validateUpload({ name: "score.musicxml", size: 10 }), /mscz/);
  assert.throws(() => validateUpload({ name: "big.wav", size: 81 * 1024 * 1024 }), /80MB/);
});
