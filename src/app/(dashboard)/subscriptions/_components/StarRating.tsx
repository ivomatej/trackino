'use client';

import { useState } from 'react';
import { ICONS } from './constants';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}

export function StarRating({ value, onChange, readonly }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          className="p-0 border-0 bg-transparent"
          style={{
            color: i <= (hover || value) ? '#f59e0b' : 'var(--text-muted)',
            cursor: readonly ? 'default' : 'pointer',
            opacity: readonly ? 0.8 : 1,
          }}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          {i <= (hover || value) ? ICONS.star : ICONS.starEmpty}
        </button>
      ))}
    </span>
  );
}
