# CLAUDE-ASISTENT.md – Osobní pokyny pro AI asistenta

> Tento soubor si přečti **před každým úkolem** spolu s CLAUDE.md.
> Zde jsou specifické pokyny od uživatele, které mají přednost před výchozím chováním.

---

## Pracovní pravidla

### 1. Dokumentace v CLAUDE.md
Před každým úkolem si přečti `CLAUDE.md` – obsahuje kompletní dokumentaci aplikace (DB schéma, architektura, moduly, typy, konvence). Nevymýšlej věci znovu, stavěj na tom, co tam už je.

### 2. Limit výstupních tokenů
Drž výstup pod **32 000 tokenů**. Pokud je úkol rozsáhlý, postupuj po částech a průběžně informuj o pokroku. Upřednostňuj stručné, přesné výstupy před obsáhlými.

### 3. SQL příkazy
Pokud úkol vyžaduje změny v databázi, vypiš přímo do chatu kompletní SQL příkazy připravené ke spuštění + stručný popis, kde a jak je spustit (Supabase → SQL editor → spustit jako celek).

### 4. Nasazení na produkci
Po každém dokončeném úkolu vždy: `npm run build` (ověření TypeScript) → `git add` → `git commit` → `git push` → Vercel automaticky nasadí.

### 5. Nápověda a Dokumentace
Každou změnu promítni do stránek `/help` (Nápověda) a `/changelog` (Dokumentace/Historie verzí). Changelog verzovat dle konvence (feat = nová verze, fix = patch).

### 6. Aktualizace CLAUDE.md
Po každé větší změně aktualizuj `CLAUDE.md`: verze v záhlaví, changelog tabulka, případně nová architektonická sekce. CLAUDE.md je zdrojem pravdy pro budoucí konverzace.

### 7. Závěrečné shrnutí
Poslední odpověď každého úkolu musí obsahovat:
- Popis toho, co bylo uděláno a jak to funguje
- Čtyři zelené checkmarky na závěr:
- Potvrzení, že jsem četl `CLAUDE.md` a `CLAUDE-ASISTENT.md` a řídím se jimi

✅ Změny nahrány na produkci
✅ Změny připsány do Nápovědy
✅ Změny připsány do Dokumentace
✅ Změny detailně popsány do CLAUDE.md
✅ Přečteny a dodrženy instrukce z CLAUDE.md a CLAUDE-ASISTENT.md

---

### 8. Konzistence UI – používej stávající prvky
Před implementací nového modulu nebo funkce se podívej do existujícího kódu a použij stejné/jednotné prvky:
- **Ikonky** – stejná sada SVG ikon jako v ostatních modulech (nekombinuj různé styly/velikosti bez důvodu)
- **Barvy a palety** – používej CSS proměnné (`var(--primary)`, `var(--bg-card)`, `var(--border)`, `var(--text-muted)` atd.), stejné jako jinde
- **Výběr barev** – pokud jiný modul má color picker, použij stejný vzor
- **Rozložení (layout)** – inspiruj se layoutem podobných stránek (dvousloupcové, kartičky, tabulky apod.)
- **Modální okna, tlačítka, formuláře** – stejný vizuální styl jako v existujících modalech
- Pokud stávající řešení vyhovuje, používej ho i v nových místech. Lepší alternativu navrhni jen pokud přináší viditelnou přidanou hodnotu.

### 10. Šipky u select elementů a color picker
- **Select dropdown šipky**: Každý `<select>` element musí mít vlastní vizuální šipku – obal ho do `<div className="relative">`, přidej `appearance-none pr-8` na select a vlož SVG chevron jako absolutně pozicovaný dekorativní prvek (`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2`). Nikdy nespoléhej na nativní šipku prohlížeče, která v tmavém režimu nebo na různých platformách vypadá jinak.
- **Color picker**: Po výběru barvy musí být zvolená barva vizuálně jasně oddělena od ostatních – zvýrazňovací kroužek (ring/outline) nesmí přesahovat do sousedních barev. Používej `ring-2 ring-offset-2 ring-[var(--primary)]` nebo ekvivalent s `outline-offset`. Vždy ověř, že se kroužek správně zobrazuje v tmavém i světlém režimu.

### 11. iOS auto-zoom prevence na inputech
Na iOS Safari se stránka automaticky přiblíží (zoom), pokud má `<input>` nebo `<textarea>` menší `font-size` než **16px** (tj. méně než `text-base` v Tailwindu). Pravidla:
- Vždy používej `text-base sm:text-sm` (nebo jen `text-base`) na všech interaktivních inputech a textareách, aby nedocházelo k automatickému přiblížení na iPhonu.
- **Nikdy** nepoužívej `text-xs` nebo `text-sm` samotné na inputech, které uživatel aktivně vyplňuje (vyhledávací pole, formulářová pole, timer vstup atd.).
- Výjimka: inputy ve vyskakovacích panelech (dropdown menu, picker) mohou mít `text-sm` pokud jsou malé – ale hlavní vstupní pole na stránce a v headeru musí mít `text-base`.
- Toto platí pro všechny stránky a komponenty v celé aplikaci Trackino.

### 12. Testovací prostředí
- Testuji v **Google Chrome** na **produkci** (Vercel deploy)
- Aktivní workspace: **Four Crowns** (ID: `cfb0b233-eff6-476a-b195-4521c17265bc`)
- Přihlášen jako **Master Admin** (tarif Max)
- Při generování testovacích SQL dat vždy používej tento workspace_id

### 9. Responzivita a světlý/tmavý režim
Každý nový modul nebo funkce musí být plně funkční na:
- **Mobil** – Android i iPhone (malé obrazovky, touch gesta, dostatečné tap targety min. 44px)
- **Tablet** – iPad a jiné (střední obrazovky, orientace na šířku i výšku)
- **Desktop** – standardní šířky od 1024px výše
- Používej Tailwind responzivní prefixy (`sm:`, `md:`, `lg:`) a vyhýbej se pevným šířkám, které by přetékaly na mobilech
- Vždy otestuj, zda layout funguje i na úzkých obrazovkách (overflow, zkrácení textu, zalamování)
- **Tmavý/světlý režim** – nikdy nepoužívej pevné barvy (např. `#ffffff`, `bg-white`, `text-black`). Vždy používej CSS proměnné (`var(--bg-card)`, `var(--text-primary)` atd.), které se automaticky přepínají dle tématu.
