import assert from "node:assert/strict";
import test from "node:test";
import { parseRehearsalMarkers } from "./markers.ts";

test("parses rehearsal marks onto measure indexes", () => {
  const xml = `
    <measure number="1"><rehearsal>Intro</rehearsal></measure>
    <measure number="2"><rehearsal font-weight="bold">Verse</rehearsal></measure>
    <measure number="3"></measure>
    <measure number="4"><rehearsal>Chorus</rehearsal></measure>
  `;
  assert.deepEqual(parseRehearsalMarkers(xml), [
    { measureIndex: 0, label: "Intro" },
    { measureIndex: 1, label: "Verse" },
    { measureIndex: 3, label: "Chorus" },
  ]);
});
