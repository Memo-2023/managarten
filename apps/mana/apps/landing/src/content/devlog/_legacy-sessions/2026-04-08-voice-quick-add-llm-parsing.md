---
title: 'Voice Quick-Add Pipeline: Notes, Todo, Habits + LLM-Parsing live in Prod'
description: 'Geteilte VoiceCaptureBar für fünf Module, LLM-getriebene Strukturextraktion (parse-task, parse-habit), Tag-Matching gegen den Workspace, mana-llm Ollama-Routing-Fix, gemma3:12b mit Few-Shot-Prompt, 49 Unit-Tests, persistente .env.secrets für Dev-Setup, end-to-end Deployment auf mana.how mit zwei real bugs unterwegs.'
date: 2026-04-08
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'voice-capture',
    'mana-stt',
    'mana-llm',
    'gemma3',
    'ollama',
    'colima',
    'sveltekit',
    'todo',
    'habits',
    'notes',
    'env-secrets',
    'few-shot-prompting',
    'tests',
  ]
featured: true
commits: 18
readTime: 14
stats:
  filesChanged: 41
  linesAdded: 2200
  linesRemoved: 980
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 18
workingHours:
  start: '2026-04-08T13:00'
  end: '2026-04-08T17:30'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


## Highlights

- **Geteilte `<VoiceCaptureBar>`** ersetzt zwei kopierte MediaRecorder-Implementierungen in Dreams + Memoro und kommt jetzt in Notes, Todo workbench, Memoro workbench und standalone /memoro zum Einsatz
- **LLM-Parsing-Pipeline** für Voice + Typed Quick-Add: `/api/v1/voice/parse-task` (Title, dueDate, Priority, Labels) und `/api/v1/voice/parse-habit` (Habit-Picker)
- **Real bug found durchs Testen**: Mac Mini's mana-llm konnte Ollama auf der GPU-Box nicht erreichen — Colima isoliert den LAN-Range, gpu-proxy Forward über `host.docker.internal:13434` löst das
- **gemma3:12b + Few-Shot-Prompt** statt 4b mit Rules-Section — bessere Date-Math, vollständige Titles, korrekte Habit-Picks, marginal langsamer
- **49 Unit-Tests** für Tag-Matching, Habit-Matching und Hallucination-Guards (todo + habits + parse-task coerce)
- **`.env.secrets` Override-Layer** im Generator — persistente Dev-Secrets die `pnpm setup:env` überleben, mit `pnpm setup:secrets` als SSH-Pull vom Mac Mini
- **Deployment auf mana.how** mit zwei echten Bugs unterwegs (SvelteKit prod-export-Restriction + `$env/dynamic/private` PUBLIC\_-Exclusion), beide gefixt und dokumentiert

---

## VoiceCaptureBar — Refactor + Drop-In für drei neue Module

Ausgangslage: Dreams und Memoro hatten je ihre eigene `recorder.svelte.ts` mit ~250 Zeilen MediaRecorder-Boilerplate, parallele Mic-Button-Markup, Error-UI, requireAuth-Gating. Literale Kopien, divergierten in Detailfragen.

**Schritt 1** — gemeinsame `voiceRecorder` Singleton extrahiert nach `$lib/components/voice/recorder.svelte.ts`. Eine Aufnahme zur Zeit ist physikalische Realität (ein Mikrofon, ein MediaStream), die Singleton macht es explizit statt sich auf "getUserMedia schlägt beim zweiten Aufruf fehl" zu verlassen.

**Schritt 2** — `<VoiceCaptureBar>` UI-Komponente mit eingebautem `requireAuth()`-Gate vor der Mic-Permission. Module-Host gibt nur:

```svelte
<VoiceCaptureBar
  idleLabel="Notiz sprechen"
  feature="notes-voice-capture"
  reason="Notizen werden verschlüsselt gespeichert. Dafür brauchst du ein Mana-Konto."
  onComplete={handleVoiceComplete}
/>
```

