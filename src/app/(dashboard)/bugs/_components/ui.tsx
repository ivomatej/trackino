'use client';

export function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative inline-flex items-center">
      {children}
      <svg
        className="pointer-events-none absolute right-2.5"
        width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: 'var(--text-muted)' }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

export function ToolbarButtons({ onCmd }: { onCmd: (cmd: string) => void }) {
  return (
    <div className="px-3 py-2 border-b flex flex-wrap gap-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
      {[
        { cmd: 'bold', label: <strong>B</strong>, title: 'Tučné' },
        { cmd: 'italic', label: <em>I</em>, title: 'Kurzíva' },
        { cmd: 'underline', label: <u>U</u>, title: 'Podtržení' },
      ].map(btn => (
        <button
          key={btn.cmd}
          onMouseDown={(e) => { e.preventDefault(); onCmd(btn.cmd); }}
          className="px-2 py-1 rounded text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title={btn.title}
        >
          {btn.label}
        </button>
      ))}
      <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
      <button
        onMouseDown={(e) => { e.preventDefault(); onCmd('insertUnorderedList'); }}
        className="px-2 py-1 rounded text-xs"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        • Seznam
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); onCmd('insertOrderedList'); }}
        className="px-2 py-1 rounded text-xs"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        1. Seznam
      </button>
    </div>
  );
}
