# CLAUDE.md – Trackino dokumentace

> Kompletní dokumentace projektu pro AI asistenta (Claude). Vždy komunikuj česky.
> Aktualizováno: 4. 3. 2026 (v2.7.0)

---

## 1. Přehled projektu

**Trackino** je webová time-tracking aplikace postavená na:
- **Next.js 16** (App Router, TypeScript strict mode)
- **Supabase** (PostgreSQL + Auth + RLS)
- **Tailwind CSS v4** + CSS proměnné (`var(--primary)`, `var(--bg-card)`, atd.)
- **Recharts** – grafy (koláč, sloupce) v Analýze kategorií

Pracovní adresář: `/Users/ivomatej/Desktop/Aplikace - Trackino`

---

## 2. Adresářová struktura

```
src/
  app/
    (auth)/           – přihlášení, registrace
    (dashboard)/      – všechny chráněné stránky
      page.tsx        – Přehled (dashboard)
      tracker/        – Time tracker (seznam záznamů)
      planner/        – Plánovač dostupnosti
      vacation/       – Evidence dovolené
      invoices/       – Fakturace
      reports/        – Reporty hodin
      attendance/     – Přehled hodin (týdenní mřížka)
      category-report/– Analýza kategorií (grafy)
      subordinates/   – Přehled podřízených
      notes/          – Manažerské poznámky
      projects/       – Správa projektů
      clients/        – Správa klientů
      tags/           – Správa štítků
      team/           – Správa týmu
      settings/       – Nastavení workspace
      audit/          – Audit log (jen tarif Max)
      text-converter/ – Převodník textu (tarif Pro a Max)
      important-days/ – Důležité dny (tarif Pro a Max)
      app-settings/   – Nastavení modulů dle tarifu (admin)
      app-changes/    – Úpravy aplikace (admin)
      bugs/           – Hlášení chyb
      admin/          – Master admin panel
      profile/        – Profil uživatele
      dashboard/      – (redirect na /)
      changelog/      – Changelog verzí
      help/           – Nápověda
    invite/[token]/   – Přijetí pozvánky do workspace
  components/
    DashboardLayout.tsx  – hlavní layout s TimerBarem a Sidebarem
    Sidebar.tsx          – navigační menu (Oblíbené, skupiny, bottom items)
    TimerBar.tsx         – spouštění/zastavování timeru, manuální zadání
    TimeEntryList.tsx    – seznam time entries
    ManualTimeEntry.tsx  – formulář manuálního zadání
    WorkspaceSelector.tsx– přepínač workspace
    TagPicker.tsx        – multi-select štítků
    ThemeProvider.tsx    – dark/light mode
  contexts/
    AuthContext.tsx      – auth stav, profil, is_master_admin
    WorkspaceContext.tsx – workspace data, role, moduly, manager assignments
  hooks/
    usePermissions.ts    – React hook: kombinuje AuthContext + WorkspaceContext → oprávnění
  lib/
    supabase.ts          – Supabase klient
    permissions.ts       – čisté funkce oprávnění (bez Reactu)
    modules.ts           – ALL_MODULES, TARIFF_MODULES, computeEnabledModules()
    czech-calendar.ts    – getCzechHolidays(), isCzechHoliday()
    midnight-split.ts    – splitAtMidnight() pro půlnoční split timeru
    utils.ts             – obecné utility
  types/
    database.ts          – VŠECHNY TypeScript typy pro DB tabulky
```

---

## 3. Databázové tabulky (Supabase)

Všechny tabulky mají prefix `trackino_`. RLS je povoleno na všech tabulkách.
Výchozí policy: `CREATE POLICY "Auth full" ... FOR ALL TO authenticated USING (true) WITH CHECK (true)`.

