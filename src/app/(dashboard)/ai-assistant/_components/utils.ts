// Helper funkce pro AI asistent

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

// Přibližný odhad tokenů klientsky (1 token ≈ 3.8 znaků)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
export function extractUrls(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) ?? [])];
}

// Auto-generuje titulek konverzace z prvních 55 znaků první zprávy
export function autoTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, ' ');
  return clean.length > 55 ? clean.slice(0, 52) + '…' : clean;
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="ai-code-block" data-lang="${lang || 'code'}"><code>${escHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>[^]*?<\/li>)+)/gm, '<ul class="ai-ul">$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

// Extrahuje prostý text z HTML obsahu promptu
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
