# Cards-Marktplatz — Plan

> **Status**: Plan, kein Code. Stand 2026-05-07.
> **Goal-Setting**: Vollvision, kein MVP-Druck. Wir bauen die optimale Lösung.
> **Alignment**: User hat folgende Eckpunkte gesetzt:
> - Versionierte Decks + Live-Updates + Pull-Requests = ja, volle Vision
> - mana-credits zentral, sowohl für User-Käufe als auch Author-Verdienst
> - „Verified" zweigleisig: Mana-Verein-Kuration UND Community-Schwellen, mit unterschiedlichen Badges
> - Co-Learn-Sessions explizit **nicht** für Phase 1 — auf Phase 2 verschoben
> - Mobile-App auch später

---

## 1. Mission

**Die Karteikarten-Plattform mit der besten Lern-Community im Netz.** Wo qualitativ hochwertige Decks entstehen, gepflegt, geteilt und gelernt werden — und wo Lernende einander helfen.

## 2. Was wir gegen die Konkurrenz aufbieten

(verdichtet aus `apps/cards/COMPETITORS_2026-05.md`)

| Differenzierer | Wir | Wer noch |
|---|---|---|
| Free Cloud-Sync | ✓ | niemand |
| Versionierte Decks mit Live-Updates | ✓ | nur AnkiHub (paywalled, Medizin-only) |
| Pull-Requests auf Decks | ✓ | niemand |
| Card-Discussions (inline pro Karte) | ✓ | niemand |
| AI-Karten + AI-Moderation + AI-Tags | ✓ | fragmentiert bei anderen |
| Open Source PWA | ✓ | nur Anki/Mnemosyne (Desktop) |
| Anki-Migration mit Bildern/Audio | ✓ (vorhanden) | niemand vollständig |
| Author-Followings + Activity-Feed | ✓ | niemand |
| Bezahlte Decks mit Author-Erlös via mana-credits | ✓ | nur Brainscape (eigenes Closed-Pricing) |
| Pseudonym + verifiziert kombinierbar | ✓ | niemand klar |

## 3. Architektur-Prinzipien

