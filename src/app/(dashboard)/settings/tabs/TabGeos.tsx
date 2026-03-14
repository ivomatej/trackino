'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { INPUT_CLS, INPUT_STYLE, LABEL_CLS } from '../constants';
import type { GeoEntry, CountryCatalogEntry } from '@/types/database';

/* ─── Předefinovaný seznam jazyků ─────────────────────────────────────────── */
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'af', label: 'Afrikánština' },
  { code: 'ak', label: 'Akanština' },
  { code: 'sq', label: 'Albánština' },
  { code: 'am', label: 'Amharština' },
  { code: 'ar', label: 'Arabština' },
  { code: 'hy', label: 'Arménština' },
  { code: 'az', label: 'Ázerbájdžánština' },
  { code: 'my', label: 'Barmština' },
  { code: 'be', label: 'Běloruština' },
  { code: 'bn', label: 'Bengálština' },
  { code: 'bs', label: 'Bosňanština' },
  { code: 'bg', label: 'Bulharština' },
  { code: 'ca', label: 'Katalánština' },
  { code: 'cs', label: 'Čeština' },
  { code: 'zh', label: 'Čínština' },
  { code: 'da', label: 'Dánština' },
  { code: 'en', label: 'Angličtina' },
  { code: 'et', label: 'Estonština' },
  { code: 'fa', label: 'Perština' },
  { code: 'fi', label: 'Finština' },
  { code: 'fr', label: 'Francouzština' },
  { code: 'ka', label: 'Gruzínština' },
  { code: 'el', label: 'Řečtina' },
  { code: 'ht', label: 'Haitská kreolština' },
  { code: 'ha', label: 'Hauština' },
  { code: 'he', label: 'Hebrejština' },
  { code: 'hi', label: 'Hindština' },
  { code: 'hr', label: 'Chorvatština' },
  { code: 'hu', label: 'Maďarština' },
  { code: 'is', label: 'Islandština' },
  { code: 'id', label: 'Indonéština' },
  { code: 'ga', label: 'Irština' },
  { code: 'it', label: 'Italština' },
  { code: 'ja', label: 'Japonština' },
  { code: 'kk', label: 'Kazaština' },
  { code: 'km', label: 'Khmerština' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'ko', label: 'Korejština' },
  { code: 'ky', label: 'Kyrgyzština' },
  { code: 'lo', label: 'Laoština' },
  { code: 'lv', label: 'Lotyština' },
  { code: 'lt', label: 'Litevština' },
  { code: 'lb', label: 'Lucemburština' },
  { code: 'mk', label: 'Makedonština' },
  { code: 'ms', label: 'Malajština' },
  { code: 'mt', label: 'Maltézština' },
  { code: 'mi', label: 'Maorština' },
  { code: 'mn', label: 'Mongolština' },
  { code: 'de', label: 'Němčina' },
  { code: 'ne', label: 'Nepálština' },
  { code: 'nl', label: 'Nizozemština' },
  { code: 'no', label: 'Norština' },
  { code: 'ny', label: 'Chichewa' },
  { code: 'pl', label: 'Polština' },
  { code: 'pt', label: 'Portugalština' },
  { code: 'ro', label: 'Rumunština' },
  { code: 'ru', label: 'Ruština' },
  { code: 'sm', label: 'Samoanština' },
  { code: 'sk', label: 'Slovenština' },
  { code: 'sl', label: 'Slovinština' },
  { code: 'so', label: 'Somálština' },
  { code: 'sr', label: 'Srbština' },
  { code: 'st', label: 'Sesotho' },
  { code: 'sv', label: 'Švédština' },
  { code: 'sw', label: 'Svahilština' },
  { code: 'tg', label: 'Tádžičtina' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'ta', label: 'Tamilština' },
  { code: 'th', label: 'Thajština' },
  { code: 'ti', label: 'Tigriňština' },
  { code: 'tn', label: 'Setswana' },
  { code: 'tk', label: 'Turkmenština' },
  { code: 'tr', label: 'Turečtina' },
  { code: 'uk', label: 'Ukrajinština' },
  { code: 'ur', label: 'Urdština' },
  { code: 'uz', label: 'Uzbečtina' },
  { code: 'vi', label: 'Vietnamština' },
  { code: 'xh', label: 'Xhoština' },
  { code: 'sn', label: 'Shona' },
  { code: 'es', label: 'Španělština' },
  { code: 'si', label: 'Sinhálština' },
  { code: 'zu', label: 'Zulujština' },
];

function getLangLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code;
}

/* ─── Props ───────────────────────────────────────────────────────────────── */
interface Props {
  workspaceId: string;
  onMessage: (msg: string) => void;
}