| Tabulka | Klíčové sloupce | Popis |
|---------|----------------|-------|
| `trackino_profiles` | id, display_name, email, avatar_color, is_master_admin | Profily uživatelů (rozšíření auth.users) |
| `trackino_workspaces` | id, name, owner_id, tariff, logo_url, week_start_day, date_format, number_format, currency, required_fields | Workspace nastavení |
| `trackino_workspace_members` | workspace_id, user_id, role, can_use_vacation, hide_tags, can_view_audit, hourly_rate (zastaralý) | Členství ve workspace |
| `trackino_workspace_billing` | workspace_id, company_name, ico, dic, email, address, ... | Fakturační údaje workspace |
| `trackino_manager_assignments` | workspace_id, member_user_id, manager_user_id | Multi-manager přiřazení |
| `trackino_time_entries` | id, workspace_id, user_id, start_time, end_time, duration (sekundy), is_running, project_id, category_id, task_id, description, manager_note | Záznamy odpracovaného času |
| `trackino_time_entry_tags` | time_entry_id, tag_id | Vazba entry ↔ štítek (M:N) |
| `trackino_projects` | id, workspace_id, name, color, client_id | Projekty |
| `trackino_clients` | id, workspace_id, name, color | Klienti |
| `trackino_client_projects` | client_id, project_id | Vazba klient ↔ projekt (M:N) |
| `trackino_categories` | id, workspace_id, name, color | Kategorie |
| `trackino_tasks` | id, workspace_id, project_id, name | Úkoly |
| `trackino_tags` | id, workspace_id, name, color | Štítky |
| `trackino_availability` | id, workspace_id, user_id, date (YYYY-MM-DD), half ('am'|'pm'|'full'), status_id, note | Plánovač dostupnosti |
| `trackino_availability_statuses` | id, workspace_id, name, color | Stavy dostupnosti (Dovolená, Home office, ...) |
| `trackino_vacation_entries` | id, workspace_id, user_id, start_date, end_date, days, note, status ('approved'\|'pending'\|'rejected'), reviewed_by (uuid\|null), reviewed_at (timestamptz\|null), reviewer_note | Evidence dovolené (status DEFAULT 'approved' pro zpětnou kompatibilitu) |
| `trackino_vacation_allowances` | workspace_id, user_id, year, days_per_year | Fond dovolené |
| `trackino_member_rates` | workspace_id, user_id, rate, valid_from, valid_to | Hodinové sazby (valid_to IS NULL = aktivní) |
| `trackino_invoices` | id, workspace_id, number, client_name, amount, status, ... | Faktury |
| `trackino_module_overrides` | workspace_id, user_id, module_id, enabled | Per-user override modulů |
| `trackino_tariff_config` | workspace_id, tariff, module_id, enabled | Per-workspace tariff config (přepisuje hardcoded defaults) |
| `trackino_availability_statuses` | id, workspace_id, name, color | Stavy pro Plánovač |
| `trackino_invitations` | id, workspace_id, email, role, token, accepted | Pozvánky emailem |
| `trackino_audit_log` | id, workspace_id, actor_user_id, action, entity_type, details | Audit záznamy |
| `trackino_app_changes` | id, workspace_id, title, content, type (bug\|idea\|request\|note), priority, status (open\|in_progress\|solved\|archived), source_bug_id, created_at, updated_at | Požadavky na úpravy aplikace |
| `trackino_important_days` | id, workspace_id, user_id, title, start_date, end_date, color, is_recurring, recurring_type ('none'\|'weekly'\|'monthly'\|'yearly'), note, created_at, updated_at | Osobní důležité dny a opakující se události |
| `trackino_system_notifications` | id, title, message, color, is_active, show_from (timestamptz\|null), show_until (timestamptz\|null), created_at, updated_at | Systémová oznámení zobrazená všem uživatelům jako banner (jen Master Admin spravuje) |

### Poznámky k DB
- `trackino_member_rates.valid_to IS NULL` = aktuálně platná sazba (aktivní rate)
- Sloupec `trackino_workspace_members.hourly_rate` je **zastaralý** – nevyužívat
- Plánovač: unikátní constraint `(workspace_id, user_id, date, half)` na `trackino_availability`
- Timer: `is_running = true` = aktuálně běžící záznam; `duration` v sekundách

---

## 4. Systém modulů (modules.ts)

### ModuleId
```typescript
type ModuleId = 'time_tracker' | 'planner' | 'vacation' | 'invoices' | 'reports' |
  'attendance' | 'category_report' | 'subordinates' | 'notes' | 'projects' |
  'clients' | 'tags' | 'team' | 'settings' | 'audit' | 'text_converter' | 'important_days';
```

