# UI-STANDARDS.md – Trackino vizuální standardy

> Referenční dokument pro konzistentní vzhled celé aplikace.
> Při vývoji se drž těchto vzorů. Odchylky povoleny jen ve zdůvodněných případech.
> Aktualizováno: 6. 3. 2026

---

## 1. Nadpisy stránek

```tsx
// Hlavní nadpis stránky
<h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
  Název stránky
</h1>

// S podtitulkem
<div>
  <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Název stránky</h1>
  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Popis stránky</p>
</div>

// Sekční nadpis uvnitř karty nebo formuláře
<h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
  Název sekce
</h3>
```

**Pravidla:**
- Hlavní nadpis vždy `text-xl font-bold`
- Podtitulek vždy `text-sm mt-1` + `var(--text-muted)`
- Sekční nadpis vždy `text-sm font-semibold`
- Nikdy nepoužívat hardcodované barvy – vždy CSS proměnné

---

## 2. Tlačítka

### Primární tlačítko (přidat, uložit, vytvořit)

```tsx
<button
  onClick={handleSave}
  disabled={saving}
  className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
  style={{ background: 'var(--primary)' }}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
  onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
>
  {saving ? 'Ukládám...' : 'Uložit'}
</button>

// S ikonou +
<button
  className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
  style={{ background: 'var(--primary)' }}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
  onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
  Přidat
</button>
```

### Sekundární tlačítko (zrušit, zpět)

```tsx
<button
  onClick={onCancel}
  className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
>
  Zrušit
</button>
```

### Nebezpečné tlačítko (smazat – jen jako standalone akce, ne ikonka)

```tsx
<button
  onClick={handleDelete}
  className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
  style={{ background: 'var(--danger)' }}
>
  Smazat
</button>
```

### Schválit / Zamítnout (inline akce v seznamu)

Používá se v řádcích tabulky/seznamu pro schvalování žádostí, dovolené apod. Vždy s SVG ikonou vlevo.

```tsx
// Schválit – zelené vyplněné tlačítko s fajfkou
<button
  onClick={() => approve(item.id)}
  disabled={approving === item.id}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
  style={{ background: 'var(--success)' }}
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
  {approving === item.id ? '...' : 'Schválit'}
</button>

// Zamítnout – červené outlined tlačítko s ×
<button
  onClick={() => setRejectModal({ id: item.id, note: '' })}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
  style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
  Zamítnout
</button>
```

**Pravidla:**
- Vždy `flex items-center gap-1.5` pro zarovnání ikony s textem
- Ikona vždy `width="12" height="12"` (menší než standardní 14px – tlačítka jsou kompaktnější)
- Schválit: zelené vyplněné (`var(--success)`), bílý text + ikona
- Zamítnout: červené outlined (`var(--danger)` border + text), hover → světlé červené pozadí
- Loading stav: `{approving === item.id ? '...' : 'Schválit'}`
- NIKDY nepoužívat textové symboly ✓ nebo ✕ – vždy SVG ikona

### Vrátit k opravě (inline akce)

```tsx
<button
  onClick={() => openReturnModal(item)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
  style={{ borderColor: 'var(--warning)', color: 'var(--warning)', background: 'transparent' }}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--warning-light)'}
  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.63" />
  </svg>
  Vrátit k opravě
</button>
```

### Dvojice tlačítek ve formuláři (Cancel + Submit)

```tsx
<div className="flex gap-2">
  <button className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium"
    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
    Zrušit
  </button>
  <button className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
    style={{ background: 'var(--primary)' }}>
    Uložit
  </button>
</div>
```

**Pravidla:**
- Padding vždy `px-4 py-2`
- Border radius vždy `rounded-lg`
- Text vždy `text-sm font-medium`
- Hover: inline `onMouseEnter`/`onMouseLeave` (ne Tailwind hover, kvůli CSS proměnným)
- Disabled: `disabled:opacity-50`
- Dvojice tlačítek: `flex gap-2` + oba `flex-1`

---

### Pořadí tlačítek (DŮLEŽITÉ – vždy dodržovat)

Negativní/destruktivní akce vždy **VLEVO**, pozitivní/potvrzující akce vždy **VPRAVO**.

| Dvojice | Vlevo ❌ | Vpravo ✅ |
|---------|---------|---------|
| Schválení | Zamítnout | Schválit |
| Formulář | Zrušit | Uložit |
| Potvrzení | Ne / Zrušit | Ano / Potvrdit |
| Mazání | Zrušit | Smazat |

**Důvod:** Uživatel si zvykne, že „bezpečná cesta zpět" je vždy vlevo a „potvrzení záměru" vždy vpravo. Konzistentní rozmístění zabraňuje nechtěným kliknutím.

