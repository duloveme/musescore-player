import assert from "node:assert/strict";
import test from "node:test";
import { parseMidi, tickToMs } from "./parse.ts";

function writeVar(value: number): number[] {
  const bytes = [value & 0x7f];
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

test("parses channel 10 note-ons and the tempo map", () => {
  const track = [
    ...writeVar(0),
    0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
    ...writeVar(0),
    0x99, 36, 80,
    ...writeVar(480),
    0x99, 38, 80,
    ...writeVar(0),
    0xff, 0x2f, 0x00,
  ];
  const bytes = [
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    0x01, 0xe0,
    0x4d, 0x54, 0x72, 0x6b,
    0x00, 0x00, 0x00, track.length,
    ...track,
  ];
  const midi = parseMidi(Uint8Array.from(bytes));
  assert.equal(midi.ticksPerQuarter, 480);
  assert.equal(midi.notes.length, 2);
  assert.equal(midi.notes[0].channel, 9);
  assert.equal(midi.notes[1].pitch, 38);
  assert.equal(tickToMs(midi, 480), 500);
});