### Výchozí moduly dle tarifu (hardcoded TARIFF_MODULES)
| Modul | Free | Pro | Max |
|-------|------|-----|-----|
| Měřič (time_tracker) | ✓ | ✓ | ✓ |
| Plánovač (planner) | – | ✓ | ✓ |
| Dovolená (vacation) | – | ✓ | ✓ |
| Fakturace (invoices) | – | ✓ | ✓ |
| Reporty (reports) | ✓ | ✓ | ✓ |
| Přehled hodin (attendance) | – | ✓ | ✓ |
| Analýza kategorií (category_report) | – | ✓ | ✓ |
| Podřízení (subordinates) | – | ✓ | ✓ |
| Poznámky (notes) | – | ✓ | ✓ |
| Projekty (projects) | ✓ | ✓ | ✓ |
| Klienti (clients) | ✓ | ✓ | ✓ |
| Štítky (tags) | ✓ | ✓ | ✓ |
| Tým (team) | ✓ | ✓ | ✓ |
| Nastavení (settings) | – | ✓ | ✓ |
| Audit log (audit) | – | – | ✓ |
| Převodník textu (text_converter) | – | ✓ | ✓ |
| Důležité dny (important_days) | – | ✓ | ✓ |

### computeEnabledModules()
```
Základ = TARIFF_MODULES[tariff]
↓ aplikuj tariffConfig z DB (jen explicitně nastavené záznamy)
↓ aplikuj per-user module_overrides
= výsledná sada povolených modulů
```

### Skupina modulů (pro App Settings)
- `'Sledování'`: time_tracker, planner, vacation, invoices
- `'Analýza'`: reports, attendance, category_report, subordinates, notes
- `'Správa'`: projects, clients, tags, team, settings, audit
- `'Nástroje'`: text_converter, important_days

---

## 5. Role a oprávnění

### Hierarchie rolí (sestupně)
```
Master Admin (is_master_admin = true na profilu, platformová úroveň)
  └── Owner (role = 'owner', vlastník workspace)
        └── Admin (role = 'admin')
              └── Manager (role = 'manager')
                    └── Member (role = 'member')
```

### Klíčové funkce (src/lib/permissions.ts)
| Funkce | Popis |
|--------|-------|
| `isMasterAdmin(profile)` | platformový super-admin |
| `isWorkspaceAdmin(role)` | owner nebo admin |
| `isManager(role)` | manažer týmu |
| `canManualEntry(role)` | member nemůže, ostatní ANO |
| `canSeeTags(membership, global)` | dle hide_tags |
| `canEditTimeEntry(role, entryUserId, currentUserId, isManagerOf)` | kdo může editovat čí záznamy |
| `canAccessSettings(role)` | jen owner/admin |
| `canAccessAuditLog(role, profile, membership)` | master admin, workspace admin, nebo can_view_audit |

### React hook (src/hooks/usePermissions.ts)
```typescript
const { canAdmin, isManager, isMasterAdmin, canManualEntry, canSeeTags, isManagerOf } = usePermissions();
```

---

## 6. Kontexty

### AuthContext (src/contexts/AuthContext.tsx)
- `user` – Supabase auth user
- `profile` – trackino_profiles záznam (včetně `is_master_admin`)
- `loading` – načítání auth stavu

### WorkspaceContext (src/contexts/WorkspaceContext.tsx)
- `currentWorkspace` – aktivní workspace (včetně tariff, required_fields, atd.)
- `workspaces` – všechny workspace uživatele
- `currentMembership` – membership záznam (role, can_use_vacation, atd.)
- `enabledModules` – Set<ModuleId> – výsledek computeEnabledModules()
- `isModuleEnabled(moduleId)` – helper funkce
- `managerAssignments` – pro isManagerOf() logiku
- `isManagerOf(userId)` – vrací true pokud je currentUser manažerem daného uživatele
- `switchWorkspace(id)`, `createWorkspace()` (jen Master Admin), `updateWorkspace()`

---

## 7. Sidebar (src/components/Sidebar.tsx)

