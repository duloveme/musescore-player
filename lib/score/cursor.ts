export type ScoreBox = {
  x: number;
  y: number;
  sx: number;
  sy: number;
  timeMs: number;
};

export type NoteAnchor = {
  x: number;
  y: number;
  timeMs: number;
};

export function parseNoteAnchors(svg: string): { x: number; y: number }[] {
  const anchors: { x: number; y: number }[] = [];
  const pattern = /class="Note" transform="matrix\(([^)]*)\)"/g;
  for (const match of svg.matchAll(pattern)) {
    const numbers = match[1].match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.length >= 6) {
      anchors.push({ x: numbers[4], y: numbers[5] });
    }
  }
  return anchors;
}

export function anchorsInMeasure(
  anchors: { x: number; y: number }[],
  box: ScoreBox,
  pad = 80,
): { x: number; y: number }[] {
  return anchors.filter(
    (anchor) =>
      anchor.x >= box.x - 8 &&
      anchor.x <= box.x + box.sx + 8 &&
      anchor.y >= box.y - pad &&
      anchor.y <= box.y + box.sy + pad,
  );
}

/** Cluster noteheads that share an onset into one column, left to right. */
export function clusterColumns(
  anchors: { x: number; y: number }[],
  tolerance = 6,
): { x: number; y: number }[] {
  const ordered = [...anchors].sort((a, b) => a.x - b.x || a.y - b.y);
  const columns: { x: number; y: number }[] = [];
  for (const anchor of ordered) {
    const last = columns[columns.length - 1];
    if (last && Math.abs(anchor.x - last.x) <= tolerance) continue;
    columns.push(anchor);
  }
  return columns;
}

export function placeCursor(options: {
  scoreMs: number;
  measure: ScoreBox;
  measureEndMs: number;
  columns: NoteAnchor[];
}): { x: number; reliable: boolean } {
  const span = Math.max(1, options.measureEndMs - options.measure.timeMs);
  const local = options.scoreMs - options.measure.timeMs;
  const ratio = Math.min(1, Math.max(0, local / span));
  const columns = [...options.columns]
    .filter(
      (column) =>
        column.timeMs >= options.measure.timeMs - 1 &&
        column.timeMs < options.measureEndMs + 1,
    )
    .sort((a, b) => a.timeMs - b.timeMs);
  if (columns.length < 2) {
    return { x: options.measure.x + ratio * options.measure.sx, reliable: false };
  }
  let left = columns[0];
  let right = columns[columns.length - 1];
  for (let i = 0; i < columns.length - 1; i += 1) {
    if (options.scoreMs >= columns[i].timeMs && options.scoreMs <= columns[i + 1].timeMs) {
      left = columns[i];
      right = columns[i + 1];
      break;
    }
  }
  if (options.scoreMs >= columns[columns.length - 1].timeMs) {
    left = columns[columns.length - 2];
    right = columns[columns.length - 1];
  }
  const timeSpan = right.timeMs - left.timeMs;
  const localRatio = timeSpan === 0 ? 0 : (options.scoreMs - left.timeMs) / timeSpan;
  return { x: left.x + (right.x - left.x) * localRatio, reliable: true };
}
