'use client';

import { RefObject } from 'react';
import CopyButton from './CopyButton';
import type { ForwardOutputTab } from './types';

interface ForwardModeProps {
  inputRef: RefObject<HTMLDivElement | null>;
  outputTab: ForwardOutputTab;
  setOutputTab: (tab: ForwardOutputTab) => void;
  forwardOutput: string;
  hasForwardInput: boolean;
  convertForward: () => void;
}

export default function ForwardMode({
  inputRef,
  outputTab,
  setOutputTab,
  forwardOutput,
  hasForwardInput,
  convertForward,
}: ForwardModeProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Levý panel: vstup */}
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
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              Vstup
            </span>
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              · Ctrl+V — formátování bude zachováno
            </span>
          </div>
          <div
            ref={inputRef}
            contentEditable
            suppressContentEditableWarning
            onInput={convertForward}
            onPaste={() => { setTimeout(convertForward, 10); }}
            className="flex-1 p-4 focus:outline-none overflow-auto prose prose-sm max-w-none"
            style={{ color: 'var(--text-primary)' }}
            data-placeholder="Sem vložte formátovaný text..."
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
  );
}
