'use client';

interface HelpToolbarProps {
  execCmd: (cmd: string, value?: string) => void;
  insertLink: () => void;
}

export function HelpToolbar({ execCmd, insertLink }: HelpToolbarProps) {
  const btnCls = 'px-2 py-1 rounded text-xs';
  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'var(--border)'; },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent'; },
  };

  return (
    <div className="px-3 py-2 border-b flex flex-wrap gap-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
      {/* Nadpisy */}
      <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h2'); }} className={`${btnCls} font-bold`} style={{ color: 'var(--text-secondary)' }} {...hoverHandlers} title="Nadpis H2">H2</button>
      <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h3'); }} className={`${btnCls} font-semibold`} style={{ color: 'var(--text-secondary)' }} {...hoverHandlers} title="Podnadpis H3">H3</button>
      <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'p'); }} className={btnCls} style={{ color: 'var(--text-secondary)' }} {...hoverHandlers} title="Normální text">¶</button>
      <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />

      {/* Formátování textu */}
      {[
        { cmd: 'bold', label: <strong>B</strong>, title: 'Tučné (Ctrl+B)' },
        { cmd: 'italic', label: <em>I</em>, title: 'Kurzíva (Ctrl+I)' },
        { cmd: 'underline', label: <u>U</u>, title: 'Podtržení (Ctrl+U)' },
      ].map(btn => (
        <button
          key={btn.cmd}
          onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
          className="px-2 py-1 rounded text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
          {...hoverHandlers}
          title={btn.title}
        >
          {btn.label}
        </button>
      ))}
      <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />

      {/* Seznamy a odkaz */}
      <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }} className={btnCls} style={{ color: 'var(--text-secondary)' }} {...hoverHandlers} title="Odrážky">• Seznam</button>
      <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }} className={btnCls} style={{ color: 'var(--text-secondary)' }} {...hoverHandlers} title="Číselný seznam">1. Seznam</button>
      <button onMouseDown={(e) => { e.preventDefault(); insertLink(); }} className={btnCls} style={{ color: 'var(--text-secondary)' }} {...hoverHandlers} title="Odkaz">🔗 Odkaz</button>
    </div>
  );
}