```tsx
{/* SPRÁVNĚ – Zamítnout vlevo, Schválit vpravo */}
<div className="flex items-center gap-2">
  <button ...>Zamítnout</button>  {/* ❌ vlevo */}
  <button ...>Schválit</button>   {/* ✅ vpravo */}
</div>

{/* SPRÁVNĚ – Zrušit vlevo, Uložit vpravo */}
<div className="flex gap-2">
  <button ...>Zrušit</button>    {/* ❌ vlevo */}
  <button ...>Uložit</button>    {/* ✅ vpravo */}
</div>
```

---

## 3. Ikonková tlačítka (akce v řádku)

```tsx
// Upravit (pencil) – hover → primary barva
<button
  className="p-1.5 rounded transition-colors"
  style={{ color: 'var(--text-muted)' }}
  onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
  title="Upravit"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
</button>

// Smazat (trash) – hover → danger barva
<button
  className="p-1.5 rounded transition-colors"
  style={{ color: 'var(--text-muted)' }}
  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
  title="Smazat"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
</button>

// Archivovat – hover → warning barva
<button
  className="p-1.5 rounded transition-colors"
  style={{ color: 'var(--text-muted)' }}
  onMouseEnter={e => e.currentTarget.style.color = 'var(--warning)'}
  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
  title="Archivovat"
>
  {/* archive SVG */}
</button>
```

**Pravidla:**
- Padding vždy `p-1.5`
- Border radius vždy `rounded` (ne `rounded-lg`)
- Výchozí barva vždy `var(--text-muted)` – ikony jsou nenápadné
- Hover barva dle akce: edit → `primary`, delete → `danger`, archive → `warning`
- Vždy `title` atribut pro tooltip
- Ikona vždy `width="14" height="14"` (standardní velikost v řádcích)
- SVG vždy `fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"`

### Ikona koše (standardní SVG – vždy použít tento)

```tsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  <path d="M10 11v6M14 11v6"/>
  <path d="M9 6V4h6v2"/>
</svg>
```

### Ikona tužky (standardní SVG – vždy použít tento)

```tsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
</svg>
```

### Ikona plus (standardní SVG – vždy použít tento)

```tsx
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <line x1="12" y1="5" x2="12" y2="19"/>
  <line x1="5" y1="12" x2="19" y2="12"/>
</svg>
```

---

## 4. Vstupní pole (inputs)

### Standardní třídy a styly

```tsx
// Definuj na začátku komponenty jako konstanty
const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const inputStyle = {
  borderColor: 'var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
};

// Text input
<input type="text" placeholder="Název" className={inputCls} style={inputStyle} />

// Textarea
<textarea rows={3} placeholder="Poznámka..." className={inputCls} style={inputStyle} />

// Date input
<input type="date" className={inputCls} style={inputStyle} />
```

### Select s vlastní šipkou

```tsx
<div className="relative">
  <select className={`${inputCls} appearance-none pr-8 cursor-pointer`} style={inputStyle}>
    <option value="">Vyberte...</option>
  </select>
  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ color: 'var(--text-muted)' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
</div>
```

**Pravidla:**
- VŽDY `text-base sm:text-sm` – prevence iOS auto-zoom (font < 16px způsobuje zoom)
- Padding vždy `px-3 py-2`
- Focus ring vždy `focus:ring-2 focus:ring-[var(--primary)]`
- Select vždy `appearance-none` + vlastní SVG šipka
- Nikdy nepoužívat Tailwind barvy (border-gray-300 apod.) – vždy CSS proměnné

---

## 5. Karty a kontejnery

### Standardní karta

```tsx
<div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
  {/* obsah */}
</div>
```

### Řádek v seznamu s hover efektem

```tsx
<div
  className="px-4 py-3 border-b last:border-b-0 transition-colors"
  style={{ borderColor: 'var(--border)' }}
  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
>
  {/* obsah */}
</div>
```

### Prázdný stav

```tsx
<div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádné záznamy.</p>
</div>
```

**Pravidla:**
- Karty: `rounded-xl` (velký radius)
- Listy uvnitř karet: `rounded-lg` (menší radius)
- Dropdowny/poppery: `rounded-lg shadow-lg`
- Padding karet: `p-5` (standardní), `p-4` (kompaktnější)
- Prázdný stav: `py-12 text-center`

---

## 6. Taby (přepínač pohledů)

```tsx
<div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--bg-hover)' }}>
  {tabs.map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all"
      style={{
        background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
        color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
        boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {tab.label}
      {/* Badge s počtem (volitelné) */}
      {tab.count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
          style={{ background: '#ef4444' }}>
          {tab.count}
        </span>
      )}
    </button>
  ))}
</div>
```

