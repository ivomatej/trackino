// Trackino – definice modulů a oprávnění dle tarifu

import type { ModuleId, Tariff } from '@/types/database';

/** Všechny dostupné moduly s metadaty */
export const ALL_MODULES: { id: ModuleId; label: string; description: string; group: string }[] = [
  { id: 'time_tracker',    label: 'Měřič',             description: 'Záznam a správa odpracovaných hodin',   group: 'Sledování' },
  { id: 'planner',         label: 'Plánovač',           description: 'Týdenní plánování dostupnosti členů',   group: 'Sledování' },
  { id: 'vacation',        label: 'Dovolená',           description: 'Evidence a správa čerpání dovolené',    group: 'Sledování' },
  { id: 'invoices',        label: 'Fakturace',          description: 'Vystavování a správa faktur',           group: 'Sledování' },
  { id: 'reports',         label: 'Reporty',            description: 'Přehledy odpracovaných hodin',          group: 'Analýza' },
  { id: 'attendance',      label: 'Přehled hodin',      description: 'Týdenní mřížka odpracovaných hodin',    group: 'Analýza' },
  { id: 'category_report', label: 'Analýza kategorií',  description: 'Přehled hodin rozdělený dle kategorií', group: 'Analýza' },
  { id: 'subordinates',    label: 'Podřízení',          description: 'Správa záznamů podřízených pracovníků', group: 'Analýza' },
  { id: 'notes',           label: 'Poznámky manažera',  description: 'Manažerské poznámky k záznamům',       group: 'Analýza' },
  { id: 'projects',        label: 'Projekty',           description: 'Správa projektů',                      group: 'Správa' },
  { id: 'clients',         label: 'Klienti',            description: 'Správa klientů',                       group: 'Správa' },
  { id: 'tags',            label: 'Štítky',             description: 'Správa štítků pro záznamy',            group: 'Správa' },
  { id: 'team',            label: 'Tým',                description: 'Správa členů týmu',                    group: 'Správa' },
  { id: 'settings',        label: 'Nastavení',          description: 'Nastavení workspace (jen admin)',       group: 'Správa' },
  { id: 'audit',           label: 'Audit log',          description: 'Protokol změn v systému',              group: 'Správa' },
  { id: 'notebook',        label: 'Poznámky',            description: 'Osobní poznámky se složkami, checklisty a sdílením', group: 'Nástroje' },
  { id: 'text_converter',  label: 'Převodník textu',    description: 'Převod formátovaného textu na prostý text nebo Markdown', group: 'Nástroje' },
  { id: 'bookmarks',      label: 'Záložky',             description: 'Sdílené i soukromé záložky webových odkazů se složkami a hodnocením', group: 'Nástroje' },
  { id: 'ai_assistant',   label: 'AI asistent',         description: 'Chatovací okno napojené na AI modely (OpenAI GPT a další)', group: 'Nástroje' },
  { id: 'automation',    label: 'Automatizace',        description: 'Naplánované úlohy a integrace s cron-job.org',              group: 'Správa' },
  { id: 'prompts',        label: 'Prompty',             description: 'Sdílené i soukromé záznamy AI promptů se složkami a hodnocením', group: 'Nástroje' },
  { id: 'calendar',       label: 'Kalendář',            description: 'Osobní a sdílený kalendář s přehledem událostí, dovolené a důležitých dnů', group: 'Sledování' },
  { id: 'important_days', label: 'Důležité dny',       description: 'Evidence osobních důležitých dnů a opakujících se událostí', group: 'Sledování' },
  { id: 'requests',       label: 'Žádosti',             description: 'Podávání a schvalování žádostí (dovolená, software, pracovní cesta aj.)', group: 'Sledování' },
  { id: 'feedback',       label: 'Připomínky',          description: 'Anonymní formulář pro zpětnou vazbu od členů týmu', group: 'Společnost' },
  { id: 'knowledge_base', label: 'Znalostní báze',      description: 'Interní wiki a znalostní databáze týmu',           group: 'Společnost' },
  { id: 'documents',      label: 'Dokumenty',           description: 'Správa firemních dokumentů a souborů',             group: 'Společnost' },
  { id: 'company_rules',  label: 'Firemní pravidla',    description: 'Textová stránka s firemními pravidly a směrnicemi', group: 'Společnost' },
  { id: 'office_rules',   label: 'Pravidla v kanceláři', description: 'Textová stránka s pravidly provozu kanceláře',    group: 'Společnost' },
  { id: 'subscriptions', label: 'Předplatná',           description: 'Evidence a správa firemních předplatných a SaaS služeb', group: 'Nástroje' },
  { id: 'domains',       label: 'Evidence domén',        description: 'Evidence a správa firemních domén',                      group: 'Nástroje' },
  { id: 'tasks',         label: 'Úkoly',                 description: 'Správa úkolů a kanban nástěnka pro tým',                   group: 'Správa' },
];

