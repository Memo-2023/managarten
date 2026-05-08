# Tech Stack Unabhängigkeit & Verbesserungen

> Stand: 2026-03-23 | Ziel: Maximale Unabhängigkeit durch Open-Source & Self-Hosting

## Aktueller Unabhängigkeits-Status

### Self-Hosted (keine externe Abhängigkeit)

| Kategorie | Service | Technologie |
|-----------|---------|-------------|
| Database | PostgreSQL 16 + Drizzle ORM | Docker |
| Cache | Redis 7 | Docker |
| Object Storage | MinIO (S3-kompatibel) | Docker |
| Auth | Better Auth (mana-auth, EdDSA JWT) | NestJS |
| Search | SearXNG + mana-search | Docker + NestJS |
| Messaging | Matrix/Synapse + 13 Bots | Docker |
| Monitoring | VictoriaMetrics + Grafana | Docker |
| Analytics | Umami | Docker |
| Error Tracking | GlitchTip (Sentry-kompatibel) | Docker |
| Automation | n8n | Docker |
| LLM | Ollama + mana-llm Gateway | Nativ + Python |
| STT | Whisper Large V3 (mana-stt) | Python/MLX |
| TTS | Piper + Kokoro (mana-tts) | Python/MLX |
| Image Gen | FLUX.2 klein (mana-image-gen) | C/MPS |

### Cloud-Abhängigkeiten

| Kategorie | Service | Ersetzbar? | Notizen |
|-----------|---------|------------|---------|
| **Payments** | Stripe | Nein (Billing ja, Gateway nein) | Alternativen: Lago/Kill Bill für Billing, aber Payment Gateway braucht immer Provider |
| **Email** | Brevo SMTP | Ja | → Postal, Stalwart, Mailcow |
| **DNS/Tunnel** | Cloudflare Tunnel | Ja | → WireGuard + eigene IP, Caddy/Traefik |
| **Landing Pages** | Cloudflare Pages | Ja | → Nginx/Caddy auf eigenem Server |
| **Image Gen** | Replicate (Picture App) | Ja | → mana-image-gen (FLUX.2 klein, bereits vorhanden!) |
| **Vision** | Google Gemini (Food, Planta) | Teilweise | → Qwen2.5-VL / LLaVA via Ollama (Qualitätsverlust) |
| **LLM** | Azure OpenAI (Context App) | Teilweise | → Ollama mit größerem Modell |
| **LLM Fallbacks** | OpenRouter, Groq, Together | Ja (optional) | Nur Fallbacks, Ollama ist Primary |
| **OAuth** | Google OAuth (Contacts Import) | Nein | Nötig für Google Contacts API |

---

## Verbesserungsvorschläge

### 1. Cloud-Abhängigkeiten eliminieren (Easy Wins)

#### 1.1 Picture App: Replicate → mana-image-gen

**Aufwand:** 1-2 Tage | **Ersparnis:** $0.02-0.10 pro Bild

`mana-image-gen` mit FLUX.2 klein läuft bereits auf dem Mac Mini (~0.8s pro Bild @ 1024x1024). Die Picture App nutzt aber noch Replicate.

**TODO:**
- `ReplicateService` in Picture Backend um lokalen Endpoint erweitern
- Lokales Modell als Default, Replicate als Fallback für Premium-Modelle
- Betroffene Datei: `apps/picture/apps/backend/src/generate/replicate.service.ts`

#### 1.2 Project Doc Bot: OpenAI → Ollama + mana-stt

**Aufwand:** 1 Tag

- Whisper (OpenAI API) → `mana-stt` (bereits self-hosted)
- GPT-4o-mini (Blog-Generierung) → `mana-llm` → Ollama (Gemma 3 4B)
- Betroffene Datei: `services/matrix-project-doc-bot/src/generation/generation.service.ts`

#### 1.3 Landing Pages: Cloudflare Pages → Self-hosted

**Aufwand:** 0.5 Tage

Statische Astro-Builds können direkt vom Mac Mini über den Cloudflare Tunnel gehostet werden (wie die Web-Apps). Nginx- oder Caddy-Container mit den `dist/`-Ordnern.

**TODO:**
- Docker-Container für Landing Pages in `docker-compose.macmini.yml`
- Cloudflare Tunnel Ingress-Rules auf lokale Ports umstellen
- Deploy-Scripts anpassen (`deploy:landing:*`)

#### 1.4 Email: Brevo SMTP → Self-hosted

**Aufwand:** 2-3 Tage

Brevo ist SPOF für alle Transaktions-Emails (Verifizierung, Passwort-Reset).

