// Trackino – definice modulů a oprávnění dle tarifu

import type { ModuleId, Tariff } from '@/types/database';

/** Všechny dostupné moduly s metadaty */
export const ALL_MODULES: { id: ModuleId; label: string; description: string; group: string }[] = [
  { id: 'time_tracker',    label: 'Time Tracker',      description: 'Záznam a správa odpracovaných hodin',   group: 'Sledování' },
  { id: 'planner',         label: 'Plánovač',           description: 'Týdenní plánování dostupnosti členů',   group: 'Sledování' },
  { id: 'vacation',        label: 'Dovolená',           description: 'Evidence a správa čerpání dovolené',    group: 'Sledování' },
  { id: 'invoices',        label: 'Fakturace',          description: 'Vystavování a správa faktur',           group: 'Sledování' },
  { id: 'reports',         label: 'Reporty',            description: 'Přehledy odpracovaných hodin',          group: 'Analýza' },
  { id: 'attendance',      label: 'Přehled hodin',      description: 'Týdenní mřížka odpracovaných hodin',    group: 'Analýza' },
  { id: 'category_report', label: 'Analýza kategorií',  description: 'Přehled hodin rozdělený dle kategorií', group: 'Analýza' },
  { id: 'subordinates',    label: 'Podřízení',          description: 'Správa záznamů podřízených pracovníků', group: 'Analýza' },
  { id: 'notes',           label: 'Poznámky',           description: 'Manažerské poznámky k záznamům',       group: 'Analýza' },
  { id: 'projects',        label: 'Projekty',           description: 'Správa projektů',                      group: 'Správa' },
  { id: 'clients',         label: 'Klienti',            description: 'Správa klientů',                       group: 'Správa' },
  { id: 'tags',            label: 'Štítky',             description: 'Správa štítků pro záznamy',            group: 'Správa' },
  { id: 'team',            label: 'Tým',                description: 'Správa členů týmu',                    group: 'Správa' },
  { id: 'settings',        label: 'Nastavení',          description: 'Nastavení workspace (jen admin)',       group: 'Správa' },
  { id: 'audit',           label: 'Audit log',          description: 'Protokol změn v systému',              group: 'Správa' },
  { id: 'text_converter',  label: 'Převodník textu',    description: 'Převod formátovaného textu na prostý text nebo Markdown', group: 'Nástroje' },
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
  ],
  max: [
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
    'audit',
    'text_converter',
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
 */
export function computeEnabledModules(
  tariff: Tariff,
  overrides: { module_id: ModuleId; enabled: boolean }[],
  tariffConfig?: TariffConfigMap
): Set<ModuleId> {
  let base: Set<ModuleId>;

  if (tariffConfig && tariffConfig.size > 0) {
    // Použij DB tariff config
    base = new Set<ModuleId>();
    for (const mod of ALL_MODULES) {
      const key = `${tariff}:${mod.id}`;
      if (tariffConfig.get(key) === true) {
        base.add(mod.id);
      }
    }
  } else {
    // Fallback na hardcoded defaults
    base = new Set<ModuleId>(TARIFF_MODULES[tariff] ?? TARIFF_MODULES.free);
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
