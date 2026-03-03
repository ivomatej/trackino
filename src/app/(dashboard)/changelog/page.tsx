'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const DEFAULT_CHANGELOG = `
<h2>Trackino – Historie verzí</h2>

<h3>v1.5.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Osobní profil (Detailní nastavení)</strong> – nová stránka dostupná z levého dolního menu; každý uživatel si může upravit jméno, e-mail, telefonní číslo, barvu avataru a barevný režim; pole Pozice je viditelné pro všechny, ale editovatelné pouze pro adminy</li>
  <li><strong>Firemní adresář</strong> – v Tým → Členové přibyly sloupce Pozice a Telefon; e-mail má ikonku pro rychlé zkopírování (zobrazí se při najetí myší); přidání polí Telefon a Pozice do editačního modálu člena (admin)</li>
  <li><strong>Adresa v panelu fakturace</strong> – panel fakturačních údajů při podání faktury nyní zobrazuje ulici, PSČ+město a stát jako řádky pod jedním nadpisem „Adresa" (bez zbytečných popisků Město/Stát)</li>
  <li><strong>SQL migrace</strong> – do tabulky trackino_profiles přidány sloupce phone a position</li>
</ul>

<h3>v1.4.2 – 3. 3. 2026</h3>
<ul>
  <li><strong>Rozdělení adresy v fakturačním profilu</strong> – pole Adresa rozděleno na tři samostatná pole: Adresa (ulice + číslo popisné), Město a Stát; migrace SQL přidává sloupce city a country</li>
</ul>

<h3>v1.4.1 – 3. 3. 2026</h3>
<ul>
  <li><strong>Plátce DPH ve fakturačním profilu</strong> – každý fakturační profil má nové pole „Jsme plátci DPH" (checkbox); v panelu při podání faktury se zobrazí „Jsme plátci DPH" nebo „Nejsme plátci DPH"</li>
  <li><strong>Úprava panelu fakturačních údajů</strong> – z pravého panelu při podání faktury odebrán řádek „Zástupce" a informační poznámka</li>
</ul>

<h3>v1.4.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Více fakturačních profilů</strong> – v Nastavení → Fakturační údaje lze nyní vytvářet více profilů (různé právní subjekty, IČO, DIČ, adresy); jeden profil lze označit jako výchozí; správa přes přehledné karty s editačním modálem</li>
  <li><strong>Přiřazení profilu členovi</strong> – v Tým → editace člena → sekce Fakturace přibyl výběr fakturačního profilu; pokud není přiřazen, použije se výchozí profil workspace</li>
  <li><strong>Fakturační panel při podání faktury</strong> – při žádosti o fakturaci se vpravo zobrazí fakturační údaje přiřazeného profilu (název, společnost, IČO, DIČ, adresa, kontakty)</li>
  <li><strong>Vrácení faktury k opravě</strong> – admin může fakturu „Vrátit k opravě" s textovou poznámkou; uživateli se zobrazí červený odznak na položce Fakturace v bočním panelu a může podat fakturu znovu</li>
  <li><strong>Název PDF při stahování</strong> – stažený soubor faktury má formát YYYYMM-faktura-jmeno-prijmeni.pdf (diakritika automaticky odstraněna)</li>
  <li><strong>Předvyplnění hodin při schvalování</strong> – při otevření schvalovacího modálu se automaticky načtou odpracované hodiny z Reportů za dané fakturační období; částka se dopočítá dle aktivní hodinové sazby člena; oboje lze ručně upravit</li>
</ul>

<h3>v1.3.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Fakturace členů (nová stránka)</strong> – uživatelé s oprávněním „Může fakturovat" mohou od 1. dne měsíce podat žádost o proplacení za předchozí měsíc: nahrají PDF faktury, vyplní datum vystavení, splatnosti, variabilní symbol a příznak plátce DPH</li>
  <li><strong>Schvalování faktur</strong> – Team Manažeři a Admini vidí záložku „Ke schválení" s čekajícími fakturami; při schválení doplní odpracované hodiny a výši částky</li>
  <li><strong>Přehled faktur a proplacení</strong> – uživatel s rolí „Správce fakturace" (can_manage_billing) vidí záložku „Přehled faktur" se schválenými fakturami; může stáhnout PDF a označit fakturu jako proplacentou</li>
  <li><strong>Nastavení fakturace v Týmu</strong> – admin může v editaci člena zapnout „Může fakturovat" a „Správce fakturace" přes nové checkboxy v sekci Fakturace</li>
  <li><strong>Půlnoční split timeru</strong> – pokud timer běží přes půlnoc, automaticky se při zastavení rozdělí na dvě záznamy (jeden do půlnoci, druhý od půlnoci); background kontrola každých 30 sekund zajistí split i při nezavřeném prohlížeči</li>
