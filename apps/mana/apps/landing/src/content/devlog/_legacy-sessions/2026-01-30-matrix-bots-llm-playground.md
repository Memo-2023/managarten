---
title: '8 neue Matrix Bots, LLM Playground & Demo Mode Cleanup'
description: '8 spezialisierte Matrix Bots für verschiedene ManaCore Apps, SvelteKit LLM Playground UI mit allen Ollama-Modellen, und Entfernung des Demo Modes aus 6 Apps für klarere UX'
date: 2026-01-30
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'matrix-bots',
    'llm-playground',
    'ollama',
    'oidc',
    'demo-mode',
    'sveltekit',
    'better-auth',
    'shared-vite-config',
  ]
featured: false
commits: 41
readTime: 12
stats:
  filesChanged: 289
  linesAdded: 17857
  linesRemoved: 2113
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 41
workingHours:
  start: '2026-01-30T11:00'
  end: '2026-01-31T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Produktiver Tag mit **41 Commits** und Fokus auf Matrix Bot Expansion und Developer Experience:

- **8 neue Matrix Bots** - Spezialisierte Bots für Planta, Cards, Contacts, Picture, Chat, SkillTree, Presi, Questions
- **LLM Playground** - SvelteKit UI für alle Mac Mini Ollama-Modelle
- **Demo Mode Cleanup** - Entfernung aus 6 Apps für klarere Login-Flows
- **OIDC-Fixes** - Matrix Synapse als Trusted Client

---

## Neue Matrix Bots

8 neue spezialisierte Matrix Bots erstellt, die als NestJS Services laufen:

### Bot-Übersicht

| Bot                    | Port | Funktion                           |
| ---------------------- | ---- | ---------------------------------- |
| `matrix-planta-bot`    | 3319 | Pflanzenpflege & Gieß-Erinnerungen |
| `matrix-cards-bot`     | 3320 | Kartendecks & Lernkarten           |
| `matrix-contacts-bot`  | 3321 | Kontaktverwaltung                  |
| `matrix-picture-bot`   | 3322 | AI-Bildgenerierung                 |
| `matrix-chat-bot`      | 3323 | AI-Chat-Konversationen             |
| `matrix-skilltree-bot` | 3324 | Skill-Tracking & XP                |
| `matrix-presi-bot`     | 3325 | Präsentationsverwaltung            |
| `matrix-questions-bot` | 3326 | Q&A Research Management            |

### Bot-Struktur

Alle Bots folgen dem gleichen Pattern:

```
services/matrix-{name}-bot/
├── src/
│   ├── bot/
│   │   ├── {name}.module.ts
│   │   └── {name}.service.ts
│   ├── health/
│   │   └── health.controller.ts
│   └── main.ts
├── Dockerfile
└── package.json
```

### Beispiel-Commands

**matrix-skilltree-bot:**

```
!skill list           - Alle Skills anzeigen
!skill add "Coding"   - Neuen Skill erstellen
!xp add Coding 50     - 50 XP zu Coding hinzufügen
!stats                - Statistiken anzeigen
```

**matrix-picture-bot:**

```
!generate <prompt>    - Bild generieren
!style <style>        - Stil setzen (realistic, anime, etc.)
!variations           - Variationen des letzten Bildes
```

---

## LLM Playground

Neue SvelteKit-Anwendung zum Testen aller verfügbaren LLM-Modelle.

### Features

| Feature              | Beschreibung                    |
| -------------------- | ------------------------------- |
| **Model Selection**  | Alle Mac Mini Ollama-Modelle    |
| **Streaming**        | SSE-basiertes Token-Streaming   |
| **Chat History**     | Konversations-Kontext           |
| **Auth Integration** | Shared Auth UI mit ManaCore SSO |

### Verfügbare Modelle

```typescript
// apps/chat/apps/web/src/lib/config/models.ts
export const OLLAMA_MODELS = [
	'gemma3:4b',
	'gemma3:12b',
	'llama3.2:3b',
	'llama3.2:11b',
	'mistral:7b',
	'codellama:13b',
	'deepseek-coder:6.7b',
	'phi3:14b',
	'qwen2.5:7b',
];
```

### Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  LLM Playground │────>│   mana-llm      │────>│    Ollama       │
│   (SvelteKit)   │     │  (Port 3025)    │     │  (Port 11434)   │
│   Port 5197     │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Deployment

