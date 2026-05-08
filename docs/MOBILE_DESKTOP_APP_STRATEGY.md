# Mobile & Desktop App Strategie

> Analyse der Optionen, die bestehende Mana SvelteKit-App als native Mobile- und Desktop-App auszuliefern.
>
> Stand: April 2026

## Ausgangslage

Die Mana Unified App ist eine SvelteKit 2 + Svelte 5 Anwendung mit:

- **27+ Module** in einer einzigen App (`apps/mana/apps/web`)
- **Local-first Architektur** mit Dexie.js / IndexedDB (120+ Collections)
- **Tailwind CSS** für Styling
- **Hintergrund-Sync** via mana-sync (Go, WebSocket)
- Bestehende **Expo/React Native Mobile-Apps** im Monorepo (einzelne Module)

Ziel: Die gesamte unified App auf iOS, Android, macOS, Windows und Linux bringen — idealerweise mit maximaler Code-Wiederverwendung.

---

## Optionen

### 1. Tauri v2

**Funktionsweise:** Nutzt die native WebView des Betriebssystems (WebKit auf macOS/iOS, WebView2 auf Windows, WebKitGTK auf Linux, Android WebView). Backend in Rust. Kein gebündelter Browser.

**Plattformen:** iOS, Android, macOS, Windows, Linux — alles mit einer Codebase.

| Aspekt | Bewertung |
|--------|-----------|
| SvelteKit-Wiederverwendung | Sehr gut — SPA via `adapter-static`, Svelte ist First-Class-Citizen |
| IndexedDB/Dexie.js | Funktioniert, aber iOS-WebKit-Limit ~500 MB |
| Native APIs | Gut — Dateisystem, Notifications, Clipboard, Biometrics, Updater u.v.m. Eigene Plugins in Rust/Swift/Kotlin |
| Bundle-Grösse | 2–10 MB (kein Chromium gebündelt) |
| App Store Distribution | Alle Stores unterstützt |
| Performance | Sehr gut auf Desktop. Auf Mobile abhängig von System-WebView-Qualität |
| Community | ~85k GitHub Stars, aktive Entwicklung |

**Vorteile:**

- Einziges Framework das alle 5 Plattformen mit einer Codebase abdeckt
- Winzige Bundles im Vergleich zu Electron
- Svelte/SvelteKit offiziell unterstützt
- Gute Plugin-Architektur

**Nachteile:**

- Mobile-Support erst seit Oktober 2024 stabil — für eine komplexe App mit 27+ Modulen ein Risiko
- WebView-Inkonsistenzen zwischen Plattformen (besonders ältere Android-Geräte)
- Rust-Toolchain für eigene Plugins nötig
- Plugin-Ökosystem kleiner als Capacitor oder Electron

---

### 2. Capacitor (Ionic)

**Funktionsweise:** Wrapping-Framework, das eine Web-App in einer nativen WebView-Shell ausführt. Entwickelt von Ionic (Nachfolger von Cordova). Bridge zu nativen APIs.

**Plattformen:** iOS und Android (Kernfokus). Desktop nur via Electron-Plugin.

| Aspekt | Bewertung |
|--------|-----------|
| SvelteKit-Wiederverwendung | Gut — SPA via `adapter-static`, offizielle Anleitungen verfügbar |
| IndexedDB/Dexie.js | Funktioniert, selbes iOS-WebKit-Limit wie Tauri |
| Native APIs | Sehr umfangreich — grösstes Plugin-Ökosystem aller WebView-Frameworks (Camera, Filesystem, Push, Haptics, Contacts, etc.) |
| Bundle-Grösse | 15–30 MB |
| App Store Distribution | Exzellent — explizit dafür gebaut, tausende Apps in den Stores |
| Performance | Gut für die meisten Anwendungsfälle |
| Community | Sehr gross, Version 6, produktionsbewährt (Burger King, Sworkit) |

