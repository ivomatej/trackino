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
<p>Trackino je moderní aplikace pro sledování pracovního času, plánování a správu týmu.</p>

<h3>Základní funkce</h3>
<ul>
  <li><strong>Přehled</strong> – úvodní přehledová stránka s personalizovaným pozdravem, souhrnem výdělku, odpracovaných hodin, zbývajících dní a svátků pro aktuální měsíc</li>
  <li><strong>Měřič</strong> – spouštějte a zastavujte timer pro sledování odpracovaného času; po výběru projektu a kategorie/úkolu se zobrazuje čitelný breadcrumb místo ikonek; každý záznam má tlačítko ▶ pro opětovné spuštění se stejnými údaji (projekt, kategorie, štítky); u každého záznamu se zobrazuje také přiřazená kategorie a úkol (světle šedě vpravo od projektu)</li>
  <li><strong>Projekty</strong> – organizujte záznamy do projektů a přiřazujte klienty; seznam projektů lze prohledávat pomocí vyhledávacího pole nad seznamem</li>
  <li><strong>Klienti</strong> – spravujte klienty a propojujte je s projekty; seznam klientů lze filtrovat vyhledávacím polem</li>
  <li><strong>Štítky</strong> – označujte záznamy štítky pro lepší kategorizaci</li>
  <li><strong>Reporty</strong> – analyzujte odpracovaný čas (včetně výdělku dle hodinové sazby) a přidávejte záznamy ručně; mobilní layout položek ve výpisu: 1. řádek název, 2. řádek projekt/kategorie/úkol, 3. řádek čas a akce</li>
  <li><strong>Podřízení</strong> – Team Manažeři a Admini vidí záznamy podřízených; dostupné filtry: Dnes / Týden / Vlastní období</li>
  <li><strong>Dovolená</strong> – evidence termínů dovolené s automatickým výpočtem pracovních dnů a přehledem zbývajícího nároku</li>
  <li><strong>Fakturace</strong> – fakturace odvedené práce: podání žádosti, schvalování manažerem, proplacení správcem fakturace</li>
  <li><strong>Tým</strong> – spravujte členy workspace, přidávejte je kódem, nastavujte manažery a oprávnění fakturace; e-mail a telefon každého člena lze rychle zkopírovat kliknutím na ikonku vedle kontaktu; seznam členů lze vyhledávat podle jména nebo e-mailu</li>
  <li><strong>Přehled hodin</strong> – týdenní mřížka odpracovaných hodin pro celý tým; navigace mezi týdny, řazení řádků šipkami, součet za den i za týden</li>
  <li><strong>Analýza kategorií</strong> – přehled odpracovaného času rozdělený po kategoriích za vybrané období; koláčový graf, sloupcový graf a detailní tabulka s podíly; administrátoři a manažeři mohou navíc filtrovat výsledky dle konkrétního uživatele (select „Všichni uživatelé" vpravo od přepínače období)</li>
  <li><strong>Detailní nastavení</strong> – osobní profil: jméno, e-mail, telefon, pozice (nastavuje admin) a barevný režim; dostupné přes rozbalovací panel uživatele v levém dolním rohu sidebaru</li>
</ul>

<h3>Mobilní a tabletové zobrazení</h3>
<p>Trackino je plně funkční na mobilních zařízeních (Android i iPhone) i tabletech. Klíčové adaptace pro malé obrazovky:</p>
<ul>
  <li><strong>Navigace (sidebar)</strong> – na mobilech se sidebar skryje a otevře se tlačítkem ☰ v záhlaví. Kliknutím na libovolnou položku nebo na tmavé pozadí se zavře.</li>
  <li><strong>Prompty a Záložky</strong> – levý panel se složkami je na mobilech skrytý; zobrazíte jej tlačítkem <em>Složky</em> v horní části stránky.</li>
  <li><strong>Kalendář</strong> – mini kalendář a filtry jsou na mobilech skryté; zobrazíte je tlačítkem <em>Mini kalendář & filtry</em> v horní části. Pohled Seznam zobrazuje panel poznámky pod kartičkou události (ne vedle ní).</li>
  <li><strong>Dokumenty</strong> – panel složek se zobrazí/skryje tlačítkem <em>Složky</em> na mobilech.</li>
  <li><strong>Nastavení workspace</strong> – na mobilech se sekce zobrazují jako horizontálně scrollovatelný pruh tlačítek.</li>
  <li><strong>Tým</strong> – záložky sekce jsou horizontálně scrollovatelné na úzkých obrazovkách.</li>
</ul>

<h3>Přehled</h3>
<p>Po přihlášení se zobrazí Přehled s klíčovými informacemi pro aktuální měsíc:</p>
<ul>
  <li><strong>Výdělek</strong> – součet hodin × hodinová sazba za aktuální měsíc (zobrazuje se pouze pokud máte nastavenou sazbu)</li>
  <li><strong>Odpracováno</strong> – celkový čas zaznamenaný v tomto měsíci</li>
  <li><strong>Zbývá dní</strong> – kalendářní dny do konce měsíce</li>
  <li><strong>Pracovní dny</strong> – zbývající pracovní dny (pondělí–pátek bez svátků)</li>
  <li><strong>Přehled měsíce</strong> – progress bar, počty dní, státní svátky ČR</li>
  <li><strong>Dnešní svátek</strong> – kdo dnes slaví svátek dle českého kalendáře</li>
  <li><strong>K vyřízení</strong> – notifikační panel zobrazující čekající položky: žádosti o dovolenou, žádosti zaměstnanců, nevyřízené připomínky, faktury ke schválení a <strong>pozvánky do kalendáře</strong> (čeká na vaši odpověď). Každá položka odkazuje přímo na příslušnou stránku. Panel se zobrazuje jen tehdy, pokud existují nevyřízené položky.</li>
  <li><strong>Týdenní graf</strong> – sloupcový graf odpracovaných hodin za posledních 7 dní s průměrem a porovnáním dnešního dne oproti průměru</li>
</ul>

<h3>Výběr projektu a kategorie v Měřiči</h3>
<p>Kliknutím na ikonu projektu otevřete picker projektů – při najetí myší se zobrazí tooltip „Klient · Projekt". Kliknutím na ikonu seznamu otevřete picker kategorie/úkolu – tooltip zobrazuje „Kategorie · Úkol".</p>

<h3>Přepínání workspace</h3>
<p>Pokud máte přístup do více workspace, zobrazuje se přepínač workspace v <strong>levém postranním panelu (sidebar)</strong>, nad sekcí s uživatelským účtem. Kliknutím na něj vyberete jiný workspace bez nutnosti odhlásit se. Přepínač se zobrazí pouze v případě, že máte přístup do 2 a více workspace.</p>

<h3>Role v systému</h3>
<ul>
  <li><strong>Master Admin</strong> – správce celé platformy, může spravovat workspace; ostatní uživatelé ho v Tým → Členové nevidí (je skryt pro zachování přehlednosti); v Správě workspace se zobrazuje skutečný workspace Admin, nikoli Master Admin</li>
  <li><strong>Admin / Owner</strong> – správce workspace, přístup k nastavení a správě týmu; vidí záznamy a dovolenou všech; nejvyšší role viditelná běžným uživatelům</li>
  <li><strong>Team Manager</strong> – správce podřízených, vidí a edituje jejich záznamy, přidává poznámky; vidí dovolenou svých podřízených</li>
  <li><strong>Member</strong> – běžný uživatel, sleduje čas timerem; spravuje svoji dovolenou (pokud má nastaven nárok)</li>
</ul>

<h3>Dovolená</h3>
<p>Stránka <strong>Dovolená</strong> (v sekci Sledování) je dostupná uživatelům s příznakem „Může čerpat dovolenou" (nastavuje admin v Tým → editace člena). Záznamy se přidávají zadáním začátku a konce dovolené – počet pracovních dnů (pondělí–pátek) se vypočítá automaticky. Přehled kartiček zobrazuje čerpáno / zbývá / celkový nárok dle nastavení workspace (Nastavení → Dovolené). Admini vidí a spravují záznamy všech uživatelů.</p>
<p><strong>Schvalování dovolené:</strong> Dovolená delší než 3 pracovní dny vyžaduje schválení přímého nadřízeného (managera). Po podání žádosti záznam čeká ve stavu <em>Čeká na schválení</em> – uvidíte ho se žlutým štítkem v záložce Záznamy → sekce Moje žádosti. Do statistiky čerpání se počítají pouze schválené záznamy.</p>
<ul>
  <li><strong>Záložka Záznamy</strong> – zobrazuje vaše schválené záznamy + sekci „Moje žádosti" s pending/zamítnutými žádostmi</li>
  <li><strong>Záložka Žádosti</strong> (viditelná jen pro managery a adminy) – přehled čekajících žádostí od podřízených; každou žádost lze <em>Schválit</em> nebo <em>Zamítnout</em> (s volitelnou poznámkou)</li>
  <li><strong>Zamítnuté žádosti</strong> – zůstávají viditelné s červeným štítkem a poznámkou od nadřízeného; uživatel je může smazat</li>
  <li><strong>Dovolená ≤ 3 dní</strong> – přidává se přímo jako schválená (bez nutnosti čekat na souhlas)</li>
  <li><strong>Admin / Owner</strong> – dovolená přidaná adminem se vždy schválí okamžitě bez ohledu na délku</li>
</ul>
<p><strong>Synchronizace s Plánovačem:</strong> Přidání záznamu dovolené automaticky nastaví stav „Dovolená" v Plánovači pro všechny dny v zadaném rozsahu. Smazání záznamu stav v Plánovači odebere. Aby sync fungoval, musí v Plánovači existovat stav s přesným názvem <strong>„Dovolená"</strong>.</p>

<h3>Kalendář</h3>
<p>Stránka <strong>Kalendář</strong> (v sekci Sledování, dostupná v tarifu <strong>Max</strong>) poskytuje přehled všech vašich událostí na jednom místě. Automaticky zobrazuje vaši schválenou dovolenou a záznamy z modulu Důležité dny – bez nutnosti cokoli ručně přidávat.</p>
<ul>
  <li><strong>Měsíční pohled</strong> – klasická mřížka celého měsíce (Po–Ne); kliknutím na libovolný den vytvoříte novou událost</li>
  <li><strong>Týdenní pohled</strong> – časová osa vlevo (hodiny), záhlaví dnů nahoře, pás celodennních událostí a klikatelná mřížka hodin. Události s konkrétním časem se zobrazují jako bloky přímo v odpovídající hodině; dnešní sloupec je jemně zvýrazněn</li>
  <li><strong>Pohled Seznam</strong> – chronologický výpis událostí seskupených po měsících; zobrazuje 6 měsíců dopředu (max. polovina šířky stránky). Tlačítkem <em>Zobrazit dřívější události</em> načtete vždy 10 dalších starších událostí. Kliknutím na ikonku 📄 u události rozbalíte inline panel poznámek přímo pod kartičkou (ostatní události se posunou níže). Opětovným kliknutím panel zavřete. Pokud má událost uloženou poznámku, panel zůstane vždy viditelný.</li>
  <li><strong>Navigace</strong> – tlačítka ← Dnes → pro přepínání týdnů nebo měsíců; rozsah dat je vždy zobrazen v záhlaví stránky</li>
</ul>
<p><strong>Levý panel</strong> obsahuje pět sekcí (každou lze sbalit/rozbalit šipkou vedle nadpisu):</p>
<ul>
  <li><strong>MÉ KALENDÁŘE</strong> – ruční události. Při prvním přístupu se vytvoří výchozí „Můj kalendář"; další přidáte tlačítkem +. Barva je viditelná přes zaškrtávátko, které zároveň slouží jako přepínač viditelnosti. Najetím myší na kalendář se zobrazí ikona tužky (upravit), červená ikona koše (smazat) a ikona sdílení (nasdílet kalendář). Výchozí kalendář nelze smazat (ikona koše se u něj nezobrazuje). Smazáním kalendáře se odstraní i všechny jeho události.</li>
  <li><strong>EXTERNÍ KALENDÁŘE</strong> – ICS/iCal odběry; přidáte je tlačítkem + a zobrazíte/skryjete zaškrtnutím. Tlačítko ↻ obnoví data. Najetím myší se zobrazí ikona sdílení pro nasdílení odběru ostatním.</li>
  <li><strong>AUTOMATICKY</strong> – Dovolená a Důležité dny; zobrazují se automaticky (lze zapnout/vypnout zaškrtnutím). Najetím myší na řádek se zobrazí malá barevná tečka vpravo – kliknutím na ni otevřete výběr barvy pro daný kalendář.</li>
  <li><strong>SDÍLENÉ KALENDÁŘE</strong> – sekce se zobrazí automaticky, pokud vám někdo nasdílel svůj kalendář. U každého sdíleného kalendáře lze přepínat viditelnost zaškrtávátkem. Najetím myší na řádek se zobrazí barevná tečka vpravo – kliknutím nastavíte vlastní zobrazovací barvu (bez vlivu na originál). Název kalendáře je doplněn o jméno vlastníka.</li>
  <li><strong>DALŠÍ KALENDÁŘE</strong> – tři automatické kalendáře: <em>Státní svátky ČR</em>, <em>Jmeniny</em> – jméno dle českého kalendáře pro každý den, <em>Narozeniny</em> – narozeniny kolegů ve workspace (dostupné jen pro adminy a uživatele s oprávněním <em>Vidí narozeniny kolegů</em>). Každý lze zapnout/vypnout zaškrtnutím. Najetím myší na řádek se zobrazí barevná tečka – kliknutím nastavíte vlastní barvu pro daný kalendář.</li>
</ul>
<p><strong>Nastavení kalendáře:</strong> Tlačítko ⚙ v levém panelu otevře nastavení <em>Viditelné oblasti</em>. Selekty <strong>Od</strong> a <strong>Do</strong> určují, která část dne se zobrazí v okně bez scrollování – zároveň nastavují výšku okna i počáteční scroll pozici. Například 9:00–17:00 zobrazí přesně 8 hodinových řádků. Mimo tuto oblast lze pohybovat scrollem (celá 24h mřížka je vždy dostupná). Nastavení se ukládá do localStorage prohlížeče.</p>
<p><strong>Checkboxy v levém panelu:</strong> Každý kalendář a odběr má barevné zaškrtávátko vlevo. Fajfka je vždy bílá, takže je dobře čitelná i u světlých barev (žlutá, oranžová apod.). Kliknutím zaškrtávátko přepnete viditelnost daného kalendáře.</p>
<p><strong>Přidání události:</strong> Klikněte na tlačítko <em>+ Přidat událost</em>, nebo klikněte přímo na den v měsíčním pohledu. V pohledech Týden a Den klikněte na konkrétní hodinový slot (např. 14:00) – formulář se otevře s automaticky předvyplněným časem 14:00–15:00 (přepínač Celý den bude vypnutý). Formulář události nabízí rozšířená pole:</p>
<ul>
  <li><strong>Název</strong> – povinné pole</li>
  <li><strong>Kalendář</strong> – vyberte, do kterého vašeho kalendáře se událost uloží</li>
  <li><strong>Od / Do</strong> + přepínač <em>Celý den</em> (nebo zadejte čas)</li>
  <li><strong>Místo</strong> – volitelná adresa nebo popis místa konání</li>
  <li><strong>Účastníci</strong> – vyberte členy workspace; vybraní uživatelé uvidí událost ve svém kalendáři a obdrží pozvánku k potvrzení (RSVP). Tag-style výběr s vyhledáváním jmen.</li>
  <li><strong>URL</strong> – volitelný odkaz (webová stránka, videohovor apod.)</li>
  <li><strong>Upozornění</strong> – připomenutí: bez upozornění / 5 / 15 / 30 minut / 1 hodinu / 1 den předem</li>
  <li><strong>Poznámka</strong> – volitelný textový popis události</li>
  <li><strong>Barva</strong> – přepíše výchozí barvu kalendáře jen pro tuto událost</li>
</ul>
<p>Událost lze kdykoli editovat kliknutím na ni, nebo smazat z formuláře. Při editaci vlastní události s účastníky vidí organizátor jejich RSVP stav (✓ přijato, ✗ odmítnuto, ? čeká).</p>
<p><strong>Sdílení kalendáře:</strong> Kliknutím na ikonu sdílení (zobrazí se při najetí na kalendář v levém panelu) otevřete dialog sdílení. Lze nasdílet celý workspace najednou nebo jen vybraným uživatelům. Pro každého příjemce lze přepínačem <em>Detaily</em> nastavit, zda vidí plné informace o událostech, nebo jen obsazenost (Nemá čas) bez názvů a popisů.</p>
<p><strong>RSVP – přijetí pozvánky:</strong> Pokud vás někdo přidal jako účastníka události, zobrazí se tato událost ve vašem kalendáři s přerušovaným okrajem a symbolem „?". Kliknutím na ni otevřete detail události s RSVP tlačítky:</p>
<ul>
  <li><strong>✓ Přijmout</strong> – potvrdíte účast; okraj události se změní na plný</li>
  <li><strong>~ Nezávazně</strong> (žluté) – označíte, že možná přijdete; událost se zobrazí s vlnovkovým prefixem „~" a přerušovaným okrajem</li>
  <li><strong>✗ Odmítnout</strong> – zamítnete účast; událost zůstane v kalendáři, ale zobrazí se zesvětleně s přeškrtnutým názvem</li>
</ul>
<p>Odpověď lze <strong>kdykoli změnit</strong> – tlačítka jsou vždy viditelná v detailu události, i pokud jste ji již přijali nebo odmítli. Organizátor vidí váš aktuální stav u vlastní události. Kliknutím na odmítnutou událost (zesvětlenou) ji stále zobrazíte a změníte RSVP.</p>
<p><strong>Poznámky k událostem</strong> (Pohled Seznam): u každé události se po najetí myší zobrazí ikonka 📄. Kliknutím rozbalíte inline editor poznámek přímo pod kartičkou (max. 220 px výšky). Poznámky jsou soukromé (pouze váš pohled). Editor nabízí:</p>
<ul>
  <li><strong>Formátování textu</strong> – B / I / U, odrážkový a číselný seznam</li>
  <li><strong>Důležitá</strong> – červený pill tag; označí poznámku jako důležitou (červený rámeček panelu)</li>
  <li><strong>Oblíbená</strong> – žlutý pill tag; přidá do oblíbených (žlutý rámeček panelu)</li>
  <li><strong>Hotovo</strong> – šedý pill tag; uzavře poznámku (přeškrtnutý text, snížená průhlednost)</li>
  <li>📋 <strong>Kopírovat</strong> – zkopíruje obsah a checklist jako prostý text</li>
  <li>🗑 <strong>Koš</strong> – smaže celou poznámku (s potvrzením)</li>
  <li><strong>Uložit / Zrušit</strong> – tlačítka se zobrazí, pouze pokud jsou neuložené změny. Flagy (Důležitá/Oblíbená/Hotovo) se ukládají okamžitě.</li>
  <li>URL adresy v textu se automaticky stanou klikatelným odkazem (otevírá nový tab)</li>
</ul>

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

<h3>AI asistent</h3>
<p>Modul <strong>AI asistent</strong> (dostupný v tarifu <strong>Max</strong>, sekce <strong>NÁSTROJE</strong>) je chatovací okno napojené na AI modely přes API. Aktuálně podporuje <strong>OpenAI</strong> (GPT-4o, GPT-4o mini, GPT-4 Turbo, o1-mini).</p>
<ul>
  <li><strong>Konverzace</strong> – každá konverzace je uložena v databázi; v levém panelu vidíte historii svých konverzací. Konverzaci lze vyhledat, přejmenovat kliknutím nebo smazat.</li>
  <li><strong>Přepínání modelu</strong> – pill tlačítka ve spodní části chatu umožňují rychlé přepnutí modelu. Tlačítko ℹ zobrazí podrobný popis každého modelu, jeho silné stránky a orientační cenu v Kč.</li>
  <li><strong>Počítadlo tokenů</strong> – pod vstupním polem se zobrazuje odhadovaný počet tokenů v konverzaci a barevný progress bar ukazující, jak blízko jste limitu kontextového okna (zelená → žlutá → oranžová → červená).</li>
  <li><strong>Kreativita (temperature)</strong> – posuvník 0–1 v nastavení; nízká hodnota = přesné/konzervativní odpovědi, vysoká = kreativnější a méně předvídatelné.</li>
  <li><strong>System prompt</strong> – v nastavení lze rozbalit pole „System prompt" a zadat pokyny pro AI (např. „Odpovídej stručně a v češtině", „Jsi HR asistent"). Platí po celou dobu konverzace.</li>
  <li><strong>Odesílání zpráv</strong> – napište zprávu do textového pole a stiskněte <kbd>Enter</kbd> (nový řádek = <kbd>Shift+Enter</kbd>) nebo klikněte Odeslat.</li>
  <li><strong>Streamované odpovědi</strong> – u modelů s podporou streamingu se odpověď zobrazuje v reálném čase písmeno po písmenu. Generování lze přerušit červeným tlačítkem stop.</li>
  <li><strong>Formátování odpovědí</strong> – AI odpovědi automaticky renderují Markdown: nadpisy, tučný text, kurzívu, kódové bloky se zvýrazněním syntaxe, odrážkové seznamy.</li>
  <li><strong>Rychlé návrhy</strong> – při prázdné konverzaci se zobrazí tlačítka s ukázkovými dotazy pro rychlé zahájení; pokud je Firecrawl dostupný, nabídnou se i návrhy s prohledáváním webu.</li>
  <li><strong>Web search (🌐)</strong> – globus tlačítko vlevo od vstupního pole. Kliknutím aktivujete webové vyhledávání: AI před každou odpovědí automaticky prohledá internet a výsledky zahrne do kontextu. Aktivní stav je indikován zeleným zvýrazněním tlačítka a štítkem „Web search aktivní". Dostupné pouze pokud je nastaven Firecrawl API klíč.</li>
  <li><strong>Automatické čtení URL</strong> – pokud vaše zpráva obsahuje URL adresu (začínající https://), AI ji automaticky přečte a obsah stránky použije jako kontext pro odpověď. Nad vstupním polem se zobrazí zelený štítek „Stránka bude přečtena". Lze vložit až 2 URL najednou.</li>
  <li><strong>Indikátor webového kontextu</strong> – u odeslaných zpráv, ke kterým byl přiložen webový kontext (vyhledávání nebo scraping), se zobrazí zelená ikonka 🌐 a text „web" pod bublinou.</li>
  <li><strong>Počítadlo Firecrawl kreditů (🔥)</strong> – v levém panelu (pod seznamem konverzací) se zobrazuje stav spotřebovaných kreditů. Barva: zelená (≥200 zbývá), oranžová (50–199), červená (&lt;50 – zobrazí se i varování). Free Plan má 500 jednorázových kreditů (1 kredit za URL, ~7 za web search).</li>
</ul>
<p><strong>Přístupová práva</strong> – AI asistent je dostupný pro master admina, workspace admina (owner/admin) a uživatele s explicitně uděleným oprávněním <code>can_use_ai_assistant</code> (nastavitelné v záložce <strong>Nastavení → AI asistent</strong>). Admin tam může také omezit, které AI modely má každý uživatel k dispozici.</p>
<p><strong>Nastavení API klíčů</strong> – AI asistent vyžaduje platný API klíč od OpenAI (<code>OPENAI_API_KEY</code>). Pro funkce web search a URL čtení je navíc potřeba Firecrawl klíč (<code>FIRECRAWL_API_KEY</code>). Oba klíče se přidávají do <code>.env.local</code> pro lokální vývoj a do Vercel Environment Variables pro produkci. Pokud OpenAI klíč chybí, zobrazí se červené upozornění přímo na stránce AI asistenta.</p>

<h3>Převodník textu</h3>
<p>Modul <strong>Převodník textu</strong> (dostupný v tarifu <strong>Pro a Max</strong>, sekce <strong>NÁSTROJE</strong>) podporuje dva směry konverze:</p>
<p><strong>Mód 1: Formátovaný text → Text / Markdown</strong> – vložte naformátovaný text z Wordu nebo webu (Ctrl+V) do levého panelu. Výstupní záložky:</p>
<ul>
  <li><strong>Prostý text</strong> – odstraní veškeré formátování, zachová pouze odřádkování.</li>
  <li><strong>Markdown</strong> – zachová strukturu: nadpisy H1–H6, tučné, kurzívu, přeškrtnutí, kód, seznamy, odkazy.</li>
</ul>
<p><strong>Mód 2: Markdown → Formátovaný text / Prostý text</strong> – zadejte nebo vložte Markdown do levého panelu (editovatelné textové pole). Výstupní záložky:</p>
<ul>
  <li><strong>Formátovaný text</strong> – vizuální náhled vyrenderovaného Markdownu (nadpisy, tučné, seznamy…); tlačítko „Kopírovat HTML" zkopíruje zdrojový HTML kód.</li>
  <li><strong>Prostý text</strong> – text bez jakéhokoli formátování.</li>
</ul>
<p>Přepínač módu se nachází v horní části stránky. Tlačítko <em>Kopírovat</em> v každé záložce zkopíruje výstup do schránky. Tlačítko <em>Vymazat vše</em> vyčistí oba panely.</p>

<h3>Důležité dny</h3>
<p>Modul <strong>Důležité dny</strong> (sekce <strong>SLEDOVÁNÍ</strong>, tarif Pro a Max) slouží k evidenci osobních důležitých dat a opakujících se událostí. Záznamy jsou soukromé – každý uživatel vidí pouze své vlastní.</p>
<ul>
  <li><strong>Jednorázový záznam</strong> – konkrétní den nebo rozsah od–do (např. narozeniny, výroční akce, projektový termín)</li>
  <li><strong>Opakující se události</strong> – po přepnutí na opakování lze vybrat: <em>Každý týden</em> (stejný den v týdnu), <em>Každý měsíc</em> (stejný den v měsíci) nebo <em>Každý rok</em> (stejné datum). U opakujících se событий se zadává pouze datum začátku opakování.</li>
  <li><strong>Barva</strong> – každý záznam má vlastní barvu z palety 12 barev pro snadné rozlišení</li>
  <li><strong>Poznámka</strong> – volitelný textový popis záznamu</li>
</ul>
<p><strong>Zobrazení v Plánovači:</strong> Důležité dny se zobrazují v záhlaví Plánovače jako barevné proužky přes příslušné sloupce. Vícedenní záznamy tvoří jeden proužek přesahující přes celý rozsah dnů. Opakující se záznamy se zobrazují pro každý odpovídající den. Přehled je personalizovaný – každý uživatel vidí pouze své záznamy.</p>

<h3>Prompty</h3>
<p>Modul <strong>Prompty</strong> (sekce <strong>NÁSTROJE</strong>, tarif Pro a Max) slouží k evidenci AI promptů ve strukturovaných složkách. Každý prompt obsahuje název, autora, datum vytvoření a formátovaný obsah.</p>
<ul>
  <li><strong>Složky</strong> – lze vytvořit libovolnou strukturu až 5 úrovní podsložek (tlačítko + v levém panelu nebo ikonka + na hover nad složkou). Složku může přejmenovat a smazat pouze její majitel. Smazaná složka neodstraní prompty v ní.</li>
  <li><strong>Sdílení složek</strong> – ikonka sdílení (na hover nad složkou) umožňuje sdílet celou složku buď s celým workspacem nebo jen s konkrétními uživateli. Sdílené složky jsou označeny modrou ikonkou.</li>
  <li><strong>Soukromé vs. sdílené prompty</strong> – při vytváření promptu lze zaškrtnout „Sdílet s celým workspacem" (i bez sdílené složky)</li>
  <li><strong>Editor</strong> – toolbar s formátováním: H2, H3, Tučné, Kurzíva, Podtržení, odrážkový a číselný seznam, blok kódu. Kódové bloky mají tmavé pozadí a monospace font.</li>
  <li><strong>Kopírování</strong> – tlačítko „Kód" kopíruje obsah prvního kódového bloku v promptu; ikona kopírování (dvě stránky) kopíruje celý textový obsah promptu (bez HTML formátování)</li>
  <li><strong>Liky</strong> – každý uživatel může dát jeden like (srdíčko). Počet unikátních liků se zobrazuje u každého promptu. Výpis lze seřadit dle liků.</li>
  <li><strong>Oblíbené</strong> – hvězdičkou označíte prompt jako oblíbený; v levém panelu se zobrazí sekce „Oblíbené" s počtem</li>
  <li><strong>Sdílené prompty</strong> – pokud workspace obsahuje sdílené prompty, zobrazí se v levém panelu virtuální složka <em>Sdílené prompty</em>. Kliknutím zobrazíte všechny prompty označené jako sdílené bez ohledu na jejich složku.</li>
  <li><strong>Komentáře</strong> – kliknutím na název promptu se otevře editační dialog, kde jsou v dolní části zobrazeny komentáře a pole pro nový komentář (Enter nebo tlačítko Odeslat). Vlastní komentáře lze <strong>upravit</strong> (ikona tužky) nebo <strong>smazat</strong> (ikona koše). Komentáře jsou evidovány se jménem autora a datem.</li>
  <li><strong>Smazání</strong> – prompt může smazat pouze jeho autor (ikona koše)</li>
</ul>

<h3>Záložky</h3>
<p>Modul <strong>Záložky</strong> (sekce <strong>NÁSTROJE</strong>, tarif Pro a Max) funguje jako sdílená záložkovací knihovna – uložte si URL článků, videí, webů nebo dokumentů a sdílejte je s týmem.</p>
<ul>
  <li><strong>Složky a sdílení</strong> – stejný systém jako u Promptů: až 5 úrovní podsložek, sdílení s workspacem nebo konkrétními uživateli</li>
  <li><strong>Ve výpisu</strong> – favicon webu, název (klikací odkaz do nového okna), doména (odkaz na homepage webu), iniciály autora s barevným avatarem, datum, badge Sdílená</li>
  <li><strong>Všechny URL</strong> se otevírají v novém okně prohlížeče (target=_blank)</li>
  <li><strong>Popis</strong> – volitelný krátký text k záložce, zobrazí se pod doménou</li>
  <li><strong>Kopírování URL</strong> – ikona kopírování vedle záložky zkopíruje URL do schránky jedním kliknutím</li>
  <li><strong>Sdílené záložky</strong> – pokud workspace obsahuje sdílené záložky, zobrazí se v levém panelu virtuální složka <em>Sdílené záložky</em>. Kliknutím zobrazíte všechny záložky označené jako sdílené bez ohledu na složku.</li>
  <li><strong>Liky a oblíbené</strong> – stejný systém jako u Promptů</li>
  <li><strong>Komentáře</strong> – kliknutím na ikonku bubliny se rozbalí detail s komentáři. Vlastní komentáře lze <strong>upravit</strong> (ikona tužky) nebo <strong>smazat</strong> (ikona koše).</li>
  <li><strong>Smazání</strong> – záložku může smazat pouze její autor</li>
  <li><strong>URL prefix</strong> – při zadání URL bez protokolu se automaticky doplní https://</li>
</ul>

<h3>Úpravy aplikace</h3>
<p>Stránka <strong>Úpravy aplikace</strong> je dostupná pouze pro <strong>Master Admina</strong> (odkaz v levém menu pod „Nahlásit chybu"). Slouží jako soukromý úkolník k evidenci nápadů a požadavků na rozvoj aplikace.</p>
<ul>
  <li><strong>Bug / Nápad / Požadavek / Poznámka</strong> – typ položky; Poznámka (šedý badge) slouží pro obecné poznámky a interní zápisky bez specifické kategorie</li>
  <li><strong>Priorita</strong> – Nízká (šedý pruh) / Střední (žlutý pruh) / Vysoká (červený pruh)</li>
  <li><strong>Stav</strong> – Otevřeno / Řeší se / Hotovo</li>
</ul>
<p>Každá položka je zobrazena jako <strong>skládací karta</strong> – header ukazuje typ, prioritu, stav, datum a název; kliknutím se rozbalí popis a ovládací prvky (změna stavu, Upravit, Archivovat). Formulář pro přidání/úpravu má větší pole pro popis, které se automaticky rozrůstá při psaní.</p>
<p>Filtrování: záložky <strong>Vše (otevřené) / Bug / Nápad / Požadavek / Poznámka / Hotové / Archiv</strong> + vyhledávání podle názvu nebo popisu.</p>
<p><strong>Archiv:</strong> Tlačítko <em>Archivovat</em> (dříve Smazat) přesune položku do archivu místo trvalého smazání. V záložce <strong>Archiv</strong> lze:</p>
<ul>
  <li>Označit jednotlivé položky zaškrtávátkem nebo kliknutím na kartu</li>
  <li>Označit <strong>vše najednou</strong> pomocí checkboxu v liště nahoře</li>
  <li>Kliknout <strong>Trvale smazat (N)</strong> pro hromadné trvalé smazání vybraných položek</li>
  <li>Kliknout <strong>Obnovit</strong> u konkrétní položky – vrátí ji do stavu Otevřeno</li>
  <li>Kliknout <strong>Trvale smazat</strong> u konkrétní položky – permanentní smazání</li>
</ul>
<p><strong>Přesun z Bug logu:</strong> V sekci Nahlásit chybu (Master Admin vidí tlačítko <strong>→ Úpravy aplikace</strong> u každého reportu po rozbalení karty) se kliknutím automaticky vytvoří položka v Úpravách. Obsah pole Poznámka se přenese do popisu. Přesunuté bugy jsou okamžitě označeny zeleným štítkem <em>„Přesunuto ✓"</em> v headeru karty a nelze je přesunout znovu. Přesunuté položky v Úpravách aplikace jsou označeny štítkem <em>„Z Bug logu"</em>. Původní report zůstane v Bug logu nezměněn.</p>
<p><strong>Poznámka Master Admina:</strong> Poznámka se zobrazuje v šedém poli. Na pravém kraji řádku jsou dvě ikonky – <em>tužka</em> (upravit) a <em>koš</em> (smazat). Pokud poznámka dosud neexistuje, zobrazuje se odkaz „+ Přidat poznámku".</p>

<h3>Oblíbené v levém menu</h3>
<p>Funkce <strong>Oblíbené</strong> je dostupná pro tarify <strong>Pro a Max</strong>. Umožňuje přidat libovolnou položku z levého menu do sekce <strong>OBLÍBENÉ</strong>, která se zobrazuje úplně nahoře v navigaci.</p>
<ul>
  <li><strong>Přidání do oblíbených</strong> – hvězdičky jsou ve výchozím stavu neviditelné. Po najetí myší na položku v menu se hvězdička zobrazí na pravém okraji. Kliknutím se položka přidá do sekce OBLÍBENÉ (hvězdička zežloutne a zůstane viditelná jako trvale zlatá).</li>
  <li><strong>Odebrání z oblíbených</strong> – v sekci OBLÍBENÉ se u každé položky na hover zobrazí křížek. Kliknutím na křížek se položka ze sekce odebere (ale v původní sekci zůstane).</li>
  <li><strong>Uložení</strong> – oblíbené se ukládají v prohlížeči (localStorage) per workspace; jsou tedy dostupné i po obnovení stránky.</li>
  <li><strong>Sekce je sbalitelná</strong> stejně jako ostatní skupiny v levém menu.</li>
</ul>

<h3>České státní svátky v Plánovači</h3>
<p>V <strong>Plánovači</strong> se v záhlaví týdne zobrazují <strong>státní svátky ČR</strong> jako červené proužky (pill) nad příslušným dnem. Pokud je daný den svátek, zobrazí se červený proužek s názvem svátku přesahující přes daný sloupec. Proužky státních svátků a proužky důležitých dnů se automaticky řadí do řádků vedle sebe bez překryvů.</p>
<p>Plánovač zobrazuje všechny státní svátky ČR: Nový rok, Velký pátek, Velikonoční pondělí, Svátek práce, Den vítězství, Den Cyrila a Metoděje, Den Jana Husa, Den české státnosti, Den vzniku ČSR, Den boje za svobodu a demokracii, Štědrý den, 1. a 2. svátek vánoční.</p>

<h3>Časová zóna workspace</h3>
<p>V <strong>Nastavení → Obecné</strong> lze nastavit <strong>Časovou zónu</strong> workspace. Tato zóna určuje, co celá aplikace považuje za „dnešní datum" – bez ohledu na to, z jaké země se člen týmu právě přihlásí.</p>
<p><strong>Co ovlivňuje:</strong></p>
<ul>
  <li><strong>Plánovač</strong> – zvýraznění dnešního sloupce modrým nadpisem a odkazem tlačítka <em>Dnes</em></li>
  <li><strong>Přehled hodin</strong> – tlačítko <em>Dnes</em> přejde na týden obsahující dnešní datum dle workspace zóny</li>
  <li><strong>Analýza kategorií</strong> – výchozí rozsah <em>Dnes</em> a <em>Týden</em> vychází z workspace zóny</li>
  <li><strong>Dovolená</strong> – výchozí rok pro zobrazení nároku odpovídá workspace zóně</li>
</ul>
<p>Výchozí hodnota je <strong>Praha / Bratislava (UTC+1/+2)</strong>. Pro týmy pracující výhradně v ČR/SK není nutné nic měnit. Pro mezinárodní týmy nastavte zónu podle sídla/hlavní provozovny.</p>

<h3>Modulární systém</h3>
<p>Aplikace je rozdělena do <strong>modulů</strong>, které lze zapnout nebo vypnout. Výchozí sada modulů závisí na tarifu workspace:</p>
<ul>
  <li><strong>Free</strong> – Měřič, Reporty, Projekty, Klienti, Štítky, Tým</li>
  <li><strong>Pro</strong> – Free + Plánovač, Dovolená, Fakturace, Přehled hodin, Analýza kategorií, Podřízení, Poznámky manažera, Nastavení, Převodník textu, Důležité dny, Žádosti, <strong>Prompty</strong>, <strong>Záložky</strong>, sekce Společnost (Znalostní báze, Dokumenty, Firemní pravidla, Pravidla v kanceláři, Připomínky) + funkce <strong>Oblíbené</strong> v levém menu</li>
  <li><strong>Max</strong> – Pro + Audit log + Kalendář + <strong>AI asistent</strong></li>
</ul>
<p>Admin může v <strong>Nastavení → Moduly</strong> nastavit výjimky pro jednotlivé uživatele – přidat modul, který není v tarifu, nebo zakázat modul, který v tarifu je. Výjimky mají vždy přednost před výchozím tarifem. Moduly, které uživatel nemá povoleny, se nezobrazují v levém menu.</p>
<p>Master Admin může v <strong>Nastavení aplikace</strong> (sekce Systém) globálně změnit, které moduly jsou součástí každého tarifu. Konfigurace se okamžitě projeví pro všechny workspace.</p>

<h3>Správa workspace (Master Admin)</h3>
<p>Stránka <strong>Správa workspace</strong> (sekce Systém, viditelná pouze pro Master Adminy) zobrazuje přehled všech workspace na platformě. Každá karta workspace obsahuje:</p>
<ul>
  <li><strong>Kód workspace</strong> s ikonkou pro rychlé zkopírování</li>
  <li><strong>Datum vytvoření</strong>, počet schválených členů a počet <strong>aktivních členů za posledních 30 dní</strong> (uživatelé, kteří vytvořili alespoň jeden time entry)</li>
  <li><strong>Kontakt na vlastníka/admina</strong> – jméno, e-mail a telefon s ikonkami kopírování</li>
  <li><strong>Archivace</strong> – workspace lze archivovat (data zůstanou zachována, jde obnovit) nebo <strong>přesunout do koše</strong> (smazat); smazané workspace jsou viditelné v záložce Smazané a lze je obnovit nebo trvale odstranit</li>
</ul>
<p>Záložky přepínají mezi <strong>Aktivními</strong>, <strong>Archivovanými</strong> a <strong>Smazanými</strong> workspace. Nad kartami je vyhledávací pole pro filtrování podle názvu.</p>

<h3>Nastavení aplikace (Master Admin)</h3>
<p>Stránka <strong>Nastavení aplikace</strong> (sekce Systém, viditelná pouze pro Master Adminy) je rozdělena do dvou záložek:</p>
<ul>
  <li><strong>Nastavení tarifů</strong> – matice modulů × tarifů (Free / Pro / Max), kde lze zaškrtnutím nebo odškrtnutím každého políčka definovat, které moduly jsou v daném tarifu dostupné. Tlačítko <em>Uložit konfiguraci</em> uloží nastavení do DB; tlačítko <em>Obnovit výchozí</em> smaže konfiguraci z DB a obnoví hardcoded výchozí hodnoty. Individuální výjimky nastavené v <strong>Nastavení workspace → Moduly</strong> mají vždy přednost před tarifní konfigurací.</li>
  <li><strong>Systémová oznámení</strong> – viz sekce níže.</li>
</ul>

<h3>Systémová oznámení (Master Admin)</h3>
<p>V záložce <strong>Systémová oznámení</strong> stránky Nastavení aplikace může Master Admin vytvářet systémové zprávy zobrazené všem uživatelům aplikace jako banner nad horní lištou (timerem).</p>
<ul>
  <li><strong>Vytvoření oznámení</strong> – každé oznámení má: volitelný <em>Nadpis</em> (tučně zvýrazněn v banneru), povinný <em>Text zprávy</em>, <em>Barvu</em> banneru z palety barev, přepínač <em>Aktivní / Neaktivní</em> a volitelný časový rozsah: <em>Zobrazit od</em> a <em>Zobrazit do</em>.</li>
  <li><strong>Plánování oznámení</strong> – oznámení lze vytvořit předem a nastavit přesný datum a čas, kdy se banner začne zobrazovat a kdy zmizí. Oznámení mimo nastavený časový rozsah se uživatelům nezobrazí i přesto, že jsou označena jako aktivní.</li>
  <li><strong>Aktivace / Deaktivace</strong> – kliknutím na přepínač u každého oznámení ho lze okamžitě aktivovat nebo deaktivovat bez nutnosti otevírat editační formulář.</li>
  <li><strong>Stavy oznámení</strong> – <em>Zobrazuje se</em> (aktivní a v platném časovém rozsahu), <em>Aktivní (mimo čas)</em> (aktivní, ale mimo rozsah od–do), <em>Neaktivní</em>.</li>
  <li><strong>Náhled</strong> – formulář zobrazuje live náhled, jak bude banner vypadat uživatelům.</li>
</ul>
<p><strong>Zobrazení banneru u uživatelů:</strong> Aktivní oznámení v platném časovém rozsahu se zobrazí jako barevný pruh v horní části aplikace nad řádkem s timerem. Každý uživatel může banner skrýt kliknutím na křížek – skrytí se uloží v prohlížeči a banner se po obnovení stránky znovu nezobrazí. Zobrazuje se všem uživatelům bez ohledu na workspace nebo roli.</p>

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
<p>Levý sidebar je členěn do šesti sekcí: <strong>SLEDOVÁNÍ</strong>, <strong>ANALÝZA</strong>, <strong>NÁSTROJE</strong>, <strong>SPRÁVA</strong>, <strong>SPOLEČNOST</strong> (dostupná od tarifu Pro) a <strong>SYSTÉM</strong> (viditelná pouze pro Master Adminy). Každou sekci lze kliknutím na její název sbalit nebo rozbalit – šipka indikuje aktuální stav. Stav sbalení se ukládá v prohlížeči a přetrvá i po obnovení stránky.</p>
<p><strong>Odznaky (badge) v navigaci:</strong> U položek Dovolená, Žádosti, Fakturace a Připomínky se v sidebaru zobrazují červené odznaky s počtem nevyřízených položek. U Dovolené jde o čekající žádosti o dovolenou, u Žádostí o čekající žádosti zaměstnanců, u Fakturace o vrácené a čekající faktury, u Připomínek o nevyřízené anonymní připomínky. Odznaky se zobrazují pouze oprávněným uživatelům (manažeři, admini, uživatelé s příslušným oprávněním).</p>

<h3>Detailní nastavení (osobní profil)</h3>
<p>V levém dolním rohu sidebaru je panel přihlášeného uživatele. Kliknutím na něj se rozbalí možnosti: odkaz <strong>Detailní nastavení</strong> (profil, jméno, e-mail, telefon, barva avataru, barevný režim) a tlačítko <strong>Odhlásit se</strong>. Pole <strong>Pozice</strong> v profilu je editovatelné pouze pro adminy – ostatní vidí hodnotu nastavenou adminem.</p>

<h3>Oslovení (jak vás aplikace oslovuje)</h3>
<p>V <strong>Detailní nastavení → Profil</strong> najdete pole <em>„Jak tě má aplikace oslovovat"</em> (max 30 znaků). Oslovení se zobrazuje v úvodním pozdravení na stránce Přehled (např. „Dobré ráno, Honzo!"). Při prvním uložení profilu se pole předvyplní křestním jménem z Zobrazovaného jména. Oslovení může být přezdívka, zkrácené jméno nebo jiná forma oslovení.</p>

<h3>Měřič v záhlaví na všech stránkách</h3>
<p>Ve výchozím nastavení je Měřič (timer) viditelný pouze na stránce Měřič. Pokud chcete mít přístup k timeru i na ostatních stránkách (Přehled, Reporty, Tým apod.), zapněte v <strong>Detailní nastavení → Zobrazení aplikace</strong> přepínač <em>„Zobrazovat Měřič v záhlaví na všech stránkách"</em>. Toto nastavení je per-uživatel a nijak neovlivňuje ostatní členy workspace.</p>

<h3>Automatické skrývání záhlaví na mobilu</h3>
<p>Na mobilních zařízeních se záhlaví aplikace (včetně panelu Měřiče) automaticky skryje při scrollu dolů, aby uvolnilo více místa pro obsah. Záhlaví se opět zobrazí:</p>
<ul>
  <li>Při <strong>rychlém scrollu nahoru</strong> (rychlost &gt; 300 px/s)</li>
  <li>Po odscrollování <strong>alespoň 100 px zpět</strong> nahoru (i pomalejším tempem)</li>
  <li>Vždy, když jste <strong>na vrcholu stránky</strong> (méně než 60 px od vrchu)</li>
</ul>
<p>Pomalý scroll nahoru záhlaví záměrně nezobrazí. Na desktopu a tabletu se záhlaví neskrývá nikdy.</p>

<h3>Měřič u spodní hrany obrazovky (mobilní)</h3>
<p>Na mobilních zařízeních (telefon) lze panel Měřiče přesunout ze záhlaví ke <strong>spodní hraně obrazovky</strong> jako pevnou lištu. Zapněte v <strong>Detailní nastavení → Zobrazení aplikace</strong> přepínač <em>„Měřič u spodní hrany obrazovky (pouze mobil)"</em>. Na desktopu a tabletu tato volba nemá žádný efekt – Měřič tam zůstává v záhlaví. Při aktivní spodní liště se obsah stránky automaticky odsadí. Lišta respektuje bezpečnou oblast displeje (safe area) – na iPhonech se zaoblenými displeji jsou tlačítka dostatečně daleko od hrany. Obě volby lze kombinovat: „záhlaví na všech stránkách" řídí <em>zda</em> se Měřič zobrazí, „spodní hrana" řídí <em>kde</em> se zobrazí na mobilu.</p>

<h3>Pozvánky v Kalendáři</h3>
<p>Pokud vás někdo pozval na událost, najdete všechny pozvánky na jednom místě – tlačítkem <strong>Pozvánky</strong> (ikona obálky) v horním záhlaví Kalendáře, přístupné ze všech pohledů (Den / Týden / Měsíc / Seznam). Červený odznak na tlačítku ukazuje počet pozvánek čekajících na odpověď.</p>
<p>V panelu Pozvánky:</p>
<ul>
  <li>Filtrujte dle stavu: <strong>Vše / Čeká na odpověď / Přijato / Nezávazně / Odmítnuto</strong></li>
  <li>Hledejte v názvech událostí pomocí pole <em>Hledat…</em></li>
  <li>U každé pozvánky vidíte datum, čas, jméno organizátora a aktuální stav</li>
  <li>Tlačítky <strong>✓ / ~ / ✗</strong> okamžitě změňte svůj stav (Přijmout / Nezávazně / Odmítnout)</li>
  <li>Odmítnuté pozvánky jsou zobrazeny zesvětleně a přeškrtnutě</li>
  <li>Při více než 20 pozvánkách se načítají postupně (tlačítko „Načíst dalších N")</li>
</ul>

<h3>Navigace v Nastavení workspace</h3>
<p>Nastavení workspace využívá <strong>vertikální postranní menu</strong> vlevo s 8 sekcemi: Obecné, Společnost, Předplatné, Fakturace, Povinná pole, Dovolená, Spolupráce a Moduly. Aktivní sekce je zvýrazněna bílým pozadím. Kliknutím na název sekce se obsah zobrazí v pravé části.</p>

<h3>Předplatné workspace</h3>
<p>Záložka <strong>Předplatné</strong> v Nastavení workspace zobrazuje informace o aktuálním tarifu a historii fakturace. Dostupná pro adminy a vlastníky workspace.</p>
<ul>
  <li><strong>Aktuální plán</strong> – zobrazuje aktivní tarif (Free / Pro / Max) s popisem</li>
  <li><strong>Platební údaje</strong> – sekce pro budoucí nastavení platební metody</li>
  <li><strong>Historie</strong> – tabulka měsíčních snapshotů: datum, tarif a počet aktivních uživatelů v daném měsíci. Snapshot za aktuální měsíc se vygeneruje automaticky při prvním zobrazení záložky.</li>
  <li><strong>Přechod na Free</strong> – vlastník workspace a Master Admin mohou downgraduovat na tarif Free (po potvrzení); funkce je dostupná pouze pokud je aktuální tarif vyšší než Free</li>
</ul>

<h3>Sekce Společnost – nastavení per workspace</h3>
<p>V záložce <strong>Společnost</strong> v Nastavení workspace (dostupná adminům) lze zapínat a vypínat jednotlivé moduly sekce Společnost pro daný workspace:</p>
<ul>
  <li><strong>Znalostní báze</strong> – interní wiki pro správu stránek ve složkách, rich text editor, verze, komentáře a přístupová práva</li>
  <li><strong>Dokumenty</strong> – centrální úložiště firemních souborů a odkazů</li>
  <li><strong>Firemní pravidla</strong> – rich-text stránka se směrnicemi workspace</li>
  <li><strong>Pravidla v kanceláři</strong> – provozní řád a každodenní kancelářská pravidla</li>
</ul>
<p>Modul je přístupný pouze tehdy, pokud je zapnutý v záložce Společnost <em>a zároveň</em> povolen v tarifové matici (App Settings). Globální nastavení tarifu má přednost.</p>

<h3>Pozvánky</h3>
<p>Nové členy workspace lze přidat v sekci <strong>Tým → Členové</strong>: sdílejte kód pro připojení, nový člen ho zadá při registraci a čeká na schválení adminem.</p>

<h3>Plánovač</h3>
<p>Stránka <strong>Plánovač</strong> (sekce Sledování) zobrazuje dostupnost celého týmu pro aktuální týden v přehledné tabulce. Každý člen má jeden řádek; každý den se zobrazuje jako <strong>jedna buňka pokrývající celý den</strong> (výchozí stav).</p>
<ul>
  <li><strong>Stavy dostupnosti</strong> – admin/Master Admin si definuje vlastní stavy (např. V kanceláři, Home office, Dovolená) s libovolnou barvou v sekci „Spravovat stavy"</li>
  <li><strong>Nastavení dostupnosti</strong> – kliknutím na buňku se otevře picker se stavy; každý uživatel edituje svůj vlastní řádek; admin a manažer mohou editovat i ostatní uživatele</li>
  <li><strong>Rozdělení na DOP / ODP</strong> – každá buňka má při najetí myší v pravém rohu ikonku rozdělení. Kliknutím se buňka rozdělí na dopoledne (DOP) a odpoledne (ODP) – každá půlka má vlastní stav i poznámku. Ikonkou sloučení lze opět vrátit na celý den (zachová se stav z dopoledne).</li>
  <li><strong>Poznámka</strong> – ke každé buňce (celý den i DOP/ODP) lze přidat volitelnou poznámku zobrazenou při najetí myší; přítomnost poznámky indikuje výraznější ikonka v pravém rohu buňky</li>
  <li><strong>Navigace týdnem</strong> – šipky vlevo/vpravo přepínají mezi týdny; tlačítko „Dnes" skočí na aktuální týden</li>
  <li><strong>Připnutí kolegů</strong> – kliknutím na hvězdičku vedle jména lze kolegu „připnout" na začátek seznamu pro rychlý přístup</li>
  <li><strong>Viditelnost</strong> – Admin/Master Admin vidí všechny členy; Team Manager vidí sebe a svůj tým; Member vidí sebe a spoluhráče se stejným manažerem</li>
  <li><strong>Synchronizace s Dovolená</strong> – nastavení stavu „Dovolená" (celý den, ne DOP/ODP) pro uživatele s příznakem „Může čerpat dovolenou" automaticky vytvoří 1denní záznam v Dovolené (pouze pracovní dny Po–Pá). Odebrání stavu nebo změna na jiný stav smaže odpovídající 1denní záznam z Dovolené. Vícedenní záznamy vytvořené ze stránky Dovolená se touto akcí nemažou. Aby sync fungoval, stav musí mít přesný název <strong>„Dovolená"</strong>.</li>
</ul>

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

<h3>Žádosti</h3>
<p>Modul <strong>Žádosti</strong> (sekce Sledování, tarif Pro a Max) umožňuje zaměstnancům podávat formální žádosti svému nadřízenému ke schválení. Stránka obsahuje průvodce kategoriemi přímo v aplikaci.</p>
<ul>
  <li><strong>Kategorie žádostí</strong> – Hardware a zařízení, Software a licence, Přístupy a oprávnění, Pracovní prostor a vybavení, Finanční žádosti, HR a personální žádosti, Vzdělávání a rozvoj, Cestování a služební cesty, Benefity a odměňování, Nábor a posílení týmu, Bezpečnost a compliance, Technická podpora a IT servis, Právní a administrativní</li>
  <li><strong>Podání žádosti</strong> – vyberte kategorii, zadejte stručný název a doplňující poznámku; klikněte „Odeslat žádost"</li>
  <li><strong>Průvodce kategoriemi</strong> – rozkliknutelný panel přímo na stránce Žádosti popisuje, co do které kategorie spadá</li>
  <li><strong>Stav žádosti</strong> – Čeká na vyřízení (žlutý štítek), Schváleno (zelený štítek), Zamítnuto (červený štítek s poznámkou)</li>
  <li><strong>Záložka Moje žádosti</strong> – přehled všech vašich žádostí s aktuálním stavem; zamítnuté žádosti zobrazují poznámku od nadřízeného</li>
  <li><strong>Záložka Ke zpracování</strong> – viditelná pro manažery a adminy; přehled čekajících žádostí od podřízených s tlačítky Schválit a Zamítnout</li>
  <li><strong>Záložka Archiv</strong> – přehled všech vyřízených žádostí (schválených i zamítnutých). U zamítnutých žádostí se štítek „Zamítnuto" zobrazuje pod hlavním obsahem kartičky, těsně nad blokem s důvodem zamítnutí.</li>
  <li><strong>Kdo zpracovává žádosti</strong> – primárně přímý manažer; admini vidí žádosti všech; konfiguruje se v Tým → Členové (příznak „Zpracovává žádosti")</li>
</ul>

<h3>Připomínky (anonymní formulář)</h3>
<p>Modul <strong>Připomínky</strong> (sekce <strong>SPOLEČNOST</strong>, tarif Pro a Max) umožňuje všem členům workspace anonymně sdílet podněty, návrhy nebo zpětnou vazbu.</p>
<ul>
  <li><strong>Anonymita</strong> – připomínky jsou zcela anonymní; nikdo (ani admin) nemůže zjistit, kdo zprávu odeslal</li>
  <li><strong>Odeslání připomínky</strong> – vyplňte zprávu a klikněte Odeslat; formulář jasně upozorňuje na anonymitu</li>
  <li><strong>Zobrazení připomínek</strong> – přijaté připomínky vidí uživatelé s příznakem „Přijímá připomínky" (nastavuje admin v Tým → Členové) a Master Admin vždy</li>
  <li><strong>Správa připomínek</strong> – přijímatelé vidí seznam zpráv seřazených od nejnovější; každou připomínku lze označit jako vyřízenou nebo smazat</li>
</ul>

<h3>Sekce SPOLEČNOST</h3>
<p>Od tarifu <strong>Pro</strong> je v levém menu dostupná sekce <strong>SPOLEČNOST</strong> s pěti moduly pro správu firemních znalostí, dokumentace a zpětné vazby:</p>
<ul>
  <li><strong>Znalostní báze</strong> – interní wiki pro sdílení firemních znalostí a postupů; stránky jsou uspořádány do hierarchických složek s neomezenou hloubkou; podporuje rich text editor (H1–H3, tučné, kurzíva, podtržení, seznamy, oddělovač, kontrolní seznam, callout, přepínací blok, kód s kopírováním, hypertextový odkaz), fulltextové vyhledávání, štítky, přístupová práva (omezené stránky per-user), historii verzí s možností navrácení, revizní připomínky, komentáře, stavy stránky (Koncept/Aktivní/Archiv), oblíbené a 5 šablon</li>
  <li><strong>Dokumenty</strong> – správa firemních souborů a odkazů; dokumenty lze organizovat do barevných složek; všichni členové workspace vidí dokumenty, správci (admin nebo uživatel s příznakem „Spravuje dokumenty") mohou nahrávat, mazat a spravovat složky</li>
  <li><strong>Firemní pravidla</strong> – editovatelná textová stránka s firemními směrnicemi a pravidly; obsah upravuje admin/owner workspace; členové vidí aktuální obsah</li>
  <li><strong>Pravidla v kanceláři</strong> – editovatelná textová stránka s provozním řádem a pravidly kanceláře; stejný editor jako Firemní pravidla</li>
  <li><strong>Připomínky</strong> – anonymní formulář pro zpětnou vazbu; viz sekce Připomínky níže</li>
</ul>

<h3>Znalostní báze</h3>
<p>Modul <strong>Znalostní báze</strong> (sekce Společnost) je interní wiki pro tvorbu, organizaci a sdílení firemních znalostí a postupů.</p>
<ul>
  <li><strong>Složky a stránky</strong> – stránky jsou uspořádány do hierarchických složek s neomezenou hloubkou; stránky lze vytvářet přímo v kořeni nebo ve složce; levý panel zobrazuje stromovou strukturu složek a stránek</li>
  <li><strong>Rich text editor</strong> – nadpisy H1–H3, tučné/kurzíva/podtržení, odrážkový a číslovaný seznam, oddělovač, kontrolní seznam (interaktivní zaškrtávání v náhledu), callout (informační rámeček), přepínací blok (toggle/accordion), kód s kopírováním, hypertextový odkaz; v editoru lze vkládat @zmínky (členové workspace) a /odkaz na jinou stránku KB</li>
  <li><strong>Šablony</strong> – při vytvoření nové stránky si vyberte z 5 přednastavených šablon: Prázdná, Zápis z meetingu, Popis procesu, Onboarding průvodce, Dokumentace projektu</li>
  <li><strong>Fulltextové vyhledávání</strong> – hledá v názvech i obsahu stránek; výsledky se zobrazují v levém panelu</li>
  <li><strong>Štítky</strong> – každá stránka může mít libovolný počet štítků; slouží k filtrování a kategorizaci</li>
  <li><strong>Stav stránky</strong> – Koncept (žlutá), Aktivní (zelená), Archiv (šedá); stav lze měnit v editoru</li>
  <li><strong>Historie verzí</strong> – každé uložení automaticky vytvoří novou verzi; v záložce Historie lze zobrazit předchozí verze a vrátit se k libovolné z nich</li>
  <li><strong>Komentáře</strong> – v záložce Komentáře lze přidávat, upravovat a mazat komentáře k dané stránce</li>
  <li><strong>Revizní připomínky</strong> – k stránce nebo složce lze přiřadit datum revize a zodpovědnou osobu; blížící se revize se zobrazí v panelu „K vyřízení" na Přehledu</li>
  <li><strong>Přístupová práva</strong> – stránka může být označena jako omezená (příznak „Přístup omezen"); v záložce Přístupy (jen admin) se přidávají konkrétní uživatelé s oprávněním ke čtení nebo editaci</li>
  <li><strong>Oblíbené</strong> – stránky lze přidávat k oblíbeným (hvězdička); oblíbené stránky se zobrazují v horní části levého panelu</li>
</ul>

<h3>Dokumenty – správa souborů a složek</h3>
<p>Modul <strong>Dokumenty</strong> (sekce Společnost) slouží jako centrální úložiště firemních materiálů dostupných všem členům workspace.</p>
<ul>
  <li><strong>Složky</strong> – dokumenty lze organizovat do barevných složek; složky vytváří a spravuje admin nebo uživatel s oprávněním „Spravuje dokumenty"; levý panel zobrazuje všechny složky s počtem dokumentů; kliknutím filtrujete zobrazení</li>
  <li><strong>Typy dokumentů</strong> – soubory (PDF, Word, Excel, PowerPoint, obrázky, ZIP, TXT, CSV; max 20 MB) nebo webové odkazy (URL)</li>
  <li><strong>Nahrání souboru</strong> – klikněte Přidat → záložka Soubor → vyberte soubor, zadejte název, popis a složku → klikněte Přidat</li>
  <li><strong>Přidání odkazu</strong> – klikněte Přidat → záložka Odkaz (URL) → zadejte URL adresu, název a složku → klikněte Přidat</li>
  <li><strong>Otevření dokumentu</strong> – klikněte na název nebo ikonu otevření; soubory se otevírají v novém okně pomocí podepsané URL (platné 60 sekund)</li>
  <li><strong>Správa přístupu</strong> – nastavuje se v Tým → Členové → editace → příznak „Spravuje dokumenty"</li>
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
