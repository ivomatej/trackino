import type { TrackingRequest, Profile, RequestType } from '@/types/database';

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface RequestWithProfile extends TrackingRequest {
  profile?: Profile;
  reviewerProfile?: Profile;
}

export type ActiveTab = 'mine' | 'pending' | 'archive';

// ─── Konstanty ───────────────────────────────────────────────────────────────

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  hardware:    'Hardware a zařízení',
  software:    'Software a licence',
  access:      'Přístupy a oprávnění',
  office:      'Pracovní prostor a vybavení',
  financial:   'Finanční žádosti',
  hr:          'HR a personální žádosti',
  education:   'Vzdělávání a rozvoj',
  travel:      'Cestování a služební cesty',
  benefits:    'Benefity a odměňování',
  recruitment: 'Nábor a posílení týmu',
  security:    'Bezpečnost a compliance',
  it_support:  'Technická podpora a IT servis',
  legal:       'Právní a administrativní',
};

export const REQUEST_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'hardware',    label: 'Hardware a zařízení' },
  { value: 'software',    label: 'Software a licence' },
  { value: 'access',      label: 'Přístupy a oprávnění' },
  { value: 'office',      label: 'Pracovní prostor a vybavení' },
  { value: 'financial',   label: 'Finanční žádosti' },
  { value: 'hr',          label: 'HR a personální žádosti' },
  { value: 'education',   label: 'Vzdělávání a rozvoj' },
  { value: 'travel',      label: 'Cestování a služební cesty' },
  { value: 'benefits',    label: 'Benefity a odměňování' },
  { value: 'recruitment', label: 'Nábor a posílení týmu' },
  { value: 'security',    label: 'Bezpečnost a compliance' },
  { value: 'it_support',  label: 'Technická podpora a IT servis' },
  { value: 'legal',       label: 'Právní a administrativní' },
];

// ─── Průvodce kategoriemi ──────────────────────────────────────────────────

export const CATEGORY_GUIDE: { title: string; desc: string }[] = [
  { title: 'Hardware a zařízení', desc: 'Počítače, monitory, klávesnice, myši, telefony, tablety, tiskárny, headset, webkamery, externí disky, UPS záložní zdroje, ergonomické vybavení (podložky, stojany na monitor).' },
  { title: 'Software a licence', desc: 'Nové aplikace, rozšíření stávajících licencí, upgrady verzí, přístupy k SaaS nástrojům (Notion, Asana, Adobe, AI nástroje…), vývojářské nástroje, antivirus.' },
  { title: 'Přístupy a oprávnění', desc: 'Přístup do systémů, sdílených složek, databází, adminská práva, VPN, přístupy k externím službám a API, zrušení přístupů při odchodu.' },
  { title: 'Pracovní prostor a vybavení kanceláře', desc: 'Kancelářský nábytek, stůl/křeslo, kuchyňské vybavení, úprava pracovního místa, klimatizace/topení, parkovací místo.' },
  { title: 'Finanční žádosti', desc: 'Proplacení výdajů (cestovné, ubytování, nákupy), zálohy na akce nebo projekty, navýšení rozpočtu projektu, nákupy nad rámec běžného schválení.' },
  { title: 'HR a personální žádosti', desc: 'Změna pracovní doby nebo úvazku, práce z domova (home office), dovolená nad rámec standardu, studijní volno, osobní volno, přestup na jinou pozici, žádost o přidání člověka do týmu.' },
  { title: 'Vzdělávání a rozvoj', desc: 'Kurzy, školení, certifikace, konference, knihy a vzdělávací materiály, mentoring, jazykové kurzy.' },
  { title: 'Cestování a služební cesty', desc: 'Schválení služební cesty, letenky, ubytování, pronájem auta, denní diety, žádost o firemní kartu.' },
  { title: 'Benefity a odměňování', desc: 'Žádost o benefit (Multisport, stravenky, penzijní příspěvek…), změna benefitů, mimořádná odměna/bonus, žádost o navýšení mzdy.' },
  { title: 'Nábor a posílení týmu', desc: 'Žádost o nového zaměstnance nebo externisty, rozšíření kapacity týmu, schválení spolupráce s agenturou nebo freelancerem.' },
  { title: 'Bezpečnost a compliance', desc: 'Hlášení bezpečnostního incidentu, žádost o bezpečnostní audit, změna přístupových hesel systémů, GDPR žádosti.' },
  { title: 'Technická podpora a IT servis', desc: 'Oprava nebo výměna zařízení, servisní zásah, obnova dat, pomoc s nastavením systému.' },
  { title: 'Právní a administrativní', desc: 'Žádost o potvrzení zaměstnání, výplatní páska, pracovní smlouva, souhlas s vedlejší výdělečnou činností.' },
];
