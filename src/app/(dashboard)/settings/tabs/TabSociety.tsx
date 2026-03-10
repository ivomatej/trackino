'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Workspace } from '@/types/database';

interface Props {
  currentWorkspace: Workspace;
  onMessage: (msg: string) => void;
  refreshWorkspace: () => Promise<void>;
}

export default function TabSociety({ currentWorkspace, onMessage, refreshWorkspace }: Props) {
  const [societyModules, setSocietyModules] = useState({
    knowledge_base: true,
    documents: true,
    company_rules: true,
    office_rules: true,
  });
  const [savingSociety, setSavingSociety] = useState(false);

  useEffect(() => {
    const sc = currentWorkspace.society_modules_enabled ?? {};
    setSocietyModules({
      knowledge_base: (sc as Record<string, boolean>).knowledge_base !== false,
      documents: (sc as Record<string, boolean>).documents !== false,
      company_rules: (sc as Record<string, boolean>).company_rules !== false,
      office_rules: (sc as Record<string, boolean>).office_rules !== false,
    });
  }, [currentWorkspace]);

  async function saveSocietyModules() {
    setSavingSociety(true);
    await supabase
      .from('trackino_workspaces')
      .update({ society_modules_enabled: societyModules })
      .eq('id', currentWorkspace.id);
    await refreshWorkspace();
    setSavingSociety(false);
    onMessage('Nastavení sekce Společnost uloženo.');
    setTimeout(() => onMessage(''), 3000);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sekce Společnost</h2>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
          Sekce Společnost obsahuje firemní dokumenty, pravidla a znalostní bázi. Moduly jsou dostupné od tarifu Pro.
          Jako správce workspace můžete jednotlivé moduly vypnout – uživatelé je pak neuvidí v navigaci.
        </p>

        <div className="space-y-3">
          {([
            { key: 'knowledge_base' as const, label: 'Znalostní báze', desc: 'Interní wiki a znalostní databáze týmu' },
            { key: 'documents' as const, label: 'Dokumenty', desc: 'Správa firemních dokumentů, souborů a odkazů' },
            { key: 'company_rules' as const, label: 'Firemní pravidla', desc: 'Editovatelná textová stránka s firemními pravidly' },
            { key: 'office_rules' as const, label: 'Pravidla v kanceláři', desc: 'Editovatelná textová stránka s kancelářskými pravidly' },
          ]).map(mod => (
            <label
              key={mod.key}
              className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
              style={{
                background: societyModules[mod.key] ? 'var(--bg-active)' : 'var(--bg-hover)',
                border: `1px solid ${societyModules[mod.key] ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              <input
                type="checkbox"
                checked={societyModules[mod.key]}
                onChange={e => setSocietyModules(prev => ({ ...prev, [mod.key]: e.target.checked }))}
                className="mt-0.5 flex-shrink-0 w-4 h-4 accent-[var(--primary)]"
              />
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{mod.label}</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mod.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-5">
          <button
            onClick={saveSocietyModules}
            disabled={savingSociety}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {savingSociety ? 'Ukládám...' : 'Uložit nastavení'}
          </button>
        </div>
      </div>
    </div>
  );
}
