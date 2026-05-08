# Fix: Colima VirtioFS Mounts nach Stromausfall

Nach dem `colima delete` + recreate fehlt der Home-Directory Mount.
Dadurch werden alle Bind-Mounts zu Projekt-Dateien als leere Verzeichnisse gemountet
und Container wie Synapse, SearXNG, Alertmanager, VictoriaMetrics, Loki crashen.

## Schritte (direkt am Mac Mini ausfuehren)

### 1. Mac Mini neu starten (Power-Button)

SSH funktioniert nicht mehr — der Server muss physisch neugestartet werden.

### 2. Terminal oeffnen und Colima stoppen

```bash
PATH=/opt/homebrew/bin:$PATH colima stop
```

### 3. Home-Directory Mount in Colima Config einfuegen

```bash
sed -i '' '/^mounts:/a\
  - location: /Users/mana\
    writable: true
' ~/.colima/default/colima.yaml
```

### 4. Verifizieren dass beide Mounts drin sind

```bash
grep -A8 'mounts:' ~/.colima/default/colima.yaml
```

Erwartete Ausgabe:

```
mounts:
  - location: /Users/mana
    writable: true
  - location: /Volumes/ManaData
    writable: true
```

### 5. Colima starten

```bash
PATH=/opt/homebrew/bin:$PATH colima start
```

### 6. Testen ob File-Mounts funktionieren

```bash
docker run --rm -v ~/projects/managarten/docker/alertmanager/alertmanager.yml:/test.yml:ro alpine head -3 /test.yml
```

Sollte YAML-Inhalt zeigen, NICHT "Is a directory".

### 7. Alle Container starten

```bash
cd ~/projects/managarten
docker compose -f docker-compose.macmini.yml up -d --no-build
```

### 8. Pruefen ob die vorher crashenden Container laufen

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'synapse|searxng|alertmanager|vmalert|victoria|loki'
```

Alle sollten "Up" und "healthy" zeigen.

### 9. Memory Baseline messen

```bash
./scripts/mac-mini/memory-baseline.sh
```

## Ursache

`colima delete` hat die VM komplett geloescht. Beim Neuerstellen mit
`colima start --mount /Volumes/ManaData:w` wurde nur das externe SSD
gemountet, nicht das Home-Directory `/Users/mana`. Ohne diesen Mount
sieht VirtioFS alle Host-Dateien als leere Verzeichnisse.

## Root Cause Fix (2026-03-30)

Das `startup.sh` Script wurde gefixt:
- `colima delete --force` entfernt (loeschte Mount-Config bei jedem Hard-Shutdown-Recovery)
- `--mount /Users/mana:w` wird jetzt immer bei `colima start` mitgegeben
- Damit tritt das Problem bei kuenftigen Neustarts nicht mehr auf