**Vorteile:**

- Grösstes Plugin-Ökosystem für Mobile
- Sehr ausgereift und produktionsbewährt
- Einfache Integration (`npx cap sync`)
- Niedriger Wartungsaufwand

**Nachteile:**

- Kein nativer Desktop-Support — braucht zusätzlich Electron oder Tauri
- Für "alle Plattformen" sind zwei Frameworks nötig
- Selbe iOS-IndexedDB-Einschränkungen

---

### 3. Electron

**Funktionsweise:** Bündelt eine vollständige Chromium-Instanz + Node.js mit der Web-App. Die App läuft in ihrem eigenen Chrome-Browser.

**Plattformen:** macOS, Windows, Linux. Kein Mobile-Support.

| Aspekt | Bewertung |
|--------|-----------|
| SvelteKit-Wiederverwendung | Gut — SPA oder SSR mit Node-Adapter möglich |
| IndexedDB/Dexie.js | Exzellent — eigenes Chromium, keine Limits, konsistentes Verhalten |
| Native APIs | Sehr umfangreich — Dateisystem, Tray, Menüs, Dialoge, Shortcuts, Autostart, Protocol Handler u.v.m. Volles npm-Ökosystem |
| Bundle-Grösse | 80–200+ MB (Chromium + Node.js gebündelt) |
| App Store Distribution | Möglich (VS Code, Slack, Discord im Mac App Store) |
| Performance | Gut für UI, hoher RAM-Verbrauch (100–300 MB Baseline) |
| Community | Industriestandard seit 2013, riesige Community |

**Vorteile:**

- Beste IndexedDB-Unterstützung (eigenes Chromium, keine Plattform-Abhängigkeit)
- Ausgereiftestes Desktop-Framework
- Riesiges Ökosystem
- Node.js-Zugriff für Server-seitige Operationen

**Nachteile:**

- Kein Mobile-Support
- Sehr grosse Bundles (80–200 MB)
- Hoher RAM-Verbrauch
- Regelmässige Chromium-Sicherheitsupdates nötig

---

### 4. PWA (Progressive Web App)

**Funktionsweise:** Die bestehende Web-App wird mit Service Worker und Web App Manifest erweitert. Kein nativer Wrapper — läuft direkt im Browser.

**Plattformen:** Alle (via Browser installierbar). iOS eingeschränkt.

| Aspekt | Bewertung |
|--------|-----------|
| SvelteKit-Wiederverwendung | Perfekt — 100%, keine Anpassungen nötig |
| IndexedDB/Dexie.js | Funktioniert, aber **kritisch auf iOS: Safari löscht IndexedDB-Daten nach 7 Tagen Inaktivität** |
| Native APIs | Begrenzt — Notifications, Geolocation, Camera, Share API, Clipboard. Kein echtes Dateisystem (iOS), eingeschränkter Hintergrund-Sync |
| Bundle-Grösse | 0 MB zusätzlich |
| App Store Distribution | Schwierig — Apple lehnt reine WebView-Apps zunehmend ab. Google Play via TWA möglich |
| Performance | Identisch zur Web-Version |
| Community | Web-Standard, aber Apple treibt PWA-Support nicht voran |

**Vorteile:**

- Zero Aufwand — Service Worker + Manifest hinzufügen
- Sofort installierbar auf allen Plattformen
- Kein App-Store-Review nötig
- Updates sofort verfügbar

**Nachteile:**

- **Für local-first auf iOS nicht verlässlich** (7-Tage-IndexedDB-Löschung)
- Begrenzte native APIs
- Apple akzeptiert reine WebView-Apps kaum noch im App Store
- Keine echte "App-Erfahrung" auf iOS

---

### 5. React Native / Expo

**Funktionsweise:** Echte native UI-Komponenten, gesteuert durch JavaScript. Kein WebView — rendert direkt UIKit (iOS) bzw. Android Views. Neue Architektur (Fabric + TurboModules) seit 2024 Standard.

