export type CountInMeasures = 0 | 1 | 2;

export type ScheduledEvent = {
  /** AudioContext time, seconds. */
  when: number;
  accent: boolean;
  /** 1-based beat shown during count-in. 0 for metronome clicks. */
  display: number;
};

export function wallFromScore(
  scoreMs: number,
  originScoreMs: number,
  originContextTime: number,
  rate: number,
): number {
  return originContextTime + (scoreMs - originScoreMs) / 1000 / rate;
}

export function scoreFromWall(
  contextTime: number,
  originScoreMs: number,
  originContextTime: number,
  rate: number,
): number {
  return originScoreMs + (contextTime - originContextTime) * 1000 * rate;
}

/**
 * Count-in is a whole number of bars in the current time signature,
 * even when playback starts after beat 1. The pickup itself is not a count-in.
 */
export function countInSchedule(options: {
  measures: CountInMeasures;
  beatsPerMeasure: number;
  secondsPerBeat: number;
  rate: number;
  startContextTime: number;
}): { events: ScheduledEvent[]; playbackContextTime: number } {
  const beats = options.measures * options.beatsPerMeasure;
  const wallBeat = options.secondsPerBeat / options.rate;
  const events: ScheduledEvent[] = [];
  for (let i = 0; i < beats; i += 1) {
    events.push({
      when: options.startContextTime + i * wallBeat,
      accent: i % options.beatsPerMeasure === 0,
      display: (i % options.beatsPerMeasure) + 1,
    });
  }
  return {
    events,
    playbackContextTime: options.startContextTime + beats * wallBeat,
  };
}

export function measureIndexAt(scoreMs: number, measureStartsMs: number[]): number {
  if (measureStartsMs.length === 0) return 0;
  let index = 0;
  for (let i = 0; i < measureStartsMs.length; i += 1) {
    if (measureStartsMs[i] <= scoreMs) index = i;
  }
  return index;
}

export function beatInMeasure(options: {
  scoreMs: number;
  measureStartMs: number;
  measureEndMs: number;
  beatsPerMeasure: number;
}): number {
  const span = Math.max(1, options.measureEndMs - options.measureStartMs);
  const ratio = (options.scoreMs - options.measureStartMs) / span;
  return Math.min(options.beatsPerMeasure, Math.max(0, ratio * options.beatsPerMeasure));
}
