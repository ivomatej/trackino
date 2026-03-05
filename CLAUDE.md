# CLAUDE.md – Trackino dokumentace

> Kompletní dokumentace projektu pro AI asistenta (Claude). Vždy komunikuj česky.
> Aktualizováno: 5. 3. 2026 (v2.13.1)

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
      calendar/       – Osobní kalendář (list/week/month pohled)
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
      requests/       – Žádosti (tarif Pro a Max)
      feedback/       – Připomínky – anonymní (tarif Pro a Max)
      knowledge-base/ – Znalostní báze (tarif Pro a Max, připravujeme)
      documents/      – Dokumenty – správa souborů a složek (tarif Pro a Max)
      company-rules/  – Firemní pravidla – editovatelná textová stránka (tarif Pro a Max)
      office-rules/   – Pravidla v kanceláři – editovatelná textová stránka (tarif Pro a Max)
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
| `trackino_profiles` | id, display_name, display_nickname, email, avatar_color, is_master_admin, timer_always_visible, calendar_day_start, calendar_day_end | Profily uživatelů (rozšíření auth.users) |
| `trackino_workspaces` | id, name, owner_id, tariff, logo_url, week_start_day, date_format, number_format, currency, required_fields, society_modules_enabled | Workspace nastavení |
| `trackino_workspace_subscriptions` | id, workspace_id, year, month, tariff, active_members, created_at | Měsíční snapshoty tarifu a počtu aktivních členů (lazy-generated) |
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
| `trackino_calendars` | id, workspace_id, owner_user_id, name, color, is_default, created_at, updated_at | Osobní kalendáře uživatele (výchozí se vytvoří automaticky) |
| `trackino_calendar_events` | id, calendar_id, workspace_id, user_id, title, description, start_date (text YYYY-MM-DD), end_date (text), is_all_day, start_time (text\|null), end_time (text\|null), color (text\|null), source ('manual'\|'vacation'\|'important_day'), source_id (uuid\|null), created_at, updated_at | Ruční události v kalendáři; dovolená a důležité dny se čtou přímo z jejich tabulek |
| `trackino_requests` | id, workspace_id, user_id, type ('hardware'\|'software'\|'access'\|'office'\|'financial'\|'hr'\|'education'\|'travel'\|'benefits'\|'recruitment'\|'security'\|'it_support'\|'legal'), title, note, status ('pending'\|'approved'\|'rejected'), reviewed_by (uuid\|null), reviewed_at (timestamptz\|null), reviewer_note, vacation_start_date (text\|null), vacation_end_date (text\|null), vacation_days (int\|null), vacation_entry_id (uuid\|null), created_at, updated_at | Žádosti zaměstnanců ke schválení – 13 kategorií |
| `trackino_feedback` | id, workspace_id, message, is_resolved (bool), created_at | Anonymní připomínky – bez user_id záměrně (plná anonymita) |
| `trackino_calendar_shares` | id, calendar_id, shared_with_user_id, can_edit, created_at | Sdílení kalendáře mezi uživateli workspace (UNIQUE calendar_id+shared_with_user_id) |
| `trackino_workspace_pages` | id, workspace_id, slug ('company-rules'\|'office-rules'), content (HTML), updated_at, updated_by | Per-workspace editovatelné textové stránky (UNIQUE workspace_id+slug) |
| `trackino_document_folders` | id, workspace_id, name, color, sort_order, created_by, created_at, updated_at | Složky pro organizaci dokumentů |
| `trackino_documents` | id, workspace_id, folder_id (uuid\|null), name, type ('file'\|'link'), file_path (text\|null), file_size (int\|null), file_mime (text\|null), url (text\|null), description, created_by, created_at, updated_at | Firemní dokumenty a odkazy; soubory uloženy v Supabase Storage bucket `trackino-documents` |

### Poznámky k DB
- `trackino_member_rates.valid_to IS NULL` = aktuálně platná sazba (aktivní rate)
- Sloupec `trackino_workspace_members.hourly_rate` je **zastaralý** – nevyužívat
- Plánovač: unikátní constraint `(workspace_id, user_id, date, half)` na `trackino_availability`
- Timer: `is_running = true` = aktuálně běžící záznam; `duration` v sekundách

---

## 4. Systém modulů (modules.ts)

