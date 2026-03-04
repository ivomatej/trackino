'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const DEFAULT_HELP_CONTENT = `
<h2>Vítejte v Trackinu</h2>
<p>Trackino je moderní aplikace pro sledování pracovního času, inspirovaná nástroji jako Toggl a Clockify.</p>

<h3>Základní funkce</h3>
<ul>
  <li><strong>Dashboard</strong> – úvodní přehledová stránka s personalizovaným pozdravem, souhrnem výdělku, odpracovaných hodin, zbývajících dní a svátků pro aktuální měsíc</li>
  <li><strong>Time Tracker</strong> – spouštějte a zastavujte timer pro sledování odpracovaného času; po výběru projektu a kategorie/úkolu se zobrazuje čitelný breadcrumb místo ikonek; každý záznam má tlačítko ▶ pro opětovné spuštění se stejnými údaji (projekt, kategorie, štítky); u každého záznamu se zobrazuje také přiřazená kategorie a úkol (světle šedě vpravo od projektu)</li>
  <li><strong>Projekty</strong> – organizujte záznamy do projektů a přiřazujte klienty; seznam projektů lze prohledávat pomocí vyhledávacího pole nad seznamem</li>
  <li><strong>Klienti</strong> – spravujte klienty a propojujte je s projekty; seznam klientů lze filtrovat vyhledávacím polem</li>
  <li><strong>Štítky</strong> – označujte záznamy štítky pro lepší kategorizaci</li>
  <li><strong>Reporty</strong> – analyzujte odpracovaný čas (včetně výdělku dle hodinové sazby) a přidávejte záznamy ručně</li>
  <li><strong>Podřízení</strong> – Team Manažeři a Admini vidí záznamy podřízených; dostupné filtry: Dnes / Týden / Vlastní období</li>
  <li><strong>Dovolená</strong> – evidence termínů dovolené s automatickým výpočtem pracovních dnů a přehledem zbývajícího nároku</li>
  <li><strong>Fakturace</strong> – fakturace odvedené práce: podání žádosti, schvalování manažerem, proplacení správcem fakturace</li>
  <li><strong>Tým</strong> – spravujte členy workspace, přidávejte je kódem, nastavujte manažery a oprávnění fakturace; e-mail a telefon každého člena lze rychle zkopírovat kliknutím na ikonku vedle kontaktu; seznam členů lze vyhledávat podle jména nebo e-mailu</li>
  <li><strong>Přehled hodin</strong> – týdenní mřížka odpracovaných hodin pro celý tým; navigace mezi týdny, řazení řádků šipkami, součet za den i za týden</li>
  <li><strong>Analýza kategorií</strong> – přehled odpracovaného času rozdělený po kategoriích za vybrané období; koláčový graf, sloupcový graf a detailní tabulka s podíly</li>
  <li><strong>Detailní nastavení</strong> – osobní profil: jméno, e-mail, telefon, pozice (nastavuje admin) a barevný režim; dostupné přes rozbalovací panel uživatele v levém dolním rohu sidebaru</li>
</ul>

<h3>Dashboard</h3>
<p>Po přihlášení se zobrazí Dashboard s klíčovými informacemi pro aktuální měsíc:</p>
<ul>
  <li><strong>Výdělek</strong> – součet hodin × hodinová sazba za aktuální měsíc (zobrazuje se pouze pokud máte nastavenou sazbu)</li>
  <li><strong>Odpracováno</strong> – celkový čas zaznamenaný v tomto měsíci</li>
  <li><strong>Zbývá dní</strong> – kalendářní dny do konce měsíce</li>
  <li><strong>Pracovní dny</strong> – zbývající pracovní dny (pondělí–pátek bez svátků)</li>
  <li><strong>Přehled měsíce</strong> – progress bar, počty dní, státní svátky ČR</li>
  <li><strong>Dnešní svátek</strong> – kdo dnes slaví svátek dle českého kalendáře</li>
