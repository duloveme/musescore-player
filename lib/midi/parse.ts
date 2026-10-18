export type MidiNote = {
  tick: number;
  channel: number;
  pitch: number;
  velocity: number;
};

export type MidiTempo = {
  tick: number;
  microsecondsPerQuarter: number;
};

export type ParsedMidi = {
  ticksPerQuarter: number;
  notes: MidiNote[];
  tempos: MidiTempo[];
};

function readVar(data: Uint8Array, offset: { value: number }): number {
  let value = 0;
  while (offset.value < data.length) {
    const byte = data[offset.value++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("잘린 MIDI 파일입니다.");
}

export function parseMidi(bytes: Uint8Array): ParsedMidi {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (type !== "MThd") throw new Error("MIDI 파일이 아닙니다.");
  const headerLength = view.getUint32(4);
  const tracks = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) {
    throw new Error("SMPTE 시간 분할 MIDI는 지원하지 않습니다.");
  }
  let offset = 8 + headerLength;
  const notes: MidiNote[] = [];
  const tempos: MidiTempo[] = [];
  for (let track = 0; track < tracks; track += 1) {
    const marker = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    if (marker !== "MTrk") throw new Error("MIDI 트랙이 손상되었습니다.");
    const length = view.getUint32(offset + 4);
    offset += 8;
    const end = offset + length;
    const cursor = { value: offset };
    let tick = 0;
    let status = 0;
    while (cursor.value < end) {
      tick += readVar(bytes, cursor);
      let byte = bytes[cursor.value];
      if (byte >= 0x80) {
        status = bytes[cursor.value++];
        byte = status;
      }
      if (status === 0xff) {
        const meta = bytes[cursor.value++];
        const size = readVar(bytes, cursor);
        if (meta === 0x51 && size === 3) {
          const microseconds =
            (bytes[cursor.value] << 16) |
            (bytes[cursor.value + 1] << 8) |
            bytes[cursor.value + 2];
          tempos.push({ tick, microsecondsPerQuarter: microseconds });
        }
        cursor.value += size;
      } else if (status === 0xf0 || status === 0xf7) {
        cursor.value += readVar(bytes, cursor);
      } else if (status >= 0x80) {
        const kind = status & 0xf0;
        const channel = status & 0x0f;
        const data1 = bytes[cursor.value++];
        const data2 = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[cursor.value++];
        if (kind === 0x90 && data2 > 0) {
          notes.push({ tick, channel, pitch: data1, velocity: data2 });
        }
      } else {
        throw new Error("MIDI 이벤트 상태가 없습니다.");
      }
    }
    offset = end;
  }
  if (tempos.length === 0) tempos.push({ tick: 0, microsecondsPerQuarter: 500000 });
  return { ticksPerQuarter: division, notes, tempos };
}

export function tickToMs(midi: ParsedMidi, tick: number): number {
  const tempos = [...midi.tempos].sort((a, b) => a.tick - b.tick);
  let ms = 0;
  let cursor = 0;
  let microseconds = tempos[0].microsecondsPerQuarter;
  for (const tempo of tempos) {
    if (tempo.tick >= tick) break;
    const span = tempo.tick - cursor;
    ms += (span / midi.ticksPerQuarter) * (microseconds / 1000);
    cursor = tempo.tick;
    microseconds = tempo.microsecondsPerQuarter;
  }
  ms += ((tick - cursor) / midi.ticksPerQuarter) * (microseconds / 1000);
  return ms;
}

const DRUM_NAMES: Record<number, string> = {
  35: "킥",
  36: "킥",
  38: "스네어",
  40: "스네어",
  42: "하이햇",
  44: "하이햇",
  46: "오픈 하이햇",
  49: "크래시",
  51: "라이드",
  41: "탐",
  43: "탐",
  45: "탐",
  47: "탐",
  48: "탐",
  50: "탐",
};

export function drumName(pitch: number): string | null {
  return DRUM_NAMES[pitch] ?? null;
}
