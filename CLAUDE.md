# CLAUDE.md – Trackino dokumentace

> Kompletní dokumentace projektu pro AI asistenta (Claude). Vždy komunikuj česky.
> Aktualizováno: 8. 3. 2026 (v2.44.4)

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
| `trackino_profiles` | id, display_name, display_nickname, email, avatar_color, is_master_admin, timer_always_visible, timer_bottom_mobile, calendar_day_start, calendar_day_end | Profily uživatelů (rozšíření auth.users) |
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
| `trackino_calendar_shares` | id, calendar_id, shared_with_user_id (uuid\|null), share_with_workspace (bool), show_details (bool), can_edit, created_at | Sdílení kalendáře: shared_with_user_id=null + share_with_workspace=true = sdílení celému workspace |
| `trackino_calendar_share_prefs` | id, calendar_id, user_id, is_enabled (bool), color_override (text\|null), created_at | Preference příjemce sdíleného kalendáře (viditelnost, barva) |
| `trackino_ics_event_cache` | id, subscription_id, workspace_id, uid, title, description, start_date, end_date, start_time, end_time, is_all_day, synced_at | Cache ICS událostí pro sdílení (bez URL exposure) – UNIQUE(subscription_id, uid) |
| `trackino_calendar_event_attendees` | id, event_id, workspace_id, user_id, status ('pending'\|'accepted'\|'declined'\|'maybe'\|'updated'), created_at, prev_start_date, prev_end_date, prev_start_time, prev_end_time, prev_location | Účastníci událostí s RSVP statusem – UNIQUE(event_id, user_id); status 'maybe' = nezávazně (žlutý, prefix ~); 'updated' = přijatá událost byla změněna organizátorem, prev_* uchovávají předchozí hodnoty |
| `trackino_workspace_pages` | id, workspace_id, slug ('company-rules'\|'office-rules'), content (HTML), updated_at, updated_by | Per-workspace editovatelné textové stránky (UNIQUE workspace_id+slug) |
| `trackino_document_folders` | id, workspace_id, name, color, sort_order, created_by, created_at, updated_at | Složky pro organizaci dokumentů |
| `trackino_documents` | id, workspace_id, folder_id (uuid\|null), name, type ('file'\|'link'), file_path (text\|null), file_size (int\|null), file_mime (text\|null), url (text\|null), description, created_by, created_at, updated_at | Firemní dokumenty a odkazy; soubory uloženy v Supabase Storage bucket `trackino-documents` |
| `trackino_calendar_event_notes` | id, workspace_id, user_id, event_ref (text – ID události), content (HTML), tasks (jsonb – TaskItem[]), is_important (bool), is_done (bool), is_favorite (bool), created_at, updated_at | Poznámky k událostem v kalendáři – per-user, UNIQUE (workspace_id, user_id, event_ref) |

### Nové sloupce (v2.23.0)
- `trackino_profiles.birth_date text DEFAULT NULL` – datum narození uživatele (YYYY-MM-DD), zobrazuje se v Narozeninách v kalendáři
- `trackino_workspace_members.can_view_birthdays boolean NOT NULL DEFAULT false` – oprávnění vidět narozeniny kolegů v kalendáři

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

### Collapse (v2.15.0)
- Desktop/tablet: sidebar lze skrýt/zobrazit – stav `collapsed` předáván z `DashboardLayout` jako prop
- `collapsed = true` → sidebar vyjede doleva (`lg:-translate-x-full`)
- `collapsed = false` → sidebar je viditelný (`lg:translate-x-0`)
- State uložen v `localStorage['trackino_sidebar_collapsed']` (`'1'` = collapsed)
- V headerů sidebaru: malé `hidden lg:flex` tlačítko s chevron-left ikonou (volá `onCollapseDesktop()`)
- V `DashboardLayout.tsx`: hamburger tlačítko vždy viditelné; na mobilu otevírá overlay, na desktopu (`window.innerWidth >= 1024`) volá `toggleDesktopSidebar()`
- Main content area: `${!sidebarCollapsed ? 'lg:ml-[var(--sidebar-width)]' : ''} transition-[margin] duration-200 ease-in-out`

### Interface
```typescript
interface SidebarProps {
  open: boolean;           // overlay na mobilu
  onClose: () => void;
  collapsed?: boolean;     // desktop collapse stav
  onCollapseDesktop?: () => void;
}
```

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

### Badge (odznaky) v navigaci
Červené kulaté odznaky s počtem nevyřízených položek u nav items:
| Stránka | Badge count | Oprávnění |
|---------|------------|-----------|
| Dovolená (`/vacation`) | `pendingVacationCount` – čekající žádosti o dovolenou | admin, manager |
| Žádosti (`/requests`) | `pendingRequestCount` – čekající žádosti ke schválení | admin, manager, masterAdmin, can_process_requests |
| Fakturace (`/invoices`) | `returnedInvoiceCount + pendingInvoiceApprovalCount` – vrácené + čekající ke schválení | returned: can_invoice; approval: admin, manager |
| Připomínky (`/feedback`) | `unresolvedFeedbackCount` – nevyřízené připomínky | masterAdmin, admin, can_receive_feedback |

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

### Mobilní 2-řádkový layout (v2.15.0)
- Root div: `flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full`
- **Řádek 1 (mobil)**: text input „Na čem pracuji" – `text-base sm:text-sm` (iOS anti-zoom, viz pravidlo 11 v CLAUDE-ASISTENT.md)
- **Řádek 2 (mobil)**: inner div `flex items-center gap-2 sm:gap-3 flex-shrink-0` s pickery (projekt, kategorie, tag) + `ml-auto sm:ml-0` na timer display (tlačí čas doprava na mobilu)
- Na desktopu (`sm:`) vše v jednom řádku jako dříve
- `DashboardLayout` header výška: `py-2.5 sm:py-0 sm:h-[var(--topbar-height)]` (auto-výška na mobilu, pevná na desktopu)

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
| iOS Safari automaticky zoomuje při focusu na input | Font-size inputu je menší než 16px | Použít `text-base sm:text-sm` na všech inputech a textareách |
| Day group header má ostré rohy (šedé pozadí přesahuje zaoblenění karty) | Div s `background` uvnitř `rounded-xl` containeru chybí `rounded-t-xl` | Přidat `rounded-t-xl` na header div uvnitř rounded karty |

---

## 14. Changelog verzí

