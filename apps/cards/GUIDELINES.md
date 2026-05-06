# Cards — Projekt-Leitlinien

Verbindliche Regeln für den Spinoff. Ziel: in wenigen Wochen ein
ausspielbares Web-MVP, das ausschließlich seinen *Core Gameloop*
beherrscht und alles andere von zentralen Mana-Bausteinen erbt.

**Status:** Planungsphase, noch kein Code.
**Name:** Cards.
**Domain:** `cards.mana.how` (Subdomain unter `*.mana.how`, SSO über mana-auth).
**Zugang:** offen für jeden eingeloggten Mana-User (`requiredTier: 'public'`, kein Beta-Gate).

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

### Was Phase 1 enthält

- Decks anlegen / löschen / umbenennen
- Karten manuell erstellen (Markdown-Inhalt)
- **Kartentypen:** Basic, Basic + Reverse, Cloze, Type-In (siehe §6)
- Lernsession mit FSRS v6, **inklusive per-User-Parameter-Tuning**
- "Heute fällig"-Übersicht + Streak-Zähler
- Tags auf Decks (das Modul hat sie ohnehin schon, raus wäre Mehrarbeit)
- PWA-installierbar, offline-fähig
- Auth via mana-auth, Sync via mana-sync

### Was Phase 1 absichtlich NICHT enthält

- KI-Generierung von Karten (kein PDF-Upload, keine Bild→Karte)
- Voice/TTS-Lernen
- Anki-Import / Export
- Statistik-Dashboards (nur Streak + Tagessumme)
- Public Decks / Marktplatz / Sharing
- Stripe / Bezahlung
- Mobile-App (PWA-tauglich aber kein Expo)
- Eigene Domain & Marketing-Landing
- Mehrsprachigkeit über Deutsch hinaus
- Bilder / Audio in Karten
- Image-Occlusion-Karten, Audio-Karten, Multiple-Choice
- Custom Card-Templates / WYSIWYG-Editor
- Erweiterte Suche

Jede dieser Features ist legitim — aber nur, wenn der Loop steht.

## 3. Goldene Regeln

1. **Simpel schlägt vollständig.** Wenn ein Feature nicht zum Core Gameloop gehört, kommt es in einen Phase-2-Backlog, nicht in den Code.
2. **Open Source only.** Jede Library, jedes Tool, jeder Dienst muss eine OSI-konforme Lizenz haben (MIT, Apache 2.0, BSD, MPL, AGPL akzeptabel). Keine Closed-Source-SDKs, keine proprietären APIs als Pflichtabhängigkeit.
3. **Bevorzugt was im Verein schon läuft.** Neue Technologie nur einführen, wenn ein konkreter Engpass es verlangt und kein vorhandenes Tool es löst.
4. **Zentrale Mana-Dienste statt Eigenbau.** Auth, Sync, Analytics, Notifications, Media usw. werden NICHT neu gebaut — siehe §5.
5. **Local-First wie der Rest des Verein-Stacks.** IndexedDB als Quelle der Wahrheit, Sync nach Postgres im Hintergrund.
6. **`cards.mana.how` als Subdomain unter `*.mana.how`.** Kein eigenes Auth-System, kein eigenes Hosting-Setup — Eintrag in `PRODUCTION_TRUSTED_ORIGINS` + Cloudflare-Tunnel-Route reichen.
7. **Eine UI-Schicht, ein Theme.** Wir verwenden `@mana/shared-theme(-ui)` und `@mana/shared-ui` so weit es geht — kein paralleles Design-System.
8. **Erweiterbare Daten, simples UI.** Das Datenmodell denkt zukünftige Kartentypen mit (siehe §6), das UI zeigt in Phase 1 nur die vier definierten Typen.

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
| Markdown-Render | `marked` + `DOMPurify` | MIT |

### Datenhaltung (Client)
| Schicht | Wahl | Lizenz |
|---|---|---|
| Local Store | IndexedDB via Dexie | Apache-2.0 |
| Local-Store-Wrapper | `@mana/local-store` (intern) | — |
| Verschlüsselung | AES-GCM-256 via `@mana/shared-crypto` (Phase 2 — Hooks bereits an allen Schreib-/Lese-Pfaden, Wirkung deferred bis Vault-Server-Roundtrip steht; siehe `src/lib/data/crypto.ts`) | — |

### Spaced Repetition
| Schicht | Wahl | Lizenz |
|---|---|---|
| Algorithmus | FSRS v6 (Free Spaced Repetition Scheduler) | BSD-3 |
| TS-Implementation | `ts-fsrs` (offizielle Portierung, mit Optimizer) | MIT |
| Per-User-Tuning | `ts-fsrs`-Optimizer, läuft client-seitig nach ≥ 50 Reviews | MIT |

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
| `mana-analytics` | 3064 | Page-Views, Loop-Events (siehe §11). |
| `mana-events` | 3115 | Domain-Events für Streak-Logik. |
| `mana-notify` | 3040 | "Du hast X Karten fällig"-Push (Phase 1.5). |
| `mana-credits` | 3061 | **Erst Phase 2** (KI-Generierung). |
| `mana-subscriptions` | 3063 | **Erst Phase 2** (Pro-Tier). |
| `mana-llm`, `mana-stt`, `mana-tts` | – | **Erst Phase 2.** |
| `mana-media` | 3015 | **Erst wenn Bilder in Karten erlaubt sind.** |

