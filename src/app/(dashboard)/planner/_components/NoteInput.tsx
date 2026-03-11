'use client';

import { useState } from 'react';

interface NoteInputProps {
  initialNote: string;
  onSave: (note: string) => void;
}

export function NoteInput({ initialNote, onSave }: NoteInputProps) {
  const [note, setNote] = useState(initialNote);
  return (
    <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka (zobrazí se při najetí myší)</p>
      <textarea
        rows={2}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Volitelná poznámka..."
        className="w-full px-2 py-1.5 rounded-lg text-base sm:text-sm border outline-none resize-none"
        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      />
      <button
        onClick={() => onSave(note)}
        className="mt-1.5 w-full py-1 rounded-lg text-xs font-medium text-white transition-colors"
        style={{ background: 'var(--primary)' }}
      >
        Uložit poznámku
      </button>
    </div>
  );
}
