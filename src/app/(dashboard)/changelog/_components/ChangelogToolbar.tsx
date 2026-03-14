'use client';

interface ChangelogToolbarProps {
  execCmd: (cmd: string, value?: string) => void;
}

export function ChangelogToolbar({ execCmd }: ChangelogToolbarProps) {
  const btnCls = 'px-2 py-1 rounded text-xs';
  const btnStyle = { color: 'var(--text-secondary)' };
  const onEnter = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = 'var(--border)';
  const onLeave = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.background = 'transparent';

  return (
    <div
      className="px-3 py-2 border-b flex flex-wrap gap-1"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}
    >
      {/* Nadpisy */}
      <button
        onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h2'); }}
        className={`${btnCls} font-bold`}
        style={btnStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Nadpis H2"
      >H2</button>
      <button
        onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h3'); }}
        className={`${btnCls} font-semibold`}
        style={btnStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Podnadpis H3"
      >H3</button>
      <button
        onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'p'); }}
        className={btnCls}
        style={btnStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Normální text"
      >¶</button>

      <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />

      {/* Formátování textu */}
      {[
        { cmd: 'bold',      label: <strong>B</strong>, title: 'Tučné' },
        { cmd: 'italic',    label: <em>I</em>,          title: 'Kurzíva' },
        { cmd: 'underline', label: <u>U</u>,             title: 'Podtržení' },
      ].map(btn => (
        <button
          key={btn.cmd}
          onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
          className="px-2 py-1 rounded text-sm font-medium"
          style={btnStyle}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          title={btn.title}
        >
          {btn.label}
        </button>
      ))}

      <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />

      {/* Seznamy */}
      <button
        onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }}
        className={btnCls}
        style={btnStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >• Seznam</button>
      <button
        onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }}
        className={btnCls}
        style={btnStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >1. Seznam</button>
    </div>
  );
}
