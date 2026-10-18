export type ScoreLimitation = {
  code: "repeats" | "jumps" | "newer-file" | "no-drum-staff" | "segment-cursor" | "column-mismatch";
  message: string;
};

export function limitationsFromXml(xml: string): ScoreLimitation[] {
  const found: ScoreLimitation[] = [];
  if (/<endRepeat|<startRepeat|<Repeat\b|<\/Repeat>/.test(xml)) {
    found.push({
      code: "repeats",
      message: "반복 기호가 있습니다. 재생은 악보에 적힌 순서를 한 번 따라가며, 반복 전개는 아직 지원하지 않습니다.",
    });
  }
  if (/dacapo|dalsegno|fine|coda|to\s*coda/i.test(xml)) {
    found.push({
      code: "jumps",
      message: "D.C. D.S. Coda Fine 점프가 보입니다. 이 구조의 실제 연주 순서는 아직 따라가지 않습니다.",
    });
  }
  return found;
}

export function fileVersionLimitation(fileVersion: number, supported: number): ScoreLimitation | null {
  if (fileVersion > supported) {
    return {
      code: "newer-file",
      message: `이 악보 형식은 ${fileVersion}이고, 지금 읽을 수 있는 형식은 ${supported}까지입니다. 더 새로운 MuseScore Studio 파일은 마디나 기호가 빠질 수 있습니다.`,
    };
  }
  return null;
}
