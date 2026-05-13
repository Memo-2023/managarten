# BACKUP_STRATEGY — Postgres + Volumes

**Stand 2026-05-13.** Wiederhergestellt und erweitert, nachdem der
LaunchD-Job 3 Monate stillgestanden hat (alter Pfad zeigte auf
`mana-monorepo/`, das nicht mehr existiert).

## Heute: lokales Backup, kein Off-Site

### Was läuft

- **`com.mana.backup-databases`** LaunchD-Job auf mana-server
- **Skript:** `~/projects/managarten/scripts/mac-mini/backup-databases.sh`
- **Schedule:** täglich 03:00 (StartCalendarInterval)
- **Ziel:** `/Volumes/ManaData/backups/postgres/{daily,weekly}/`
- **Retention:** daily 7 Tage, weekly (Sonntag) 4 Wochen

### Was wird gebackupt

Alle Postgres-Container, die `*postgres*` matchen, ausgenommen
`*exporter*` und `mana-infra-postgres-backup`. Stand 2026-05-13:

| Container | User | DB(s) |
|---|---|---|
| `mana-infra-postgres` | `postgres` | mana_platform, mana_sync, mana_admin, memoro (956 MB), forgejo, glitchtip, umami |
| `cards-postgres` | `cards` | cards |
| `manaspur-postgres` | `manaspur` | manaspur |
| `nutriphi-postgres` | `nutriphi` | nutriphi |
| `zitare-postgres` | `zitare` | zitare |
| `chorportal-prod-postgres` | `chorportal` | chorportal |

Dump-Pattern: `${container}_${db}_${date}.sql.gz`.

Total nach erstem Run 2026-05-13: **~45 GB** in `/Volumes/ManaData/backups/postgres`.

### Was NICHT gebackupt wird (heute)

- **MinIO-Objekte** (Cards-Media, mana-media, …) — getrennte Volumes
- **`/Volumes/ManaData/{cards,manaspur,…}/postgres`** auf File-Level —
  pg_dump reicht für DBs, aber Disk-Bitrot würde damit nicht erfasst
- **Cloudflared-Tunnel-Credentials** unter `~/.cloudflared/` (kritisch!)
- **`~/secrets/`** (App-Service-Keys, Master-Keys-Klartexte)

## Off-Site — heute noch nicht aktiv

**Problem:** Mac Mini ist Single-Point-of-Failure. Defekte Disk,
Diebstahl, Brand → alle Backups weg, weil sie auf der **gleichen**
Disk liegen.

**Aufgaben für die Off-Site-Strategie:**

1. **Endpoint wählen:**
   - **Cloudflare R2** (S3-kompatibel, Vereins-tauglich Preis, mana
     hat schon Cloudflare-Account) ← Empfehlung
   - **Hetzner Storage Box** (günstig, EU-Hoster, Verein-Datenschutz-
     konform)
   - **Wasabi / Backblaze B2** (günstig, US-Anbieter, DSGVO-fragwürdig)
   - **eigener mana-server-2** (privater Off-Site-Mini, max Kontrolle)

2. **Tool wählen:**
   - **rclone** (Multi-Provider, läuft auf macOS) ← Empfehlung
   - **restic** (Encryption + Dedup eingebaut, S3-fähig)
   - **borg** (klassisch, Repo-orientiert)

3. **Encryption:** Daten verlassen den Mac Mini — ohne Encryption-at-
   transit-AND-at-rest verletzen wir die Vereins-Werte (Memoro/Cards/
   Manaspur enthalten User-Inhalte). Empfehlung: **rclone crypt** als
   Wrapper, Key in `~/secrets/` und Off-Site-Recovery-Code im
   `secret_offsite_backup_key`-Memory.

### Vorgeschlagener Aufbau (zu implementieren)

```bash
# rclone-Config mit verschlüsseltem Remote:
rclone config create r2-raw s3 provider Cloudflare \
    access_key_id <KEY> secret_access_key <SECRET> \
    endpoint <ACCOUNT>.r2.cloudflarestorage.com

rclone config create r2-encrypted crypt remote r2-raw:mana-backups \
    password <RANDOM> password2 <RANDOM2>
```

LaunchD-Job nach `backup-databases.sh`:

```bash
# scripts/mac-mini/backup-sync-offsite.sh
rclone sync /Volumes/ManaData/backups/postgres r2-encrypted:postgres \
    --transfers 4 --checkers 8 --log-file /tmp/mana-backup-offsite.log
```

Cron alle 6h, separate plist `com.mana.backup-offsite.plist`.

### Pre-Live-Gate für mana-Plattform

Bevor manaspur-Endurance-User-Daten landen (siehe `manaspur-native/docs/ENDURANCE_TEST.md`):

- [x] Local-Backup-Job wieder aktiv (2026-05-13)
- [ ] Off-Site-Endpoint provisioniert (R2-Bucket o. ä.)
- [ ] rclone + Encryption-Setup
- [ ] LaunchD-Job für Off-Site-Sync alle 6h
- [ ] Recovery-Probe: zufällige Daily-Backup-Datei herunterladen +
      entschlüsseln + pg_restore-Trockenlauf gegen Test-DB

## Recovery-Drill (Test, dass Backups wiederherstellbar sind)

Pro Quartal:

```bash
# Beispiel: cards-postgres aus Backup wiederherstellen
ssh mana-server
docker run --rm -d --name cards-postgres-restore-test \
    -e POSTGRES_PASSWORD=test -e POSTGRES_USER=cards -e POSTGRES_DB=cards \
    postgres:16-alpine

gunzip -c /Volumes/ManaData/backups/postgres/daily/cards-postgres_cards_2026-05-13.sql.gz \
    | docker exec -i cards-postgres-restore-test psql -U cards -d cards

# Probe-Query
docker exec cards-postgres-restore-test psql -U cards -d cards \
    -c "SELECT count(*) FROM cards.decks;"

docker stop cards-postgres-restore-test
```

## Cross-Refs

- `secret_offsite_backup_key.md` (Memory, kommt mit Off-Site-Setup)
- `mana/docs/PLAN.md` § Backup-Strategy
- `scripts/mac-mini/backup-databases.sh` — der eigentliche Code
- `~/Library/LaunchAgents/com.mana.backup-databases.plist` — LaunchD-Job
