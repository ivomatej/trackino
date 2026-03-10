'use client';
// ─── Calendar Module – useCalendarSubscriptions ───────────────────────────────
// CRUD pro ICS odběry + řazení. Přesunuto z page.tsx (ř. 2177–2282).

import { useMemo } from 'react';
import type { CalendarSubscription } from '@/types/database';
import { supabase } from '@/lib/supabase';

// ─── Typy závislostí ──────────────────────────────────────────────────────────

export interface SubsDeps {
  user: { id: string } | null;
  currentWorkspace: { id: string } | null;
  editingSub: CalendarSubscription | null;
  setEditingSub: (s: CalendarSubscription | null) => void;
  subForm: { name: string; url: string; color: string };
  setSubForm: (f: { name: string; url: string; color: string }) => void;
  subUrlError: string;
  setSubUrlError: (e: string) => void;
  setSavingSub: (v: boolean) => void;
  setShowSubForm: (v: boolean) => void;
  subscriptions: CalendarSubscription[];
  setSubscriptions: (s: CalendarSubscription[] | ((prev: CalendarSubscription[]) => CalendarSubscription[])) => void;
  subsOrder: string[];
  setSubsOrder: (o: string[] | ((prev: string[]) => string[])) => void;
  calendarOrder: string[];
  setCalendarOrder: (o: string[] | ((prev: string[]) => string[])) => void;
  fetchSubscriptions: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendarSubscriptions(deps: SubsDeps) {
  const {
    user, currentWorkspace,
    editingSub, setEditingSub,
    subForm, setSubForm,
    setSubUrlError, setSavingSub, setShowSubForm,
    subscriptions, setSubscriptions,
    subsOrder, setSubsOrder,
    calendarOrder, setCalendarOrder,
    fetchSubscriptions,
  } = deps;

  function openNewSub() {
    setEditingSub(null);
    setSubForm({ name: '', url: '', color: '#8b5cf6' });
    setSubUrlError('');
    setShowSubForm(true);
  }

  function openEditSub(sub: CalendarSubscription) {
    setEditingSub(sub);
    setSubForm({ name: sub.name, url: sub.url, color: sub.color });
    setSubUrlError('');
    setShowSubForm(true);
  }

  async function saveSubscription() {
    if (!user || !currentWorkspace || !subForm.name.trim() || !subForm.url.trim()) return;
    setSubUrlError('');
    setSavingSub(true);
    try {
      try { new URL(subForm.url); } catch {
        setSubUrlError('Zadej platnou URL adresu');
        setSavingSub(false);
        return;
      }
      if (editingSub) {
        await supabase
          .from('trackino_calendar_subscriptions')
          .update({ name: subForm.name.trim(), url: subForm.url.trim(), color: subForm.color })
          .eq('id', editingSub.id);
      } else {
        await supabase.from('trackino_calendar_subscriptions').insert({
          workspace_id: currentWorkspace.id,
          user_id: user.id,
          name: subForm.name.trim(),
          url: subForm.url.trim(),
          color: subForm.color,
          is_enabled: true,
        });
      }
      setShowSubForm(false);
      setEditingSub(null);
      await fetchSubscriptions();
    } finally {
      setSavingSub(false);
    }
  }

  async function deleteSubscription(id: string) {
    await supabase.from('trackino_calendar_subscriptions').delete().eq('id', id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  }

  async function toggleSubscription(id: string, enabled: boolean) {
    await supabase
      .from('trackino_calendar_subscriptions')
      .update({ is_enabled: enabled })
      .eq('id', id);
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, is_enabled: enabled } : s));
  }

  // ── Seřazené kalendáře a odběry ────────────────────────────────────────────

  const sortedSubscriptions = useMemo(() => {
    if (subsOrder.length === 0) return [...subscriptions].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    const idx = new Map(subsOrder.map((id, i) => [id, i]));
    return [...subscriptions].sort((a, b) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999));
  }, [subscriptions, subsOrder]);

  function moveSubscription(id: string, dir: -1 | 1) {
    setSubsOrder(prev => {
      const list = prev.length > 0 ? [...prev] : sortedSubscriptions.map(s => s.id);
      const i = list.indexOf(id);
      if (i < 0) return list;
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      localStorage.setItem('trackino_subs_order', JSON.stringify(next));
      return next;
    });
  }

  return {
    openNewSub, openEditSub, saveSubscription,
    deleteSubscription, toggleSubscription,
    sortedSubscriptions, moveSubscription,
  };
}