| Verze | Datum | Klíčové změny |
|-------|-------|---------------|
| v2.44.4 | 8. 3. 2026 | Kalendář: oprava scroll pozice při navigaci – přidán currentDate do deps scroll useLayoutEffect+useEffect → scroll na calViewStart*ROW_H se spustí i při prev/next/today |
| v2.44.3 | 8. 3. 2026 | Globální iOS zoom prevence: globals.css media query (max-width:640px) font-size:16px!important na input/textarea/select/[contenteditable] – pokrývá celou aplikaci; pravidlo přidáno do CLAUDE-ASISTENT.md |
| v2.44.2 | 8. 3. 2026 | Poznámky: auto-clear názvu nové poznámky onFocus pokud title==='Nová poznámka' (stejný vzor jako KB) |
| v2.44.1 | 8. 3. 2026 | KB: akce header vpravo na mobilu (self-end md:self-auto), fix tab scroll (touchAction:pan-x + overscrollBehavior:contain), ul/ol padding-left 20px→32px (prose-kb+prose-view), auto-clear titulku nové stránky onFocus pokud editTitle==='Nová stránka' |
| v2.44.0 | 8. 3. 2026 | Poznámky: 3řádkový výpis (název/popisek/datum+autor), větší action buttony na mobilu (w-9 h-9, gap-1.5), standardní 4-path koš ikona, task panel větší na mobilu (w-5 h-5 checkboxy, text-base inputy=iOS zoom fix, viditelné × tlačítko); KB: flex-col-reverse header (akce nahoře, název přes šířku na mobilu), datum month:numeric (2. 3. 2026), px-5 odsazení obsahu na mobilu, overflow-x-auto tabs, text-base komentář input (iOS zoom fix), pb-8 pod komentářem |
| v2.43.3 | 8. 3. 2026 | Poznámky: action buttony (Důležité/Oblíbené/Přesunout/Archivovat) vždy viditelné na mobilu (opacity-100 md:opacity-0 md:group-hover:opacity-100); KB: folder hover menu + task remove tlačítko vždy viditelné na mobilu |
| v2.43.2 | 8. 3. 2026 | Poznámky: URL auto-link při Space/Enter v editoru (handleEditorKeyDown + handleKeyDown v NoteEditor+CalEventNoteEditor; DOM manipulation: Range API, createTextNode, createElement('a'), cursor reposition) |
| v2.43.1 | 8. 3. 2026 | Poznámky: fetchMembers přepnut na dvou-krokový fetch (workspace_members → profiles) → sdílení složek „Konkrétní uživatelé" zobrazuje členy; Dokumenty: přidáno tlačítko editace (tužka) + edit modal (název/popis/složka/url), ikona koše sjednocena na 4-path SVG; AI asistent: ikona Nastavení → gear SVG |
| v2.43.0 | 8. 3. 2026 | KB: panel s úkoly (checklist, editTasks state, kbTaskRefs, addKbTask/toggleKbTask/updateKbTaskText/removeKbTask, SQL: ALTER trackino_kb_pages ADD tasks jsonb DEFAULT '[]'), sdílení složek (trackino_kb_folder_shares tabulka, is_shared na folder, openShare/saveShare funkce, KbFolderShare typ), datum s rokem na homepage, status dot v Nově vytvořené, info-circle ikona Nezařazené; Poznámky: nadpis Poznámky v levém panelu, Všechny poznámky nav položka, pořadí Události→Archiv, URL klikatelné v NoteEditor+CalEventNoteEditor (handleEditorClick+handleBlur+linkifyHtml), sdílení ve stylu karet (3 volby s popisky) |
| v2.40.0 | 7. 3. 2026 | Znalostní báze: redesign navigace – levý panel čistě navigační (bez inline stránek), nový typ ListFilter (discriminated union), nová komponenta PageListView (mezivrstva seznam stránek při aktivním filtru), tlačítko ← Zpět v záhlaví stránky (backToList), computed showList/showWelcome; fulltextové hledání v názvech+obsahu+štítcích; animace kopírování kódu (CSS třída kb-code-copied, zelená fajfka 1,5s, editor+viewer) |
| v2.39.3 | 7. 3. 2026 | Znalostní báze: kurzor uvnitř kód/checklist/infobox (insBlock+data-kbm), infobox color picker (6 barev, data-color, CSS variants, palette ::after, floating picker), Enter v infoboxu = br, Revize přesunuta z hlavičky → záložka reviews (ℹ→SVG), větší odsazení H1/H2/H3+bloky (16–28px), checklist vertical-align fix, filtr Podle zmínky v sidebaru (mentionFilter state) |
| v2.39.2 | 7. 3. 2026 | Znalostní báze: Naposledy upravené v levém sidebaru (collapsible, top 10 s cestou složky), Nezařazené a Podle stavu filtry v sidebaru (s počty), dvousloupcová úvodní stránka (upravené+nové, 10 položek každý), tab Odkazující stránky (backlinks s cestou+stavem), oprava layoutu edit polí Status+Složka+Štítky, odsazení puntíku stavu v menu (ml-1 mr-2) |
| v2.39.1 | 7. 3. 2026 | Automatizace: editace rozvrhu (tužka → modal s hodinam/minutami/dny/timezone), fix dvojitého lomítka v URL (trailing slash strip); Timer: auto manager note "Práce 8+h v kuse. Ověřit." po 8h s vybraným projektem+kategorií+úkolem; AI asistent: výška stránky s paddingem u patičky, Firecrawl kredity přesunuty do pravého panelu (kompaktní progress bar) |
| v2.39.0 | 7. 3. 2026 | Automatizace: nová záložka v Nastavení (cron-job.org integrace), 5 šablon (weekly-report AI, inactive-check, kb-reviews-digest, feedback-summary AI, vacation-report), proxy routes /api/cron-jobs/*, 5 cron action handlers /api/cron/*, CRON_SECRET server-side injekce, výsledky v trackino_cron_results |
| v2.38.0 | 7. 3. 2026 | Znalostní báze: vkládání kdekoliv (savedRange+onMouseDown), plovoucí selection popup (Odkaz/@/Stránka), nový vzhled Callout+Toggle (color-mix, animovaná šipka), checklist bez auto textu, Revize v hlavičce stránky (pill odznaky, červený badge, odebrán tab Recenze→záložky: Komentáře/Historie/Přístupy); AI asistent: měsíční statistiky tokenů per user, per-user token limity (denní/týdenní/měsíční) |
| v2.37.3 | 7. 3. 2026 | Znalostní báze: 2řádkový toolbar (SVG ikony místo emoji), přiřazení stránky do složky (edit mód + hover v levém panelu), kopírování obsahu (clipboard), fix kódových bloků (min-height + Enter → nový řádek), standardní trash ikony |
| v2.37.2 | 7. 3. 2026 | AI asistent – oblíbené konverzace (hvězdička, sekce OBLÍBENÉ v sidebaru, uloženo v DB is_favorite); šedé zvýraznění aktivní konverzace (var(--bg-hover)); standardní ikona koše; SQL: ALTER TABLE trackino_ai_conversations ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false |
| v2.37.0 | 7. 3. 2026 | AI asistent redesign: konverzace ukládány v DB (trackino_ai_conversations + trackino_ai_messages); levý sidebar s vyhledáváním a mazáním; větší textarea (80–300px); token counter s progress barem; rychlý přepínač modelů (pill tlačítka); model info dialog s popisem + cenou v Kč; tarif změněn na Max only; oprávnění can_use_ai_assistant + ai_allowed_models per user; nastavení → záložka AI asistent (token limity, CZK kalkulačka, per-user modely); streaming usage via __USAGE__: suffix; trackino_ai_usage_limits tabulka |
| v2.36.1 | 7. 3. 2026 | AI asistent: počítadlo Firecrawl kreditů (🔥 X/500) v footeru; localStorage persist; barevné kódování (zelená/oranžová/červená); varování při <50 zbývajících kreditech; CREDITS_PER_SCRAPE=1, CREDITS_PER_SEARCH=7, FIRECRAWL_CREDIT_LIMIT=500 |
| v2.36.0 | 7. 3. 2026 | Firecrawl integrace: server-side API routes (/api/firecrawl/scrape + /api/firecrawl/search); AI asistent rozšířen o web search toggle (🌐) a auto-detekci URL → scraping obsahu; kontext z webu injektován do AI odpovědi; FIRECRAWL_API_KEY env var |
| v2.35.0 | 7. 3. 2026 | AI asistent: nový modul (Pro+Max) – chatovací okno napojené na OpenAI API; streaming; výběr modelu (GPT-4o/4o-mini/4-Turbo/o1-mini); temperature; system prompt; Markdown rendering; src/lib/ai-providers.ts (multi-provider infra); src/app/api/ai-chat/route.ts (serverová route); env: OPENAI_API_KEY |
| v2.34.0 | 7. 3. 2026 | Znalostní báze: plná implementace – hierarchické složky+stránky, rich text editor (H1–H3/B/I/U/seznam/checklist/callout/toggle/kód/link/@mention//page-link), fulltextové hledání, štítky, 5 šablon, stavy (Koncept/Aktivní/Archiv), verze s revert, komentáře, revizní připomínky (→Přehled K vyřízení), přístupová práva (is_restricted+trackino_kb_access), oblíbené; 7 nových DB tabulek |
| v2.33.0 | 7. 3. 2026 | Analýza kategorií: přidán filtr uživatele (select „Všichni uživatelé" pro admin/manager); sidebar scrollbar skrytý – zobrazí se až při hoveru (CSS třída sidebar-scroll) |
| v2.32.2 | 7. 3. 2026 | iOS overflow definitívní fix: transform:translateZ(0) na overflow-x-hidden+rounded containery (vacation, important-days, calendar modal, invoices, ManualTimeEntry) → GPU compositing opraví iOS border-radius+overflow-hidden bug; globals.css: appearance:none !important + webkit-datetime-edit-fields-wrapper fix; ManualTimeEntry: overflow-x-hidden přidán |
| v2.32.1 | 7. 3. 2026 | Definitivní oprava přetékání date/time inputů: globální CSS min-width:0 !important na input[type=date/time/datetime-local]; overflow-x-hidden na formulářových kartách (vacation, important-days, calendar modal, invoices); ManualTimeEntry grid-cols-2 sm:grid-cols-3 s Datum col-span-2 sm:col-span-1; notes custom range → grid-cols-2; invoices → grid-cols-1 sm:grid-cols-2 |
| v2.32.0 | 7. 3. 2026 | Overflow fix 2. kolo: min-w-0 + maxWidth:100% na date/time inputy (vacation/important-days/calendar/reports); reports filtr Od/Do → w-full grid grid-cols-2 s min-w-0 na buňkách; Reports položky → 3-řádkový layout (1=název, 2=projekt/kat/úkol/user, 3=čas+trvání+akce); 72× --bg-input→--bg-hover (24 souborů: 19 stránek + 5 komponent) |
| v2.31.0 | 7. 3. 2026 | Přehled: notif panel „K vyřízení" + pozvánky do kalendáře (calendar_invite type, fialová, ikonka kalendáře, dotaz na trackino_calendar_event_attendees kde status='pending' a user_id=current); Mobilní opravy: grid-cols-2 → grid-cols-1 sm:grid-cols-2 v Dovolené, Důl. dnech, Kalendáři (event modal Od/Do+časy, settings Od/Do); Tým/Manažeři: flex-col sm:flex-row, hidden sm:block separator, sm:w-52 místo pevného w-52; Reporty: period tabs px-2 sm:px-3 + zkrácený text (hidden sm:inline "Tento ") |
| v2.30.0 | 7. 3. 2026 | Mobil: auto-hide header při scrollu dolů (translateY(-100%)), zobrazí při velocity > 300px/s nebo upDelta > 100px; headerHiddenRef + scrollStateRef (stale closure safe); na desktopu vždy viditelné. TimerBar: prop `isBottomBar` – větší touch targety (w-11 h-11 start/stop), větší ikony, dropdowny nad lištou (rect.top - 324); DashboardLayout: safe-area-inset-bottom + 12px padding, calc(env(safe-area-inset-bottom)+130px) na content |
| v2.29.0 | 7. 3. 2026 | Timer: nový sloupec `timer_bottom_mobile` v trackino_profiles – na mobilu (< 640px) přesune Měřič do fixního bottom baru; žádná kolize s timer_always_visible (shouldShowTimer řídí viditelnost, timerAtBottom řídí pozici); content pb-24 když aktivní. Kalendář: panel Pozvánky – tlačítko v headeru (všechny pohledy), badge s pending počtem, filtrace dle stavu (Vše/Čeká/Přijato/Nezávazně/Odmítnuto), textové hledání, RSVP tlačítka, stránkování po 20 |
| v2.28.0 | 7. 3. 2026 | Kalendář: RSVP třetí stav 'maybe' (Nezávazně, žlutý, prefix ~); příjemce může kdykoliv změnit RSVP (3 tlačítka vždy viditelná); odmítnuté události zesvětlené (opacity ~45%, přeškrtnutý název) ve všech pohledech; kliknutí na slot v Týden/Den vyplní čas v novém event modalu |
| v2.27.0 | 7. 3. 2026 | Kalendář: nový attendee status `'updated'` – organizátor mění přijatou událost (datum/čas/místo) → přijatí účastníci dostanou dashed border + diff blok v modalu (přeškrtnuté staré hodnoty → nové); `trackino_calendar_event_attendees` rozšířena o prev_* sloupce |
| v2.26.0 | 7. 3. 2026 | Kalendář: čárkovaný rámeček + otazník u pending (čeká na potvrzení) událostí rozšířen do pohledů Den, Týden a Seznam (dosud jen Měsíc/EventPill) |
| v2.25.2 | 7. 3. 2026 | Kalendář/Seznam: badge sdílených událostí zobrazuje název kalendáře + jméno vlastníka (přidán `shared_calendar_name` do DisplayEvent, naplněn v `fetchSharedEvents`) |
| v2.25.1 | 7. 3. 2026 | Kalendář: sekce „SDÍLENÉ" přejmenována na „SDÍLENÉ KALENDÁŘE", color picker přesunut za label (hover, stejný vzor jako Automaticky/Další), sekce přesunuta nad Další kalendáře |
| v2.25.0 | 7. 3. 2026 | Kalendář: color picker pro Státní svátky, Jmeniny, Narozeniny v sekci Další kalendáře (hover → barevná tečka → picker); sjednocení checkboxů (všechny custom button s bílou fajfkou); sekce Automaticky – odstraněn puntík vedle checkboxu, color picker přesunut za label (hover); Tým: Datum narození přesunuto nad Typ spolupráce |
| v2.24.0 | 7. 3. 2026 | Kalendář: Dovolená + Důležité dny – toggle (checkbox) + color picker v sekci Automaticky; pohled „Den" (přejmenováno z Dnes); Fix: sdílení ICS kalendáře – error handling + SQL migrace pro FK |
| v2.23.0 | 7. 3. 2026 | Kalendář: Jmeniny (fialová, všichni) + Narozeniny kolegů (růžová, admin/can_view_birthdays) v sekci Další kalendáře; `birth_date` v Profilu + Týmu; `can_view_birthdays` toggle v Týmu; `src/lib/czech-namedays.ts` (366 jmen) |
| v2.22.1 | 7. 3. 2026 | Kalendář/Seznam: badge u sdílených událostí zobrazuje název kalendáře + jméno vlastníka |
| v2.22.0 | 7. 3. 2026 | Kalendář: kliknutím na jakoukoliv událost se otevře detail modal (vlastní = Edit tlačítko, sdílené/ICS = preview, účastník = RSVP tlačítka) |
| v2.21.0 | 7. 3. 2026 | Kalendář: Sdílení kalendářů (share modal, workspace/per-user, show_details toggle, ICS cache); SDÍLENÉ KALENDÁŘE sekce v levém panelu (toggle, color override); Rozšířený formulář události (Místo, Účastníci, URL, Upozornění, Popis→Poznámka); RSVP systém (attendees tabulka, pending dashed border, RSVP modal) |
| v2.20.11 | 7. 3. 2026 | Kalendář: today view opraven (přirozené CSS výšky, ne explicitní výpočet); desktop week scroll: double-rAF fallback po useLayoutEffect – flex-1 se stabilizuje po prvním paint |
| v2.20.10 | 7. 3. 2026 | Kalendář: název kal. v levém panelu klikatelný (otevře edit modal, přístupné na mobilu); tlačítko Smazat→Odstranit v modálu; výška scrollGrid přepočtena po načtení dat ([view,loading] deps) – scroll na calViewStart funkční na mobilu i desktopu |
| v2.20.9 | 7. 3. 2026 | Kalendář/Týden: scroll na calViewStart přes useLayoutEffect (synchronní, bez záblesku 0:00 při prvním načtení na mobilu i desktopu); odstraněn retry mechanismus 30×/50ms |
| v2.20.8 | 7. 3. 2026 | Žádosti/Archiv: badge Zamítnuto přesunut pod hlavní obsah (před Důvod zamítnutí), Schváleno zůstává vpravo nahoře; Kalendář/Levý panel: ikona koše (červená, hover) přidána vedle tužky pro ne-výchozí kalendáře |
| v2.20.1 | 6. 3. 2026 | Kalendář/Nastavení: odstraněn "Rozsah dne", grid vždy 0–24h (24 řádků); calDayStart/calDayEnd state odstraněny; topPx = _startMin*(ROW_H/60); scroll = calViewStart*ROW_H; nowTopPx vždy počítán; selecty viditelné části 0..24 |
| v2.20.0 | 6. 3. 2026 | Kalendář/Seznam mobil: md:items-start, w-full md:flex-1 na event card, tlačítko pozn. opacity-30 md:opacity-0; badge zobrazuje sub.name místo 'Ext. kalendář'; saveCalSettings: double-rAF scroll po uložení; vlastní checkbox (button+bílá fajfka) pro Mé kalendáře i Ext. odběry; iOS text-base na selectCls v settings/admin/app-changes |
| v2.19.0 | 6. 3. 2026 | Kalendář/Poznámky: checkboxy šedé (#9ca3af), animace kopírování (1.5s zelená fajfka); zapamatování pohledu v localStorage (trackino_calendar_view, výchozí 'week'); mobilní layout Seznamu (flex-col md:flex-row, w-full md:w-[520px]); Bez události: název sub z subscriptions.find (event_ref.slice(4,40)), celý checklist úkolů, bez line-clamp; Fakturace: self-start na filter select wrapperech |
| v2.18.1 | 6. 3. 2026 | Kalendář/Seznam: inline accordion poznámky (max 220px pod kartičkou, posunuje ostatní níže); šířka výpisu max-w-2xl (~50%); auto-save nahrazen tlačítky Uložit/Zrušit (isDirty pattern); meta tagy redesignovány jako colored pill tlačítka (Důležitá červená, Oblíbená žlutá, Hotovo šedá) |
| v2.18.0 | 6. 3. 2026 | Kalendář/Seznam: dvousloupcové rozvržení (vlevo výpis, vpravo panel poznámek pro vybranou událost); „Zobrazit dřívější události" – event-count-based (10 událostí, ne 6 měsíců), fixní rozsah 24 měsíců zpět; Mé kalendáře – font-size sjednocen na text-xs |
| v2.17.3 | 6. 3. 2026 | Žádosti/Archiv: sjednocení stylingu s Dovolenou (badge top-right, reviewer info inline, červený blok pro důvod zamítnutí); Kalendář/ICS: fix bug – opakující se události sdílí poznámky (přidán startDate do ID: `sub-{subId}-{uid}-{startDate}`); Kalendář/Poznámky: URL auto-linking (onBlur linkifyHtml), nové ikonky Praporek/Check/Hvězdička/Kopírovat/Koš, flagy is_important/is_done/is_favorite (DB migrace); Kalendář/Seznam: tlačítko „Zobrazit dřívější události" (listHistoryMonths +6 měs.); Kalendář/Levý panel: přesun Ext. kalendářů pod Mé kalendáře, odebrání barevných teček u checkboxů, collapse šipky u všech sekcí |
| v2.17.2 | 6. 3. 2026 | Sidebar: optimalizace badge (Promise.all místo 5 useEffects); Badge kruhy na stránkách Žádosti, Připomínky, Tým, Fakturace (nahrazení „(N)" za červený badge) |
| v2.17.1 | 6. 3. 2026 | Přehled: sjednocení formátu hodin v grafu (fmtHours); Sidebar: badge u Žádostí (pending), Připomínek (unresolved), Fakturace (pending approval) |
| v2.17.0 | 6. 3. 2026 | Přehled: notifikační panel „K vyřízení" (čekající dovolené, žádosti, připomínky, faktury); Přehled: týdenní sloupcový graf odpracovaných hodin (Recharts, 7 dní, průměr, trend) |
| v2.16.2 | 5. 3. 2026 | Sjednocení nadpisů stránek (text-xl, 14 stránek); sjednocení výšek toolbarových prvků na py-2 (7 stránek); Záložky+Prompty jméno autora místo avataru; záložky doména bez www. |
| v2.16.1 | 5. 3. 2026 | iOS auto-zoom prevence: text-base sm:text-sm na všech input/textarea/select v celé aplikaci (98 elementů, 25 souborů); FolderTree ⋮ mobilní dropdown (Prompty+Záložky); Sdílení složek „Nesdílet s nikým"; FolderTree dropdown fixed position (position:fixed+getBoundingClientRect); Záložky popis inline; Mobilní responzivita: Settings nav, Tým tabs, Admin karty, App-Settings tabulka, Kalendář časy |
| v2.16.0 | 5. 3. 2026 | Sidebar: WorkspaceSwitcher přesunut pod Dokumentaci (scrollovatelný, inline expanze jako user panel); Prompty: odstraněn expand chevron + jméno autora (jen datum); kliknutí na název → editační dialog; kódové bloky: clear placeholder on click, kopírovat ikona (SVG ::after + souřadnicová detekce); Sdílení (Prompty + Záložky): sekce „Konkrétní uživatelé" doplněna o seznam s avatary a bg-active výběrem; Sidebar reorganizace: Důležité dny → SLEDOVÁNÍ (pod Kalendář), Připomínky → SPOLEČNOST (pod Pravidla v kanceláři), NÁSTROJE = Záložky, Prompty, Převodník textu; Poznámky → Poznámky manažera všude; Nápověda: aktualizovány sekce a tarify dle nové struktury sidebaru |
| v2.15.0 | 5. 3. 2026 | Sidebar collapse: hamburger vždy viditelný, desktop collapse toggle s localStorage persist (trackino_sidebar_collapsed), transition-[margin]; Kalendář: view switcher (Seznam/Týden/Měsíc) přesunut do top headeru, levý panel reorder (Moje kalendáře nahoře, mini kalendář dole); Měřič mobile: 2-řádkový layout (flex-col sm:flex-row), text-base na inputu (iOS anti-zoom), bigger action icons (16px), rounded-t-xl fix na day header; Dovolená mobile: flex-col header, responsive button text; SQL banner odstraněn z Úpravy aplikace; CLAUDE-ASISTENT.md pravidlo 11 (iOS auto-zoom) |
| v2.14.0 | 5. 3. 2026 | WorkspaceSwitcher přesunut z headeru do Sidebaru (nad user panel, dropdown nahoru); Prompty + Záložky: Sdílené prompty/záložky virtuální složka, komentáře edit/delete, kopírování obsahu/URL, avatary s avatar_color, FolderTree hover opacity fix, panel wider md:w-72, select arrows fix; CLAUDE-ASISTENT.md pravidlo 10 (select šipky + color picker) |
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
- `trackino_calendar_events` – ruční události; pole `source='manual'`, `source_id=null`; rozšířeno o `location`, `url`, `reminder_minutes`
- `trackino_calendar_shares` – sdílení: `shared_with_user_id` nullable, `share_with_workspace` bool, `show_details` bool
- `trackino_calendar_share_prefs` – preference příjemce (is_enabled, color_override)
- `trackino_ics_event_cache` – cache ICS událostí pro sdílení (subscription_id, uid, title, start_date, …)
- `trackino_calendar_event_attendees` – RSVP systém; status: pending/accepted/declined

### Pohledy
- `'list'` – chronologický výpis po měsících, 6 měsíců dopředu od začátku aktuálního měsíce
- `'week'` – 7 sloupců (Po–Ne), `getMonday(currentDate)` jako začátek
- `'month'` – mřížka; týdny začínají pondělím; dny mimo měsíc jsou šedě podbarveny

### View switcher (v2.15.0)
- Přesunut z levého panelu do **top headeru** (vedle „Přidat událost")
- Tlačítka: „Seznam" / „Týden" / „Měsíc" (plné texty, ne zkratky)
- Responzivní: `px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium`
- „Přidat událost" button: `<span className="hidden sm:inline">Přidat událost</span><span className="sm:hidden">Přidat</span>`

### Levý panel – pořadí sekcí (v2.17.3)
1. **MÉ KALENDÁŘE** – checkbox (accentColor dle barvy kal.), bez barevné tečky
2. **EXTERNÍ KALENDÁŘE** – přesunuto pod Mé kalendáře; checkbox (accentColor), bez tečky; + refresh + přidat
3. **AUTOMATICKY** – Dovolená, Důležité dny (barevný čtvereček, bez checkboxu)
4. **DALŠÍ KALENDÁŘE** – Státní svátky (červená #ef4444), Jmeniny (fialová #7c3aed, pro všechny), Narozeniny (růžová #ec4899, jen canViewBirthdays); checkbox (accentColor dle barvy), bez tečky
- Každá sekce má **collapse šipku** vedle nadpisu – rozbalí/sbalí podřazené položky
- Stav collaspe: lokální React state (`myCalExpanded`, `extCalExpanded`, `autoExpanded`, `otherExpanded`)
- Barevné tečky odstraněny ze všech položek s checkboxem (barva je pouze přes `accentColor` na checkboxu)
- Mini kalendář – dole (`border-t pt-3 pb-3 flex-shrink-0`), nezměněno

### DisplayEvent (lokální typ)
```typescript
interface DisplayEvent {
  id: string; title: string;
  start_date: string; end_date: string;
  color: string;
  source: 'manual' | 'vacation' | 'important_day' | 'subscription' | 'holiday' | 'shared' | 'birthday' | 'nameday';
  source_id: string;
  calendar_id?: string;
  description?: string;
  is_all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  // nová pole (v2.21.0)
  location?: string;
  url?: string;
  reminder_minutes?: number | null;
  is_shared?: boolean;
  show_details?: boolean;
  shared_owner_name?: string;
  attendee_status?: 'pending' | 'accepted' | 'declined' | 'maybe';
  event_owner_id?: string;
}
```

### SharedCalendarInfo (lokální typ, v2.21.0)
```typescript
interface SharedCalendarInfo {
  share_id: string;
  calendar_id: string;
  type: 'calendar' | 'subscription';
  name: string;
  owner_name: string;
  color: string;
  show_details: boolean;
  is_enabled: boolean;
  color_override: string | null;
}
```

### Zdroje dat (automatická synchronizace)
- **Ruční události** – `trackino_calendar_events` filtrované dle `selectedCalendarIds`
- **Dovolená** – `trackino_vacation_entries` kde `status='approved'` a `user_id=user.id`; vždy viditelné (nelze filtrovat dle kalendáře)
- **Důležité dny** – `trackino_important_days`; opakující se záznamy rozvinout přes `visibleRange` pomocí funkce `getImportantDayOccurrences()`

### Klíčové funkce
- `fetchData()` – načte calendars, events, vacation, important days; auto-vytvoří výchozí kalendář pokud žádný neexistuje; volá fetchWorkspaceMembers, fetchCalendarShares, fetchSharedWithMe, fetchAttendeeEvents
- `getImportantDayOccurrences(day, rangeStart, rangeEnd)` – vrátí seznam výskytů v daném rozsahu (zpracovává weekly/monthly/yearly recurrence)
- `eventsOnDay(day)` – filtruje displayEvents pro konkrétní den (multiday overlap)
- `openNewEvent(date?)` – otevře formulář s předvyplněným datem
- `openEditEvent(event)` – otevře formulář pro editaci (včetně načtení attendees pro daný event)
- `saveEvent()` – INSERT nebo UPDATE do trackino_calendar_events + uložení attendees do trackino_calendar_event_attendees
- `saveCalendar()` – INSERT nebo UPDATE do trackino_calendars
- `fetchNotesBatch(refs)` – dávkové načtení poznámek (včetně is_important/is_done/is_favorite)
- `handleNoteSave(eventRef, content, tasks, meta)` – uloží/aktualizuje poznámku s meta flagy
- `handleNoteDelete(eventRef)` – smaže poznámku z DB a skryje panel
- `fetchWorkspaceMembers()` – načte členy workspace pro picker účastníků
- `fetchCalendarShares()` – načte sdílení, která owner nastavil pro své kalendáře
- `fetchSharedWithMe()` – načte sdílení, kde je přihlášený user příjemcem (nebo workspace-wide)
- `fetchSharePrefs()` – načte preference příjemce (color_override, is_enabled)
- `fetchAttendeeEvents()` – načte události, kde je user attendee; zobrazí se v displayEvents s attendee_status
- `respondToAttendance(eventId, status)` – UPDATE stavu RSVP (accepted/declined)
- `openShareModal(cal?, sub?)` – otevře share modal pro daný kalendář nebo ICS subscripci
- `saveShare()` – DELETE + INSERT do trackino_calendar_shares dle shareModalState
- `updateSharePref(calendarId, field, value)` – UPDATE v trackino_calendar_share_prefs

### ICS odběry – formát ID událostí (v2.17.3)
```
id = `sub-${subId}-${uid.slice(0,40)}-${startDate}`
```
- `startDate` je klíčový pro **opakující se události** – sdílejí stejné `UID` v ICS, ale mají různý startDate → každý výskyt dostane unikátní ID → poznámky se nepropagují

### Poznámky k událostem – architektura (v2.17.3)
```typescript
interface TaskItem { id: string; text: string; checked: boolean; }
interface EventNote {
  id?: string; content: string; tasks: TaskItem[];
  is_important?: boolean;  // červený rámeček + pozadí
  is_done?: boolean;       // přeškrtnutí + průhlednost
  is_favorite?: boolean;   // žlutý rámeček + pozadí
}
```
- **NotePanel** – contenteditable editor + checklist + toolbar ikonky
- **Toolbar ikonky**: B/I/U | odrážky/číselný seznam | Praporek | Check | Hvězdička | separator | Kopírovat | Koš
- **URL linking**: `linkifyHtml()` obalí plain URL do `<a>` tagu při `onBlur`; click na `<a>` otevře `window.open(_blank)` (interceptováno přes `handleEditorClick`)
- **Meta flagy**: uloženy do DB; vizuálně mění barvu rámečku a pozadí panelu
- **Koš**: volá `onDelete(eventRef)` → smaže řádek z DB + skryje panel

### Seznam – dvousloupcové rozvržení (v2.18.0)
- Levý sloupec: čistý výpis událostí (flex-1), pravý sloupec: panel poznámek (md:w-[360px])
- State `selectedListEventId: string | null` – vybraná událost pro pravý panel
- Kliknutím na 📄 ikonku u události → `setSelectedListEventId(id)` (toggle)
- Pravý panel: záhlaví s názvem události + barvy, tlačítko × zavřít, NotePanel klíč `right-{id}-{noteId}`
- Responzivní: `flex-col md:flex-row`, border-t na mobilu / border-l na md+

### Seznam – Zobrazit dřívější události (v2.18.0, přepis z v2.17.3)
- State `listHistoryCount: number` (default 0) – event-count-based (místo měsíců)
- `visibleRange` pro list pohled: pevný rozsah 24 měsíců zpět (nezávislý na stavu)
- Tlačítko: `setListHistoryCount(n => n + 10)` – načte 10 dalších starších událostí
- `pastEvents.slice(Math.max(0, len - listHistoryCount))` → zobrazí posledních N z pastEvents
- Podmínka zobrazení tlačítka: `pastEvents.length > listHistoryCount && !listSearch`

### SQL migrace (nutno spustit v Supabase)
```sql
ALTER TABLE trackino_calendar_event_notes
  ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_done     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
```

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

## 19. Timer visible/position – architektura

### DB sloupce
- `trackino_profiles.timer_always_visible boolean NOT NULL DEFAULT false` – zobrazit Měřič ve všech stránkách
- `trackino_profiles.timer_bottom_mobile boolean NOT NULL DEFAULT false` – na mobilu připnout ke spodní hraně

### DashboardLayout.tsx – logika pozice/viditelnosti (v2.29.0)
```tsx
// Detekce mobilu (< 640px = sm breakpoint)
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 640);
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, []);

// shouldShowTimer: zda je timer vůbec viditelný
// timerAtBottom: jen na mobilu a pokud user zapnul timer_bottom_mobile
const shouldShowTimer = (showTimer || (profile?.timer_always_visible ?? false)) && !isPendingApproval && !showLockedScreen;
const timerAtBottom = (profile?.timer_bottom_mobile ?? false) && isMobile;

// V headeru – jen pokud není přesunutý ke spodní hraně
{shouldShowTimer && !timerAtBottom ? (
  <div className="flex-1 min-w-0"><TimerBar ... /></div>
) : (
  <div className="flex-1" />
)}

// Fixed bottom bar – jen na mobilu s timer_bottom_mobile zapnutým (v2.30.0: safe area insets, isBottomBar prop)
{shouldShowTimer && timerAtBottom && (
  <div className="fixed bottom-0 left-0 right-0 z-40 border-t px-4 pt-3"
    style={{
      background: 'var(--bg-card)', borderColor: 'var(--border)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    }}>
    <TimerBar ... isBottomBar />
  </div>
)}

// main content dostane safe-area padding když je timer dole (v2.30.0)
<main
  className="flex-1 p-4 lg:p-6 flex flex-col"
  style={timerAtBottom && shouldShowTimer ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 130px)' } : undefined}
>
```
`profile` je dostupný přes `useAuth()` přímo v `DashboardLayout` – není potřeba předávat prop.

### DashboardLayout.tsx – auto-hide header (v2.30.0)
- Funguje **jen na mobilu** (`isMobile = true`), na desktopu `headerHidden` je vždy `false`
- Používá `headerHiddenRef` (stale-closure safe) + `scrollStateRef` (lastY, lastTime, upDelta) pro výpočet
- **Logika**: scroll dolů > 4px → skrýt; scroll nahoru > 4px: přičti do upDelta; zobraz pokud `velocity > 300px/s || upDelta > 100px`; y < 60 → vždy zobrazit
- `transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)'` + `transition-transform duration-200`
- `sticky top-0` zůstává – element je ve flow, layout se neposunuje

### TimerBar.tsx – isBottomBar prop (v2.30.0)
- `isBottomBar?: boolean` (default false) – předáváno z DashboardLayout když je timer fixně dole
- **Větší touch targety**: start/stop `w-11 h-11` (vs `w-9 h-9`), ikony 18/16px (vs 15/13px)
- **Větší picker buttony**: `px-2.5 py-2` (vs `px-2 py-1.5`), ikony 18px (vs 16px)
- **Větší discard**: `p-2.5` (vs `p-2`), ikona 18px (vs 16px)
- **Dropdowny nahoru**: `top: Math.max(8, rect.top - 324)` (vs `rect.bottom + 4`)
- **Gap**: `gap-3` vždy (vs `gap-2 sm:gap-3`)

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
- **Hover fix (v2.14.0)**: akční tlačítka používají `opacity-0 group-hover/folder:opacity-100 flex transition-opacity` místo `hidden group-hover/folder:flex` – zabraňuje skoku šířky při hoveru

### RichEditor komponenta
- `contenteditable` div s `document.execCommand` pro formátování
- Kódové bloky: `<pre><code>` s inline stylem pro tmavé pozadí
- `extractCodeBlocks(html)` – regex extrakce obsahu `<pre><code>` pro kopírování

### Nové stavy a funkce (v2.14.0)
- `showShared: boolean` – filtruje `p.is_shared === true` bez ohledu na složku; tlačítko "Sdílené prompty" v levém panelu (jen pokud existují sdílené prompty)
- `editingComment: { id: string; content: string } | null` – inline editace vlastního komentáře
- `deleteComment(id)` – smaže komentář z DB (`trackino_prompt_comments`)
- `updateComment()` – uloží editovaný komentář do DB
- Levý panel šířka: `md:w-56` → `md:w-72`
- `Member.avatar_color: string` – barva avataru z `trackino_profiles`

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

### Nové stavy a funkce (v2.14.0)
- `showShared: boolean` – virtuální složka "Sdílené záložky" (filtr `b.is_shared === true`)
- `editingComment: { id: string; content: string } | null` – inline editace vlastního komentáře
- `deleteComment(id)`, `updateComment()` – mazání a editace komentářů (`trackino_bookmark_comments`)
- Kopírování URL: `navigator.clipboard.writeText(b.url)` při kliknutí na ikonu
- `Member.avatar_color: string` – barva avataru autora a v komentářích
- Levý panel šířka: `md:w-56` → `md:w-72`

### WorkspaceSwitcher – architektura (v2.14.0, Sidebar.tsx)
- Přesunuto z `DashboardLayout.tsx` do `Sidebar.tsx` jako inline funkce `WorkspaceSwitcher()`
- Umístění: nad user panel (mezi `<nav>` a `<div className="border-t">`)
- Dropdown otevírán nahoru: `absolute left-3 right-3 bottom-full mb-1`
- Zobrazí se jen pokud `workspaces.length > 1`
- `DashboardLayout.tsx` nemá již žádnou logiku workspace switcheru

---

## 26. Sidebar Collapse – architektura (v2.15.0)

### State management (DashboardLayout.tsx)
```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('trackino_sidebar_collapsed') === '1';
});

const toggleDesktopSidebar = () => {
  setSidebarCollapsed(prev => {
    const next = !prev;
    if (typeof window !== 'undefined') {
      localStorage.setItem('trackino_sidebar_collapsed', next ? '1' : '0');
    }
    return next;
  });
};
```

### Hamburger tlačítko (vždy viditelné v DashboardLayout)
```tsx
<button
  onClick={() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      toggleDesktopSidebar();  // desktop: collapse/expand
    } else {
      setSidebarOpen(true);    // mobil: otevři overlay
    }
  }}
>
  {/* hamburger SVG */}