</ul>

<h3>v1.2.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Dovolená (nová stránka)</strong> – každý uživatel si může evidovat termíny dovolené; automatický výpočet pracovních dnů; přehled čerpáno / zbývá / celkový nárok dle nastavení workspace; admini vidí záznamy všech uživatelů</li>
  <li><strong>Přiřazení manažerů</strong> – nová záložka „Manažeři" v Týmu; admin přiřadí libovolnému členovi jednoho nebo více Team Manažerů kliknutím na tlačítko; přiřazení se okamžitě promítá do stránky Podřízení</li>
  <li><strong>Podřízení – filtrace času</strong> – záznamy podřízených lze filtrovat: Dnes / Týden / Vlastní období; přesun záložky Podřízení ze sekce Sledování do sekce Analýza</li>
  <li><strong>Tooltip projekt/klient v Time Trackeru</strong> – při najetí myší na ikonu projektu se nyní zobrazí „Klient · Projekt" stejně jako u kategorie/úkolu</li>
</ul>

<h3>v1.1.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Barva workspace</strong> – každý workspace může mít vlastní barvu ikonky; barva je viditelná v přepínači workspace v horní liště; nastavení v sekci Správa workspace (Master Admin)</li>
  <li><strong>Dovolená</strong> – nová sekce v Nastavení pro správu dnů dovolené po letech (2025, 2026…); v editaci člena v Týmu lze zapnout příznak „Může čerpat dovolenou" pro zaměstnance s nárokem</li>
  <li><strong>Typy spolupráce</strong> – definujte vlastní formy spolupráce (HPP, DPP, OSVČ, s.r.o.…) v Nastavení → Spolupráce; každému členovi lze přiřadit typ v editačním modálu</li>
  <li><strong>Tooltip kategorie/úkolu</strong> – při najetí myší na vybranou kategorii či úkol v Time Trackeru se nyní zobrazí jejich plný název místo generického textu</li>
</ul>

<h3>v1.0.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Dashboard</strong> – nová úvodní stránka: personalizovaný pozdrav dle části dne, souhrn výdělku a odpracovaných hodin za aktuální měsíc, zbývající kalendářní a pracovní dny, přehled měsíce s progress barem, dnešní svátek, státní svátky ČR v daném měsíci</li>
  <li><strong>Logo jako odkaz na Dashboard</strong> – kliknutím na logo Trackino v levém panelu se vždy přejde na Dashboard</li>
</ul>

<h3>v0.9.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Přepínač workspace</strong> – uživatelé s přístupem do více workspace mohou přepínat přímo z horní lišty bez odhlášení</li>
  <li><strong>Breadcrumb v Time Trackeru</strong> – po výběru projektu a kategorie/úkolu se zobrazí čitelný text (Klient · Projekt / Kategorie · Úkol) místo pouhých ikonek; funguje i na mobilu</li>
  <li><strong>Propojení kategorie–úkol</strong> – výběr kategorie/úkolu nyní respektuje vazbu: úkoly jsou zobrazeny pod svou kategorií; výběr úkolu automaticky nastaví nadřazenou kategorii</li>
  <li><strong>Výdělek v Reportech</strong> – karta přejmenována z „Náklady" na „Výdělek"</li>
</ul>

