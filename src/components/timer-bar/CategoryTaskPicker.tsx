'use client';

import type { RefObject } from 'react';
import type { Category, Task } from '@/types/database';

interface CategoryTaskPickerProps {
  isBottomBar: boolean;
  selectedCategory: string;
  selectedTask: string;
  selectedCategoryObj: Category | undefined;
  selectedTaskObj: Task | undefined;
  taskPickerRef: RefObject<HTMLDivElement | null>;
  taskDropdownRef: RefObject<HTMLDivElement | null>;
  showTaskPicker: boolean;
  taskPickerPos: { top: number; left: number; width: number } | null;
  taskSearch: string;
  taskStructure: (Category & { matchedTasks: Task[] })[];
  orphanTasks: Task[];
  categories: Category[];
  tasks: Task[];
  setSelectedCategory: (id: string) => void;
  setSelectedTask: (id: string) => void;
  setShowTaskPicker: (show: boolean) => void;
  setTaskSearch: (search: string) => void;
  setTaskPickerPos: (pos: { top: number; left: number; width: number } | null) => void;
  setShowProjectPicker: (show: boolean) => void;
  setProjectSearch: (search: string) => void;
}

export function CategoryTaskPicker({
  isBottomBar,
  selectedCategory, selectedTask, selectedCategoryObj, selectedTaskObj,
  taskPickerRef, taskDropdownRef,
  showTaskPicker, taskPickerPos, taskSearch,
  taskStructure, orphanTasks, categories, tasks,
  setSelectedCategory, setSelectedTask,
  setShowTaskPicker, setTaskSearch, setTaskPickerPos,
  setShowProjectPicker, setProjectSearch,
}: CategoryTaskPickerProps) {
  return (
    <div className="relative flex-shrink-0" ref={taskPickerRef}>
      <button
        onClick={(e) => {
          if (showTaskPicker) { setShowTaskPicker(false); setTaskSearch(''); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const w = Math.min(280, window.innerWidth - 16);
          setTaskPickerPos({ top: isBottomBar ? Math.max(8, rect.top - 324) : rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)), width: w });
          setShowProjectPicker(false); setProjectSearch(''); setTaskSearch('');
          setShowTaskPicker(true);
        }}
        className={`flex items-center gap-1.5 ${isBottomBar ? 'px-2.5 py-2' : 'px-2 py-1.5'} rounded-lg transition-colors`}
        style={{
          color: selectedTask || selectedCategory ? 'var(--primary)' : 'var(--text-muted)',
          background: (selectedTask || selectedCategory) ? 'var(--primary)18' : 'transparent',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = (selectedTask || selectedCategory) ? 'var(--primary)28' : 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = (selectedTask || selectedCategory) ? 'var(--primary)18' : 'transparent'}
        title={
          selectedCategoryObj && selectedTaskObj
            ? `${selectedCategoryObj.name} · ${selectedTaskObj.name}`
            : selectedCategoryObj?.name ?? selectedTaskObj?.name ?? 'Kategorie / Úkol'
        }
      >
        {selectedCategory || selectedTask ? (
          <>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />
            <span className="hidden sm:block text-xs truncate max-w-[140px]">
              {selectedCategoryObj?.name ?? ''}
              {selectedCategoryObj && selectedTaskObj ? ' · ' : ''}
              {selectedTaskObj?.name ?? ''}
            </span>
          </>
        ) : (
          <svg width={isBottomBar ? 18 : 16} height={isBottomBar ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        )}
      </button>

      {showTaskPicker && taskPickerPos && (
        <div
          ref={taskDropdownRef}
          className="fixed rounded-lg border shadow-lg z-[9999] max-h-80 overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', top: taskPickerPos?.top ?? 0, left: taskPickerPos?.left ?? 0, width: taskPickerPos?.width ?? 280 }}
        >
          {/* Vyhledávání */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Hledat kategorii nebo úkol..."
              className="w-full px-2.5 py-1.5 rounded-md border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>

          <div className="overflow-y-auto py-1">
            {/* Reset */}
            {(selectedCategory || selectedTask) && (
              <button
                onClick={() => { setSelectedCategory(''); setSelectedTask(''); }}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors border-b mb-1"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Zrušit výběr
              </button>
            )}

            {/* Kategorie s úkoly (grouped) */}
            {taskStructure.map(cat => (
              <div key={cat.id}>
                {/* Kategorie řádek */}
                <button
                  onClick={() => {
                    if (selectedCategory === cat.id) {
                      setSelectedCategory('');
                      setSelectedTask('');
                    } else {
                      setSelectedCategory(cat.id);
                      // Pokud vybraný úkol nepatří do nové kategorie, smaž ho
                      if (selectedTask) {
                        const taskBelongs = tasks.find(t => t.id === selectedTask)?.category_id === cat.id;
                        if (!taskBelongs) setSelectedTask('');
                      }
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2"
                  style={{
                    color: cat.id === selectedCategory ? 'var(--primary)' : 'var(--text-primary)',
                    background: cat.id === selectedCategory ? 'var(--bg-active)' : 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = cat.id === selectedCategory ? 'var(--bg-active)' : 'transparent'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span className="truncate">{cat.name}</span>
                </button>

                {/* Úkoly pod kategorií */}
                {cat.matchedTasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedTask(t.id);
                      setShowTaskPicker(false);
                      setTaskSearch('');
                    }}
                    className="w-full text-left pl-7 pr-3 py-1.5 text-xs transition-colors truncate flex items-center gap-1.5"
                    style={{
                      color: t.id === selectedTask ? 'var(--primary)' : 'var(--text-secondary)',
                      background: t.id === selectedTask ? 'var(--bg-active)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = t.id === selectedTask ? 'var(--bg-active)' : 'transparent'}
                  >
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'currentColor', opacity: 0.4 }} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            ))}

            {/* Úkoly bez kategorie */}
            {orphanTasks.length > 0 && (
              <>
                {taskStructure.length > 0 && <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />}
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Bez kategorie
                </div>
                {orphanTasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTask(t.id);
                      setSelectedCategory('');
                      setShowTaskPicker(false);
                      setTaskSearch('');
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors truncate"
                    style={{
                      color: t.id === selectedTask ? 'var(--primary)' : 'var(--text-primary)',
                      background: t.id === selectedTask ? 'var(--bg-active)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = t.id === selectedTask ? 'var(--bg-active)' : 'transparent'}
                  >
                    {t.name}
                  </button>
                ))}
              </>
            )}

            {taskStructure.length === 0 && orphanTasks.length === 0 && taskSearch && (
              <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Žádné výsledky pro &ldquo;{taskSearch}&rdquo;
              </div>
            )}

            {categories.length === 0 && tasks.length === 0 && (
              <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Vytvořte kategorie a úkoly v sekci Tým.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
