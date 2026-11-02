export const MEASURE_COUNTS = [2, 4, 8] as const;
export type MeasuresPerScreen = (typeof MEASURE_COUNTS)[number];

export type MeasureWindow = {
  start: number;
  body: number[];
  preview: number | null;
};

/** Group consecutive measures that share a staff-system Y into 0-based system ids. */
export function systemIdsFromYs(ys: number[], tolerance = 40): number[] {
  if (ys.length === 0) return [];
  const ids: number[] = [];
  let systemId = 0;
  let anchorY = ys[0];
  for (let i = 0; i < ys.length; i += 1) {
    if (Math.abs(ys[i] - anchorY) > tolerance) {
      systemId += 1;
      anchorY = ys[i];
    }
    ids.push(systemId);
  }
  return ids;
}

/**
 * 0-based measure index. Preview is the first measure of the next screen and is not part of playback.
 * When `systemIds` is provided, a window never crosses a MuseScore staff-system boundary
 * (unless a single system itself is longer than `perScreen`, in which case it is split).
 */
export function windowForMeasure(
  measureIndex: number,
  perScreen: MeasuresPerScreen,
  totalMeasures: number,
  systemIds?: number[],
): MeasureWindow {
  if (totalMeasures <= 0) {
    return { start: 0, body: [], preview: null };
  }
  const index = Math.min(Math.max(0, measureIndex), totalMeasures - 1);
  const systems =
    systemIds && systemIds.length === totalMeasures ? systemIds : null;

  if (!systems) {
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

  let start = 0;
  while (start < totalMeasures) {
    const systemId = systems[start];
    const body: number[] = [];
    for (let i = start; i < totalMeasures && body.length < perScreen; i += 1) {
      if (systems[i] !== systemId) break;
      body.push(i);
    }
    if (body.length === 0) break;
    if (index >= body[0] && index <= body[body.length - 1]) {
      const previewIndex = body[body.length - 1] + 1;
      return {
        start: body[0],
        body,
        preview: previewIndex < totalMeasures ? previewIndex : null,
      };
    }
    start = body[body.length - 1] + 1;
  }

  return { start: index, body: [index], preview: null };
}

/** Preview is shown in the crop only when it sits on the same staff system as the body. */
export function previewInSameSystem(
  preview: number | null,
  body: number[],
  systemIds: number[],
): number | null {
  if (preview === null || body.length === 0) return null;
  const bodySystem = systemIds[body[0]];
  if (bodySystem === undefined || systemIds[preview] !== bodySystem) return null;
  return preview;
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

export type SheetViewport = {
  viewportWidth: number;
  viewportHeight: number;
  innerWidth: number;
  innerHeight: number;
};

/**
 * When scroll is needed, the viewport is the container width and the inner sheet
 * keeps the full scaled content width so overflow-x can scroll.
 */
export function sheetViewportSize(
  unionWidth: number,
  unionHeight: number,
  scale: number,
  containerWidth: number,
  scroll: boolean,
  maxHeight = 560,
): SheetViewport {
  const innerWidth = Math.max(1, unionWidth * scale);
  const innerHeight = Math.max(1, unionHeight * scale);
  const viewportWidth = scroll ? Math.max(1, containerWidth) : innerWidth;
  const viewportHeight = Math.min(maxHeight, innerHeight);
  return { viewportWidth, viewportHeight, innerWidth, innerHeight };
}
