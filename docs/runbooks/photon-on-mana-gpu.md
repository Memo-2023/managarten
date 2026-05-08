# Runbook — Self-host Photon on mana-gpu

**Goal:** install WSL2 + Docker Desktop on the Windows GPU server, run a self-hosted Photon (Europe-wide), and cut the geocoding wrapper over to it as the primary `privacy: 'local'` provider.

**Estimated time:** 3–4 h, ~1 h of which is unattended download/unpack.

**Prerequisites:**
- Physical access to mana-gpu (Hyper-V install requires reboot)
- Admin account
- 100 GB free on a fast SSD (current state: **739 GB free on C:**, ✓)
- Decent download speed (Europe tarball is ~30 GB)

**Pre-checked state (2026-04-28):**
- Windows 11 Pro Build 26200 — fully WSL2-ready, no upgrade needed
- 64 GB RAM, 56 GB free
- WSL2: not installed
- Docker Desktop: not installed
- No native CUDA / Ollama / STT / TTS Windows services detected (so Hyper-V activation should not disrupt anything currently running)
- LAN-only — Cloudflare tunnel terminates on the Mac mini, the GPU server is only reachable from the home LAN

---

## Phase 1 — WSL2 + Docker Desktop (~1.5 h, requires physical access)

### 1.1 Enable Windows features (5 min, requires reboot)

Open **PowerShell as Administrator** and run:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Then **reboot**:

```powershell
Restart-Computer
```

### 1.2 Install WSL2 + Ubuntu (10 min)

After reboot, in elevated PowerShell:

```powershell
wsl --install --no-distribution
wsl --set-default-version 2
wsl --install -d Ubuntu-24.04
```

When the Ubuntu setup prompt appears, create a user (e.g. `mana`). Verify:

```powershell
wsl --list --verbose
# Should show Ubuntu-24.04, VERSION 2, STATE Running
```

### 1.3 Install Docker Desktop (15 min)

Download installer:

```powershell
$dl = "$env:TEMP\DockerDesktopInstaller.exe"
Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -OutFile $dl
Start-Process -FilePath $dl -ArgumentList "install","--quiet","--accept-license","--backend=wsl-2" -Wait
```

Then **log out and back in** (or reboot). Launch Docker Desktop from the Start Menu, accept the license, **uncheck** "Send usage statistics" if you care.

In Settings → Resources → WSL Integration: ensure Ubuntu-24.04 is enabled.

Verify from PowerShell:

```powershell
docker --version
docker run --rm hello-world
```

If `docker run` works, Phase 1 is done.

### 1.4 GPU services sanity check (5 min)

If you have any natively-running ML services (Ollama, image-gen, …), verify they still work after the Hyper-V activation. If something broke, the most common fix is to make sure Docker Desktop is running with **WSL2 backend** (not Hyper-V backend) — they coexist with CUDA pass-through more smoothly.

---

## Phase 2 — Photon container (~45 min, ~30 min of which is download)

### 2.1 Create data directory + download index (30 min)

In **PowerShell** (does not need to be admin):

```powershell
mkdir D:\photon-data -Force
cd D:\photon-data

# ~30 GB compressed; takes 5–30 min depending on your link
Invoke-WebRequest `
  -Uri "https://download1.graphhopper.com/public/europe/photon-db-europe-1.0-latest.tar.bz2" `
  -OutFile "photon-db-europe-1.0-latest.tar.bz2"
```

If you'd rather start with Germany-only (5.8 GB, faster), use:

```powershell
Invoke-WebRequest `
  -Uri "https://download1.graphhopper.com/public/europe/germany/photon-db-germany-1.0-latest.tar.bz2" `
  -OutFile "photon-db-germany-1.0-latest.tar.bz2"
```

Unpack:

```powershell
# Unpacks into D:\photon-data\photon_data\
tar -xjf photon-db-europe-1.0-latest.tar.bz2
```

Verify the structure — you should see `D:\photon-data\photon_data\` with subdirectories.

### 2.2 Run Photon container (5 min)

```powershell
docker run -d `
  --name photon `
  --restart unless-stopped `
  -p 2322:2322 `
  -v D:\photon-data\photon_data:/photon/photon_data `
  -e JAVA_OPTS="-Xmx6g -Xms2g" `
  komoot/photon
```

**Heap notes:**
- `-Xmx6g` (6 GB max heap) is comfortable for Europe; bump to 8g if you see GC churn
- `-Xms2g` (2 GB initial heap) avoids cold-start expansion latency

Check it boots cleanly:

```powershell
docker logs -f photon
# Wait until you see lines like: "started Photon" / "OpenSearch ready"
# Press Ctrl+C to stop following
```

Smoke from the GPU server itself:

```powershell
curl "http://localhost:2322/api?q=Konstanz&limit=2"
# Expect a GeoJSON FeatureCollection with at least one feature
```

### 2.3 Open the firewall (2 min)

The Mac mini needs to reach Photon on port 2322 from the LAN:

```powershell
New-NetFirewallRule `
  -DisplayName "Photon (mana-geocoding)" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 2322 `
  -Action Allow `
  -Profile Private `
  -RemoteAddress 192.168.178.0/24