**Optionen:**
- **Postal** — Open-Source Mailgun-Alternative (Docker, Web-UI, Webhooks)
- **Stalwart Mail Server** — Moderner, Rust-basierter Mailserver
- **Mailcow** — Vollständiger Mailserver-Stack

**Voraussetzung:** Korrekte DNS-Records (SPF, DKIM, DMARC) und idealerweise ein VPS mit offenem Port 25 (die meisten Hoster blockieren Port 25 auf Consumer-Leitungen).

**Pragmatischer Ansatz:** Postal auf einem günstigen Hetzner VPS (€3/Monat), DNS bei eigenem Provider.

---

### 2. Architektur-Verbesserungen

#### 2.1 Alle LLM-Requests über mana-llm routen

**Status: ✅ ERLEDIGT** (2026-03-24)

Alle 9 Backends nutzen jetzt `@mana/shared-llm` → `mana-llm` Gateway:
- Auth, Chat, Context, Food, Planta, Traces, Cardecky, Bot Services, Matrix Bots
- Google Gemini als automatischer Fallback wenn Ollama überlastet
- OpenAI SDK komplett entfernt (Project Doc Bot)
- Google Gemini SDK entfernt (Cardecky)

#### 2.2 PostgreSQL Backup stärken

**Aufwand:** 1-2 Tage | **Impact:** Kritisch

Aktuell nur `pg_dumpall`. Besser:
- **pgBackRest** für Point-in-Time-Recovery (PITR)
- Backups verschlüsselt auf externen Storage (z.B. zweite Maschine oder S3-kompatibler EU-Anbieter)
- Automatisierter Restore-Test (monatlich)

```bash
# Beispiel: pgBackRest in Docker
docker run --name pgbackrest \
  -v /Volumes/ManaData/backups:/var/lib/pgbackrest \
  pgbackrest/pgbackrest:latest
```

#### 2.3 Cloudflare-Fallback dokumentieren

**Aufwand:** 0.5 Tage | **Impact:** Risikominimierung

Cloudflare Tunnel ist der einzige Weg ins Internet. Falls Cloudflare ausfällt oder den Account sperrt:
- **Plan B:** WireGuard-Tunnel zu einem VPS + Caddy als Reverse Proxy
- **Plan C:** Direkte IP beim ISP (falls verfügbar) + Let's Encrypt
- Einen dokumentierten Failover-Plan erstellen und testen

#### 2.4 Redundanz: Zweiter Server

**Aufwand:** 1-2 Wochen | **Impact:** Kritisch

Der Mac Mini ist Single Point of Failure. Optionen:

| Option | Kosten | Komplexität | Failover-Zeit |
|--------|--------|-------------|---------------|
| Zweiter Mac Mini (Warm Standby) | ~€800 einmalig | Mittel | ~5 Min |
| Hetzner Dedicated (Standby) | ~€40/Monat | Mittel | ~5 Min |
| k3s Cluster (2-3 Nodes) | ~€80/Monat | Hoch | ~30 Sek |
| Docker Swarm (2 Nodes) | ~€40/Monat | Mittel | ~1 Min |

**Minimum:** PostgreSQL Streaming Replication auf einen zweiten Server, sodass Daten nicht verloren gehen.

---

### 3. Tech Stack Modernisierung

#### 3.1 NestJS 10 → 11

**Aufwand:** Mittel | **Impact:** Niedrig

Aktuell: NestJS 10.4.15. Version 11 ist stable. Shared Packages (`@mana/shared-nestjs-auth` etc.) unterstützen bereits NestJS 11 als peerDependency. Bringt bessere Performance und ESM-Support.

#### 3.2 Expo 52 → 53/54

**Aufwand:** Mittel | **Impact:** Mittel

Aktuell: Expo 52 + React Native 0.76. Expo 53+ bringt React Native 0.78+ mit New Architecture (Fabric, TurboModules) standardmäßig. Deutlich bessere Performance.

#### 3.3 Vitest statt Jest

**Aufwand:** Mittel | **Impact:** Niedrig

Ihr nutzt Vite überall (SvelteKit, Astro). Jest 29/30 mit ts-jest ist langsamer und hat ESM-Probleme. Vitest wäre native kompatibel und deutlich schneller.

#### 3.4 Vision-Models lokal testen

**Aufwand:** 1 Woche | **Impact:** Mittel

Food und Planta nutzen Google Gemini Vision. Alternativen via Ollama:
- **Qwen2.5-VL** — Bestes Open-Source Vision Model
- **LLaVA** — Leichtgewichtiger, gut für Kategorisierung

