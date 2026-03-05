'use client';

import { useState, useRef, useCallback } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { useRouter } from 'next/navigation';

// ─── Konverze HTML → Prostý text ─────────────────────────────────────────────

function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined' || !html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div as HTMLElement).innerText ?? div.textContent ?? '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Konverze HTML → Markdown ─────────────────────────────────────────────────

function htmlToMarkdown(html: string): string {
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

function markdownToHtml(md: string): string {
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

// ─── Ikona kopírování ─────────────────────────────────────────────────────────

function CopyButton({ text, disabled, label }: { text: string; disabled?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={disabled || !text}
      title={copied ? 'Zkopírováno!' : 'Kopírovat do schránky'}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        borderColor: copied ? 'var(--success)' : 'var(--border)',
        color: copied ? 'var(--success)' : 'var(--text-secondary)',
        background: copied ? 'var(--success-light)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!copied && text) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = 'transparent'; }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Zkopírováno
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label ?? 'Kopírovat'}
        </>
      )}
    </button>
  );
}

// ─── Hlavní obsah ─────────────────────────────────────────────────────────────

function TextConverterContent() {
  const { currentWorkspace, loading, hasModule } = useWorkspace();
  const router = useRouter();

  // Mód: forward = Formátovaný → Text/Markdown, reverse = Markdown → Formátovaný/Prostý
  const [mode, setMode] = useState<'forward' | 'reverse'>('forward');

  // Stav pro mód forward
  const [outputTab, setOutputTab] = useState<'plain' | 'markdown'>('plain');
  const [plainOutput, setPlainOutput] = useState('');
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [hasForwardInput, setHasForwardInput] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  // Stav pro mód reverse
  const [markdownInput, setMarkdownInput] = useState('');
  const [reverseHtml, setReverseHtml] = useState('');
  const [reversePlain, setReversePlain] = useState('');
  const [reverseTab, setReverseTab] = useState<'formatted' | 'plain'>('formatted');
  const previewRef = useRef<HTMLDivElement>(null);

  // Konverze forward (HTML → plain/markdown)
  const convertForward = useCallback(() => {
    const html = inputRef.current?.innerHTML ?? '';
    const hasText = (inputRef.current?.innerText ?? '').trim().length > 0;
    setHasForwardInput(hasText);
    if (hasText) {
      setPlainOutput(htmlToPlainText(html));
      setMarkdownOutput(htmlToMarkdown(html));
    } else {
      setPlainOutput('');
      setMarkdownOutput('');
    }
  }, []);

  // Konverze reverse (Markdown → HTML/plain)
  const convertReverse = useCallback((md: string) => {
    if (!md.trim()) {
      setReverseHtml('');
      setReversePlain('');
      return;
    }
    const html = markdownToHtml(md);
    setReverseHtml(html);
    setReversePlain(htmlToPlainText(html));
  }, []);

  const clearAll = () => {
    if (mode === 'forward') {
      if (inputRef.current) inputRef.current.innerHTML = '';
      setPlainOutput('');
      setMarkdownOutput('');
      setHasForwardInput(false);
    } else {
      setMarkdownInput('');
      setReverseHtml('');
      setReversePlain('');
    }
  };

  const hasAnyInput = mode === 'forward' ? hasForwardInput : markdownInput.trim().length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentWorkspace) return <WorkspaceSelector />;

  if (!hasModule('text_converter')) {
    return (
      <DashboardLayout>
        <div className="max-w-xl">
          <h1 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Převodník textu</h1>
          <div className="p-6 rounded-xl border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Modul není dostupný</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Převodník textu je dostupný pouze v tarifu <strong>Max</strong>.
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ background: 'var(--primary)' }}
            >
              Přejít na nastavení
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const forwardOutput = outputTab === 'plain' ? plainOutput : markdownOutput;

  return (
    <DashboardLayout>
      <div>
        {/* Hlavička */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Převodník textu</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Převádějte mezi formátovaným textem, Markdownem a prostým textem
            </p>
          </div>
          {hasAnyInput && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Vymazat vše
            </button>
          )}
        </div>

        {/* Přepínač módu */}
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--bg-hover)' }}>
          <button
            onClick={() => setMode('forward')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: mode === 'forward' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'forward' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === 'forward' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h10M4 18h7" />
            </svg>
            Formátovaný text → Text / Markdown
          </button>
          <button
            onClick={() => setMode('reverse')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: mode === 'reverse' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'reverse' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === 'reverse' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10H7M21 6H3M21 14H3M21 18H7" />
            </svg>
            Markdown → Formátovaný text / Prostý text
          </button>
        </div>

        {/* ─── MÓD FORWARD: Formátovaný text → Text/Markdown ─── */}
        {mode === 'forward' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Levý panel: vstup */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Vstup – formátovaný text
              </span>
              <div
                className="rounded-xl border overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minHeight: 400 }}
              >
                <div
                  className="px-3 py-2 border-b flex items-center gap-2"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Vložte text Ctrl+V — formátování bude zachováno
                  </span>
                </div>
                <div
                  ref={inputRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={convertForward}
                  onPaste={() => { setTimeout(convertForward, 10); }}
                  className="flex-1 p-4 focus:outline-none overflow-auto prose prose-sm max-w-none"
                  style={{ color: 'var(--text-primary)', minHeight: 360 }}
                  data-placeholder="Sem vložte formátovaný text..."
                />
              </div>
            </div>

            {/* Pravý panel: výstup */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Výstup
              </span>
              <div
                className="rounded-xl border overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minHeight: 400 }}
              >
                <div
                  className="px-3 py-2 border-b flex items-center justify-between gap-2"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
                >
                  <div className="flex gap-1">
                    {([
                      { key: 'plain' as const, label: 'Prostý text' },
                      { key: 'markdown' as const, label: 'Markdown' },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setOutputTab(tab.key)}
                        className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                        style={{
                          background: outputTab === tab.key ? 'var(--bg-card)' : 'transparent',
                          color: outputTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                          boxShadow: outputTab === tab.key ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <CopyButton text={forwardOutput} disabled={!hasForwardInput} />
                </div>
                <textarea
                  readOnly
                  value={forwardOutput}
                  placeholder={hasForwardInput ? 'Konverze…' : 'Výstup se zobrazí zde po vložení textu vlevo'}
                  className="flex-1 p-4 resize-none focus:outline-none text-base sm:text-sm font-mono"
                  style={{
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    minHeight: 360,
                    border: 'none',
                  }}
                />
              </div>
              {outputTab === 'markdown' && (
                <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                  Tip: Zkopírovaný Markdown vložte do GitHubu, Notion, Obsidianu nebo jiných nástrojů podporujících Markdown.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ─── MÓD REVERSE: Markdown → Formátovaný/Prostý ─── */}
        {mode === 'reverse' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Levý panel: Markdown vstup */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Vstup – Markdown
              </span>
              <div
                className="rounded-xl border overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minHeight: 400 }}
              >
                <div
                  className="px-3 py-2 border-b flex items-center gap-2"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <path d="M21 10H7M21 6H3M21 14H3M21 18H7" />
                  </svg>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Zadejte nebo vložte Markdown text
                  </span>
                </div>
                <textarea
                  value={markdownInput}
                  onChange={(e) => {
                    setMarkdownInput(e.target.value);
                    convertReverse(e.target.value);
                  }}
                  placeholder={'# Nadpis\n\n**Tučné**, *kurzíva*, ~~přeškrtnuté~~\n\n- Položka 1\n- Položka 2\n\n[Odkaz](https://example.com)'}
                  className="flex-1 p-4 resize-none focus:outline-none text-base sm:text-sm font-mono"
                  style={{
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    minHeight: 360,
                    border: 'none',
                  }}
                />
              </div>
            </div>

            {/* Pravý panel: výstup */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Výstup
              </span>
              <div
                className="rounded-xl border overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minHeight: 400 }}
              >
                <div
                  className="px-3 py-2 border-b flex items-center justify-between gap-2"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
                >
                  <div className="flex gap-1">
                    {([
                      { key: 'formatted' as const, label: 'Formátovaný text' },
                      { key: 'plain' as const, label: 'Prostý text' },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setReverseTab(tab.key)}
                        className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                        style={{
                          background: reverseTab === tab.key ? 'var(--bg-card)' : 'transparent',
                          color: reverseTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                          boxShadow: reverseTab === tab.key ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {/* Copy plain text v obou záložkách */}
                  <CopyButton
                    text={reverseTab === 'plain' ? reversePlain : reverseHtml}
                    disabled={!markdownInput.trim()}
                    label={reverseTab === 'plain' ? 'Kopírovat' : 'Kopírovat HTML'}
                  />
                </div>

                {/* Formátovaný text – renderovaný náhled */}
                {reverseTab === 'formatted' ? (
                  <div
                    ref={previewRef}
                    className="flex-1 p-4 overflow-auto prose prose-sm max-w-none"
                    style={{ color: 'var(--text-primary)', minHeight: 360 }}
                    dangerouslySetInnerHTML={{ __html: reverseHtml || '<p style="color:var(--text-muted)">Náhled se zobrazí zde po zadání Markdownu vlevo</p>' }}
                  />
                ) : (
                  /* Prostý text */
                  <textarea
                    readOnly
                    value={reversePlain}
                    placeholder="Prostý text se zobrazí zde po zadání Markdownu vlevo"
                    className="flex-1 p-4 resize-none focus:outline-none text-base sm:text-sm font-mono"
                    style={{
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      minHeight: 360,
                      border: 'none',
                    }}
                  />
                )}
              </div>
              {reverseTab === 'formatted' && markdownInput.trim() && (
                <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                  Tlačítko „Kopírovat HTML" zkopíruje zdrojový HTML kód. Pro vložení do emailu nebo Wordu označte text v náhledu a zkopírujte jej ručně (Ctrl+C).
                </p>
              )}
            </div>
          </div>
        )}

        {/* Cheatsheet */}
        <div className="mt-6 p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'forward' ? 'Co se převádí do Markdownu' : 'Podporované Markdown prvky'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {[
              ['Nadpisy H1–H6', '# Nadpis'],
              ['Tučné', '**text**'],
              ['Kurzíva', '*text*'],
              ['Přeškrtnuté', '~~text~~'],
              ['Nečíslovaný seznam', '- položka'],
              ['Číslovaný seznam', '1. položka'],
              ['Odkaz', '[text](url)'],
              ['Kód', '`kód`'],
            ].map(([label, example]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span>{label}</span>
                <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--primary)' }}>{example}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
        .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 { color: var(--text-primary); margin: 0.75em 0 0.3em; }
        .prose p { color: var(--text-secondary); margin: 0.3em 0; line-height: 1.6; }
        .prose ul { margin: 0.3em 0 0.3em 1.5em; list-style-type: disc; }
        .prose ol { margin: 0.3em 0 0.3em 1.5em; list-style-type: decimal; }
        .prose li { color: var(--text-secondary); margin: 0.15em 0; }
        .prose strong { font-weight: 700; color: var(--text-primary); }
        .prose a { color: var(--primary); text-decoration: underline; }
        .prose blockquote { border-left: 3px solid var(--border); padding-left: 1em; color: var(--text-muted); margin: 0.5em 0; }
        .prose pre { background: var(--bg-hover); padding: 0.75em 1em; border-radius: 6px; overflow-x: auto; }
        .prose code { background: var(--bg-hover); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.85em; }
        .prose hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
      `}</style>
    </DashboardLayout>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function TextConverterPage() {
  return (
    <WorkspaceProvider>
      <TextConverterContent />
    </WorkspaceProvider>
  );
}