### Struktura
```
[Logo / WorkspaceSelector]
─────────────────────────
⭐ OBLÍBENÉ (jen Pro/Max, jen pokud existují)
   [položky z favorites] [× odebrat]
─────────────────────────
SLEDOVÁNÍ
  Přehled (/) [icon]
  Time Tracker (/tracker)
  Plánovač (/planner)
  Dovolená (/vacation)
  Fakturace (/invoices)
ANALÝZA
  Reporty (/reports)
  Přehled hodin (/attendance)
  Analýza kategorií (/category-report)
  Podřízení (/subordinates)
  Poznámky (/notes)
NÁSTROJE
  Převodník textu (/text-converter)
  Důležité dny (/important-days)
SPRÁVA
  Projekty (/projects)
  Klienti (/clients)
  Štítky (/tags)
  Tým (/team)
  Nastavení (/settings)
  Audit log (/audit)
NÁSTROJE
  Převodník textu (/text-converter)
─────────────────────────
[bottom items]
  Nápověda (/help)
  Changelog (/changelog)
  Profil (/profile)
  Admin (/admin) – jen Master Admin
  Odhlásit
```

### Oblíbené (Favorites)
- Dostupné pro tarify: `pro`, `max`
- Uloženo v localStorage: klíč `trackino_favorites_{workspaceId}`
- Hvězdičky jsou defaultně **neviditelné** (opacity 0), zobrazí se až při hoveru na položku
- Oblíbená položka má hvězdičku trvale zlatou (opacity 0.8)
- V sekci OBLÍBENÉ je ikona × pro odebrání z oblíbených (viditelná na hover)

---

## 8. Plánovač (planner/page.tsx)

### Synchronizace s Dovolenou
- **Vacation → Planner**: přidání/odebrání záznamu dovolené automaticky nastaví/smaže stav „Dovolená" v Plánovači pro všechny dny v rozsahu (half='full')
- **Planner → Vacation**: nastavení stavu „Dovolená" pro `half='full'` v Plánovači vytvoří 1denní záznam v Dovolené; odebrání stav smaže
- Stav „Dovolená" identifikován podle jména: `name.trim().toLowerCase() === 'dovolená'`
- Sync z Plánovače do Dovolené: jen pro uživatele s `can_use_vacation = true`
- Deduplication: před vytvořením záznamu ověřit, zda neexistuje pokrývající záznam

### České státní svátky
- Import: `getCzechHolidays(year)` z `@/lib/czech-calendar`
- Výpočet: `const weekHolidays = [...new Set(weekDays.map(d => d.getFullYear()))].flatMap(y => getCzechHolidays(y));`
- Zobrazeny v záhlaví sloupce: 🎉 celý název svátku (červeně, malé písmo, může se zalomit)
- `minWidth` sloupce: 110px (dostatečný prostor pro zalamování)
- Zahrnuje pohyblivé svátky (Velikonoce) via Gaussův algoritmus
- Třídy: `w-full` (bez truncate), text se volně zalomí v rámci sloupce

### Důležité dny a státní svátky – vizuální proužky (strips)
- **StripItem interface** (definováno před komponentou):
  ```typescript
  interface StripItem { id: string; title: string; color: string; startCol: number; endCol: number; }
  ```
  - `startCol` / `endCol`: 0–6 (index dne v týdnu, 0 = pondělí)
- **`packStripLanes(strips: StripItem[]): StripItem[][]`** – greedy algoritmus, řadí proužky do řad (lanes) bez překryvů
  - Sort dle `startCol`, každý proužek do první řady kde `lane[last].endCol < strip.startCol`
- **Rendering v `<thead>`**: IIFE (`{(() => { ... })()}`) vypočítá strips z holidays + important days, volá `packStripLanes()`, renderuje extra `<tr>` řádky nad záhlavím dnů
  - Každý strip-lane `<tr>`: `<th>` spacer pro sloupec jmen + sada `<th colSpan={N}>` buněk
  - Styl buňky: `background: color+'22'`, `color: color`, `borderRadius: 5`, `fontSize: 10`, `fontWeight: 600`
