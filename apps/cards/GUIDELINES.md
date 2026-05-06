# Cards — Projekt-Leitlinien

Verbindliche Regeln für den Spinoff. Ziel: in wenigen Wochen ein
ausspielbares Web-MVP, das ausschließlich seinen *Core Gameloop*
beherrscht und alles andere von zentralen Mana-Bausteinen erbt.

Status: Planungsphase. Noch kein Code. Markenname offen — bis dahin
Arbeitstitel **Cards**.

## 1. Mission in einem Satz

Die schönste, einfachste Karteikarten-App mit Spaced Repetition —
zuerst nur Web, später Mobile, KI-Generierung als Phase 2.

## 2. Game-Dev-Prinzip: zuerst nur der Core Gameloop

Wie bei einem Spielprototyp gilt: alles, was nicht zum Loop gehört,
wird zurückgestellt. Erst wenn der Loop sich gut anfühlt und Nutzer ihn
freiwillig wiederholen, wird gebaut, was drumherum gehört.

### Der Core Gameloop von Cards

```
Start
  │
  ▼
"Du hast N Karten heute fällig" ─────► (wenn 0: "Alles gelernt — komm später wieder")
  │
  ▼
[Lernen starten]
  │
  ▼
Vorderseite zeigen ──► User denkt ──► Tap/Space ──► Rückseite zeigen
  │
  ▼
Selbst-Bewertung: 1=nochmal · 2=schwer · 3=gut · 4=leicht
  │
  ▼
FSRS rechnet next-due ──► nächste Karte (oder Session-Ende)
  │
  ▼
Session-Ende: "X Karten gelernt, nächste in Y Stunden"
  │
  └─► zurück zum Start
```

Sekundäre Loops (Karten erstellen, Decks verwalten) werden gebaut, sind
aber UI-arm. **Tertiäre Loops (KI-Generierung, Voice, Sharing) sind
Phase 2 und werden in Phase 1 nicht angefasst.**

### Was Phase 1 absichtlich NICHT enthält

- KI-Generierung von Karten (kein PDF-Upload, keine Bild→Karte)
- Voice/TTS-Lernen
- Anki-Import
- Statistik-Dashboards (nur eine Streak-Zahl)
- Public Decks / Marktplatz / Sharing
- Stripe / Bezahlung
- Mobile-App (PWA-tauglich aber kein Expo)
- Eigene Domain & Marketing-Landing
- Mehrsprachigkeit über Deutsch hinaus
- Cloze, Bilder in Karten, Tags, erweiterte Suche

Jede dieser Features ist legitim — aber nur, wenn der Loop steht.

## 3. Goldene Regeln

1. **Simpel schlägt vollständig.** Wenn ein Feature nicht zum Core Gameloop gehört, kommt es in einen Phase-2-Backlog, nicht in den Code.
2. **Open Source only.** Jede Library, jedes Tool, jeder Dienst muss eine OSI-konforme Lizenz haben (MIT, Apache 2.0, BSD, MPL, AGPL akzeptabel). Keine Closed-Source-SDKs, keine proprietären APIs als Pflichtabhängigkeit.
3. **Bevorzugt was im Verein schon läuft.** Neue Technologie nur einführen, wenn ein konkreter Engpass es verlangt und kein vorhandenes Tool es löst.
4. **Zentrale Mana-Dienste statt Eigenbau.** Auth, Sync, Analytics, Notifications, Media usw. werden NICHT neu gebaut — siehe Abschnitt 5.
5. **Local-First wie der Rest des Verein-Stacks.** IndexedDB als Quelle der Wahrheit, Sync nach Postgres im Hintergrund.
6. **Keine eigene Subdomain-Logik in Phase 1.** Cards läuft als Subroute oder dedizierte Subdomain unter `*.mana.how`, damit SSO ohne Sonderwege funktioniert.
7. **Eine UI-Schicht, ein Theme.** Wir verwenden `@mana/shared-theme(-ui)` und `@mana/shared-ui` so weit es geht — kein paralleles Design-System.

## 4. Tech-Stack (Phase 1)

Alles bereits im Verein verwendet, alles OSI-Open-Source.

### Frontend
| Schicht | Wahl | Lizenz |
|---|---|---|
| Framework | SvelteKit 2 | MIT |
| UI-Sprache | Svelte 5 (Runes) | MIT |
| Sprache | TypeScript 5 | Apache-2.0 |
| Styling | Tailwind CSS 4 | MIT |
| Build/Dev | Vite | MIT |
| PWA | `@vite-pwa/sveltekit` (über `@mana/shared-pwa`) | MIT |
| Icons | über `@mana/shared-icons` | MIT |

