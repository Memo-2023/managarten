# Cloudflare DNS — Domains & Konfiguration

> Stand: 2026-03-24

## Ausstehende Aktionen im Cloudflare Dashboard

### Landing Pages auf Tunnel umstellen

Landing Pages laufen jetzt **self-hosted** via Nginx auf dem Mac Mini (Port 4400). Die DNS-Records müssen von Cloudflare Pages auf den Cloudflare Tunnel umgestellt werden.

**Tunnel-ID:** `bb0ea86d-8253-4a54-838b-107bb7945be9`

**Im Cloudflare Dashboard → DNS → mana.how:**

Für jede Domain: **CNAME Record hinzufügen** (oder bestehenden ändern), Proxied (orange Wolke):

| Domain | Typ | Wert | Status |
|--------|-----|------|--------|
| `it` | CNAME | `bb0ea86d-8253-4a54-838b-107bb7945be9.cfargotunnel.com` | **Neu erstellen** |
| `citycorners` | CNAME | `bb0ea86d-8253-4a54-838b-107bb7945be9.cfargotunnel.com` | **Neu erstellen** |
| `food` | CNAME | `bb0ea86d-8253-4a54-838b-107bb7945be9.cfargotunnel.com` | **Neu erstellen** |
| `cards` | CNAME | `bb0ea86d-8253-4a54-838b-107bb7945be9.cfargotunnel.com` | **Neu erstellen** |
| `docs` | CNAME | `bb0ea86d-8253-4a54-838b-107bb7945be9.cfargotunnel.com` | **Neu erstellen** |

**Für bestehende Landing-Domains (aktuell auf CF Pages):**

Diese Domains zeigen noch auf Cloudflare Pages. Um sie auf Self-Hosted umzustellen:

1. **Pages → [Projekt] → Custom domains → Remove** (Domain vom Pages-Projekt entfernen)
2. **DNS → CNAME auf Tunnel-ID ändern** (wie oben)

| Domain | Aktuell | Umstellen auf |
|--------|---------|---------------|
| `chats.mana.how` | CF Pages (`chat-landing`) | Tunnel → `localhost:4400` |
| `pics.mana.how` | CF Pages (`picture-landing`) | Tunnel → `localhost:4400` |
| `quotess.mana.how` | CF Pages (`quotes-landing`) | Tunnel → `localhost:4400` |
| `presis.mana.how` | CF Pages (`presi-landing`) | Tunnel → `localhost:4400` |
| `clocks.mana.how` | CF Pages (`clocks-landing`) | Tunnel → `localhost:4400` |

**Hinweis:** Die Umstellung kann schrittweise erfolgen — erst neue Domains, dann bestehende migrieren.

### Reihenfolge

1. **Zuerst:** Neue Domains erstellen (`it`, `citycorners`, `food`, `cards`, `docs`)
2. **Danach:** Bestehende Landing-Domains von Pages auf Tunnel migrieren (eine nach der anderen, testen)
3. **Zuletzt:** Alte CF Pages Projekte löschen (optional, kosten nichts)

---

## Architektur

```
Internet
    │
    ▼
Cloudflare DNS (*.mana.how)
    │
    ▼
Cloudflare Tunnel (bb0ea86d...)
    │
    ├── Apps (Web + API):  chat.mana.how → localhost:5010
    ├── Services:          auth.mana.how → localhost:3001
    ├── Landing Pages:     it.mana.how   → localhost:4400 (Nginx)
    └── Monitoring:        grafana.mana.how → localhost:8000
```

**Nginx Landing Container** (`mana-infra-landings`, Port 4400):
- Routet nach `Host`-Header zu verschiedenen `dist/`-Ordnern
- Config: `docker/nginx/landings.conf`
- Daten: `/Volumes/ManaData/landings/{name}/`
- Build: `./scripts/mac-mini/build-landings.sh`

---

## Alle Domains

### Apps (via Tunnel → Docker Container)

| Domain | Service | Port |
|--------|---------|------|
| `mana.how` | Dashboard Web | 5000 |
| `auth.mana.how` | Auth API | 3001 |
| `chat.mana.how` | Chat Web | 5010 |
| `chat-api.mana.how` | Chat API | 3030 |
| `todo.mana.how` | Todo Web | 5011 |
| `todo-api.mana.how` | Todo API | 3031 |
| `calendar.mana.how` | Calendar Web | 5012 |
| `calendar-api.mana.how` | Calendar API | 3032 |
| `clock.mana.how` | Clock Web | 5013 |
| `clock-api.mana.how` | Clock API | 3033 |
| `contacts.mana.how` | Contacts Web | 5014 |
| `contacts-api.mana.how` | Contacts API | 3034 |
| `storage.mana.how` | Storage Web | 5015 |
| `storage-api.mana.how` | Storage API | 3035 |
| `presi.mana.how` | Presi Web | 5016 |
| `food.mana.how` | Food Web | 5017 |
| `photos.mana.how` | Photos Web | 5019 |
| `mukke.mana.how` | Mukke Web | 5180 |
| `picture.mana.how` | Picture Web | 5021 |
| `playground.mana.how` | LLM Playground | 5090 |

### Landing Pages (via Tunnel → Nginx 4400)

| Domain | Landing | Nginx Root |
|--------|---------|------------|
| `it.mana.how` | IT Souveränität | `/srv/landings/it` |
| `chats.mana.how` | Chat Landing | `/srv/landings/chat` |
| `pics.mana.how` | Picture Landing | `/srv/landings/picture` |
| `quotess.mana.how` | Quotes Landing | `/srv/landings/quotes` |
| `presis.mana.how` | Presi Landing | `/srv/landings/presi` |
| `clocks.mana.how` | Clock Landing | `/srv/landings/clock` |
| `cardecky.mana.how` | Cardecky App | (Docker container — not a static landing) |
| `cardecky.com` | Cardecky Marketing-Landing | `/srv/landings/cardecky` |
| `food.mana.how` | Food Landing | `/srv/landings/food` |
| `citycorners.mana.how` | CityCorners Landing | `/srv/landings/citycorners` |
| `docs.mana.how` | Dokumentation | `/srv/landings/docs` |

### Services & Monitoring (via Tunnel)

| Domain | Service | Port |
|--------|---------|------|
| `grafana.mana.how` | Grafana | 8000 |
| `stats.mana.how` | Umami Analytics | 8010 |
| `glitchtip.mana.how` | GlitchTip Errors | 8020 |
| `ssh.mana.how` | SSH Access | 22 |

---

## Landing Pages deployen

```bash
# Alle Landings bauen und nach /Volumes/ManaData/landings/ kopieren
./scripts/mac-mini/build-landings.sh

# Nginx neuladen
docker restart mana-infra-landings
```

## Neue Landing Page hinzufügen

1. Landing erstellen (Astro in `apps/{app}/apps/landing/` oder `services/{name}/`)
2. Build-Script (`scripts/mac-mini/build-landings.sh`) erweitern
3. Nginx Server-Block in `docker/nginx/landings.conf` hinzufügen
4. Cloudflare Tunnel Ingress in `cloudflared-config.yml` hinzufügen
5. DNS CNAME im Cloudflare Dashboard erstellen
6. Bauen, deployen, cloudflared neustarten