### Workspace-Pakete (`@mana/*`)
| Paket | Wofür in Cards |
|---|---|
| `@mana/shared-auth` | Client-seitiger Auth-Hook (SSO-Flow, JWT-Handling). |
| `@mana/shared-auth-ui` | Login/Logout-Komponenten. |
| `@mana/shared-hono` | (sobald cards-server existiert) Auth-/Health-/Error-Middleware. |
| `@mana/shared-branding` | App-Registry-Eintrag (Tier=`public`, Branding, Subdomain). |
| `@mana/shared-types` | Geteilte TS-Typen. |
| `@mana/shared-utils` | Utility-Funktionen. |
| `@mana/shared-ui` | UI-Komponenten. |
| `@mana/shared-theme`, `@mana/shared-theme-ui` | Theme-Tokens, Dark/Light. |
| `@mana/shared-tailwind` | Tailwind-Preset. |
| `@mana/shared-i18n` | Übersetzungsfundament (Phase 1: nur DE registriert). |
| `@mana/shared-icons` | Icon-Set. |
| `@mana/shared-privacy` | Visibility-Enum für Decks (Sharing erst Phase 2, aber Feld vorbereitet). |
| `@mana/shared-crypto` | AES-GCM-256 für sensible Felder. |
| `@mana/shared-pwa` | Manifest, Service-Worker, Install-Prompt. |
| `@mana/shared-vite-config` | Vite-Defaults. |
| `@mana/shared-error-tracking` | Error-Reporting. |
| `@mana/shared-logger` | Strukturiertes Logging (Server-Seite, sobald relevant). |
| `@mana/shared-stores` | Geteilte Local-Store-Helpers. |
| `@mana/shared-tags` | Tags auf Decks. |
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

appId = `cards`. Tabellen: `cardDecks`, `cards`, `cardReviews`,
`cardStudyBlocks`, `deckTags`.

## 6. Datenmodell — erweiterbar gedacht

Heutiges Modul kennt nur `front`/`back`. Damit weitere Kartentypen
ohne Schema-Bruch dazukommen, wechseln wir auf ein **Felder-Map +
Typ-Diskriminator**:

```ts
type CardType =
  | 'basic'           // Phase 1: front/back
  | 'basic-reverse'   // Phase 1: erzeugt zwei Lernrichtungen aus einer Karte
  | 'cloze'           // Phase 1: Lückentext, eine Subkarte pro Cluster
  | 'type-in'         // Phase 1: User tippt Antwort, exact-match-Vergleich
  | 'image-occlusion' // Phase 2
  | 'audio'           // Phase 2
  | 'multiple-choice' // ggf. Phase 2

interface LocalCard extends BaseRecord {
  deckId: string
  type: CardType
  fields: Record<string, string>   // basic: { front, back } · cloze: { text, extra? }
  // FSRS-State liegt nicht hier, sondern in cardReviews (1:N pro Subkarte)
  order: number
}

interface LocalCardReview extends BaseRecord {
  cardId: string
  subIndex: number       // basic-reverse → 0|1, cloze → c1, c2, …
  stability: number      // FSRS
  difficulty: number     // FSRS
  due: string            // ISO
  reps: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  lastReview?: string
}

interface LocalCardStudyBlock extends BaseRecord {
  date: string           // YYYY-MM-DD
  cardsReviewed: number
  durationMs: number
}
```

**Cloze-Syntax:** Anki-kompatibel: `{{c1::Wort}}`, `{{c1::Wort::Hinweis}}`.
Eine Cloze-Karte mit Cluster `c1`+`c2` erzeugt 2 Reviews
(`subIndex 1`, `subIndex 2`).

**Markdown:** `marked` + `DOMPurify` rendern Front/Back. Cloze-Tags
werden vor dem Markdown-Parser zu HTML-Spans umgewandelt, damit sie im
Render erhalten bleiben.

**Migration aus dem Bestand:** existierende `front`/`back`-Karten werden
beim ersten Schema-Upgrade auf `type='basic'` mit
`fields={front, back}` migriert. Alte Spalten bleiben für eine
Übergangsversion lesbar (siehe `docs/DATABASE_MIGRATIONS.md`).

## 7. Daten-Contract mit dem mana-Modul

Wichtig: das **bestehende `cards`-Modul in der Mana-Web-App bleibt
erhalten**. Cards-Standalone und mana-Modul schreiben in dieselben
Postgres-Tabellen.

