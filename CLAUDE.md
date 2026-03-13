# CLAUDE.md – Trackino dokumentace

> Kompletní dokumentace projektu pro AI asistenta (Claude). Vždy komunikuj česky.
> Aktualizováno: 13. 3. 2026 (v2.51.43)

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
      tasks/          – Úkoly a kanban nástěnka (tarif Pro a Max)
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
      subscriptions/  – Evidence předplatných (tarif Pro a Max)
      domains/        – Evidence domén (tarif Pro a Max)
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
    DashboardLayout.tsx  – hlavní layout s TimerBarem a Sidebarem; obaluje children + TimerBar ErrorBoundary
    ErrorBoundary.tsx    – React class Error Boundary; moduleName prop, timerFallback varianta, dev detail
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
| `trackino_calendar_events` | id, calendar_id, workspace_id, user_id, title, description, start_date (text YYYY-MM-DD), end_date (text), is_all_day, start_time (text\|null), end_time (text\|null), color (text\|null), source ('manual'\|'vacation'\|'important_day'), source_id (uuid\|null), recurrence_type (text, DEFAULT 'none'), recurrence_day (integer\|null), created_at, updated_at | Ruční události v kalendáři; dovolená a důležité dny se čtou přímo z jejich tabulek; opakující se události expandovány přes expandRecurringEvent() |
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
| `trackino_notebook_prefs` | workspace_id, user_id, folder_sort_cache (jsonb), updated_at | Per-user preference Notebooku (uložení filtrace složek); PRIMARY KEY (workspace_id, user_id); cross-device |
| `trackino_subscription_categories` | id, workspace_id, name, color, sort_order, parent_id (uuid\|null, self-ref), created_at | Kategorie předplatných (barva, řazení, hierarchie) |
| `trackino_subscriptions` | id, workspace_id, name, type, website_url, login_url, registration_email, company_name, registered_by, description, notes, priority, status, renewal_type, price, currency, frequency, next_payment_date, registration_date, category_id, is_tip, created_by, created_at, updated_at | Evidence firemních předplatných a SaaS služeb |
| `trackino_subscription_ratings` | id, subscription_id, workspace_id, user_id, rating (1-5), created_at, updated_at | Hvězdičkové hodnocení předplatných (per-user, UNIQUE subscription_id+user_id) |
| `trackino_subscription_access_users` | id, workspace_id, name, email, note, created_by, created_at, updated_at | Externí uživatelé pro evidenci přístupů (mimo workspace) |
| `trackino_subscription_accesses` | id, workspace_id, subscription_id (FK CASCADE), user_id (nullable), external_user_id (FK nullable CASCADE), role, granted_at, note, created_by, created_at | Přiřazení uživatel→služba; CHECK: právě jeden z user_id/external_user_id NOT NULL; UNIQUE partial indexy |
| `trackino_exchange_rates` | id, date (text YYYY-MM-DD), currency, rate (numeric), fetched_at | Globální cache kurzů ČNB (bez workspace_id); UNIQUE (date, currency) |
| `trackino_domain_registrars` | id, workspace_id, name, website_url, notes, created_by, created_at, updated_at | Registrátoři domén (entita pro select ve formuláři domény) |
| `trackino_domains` | id, workspace_id, name, registrar, subscription_id (FK nullable), registration_date, expiration_date, status (active/expired/transferred/cancelled), notes, target_url, project_name, company_name, created_by, created_at, updated_at | Evidence firemních domén; computed status „expiring" na klientu (active + ≤30 dní) |
| `trackino_task_boards` | id, workspace_id, name, settings (jsonb), folder_id (FK nullable), color, description, is_shared (bool), created_by, created_at | Nástěnky/projekty úkolů |
| `trackino_task_columns` | id, board_id, name, color, sort_order, created_at | Sloupce/stavy nástěnky (K řešení, Rozpracováno, ...) |
| `trackino_task_items` | id, workspace_id, board_id, column_id, title, description, priority, deadline, sort_order, created_by, assigned_to, is_completed (bool), created_at, updated_at | Úkoly |
| `trackino_task_subtasks` | id, task_id, title, is_done, sort_order, assigned_to (uuid nullable), created_at | Podúkoly (checklist) s přiřazením řešitele |
| `trackino_task_comments` | id, task_id, user_id, content, created_at, updated_at | Komentáře k úkolům |
| `trackino_task_attachments` | id, task_id, file_path, file_name, file_size, file_mime, uploaded_by, created_at | Přílohy úkolů (Supabase Storage) |
| `trackino_task_history` | id, task_id, user_id, action, old_value, new_value, created_at | Historie změn úkolů |
| `trackino_task_folders` | id, workspace_id, name, color, sort_order, parent_id (self-ref), created_by, is_shared, created_at, updated_at | Složky pro organizaci projektů/nástěnek |
| `trackino_task_folder_shares` | id, folder_id, workspace_id, user_id (nullable), shared_by, created_at | Sdílení složek úkolů (user_id=null = celý workspace) |
| `trackino_task_board_members` | id, board_id, workspace_id, user_id, can_edit (bool), created_at | Sdílení nástěnky s konkrétními členy (UNIQUE board_id+user_id) |

### Nové sloupce (v2.51.3)
- `trackino_task_items.reviewer_id uuid REFERENCES auth.users(id)` – Zadavatel/Kontrolor úkolu (nullable)
- `trackino_task_items.time_estimate integer` – časový odhad v minutách (nullable)

### Nové sloupce (v2.51.0)
- `trackino_task_items.is_completed boolean NOT NULL DEFAULT false` – checkbox dokončení úkolu
- `trackino_task_boards.settings jsonb NOT NULL DEFAULT '{}'` – nastavení nástěnky (auto_complete_column_id, column_colors_enabled, detail_size)
- `trackino_task_boards.folder_id uuid REFERENCES trackino_task_folders(id) ON DELETE SET NULL` – zařazení do složky
- `trackino_task_boards.color text NOT NULL DEFAULT '#6366f1'` – barva projektu
- `trackino_task_boards.description text NOT NULL DEFAULT ''` – popis projektu
- `trackino_task_boards.is_shared boolean NOT NULL DEFAULT false` – sdílení projektu
- `trackino_task_subtasks.assigned_to uuid REFERENCES auth.users(id)` – přiřazení řešitele podúkolu

### Nové sloupce (v2.50.0)
- `trackino_workspace_members.can_manage_tasks boolean NOT NULL DEFAULT false` – oprávnění spravovat úkoly

### Nové sloupce (v2.48.0)
- `trackino_workspace_members.can_manage_domains boolean NOT NULL DEFAULT false` – oprávnění spravovat domény

### Nové sloupce (v2.46.0)
- `trackino_workspace_members.can_manage_subscriptions boolean NOT NULL DEFAULT false` – oprávnění spravovat předplatná

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
  'requests' | 'feedback' | 'knowledge_base' | 'documents' | 'company_rules' | 'office_rules' |
  'subscriptions' | 'domains' | 'tasks';
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
| Předplatná (subscriptions) | – | ✓ | ✓ |
| Evidence domén (domains) | – | ✓ | ✓ |
| Úkoly (tasks) | – | ✓ | ✓ |

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
- `'Správa'`: projects, clients, tags, team, settings, audit, tasks
- `'Nástroje'`: tasks, text_converter, important_days, requests, feedback, subscriptions, domains
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
  Úkoly (/tasks)
  Převodník textu (/text-converter)
  Důležité dny (/important-days)
  Předplatná (/subscriptions)