</button>
```

### Main content div
```tsx
<div className={`${!sidebarCollapsed ? 'lg:ml-[var(--sidebar-width)]' : ''} min-h-screen flex flex-col transition-[margin] duration-200 ease-in-out`}>
```

### Sidebar aside className
```tsx
className={`
  fixed top-0 left-0 bottom-0 z-50 w-[var(--sidebar-width)] flex flex-col
  border-r transition-transform duration-200 ease-in-out
  ${!collapsed ? 'lg:translate-x-0' : 'lg:-translate-x-full'}
  ${open ? 'translate-x-0' : '-translate-x-full'}
`}
```
- `open` = mobilní overlay otevřen (přes hamburgera)
- `collapsed` = desktop stav (z localStorage)

---

## 28. AI asistent – architektura (ai-assistant/page.tsx)

### Soubory
| Soubor | Popis |
|--------|-------|
| `src/lib/ai-providers.ts` | Konfigurace providerů (AiProvider, AiProviderConfig) + seznam modelů (AiModel, AI_MODELS) + helpery |
| `src/app/api/ai-chat/route.ts` | Serverová POST route – drží API klíče bezpečně na serveru; streaming přes ReadableStream; non-streaming pro modely bez podpory (o1-mini) |
| `src/app/(dashboard)/ai-assistant/page.tsx` | Chat UI – výběr modelu, temperature, system prompt, stream/stop, Markdown rendering |

### AI providers (src/lib/ai-providers.ts)
```typescript
export type AiProvider = 'openai'; // Budoucí: | 'anthropic' | 'google' | 'mistral'
export interface AiProviderConfig { id, name, envKey, baseUrl, available }
export interface AiModel { id, name, provider, description, contextWindow, supportsStreaming }
export const AI_PROVIDERS: AiProviderConfig[]
export const AI_MODELS: AiModel[]
export const DEFAULT_MODEL_ID = 'gpt-4o-mini'
export function getProviderForModel(modelId): AiProviderConfig | undefined
```

### Přidání nového providera
1. Přidat do `type AiProvider` v `ai-providers.ts`
2. Odkomentovat/přidat objekt do `AI_PROVIDERS[]` s `envKey` (název env proměnné)
3. Přidat modely do `AI_MODELS[]` se správným `provider`
4. Přidat env proměnnou do `.env.local` a Vercel
5. Serverová route (`/api/ai-chat/route.ts`) funguje automaticky – používá OpenAI-compatible formát

### API route (/api/ai-chat)
- `POST /api/ai-chat` – přijímá `{ messages, model, systemPrompt?, stream?, temperature?, maxTokens? }`
- Validace modelu, lookup providera, check env klíče
- Streaming: `ReadableStream` parses SSE chunks (`data: {...}` → delta content)
- Non-streaming: vrací `{ content, usage }`
- Chybové stavy: 400 neznámý model, 503 chybí API klíč, 500 interní chyba

### Env proměnné (přidat do .env.local i Vercel)
```
OPENAI_API_KEY=sk-...
# Budoucí:
# ANTHROPIC_API_KEY=...
# GOOGLE_AI_API_KEY=...
# MISTRAL_API_KEY=...
```

### Modul v systému
- ModuleId: `'ai_assistant'`
- Tarif: **Max only** (od v2.37.0 odstraněn z Pro tarifu)
- Přístup: master admin, workspace admin (owner/admin), nebo `can_use_ai_assistant = true` na membership
- Skupina: `'Nástroje'`
- Sidebar ikona: glühbirne/AI brain SVG

### Per-user AI nastavení (v2.37.0+)
- `trackino_workspace_members.can_use_ai_assistant boolean DEFAULT false` – explicitní přístup pro member/manager
- `trackino_workspace_members.ai_allowed_models text[] DEFAULT NULL` – NULL = vše; pole ID = omezená sada modelů
- Nastavení v: **Nastavení workspace → AI asistent** (záložka dostupná pro workspace adminy)
- Token limity: tabulka `trackino_ai_usage_limits` – workspace-wide (user_id IS NULL) nebo per-user

### Konverzace (v2.37.0+)
- Tabulka `trackino_ai_conversations` – per-user konverzace s titulkem a nastavením; sloupec `is_favorite boolean DEFAULT false` (v2.37.2)
- Tabulka `trackino_ai_messages` – jednotlivé zprávy s usage daty (tokeny, cena v USD)
- Auto-title: první zpráva ořezaná na 55 znaků
- Levý sidebar: seznam konverzací, vyhledávání, smazání, hvězdička oblíbených
- Sekce OBLÍBENÉ: v horní části sidebaru (jen pokud existují oblíbené), pod ní OSTATNÍ
- Aktivní konverzace: šedé zvýraznění `var(--bg-hover)` + border (nikoli modré)
- Token counter: `estimateTokens(text) = Math.ceil(text.length / 3.8)` – klientský odhad
- Usage data ze serveru: `__USAGE__:{json}` suffix ve streaming response → parsuje klient
- SQL migrace: `ALTER TABLE trackino_ai_conversations ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;`

### Firecrawl integrace v AI asistentovi (v2.36.0+)
- **Web search toggle** – tlačítko 🌐 vedle vstupu; když je aktivní, před každým odesláním se zavolá `/api/firecrawl/search` a výsledky se injektují jako kontext
- **URL auto-detection** – pokud zpráva obsahuje URL, automaticky se zavolá `/api/firecrawl/scrape` a obsah se přidá do kontextu
- **Stav načítání** – `firecrawlStatus: 'idle' | 'searching' | 'scraping'` zobrazovaný v UI
- **Context injection** – výsledky se přidají do `systemPrompt` jako blok „Kontext z webu" před odesláním do AI

### Počítadlo kreditů (v2.36.1)
- **Konstanty**: `FIRECRAWL_CREDIT_LIMIT = 500`, `CREDITS_PER_SCRAPE = 1`, `CREDITS_PER_SEARCH = 7`
- **localStorage key**: `trackino_firecrawl_credits_used` – přežívá refresh, bez měsíčního resetu (Free Plan = jednorázové kredity)
- **State**: `creditsUsed` inicializovaný lazy z localStorage
- **addCredits(n)** – přičítá po úspěšném Firecrawl volání; voláno v `scrapeUrls()` (1/URL) a `searchWeb()` (7)
- **Footer display**: `🔥 {creditsUsed} / 500` s barevným kódováním: zelená ≥200, oranžová 50–199, červená <50
- **Varování**: červený banner nad vstupem když `creditsRemaining < 50`

---

## 29. Firecrawl – architektura webového scrapingu

### Co je Firecrawl
Firecrawl (firecrawl.dev) je API služba pro převod webových stránek na LLM-ready data (Markdown, JSON, screenshot). Trackino ho využívá pro rozšíření AI asistenta o schopnost číst web.

### API klíč
```
FIRECRAWL_API_KEY=fc-...   # přidat do .env.local + Vercel env vars
```

### Soubory
| Soubor | Popis |
|--------|-------|
| `src/app/api/firecrawl/scrape/route.ts` | Serverová POST route – scrape URL → Markdown |
| `src/app/api/firecrawl/search/route.ts` | Serverová POST route – webové vyhledávání → seznam výsledků s obsahem |

### Endpointy (REST API)
```
POST https://api.firecrawl.dev/v2/scrape
  { url, formats: ['markdown'] }
  → { success, data: { markdown, metadata: { title, description } } }