**Vorgehen:** Benchmark mit 200-300 Beispielbildern (Food/Pflanzen) gegen Gemini. Wenn Genauigkeit >85%: migrieren.

---

### 4. Open-Source Alternativen-Matrix

| Aktuell (Cloud) | Open-Source Alternative | Status |
|-----------------|----------------------|--------|
| Stripe | Lago (Billing) + Mollie/Adyen (Gateway) | Billing ersetzbar, Gateway nicht |
| Brevo SMTP | Postal, Stalwart, Mailcow | Vollständig ersetzbar |
| Cloudflare Pages | Nginx/Caddy + eigener Server | Trivial |
| Cloudflare Tunnel | WireGuard + VPS | Machbar |
| Replicate | mana-image-gen (FLUX.2 klein) | **Bereits vorhanden!** |
| Google Gemini Vision | Qwen2.5-VL, LLaVA via Ollama | Qualitätsverlust möglich |
| Azure OpenAI | Ollama (Gemma, Llama, DeepSeek) | Für die meisten Use Cases |
| OpenAI Whisper API | mana-stt (Whisper lokal) | **Bereits vorhanden!** |
| Edge TTS | mana-tts (Piper + Kokoro) | **Bereits vorhanden!** |

---

## Priorisierte Roadmap

| Prio | Maßnahme | Aufwand | Gewinn |
|------|----------|---------|--------|
| ~~**1**~~ | ~~Picture App → mana-image-gen~~ | ✅ Erledigt | Lokales FLUX.2 klein als Default, Replicate für Premium |
| ~~**2**~~ | ~~Project Doc Bot → Ollama + mana-stt~~ | ✅ Erledigt | OpenAI SDK entfernt, nutzt mana-llm + mana-stt |
| ~~**3**~~ | ~~Alle LLM-Calls über mana-llm routen~~ | ✅ Erledigt | @mana/shared-llm + Google Fallback |
| ~~**4**~~ | ~~PostgreSQL Backup~~ | ✅ Erledigt | Stündliche pg_dumpall + tägliche pg_basebackup, Docker Container |
| **5** | Brevo → Postal/Stalwart | 2-3 Tage | Email-Unabhängigkeit |
| ~~**6**~~ | ~~Landing Pages self-hosted~~ | ✅ Erledigt | Nginx Container auf Port 4400, 10 Domains via Tunnel |
| **7** | Vision-Models lokal benchmarken | 1 Woche | Gemini-Abhängigkeit reduzieren |
| ~~**8**~~ | ~~Cloudflare-Fallback dokumentieren~~ | ✅ Erledigt | WireGuard + Caddy auf Hetzner VPS, docs/CLOUDFLARE_FALLBACK.md |
| **9** | Zweiter Server / Redundanz | 1-2 Wochen | Kein Single Point of Failure |
| **10** | NestJS 11 + Vitest Migration | 1-2 Wochen | Modernerer Stack |

---

## Zusammenfassung

**Aktuell self-hosted:** ~85% der Infrastruktur (Stand: 2026-03-24)
**Nach Roadmap (Prio 5):** ~90%
**Unvermeidbare Cloud-Abhängigkeiten:** Stripe (Payment Gateway), Google OAuth (Contacts API)

**Erledigte Meilensteine (2026-03-24):**
- ✅ Prio 1: Picture App nutzt lokales `mana-image-gen` (FLUX.2 klein) als Default
- ✅ Prio 2: Project Doc Bot: OpenAI SDK komplett entfernt, nutzt mana-llm + mana-stt
- ✅ Prio 3: Alle LLM-Calls über `mana-llm` geroutet (10 Backends, `@mana/shared-llm`)
- ✅ Prio 3: Google Gemini Fallback in mana-llm + Cardecky Gemini SDK entfernt
- ✅ Prio 4: PostgreSQL Backup mit stündlichen Dumps + täglichen Base-Backups
- ✅ Prio 6: Landing Pages self-hosted via Nginx (10 Domains, kein Cloudflare Pages mehr)
- ✅ Prio 8: Cloudflare-Fallback Plan dokumentiert (WireGuard + Caddy)

**Nächste Schritte:** E-Mail-Unabhängigkeit (Prio 5), Vision-Models benchmarken (Prio 7), Server-Redundanz (Prio 9).

**Nächste Schritte:** PostgreSQL Backup (Prio 4), E-Mail-Unabhängigkeit (Prio 5), Landing Pages self-hosted (Prio 6).