Vier States, automatische Sticky-Deny-Detection, "Trotzdem versuchen" Force-Retry — alles in einer Komponente.

**Schritt 3** — Migration: Dreams workbench, Memoro workbench, standalone /memoro, Notes, Todo, Habits. Insgesamt **-234 LOC** im ersten Refactor-Commit, plus die neuen Drop-Ins in den drei Modulen ohne Voice davor.

Use-Case-Verteilung der Mic-Bar nach diesem Tag:

| Modul | Pfad | Was passiert nach Stop |
|---|---|---|
| Dreams | workbench | encrypted save direkt |
| Memoro | workbench + standalone | createFromVoice → STT → encrypted memo |
| Notes | workbench | createFromVoice → STT → inline editor mit Live-Refresh |
| Todo | workbench | createFromVoice → STT → parse-task → strukturierter Task |
| Habits | workbench | logFromVoice → STT → substring match → parse-habit Fallback |

---

## Generischer STT-Proxy + Endpoint-Konsolidierung

Memoro und Dreams hatten je ihren eigenen Transcribe-Endpoint (`/api/v1/memoro/transcribe`, `/api/v1/dreams/transcribe`) — beides literale Kopien die nur an mana-stt durchproxien. Neuer generischer `/api/v1/voice/transcribe` (mit `MANA_STT_API_KEY` aus dem Server-Env), beide Module migriert, alte Endpoints gelöscht. **-206 LOC**, ein Ort für STT-Auth und Response-Shape von jetzt an.

Dokumente (`docker-compose.macmini.yml`, `ENVIRONMENT_VARIABLES.md`, `MAC_MINI_SERVER.md`) entsprechend nachgezogen.

---

## LLM-Parsing für Todo: parse-task

Notes und Memoro brauchen nur den Transkript. Todo will mehr — "Steuererklärung morgen 14 Uhr unbedingt" sollte als `{title: "Steuererklärung", dueDate: tomorrow, priority: "high"}` landen, nicht als Title mit dem ganzen Satz.

Neuer Endpoint `/api/v1/voice/parse-task`:

- Input: `{ transcript, language }`
- Output: `{ title, dueDate, priority, labels }`
- Sprich an mana-llm via OpenAI-kompatible chat completions
- Graceful degradation: bei jedem Fehler → `{ title: transcript, ... }`. Voice quick-add darf NIE schlechter scheitern als typed quick-add.

Im Todo-Store dazu:
- `createFromVoice(blob, durationMs, language)` — Placeholder-Task sofort, dann STT + Parse im Hintergrund
- `enrichTaskFromText(taskId, text)` — gleicher LLM-Pass für TYPED quick-add. Asymmetrie: bei Voice IMMER die LLM-Title übernehmen (rohe Transkripte sind hässlich), bei Typed nur wenn die LLM tatsächlich strukturierten Inhalt findet (sonst ein gefundener Title-Cleanup wäre lästig statt hilfreich)
- `parseTaskText(text, language)` — pure helper, beide Pfade rufen ihn

### Tag-Matching gegen vorhandene Workspace-Tags

Die LLM gibt freie Topic-Hints zurück (`["steuern", "haushalt"]`). Diese werden gegen `tagCollection.getAll()` gematcht über:

- NFD-strip + lowercase + collapsed whitespace normalize
- Exact match (winner)
- Substring match (fallback, beide Seiten ≥ 3 Zeichen — verhindert "ab" in "abenteuer")
- **Niemals Auto-Create**: unbekannte Topics droppen still. Auto-Create würde die Tag-Liste mit one-off "shopping"/"einkauf"/"groceries" Duplikaten zumüllen.

---

## LLM-Parsing für Habits: parse-habit + Substring Fast-Path

Habits-Voice ist anders: kein freies Format, sondern "welcher meiner existierenden Habits war das?".

Two-stage:

1. **Client-Side Substring Fast-Path** in `matchHabitToTranscript`:
   - Wort-Boundary-Match über die normalisierten Tokens
   - "kaffee" → matched "Kaffee" instant ohne LLM-Call
   - Multi-Word Habits: alle Tokens müssen vorkommen ("grüner tee schmeckt gut" → "Grüner Tee")
   - **Specificity-Ranking**: bei Mehrfach-Match wins die spezifischere Variante. Sonst würde "Tee" immer "Grüner Tee" schlagen wenn beide existieren

2. **LLM-Fallback** `/api/v1/voice/parse-habit`:
   - Input: `{ transcript, habits: [string], language }`
   - Output: `{ match: string | null, note: string | null }`
   - Endpoint validiert das LLM-Ergebnis verbatim gegen die Input-Liste — paraphrasierte Namen ("Joggen" statt "Laufen") werden gedropt statt gegen einen nicht-existenten Habit zu loggen
   - Catches die harten Fälle: "30 minuten gelaufen" → Laufen, "ich rauche eine" → Zigarette

---

## Der Mac Mini mana-llm Bug — der größte Detour des Tages

Erste real-LLM Tests durchs `parse-task`-Endpoint gingen alle in den Fallback-Pfad. mana-llm war "up" auf `https://llm.mana.how`, aber `/v1/models` lieferte `{"data":[]}` und chat completions warfen "All connection attempts failed".

`mana-llm/health` zeigte:
```
"providers":{"ollama":{"status":"unhealthy","url":"http://192.168.178.11:11434","error":"All connection attempts failed"}}
```

192.168.178.11 ist die GPU-Box. Per SSH zur GPU verifiziert: Ollama läuft, lauscht auf `::` (alle IPv6 inkl. dual-stack IPv4), `gemma3:4b`/`12b`/`27b` geladen, vom Mac Mini Host aus per `curl 192.168.178.11:11434/api/tags` direkt erreichbar.

**Aber** vom mana-llm Container aus → "Connection refused". Mehr Tests: vom Container aus war der **gesamte 192.168.178.0/24 Range** unreachable, auch IPs auf denen niemand lauschte → trotzdem Connection Refused (nicht Timeout!).

Das ist Colima's Footgun: die VM "claimt" den LAN-Range, kann aber nicht hinroutten. Jeder TCP-Connect kriegt einen synthetisierten RST. Der Host kann hin, der Container kann nicht.

**Fix found bereits running**: `~/Library/LaunchAgents/com.mana.gpu-proxy.plist` läuft auf dem Mac Mini und forwardet `127.0.0.1:13434 → 192.168.178.11:11434` neben einigen anderen GPU-Service-Ports. Das war für genau dieses Problem gedacht, war aber nie für mana-llm verkabelt.

Compose-Edit:
```yaml
mana-llm:
  extra_hosts:
    - "host.docker.internal:host-gateway"
  environment:
    OLLAMA_URL: http://host.docker.internal:13434
```

`docker compose up -d --force-recreate mana-llm` → `/health` zeigt sofort `status: healthy`, `models_available: 5`.

Lehre: wenn ein Service im Container nicht erreichbar ist, immer prüfen ob der Host's Docker-Network-Bridge die Ziel-IP "claimt" ohne hinzukönnen. Colima ist hier subtiler als Docker Desktop.

---

## Echtes LLM, echte Hallucination-Probleme

Mit working mana-llm konnte ich zum ersten Mal `parse-task` end-to-end testen. Erste Ergebnisse mit `gemma3:4b`:

| Transkript | Erwartung | gemma3:4b |
|---|---|---|
| Mülltonnen rausstellen | dueDate=null, priority=null | dueDate=2026-04-08 (heute!), priority=low |
| Anna nächsten Montag anrufen | dueDate=2026-04-13 (Mo) | dueDate=2026-04-14 (Di) — off-by-one |
| Steuererklärung morgen 14 Uhr | dueDate=2026-04-09 | dueDate=2026-04-09T14:00:00 — full ISO timestamp |

Drei strukturelle Probleme:
1. Hallucinated dueDate auf bare tasks
2. Falsches Weekday-Math
3. Time-Component im Date-String, der die Dexie-YYYY-MM-DD-Spalte killt

