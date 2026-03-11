'use client';

/** Ikona rozdělení – dvě horizontální čáry */
export function IconSplit() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="1" y1="4" x2="11" y2="4" />
      <line x1="1" y1="8" x2="11" y2="8" />
    </svg>
  );
}

/** Ikona sloučení – šipky sbíhající se k čáře */
export function IconMerge() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,2 6,5 9,2" />
      <line x1="6" y1="5" x2="6" y2="7" />
      <polyline points="3,10 6,7 9,10" />
    </svg>
  );
}
