'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { ImportantDay, ImportantDayRecurring } from '@/types/database';

export function useImportantDays() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [entries, setEntries] = useState<ImportantDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<ImportantDay | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // SQL banner dismiss (localStorage)
  const [sqlBannerDismissed, setSqlBannerDismissed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSqlBannerDismissed(localStorage.getItem('trackino_important_days_sql_done') === '1');
    }
  }, []);
  const dismissSqlBanner = () => {
    localStorage.setItem('trackino_important_days_sql_done', '1');
    setSqlBannerDismissed(true);
  };

  // Formulář
  const [fTitle, setFTitle] = useState('');
  const [fStartDate, setFStartDate] = useState('');
  const [fEndDate, setFEndDate] = useState('');
  const [fColor, setFColor] = useState('#6366f1');
  const [fRecurring, setFRecurring] = useState<ImportantDayRecurring>('none');
  const [fNote, setFNote] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('trackino_important_days')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('start_date', { ascending: true });
    setEntries((data ?? []) as ImportantDay[]);
    setLoading(false);
  }, [user, currentWorkspace]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Formulář ───────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditEntry(null);
    setFTitle('');
    const today = new Date().toISOString().slice(0, 10);
    setFStartDate(today);
    setFEndDate(today);
    setFColor('#6366f1');
    setFRecurring('none');
    setFNote('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (entry: ImportantDay) => {
    setEditEntry(entry);
    setFTitle(entry.title);
    setFStartDate(entry.start_date);
    setFEndDate(entry.end_date);
    setFColor(entry.color);
    setFRecurring(entry.recurring_type);
    setFNote(entry.note ?? '');
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !currentWorkspace) return;
    if (!fTitle.trim()) { setFormError('Zadej název.'); return; }
    if (!fStartDate) { setFormError('Zadej datum od.'); return; }
    if (fRecurring === 'none' && fEndDate && fEndDate < fStartDate) {
      setFormError('Datum do nesmí být před datem od.'); return;
    }
    setSaving(true);
    setFormError('');

    const endDate = fRecurring !== 'none' ? fStartDate : (fEndDate || fStartDate);
    const isRecurring = fRecurring !== 'none';
    const payload = {
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      title: fTitle.trim(),
      start_date: fStartDate,
      end_date: endDate,
      color: fColor,
      is_recurring: isRecurring,
      recurring_type: fRecurring,
      note: fNote.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from('trackino_important_days')
        .update(payload)
        .eq('id', editEntry.id));
    } else {
      ({ error } = await supabase
        .from('trackino_important_days')
        .insert(payload));
    }

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        setFormError('Tabulka neexistuje – spusť SQL migraci v Supabase (viz banner nahoře). Detail: ' + error.message);
      } else {
        setFormError('Chyba: ' + error.message);
      }
      setSaving(false);
      return;
    }

    setShowForm(false);
    fetchEntries();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tento záznam?')) return;
    await supabase.from('trackino_important_days').delete().eq('id', id);
    fetchEntries();
  };

  return {
    entries,
    loading,
    showForm,
    setShowForm,
    editEntry,
    saving,
    formError,
    sqlBannerDismissed,
    dismissSqlBanner,
    fTitle, setFTitle,
    fStartDate, setFStartDate,
    fEndDate, setFEndDate,
    fColor, setFColor,
    fRecurring, setFRecurring,
    fNote, setFNote,
    openNew,
    openEdit,
    handleSave,
    handleDelete,
  };
}
