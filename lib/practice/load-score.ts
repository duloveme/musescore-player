import { tickToMs, parseMidi, type MidiNote } from "@/lib/midi/parse";
import {
  anchorsInMeasure,
  clusterColumns,
  parseNoteAnchors,
  type NoteAnchor,
  type ScoreBox,
} from "@/lib/score/cursor";
import {
  fileVersionLimitation,
  limitationsFromXml,
  type ScoreLimitation,
} from "@/lib/score/limitations";

export type ScoreNote = {
  timeMs: number;
  pitch: number;
  velocity: number;
  channel: number;
};

export type LoadedScore = {
  title: string;
  fileVersion: number;
  supportedVersion: number;
  measures: number;
  durationMs: number;
  tempoBpm: number;
  timeSignature: string;
  beatsPerMeasure: number;
  hasDrumStaff: boolean;
  svg: string;
  pageSize: { width: number; height: number };
  measuresGeom: ScoreBox[];
  columns: NoteAnchor[];
  notes: ScoreNote[];
  limitations: ScoreLimitation[];
  columnMismatch: boolean;
  savePdf: () => Promise<Uint8Array>;
  destroy: () => void;
};

type ScoreApi = {
  metadata: () => Promise<{
    title: string;
    fileVersion: number;
    measures: number;
    duration: number;
    tempo: number;
    timesig: string;
    parts: { hasDrumStaff: string }[];
  }>;
  measurePositions: () => Promise<{
    elements: { id: number; x: number; y: number; sx: number; sy: number; page: number }[];
    events: { elid: number; position: number }[];
    pageSize: { width: number; height: number };
  }>;
  saveSvg: (page?: number, background?: boolean) => Promise<string>;
  saveMidi: (expandRepeats?: boolean, exportRpns?: boolean) => Promise<Uint8Array>;
  savePdf: () => Promise<Uint8Array>;
  saveXml: () => Promise<string>;
  destroy: (soft?: boolean) => void;
};

type WebMscoreModule = {
  default: {
    ready: Promise<void>;
    version: () => Promise<number>;
    load: (
      format: string,
      data: Uint8Array,
      fonts?: Uint8Array[],
    ) => Promise<ScoreApi>;
  };
};

async function importWebMscore(): Promise<WebMscoreModule["default"]> {
  const importer = new Function("url", "return import(url)") as (
    url: string,
  ) => Promise<WebMscoreModule>;
  const loaded = await importer("/vendor/webmscore/webmscore.mjs");
  return loaded.default;
}

function beatsPerMeasure(timeSignature: string): number {
  const [beats] = timeSignature.split("/");
  const parsed = Number(beats);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

function pairColumns(
  boxes: ScoreBox[],
  anchors: { x: number; y: number }[],
  notes: ScoreNote[],
  durationMs: number,
): { columns: NoteAnchor[]; mismatch: boolean } {
  const columns: NoteAnchor[] = [];
  let mismatch = false;
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    const end = boxes[index + 1]?.timeMs ?? durationMs;
    const local = clusterColumns(anchorsInMeasure(anchors, box));
    const onsets = [
      ...new Set(
        notes
          .filter((note) => note.timeMs >= box.timeMs - 1 && note.timeMs < end - 1)
          .map((note) => note.timeMs),
      ),
    ].sort((a, b) => a - b);
    if (local.length !== onsets.length) mismatch = true;
    local.forEach((column, columnIndex) => {
      const timeMs =
        columnIndex < onsets.length
          ? onsets[columnIndex]
          : box.timeMs + ((columnIndex + 1) / (local.length + 1)) * (end - box.timeMs);
      columns.push({ x: column.x, y: column.y, timeMs });
    });
  }
  return { columns, mismatch };
}

export async function loadScoreFile(bytes: Uint8Array, fontBytes: Uint8Array): Promise<LoadedScore> {
  const WebMscore = await importWebMscore();
  await WebMscore.ready;
  const supportedVersion = await WebMscore.version();
  const score = await WebMscore.load("mscz", bytes, [fontBytes]);
  const meta = await score.metadata();
  const positions = await score.measurePositions();
  const svg = await score.saveSvg(0, false);
  const midi = parseMidi(await score.saveMidi(false, false));
  const xml = await score.saveXml();
  const timeById = new Map(positions.events.map((event) => [event.elid, event.position]));
  const measuresGeom = positions.elements
    .map((element) => ({
      x: element.x,
      y: element.y,
      sx: element.sx,
      sy: element.sy,
      timeMs: timeById.get(element.id) ?? 0,
    }))
    .sort((a, b) => a.timeMs - b.timeMs || a.y - b.y || a.x - b.x);
  const notes: ScoreNote[] = midi.notes.map((note: MidiNote) => ({
    timeMs: tickToMs(midi, note.tick),
    pitch: note.pitch,
    velocity: note.velocity,
    channel: note.channel,
  }));
  const drumNotes = notes.filter((note) => note.channel === 9);
  const usedNotes = drumNotes.length > 0 ? drumNotes : notes;
  const paired = pairColumns(measuresGeom, parseNoteAnchors(svg), usedNotes, meta.duration * 1000);
  const limitations = [
    ...limitationsFromXml(xml),
    fileVersionLimitation(meta.fileVersion, supportedVersion),
  ].filter((item): item is ScoreLimitation => item !== null);
  if (!meta.parts.some((part) => part.hasDrumStaff === "true")) {
    limitations.push({
      code: "no-drum-staff",
      message: "드럼 보표로 인식되지 않았습니다. 음표 위치가 드럼 기보와 다를 수 있습니다.",
    });
  }
  if (paired.mismatch) {
    limitations.push({
      code: "column-mismatch",
      message: "음표 머리와 소리 시작 시각의 개수가 달라, 일부 커서는 마디 길이 비례로 움직입니다.",
    });
  }
  return {
    title: meta.title || "제목 없는 악보",
    fileVersion: meta.fileVersion,
    supportedVersion,
    measures: meta.measures,
    durationMs: meta.duration * 1000,
    tempoBpm: meta.tempo,
    timeSignature: meta.timesig || "4/4",
    beatsPerMeasure: beatsPerMeasure(meta.timesig || "4/4"),
    hasDrumStaff: meta.parts.some((part) => part.hasDrumStaff === "true"),
    svg,
    pageSize: positions.pageSize,
    measuresGeom,
    columns: paired.columns,
    notes: usedNotes,
    limitations,
    columnMismatch: paired.mismatch,
    savePdf: () => score.savePdf(),
    destroy: () => score.destroy(true),
  };
}
