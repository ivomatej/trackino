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