SPRÁVA
  Projekty (/projects)
  Klienti (/clients)
  Štítky (/tags)
  Tým (/team)
  Nastavení (/settings)
  Audit log (/audit)
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
| Úkoly (`/tasks`) | `myOpenTasks` – otevřené úkoly přiřazené uživateli (mimo sloupce „Hotovo") | všichni |

---

## 7b. Error Boundary systém (v2.51.39)

### Architektura

```
DashboardLayout
  ├── ErrorBoundary (timerFallback) → TimerBar
  └── <main>
        └── ErrorBoundary (moduleName) → children (obsah stránky)

src/app/error.tsx              – globální záchranná síť (root layout)
src/app/(dashboard)/error.tsx  – Next.js Error Boundary pro dashboard segment
```

### Komponenta `src/components/ErrorBoundary.tsx`
- React **class component** (Error Boundaries nelze implementovat jako function component)
- Props:
  - `moduleName?: string` – zobrazí se v nadpisu fallback UI „Modul X selhal"
  - `fallback?: ReactNode` – vlastní fallback UI (optional)
  - `timerFallback?: boolean` – speciální kompaktní varianta pro TimerBar
- Fallback UI: karta s ikonou varování (SVG triangle), nadpisem, podtextem a dvěma tlačítky
- Dev mode (`NODE_ENV === 'development'`): collapsible detail s chybovým stack trace
- Logování: `componentDidCatch` loguje do konzole s kontextem `{ error, stack, componentStack, timestamp }`
- TODO komentář: napojit na Sentry/LogRocket
- Tlačítko **Přejít na přehled**: `<a href="/">` (nekontroluje router, funguje vždy)
- Tlačítko **Zkusit znovu**: volá `setState({ hasError: false })` → pokusí se znovu renderovat podstrom

### TimerBar fallback (`timerFallback`)
- Zachová výšku a layout hlavičky – lišta „Timer nedostupný" s ikonou
- Tlačítko Zkusit znovu přímo v liště
- Neodstraňuje prostor – layout se nepřeskočí

### Integrace do DashboardLayout
```tsx
// DashboardLayout.tsx – prop:
interface DashboardLayoutProps {
  moduleName?: string; // předává se do vnitřního ErrorBoundary
  // ...ostatní props
}

// V <main>:
<ErrorBoundary moduleName={moduleName}>
  {children}
</ErrorBoundary>

// TimerBar v headeru a v bottom baru:
<ErrorBoundary timerFallback>
  <TimerBar ... />
</ErrorBoundary>
```

### Obalené moduly (moduleName prop)
| Soubor | moduleName |
|--------|-----------|
| tracker/page.tsx | Měřič |
| page.tsx (root) | Přehled |
| reports/page.tsx | Reporty |
| attendance/page.tsx | Přehled hodin |
| category-report/page.tsx | Analýza kategorií |
| planner/_components/PlannerContent.tsx | Plánovač |
| vacation/_components/VacationContent.tsx | Dovolená |
| calendar/components/CalendarContent.tsx | Kalendář |
| invoices/page.tsx | Fakturace |
| projects/page.tsx | Projekty |
| clients/page.tsx | Klienti |
| tags/page.tsx | Štítky |
| team/page.tsx | Tým |
| settings/SettingsContent.tsx | Nastavení |
| audit/page.tsx | Audit log |
| text-converter/page.tsx | Převodník textu |
| important-days/page.tsx | Důležité dny |
| requests/page.tsx | Žádosti |
| feedback/page.tsx | Připomínky |
| documents/page.tsx | Dokumenty |
| company-rules/page.tsx | Firemní pravidla |
| office-rules/page.tsx | Pravidla v kanceláři |
| help/page.tsx | Nápověda |
| changelog/page.tsx | Changelog |
| bugs/page.tsx | Hlášení chyb |
| admin/page.tsx | Admin |
| app-settings/page.tsx | Nastavení aplikace |
| app-changes/_components/AppChangesContent.tsx | Úpravy aplikace |
| profile/page.tsx | Profil |
| notes/page.tsx | Poznámky |
| subordinates/page.tsx | Podřízení |
| knowledge-base/page.tsx | Znalostní báze |
| tasks/page.tsx | Úkoly |
| subscriptions/_components/SubscriptionsContent.tsx | Předplatná |
| domains/_components/DomainsContent.tsx | Evidence domén |
| prompts/_components/PromptsContent.tsx | Prompty |
| bookmarks/_components/BookmarksContent.tsx | Záložky |
| ai-assistant/_components/AiAssistantContent.tsx | AI Asistent |
| notebook/page.tsx | Notebook |

### Globální Next.js error.tsx
- `src/app/error.tsx` – kořenový error (fullscreen, bez CSS proměnných – nezná theme)
- `src/app/(dashboard)/error.tsx` – dashboard error (s CSS proměnnými, zachová sidebar)

### Co ErrorBoundary NEZACHYTÍ
- Async chyby v `useEffect` (musí být re-thrown do render fáze)
- Chyby v event handlerech (try/catch)
- Server-side chyby (ty zachytí `error.tsx`)

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
| **Předplatná** | – | ✓ | ✓ |
| **Evidence domén** | – | ✓ | ✓ |
| **Úkoly** | – | ✓ | ✓ |

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
| v2.51.28 | 11. 3. 2026 | Notebook – FolderTree: odstraněny desktop individuální tlačítka, nahrazeny třemi tečkami (⋮) zobrazující se na hover na desktopu + vždy viditelné na mobilu; NoteEditor: paste handler strippuje background-* CSS vlastnosti a bgcolor atribut z vkládaného HTML (žádná změna barvy pozadí z externích nástrojů) |
| v2.51.43 | 13. 3. 2026 | Refaktoring: category-report/page.tsx (534 ř.) rozdělen na 8 souborů v _components/ (types.ts, utils.ts, useCategoryReport.ts, CategoryFilters.tsx, SummaryBar.tsx, CategoryPieChart.tsx, CategoryBarChart.tsx, CategoryTable.tsx, CategoryReportContent.tsx); page.tsx redukován na ~20 řádků |
| v2.51.42 | 13. 3. 2026 | Refaktoring: bugs/page.tsx (700 ř.) rozdělen na 5 souborů v _components/ (types.ts, ui.tsx, useBugs.ts, BugCard.tsx, BugsContent.tsx); page.tsx redukován na ~20 řádků |
| v2.51.41 | 13. 3. 2026 | Refaktoring: page.tsx (765 ř.) rozdělen na 8 souborů v _components/ (types.ts, utils.ts, useDashboard.ts, StatCard.tsx, GreetingCard.tsx, NotificationsPanel.tsx, WeekChart.tsx, MonthOverview.tsx, DashboardContent.tsx); page.tsx redukován na ~55 řádků |
| v2.51.40 | 13. 3. 2026 | Refaktoring: app-changes/page.tsx (818 ř.) rozdělen na 6 souborů v _components/ (types.ts, utils.ts, useAppChanges.ts, AppChangeFormModal.tsx, AppChangeItem.tsx, AppChangesContent.tsx); page.tsx redukován na ~10 řádků |
| v2.51.39 | 12. 3. 2026 | Error Boundaries – izolace selhání modulů: ErrorBoundary.tsx (React class component, moduleName prop, timerFallback varianta), DashboardLayout obaluje children + TimerBar, 39 stránek s moduleName, globální error.tsx (root + dashboard segment), konzistentní logování |
| v2.51.38 | 12. 3. 2026 | Refaktoring: vacation/page.tsx (925 ř.) rozdělen na 11 souborů v _components/ (types.ts, utils.ts, useVacation.ts, VacationStats.tsx, VacationForm.tsx, VacationRecordsTab.tsx, VacationRequestsTab.tsx, VacationArchiveTab.tsx, RejectModal.tsx, VacationContent.tsx); page.tsx redukován na ~23 řádků |
| v2.51.37 | 12. 3. 2026 | Refaktoring: prompts/page.tsx (1001 ř.) rozdělen na 10 souborů v _components/ (types.ts, utils.ts, RichEditor.tsx, FolderTree.tsx, usePrompts.ts, PromptCard.tsx, PromptModals.tsx, PromptsLeftPanel.tsx, PromptsContent.tsx); page.tsx redukován na ~15 řádků |
| v2.51.36 | 12. 3. 2026 | Refaktoring: bookmarks/page.tsx (1008 ř.) rozdělen na 8 souborů v _components/ (types.ts, utils.ts, useBookmarks.ts, FolderTree.tsx, BookmarksLeftPanel.tsx, BookmarkCard.tsx, BookmarkModals.tsx, BookmarksContent.tsx); page.tsx redukován na ~15 řádků |
| v2.51.35 | 12. 3. 2026 | Refaktoring: domains/page.tsx (1195 ř.) rozdělen na 11 souborů v _components/ (types.ts, constants.tsx, utils.ts, useDomains.ts, StatsDashboard.tsx, DomainsTabContent.tsx, RegistrarsTabContent.tsx, DomainFormModal.tsx, RegistrarFormModal.tsx, DomainDetailModal.tsx, DomainsContent.tsx); page.tsx redukován na ~20 řádků |
| v2.51.34 | 11. 3. 2026 | Refaktoring: planner/page.tsx (1280 ř.) rozdělen na 11 souborů v _components/ (types.ts, utils.ts, icons.tsx, CellFull.tsx, CellHalf.tsx, NoteInput.tsx, usePlanner.ts, StatusManager.tsx, PlannerTable.tsx, CellPicker.tsx, PlannerContent.tsx); page.tsx redukován na ~25 řádků |
| v2.51.33 | 11. 3. 2026 | Refaktoring: Sidebar.tsx (~800 ř.) rozdělen na 7 souborů v sidebar/ (types.ts, icons.tsx, useSidebar.ts, SidebarHeader.tsx, SidebarNav.tsx, SidebarUserPanel.tsx); Sidebar.tsx redukován na ~80 řádků orchestrátoru |
| v2.51.32 | 11. 3. 2026 | Refaktoring: TimerBar.tsx (938 ř.) rozdělen na 6 souborů v timer-bar/ (types.ts, utils.ts, useTimerBar.ts, ProjectPicker.tsx, CategoryTaskPicker.tsx, TimerControls.tsx); TimerBar.tsx redukován na ~80 řádků orchestrátoru |
| v2.51.31 | 11. 3. 2026 | Refaktoring: ai-assistant/page.tsx (1340 ř.) rozdělen na 10 souborů v _components/ (types.ts, utils.ts, constants.ts, useAiAssistant.ts, ConversationSidebar.tsx, ChatMessages.tsx, ChatInput.tsx, FavoritePromptsPanel.tsx, ModelInfoPanel.tsx, AiAssistantContent.tsx); page.tsx redukován na ~10 řádků |
| v2.51.30 | 11. 3. 2026 | Notebook – fix dropdown složek: createPortal() na document.body (CSS transform levého panelu způsoboval špatné fixed pozicování); flip nahoru pokud spaceBelow < 180px (spodní složky na mobilu) |
| v2.51.29 | 11. 3. 2026 | Notebook – fix dropdown složek: sm:absolute (bez vlivu na layout), dropdown mimo opacity wrapper + backdrop; fix číslo počtu poznámek; paste handler odstraňuje background barvy |
| v2.51.28 | 11. 3. 2026 | Notebook – tři tečky u složek (hover desktop / vždy mobil), dropdown s akcemi; paste handler stripuje CSS background barvy |
| v2.51.27 | 11. 3. 2026 | Rate Limiting: Upstash Redis (@upstash/ratelimit, @upstash/redis); src/lib/rate-limit.ts (rateLimitRegister 3/hod, rateLimitAI 20/min, rateLimitFirecrawl 10/min); nová API route /api/auth/register (server-side signup s rate limitem dle IP); register/page.tsx přepnut na volání nového endpointu; rate limit přidán do /api/ai-chat, /api/firecrawl/scrape, /api/firecrawl/search; env vars UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN |
| v2.51.26 | 11. 3. 2026 | Refaktoring: team/page.tsx (1516 ř.) rozdělen na 6 souborů v _components/ (types.tsx, useTeam.ts, MembersTab.tsx, StructureTab.tsx, ManagersTab.tsx, EditMemberModal.tsx s PermissionToggle sub-komponentou); page.tsx redukován na ~170 řádků |
| v2.51.25 | 11. 3. 2026 | Notebook – folderSortCache přesunuta do DB (nová tabulka trackino_notebook_prefs, cross-device per-user); mobilní výpis poznámek: 3 řádky (název / datum+autor / ikonky justify-around, tap target 44px) |
| v2.51.24 | 11. 3. 2026 | Refaktoring: subscriptions/page.tsx (2124 ř.) rozdělen na 19 souborů v _components/ (types.ts, constants.tsx, utils.ts, useSubscriptions.ts, StarRating, StatsDashboard, SubsTabContent, CategoriesTabContent, AccessByServiceView, AccessByUserView, AccessSummaryView, AccessTabContent, DetailModal, SubFormModal, AccessModal, ExtUserModal, CatFormModal, SubscriptionsContent); page.tsx redukován na ~20 řádků |
| v2.51.23 | 11. 3. 2026 | Notebook – smazání složky nyní archivuje všechny poznámky (včetně podsložek) místo přesunu do Inboxu; deleteFolder() používá getDescendantFolderIds() + batch UPDATE is_archived=true před DELETE složky |
| v2.51.22 | 11. 3. 2026 | Kalendář – fix timezone u ICS externích kalendářů: UTC časy (Z přípona) převedeny na lokální čas prohlížeče; přidán helper parseTzIdToLocal() pro TZID= pojmenované timezone (Intl.DateTimeFormat); Notebook – tlačítko Skrýt hotové v záhlaví výpisu (viditelné pokud showDoneFeature=true, hideDone state, filtruje is_done=true poznámky) |
| v2.51.21 | 11. 3. 2026 | Refaktoring: knowledge-base/page.tsx (2174 ř.) rozdělen na 10 souborů v _components/ (types.ts, utils.ts, RichEditor.tsx, PageViewer.tsx, KbFolderTree.tsx, KbSidebar.tsx, KbWelcomeScreen.tsx, PageListView.tsx, KbModals.tsx, KbPageDetail.tsx); page.tsx (~400 ř.) je orchestrátor; opravena záložka Historie (chybějící prop revertToVersion) |
| v2.51.20 | 10. 3. 2026 | Úkoly – Přehled workspace: cross-workspace tabulkový pohled (Název/Projekt/Workspace/Řešitel/Priorita/Status/Termín); záložky per workspace s barevným kódováním; filtry (priorita/termín/projekt/řešitel/search/hide-completed); modal Nový úkol (ws→projekt→sloupec→název/priorita/termín/řešitel); detail panel s breadcrumb ws/projekt/sloupec; deterministické barvy workspace; RLS z v2.51.19 zajišťuje izolaci dat |
| v2.51.19 | 10. 3. 2026 | Supabase RLS – kompletní workspace izolace na DB vrstvě: dvě SECURITY DEFINER helper funkce (trackino_is_master_admin, trackino_user_workspaces), idempotentní politiky na všech ~92 tabulkách; cross-workspace pohled v modulu Úkoly funguje automaticky přes standard workspace_id filter; child tabulky bez workspace_id chainovány přes parent; exchange_rates = globální cache (SELECT pro všechny, zápis jen service_role/Master Admin) |
| v2.51.18 | 10. 3. 2026 | Notebook – 2 úpravy: (a) Breadcrumb v hlavičce NoteEditor – hierarchická cesta složek kde je poznámka uložena, kliknutím zvýrazní složku v levém panelu (setListFilter, neuzavírá editor); (b) Hierarchické počty u složek – počet u nadřazené složky zahrnuje všechny poznámky z podsložek libovolné hloubky (getDescendantFolderIds) |
| v2.51.17 | 10. 3. 2026 | Notebook – 3 úpravy: (a) Hierarchické filtrování složek (getDescendantFolderIds – hlavní složka zobrazuje poznámky ze všech podsložek); (b) Animace tlačítka „Uložit filtraci" (zelené „Uloženo ✓" na 2s, filterSaved state); (c) Odstraněno tlačítko „+ Přidat úkoly" z prázdného stavu (NoteEditor + CalEventNoteEditor) |
| v2.51.16 | 10. 3. 2026 | Notebook – 6 vylepšení: (a) Uložit filtraci pro složku (toggle v Nastavení, folderSortCache v localStorage trackino_notebook_folder_sort_{wsId}); (b) Fix odrážek/číslování v editoru (nb-editor class + CSS ul/ol/li v editorStyles); (c) Kódový blok výška 5em; (d) × tlačítko pro odstranění task bloku + conditional tasks section (prázdný stav = „+ Přidat úkoly"); (e) Název složky max-w 160px→480px; (f) Stav Hotovo (is_done v DB, toggle v Nastavení, pill button v toolbaru, line-through+opacity v listě) |
| v2.51.15 | 10. 3. 2026 | ICS poznámky – 2 opravy: Notebook ICS sekce přepsána (uid v cache = celý ev.id → přímý lookup uid=event_ref místo chybné regex+uidFrag logiky); ICS cache plněna vždy (nejen sdílené odběry) aby fungovaly i osobní ICS události |
| v2.51.14 | 10. 3. 2026 | Notebook – Sync Poznámky k událostem: fetchCalEventNotes rozšířeno o handlery vacation (vacation-UUID → trackino_vacation_entries) a important_day (importantday-UUID-datum → trackino_important_days); error logování pro všechny Supabase dotazy |
| v2.51.13 | 10. 3. 2026 | Notebook – Sync Poznámky k událostem: selectFilter volá fetchCalEventNotes při přepnutí na složku; Kalendář – upsert poznámek bez neexistujících sloupců event_title/event_date |
| v2.51.12 | 10. 3. 2026 | Kalendář + Notebook – 4 opravy poznámek: fetchNotesBatch chunking (dávky 100) + filtr noteable zdrojů (oprava hlavní příčiny mizení poznámek); NotePanel currentHtmlRef + cleanup unmount save; Notebook fetchCalEventNotes – recurring eventy (UUID__rec__datum); fetchOrphanNotes – oprava detekce recurring refs |
| v2.51.11 | 10. 3. 2026 | Notebook – 4 opravy: Kopírování obsahu zachovává formátování (htmlToPlainText); Kód blok – klik maže placeholder + Enter = nový řádek; Sync s Kalendářem – odstraněny neexistující sloupce event_title/event_date z upsert; Zarovnání počtů složek (mr-8 → mr-1) |
| v2.51.10 | 10. 3. 2026 | Notebook – 8 vylepšení: Řazení Název Z-A; Nastavení (ozubené kolo, localStorage `trackino_notebook_settings_{wsId}`: showInbox/foldersAutoOpen/defaultSort/folderSortOrder); Kódový blok `</>` + copy icon (CSS ::after, coordinate detection, nb-code-copied); Pohyb složek šipkami (moveFolderPos, jen manual sort); Název složky v pravém toolbaru; Fix ICS poznámek (ICS_REF_RE + `trackino_ics_event_cache` query); Řazení Poznámek k událostem (calNotesSortBy); Zarovnání počtů složek (mr-8) |
| v2.51.9 | 10. 3. 2026 | Notebook – 5 vylepšení: Kopírovat obsah (clipboard + 2s zelená fajfka); Duplikovat poznámku (suffix „– kopie N"); Poznámky k událostem – titulek s datem+časem + „Otevřít v Kalendáři" → localStorage deep-link → inline note panel; Řazení Nejstarší; Zarovnání počtů složek (ml-auto) |
| v2.51.8 | 10. 3. 2026 | Notebook – 5 oprav levého panelu: FolderTree počty složek nezahrnují archivované poznámky (a+e); přejmenování „Doručené" → „Inbox" v move menu (b); FolderTree počty fade místo hide (c); hover shift opraven – akční tlačítka absolutně pozicována (d) |
| v2.51.4 | 10. 3. 2026 | Globální scrollbar auto-hide (is-scrolling class); Poznámky – move button v detailu, autofocus titulku, delší preview (2 řádky); Kanban – odstraněn text „Přetáhněte sem úkol", počet úkolů v šedém kroužku |
| v2.51.3 | 10. 3. 2026 | Úkoly – 6 vylepšení: oprava „Skrýt hotové" (filtruje is_completed bez závislosti na sloupci); zakázán drag sloupců v Kanban; zvýraznění vybraného úkolu (modrý border); redesign detailu (Asana styl – kroužkové tlačítko, kompaktní pole, Zadavatel/Kontrolor, Časový odhad, Datum vytvoření, volba šířky panelu); přidána pole reviewer_id a time_estimate do DB; posun headeru výše |
| v2.51.2 | 9. 3. 2026 | Úkoly – 7 oprav: výrazné tlačítko dokončení v detailu; „Moje úkoly" řazení „Naposledy přiřazené" (updated_at); share modal oprava pořadí tlačítek + email pod jménem; DnD deaktivován na mobilu; odstraněno šedé pozadí z detail panel polí |
| v2.51.1 | 8. 3. 2026 | Úkoly – 8 vylepšení: odstraněn badge ze sidebaru; detail úkolu jako fixní overlay z pravé strany (celý viewport); pořadí sloupců v nastavení boardu (šipky ↑↓); editace projektů v levém panelu (hover akce tužka/křížek + modal); oprava priority strip zaoblení (overflow-hidden); redesign komentářového pole; zasouvací/vysouvací levý sidebar na desktopu (localStorage persist); Kalendář – SVG ikonka opakující se události přesunuta do pravého horního rohu (Týden/3 dny/Den/Měsíc) |
| v2.51.0 | 8. 3. 2026 | Úkoly – kompletní refaktoring modulu: přesun do NÁSTROJE v sidebaru; DnD přesouvání úkolů mezi sloupci (useDroppable fix); DnD přesouvání celých sloupců (horizontalListSortingStrategy); editace/mazání sloupců (double-click přejmenování); checkbox dokončení úkolu (is_completed, line-through + opacity); nastavení nástěnky (auto-přesun dokončených, barvy sloupců); rich text editor v popisu a komentářích (B/I/U, seznamy); přiřazení řešitele podúkolů; klik mimo detail panel = zavření; levý sidebar se složkami a projekty (rekurzivní strom, max 5 úrovní); sdílení projektů (nesdílet/workspace/konkrétní uživatelé); auto-hide horizontální scrollbar (kanban-scroll CSS); 3 nové DB tabulky + 7 ALTER |
| v2.50.1 | 8. 3. 2026 | Kalendář – Opakující se události: 14 typů opakování (denně/týdně/měsíčně/ročně + speciální vzory: 1./poslední den v týdnu/měsíci/kvartálu/roce + konkrétní den v měsíci); expandRecurringEvent() funkce; UI select v event modalu; info o opakování v detail modalu; podpora pro sdílené i účastnické události; 2 nové sloupce (recurrence_type, recurrence_day na trackino_calendar_events) |
| v2.50.0 | 8. 3. 2026 | Nový modul Úkoly (tasks, SPRÁVA, Pro+Max) – kompletní správa úkolů s Kanban nástěnkou; 3 pohledy (Seznam/Kanban/Tabulka); drag & drop přesouvání (@dnd-kit); detail panel s editovatelným názvem, statusem, prioritou, deadline, přiřazením; podúkoly s progress barem; přílohy (Supabase Storage); komentáře; historie změn; filtrování (fulltext/priorita/deadline/assignee/jen moje/skrytí hotových); auto-vytvoření nástěnky se 4 sloupci; badge otevřených úkolů v sidebar; oprávnění can_manage_tasks v Týmu; 7 nových DB tabulek + 1 ALTER |
| v2.49.1 | 8. 3. 2026 | Znalostní báze – Publikování stránky (veřejná URL s bezpečnostním tokenem); Kalendář – SVG ikonka opakující se události ve všech pohledech; nová veřejná route /kb/[slug]/[token]; API route /api/kb-public; 1 nový sloupec (public_token na trackino_kb_pages) |
| v2.49.0 | 8. 3. 2026 | Evidence domén – Registrátoři jako entita: nová záložka Registrátoři s CRUD (název, web, poznámky), select registrátora ve formuláři domény (místo volného textu), tlačítko + pro rychlé přidání, filtr dle registrátora; nový status Dobíhá (winding_down, fialový); dashboard rozšířen na 5 karet; Kalendář – nový pohled 3 dny: 3sloupcová mřížka (předchozí/dnešek/další den) s časovou osou, navigace po 1 dni, nastavení časového rozsahu, celodenní události; 1 nová DB tabulka (trackino_domain_registrars) |
| v2.48.0 | 8. 3. 2026 | Nový modul Evidence domén (domains, NÁSTROJE, Pro+Max) – evidence firemních domén; dashboard (celkem/aktivní/expirující/expirované); computed status „Expirující" (active + ≤30 dní do expirace, oranžové zvýraznění); spárování s předplatným (volitelné FK); tabulka s řazením (název/expirace/registrátor/status) + filtrování (status/firma/fulltext); detail modal; mobilní karty; oprávnění can_manage_domains v Týmu; 1 nová DB tabulka (trackino_domains) |
| v2.47.1 | 8. 3. 2026 | Předplatná – Podkategorie: hierarchická struktura kategorií (parent_id na trackino_subscription_categories), stromové zobrazení v záložce Kategorie, tlačítko + pro rychlé přidání podkategorie, seskupený select ve formuláři předplatného, filtr zahrnuje podkategorie, kaskádové mazání |
| v2.47.0 | 8. 3. 2026 | Předplatná – Evidence přístupů: 4. záložka „Přístupy" s 3 pohledy (Podle služby/Podle uživatele/Souhrnný přehled); interní i externí uživatelé; náklad na uživatele = měsíční_CZK / počet_přístupů; CRUD přístupů + externích uživatelů (modály); sekce Přístupy v detail modalu; ČNB kurzy – lazy DB cache (1× denně); 3 nové DB tabulky (trackino_subscription_access_users, trackino_subscription_accesses, trackino_exchange_rates přepis na globální cache) |
| v2.46.0 | 8. 3. 2026 | Nový modul Předplatná (subscriptions, NÁSTROJE, Pro+Max) – evidence firemních předplatných a SaaS služeb; dashboard statistiky (aktivní/měsíčně/ročně/blížící se platby); 3 záložky (Předplatná/Tipy/Kategorie); CRUD s modálním formulářem (název, typ, stav, cena, měna, frekvence, priorita, obnova, URLs, společnost, registrační email, poznámky); hvězdičkové hodnocení (1-5, per-user); ČNB kurzovní lístek (/api/cnb-rates) pro přepočet EUR/USD→CZK; filtrování (stav/typ/kategorie) + fulltextové hledání + řazení; detail modal; kategorie s barvami; oprávnění can_manage_subscriptions v Týmu; 4 nové DB tabulky (trackino_subscription_categories/subscriptions/subscription_ratings/exchange_rates) |
| v2.45.2 | 8. 3. 2026 | KB: task box ve stylu Poznámek – tlačítko Úkol v toolbaru přidává panel s úkoly pod editor (checkboxy, text inputy, Enter=nový, Backspace=smazat), read-only zobrazení při prohlížení; AI asistent: scroll v info panelu (overflow-y-auto, max 60vh), model pills seskupeny po řádcích dle providera (GPT/Gemini); Nastavení: přesun „Skrýt štítky" z Obecné do Povinná pole s lepším popisem |
| v2.45.1 | 8. 3. 2026 | Fakturace: redesign desktop výpisu – 4 řádky (měsíc, VS+vystaveno+splatnost, částka s hodinami v závorce, Schváleno+Proplaceno); Kalendář: fix race condition načítání poznámek v pohledu Seznam (prevDisplayEventsRef clear cache při změně displayEvents); KB: odstraněn fixní task panel pod stránkou – tlačítko Úkol vkládá checklist inline do editoru přes insBlock() |
| v2.45.0 | 8. 3. 2026 | AI asistent: Google Gemini integrace – přidán provider 'google' (AiProvider type), 4 nové modely (gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro, gemini-3-flash-preview), @google/generative-ai SDK, handleGemini() v API route, model pills seskupeny dle providera, info dialog s provider sekcemi, env GEMINI_API_KEY |
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
- `'today'` – jeden den s časovou osou (24h mřížka)
- `'three_days'` – 3 sloupce (předchozí den, dnešek, další den) s časovou osou, navigace po 1 dni (v2.49.0)
- `'week'` – 7 sloupců (Po–Ne), `getMonday(currentDate)` jako začátek
- `'month'` – mřížka; týdny začínají pondělím; dny mimo měsíc jsou šedě podbarveny

### View switcher (v2.15.0)
- Přesunut z levého panelu do **top headeru** (vedle „Přidat událost")
- Tlačítka: „Den" / „3 dny" / „Týden" / „Měsíc" / „Rok" / „Seznam"
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
  // Opakování (v2.50.1)
  recurrence_type?: string;
  recurrence_day?: number | null;
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
- `expandRecurringEvent(ev, rangeStart, rangeEnd)` – vrátí pole `{ start_date, end_date }[]` výskytů opakující se události v daném rozsahu; podporuje 14 typů: none, daily, weekly, monthly, yearly, first/last_day_month/week/quarter/year, monthly_on_day; safety counter MAX_ITER=2000
- `getRecurrenceLabel(type)` – vrátí český label pro typ opakování
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

### Opakující se události (v2.50.1)
- **DB sloupce**: `recurrence_type` (text, 14 typů, DEFAULT 'none'), `recurrence_day` (integer, nullable, 1–31 jen pro monthly_on_day)
- **Typy**: `none`, `daily`, `weekly`, `monthly`, `yearly`, `first_day_month`, `last_day_month`, `first_day_week`, `last_day_week`, `first_day_quarter`, `last_day_quarter`, `first_day_year`, `last_day_year`, `monthly_on_day`
- **expandRecurringEvent()**: generuje výskyty v rozsahu `[rangeStart, rangeEnd]`; MAX_ITER=2000 safety counter
- **ID výskytů**: `{originalEventId}__rec__{YYYY-MM-DD}` – kliknutí na výskyt → `source_id` obsahuje originální ID → `events.find()` → editace původní události
- **displayEvents useMemo**: vlastní, sdílené i účastnické události s `recurrence_type !== 'none'` se expandují přes `expandRecurringEvent()`
- **UI**: select „Opakování" v event modalu + podmíněný input „Den v měsíci" (1–31) pro monthly_on_day
- **Detail modal**: řádek s SVG ikonou cyklu + label typu opakování
- **RECURRENCE_OPTIONS**: pole `{ value, label, separator? }` pro select s oddělovači

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

## 17. Schvalování dovolené – architektura (vacation/)

### Soubory (po refaktoringu v2.51.38 – rozdělen z 925 ř. na subsoubory)
| Soubor | Popis |
|--------|-------|
| `vacation/page.tsx` | Auth guard + WorkspaceProvider (~23 ř.) |
| `vacation/_components/VacationContent.tsx` | **Orchestrátor** – volá useVacation, renderuje access guard, header (user filter + add button), tab switcher, podmíněný obsah záložek, RejectModal (~170 ř.) |
| `vacation/_components/useVacation.ts` | Custom hook – veškerý state, fetchData, addEntry, deleteEntry, approveEntry, rejectEntry, computed hodnoty; exportuje `UseVacationReturn` (~230 ř.) |
| `vacation/_components/types.ts` | Sdílené typy: `APPROVAL_THRESHOLD = 3`, `VacationEntryWithProfile`, `ActiveTab` |
| `vacation/_components/utils.ts` | Helper funkce: `calcWorkDays`, `formatDate`, `inputCls`, `inputStyle`, `syncVacationToPlanner`, `removeVacationFromPlanner` |
| `vacation/_components/VacationStats.tsx` | 3 stat karty (Čerpáno/Zbývá/Celkový nárok) + allowance warning banner (~45 ř.) |
| `vacation/_components/VacationForm.tsx` | Formulář přidání dovolené (user picker, datumové pole, náhled pracovních dní, badge schválení, poznámka) (~100 ř.) |
| `vacation/_components/VacationRecordsTab.tsx` | Tabulka schválených záznamů s mazáním + sekce „Moje žádosti" (pending/rejected) (~130 ř.) |
| `vacation/_components/VacationRequestsTab.tsx` | Seznam čekajících žádostí pro manažery/adminy se Schválit/Zamítnout tlačítky (~90 ř.) |
| `vacation/_components/VacationArchiveTab.tsx` | Archiv vyřízených žádostí (schválené + zamítnuté) s info o reviewerovi (~100 ř.) |
| `vacation/_components/RejectModal.tsx` | Fixní modal pro zadání důvodu zamítnutí s textarea (~65 ř.) |

### Konstanty
```typescript
export const APPROVAL_THRESHOLD = 3; // > 3 pracovních dní vyžaduje schválení
// Definováno v vacation/_components/types.ts
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

### Key state variables (v useVacation.ts)
- `activeTab: ActiveTab` – `'records' | 'requests' | 'archive'`
- `subordinateUserIds: string[]` – z managerAssignments kde manager_user_id === user?.id (useMemo)
- `canSeeRequests = isWorkspaceAdmin || isManager`
- `approvedEntries` – jen `status === 'approved'`
- `myPendingRejectedEntries` – vlastní pending/rejected záznamy
- `pendingRequestEntries` – pending od podřízených (manager) nebo od všech (admin)
- `archiveEntries` – všechny approved+rejected (pro adminy/managery)

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

## 24. Prompty – architektura (prompts/)

### Soubory (po refaktoringu v2.51.37 – rozdělen z 1001 ř. na subsoubory)
| Soubor | Popis |
|--------|-------|
| `prompts/page.tsx` | Auth guard + WorkspaceProvider (~15 ř.) |
| `prompts/_components/PromptsContent.tsx` | **Orchestrátor** – volá usePrompts, renderuje layout, PromptsLeftPanel, PromptCard, PromptModals |
| `prompts/_components/usePrompts.ts` | Custom hook – veškerý state, computed hodnoty, CRUD (~270 ř.) |
| `prompts/_components/types.ts` | Sdílené typy: PromptFolder, FolderShare, Prompt, PromptComment, Member, PromptFilter, MAX_DEPTH |
| `prompts/_components/utils.ts` | Pomocné funkce: getDepth, getInitials, stripHtml, extractCodeBlocks |
| `prompts/_components/RichEditor.tsx` | Rich text editor (H2/H3/B/I/U/seznamy/kód) s contentEditable |
| `prompts/_components/FolderTree.tsx` | Rekurzivní strom složek (mobil ⋮ dropdown, desktop hover akce) |
| `prompts/_components/PromptCard.tsx` | Karta promptu s akcemi (copy/like/fav/edit/delete) |
| `prompts/_components/PromptModals.tsx` | Tři modaly: FolderModal, ShareModal, PromptModal |
| `prompts/_components/PromptsLeftPanel.tsx` | Levý panel (vyhledávání, filtry, podle autora, složky) |

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

## 25. Záložky – architektura (bookmarks/)

### Soubory (po refaktoringu v2.51.36 – rozdělen z 1008 ř. na subsoubory)
| Soubor | Popis |
|--------|-------|
| `bookmarks/page.tsx` | Auth guard + WorkspaceProvider (~15 ř.) |
| `bookmarks/_components/BookmarksContent.tsx` | **Orchestrátor** – volá useBookmarks, renderuje layout, přepíná záložky, zobrazuje modaly |
| `bookmarks/_components/useBookmarks.ts` | Custom hook – veškerý state, computed hodnoty, CRUD (~260 ř.) |
| `bookmarks/_components/types.ts` | Sdílené typy: BookmarkFolder, FolderShare, Bookmark, BookmarkComment, Member, BookmarkFilter, MAX_DEPTH |
| `bookmarks/_components/utils.ts` | Pomocné funkce: getInitials, getDomain, getFaviconUrl |
| `bookmarks/_components/FolderTree.tsx` | Rekurzivní strom složek (mobil ⋮ dropdown, desktop hover akce) |
| `bookmarks/_components/BookmarksLeftPanel.tsx` | Levý panel (vyhledávání, filtry, podle autora, složky) |
| `bookmarks/_components/BookmarkCard.tsx` | Karta záložky s inline komentáři (edit/delete), akce (copy/like/fav/edit/delete) |
| `bookmarks/_components/BookmarkModals.tsx` | Tři modaly: FolderModal, ShareModal, BookmarkModal |

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

## 28. AI asistent – architektura (ai-assistant/)

### Soubory (po refaktoringu v2.51.31 – rozdělen z 1340 ř. na subsoubory)
| Soubor | Popis |
|--------|-------|
| `src/lib/ai-providers.ts` | Konfigurace providerů (AiProvider, AiProviderConfig) + seznam modelů (AiModel, AI_MODELS) + helpery |
| `src/app/api/ai-chat/route.ts` | Serverová POST route – drží API klíče bezpečně na serveru; streaming přes ReadableStream; non-streaming pro modely bez podpory (o1-mini) |
| `ai-assistant/page.tsx` | Entry point – WorkspaceProvider wrapper (~10 ř.) |
| `ai-assistant/_components/AiAssistantContent.tsx` | **Orchestrátor** – access guard, layout, header, nastavení panel, skládá subkomponenty |
| `ai-assistant/_components/useAiAssistant.ts` | Custom hook – veškerý state, computed hodnoty, CRUD konverzací, sendMessage, streaming, Firecrawl; exportuje `UseAiAssistantReturn` |
| `ai-assistant/_components/types.ts` | Sdílené typy: `ChatMessage`, `FirecrawlStatus`, `FavoritePrompt` |
| `ai-assistant/_components/utils.ts` | Helper funkce: `fmtTime`, `fmtDate`, `estimateTokens`, `extractUrls`, `autoTitle`, `escHtml`, `renderMarkdown`, `htmlToPlainText` |
| `ai-assistant/_components/constants.ts` | Konstanty: `FIRECRAWL_CREDIT_LIMIT`, `CREDITS_PER_SCRAPE/SEARCH`, `FIRECRAWL_CREDITS_KEY`, `AI_MSG_STYLES` (CSS string) |
| `ai-assistant/_components/ConversationSidebar.tsx` | Levý sidebar – seznam konverzací, vyhledávání, Oblíbené/Ostatní sekce, hvězdička, mazání |
| `ai-assistant/_components/ChatMessages.tsx` | Oblast zpráv – prázdný stav, bubliny user/AI, Firecrawl loading, streaming bublina s kurzorem |
| `ai-assistant/_components/ChatInput.tsx` | Input oblast – textarea, web search toggle, model pills, token counter, Firecrawl kredity; skládá FavoritePromptsPanel + ModelInfoPanel |
| `ai-assistant/_components/FavoritePromptsPanel.tsx` | Panel oblíbených promptů (toggle, seznam, kopírování) |
| `ai-assistant/_components/ModelInfoPanel.tsx` | Info dialog o modelech – grid karet per provider, výběr modelu, ceny v Kč |

### AI providers (src/lib/ai-providers.ts)
```typescript
export type AiProvider = 'openai' | 'google'; // Budoucí: | 'anthropic' | 'mistral'
export interface AiProviderConfig { id, name, envKey, baseUrl, available }
export interface AiModel { id, name, provider, description, contextWindow, supportsStreaming }
export const AI_PROVIDERS: AiProviderConfig[]
export const AI_MODELS: AiModel[]
export const DEFAULT_MODEL_ID = 'gpt-4o-mini'
export function getProviderForModel(modelId): AiProviderConfig | undefined
```

### Dostupné modely
| Provider | Model | API ID | Input $/1M | Output $/1M | Streaming |
|----------|-------|--------|-----------|------------|-----------|
| OpenAI | GPT-4o | gpt-4o | 2.50 | 10.00 | Ano |
| OpenAI | GPT-4o mini | gpt-4o-mini | 0.15 | 0.60 | Ano |
| OpenAI | GPT-4 Turbo | gpt-4-turbo | 10.00 | 30.00 | Ano |
| OpenAI | o1-mini | o1-mini | 1.10 | 4.40 | Ne |
| Google | Gemini 2.5 Flash | gemini-2.5-flash | 0.30 | 2.50 | Ano |
| Google | Gemini 2.5 Flash-Lite | gemini-2.5-flash-lite | 0.10 | 0.40 | Ano |
| Google | Gemini 2.5 Pro | gemini-2.5-pro | 1.25 | 10.00 | Ano |
| Google | Gemini 3 Flash Preview | gemini-3-flash-preview | 0.50 | 3.00 | Ano |

### Přidání nového providera
1. Přidat do `type AiProvider` v `ai-providers.ts`
2. Přidat objekt do `AI_PROVIDERS[]` s `envKey` (název env proměnné)
3. Přidat modely do `AI_MODELS[]` se správným `provider`
4. Přidat env proměnnou do Vercel Environment Variables
5. Pro OpenAI-compatible API: automaticky funguje přes `handleOpenAI()`
6. Pro non-OpenAI API (jako Gemini): přidat handler funkci do `route.ts` a podmínku v POST handleru

### API route (/api/ai-chat)
- `POST /api/ai-chat` – přijímá `{ messages, model, systemPrompt?, stream?, temperature?, maxTokens? }`
- Validace modelu, lookup providera, check env klíče
- **OpenAI**: OpenAI-compatible formát (SSE stream, `data: {...}` chunks)
- **Google Gemini**: @google/generative-ai SDK, `generateContentStream()` / `generateContent()`
- Obě větve vrací stejný formát: streaming text + `__USAGE__:{json}` suffix
- Non-streaming: vrací `{ content, usage }`
- Chybové stavy: 400 neznámý model, 503 chybí API klíč, 500 interní chyba

### Env proměnné (přidat do Vercel Environment Variables)
```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
# Budoucí:
# ANTHROPIC_API_KEY=...
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
| `trackino_kb_pages` | Stránky (folder_id, title, content HTML, tasks jsonb, status, tags[], is_restricted, public_token, created_by, updated_by) |
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
export interface KbPage { id, workspace_id, folder_id, title, content, tasks: { id: string; text: string; checked: boolean }[], status: KbPageStatus, tags: string[], is_restricted, public_token: string | null, created_by, updated_by, created_at, updated_at }
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
- `togglePublish(page)` – generuje/maže `public_token` na stránce; pokud token existuje → nastaví na null (unpublish); jinak vygeneruje 16znakový kryptograficky náhodný token
- `getPublicUrl(page)` → `{origin}/kb/{slugify(title)}/{public_token}` – veřejná URL pro sdílení
- `copyPublicUrl(page)` – zkopíruje veřejnou URL do schránky

### Publikování stránky (v2.49.1)
- **DB sloupec**: `trackino_kb_pages.public_token text DEFAULT NULL` – kryptograficky náhodný 16znakový token (crypto.getRandomValues)
- **Veřejná route**: `/kb/[slug]/[token]` – Next.js stránka bez auth, slug je jen pro hezčí URL (ignorován serverem), token je klíčový
- **API route**: `GET /api/kb-public?token=...` – server-side přes supabase-admin (bypasuje RLS), vrací title, content, updated_at, workspace_name
- **UI**: ikona zeměkoule v action baru stránky (zelená = publikováno, šedá = nepublikováno); zelený proužek s „Kopírovat odkaz" a „Otevřít" u publikovaných stránek
- **Oprávnění**: jen admin (canAdmin) může publikovat/odvolat
- **Bezpečnost**: token je 16 znaků z `crypto.getRandomValues(Uint8Array(12))` → base36 = ~62 bitů entropie; URL nelze uhádnout

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

## 36b. Rate Limiting – architektura (Upstash Redis)

### Soubory
| Soubor | Popis |
|--------|-------|
| `src/lib/rate-limit.ts` | Tři limitery: `rateLimitRegister`, `rateLimitAI`, `rateLimitFirecrawl` |
| `src/app/api/auth/register/route.ts` | Server-side registrace s rate limitem (POST) |

### Limitery
| Název | Limit | Prefix | Použití |
|-------|-------|--------|---------|
| `rateLimitRegister` | 3 / 1 hod | `trackino:register` | `/api/auth/register` |
| `rateLimitAI` | 20 / 1 min | `trackino:ai` | `/api/ai-chat` |
| `rateLimitFirecrawl` | 10 / 1 min | `trackino:firecrawl` | `/api/firecrawl/scrape`, `/api/firecrawl/search` |

### Klíč pro rate limiting
Všechny limitery používají **IP adresu** jako klíč:
```typescript
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? req.headers.get('x-real-ip') ?? 'anonymous';
```
Při překročení limitu vrací HTTP **429** s `{ error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' }`.

### Registrace – nový tok (v2.51.27)
Původní tok: `register/page.tsx` → `signUp()` z AuthContext → `supabase.auth.signUp()` (client-side)
Nový tok: `register/page.tsx` → `POST /api/auth/register` (rate limit check) → `supabase.auth.signUp()` (server-side) → `supabase.auth.setSession(session)` v prohlížeči

### Env proměnné (nutno přidat na Vercel)
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```
Hodnoty z: https://console.upstash.com/ → vytvoř Redis databázi → REST API sekce.

### Algoritmus
Sliding window – okno se posouvá s každým požadavkem (ne fixed bucket). Vhodné pro ochranu před burst útoky.

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

## 32. Předplatná – architektura (subscriptions/)

### Soubory (po refaktoringu v2.51.24)
| Soubor | Popis |
|--------|-------|
| `subscriptions/page.tsx` | Auth guard + WorkspaceProvider (~20 ř.) |
| `subscriptions/_components/SubscriptionsContent.tsx` | Orchestrátor – volá useSubscriptions, renderuje layout, přepíná záložky, zobrazuje modaly |
| `subscriptions/_components/useSubscriptions.ts` | Custom hook – veškerý state, computed hodnoty, CRUD (~315 ř.) |
| `subscriptions/_components/types.ts` | Sdílené TypeScript typy: Tab, SortField, Member, Rates, Stats, SubForm, CatForm, AccessForm, ExtUserForm |
| `subscriptions/_components/constants.tsx` | STATUS_CONFIG, TYPE_LABELS, ICONS (SVG JSX), inputCls, btnPrimary, CATEGORY_COLORS |
| `subscriptions/_components/utils.ts` | toMonthly, toYearly, getFaviconUrl, fmtPrice, fmtDate, daysUntil |
| `subscriptions/_components/StarRating.tsx` | Interaktivní 5-hvězdičkové hodnocení |
| `subscriptions/_components/StatsDashboard.tsx` | 4 statistické karty (aktivní/měsíčně/ročně/blížící se) |
| `subscriptions/_components/SubsTabContent.tsx` | Záložka Předplatná/Tipy – filtry + seřaditelná tabulka |
| `subscriptions/_components/CategoriesTabContent.tsx` | Záložka Kategorie – 3-sloupcová mřížka s podkategoriemi |
| `subscriptions/_components/AccessByServiceView.tsx` | Pohled Přístupy: Podle služby |
| `subscriptions/_components/AccessByUserView.tsx` | Pohled Přístupy: Podle uživatele |
| `subscriptions/_components/AccessSummaryView.tsx` | Pohled Přístupy: Souhrnný přehled |
| `subscriptions/_components/AccessTabContent.tsx` | Záložka Přístupy – přepínač 3 pohledů + routing |
| `subscriptions/_components/DetailModal.tsx` | Detail modal předplatného |
| `subscriptions/_components/SubFormModal.tsx` | Formulář vytvoření/editace předplatného |
| `subscriptions/_components/AccessModal.tsx` | Formulář přidání přístupu |
| `subscriptions/_components/ExtUserModal.tsx` | Formulář externího uživatele |
| `subscriptions/_components/CatFormModal.tsx` | Formulář kategorie (název, barva, nadřazená kat.) |
| `src/app/api/cnb-rates/route.ts` | ČNB kurzovní lístek (EUR/USD→CZK) s lazy DB cache (1× denně) |

### DB tabulky
| Tabulka | Popis |
|---------|-------|
| `trackino_subscription_categories` | Kategorie předplatných (name, color, sort_order, parent_id – hierarchie podkategorií) |
| `trackino_subscriptions` | Záznamy předplatných (profil, cena, stav, URLs, poznámky, is_tip) |
| `trackino_subscription_ratings` | Hvězdičkové hodnocení (per-user, 1-5, UNIQUE subscription_id+user_id) |
| `trackino_subscription_access_users` | Externí uživatelé (name, email, note) pro evidenci přístupů |
| `trackino_subscription_accesses` | Přiřazení uživatel→služba (subscription_id, user_id XOR external_user_id, role, granted_at) |
| `trackino_exchange_rates` | Globální cache kurzů ČNB (date, currency, rate); UNIQUE(date,currency) |

### Typy (database.ts)
```typescript
type SubscriptionType = 'saas' | 'hosting' | 'license' | 'domain' | 'other';
type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial' | 'pending_approval';
type SubscriptionFrequency = 'monthly' | 'quarterly' | 'yearly' | 'biennial' | 'one_time';
type SubscriptionPriority = 'high' | 'medium' | 'low';
type SubscriptionCurrency = 'CZK' | 'EUR' | 'USD';
```

### Oprávnění
```typescript
const canManage = isMasterAdmin || isWorkspaceAdmin || currentMembership?.can_manage_subscriptions;
```

### Záložky
- **Předplatná** – hlavní tabulkový výpis (subs kde `is_tip=false`)
- **Tipy** – doporučení (subs kde `is_tip=true`)
- **Kategorie** – CRUD kategorií s barvami
- **Přístupy** – evidence přístupů uživatelů ke službám (3 pohledy)

### Dashboard statistiky (4 karty)
- Aktivních (z celkových)
- Měsíčně v CZK (přepočet přes ČNB kurz)
- Ročně v CZK
- Blížící se platby (do 30 dní)

### Cenový přepočet
- `toMonthly(price, freq)` / `toYearly(price, freq)` – normalizace dle frekvence
- `toCzk(price, currency)` – přepočet přes ČNB kurzovní lístek
- API route `/api/cnb-rates` → lazy DB cache: 1. check `trackino_exchange_rates` pro dnešní datum, 2. pokud chybí → fetch z ČNB → upsert do DB
- Výpočet nákladu na uživatele: `toMonthly(toCzk(cena, měna), frekvence) / počet_přístupů`

### Evidence přístupů (záložka Přístupy)
- **Dva typy uživatelů**: interní (členové workspace) a externí (`trackino_subscription_access_users`)
- **3 pohledy**: Podle služby / Podle uživatele / Souhrnný přehled (sub-přepínač)
- **Podle služby**: karta per předplatné → seznam uživatelů s přístupem, počet, cena/měs, náklad/uživatel
- **Podle uživatele**: sekce Interní/Externí, pro každého seznam služeb + celkový měsíční náklad
- **Souhrnný přehled**: seřaditelná tabulka (název/uživatelů/náklad/stav/cena/kategorie) + 3 souhrnné karty
- **CRUD**: `openAccessModal()`, `saveAccess()`, `removeAccess()`, `openNewExtUser()`, `saveExtUser()`, `deleteExtUser()`
- **Detail modal**: sekce Přístupy (seznam + přidat/odebrat)
- **Oprávnění**: sdílí `canManage` (can_manage_subscriptions)

### SQL migrace
```sql
CREATE TABLE IF NOT EXISTS trackino_subscription_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  sort_order integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES trackino_subscription_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_subscription_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_subscription_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS trackino_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'saas' CHECK (type IN ('saas','hosting','license','domain','other')),
  website_url text NOT NULL DEFAULT '',
  login_url text NOT NULL DEFAULT '',
  registration_email text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  registered_by uuid REFERENCES auth.users(id),
  description text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','trial','pending_approval')),
  renewal_type text NOT NULL DEFAULT 'auto' CHECK (renewal_type IN ('auto','manual')),
  price numeric,
  currency text NOT NULL DEFAULT 'CZK' CHECK (currency IN ('CZK','EUR','USD')),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','quarterly','yearly','biennial','one_time')),
  next_payment_date text,
  registration_date text,
  category_id uuid REFERENCES trackino_subscription_categories(id) ON DELETE SET NULL,
  is_tip boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS trackino_subscription_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES trackino_subscriptions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (subscription_id, user_id)
);
ALTER TABLE trackino_subscription_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_subscription_ratings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE trackino_workspace_members
  ADD COLUMN IF NOT EXISTS can_manage_subscriptions boolean NOT NULL DEFAULT false;

-- Evidence přístupů (v2.47.0)
CREATE TABLE IF NOT EXISTS trackino_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date text NOT NULL,
  currency text NOT NULL,
  rate numeric NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (date, currency)
);
ALTER TABLE trackino_exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_exchange_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS trackino_subscription_access_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_subscription_access_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_subscription_access_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS trackino_subscription_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES trackino_subscriptions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  external_user_id uuid REFERENCES trackino_subscription_access_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT '',
  granted_at text,
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CHECK (
    (user_id IS NOT NULL AND external_user_id IS NULL) OR
    (user_id IS NULL AND external_user_id IS NOT NULL)
  )
);
ALTER TABLE trackino_subscription_accesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_subscription_accesses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_access_user
  ON trackino_subscription_accesses (subscription_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_access_ext_user
  ON trackino_subscription_accesses (subscription_id, external_user_id)
  WHERE external_user_id IS NOT NULL;
```

---

## 33. Evidence domén – architektura (domains/)

### Soubory (po refaktoringu v2.51.35 – rozdělen z 1195 ř. na subsoubory)
| Soubor | Popis |
|--------|-------|
| `domains/page.tsx` | Auth guard + WorkspaceProvider (~20 ř.) |
| `domains/_components/DomainsContent.tsx` | **Orchestrátor** – renderuje DashboardLayout, header, záložky, všechny podkomponenty |
| `domains/_components/useDomains.ts` | Custom hook – veškerý state, computed hodnoty, CRUD (~240 ř.) |
| `domains/_components/types.ts` | Sdílené typy: DisplayStatus, SortField, SortDir, TabType, DomainFormState, RegFormState, DomainStats |
| `domains/_components/constants.tsx` | STATUS_CONFIG, DB_STATUSES, EXPIRING_THRESHOLD_DAYS, ICONS (SVG JSX), inputCls, inputStyle |
| `domains/_components/utils.ts` | daysUntilExpiration, getDisplayStatus, fmtDate |
| `domains/_components/StatsDashboard.tsx` | 5 statistických karet (Celkem/Aktivní/Expirující/Dobíhá/Expirované) |
| `domains/_components/DomainsTabContent.tsx` | Záložka Domény – filtry + seřaditelná tabulka + mobilní karty |
| `domains/_components/RegistrarsTabContent.tsx` | Záložka Registrátoři – tabulka + mobilní karty |
| `domains/_components/DomainFormModal.tsx` | Formulář vytvoření/editace domény (z-index z-50) |
| `domains/_components/RegistrarFormModal.tsx` | Formulář vytvoření/editace registrátora (z-index z-[60]) |
| `domains/_components/DomainDetailModal.tsx` | Read-only detail domény s editačním tlačítkem (z-index z-50) |

### DB tabulka `trackino_domains`
| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | uuid | PK |
| workspace_id | uuid | FK na trackino_workspaces |
| name | text | Název domény (povinné) |
| registrar | text | Název registrátora |
| subscription_id | uuid (nullable) | FK na trackino_subscriptions (volitelné spárování) |
| registration_date | text (nullable) | Datum registrace YYYY-MM-DD |
| expiration_date | text (nullable) | Datum expirace YYYY-MM-DD |
| status | text | active / expired / transferred / cancelled |
| notes | text | Poznámky |
| target_url | text | Cílová URL |
| project_name | text | Název projektu |
| company_name | text | Název firmy |
| created_by | uuid | FK na auth.users |
| created_at | timestamptz | Čas vytvoření |
| updated_at | timestamptz | Čas poslední úpravy |

### Computed status „Expirující"
- **Není uložen v DB** – počítá se na klientu
- `getDisplayStatus(domain)` → pokud `status === 'active'` a `expirationDate` ≤ 30 dní → vrací `'expiring'`
- Expirující domény mají oranžově podbarvený řádek v tabulce (`#fef3c720`)
- `daysUntilExpiration(date)` → počet dní do expirace (záporné = po expiraci)

### Oprávnění
```typescript
const canManage = isMasterAdmin || isWorkspaceAdmin || currentMembership?.can_manage_domains;
```

### Spárování s předplatným
- Select s existujícími aktivními předplatnými (jen pokud `hasModule('subscriptions')`)
- Nullable FK `subscription_id` → při smazání předplatného se nastaví na NULL (ON DELETE SET NULL)

### Dashboard (4 karty)
- Celkem – všechny domény
- Aktivní – `status === 'active'`
- Expirující – computed, active + ≤30 dní
- Expirované – `status === 'expired'`

### Filtry a řazení
- **Fulltext**: název, registrátor, firma, projekt, poznámky
- **Status filtr**: active, expiring (computed), expired, transferred, cancelled
- **Firma filtr**: select z unikátních company_name
- **Řazení**: name, expiration_date, registrar, status

### SQL migrace
```sql
CREATE TABLE IF NOT EXISTS trackino_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  registrar text NOT NULL DEFAULT '',
  subscription_id uuid REFERENCES trackino_subscriptions(id) ON DELETE SET NULL,
  registration_date text,
  expiration_date text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','transferred','cancelled')),
  notes text NOT NULL DEFAULT '',
  target_url text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_domains FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE trackino_workspace_members
  ADD COLUMN IF NOT EXISTS can_manage_domains boolean NOT NULL DEFAULT false;
```

---

## 34. Úkoly – architektura (tasks/page.tsx)

### Struktura souborů (od v2.51.21 – rozdělen z 2978 ř. na subsoubory)

| Soubor | Popis |
|--------|-------|
| `tasks/page.tsx` | **Orchestrátor** – importuje subkomponenty, drží veškerý state a logiku, renderuje layout |
| `tasks/types.tsx` | Shared typy a konstanty: `PRIORITY_CONFIG`, `TaskView`, `DeadlineFilter`, `Member`, `UserWorkspace`, `CwsBoardInfo`, `CwsColumnInfo`, `WORKSPACE_COLORS`, `getWsColor`, `selectCls`, `SelectChevron` |
| `tasks/components/Avatar.tsx` | `Avatar` – kruhový avatar s iniciálou a barvou |
| `tasks/components/DragComponents.tsx` | `DroppableColumn` (useDroppable), `SortableColumnWrapper` (useSortable) |
| `tasks/components/SortableCard.tsx` | `SortableCard` – karta úkolu v Kanban pohledu (DnD, checkbox, priorita, assignee, deadline) |
| `tasks/components/TaskLeftSidebar.tsx` | Levý panel: strom složek, projekty, navigace (Moje/Všechny/cross-ws), sdílení složek |
| `tasks/components/TaskDetailPanel.tsx` | Pravý panel detailu úkolu: editace názvu/popisu, podúkoly, přílohy, komentáře, historie |
| `tasks/components/TaskModals.tsx` | `BoardSettingsModal`, `ShareModal`, `BoardEditModal`, `CwsNewTaskModal` |
| `tasks/views/ListView.tsx` | `ListView` – seznam úkolů s checkboxy, volitelné řazení |
| `tasks/views/KanbanView.tsx` | `KanbanView` – DnD Kanban (DndContext, SortableContext, DragOverlay) |
| `tasks/views/TableView.tsx` | `TableView` – tabulka s klikatelným řazením |
| `tasks/views/CrossWorkspaceView.tsx` | `CrossWorkspaceView` – tabulka úkolů napříč workspace |

### Soubory
| Soubor | Popis |
|--------|-------|
| `src/app/(dashboard)/tasks/page.tsx` | Hlavní stránka modulu – levý sidebar se složkami a projekty, 3 pohledy (Seznam/Kanban/Tabulka), detail panel, CRUD, DnD karet i sloupců |

### DB tabulky (7 + 3 nové)
| Tabulka | Popis |
|---------|-------|
| `trackino_task_boards` | Nástěnky/projekty (workspace_id, name, settings jsonb, folder_id, color, description, is_shared, created_by) |
| `trackino_task_columns` | Sloupce/stavy nástěnky (board_id, name, color, sort_order) |
| `trackino_task_items` | Úkoly (board_id, column_id, title, description, priority, deadline, assigned_to, is_completed, sort_order) |
| `trackino_task_subtasks` | Podúkoly (task_id, title, is_done, sort_order, assigned_to) |
| `trackino_task_comments` | Komentáře k úkolu (task_id, user_id, content) |
| `trackino_task_attachments` | Přílohy (task_id, file_path, file_name, file_size, file_mime, uploaded_by) |
| `trackino_task_history` | Historie změn (task_id, user_id, action, old_value, new_value) |
| `trackino_task_folders` | Složky pro organizaci projektů (parent_id self-ref, is_shared, max 5 úrovní) |
| `trackino_task_folder_shares` | Sdílení složek (user_id nullable = celý workspace) |
| `trackino_task_board_members` | Sdílení nástěnky s konkrétními členy (UNIQUE board_id+user_id, can_edit) |

### Typy (database.ts)
```typescript
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export interface TaskBoardSettings { auto_complete_column_id?: string | null; column_colors_enabled?: boolean; }
export interface TaskBoard { id, workspace_id, name, settings: TaskBoardSettings, folder_id, color, description, is_shared, created_by, created_at }
export interface TaskColumn { id, board_id, name, color, sort_order, created_at }
export interface TaskItem { id, workspace_id, board_id, column_id, title, description, priority: TaskPriority, deadline, sort_order, created_by, assigned_to, is_completed, created_at, updated_at }
export interface TaskSubtask { id, task_id, title, is_done, sort_order, assigned_to, created_at }
export interface TaskComment { id, task_id, user_id, content, created_at, updated_at }
export interface TaskAttachment { id, task_id, file_path, file_name, file_size, file_mime, uploaded_by, created_at }
export interface TaskHistory { id, task_id, user_id, action, old_value, new_value, created_at }
export interface TaskFolder { id, workspace_id, name, color, sort_order, parent_id, created_by, is_shared, created_at, updated_at }
export interface TaskFolderShare { id, folder_id, workspace_id, user_id, shared_by, created_at }
export interface TaskBoardMember { id, board_id, workspace_id, user_id, can_edit, created_at }
```

### Layout (v2.51.0)
- Dvoupanelový: záporný margin (`-m-4 lg:-m-6`) pro plný viewport, `flex flex-row`
- **Levý panel**: 260px fixed width, na mobilu overlay (toggle tlačítkem), obsahuje strom složek, projekty
- **Pravý panel**: flex-1, zobrazuje Kanban/List/Table view + detail panel

### Levý sidebar – struktura
```
[Záhlaví: "Úkoly" + tlačítka Nový projekt / Nová složka]
[Navigace]
  ├─ Všechny úkoly
  ├─ Moje úkoly
  ├─ SLOŽKY (rekurzivní strom, max 5 úrovní)
  │   ├─ Složka A (sdílená – modrá ikona)
  │   │   ├─ Projekt 1 ← kliknutelný (nastaví activeBoardId)
  │   │   └─ Projekt 2
  │   └─ Složka B
  └─ NEZAŘAZENÉ PROJEKTY
      ├─ Hlavní board
      └─ ...
```

### Pohledy
- `'list'` – vertikální výpis s checkboxy dokončení, bez barevných puntíků
- `'kanban'` – sloupcový přehled; DnD karet (verticalListSortingStrategy) + DnD celých sloupců (horizontalListSortingStrategy); `DroppableColumn` wrapper (useDroppable) pro cross-column přesun; `SortableColumnWrapper` s render prop pro drag sloupců; `kanban-scroll` CSS třída pro auto-hide scrollbar
- `'table'` – kompaktní tabulka s řazením

### Oprávnění
```typescript
const canManage = isMasterAdmin || isAdmin || (currentMembership?.can_manage_tasks ?? false);
```

### Drag & Drop (v2.51.0)
- `@dnd-kit/core`: DndContext, DragOverlay, closestCorners, PointerSensor, useDroppable
- `@dnd-kit/sortable`: SortableContext, useSortable, arrayMove, horizontalListSortingStrategy, verticalListSortingStrategy
- **ID prefix**: sloupce mají ID `col-{id}`, droppable areas `droppable-{id}`, karty holé ID
- **dragType state**: `'card' | 'column' | null` – detekce v handleDragStart dle prefixu
- **handleDragEnd**:
  - `dragType === 'column'` → arrayMove sloupců + UPDATE sort_order v DB
  - `dragType === 'card'` → cross-column přesun (detekce `droppable-` prefixu nebo nalezení sloupce karty)
- **DroppableColumn** komponenta: obaluje SortableContext karet, registruje sloupec jako droppable cíl
- **SortableColumnWrapper** komponenta: obaluje sloupec, render prop předává drag listeners na záhlaví

### Dokončení úkolu (v2.51.0)
- Checkbox v SortableCard (Kanban), List view, Table view
- `is_completed` boolean na TaskItem
- Po zaškrtnutí: karta zesvětlí (opacity-50, text line-through)
- Lze opakovaně zapínat/vypínat
- `toggleComplete(task)`: toggle `is_completed` + volitelný auto-přesun dle nastavení boardu

### Nastavení nástěnky (v2.51.0)
- `settings: TaskBoardSettings` jako JSONB na boardu
- Modal s ikonou ozubeného kola:
  - **Auto-přesun dokončených**: select sloupce (nebo „Nepřesouvat")
  - **Barvy sloupců**: toggle + color pickery (6 barev) pro každý sloupec
- Kanban sloupec: `background: column_colors_enabled ? col.color + '0d' : 'var(--bg-hover)'`

### Editace/mazání sloupců (v2.51.0)
- Odstraněny barevné puntíky ze záhlaví sloupců
- Double-click na název → inline input pro přejmenování
- Ikona koše → smazání sloupce (s confirm dialogem)
- Hover reveal akce (opacity-0 group-hover:opacity-100)

### Detail panel (slide-in, 480px)
- Editovatelný název (kliknutí → input)
- Grid 2×2: Status (select sloupce), Priorita, Přiřazení, Deadline
- **Popis**: contentEditable div, min-h-[120px], rich text toolbar (B/I/U, odrážky, číslování) s `document.execCommand` + `onMouseDown={e => e.preventDefault()}`
- **Podúkoly**: checklist s progress barem + select přiřazení řešitele (assigned_to na subtask)
- Přílohy: upload do Supabase Storage bucket `trackino-task-attachments`, download přes signedUrl
- **Komentáře**: contentEditable div s mini toolbarem (B/I/U), dangerouslySetInnerHTML pro zobrazení
- Historie: collapsible, log změn
- **Klik mimo panel**: backdrop overlay (`onClick → setSelectedTask(null)`)

### Sdílení projektů (v2.51.0)
- Share modal (vzor z KB): 3 volby – Nesdílet / Celý workspace / Konkrétní uživatelé
- `is_shared = true` na boardu → viditelné jen sdíleným členům (+ admin/owner vždy vidí)
- `visibleBoards` useMemo: admin vidí vše, `!is_shared` viditelné všem, `is_shared` jen pro board members

### Filtrování
- `search` – fulltextové hledání v názvu a popisu
- `filterAssignee` – select člena workspace
- `filterPriority` – select priority
- `filterDeadline` – all, overdue, today, this_week, this_month, no_deadline
- `onlyMine` – toggle „Jen moje"
- `hideCompleted` – skryje dokončené úkoly (is_completed)

### Supabase Storage
- Bucket: `trackino-task-attachments` (private)
- Cesta souboru: `{workspace_id}/{uuid}.{ext}`
- Max velikost: 20 MB
- Signed URL pro stahování (60s)

### SQL migrace (v2.51.0 – nové tabulky a ALTER)
```sql
-- Nové sloupce na existujících tabulkách
ALTER TABLE trackino_task_items
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

ALTER TABLE trackino_task_boards
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

ALTER TABLE trackino_task_boards
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES trackino_task_folders(id) ON DELETE SET NULL;

ALTER TABLE trackino_task_boards
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6366f1';

ALTER TABLE trackino_task_boards
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE trackino_task_boards
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

ALTER TABLE trackino_task_subtasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- Nové tabulky
CREATE TABLE IF NOT EXISTS trackino_task_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  sort_order integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES trackino_task_folders(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_task_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_task_folders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS trackino_task_folder_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES trackino_task_folders(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  shared_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_task_folder_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_task_folder_shares
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS trackino_task_board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES trackino_task_boards(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (board_id, user_id)
);
ALTER TABLE trackino_task_board_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_task_board_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 35. Mapa souborů projektu (aktualizováno: 10. 3. 2026)

> **Účel:** Rychlý přehled – kde co hledat bez procházení stromu souborů.

### Vstupní body a layout

| Soubor | Co dělá |
|--------|---------|
| `src/app/layout.tsx` | Root layout – ThemeProvider, metadata |
| `src/app/page.tsx` | Root redirect (přesměruje na `/`) |
| `src/app/(auth)/login/page.tsx` | Přihlašovací stránka |
| `src/app/(auth)/register/page.tsx` | Registrační stránka |
| `src/app/invite/[token]/page.tsx` | Přijetí pozvánky do workspace |
| `src/app/kb/[slug]/[token]/page.tsx` | Veřejná KB stránka (bez auth) |

### Komponenty (src/components/)

| Soubor | Co dělá |
|--------|---------|
| `DashboardLayout.tsx` | Hlavní layout: header (TimerBar), Sidebar, systémové notifikace, auto-hide header na mobilu, bottom timer bar; obaluje children + oba TimerBar výskyty ErrorBoundary; prop `moduleName?` |
| `ErrorBoundary.tsx` | React class Error Boundary; props: `moduleName`, `fallback`, `timerFallback`; fallback karta s varováním; dev collapsible stack; TODO Sentry |
| `Sidebar.tsx` | **Orchestrátor** (po refaktoringu v2.51.33) – importuje subkomponenty z `sidebar/`, renderuje layout |
| `sidebar/types.ts` | Typy: `SidebarProps`, `NavItem`, `NavGroup`, `BadgeCounts` |
| `sidebar/icons.tsx` | `ICONS` objekt (40+ SVG ikon) + `StarIcon` + `RemoveIcon` |
| `sidebar/useSidebar.ts` | Custom hook – veškerý state, logika (navGroups, badge fetch, oblíbené, collapsedGroups) |
| `sidebar/SidebarHeader.tsx` | Logo, název workspace, tlačítka zavřít (mobil) a collapse (desktop) |
| `sidebar/SidebarNav.tsx` | Navigace – sekce OBLÍBENÉ, skupiny (SLEDOVÁNÍ/ANALÝZA/...), bottom items; renderNavItem, renderFavoriteItem |
| `sidebar/SidebarUserPanel.tsx` | User panel + workspace switcher + odhlášení |
| `TimerBar.tsx` | **Orchestrátor** (po refaktoringu v2.51.32) – importuje subkomponenty z `timer-bar/`, renderuje layout |
| `timer-bar/types.ts` | Typy: `PlayData`, `TimerBarProps` |
| `timer-bar/utils.ts` | Helper: `formatTime(seconds)` |
| `timer-bar/useTimerBar.ts` | Hlavní hook – veškerý state, logika (start/stop/discard, offline, midnight split, computed hodnoty) |
| `timer-bar/ProjectPicker.tsx` | Projekt picker – tlačítko + dropdown s hledáním a seskupením dle klienta |
| `timer-bar/CategoryTaskPicker.tsx` | Kategorie/úkol picker – tlačítko + dropdown se stromem kategorií/úkolů |
| `timer-bar/TimerControls.tsx` | Čas + start/stop/discard tlačítka + validační chyba + offline indikátor |
| `ManualTimeEntry.tsx` | Formulář pro ruční zadání time entry |
| `TimeEntryList.tsx` | Seznam time entries s editací/mazáním |
| `TagPicker.tsx` | Multi-select štítků (použito v TimerBar) |
| `ThemeProvider.tsx` | Dark/light mode přepínač |
| `WorkspaceSelector.tsx` | Přepínač workspace (použito v Sidebaru) |

### Kontexty a hooky (src/contexts/, src/hooks/)

| Soubor | Co dělá |
|--------|---------|
| `contexts/AuthContext.tsx` | Auth stav: user, profile (is_master_admin, timer_always_visible, ...), loading |
| `contexts/WorkspaceContext.tsx` | Workspace data: currentWorkspace, currentMembership, enabledModules, managerAssignments, isManagerOf() |
| `hooks/usePermissions.ts` | React hook – kombinuje AuthContext + WorkspaceContext → canAdmin, isManager, canManualEntry, canSeeTags atd. |

### Knihovny (src/lib/)

| Soubor | Co dělá |
|--------|---------|
| `supabase.ts` | Supabase klient (anon key, storageKey 'trackino-auth') |
| `supabase-admin.ts` | Supabase klient se service role (bypasuje RLS, pouze server-side) |
| `permissions.ts` | Čisté funkce: isMasterAdmin, isWorkspaceAdmin, isManager, canManualEntry, canEditTimeEntry, canAccessSettings atd. |
| `modules.ts` | ALL_MODULES, TARIFF_MODULES, computeEnabledModules() |
| `czech-calendar.ts` | getCzechHolidays(year) → { date: Date; name: string }[], isCzechHoliday() – 13 svátků vč. Velikonoc |
| `czech-namedays.ts` | getCzechNameday(monthDay), getCzechNamedayForDate(date) – 366 jmen |
| `midnight-split.ts` | splitAtMidnight(start, end) → pole segmentů (pro timer přes půlnoc) |
| `ai-providers.ts` | Konfigurace AI providerů (OpenAI + Gemini), AiModel[], DEFAULT_MODEL_ID |
| `rate-limit.ts` | Upstash Redis rate limitery: rateLimitRegister (3/hod), rateLimitAI (20/min), rateLimitFirecrawl (10/min) |
| `cron-handler.ts` | verifyCronSecret(), saveCronResult(), parseCronBody() – sdílené helpery pro cron routes |
| `utils.ts` | Obecné utility (nesouvisí s Kalendářem) |

### Typy (src/types/)

| Soubor | Co dělá |
|--------|---------|
| `database.ts` | VŠECHNY TypeScript typy pro DB tabulky (Profile, Workspace, TimeEntry, VacationEntry, TaskItem atd.) |

### API routes (src/app/api/)

| Soubor | Co dělá |
|--------|---------|
| `auth/register/route.ts` | POST – server-side registrace s rate limitem (max 3/hod./IP), volá Supabase signUp |
| `ai-chat/route.ts` | POST – streaming/non-streaming AI chat (OpenAI + Gemini), server-side API klíče, rate limit 20/min/IP |
| `cnb-rates/route.ts` | GET – kurzovní lístek ČNB s lazy DB cache (trackino_exchange_rates) |
| `cron-jobs/route.ts` | GET/PUT proxy pro cron-job.org API (seznam + vytvoření jobů) |
| `cron-jobs/[jobId]/route.ts` | GET/PATCH/DELETE proxy pro konkrétní job |
| `cron-jobs/[jobId]/history/route.ts` | GET – historie spuštění jobu |
| `cron/weekly-report/route.ts` | POST – týdenní AI report hodin |
| `cron/inactive-check/route.ts` | POST – kontrola neaktivních členů |
| `cron/kb-reviews-digest/route.ts` | POST – digest revizí KB |
| `cron/feedback-summary/route.ts` | POST – AI shrnutí připomínek |
| `cron/vacation-report/route.ts` | POST – report dovolených |
| `firecrawl/scrape/route.ts` | POST – scrape URL → Markdown (Firecrawl wrapper), rate limit 10/min/IP |
| `firecrawl/search/route.ts` | POST – webové vyhledávání (Firecrawl wrapper), rate limit 10/min/IP |
| `ics-proxy/route.ts` | GET – proxy pro ICS kalendářové odběry |
| `kb-public/route.ts` | GET – veřejná KB stránka přes token (bypasuje RLS) |

### Stránky (src/app/(dashboard)/) – přehled

| Cesta | Soubor | Modul/tarif |
|-------|--------|-------------|
| `/` | `page.tsx` (auth guard + WorkspaceProvider, ~55 ř.) + `_components/DashboardContent.tsx` (orchestrátor) + `_components/` (8 souborů: types.ts, utils.ts, useDashboard.ts, StatCard.tsx, GreetingCard.tsx, NotificationsPanel.tsx, WeekChart.tsx, MonthOverview.tsx) | Přehled – dashboard |
| `/tracker` | `tracker/page.tsx` | Time Tracker (Free+) |
| `/planner` | `planner/page.tsx` (auth guard) + `_components/PlannerContent.tsx` (orchestrátor) + `_components/` (10 souborů: types.ts, utils.ts, icons.tsx, CellFull.tsx, CellHalf.tsx, NoteInput.tsx, usePlanner.ts, StatusManager.tsx, PlannerTable.tsx, CellPicker.tsx) | Plánovač dostupnosti (Pro+) |
| `/calendar` | `calendar/page.tsx` → CalendarContent | Kalendář (Max) |
| `/vacation` | `vacation/page.tsx` (auth guard) + `_components/VacationContent.tsx` (orchestrátor) + `_components/` (9 souborů: types.ts, utils.ts, useVacation.ts, VacationStats.tsx, VacationForm.tsx, VacationRecordsTab.tsx, VacationRequestsTab.tsx, VacationArchiveTab.tsx, RejectModal.tsx) | Dovolená (Pro+) |
| `/invoices` | `invoices/page.tsx` (orchestrátor) + `types.ts`, `utils.ts`, `components/InvoiceRow.tsx`, `components/SubmitInvoiceForm.tsx`, `components/InvoiceFilters.tsx`, `components/ApproveModal.tsx`, `components/ReturnModal.tsx`, `components/DetailModal.tsx` | Fakturace (Pro+) |
| `/reports` | `reports/page.tsx` | Reporty (Free+) |
| `/attendance` | `attendance/page.tsx` | Přehled hodin (Pro+) |
| `/category-report` | `category-report/page.tsx` (auth guard ~20 ř.) + `_components/CategoryReportContent.tsx` (orchestrátor) + `_components/` (types.ts, utils.ts, useCategoryReport.ts, CategoryFilters.tsx, SummaryBar.tsx, CategoryPieChart.tsx, CategoryBarChart.tsx, CategoryTable.tsx) | Analýza kategorií – Recharts (Pro+) |
| `/subordinates` | `subordinates/page.tsx` | Přehled podřízených (Pro+) |
| `/notes` | `notes/page.tsx` | Manažerské poznámky (Pro+) |
| `/projects` | `projects/page.tsx` | Správa projektů (Free+) |
| `/clients` | `clients/page.tsx` | Správa klientů (Free+) |
| `/tags` | `tags/page.tsx` | Správa štítků (Free+) |
| `/team` | `team/page.tsx` (orchestrátor) + `_components/types.tsx`, `useTeam.ts`, `MembersTab.tsx`, `StructureTab.tsx`, `ManagersTab.tsx`, `EditMemberModal.tsx` | Správa týmu + sazby (Free+) |
| `/tasks` | `tasks/page.tsx` (orchestrátor) | Úkoly + Kanban (Pro+) – rozdělen na subsoubory od v2.51.21 |
| `/subscriptions` | `subscriptions/page.tsx` (auth guard) + `_components/SubscriptionsContent.tsx` (orchestrátor) + `_components/` (18 souborů: types, constants, utils, useSubscriptions, StarRating, StatsDashboard, SubsTabContent, CategoriesTabContent, AccessByServiceView, AccessByUserView, AccessSummaryView, AccessTabContent, DetailModal, SubFormModal, AccessModal, ExtUserModal, CatFormModal) | Evidence předplatných (Pro+) |
| `/domains` | `domains/page.tsx` (auth guard) + `_components/DomainsContent.tsx` (orchestrátor) + `_components/` (10 souborů: types.ts, constants.tsx, utils.ts, useDomains.ts, StatsDashboard.tsx, DomainsTabContent.tsx, RegistrarsTabContent.tsx, DomainFormModal.tsx, RegistrarFormModal.tsx, DomainDetailModal.tsx) | Evidence domén (Pro+) |
| `/important-days` | `important-days/page.tsx` | Důležité dny (Pro+) |
| `/requests` | `requests/page.tsx` | Žádosti zaměstnanců (Pro+) |
| `/feedback` | `feedback/page.tsx` | Anonymní připomínky (Pro+) |
| `/knowledge-base` | `knowledge-base/page.tsx` (orchestrátor) + `_components/types.ts`, `utils.ts`, `RichEditor.tsx`, `PageViewer.tsx`, `KbFolderTree.tsx`, `KbSidebar.tsx`, `KbWelcomeScreen.tsx`, `PageListView.tsx`, `KbModals.tsx`, `KbPageDetail.tsx` | Znalostní báze (Pro+) |
| `/documents` | `documents/page.tsx` | Dokumenty + Supabase Storage (Pro+) |
| `/company-rules` | `company-rules/page.tsx` | Firemní pravidla – rich text (Pro+) |
| `/office-rules` | `office-rules/page.tsx` | Pravidla v kanceláři – rich text (Pro+) |
| `/text-converter` | `text-converter/page.tsx` | Převodník textu (Pro+) |
| `/prompts` | `prompts/page.tsx` | Prompty – složky + rich editor (Pro+) |
| `/bookmarks` | `bookmarks/page.tsx` | Záložky – složky + favicon (Pro+) |
| `/ai-assistant` | `ai-assistant/page.tsx` (entry point) + `_components/AiAssistantContent.tsx` (orchestrátor) + `_components/` (10 souborů: useAiAssistant, types, utils, constants, ConversationSidebar, ChatMessages, ChatInput, FavoritePromptsPanel, ModelInfoPanel) | AI asistent – OpenAI + Gemini (Max) |
| `/settings` | `settings/page.tsx` | Nastavení workspace – 8 záložek (Pro+) |
| `/audit` | `audit/page.tsx` | Audit log (Max) |
| `/team` | `team/page.tsx` | Tým – role, sazby, toggles |
| `/profile` | `profile/page.tsx` | Profil uživatele |
| `/admin` | `admin/page.tsx` | Master admin panel |
| `/app-settings` | `app-settings/page.tsx` | Nastavení modulů dle tarifu (admin) |
| `/app-changes` | `app-changes/page.tsx` (entry point) + `_components/AppChangesContent.tsx` (orchestrátor) + `_components/` (5 souborů: types.ts, utils.ts, useAppChanges.ts, AppChangeFormModal.tsx, AppChangeItem.tsx) | Úpravy aplikace |
| `/bugs` | `bugs/page.tsx` (auth guard ~20 ř.) + `_components/BugsContent.tsx` (orchestrátor) + `_components/` (types.ts, ui.tsx, useBugs.ts, BugCard.tsx) | Hlášení chyb |
| `/changelog` | `changelog/page.tsx` | Changelog verzí |
| `/help` | `help/page.tsx` | Nápověda |
| `/notebook` | `notebook/page.tsx` | Notebook |
| `/dashboard` | `dashboard/page.tsx` | Redirect na `/` |

### Kalendář – modul (src/app/(dashboard)/calendar/)

Modul je rozdělen do ~32 souborů. `page.tsx` je entry point (25 ř.), orchestrátor je `CalendarContent.tsx`.

#### Sdílené typy a utility

| Soubor | Co dělá |
|--------|---------|
| `CalendarContext.tsx` | CalendarContextValue interface + createContext + useCalendarContext() |
| `types.ts` | Lokální typy: DisplayEvent, ViewType, SharedCalendarInfo, MemberWithProfile, BirthdayMember, EventNote, OrphanNote, TaskItem |
| `utils.ts` | toDateStr, parseDate, addDays, getMonday, isSameDay, formatMonthYear, formatWeekRange, DAY_NAMES_SHORT, MONTH_NAMES, DEFAULT_COLORS, ROW_H=60, eventOnDay, sourceBadgeLabel, parseICS, linkifyHtml, stripHtmlToText |
| `recurrenceUtils.ts` | expandRecurringEvent, getImportantDayOccurrences, getRecurrenceLabel, RECURRENCE_OPTIONS (14 typů) |
| `layoutUtils.ts` | Utility pro layout eventů v časové mřížce (výpočet přesahů) |

#### Hooky

| Soubor | Co dělá | Vrací |
|--------|---------|-------|
| `hooks/useCalendarState.ts` | VEŠKERÝ useState + useRef + základní efekty (scroll, hodiny, localStorage, ICS load) | ~80 state proměnných + setterů + refs |
| `hooks/useCalendarData.ts` | Fetch funkce: fetchData, fetchSubscriptions (vrací data, nevolá setSubscriptions!), fetchWorkspaceMembers, fetchBirthdayMembers, fetchCalendarShares, fetchSharedWithMe, fetchSharedEvents, fetchAttendees, fetchAttendeeEvents | Výše uvedené funkce |
| `hooks/useCalendarCrud.ts` | CRUD: openNewEvent, openEditEvent, saveEvent, respondToAttendance, deleteEvent, openShareModal, saveShare, updateSharePref, openNewCalendar, openEditCalendar, saveCalendar, deleteCalendar | Výše uvedené funkce |
| `hooks/useCalendarNotes.ts` | Poznámky k událostem: fetchNotesBatch, handleNoteSave, handleNoteDelete, fetchOrphanNotes, deleteOrphanNote | Výše uvedené funkce |
| `hooks/useCalendarSubscriptions.ts` | ICS odběry + řazení: openNewSub, openEditSub, saveSubscription, deleteSubscription, toggleSubscription, sortedSubscriptions, moveSubscription | Výše uvedené + sortedSubscriptions |

#### Komponenty (components/)

| Soubor | Co dělá |
|--------|---------|
| `CalendarContent.tsx` | **Orchestrátor** (680 ř.) – zapojuje všechny hooky, počítá displayEvents/visibleRange/..., sestavuje ctxValue, renderuje layout |
| `CalendarHeader.tsx` | Záhlaví: název, navigace (prev/today/next), přepínač pohledů, tlačítko Pozvánky, tlačítko Přidat událost |
| `InvitationsPanel.tsx` | Panel pozvánek – záložky (Vše/Čeká/Přijato/...), vyhledávání, RSVP tlačítka; vrací null pokud !showInvitationsPanel |
| `CalendarSidebar.tsx` | Fragment: mobilní toggle button + levý panel (md:w-56) s CalendarSidebarCalendars + CalendarSidebarOther + mini kalendář |
| `CalendarSidebarCalendars.tsx` | Levý panel – sekce Mé kalendáře, Sdílené kalendáře, Ext. odběry (ICS) |
| `CalendarSidebarOther.tsx` | Levý panel – sekce Automaticky (Dovolená, Důl. dny), Další kalendáře (Svátky, Jmeniny, Narozeniny) |
| `EventPill.tsx` | Barevná pilulka události (slouží jako prop `onEventClick: (ev) => void`!) – zobrazuje opakování SVG, pending border, decline opacity |
| `NotePanel.tsx` | Editor poznámek k události – contenteditable, toolbar B/I/U/..., checklist, URL linking, meta flagy |
| `MonthView.tsx` | Měsíční mřížka (78 ř.) |
| `WeekView.tsx` | Týdenní pohled s časovou osou, ROW_H=60, all-day strip, overlapping events |
| `ThreeDaysView.tsx` | 3-sloupcový pohled (předchozí/dnešek/další den) |
| `TodayView.tsx` | Denní pohled s časovou osou |
| `YearView.tsx` | Roční přehled – 12 mini-mřížek |
| `ListView.tsx` | Chronologický seznam po měsících, poznámky v pravém panelu, načítání starších událostí |
| `EventFormModal.tsx` | Formulář pro vytvoření/editaci události (419 ř.) |
| `EventDetailModal.tsx` | Detail modal – preview vlastních/sdílených/účastnických událostí (301 ř.) |
| `RsvpModal.tsx` | RSVP modal – přijmout/odmítnout/nezávazně |
| `CalendarFormModal.tsx` | Formulář pro vytvoření/editaci kalendáře |
| `ShareModal.tsx` | Modal sdílení kalendáře nebo ICS odběru |
| `IcsSubscriptionModal.tsx` | Formulář pro přidání/editaci ICS odběru (URL, název, barva) |
| `CalSettingsModal.tsx` | Nastavení zobrazení – rozsah hodin (calViewStart/calViewEnd) |

#### Důležité detaily implementace

- `fetchSubscriptions` v `useCalendarData` vrací data ale NEVOLÁ `setSubscriptions` – CalendarContent.tsx obsahuje wrapper
- `useCalendarNotes` musí být volán AŽ PO výpočtu `displayEvents` (hook call order)
- `EventPill` vyžaduje povinný prop `onEventClick: (ev: DisplayEvent) => void`
- `CalendarSidebar` obsahuje OBOJÍ: mobilní toggle I levý panel (Fragment, ne div)
- `ROW_H = 60` px/hodina (definováno v `utils.ts`, exportováno)

---

## 36. Supabase RLS – architektura workspace izolace (v2.51.19)

### Výchozí stav před auditem
Všechny tabulky měly jedinou politiku `"Auth full" FOR ALL TO authenticated USING (true) WITH CHECK (true)` – nulová workspace izolace na DB vrstvě. Jakýkoliv autentizovaný uživatel mohl číst/zapisovat data libovolného workspace přímým API voláním.

### Dvě SECURITY DEFINER helper funkce

```sql
-- Ověřuje is_master_admin na profilu (bypasuje RLS aby nedošlo k circular dependency)
CREATE OR REPLACE FUNCTION trackino_is_master_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_master_admin FROM trackino_profiles WHERE id = auth.uid()), false);
$$;

