// ─── Konverze HTML → Prostý text ─────────────────────────────────────────────

export function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined' || !html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div as HTMLElement).innerText ?? div.textContent ?? '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Konverze HTML → Markdown ─────────────────────────────────────────────────

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  for (let i = 6; i >= 1; i--) {
    md = md.replace(new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'),
      '#'.repeat(i) + ' $1\n\n');
  }

  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  md = md.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content: string) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content: string) => {
    let i = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, text: string) => `${++i}. ${text}\n`) + '\n';
  });
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c: string) =>
    c.split('\n').map((l: string) => '> ' + l).join('\n') + '\n\n'
  );
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n');
  md = md.replace(/<[^>]+>/g, '');

  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&hellip;/g, '…');
  md = md.replace(/&mdash;/g, '—');
  md = md.replace(/&ndash;/g, '–');

  return md.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Konverze Markdown → HTML ─────────────────────────────────────────────────

export function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md;

  // Kódové bloky (zpracovat první, aby se vyhnuly dalšímu parsování)
  html = html.replace(/```(?:\w*)\n([\s\S]*?)```/g, (_: string, code: string) =>
    `<pre><code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  );

  // Inline kód
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Nadpisy (H6 → H1, delší ## první)
  for (let i = 6; i >= 1; i--) {
    html = html.replace(new RegExp(`^${'#'.repeat(i)} (.+)$`, 'gm'), `<h${i}>$1</h${i}>`);
  }

  // Horizontální čára
  html = html.replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr>');

  // Tučné
  html = html.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');

  // Kurzíva
  html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');

  // Přeškrtnuté
  html = html.replace(/~~([^~\n]+?)~~/g, '<s>$1</s>');

  // Odkazy
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Citace
  html = html.replace(/((?:^> .*$\n?)+)/gm, (match: string) => {
    const inner = match.replace(/^> /gm, '').trim();
    return `<blockquote>${inner}</blockquote>`;
  });

  // Nečíslovaný seznam
  html = html.replace(/((?:^[*\-+] .+$\n?)+)/gm, (match: string) => {
    const items = match.trim().split('\n').map((l: string) =>
      `<li>${l.replace(/^[*\-+] /, '').trim()}</li>`
    ).join('');
    return `<ul>${items}</ul>`;
  });

  // Číslovaný seznam
  html = html.replace(/((?:^\d+\. .+$\n?)+)/gm, (match: string) => {
    const items = match.trim().split('\n').map((l: string) =>
      `<li>${l.replace(/^\d+\. /, '').trim()}</li>`
    ).join('');
    return `<ol>${items}</ol>`;
  });

  // Odstavce: zabalit noblokový obsah do <p>
  const BLOCK_RE = /^<(h[1-6]|ul|ol|blockquote|pre|hr)/;
  const paras = html.split(/\n{2,}/);
  html = paras.map((block: string) => {
    const b = block.trim();
    if (!b) return '';
    if (BLOCK_RE.test(b)) return b;
    return `<p>${b.replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}