### ModuleId
```typescript
type ModuleId = 'time_tracker' | 'planner' | 'calendar' | 'vacation' | 'invoices' | 'reports' |
  'attendance' | 'category_report' | 'subordinates' | 'notes' | 'projects' |
  'clients' | 'tags' | 'team' | 'settings' | 'audit' | 'text_converter' | 'important_days' |
  'requests' | 'feedback' | 'knowledge_base' | 'documents' | 'company_rules' | 'office_rules';
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
| Žádosti (requests) | – | ✓ | ✓ |
| Připomínky (feedback) | – | ✓ | ✓ |
| Znalostní báze (knowledge_base) | – | ✓ | ✓ |
| Dokumenty (documents) | – | ✓ | ✓ |
| Firemní pravidla (company_rules) | – | ✓ | ✓ |
| Pravidla v kanceláři (office_rules) | – | ✓ | ✓ |
| Kalendář (calendar) | – | – | ✓ |

### computeEnabledModules()
```
Základ = TARIFF_MODULES[tariff]
↓ aplikuj tariffConfig z DB (jen explicitně nastavené záznamy)
↓ aplikuj per-user module_overrides
= výsledná sada povolených modulů
```

### Skupina modulů (pro App Settings)
- `'Sledování'`: time_tracker, planner, calendar, vacation, invoices
- `'Analýza'`: reports, attendance, category_report, subordinates, notes
- `'Správa'`: projects, clients, tags, team, settings, audit
- `'Nástroje'`: text_converter, important_days, requests, feedback
- `'Společnost'`: knowledge_base, documents, company_rules, office_rules

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
  Kalendář (/calendar)
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
| **Žádosti** | – | ✓ | ✓ |
| **Připomínky (anonymní)** | – | ✓ | ✓ |
| **Sekce SPOLEČNOST** | – | ✓ | ✓ |
| &nbsp;&nbsp;Znalostní báze (připravujeme) | – | ✓ | ✓ |
| &nbsp;&nbsp;Dokumenty (soubory + složky) | – | ✓ | ✓ |
| &nbsp;&nbsp;Firemní pravidla (rich text editor) | – | ✓ | ✓ |
| &nbsp;&nbsp;Pravidla v kanceláři (rich text editor) | – | ✓ | ✓ |

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
| `/app-settings` přesměruje na `/` při refreshi | AuthContext volá `setLoading(false)` PŘED dokončením `fetchProfile()` (setTimeout 0) → `authLoading=false`, `user=set`, `profile=null` → redirect se spustí | Čekat na všechny tři: `if (authLoading) return; if (!user) redirect; if (profile===null) return; if (!isMasterAdmin) redirect;` |
| Dovolená / jiná stránka se neustále načítá (infinite loop) | Pole/objekt počítaný inline v těle komponenty je v deps `useCallback` → nová reference každý render → `useEffect` se spouští donekonečna | Obalit do `useMemo` se správnými deps |
| Chybějící borderBottom na některých buňkách v Plánovači | Gap buňky před prvním proužkem v strip lane neměly `borderBottom` | Přidat `borderBottom` i na leading gap `<th>` buňky |

---

## 14. Changelog verzí

| Verze | Datum | Klíčové změny |
|-------|-------|---------------|
| v2.13.1 | 5. 3. 2026 | Mobilní responzivita: Prompty/Záložky/Kalendář/Dokumenty – toggle pro levý panel na mobilu; Nastavení workspace – horizontální scrollovatelný nav na mobilu; Tým – přetékající taby → overflow-x-auto; Dovolená – stats grid-cols-2 na mobilu + overflow-x-auto tabulka |
| v2.13.0 | 5. 3. 2026 | Nový modul Prompty (NÁSTROJE, Pro+): stromová struktura složek (5 úrovní), rich text editor, kódové bloky, liky, oblíbené, komentáře, sdílení složek; Nový modul Záložky (NÁSTROJE, Pro+): záložkovací knihovna URL s faviconem, stejný systém složek/sdílení/liků; 12 nových DB tabulek |
| v2.12.1 | 4. 3. 2026 | Fix: Nastavení workspace – horizontální tab scrollbar (8 záložek) → vertikální levé menu (w-44) + rozšíření layout na max-w-5xl |
| v2.12.0 | 4. 3. 2026 | Oslovení (display_nickname v profilu, greeting na Přehledu); Timer always visible (per-user toggle, profile.timer_always_visible); Předplatné v Nastavení (lazy monthly snapshots do trackino_workspace_subscriptions); Kalendář redesign (mini cal + week time grid + settings modal, calendar_day_start/end); App Settings skupina Společnost; Nastavení workspace záložka Společnost (society_modules_enabled JSONB); SQL migrace: ALTER trackino_profiles ADD display_nickname/timer_always_visible/calendar_day_start/calendar_day_end; CREATE TABLE trackino_workspace_subscriptions; ALTER trackino_workspaces ADD society_modules_enabled |
| v2.11.0 | 4. 3. 2026 | Sekce SPOLEČNOST v sidebaru (Pro+Max) – Znalostní báze (placeholder), Dokumenty (soubory+složky+Storage), Firemní pravidla (rich text editor), Pravidla v kanceláři (rich text editor); Tým – toggle can_manage_documents; Fix: Připomínky layout záhlaví + šířka formuláře; SQL migrace: trackino_workspace_pages, trackino_document_folders, trackino_documents, ALTER workspace_members ADD can_manage_documents |
| v2.10.0 | 4. 3. 2026 | Dokumentace skryta (jen MasterAdmin + Max tarif); Žádosti – 13 nových kategorií + průvodce kategoriemi (collapsible panel); Fix: select arrow + header layout v Žádostech |
| v2.9.0 | 4. 3. 2026 | Nový modul Žádosti (Pro+Max); Nový modul Připomínky anonymní (Pro+Max); Tým – toggles can_process_requests + can_receive_feedback; Kalendář – přejmenování Liste→Seznam + fix color picker; Nastavení – české názvy rolí; Přehled hodin – celá jména bez ořezu; Měřič – záhlaví dnů jako v Reportech |
| v2.8.0 | 4. 3. 2026 | Nový modul Kalendář (Max tarif) – 3 pohledy (Měsíční/Týdenní/Seznam), sync s Dovolenou a Důležitými dny; Fix: Sidebar – kolize badge s hvězdičkou Oblíbených |
| v2.7.2 | 4. 3. 2026 | Fix: app-settings přesměrování při refreshi (definitivní); Fix: Dovolená rozhozené sloupce (pevné šířky); Badge čekajících žádostí o dovolenou v Sidebaru |
| v2.7.1 | 4. 3. 2026 | Fix: app-settings falešné přesměrování při refreshi (authLoading guard); Fix: vacation infinite loop (useMemo pro subordinateUserIds); Fix: planner chybějící borderBottom na leading gap buňkách |
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

## 18. Kalendář – architektura (calendar/page.tsx)

### Tabulky
- `trackino_calendars` – vlastní kalendáře uživatele (auto-vytvoří se výchozí „Můj kalendář")
- `trackino_calendar_events` – ruční události; pole `source='manual'`, `source_id=null`
- `trackino_calendar_shares` – sdílení (databáze připravena, UI zatím nezaimplementováno)

### Pohledy
- `'list'` – chronologický výpis po měsících, 6 měsíců dopředu od začátku aktuálního měsíce
- `'week'` – 7 sloupců (Po–Ne), `getMonday(currentDate)` jako začátek
- `'month'` – mřížka; týdny začínají pondělím; dny mimo měsíc jsou šedě podbarveny

### DisplayEvent (lokální typ)
```typescript
interface DisplayEvent {
  id: string; title: string;
  start_date: string; end_date: string;
  color: string;
  source: 'manual' | 'vacation' | 'important_day';
  source_id: string;
  calendar_id?: string;
  description?: string;
  is_all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
}
```

### Zdroje dat (automatická synchronizace)
- **Ruční události** – `trackino_calendar_events` filtrované dle `selectedCalendarIds`
- **Dovolená** – `trackino_vacation_entries` kde `status='approved'` a `user_id=user.id`; vždy viditelné (nelze filtrovat dle kalendáře)
- **Důležité dny** – `trackino_important_days`; opakující se záznamy rozvinout přes `visibleRange` pomocí funkce `getImportantDayOccurrences()`

### Klíčové funkce
- `fetchData()` – načte calendars, events, vacation, important days; auto-vytvoří výchozí kalendář pokud žádný neexistuje
- `getImportantDayOccurrences(day, rangeStart, rangeEnd)` – vrátí seznam výskytů v daném rozsahu (zpracovává weekly/monthly/yearly recurrence)
- `eventsOnDay(day)` – filtruje displayEvents pro konkrétní den (multiday overlap)
- `openNewEvent(date?)` – otevře formulář s předvyplněným datem
- `saveEvent()` – INSERT nebo UPDATE do trackino_calendar_events
- `saveCalendar()` – INSERT nebo UPDATE do trackino_calendars

### SQL migrace (nutno spustit v Supabase)
Viz Nápověda → Kalendář nebo Help page.tsx pro plný SQL.

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

## 18. Žádosti – architektura (requests/page.tsx)

### Workflow
```
Zaměstnanec podá žádost  →  status: 'pending'
Admin/Owner přidá žádost  →  status: 'pending' (stejná logika)