Daher gilt:
- Schema-Änderungen werden **gemeinsam** im mana-Modul und im
  Cards-Standalone-Code rolled out (nie nur auf einer Seite).
- Encryption-Registry-Einträge müssen in beiden Frontends identisch
  sein (Field-Allowlist).
- Migrationen über `docs/DATABASE_MIGRATIONS.md`.

**Reihenfolge:** Phase 0 (mana-Modul um neue Tabellen + Kartentyp-Felder
+ FSRS erweitern) wird **vor** dem Standalone-Build durchgezogen. So
gibt es nie zwei Wahrheiten zur Datenstruktur.

## 8. Definition of Done für Phase 1

Phase 1 ist fertig, wenn:

1. Ein eingeloggter Mana-User kann auf `cards.mana.how`
   - mindestens ein Deck anlegen,
   - Karten manuell hinzufügen (Basic, Basic+Reverse, Cloze, Type-In),
   - Markdown im Front/Back nutzen (Bold, Listen, Code, Links),
   - eine Lernsession starten und mit FSRS-Bewertung durchspielen,
   - die App schließen und am nächsten Tag die richtigen fälligen Karten wiederfinden.
2. FSRS-Per-User-Tuning läuft automatisch nach ≥ 50 Reviews und überschreibt die Default-Parameter.
3. Die App ist als PWA installierbar und offline-bedienbar (Karten lernen ohne Netz).
4. Auth läuft komplett über mana-auth (kein Eigen-Login).
5. Daten landen in Postgres und sind im bestehenden mana-Modul sichtbar (gleiche Datenquelle, kein Drift).
6. `pnpm validate:all` grün.
7. Mindestens drei Smoke-E2E-Tests (Playwright):
   - „Login → Deck anlegen → Basic-Karte → Lernsession → bewerten"
   - „Cloze-Karte mit zwei Clustern → erzeugt zwei Subkarten"
   - „Type-In: korrekte Antwort = grün, falsche = rot"
8. Container baut & läuft auf dem Mac mini hinter Cloudflare Tunnel (`cards.mana.how`).

Alles andere ist Phase 2.

## 9. Repo-Struktur (Phase 1)

```
apps/cards/
├── apps/
│   └── web/                # SvelteKit-App, einziges Surface in Phase 1
│       ├── src/
│       │   ├── lib/
│       │   │   ├── data/   # Dexie + Sync-Anbindung
│       │   │   ├── fsrs/   # ts-fsrs-Wrapper + Optimizer-Hook
│       │   │   ├── cards/  # Kartentyp-Renderer (basic, cloze, type-in)
│       │   │   ├── stores/ # Decks, Cards, Reviews, StudyBlocks
│       │   │   └── ui/     # Komponenten (DeckList, CardEditor, Session)
│       │   └── routes/
│       │       ├── +layout.svelte
│       │       ├── +page.svelte                  # Heute fällig + Decks
│       │       ├── decks/[id]/+page.svelte       # Deck-Detail + Karten
│       │       └── learn/[deckId]/+page.svelte   # Lernsession
│       ├── package.json
│       ├── svelte.config.js
│       └── vite.config.ts
├── GUIDELINES.md           # ← dieses Dokument
└── README.md
```

`apps/cards/apps/mobile/` und `apps/cards/apps/landing/` sind erst
Phase 2/3.

## 10. PR-Checkliste

Bei jedem Pull-Request gefragt:

- Gehört die Änderung zum Core Gameloop?
- Wenn nein: rechtfertigt sie sich aus einer Pflicht (Auth, Sync, Build)?
- Wird ein bestehendes `@mana/*` Paket genutzt statt neu zu bauen?
- Ist jede neue Dependency Open-Source und im Verein bereits in Verwendung?
- Sind Datenmodell-Änderungen mit dem mana-Modul konsistent?
- Bricht die Änderung das Versprechen "Erweiterbare Daten, simples UI"?

## 11. Analytics-Events (Mindestumfang Phase 1)

Über `mana-analytics`:

- `cards_session_started` — `{ deckId, dueCount }`
- `cards_card_rated` — `{ cardId, type, grade (1–4), elapsedMs }`
- `cards_session_completed` — `{ deckId, cardCount, durationMs }`
- `cards_deck_created` — `{ deckId }`
- `cards_card_created` — `{ deckId, type }`
- `cards_fsrs_optimized` — `{ reviewCount, paramsHash }`
- `cards_pwa_installed` — Standard-PWA-Event

Reicht für die Core-Loop-Validierung. Mehr Events erst, wenn eine
konkrete Frage entsteht, die Daten beantworten sollen.

## 12. Hinweis im mana-Modul

Sobald `cards.mana.how` live ist, bekommt das mana-Modul einen
**dezenten** Hinweis (z.B. ein Banner oder Badge über der ListView):
"Cards gibt es jetzt auch als eigenständige App". Kein Pop-up, kein
forcierter Redirect — User entscheiden selbst.