POST https://api.firecrawl.dev/v2/search
  { query, limit: 5, scrapeOptions: { formats: ['markdown'] } }
  → { success, data: [{ url, title, description, markdown }] }

POST https://api.firecrawl.dev/v2/crawl    # pro budoucí použití (KB import)
  { url, limit: 10 }

POST https://api.firecrawl.dev/v2/agent    # pro budoucí use cases
  { prompt, model: 'spark-1-mini' }
```
- Autentizace: `Authorization: Bearer $FIRECRAWL_API_KEY`
- API klíč pouze na serveru (`process.env.FIRECRAWL_API_KEY`) – nikdy v klientském kódu

### Naše API routes (wrapper)
```typescript
// POST /api/firecrawl/scrape
// Body: { url: string }
// Response: { markdown: string; title?: string; description?: string } | { error: string }

// POST /api/firecrawl/search
// Body: { query: string; limit?: number }
// Response: { results: Array<{ url, title, description, markdown }> } | { error: string }
```

### Cenové jednotky (kredity)
| Operace | Cena |
|---------|------|
| Scrape (markdown) | 1 kredit |
| Search (10 výsledků) | 2 kredity |
| Search + scrape výsledků | 2 + 1/stránka |
| Crawl | 1 kredit/stránka |
| Agent | ~stovky kreditů |

### Plánované rozšíření
- **Záložky**: při přidání záložky auto-scrape → titulek, popis (zatím manuální)
- **Znalostní báze**: tlačítko „Importovat z URL" → Firecrawl scrape → MD obsah jako KB stránka
- **Web Research modul**: fulltextové vyhledávání + AI shrnutí výsledků

---

## 27. Znalostní báze – architektura (knowledge-base/page.tsx)

### DB tabulky (7 nových)
| Tabulka | Popis |
|---------|-------|
| `trackino_kb_folders` | Hierarchické složky (parent_id self-ref, owner_id, is_shared bool) |
| `trackino_kb_pages` | Stránky (folder_id, title, content HTML, tasks jsonb, status, tags[], is_restricted, created_by, updated_by) |
| `trackino_kb_versions` | Verze stránek – každé uložení vytvoří verzi (page_id, content, title, edited_by) |
| `trackino_kb_comments` | Komentáře k stránce (page_id, user_id, content) |
| `trackino_kb_favorites` | Oblíbené stránky (PK: page_id + user_id) |
| `trackino_kb_reviews` | Revizní připomínky (page_id, folder_id, assigned_to, review_date, is_done, note) |
| `trackino_kb_access` | Přístupová práva k omezené stránce (page_id, user_id, can_edit) |
| `trackino_kb_folder_shares` | Sdílení složek (folder_id, workspace_id, user_id nullable, shared_by) – user_id=null = celý workspace |

### Typy (database.ts)
```typescript
export type KbPageStatus = 'draft' | 'active' | 'archived';
export interface KbFolder { id, workspace_id, parent_id, name, owner_id, is_shared?: boolean, created_at, updated_at }
export interface KbPage { id, workspace_id, folder_id, title, content, tasks: { id: string; text: string; checked: boolean }[], status: KbPageStatus, tags: string[], is_restricted, created_by, updated_by, created_at, updated_at }
export interface KbVersion { id, page_id, workspace_id, content, title, edited_by, created_at }
export interface KbComment { id, page_id, workspace_id, user_id, content, created_at, updated_at }
export interface KbReview { id, workspace_id, page_id, folder_id, assigned_to, review_date, note, is_done, created_by, created_at }
export interface KbAccess { id, workspace_id, page_id, user_id, can_edit, created_at }
export interface KbFolderShare { id, folder_id, workspace_id, user_id: string | null, shared_by, created_at }
```

### Lokální typy (knowledge-base/page.tsx)
```typescript
type PageTab = 'comments' | 'history' | 'access' | 'backlinks' | 'reviews';
type ListFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'recent' }
  | { type: 'unfiled' }
  | { type: 'status'; value: KbPageStatus }
  | { type: 'mention'; userId: string }
  | { type: 'folder'; folderId: string };
