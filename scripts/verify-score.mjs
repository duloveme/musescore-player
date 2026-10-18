import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMidi, tickToMs } from "../lib/midi/parse.ts";
import { patchNodeShim } from "./vendor-engines.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
patchNodeShim();

const originalFetch = globalThis.fetch?.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = raw.startsWith("file:") ? new URL(raw).pathname : raw;
  if (!/^https?:/i.test(path)) {
    const bytes = readFileSync(path);
    const type = path.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
    return new Response(bytes, { status: 200, headers: { "Content-Type": type } });
  }
  if (!originalFetch) throw new Error(`unexpected network fetch: ${path}`);
  return originalFetch(input, init);
};

const { default: WebMscore } = await import("webmscore");
await WebMscore.ready;
const supported = await WebMscore.version();
const scoreBytes = readFileSync(resolve(root, "public/fixtures/synthetic-drums.mscz"));
const fontBytes = readFileSync(resolve(root, "public/fonts/wqy-microhei.ttc"));
const score = await WebMscore.load("mscz", new Uint8Array(scoreBytes), [new Uint8Array(fontBytes)]);
const meta = await score.metadata();
const positions = await score.measurePositions();
const svg = await score.saveSvg(0, false);
const midi = await score.saveMidi(false, false);
const pdf = await score.savePdf();
const xml = await score.saveXml();
let segmentError = null;
try {
  await score.segmentPositions();
} catch (error) {
  segmentError = error instanceof Error ? error.message : String(error);
}

const parsed = parseMidi(midi);
const drumNotes = parsed.notes.filter((note) => note.channel === 9 && note.velocity > 0);

const report = {
  source: "synthetic",
  file: "public/fixtures/synthetic-drums.mscz",
  supportedFormat: supported,
  fileVersion: meta.fileVersion,
  title: meta.title,
  measures: meta.measures,
  durationSec: meta.duration,
  tempo: meta.tempo,
  timesig: meta.timesig,
  hasDrumStaff: meta.parts?.map((part) => part.hasDrumStaff),
  measureCount: positions.elements.length,
  measureTimesMs: positions.events.map((event) => event.position),
  noteHeads: (svg.match(/class="Note"/g) ?? []).length,
  titleInSvgText: svg.includes("연습"),
    midiBytes: midi.length,
    drumPitches: [...new Set(drumNotes.map((note) => note.pitch))].sort((a, b) => a - b),
    firstDrumMs: drumNotes.slice(0, 4).map((note) => Math.round(tickToMs(parsed, note.tick))),
  pdfHeader: Buffer.from(pdf.slice(0, 5)).toString("utf8"),
  xmlHasUseDrumset: xml.includes("<useDrumset>"),
  segmentError,
};

const failures = [];
if (supported !== 400) failures.push(`supported format ${supported}`);
if (meta.measures !== 8) failures.push(`measures ${meta.measures}`);
if (!meta.parts?.some((part) => part.hasDrumStaff === "true")) failures.push("no drum staff");
if (Math.abs(meta.duration - 16) > 0.2) failures.push(`duration ${meta.duration}`);
if (meta.tempo !== 120) failures.push(`tempo ${meta.tempo}`);
if ((svg.match(/class="Note"/g) ?? []).length < 8) failures.push("missing noteheads");
if (!drumNotes.some((note) => note.pitch === 36) || !drumNotes.some((note) => note.pitch === 38)) {
  failures.push("missing kick or snare");
}
if (!Buffer.from(pdf.slice(0, 5)).toString("utf8").startsWith("%PDF")) failures.push("pdf");
if (!segmentError) failures.push("segmentPositions unexpectedly succeeded; re-check the cursor path");

score.destroy(true);
mkdirSync("/opt/cursor/artifacts", { recursive: true });
writeFileSync("/opt/cursor/artifacts/score-verify.json", JSON.stringify({ report, failures }, null, 2));
console.log(JSON.stringify({ report, failures }, null, 2));
if (failures.length) process.exit(1);