- **Contiguous span detection** pro důležité dny: iteruje `matchingCols[]`, detekuje mezery (non-consecutive indexy) a vytváří separátní StripItems pro každý kontinuální rozsah
- **Státní svátky**: barva `#ef4444` (červená), každý svátek = jeden StripItem přes jeden sloupec
- **Důležité dny**: barva dle `importantDay.color`; vícedenní záznamy = proužek přes rozsah sloupců; opakující se záznamy = proužek pro každý odpovídající den v týdnu
- Personalizované – každý uživatel vidí jen své záznamy

### Navigace po týdnech
- `getMonday(date)` – vrátí pondělí daného týdne
- `addDays(date, n)` – přidá n dní
- `weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))`

---

## 9. Timer (TimerBar.tsx)

### Půlnoční split (midnight-split.ts)
- `splitAtMidnight(start, end)` → pole segmentů `{start, end}[]`
- Při stopnutí timeru přes půlnoc: UPDATE prvního segmentu + INSERT dalších
- Background check každých 30s: pokud timer překročil půlnoc → automatický split

### Manuální zadání
- Dostupné jen pro role !== 'member' (`canManualEntry()`)
- Povinná pole dle `workspace.required_fields` (project, category, task, description, tag)

---

## 10. Klíčové utility

### czech-calendar.ts
```typescript
getCzechHolidays(year: number): { date: string; name: string }[]
isCzechHoliday(date: Date, holidays: ...[]): { isHoliday: boolean; name: string }
```
- 13 svátků včetně pohyblivých (Velký pátek, Velikonoční pondělí)
- Gaussův algoritmus pro výpočet data Velikonoc

### midnight-split.ts
```typescript
splitAtMidnight(start: Date, end: Date): { start: Date; end: Date }[]
```

### modules.ts
```typescript
computeEnabledModules(tariff, overrides, tariffConfig?): Set<ModuleId>
ALL_MODULES: { id, label, description, group }[]
TARIFF_MODULES: Record<Tariff, ModuleId[]>
```

---

## 11. Tarify a funkce

| Funkce | Free | Pro | Max |
|--------|------|-----|-----|
| Základní timer | ✓ | ✓ | ✓ |
| Projekty, klienti, štítky | ✓ | ✓ | ✓ |
| Plánovač dostupnosti | – | ✓ | ✓ |
| Dovolená (synchronizace) | – | ✓ | ✓ |
| Fakturace | – | ✓ | ✓ |
| Přehled hodin (týdenní) | – | ✓ | ✓ |
| Analýza kategorií | – | ✓ | ✓ |
| Podřízení + Poznámky | – | ✓ | ✓ |
| Nastavení workspace | – | ✓ | ✓ |
| **Oblíbené v sidebaru** | – | ✓ | ✓ |
| Audit log | – | – | ✓ |
| Převodník textu | – | ✓ | ✓ |
| **Důležité dny** | – | ✓ | ✓ |

---

## 12. Vývoj a deployment

### Lokální development
```bash
cd "/Users/ivomatej/Desktop/Aplikace - Trackino"
npm run dev          # http://localhost:3000
```

### Build a deploy
```bash
npm run build        # TypeScript check + produkční build
git add -p           # staging jen relevantních souborů
git commit -m "feat: ..."
git push             # → Vercel auto-deploy na produkci
```

### Proměnné prostředí (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Konvence commitů
- `feat: popis` – nová funkce
- `fix: popis` – oprava chyby
- `refactor: popis` – refaktoring
- `docs: popis` – dokumentace
- `chore: popis` – údržba

---

## 13. Časté chyby a řešení

| Problém | Příčina | Řešení |
|---------|---------|--------|
| Modul se nezobrazuje v App Settings | Chybí skupina v `groups` array v `app-settings/page.tsx` | Přidat skupinu (např. 'Nástroje') |
| Synchronizace Dovolená ↔ Plánovač nefunguje | Stav v Plánovači se nejmenuje přesně „Dovolená" | Zkontrolovat název stavu (háček, velké D) |
| `hourly_rate` vrací null | Používáš zastaralý sloupec na workspace_members | Použít `trackino_member_rates` s `valid_to IS NULL` |
| Build selže s TypeScript chybou | Chybí typ v `database.ts` nebo špatný import | Přidat typ a reimportovat |
| Oblíbené se nezobrazují | Tarif workspace je 'free' | Oblíbené jsou jen pro Pro a Max tarif |
| České svátky se nezobrazují v Plánovači | Chybí import nebo špatný rok | Zkontrolovat `getCzechHolidays` import |