**Plattformen:** iOS und Android (Kernfokus). Desktop experimentell (react-native-macos/windows von Microsoft).

| Aspekt | Bewertung |
|--------|-----------|
| SvelteKit-Wiederverwendung | Keine — komplett andere Technologie (React + JSX statt Svelte) |
| IndexedDB/Dexie.js | Nicht verfügbar — Alternativen: SQLite, MMKV, WatermelonDB |
| Native APIs | Exzellent — voller Zugriff auf alle nativen APIs. 50+ Expo-Module |
| Bundle-Grösse | 20–50 MB |
| App Store Distribution | Exzellent — EAS Build + EAS Submit für automatisierte Store-Submissions |
| Performance | Beste Mobile-Performance aller Optionen (native Rendering) |
| Community | Sehr gross — Meta, Microsoft, Amazon, Shopify nutzen React Native |

**Vorteile:**

- Beste Performance auf Mobile (kein WebView-Overhead)
- Voller Zugang zu allen nativen APIs
- Bestehende Expo-Erfahrung und Apps im Monorepo
- OTA-Updates via EAS Update

**Nachteile:**

- **Kein Code-Sharing mit SvelteKit** — komplettes UI-Rewrite nötig
- Dexie.js/IndexedDB nicht verfügbar, Datenschicht muss komplett neu gebaut werden
- 27+ Module doppelt pflegen = enormer Aufwand
- Kein verlässlicher Desktop-Support

---

### 6. Wails

**Funktionsweise:** Wie Tauri, aber Backend in Go statt Rust. Nutzt die System-WebView. Go-Funktionen direkt aus dem Frontend aufrufbar.

**Plattformen:** macOS, Windows, Linux. Kein Mobile-Support.

| Aspekt | Bewertung |
|--------|-----------|
| SvelteKit-Wiederverwendung | Gut — SPA, Svelte offiziell unterstützt |
| IndexedDB/Dexie.js | Wie Tauri — abhängig von System-WebView |
| Native APIs | Basis — Fenster, Menüs, Dialoge, Events, Clipboard. Eigene APIs in Go |
| Bundle-Grösse | 5–15 MB |
| App Store Distribution | Desktop-Stores möglich |
| Performance | Gut auf Desktop |
| Community | Mittel (~26k Stars), Wails v3 seit langem in Entwicklung |

**Vorteile:**

- Passt zur bestehenden Go-Expertise (6 Go-Services im Monorepo)
- Kleine Bundles
- Go-Backend kann direkt auf bestehende Service-Logik zugreifen

**Nachteile:**

- Kein Mobile-Support
- Deutlich kleinere Community als Tauri oder Electron
- Weniger Native APIs als Tauri
- Wails v3 Entwicklung schleppend

---

## Vergleichsmatrix

| Kriterium | Tauri v2 | Capacitor | Electron | PWA | React Native | Wails |
|---|---|---|---|---|---|---|
| **iOS** | Ja (seit 2024) | Ja (ausgereift) | Nein | Eingeschränkt | Ja (ausgereift) | Nein |
| **Android** | Ja (seit 2024) | Ja (ausgereift) | Nein | Ja | Ja (ausgereift) | Nein |
| **macOS** | Ja | Via Electron | Ja | Via Browser | Experimentell | Ja |
| **Windows** | Ja | Via Electron | Ja | Via Browser | Experimentell | Ja |
| **Linux** | Ja | Via Electron | Ja | Via Browser | Nein | Ja |
| **SvelteKit direkt nutzbar** | Ja (SPA) | Ja (SPA) | Ja (SPA/SSR) | Ja (100%) | Nein | Ja (SPA) |
| **IndexedDB/Dexie.js** | Gut¹ | Gut¹ | Exzellent | Riskant² | N/A | Gut¹ |
| **Native API Umfang** | Gut | Sehr gut | Sehr gut | Begrenzt | Exzellent | Basis |
| **Bundle-Grösse** | 2–10 MB | 15–30 MB | 80–200 MB | 0 MB | 20–50 MB | 5–15 MB |
| **App Store tauglich** | Ja | Ja | Ja (Desktop) | Schwierig | Ja | Ja (Desktop) |
| **Community** | Gross (85k★) | Gross | Sehr gross | Web-Standard | Sehr gross | Mittel (26k★) |
| **Wartungsaufwand** | Mittel | Niedrig–Mittel | Mittel | Minimal | Hoch (2. Codebase) | Niedrig |