### Deterministic guards in `coerce()`

Erste Iteration: Strenge Post-Processing-Logik:
- Strikt-`/^(\d{4}-\d{2}-\d{2})/` Regex zieht nur die Datumspräfix raus
- `DATE_TRIGGER_PATTERNS` und `PRIORITY_TRIGGER_PATTERNS`: Substring-Scan über das Original-Transkript für deutsche + englische Date/Urgency-Wörter. Wenn die LLM einen dueDate zurückgibt aber das Transkript hat null Trigger-Wörter → drop. Hallucination guard.

Damit war Bug 1 + 3 weg, Bug 2 (Weekday-Math) blieb.

### Modell-Bump: 4b → 12b

Direkt-Test gegen `llm.mana.how`: gemma3:12b bekommt "what date is next Monday from Wednesday 2026-04-08?" auf ersten Versuch korrekt (2026-04-13). Aber durch das `parse-task` Endpoint mit JSON-Output-System-Message → 2026-04-14. Über-Prompting macht das Modell schlechter.

### Few-Shot-Prompt statt Rules-Section

Pure Rules-Beschreibungen ("ONLY set X when..." × 6) machten das Modell schlechter. Ersetzt durch fünf worked examples:

```
Examples (assume today is 2026-04-08, a Wednesday):

Transcript: "Mülltonnen rausstellen"
{"title":"Mülltonnen rausstellen","dueDate":null,"priority":null,"labels":["müll"]}

Transcript: "Steuererklärung morgen 14 Uhr unbedingt erledigen"
{"title":"Steuererklärung erledigen","dueDate":"2026-04-09","priority":"high","labels":["steuern"]}

Transcript: "Anna nächsten Montag anrufen"
{"title":"Anna anrufen","dueDate":"2026-04-13","priority":null,"labels":["anruf"]}

...
```

Ergebnis nach diesem Wechsel — alle fünf Examples + ein novel case ("Mama am Wochenende besuchen") werden korrekt geparsed:

| Transkript | Ergebnis |
|---|---|
| Mülltonnen rausstellen | title=`Mülltonnen rausstellen`, dueDate=`null`, priority=`null` ✅ |
| Steuererklärung morgen 14 Uhr unbedingt | title=`Steuererklärung erledigen`, dueDate=`2026-04-09`, priority=`high` ✅ |
| Anna nächsten Montag anrufen | title=`Anna anrufen`, dueDate=`2026-04-13` ✅ korrekter Wochentag! |
| Buy milk | title=`Buy milk`, dueDate=`null` ✅ |
| Mama am Wochenende besuchen *(novel)* | title=`Mama besuchen`, dueDate=`2026-04-11` (Sat) ✅ generalisiert |

Die deterministischen Guards in `coerce()` blieben als Backstop.

---

## 49 Unit-Tests

Drei Test-Files, alle pure-function getestet ohne Infrastructure:

| File | Cases | Was wird abgesichert |
|---|---|---|
| `tasks-matching.test.ts` | 16 | normalize, exact/case/diacritic/substring/specificity matching, "never invent tags" guarantee |
| `habits-matching.test.ts` | 11 | wort-boundary, multi-word, false-positive prevention, dedupe ranking |
| `parse-task/coerce.test.ts` | 22 | transcriptMentions, date/priority hallucination guards, time-component stripping, malformed dueDate rejection, label filtering |

Die habits-matching Tests fanden auf erstem Run einen real bug: ohne Specificity-Ranking würde "Tee" immer "Grüner Tee" schlagen weil first-match-in-input-order. Fix: alle Kandidaten sammeln, max-Token-count gewinnt.

---

## Deployment auf mana.how mit zwei real bugs

### Bug 1: SvelteKit prod-build-export-Restriction

Mein erstes mana-web Rebuild scheiterte mit:
```
Invalid export 'coerce' in /api/v1/voice/parse-task
```

