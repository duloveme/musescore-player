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

/** All measure indexes that sit on the same engraved staff system. */
export function measuresOnSystem(systemIds: number[], systemId: number): number[] {
  const indexes: number[] = [];
  for (let i = 0; i < systemIds.length; i += 1) {
    if (systemIds[i] === systemId) indexes.push(i);
  }
  return indexes;
}

/** First measure of the next staff system after `systemId`, or null at the end. */
export function nextSystemPreview(
  systemIds: number[],
  systemId: number,
): number | null {
  for (let i = 0; i < systemIds.length; i += 1) {
    if (systemIds[i] > systemId) return i;
  }
  return null;
}

/**
 * Split one staff-system's measures into screen bodies.
 * A trailing chunk shorter than `perScreen` is merged into the previous chunk so
 * the next section never opens on a single oversized leftover bar.
 */
export function chunkSystemMeasures(
  measures: number[],
  perScreen: MeasuresPerScreen,
): number[][] {
  if (measures.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < measures.length; i += perScreen) {
    chunks.push(measures.slice(i, i + perScreen));
  }
  if (chunks.length >= 2 && chunks[chunks.length - 1].length < perScreen) {
    const orphan = chunks.pop()!;
    chunks[chunks.length - 1] = [...chunks[chunks.length - 1], ...orphan];
  }
  return chunks;
}

function systemWindows(
  totalMeasures: number,
  perScreen: MeasuresPerScreen,
  systems: number[],
): number[][] {
  const groups = new Map<number, number[]>();
  const order: number[] = [];
  for (let i = 0; i < totalMeasures; i += 1) {
    const systemId = systems[i];
    let group = groups.get(systemId);
    if (!group) {
      group = [];
      groups.set(systemId, group);
      order.push(systemId);
    }
    group.push(i);
  }
  const windows: number[][] = [];
  for (const systemId of order) {
    windows.push(...chunkSystemMeasures(groups.get(systemId) ?? [], perScreen));
  }
  return windows;
}

/**
 * 0-based measure index. Preview is the first measure of the next screen and is not part of playback.
 * When `systemIds` is provided, a window never crosses a MuseScore staff-system boundary
 * (unless a single system itself is longer than `perScreen`, in which case it is split,
 * with orphan leftovers merged into the previous screen on that system).
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

  const windows = systemWindows(totalMeasures, perScreen, systems);
  for (const body of windows) {
    if (index >= body[0] && index <= body[body.length - 1]) {
      const previewIndex = body[body.length - 1] + 1;
      return {
        start: body[0],
        body,
        preview: previewIndex < totalMeasures ? previewIndex : null,
      };
    }
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
  minScale = 0.5,
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
  maxHeight = 640,
): SheetViewport {
  const innerWidth = Math.max(1, unionWidth * scale);
  const innerHeight = Math.max(1, unionHeight * scale);
  const viewportWidth = scroll ? Math.max(1, containerWidth) : innerWidth;
  // Keep a little spare height so section labels and the corner peek do not feel cramped.
  const viewportHeight = Math.min(maxHeight, Math.max(innerHeight, Math.min(innerHeight + 40, maxHeight)));
  return { viewportWidth, viewportHeight, innerWidth, innerHeight };
}

/** Extra crop above/below measure boxes so section labels and low notes are not clipped. */
export const SCORE_TOP_EXTRA = 130;
export const SCORE_BOTTOM_EXTRA = 56;
export const SCORE_PAD = 48;

/** Small peek of the next window's first measure in the upper-right corner. */
export const PREVIEW_PEEK_SCALE = 0.42;
