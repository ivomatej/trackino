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

<h3>v2.39.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Automatizace – nová záložka v Nastavení workspace</strong> – nový modul automatizovaných úloh integrovaný s cron-job.org. Admini mohou přidávat naplánované joby ze 5 předpřipravených šablon, zapínat/vypínat je togglem, mazat a prohlížet historii spuštění (HTTP status, délka, čas).</li>
  <li><strong>5 šablon automatizací:</strong> (1) Týdenní AI report hodin – každé pondělí v 8:00 vygeneruje GPT-4o-mini report odpracovaných hodin za minulý týden; (2) Kontrola neaktivních členů – každé pondělí v 8:30 vypíše členy bez záznamu za 14 dní; (3) Digest revizí KB – každé pondělí v 7:00 zobrazí revize znalostní báze splatné tento týden a po splatnosti; (4) Shrnutí feedbacku (AI) – každý pátek v 16:00 AI shrne a kategorizuje anonymní připomínky za týden; (5) Report dovolených – 1. každého měsíce v 7:00 zobrazí čerpání dovolené všech členů za aktuální rok.</li>
  <li><strong>Bezpečnost</strong> – CRON_SECRET injektován server-side v proxy route (nikdy není exponován klientovi); cron handlery ověřují hlavičku X-Cron-Secret a odmítnou požadavky bez platného tokenu.</li>
  <li><strong>Výsledky automatizací</strong> – každé spuštění uloží výsledek (Markdown obsah) do tabulky <code>trackino_cron_results</code>; admin vidí posledních 20 výsledků v záložce Automatizace s rozbalovacím náhledem obsahu.</li>
  <li><strong>SQL migrace:</strong> <code>CREATE TABLE trackino_cron_results (...)</code> – viz dokumentace.</li>
</ul>

<h3>v2.38.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Znalostní báze – vkládání kdekoliv v textu</strong> – @zmínky a /odkaz na stránku se nyní vloží na aktuální pozici kurzoru (ne na konec nebo do nadpisu). Implementace: <code>savedRange</code> ref zachytí selection před otevřením pickeru; <code>onMouseDown={e => e.preventDefault()}</code> na všech toolbar tlačítkách zamezí ztrátě fokusu; při insertu se selection obnoví ze <code>savedRange</code>.</li>
  <li><strong>Znalostní báze – plovoucí panel nad označeným textem</strong> – při označení textu v editoru se zobrazí malý floating toolbar s tlačítky Odkaz / @ / Stránka; panel je pozicován fixed (viewport souřadnice z getBoundingClientRect), takže nevytéká z overflow:hidden kontejneru.</li>
  <li><strong>Znalostní báze – nový vzhled Callout a Toggle bloků</strong> – Callout: zaoblený border s barevným okrajem (color-mix primary 35%), barevné pozadí (color-mix primary 8%), žádné inline styly. Toggle: details.kb-toggle s bg-hover pozadím, animovaná šipka ▶ (rotace 90° při otevření), bez border. Šablony aktualizovány.</li>
  <li><strong>Znalostní báze – checklist bez auto textu</strong> – tlačítko „Úkol" v toolbaru vloží prázdnou položku checklist se samotným &lt;br&gt; místo textu „Položka"; uživatel začne psát ihned. CSS checkboxů: prázdný čtvereček s border, zaškrtnutý se ✓ symbolem, přeškrtnutý text.</li>
  <li><strong>Znalostní báze – Revize v hlavičce stránky</strong> – sekce Revize přesunuta z záložky „Recenze" do hlavičky každé stránky (pod meta informacemi). Zobrazuje se jako flex řada pill odznaků; červený badge s počtem nesplněných revizí; položka obsahuje jméno odpovědné osoby, datum a volitelnou poznámku; zaškrtávací checkbox přímo v pillu; admin vidí „×" pro smazání a „+ Přidat revizi" tlačítko. Tab „Recenze" odebrán – zbývají: Komentáře, Historie, Přístupy. Modální dialog přejmenován na „Přidat revizi".</li>
  <li><strong>Znalostní báze – opravy toggle tlačítek přístupů</strong> – thumb togglů ve všech switchích má nyní konzistentní pozici (top-0.5 left-0.5, translateX(0/16px)); optimistický update před voláním DB → okamžitá odezva UI.</li>
  <li><strong>AI asistent – měsíční statistiky tokenů per uživatel</strong> – v Nastavení workspace → záložka AI asistent přibyl dropdown výběru měsíce (aktuální + posledních 6 = 7 voleb) a u každého uživatele se zobrazí spotřeba tokenů a orientační cena v Kč za vybraný měsíc.</li>
  <li><strong>AI asistent – per-user token limity</strong> – pod přepínačem modelů u každého uživatele přibyla sekce s denním/týdenním/měsíčním limitem tokenů s inline tlačítkem Uložit.</li>
</ul>

<h3>v2.37.3 – 7. 3. 2026</h3>
<ul>
  <li><strong>Znalostní báze – toolbar ve dvou řádcích</strong> – editor přeorganizován: řádek 1 obsahuje H1/H2/H3, B/I/U, odrážkový/číslovaný seznam a oddělovač; řádek 2 obsahuje Kód, Odkaz, Zmínky, Stránka, Úkol (dříve Check), Infobox (dříve Callout), Toggle. Všechna tlačítka mají SVG ikony místo emoji (📄, 🔗, ℹ, ▶, ☐ odstraněny).</li>
  <li><strong>Znalostní báze – přiřazení stránky do složky</strong> – v editoru stránky přibyl select složky v metadatech; v levém panelu se při hoveru na stránku zobrazí ikonka složky pro rychlé přesunutí do jiné složky bez otevření editoru.</li>
  <li><strong>Znalostní báze – kopírování obsahu stránky</strong> – nová ikona kopírování v pravém horním rohu detailu stránky zkopíruje celý obsah jako prostý text do schránky (potvrzení zelenou fajfkou).</li>
  <li><strong>Znalostní báze – kódové bloky</strong> – kód má nyní správnou minimální výšku (3em) a Enter uvnitř kódového bloku vytvoří nový řádek (místo ukončení bloku).</li>
  <li><strong>Znalostní báze – standardní SVG ikony</strong> – všechny trash ikony (smazání stránky, komentáře, recenze, složky) nahrazeny standardní 4-path SVG ikonou shodnou s ostatními moduly. Emoji ⭐ v sekci Oblíbené nahrazeno SVG hvězdou.</li>
</ul>

<h3>v2.37.2 – 7. 3. 2026</h3>
<ul>
  <li><strong>AI asistent – oblíbené konverzace</strong> – v levém panelu přibyla hvězdička ☆ u každé konverzace (zobrazí se při najetí myší). Kliknutím označíte konverzaci jako oblíbenou – hvězdička svítí zlatě a konverzace se přesune do samostatné sekce <strong>OBLÍBENÉ</strong> v horní části seznamu. Ostatní konverzace zůstávají v sekci <strong>OSTATNÍ</strong>. Stav oblíbených je uložen v databázi a přežívá refresh i přihlášení z jiného zařízení. SQL migrace: <code>ALTER TABLE trackino_ai_conversations ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;</code></li>
  <li><strong>AI asistent – vizuální vylepšení levého panelu</strong> – aktivní konverzace je nyní zvýrazněna šedou barvou (<code>var(--bg-hover)</code>) místo modré – čistší a méně rušivý vzhled. Ikona koše nahrazena standardní čtyřcestnou SVG ikonkou shodnou s ostatními moduly aplikace.</li>
</ul>

<h3>v2.37.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>AI asistent – konverzace ukládány v databázi</strong> – každá konverzace se nyní ukládá per-user do DB (tabulky <code>trackino_ai_conversations</code> a <code>trackino_ai_messages</code>). V levém panelu vidíte historii konverzací s vyhledáváním a možností smazání. Auto-název se generuje z první zprávy.</li>
  <li><strong>AI asistent – vylepšené UI</strong> – vstupní pole pro zprávy je nyní výrazně větší (min. 80 px, max. 300 px). Přidán barevný token counter (progress bar) ukazující blízkost k limitu kontextového okna. Rychlý přepínač modelu ve spodní liště (pill tlačítka). Tlačítko ℹ otevře detail každého modelu s popisem, silnými stránkami a cenou v Kč.</li>
  <li><strong>AI asistent – přesun na tarif Max</strong> – modul AI asistent je nově dostupný pouze v tarifu <strong>Max</strong> (dříve Pro+Max). Přístup mají: master admin, workspace admin (owner/admin) a uživatelé s explicitně uděleným oprávněním <code>can_use_ai_assistant</code>.</li>
  <li><strong>Nastavení workspace – záložka AI asistent</strong> – nová záložka v nastavení workspace. Umožňuje: nastavit denní/týdenní/měsíční limit tokenů pro celý workspace s orientační cenou v Kč; per-user přepínač přístupu k AI asistentovi; omezení dostupných AI modelů per uživatel (pill checkboxy).</li>
  <li><strong>Usage data ze streamingu</strong> – API route nyní přidává usage statistiky (počet tokenů, cena) na konec každé streaming odpovědi jako speciální suffix <code>__USAGE__:{json}</code>, který klient parsuje a zobrazuje pod každou odpovědí AI.</li>
</ul>

<h3>v2.36.1 – 7. 3. 2026</h3>
<ul>
  <li><strong>AI asistent – počítadlo Firecrawl kreditů</strong> – přidáno počítadlo spotřebovaných Firecrawl kreditů ve footeru chatu (🔥 X / 500). Stav kreditů se ukládá do localStorage a přežívá refresh. Barevné kódování: zelená (≥200 zbývá), oranžová (50–199), červená (&lt;50). Při méně než 50 zbývajících kreditech se zobrazí varování nad vstupním polem. Ceny: 1 kredit za scrapování URL, ~7 kreditů za web search (2 base + 5 výsledků).</li>
</ul>

<h3>v2.36.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>AI asistent – Firecrawl integrace (web search + URL scraping)</strong> – AI asistent byl rozšířen o schopnost číst a prohledávat internet v reálném čase díky službě Firecrawl. Dvě nové funkce: <em>(a) Web search</em> – globus tlačítko (🌐) vedle vstupního pole; po aktivaci AI před každou odpovědí prohledá web a injektuje nalezené informace jako kontext do odpovědi. <em>(b) Auto URL scraping</em> – pokud zpráva obsahuje URL adresu, systém ji automaticky přečte a obsah stránky přidá jako kontext. AI tak může pracovat s aktuálními informacemi z internetu bez nutnosti kopírovat obsah stránek. Indikátory v UI: zelený štítek „Stránka bude přečtena" nebo „Web search aktivní" nad vstupním polem; animovaný zelený loading stav „🔍 Prohledávám web…" nebo „📄 Čtu stránku…" v průběhu načítání; zelená ikona 🌐 u odeslané zprávy, která obsahovala webový kontext. Dostupné pouze pokud je nastaven API klíč <code>FIRECRAWL_API_KEY</code>.</li>
  <li><strong>Server-side API routes</strong> – přidány dvě nové serverové routes: <code>POST /api/firecrawl/scrape</code> (převede URL na Markdown) a <code>POST /api/firecrawl/search</code> (webové vyhledávání s obsahem výsledků). API klíč Firecrawl je bezpečně pouze na serveru.</li>
</ul>

<h3>v2.35.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>AI asistent – nový modul (Max)</strong> – chatovací okno napojené na OpenAI API (GPT-4o, GPT-4o mini, GPT-4 Turbo, o1-mini). Funkce: výběr modelu, nastavitelná kreativita (temperature 0–1), volitelný system prompt, streamované odpovědi v reálném čase, vymazání konverzace, rychlé návrhy dotazů. Odpovědi renderují Markdown (nadpisy, tučné, kód, seznamy).</li>
  <li><strong>AI infrastructure</strong> – <code>src/lib/ai-providers.ts</code>: centrální konfigurace providerů a modelů připravená pro snadné přidání dalších AI providerů (Anthropic, Google Gemini, Mistral); <code>src/app/api/ai-chat/route.ts</code>: serverová API route (API klíče bezpečně na serveru), podpora streaming + non-streaming odpovědí.</li>
  <li><strong>Nastavení</strong> – API klíč se přidá jako env proměnná <code>OPENAI_API_KEY</code> do <code>.env.local</code> (local dev) a do Vercel Environment Variables (produkce).</li>
