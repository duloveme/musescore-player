export type SyncPoint = {
  id: string;
  scoreMs: number;
  audioSec: number;
};

export class SyncMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncMapError";
  }
}

function sorted(points: SyncPoint[]): SyncPoint[] {
  return [...points].sort((a, b) => a.scoreMs - b.scoreMs);
}

/** Audio seconds per score second. Defaults to 1:1 when a segment has no neighbor. */
export function slopeAt(points: SyncPoint[], scoreMs: number): number {
  const list = sorted(points);
  if (list.length < 2) return 1;
  let index = 0;
  for (let i = 0; i < list.length - 1; i += 1) {
    if (scoreMs >= list[i].scoreMs) index = i;
  }
  if (scoreMs < list[0].scoreMs) index = 0;
  if (scoreMs >= list[list.length - 1].scoreMs) index = list.length - 2;
  const a = list[index];
  const b = list[index + 1];
  const scoreDelta = (b.scoreMs - a.scoreMs) / 1000;
  if (scoreDelta === 0) {
    throw new SyncMapError("같은 악보 시각에 보정 지점이 두 개 있습니다.");
  }
  const slope = (b.audioSec - a.audioSec) / scoreDelta;
  if (slope <= 0) {
    throw new SyncMapError("보정 지점은 원곡 시간이 뒤로 가면 안 됩니다.");
  }
  return slope;
}

export function scoreMsToAudioSec(points: SyncPoint[], scoreMs: number): number {
  const list = sorted(points);
  if (list.length === 0) return scoreMs / 1000;
  const slope = slopeAt(list, scoreMs);
  let anchor = list[0];
  for (const point of list) {
    if (point.scoreMs <= scoreMs) anchor = point;
    else break;
  }
  if (scoreMs < list[0].scoreMs) anchor = list[0];
  return anchor.audioSec + ((scoreMs - anchor.scoreMs) / 1000) * slope;
}

export function audioSecToScoreMs(points: SyncPoint[], audioSec: number): number {
  const list = sorted(points);
  if (list.length === 0) return audioSec * 1000;
  const lo = Math.min(...list.map((point) => point.scoreMs)) - 60_000;
  const hi = Math.max(...list.map((point) => point.scoreMs)) + 60_000;
  let left = lo;
  let right = hi;
  for (let i = 0; i < 48; i += 1) {
    const mid = (left + right) / 2;
    const audio = scoreMsToAudioSec(list, mid);
    if (audio < audioSec) left = mid;
    else right = mid;
  }
  return (left + right) / 2;
}

export function assertSyncPoints(points: SyncPoint[]): void {
  const list = sorted(points);
  for (let i = 1; i < list.length; i += 1) {
    if (list[i].scoreMs === list[i - 1].scoreMs) {
      throw new SyncMapError("같은 악보 시각에 보정 지점이 두 개 있습니다.");
    }
    if (list[i].audioSec <= list[i - 1].audioSec) {
      throw new SyncMapError("보정 지점은 원곡 시간이 뒤로 가면 안 됩니다.");
    }
  }
}