<h3>v0.8.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Náklady v Reportech</strong> – karta „Náklady" vedle „Celkem odpracováno" zobrazuje hodiny × hodinová sazba; přepočítává se dle zvoleného období, uživatele a projektu; viditelné pro všechny uživatele (každý vidí své vlastní náklady)</li>
  <li><strong>Přehled nákladů per uživatel</strong> – tabulka pod souhrnými kartami zobrazuje odpracované hodiny a náklady zvlášť pro každého člena (viditelné pro admin/manager)</li>
  <li><strong>Správa workspace (Master Admin)</strong> – nová stránka /admin umožňuje vytvořit nové workspace, editovat název a tarif, spravovat členy, zamknout/odemknout workspace</li>
  <li><strong>Zamčený workspace</strong> – zamčený workspace zobrazí uživatelům informační obrazovku; Master Admin vidí workspace i po zamčení</li>
  <li><strong>Grupování projektů v Time Trackeru</strong> – projekty jsou nyní sdruženy pod správnými klienty (využívá tabulku client_projects místo starého textového pole)</li>
  <li><strong>Color picker – 20 barev</strong> – všude (Klienti, Štítky, Tým) je k dispozici 20 barev; vybraná barva označena černým okrajem místo zvětšení</li>
  <li><strong>Viditelnost štítků v menu</strong> – pokud je zapnuto „Skrýt štítky pro všechny", záložka Štítky zmizí z menu pro běžné členy</li>
  <li><strong>Hodinové sazby – oprávnění</strong> – člen vidí jen svoji sazbu; Team Manager vidí sebe a podřízené; Admin/Master Admin vidí všechny sazby</li>
  <li><strong>Historie hodinových sazeb</strong> – sazby s platností (valid_from / valid_to); aktivní sazba (bez valid_to) zobrazena v seznamu členů</li>
  <li><strong>Ikonky akcí</strong> – tlačítka pro editaci, archivaci a mazání v Projektech, Klientech a Štítcích jsou vždy viditelná (šedá), sjednocená ikona koše</li>
</ul>

<h3>v0.7.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Editace členů týmu</strong> – admin může upravit jméno, email, barvu avataru a hodinovou sazbu přímo v modálním okně</li>
  <li><strong>Schválení přístupu</strong> – noví uživatelé čekají na schválení adminem; admin schvaluje v sekci Tým</li>
  <li><strong>Přesměrování po registraci</strong> – uživatel je po registraci přesměrován přímo na dashboard</li>
</ul>

<h3>v0.6.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Nápověda</strong> – nová stránka s dokumentací aplikace, editovatelná Master Adminem</li>
  <li><strong>Nahlásit chybu</strong> – formulář pro bug reporty s rich-text editorem; Master Admin vidí všechny reporty ze všech workspace, může měnit stavy (Otevřeno / Řeší se / Vyřešeno) a přidávat poznámky</li>
  <li><strong>Dokumentace</strong> – tato stránka s historií verzí, editovatelná Master Adminem</li>
  <li><strong>Reporty</strong> – nová stránka s přehledem odpracovaného času; filtry dle data, uživatele a projektu; ruční zadání záznamů (přesunuto z Time Trackeru)</li>
  <li><strong>JetBrains Mono</strong> – číslice (časy, trvání) nyní zobrazeny monospacovým písmem pro lepší čitelnost</li>
  <li><strong>Jemnější oddělovače</strong> – záznamy v Time Trackeru odděleny subtilnější čárou</li>
  <li><strong>Ikona kategorie</strong> – tlačítko pro výběr kategorie/úkolu v Time Trackeru má novou ikonu (seznam)</li>
  <li><strong>Globální skrytí štítků</strong> – admin workspace může skrýt štítky pro všechny uživatele najednou</li>
  <li><strong>Oprava select šipek</strong> – rozbalovací nabídky v Nastavení mají správně zarovnanou šipku</li>
  <li><strong>Iniciály a jméno</strong> – Sidebar zobrazuje skutečné jméno uživatele a správné iniciály</li>
</ul>

<h3>v0.5.0 – únor 2026</h3>
<ul>
  <li><strong>Půlnoční split</strong> – pokud timer přeběhne přes půlnoc, záznam se automaticky rozdělí na dva dny</li>
  <li><strong>Podřízení</strong> – manažeři vidí záznamy svých podřízených, mohou je editovat a přidávat poznámky</li>
  <li><strong>Manažerské poznámky</strong> – přehled všech poznámek manažera s možností editace a mazání</li>
</ul>