### Datenhaltung (Client)
| Schicht | Wahl | Lizenz |
|---|---|---|
| Local Store | IndexedDB via Dexie | Apache-2.0 |
| Local-Store-Wrapper | `@mana/local-store` (intern) | — |
| Verschlüsselung | AES-GCM-256 via `@mana/shared-crypto` | — |

### Spaced Repetition
| Schicht | Wahl | Lizenz |
|---|---|---|
| Algorithmus | FSRS (Free Spaced Repetition Scheduler) v6 | BSD-3 |
| Implementierung | `ts-fsrs` (offizielle TS-Portierung) | MIT |

### Deployment
| Schicht | Wahl | Lizenz |
|---|---|---|
| Adapter | `@sveltejs/adapter-node` | MIT |
| Container | Docker, hinter Cloudflare Tunnel | Apache-2.0 |
| Host | Mac mini (siehe `docker-compose.macmini.yml`) | — |

### Tooling
| Schicht | Wahl | Lizenz |
|---|---|---|
| Paket-Manager | pnpm 9 | MIT |
| Monorepo-Orchestrierung | Turborepo (vorhanden) | MPL-2.0 |
| Linting | ESLint (`@mana/eslint-config`) | MIT |
| Formatierung | Prettier | MIT |
| Tests (Unit) | Vitest | MIT |
| Tests (E2E) | Playwright | Apache-2.0 |
| TS-Config | `@mana/test-config`, `@mana/shared-vite-config` | — |

### Backend in Phase 1: keiner

Phase 1 braucht **keinen eigenen Service**. Lese-/Schreibpfad geht
ausschließlich über IndexedDB → `mana-sync` (existiert) → Postgres.

Erst wenn KI-Generierung (Phase 2) dazukommt, entsteht
`services/cards-server` (Hono + Bun, analog zu allen anderen
Verein-Services).

## 5. Zentrale Mana-Bausteine (Pflicht in Phase 1)

### Services (laufen bereits, nur konsumieren)
| Service | Port | Wofür in Cards |
|---|---|---|
| `mana-auth` | 3001 | SSO, JWT, Sessions, Tier-Claims. Cards-Origin in `PRODUCTION_TRUSTED_ORIGINS` eintragen. |
| `mana-sync` | 3050 | Sync der `cards`-AppId-Daten (Decks, Karten, Reviews, StudyBlocks). |
| `mana-user` | 3062 | Profilinfos / Settings. |
| `mana-analytics` | 3064 | Page-Views, Loop-Events (Session gestartet, Karte bewertet …). |
| `mana-events` | 3115 | Domain-Events falls für Streak-Logik nötig. |
| `mana-notify` | 3040 | "Du hast X Karten fällig"-Push (später, Phase 1.5). |
| `mana-credits` | 3061 | **Erst Phase 2** (KI-Generierung). |
| `mana-subscriptions` | 3063 | **Erst Phase 2** (Pro-Tier). |
| `mana-llm`, `mana-stt`, `mana-tts` | – | **Erst Phase 2.** |
| `mana-media` | 3015 | **Erst wenn Bilder in Karten erlaubt sind.** |

### Workspace-Pakete (`@mana/*`)
| Paket | Wofür in Cards |
|---|---|
| `@mana/shared-auth` | Client-seitiger Auth-Hook (SSO-Flow, JWT-Handling). |
| `@mana/shared-auth-ui` | Login/Logout-Komponenten. |
| `@mana/shared-hono` | (nur sobald cards-server existiert) Auth-/Health-/Error-Middleware. |
| `@mana/shared-branding` | App-Registry-Eintrag, Tier-Konfiguration. |
| `@mana/shared-types` | Geteilte TS-Typen. |
| `@mana/shared-utils` | Utility-Funktionen. |
| `@mana/shared-ui` | UI-Komponenten. |
| `@mana/shared-theme`, `@mana/shared-theme-ui` | Theme-Tokens, Dark/Light. |
| `@mana/shared-tailwind` | Tailwind-Preset. |
| `@mana/shared-i18n` | Übersetzungsfundament (Phase 1: nur DE registriert). |
| `@mana/shared-icons` | Icon-Set. |
| `@mana/shared-privacy` | Visibility-Enum für Decks (auch wenn Sharing erst Phase 2). |
| `@mana/shared-crypto` | AES-GCM-256 für sensible Felder. |
| `@mana/shared-pwa` | Manifest, Service-Worker, Install-Prompt. |
| `@mana/shared-vite-config` | Vite-Defaults. |
| `@mana/shared-error-tracking` | Error-Reporting (Sentry-Adapter o.ä., siehe Paket). |
| `@mana/shared-logger` | Strukturiertes Logging (Server-Seite). |
| `@mana/shared-stores` | Geteilte Local-Store-Helpers. |
| `@mana/local-store` | Dexie-Setup, Sync-Hooks. |
| `@mana/eslint-config` | Lint-Regeln. |
| `@mana/test-config` | Vitest-Defaults. |
| `@mana/feedback` | In-App-Feedback-Widget. |
| `@mana/help` | Hilfe-Overlay. |

