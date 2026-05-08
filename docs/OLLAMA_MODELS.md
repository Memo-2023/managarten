# Ollama Models Management

Dokumentation zum Hinzufügen und Verwalten von Ollama-Modellen auf dem Mac Mini Server.

## Aktuelle Modelle

| Modell | Größe | Typ | Performance | Beschreibung |
|--------|-------|-----|-------------|--------------|
| `gemma3:4b` | 3.3 GB | Text | ~53 t/s | Standard - schnell für einfache Aufgaben |
| `gemma3:12b` | 8 GB | Text | ~30 t/s | Empfohlen - gute Balance |
| `gemma3:27b` | 16 GB | Text | ~15 t/s | Beste Qualität, langsamer |
| `phi3.5:latest` | 2.2 GB | Text | ~60 t/s | Microsoft - kompakt & effizient |
| `ministral-3:3b` | 3 GB | Text | ~55 t/s | Mistral Mini - sehr schnell |
| `llava:7b` | 4.7 GB | Vision | ~25 t/s | Bildverständnis |
| `qwen3-vl:4b` | 3.3 GB | Vision | ~40 t/s | Qwen Vision-Language |
| `deepseek-ocr:latest` | 6.7 GB | Vision | ~20 t/s | OCR & Dokumente |
| `qwen2.5-coder:7b` | 4.7 GB | Code | ~35 t/s | Code-Generierung |
| `qwen2.5-coder:14b` | 10 GB | Code | ~20 t/s | Erweiterte Code-Generierung |

## Neues Modell hinzufügen

### Schritt 1: Modell auf Server installieren

```bash
# Via SSH auf Mac Mini
ssh mana-server

# Modell herunterladen
/opt/homebrew/bin/ollama pull <model-name>

# Beispiel:
/opt/homebrew/bin/ollama pull gemma3:12b
```

### Schritt 2: Modell im LLM Playground registrieren

Datei: `services/llm-playground/src/lib/stores/models.svelte.ts`

Füge das Modell in `MODEL_METADATA` hinzu:

```typescript
export const MODEL_METADATA: Record<string, { description: string; modality: Modality }> = {
	// ... bestehende Modelle ...

	// Neues Modell hinzufügen:
	'neues-modell:tag': {
		description: 'Kurze Beschreibung des Modells',
		modality: 'text', // oder 'vision' oder 'code'
	},
};
```

### Schritt 3: Optional - Als Standard setzen

Datei: `services/llm-playground/src/lib/stores/settings.svelte.ts`

```typescript
const defaultSettings: Settings = {
	model: 'ollama/neues-modell:tag', // Standard-Modell ändern
	// ...
};
```

### Schritt 4: Deployment

```bash
# Playground neu bauen und deployen
pnpm --filter @mana/llm-playground build

# Auf Mac Mini deployen
ssh mana-server "cd ~/projects/managarten && docker compose -f docker-compose.macmini.yml up -d --build llm-playground"
```

## Modality-Typen

| Typ | Beschreibung | Pattern-Erkennung |
|-----|--------------|-------------------|
| `text` | Standard Text-Generierung | Default |
| `vision` | Bildverständnis (LLaVA, etc.) | `llava`, `vision`, `-vl`, `ocr`, `moondream` |
| `code` | Code-Generierung | `coder`, `codellama`, `starcoder` |

Die Modality wird automatisch erkannt, wenn das Modell nicht in `MODEL_METADATA` ist.

## Server-Verwaltung

### Modelle auflisten

```bash
ssh mana-server "/opt/homebrew/bin/ollama list"
```

### Modell entfernen

```bash
ssh mana-server "/opt/homebrew/bin/ollama rm <model-name>"
```

### Speicherort der Modelle

Die Modelle liegen auf der externen 4TB SSD:
- Pfad: `/Volumes/TillJakob-S04/ManaData/ollama/models`
- Symlink: `~/.ollama -> /Volumes/TillJakob-S04/ManaData/ollama`

### Ollama Service

```bash
# Status prüfen
ssh mana-server "pgrep -x ollama && echo 'Running' || echo 'Stopped'"

# Neustarten
ssh mana-server "/opt/homebrew/bin/brew services restart ollama"

# Logs
ssh mana-server "tail -f /opt/homebrew/var/log/ollama.log"
```

## Performance-Empfehlungen

### RAM-Nutzung

| Modell-Größe | Min. RAM | Empfohlen |
|--------------|----------|-----------|
| 3-4B | 4 GB | 8 GB |
| 7-8B | 6 GB | 12 GB |
| 12-14B | 10 GB | 16 GB |
| 27B+ | 16 GB | 24+ GB |

**Mac Mini M4 hat 16 GB RAM** - daher maximal ein 27B Modell gleichzeitig laden.

### Gleichzeitige Modelle

Ollama lädt Modelle bei Bedarf. Wenn ein neues Modell angefragt wird und nicht genug RAM frei ist, wird das vorherige entladen. Für beste Performance:

1. Hauptsächlich ein Modell verwenden
2. Zwischen ähnlichen Größen wechseln
3. Nach großen Modellen (27B) kurz warten vor kleinen Anfragen

## Changelog

| Datum | Änderung |
|-------|----------|
| 2026-02-01 | gemma3:12b, gemma3:27b, qwen2.5-coder:14b hinzugefügt |
| 2026-02-01 | MODEL_METADATA System eingeführt |
| 2026-02-01 | Standard-Modell auf gemma3:4b geändert |