---

## 14. Changelog verzí

| Verze | Datum | Klíčové změny |
|-------|-------|---------------|
| v2.7.0 | 4. 3. 2026 | Schvalování dovolené (status pending/approved/rejected, tab Žádosti pro managery, sync s Plánovačem jen po schválení); Plánovač – proužky pod záhlavím + today tint jen na headeru; Fix: ikonka v náhledu banneru (items-center) |
| v2.6.0 | 4. 3. 2026 | Systémová oznámení (nová tabulka `trackino_system_notifications`, záložka v App Settings, banner v DashboardLayout, localStorage dismissal); Plánovač – vizuální proužky pro důležité dny a státní svátky (StripItem, packStripLanes, colspan thead rendering) |
| v2.5.0 | 4. 3. 2026 | Sidebar – sekce NÁSTROJE; nový modul Důležité dny (Pro+Max) s opakujícími se událostmi; zobrazení v Plánovači; Přesun Převodníku textu do NÁSTROJE + dostupný od Pro; Fix DB constraints pro app_changes (note+archived) |
| v2.4.0 | 4. 3. 2026 | Sidebar hvězdičky jen na hover; Plánovač – celý název svátku (minWidth 110px); Úpravy aplikace – nový typ Poznámka + Archiv (soft delete + hromadné trvalé mazání) |
| v2.3.0 | 4. 3. 2026 | Oblíbené v sidebaru (Pro/Max), české svátky v Plánovači, skupina Nástroje v App Settings, oprava názvů modulů |
| v2.2.0 | – | Audit log, Nastavení workspace (tarify, fakturační údaje), půlnoční split timeru |
| v2.1.0 | – | Přehled hodin (attendance), Analýza kategorií (recharts), Podřízení, Poznámky |
| v2.0.0 | – | Role systém (MasterAdmin/Owner/Admin/Manager/Member), Klienti, Štítky, Pozvánky emailem |
| v1.x.x | – | Základní timer, projekty, kategorie, úkoly, plánovač, dovolená, reporty |

---

## 15. Systémová oznámení – architektura

### Tabulka
`trackino_system_notifications` – bez `workspace_id` (globální pro celou platformu)

### App Settings (`app-settings/page.tsx`)
- Záložky: `'tariffs' | 'notifications'` (stav `activeTab`)
- Lazy fetch: oznámení se načítají jen při přepnutí na záložku notifications
- CRUD: `fetchNotifications`, `openNewNotif`, `openEditNotif`, `saveNotif`, `deleteNotif`, `toggleNotifActive`
- `toDatetimeLocal(iso)` → `YYYY-MM-DDTHH:mm` pro `<input type="datetime-local">`
- `fromDatetimeLocal(val)` → ISO string (`new Date(val).toISOString()`)
- Stav oznámení: `isVisible = n.is_active && (!n.show_from || show_from <= now) && (!n.show_until || show_until >= now)`
- Badge: „Zobrazuje se" (zelený) / „Aktivní (mimo čas)" (žlutý) / „Neaktivní" (šedý)
- Live náhled banneru v modálním formuláři

### DashboardLayout – banner
- Hook `useSystemNotifications()` – lokální v `DashboardLayout.tsx`
  - Načítá `dismissed` IDs z `localStorage.getItem('trackino_dismissed_notifications')` (JSON array)
  - Fetchuje `trackino_system_notifications` kde `is_active = true`
  - Filtruje: `!dismissed.has(id) && show_from <= now && show_until >= now`
  - `dismiss(id)` → aktualizuje state + localStorage
- Banner renderován v `<header>` **před** řádkem s timerem
- Styl: `background: n.color + '18'`, `borderColor: n.color + '44'`
- Ikona ⓘ + nadpis (tučně, barvou) + text + × tlačítko

