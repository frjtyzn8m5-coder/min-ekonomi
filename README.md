# Min Ekonomi

Personlig ekonomi-dashboard byggd med React + Vite + TypeScript.

## Kom igång

Krav: Node.js 18+ (nodejs.org)

```bash
cd Ekonomi/app
npm install
npm run dev
```

Öppna http://localhost:5173 i webbläsaren.

## Sidor & funktioner

- Översikt: KPI-kort, inkomst vs utgifter, kassaflöde, senaste transaktioner
- Transaktioner: Sökbar och filtrerbar lista, inline kategoriredigering
- Analys: Heatmap, treemap, staplad kategorivy, radar-jämförelse, månadsförändring
- Budget: Gränser per kategori, progress-bars, varning vid överdrag
- Förmögenhet: Tillgångar & skulder, nettovärde-trend, CSN-skuldprognos
- Importera: Drag-and-drop, importguide, "Kopiera till Claude"-knapp

## Filter

Månadschips, kategori (multi-select), konton, inkomst/utgift, fritextsökning.

## Importformat

- SEB CSV: Bokföringsdatum;...;Text;Belopp;Saldo
- SEB Excel: Samma kolumner i XLSX
- Avanza CSV: Datum;Konto;Typ;Värdepapper;Antal;Kurs;Belopp
- Klarna CSV: Variabla kolumnnamn (GDPR-export)
- CSN CSV: datum;typ;belopp

## Stack

React 19, TypeScript, Vite, Recharts, Framer Motion, Zustand, SheetJS, Tailwind CDN
