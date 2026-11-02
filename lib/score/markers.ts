export type ScoreMarker = {
  measureIndex: number;
  label: string;
};

/** Read rehearsal marks from MusicXML, one label per starting measure. */
export function parseRehearsalMarkers(xml: string): ScoreMarker[] {
  const markers: ScoreMarker[] = [];
  const chunks = xml.split(/<measure\b/i);
  for (let i = 1; i < chunks.length; i += 1) {
    const labels = [...chunks[i].matchAll(/<rehearsal\b[^>]*>([^<]*)<\/rehearsal>/gi)].map((match) =>
      match[1].trim(),
    );
    for (const label of labels) {
      if (label) markers.push({ measureIndex: i - 1, label });
    }
  }
  return markers;
}
