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
  <li><strong>Time Tracker</strong> – spouštějte a zastavujte timer pro sledování odpracovaného času; po výběru projektu a kategorie/úkolu se zobrazuje čitelný breadcrumb místo ikonek</li>
  <li><strong>Projekty</strong> – organizujte záznamy do projektů a přiřazujte klienty</li>
  <li><strong>Klienti</strong> – spravujte klienty a propojujte je s projekty</li>
  <li><strong>Štítky</strong> – označujte záznamy štítky pro lepší kategorizaci</li>
  <li><strong>Reporty</strong> – analyzujte odpracovaný čas (včetně výdělku dle hodinové sazby) a přidávejte záznamy ručně</li>
  <li><strong>Podřízení</strong> – Team Manažeři a Admini vidí záznamy podřízených; dostupné filtry: Dnes / Týden / Vlastní období</li>
  <li><strong>Dovolená</strong> – evidence termínů dovolené s automatickým výpočtem pracovních dnů a přehledem zbývajícího nároku</li>
  <li><strong>Fakturace</strong> – fakturace odvedené práce: podání žádosti, schvalování manažerem, proplacení správcem fakturace</li>
  <li><strong>Tým</strong> – spravujte členy workspace, přidávejte je kódem, nastavujte manažery a oprávnění fakturace</li>
  <li><strong>Detailní nastavení</strong> – osobní profil: jméno, e-mail, telefon, pozice (nastavuje admin) a barevný režim</li>
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

<h3>Přiřazení manažerů (Tým → Manažeři)</h3>
<p>Admin workspace může v záložce <strong>Manažeři</strong> (v sekci Tým) definovat, kdo je čí Team Manažer. Kliknutím na tlačítko manažera se toto přiřazení okamžitě aktivuje nebo odebere. Každý člen může mít více manažerů. Přiřazení se promítá do stránky <strong>Podřízení</strong>, kde manažer vidí záznamy svých podřízených.</p>

<h3>Podřízení</h3>
<p>Team Manažeři a Admini mají přístup ke stránce <strong>Podřízení</strong> (v sekci Analýza). Zobrazuje záznamy přiřazených podřízených s možností filtrovat: Dnes, Týden, nebo Vlastní období (výběrem datumu od–do). Kliknutím na popis záznamu ho lze inline editovat; kliknutím na existující poznámku ji lze upravit.</p>

<h3>Fakturace</h3>
<p>Stránka <strong>Fakturace</strong> slouží k fakturaci odvedené práce. Workflow má čtyři fáze:</p>
<ul>
  <li><strong>Podání žádosti</strong> – uživatel s oprávněním „Může fakturovat" klikne na „Požádat o fakturaci", nahraje PDF faktury a vyplní: datum vystavení, datum splatnosti, variabilní symbol a příznak plátce DPH. Při podání se vpravo zobrazí fakturační profil přiřazený k uživateli.</li>
  <li><strong>Schválení</strong> – Team Manažer nebo Admin vidí záložku „Ke schválení"; kliknutím na fakturu ji zkontroluje (hodiny jsou předvyplněny z Reportů za dané období), doplní výši částky a schválí nebo vrátí k opravě</li>
  <li><strong>Vrácení k opravě</strong> – admin může fakturu „Vrátit k opravě" s poznámkou (např. „uprav fakturační údaje"); uživateli se zobrazí červený odznak na položce Fakturace v bočním panelu a může podat fakturu znovu</li>
  <li><strong>Proplacení</strong> – uživatel s rolí „Správce fakturace" vidí záložku „Přehled faktur"; může stáhnout PDF (název souboru: YYYYMM-faktura-jmeno-prijmeni.pdf) a označit schválenou fakturu jako proplacentou</li>
</ul>
<p>Oprávnění se nastavují v Tým → editace člena → sekce Fakturace.</p>

<h3>Fakturační profily workspace</h3>
<p>V <strong>Nastavení → Fakturační údaje</strong> lze vytvořit více fakturačních profilů (např. pro různé právní subjekty). Každý profil obsahuje: název společnosti, jméno jednatele, adresu (ulice + číslo popisné), PSČ, město, stát, IČO, DIČ, příznak plátce DPH, e-mail, telefon a poznámku k fakturaci. Jeden profil lze označit jako výchozí.</p>
<p>V <strong>Tým → editace člena → sekce Fakturace</strong> lze každému členovi přiřadit konkrétní fakturační profil. Pokud není přiřazen žádný, použije se výchozí profil workspace. Přiřazený profil se uživateli zobrazí při podání žádosti o fakturaci v pravém panelu formuláře.</p>

<h3>Půlnoční split</h3>
<p>Pokud timer běží přes půlnoc, záznam se automaticky rozdělí na dva – jeden za předchozí den, druhý za nový den. Kontrola probíhá každých 30 sekund na pozadí.</p>

<h3>Firemní adresář (Tým → Členové)</h3>
<p>Záložka <strong>Členové</strong> v sekci Tým slouží jako firemní adresář. Zobrazuje jméno, pracovní pozici, e-mail (s ikonkou pro rychlé zkopírování) a telefonní číslo každého člena. Telefon a pozici si každý uživatel vyplní v <strong>Detailní nastavení</strong>; pozici může nastavit také admin v editaci člena.</p>

<h3>Detailní nastavení (osobní profil)</h3>
<p>V levém dolním menu je odkaz <strong>Detailní nastavení</strong>, kde každý uživatel může upravit: zobrazované jméno, e-mail, telefonní číslo, barvu avataru a barevný režim aplikace (světlý / tmavý / auto). Pole <strong>Pozice</strong> je viditelné, ale editovatelné pouze pro adminy – ostatní vidí hodnotu nastavenou adminem.</p>

<h3>Pozvánky</h3>
<p>Nové členy workspace lze přidat v sekci <strong>Tým → Členové</strong>: sdílejte kód pro připojení, nový člen ho zadá při registraci a čeká na schválení adminem.</p>
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
