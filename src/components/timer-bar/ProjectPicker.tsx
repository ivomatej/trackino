'use client';

import type { RefObject } from 'react';
import type { Project } from '@/types/database';

interface ProjectPickerProps {
  isBottomBar: boolean;
  selectedProject: string;
  selectedProjectObj: Project | undefined;
  selectedProjectClientName: string;
  projectPickerRef: RefObject<HTMLDivElement | null>;
  projectDropdownRef: RefObject<HTMLDivElement | null>;
  showProjectPicker: boolean;
  projectPickerPos: { top: number; left: number; width: number } | null;
  projectSearch: string;
  sortedClientEntries: [string, Project[]][];
  filteredProjects: Project[];
  projects: Project[];
  setSelectedProject: (id: string) => void;
  setShowProjectPicker: (show: boolean) => void;
  setProjectSearch: (search: string) => void;
  setProjectPickerPos: (pos: { top: number; left: number; width: number } | null) => void;
  setShowTaskPicker: (show: boolean) => void;
  setTaskSearch: (search: string) => void;
}

export function ProjectPicker({
  isBottomBar,
  selectedProject, selectedProjectObj, selectedProjectClientName,
  projectPickerRef, projectDropdownRef,
  showProjectPicker, projectPickerPos, projectSearch,
  sortedClientEntries, filteredProjects, projects,
  setSelectedProject, setShowProjectPicker, setProjectSearch, setProjectPickerPos,
  setShowTaskPicker, setTaskSearch,
}: ProjectPickerProps) {
  return (
    <div className="relative flex-shrink-0" ref={projectPickerRef}>
      <button
        onClick={(e) => {
          if (showProjectPicker) { setShowProjectPicker(false); setProjectSearch(''); return; }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const w = Math.min(320, window.innerWidth - 16);
          setProjectPickerPos({ top: isBottomBar ? Math.max(8, rect.top - 324) : rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)), width: w });
          setShowTaskPicker(false); setTaskSearch(''); setProjectSearch('');
          setShowProjectPicker(true);
        }}
        className={`flex items-center gap-1.5 ${isBottomBar ? 'px-2.5 py-2' : 'px-2 py-1.5'} rounded-lg transition-colors`}
        style={{
          color: selectedProject ? 'var(--text-primary)' : 'var(--text-muted)',
          background: selectedProject ? ((selectedProjectObj?.color ?? 'var(--primary)') + '18') : 'transparent',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = selectedProject ? ((selectedProjectObj?.color ?? 'var(--primary)') + '28') : 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = selectedProject ? ((selectedProjectObj?.color ?? 'var(--primary)') + '18') : 'transparent'}
        title={
          selectedProjectClientName
            ? `${selectedProjectClientName} · ${selectedProjectObj?.name}`
            : selectedProjectObj?.name ?? 'Projekt'
        }
      >
        {selectedProject ? (
          <>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: selectedProjectObj?.color ?? 'var(--primary)' }} />
            <span className="hidden sm:block text-xs truncate max-w-[140px]">
              {selectedProjectClientName ? `${selectedProjectClientName} · ` : ''}{selectedProjectObj?.name}
            </span>
          </>
        ) : (
          <svg width={isBottomBar ? 18 : 16} height={isBottomBar ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {showProjectPicker && projectPickerPos && (
        <div
          ref={projectDropdownRef}
          className="fixed rounded-lg border shadow-lg z-[9999] max-h-80 overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', top: projectPickerPos?.top ?? 0, left: projectPickerPos?.left ?? 0, width: projectPickerPos?.width ?? 320 }}
        >
          {/* Vyhledávání */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Hledat projekt nebo klienta..."
              className="w-full px-2.5 py-1.5 rounded-md border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>

          <div className="overflow-y-auto py-1">
            <button
              onClick={() => { setSelectedProject(''); setShowProjectPicker(false); setProjectSearch(''); }}
              className="w-full text-left px-3 py-2 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Žádný projekt
            </button>

            {sortedClientEntries.map(([client, clientProjs]) => (
              <div key={client}>
                {/* Klient header */}
                <div
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider mt-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {client}
                </div>
                {clientProjs.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProject(p.id); setShowProjectPicker(false); setProjectSearch(''); }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2"
                    style={{ color: 'var(--text-primary)', background: p.id === selectedProject ? 'var(--bg-active)' : 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = p.id === selectedProject ? 'var(--bg-active)' : 'transparent'}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            ))}

            {filteredProjects.length === 0 && projectSearch && (
              <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Žádné výsledky pro &ldquo;{projectSearch}&rdquo;
              </div>
            )}
            {projects.length === 0 && (
              <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Vytvořte projekt v sekci Projekty.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