Reviewer schválí  →  status: 'approved', reviewed_by, reviewed_at
  → pokud type='vacation': vytvoří trackino_vacation_entries + syncVacationToPlanner()
Reviewer zamítne  →  status: 'rejected', reviewer_note (dialog pro zadání)
```

### Typy žádostí
```typescript
type RequestType = 'vacation' | 'software' | 'business_trip' | 'company_card' | 'other';
```

### Key state variables
- `activeTab: 'mine' | 'pending'` – tab state ('pending' jen pro reviewery)
- `canProcessRequests = isWorkspaceAdmin || isManager || isMasterAdmin || currentMembership?.can_process_requests`
- `myRequests` – všechny žádosti aktuálního uživatele
- `pendingRequests` – čekající žádosti od ostatních (pro reviewery)

### WorkspaceMember toggle
```typescript
can_process_requests: boolean  // nový sloupec, DEFAULT false
```

### SQL migrace
```sql
ALTER TABLE trackino_workspace_members
  ADD COLUMN IF NOT EXISTS can_process_requests boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_receive_feedback boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS trackino_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('vacation','software','business_trip','company_card','other')),
  title text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reviewer_note text NOT NULL DEFAULT '',
  vacation_start_date text,
  vacation_end_date text,
  vacation_days integer,
  vacation_entry_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 19. Připomínky – architektura (feedback/page.tsx)