¹ iOS-WebKit-Limit ~500 MB für IndexedDB
² iOS Safari: Löschung nach 7 Tagen Inaktivität

---

## Empfehlung

### Primärstrategie: Tauri v2

Tauri v2 ist das einzige Framework, das alle 5 Zielplattformen (iOS, Android, macOS, Windows, Linux) mit einer einzigen SvelteKit-Codebase abdeckt. Svelte ist offiziell unterstützt, die Bundles sind winzig, und die Plugin-Architektur ist erweiterbar.

**Risiken die im Auge behalten werden müssen:**

- Mobile-Support ist jung — gründliches Testing mit allen 27+ Modulen nötig
- WebView-Inkonsistenzen auf älteren Android-Geräten
- iOS-WebKit-Limit für IndexedDB (~500 MB) bei wachsender Datenmenge

### Fallback: Capacitor (Mobile) + Tauri (Desktop)

Falls Tauri v2 Mobile sich für die Komplexität der 27+ Module als zu unreif erweist:

- **Capacitor** für iOS/Android — ausgereifter, grösstes Mobile-Plugin-Ökosystem
- **Tauri v2** für Desktop — leichtgewichtig, Svelte-First-Class
- Dieselbe SvelteKit SPA-Codebase für beide Wrapper

### PWA als sofortige Massnahme

Unabhängig von der nativen Strategie: Service Worker und Web App Manifest hinzufügen. Kostet fast nichts, bringt sofortige Installierbarkeit auf Desktop (Chrome/Edge). Auf iOS für local-first allerdings nicht verlässlich.

### React Native / Expo nur für dedizierte Einzel-Apps

Die bestehenden Expo-Apps im Monorepo machen Sinn für Module, die eine fundamental native Mobile-UX brauchen (z.B. Cardecky mit Swipe-Gesten, Chat mit nativen Push Notifications). Für "die gesamte unified App auf Mobile bringen" ist der Aufwand (komplettes Rewrite) nicht verhältnismässig.

### IndexedDB-Risiko mitigieren

Das grösste technische Risiko über alle WebView-Ansätze hinweg ist das iOS-WebKit-Verhalten:

- **SQLite-Plugin als Alternative auf Mobile** — Tauri hat `tauri-plugin-sql`, Capacitor hat `@capacitor-community/sqlite`
- **Hybride Strategie:** IndexedDB im Web, SQLite im nativen Wrapper
- **Dexie.js** arbeitet an experimentellen SQLite-Backends (Dexie Cloud)

---

## Nächste Schritte

1. **PWA-Grundlagen einbauen** — Service Worker + Manifest für sofortige Desktop-Installierbarkeit
2. **Tauri v2 Proof-of-Concept** — SvelteKit-App als SPA mit adapter-static bauen, in Tauri laden, auf allen 5 Plattformen testen
3. **IndexedDB-Limits evaluieren** — Tatsächlichen Speicherbedarf der 120+ Collections messen, iOS-Verhalten unter Last testen
4. **SQLite-Fallback prototypen** — Dexie.js mit SQLite-Backend oder Storage-Abstraktionsschicht evaluieren
5. **Entscheidung treffen** — Basierend auf PoC-Ergebnissen: Tauri allein oder Capacitor+Tauri Kombi
