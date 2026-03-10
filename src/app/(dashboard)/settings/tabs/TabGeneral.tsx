'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Workspace } from '@/types/database';
import { INPUT_CLS, SELECT_CLS, INPUT_STYLE, LABEL_CLS, TIMEZONE_OPTIONS } from '../constants';
import SelectWrap from '../SelectWrap';
import type { Tariff } from '@/types/database';

interface Props {
  currentWorkspace: Workspace;
  isMasterAdmin: boolean;
  onMessage: (msg: string) => void;
  refreshWorkspace: () => Promise<void>;
}

export default function TabGeneral({ currentWorkspace, isMasterAdmin, onMessage, refreshWorkspace }: Props) {
  const [saving, setSaving] = useState(false);
  const [wsName, setWsName] = useState('');
  const [tariff, setTariff] = useState<Tariff>('free');
  const [weekStart, setWeekStart] = useState(1);
  const [dateFormat, setDateFormat] = useState('dd.MM.yyyy');
  const [numberFormat, setNumberFormat] = useState('cs');
  const [currency, setCurrency] = useState('CZK');
  const [timezone, setTimezone] = useState('Europe/Prague');

  useEffect(() => {
    setWsName(currentWorkspace.name);
    setTariff(currentWorkspace.tariff);
    setWeekStart(currentWorkspace.week_start_day);
    setDateFormat(currentWorkspace.date_format);
    setNumberFormat(currentWorkspace.number_format);
    setCurrency(currentWorkspace.currency);
    setTimezone(currentWorkspace.timezone ?? 'Europe/Prague');
  }, [currentWorkspace]);

  async function saveGeneral() {
    setSaving(true);
    const updates: Record<string, unknown> = {
      tariff,
      week_start_day: weekStart,
      date_format: dateFormat,
      number_format: numberFormat,
      currency,
      timezone,
    };
    if (isMasterAdmin) {
      updates.name = wsName;
    }
    const { error } = await supabase
      .from('trackino_workspaces')
      .update(updates)
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
    <div className="space-y-5">
      <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Obecné nastavení</h2>

        <div className="space-y-4">
          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>
              Název workspace {!isMasterAdmin && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(jen Master Admin)</span>}
            </label>
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              disabled={!isMasterAdmin}
              className={INPUT_CLS + ' disabled:opacity-50'}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Tarif</label>
            <SelectWrap>
              <select value={tariff} onChange={(e) => setTariff(e.target.value as Tariff)} className={SELECT_CLS} style={INPUT_STYLE}>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
            </SelectWrap>
          </div>

          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Začátek týdne</label>
            <SelectWrap>
              <select value={weekStart} onChange={(e) => setWeekStart(Number(e.target.value))} className={SELECT_CLS} style={INPUT_STYLE}>
                <option value={1}>Pondělí</option>
                <option value={0}>Neděle</option>
                <option value={6}>Sobota</option>
              </select>
            </SelectWrap>
          </div>

          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Formát data</label>
            <SelectWrap>
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={SELECT_CLS} style={INPUT_STYLE}>
                <option value="dd.MM.yyyy">dd.MM.yyyy (31.12.2025)</option>
                <option value="MM/dd/yyyy">MM/dd/yyyy (12/31/2025)</option>
                <option value="yyyy-MM-dd">yyyy-MM-dd (2025-12-31)</option>
              </select>
            </SelectWrap>
          </div>

          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Formát čísel</label>
            <SelectWrap>
              <select value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)} className={SELECT_CLS} style={INPUT_STYLE}>
                <option value="cs">1 234,56 (český)</option>
                <option value="en">1,234.56 (anglický)</option>
              </select>
            </SelectWrap>
          </div>

          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Měna</label>
            <SelectWrap>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={SELECT_CLS} style={INPUT_STYLE}>
                <option value="CZK">CZK (Kč)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </SelectWrap>
          </div>

          <div>
            <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Časová zóna</label>
            <SelectWrap>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={SELECT_CLS} style={INPUT_STYLE}>
                {TIMEZONE_OPTIONS.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </SelectWrap>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Určuje, co se považuje za „dnešní datum" v Plánovači, Dovolené a reportech.
            </p>
          </div>
        </div>

        <button
          onClick={saveGeneral}
          disabled={saving}
          className="mt-5 px-5 py-2 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
        >
          {saving ? 'Ukládám...' : 'Uložit'}
        </button>
      </div>
    </div>
  );
}