### SQL migrace
```sql
CREATE TABLE IF NOT EXISTS trackino_system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#f59e0b',
  is_active boolean NOT NULL DEFAULT false,
  show_from timestamptz,
  show_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_system_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_system_notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 16. Úpravy aplikace – architektura

### Typy a stavy (`src/types/database.ts`)
```typescript
AppChangeType  = 'bug' | 'idea' | 'request' | 'note'
AppChangeStatus = 'open' | 'in_progress' | 'solved' | 'archived'
```

### Záložky filtru
- `all` → aktivní položky (status !== solved && !== archived)
- `bug` / `idea` / `request` / `note` → filtruje dle type (bez solved/archived)
- `solved` → dokončené
- `archived` → archivované (soft delete)

### Archiv – chování
- `archiveItem(id)` → UPDATE status = 'archived' (soft delete, nahrazuje trvalé smazání)
- `restoreItem(id)` → UPDATE status = 'open'
- `permanentDeleteOne(id)` → skutečný DB delete
- `permanentDeleteSelected()` → bulk DB delete dle `selectedIds: Set<string>`
- Klik na kartu v archivu = toggle výběru (checkbox)
- Panel nahoře: "Označit vše" checkbox + "Trvale smazat (N)" tlačítko

---

## 17. Schvalování dovolené – architektura (vacation/page.tsx)

### Konstanty
```typescript
const APPROVAL_THRESHOLD = 3; // > 3 pracovních dní vyžaduje schválení
```

### Status flow
```
Uživatel přidá dovolenou > 3 dní  →  status: 'pending'  (žádný planner sync)
Uživatel přidá dovolenou ≤ 3 dní  →  status: 'approved' + syncVacationToPlanner()
Admin přidá dovolenou (jakkoliv)   →  status: 'approved' + syncVacationToPlanner()

Manager/Admin schválí  →  status: 'approved', reviewed_by, reviewed_at + syncVacationToPlanner()
Manager/Admin zamítne  →  status: 'rejected', reviewed_by, reviewed_at, reviewer_note (žádný sync)
```

### Typy (`database.ts`)
```typescript
export type VacationStatus = 'approved' | 'pending' | 'rejected';
// VacationEntry má: status, reviewed_by, reviewed_at, reviewer_note
```

### Key state variables
- `activeTab: 'records' | 'requests'` – tab state
- `subordinateUserIds: string[]` – z managerAssignments kde manager_user_id === user?.id
- `canSeeRequests = isWorkspaceAdmin || isManager`
- `approvedEntries` – jen `status === 'approved'`
- `myPendingRejectedEntries` – vlastní pending/rejected záznamy
- `pendingRequestEntries` – pending od podřízených (manager) nebo od všech (admin)

### Klíčové funkce
- `addEntry()` – pokud `days > APPROVAL_THRESHOLD && !isWorkspaceAdmin` → status='pending', jinak 'approved' + sync
- `deleteEntry(id)` – sync s Plánovačem jen pokud `entry.status === 'approved'`
- `approveEntry(id)` – UPDATE approved → fetch entry → syncVacationToPlanner
- `rejectEntry()` – UPDATE rejected s reviewer_note z rejectModal

### Stats (usedDays)
```typescript
const usedDays = entries.filter(e => e.status === 'approved').reduce(...)
```

### SQL migrace
```sql
ALTER TABLE trackino_vacation_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'pending', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_note text DEFAULT '';
```

---

## 16. Konvence kódu

- Vždy `'use client'` na interaktivních stránkách
- CSS proměnné: `var(--primary)`, `var(--text-muted)`, `var(--bg-card)`, `var(--bg-hover)`, `var(--border)`
- Tailwind: group hover pattern: `group/name` + `group-hover/name:opacity-60`
- Data z DB: vždy ošetřit `null` / `undefined`
- Datum: ISO string `YYYY-MM-DD`, čas `ISO 8601`
- Supabase queries: vždy `.eq('workspace_id', currentWorkspace.id)` pro RLS
- Po každé větší změně: `npm run build` pro ověření TypeScript

---

*Soubor spravuje Claude. Aktualizuj při každé větší změně architektury nebo přidání nových funkcí.*
