'use client';

export function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: color, color: '#fff', fontSize: size * 0.4, fontWeight: 600, lineHeight: 1 }}>
      {initials}
    </div>
  );
}
