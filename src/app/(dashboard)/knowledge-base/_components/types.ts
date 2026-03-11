import type { KbPageStatus } from '@/types/database';

// ── Local types ───────────────────────────────────────────────────────────────

export type PageTab = 'comments' | 'history' | 'access' | 'backlinks' | 'reviews';

export interface KbMember {
  user_id: string;
  display_name: string;
  avatar_color: string;
  email?: string;
}

export type ListFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'recent' }
  | { type: 'unfiled' }
  | { type: 'status'; value: KbPageStatus }
  | { type: 'mention'; userId: string }
  | { type: 'folder'; folderId: string };

// ── Constants ─────────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<KbPageStatus, { label: string; color: string }> = {
  draft:    { label: 'Koncept',  color: '#f59e0b' },
  active:   { label: 'Aktivní', color: '#22c55e' },
  archived: { label: 'Archiv',  color: '#6b7280' },
};

export const TEMPLATES = [
  {
    id: 'blank', title: 'Prázdná stránka', description: 'Začít od nuly',
    content: '',
  },
  {
    id: 'meeting', title: 'Zápis z meetingu', description: 'Šablona pro zápis z porad',
    content: '<h2>Zápis z meetingu</h2><p><strong>Datum:</strong> </p><p><strong>Účastníci:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Program</h3><ul><li>Bod 1</li><li>Bod 2</li></ul><h3>Závěry a úkoly</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Úkol 1</li><li class="kb-check-unchecked">Úkol 2</li></ul><h3>Příští kroky</h3><p><br></p>',
  },
  {
    id: 'process', title: 'Popis procesu', description: 'Interní postup / návod',
    content: '<h2>Popis procesu</h2><p><strong>Zodpovědná osoba:</strong> </p><p><strong>Frekvence:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Popis</h3><p>Stručný popis procesu...</p><h3>Kroky</h3><ol><li>Krok 1</li><li>Krok 2</li><li>Krok 3</li></ol><h3>Poznámky</h3><div class="kb-callout">ℹ Důležité informace k procesu</div>',
  },
  {
    id: 'onboarding', title: 'Onboarding průvodce', description: 'Checklist pro nové zaměstnance',
    content: '<h2>Onboarding průvodce</h2><p>Vítejte v týmu! Tento průvodce vám pomůže v prvních dnech.</p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>První den</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Nastavit pracovní e-mail</li><li class="kb-check-unchecked">Představit se týmu</li><li class="kb-check-unchecked">Projít firemní pravidla</li></ul><h3>První týden</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Absolvovat úvodní školení</li><li class="kb-check-unchecked">Nastavit přístupy do systémů</li></ul>',
  },
  {
    id: 'project', title: 'Dokumentace projektu', description: 'Cíle a architektura projektu',
    content: '<h2>Dokumentace projektu</h2><p><strong>Vlastník projektu:</strong> </p><p><strong>Termín:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Cíl projektu</h3><p>Popis cíle...</p><h3>Rozsah</h3><ul><li>V rozsahu: </li><li>Mimo rozsah: </li></ul><h3>Technické detaily</h3><pre style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;margin:8px 0;border:1px solid var(--border)"><code>...</code></pre><h3>Rizika</h3><div class="kb-callout">⚠ Identifikovaná rizika</div>',
  },
];

export const MAX_FOLDER_DEPTH = 6;
