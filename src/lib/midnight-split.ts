/**
 * Půlnoční split – rozdělí časový úsek na segmenty, kde každý nepřekročí půlnoc.
 * Příklad: 23:00 → 00:30 se rozdělí na [23:00-00:00, 00:00-00:30]
 */

export interface TimeSegment {
  start: Date;
  end: Date;
}

export function splitAtMidnight(start: Date, end: Date): TimeSegment[] {
  const segments: TimeSegment[] = [];
  let current = new Date(start);

  while (current < end) {
    const nextMidnight = new Date(current);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    if (nextMidnight >= end) {
      // Konec je před půlnocí – poslední segment
      segments.push({ start: new Date(current), end: new Date(end) });
      break;
    }

    // Segment do půlnoci
    segments.push({ start: new Date(current), end: new Date(nextMidnight) });
    current = nextMidnight;
  }

  return segments;
}

/**
 * Kontroluje, zda timer přetéká přes půlnoc (start je z jiného dne než teď).
 */
export function crossesMidnight(startTime: Date): boolean {
  const now = new Date();
  return startTime.toDateString() !== now.toDateString();
}