<h3>v0.4.0 – únor 2026</h3>
<ul>
  <li><strong>Klienti</strong> – samostatná entita pro správu klientů s propojením na projekty (many-to-many)</li>
  <li><strong>Štítky</strong> – barevné štítky pro kategorizaci záznamů; výběr přímo v Time Trackeru</li>
  <li><strong>Skrytí štítků</strong> – individuální nastavení viditelnosti štítků per-uživatel v Nastavení týmu</li>
</ul>

<h3>v0.3.0 – únor 2026</h3>
<ul>
  <li><strong>Systém rolí</strong> – 4 úrovně: Master Admin, Admin/Owner, Team Manager, Member</li>
  <li><strong>Multi-manager</strong> – jeden člen může mít více manažerů (tabulka manager_assignments)</li>
  <li><strong>Workspace nastavení</strong> – tarif, formát data/čísel, měna, začátek týdne, povinná pole</li>
  <li><strong>Fakturační údaje</strong> – IČO, DIČ, adresa a kontaktní údaje workspace</li>
  <li><strong>Audit log</strong> – záznam akcí pro tarif Max</li>
  <li><strong>Pozvánky</strong> – přidání nových členů emailem s unikátním tokenem</li>
</ul>

<h3>v0.2.0 – leden 2026</h3>
<ul>
  <li><strong>Projekty</strong> – správa projektů s barvami a archivací</li>
  <li><strong>Kategorie a úkoly</strong> – hierarchická struktura pro organizaci záznamů</li>
  <li><strong>Tým</strong> – správa členů workspace s rolemi a hodinovou sazbou</li>
  <li><strong>Tmavý/světlý režim</strong> – přepínač v profilu uživatele</li>
</ul>

<h3>v0.1.0 – leden 2026</h3>
<ul>
  <li><strong>Základní timer</strong> – spouštění, zastavování a zobrazování záznamů</li>
  <li><strong>Workspace</strong> – izolované prostředí pro tým</li>
  <li><strong>Autentizace</strong> – přihlášení a registrace přes Supabase Auth</li>
</ul>
`;

function ChangelogContent() {
  const { user } = useAuth();
  const { isMasterAdmin } = usePermissions();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const fetchContent = useCallback(async () => {
    const { data } = await supabase
      .from('trackino_changelog_content')
      .select('*')
      .limit(1)
      .single();

    if (data?.content && data.content.trim()) {
      setContent(data.content);
    } else {
      setContent(DEFAULT_CHANGELOG);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const saveContent = async () => {
    if (!user) return;
    setSaving(true);
    const newContent = editorRef.current?.innerHTML ?? '';

    const { data: existing } = await supabase
      .from('trackino_changelog_content')
      .select('id')
      .limit(1)
      .single();

    if (existing?.id) {
      await supabase.from('trackino_changelog_content').update({
        content: newContent,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq('id', existing.id);
    } else {
      await supabase.from('trackino_changelog_content').insert({
        content: newContent,
        updated_by: user.id,
      });
    }

    setContent(newContent);
    setSaving(false);
    setEditing(false);
  };

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
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dokumentace</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Historie verzí a přehled změn v aplikaci Trackino
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
                { cmd: 'bold', label: <strong>B</strong>, title: 'Tučné' },
                { cmd: 'italic', label: <em>I</em>, title: 'Kurzíva' },
                { cmd: 'underline', label: <u>U</u>, title: 'Podtržení' },
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
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>• Seznam</button>
              <button onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>1. Seznam</button>
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
        .prose h3 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.4rem; color: var(--text-primary); border-left: 3px solid var(--primary); padding-left: 0.6rem; }
        .prose p { margin: 0.5rem 0; color: var(--text-secondary); line-height: 1.6; }
        .prose ul { margin: 0.5rem 0 0.5rem 1.5rem; list-style-type: disc; }
        .prose ol { margin: 0.5rem 0 0.5rem 1.5rem; list-style-type: decimal; }
        .prose li { margin: 0.25rem 0; color: var(--text-secondary); }
        .prose a { color: var(--primary); text-decoration: underline; }
        .prose strong { font-weight: 700; color: var(--text-primary); }
      `}</style>
    </DashboardLayout>
  );
}

export default function ChangelogPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <WorkspaceProvider>
      <ChangelogContent />
    </WorkspaceProvider>
  );
}