`+server.ts` Files dürfen in der Production-Build nur Request-Handler exportieren (`GET`, `POST`, ...) plus Symbole mit `_` Präfix. Dev-Server ist looser. Meine Test-Helper `coerce`, `transcriptMentions`, `__test` violated das.

**Fix**: Helper extrahiert nach `coerce.ts` (sibling, kein `+server` suffix). `+server.ts` importiert von dort, exportiert nur `POST`. Tests importieren von `./coerce` direkt → Bonus: Test-Setup pulls in zero SvelteKit runtime, runs ~3× faster (130ms statt 400ms).

### Bug 2: `$env/dynamic/private` excludes PUBLIC_-prefixed vars

Erstes erfolgreiches Build → smoke-test gegen mana.how → ALLE Responses sind die Fallback-Shape (`title=transcript`, `dueDate=null`, ...). LLM erreichbar von innen mana-web (verifiziert per `wget`), aber das Endpoint hits die `fallback()` path.

Root cause: Mein Code las `env.MANA_LLM_URL || env.PUBLIC_MANA_LLM_URL || ...`. Aber **`$env/dynamic/private` schließt explizit alle Vars mit dem PUBLIC_-Präfix aus**. Der `PUBLIC_MANA_LLM_URL` Fallback war seit Tag 1 toter Code, nur weil die Compose-Env nur `PUBLIC_MANA_LLM_URL` setzte → in Prod hieß das fetch ging an `http://localhost:3025` (default), schlug fehl, fallback returned.

**Fix**: 
1. `MANA_LLM_URL` (no prefix) zur compose-env von mana-web hinzugefügt
2. Den toten `PUBLIC_*` fallback im Code rausgeworfen
3. Comment dazu damit der nächste Dev nicht in dieselbe Falle läuft

Recreate (env-only, kein rebuild) → alle Prod-Smoke-Tests grün:

```
=== prod parse-task: weekday ===
{"title":"Anna anrufen","dueDate":"2026-04-13","priority":null,"labels":["anruf"]}

=== prod parse-task: bare ===
{"title":"Mülltonnen rausstellen","dueDate":null,"priority":null,"labels":["müll"]}

=== prod parse-task: explicit ===
{"title":"Steuererklärung erledigen","dueDate":"2026-04-09","priority":"high","labels":["steuern"]}

=== prod parse-habit ===
{"match":"Laufen","note":"30 minuten"}
```

Voice Quick-Add ist live auf mana.how.

---

## `.env.secrets` — persistente Dev-Secrets

Letzter Tag-Punkt: das Setup-Friction-Problem. `apps/mana/apps/web/.env` ist gitignored und vom Generator überschrieben. Jedes `pnpm setup:env` wischt Dev-Keys (STT, LLM, KEK, OAuth-Keys) wieder raus. Devs müssen sie manuell re-pasten — wiederkehrend, nervig, error-prone.

**Lösung**: neuer Layer `.env.secrets` im Repo-Root.

```
.env.development          # committed, no secrets
        │
        ├── .env.secrets   # gitignored override (dein API keys)
        ▼
scripts/generate-env.mjs   # merges + propagates
        │
        ▼
apps/**/apps/**/.env       # generated, with secrets baked in
```

- `.env.secrets.example` committed, listet alle bekannten Secret-Keys mit leeren Werten + Doku
- `.gitignore`: `.env.secrets` ignoriert, `.env.secrets.example` erlaubt
- `generate-env.mjs`: liest `.env.secrets` (wenn vorhanden) als Override über `.env.development`. Empty values fall through, so eine frisch kopierte template ist no-op
- `pnpm setup:secrets` (neues Script): SSHt zum mana-server, greppt 14 bekannte Keys aus der prod `.env`, schreibt nach `.env.secrets`. Refusal-by-default vor Overwrite, `--force` zum Skippen, reportet welche Keys auf der Mac Mini fehlten