```

(`-Profile Private` because the network is the home LAN, not Public. Adjust if your network categorisation is different — `Get-NetConnectionProfile` shows it.)

Verify from the **Mac mini**:

```bash
ssh mana-server 'curl -fsS http://192.168.178.11:2322/api?q=Konstanz | head -c 200'
```

Should return a Photon GeoJSON response.

---

## Phase 3 — Wrapper cutover (already prepared in code, ~15 min to deploy)

The wrapper code already supports a `photon-self` provider — we just need to set the env-var and recreate the container.

### 3.1 Add to `.env.macmini` on mana-server

```bash
ssh mana-server
nano ~/projects/managarten/.env.macmini
```

Add at the bottom:

```env
PHOTON_SELF_API_URL=http://192.168.178.11:2322
```

Optionally tighten the chain to drop public Nominatim (saving one redundant fallback):

```env
GEOCODING_PROVIDERS=photon-self,photon
```

(Default order without this env-var is `photon-self,pelias,photon,nominatim`. `pelias` is silently skipped because the Pelias container is stopped. Setting `GEOCODING_PROVIDERS=photon-self,photon` is more explicit but not required.)

### 3.2 Recreate mana-geocoding container

```bash
cd ~/projects/managarten
docker compose -f docker-compose.macmini.yml --env-file .env.macmini up -d mana-geocoding
```

### 3.3 Verify

```bash
# Should now list photon-self as healthy
docker exec mana-geocoding bun -e 'fetch("http://127.0.0.1:3018/health/providers").then(r=>r.text()).then(console.log)'

# Sensitive query should now return REAL results (was empty before cutover)
docker exec mana-geocoding bun -e 'fetch("http://127.0.0.1:3018/api/v1/geocode/search?q=Hausarzt+Konstanz&limit=2").then(r=>r.text()).then(t=>console.log(t.substring(0,400)))'

# Normal query should be served by photon-self (provider:"photon-self", no notice field)
docker exec mana-geocoding bun -e 'fetch("http://127.0.0.1:3018/api/v1/geocode/search?q=Konstanz&limit=1").then(r=>r.text()).then(t=>console.log(t.substring(0,400)))'
```

Look for:
- `"healthy":true` for `photon-self`
- `"provider":"photon-self"` on the result objects
- No `"notice":"fallback_used"` (the only notice should appear if photon-self is somehow down)

### 3.4 Tail the logs for 5 minutes

```bash
docker logs -f --since 1m mana-geocoding
```

Watch for:
- `[geocoding-chain] photon-self failed` warnings (means cross-LAN issue — debug from there)
- Steady stream of normal `200`s from real user traffic (no warnings)

---

## Phase 4 — Cleanup (10 min)

### 4.1 Remove the Pelias stack from the Mac mini

```bash
cd ~/projects/managarten/services/mana-geocoding/pelias
docker compose down -v
# `-v` deletes the volumes too — frees ~5 GB disk
```

If you want to keep Pelias around as a "break glass" option, omit the `-v` and just leave the stack stopped (which is the current state).

### 4.2 Update CLAUDE.md

`services/mana-geocoding/CLAUDE.md` should reflect the new topology:
- Self-hosted Photon on `mana-gpu` is the primary, `privacy: 'local'`
- Public Photon stays as last-resort `privacy: 'public'` fallback
- Pelias is retired

### 4.3 Update memory if you keep one

The `memory/project_*.md` notes should reflect: Pelias retired 2026-04-28, Photon migrated to mana-gpu on $DATE.

---

## Phase 5 — Weekly maintenance (10 min/week, optional automation)

GraphHopper publishes a fresh tarball every week. Manual refresh:

```powershell
cd D:\photon-data
docker stop photon
Invoke-WebRequest -Uri "https://download1.graphhopper.com/public/europe/photon-db-europe-1.0-latest.tar.bz2" -OutFile "photon-db-new.tar.bz2"
mv photon_data photon_data.old
tar -xjf photon-db-new.tar.bz2
docker start photon
# After a smoke-test:
rm -r photon_data.old
rm photon-db-new.tar.bz2
```

For full automation, schedule the above as a Windows Task Scheduler weekly job. Not urgent — the OSM data being a week stale is fine for our use case.

---

## Rollback

If something goes wrong at any step, the rollback is unceremonious:

1. Remove the env-var: `unset PHOTON_SELF_API_URL` in `.env.macmini`
2. Recreate the container: `docker compose ... up -d mana-geocoding`
3. The chain falls back to public Photon + Nominatim — **same state as right now**

The wrapper code is fully backward-compatible: `photon-self` registration is opt-in via the env-var alone, no schema migrations, no data dependencies.

---

## Open questions for you

1. **Europe vs Germany only:** Europe is 30 GB compressed → 80 GB unpacked, 6–8 GB heap. Germany is 5.8 GB compressed → 15 GB unpacked, 2–4 GB heap. We recommended Europe; both work. Pick based on whether you ever want to geocode Spanish or Italian addresses.
2. **Cleanup of public providers from chain:** do you want public Photon + Nominatim to stay as last-resort fallbacks (current behavior), or drop them entirely once self-hosted is up? Keeping them costs nothing if self-hosted is healthy.
3. **Nightly Photon restart:** OpenSearch occasionally fragments its memory. A weekly restart (or a `docker restart photon` after the data refresh) keeps things tidy. Not urgent.
