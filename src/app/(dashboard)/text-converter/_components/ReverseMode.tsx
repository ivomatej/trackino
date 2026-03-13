'use client';

import { useRef } from 'react';
import CopyButton from './CopyButton';
import type { ReverseOutputTab } from './types';

interface ReverseModeProps {
  markdownInput: string;
  setMarkdownInput: (v: string) => void;
  reverseHtml: string;
  reversePlain: string;
  reverseTab: ReverseOutputTab;
  setReverseTab: (tab: ReverseOutputTab) => void;
  convertReverse: (md: string) => void;
}

export default function ReverseMode({
  markdownInput,
  setMarkdownInput,
  reverseHtml,
  reversePlain,
  reverseTab,
  setReverseTab,
  convertReverse,
}: ReverseModeProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Levý panel: Markdown vstup */}
      <div className="flex flex-col">
        <div
          className="rounded-xl border overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', height: 480 }}
        >
          <div
            className="px-4 h-[46px] border-b flex items-center gap-2.5 flex-shrink-0"
            style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <path d="M21 10H7M21 6H3M21 14H3M21 18H7" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              Vstup – Markdown
            </span>
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              · Zadejte nebo vložte Markdown
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
              border: 'none',
            }}
          />
        </div>
      </div>

      {/* Pravý panel: výstup */}
      <div className="flex flex-col gap-2">
        <div
          className="rounded-xl border overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', height: 480 }}
        >
          <div
            className="px-4 h-[46px] border-b flex items-center justify-between gap-2 flex-shrink-0"
            style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                Výstup
              </span>
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
              style={{ color: 'var(--text-primary)' }}
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
  );
}
