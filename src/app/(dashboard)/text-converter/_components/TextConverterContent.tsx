'use client';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { useRouter } from 'next/navigation';
import { useTextConverter } from './useTextConverter';
import ForwardMode from './ForwardMode';
import ReverseMode from './ReverseMode';

export default function TextConverterContent() {
  const { currentWorkspace, loading, hasModule } = useWorkspace();
  const router = useRouter();

  const {
    mode, setMode,
    outputTab, setOutputTab,
    hasForwardInput,
    inputRef,
    markdownInput, setMarkdownInput,
    reverseHtml, reversePlain,
    reverseTab, setReverseTab,
    convertForward, convertReverse, clearAll,
    hasAnyInput, forwardOutput,
  } = useTextConverter();

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
      <DashboardLayout moduleName="Převodník textu">
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

  return (
    <DashboardLayout moduleName="Převodník textu">
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

        {/* Mód forward */}
        {mode === 'forward' && (
          <ForwardMode
            inputRef={inputRef}
            outputTab={outputTab}
            setOutputTab={setOutputTab}
            forwardOutput={forwardOutput}
            hasForwardInput={hasForwardInput}
            convertForward={convertForward}
          />
        )}

        {/* Mód reverse */}
        {mode === 'reverse' && (
          <ReverseMode
            markdownInput={markdownInput}
            setMarkdownInput={setMarkdownInput}
            reverseHtml={reverseHtml}
            reversePlain={reversePlain}
            reverseTab={reverseTab}
            setReverseTab={setReverseTab}
            convertReverse={convertReverse}
          />
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
