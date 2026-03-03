// Trackino – sdílené utility funkce

/**
 * Formátuje telefonní číslo pro zobrazení (přidává mezery mezi skupiny číslic).
 * V databázi a při kopírování do schránky se číslo uchovává BEZ mezer.
 *
 * Příklady:
 *   "+420608510232"  → "+420 608 510 232"  (česká čísla)
 *   "+14155552671"   → "+1 415 555 267 1"  (USA – obecný fallback)
 *   "+44207946000"   → "+44 207 946 000"   (UK)
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Normalizovat – odebrat veškeré mezery (pro případ, že číslo bylo uloženo s mezerami)
  const normalized = phone.replace(/\s+/g, '');

  // Česká čísla: +420 + přesně 9 číslic → "+420 XXX XXX XXX"
  const czMatch = normalized.match(/^(\+420)(\d{3})(\d{3})(\d{3})$/);
  if (czMatch) {
    return `${czMatch[1]} ${czMatch[2]} ${czMatch[3]} ${czMatch[4]}`;
  }

  // Obecný formát: kód země (+1–3 číslice) + zbývající číslice ve skupinách po 3
  const genericMatch = normalized.match(/^(\+\d{1,3})(\d+)$/);
  if (genericMatch) {
    const countryCode = genericMatch[1];
    const digits = genericMatch[2];
    const groups = digits.match(/.{1,3}/g) ?? [];
    return `${countryCode} ${groups.join(' ')}`;
  }

  // Fallback – vrátit beze změny
  return phone;
}

/**
 * Odstraní mezery z telefonního čísla.
 * Používá se před uložením do databáze, aby bylo číslo konzistentně bez mezer.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, '');
}