</ul>

<h3>v2.34.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Znalostní báze – plná implementace (15 funkcí)</strong> – modul byl kompletně přepracován z placeholderu na plnohodnotnou interní wiki. Přehled funkcí: <em>(a)</em> Stránky a podsložky – neomezená hierarchická struktura složek s vlevo panelem (stejný styl jako Prompty/Záložky). <em>(b)</em> Rich text editor – H1/H2/H3, tučné/kurzíva/podtržení, odrážky, číslovaný seznam, oddělovač (HR), kódový blok s kopírováním, vkládání odkazů s editovatelným textem a URL. <em>(c)</em> Checklist (☐/☑ v editor i view mód s kliknutím), Callout/info box (ℹ s primární barvou), Toggle/accordion blok (details/summary). <em>(d)</em> Fulltextové vyhledávání – hledá v titulku, obsahu i štítcích. <em>(e)</em> Štítky – přidávání/odebírání tagsů přímo při editaci stránky. <em>(f)</em> Přístupová práva – přepínač „Omezený přístup" (jen admin a vybraní uživatelé mohou editovat) + správa konkrétních uživatelů v záložce Přístupy. <em>(g)</em> Naposledy upraveno – datum a jméno editora pod titulkem. <em>(h)</em> Historie editací – záložka „Historie" zobrazuje verze uložené při každém uložení (who, when, title) s tlačítkem „Obnovit" pro rollback. <em>(i)</em> Revizní připomínky – záložka „Recenze": přiřadit uživatele + termín revize, notifikace v panelu „K vyřízení" na Přehledu, označit jako hotovo. <em>(j)</em> @zmínění uživatele – toolbar tlačítko @ s vyhledávacím pickerem, vloží zmínku jako styled span. /stránka odkaz – toolbar tlačítko „📄 Stránka" s pickerem stránek, vloží klikatelný odkaz na jinou KB stránku. <em>(k)</em> Šablony – výběr z 5 šablon při vytvoření nové stránky (Prázdná, Zápis z meetingu, Popis procesu, Onboarding průvodce, Dokumentace projektu). <em>(l)</em> Komentáře – záložka Komentáře s přidáváním, editací a mazáním vlastních komentářů. <em>(m)</em> Stav dokumentu – Koncept / Aktivní / Archiv (barevný badge, měnitelný při editaci). <em>(n)</em> Verze s rollbackem – každé uložení vytvoří verzi, admin/editor může obnovit libovolnou předchozí. <em>(o)</em> Oblíbené – hvězdičkové tlačítko u stránky, oblíbené stránky se zobrazují nahoře v levém panelu.</li>
  <li><strong>DB migrace</strong> – 7 nových tabulek: <code>trackino_kb_folders</code>, <code>trackino_kb_pages</code>, <code>trackino_kb_versions</code>, <code>trackino_kb_comments</code>, <code>trackino_kb_favorites</code>, <code>trackino_kb_reviews</code>, <code>trackino_kb_access</code>.</li>
</ul>

<h3>v2.33.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Analýza kategorií – filtr uživatele</strong> – administrátoři a manažeři nově mohou filtrovat analýzu kategorií dle konkrétního uživatele. Vpravo od tlačítek přepínače období (Dnes / Týden / Měsíc / Vlastní) se zobrazuje select „Všichni uživatelé". Admin vidí všechny členy workspace, manažer vidí pouze své podřízené a sebe. Výběrem konkrétního uživatele se aktualizují koláčový graf, sloupcový graf i tabulka kategorií.</li>
  <li><strong>Sidebar – scrollbar skrytý</strong> – posuvník v levém navigačním panelu (sidebar) je nyní skrytý a zobrazí se až při najetí myší na sidebar. Sidebar tak vypadá čistěji a posuvník nepřekáží při práci.</li>
</ul>

<h3>v2.32.1 – 7. 3. 2026</h3>
<ul>
  <li><strong>Definitivní oprava přetékání date/time polí na mobilech</strong> – přidáno globální CSS pravidlo <code>min-width: 0 !important</code> na všechny <code>input[type=date/time/datetime-local]</code>. Toto pravidlo přebíjí nativní minimální šířku prohlížeče (hlavně Chrome na Androidu), která způsobovala přetékání mimo modal. Doplněno <code>overflow-x-hidden</code> na kontejnerech formulářů (Dovolená, Důležité dny, Kalendář, Fakturace). ManualTimeEntry přepracován na <code>grid-cols-2 sm:grid-cols-3</code> – pole Datum zabírá na mobilu celou šířku, Od/Do jsou vedle sebe. Poznámky a Fakturace: vlastní rozsah dat přepracován na grid kontejner.</li>
</ul>

<h3>v2.32.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Mobilní opravy – přetékání datových polí (2. kolo)</strong> – přidány atributy <code>min-w-0</code> a <code>maxWidth: 100 %</code> na všechna datová vstupní pole: Dovolená (formulář), Důležité dny (modal), Reporty (filtr Od/Do), Kalendář (modal události – datum i čas). Reporty filtr Od/Do přepracován na grid kontejner s <code>w-full</code> na vstupech – pole se nyní správně vejdou na mobil bez přetékání za okraj.</li>
  <li><strong>Reporty – Nový mobilní layout položek</strong> – záznamy v seznamu reportů jsou nyní rozloženy do tří řádků: 1) název/popis (celá šířka), 2) projekt / kategorie / úkol / uživatel (celá šířka), 3) čas od–do + trvání + akce. Layout je přehlednější na mobilních zařízeních.</li>
  <li><strong>Jednotné šedé pozadí vstupních polí</strong> – sjednocena barva pozadí všech formulářových polí (inputs, selects, textareas) v celé aplikaci na šedou variantu. Celkem upraveno 72 míst v 24 souborech.</li>
</ul>

<h3>v2.31.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Přehled – Upozornění na pozvánky do kalendáře</strong> – panel „K vyřízení" na Přehledu nyní zobrazuje i čekající pozvánky do kalendáře (události, na které jste byli pozváni a dosud jste neodpověděli). Položka je fialová s ikonou kalendáře a odkazuje přímo na stránku Kalendáře. Zobrazuje se všem uživatelům s přístupem ke Kalendáři, kteří mají nevyřízené pozvánky.</li>
  <li><strong>Mobilní opravy – přetékání polí</strong> – opravena řada míst, kde formulářová pole přetékala mimo obrazovku na mobilech: datum Od/Do v Dovolené, datum Od/Do v Důležitých dnech, karty přiřazení manažerů v Týmu, datum/čas v modalu Nové události v Kalendáři a nastavení pohledu kalendáře. Přepínač období v Reportech (Dnes / Týden / Měsíc / Vlastní) nyní používá kratší text na mobilech, aby se vlezl na jeden řádek.</li>
</ul>

<h3>v2.30.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Mobil – Automatické skrývání záhlaví při scrollu</strong> – na mobilních zařízeních se záhlaví (včetně Měřiče) automaticky skryje při scrollu dolů, aby uvolnilo místo obsahu. Při rychlém scrollu nahoru (rychlost &gt; 300 px/s) nebo po odscrollování alespoň 100 px zpět se záhlaví opět zobrazí. Pomalý scroll nahoru záhlaví nezobrazí. Na vrcholu stránky (méně než 60 px od vrchu) je záhlaví vždy viditelné. Na desktopu a tabletu se záhlaví neskrývá nikdy.</li>
  <li><strong>Měřič – Lepší rozložení spodní lišty pro iPhone</strong> – spodní lišta Měřiče (volba „Měřič u spodní hrany") je nyní přizpůsobena pro iPhony se zaoblenými displeji a home indikátorem. Lišta respektuje <em>safe area</em> (výřez displeje, home indicator) a přidává dostatečné odsazení od spodního okraje, aby byla tlačítka pohodlně dostupná. Tlačítka Spustit / Zastavit jsou větší (44 × 44 px), ikony projektu a kategorie mají větší plochu pro kliknutí, tlačítko Zahodit má větší padding. Dropdowny pro výběr projektu a kategorie se nyní otevírají <em>nad</em> lištou (místo pod ní).</li>
</ul>

<h3>v2.29.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Měřič – Připnutí ke spodní hraně obrazovky (mobilní)</strong> – nová volba v Profilu → Zobrazení aplikace: <em>Měřič u spodní hrany obrazovky</em>. Po zapnutí se na mobilním zařízení (telefon) panel Měřiče přesune ze záhlaví k dolnímu okraji obrazovky jako fixní lišta. Obsah stránky se automaticky odsadí, aby nic nezůstalo schováno za lištou. Na desktopu a tabletu volba nemá žádný efekt – tam zůstává Měřič v záhlaví. Nastavení nezasahuje do volby „Zobrazovat Měřič v záhlaví na všech stránkách".</li>
  <li><strong>Kalendář – Panel Pozvánky</strong> – nové tlačítko <strong>Pozvánky</strong> (ikona obálky) v horním záhlaví kalendáře, přístupné ze všech pohledů. Červený odznak zobrazuje počet pozvánek čekajících na odpověď. Kliknutím se otevře panel se všemi událostmi, na které jste byli pozváni. V panelu: filtrování dle stavu (Vše / Čeká na odpověď / Přijato / Nezávazně / Odmítnuto), textové vyhledávání v názvech událostí, u každé pozvánky je vidět datum, čas, jméno organizátora, aktuální stav a tlačítka pro odpověď (✓ / ~ / ✗). Odmítnuté pozvánky jsou zesvětleny a přeškrtnuty. Při více než 20 pozvánkách se zobrazuje tlačítko „Načíst dalších N".</li>
</ul>

<h3>v2.28.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – RSVP: stav „Nezávazně"</strong> – přibyl třetí stav odpovědi na pozvánku. Tlačítkem <em>~ Nezávazně</em> (žluté) dáváte najevo, že přítomnost není jistá. Organizátor vidí tento stav v přehledu účastníků. Prefix „~" se zobrazí před názvem události ve všech pohledech.</li>
  <li><strong>Kalendář – RSVP: dodatečná změna odpovědi</strong> – po přijetí, odmítnutí nebo označení „Nezávazně" jsou tlačítka Přijmout / Nezávazně / Odmítnout stále viditelná v detailu události, takže odpověď lze kdykoliv změnit.</li>
  <li><strong>Kalendář – Odmítnuté události viditelné, ale zesvětlené</strong> – pokud událost odmítnete, zůstane v kalendáři viditelná, ale je zobrazena průsvitně (opacity ~45 %), název je přeškrtnut a barva je slabší. Platí ve všech pohledech: Měsíc, Týden, Den i Seznam.</li>
  <li><strong>Kalendář – Čas z mřížky</strong> – kliknutím na konkrétní hodinu v pohledu Týden nebo Den se otevře formulář pro novou událost s automaticky předvyplněným časem (např. klik na 14:00 → čas 14:00–15:00, událost není celodenní).</li>
</ul>

<h3>v2.27.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Upozornění na změnu události</strong> – pokud organizátor po vašem přijetí změní datum, čas nebo místo konání, událost se znovu označí čárkovaným rámečkem a otazníkem „?" (jako nová pozvánka). V detailu události uvidíte žlutý blok „Událost byla upravena organizátorem" se starými hodnotami přeškrtnutými a novými hodnotami. Tlačítko „Beru na vědomí" (nebo „Odmítnout") potvrdí přijetí změny.</li>
  <li><strong>Kalendář – Organizátor vidí stav</strong> – v přehledu účastníků u vlastní události nově vidíte ikonu <strong>!</strong> (žlutě) u těch, kteří ještě nepotvrdili upravenou verzi.</li>
</ul>

<h3>v2.26.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Pending události ve všech pohledech</strong> – události, kde jste pozvaní a zatím jste neodpověděli (čeká na potvrzení), nyní mají čárkovaný rámeček a otazník před názvem ve <em>všech</em> pohledech: Den, Týden i Seznam. Dosud bylo toto označení jen v pohledu Měsíc.</li>
</ul>

