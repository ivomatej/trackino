'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Tag } from '@/types/database';

interface TagPickerProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export default function TagPicker({ selectedTagIds, onChange }: TagPickerProps) {
  const { currentWorkspace, currentMembership } = useWorkspace();
  const [tags, setTags] = useState<Tag[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Skrýt pokud workspace má globální skrytí nebo uživatel má per-member skrytí
  const hidden = currentWorkspace?.hide_tags_globally === true || currentMembership?.hide_tags === true;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPicker(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchTags = useCallback(async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('trackino_tags')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('name');
    setTags((data ?? []) as Tag[]);
  }, [currentWorkspace]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  if (hidden) return null;

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const filteredTags = tags.filter(t => {
    if (!search) return true;
    return t.name.toLowerCase().includes(search.toLowerCase());
  });

  const hasSelection = selectedTagIds.length > 0;

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        onClick={() => { setShowPicker(!showPicker); setSearch(''); }}
        className="p-2 rounded-lg transition-colors relative"
        style={{ color: hasSelection ? 'var(--primary)' : 'var(--text-muted)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="Štítky"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path d="M6 6h.008v.008H6V6z" />
        </svg>
        {hasSelection && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white px-1"
            style={{ background: 'var(--primary)' }}
          >
            {selectedTagIds.length}
          </span>
        )}
      </button>

      {showPicker && (
        <div
          className="absolute top-full right-0 mt-1 rounded-lg border shadow-lg z-50 max-h-72 overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: '280px' }}
        >
          {/* Vyhledávání */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat štítek..."
              className="w-full px-2.5 py-1.5 rounded-md border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>

          <div className="overflow-y-auto py-1">
            {/* Vybrané tagy nahoře */}
            {selectedTagIds.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Odebrat všechny štítky
              </button>
            )}

            {filteredTags.map(tag => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2"
                  style={{
                    color: 'var(--text-primary)',
                    background: selected ? 'var(--bg-active)' : 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = selected ? 'var(--bg-active)' : 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    readOnly
                    className="w-3.5 h-3.5 rounded"
                    style={{ accentColor: tag.color }}
                  />
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                  <span className="truncate">{tag.name}</span>
                </button>
              );
            })}

            {filteredTags.length === 0 && search && (
              <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Žádné výsledky pro &ldquo;{search}&rdquo;
              </div>
            )}

            {tags.length === 0 && (
              <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Vytvořte štítky v sekci Štítky.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
