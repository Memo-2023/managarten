---
title: 'Monitoring, Auth & Local AI: Prometheus, Email Verification & Speech-to-Text'
description: 'Prometheus Metrics für alle Backends, Brevo Email Service, Email Verification Flow, Ollama Integration, Speech-to-Text Service und zwei neue Telegram Bots'
date: 2026-01-26
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'monitoring',
    'prometheus',
    'grafana',
    'auth',
    'email',
    'brevo',
    'ollama',
    'speech-to-text',
    'telegram-bot',
    'ai',
  ]
featured: true
commits: 54
readTime: 10
stats:
  filesChanged: 155
  linesAdded: 11566
  linesRemoved: 2290
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 54
workingHours:
  start: '2026-01-26T11:00'
  end: '2026-01-27T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


Produktiver Tag mit Fokus auf **Monitoring-Infrastruktur**, **Email-Authentifizierung** und **lokale AI-Services**. Die wichtigsten Errungenschaften:

- **Prometheus Metrics** für alle NestJS Backends
- **Grafana Dashboards** mit CI/CD und User Statistics
- **Brevo SMTP** für transaktionale Emails
- **Email Verification** Flow komplett implementiert
- **Ollama Integration** für lokale LLM-Inferenz
- **Speech-to-Text Service** mit Whisper MLX
- **2 neue Telegram Bots** (Ollama Bot, Project Doc Bot)

---

## Monitoring & Prometheus

### Prometheus Metrics für alle Backends

Alle NestJS Backends wurden mit Prometheus Metrics ausgestattet:

- `/metrics` Endpoint auf jedem Backend
- Request/Response Metriken
- User Statistics (registrierte Nutzer pro App)
- Health Check Endpoints korrigiert

### Grafana Dashboards

| Dashboard        | Inhalt                        |
| ---------------- | ----------------------------- |
| **CI/CD**        | GitHub Actions, Deployments   |
| **User Stats**   | Registrierungen pro App       |
| **System**       | CPU, Memory, Disk             |
| **Container**    | Docker Container Metriken     |

### Health Check Fixes

Korrektur der Health Check Endpoints für alle Services:

- `mana-core-auth`: `/health`
- `chat-backend`: `/api/health`
- `calendar-backend`: `/health`
- `clock-backend`: `/health`
- `contacts-backend`: `/health`
- `todo-backend`: `/health`
- Alle Web Apps: `/health` Endpoint hinzugefügt

---

## Auth & Email Service

### Brevo SMTP Integration

Implementierung von **Brevo** (ehemals Sendinblue) als Email-Provider:

```
mana-core-auth
├── src/lib/email/
│   ├── brevo.ts          # Brevo SMTP Client
│   └── templates/        # Email Templates
```

**Features:**
- Transaktionale Emails via SMTP
- HTML Email Templates
- Einladungs-Emails für Team-Mitglieder
- Password Reset Emails

### Email Verification Flow

Kompletter Email-Verification-Flow für neue Registrierungen:

| Komponente               | Beschreibung                              |
| ------------------------ | ----------------------------------------- |
| `sendVerificationEmail`  | Sendet Verification Link                  |
| `/verify-email` Endpoint | Better Auth API Endpoint                  |
| Verification Pages       | Success/Error Pages in ManaCore Web       |
| Redirect Flow            | Zurück zur Ursprungs-App nach Verifizierung |
| Login Banner             | "Email verified" Banner auf Login Pages   |

**User Flow:**
1. Nutzer registriert sich
2. Verification Email wird gesendet
3. Nutzer klickt Link → `/verify-email?token=...`
4. Erfolgsseite mit Redirect zur Ursprungs-App
5. Login Page zeigt "Email erfolgreich verifiziert" Banner

### Auth Fixes

- Minimum Passwortlänge auf 8 Zeichen reduziert
- Password Reset API-Methode korrigiert
- Inviter Name in Einladungs-Emails gefixed
- Email Verification Config an richtige Stelle verschoben

---

## Ollama Integration

### Telegram Ollama Bot

Neuer Telegram Bot für lokale LLM-Inferenz via Ollama:

```
services/telegram-ollama-bot/
├── src/
│   ├── bot/           # Telegram Bot Logic
│   ├── ollama/        # Ollama API Client
│   └── main.ts
```

