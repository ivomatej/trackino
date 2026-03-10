'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Workspace, RequiredFields } from '@/types/database';

interface Props {
  currentWorkspace: Workspace;
  onMessage: (msg: string) => void;
  refreshWorkspace: () => Promise<void>;
}

export default function TabFields({ currentWorkspace, onMessage, refreshWorkspace }: Props) {
  const [saving, setSaving] = useState(false);
  const [requiredFields, setRequiredFields] = useState<RequiredFields>({
    project: false, category: false, task: false, description: false, tag: false,
  });
  const [hideTagsGlobally, setHideTagsGlobally] = useState(false);

  useEffect(() => {
    setRequiredFields(currentWorkspace.required_fields);
    setHideTagsGlobally(currentWorkspace.hide_tags_globally ?? false);
  }, [currentWorkspace]);

  async function saveRequiredFields() {
    setSaving(true);
    const { error } = await supabase
      .from('trackino_workspaces')
      .update({ required_fields: requiredFields, hide_tags_globally: hideTagsGlobally })
      .eq('id', currentWorkspace.id);
    setSaving(false);
    if (error) {
      onMessage('Chyba při ukládání: ' + error.message);
    } else {
      onMessage('Nastavení uloženo.');
      await refreshWorkspace();
      setTimeout(() => onMessage(''), 3000);
    }
  }

  return (
    <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Povinná pole pro trackování</h2>
      <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
        Zvolte, které položky musí uživatel vyplnit, aby mohl spustit timer nebo uložit manuální záznam.
      </p>

      <div className="space-y-3">
        {[
          { key: 'project' as const, label: 'Projekt' },
          { key: 'category' as const, label: 'Kategorie' },
          { key: 'task' as const, label: 'Úkol' },
          { key: 'description' as const, label: 'Popisek' },
          { key: 'tag' as const, label: 'Štítek' },
        ].map(field => (
          <label
            key={field.key}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
            style={{ background: requiredFields[field.key] ? 'var(--bg-active)' : 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = requiredFields[field.key] ? 'var(--bg-active)' : 'transparent'}
          >
            <input
              type="checkbox"
              checked={requiredFields[field.key]}
              onChange={(e) => setRequiredFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
              className="w-4 h-4 rounded"
              style={{ accentColor: 'var(--primary)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{field.label}</span>
          </label>
        ))}
      </div>

      {/* Skrytí štítků */}
      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <label
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
          style={{ background: hideTagsGlobally ? 'var(--bg-active)' : 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = hideTagsGlobally ? 'var(--bg-active)' : 'transparent'}
        >
          <input
            type="checkbox"
            checked={hideTagsGlobally}
            onChange={(e) => setHideTagsGlobally(e.target.checked)}
            className="w-4 h-4 rounded"
            style={{ accentColor: 'var(--primary)' }}
          />
          <div>
            <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Skrýt štítky pro všechny</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Výběr štítků se nebude zobrazovat v Měřiči ani v manuálním zadání</span>
          </div>
        </label>
      </div>

      <button
        onClick={saveRequiredFields}
        disabled={saving}
        className="mt-5 px-5 py-2 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50"
        style={{ background: 'var(--primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
      >
        {saving ? 'Ukládám...' : 'Uložit'}
      </button>
    </div>
  );
}