interface KbMember { user_id: string; display_name: string; avatar_color: string; }
const STATUS_CONFIG: Record<KbPageStatus, { label: string; color: string }>
```

### Komponenty
- **RichEditor** – contentEditable div, toolbar: H1/H2/H3, B/I/U, bullet/numbered list, divider, checklist (bez auto textu), callout (color-mix border+bg), toggle (animovaná šipka), kód, link modal, @mention picker (dropdown členů), /page picker (dropdown stránek); `savedRange` ref zachovává pozici kurzoru před otevřením pickerů; `onMouseDown={e => e.preventDefault()}` na TBtn zamezí ztrátě fokusu; selection popup (fixed, viewport coords) při označení textu
- **PageViewer** – dangerouslySetInnerHTML + click handler: checklist toggle (DOM index matching → silent save), /page-link navigace, external link (window.open), kód kopírování; vložený `<style>` pro třídy `kb-check-unchecked/checked`, `kb-callout`, `kb-toggle`, `kb-mention`, `kb-page-link`
- **KbFolderTree** – rekurzivní, max 5 úrovní hloubky, hover-reveal akce: + podsložka, přejmenovat, smazat; stránky zobrazeny inline

### Sentinelový id pro nové stránky
`id: '__new__'` – rozlišuje INSERT vs UPDATE v `savePage()`

### Klíčové funkce
- `fetchAll()` – parallel fetch: folders, pages, members (profiles přes workspace_members), favorites
- `fetchPageDetail(id)` – full page + comments + versions (ORDER BY created_at DESC, limit 20) + reviews + access
- `savePage()` – INSERT nebo UPDATE + INSERT nové verze + fetchAll + fetchPageDetail
- `handleChecklistToggle(html)` – silent save bez zobrazení editoru; DOM index matching pro toggle správného prvku
- `revertToVersion(v)` – confirm → UPDATE page → INSERT verze → fetchPageDetail + fetchAll
- `toggleUserAccess(userId, canEdit)` – upsert/delete v trackino_kb_access

### Layout
- Dvoupanelový: záporný margin (`-m-4 lg:-m-6`) k eliminaci DashboardLayout paddingu, `flex flex-row`
- Levý panel: 260px fixed width, na mobilu overlay (toggle tlačítkem), obsahuje hledání, stromovou strukturu, oblíbené
- Pravý panel: flex-1, zobrazuje buď viewer nebo editor se záložkami (Komentáře / Historie / Přístupy / Odkazující / Revize)

### Revize jako záložka (v2.39.3)
- Sekce Revize přesunuta z hlavičky stránky do **záložky `reviews`** (vedle Komentáře, Historie, Přístupy, Odkazující)
- Záložky nyní: `comments | history | access | backlinks | reviews`
- Badge s počtem nesplněných revizí zobrazeno přímo na záložce
- Každá revize: checkbox + jméno + datum + volitelná poznámka (SVG info ikona, nikoliv ℹ emoji) + × mazání (admin)
- Tab „Odkazující" (backlinks): klientsky detekuje stránky odkazující na aktuální stránku (hledání `data-page-id="${pageId}"` v content HTML); zobrazuje název + cestu složky (getFolderPath) + stav; kliknutí přejde na danou stránku

### Infobox – color picker (v2.39.3)
- Atribut `data-color` na `.kb-callout` pro uložení barvy (výchozí = '' nebo chybějící atribut)
- 6 variant: `''` (výchozí/primary), `'green'`, `'yellow'`, `'red'`, `'purple'`, `'gray'`
- CSS: `[data-color="green"] { border-color: #22c55e40; background: #22c55e10; }`  atd. v prose-kb + prose-view
- Callout má `position:relative; padding-right:36px`; `::after` zobrazuje SVG palety (opacity 0 → 0.5 na hover)
- V editoru: click v pravém horním rohu callout (32px oblast) → `calloutPicker` state → floating fixed div se 6 kulatými tlačítky
- `onMouseDown={e => e.preventDefault()}` na picker div – zabraňuje ztrátě fokusu editoru před kliknutím

### insBlock helper (v2.39.3)
- Nová funkce `insBlock(html: string)` v RichEditor – obdoba `ins()`, ale po insertu přemístí kurzor dovnitř prvku označeného `data-kbm`
- Atribut `data-kbm` se v HTML odstraní po insertu; kurzor se umístí přes `range.setStart(target, 0)`
- Používán pro: kód (`<code data-kbm>`), checklist (`<li data-kbm>`), infobox (`<div data-kbm class="kb-callout">`)

### Navigace – třístavová logika (v2.40.0)
- **State**: `listFilter: ListFilter | null` – aktuálně aktivní filtr (nebo null = welcome screen)
- **Computed**: `filteredPages` (podle search nebo listFilter), `filterLabel` (string), `filterIcon` (JSX), `showList` (bool), `showWelcome` (bool)
- **showWelcome**: `!search && listFilter === null && !selectedPage` → zobrazí dvousloupcový přehled
- **showList**: `(search.trim() || listFilter !== null) && !selectedPage` → zobrazí `PageListView`
- **KbFolderTree**: nyní bez inline stránek – zobrazuje jen složky s počtem stránek (badge)
- **PageListView** komponenta: zobrazí header s ikonou/labelm/počtem + tlačítko Nová stránka + seznam stránek s metadaty
- **backToList()**: `setSelectedPage(null); setEditing(false); setComments([]); ...`
- **Tlačítko Zpět**: zobrazí se v záhlaví stránky když `listFilter !== null || search.trim()` a stránka není nová
- **Animace kopírování kódu**: CSS třída `.kb-code-copied::after` (zelená fajfka SVG, `opacity:1!important`) přidaná přes `classList.add/remove` s 1500ms timeoutem; platí v `.prose-kb` (editor) i `.prose-view` (viewer)

### Revize v Přehledu (page.tsx)
- Přidán typ `'kb_review'` do NotificationItem
- Query: `trackino_kb_reviews WHERE assigned_to=user.id AND is_done=false AND review_date <= today`
- Ikona: kniha se zaškrtnutím (SVG), barva `#0ea5e9`, label `'KB Revize'`, href `'/knowledge-base'`

### Šablony (5 hardcoded)
1. Prázdná – prázdný editor
2. Zápis z meetingu – H2 sekce: Datum/Účastníci/Program/Záznamy/Úkoly
3. Popis procesu – H2 sekce: Účel/Kroky/Role/Poznámky
4. Onboarding průvodce – H2 sekce: Vítejte/IT setup/Procesy/Kontakty
5. Dokumentace projektu – H2 sekce: Přehled/Architektura/Deployment/FAQ

---

## 30. Automatizace – architektura (settings/page.tsx záložka Automatizace)

### Co to je
Modul pro správu naplánovaných cron jobů integrovaných s **cron-job.org REST API**. Dostupný v záložce **Nastavení → Automatizace**. Přístup jen pro workspace adminy.

### Soubory
| Soubor | Popis |
|--------|-------|
| `src/lib/supabase-admin.ts` | Supabase klient se service role klíčem (bypasuje RLS; jen server-side) |
| `src/lib/cron-handler.ts` | Sdílené helpery: `verifyCronSecret()`, `saveCronResult()`, `parseCronBody()` |
| `src/app/api/cron-jobs/route.ts` | Proxy GET (seznam) + PUT (vytvoření) – injektuje CRON_SECRET |
| `src/app/api/cron-jobs/[jobId]/route.ts` | Proxy GET, PATCH (enable/disable), DELETE |
| `src/app/api/cron-jobs/[jobId]/history/route.ts` | Proxy GET historie spuštění |
| `src/app/api/cron/weekly-report/route.ts` | Týdenní AI report hodin (OpenAI) |
| `src/app/api/cron/inactive-check/route.ts` | Kontrola neaktivních členů |
| `src/app/api/cron/kb-reviews-digest/route.ts` | Digest revizí znalostní báze |
| `src/app/api/cron/feedback-summary/route.ts` | AI shrnutí anonymních připomínek (OpenAI) |
| `src/app/api/cron/vacation-report/route.ts` | Report čerpání dovolené |

### Bezpečnost
- `CRON_SECRET` – nikdy nedostane se na klienta; proxy route ho injektuje do `extendedData.headers['x-cron-secret']` při registraci jobu
- Cron handlery ověřují `request.headers.get('x-cron-secret') === process.env.CRON_SECRET` → 401 jinak
- `SUPABASE_SERVICE_ROLE_KEY` – jen v cron handlerech (server-side), bypasuje RLS

### cron-job.org API
- **Web konzole**: https://console.cron-job.org/
- **API dokumentace**: https://docs.cron-job.org/
- **Správa API klíčů**: https://console.cron-job.org/settings (sekce API Keys)
- Base URL: `https://api.cron-job.org`
- Auth: `Authorization: Bearer {CRON_JOB_API_KEY}`
- Schedule format: `{ minutes: [0], hours: [8], wdays: [1], mdays: [-1], months: [-1], timezone: "Europe/Prague", expiresAt: 0 }` kde `[-1]` = každý
  - `wdays`: 0=Ne, 1=Po, 2=Út, 3=St, 4=Čt, 5=Pá, 6=So
  - `mdays`: dny v měsíci 1–31, `[-1]` = každý den
- `GET /jobs` → seznam všech jobů workspace
- `PUT /jobs` → `{ job: { url, title, enabled, saveResponses, schedule, extendedData: { headers, method, body } } }` – vytvoření jobu
- `PATCH /jobs/{id}` → `{ job: { enabled?: bool, schedule?: {...} } }` – aktualizace (enable/disable nebo celý rozvrh)
- `DELETE /jobs/{id}` → smazání jobu (vrací HTTP 204)
- `GET /jobs/{id}/history` → historie spuštění (date timestamp, httpStatus, duration ms)

### Editace rozvrhu (v2.39.1+)
- Tlačítko tužky u každého jobu v záložce Automatizace → otevře modal s formulářem
- Formulář: výběr hodiny (0–23), minuty (po 5 minutách), dny v týdnu (toggle buttony), časové pásmo
- `openEditJob(job)` – naplní form z aktuálního `job.schedule`
- `saveJobEdit()` – PATCH `/api/cron-jobs/{jobId}` se `{ schedule: {...} }` → proxy route obalí do `{ job: { schedule } }`
- Po úspěchu: aktualizuje `automationJobs` state lokálně (bez nutnosti re-fetch)

### DB tabulka trackino_cron_results
```sql
CREATE TABLE IF NOT EXISTS trackino_cron_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_cron_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_cron_results
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Env proměnné (přidat i do Vercel)
```
CRON_JOB_API_KEY=...          # Bearer token pro cron-job.org API
CRON_SECRET=...               # Náhodný hex string pro ověření cron requestů (openssl rand -hex 32)
NEXT_PUBLIC_APP_URL=https://... # Produkční URL (např. https://trackino.vercel.app)
SUPABASE_SERVICE_ROLE_KEY=... # Supabase → Settings → API → service_role (server-side only)
```

### 5 šablon automatizací
| ID | Název | Schedule |
|----|-------|----------|
| `weekly-report` | Týdenní AI report hodin | Pondělí 8:00 |
| `inactive-check` | Kontrola neaktivních členů | Pondělí 8:30 |
| `kb-reviews-digest` | Digest revizí KB | Pondělí 7:00 |
| `feedback-summary` | Shrnutí feedbacku (AI) | Pátek 16:00 |
| `vacation-report` | Report dovolených | 1. v měsíci 7:00 |

### Workflow (jak přidat novou šablonu)
1. Přidat objekt do `CRON_TEMPLATES` v `settings/page.tsx`
2. Vytvořit handler `src/app/api/cron/{id}/route.ts` s `verifyCronSecret` + `parseCronBody` + `saveCronResult`
3. Handler musí přijímat POST s `{ workspace_id: string }` v těle

---

## 31. Postup přejmenování aplikace (Trackino → NovýNázev)

> Tento postup popisuje, kde všude je potřeba změnit název, pokud by se aplikace přejmenovala z "Trackino" na jiný název. Pořadí odpovídá doporučené sekvenci.

### A) Supabase – nový projekt (nebo rename)
Supabase nepodporuje rename projektu – buď si změn na frontend stačí, nebo je nutný nový projekt.
- **Název projektu** v Supabase dashboardu: https://supabase.com/dashboard → Settings → General → Project name
- **Supabase URL a ANON_KEY** se při novém projektu změní → aktualizovat `.env.local` + Vercel env vars
- **Databázové tabulky** mají prefix `trackino_` (~67 tabulek) – přejmenovat přes SQL:
  ```sql
  -- Příklad – opakovat pro všechny tabulky:
  ALTER TABLE trackino_profiles RENAME TO novynazev_profiles;
  ALTER TABLE trackino_workspaces RENAME TO novynazev_workspaces;
  -- ... atd. pro všech ~67 tabulek
  ```
  Poté aktualizovat **všechny** Supabase dotazy v kódu (hledat: `from('trackino_`).
- **Storage buckety** (přejmenovat nebo smazat + znovu vytvořit):
  - `trackino-documents` → `novynazev-documents`
  - `trackino-invoices` → `novynazev-invoices`
  Aktualizovat v: `src/app/(dashboard)/documents/page.tsx`, `invoices/page.tsx`
- **Auth storage key** v `src/lib/supabase.ts`:
  ```typescript
  storageKey: 'trackino-auth'  →  storageKey: 'novynazev-auth'
  ```
- **RLS politiky** (obsahují-li název): zkontrolovat přes Supabase dashboard → Authentication → Policies

### B) package.json
```json
"name": "trackino"  →  "name": "novynazev"
```

### C) Next.js metadata (src/app/layout.tsx)
```typescript
title: "Trackino"         →  title: "NovýNázev"
description: "Time tracking pro týmy"  →  (libovolný popis)
```
- Přidat Open Graph metadata: `openGraph: { title, description, siteName }`

### D) UI – zobrazení názvu
Hledat `>Trackino<` nebo `"Trackino"` v komponentách:
| Soubor | Řádek | Kde se zobrazuje |
|--------|-------|-----------------|
| `src/app/(auth)/login/page.tsx` | ~logo | Přihlašovací stránka – nadpis |
| `src/app/(auth)/register/page.tsx` | ~logo | Registrační stránka – nadpis |
| `src/app/invite/[token]/page.tsx` | ~logo | Stránka přijetí pozvánky |
| `src/components/Sidebar.tsx` | ~540 | Logo v headeru sidebaru |
| `src/app/(dashboard)/help/page.tsx` | ~popis | Text nápovědy |
| `src/app/(dashboard)/changelog/page.tsx` | ~nadpis | „Trackino – Historie verzí" |

### E) API headers
```typescript
// src/app/api/ics-proxy/route.ts
'User-Agent': 'Trackino-Calendar/1.0'  →  'User-Agent': 'NovýNázev-Calendar/1.0'
```

### F) localStorage klíče (~19 klíčů)
Hledat `trackino_` v celém `src/` a nahradit. Klíčové soubory:
- `src/components/Sidebar.tsx` – `trackino_sidebar_collapsed`, `trackino_favorites_*`
- `src/app/(dashboard)/calendar/page.tsx` – `trackino_cal_*`, `trackino_subs_order`
- `src/app/(dashboard)/attendance/page.tsx` – `trackino_attendance_order_`
- `src/app/(dashboard)/ai-assistant/page.tsx` – `trackino_firecrawl_credits_used`
- `src/components/DashboardLayout.tsx` – `trackino_dismissed_notifications`
- Ostatní stránky dle `grep -r "trackino_" src/`

> **Důležité**: Existující uživatelé přijdou o lokálně uložená nastavení (sidebar collapse, oblíbené, barvy kalendáře) – po přejmenování klíčů se localStorage resetuje. Pokud je to problém, napsat migrační funkci v `useEffect` při startu.

### G) Komentáře v kódu (volitelné)
Hledat `// Trackino` v celém `src/` – tyto jsou jen komentáře, na funkčnost nemají vliv.

### H) Dokumentace (CLAUDE.md, UI-STANDARDS.md)
- `CLAUDE.md` – nadpis, popis projektu, verze
- `UI-STANDARDS.md` – nadpis

### I) Git repozitář
1. Přejmenovat repozitář na GitHubu: github.com/ivomatej/trackino → Settings → Rename
2. Aktualizovat remote:
   ```bash
   git remote set-url origin git@github.com:ivomatej/novynazev.git
   ```

### J) Vercel
1. Vercel projekt: Settings → General → Project Name (jen display jméno, na funkčnost nemá vliv)
2. Produkční URL (custom domain) – nastavit novou doménu pokud se mění

### K) Env proměnné (Vercel + .env.local)
Po přejmenování Supabase projektu:
```
NEXT_PUBLIC_SUPABASE_URL=https://NOVY-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...nový klíč...
SUPABASE_SERVICE_ROLE_KEY=...nový klíč...
NEXT_PUBLIC_APP_URL=https://novynazev.vercel.app  (nebo custom doména)
```

### L) cron-job.org (Automatizace)
Existující cron joby mají URL `https://trackino.vercel.app/api/cron/...`. Po změně URL:
1. Smazat všechny existující joby v Nastavení → Automatizace
2. Aktualizovat `NEXT_PUBLIC_APP_URL` v env vars
3. Znovu přidat joby – nové URL se vytvoří automaticky ze správného `NEXT_PUBLIC_APP_URL`

### Celkový rozsah
| Kategorie | Počet změn |
|-----------|-----------|
| Supabase tabulky (SQL) | ~67 |
| Supabase Storage buckety | 2 |
| Env proměnné | 4+ |
| Kódové soubory (funkční) | ~15 |
| localStorage klíče | ~19 |
| UI texty | ~6 |
| Dokumentace | 2 |
| Git + Vercel | 2 |

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