**Pravidla:**
- Kontejner: `rounded-xl` + `background: var(--bg-hover)` + `p-1`
- Aktivní tab: `var(--bg-card)` + `var(--shadow-sm)` + primární text
- Neaktivní tab: `transparent` + `var(--text-muted)`
- `transition-all` pro plynulé přechody

---

## 7. Stavové odznaky (badges / pills)

### Počtový badge (červený kruh)

```tsx
<span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
  style={{ background: '#ef4444' }}>
  {count}
</span>
```

### Stavový pill (schváleno / zamítnuto / čeká)

```tsx
// Schváleno – zelená
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
  style={{ background: '#dcfce7', color: '#166534' }}>
  Schváleno
</span>

// Čeká – žlutá
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
  style={{ background: '#fef3c7', color: '#92400e' }}>
  Čeká na schválení
</span>

// Zamítnuto – červená
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
  style={{ background: '#fee2e2', color: '#991b1b' }}>
  Zamítnuto
</span>

// Informační – modrá
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
  style={{ background: '#dbeafe', color: '#1e40af' }}>
  Info
</span>
```

**Pravidla:**
- Padding vždy `px-2 py-0.5`
- Text vždy `text-[11px] font-semibold`
- Tvar vždy `rounded-full` (pill)
- Barvy: světlé pozadí + tmavý text stejné barvy (ne `text-white`)

---

## 8. Modální dialogy

```tsx
{showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.5)' }}
    onClick={e => e.target === e.currentTarget && setShowModal(false)}>
    <div className="w-full max-w-md rounded-xl p-6 shadow-xl"
      style={{ background: 'var(--bg-card)' }}>

      {/* Hlavička */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Název modálu
        </h2>
        <button
          onClick={() => setShowModal(false)}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Obsah */}
      <div className="space-y-4 mb-6">
        {/* ... */}
      </div>

      {/* Akční tlačítka */}
      <div className="flex gap-2">
        <button className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          onClick={() => setShowModal(false)}>
          Zrušit
        </button>
        <button className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ background: 'var(--primary)' }}>
          Uložit
        </button>
      </div>

    </div>
  </div>
)}
```

**Pravidla:**
- Pozadí: `rgba(0,0,0,0.5)` (poloprůhledné černé)
- Klik mimo zavírá modal: `onClick={e => e.target === e.currentTarget && closeModal()}`
- Kontejner: `max-w-md rounded-xl p-6 shadow-xl`
- Nadpis: `text-base font-semibold` (ne `text-xl`)
- Zavírací ×: ikonková tlačítko vpravo nahoře

---

## 9. Vyhledávací pole

```tsx
<div className="relative">
  <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ color: 'var(--text-muted)' }}>
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
  <input
    type="text"
    value={search}
    onChange={e => setSearch(e.target.value)}
    placeholder="Hledat..."
    className="w-full pl-9 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
  />
  {search && (
    <button onClick={() => setSearch('')}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
      style={{ color: 'var(--text-muted)' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )}
</div>
```

**Pravidla:**
- Lupa vlevo: `left-3`, `pointer-events-none`
- Input padding: `pl-9 pr-8` (prostor pro ikony)
- × tlačítko vpravo: zobrazit jen když `search !== ''`

---

## 10. Avatar (iniciálový kruh)

```tsx
// Standardní velikost (v seznamech)
<div
  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
  style={{ background: member.avatar_color ?? 'var(--primary)' }}
>
  {member.display_name?.charAt(0).toUpperCase() ?? '?'}
</div>

// Malá velikost (v komentářích, inline)
<div
  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
  style={{ background: member.avatar_color ?? 'var(--primary)' }}
>
  {member.display_name?.charAt(0).toUpperCase() ?? '?'}
</div>
```

**Pravidla:**
- Standardní: `w-8 h-8 text-xs`
- Malý: `w-6 h-6 text-[10px]`
- Vždy `rounded-full flex items-center justify-center flex-shrink-0`
- Barva z `avatar_color` profilu, fallback `var(--primary)`

---

## 11. Načítání (loading spinner)

```tsx
<div className="flex justify-center py-12">
  <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
</div>
```

---

## 12. Upozornění / info boxe

```tsx
// Warning (žlutá)
<div className="rounded-lg border px-4 py-3 text-sm mb-4"
  style={{ borderColor: '#f59e0b', background: '#fffbeb', color: '#92400e' }}>
  Text upozornění.
</div>

// Error (červená)
<div className="rounded-lg border px-4 py-3 text-sm mb-4"
  style={{ borderColor: '#ef4444', background: '#fef2f2', color: '#991b1b' }}>
  Text chyby.
</div>

// Info (modrá)
<div className="rounded-lg border px-4 py-3 text-sm mb-4"
  style={{ borderColor: '#3b82f6', background: '#eff6ff', color: '#1e40af' }}>
  Informace.
</div>

// Success (zelená)
<div className="rounded-lg border px-4 py-3 text-sm mb-4"
  style={{ borderColor: '#16a34a', background: '#f0fdf4', color: '#166534' }}>
  Úspěch.
</div>
```

