import assert from "node:assert/strict";
import test from "node:test";
import {
  beatInMeasure,
  countInSchedule,
  measureIndexAt,
  scoreFromWall,
  wallFromScore,
} from "./timeline.ts";

test("the audio clock and the score clock invert each other", () => {
  const wall = wallFromScore(2000, 500, 10, 0.5);
  assert.equal(wall, 13);
  assert.equal(scoreFromWall(13, 500, 10, 0.5), 2000);
});

test("one bar of count-in at half speed lasts twice as long", () => {
  const full = countInSchedule({
    measures: 1,
    beatsPerMeasure: 4,
    secondsPerBeat: 0.5,
    rate: 1,
    startContextTime: 5,
  });
  assert.equal(full.events.length, 4);
  assert.equal(full.events[0].display, 1);
  assert.equal(full.events[0].accent, true);
  assert.equal(full.playbackContextTime, 7);

  const slow = countInSchedule({
    measures: 1,
    beatsPerMeasure: 4,
    secondsPerBeat: 0.5,
    rate: 0.5,
    startContextTime: 0,
  });
  assert.equal(slow.playbackContextTime, 4);
  assert.equal(slow.events[3].when, 3);
});

test("a mid-measure start still gets a full count-in bar", () => {
  const scheduled = countInSchedule({
    measures: 2,
    beatsPerMeasure: 4,
    secondsPerBeat: 0.5,
    rate: 1,
    startContextTime: 0,
  });
  assert.equal(scheduled.events.length, 8);
  assert.deepEqual(
    scheduled.events.map((event) => event.display),
    [1, 2, 3, 4, 1, 2, 3, 4],
  );
});

test("measure lookup uses score time, not equal pixels", () => {
  const starts = [0, 2000, 5000];
  assert.equal(measureIndexAt(4999, starts), 1);
  assert.equal(measureIndexAt(5000, starts), 2);
  assert.equal(beatInMeasure({
    scoreMs: 2500,
    measureStartMs: 2000,
    measureEndMs: 5000,
    beatsPerMeasure: 4,
  }), 4 * (500 / 3000));
});
