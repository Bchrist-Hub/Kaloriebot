# Kalorietæller

Desktop-app til at tracke fødevareindtag, kalorier, BMI og vægtudvikling. Baseret på 1.381 fødevarer fra den danske Frida-database.

## Forudsætninger

- **Node.js** ≥ 18 — download fra [nodejs.org](https://nodejs.org)
- **npm** (følger med Node.js)

## Hurtigstart

```bash
# 1. Installer afhængigheder
npm install

# 2. Kør i dev-mode (browser)
npm run dev

# 3. Kør i dev-mode (Electron desktop-vindue)
npm run electron:dev
```

## Build til desktop

```bash
# Mac (.dmg + .zip)
npm run electron:build:mac

# Windows (.exe installer + portable)
npm run electron:build:win

# Begge platforme
npm run electron:build:all
```

Færdige apps havner i `release/`-mappen.

### Cross-compilation

- **Mac → Windows**: Kræver Wine (`brew install --cask wine-stable`)
- **Windows → Mac**: Ikke muligt — macOS-builds kræver en Mac

## Projektstruktur

```
kalorie-app/
├── electron/
│   └── main.cjs          # Electron main process
├── public/
│   └── icon.png           # App-ikon (tilføj dit eget, 512×512 px)
├── src/
│   ├── App.jsx            # Hoved-komponent med al UI-logik
│   ├── foods.js           # 1.381 fødevarer fra Frida-databasen
│   └── main.jsx           # React entry point
├── index.html             # HTML entry point
├── package.json           # Afhængigheder og build-scripts
└── vite.config.js         # Vite bundler-konfiguration
```

## Funktioner

- **BMI-beregning** med farvekodede kategorier
- **TDEE-beregning** (Mifflin-St Jeor + aktivitetsfaktor)
- **Fødevaresøgning** med word-boundary matching og relevansssortering
- **Måltidskategorier** (morgenmad, frokost, aftensmad, snacks) med auto-forslag
- **Favoritter og seneste** for hurtig adgang til hyppigt brugte fødevarer
- **Tilføj egne fødevarer** med kalorieværdi per 100g
- **Vægtlog med graf** og TDEE-sammenligning per datapunkt
- **Ugentligt gennemsnit** med estimeret vægtændring
- **Data gemmes lokalt** via localStorage (persisterer mellem sessioner)

## Senere: Mobil

Appen kan wraps til mobil med:
- **Capacitor** (anbefalet) — genbruger web-koden direkte
- **React Native** — kræver omskrivning af UI

```bash
# Capacitor setup (fremtidigt)
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add ios
npx cap add android
```