**Verifiziert end-to-end**:
- `rm .env.secrets apps/mana/apps/web/.env && pnpm setup:env` → STT-Key empty (kein Regress für Devs ohne Opt-in)
- `pnpm setup:secrets --force && pnpm setup:env` → STT-Key propagiert, Generator-Output zeigt `Loaded 3 secrets from .env.secrets`
- Echter STT-Round-Trip lokal: macOS `say` → m4a → `/api/v1/voice/transcribe` → "Steuererklärung morgen 14 Uhr unbedingt erledigen." zurück

Damit ist der Setup-Friction strukturell weg, nicht nur für STT sondern für alle Secrets die zukünftig dazukommen.

---

## Numbers

| | |
|---|---|
| Commits today (eigene) | 18 |
| LOC added | ~2.200 |
| LOC removed | ~980 |
| Net | +1.220 |
| Unit tests added | 49 |
| Module mit Voice Quick-Add | 5 (Dreams, Memoro × 2, Notes, Todo, Habits) |
| Neue Endpoints | 3 (`/api/v1/voice/transcribe`, `/parse-task`, `/parse-habit`) |
| Endpoints gelöscht | 2 (`/api/v1/memoro/transcribe`, `/api/v1/dreams/transcribe`) |
| Real bugs während Deployment | 2 (SvelteKit prod-export, `$env/dynamic/private` PUBLIC_-Exclusion) |

---

## Nicht abgedeckt (für später)

- **Mic-Permission-Flow E2E-Test** mit Playwright + `--use-fake-device-for-media-stream` — Gating per Code-Inspection verifiziert, nicht via Browser-Automation
- **`requireAuth`-Modal Test** — gleicher Pfad
- **gemma3:27b Test** — Modell bereits geladen auf der GPU-Box, könnte für besonders schwierige Date-Math-Cases noch besser sein, aber 12b's Accuracy war hier schon ausreichend
- **Habits substring matching tuning** — funktioniert für meine Test-Habits, aber realer Bestand könnte Edge Cases haben
- **parse-task für andere Module** — Notes könnte auch eine bessere Title-Extraktion bekommen statt "erste 80 Zeichen", Questions könnte "Frage formulieren" als Voice-Input nutzen, Chat als Voice-Message

---

## Lehren

1. **Few-shot beats rules** für strukturierte Extraktion mit kleinen Modellen. Längere Rules-Sections machten gemma3:12b nachweislich schlechter, fünf Examples machten es besser — auch für novel cases die nicht in den Examples waren.

2. **Deterministic post-processing als Backstop** ist immer noch nötig, selbst mit dem besseren Modell. LLM-Output zu vertrauen ohne Validation ist eine Wette gegen die Hallucination-Wahrscheinlichkeit. Die Guards kosten nichts wenn die LLM richtig liegt und retten den UX wenn nicht.

3. **End-to-end testen findet bugs die Code-Review nicht findet**. Zwei real bugs (SvelteKit prod-export, `$env/dynamic/private` PUBLIC_-Exclusion) wären ohne tatsächliche Deploys auf prod nicht aufgefallen. Beide subtil, beide blocking, beide jetzt mit Comments im Code damit der nächste Dev nicht reinläuft.

4. **Generic > per-module** für Endpoints. Drei `/api/v1/{module}/transcribe` waren literale Kopien — der generische `/api/v1/voice/transcribe` sparte 200 LOC und ist der Default für jedes neue Modul. Gleiche Logik für `/api/v1/voice/parse-task` und `/parse-habit`.

5. **Singleton-Pattern für hardware-bound Resources** (eine Mic, ein MediaStream). Vorher relied jedes Modul auf "der zweite getUserMedia call schlägt fehl"; die Singleton macht die physikalische Realität explizit und sichtbar im UI-Code — andere Module können ihren Mic-Button als disabled rendern während ein anderes aufnimmt.

6. **Setup-Friction ist auch Tech-Debt**. `.env.secrets` ist ~150 Zeilen Code aber spart jedem Dev mehrere Minuten pro Woche — und sorgt dafür dass nächste Secret-Additions automatisch das gleiche Pattern erben statt jedes Mal neu erfunden zu werden.