**Erst Phase 2 oder später:** `@mana/shared-llm`, `@mana/shared-ai`,
`@mana/local-llm`, `@mana/local-stt`, `@mana/credits`, `@mana/qr-export`,
`@mana/wallpaper-generator`, `@mana/website-blocks`,
`@mana/shared-research`, `@mana/shared-uload`, `@mana/shared-storage`.

### Datenpfad

Cards übernimmt 1:1 das Mana-Datenpfad-Pattern:

```
User-Aktion → Store → encryptRecord → Dexie → Hooks (_pendingChanges)
            → mana-sync → Postgres (mana_platform.cards.*) → andere Clients
```

Die Tabellen heißen genau wie heute im mana-Modul (`cardDecks`, `cards`),
plus neue Tabellen für FSRS-State (`cardReviews`, `cardStudyBlocks`).
appId = `cards`.

## 6. Daten-Contract mit dem mana-Modul

Wichtig: das **bestehende `cards`-Modul in der Mana-Web-App bleibt
erhalten** (siehe Spinoff-Skizze). Cards-Standalone und mana-Modul
schreiben in dieselben Postgres-Tabellen.

Daher gilt:
- Schema-Änderungen werden **gemeinsam** im mana-Modul und im
  Cards-Standalone-Code rolled out (nie nur auf einer Seite).
- Encryption-Registry-Einträge müssen in beiden Frontends identisch
  sein (Field-Allowlist).
- Migrationen über `docs/DATABASE_MIGRATIONS.md`.

## 7. Definition of Done für Phase 1

Phase 1 ist fertig, wenn:

1. Ein eingeloggter Mana-User kann auf der Cards-Web-App
   - mindestens ein Deck anlegen,
   - Karten manuell hinzufügen (Front/Back, reiner Text),
   - eine Lernsession starten und Karten mit FSRS-Bewertung durchspielen,
   - die App schließen und am nächsten Tag die richtigen fälligen Karten wiederfinden.
2. Die App ist als PWA installierbar und offline-bedienbar (Karten lernen ohne Netz).
3. Auth läuft komplett über mana-auth (kein Eigen-Login).
4. Daten landen in Postgres und sind im bestehenden mana-Modul sichtbar (gleiche Datenquelle).
5. `pnpm validate:all` grün.
6. Mindestens ein Smoke-E2E-Test (Playwright): „Login → Deck anlegen → Karte anlegen → Lernsession starten → Karte bewerten".
7. Container baut & läuft auf dem Mac mini hinter Cloudflare Tunnel.

Alles andere ist Phase 2.

## 8. Repo-Struktur (Phase 1)

```
apps/cards/
├── apps/
│   └── web/                # SvelteKit-App, einziges Surface in Phase 1
│       ├── src/
│       │   ├── lib/
│       │   │   ├── data/   # Dexie + Sync-Anbindung
│       │   │   ├── fsrs/   # ts-fsrs-Wrapper
│       │   │   ├── stores/ # Decks, Cards, Reviews
│       │   │   └── ui/     # Komponenten (Card, DeckList, Session)
│       │   └── routes/
│       │       ├── +layout.svelte
│       │       ├── +page.svelte           # Heute fällig + Decks
│       │       ├── decks/[id]/+page.svelte
│       │       └── learn/[deckId]/+page.svelte
│       ├── package.json
│       ├── svelte.config.js
│       └── vite.config.ts
├── GUIDELINES.md           # ← dieses Dokument
└── README.md
```

`apps/cards/apps/mobile/` und `apps/cards/apps/landing/` sind erst
Phase 2/3.

## 9. Was bei jedem Pull-Request gefragt wird

- Gehört die Änderung zum Core Gameloop?
- Wenn nein: rechtfertigt sie sich aus einer Pflicht (Auth, Sync, Build)?
- Wird ein bestehendes `@mana/*` Paket genutzt statt neu zu bauen?
- Ist jede neue Dependency Open-Source und im Verein bereits in Verwendung?
- Sind Datenmodell-Änderungen mit dem mana-Modul konsistent?

## 10. Offene Fragen — siehe unten / im Chat

Sammelpunkt für noch zu klärende Entscheidungen, bevor Code entsteht.
Liste wird in den ersten Tagen aktiv abgearbeitet.
