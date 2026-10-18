export const MEASURE_COUNTS = [2, 4, 8] as const;
export type MeasuresPerScreen = (typeof MEASURE_COUNTS)[number];

export type MeasureWindow = {
  start: number;
  body: number[];
  preview: number | null;
};

/** 0-based measure index. Preview is the first measure of the next screen and is not part of playback. */
export function windowForMeasure(
  measureIndex: number,
  perScreen: MeasuresPerScreen,
  totalMeasures: number,
): MeasureWindow {
  if (totalMeasures <= 0) {
    return { start: 0, body: [], preview: null };
  }
  const index = Math.min(Math.max(0, measureIndex), totalMeasures - 1);
  const start = Math.floor(index / perScreen) * perScreen;
  const body: number[] = [];
  for (let i = start; i < Math.min(start + perScreen, totalMeasures); i += 1) {
    body.push(i);
  }
  const previewIndex = start + perScreen;
  return {
    start,
    body,
    preview: previewIndex < totalMeasures ? previewIndex : null,
  };
}

export type FitDecision = {
  scale: number;
  scroll: boolean;
};

/**
 * Shrink the cropped measures to the container, but stop at minScale.
 * Denser measures scroll sideways instead of overlapping notes.
 */
export function fitScoreWidth(
  unionWidthPx: number,
  containerPx: number,
  minScale = 0.55,
): FitDecision {
  if (unionWidthPx <= 0 || containerPx <= 0) {
    return { scale: 1, scroll: false };
  }
  const natural = containerPx / unionWidthPx;
  if (natural >= minScale) {
    return { scale: natural, scroll: false };
  }
  return { scale: minScale, scroll: true };
}