- Docker-Konfiguration für Production
- Shared-Auth-UI Integration
- Vite Config aus `@manacore/shared-vite-config`

---

## Demo Mode Cleanup

Entfernung des Demo Modes aus 6 Apps für klarere User Experience.

### Betroffene Apps

| App       | Änderung                               |
| --------- | -------------------------------------- |
| Calendar  | Demo Mode entfernt, Login erforderlich |
| Todo      | Demo Mode entfernt, Login erforderlich |
| Contacts  | Demo Mode entfernt, Login erforderlich |
| Clock     | Demo Mode entfernt, Login erforderlich |
| Questions | Demo Mode entfernt, Login erforderlich |
| Chat      | Demo Mode entfernt, Login erforderlich |

### Begründung

- **Klarere UX**: Kein Wechsel zwischen Guest/Auth-Modi
- **Einfacherer Code**: Keine Session-Storage-Logik
- **Konsistentes Verhalten**: Alle Apps gleich
- **SSO-Ready**: Nahtlose Auth über alle Apps

---

## OIDC-Verbesserungen

Fixes für die Matrix Synapse OIDC-Integration.

### Trusted Client Config

```typescript
// mana-core-auth: Better Auth OIDC Client
{
  clientId: 'synapse',
  clientSecret: process.env.MATRIX_OIDC_SECRET,
  redirectUrls: [
    'https://matrix.mana.how/_synapse/client/oidc/callback',
  ],
}
```

### Fixes

| Fix                     | Beschreibung                            |
| ----------------------- | --------------------------------------- |
| `redirectUrls` Property | Korrekter Property-Name für Better Auth |
| `client_id` Extraction  | Aus returnUrl für Login-Flow            |
| TypeScript Errors       | OIDC-Login Controller                   |
| CSP Inline Scripts      | Für OIDC Login Page                     |

---

## Shared Vite Config Integration

Integration von `@manacore/shared-vite-config` in alle Web-Apps.

### Vorher

```typescript
// Jede App hatte eigene Vite Config
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: { port: 5174 },
  ssr: { noExternal: ['@manacore/shared-icons', ...] },
});
```

### Nachher

```typescript
import { createViteConfig, mergeViteConfig } from '@manacore/shared-vite-config';

export default defineConfig(
	mergeViteConfig(createViteConfig({ port: 5174 }), { plugins: [tailwindcss(), sveltekit()] })
);
```

### Betroffene Apps

- calendar-web
- Alle Apps via Dockerfile-Updates

---

## Matrix Bots Standardisierung

Standardisierung aller 9+ Matrix Bots mit einheitlicher package.json.

### Einheitliche Dependencies

```json
{
	"dependencies": {
		"@nestjs/common": "^10.0.0",
		"@nestjs/core": "^10.0.0",
		"matrix-bot-sdk": "^0.7.0"
	}
}
```

### TypeScript Fixes

- Strict null checks behoben
- Einheitliche tsconfig

---

## Bugfixes

| Fix                       | Beschreibung                           |
| ------------------------- | -------------------------------------- |
| contacts-web syntax error | +layout.svelte Fix                     |
| calendar-web API calls    | Client URL für Browser-Requests        |
| calendar-web auth store   | Initialisierung beim Mount             |
| matrix-web SSR            | Disabled für App-Routes ($state error) |
| mana-notify               | Email-Benachrichtigungen deaktiviert   |

---

## Zusammenfassung

| Bereich               | Commits | Highlights                     |
| --------------------- | ------- | ------------------------------ |
| **Matrix Bots**       | 8       | 8 neue spezialisierte Bots     |
| **LLM Playground**    | 3       | SvelteKit UI, Auth Integration |
| **Demo Mode Cleanup** | 6       | Entfernt aus 6 Apps            |
| **OIDC**              | 8       | Matrix Synapse Integration     |
| **Shared Config**     | 6       | Vite Config in alle Apps       |
| **Bugfixes**          | 10      | Web Apps, Matrix, Auth         |

---

## Nächste Schritte

1. **Bot Migration** zu `@manacore/matrix-bot-common`
2. **LLM Playground** Production Deployment
3. **Voice Support** für Matrix Bots
4. **E2EE** für Matrix Client