### Anonymita
- Tabulka `trackino_feedback` záměrně **nemá** sloupec `user_id`
- Při vkládání se neodesílá žádný identifikátor uživatele
- Nikdo (ani Master Admin) nemůže zjistit, kdo připomínku napsal

### Oprávnění k zobrazení
```typescript
const canViewFeedback = isMasterAdmin || isWorkspaceAdmin || currentMembership?.can_receive_feedback;
```

### WorkspaceMember toggle
```typescript
can_receive_feedback: boolean  // nový sloupec, DEFAULT false
```

### Key state
- `feedbackList` – všechny připomínky workspace (jen pro canViewFeedback)
- `is_resolved` – bool, toggle checkboxem
- Sekce „Nevyřízené" / „Vyřízené" v zobrazení

### SQL migrace
```sql
CREATE TABLE IF NOT EXISTS trackino_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  -- Záměrně bez user_id – plná anonymita
  message text NOT NULL DEFAULT '',
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 20. Sekce SPOLEČNOST – architektura

### Moduly
- `knowledge_base` → `/knowledge-base` – placeholder (připravujeme)
- `documents` → `/documents` – správa souborů a složek
- `company_rules` → `/company-rules` – textová stránka (rich text editor)
- `office_rules` → `/office-rules` – textová stránka (rich text editor)

### Dokumenty (documents/page.tsx)
- **Tabulky:** `trackino_document_folders`, `trackino_documents`
- **Storage:** Supabase bucket `trackino-documents` (private); signed URL (60s) pro čtení
- **Oprávnění:** `canManage = isMasterAdmin || isWorkspaceAdmin || currentMembership?.can_manage_documents`
- **Typy souborů:** MIME whitelist (PDF, Word, Excel, PPT, obrázky, ZIP, TXT, CSV); max 20 MB
- **Cesta souboru:** `{workspace_id}/{uuid}.{ext}` v bucketu
- **Složky:** barva, pořadí (sort_order), filtrování v levém panelu; `null` folder_id = bez složky

### Textové stránky (company-rules, office-rules)
- **Tabulka:** `trackino_workspace_pages` s UNIQUE `(workspace_id, slug)`
- **Slug:** `'company-rules'` nebo `'office-rules'`
- **Editor:** contentEditable div + `document.execCommand()` (H2/H3/B/I/U/lists/links)
- **Oprávnění editace:** `isWorkspaceAdmin || isMasterAdmin`
- **Fallback:** DEFAULT_CONTENT (statický HTML) pokud záznam v DB neexistuje

### SQL migrace (poskytnout uživateli)
```sql
-- Textové stránky workspace
CREATE TABLE IF NOT EXISTS trackino_workspace_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  slug text NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (workspace_id, slug)
);
ALTER TABLE trackino_workspace_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_workspace_pages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Složky dokumentů
CREATE TABLE IF NOT EXISTS trackino_document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_document_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_document_folders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dokumenty
CREATE TABLE IF NOT EXISTS trackino_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES trackino_document_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'file' CHECK (type IN ('file','link')),
  file_path text,
  file_size bigint,
  file_mime text,
  url text,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Nové oprávnění na member