</ul>

<h3>Výběr projektu a kategorie v Time Trackeru</h3>
<p>Kliknutím na ikonu projektu otevřete picker projektů – při najetí myší se zobrazí tooltip „Klient · Projekt". Kliknutím na ikonu seznamu otevřete picker kategorie/úkolu – tooltip zobrazuje „Kategorie · Úkol".</p>

<h3>Přepínání workspace</h3>
<p>Pokud máte přístup do více workspace, zobrazuje se v pravém rohu horní lišty přepínač. Kliknutím na něj vyberete jiný workspace bez nutnosti odhlásit se.</p>

<h3>Role v systému</h3>
<ul>
  <li><strong>Master Admin</strong> – správce celé platformy, může spravovat workspace</li>
  <li><strong>Admin / Owner</strong> – správce workspace, přístup k nastavení a správě týmu; vidí záznamy a dovolenou všech</li>
  <li><strong>Team Manager</strong> – správce podřízených, vidí a edituje jejich záznamy, přidává poznámky; vidí dovolenou svých podřízených</li>
  <li><strong>Member</strong> – běžný uživatel, sleduje čas timerem; spravuje svoji dovolenou (pokud má nastaven nárok)</li>
</ul>

<h3>Dovolená</h3>
<p>Stránka <strong>Dovolená</strong> (v sekci Sledování) je dostupná uživatelům s příznakem „Může čerpat dovolenou" (nastavuje admin v Tým → editace člena). Záznamy se přidávají zadáním začátku a konce dovolené – počet pracovních dnů (pondělí–pátek) se vypočítá automaticky. Přehled kartiček zobrazuje čerpáno / zbývá / celkový nárok dle nastavení workspace (Nastavení → Dovolené). Admini vidí a spravují záznamy všech uživatelů.</p>
<p><strong>Synchronizace s Plánovačem:</strong> Přidání záznamu dovolené automaticky nastaví stav „Dovolená" v Plánovači pro všechny dny v zadaném rozsahu (včetně víkendů, pokud jsou v rozsahu). Smazání záznamu stav v Plánovači odebere. Aby sync fungoval, musí v Plánovači existovat stav s přesným názvem <strong>„Dovolená"</strong> (velké D, háček nad A).</p>

<h3>Přiřazení manažerů (Tým → Manažeři)</h3>
<p>Admin workspace může v záložce <strong>Manažeři</strong> (v sekci Tým) definovat, kdo je čí Team Manažer. Kliknutím na tlačítko manažera se toto přiřazení okamžitě aktivuje nebo odebere. Každý člen může mít více manažerů. Přiřazení se promítá do stránky <strong>Podřízení</strong>, kde manažer vidí záznamy svých podřízených.</p>

<h3>Podřízení</h3>
<p>Team Manažeři a Admini mají přístup ke stránce <strong>Podřízení</strong> (v sekci Analýza). Zobrazuje záznamy přiřazených podřízených s možností filtrovat: Dnes, Týden, nebo Vlastní období (výběrem datumu od–do). Kliknutím na popis záznamu ho lze inline editovat; kliknutím na existující poznámku ji lze upravit.</p>

