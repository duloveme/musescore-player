import assert from "node:assert/strict";
import test from "node:test";
import {
  audioSecToScoreMs,
  scoreMsToAudioSec,
  slopeAt,
  type SyncPoint,
} from "./mapping.ts";

const anchor: SyncPoint[] = [{ id: "a", scoreMs: 0, audioSec: 0.5 }];

test("a single anchor keeps a 1:1 map after the lead-in", () => {
  assert.equal(scoreMsToAudioSec(anchor, 0), 0.5);
  assert.equal(scoreMsToAudioSec(anchor, 2000), 2.5);
  assert.ok(Math.abs(audioSecToScoreMs(anchor, 2.5) - 2000) < 1);
});

test("points warp the middle and keep the outer slope", () => {
  const points: SyncPoint[] = [
    { id: "a", scoreMs: 0, audioSec: 1 },
    { id: "b", scoreMs: 4000, audioSec: 3 },
    { id: "c", scoreMs: 8000, audioSec: 9 },
  ];
  assert.equal(slopeAt(points, 2000), 0.5);
  assert.equal(scoreMsToAudioSec(points, 2000), 2);
  assert.equal(slopeAt(points, 6000), 1.5);
  assert.equal(scoreMsToAudioSec(points, 6000), 6);
  assert.equal(scoreMsToAudioSec(points, 10000), 12);
  assert.ok(Math.abs(audioSecToScoreMs(points, 6) - 6000) < 1);
});

test("speed is not baked into the map", () => {
  const audio = scoreMsToAudioSec(anchor, 1000);
  assert.equal(audio, 1.5);
});