ALTER TABLE trackino_workspace_members
  ADD COLUMN IF NOT EXISTS can_manage_documents boolean NOT NULL DEFAULT false;
```

---

## 18. Oslovení (nickname) – architektura

### DB sloupec
`trackino_profiles.display_nickname text NOT NULL DEFAULT ''`

### Inicializace při zobrazení profilu
```typescript
setDisplayNickname(profile.display_nickname?.trim()
  ? profile.display_nickname
  : (profile.display_name?.split(' ')[0] ?? ''));
```

### Použití na homepage (page.tsx)
```typescript
const nickname = profile?.display_nickname?.trim()
  || profile?.display_name?.split(' ')[0]
  || 'uživateli';
// Zobrazeno jako: {greetingPrefix}, {nickname}!
```

---

## 19. Timer always visible – architektura

### DB sloupec
`trackino_profiles.timer_always_visible boolean NOT NULL DEFAULT false`

### DashboardLayout.tsx (podmínka renderu TimerBaru)
```tsx
{(showTimer || (profile?.timer_always_visible ?? false)) && !isPendingApproval && !showLockedScreen ? (
  <div className="flex-1 min-w-0">
    <TimerBar ... />
  </div>
) : (
  <div className="flex-1" />
)}
```
`profile` je dostupný přes `useAuth()` přímo v `DashboardLayout` – není potřeba předávat prop.

---

## 20. WorkspaceSubscription – architektura

### Tabulka `trackino_workspace_subscriptions`
| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | uuid | PK |
| workspace_id | uuid | FK na trackino_workspaces |
| year | int | Rok snapshotu |
| month | int | Měsíc snapshotu (1–12) |
| tariff | text | Tarif v daném měsíci |
| active_members | int | Počet aktivních členů |
| created_at | timestamptz | Čas vytvoření |

### Lazy snapshot (settings/page.tsx, záložka Předplatné)
1. Zkontroluj, zda záznam pro aktuální year+month existuje
2. Pokud ne → spočítej `COUNT(trackino_workspace_members WHERE approved=true)` → INSERT snapshot
3. Načti historii ORDER BY year DESC, month DESC

---

## 21. Kalendář – week view s časovou osou

### DB sloupce (trackino_profiles)
- `calendar_day_start int NOT NULL DEFAULT 8` – začátek dne (0–23)
- `calendar_day_end int NOT NULL DEFAULT 18` – konec dne (1–24)

### Architektura week view (calendar/page.tsx)
- `ROW_H = 60` px per hour
- **Záhlaví dnů** – 7 sloupců s názvem dne + číslem dne, today zvýrazněn primární barvou
- **All-day strip** – renderuje se pouze pokud existují celodennní události; zobrazuje EventPill komponenty
- **Časová mřížka** – `Array.from({ length: calDayEnd - calDayStart }, ...)` → `height: ROW_H` pro každou hodinu
- **Timed events** – `position: absolute`, `top = (startMin - dayStartMin) * (ROW_H/60)`, `height = (endMin - startMin) * (ROW_H/60)`

### Mini kalendář
- State `miniCalDate` – nezávislá navigace mini kalendáře
- Při navigaci (goPrev/goNext/goToday) se `currentDate` a `miniCalDate` synchronizují
- Kliknutím na den v mini kalu: `setCurrentDate(day); setMiniCalDate(day);`
- `miniCalGrid` = useMemo, stejná logika jako `monthGrid` ale pro `miniCalDate`

---

## 22. Workspace society_modules_enabled – architektura

### DB sloupec
`trackino_workspaces.society_modules_enabled jsonb NOT NULL DEFAULT '{"knowledge_base":true,"documents":true,"company_rules":true,"office_rules":true}'`

### WorkspaceContext.tsx (enabledModules useMemo)
Po `computeEnabledModules()` se aplikuje filtr:
```typescript
const SOCIETY_MODS = ['knowledge_base', 'documents', 'company_rules', 'office_rules'] as const;
const sConfig = currentWorkspace?.society_modules_enabled ?? {};
for (const mod of SOCIETY_MODS) {
  if (sConfig[mod] === false) {
    modules.delete(mod as ModuleId);
  }
}
```
Globální tariffConfig má vždy přednost – society toggle může pouze vypnout, nikdy zapnout modul který není povolen tarifem.

### Nastavení workspace → záložka Společnost
- Načítání: z `currentWorkspace.society_modules_enabled` v useEffect
- Uložení: `supabase.from('trackino_workspaces').update({ society_modules_enabled: societyModules })` + `refreshWorkspace()`

---

## 23. Nastavení workspace – navigační layout (settings/page.tsx)

### Layout
- Outer wrapper: `max-w-5xl` (rozšířeno z původního `max-w-3xl`)
- Dvousloupcové rozvržení: `flex gap-6 items-start`
  - **Levý sloupec** (`w-44 flex-shrink-0`): vertikální `<nav>` s tlačítky pro každou sekci
  - **Pravý sloupec** (`flex-1 min-w-0`): obsah aktivní sekce + message banner

### Tab typ
```typescript
type SettingsTab = 'general' | 'society' | 'subscription' | 'billing' | 'fields' | 'vacation' | 'cooperation' | 'modules';
```

### Sekce (v pořadí)
1. **Obecné** – název workspace, tarif, logo, formát data/čísel, začátek týdne
2. **Společnost** – per-workspace toggle pro 4 Společnost moduly
3. **Předplatné** – aktuální plán, history snapshotů, přechod na Free
4. **Fakturace** – fakturační údaje workspace
5. **Povinná pole** – required_fields konfigurace
6. **Dovolená** – can_use_vacation per member
7. **Spolupráce** – manager assignments
8. **Moduly** – per-user module_overrides

### Styl aktivní položky v levém menu
```tsx
style={{
  background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
  boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
}}
```

---

## 24. Prompty – architektura (prompts/page.tsx)

### DB tabulky
| Tabulka | Popis |
|---------|-------|
| `trackino_prompt_folders` | Složky pro prompty (parent_id self-ref, owner_id, is_shared) |
| `trackino_prompt_folder_shares` | Sdílení složky: user_id=NULL=celý workspace, jinak konkrétní user |
| `trackino_prompts` | Záznamy promptů (title, content HTML, is_shared, folder_id) |
| `trackino_prompt_comments` | Komentáře k promptu (user_id, content, created_at) |
| `trackino_prompt_likes` | Liky (PK: prompt_id + user_id) – unikátní per uživatel |
| `trackino_prompt_favorites` | Oblíbené (PK: prompt_id + user_id) |

### Viditelnost promptů
Prompt je viditelný pokud: `created_by === userId` OR `is_shared === true` OR `folder_id IN (sdílené složky pro userId nebo workspace)`

### FolderTree komponenta
- Rekurzivní komponenta, `depth` prop sleduje hloubku (max 5)
- `expanded: Set<string>` – lokální state pro rozbalení
- Hover akce na složce: + podsložka, sdílet, přejmenovat, smazat (jen owner)
- Ikona složky: modrá pokud is_shared, šedá pokud soukromá

### RichEditor komponenta
- `contenteditable` div s `document.execCommand` pro formátování
- Kódové bloky: `<pre><code>` s inline stylem pro tmavé pozadí
- `extractCodeBlocks(html)` – regex extrakce obsahu `<pre><code>` pro kopírování

---

## 25. Záložky – architektura (bookmarks/page.tsx)

### DB tabulky
| Tabulka | Popis |
|---------|-------|
| `trackino_bookmark_folders` | Složky pro záložky (stejná struktura jako prompt_folders) |
| `trackino_bookmark_folder_shares` | Sdílení složky záložek |
| `trackino_bookmarks` | Záložky (title, url, description, is_shared, folder_id) |
| `trackino_bookmark_comments` | Komentáře k záložce |
| `trackino_bookmark_likes` | Liky (PK: bookmark_id + user_id) |
| `trackino_bookmark_favorites` | Oblíbené (PK: bookmark_id + user_id) |

### Klíčové funkce
- `getFaviconUrl(url)` – Google Favicons API: `https://www.google.com/s2/favicons?domain={hostname}&sz=32`
- `getDomain(url)` – vrací origin URL pro odkaz na homepage
- URL prefix: pokud url nezačíná `https?://`, automaticky doplní `https://`
- Všechny URL otevírány s `target="_blank" rel="noopener noreferrer"`

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
