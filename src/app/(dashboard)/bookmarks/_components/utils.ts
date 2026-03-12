export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getDomain(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

export function getFaviconUrl(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ''; }
}
