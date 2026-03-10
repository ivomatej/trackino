// ─── Calendar Module – Timed-event overlap layout ─────────────────────────────
// Přesunuto z page.tsx (ř. 313–372)

import type { DisplayEvent } from './types';

export interface LayoutEvt extends DisplayEvent {
  _col: number;
  _totalCols: number;
  _startMin: number;
  _endMin: number;
}

/** Greedy column layout pro překrývající se časové události.
 *  Vrátí pole s `_col` (0-based sloupec), `_totalCols` a přepočítanými minutami. */
export function layoutTimedEvents(evs: DisplayEvent[]): LayoutEvt[] {
  if (evs.length === 0) return [];
  const mapped: LayoutEvt[] = evs.map(ev => {
    const parts = (ev.start_time ?? '00:00').split(':');
    const sh = parseInt(parts[0] ?? '0', 10);
    const sm = parseInt(parts[1] ?? '0', 10);
    const startMin = sh * 60 + sm;
    let endMin = startMin + 60;
    if (ev.end_time) {
      const ep = ev.end_time.split(':');
      endMin = parseInt(ep[0] ?? '0', 10) * 60 + parseInt(ep[1] ?? '0', 10);
    }
    return { ...ev, _col: 0, _totalCols: 1, _startMin: startMin, _endMin: Math.max(startMin + 15, endMin) };
  });

  // Seřadit podle začátku, delší nejdříve při stejném začátku
  mapped.sort((a, b) => a._startMin - b._startMin || b._endMin - a._endMin);

  // Greedy přiřazení sloupců
  const colEnds: number[] = [];
  for (const ev of mapped) {
    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= ev._startMin) {
        ev._col = c;
        colEnds[c] = ev._endMin;
        placed = true;
        break;
      }
    }
    if (!placed) {
      ev._col = colEnds.length;
      colEnds.push(ev._endMin);
    }
  }

  // Spočítej totalCols = max(col)+1 mezi všemi přímo překrývajícími se událostmi
  for (const ev of mapped) {
    let maxCol = ev._col;
    for (const other of mapped) {
      if (other._startMin < ev._endMin && other._endMin > ev._startMin) {
        maxCol = Math.max(maxCol, other._col);
      }
    }
    ev._totalCols = maxCol + 1;
  }

  return mapped;
}