<h3>v2.25.2 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Seznam: badge sdílených událostí</strong> – štítek u sdílených událostí v pohledu Seznam nyní zobrazuje název kalendáře a jméno vlastníka (např. „Pracovní · Jan Novák") místo obecného textu „Sdílený kalendář".</li>
</ul>

<h3>v2.25.1 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Sdílené kalendáře: přejmenování sekce</strong> – sekce „SDÍLENÉ" v levém panelu byla přejmenována na <strong>SDÍLENÉ KALENDÁŘE</strong> pro konzistenci s ostatními sekcemi.</li>
  <li><strong>Kalendář – Sdílené kalendáře: pozice výběru barvy</strong> – barevná tečka pro změnu barvy sdíleného kalendáře byla přesunuta z místa za checkboxem (před názvem) na konec řádku za název a jméno vlastníka. Tečka je viditelná jen při najetí myší – stejný vzor jako sekce Automaticky a Další kalendáře.</li>
  <li><strong>Kalendář – Sdílené kalendáře: pořadí sekce</strong> – sekce Sdílené kalendáře byla přesunuta nad sekci Další kalendáře.</li>
</ul>

<h3>v2.25.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Další kalendáře: výběr barvy</strong> – Státní svátky, Jmeniny a Narozeniny v sekci <em>Další kalendáře</em> nyní podporují vlastní barvu. Najetím myší na řádek se vpravo zobrazí malá barevná tečka – kliknutím na ni otevřete výběr barvy z palety. Tlačítkem ○ obnovíte výchozí barvu. Barva se ukládá do prohlížeče.</li>
  <li><strong>Kalendář – Sjednocení checkboxů</strong> – všechny zaškrtávátka v levém panelu nyní používají stejný vlastní styl (čtvereček s bílou fajfkou a barevným pozadím). Odstraněna vizuální nekonzistence mezi sekcemi, kde se míchaly nativní a vlastní checkboxy s různým zaoblením rohů.</li>
  <li><strong>Kalendář – Automaticky: redesign barvy</strong> – barevná tečka (puntík), která se zobrazovala přímo vedle zaškrtávátka, byla přesunuta na konec řádku za název kalendáře. Tečka je viditelná až po najetí myší – formulář tak zůstane přehledný a čistý.</li>
  <li><strong>Tým – Datum narození: přemístění</strong> – pole <em>Datum narození</em> v editaci člena bylo přesunuto výše – nyní se zobrazuje nad polem <em>Typ spolupráce</em>, hned po kontaktních údajích (telefon, pozice).</li>
</ul>

<h3>v2.24.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Dovolená a Důležité dny: toggle + barva</strong> – sekce „Automaticky" v levém panelu nyní obsahuje zaškrtávátko pro zobrazení/skrytí těchto kalendářů (stejně jako Státní svátky). Kliknutím na barevnou tečku lze nastavit vlastní barvu: Dovolená má výchozí modrou, Důležité dny umožní přebít individuální barvy jednou společnou barvou (výchozí = individuální barvy).</li>
  <li><strong>Kalendář – Zobrazení „Den"</strong> – pohled na jeden den byl přejmenován z „Dnes" na „Den" ve přepínači pohledů v záhlaví.</li>
  <li><strong>Fix: Sdílení externího (ICS) kalendáře</strong> – opravena chyba kdy sdílení externího kalendáře s konkrétním uživatelem selžalo tiše kvůli FK omezení v DB. Přidáno zobrazení chyby + SQL migrace pro opravu (viz níže). SQL migrace: <code>ALTER TABLE trackino_calendar_shares DROP CONSTRAINT IF EXISTS trackino_calendar_shares_calendar_id_fkey;</code></li>
</ul>

<h3>v2.23.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Jmeniny</strong> – nový automatický kalendář v sekci Další kalendáře (fialová barva). Zobrazuje jméno dle českého jméninového kalendáře pro každý den v roce. Dostupné pro všechny uživatele workspace, zapíná/vypíná se zaškrtnutím v levém panelu.</li>
  <li><strong>Kalendář – Narozeniny</strong> – nový automatický kalendář (růžová barva) zobrazující narozeniny kolegů ve workspace. Dostupné pouze pro adminy, master adminy a uživatele s oprávněním <em>Vidí narozeniny kolegů</em> (nastavení v Týmu). Každý uživatel zadává datum narození v Profilu (nebo admin v editaci člena v Týmu).</li>
  <li><strong>Profil – Datum narození</strong> – nové pole v Nastavení profilu; zobrazuje se v Narozeninách v kalendáři.</li>
  <li><strong>Tým – oprávnění Narozeniny</strong> – nový toggle <em>Vidí narozeniny kolegů</em> v editaci člena; admin může nastavit datum narození za uživatele.</li>
</ul>

<h3>v2.21.0 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Sdílení kalendářů</strong> – Mé i Externí kalendáře lze nyní nasdílet ostatním uživatelům workspace. Ikona sdílení se zobrazí najetím myší na kalendář v levém panelu. V dialogu sdílení lze zapnout sdílení pro celý workspace nebo vybrat konkrétní uživatele. Přepínač <em>Detaily</em> (per příjemce) určuje, zda příjemce vidí plné informace o událostech, nebo jen obsazenost (Nemá čas). Sdílené ICS odběry se přenášejí přes DB cache – příjemci nevidí ICS URL.</li>
  <li><strong>Kalendář – Sekce „Sdílené kalendáře"</strong> – příjemci sdíleného kalendáře jej nyní vidí v levém panelu v nové sekci. Lze přepínat viditelnost zaškrtávátkem a kliknutím na barevnou tečku nastavit vlastní zobrazovací barvu (bez vlivu na originál). Jméno vlastníka je zobrazeno pod názvem kalendáře.</li>
  <li><strong>Kalendář – Rozšířený formulář události</strong> – formulář pro přidání/editaci události obsahuje nová pole: <strong>Místo</strong> (adresa/popis), <strong>Účastníci</strong> (výběr členů workspace, tag-style s vyhledáváním), <strong>URL</strong> (odkaz na videohovor nebo web) a <strong>Upozornění</strong> (bez / 5 / 15 / 30 min / 1 hod / 1 den). Pole „Popis" bylo přejmenováno na <strong>Poznámka</strong>.</li>
  <li><strong>Kalendář – RSVP systém</strong> – účastníci přidaní k události obdrží pozvánku ve svém kalendáři. Neodsouhlasená událost je vyznačena přerušovaným okrajem a symbolem „?". Kliknutím se otevře dialog, kde lze zvolit <em>Přijmout</em> nebo <em>Odmítnout</em>. Organizátor vidí stav RSVP (✓/✗/?) pro každého účastníka v detailu události.</li>
</ul>

<h3>v2.20.11 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Dnes (mobil): oprava zobrazení mřížky</strong> – pohled „Dnes" přestal zobrazovat časovou mřížku po opravě v2.20.10. Příčina: výpočet výšky při načítání dat způsoboval chybné hodnoty pro pohled Dnes. Pohled Dnes nyní správně používá přirozené CSS výšky (flex-1), které fungují spolehlivě na mobilech.</li>
  <li><strong>Kalendář – Týden (desktop): scroll na počáteční hodinu</strong> – na desktopu se mřížka načítala od 0:00 i po předchozích opravách. Příčina: CSS flex-1 layout se na desktopu stabilizuje až po prvním vymalování prohlížeče. Přidán záložní scroll pomocí dvojitého <code>requestAnimationFrame</code>, který proběhne po stabilizaci layoutu. Na desktopu se nyní mřížka správně zobrazuje od nakonfigurované hodiny.</li>
</ul>

<h3>v2.20.10 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Smazání kalendáře (mobil)</strong> – kliknutím/tapnutím na název vlastního kalendáře v sekci „Mé kalendáře" se nyní otevře editační modal. V modálu je tlačítko <strong>Odstranit</strong> (vlevo dole), které celý kalendář i jeho události smaže. Na dotek dostupné na iOS i Androidu – není potřeba hledání hover-ikony.</li>
  <li><strong>Kalendář – Týdenní pohled: scroll na počáteční hodinu (oprava 2)</strong> – výška scrollovacího kontejneru se nyní přepočítává po úplném načtení dat. Předchozí oprava (v2.20.9) zajistila synchronní scroll, ale výška mohla být spočtena z nestabilního DOM. Nyní se výška i scroll nastavují ve správném pořadí po dokončení načítání – oprava funkční na mobilu i desktopu.</li>
</ul>

<h3>v2.20.9 – 7. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Týdenní pohled: scroll na počáteční hodinu</strong> – opravena chyba, kdy se při prvním načtení stránky mřížka zobrazila od 0:00 místo od nakonfigurované hodiny (např. 9:00). Problém postihoval mobil i desktop. Scroll se nyní nastavuje synchronně před prvním malováním prohlížeče (<code>useLayoutEffect</code>), takže nedochází k záblesku 0:00. Přepínání mezi pohledy fungovalo správně i dříve.</li>
</ul>

<h3>v2.20.8 – 7. 3. 2026</h3>
<ul>
  <li><strong>Žádosti – Archiv: pozice štítku „Zamítnuto"</strong> – štítek „Zamítnuto" byl přesunut z pravého horního rohu kartičky dolů, těsně nad blok „Důvod zamítnutí". Štítek „Schváleno" zůstává vpravo nahoře. Konzistentní s layoutem Dovolená → Archiv.</li>
  <li><strong>Kalendář – Smazání kalendáře</strong> – v sekci „Mé kalendáře" v levém panelu přibyla ikona koše (červená, viditelná na hover) přímo vedle ikony tužky. Umožňuje smazat ne-výchozí kalendář bez nutnosti otevírat editační modal. Výchozí kalendář nelze smazat (ikona koše se u něj nezobrazuje). Tlačítko Smazat zůstává i v editačním modalu.</li>
</ul>

<h3>v2.20.2 – 6. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Viditelná oblast mřížky</strong> – nastavení „Od/Do" nyní určuje nejen počáteční scroll pozici, ale i výšku viditelného okna. Pokud nastavíte například 9:00–17:00, bude v okně kalendáře vidět přesně 8 hodinových řádků – výš ani níž bez scrollování neuvidíte. Mimo tuto oblast lze pohybovat scrollem (celá 24h mřížka zůstává dostupná). Příklad: 9:00–17:00 = 8 řádků, 8:00–16:00 = 8 řádků atd.</li>
</ul>

<h3>v2.20.1 – 6. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Nastavení: zjednodušení</strong> – z nastavení kalendáře byl odstraněn oddíl „Rozsah dne (scrollovatelná oblast)". Časová mřížka nyní vždy zobrazuje celý den (0:00–23:00). Nastavit lze pouze „Výchozí viditelná část (při načtení stránky)" – selekty Od a Do určují, na jakou hodinu se mřížka posune při otevření kalendáře. Mimo viditelnou část lze vždy posunout scrollováním.</li>
</ul>

<h3>v2.20.0 – 6. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Seznam, mobil: poznámky pod událostí</strong> – na mobilech se panel s poznámkou nyní vždy otevírá pod kartičkou události (ne vedle). Šířka kartičky je konzistentní přes celou šířku obrazovky. Tlačítko pro přidání poznámky je na mobilech vždy viditelné (30% průhlednost místo 0%).</li>
  <li><strong>Kalendář – Seznam: název externího kalendáře</strong> – u událostí z externích (ICS) odběrů se nyní zobrazuje skutečný název odběru (např. „Pracovní kalendář") místo obecného štítku „Ext. kalendář".</li>
  <li><strong>Kalendář – Checkboxy s bílou fajfkou</strong> – vlastní kalendáře a externí odběry v levém panelu nyní používají vlastní checkbox místo nativního. Fajfka je vždy bílá (nezávisle na barvě kalendáře), takže je dobře čitelná i u žlutých nebo oranžových barev.</li>
  <li><strong>iOS: oprava automatického zoomu u select prvků</strong> – selecty na stránkách Nastavení, Admin a Úpravy aplikace nyní mají <code>font-size: 16px</code> na mobilu (text-base sm:text-sm), čímž se zabrání automatickému přiblížení na iOS Safari.</li>
</ul>

<h3>v2.19.0 – 6. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Poznámky: checkboxy šedé</strong> – checkboxy u úkolů v poznámce jsou nyní šedé místo modré, aby nerušily při čtení obsahu.</li>
  <li><strong>Kalendář – Poznámky: animace kopírování</strong> – po kliknutí na tlačítko Kopírovat se ikonka na 1,5 sekundy změní na zelený fajfku, která potvrzuje úspěšné zkopírování obsahu do schránky.</li>
  <li><strong>Kalendář – zapamatování pohledu</strong> – zvolený pohled (Dnes / Týden / Měsíc / Rok / Seznam) se nyní ukládá do localStorage a obnoví se při příštím otevření kalendáře. Výchozí pohled při prvním spuštění je Týden.</li>
  <li><strong>Kalendář – mobilní layout (Seznam)</strong> – panel poznámky v pohledu Seznam se nyní na mobilech zobrazuje pod kartičkou události místo vedle ní, čímž eliminuje horizontální přetékání na úzkých obrazovkách.</li>
  <li><strong>Kalendář – Bez události: název kalendáře</strong> – sirotčí poznámky z externích (ICS) kalendářů nyní zobrazují skutečný název odběru kalendáře místo obecného textu „Ext. kalendář".</li>
  <li><strong>Kalendář – Bez události: celý checklist</strong> – panel sirotčích poznámek nyní zobrazuje kompletní seznam úkolů (zaškrtnuté i nezaškrtnuté) místo souhrnného počtu „✓ N/M úkolů". Obsah poznámky se zobrazuje bez ořezání.</li>
  <li><strong>Fakturace – šipka v roletce měsíce</strong> – opraveno zarovnání vlastní šipky v roletce pro výběr měsíce (a roku) ve filtru faktur. Šipka je nyní správně vycentrována svisle.</li>
</ul>

<h3>v2.18.1 – 6. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Seznam: inline poznámky</strong> – poznámka k události se nyní otevírá přímo pod kartičkou události jako rozbalovací panel (max. 220 px výšky), nikoliv v pravém sloupci. Ostatní události se posunou níže. Pokud událost již má poznámku, zůstane vždy zobrazena. Kliknutím na ikonku 📄 panel otevřete nebo zavřete.</li>
  <li><strong>Kalendář – Seznam: šířka výpisu</strong> – seznam událostí nyní zaujímá přibližně polovinu plochy (max. 672 px) místo původních dvou třetin. Prázdný prostor napravo usnadňuje čitelnost.</li>
  <li><strong>Kalendář – Poznámky: tlačítka Uložit / Zrušit</strong> – automatické ukládání při pauze v psaní bylo nahrazeno explicitními tlačítky Uložit a Zrušit, která se zobrazí pouze v případě neuložených změn. Tlačítko Zrušit obnoví předchozí obsah. Flagy Důležitá / Oblíbená / Hotovo se ukládají okamžitě jako dříve.</li>
  <li><strong>Kalendář – Poznámky: redesign pill tagů</strong> – tlačítka Důležitá, Oblíbená a Hotovo jsou nyní zobrazena jako barevné pill tagy s rámečkem místo malých ikon v toolbaru. Aktivní stav: Důležitá = červená, Oblíbená = žlutá, Hotovo = šedá ztlumená.</li>
</ul>

<h3>v2.18.0 – 6. 3. 2026</h3>
<ul>
  <li><strong>Kalendář – Seznam: dvousloupcové rozvržení</strong> – pohled Seznam je nyní rozdělen na dvě části: levý sloupec obsahuje čistý výpis událostí, pravý sloupec zobrazuje panel poznámek pro vybranou událost.</li>
  <li><strong>Kalendář – Seznam: „Zobrazit dřívější události"</strong> – tlačítko nyní načítá vždy přesně 10 starších událostí (místo 6 měsíců). Historický rozsah je natvrdo nastaven na 24 měsíců zpět.</li>
  <li><strong>Kalendář – Mé kalendáře: velikost písma</strong> – názvy vlastních kalendářů v levém panelu jsou nyní stejně velké jako položky Externích kalendářů (text-xs).</li>
</ul>

<h3>v2.17.2 – 6. 3. 2026</h3>
<ul>
  <li><strong>Sidebar – optimalizace načítání badge</strong> – 5 nezávislých dotazů na badge počty bylo sloučeno do jednoho Promise.all s jedním setState, což eliminuje kaskádové překreslování a zpoždění při načítání navigace.</li>
  <li><strong>Badge kruhy na stránkách</strong> – počty v závorkách (např. „(2)") byly nahrazeny červenými badge kruhy na stránkách: Žádosti (tab „Ke zpracování"), Připomínky (sekce „Nevyřízené"/„Vyřízené"), Tým (banner „Čeká na schválení") a Fakturace (tab counts).</li>
</ul>

<h3>v2.17.1 – 6. 3. 2026</h3>
<ul>
  <li><strong>Přehled – sjednocení formátu hodin v grafu</strong> – celkový součet v týdenním grafu nyní používá stejný formát jako statistické karty nahoře (např. „1 h 7 min celkem" místo „1.1 h celkem").</li>
  <li><strong>Navigace – odznaky (badge) u dalších stránek</strong> – v levém sidebaru se nyní zobrazují červené odznaky s počtem nevyřízených položek u Žádostí (čekající žádosti ke schválení), Připomínek (nevyřízené anonymní připomínky) a Fakturace (čekající faktury ke schválení). Odznaky se zobrazují pouze oprávněným uživatelům.</li>
</ul>

<h3>v2.17.0 – 6. 3. 2026</h3>
<ul>
  <li><strong>Přehled – panel „K vyřízení"</strong> – nový notifikační panel na úvodní stránce zobrazující čekající položky: žádosti o dovolenou, žádosti zaměstnanců, nevyřízené anonymní připomínky a faktury ke schválení. Každá položka zobrazuje typ (barevná ikona), název, datum a čas. Kliknutím přejdete přímo na příslušnou stránku. Panel se zobrazuje pouze oprávněným uživatelům (manažeři, admini) a pouze pokud existují nevyřízené položky.</li>
  <li><strong>Přehled – týdenní graf hodin</strong> – nový sloupcový graf (Recharts) zobrazující odpracované hodiny za posledních 7 dní. Obsahuje celkový součet, denní průměr a porovnání dnešního dne oproti průměru (zelená šipka nahoru / červená dolů).</li>
</ul>

<h3>v2.16.2 – 5. 3. 2026</h3>
<ul>
  <li><strong>Sjednocení nadpisů stránek</strong> – všechny hlavní nadpisy stránek (Fakturace, Dovolená, Reporty, Projekty, Tým, Prompty, Záložky, Podřízení, Poznámky, Profil, Důležité dny, Firemní pravidla, Pravidla v kanceláři, Nahlásit chybu) mají nyní jednotnou velikost <code>text-xl</code> jako ostatní stránky aplikace.</li>
  <li><strong>Sjednocení výšek toolbarových prvků</strong> – tlačítka, selecty a inputy v hlavním filtrovacím panelu každé stránky mají nyní jednotnou výšku (<code>py-2</code>). Opraveno: Podřízení (period tabs, datumové inputy, user select), Analýza kategorií (inputy + preset tlačítka), Přehled hodin (navigační tlačítka), Klienti a Štítky (tlačítko Nový), Záložky a Prompty (search + sort + akční tlačítko).</li>
  <li><strong>Záložky a Prompty – jméno autora místo avataru</strong> – barevný kroužek s iniciálami autora byl odstraněn; za datem vytvoření se nyní zobrazuje celé jméno autora oddelené tečkou (formát: <em>5. 3. 2026 · Jan Novák</em>).</li>
  <li><strong>Záložky – doména bez www.</strong> – URL doména záložky se zobrazuje bez prefixu <em>www.</em> (např. <em>forbes.cz</em> místo <em>www.forbes.cz</em>).</li>
</ul>

<h3>v2.16.1 – 5. 3. 2026</h3>
<ul>
  <li><strong>iOS auto-zoom prevence – celá aplikace</strong> – na iPhonu se stránka automaticky přibližovala při focusu na textové pole, pokud mělo font-size menší než 16px. Nyní mají všechny interaktivní vstupy (input, textarea, select) na mobilu velikost 16px (text-base) a na desktopu 14px (sm:text-sm). Opraveno 98 elementů v 25 souborech.</li>
  <li><strong>Prompty a Záložky – mobilní ⋮ menu složek</strong> – na mobilních zařízeních se akční ikonky složek (přidat podsložku, sdílet, přejmenovat, smazat) zobrazí přes nové tlačítko ⋮ s rozbalovacím menu. Na desktopu zůstávají původní ikonky při hoveru.</li>
  <li><strong>Sdílení složek – možnost „Nesdílet s nikým"</strong> – v dialogu pro sdílení složky (Prompty i Záložky) přibyla třetí možnost: Nesdílet s nikým, která složku okamžitě vrátí do soukromého stavu.</li>
  <li><strong>FolderTree dropdown – oprava oříznutí</strong> – rozbalovací menu složek se dříve ořezávalo za hranou kontejneru se scrollem. Nyní je menu pozicováno přes <code>position: fixed</code> s přesnými souřadnicemi z <code>getBoundingClientRect()</code>, takže se zobrazí celé.</li>
  <li><strong>Záložky – popis inline vedle názvu</strong> – popisek záložky se nyní zobrazuje na stejném řádku jako název (za pomlčkou, šedě, zkráceno), nikoli pod ním, čímž se ušetří místo.</li>
  <li><strong>Mobilní responzivita – 5 stránek</strong> – Nastavení workspace: horizontální nav s gradientovým indikátorem posunu; Tým: taby s gradientem; Správa workspace (Admin): karty akcí se přizpůsobí na celou šířku; Tarify (App Settings): tabulka modulů je horizontálně scrollovatelná; Kalendář: popisky hodin jsou nyní pod linkou (nikoli přes ni) a sloupce týdenního pohledu jsou širší.</li>
</ul>

<h3>v2.16.0 – 5. 3. 2026</h3>
<ul>
  <li><strong>Sidebar – WorkspaceSwitcher přesunut pod Dokumentaci</strong> – přepínač workspace se nyní nachází v dolní části sidebaru, přímo nad uživatelským panelem. Je scrollovatelný a expanduje inline.</li>
  <li><strong>Prompty – UX vylepšení</strong> – odstraněn expand chevron a zobrazení jména autora (zůstává jen datum). Kliknutí na název promptu otevře editační dialog. Kódové bloky mají tlačítko pro kopírování (SVG ikona) a při kliknutí se vymaže placeholder.</li>
  <li><strong>Sdílení složek (Prompty + Záložky) – výběr konkrétních uživatelů</strong> – sekce „Konkrétní uživatelé" zobrazuje seznam členů s avatary; zvýrazněný (bg-active) výběr ukazuje, komu je složka sdílena.</li>
  <li><strong>Sidebar – reorganizace navigace</strong> – Důležité dny přesunuto do sekce SLEDOVÁNÍ (pod Kalendář); Připomínky přesunuto do sekce SPOLEČNOST (pod Pravidla v kanceláři); NÁSTROJE nyní obsahuje Záložky, Prompty a Převodník textu.</li>
  <li><strong>Přejmenování: Poznámky → Poznámky manažera</strong> – přejmenováno v celé aplikaci pro větší jasnost.</li>
  <li><strong>Nápověda – aktualizace</strong> – sekce nápovědy a tarify přizpůsobeny nové struktuře sidebaru.</li>
</ul>

<h3>v2.15.0 – 5. 3. 2026</h3>
<ul>
  <li><strong>Sidebar – collapse tlačítko na desktopu</strong> – nové tlačítko (šipka vlevo) v záhlaví sidebaru umožňuje skrýt/zobrazit levý navigační panel na desktopu a tabletu. Stav (skrytý/viditelný) se ukládá do localStorage a přetrvá i po obnovení stránky. Hamburger v hlavičce slouží jako tlačítko pro znovuotevření skrytého sidebaru.</li>
  <li><strong>Kalendář – přepínač pohledu v hlavičce</strong> – přepínač Seznam / Týden / Měsíc byl přesunut z levého panelu do horního záhlaví kalendáře (vedle tlačítka Přidat událost). Levý panel nyní zobrazuje Moje kalendáře, automatické zdroje a nastavení <em>nahoře</em>, mini kalendář <em>dole</em>.</li>
  <li><strong>Měřič – 2-řádkový layout na mobilu</strong> – na mobilních zařízeních se timer rozloží do 2 řádků: textové pole „Na čem pracuješ?" (plná šířka) a v druhém řádku výběry projektu, kategorie, štítků + časomíra + tlačítko START/STOP. Záhlaví headeru se automaticky přizpůsobí výšce.</li>
  <li><strong>Měřič – větší vstupní pole (iOS anti-zoom)</strong> – textové pole „Na čem pracuješ?" má nyní font-size 16px na mobilech (text-base), čímž se zabrání automatickému přiblížení obrazovky na iPhonu při kliknutí na pole.</li>
  <li><strong>Měřič – větší akční ikonky</strong> – ikonky akcí (spustit znovu, poznámka, smazat) v seznamu záznamů mají větší tap target na mobilech (p-1.5) a větší ikony (16px) pro pohodlnější ovládání dotykem.</li>
  <li><strong>Měřič – fix zaoblených rohů skupin</strong> – záhlaví skupiny dnů (šedé pozadí „Dnes", „Včera") nyní správně sleduje zaoblené rohy rámečku (rounded-t-xl) a nepřesahuje do rohů karty.</li>
  <li><strong>Dovolená – přizpůsobení hlavičky pro mobil</strong> – hlavička stránky Dovolená je na mobilu dvouřádková: název vlevo, tlačítka (výběr uživatele + Přidat) vpravo/pod ním. Text tlačítka se zkrátí na „Přidat" na úzkých obrazovkách.</li>
  <li><strong>Úpravy aplikace – odstraněn SQL banner</strong> – informační banner s SQL migrací byl odstraněn z celé stránky (migrace je dávno aplikována).</li>
</ul>

<h3>v2.14.0 – 5. 3. 2026</h3>
<ul>
  <li><strong>Přepínač workspace přesunut do sidebaru</strong> – přepínač workspace (viditelný pouze pokud máte přístup do 2+ workspace) byl přesunut z horního záhlaví do levého postranního panelu, nad sekci s uživatelským účtem. Rozbalovací menu se otevírá <em>nahoru</em> pro lepší přehlednost.</li>
  <li><strong>Prompty – sdílené prompty</strong> – nová virtuální složka <em>Sdílené prompty</em> v levém panelu zobrazí všechny prompty označené jako sdílené bez ohledu na jejich složku (zobrazí se pouze pokud existují sdílené prompty).</li>
  <li><strong>Prompty – editace a mazání komentářů</strong> – vlastní komentáře lze nyní upravit (ikona tužky → inline textové pole + Uložit/Zrušit) nebo smazat (ikona koše). Cizí komentáře nejsou upravitelné.</li>
  <li><strong>Prompty – tlačítko kopírování obsahu</strong> – nová ikona kopírování vedle každého promptu zkopíruje celý textový obsah promptu (bez HTML) do schránky jedním kliknutím.</li>
  <li><strong>Prompty – avatary s barvou uživatele</strong> – avatar autora promptu a avatary v komentářích nyní využívají osobní barvu uživatele (avatar_color z profilu) místo jednotné primární barvy.</li>
  <li><strong>Záložky – sdílené záložky</strong> – nová virtuální složka <em>Sdílené záložky</em> v levém panelu zobrazí všechny záložky sdílené v rámci workspace.</li>
  <li><strong>Záložky – editace a mazání komentářů</strong> – vlastní komentáře záložek lze upravit nebo smazat stejně jako u Promptů.</li>
  <li><strong>Záložky – kopírování URL</strong> – nová ikona kopírování u každé záložky zkopíruje URL do schránky.</li>
  <li><strong>Záložky – avatary s barvou uživatele</strong> – avatar autora a avatary v komentářích využívají avatar_color z profilu.</li>
  <li><strong>Opravy UX – šipky u select elementů</strong> – všechny rozbalovací nabídky (select) v modulech Záložky a Prompty mají nyní konzistentní vlastní SVG šipku místo nativní šipky prohlížeče (funguje správně i v tmavém režimu).</li>
  <li><strong>FolderTree hover</strong> – akční ikonky složek se nyní zobrazují přechodem opacity místo přepínání display, takže při hoveru na složku nedochází ke skoku šířky řádku.</li>
  <li><strong>Panel složek wider</strong> – levý panel se složkami v Záložkách i Promptech byl rozšířen z 224 px na 288 px pro lepší zobrazení delších názvů složek.</li>
</ul>

<h3>v2.13.1 – 5. 3. 2026</h3>
<ul>
  <li><strong>Mobilní responzivita – panely se složkami</strong> – Prompty, Záložky, Kalendář a Dokumenty mají na mobilech tlačítko „Složky / Mini kalendář & filtry" pro zobrazení/skrytí levého panelu se složkami. Na tabletu a desktopu zůstává panel vždy viditelný.</li>
  <li><strong>Nastavení workspace – mobilní navigace</strong> – levé vertikální menu sekcí se na mobilních zařízeních změní na horizontálně scrollovatelný pruh tlačítek (flex-row + overflow-x-auto).</li>
  <li><strong>Tým – záložky na mobilu</strong> – záložky v sekci Tým (Členové, Oddělení, Kategorie, Úkoly, Manažeři) jsou nyní horizontálně scrollovatelné a nepřetékají na úzkých obrazovkách.</li>
  <li><strong>Dovolená – mobilní tabulka a statistiky</strong> – statistické karty zobrazují 2 sloupce na mobilu (místo 3); tabulka záznamů je zabalena do horizontálního scrolleru pro zachování přehlednosti na úzkých obrazovkách.</li>
</ul>

<h3>v2.13.0 – 5. 3. 2026</h3>
<ul>
  <li><strong>Nový modul Prompty</strong> (NÁSTROJE, tarif Pro+) – evidence AI promptů ve stromové struktuře složek (až 5 úrovní). Formátovaný editor (H2/H3, tučné, kurzíva, podtržení, seznamy, bloky kódu). Kopírování kódu jedním klikem, like systém, oblíbené hvězdičkou, komentáře, sdílení složek (workspace nebo konkrétní uživatelé), řazení a fulltextové vyhledávání.</li>
  <li><strong>Nový modul Záložky</strong> (NÁSTROJE, tarif Pro+) – záložkovací knihovna URL odkazů. Favicon webu, klikací název, doména, autor, datum. Stejný systém složek, sdílení, liků, oblíbených a komentářů jako u Promptů. URL se otevírají v novém okně.</li>
</ul>

<h3>v2.12.1 – 4. 3. 2026</h3>
<ul>
  <li><strong>Nastavení workspace – vertikální navigace</strong> – záložky v Nastavení workspace byly přesunuty z horizontálního pásu (který při 8 sekcích způsoboval posuvník) do <strong>vertikálního levého menu</strong>. Aktivní sekce je zvýrazněna bílým pozadím; obsah se zobrazuje v pravém sloupci. Layout byl rozšířen z max-w-3xl na max-w-5xl pro optimální využití prostoru.</li>
</ul>

<h3>v2.12.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Oslovení (nickname)</strong> – v Detailním nastavení přibyl nový vstupní řádek „Jak tě má aplikace oslovovat" (max 30 znaků). Při prvním uložení se předvyplní křestním jménem z Zobrazovaného jména. Oslovení se zobrazuje v úvodním pozdravení na stránce Přehled místo celého jména.</li>
  <li><strong>Měřič ve všech stránkách</strong> – v Detailním nastavení → Zobrazení aplikace přibyl přepínač „Zobrazovat Měřič v záhlaví na všech stránkách". Ve výchozím nastavení je timer viditelný pouze na stránce Měřič; zapnutím tohoto přepínače se zobrazí trvale v horním záhlaví na libovolné stránce.</li>
  <li><strong>Předplatné – nová záložka v Nastavení</strong> – záložka „Předplatné" zobrazuje aktuální tarif, platební sekci (placeholder) a historii měsíčních snapshotů (tarif + počet aktivních uživatelů). Snapshot se automaticky vygeneruje při prvním zobrazení záložky v daném měsíci. Vlastník workspace a Master Admin mohou přejít na tarif Free.</li>
  <li><strong>Kalendář – redesign týdenního pohledu</strong> – Levý panel kalendáře nově obsahuje mini měsíční kalendář s nezávislou navigací (◀ Měsíc RRRR ▶), přepínač pohledu (Seznam / Týden / Měsíc) a tlačítko Nastavení kalendáře. Týdenní pohled má časovou osu vlevo (hodiny), pás celodennních událostí nahoře a klikatelnou časovou mřížku pro události s konkrétním časem (absolutní pozicování).</li>
  <li><strong>Nastavení kalendáře</strong> – v levém panelu Kalendáře nové tlačítko ⚙ Nastavení kalendáře. Uživatel si může nastavit začátek a konec pracovního dne (rozsah hodin zobrazený v týdenním pohledu). Nastavení se ukládá do profilu a přetrvává napříč relacemi.</li>
  <li><strong>Nastavení workspace – záložka Společnost</strong> – nová záložka mezi Obecné a Fakturace umožňuje per-workspace zapínání/vypínání čtyř modulů sekce Společnost: Znalostní báze, Dokumenty, Firemní pravidla, Pravidla v kanceláři. Tyto moduly jsou i nadále filtrovány dle tarifu v App Settings.</li>
  <li><strong>App Settings – skupina Společnost</strong> – v tarifové matici modulů (App Settings) přibyla skupina <em>Společnost</em> zahrnující všechny čtyři moduly sekce Společnost.</li>
</ul>

<h3>v2.11.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Nová sekce SPOLEČNOST</strong> v levém menu (tarif Pro a Max) – čtyři nové moduly pro správu firemní dokumentace a pravidel: <em>Znalostní báze</em> (připravujeme), <em>Dokumenty</em>, <em>Firemní pravidla</em> a <em>Pravidla v kanceláři</em>.</li>
  <li><strong>Dokumenty</strong> – centrální úložiště firemních souborů a odkazů. Dokumenty lze organizovat do barevných složek. Všichni členové workspace vidí dokumenty; správci (admin nebo člen s příznakem „Spravuje dokumenty") mohou nahrávat, mazat a spravovat složky. Podporované typy: PDF, Word, Excel, PowerPoint, obrázky, ZIP, TXT, CSV (max 20 MB) nebo webové URL.</li>
  <li><strong>Firemní pravidla</strong> – textová editovatelná stránka se směrnicemi a pravidly workspace. Obsah upravuje admin nebo vlastník workspace pomocí Rich Text editoru (nadpisy, tučné, seznamy, odkazy). Všichni členové vidí aktuální obsah.</li>
  <li><strong>Pravidla v kanceláři</strong> – stejný vzor jako Firemní pravidla, určeno pro provozní řád a každodenní kancelářská pravidla.</li>
  <li><strong>Tým – nové oprávnění „Spravuje dokumenty"</strong> – v dialogu úpravy člena přibyl příznak pro oprávnění nahrávat, mazat a spravovat složky v modulu Dokumenty (bez nutnosti být admin).</li>
  <li><strong>Fix: Připomínky – layout záhlaví a šířka formuláře</strong> – text subtitulu se nyní nedotýká tlačítka „Nová připomínka" (přidána mezera a obalení textu). Formulář pro novou připomínku se již nerozšiřuje za původní šířku stránky.</li>
</ul>

<h3>v2.10.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Dokumentace skryta pro běžné uživatele</strong> – odkaz na Dokumentaci (changelog) v levém menu je nyní viditelný pouze pro Master Admina a uživatele s tarifem <em>Max</em>. Ostatní tarify jej nevidí.</li>
  <li><strong>Žádosti – nové kategorie (13)</strong> – původní typy (Dovolená, Software, Pracovní cesta, Firemní karta, Jiné) nahrazeny 13 kategorickými oblastmi: <em>Hardware a zařízení, Software a licence, Přístupy a oprávnění, Pracovní prostor a vybavení, Finanční žádosti, HR a personální žádosti, Vzdělávání a rozvoj, Cestování a služební cesty, Benefity a odměňování, Nábor a posílení týmu, Bezpečnost a compliance, Technická podpora a IT servis, Právní a administrativní</em>.</li>
  <li><strong>Žádosti – průvodce kategoriemi</strong> – na stránce Žádosti přibyl rozkliknutelný panel <em>„Průvodce kategoriemi – co kam spadá"</em>. Každá kategorie obsahuje přehled konkrétních příkladů žádostí, které do ní patří.</li>
  <li><strong>Žádosti – opravy UI</strong> – záhlaví stránky opraven layout (tlačítko „Nová žádost" má pevnou šířku, nekryje se se subtitlem); formulář pro novou žádost má opravenou šipku v roletce (nativní šipka nahrazena vlastní SVG ikonou).</li>
</ul>

<h3>v2.9.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Nový modul: Žádosti</strong> (tarif Pro a Max) – zaměstnanci mohou podávat formální žádosti svému manažerovi: dovolená, software, pracovní cesta, firemní karta nebo jiné. Každá žádost prochází schvalovacím procesem (Čeká na schválení → Schváleno / Zamítnuto). Záložka <em>Žádosti</em> je viditelná jen pro uživatele s oprávněním zpracovávat žádosti (nastavují admin/vlastník v sekci Tým). Při schválení žádosti o dovolenou se automaticky vytvoří záznam v modulu Dovolená a zapíše se do Plánovače. Zamítnuté žádosti zůstávají viditelné s poznámkou recenzenta.</li>
  <li><strong>Nový modul: Připomínky</strong> (tarif Pro a Max) – anonymní formulář pro sdílení podnětů a návrhů v rámci týmu. Odesílatel je zcela anonymní – jméno ani žádné osobní údaje se neukládají. Připomínky vidí pouze uživatelé s oprávněním přijímat zpětnou vazbu (lze nastavit per-člen v sekci Tým), workspace admini a Master Admin. Každou připomínku lze označit jako vyřízenou (zelený checkbox) nebo smazat.</li>
  <li><strong>Tým – nové přepínače pro členy</strong> – v dialogu úpravy člena přibyly dvě nová oprávnění: <em>Zpracovávat žádosti</em> (vidí záložku Žádosti a může schvalovat/zamítat žádosti od podřízených) a <em>Přijímat anonymní připomínky</em> (vidí připomínky odesílaných v rámci workspace).</li>
  <li><strong>Kalendář – přejmenování pohledu</strong> – pohled <em>Liste</em> přejmenován na <em>Seznam</em> pro konzistentnost s českou terminologií.</li>
  <li><strong>Kalendář – zvýraznění vybrané barvy</strong> – ve formuláři pro tvorbu/úpravu události a kalendáře je vybraná barva nyní zřetelně zvýrazněna bílým kroužkem a barevným ohraničením (box-shadow), stejně jako na ostatních místech v aplikaci.</li>
  <li><strong>Nastavení – názvy rolí v modulu</strong> – v sekci Nastavení workspace → Moduly se zobrazují české názvy rolí (Vlastník, Admin, Team Manager, Člen) místo interních kódů (owner, admin, manager, member).</li>
  <li><strong>Přehled hodin – celá jména členů</strong> – ve sloupci Člen v Přehledu hodin byla dříve jména ořezávána na 100 px. Nyní se vždy zobrazí celé jméno.</li>
  <li><strong>Měřič – záhlaví dnů jako v Reportech</strong> – skupiny záznamů v Měřiči nyní mají záhlaví ve stejném stylu jako v modulu Reporty: šedé podbarvení (<em>var(--bg-hover)</em>), formát „Úterý 3. března" (celý název dne a měsíce), dnešní a včerejší den zůstávají jako „Dnes" a „Včera".</li>
</ul>

<h3>v2.8.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Nový modul: Kalendář</strong> (tarif Max) – komplexní osobní kalendář s třemi pohledy: <em>Měsíční</em> (klasická mřížka), <em>Týdenní</em> (sedmisloupcový přehled) a <em>Listový</em> (chronologický výpis po měsících). Navigace pomocí tlačítek ← Dnes → pro přechod mezi týdny nebo měsíci. Přidávání ručních událostí formulářem nebo přímým kliknutím na den v mřížce.</li>
  <li><strong>Více kalendářů</strong> – každý uživatel může mít více vlastních pojmenovaných kalendářů s různými barvami. Při prvním přístupu vznikne automaticky výchozí kalendář „Můj kalendář". Jednotlivé kalendáře lze zobrazit/skrýt zaškrtnutím v levém panelu.</li>
  <li><strong>Automatická synchronizace</strong> – Dovolená (schválená) a Důležité dny se automaticky propisují do Kalendáře bez nutnosti ručního zadávání. Jsou barevně odlišeny a označeny štítkem zdroje; nelze je editovat přímo v Kalendáři.</li>
  <li><strong>Připraveno pro budoucí rozšíření</strong> – architektura počítá s napojením na externí kalendáře (Google, Apple, Microsoft) a sdílením kalendáře s kolegy; databázová struktura je vytvořena (trackino_calendars, trackino_calendar_events, trackino_calendar_shares). SQL migrace viz Nápověda → Kalendář.</li>
  <li><strong>Fix: Sidebar – kolize badge s hvězdičkou Oblíbených</strong> – červené badgeky u položek Dovolená a Fakturace se přestaly překrývat s hvězdičkou oblíbených. Odkaz nyní dostane dostatečný odsazení zprava (32 px) pro tarify Pro/Max.</li>
</ul>

<h3>v2.7.2 – 4. 3. 2026</h3>
<ul>
  <li><strong>Fix: Nastavení aplikace – přesměrování při refreshi (opraveno definitivně)</strong> – předchozí oprava nestačila, protože AuthContext volá <code>setLoading(false)</code> ještě před dokončením <code>fetchProfile()</code> (profil je načítán přes <code>setTimeout(0)</code> kvůli prevenci deadlocku). Takže nastával stav: <code>authLoading=false</code>, <code>user=set</code>, <code>profile=null</code> (fetch stále probíhá) → redirect se spustil. Nyní redirect čeká na všechny tři podmínky: auth hotovo + user přihlášen + profile načten.</li>
  <li><strong>Fix: Dovolená – rozhozené sloupce tabulky</strong> – záhlaví a řádky tabulky dovolených nebyly vzájemně zarovnány. Příčinou bylo použití <code>grid</code> s <code>auto</code> sloupci v oddělených <code>div</code> elementech – každý div počítá šířky sloupců nezávisle podle svého obsahu. Opraveno použitím pevných šířek (<code>110px 110px 55px 1fr 36px</code>), které jsou konzistentní napříč záhlavím i daty.</li>
  <li><strong>Dovolená – badge čekajících žádostí v levém menu</strong> – manažeři a adminové nyní vidí u položky Dovolená v postranním menu červený odznak s počtem čekajících žádostí o dovolenou (stejný styl jako u Fakturace). Odznak se zobrazí automaticky, jakmile někdo z podřízených nebo workspace (admin) podá žádost. Zmizí po jejím schválení nebo zamítnutí.</li>
</ul>

<h3>v2.7.1 – 4. 3. 2026</h3>
<ul>
  <li><strong>Fix: Nastavení aplikace – přesměrování při refreshi</strong> – při obnovení stránky <code>/app-settings</code> docházelo k falešnému přesměrování na hlavní stránku. Příčinou byl fakt, že AuthContext inicializuje <code>profile</code> jako <code>null</code> (nikoli <code>undefined</code>), takže stav „načítá se" vypadal jako „nepřihlášen". Opraveno kontrolou <code>authLoading</code> před přesměrováním.</li>
  <li><strong>Fix: Dovolená – nekonečné načítání (cyklus)</strong> – stránka se neustále točila v cyklu načítání. Příčinou bylo pole <code>subordinateUserIds</code> počítané inline bez memoizace – každý render vytvořilo nové pole, což způsobilo neustálou změnu reference v <code>useCallback</code>, spouštění <code>useEffect</code> a opětovné volání <code>fetchData()</code>. Opraveno přidáním <code>useMemo</code>.</li>
  <li><strong>Fix: Plánovač – chybějící linka u předchozích dní</strong> – spodní oddělující čára pod záhlavím dnů chyběla pro sloupce, které předcházely prvnímu proužku (důležitý den / svátek) v daném řádku. Opraveno přidáním <code>borderBottom</code> i na mezery (gap buňky) před prvním proužkem.</li>
</ul>

<h3>v2.7.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Schvalování dovolené</strong> – dovolená delší než 3 pracovní dny nyní vyžaduje schválení přímého nadřízeného (managera). Po podání žádosti se záznam zobrazí se žlutým štítkem „Čeká na schválení" v záložce Záznamy → sekce Moje žádosti. Do statistiky čerpání se počítají pouze schválené záznamy. Manager a Admin mají novou záložku <strong>Žádosti</strong> se seznamem čekajících žádostí od podřízených – každou lze Schválit (zelené tlačítko, spustí sync s Plánovačem) nebo Zamítnout (červené tlačítko, otevře pole pro volitelnou poznámku). Zamítnutá žádost zůstane viditelná s červeným štítkem a poznámkou; uživatel ji může smazat. Dovolená ≤ 3 dní a veškerá dovolená přidaná adminem se schvaluje okamžitě. Vyžaduje SQL migraci – viz Nápověda → Dovolená.</li>
  <li><strong>Plánovač – proužky pod záhlavím</strong> – vizuální proužky důležitých dnů a státních svátků se nyní zobrazují <em>pod</em> řádkem s názvem dne a datem (dříve nad ním). Záhlaví dnů je vždy viditelné jako první řádek hlavičky tabulky.</li>
  <li><strong>Plánovač – zvýraznění dnešního dne</strong> – modrý tint pro aktuální den je nyní omezen pouze na záhlaví (boxík se jménem a datem); tělo sloupce zůstává bez podbarvení pro přehlednější čtení plánovacích buněk.</li>
  <li><strong>Fix: Ikonka v náhledu systémového oznámení</strong> – ⓘ ikonka v live náhledu banneru ve formuláři Nastavení aplikace → Systémová oznámení byla vertikálně posunutá; opraveno správným zarovnáním (items-center).</li>
</ul>

<h3>v2.6.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Systémová oznámení (Master Admin)</strong> – nová záložka v Nastavení aplikace. Master Admin může vytvářet systémové bannery zobrazené všem uživatelům. Každé oznámení má: volitelný nadpis, text zprávy, barvu, přepínač aktivity a časový rozsah (od–do). Oznámení lze připravit předem a naplánovat přesný čas zobrazení. Stránka zobrazuje stav každého oznámení: <em>Zobrazuje se / Aktivní (mimo čas) / Neaktivní</em>. Přidán live náhled banneru přímo ve formuláři.</li>
  <li><strong>Systémový banner</strong> – aktivní oznámení se zobrazí jako barevný pruh nad horní lištou (timerem). Každý uživatel může banner skrýt křížkem; skrytí se zapamatuje v prohlížeči. Banner se zobrazuje všem uživatelům bez ohledu na workspace nebo roli.</li>
  <li><strong>Plánovač – vizuální proužky (Důležité dny &amp; Státní svátky)</strong> – záhlaví Plánovače nyní zobrazuje důležité dny a státní svátky jako barevné proužky (pill) přesahující přes příslušné sloupce. Vícedenní záznamy tvoří jeden proužek přes celý rozsah; jednorázové záznamy tvoří proužek pro jeden sloupec. Překrývající se proužky jsou automaticky rozloženy do více řádků. Státní svátky mají červené proužky, důležité dny barvu přiřazenou při vytváření záznamu.</li>
</ul>

<h3>v2.5.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Sidebar – sekce NÁSTROJE</strong> – nová sekce <em>NÁSTROJE</em> v levém menu (umístěna za ANALÝZA). Modul <strong>Převodník textu</strong> byl přesunut z ANALÝZA do NÁSTROJE. Tarif Pro nově zahrnuje Převodník textu i Důležité dny.</li>
  <li><strong>Důležité dny</strong> (tarif Pro a Max) – nový osobní modul v sekci NÁSTROJE. Umožňuje evidovat důležitá data a opakující se události: jednorázový den nebo rozsah, opakování každý týden / měsíc / rok. Každý záznam má vlastní barvu a volitelnou poznámku. Záznamy se zobrazují v záhlaví sloupců <strong>Plánovače</strong> (pod státními svátky) – barevná tečka s názvem události pro každý příslušný den.</li>
  <li><strong>Úpravy aplikace – oprava DB constraint</strong> – typ <em>Poznámka</em> a stav <em>Archiv</em> nyní fungují bez chyby. Vyžaduje SQL migraci v Supabase (viz Nápověda → Úpravy aplikace). Na stránce Úpravy aplikace je zobrazen informační banner s přesným SQL příkazem.</li>
</ul>

<h3>v2.4.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Sidebar – hvězdičky jen při hoveru</strong> – hvězdičky oblíbených položek jsou nyní ve výchozím stavu neviditelné. Zobrazí se (zlatě) teprve po najetí myší na danou položku. Již oblíbené položky jsou zvýrazněny zlatou hvězdičkou vždy.</li>
  <li><strong>Plánovač – celý název svátku</strong> – název státního svátku v záhlaví sloupce nyní nezůstává oříznutý. Šířka sloupce zvýšena z 90 na 110 px, text se volně zalomí na více řádků – celý název je vždy čitelný.</li>
  <li><strong>Úpravy aplikace – typ Poznámka</strong> – nový typ položky <em>Poznámka</em> (šedý badge). Má vlastní záložku v horním filtrovacím menu vedle Bug, Nápad a Požadavek. Dostupný i v přidávacím formuláři.</li>
  <li><strong>Úpravy aplikace – Archiv</strong> – tlačítko <em>Smazat</em> přejmenováno na <em>Archivovat</em> – kliknutím se položka přesune do archivu místo trvalého smazání. Nová záložka <strong>Archiv</strong> zobrazuje archivované položky. V archivu lze: označit jednotlivé položky nebo hromadně <em>Označit vše</em> a kliknout <em>Trvale smazat (N)</em>. Každá položka v archivu má také tlačítko <em>Obnovit</em> (vrátí do stavu Otevřeno) a <em>Trvale smazat</em>.</li>
</ul>

<h3>v2.3.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Oblíbené v levém menu</strong> (tarif Pro a Max) – nová sekce <em>OBLÍBENÉ</em> se zobrazuje úplně nahoře v navigaci. Každá položka v sidebaru má na pravém okraji velmi světlou hvězdičku; kliknutím ji přidáte do Oblíbených (sekce se vytvoří automaticky). V sekci Oblíbené se položky zobrazují se křížkem pro odebrání (viditelný na hover). Oblíbené se ukládají v prohlížeči (localStorage) per workspace.</li>
  <li><strong>České státní svátky v Plánovači</strong> – záhlaví každého dne nyní zobrazuje státní svátek ČR (pokud existuje). Pod datem se v červeném textu zobrazí 🎉 + název svátku. Všechny svátky včetně pohyblivých (Velký pátek, Velikonoční pondělí) jsou počítány automaticky.</li>
  <li><strong>Nastavení aplikace – skupina Nástroje</strong> – v matici modulů tarifů přibyla nová skupina <em>Nástroje</em> obsahující modul Převodník textu. Všechny moduly nyní mají shodné názvy se Sidebarem.</li>
  <li><strong>Moduly – opraven název „Time Tracker" → „Měřič"</strong> – název modulu v Nastavení aplikace nyní odpovídá názvu v levém menu.</li>
  <li><strong>Přehled – upraven text</strong> – uvítací text „Tady máš souhrn aktivit" změněn na „Tady máš přehled aktivit".</li>
  <li><strong>Úpravy aplikace – větší textarea v modalu</strong> – při otevření formuláře pro úpravu existující položky se pole Popis automaticky rozroste na výšku odpovídající obsahu textu (min. 260px, max. 600px). Pole je přibližně 2× vyšší než dříve.</li>
</ul>

<h3>v2.2.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Sidebar – přejmenování položek</strong> – „Dashboard" přejmenováno na <em>Přehled</em>, „Time Tracker" přejmenováno na <em>Měřič</em>.</li>
  <li><strong>Úpravy aplikace – skládací karty</strong> – každá položka je nyní zobrazena jako skládací karta (jako Bug log). Header vždy ukazuje typ, prioritu, stav, datum a název; kliknutím se rozbalí popis a ovládací prvky (změna stavu, Upravit, Smazat).</li>
  <li><strong>Úpravy aplikace – větší formulář</strong> – dialog pro přidání/úpravu položky je nyní širší (<code>max-w-2xl</code>) a pole Popis se automaticky rozrůstá s délkou textu (min. 160px, max. 500px). Kliknutím mimo dialog se zavírá.</li>
  <li><strong>Převodník textu – reverzní mód</strong> – přibyl přepínač <em>Markdown → Formátovaný text / Prostý text</em>. V tomto módu zadáte Markdown do levého panelu a v pravém vidíte vizuální náhled (záložka Formátovaný text) nebo prostý text (záložka Prostý text). Implementovaná konverze: nadpisy H1–H6, tučné, kurzíva, přeškrtnuté, kód, blokové citace, nečíslované a číslované seznamy, hypertextové odkazy.</li>
</ul>

<h3>v2.1.2 – 4. 3. 2026</h3>
<ul>
  <li><strong>Oprava Převodníku textu – viditelnost modulu</strong> – nové moduly přidané do kódu po nastavení DB konfigurace tarifů se nyní zobrazují správně. Logika <code>computeEnabledModules()</code> byla upravena: základ je vždy hardcoded seznam dle tarifu; DB config aplikuje jen explicitní výjimky. Tím se zamezí situaci, kdy nový modul zmizí jen proto, že DB konfigurace vznikla před jeho přidáním do aplikace.</li>
  <li><strong>Bug log – ikonky úpravy a smazání poznámky</strong> – poznámka Master Admina má nově na pravém kraji řádku dvě ikonky: <em>tužka</em> (upravit) a <em>koš</em> (smazat). Textový odkaz „Upravit poznámku" pod poznámkou byl odstraněn. Tlačítko „+ Přidat poznámku" zůstává beze změny.</li>
</ul>

<h3>v2.1.1 – 4. 3. 2026</h3>
<ul>
  <li><strong>Bug log – skládací karty</strong> – každý bug report je nyní zobrazen jako skládací karta (kliknutím na header se rozbalí detail). Header vždy zobrazuje stav, autora, datum a případně workspace. Levý barevný pruh indikuje stav (červená = Otevřeno, žlutá = Řeší se, zelená = Vyřešeno) – shodný vizuální styl s Úpravami aplikace.</li>
  <li><strong>Bug log – označení přesunutých bugů</strong> – bug přesunutý do Úprav aplikace je v headeru okamžitě označen zeleným štítkem <em>„Přesunuto ✓"</em> a tlačítko přesunu je nahrazeno statusovým prvkem. Znovu přesunout nelze.</li>
  <li><strong>Bug log – přenos poznámky</strong> – obsah pole <em>Poznámka</em> (Master Admin) se při přesunu do Úprav aplikace automaticky zahrne do popisu položky.</li>
  <li><strong>Bug log – opraveny šipky ve filtrech</strong> – rozbalovací šipky u filtrů Workspace a Stav jsou nyní správně zarovnány pomocí vlastní SVG šipky (konzistentní s ostatními stránkami).</li>
</ul>

<h3>v2.1.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Převodník textu</strong> (tarif Max) – nový modul v sekci Analýza. Vložte naformátovaný text z Wordu nebo webu a převeďte ho na <strong>Prostý text</strong> (bez jakéhokoli formátování, zachována odřádkování) nebo <strong>Markdown</strong> (konverze nadpisů, tučného/kurzívy, seznamů, odkazů aj.). Každý výstupní panel má tlačítko Kopírovat. Spodní panel ukazuje přehled podporovaných Markdown prvků. Modul je dostupný v tarifu Max; workspace s jiným tarifem vidí informaci o uzamčení.</li>
  <li><strong>Úpravy aplikace</strong> (pouze Master Admin) – nová sekce dostupná z levého menu pod „Nahlásit chybu". Slouží jako osobní úkolník/poznámky k rozvoji aplikace. Každá položka má: název, popis, typ (<em>Bug / Nápad / Požadavek</em>), prioritu (<em>Nízká / Střední / Vysoká</em>) a stav (<em>Otevřeno / Řeší se / Hotovo</em>). Nad seznamem je vyhledávání a záložky filtrování. Levý barevný pruh indikuje prioritu (šedá / žlutá / červená). Položky označené „Hotovo" jsou přeškrtnuty a odděleny záložkou „Hotové".</li>
  <li><strong>Propojení Bug logu s Úpravami aplikace</strong> – u každého bug reportu se Master Adminovi zobrazuje tlačítko <strong>→ Úpravy aplikace</strong>. Kliknutím se obsah reportu automaticky zkopíruje do nové položky v Úpravách aplikace (typ Bug, priorita Střední). Přesunuté položky jsou označeny štítkem <em>„Z Bug logu"</em>.</li>
</ul>

<h3>v2.0.0 – 4. 3. 2026</h3>
<ul>
  <li><strong>Časová zóna workspace</strong> – v Nastavení → Obecné přibyl picker <strong>Časová zóna</strong>. Workspace může mít nastavenou libovolnou IANA časovou zónu (výchozí: <em>Praha / Bratislava UTC+1/+2</em>). Vybraná zóna určuje, co je v celé aplikaci považováno za „dnešní datum" – zvýraznění dnešního sloupce v Plánovači a Přehledu hodin, počáteční rozsah v Analýze kategorií a výchozí rok na stránce Dovolená. Funkce <code>getWorkspaceToday()</code> v <code>src/lib/utils.ts</code> používá <code>Intl.DateTimeFormat</code> s locale <code>sv-SE</code>, který přirozeně produkuje formát YYYY-MM-DD. Vyžaduje SQL migraci – viz Nápověda.</li>
</ul>

<h3>v1.9.9 – 4. 3. 2026</h3>
<ul>
  <li><strong>Tým → Členové – řazení členů</strong> – nad seznamem schválených členů přibyly tři přepínače řazení: <strong>Práva</strong> (výchozí – Vlastník → Admin → Team Manager → Člen, stejná role abecedně), <strong>A → Z</strong> a <strong>Z → A</strong> (abecedně dle jména). Přepínače jsou zobrazeny pod vyhledávacím polem, aktivní možnost je zvýrazněna.</li>
</ul>

<h3>v1.9.8 – 4. 3. 2026</h3>
<ul>
  <li><strong>Nastavení workspace – optimální šíře</strong> – stránka Nastavení workspace má nyní nastaven rozumný maximální rozměr (max-w-3xl); záložky se nezalamují a obsah karet je pohodlně editovatelný</li>
  <li><strong>Sjednocení ikony smazání</strong> – v Projektech a Klientech byla ikona koše sjednocena s ikonou používanou ve Štítcích (detailnější provedení s vnitřními čarami, zaoblené konce)</li>
</ul>

<h3>v1.9.7 – 4. 3. 2026</h3>
<ul>
  <li><strong>Nastavení aplikace (Master Admin)</strong> – nová stránka v sekci Systém umožňuje Master Adminovi konfigurovat, které moduly jsou dostupné v každém tarifu (Free / Pro / Max). Změny se okamžitě projeví v celé aplikaci. Konfigurace se ukládá do DB tabulky <code>trackino_tariff_config</code>; pokud není nastavena, použijí se výchozí hodnoty ze systému. Vyžaduje SQL migraci – viz Nápověda.</li>
  <li><strong>Nastavení workspace – plná šíře</strong> – stránka Nastavení workspace nyní využívá plnou šíři dostupného prostoru; záložky (Obecné, Dovolené, Spolupráce, Moduly, Fakturační údaje, Povinná pole) se nezalamují do více řádků a při potřebě scrollují horizontálně</li>
  <li><strong>Přejmenování: Přepisy → Výjimky</strong> – sekce v Nastavení → Moduly přejmenována na „Individuální moduly pro uživatele"; terminologie „přepis" nahrazena za „výjimka" pro lepší srozumitelnost</li>
</ul>

<h3>v1.9.6 – 4. 3. 2026</h3>
<ul>
  <li><strong>Modulární systém</strong> – části aplikace jsou nyní organizovány jako moduly, které lze zapnout nebo vypnout. Výchozí sada modulů závisí na tarifu workspace (Free / Pro / Max). Admin může v Nastavení → Moduly přidat konkrétnímu uživateli modul, který není zahrnut v tarifu, nebo naopak modul zakázat. Sidebar zobrazuje pouze povolené moduly. Vyžaduje SQL migraci – viz Nápověda.</li>
  <li><strong>URL routing – Dashboard na hlavní stránce</strong> – Dashboard byl přesunut na URL <code>/</code> (hlavní stránka); Time Tracker má nyní URL <code>/tracker</code>. Staré záložky na <code>/dashboard</code> jsou přesměrovány automaticky.</li>
</ul>

<h3>v1.9.5 – 4. 3. 2026</h3>
<ul>
  <li><strong>Master Admin – skrytí v Tým → Členové</strong> – Master Admin je nyní skryt ze seznamu členů pro všechny ostatní uživatele; sám Master Admin vidí seznam kompletně; v záložce Manažeři je Master Admin také skryt</li>
  <li><strong>Správa workspace – Admin kontakt bez Master Admina</strong> – v kartě workspace se nyní zobrazuje skutečný workspace Admin (owner nebo admin role), nikoli Master Admin, který by byl přítomen ve všech workspace</li>
  <li><strong>Výběr barvy avataru – sjednocení stylu</strong> – vybraná barva je nyní везде označena černým kroužkem (outline: 2px solid #000, offset 2px) – stejný styl jako v editaci uživatele; platí pro Detailní nastavení i Správu workspace</li>
</ul>

<h3>v1.9.4 – 4. 3. 2026</h3>
<ul>
  <li><strong>Správa workspace – redesign</strong> – karty workspace nyní zobrazují: kód (s ikonkou kopírování), datum vytvoření, počet členů, počet aktivních členů za posledních 30 dní a kontakt na vlastníka/admina (jméno, e-mail, telefon – vše kopírovatelné); přidáno vyhledávací pole pro filtrování dle názvu</li>
  <li><strong>Správa workspace – archivace a mazání</strong> – záložky Aktivní / Archivované / Smazané; workspace lze archivovat (data zachována, obnovitelné) nebo přesunout do koše (Smazané); ze záložky Smazané lze obnovit nebo trvale odstranit. Vyžaduje SQL migraci – viz Nápověda.</li>
  <li><strong>Plánovač – ikonka poznámky</strong> – ikonka indikující přítomnost poznámky v buňce je nyní výraznější (vyšší opacity, větší ikona)</li>
</ul>

<h3>v1.9.3 – 4. 3. 2026</h3>
<ul>
  <li><strong>Time Tracker – kategorie a úkol u záznamu</strong> – pod popisem každého záznamu se nyní zobrazuje přiřazená kategorie a úkol (světle šedě, vpravo od projektu); pokud je vyplněna kategorie i úkol, jsou odděleny tečkou</li>
  <li><strong>Detailní nastavení – výběr barvy avataru</strong> – vybraná barva je nyní zvýrazněna subtilnějším způsobem (shadow ring místo zvětšení na 130 %); sjednoceno s výběrem barvy projektu a klienta</li>
</ul>

<h3>v1.9.2 – 4. 3. 2026</h3>
<ul>
  <li><strong>Sidebar – rozbalovací sekce</strong> – navigační sekce (Sledování, Analýza, Správa, Systém) lze kliknutím na název sbalit nebo rozbalit; stav se ukládá v prohlížeči a přetrvá po obnovení stránky</li>
  <li><strong>Sidebar – uživatelský panel</strong> – odkaz „Detailní nastavení" přesunut z dolního menu do rozbalovacího panelu uživatele (spodní část sidebaru); panel nyní zobrazuje Detailní nastavení a tlačítko Odhlásit se s ikonkou</li>
  <li><strong>Sidebar – odstraněn přepínač motivu</strong> – volba barevného motivu (světlý / tmavý / auto) byla odebrána z uživatelského panelu v sidebaru; nastavení motivu je nadále dostupné v Detailní nastavení (/profile)</li>
</ul>

<h3>v1.9.1 – 3. 3. 2026</h3>
<ul>
  <li><strong>Synchronizace Dovolená ↔ Plánovač</strong> – přidání záznamu dovolené automaticky nastaví stav „Dovolená" v Plánovači pro všechny dny v rozsahu; smazání záznamu ho odebere. Nastavení stavu „Dovolená" (celý den) v Plánovači pro uživatele s příznakem „Může čerpat dovolenou" automaticky vytvoří 1denní záznam v Dovolené (pouze pracovní dny); odebrání stavu záznam smaže. Sync vyžaduje existenci stavu s přesným názvem „Dovolená" v Plánovači.</li>
</ul>

<h3>v1.9.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Přehled hodin (nová stránka)</strong> – týdenní tabulka odpracovaných hodin pro celý tým; každý člen tvoří jeden řádek, každý den sloupec s barevným podbarvením dle avataru; víkendy jsou vizuálně odlišeny; spodní řádek zobrazuje součet za den a celkový týdenní součet; řádky se řadí šipkami ↑↓ s persistencí pořadí v prohlížeči</li>
  <li><strong>Analýza kategorií (nová stránka)</strong> – přehled odpracovaného času rozdělený po kategoriích za vybrané období (Dnes / Týden / Měsíc / Vlastní); koláčový graf s legendou, horizontální sloupcový graf a detailní tabulka s podíly a progress bary; záznamy bez kategorie se zobrazují jako „Bez kategorie"</li>
  <li><strong>Sidebar – nové položky</strong> – v sekci Analýza přibyly „Přehled hodin" (ikona tabulky) a „Analýza kategorií" (ikona koláče); obě položky jsou viditelné všem přihlášeným uživatelům</li>
</ul>

<h3>v1.8.2 – 3. 3. 2026</h3>
<ul>
  <li><strong>Vyhledávání v Projektech</strong> – nad seznam projektů přidáno vyhledávací pole pro rychlé filtrování aktivních i archivovaných projektů; křížek pole vymaže</li>
  <li><strong>Vyhledávání v Klientech</strong> – nad seznam klientů přidáno vyhledávací pole pro filtrování dle jména klienta</li>
  <li><strong>Vyhledávání v Tým → Členové</strong> – nad seznam schválených členů přidáno vyhledávací pole; hledá podle jména i e-mailu</li>
  <li><strong>Sidebar – přesunutí Poznámek</strong> – položka Poznámky přesunuta z oddílu Sledování do oddílu Analýza, kde se zobrazuje za Podřízenými</li>
</ul>

<h3>v1.8.1 – 3. 3. 2026</h3>
<ul>
  <li><strong>Formát telefonního čísla</strong> – telefonní čísla se napříč aplikací zobrazují s mezerami pro přehlednost (např. +420 608 510 232); tlačítko kopírování zkopíruje číslo bez mezer pro přímé použití v dialeru; uložení automaticky odstraní mezery bez ohledu na formát zadání</li>
  <li><strong>Plánovač – celý den jako výchozí buňka</strong> – výchozí stav buňky je celý den; při najetí myší se zobrazí ikonka rozdělení, kliknutím se buňka rozloží na DOP a ODP; ikonkou sloučení lze vrátit na celý den (zachová stav z dopoledne)</li>
</ul>

<h3>v1.8.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Plánovač (nová stránka)</strong> – vizuální přehled dostupnosti celého týmu; každý člen má řádek, každý den dvě buňky (DOP / ODP) podbarvené dle vybraného stavu</li>
  <li><strong>Stavy dostupnosti</strong> – admin může definovat vlastní stavy s libovolným názvem a barvou (V kanceláři, Home office, Dovolená, Nemocný...); správa přes tlačítko „Spravovat stavy"</li>
  <li><strong>Nastavení dostupnosti</strong> – každý uživatel nastavuje svůj vlastní stav kliknutím na buňku; admin a manažer mohou nastavovat stav i za jiné uživatele</li>
  <li><strong>Poznámka ke stavu</strong> – ke každé buňce lze přidat volitelnou poznámku zobrazenou při najetí myší</li>
  <li><strong>Připnutí kolegů</strong> – hvězdičkou vedle jména lze kolegu připnout na začátek seznamu</li>
  <li><strong>Viditelnost</strong> – Admin vidí všechny; Manager vidí svůj tým; Member vidí sebe a spoluhráče se stejným manažerem</li>
  <li><strong>Navigace týdnem</strong> – šipky pro přepínání týdnů, tlačítko „Dnes" pro skok na aktuální týden</li>
</ul>

<h3>v1.7.1 – 3. 3. 2026</h3>
<ul>
  <li><strong>Fakturace – vyhledávání skryto pro běžné uživatele</strong> – vyhledávací pole ve fakturách se zobrazuje pouze Adminům, Master Adminům a Správcům fakturace; běžní uživatelé (záložka Moje faktury) pole nevidí</li>
</ul>

<h3>v1.7.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Fakturace – vyhledávání</strong> – v záložkách Ke schválení a Přehled faktur přidáno vyhledávací pole pro filtrování faktur podle jména uživatele, variabilního symbolu nebo měsíce/roku; pole zobrazují pouze Admini, Master Admini a Správci fakturace</li>
  <li><strong>Audit log – rozšíření oprávnění</strong> – přístup k audit logu již nevyžaduje tarif Max; oprávnění lze udělit libovolnému členovi workspace (Tým → editace člena → zaškrtávátko „Audit log"); Workspace Admini a Master Admini mají přístup vždy</li>
  <li><strong>Audit log – logování úprav podřízených</strong> – při editaci popisu záznamu nebo přidání manažerské poznámky k záznamu podřízeného se automaticky zapíše záznam do audit logu (kdo, kdy, co, pro koho, jakou dobu a jaký popis)</li>
  <li><strong>Timer – offline provoz</strong> – timer stále běží i bez připojení k internetu (zobrazuje se indikátor „Offline"); zastavení offline uloží čekající data do lokální paměti prohlížeče a automaticky je odešle do databáze při obnovení připojení (zobrazuje se indikátor „Čeká na uložení")</li>
</ul>

<h3>v1.6.1 – 3. 3. 2026</h3>
<ul>
  <li><strong>Fakturace – editace dat schválení a proplacení</strong> – admin může v detailu faktury (režim Upravit) měnit také datum schválení a datum proplacení (zobrazují se pouze pro faktury ve stavu Schváleno / Proplaceno)</li>
  <li><strong>Fakturace – přehled aktuální faktury místo banneru</strong> – po podání faktury se namísto zeleného informačního banneru zobrazí přímo řádek faktury s aktuálním stavem, daty, počtem hodin, částkou a možností stáhnout PDF; badge v bočním panelu se nyní počítá client-side a nezobrazí se, pokud existuje novější aktivní faktura pro stejné období</li>
  <li><strong>Fakturace – vrácení stavů v detailu</strong> – admin může v detailu faktury změnit stav zpět: Proplaceno → Schváleno nebo → Stornováno; Schváleno → Čekající nebo → Stornováno; Čekající → Stornováno</li>
</ul>

<h3>v1.6.0 – 3. 3. 2026</h3>
<ul>
  <li><strong>Patička aplikace</strong> – do spodní části každé stránky přidán copyright „© 2026 Trackino"; rok se automaticky rozšíří na rozsah (např. 2026–2027) s každým novým rokem</li>
  <li><strong>Play tlačítko v Time Trackeru</strong> – každý záznam má nové tlačítko ▶ (Spustit znovu); po kliknutí se načtou popis, projekt, kategorie, úkol i štítky záznamu do timeru a timer se automaticky spustí</li>
  <li><strong>Fakturace – Proplatit jako checkbox</strong> – tlačítko „Proplatit" v záložce Přehled faktur má nový styl checkboxu se zelenou hranicí; kliknutím bez potvrzovacího dialogu okamžitě označí fakturu jako Proplacentou; dostupné také pro Adminy</li>
  <li><strong>Fakturace – datum schválení a proplacení v řádku</strong> – pro schválené a proplacené faktury se nyní v řádku zobrazuje „Schváleno: datum" a „Proplaceno: datum", takže uživatel vidí vše bez nutnosti otevírat detail</li>
  <li><strong>Fakturace – badge po novém podání zmizí</strong> – při opětovném odeslání vrácené faktury se stará vrácená faktura automaticky smaže; červený odznak v levém menu ihned zmizí</li>
  <li><strong>Tým – kopírování kontaktů</strong> – ikona pro kopírování e-mailu je nyní vždy viditelná (dříve jen po najetí myší); přidána stejná ikonka pro kopírování telefonního čísla; odstraněna emoji 📞</li>
</ul>

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