/* ─── Prázdný formulář ────────────────────────────────────────────────────── */
const EMPTY_FORM = { name_en: '', name_cs: '', name_official: '', code: '', languages: [] as string[] };

/* ─── Multi-select jazyk picker ───────────────────────────────────────────── */
function LangPicker({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = LANGUAGES.filter(l =>
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <div
        className="min-h-[38px] w-full px-3 py-1.5 rounded-lg border cursor-pointer flex flex-wrap gap-1 items-center"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
        onClick={() => setOpen(o => !o)}
      >
        {selected.length === 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>– vyberte jazyk(y) –</span>
        )}
        {selected.map(code => (
          <span key={code}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {getLangLabel(code)}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(code); }}
              className="hover:opacity-70 leading-none">×</button>
          </span>
        ))}
        {/* Chevron */}
        <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {/* Dropdown – otevírá se nahoru */}
      {open && (
        <div className="absolute z-50 bottom-full mb-1 w-full rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat jazyk..."
              className="w-full px-2 py-1 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: 'none' }}
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(lang => {
              const checked = selected.includes(lang.code);
              return (
                <button key={lang.code} type="button"
                  onClick={() => toggle(lang.code)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: checked ? 'var(--primary)' : 'transparent',
                      borderColor: checked ? 'var(--primary)' : 'var(--border)',
                    }}>
                    {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </span>
                  <span>{lang.label}</span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{lang.code.toUpperCase()}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Žádný jazyk nenalezen</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Modální formulář GEO ────────────────────────────────────────────────── */
function GeoModal({
  open, editing, saving, form, setForm, onClose, onSave, catalog,
}: {
  open: boolean;
  editing: GeoEntry | null;
  saving: boolean;
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onClose: () => void;
  onSave: () => void;
  catalog: CountryCatalogEntry[];
}) {
  if (!open) return null;

  const codeInvalid = form.code.trim().length > 0 && form.code.trim().length !== 2;

  const handleCatalogSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    if (!code) return;
    const entry = catalog.find(c => c.code === code);
    if (!entry) return;
    setForm(f => ({
      ...f,
      name_en: entry.name_en,
      name_official: entry.name_official,
      code: entry.code,
      languages: entry.default_languages ?? [],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)' }}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editing ? 'Upravit stát' : 'Přidat stát'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Rychlé vyplnění ze číselníku */}
        {catalog.length > 0 && (
          <div className="mb-5 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <label className={LABEL_CLS} style={{ color: 'var(--text-muted)' }}>
              Vyplnit ze seznamu zemí
            </label>
            <div className="relative">
              <select
                defaultValue=""
                onChange={handleCatalogSelect}
                className={INPUT_CLS + ' appearance-none pr-8 text-base sm:text-sm'}
                style={INPUT_STYLE}
              >
                <option value="">– vyberte zemi –</option>
                {catalog.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.name_en} ({c.code})
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Výběrem se předvyplní anglický název, oficiální název, kód a jazyky. Český název doplňte ručně.
            </p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {/* Anglický název */}
          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-muted)' }}>Anglický název *</label>
            <input type="text" value={form.name_en}
              onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
              placeholder="Germany"
              className={INPUT_CLS + ' text-base sm:text-sm'} style={INPUT_STYLE} />
          </div>

          {/* Český název */}
          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-muted)' }}>Český název</label>
            <input type="text" value={form.name_cs}
              onChange={e => setForm(f => ({ ...f, name_cs: e.target.value }))}
              placeholder="Německo"
              className={INPUT_CLS + ' text-base sm:text-sm'} style={INPUT_STYLE} />
          </div>

          {/* Oficiální název státu */}
          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-muted)' }}>Oficiální název státu</label>
            <input type="text" value={form.name_official}
              onChange={e => setForm(f => ({ ...f, name_official: e.target.value }))}
              placeholder="Federal Republic of Germany"
              className={INPUT_CLS + ' text-base sm:text-sm'} style={INPUT_STYLE} />
          </div>

          {/* Kód */}
          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-muted)' }}>Zkratka (2 písmena) *</label>
            <input type="text" value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="DE"
              maxLength={2}
              className={INPUT_CLS + ' text-base sm:text-sm'}
              style={{
                ...INPUT_STYLE,
                borderColor: codeInvalid ? 'var(--danger)' : 'var(--border)',
              }} />
            {codeInvalid && (
              <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Zkratka musí mít přesně 2 písmena</p>
            )}
          </div>

          {/* Jazyky */}
          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-muted)' }}>Jazyk(y)</label>
            <LangPicker selected={form.languages} onChange={v => setForm(f => ({ ...f, languages: v }))} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Zrušit
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name_en.trim() || !form.code.trim() || form.code.trim().length !== 2}
            className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'var(--primary-hover)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}>
            {saving ? 'Ukládám...' : editing ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Hlavní komponenta TabGeos ───────────────────────────────────────────── */
export default function TabGeos({ workspaceId, onMessage }: Props) {
  const { user } = useAuth();

  const [geos, setGeos] = useState<GeoEntry[]>([]);
  const [catalog, setCatalog] = useState<CountryCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<GeoEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');

  const fetchGeos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trackino_geos')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name_en');
    if (data) setGeos(data as GeoEntry[]);
    setLoading(false);
  }, [workspaceId]);

  const fetchCatalog = useCallback(async () => {
    const { data } = await supabase
      .from('trackino_country_catalog')
      .select('*')
      .order('name_en');
    if (data) setCatalog(data as CountryCatalogEntry[]);
  }, []);

  useEffect(() => {
    fetchGeos();
    fetchCatalog();
  }, [fetchGeos, fetchCatalog]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (g: GeoEntry) => {
    setEditing(g);
    setForm({
      name_en: g.name_en,
      name_cs: g.name_cs,
      name_official: g.name_official ?? '',
      code: g.code,
      languages: g.languages ?? [],
    });
    setModal(true);
  };

  const saveGeo = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      name_en: form.name_en.trim(),
      name_cs: form.name_cs.trim(),
      name_official: form.name_official.trim(),
      code: form.code.trim().toUpperCase(),
      languages: form.languages,
    };
    if (editing) {
      const { error } = await supabase
        .from('trackino_geos')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      onMessage(error ? 'Chyba při ukládání státu' : 'Stát aktualizován');
    } else {
      const { error } = await supabase
        .from('trackino_geos')
        .insert(payload);
      onMessage(error ? 'Chyba při přidávání státu' : 'Stát přidán');
    }
    setSaving(false);
    setModal(false);
    fetchGeos();
  };

  const deleteGeo = async (g: GeoEntry) => {
    if (!confirm(`Opravdu chcete smazat stát "${g.name_en}"?`)) return;
    await supabase.from('trackino_geos').delete().eq('id', g.id);
    onMessage('Stát smazán');
    fetchGeos();
  };

  const filtered = geos.filter(g => {
    const q = search.toLowerCase();
    return !q || g.name_en.toLowerCase().includes(q) || g.name_cs.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>GEOs – Evidence států</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Spravujte seznam zemí s kódy a jazyky. GEOs jsou dostupné v modulu Evidence domén.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors flex-shrink-0"
          style={{ background: 'var(--primary)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Přidat stát
        </button>
      </div>

      {/* Vyhledávání */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat stát..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {search ? 'Žádný stát nenalezen' : 'Zatím žádné státy. Přidejte první kliknutím na tlačítko výše.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop tabulka */}
          <div className="hidden sm:block rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Zkratka</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Anglický název</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Český název</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Oficiální název</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Jazyky</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((g, i) => (
                  <tr key={g.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold"
                        style={{ background: 'var(--primary)', color: '#fff' }}>{g.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{g.name_en}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{g.name_cs || '–'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{g.name_official || '–'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(g.languages ?? []).length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>–</span>
                        ) : (
                          (g.languages ?? []).map(code => (
                            <span key={code} className="inline-block px-1.5 py-0.5 rounded text-[11px]"
                              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                              {getLangLabel(code)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(g)}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Upravit">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button onClick={() => deleteGeo(g)}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Smazat">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobilní karty */}
          <div className="sm:hidden space-y-2">
            {filtered.map(g => (
              <div key={g.id} className="rounded-xl border p-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold"
                      style={{ background: 'var(--primary)', color: '#fff' }}>{g.code}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{g.name_en}</p>
                      {g.name_cs && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.name_cs}</p>}
                      {g.name_official && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.name_official}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(g)}
                      className="p-2 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteGeo(g)}
                      className="p-2 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                {(g.languages ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.languages.map(code => (
                      <span key={code} className="inline-block px-1.5 py-0.5 rounded text-[11px]"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {getLangLabel(code)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs mt-3 text-right" style={{ color: 'var(--text-muted)' }}>
            Celkem {geos.length} {geos.length === 1 ? 'stát' : geos.length < 5 ? 'státy' : 'států'}
          </p>
        </>
      )}

      <GeoModal
        open={modal}
        editing={editing}
        saving={saving}
        form={form}
        setForm={setForm}
        onClose={() => setModal(false)}
        onSave={saveGeo}
        catalog={catalog}
      />
    </div>
  );
}
