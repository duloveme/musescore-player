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
 * 0-based measure index.
 * With MuseScore `systemIds`, each engraved staff system is one practice screen.
 * Without system ids, falls back to fixed `perScreen` blocks (tests / legacy).
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

  if (systems) {
    const systemId = systems[index];
    const body = measuresOnSystem(systems, systemId);
    return {
      start: body[0] ?? index,
      body,
      preview: nextSystemPreview(systems, systemId),
    };
  }

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

/** Map a system length onto the stored settings enum without driving layout. */
export function measuresPerScreenFromCount(count: number): MeasuresPerScreen {
  if (count <= 2) return 2;
  if (count <= 4) return 4;
  return 8;
}

export type FitDecision = {
  scale: number;
  scroll: boolean;
};

/**
 * Fit the cropped staff system into the container width.
 * Prefer showing the whole system; only scroll when the scale would go below minScale.
 */
export function fitScoreWidth(
  unionWidthPx: number,
  containerPx: number,
  minScale = 0.42,
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

/**
 * Preferred viewport width so a system stays readable: widen past the stage
 * when the natural container would force an unreadably small scale.
 */
export function preferredSystemViewportWidth(
  unionWidthPx: number,
  containerPx: number,
  minComfortScale = 0.55,
): number {
  if (unionWidthPx <= 0) return Math.max(1, containerPx);
  const comfortable = unionWidthPx * minComfortScale;
  return Math.max(containerPx, Math.ceil(comfortable));
}

export type SheetViewport = {
  viewportWidth: number;
  viewportHeight: number;
  innerWidth: number;
  innerHeight: number;
};

/**
 * When scroll is needed, the viewport can grow wider than the stage so the
 * full system remains visible via page/stage horizontal scroll.
 */
export function sheetViewportSize(
  unionWidth: number,
  unionHeight: number,
  scale: number,
  containerPx: number,
  scroll: boolean,
  maxHeight = 640,
): SheetViewport {
  const innerWidth = Math.max(1, unionWidth * scale);
  const innerHeight = Math.max(1, unionHeight * scale);
  const viewportWidth = scroll ? Math.max(containerPx, innerWidth) : Math.max(1, containerPx);
  const viewportHeight = Math.min(maxHeight, Math.max(innerHeight, Math.min(innerHeight + 40, maxHeight)));
  return { viewportWidth, viewportHeight, innerWidth, innerHeight };
}

/** Extra crop above/below measure boxes so section labels and low notes are not clipped. */
export const SCORE_TOP_EXTRA = 130;
export const SCORE_BOTTOM_EXTRA = 56;
export const SCORE_PAD = 48;

/** Small peek of the next staff system under the main sheet. */
export const PREVIEW_PEEK_SCALE = 0.42;