-- Vrací workspace UUIDs, kde je uživatel schválený člen (approved = true)
-- SECURITY DEFINER je nutný – tato funkce sama čte trackino_workspace_members,
-- jehož RLS by jinak způsobilo circular dependency
CREATE OR REPLACE FUNCTION trackino_user_workspaces()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM trackino_workspace_members
  WHERE user_id = auth.uid() AND approved = true;
$$;
```

### Vzory politik

**Standardní tabulka s workspace_id:**
```sql
CREATE POLICY "<name>_all" ON <table> FOR ALL TO authenticated
  USING  (workspace_id IN (SELECT trackino_user_workspaces()) OR trackino_is_master_admin())
  WITH CHECK (workspace_id IN (SELECT trackino_user_workspaces()) OR trackino_is_master_admin());
```

**Child tabulka BEZ workspace_id (chain přes parent):**
```sql
CREATE POLICY "<name>_all" ON <child_table> FOR ALL TO authenticated
  USING (
    <parent_fk_col> IN (
      SELECT id FROM <parent_table>
      WHERE workspace_id IN (SELECT trackino_user_workspaces())
    ) OR trackino_is_master_admin()
  ) WITH CHECK (...stejné...);
```

**AI konverzace (workspace_id + user_id – soukromé):**
```sql
USING (
  (workspace_id IN (SELECT trackino_user_workspaces()) AND user_id = auth.uid())
  OR trackino_is_master_admin()
)
```

**exchange_rates (globální cache bez workspace_id):**
- `SELECT`: všichni authenticated (USING true)
- `INSERT/UPDATE/DELETE`: pouze Master Admin (service_role API routes obchází RLS automaticky)

### Speciální případy
| Tabulka | Vzor |
|---------|------|
| `trackino_task_columns` | chain → `trackino_task_boards.workspace_id` |
| `trackino_task_subtasks`, `_comments`, `_attachments`, `_history` | chain → `trackino_task_items.workspace_id` |
| `trackino_ai_messages` | chain → `trackino_ai_conversations` (workspace_id + user_id) |
| `trackino_exchange_rates` | globální – SELECT všichni, WRITE jen master admin |
| `trackino_system_notifications` | globální – není workspace_id; READ všichni, WRITE jen master admin |
| `trackino_app_changes` | workspace_id → standardní vzor |

### Cross-workspace Úkoly – záměrné chování
`workspace_id IN (SELECT trackino_user_workspaces())` automaticky vrátí záznamy ze VŠECH workspace, kde je user schválený člen → pohled „Moje úkoly" napříč workspace funguje bez nutnosti obcházet izolaci. Toto je požadované chování.

### Cross-workspace pohled (v2.51.20) – architektura

**State proměnné (prefix `cws`):**
- `crossWsMode: boolean` – přepínač pro cross-ws pohled
- `userWorkspaces: UserWorkspace[]` – seznam všech workspace uživatele
- `cwsTasks: TaskItem[]` – úkoly ze všech workspace
- `cwsBoardsMap: Map<string, CwsBoardInfo>` – board_id → {id, name, workspace_id, color}
- `cwsColsMap: Map<string, CwsColumnInfo>` – column_id → {id, name, board_id, sort_order}
- `cwsAllMembers: Map<string, Member>` – user_id → profil pro zobrazení jmen
- `cwsTab: string` – 'all' nebo workspace_id pro filtr záložky
- `cwsSearch, cwsSortBy, cwsHideCompleted` – filtry
- `cwsFilterPriority, cwsFilterDeadline, cwsFilterBoard, cwsFilterAssignee` – rozšířené filtry
- `showCwsFilters: boolean` – toggle pro panel filtrů

**Interfaces:**
```typescript
interface UserWorkspace { id: string; name: string; color?: string | null; }
interface CwsBoardInfo { id: string; name: string; workspace_id: string; color?: string | null; }
interface CwsColumnInfo { id: string; name: string; board_id: string; sort_order: number; }
```

**Barvy workspace:**
```typescript
const WORKSPACE_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const getWsColor = (wsId: string, ws?: UserWorkspace) => ws?.color ?? WORKSPACE_COLORS[parseInt(wsId.slice(0,8), 16) % WORKSPACE_COLORS.length];
```

**fetchCrossWsData():**
1. Fetch `trackino_workspace_members` pro current user → unikátní workspace_id listA
2. Fetch `trackino_workspaces` WHERE id IN listA → userWorkspaces
3. Fetch `trackino_task_boards` WHERE workspace_id IN listA → cwsBoardsMap
4. Fetch `trackino_task_columns` WHERE board_id IN [board IDs]
5. Fetch `trackino_task_items` WHERE workspace_id IN listA ORDER BY updated_at DESC, LIMIT 500
6. Fetch `trackino_profiles` pro všechny assigned_to unikátní user_ids

**Komponenty v UI (crossWsMode):**
- Záložky workspace (Vše + per-ws) nad tabulkou
- Tabulka: 7 sloupců, kliknutím na řádek → `openDetail(task)` (existující funkce)
- Filtry: priorita, termín (overdue/today/week/month/no_deadline), board, assignee, search, hide-completed
- Modal Nový úkol: cascade ws → board → col → form fields

**Detail panel v crossWsMode:**
- `breadcrumb`: ws.name / board.name / col.name (z cwsBoardsMap, cwsColsMap, userWorkspaces)
- `maxWidth`: vždy 'normal' preset (520px) když crossWsMode (activeBoard může být null)

### Kdo je `approved = true`
- `trackino_workspace_members.approved` – člen, jehož pozvánka byla přijata a admin ho schválil
- Neschválení čekatelé (`approved = false`) nemohou vidět žádná workspace data ani přes přímé API volání

### Idempotentnost SQL migrace
Migrace používá `DROP POLICY IF EXISTS` + `CREATE POLICY` – lze spustit opakovaně bez chyb nebo duplicit. Funkce jsou `CREATE OR REPLACE` – bezpečné i při opakovaném spuštění.

---

*Soubor spravuje Claude. Aktualizuj při každé větší změně architektury nebo přidání nových funkcí.*

*Soubor spravuje Claude. Aktualizuj při každé větší změně architektury nebo přidání nových funkcí.*