---

## 13. CSS proměnné (design tokeny)

Definovány v `src/app/globals.css`. Nikdy nepoužívat hardcodované hex barvy pro základní UI – vždy CSS proměnné.

| Proměnná | Světlý režim | Tmavý režim | Použití |
|----------|-------------|-------------|---------|
| `--primary` | `#2563eb` | `#3b82f6` | Primární akce, focus ring |
| `--primary-hover` | `#1d4ed8` | `#60a5fa` | Hover stav primárního |
| `--primary-light` | `#dbeafe` | `#1e3a5f` | Lehké zvýraznění |
| `--bg-main` | `#f8fafc` | `#0f172a` | Pozadí celé stránky |
| `--bg-card` | `#ffffff` | `#1e293b` | Pozadí karet |
| `--bg-input` | `#ffffff` | `#1e293b` | Pozadí vstupů |
| `--bg-hover` | `#f1f5f9` | `#1e293b` | Hover efekt řádků/položek |
| `--bg-active` | `#eff6ff` | `#1e3a5f` | Aktivní/selected stav |
| `--text-primary` | `#0f172a` | `#f1f5f9` | Hlavní text |
| `--text-secondary` | `#475569` | `#94a3b8` | Sekundární text |
| `--text-muted` | `#94a3b8` | `#64748b` | Nenápadný text, ikony |
| `--border` | `#e2e8f0` | `#334155` | Okraje karet, inputů |
| `--danger` | `#dc2626` | `#ef4444` | Delete akce, chyby |
| `--warning` | `#ca8a04` | `#eab308` | Varování, archivace |
| `--success` | `#16a34a` | `#22c55e` | Úspěch, schválení |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | stejné | Jemný stín |

**Barvy mimo proměnné (stavové – použití dovoleno):**

| Hodnota | Použití |
|---------|---------|
| `#ef4444` | Badge kruh s počtem |
| `#dcfce7` / `#166534` | Pill "Schváleno" – bg / text |
| `#fef3c7` / `#92400e` | Pill "Čeká" – bg / text |
| `#fee2e2` / `#991b1b` | Pill "Zamítnuto" – bg / text |
| `#dbeafe` / `#1e40af` | Pill "Info" – bg / text |

---

## 14. Color picker (výběr barvy)

```tsx
const COLORS = ['#2563eb','#dc2626','#16a34a','#ca8a04','#9333ea','#db2777','#ea580c','#0891b2','#65a30d','#6366f1'];

<div className="flex gap-2 flex-wrap">
  {COLORS.map(c => (
    <button
      key={c}
      onClick={() => setColor(c)}
      className="w-7 h-7 rounded-full transition-all"
      style={{
        background: c,
        transform: color === c ? 'scale(1.2)' : 'scale(1)',
        boxShadow: color === c ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${c}` : 'none',
      }}
    />
  ))}
</div>
```

**Pravidla:**
- Velikost vždy `w-7 h-7`
- Aktivní stav: `scale(1.2)` + double box-shadow (bílý mezikruh + barevný okraj)

---

## 15. Záhlaví stránky (layout header)

```tsx
// Standardní layout hlavičky stránky
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
      Název stránky
    </h1>
    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Popis</p>
  </div>
  <button className="px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2"
    style={{ background: 'var(--primary)' }}>
    <svg width="16" height="16" ...>...</svg>
    Přidat
  </button>
</div>
```

---

## 16. Klíčová pravidla (shrnutí)

1. **CSS proměnné vždy** – nikdy `text-gray-500`, vždy `color: 'var(--text-muted)'`
2. **iOS anti-zoom** – každý input/textarea/select musí mít `text-base sm:text-sm`
3. **Hover přes inline onMouseEnter/Leave** – Tailwind `hover:` nefunguje s CSS proměnnými
4. **Ikony koše: vždy stejné SVG** – viz sekce 3 výše (čtyři path elementy)
5. **Ikony: vždy `currentColor`** – aby barva reagovala na CSS proměnné rodiče
6. **Disabled stav: `disabled:opacity-50`** – standardní ztlumení
7. **Animace: `transition-colors`** pro barvy, **`transition-all`** pro vše ostatní
8. **Rounded: `rounded-xl`** pro karty, **`rounded-lg`** pro tlačítka a inputy, **`rounded`** pro ikonová tlačítka
9. **Pořadí tlačítek: negativní VLEVO, pozitivní VPRAVO** – Zamítnout→Schválit, Zrušit→Uložit (viz sekce 2)

---

*Soubor spravuje Claude. Aktualizuj při každé větší změně vizuálních standardů.*