/**
 * Výchozí (fallback) moduly dle tarifu – používají se pokud DB tariff config není nastaven.
 * Dashboard je vždy dostupný (není modul).
 */
export const TARIFF_MODULES: Record<Tariff, ModuleId[]> = {
  free: [
    'time_tracker',
    'reports',
    'projects',
    'clients',
    'tags',
    'team',
  ],
  pro: [
    'time_tracker',
    'planner',
    'vacation',
    'invoices',
    'reports',
    'attendance',
    'category_report',
    'subordinates',
    'notes',
    'projects',
    'clients',
    'tags',
    'team',
    'settings',
    'text_converter',
    'important_days',
    'requests',
    'feedback',
    'knowledge_base',
    'documents',
    'company_rules',
    'office_rules',
    'prompts',
    'bookmarks',
    'notebook',
    'subscriptions',
    'domains',
    'tasks',
  ],
  max: [
    'time_tracker',
    'planner',
    'calendar',
    'vacation',
    'invoices',
    'reports',
    'attendance',
    'category_report',
    'subordinates',
    'notes',
    'projects',
    'clients',
    'tags',
    'team',
    'settings',
    'audit',
    'text_converter',
    'important_days',
    'requests',
    'feedback',
    'knowledge_base',
    'documents',
    'company_rules',
    'office_rules',
    'prompts',
    'bookmarks',
    'notebook',
    'ai_assistant',
    'automation',
    'subscriptions',
    'domains',
    'tasks',
  ],
};

/**
 * Tariff config z DB: map "tariff:module_id" -> enabled.
 * Pokud je prázdná (size === 0), použijí se hardcoded TARIFF_MODULES.
 */
export type TariffConfigMap = Map<string, boolean>;

/**
 * Vypočítá sadu povolených modulů pro uživatele.
 * @param tariff         tarif workspace
 * @param overrides      pole override záznamů z DB pro tohoto uživatele
 * @param tariffConfig   tariff config z DB (pokud prázdná, použijí se hardcoded defaults)
 *
 * Logika:
 * - Základ je vždy hardcoded TARIFF_MODULES (zajišťuje, že nové moduly přidané do kódu
 *   jsou automaticky dostupné bez nutnosti updatovat DB konfiguraci).
 * - Pokud existuje DB tariff config, aplikují se POUZE explicitně nastavené záznamy
 *   (true = přidat, false = odebrat). Moduly bez záznamu v DB zůstávají dle hardcoded defaults.
 * - Nakonec se aplikují per-user overrides.
 */
export function computeEnabledModules(
  tariff: Tariff,
  overrides: { module_id: ModuleId; enabled: boolean }[],
  tariffConfig?: TariffConfigMap
): Set<ModuleId> {
  // Vždy začni s hardcoded defaults jako základem
  const base = new Set<ModuleId>(TARIFF_MODULES[tariff] ?? TARIFF_MODULES.free);

  if (tariffConfig && tariffConfig.size > 0) {
    // Aplikuj explicitní DB nastavení – jen pro moduly, které mají záznam v DB
    for (const mod of ALL_MODULES) {
      const key = `${tariff}:${mod.id}`;
      if (tariffConfig.has(key)) {
        if (tariffConfig.get(key) === true) {
          base.add(mod.id);
        } else {
          base.delete(mod.id);
        }
      }
      // Moduly bez záznamu v DB zůstávají dle hardcoded defaults (výše)
    }
  }

  for (const o of overrides) {
    if (o.enabled) {
      base.add(o.module_id);
    } else {
      base.delete(o.module_id);
    }
  }

  return base;
}
