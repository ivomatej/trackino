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
  // innerText respektuje blokové elementy a přidává správné odřádkování
  const text = (div as HTMLElement).innerText ?? div.textContent ?? '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Konverze HTML → Markdown ─────────────────────────────────────────────────

function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // Nadpisy (H6→H1, order matters)
  for (let i = 6; i >= 1; i--) {
    md = md.replace(new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'),
      '#'.repeat(i) + ' $1\n\n');
  }

  // Tučné
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');

  // Kurzíva
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // Přeškrtnuté
  md = md.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');

  // Kód
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Odkazy
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Odřádkování
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Nečíslované seznamy – zpracuj celý ul blok
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content: string) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });

  // Číslované seznamy
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content: string) => {
    let i = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_match: string, text: string) => `${++i}. ${text}\n`) + '\n';
  });

  // Citace
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c: string) =>
    c.split('\n').map((l: string) => '> ' + l).join('\n') + '\n\n'
  );

  // Odstavce
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n');

  // Odstranit zbývající HTML tagy
  md = md.replace(/<[^>]+>/g, '');

  // Dekódovat HTML entity
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&hellip;/g, '…');
  md = md.replace(/&mdash;/g, '—');
  md = md.replace(/&ndash;/g, '–');

  // Normalizovat mezery
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Ikona kopírování ─────────────────────────────────────────────────────────

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pro starší prohlížeče
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
          Kopírovat
        </>
      )}
    </button>
  );
}

// ─── Hlavní obsah ─────────────────────────────────────────────────────────────

function TextConverterContent() {
  const { currentWorkspace, loading, hasModule } = useWorkspace();
  const router = useRouter();

  const [outputTab, setOutputTab] = useState<'plain' | 'markdown'>('plain');
  const [plainOutput, setPlainOutput] = useState('');
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [hasInput, setHasInput] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const convert = useCallback(() => {
    const html = inputRef.current?.innerHTML ?? '';
    const hasText = (inputRef.current?.innerText ?? '').trim().length > 0;
    setHasInput(hasText);
    if (hasText) {
      setPlainOutput(htmlToPlainText(html));
      setMarkdownOutput(htmlToMarkdown(html));
    } else {
      setPlainOutput('');
      setMarkdownOutput('');
    }
  }, []);

  const clearAll = () => {
    if (inputRef.current) inputRef.current.innerHTML = '';
    setPlainOutput('');
    setMarkdownOutput('');
    setHasInput(false);
  };

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

  const currentOutput = outputTab === 'plain' ? plainOutput : markdownOutput;

  return (
    <DashboardLayout>
      <div>
        {/* Hlavička */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Převodník textu</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Vložte formátovaný text z Wordu nebo webu a převeďte ho na prostý text nebo Markdown
            </p>
          </div>
          {hasInput && (
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

        {/* Dvoupanelový layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ─── Levý panel: vstup ─── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Vstup – formátovaný text
              </span>
            </div>
            <div
              className="rounded-xl border overflow-hidden flex flex-col"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minHeight: 400 }}
            >
              {/* Nástrojová lišta se záložkami / info */}
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
              {/* Editovatelná oblast */}
              <div
                ref={inputRef}
                contentEditable
                suppressContentEditableWarning
                onInput={convert}
                onPaste={() => { setTimeout(convert, 10); }}
                className="flex-1 p-4 focus:outline-none overflow-auto prose prose-sm max-w-none"
                style={{
                  color: 'var(--text-primary)',
                  minHeight: 360,
                }}
                data-placeholder="Sem vložte formátovaný text..."
              />
            </div>
            <style>{`
              [data-placeholder]:empty:before {
                content: attr(data-placeholder);
                color: var(--text-muted);
                pointer-events: none;
              }
            `}</style>
          </div>

          {/* ─── Pravý panel: výstup ─── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Výstup
              </span>
            </div>
            <div
              className="rounded-xl border overflow-hidden flex flex-col"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minHeight: 400 }}
            >
              {/* Záložky výstupního formátu + copy */}
              <div
                className="px-3 py-2 border-b flex items-center justify-between gap-2"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
              >
                {/* Záložky */}
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
                {/* Tlačítko kopírovat */}
                <CopyButton text={currentOutput} disabled={!hasInput} />
              </div>

              {/* Výstupní oblast */}
              <textarea
                readOnly
                value={currentOutput}
                placeholder={hasInput ? 'Konverze…' : 'Výstup se zobrazí zde po vložení textu vlevo'}
                className="flex-1 p-4 resize-none focus:outline-none text-sm font-mono"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  minHeight: 360,
                  border: 'none',
                  colorScheme: 'var(--scheme, light)',
                }}
              />
            </div>

            {/* Tipy */}
            {outputTab === 'markdown' && (
              <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                Tip: Zkopírovaný Markdown můžete vložit do GitHubu, Notion, Obsidianu nebo jiných nástrojů podporujících Markdown.
              </p>
            )}
          </div>
        </div>

        {/* Cheatsheet */}
        <div className="mt-6 p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Co se převádí do Markdownu</p>
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