<h3>Fakturace – vyhledávání (admin)</h3>
<p>V záložkách <strong>Ke schválení</strong> a <strong>Přehled faktur</strong> je nad seznamem vyhledávací pole. Faktury lze filtrovat podle jména uživatele, variabilního symbolu nebo měsíce/roku (např. „Únor 2026"). Vyhledávací pole je viditelné pouze pro Adminy, Master Adminy a Správce fakturace – běžní uživatelé ho nevidí.</p>

<h3>Fakturace</h3>
<p>Stránka <strong>Fakturace</strong> slouží k fakturaci odvedené práce. Workflow má čtyři fáze:</p>
<ul>
  <li><strong>Podání žádosti</strong> – uživatel s oprávněním „Může fakturovat" klikne na „Požádat o fakturaci", nahraje PDF faktury a vyplní: datum vystavení, datum splatnosti, variabilní symbol a příznak plátce DPH. Po podání se namísto banneru zobrazí přímo řádek faktury s aktuálním stavem; kliknutím na řádek lze otevřít detail. Při podání se vpravo zobrazí fakturační profil přiřazený k uživateli.</li>
  <li><strong>Schválení</strong> – Team Manažer nebo Admin vidí záložku „Ke schválení"; kliknutím na fakturu ji zkontroluje (hodiny jsou předvyplněny z Reportů za dané období), doplní výši částky a schválí nebo vrátí k opravě</li>
  <li><strong>Vrácení k opravě</strong> – admin může fakturu „Vrátit k opravě" s poznámkou (např. „uprav fakturační údaje"); uživateli se zobrazí červený odznak na položce Fakturace v bočním panelu a může podat fakturu znovu. Odznak se nezobrazí, pokud byla vrácená faktura znovu podána.</li>
  <li><strong>Proplacení</strong> – uživatel s rolí „Správce fakturace" vidí záložku „Přehled faktur"; může stáhnout PDF (název souboru: YYYYMM-faktura-jmeno-prijmeni.pdf) a označit schválenou fakturu jako proplacentou</li>
</ul>
<p><strong>Editace detailu faktury (admin)</strong> – Admin nebo Správce fakturace může v detailu faktury kliknout na „Upravit" a změnit: datum vystavení, datum splatnosti, počet hodin, částku a (pro schválené/proplacené faktury) datum schválení a datum proplacení. V detailu jsou dostupná také tlačítka pro změnu stavu zpět: Proplaceno → Schváleno nebo → Stornováno; Schváleno → Čekající nebo → Stornováno.</p>
<p>Oprávnění se nastavují v Tým → editace člena → sekce Fakturace.</p>

<h3>Fakturační profily workspace</h3>
<p>V <strong>Nastavení → Fakturační údaje</strong> lze vytvořit více fakturačních profilů (např. pro různé právní subjekty). Každý profil obsahuje: název společnosti, jméno jednatele, adresu (ulice + číslo popisné), PSČ, město, stát, IČO, DIČ, příznak plátce DPH, e-mail, telefon a poznámku k fakturaci. Jeden profil lze označit jako výchozí.</p>
<p>V <strong>Tým → editace člena → sekce Fakturace</strong> lze každému členovi přiřadit konkrétní fakturační profil. Pokud není přiřazen žádný, použije se výchozí profil workspace. Přiřazený profil se uživateli zobrazí při podání žádosti o fakturaci v pravém panelu formuláře.</p>

