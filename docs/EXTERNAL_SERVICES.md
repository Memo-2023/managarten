# Externe Dienste & Self-Hosting-Analyse

Dieser Bericht dokumentiert alle externen Dienste im Mana Monorepo und evaluiert Self-Hosting-Alternativen für den Mac Mini Server (M4, 16GB RAM).

**Stand:** Januar 2026

---

## Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Aktuelle externe Dienste](#aktuelle-externe-dienste)
  - [AI-Dienste](#1-ai-dienste)
  - [Infrastruktur](#2-infrastruktur)
  - [Auth & Payment](#3-auth--payment)
  - [Email](#4-email)
  - [Hosting & CDN](#5-hosting--cdn)
  - [Monitoring](#6-monitoring)
- [Self-Hosting-Status](#self-hosting-status)
- [Self-Hosting-Möglichkeiten](#self-hosting-möglichkeiten)
  - [Bildgenerierung (Replicate-Ersatz)](#1-bildgenerierung-replicate-ersatz)
  - [Vision AI (Gemini-Ersatz)](#2-vision-ai-gemini-ersatz)
  - [Email-Service](#3-email-service)
- [Kosten-Analyse](#kosten-analyse)
- [Implementierungs-Roadmap](#implementierungs-roadmap)
- [Nicht ersetzbare Dienste](#nicht-ersetzbare-dienste)

---

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MANA EXTERNAL SERVICES MAP                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AI SERVICES                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Replicate│ │OpenRouter│ │  Gemini  │ │  Ollama  │ │Azure OAPI│  │   │
│  │  │ (Picture)│ │  (Chat)  │ │(Planta,  │ │  (Chat)  │ │  (Chat)  │  │   │
│  │  │  CLOUD   │ │  CLOUD   │ │Food) │ │  LOCAL   │ │  CLOUD   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       INFRASTRUCTURE                                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │   │
│  │  │PostgreSQL│ │  Redis   │ │  MinIO   │ │Hetzner S3│               │   │
│  │  │  LOCAL   │ │  LOCAL   │ │  LOCAL   │ │  CLOUD   │               │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      AUTH & PAYMENT                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                            │   │
│  │  │Better    │ │  Stripe  │ │ Google   │                            │   │
│  │  │Auth      │ │ Payments │ │  OAuth   │                            │   │
│  │  │  LOCAL   │ │  CLOUD   │ │  CLOUD   │                            │   │
│  │  └──────────┘ └──────────┘ └──────────┘                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     HOSTING & CDN                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                            │   │
│  │  │Cloudflare│ │Cloudflare│ │ Mac Mini │                            │   │
│  │  │  Pages   │ │  Tunnel  │ │  Server  │                            │   │
│  │  │  FREE    │ │  FREE    │ │  LOCAL   │                            │   │
│  │  └──────────┘ └──────────┘ └──────────┘                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Legende: LOCAL = Self-hosted | CLOUD = Externer Dienst | FREE = Kostenlos
```

---

## Aktuelle externe Dienste

### 1. AI-Dienste

| Dienst | App(s) | Zweck | API-Key Variable | Geschätzte Kosten |
|--------|--------|-------|------------------|-------------------|
| **Replicate** | Picture | Bildgenerierung (Flux, SDXL, SD) | `PICTURE_REPLICATE_API_TOKEN` | €20-100/Monat |
| **OpenRouter** | Chat | Cloud LLMs (Claude, GPT, Llama, DeepSeek) | `OPENROUTER_API_KEY` | €10-50/Monat |
| **Google Gemini** | Planta, Food, Cardecky | Vision & Text AI | `GEMINI_API_KEY`, `PLANTA_GEMINI_API_KEY` | €5-20/Monat |
| **Azure OpenAI** | Chat (Docker) | GPT-4o via Azure | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` | Optional |
| **Anthropic** | Mana Games | Claude API | `MANA_GAMES_ANTHROPIC_API_KEY` | Optional |
| **Ollama** | Chat | Lokale LLMs (Gemma 3, Llama) | `OLLAMA_URL` | ✅ Bereits lokal |

### 2. Infrastruktur

| Dienst | Typ | Port | Status | Details |
|--------|-----|------|--------|---------|
| **PostgreSQL** | Datenbank | 5432 | ✅ Lokal | Docker: `postgres:16-alpine` |
| **Redis** | Cache/Sessions | 6379 | ✅ Lokal | Docker: `redis:7-alpine` |
| **MinIO** | Object Storage | 9000/9001 | ✅ Lokal | S3-kompatibel |
| **Hetzner S3** | Cloud Storage | - | Cloud | Production (~€5/TB/Monat) |
| **Supabase** | DB/Auth (Legacy) | - | Cloud | Nur noch Legacy-Features |

**Konfigurierte MinIO Buckets:**
- `picture-storage` - AI-generierte Bilder
- `chat-storage` - User-Uploads
- `cards-storage` - Card/Deck Assets
- `plants-storage` - Pflanzenfotos
- `food-storage` - Mahlzeitenfotos
- `presi-storage` - Präsentationsfolien
- `calendar-storage` - Kalender-Anhänge
- `contacts-storage` - Kontakt-Avatare
- `storage-storage` - Cloud Drive Dateien

### 3. Auth & Payment

| Dienst | Zweck | Status | Ersetzbar? |
|--------|-------|--------|------------|
| **Better Auth** | Zentrale Authentifizierung (JWT/EdDSA) | ✅ Self-hosted | - |
| **Stripe** | Payment Processing, Subscriptions | Cloud | ❌ Nein |
| **Google OAuth** | Social Login (Contacts Import) | Cloud | ❌ Nein |

### 4. Email

| Dienst | Zweck | Status |
|--------|-------|--------|
| **Nodemailer** | SMTP-basierter Email-Versand | Braucht SMTP-Server |

**Verwendungszwecke:**
- Email-Verifizierung (Registrierung)
- Passwort-Reset
- Einladungen
- Benachrichtigungen

### 5. Hosting & CDN

| Dienst | Zweck | Kosten |
|--------|-------|--------|
| **Cloudflare Pages** | Landing Pages Hosting | Kostenlos |
| **Cloudflare Tunnel** | SSH-Zugang zu Mac Mini | Kostenlos |
| **Mac Mini Server** | Production Backend | Hardware vorhanden |

**Gehostete Landing Pages:**
- `chat-landing.pages.dev`
- `picture-landing.pages.dev`
- `mana-landing.pages.dev`
- `cards-landing.pages.dev`
- `quotes-landing.pages.dev`

### 6. Monitoring

| Dienst | Zweck | Status |
|--------|-------|--------|
| **Prometheus** | Metrics Collection | In mana-auth integriert |
| **Grafana** | Dashboards | Konfigurierbar |
| **Winston** | Application Logging | In allen NestJS Services |
| **Umami** | Web Analytics | `UMAMI_APP_SECRET` |

---

## Self-Hosting-Status

### ✅ Bereits selbst gehostet

| Service | Technologie | Port | RAM-Verbrauch |
|---------|-------------|------|---------------|
| PostgreSQL | Docker | 5432 | ~1GB |
| Redis | Docker | 6379 | ~256MB |
| MinIO | Docker | 9000/9001 | ~512MB |
| Ollama | Native | 11434 | ~4-8GB (je nach Modell) |
| mana-auth | Docker | 3001 | ~512MB |
| mana-stt | Native Python | 3020 | ~2-4GB |
| Chat Backend | Docker | 3002 | ~512MB |

### ⚠️ Noch externe Abhängigkeiten

| Service | Aktueller Anbieter | Self-Hosting möglich? |
|---------|-------------------|----------------------|
| Bildgenerierung | Replicate | ✅ Ja (ComfyUI) |
| Vision AI | Google Gemini | ✅ Ja (LLaVA) |
| Cloud LLMs | OpenRouter | ✅ Teilweise (Ollama) |
| Email-Versand | Nodemailer + ? | ✅ Ja (Postal/useSend) |
| Payments | Stripe | ❌ Nein |
| Cloud Storage | Hetzner S3 | ⚠️ Möglich, aber nicht empfohlen |

---

## Self-Hosting-Möglichkeiten

### 1. Bildgenerierung (Replicate-Ersatz)

#### Empfehlung: ComfyUI

ComfyUI ist die beste Open-Source-Alternative zu Replicate für Bildgenerierung.

**Vorteile:**
- Volle Kontrolle über Modelle
- Keine API-Kosten
- Offline-fähig
- Erweiterbar mit Custom Nodes

**Hardware-Anforderungen (Mac Mini M4, 16GB):**

| Modell | VRAM/RAM | Qualität | Geschwindigkeit |
|--------|----------|----------|-----------------|
| SDXL | 6.5GB | Sehr gut | ~2-3 Min/Bild |
| SD 1.5 | 4GB | Gut | ~1 Min/Bild |
| Flux.1 Schnell | 12GB | Exzellent | ~3-4 Min/Bild |
| Flux.1 Dev | 24GB+ | Beste | ❌ Nicht möglich |

**Installation:**

```bash
# ComfyUI installieren
cd ~/projects
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Python Environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# SDXL Modell herunterladen
mkdir -p models/checkpoints
cd models/checkpoints
wget https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors

# Server starten (Netzwerkzugriff)
cd ~/projects/ComfyUI
python main.py --listen 0.0.0.0 --port 8188
```

**API-Integration:**

ComfyUI bietet eine REST API für programmatische Nutzung:

```typescript
// Beispiel: ComfyUI API Call
const response = await fetch('http://localhost:8188/prompt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: workflowJSON,
    client_id: 'mana'
  })
});
```

**Ressourcen:**
- [ComfyUI GitHub](https://github.com/comfyanonymous/ComfyUI)
- [Mac M4 Setup Guide](https://medium.com/@tchpnk/comfyui-on-apple-silicon-from-scratch-2025-9facb41c842f)
- [ComfyUI on M4 Mac Mini](https://lilys.ai/en/notes/comfyui-20260115/comfyui-m4-mac-mini-worth-it)

---

### 2. Vision AI (Gemini-Ersatz)

#### Empfehlung: LLaVA via Ollama

LLaVA (Large Language and Vision Assistant) kann Gemini Vision für die meisten Use-Cases ersetzen.

**Use-Cases in Mana:**
- **Planta:** Pflanzenidentifikation
- **Food:** Lebensmittelerkennung, Nährwertschätzung

**Installation:**

```bash
# LLaVA 13B (beste Qualität für 16GB RAM)
ollama pull llava:13b

# Oder LLaVA 7B (schneller, weniger RAM)
ollama pull llava:7b
```

**Qualitätsvergleich:**

| Modell | RAM | Genauigkeit vs Gemini | Geschwindigkeit |
|--------|-----|----------------------|-----------------|
| LLaVA 13B | ~10GB | ~80% | Mittel |
| LLaVA 7B | ~6GB | ~70% | Schnell |
| Gemini Vision | Cloud | 100% (Referenz) | Sehr schnell |

**API-Nutzung:**

```bash
# Bild analysieren
curl http://localhost:11434/api/generate -d '{
  "model": "llava:13b",
  "prompt": "Was ist auf diesem Bild zu sehen?",
  "images": ["base64-encoded-image"]
}'
```

**Alternative: Qwen2-VL**

Für bessere OCR und Dokumentenverarbeitung:

```bash
ollama pull qwen2-vl:7b
```

---

### 3. Email-Service

#### Option A: Postal (Empfohlen für hohe Volumen)

Postal ist ein vollständiger Mail Transfer Agent mit Web-UI.

**Features:**
- REST API
- Delivery Tracking
- Bounce Handling
- Webhooks
- Multi-Domain Support

**Installation (Docker):**

```yaml
# docker-compose.postal.yml
version: '3'
services:
  postal:
    image: ghcr.io/postalserver/postal:latest
    ports:
      - "25:25"
      - "5000:5000"
    volumes:
      - postal-data:/data
    environment:
      - POSTAL_WEB_HOSTNAME=mail.mana.how
```

**Ressourcen:**
- [Postal GitHub](https://github.com/postalserver/postal)
- [Postal Docs](https://docs.postalserver.io/)

#### Option B: useSend (Modern, AWS SES Backend)

Für einfachere Setups mit AWS SES als Delivery-Backend.

**Features:**
- Open Source
- Self-hostable
- AWS SES für Delivery (günstig: ~$0.10/1000 Emails)
- Dashboard für Analytics

**Ressourcen:**
- [useSend GitHub](https://github.com/usesend/useSend)

#### Option C: Mailpit (Nur Development)

Für lokale Entwicklung ohne echten Email-Versand:

```bash
docker run -d --name mailpit \
  -p 1025:1025 \
  -p 8025:8025 \
  axllent/mailpit
```

Web-UI: http://localhost:8025

---

## Kosten-Analyse

### Aktuelle monatliche Kosten (geschätzt)

| Dienst | Nutzung | Kosten/Monat |
|--------|---------|--------------|
| Replicate | ~500 Bilder | €20-50 |
| OpenRouter | ~1M Tokens | €10-30 |
| Google Gemini | ~10K Requests | €5-15 |
| Hetzner S3 | ~50GB | €5 |
| Cloudflare | Unbegrenzt | €0 |
| **Gesamt** | | **€40-100** |

### Nach vollständigem Self-Hosting

| Dienst | Lösung | Kosten/Monat |
|--------|--------|--------------|
| Bildgenerierung | ComfyUI (lokal) | €0 |
| Vision AI | LLaVA (lokal) | €0 |
| LLMs | Ollama (lokal) | €0 |
| Email | Postal + SES | ~€2 |
| Storage | Hetzner S3 (behalten) | €5 |
| Strom | Mac Mini (~50W) | ~€5 |
| **Gesamt** | | **~€12** |

### Ersparnis

| Szenario | Monatlich | Jährlich |
|----------|-----------|----------|
| Aktuell | €40-100 | €480-1200 |
| Self-Hosted | ~€12 | ~€144 |
| **Ersparnis** | **€28-88** | **€336-1056** |

---

## Implementierungs-Roadmap

### Phase 1: Sofort umsetzbar (0-2 Wochen)

| Aufgabe | Priorität | Aufwand | Ersparnis |
|---------|-----------|---------|-----------|
| ComfyUI installieren | Hoch | 2h | €20-50/Monat |
| LLaVA für Vision | Hoch | 1h | €5-15/Monat |
| Mailpit für Dev | Mittel | 30min | - |

**Skript für Phase 1:**

```bash
#!/bin/bash
# scripts/mac-mini/setup-self-hosted-ai.sh

echo "=== Installing ComfyUI ==="
cd ~/projects
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "=== Downloading SDXL ==="
mkdir -p models/checkpoints
cd models/checkpoints
wget -q https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors

echo "=== Installing LLaVA ==="
ollama pull llava:13b

echo "=== Done! ==="
echo "Start ComfyUI: cd ~/projects/ComfyUI && python main.py --listen 0.0.0.0 --port 8188"
echo "LLaVA ready at: http://localhost:11434"
```

### Phase 2: Bei Bedarf (2-4 Wochen)

| Aufgabe | Auslöser | Aufwand |
|---------|----------|---------|
| Postal für Emails | Email-Volumen > 1000/Monat | 4h |
| Umami self-hosted | Analytics benötigt | 2h |
| Mehr LLM-Modelle | Qualitätsanforderungen | 1h |

### Phase 3: Hardware-Upgrade nötig

| Aufgabe | Anforderung | Hardware |
|---------|-------------|----------|
| Flux.1 Dev | 24GB+ RAM | Mac Mini M4 Pro (32GB+) |
| Größere LLMs (70B) | 48GB+ RAM | Mac Studio (64GB+) |
| Multi-GPU Setup | Parallel Inference | Externe GPU |

---

## Nicht ersetzbare Dienste

Diese Dienste können/sollten **nicht** selbst gehostet werden:

| Dienst | Grund |
|--------|-------|
| **Stripe** | PCI-DSS Compliance, Haftung, Aufwand |
| **Google OAuth** | Benötigt Google API, kein Ersatz |
| **Cloudflare** | DDoS-Schutz, CDN nicht selbst replizierbar |
| **Hetzner S3** | Günstiger als eigene Storage-Infra, Redundanz |

---

## Anhang: Environment Variables Übersicht

### AI-Dienste

```env
# Replicate (Picture App)
PICTURE_REPLICATE_API_TOKEN=r8_xxx

# OpenRouter (Chat)
OPENROUTER_API_KEY=sk-or-v1-xxx

# Google Gemini (Planta, Food, Cardecky)
GEMINI_API_KEY=AIza...
PLANTA_GEMINI_API_KEY=AIza...
FOOD_GEMINI_API_KEY=AIza...
MANA_GAMES_GOOGLE_GENAI_API_KEY=AIza...

# Ollama (Local - bereits konfiguriert)
OLLAMA_URL=http://localhost:11434
OLLAMA_TIMEOUT=120000

# Azure OpenAI (Optional)
AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com
AZURE_OPENAI_API_KEY=xxx
```

### Infrastruktur

```env
# PostgreSQL
DATABASE_URL=postgresql://mana:devpassword@localhost:5432/{app}

# Redis
REDIS_URL=redis://localhost:6379

# MinIO (Local)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Hetzner S3 (Production)
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=fsn1
```

### Auth & Payment

```env
# Mana Auth
MANA_AUTH_URL=http://localhost:3001

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Google OAuth (Contacts)
CONTACTS_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
CONTACTS_GOOGLE_CLIENT_SECRET=xxx
```

---

## Weiterführende Dokumentation

- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) - Lokale Entwicklungsumgebung
- [LOCAL_LLM_MODELS.md](./LOCAL_LLM_MODELS.md) - Verfügbare lokale LLM-Modelle
- [LOCAL_STT_MODELS.md](./LOCAL_STT_MODELS.md) - Speech-to-Text Modelle
- [MAC_MINI_SERVER.md](./MAC_MINI_SERVER.md) - Mac Mini Server Dokumentation
- [SELF-HOSTING-GUIDE.md](./SELF-HOSTING-GUIDE.md) - VPS Self-Hosting Guide
- [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) - Docker Konfiguration

---

*Zuletzt aktualisiert: Januar 2026*