1. **API ist `/v1` ab Tag 1** — OpenAPI-Spec als Quelle der Wahrheit, Versionierungs-Bewusstsein eingebaut.
2. **Public-Decks leben separat** vom Local-First-Sync-Pfad (eigene Postgres-Tabellen, eigene Service, eigene RLS-Policies). Kein Vermischen mit `mana_sync.sync_changes`.
3. **Subscribed Decks sind unidirektional**: Author → Subscribers. Updates fließen einseitig. Wer ändern will, forkt.
4. **Content-Hash überall.** Jede Karte und jede Version bekommt einen deterministischen SHA-256 → Trust + Cache + Diff kostenlos.
5. **Lizenzen sind explizit + maschinen-lesbar** (SPDX-IDs: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, plus eigener `Cards-Personal-Use-1.0` für Default-Käufe und `Cards-Pro-Only-1.0` für paid Decks).
6. **AI ist Moderator, nicht Gatekeeper** — KI-First-Pass + Human-Review-Eskalation. Niemals KI-allein-Take-down.
7. **Search ist von der DB entkoppelt** — Read-Only-Index, asynchron befüllt. Bricht der Search-Service, läuft der Marktplatz weiter.
8. **mana-credits ist die einzige Geld-Schnittstelle** — niemals Stripe direkt im cards-server. Alles geht über `/api/v1/credits/use`, `/credits/grant`, `/credits/reservations/*`.
9. **Anonymisiertes Lern-Verhalten**: aggregierte Stats sichtbar (z.B. „1.200 Lernende"), individuelles Lernverhalten nie öffentlich ohne explizites Opt-in.
10. **Keine Drittanbieter-Tracker.** Telemetrie ausschließlich über mana-analytics, opt-out möglich.

## 4. Datenmodell

Neues Schema `cards` in `mana_platform`. Alle Tabellen über `pgSchema('cards').table(...)` (Mana-Konvention).

### 4.1 Authoren

```sql
public_authors (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id),
  slug               text UNIQUE NOT NULL,        -- @anna-lang
  display_name       text NOT NULL,
  bio                text,
  avatar_url         text,
  joined_at          timestamptz DEFAULT now(),
  pseudonym          boolean DEFAULT false,        -- true = klarname versteckt
  verified_mana      boolean DEFAULT false,        -- vom Verein verliehen
  verified_community boolean DEFAULT false,        -- automatisch ab Schwelle
  banned_at          timestamptz,                  -- soft-ban
  banned_reason      text
)
```

Drei Verifizierungs-Stufen mit unterschiedlichen Badges in der UI:

| Status | Badge | Wer / wie |
|---|---|---|
| `verified_mana = true` | 🛡️ **Mana Verifiziert** | Manuell vom Mana-Verein vergeben (Lehrer, Profis, Sprachschulen, Ärzte). Nicht erkaufbar. |
| `verified_community = true` | ⭐ **Community Verifiziert** | Automatisch bei: ≥ 500 Stars über alle Decks ODER ≥ 3 featured Decks ODER ≥ 200 aktive Subscribers über alle Decks. Periodisch neu evaluiert. |
| beides | 🛡️⭐ Beide Badges | Mana + Community zusammen. |

### 4.2 Decks + Versionen

```sql
public_decks (
  id                  uuid PRIMARY KEY,
  slug                text UNIQUE NOT NULL,        -- /decks/anna-lang/spanish-a2-vocab
  title               text NOT NULL,
  description         text,
  language            text,                         -- ISO-639-1
  license             text NOT NULL,                -- SPDX
  price_credits       integer DEFAULT 0,            -- 0 = kostenlos
  owner_user_id       uuid NOT NULL REFERENCES public_authors(user_id),
  latest_version_id   uuid,                         -- → public_deck_versions
  is_featured         boolean DEFAULT false,
  is_takedown         boolean DEFAULT false,
  takedown_at         timestamptz,
  takedown_reason     text,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT price_requires_license CHECK (price_credits = 0 OR license = 'Cards-Pro-Only-1.0')
)

public_deck_versions (
  id                  uuid PRIMARY KEY,
  deck_id             uuid NOT NULL REFERENCES public_decks(id),
  semver              text NOT NULL,                -- 1.0.0, 1.1.0, 2.0.0
  changelog           text,
  content_hash        text NOT NULL,                -- SHA-256 of canonicalized cards
  card_count          integer NOT NULL,
  published_at        timestamptz DEFAULT now(),
  deprecated_at       timestamptz,
  UNIQUE (deck_id, semver)
)

public_deck_cards (
  id                  uuid PRIMARY KEY,
  version_id          uuid NOT NULL REFERENCES public_deck_versions(id),
  type                text NOT NULL,                -- basic, basic-reverse, cloze, type-in
  fields              jsonb NOT NULL,               -- {front, back} oder {text, extra}
  ord                 integer NOT NULL,
  content_hash        text NOT NULL,                -- per Karte: ermöglicht Smart-Merge
  UNIQUE (version_id, ord)
)
```

### 4.3 Tags + Discovery

```sql
tag_definitions (
  id                  uuid PRIMARY KEY,
  slug                text UNIQUE NOT NULL,
  name                text NOT NULL,
  parent_id           uuid REFERENCES tag_definitions(id),  -- Hierarchie
  description         text,
  curated             boolean DEFAULT false         -- vom Mana-Verein gepflegt
)

deck_tags (
  deck_id             uuid REFERENCES public_decks(id),
  tag_id              uuid REFERENCES tag_definitions(id),
  PRIMARY KEY (deck_id, tag_id)
)
```

### 4.4 Engagement (Stars, Subscribes, Forks)

```sql
deck_stars (
  user_id             uuid REFERENCES auth.users(id),
  deck_id             uuid REFERENCES public_decks(id),
  starred_at          timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, deck_id)
)

deck_subscriptions (
  user_id             uuid REFERENCES auth.users(id),
  deck_id             uuid REFERENCES public_decks(id),
  current_version_id  uuid REFERENCES public_deck_versions(id),
  subscribed_at       timestamptz DEFAULT now(),
  notify_updates      boolean DEFAULT true,
  PRIMARY KEY (user_id, deck_id)
)

deck_forks (
  user_id             uuid REFERENCES auth.users(id),
  source_deck_id      uuid REFERENCES public_decks(id),
  source_version_id   uuid REFERENCES public_deck_versions(id),
  forked_at           timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, source_deck_id, source_version_id)
)

author_follows (
  follower_user_id    uuid REFERENCES auth.users(id),
  author_user_id      uuid REFERENCES public_authors(user_id),
  since               timestamptz DEFAULT now(),
  PRIMARY KEY (follower_user_id, author_user_id)
)
```

### 4.5 Pull-Requests + Discussions

```sql
deck_pull_requests (
  id                  uuid PRIMARY KEY,
  deck_id             uuid REFERENCES public_decks(id),
  author_user_id      uuid REFERENCES auth.users(id),
  status              text NOT NULL,                -- open, merged, closed, rejected
  title               text NOT NULL,
  body                text,
  diff                jsonb NOT NULL,               -- {add: [...], modify: [...], remove: [...]}
  merged_into_version uuid REFERENCES public_deck_versions(id),
  created_at          timestamptz DEFAULT now(),
  resolved_at         timestamptz
)

card_discussions (
  id                  uuid PRIMARY KEY,
  card_content_hash   text NOT NULL,                -- bindet sich an Karte, nicht an version
  deck_id             uuid REFERENCES public_decks(id),
  author_user_id      uuid REFERENCES auth.users(id),
  parent_id           uuid REFERENCES card_discussions(id),
  body                text NOT NULL,
  hidden              boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
)
```

### 4.6 Moderation

```sql
deck_reports (
  id                  uuid PRIMARY KEY,
  deck_id             uuid REFERENCES public_decks(id),
  version_id          uuid REFERENCES public_deck_versions(id),
  card_content_hash   text,                         -- optional: Karte spezifisch
  reporter_user_id    uuid REFERENCES auth.users(id),
  category            text NOT NULL,                -- spam, copyright, nsfw, misinformation, other
  body                text,
  status              text DEFAULT 'open',          -- open, dismissed, actioned
  resolved_by         uuid,
  resolved_at         timestamptz,
  resolution_notes    text,
  created_at          timestamptz DEFAULT now()
)

ai_moderation_log (
  id                  uuid PRIMARY KEY,
  version_id          uuid REFERENCES public_deck_versions(id),
  verdict             text NOT NULL,                -- pass, flag, block
  categories          text[],                       -- spam, csam, hate, nsfw, ...
  model               text,                         -- "claude-3-5-sonnet" etc
  rationale           text,
  human_reviewed      boolean DEFAULT false,
  human_overrode      boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
)
```

### 4.7 mana-credits Integration

```sql
deck_purchases (
  id                  uuid PRIMARY KEY,
  buyer_user_id       uuid REFERENCES auth.users(id),
  deck_id             uuid REFERENCES public_decks(id),
  version_id          uuid REFERENCES public_deck_versions(id),
  price_credits       integer NOT NULL,             -- Snapshot zum Zeitpunkt des Kaufs
  author_share        integer NOT NULL,             -- nach Verein-Cut
  mana_share          integer NOT NULL,
  credits_transaction text,                         -- mana-credits ID
  purchased_at        timestamptz DEFAULT now(),
  refunded_at         timestamptz,
  UNIQUE (buyer_user_id, deck_id)                   -- einmal Kauf reicht für Lifetime + alle Versionen
)

author_payouts (
  id                  uuid PRIMARY KEY,
  author_user_id      uuid REFERENCES public_authors(user_id),
  source_purchase_id  uuid REFERENCES deck_purchases(id),
  credits_granted     integer NOT NULL,
  credits_grant_id    text,                         -- mana-credits grant ID
  granted_at          timestamptz DEFAULT now()
)
```

## 5. mana-credits Integration (Detail)

Zwei-seitiger Marktplatz. mana-credits ist Single-Source-of-Truth fürs Geld.

### 5.1 Kauf-Flow (Buyer)

1. User klickt „Kaufen" auf paid Deck (Preis: z.B. 50 Credits)
2. cards-server checkt: Hat User schon dieses Deck? (deck_purchases) → wenn ja, sofort Zugriff
3. cards-server reserviert Credits via `POST mana-credits/api/v1/credits/reservations` (2-phase)
4. cards-server erstellt deck_purchases-Row (committed)
5. cards-server commit-released die Reservation → Credits abgebucht
6. cards-server erstellt author_payouts-Row → ruft `POST mana-credits/api/v1/internal/credits/grant` für den Author-Anteil
7. User bekommt sofortigen Zugriff: Deck wird in private Liste verschoben (User hat eine eigene Lokal-Kopie als Author-Subscription)

**Was passiert wenn Author gebannt nach Kauf?** → Refund-Path (Phase γ Implementation): Admin kann Refund triggern → mana-credits → Reverse-Grant → User behält das Deck nicht mehr.

### 5.2 Author-Auszahlungs-Modell

- **Standard-Cut**: 80 % Author / 20 % Mana-Verein (Server-, Hosting-, Moderations-Kosten)
- **Verifizierte Authoren** (verified_mana): 90 % / 10 %
- **Mindestauszahlung**: keine — Credits werden direkt im mana-credits-Account gebucht, von dort kann der Author sie selbst nutzen oder per Stripe-Payout (mana-credits-Feature, falls vorhanden) abheben
- **Pricing-Range**: Free (0 Credits), oder 10–500 Credits (entspricht ungefähr 1–50 € — exakte Conversion siehe mana-credits packages)

### 5.3 Käufer-Lebenszyklus

- Einmal gekauft = Lifetime-Zugriff auf alle künftigen Versionen
- Bei major Version (e.g. 1.x → 2.0.0) **kein** zweiter Kauf nötig — Author behält die Verbesserungs-Pflicht
- Refund-Window: 30 Tage, automatisch verfügbar wenn ≤ 10 % der Karten gelernt wurden (Quizlet hat das, ist Best-Practice)

### 5.4 Buyer-Protection bei Take-Down

- Wenn Deck per Take-Down entfernt wird, behält Buyer Zugriff auf das letzte gesehene Snapshot (DSGVO-konform)
- Refund automatisch wenn Take-Down innerhalb 90 Tagen nach Kauf

## 6. Service-Architektur

### 6.1 `cards-server` (neu)

- **Stack**: Hono + Bun (Mana-Konvention)
- **Port**: 3072
- **Deps**: PostgreSQL (`mana_platform.cards.*`), Redis (Job-Queue für Indexing/Notifications)
- **Auth**: JWT via JWKS (mana-auth)
- **Routes**: siehe §7

### 6.2 `cards-search` (neu, später)

- Eigene PostgreSQL-Instance mit pg_trgm + tsvector + pgvector
- Async-Indexer hört auf cards-server-Events („deck-published", „deck-updated")
- Optional: Meilisearch wenn Postgres FTS nicht reicht

### 6.3 mana-llm (existierend, erweitert)

- Embeddings für semantic search (jeden Deck-Description + Karte → 1536-dim Vector)
- Moderation-First-Pass (Klassifikation in spam/csam/hate/nsfw/etc.)
- Auto-Tag-Suggestions
- Auto-Summary für Deck-Beschreibungen

### 6.4 mana-credits (existierend, erweitert)

- Bestehende `/credits/use` und `/credits/reservations/*` für Kauf
- Bestehender `/internal/credits/grant` für Author-Auszahlung
- Vermutlich keine API-Erweiterung nötig

### 6.5 mana-notify (existierend, erweitert)

- Push-Notifications für Subscribe-Updates, neue Subscribers, neue Discussions/Replies, neue Stars (vom User konfigurierbar)

### 6.6 mana-media (existierend)

- Bilder/Audio in published Decks landen wie heute auch
- Pro Author-Tier ein Soft-Quota: Free 100MB, Verified 1GB, Mana 5GB

## 7. API-Endpoints (Auswahl)

OpenAPI-Spec wird die Quelle der Wahrheit; hier die wichtigsten Routes:

### 7.1 Authoren

```
POST   /v1/authors/me                       — Profil anlegen/updaten (slug, displayName, bio, avatar, pseudonym)
GET    /v1/authors/:slug                    — Public Profile + Decks-Liste + Stats
GET    /v1/authors/me/dashboard             — Eigene Stats: Subscriber, Erlöse, Mod-Inbox
POST   /v1/authors/:slug/follow             — Folgen
DELETE /v1/authors/:slug/follow             — Entfolgen
GET    /v1/authors/me/feed                  — Personal Activity-Feed
```

### 7.2 Decks

```
POST   /v1/decks                            — Deck als public registrieren (Init-Flow)
GET    /v1/decks/:slug                      — Public Deck mit latest version
GET    /v1/decks/:slug/versions             — Versionsliste mit Changelogs
GET    /v1/decks/:slug/versions/:semver     — Specific Version + alle Karten
PATCH  /v1/decks/:slug                      — Metadaten (title, description, license, price)

POST   /v1/decks/:slug/publish              — Neue Version publishen (body: cards[], semver, changelog)
                                              → triggert AI-Mod-Pass
                                              → setzt latest_version_id

POST   /v1/decks/:slug/star                 — Star setzen
DELETE /v1/decks/:slug/star                 — Star entfernen

POST   /v1/decks/:slug/subscribe            — Subscribe (lädt + sync'd Karten in lokale DB)
DELETE /v1/decks/:slug/subscribe            — Unsubscribe

POST   /v1/decks/:slug/fork                 — Fork (lokale Kopie + Author-Lineage)

POST   /v1/decks/:slug/buy                  — Paid Deck kaufen (mana-credits-Flow)
POST   /v1/decks/:slug/refund               — Refund anfragen
```

### 7.3 Pull-Requests

```
GET    /v1/decks/:slug/pull-requests        — Liste
POST   /v1/decks/:slug/pull-requests        — Neuer PR (body: title, body, diff)
GET    /v1/pull-requests/:id                — Details
POST   /v1/pull-requests/:id/merge          — Author merged → erstellt neue Version
POST   /v1/pull-requests/:id/close          — Author schließt
POST   /v1/pull-requests/:id/comments       — Diskussion auf PR-Ebene
```

### 7.4 Discussions

```
GET    /v1/cards/:contentHash/discussions   — Threads für eine Karte (über Versionen hinweg)
POST   /v1/cards/:contentHash/discussions   — Neuer Thread / Reply
POST   /v1/discussions/:id/hide             — Author/Mod versteckt
```

### 7.5 Discovery + Search

```
GET    /v1/explore                          — Featured + Trending + Categories (curated)
GET    /v1/search?q=…&tag=…&lang=…&sort=…  — Volltextsuche (FTS + semantic)
GET    /v1/tags                             — Tag-Hierarchie
GET    /v1/decks?author=…&tag=…&sort=…&p=… — Filtered Browse
```

### 7.6 Reports + Moderation

```
POST   /v1/decks/:slug/report               — User reportet Deck
POST   /v1/cards/:contentHash/report        — User reportet Karte
GET    /v1/admin/reports                    — Admin-Inbox (verifizierte Mana-Mods only)
POST   /v1/admin/decks/:slug/takedown       — Admin entfernt Deck
POST   /v1/admin/authors/:slug/ban          — Admin sperrt Author
POST   /v1/admin/authors/:slug/verify-mana  — Mana-Verein-Badge vergeben
```

### 7.7 Notifications

```
GET    /v1/notifications                    — Unread + recent
POST   /v1/notifications/:id/read           — Mark read
PATCH  /v1/notifications/preferences        — Settings (welche Events triggern Push)
```

## 8. UI / Routes (Cards-Frontend)

```
/explore                          — Featured + Trending + Tag-Tree + Search-Bar
/explore/search?q=…              — Search-Result-Page
/explore/tag/:slug                — Tag-Page

/u/:slug                          — Author-Profil (Public)
/u/:slug/follow                   — Follow-Button im Header

/d/:slug                          — Public-Deck-Detail-View
                                    (Description, Stats, Latest-Karten-Preview, Subscribe/Fork/Star/Buy, Discussions)
/d/:slug/v/:semver                — spezifische Version
/d/:slug/discussions              — Alle Discussions zum Deck
/d/:slug/pull-requests            — PRs
/d/:slug/pull-requests/:id        — PR-Detail mit Diff-View

/me/decks                         — Eigene private Decks (heute existiert)
/me/published                     — Eigene published Decks + Stats
/me/subscribed                    — Abonnierte Decks (mit Update-Indikator)
/me/forks                         — Geforkte Decks
/me/dashboard                     — Author-Dashboard (Erlöse, Subscriber-Wachstum)

/feed                             — Personal Activity-Feed (Following-Activity + Updates)

/admin/reports                    — Admin-Inbox (verified-mana-only)
/admin/decks                      — Take-Down-UI
/admin/authors                    — Verify + Ban
```

Zusätzlich: einige bestehende Komponenten erweitern (DeckDetail bekommt Subscribe-Button etc.).

## 9. Cold-Start-Strategie

Marktplatz ohne Decks ist nutzlos. Drei parallele Hebel:

1. **Verein-Seed-Decks**: 50 hochwertige Decks selbst erstellen — sprachen (Top-3000 Vokabeln pro Sprache), Geschichte (TimeLine-Karten), Allgemeinwissen, Programmierung. Vom Mana-Team published, alle mit `verified_mana`-Badge.
2. **Anki-Top-100-Import-Service**: Wir bieten an, populäre Anki-Web-Decks (mit korrekter CC-BY-Lizenz) zu importieren und mit Original-Author-Attribution als Public-Decks anzulegen. Original-Author bekommt das `verified_mana`-Badge wenn er sich registriert.
3. **Influencer-Outreach**: Direkte Ansprache von 10-20 Anki-Power-Authoren (AnKing, etc.) mit dem Angebot eines verified-Status + sehr Author-freundlichem Cut. Wenn 1-2 wechseln, kommt ein Lawineneffekt.

## 10. Risiken + Mitigationen

| Risiko | Mitigation |
|---|---|
| Cold-Start (Marktplatz leer) | Seed + Anki-Import + Influencer (siehe §9) |
| Spam / Junk-Decks | AI-Mod-First-Pass + Report-System + Author-Ban-Flow |
| Copyright-Klagen (Lehrbuch-Karten) | Lizenz-Pflichtangabe + DMCA-Process + Take-Down-Workflow |
| Server-Kosten (Storage von Bildern/Audio) | Soft-Quotas pro Author-Tier (§6.6) + lossy compression im mana-media |
| AnkiHub als Konkurrent (Live-Updates Medizin) | „Alle Fachgebiete + gratis" als Counter; Med-Decks aktiv akquirieren |
| Mana-Credits-Verein-Cut zu hoch oder zu niedrig | A/B-Test verschiedener Cut-Verhältnisse; Best-Practice: ~80/20 für Standard, ~90/10 für Verified |
| Author-Frustration über fehlende Mobile-App | Klarer Roadmap-Hinweis + Mobile-Push-Notifications via PWA (heute geht das schon) |
| Discussions werden Toxic | Author-Owns-Their-Discussions (kann hide); Community-Mod (Verified-User können flaggen); klar dokumentierte Community-Guidelines |
| Mining/Scraping der Decks | Rate-limit auf API + Auth-Required für full-content; offene Snippets aber paywall am Voll-Inhalt |

## 11. Phasenplan

> **Co-Learn explizit ausgeklammert.** Mobile-App auch.

### Phase α — Daten-Skelett (cards-server v0.1)

- `services/cards-server/` SvelteKit-style Service-Setup, Hono + Bun + Drizzle
- Alle Schema-Tabellen + Migrationen (§4)
- API-Routes (CRUD-Niveau): Authoren, Decks, Versionen, Stars, Subscriptions
- OpenAPI-Spec
- Integration-Tests (Drizzle + Vitest)
- mana-auth-JWT-Middleware (`@mana/shared-hono`)
- Container in `docker-compose.macmini.yml`
- Cloudflare-Tunnel-Route `cards-api.mana.how` → `:3072`

### Phase β — Author-Workflow ✅ shipped

- ✅ „Author werden"-Flow im Frontend (Profil anlegen, slug claimen)
- ✅ „Publish"-Aktion auf Deck-Detail-Seite
  - ✅ Lizenz-Picker (SPDX-Auswahl)
  - ✅ Optional: Preis in Credits
  - ⏳ Tags: Picker fehlt im Publish-Flow; Server-Schema steht
- ✅ Versioning: semver-Eingabe (Auto-Suggest pre-fill folgt in θ)
- ✅ Changelog-Editor
- ✅ AI-First-Pass-Moderation (mana-llm classify, Verdict im Publish-Result)
- ⏳ Author-Dashboard mit Subscriber-Counts: Erlöse jetzt unter `/me/purchases`, restliche Stats fehlen

### Phase γ — Discovery-Frontend ✅ shipped (FTS minimal)

- ✅ `/explore`-Seite mit Featured + Trending
- 🟡 Volltext-Suche: einfaches `ILIKE` über Title/Description; tsvector-Upgrade in Phase ι
- 🟡 Tag-Hierarchie: flach implementiert; baumartige Eltern-Kind-Navigation offen
- ✅ Author-Profile (`/u/<slug>`) + Follow-Button
- ⏳ Activity-Feed (wer hat was published / merged): nicht gebaut
- ✅ Star-System

### Phase δ — Subscribe + Updates + Smart-Merge ✅ shipped

- ✅ „Abonnieren"-Button → lädt aktuelle Version in lokale Cards-DB
- 🟡 Update-Detection: Polling beim Öffnen der Deck-Page; **kein** WebSocket-Push (kommt in θ/ι)
- ✅ **Smart-Merge**: Diff zwischen Versionen → unveränderte Karten behalten FSRS-State; geänderte erben FSRS-State über Ord-Pairing-Heuristik; neue + entfernte werden korrekt behandelt
- ✅ Diff-View „+N · ~N · −N" mit Apply-Button auf der Deck-Page
- ⏳ Push-Notifications für Subscribe-Updates via mana-notify: PR-/Verkaufs-Mails sind drin (ε.3, ζ.1), Update-Mail noch nicht

### Phase ε — Pull-Requests + Discussions ✅ shipped

- ✅ PR-Erstellen-UI: „✏️ Verbessern" auf `/learn/[id]` für Karten aus abonnierten Decks (modify oder remove)
- ✅ PR-Diff-Preview (flach, alle drei Blöcke `add` / `modify` / `remove`)
- ✅ Author-Merge-Workflow → erstellt neue Version atomar, bumped semver-Minor by default
- ✅ Inline-Discussion-Threads: in `/learn` (Toggle) + auf `/d/<slug>` (Karten-Liste mit Comment-Counts)
- ✅ Notify: Author bei neuem PR; PR-Author bei Merge/Reject (deterministische ExternalIDs für Dedup)
- ⏳ Mention-System (@username): nicht gebaut; Schema-Änderung später trivial
- 🟡 PR-Merge ist „stale-blind": kein Rebase / Konflikt-Detection (siehe §13a)

### Phase ζ — mana-credits Marketplace 🟡 ζ.1 shipped, ζ.2 offen

- ✅ Paid-Deck-Workflow End-to-End: 4-step Pipeline `reserve → INSERT purchase → commit → grant author + INSERT payout`, idempotent über `(buyer, deck)`
- ✅ Author-Auszahlungs-Pipeline: 80/20 Standard, 90/10 für `verifiedMana`-Authoren, kommt aus `config.authorPayout` (Basis-Punkte)
- ✅ Buyer-Dashboard `/me/purchases` mit Käufen + Author-Auszahlungs-Historie
- ⏳ **Refund-Workflow**: bewusst out-of-scope für ζ.1 (Author-Clawback ist konzeptuell heikel — siehe §13a)
- ⏳ **Reconciler**: bei Commit-/Grant-Failure nach Schritt 2 bleibt eine Purchase-Row mit `creditsTransaction = null` bzw. ohne Payout. Code logged, niemand fegt nach. Cron-Sweep in ζ.2
- ⏳ Author-Payouts-CSV-Export für Steuern

### Phase η — Moderation + Trust 🟡 η.1 shipped, η.2/η.3 offen

- ✅ Report-Buttons auf Deck (`/d/<slug>`) + Discussion-Kommentare
- ✅ Admin-Inbox-UI (`/admin/reports`) mit Abweisen / Deck-Takedown / Author-Bann
- ✅ Take-Down-Workflow: transaktional, auto-closed parallele Reports + offene PRs auf demselben Deck, Mail an Author
- 🟡 Verified-Badge-Vergabe via API (`POST /v1/admin/authors/:slug/verify`); kein dediziertes UI
- ⏳ **Community-Verified Auto-Calculation**: Schema + Schwellwerte da; Cron-Job fehlt (η.2)
- ⏳ **Public Take-Down-Changelog**: Plan erwähnt das, nicht gebaut
- ⏳ **Verified-Mana-only Mods**: aktuell nur `role === 'admin'`; Plan-Vision ist „verified-mana darf auch resolven" — feiner Cut, später
- ⏳ Author-Ban-Process: Ban kaskadiert auf Decks ✅, aber kein Self-Service-Appeal-Flow für Author
- ⏳ Report-Spam-Schutz (Rate-Limit pro User+Deck): nicht da

### Phase θ — Deep AI

- Auto-Tag-Suggestions beim Publish (mana-llm)
- Auto-Summary für Decks (mana-llm Markdown-Render-tauglich)
- Audio-Vertonung mit mana-tts (Author opt-in: alle Karten als Audio generieren)
- Semantic-Search via Embeddings (mana-llm + pgvector)
- Personalized-Discovery („Empfohlen für dich" basierend auf Lern-Historie)

### Phase ι — Optimierung + Skalierung

- Search-Service als separater Pod (Meilisearch wenn Postgres FTS limitiert)
- CDN für public-deck-content (Cache + Geo-Distribution)
- Rate-Limiting + Anti-Scraping
- Real-time-Stats-Aggregation (Materialized Views)

### Phasen die später kommen (explizit nicht in diesem Plan)

- **Phase λ — Co-Learn-Sessions**: WebSocket-Multiplayer, gemeinsam lernen, Sehen-was-andere-machen
- **Phase μ — Mobile-Apps**: Expo-App (Cards-Standalone-Mobile)
- **Phase ν — Author-Tools**: Bulk-Edit-UI für Authoren mit großen Decks, Style-Templates, Author-Analytics-Deep-Dive
- **Phase ξ — Lern-Battles**: Asynchroner Wettkampf-Modus

## 12. Konkrete Differenzierungs-Hebel — was geht wirklich nur bei uns

1. **Gratis Cloud-Sync + Live-Updates auf abonnierte Decks**. Niemand sonst hat beides ohne Paywall.
2. **Pull-Requests auf Decks**. AnkiHub erlaubt das nicht so flüssig, andere gar nicht. „Lerne und verbessere mit" als Modus.
3. **Card-Discussions inline** — wenn ich beim Lernen eine Karte unverständlich finde, kann ich direkt fragen / ergänzen. Anki hat Plugin dafür, RemNote auch nicht.
4. **Authoren verdienen via mana-credits** — wir behandeln Authoren als 1st-Class-Konstrukt mit Erlös-Möglichkeit. Quizlet macht das nicht, AnkiWeb macht das nicht, Brainscape paywalled stattdessen die User.
5. **Open Source PWA** mit klarer Roadmap-Transparenz — Vertrauensvorsprung vs. Quizlet (closed, Trustpilot 1.4/5) und gegenüber AnkiPro/AnkiApp (closed-source, Brand-Sniper).
6. **Doppelte Verifizierungs-Stufen** mit unterschiedlichen Badges — Anki-Foren machen das ad-hoc; wir formalisieren es.
7. **AI als Moderator + Generator + Indexer** ohne Paywall — wir haben den eigenen mana-llm-Stack, Konkurrenten zahlen OpenAI per Call.

## 13. Was wir NICHT tun

- **Kein Decks-Bewertungssystem mit 1-5 Sternen**. Stars (Bookmarks) ja, Bewertungen nein — die werden gegamed (Quizlet-Erfahrung), und führen zu Author-Frust + Review-Bombing.
- **Kein Reddit-Style-Voting auf Karten / PRs / Discussions**. Wirkt cool, ruiniert die Community (Hacker-News-Effekt). Lieber „helpful"-Reactions in begrenzten Kategorien.
- **Kein „Karten der Woche" allein-algorithmisch**. Editorial-Pick (Mana-Verein) + Trending-Liste, aber niemals nur Algo, das landet immer beim niederschwelligsten Content.
- **Kein Anki-Bashing im Marketing**. Anki ist OSS, ehrlich, und wir wollen nicht ihre Audience entfremden — wir wollen sie ergänzen. Bridge nicht Burning.
- **Keine Pflicht-Klarnamen**. Pseudonyme bleiben gleichberechtigt. Verifizierung ist Bonus, nicht Pflicht.
- **Kein Marketplace-Cut über 30 %**. Apple-App-Store-Hass ist real, wir bleiben fair.

## 13a. Bekannte Limitierungen / „macht später"

**Phase ε (Pull-Requests + Discussions)**

- **PR-Merge ist stale-blind**: `merge()` baut die neue Version aus `currentCards` zusammen, indem es Removes anwendet, dann Modifies-by-Hash, dann Adds. Wenn der Author zwischen PR-Open und Merge selbst eine Karte geändert hat, deren `previousContentHash` der PR matched, gewinnt **stumm** der PR — kein Konflikt-Hinweis. Akzeptabel solange wir wenige PRs/Tag haben; später entweder (a) PR-rebase mit `status=stale` bei Konflikt, oder (b) optimistic locking via `baseVersionId` auf der PR-Row mit Reject bei Mismatch.
- **Keine Multi-Card-Diff-Visualisierung**: PR-Diff-Preview zeigt jeden Block (`add` / `modify` / `remove`) flach. Bei großen PRs mit 50+ Karten unübersichtlich — Side-by-side-Vergleich pro modify wäre nett.
- **Discussion-Threading ist 1-Level**: Server speichert schon `parent_id`, aber das UI rendert flach. Bei Bedarf später ein Antworten-Button + visuelle Einrückung — kein Schema-Change nötig.
- **Card-Preview-Heuristik ist roh**: `<DeckCardList>` zieht `front` → `text` → erstes nicht-leeres Feld, strippt HTML, capt bei 140 Zeichen. Bei Cloze-Karten sieht der Leser den Roh-Text mit `{{c1::…}}`-Markern statt der maskierten Lern-Form. Kein Showstopper; später kann der Server eine `searchPreview`-Spalte schreiben.

**Phase ζ (Paid Decks)**

- **Refunds**: bewusst weggelassen. Author-Clawback ist konzeptuell heikel, weil der Author seinen Anteil nach Grant schon ausgegeben haben kann (→ 402 beim Reverse-Charge). Empfohlene ζ.2-Variante: Admin-only Refund, Buyer kriegt vollen Preis zurück, Author-Clawback nur best-effort, AGB-Klausel über Author-Cut-Risiko bei Refund.
- **Reconciler fehlt**: Wenn `commit` oder `grant` nach Schritt 2 fehlschlägt, bleibt eine Purchase-Row mit `creditsTransaction = null` bzw. ohne `author_payout`. Code logged das, aber niemand fegt nach. Cron-Sweep in ζ.2.
- **Buyer hat keinen Refund-Self-Service**: kein 30-Tage-Window-Knopf in der UI. Plan §5.3 sieht ihn vor; warten auf ζ.2.
- **CSV-Export für Steuern**: nicht drin. Easy add-on, sobald Verein die Steuerklärung 2026 vorbereitet.

**Phase η (Moderation)**

- **Verified-Mana-only Mods**: Admin-Gate ist aktuell `role === 'admin'`. Plan §11 sieht vor, dass auch verified-mana-Authoren Reports abarbeiten dürfen (mit eingeschränkten Aktionen). Würde nach den ersten 50 Reports sinnvoll, vorher over-engineered.
- **Community-Verified Cron**: Schema + Schwellwerte (`COMMUNITY_VERIFY_STARS=500`, `_FEATURED=3`, `_SUBSCRIBERS=200`) sind im config, aber kein Job berechnet `verified_community`. Add-on: ein Cron-Endpoint im internal API + SystemD-Timer auf Mac mini.
- **Public Take-Down-Changelog**: Plan erwähnt eine `/transparency`-Page — nicht gebaut. Bringt Trust, niedrige Priorität.
- **Appeal-Self-Service**: Author hat keinen Self-Service-Knopf für Restore. Bewusste Entscheidung — Appeals sollen menschlich sein, kein Self-Restore.
- **Report-Spam-Schutz**: ein User kann unbegrenzt Reports gegen ein Deck filen. Rate-Limit (max 1/User+Deck+Tag) wäre billig; kommt mit Phase ι.

**Querschnittsthemen**

- **Disk-Space auf der Build-Maschine** (Mac mini): aktuell ~6.7 GB frei. `pnpm store prune` als nächste Notbremse, falls cards-web-Builds enge Container-Layer brauchen.

## 14. Offene Punkte die später entschieden werden müssen

- **Mobile-Push-Notifications** für Subscribe-Updates: native PWA-Push reicht aktuell, aber Browser-API ist hin- und her — könnte Phase ι in einen eigenen Push-Service auslagern müssen.
- **Slack/Discord-Bots für Author-Updates**: nice-to-have, irgendwann.
- **Embed-Widget**: „Lerne dieses Deck auf meiner Webseite" mit IFrame — könnte Reichweite stark boosten.
- **API-Public**: API-Keys für Drittentwickler die eigene Tools rund um Cards bauen.
- **Backup für Subscriber**: Wenn ein Author published-Deck depubliziert, behalten Subscriber das letzte Snapshot (DSGVO-pflicht eh).
- **Internationalisierung der UI** (heute nur DE): nötig fürs internationale Publikum.

## 15. Aktueller Stand 2026-05-07

| Phase | Status | Was läuft | Was fehlt |
|-------|--------|-----------|-----------|
| α — Skelett | ✅ | cards-server lebt auf 3072, Schema gepushed, JWT-Auth, Container in `docker-compose.macmini.yml`, Tunnel-Route `cards-api.mana.how` | — |
| β — Author-Workflow | ✅ | Profil-Claim, Publish, Lizenz, Preis, AI-Mod-Verdict | Tag-Picker im Publish, Author-Dashboard-Stats |
| γ — Discovery | ✅ | `/explore`, Stars, Follows, Author-Profile, Trending | tsvector-FTS, Tag-Tree, Activity-Feed |
| δ — Subscribe + Smart-Merge | ✅ | Pull, Smart-Merge mit FSRS-State-Erhalt, Diff-View | WebSocket-Push, Update-Mails |
| ε — PRs + Discussions | ✅ | PR-Erstellen / List / Merge / Reject / Close, Discussions auf `/learn` + `/d/<slug>`, Notify-Mails | Mention-System, PR-Rebase, Multi-Card-Diff-View, Discussion-Threading |
| ζ — Paid Decks | 🟡 ζ.1 | Buy-Flow, Author-Payout, Buyer-Dashboard | Refund, Reconciler, CSV-Export |
| η — Moderation | 🟡 η.1 | Reports, Admin-Inbox, Takedown, Ban-Cascade, Verify-API | Community-Verified-Cron, Public-Changelog, Verified-Mana-Mod-Permissions, Rate-Limit |
| θ — Deep AI | ⏳ | — | Auto-Tags, Auto-Summary, TTS, Embeddings, Personalized-Discovery |
| ι — Optimierung | ⏳ | — | Search-Service, CDN, Rate-Limiting, Materialized Views |
| λ / μ / ν / ξ | ⏳ | — | später (Co-Learn, Mobile, Author-Tools, Lern-Battles) |

**Live-Domains**: `cards.mana.how` (Web) · `cards-api.mana.how` (API).

**Nächste sinnvolle Schritte (Empfehlung)**:

1. **ζ.2 Reconciler + minimaler Admin-Refund** — schließt das größte operative Loch im Paid-Flow.
2. **η.2 Community-Verified-Cron** — Plan-Vision der „doppelten Verifizierung" ist sonst nur halb umgesetzt; Cron ist klein.
3. **Update-Mail in δ.4** — Subscriber bekommen sonst nichts mit, wenn Author published. Dann ist die Notify-Story rund (PR-Open + PR-Merged + PR-Rejected + Verkauf + Takedown + Update).
4. **Phase θ starten** — Auto-Tags + Auto-Summary beim Publish via mana-llm: kostet wenig Code, viel Discovery-Hebel.

---

*Plan erstellt: 2026-05-07. Owner: @till. Letzter Stand-Update: 2026-05-07 nach η.1.*