<h3>Audit log</h3>
<p>Stránka <strong>Audit log</strong> (dostupná Adminum, Master Adminům a uživatelům s oprávněním „Audit log") zobrazuje historii úprav, které manažeři nebo admini provedli na záznamech podřízených. Každý záznam obsahuje: kdo úpravu provedl, pro koho, jakou akci vykonal, datum a čas úpravy a detail záznamu (datum, čas od–do, délka, popis). Oprávnění se nastavuje v Tým → editace člena.</p>

<h3>Timer – provoz bez internetu</h3>
<p>Timer sleduje čas čistě lokálně (JavaScript interval) od okamžiku spuštění. Pokud uživateli vypadne internet, timer <strong>stále běží</strong> a zobrazuje správný čas. Při zastavení offline se záznam uloží do lokální paměti prohlížeče a automaticky se odešle do databáze ihned po obnovení připojení. V liště timeru se zobrazí stav „Offline" (při výpadku) nebo „Čeká na uložení" (po zastavení offline).</p>

<h3>Půlnoční split</h3>
<p>Pokud timer běží přes půlnoc, záznam se automaticky rozdělí na dva – jeden za předchozí den, druhý za nový den. Kontrola probíhá každých 30 sekund na pozadí.</p>

<h3>Firemní adresář (Tým → Členové)</h3>
<p>Záložka <strong>Členové</strong> v sekci Tým slouží jako firemní adresář. Zobrazuje jméno, pracovní pozici, e-mail (s ikonkou pro rychlé zkopírování) a telefonní číslo každého člena. Telefon a pozici si každý uživatel vyplní v <strong>Detailní nastavení</strong>; pozici může nastavit také admin v editaci člena.</p>
<p><strong>Formát telefonního čísla</strong> – čísla se v aplikaci zobrazují s mezerami pro přehlednost (např. <code>+420 608 510 232</code>). Tlačítko kopírování zkopíruje číslo <em>bez</em> mezer (např. <code>+420608510232</code>) pro přímé použití v dialeru nebo jiné aplikaci. Číslo lze zadat v libovolném formátu – při uložení se mezery automaticky odstraní.</p>

<h3>Navigace – rozbalovací sekce</h3>
<p>Levý sidebar je členěn do čtyř sekcí: <strong>SLEDOVÁNÍ</strong>, <strong>ANALÝZA</strong>, <strong>SPRÁVA</strong> a <strong>SYSTÉM</strong> (viditelná pouze pro Master Adminy). Každou sekci lze kliknutím na její název sbalit nebo rozbalit – šipka indikuje aktuální stav. Stav sbalení se ukládá v prohlížeči a přetrvá i po obnovení stránky.</p>

<h3>Detailní nastavení (osobní profil)</h3>
<p>V levém dolním rohu sidebaru je panel přihlášeného uživatele. Kliknutím na něj se rozbalí možnosti: odkaz <strong>Detailní nastavení</strong> (profil, jméno, e-mail, telefon, barva avataru, barevný režim) a tlačítko <strong>Odhlásit se</strong>. Pole <strong>Pozice</strong> v profilu je editovatelné pouze pro adminy – ostatní vidí hodnotu nastavenou adminem.</p>

<h3>Pozvánky</h3>
<p>Nové členy workspace lze přidat v sekci <strong>Tým → Členové</strong>: sdílejte kód pro připojení, nový člen ho zadá při registraci a čeká na schválení adminem.</p>

<h3>Plánovač</h3>
<p>Stránka <strong>Plánovač</strong> (sekce Sledování) zobrazuje dostupnost celého týmu pro aktuální týden v přehledné tabulce. Každý člen má jeden řádek; každý den se zobrazuje jako <strong>jedna buňka pokrývající celý den</strong> (výchozí stav).</p>
<ul>
  <li><strong>Stavy dostupnosti</strong> – admin/Master Admin si definuje vlastní stavy (např. V kanceláři, Home office, Dovolená) s libovolnou barvou v sekci „Spravovat stavy"</li>
  <li><strong>Nastavení dostupnosti</strong> – kliknutím na buňku se otevře picker se stavy; každý uživatel edituje svůj vlastní řádek; admin a manažer mohou editovat i ostatní uživatele</li>
  <li><strong>Rozdělení na DOP / ODP</strong> – každá buňka má při najetí myší v pravém rohu ikonku rozdělení. Kliknutím se buňka rozdělí na dopoledne (DOP) a odpoledne (ODP) – každá půlka má vlastní stav i poznámku. Ikonkou sloučení lze opět vrátit na celý den (zachová se stav z dopoledne).</li>
  <li><strong>Poznámka</strong> – ke každé buňce (celý den i DOP/ODP) lze přidat volitelnou poznámku zobrazenou při najetí myší</li>
  <li><strong>Navigace týdnem</strong> – šipky vlevo/vpravo přepínají mezi týdny; tlačítko „Dnes" skočí na aktuální týden</li>
  <li><strong>Připnutí kolegů</strong> – kliknutím na hvězdičku vedle jména lze kolegu „připnout" na začátek seznamu pro rychlý přístup</li>
  <li><strong>Viditelnost</strong> – Admin/Master Admin vidí všechny členy; Team Manager vidí sebe a svůj tým; Member vidí sebe a spoluhráče se stejným manažerem</li>
  <li><strong>Synchronizace s Dovolená</strong> – nastavení stavu „Dovolená" (celý den, ne DOP/ODP) pro uživatele s příznakem „Může čerpat dovolenou" automaticky vytvoří 1denní záznam v Dovolené (pouze pracovní dny Po–Pá). Odebrání stavu nebo změna na jiný stav smaže odpovídající 1denní záznam z Dovolené. Vícedenní záznamy vytvořené ze stránky Dovolená se touto akcí nemažou. Aby sync fungoval, stav musí mít přesný název <strong>„Dovolená"</strong>.</li>
</ul>
<p><strong>SQL migrace (nutno spustit v Supabase):</strong> Plánovač vyžaduje 3 nové tabulky: <code>trackino_availability_statuses</code>, <code>trackino_availability</code> a <code>trackino_planner_pins</code>.</p>

<h3>Přehled hodin</h3>
<p>Stránka <strong>Přehled hodin</strong> (sekce Analýza) zobrazuje týdenní tabulku odpracovaných hodin za celý viditelný tým. Každý člen tvoří jeden řádek, každý den týdne (Po–Ne) jeden sloupec.</p>
<ul>
  <li><strong>Buňky</strong> – zobrazují součet odpracovaných hodin za daný den (formát H:MM); do součtu vstupují pouze uzavřené záznamy (timer je zastaven)</li>
  <li><strong>Víkendy</strong> – sloupce So a Ne jsou podbarveny šedě pro rychlou orientaci</li>
  <li><strong>Navigace</strong> – šipkami přecházíte na předchozí nebo následující týden; tlačítko „Dnes" skočí na aktuální týden</li>
  <li><strong>Řazení řádků</strong> – každý člen lze šipkami ↑ ↓ přesunout výše nebo níže; pořadí se uloží automaticky a zachová i po novém načtení stránky</li>
  <li><strong>Součtový řádek</strong> – spodní řádek „Σ Celkem" zobrazuje součet všech členů pro každý den i celkový součet za týden</li>
  <li><strong>Viditelnost</strong> – Admin/Master Admin vidí všechny; Team Manager vidí sebe a svůj tým; Member vidí pouze sebe</li>
</ul>

<h3>Analýza kategorií</h3>
<p>Stránka <strong>Analýza kategorií</strong> (sekce Analýza) zobrazuje přehled odpracovaného času rozdělený podle kategorií za vybrané časové období.</p>
<ul>
  <li><strong>Výběr období</strong> – přepínač Dnes / Týden / Měsíc nebo vlastní datum Od–Do</li>
  <li><strong>Koláčový graf</strong> – vizualizuje podíl jednotlivých kategorií na celkovém čase; najetím myší se zobrazí detail (hodiny, počet záznamů)</li>
  <li><strong>Sloupcový graf</strong> – horizontální sloupce seřazené dle odpracovaného času, doplněné o tooltip s detailem</li>
  <li><strong>Detailní tabulka</strong> – pro každou kategorii uvádí počet záznamů, odpracované hodiny a procentuální podíl s grafickým progress barem</li>
  <li><strong>Bez kategorie</strong> – záznamy bez přiřazené kategorie se zobrazí jako samostatná položka „Bez kategorie"</li>
  <li><strong>Viditelnost</strong> – Admin/Master Admin vidí záznamy celého workspace; Team Manager vidí záznamy svého týmu; Member vidí pouze své záznamy</li>
</ul>
`;

function HelpContent() {
  const { user, profile } = useAuth();
  const { isMasterAdmin } = usePermissions();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const fetchContent = useCallback(async () => {
    const { data } = await supabase
      .from('trackino_help_content')
      .select('*')
      .limit(1)
      .single();

    if (data?.content && data.content.trim()) {
      setContent(data.content);
    } else {
      setContent(DEFAULT_HELP_CONTENT);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const saveContent = async () => {
    if (!user) return;
    setSaving(true);
    const newContent = editorRef.current?.innerHTML ?? '';

    const { data: existing } = await supabase
      .from('trackino_help_content')
      .select('id')
      .limit(1)
      .single();

    if (existing?.id) {
      await supabase.from('trackino_help_content').update({
        content: newContent,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq('id', existing.id);
    } else {
      await supabase.from('trackino_help_content').insert({
        content: newContent,
        updated_by: user.id,
      });
    }

    setContent(newContent);
    setSaving(false);
    setEditing(false);
  };

  // Při přepnutí do edit módu vloží aktuální obsah do editoru
  const startEditing = () => {
    setEditing(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
        editorRef.current.focus();
      }
    }, 0);
  };

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const url = prompt('URL odkazu:');
    if (url) execCmd('createLink', url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Nápověda</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Dokumentace a nápověda k aplikaci Trackino
            </p>
          </div>
          {isMasterAdmin && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={saveContent}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg text-white text-sm font-medium"
                    style={{ background: 'var(--primary)' }}
                  >
                    {saving ? 'Ukládám...' : 'Uložit'}
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Upravit
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {editing && (
            <div className="px-3 py-2 border-b flex flex-wrap gap-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              {/* Nadpisy */}
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h2'); }} className="px-2 py-1 rounded text-xs font-bold" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Nadpis H2">H2</button>
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h3'); }} className="px-2 py-1 rounded text-xs font-semibold" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Podnadpis H3">H3</button>
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'p'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Normální text">¶</button>
              <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
              {/* Formátování textu */}
              {[
                { cmd: 'bold', label: <strong>B</strong>, title: 'Tučné (Ctrl+B)' },
                { cmd: 'italic', label: <em>I</em>, title: 'Kurzíva (Ctrl+I)' },
                { cmd: 'underline', label: <u>U</u>, title: 'Podtržení (Ctrl+U)' },
              ].map(btn => (
                <button
                  key={btn.cmd}
                  onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
                  className="px-2 py-1 rounded text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={btn.title}
                >
                  {btn.label}
                </button>
              ))}
              <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Odrážky">• Seznam</button>
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Číselný seznam">1. Seznam</button>
              <button onMouseDown={(e) => { e.preventDefault(); insertLink(); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Odkaz">🔗 Odkaz</button>
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable={editing}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={!editing ? { __html: content } : undefined}
            className="prose prose-sm max-w-none p-6 focus:outline-none"
            style={{
              color: 'var(--text-primary)',
              minHeight: editing ? '400px' : 'auto',
              cursor: editing ? 'text' : 'default',
            }}
          />
        </div>

        {!editing && (
          <p className="mt-3 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
            {isMasterAdmin ? 'Klikněte Upravit pro editaci obsahu.' : ''}
          </p>
        )}
      </div>

      <style>{`
        .prose h2 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: var(--text-primary); }
        .prose h3 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.4rem; color: var(--text-primary); }
        .prose p { margin: 0.5rem 0; color: var(--text-secondary); line-height: 1.6; }
        .prose ul { margin: 0.5rem 0 0.5rem 1.5rem; list-style-type: disc; }
        .prose ol { margin: 0.5rem 0 0.5rem 1.5rem; list-style-type: decimal; }
        .prose li { margin: 0.2rem 0; color: var(--text-secondary); }
        .prose a { color: var(--primary); text-decoration: underline; }
        .prose strong { font-weight: 700; color: var(--text-primary); }
      `}</style>
    </DashboardLayout>
  );
}

export default function HelpPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <WorkspaceProvider>
      <HelpContent />
    </WorkspaceProvider>
  );
}