**Features:**
- Chat mit lokalen LLMs (Llama 3.2, Qwen, etc.)
- Streaming Responses
- Conversation History
- Model Selection

### Chat Backend Ollama

Integration von Ollama in das Chat Backend für lokale LLM-Inferenz:

- Docker Compose Configuration für Ollama
- API Endpoint für lokale Modelle
- Fallback zu Cloud-APIs wenn Ollama nicht verfügbar

---

## Speech-to-Text Service

### Whisper MLX Service

Neuer Speech-to-Text Service für den Mac Mini:

```
services/speech-to-text/
├── src/
│   ├── transcription/   # Whisper MLX
│   ├── api/             # FastAPI Endpoints
│   └── main.py
```

**Technologie:**
- **lightning-whisper-mlx** für Apple Silicon
- **Modell:** large-v3 (optimiert für Genauigkeit)
- **API:** FastAPI mit `/transcribe` Endpoint

### Voxtral Multimodal (Experimentell)

Experimente mit Voxtral für multimodale Audio-Verarbeitung:

- Base64 Audio Encoding
- AutoModel für korrekte Architektur
- Homebrew PATH für ffmpeg

---

## Todo App Refactoring

### ExpandableToolbar Pattern

Übernahme des ExpandableToolbar-Patterns aus der Calendar App:

- Konsolidierte Toolbar-Komponente
- Bessere Mobile-UX
- Einheitliches Design

### Inline Task Editing

Refactoring des Task-Editierens:

| Vorher              | Nachher                    |
| ------------------- | -------------------------- |
| Modal zum Editieren | Inline-Editing direkt in der Liste |
| Extra Click nötig   | Direktes Editieren         |
| Context Switch      | Fokus bleibt in der Liste  |

### Homepage Redesign

- Verbesserte Empty State Darstellung
- Optimierte Section Visibility
- Klarere Call-to-Actions

---

## Calendar App Fix

Behebung eines kritischen Bugs:

- **Problem:** App hing beim Laden
- **Ursache:** Layout Issues
- **Fix:** Korrektur der Layout-Komponenten

---

## Neue Telegram Bots

### telegram-ollama-bot

Bot für lokale LLM-Inferenz:

| Feature              | Beschreibung               |
| -------------------- | -------------------------- |
| Chat                 | Unterhaltung mit lokalen LLMs |
| Streaming            | Echtzeit-Antworten         |
| Model Selection      | Verschiedene Modelle wählbar |

### telegram-project-doc-bot

Bot für Projekt-Dokumentation:

| Feature              | Beschreibung               |
| -------------------- | -------------------------- |
| Drizzle ORM          | PostgreSQL Datenbank       |
| OpenAI Integration   | AI-gestützte Features      |
| S3 Storage           | Datei-Upload via MinIO     |

---

## Dokumentation

### Neue Docs

- **Design UX Guidelines** (`.claude/guidelines/design-ux.md`)
- **Local Models Documentation**
- **External Services Analysis** - Self-Hosting Guide
- **Telegram Ollama Bot** in MAC_MINI_SERVER.md

---

## Infrastruktur Updates

### Watchtower Notifications

Experimente mit verschiedenen Notification-Methoden:

- Telegram API (nicht funktional)
- n8n Webhook (Alternative)
- nickfedor Fork mit Telegram Support

### Cloudflare Tunnel

- Pushgateway zur Tunnel-Konfiguration hinzugefügt

---

## Zusammenfassung

| Bereich        | Commits | Highlights                           |
| -------------- | ------- | ------------------------------------ |
| Monitoring     | 15      | Prometheus, Grafana, Health Checks   |
| Auth           | 12      | Brevo SMTP, Email Verification       |
| AI Services    | 10      | Ollama, Speech-to-Text               |
| Todo           | 5       | Inline Editing, Toolbar              |
| Telegram Bots  | 4       | Ollama Bot, Project Doc Bot          |
| Bugfixes       | 8       | Calendar, Auth, Docker               |

---

## Nächste Schritte

1. **Grafana Alerts** für kritische Metriken konfigurieren
2. **Speech-to-Text** in Chat App integrieren
3. **Ollama** Performance-Optimierungen
4. **Mobile Apps** mit neuen Auth-Features testen
5. **Project Doc Bot** Features erweitern
