# Windows GPU-Server: Lokale Einrichtung

Diese Anleitung wird **am Windows-PC selbst** durchgeführt.
Ziel: SSH + Grundkonfiguration, damit der Rechner remote steuerbar ist.

Danach kann alles Weitere (Ollama, AI-Services, Cloudflare Tunnel) per SSH erledigt werden.

## Hardware (Stand 2026-05-06)

| | |
|---|---|
| Hostname | `mana-server-gpu` |
| LAN-IP | `192.168.178.11` |
| OS | Windows 10 Pro (Build 2009), 64-bit |
| CPU | AMD Ryzen 9 **5950X** — 16 Cores / 32 Threads, 3.4 GHz Base |
| RAM | **64 GB** DDR4-3200 (2× 32 GB Kingston, Dual-Channel, DIMM_A2 + DIMM_B2) |
| GPU | NVIDIA **RTX 3090** — 24 GB VRAM, Treiber 591.86 |
| Disk C: | ~930 GB total, ~660 GB frei |
| Mainboard / PSU | (nicht remote auslesbar — bei Vor-Ort-Wartung ergänzen) |

### Zusatz-Workloads neben den AI-Services

Seit 2026-05-06 läuft auf der Box zusätzlich ein **WSL2-Docker-Stack** für
nicht-zeitkritische Hilfsdienste (Monitoring, Forgejo, Glitchtip, Umami) —
siehe [`PLAN_OPTION_C.md`](./PLAN_OPTION_C.md). WSL2 ist auf 24 GB RAM /
12 vCPUs / 8 GB Swap begrenzt (`C:\Users\tills\.wslconfig`), sodass die
AI-Scheduled-Tasks bei 64 GB Host-RAM > 30 GB Reserve behalten.

Bestand 2026-05-06: ein **Photon-Geocoder** (eclipse-temurin Java, Port 2322)
läuft unter Docker in WSL2 als Backend für `mana-geocoding` auf dem Mac Mini.

---

## Checkliste: Nach jedem Neustart

> **Wichtig:** Bis der Server-Modus (Schritt 9) vollständig konfiguriert ist, können nach einem Neustart einige Dinge manuell geprüft/repariert werden müssen.

PowerShell **als Administrator** ausführen:

```powershell
# 1. Netzwerkprofil auf "Privat" setzen
#    (Windows setzt es nach Neustart manchmal auf "Öffentlich" zurück,
#     was die Firewall verschärft und SSH/Ping blockt)
Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private

# 2. SSH-Dienst prüfen (muss "Running" sein)
Get-Service sshd
# Falls "Stopped": Start-Service sshd

# 3. AI-Services prüfen
python C:\mana\status.py
# Falls Services nicht laufen:
Start-ScheduledTask -TaskName "ManaLLM"
Start-ScheduledTask -TaskName "ManaSTT"
Start-ScheduledTask -TaskName "ManaTTS"
Start-ScheduledTask -TaskName "ManaImageGen"
Start-ScheduledTask -TaskName "ManaVideoGen"
```

Wenn Schritt 9 (Server-Modus) korrekt konfiguriert ist, sollte der PC:
- Nie in den Ruhezustand gehen
- Nach Neustart automatisch einloggen
- Alle Services automatisch starten (Scheduled Tasks mit AtLogOn)
- Netzwerkprofil dauerhaft auf "Privat" stehen

### Netzwerkprofil dauerhaft auf "Privat" fixieren

Damit das Netzwerk nach Neustart nicht wieder auf "Öffentlich" springt:

```powershell
# Variante 1: Per Registry (empfohlen)
# Erst die aktuelle Netzwerk-ID herausfinden:
Get-NetConnectionProfile

# Dann in der Registry fixieren (ProfileType: 1=Privat, 0=Öffentlich):
$profiles = Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles"
foreach ($profile in $profiles) {
    Set-ItemProperty -Path $profile.PSPath -Name Category -Value 1
}
```

---

## Erstinstallation

### Schritt 1: Computername setzen

PowerShell **als Administrator** öffnen (Rechtsklick → Als Administrator ausführen):

```powershell
Rename-Computer -NewName "mana-server-gpu"
```

Noch **nicht** neu starten — erst alle Schritte durchgehen.

---

## Schritt 2: SSH-Server aktivieren

Gleiche Admin-PowerShell:

```powershell
# SSH-Server installieren
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# SSH-Server starten
Start-Service sshd

# Automatisch bei jedem Start
Set-Service -Name sshd -StartupType Automatic

# Standard-Shell auf PowerShell setzen (statt cmd)
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force
```

---

## Schritt 3: Statische IP vergeben

1. **Einstellungen** → **Netzwerk und Internet** → **Ethernet**
2. Bei der aktiven Verbindung auf **Bearbeiten** klicken (bei IP-Zuweisung)
3. Auf **Manuell** umstellen, **IPv4** aktivieren:

```
IP-Adresse:      192.168.178.11
Subnetzmaske:    255.255.255.0
Gateway:         192.168.178.1
Bevorzugter DNS: 192.168.178.1
Alternativer DNS: 1.1.1.1
```

> Mac Mini ist auf `192.168.178.131`, Gateway ist `192.168.178.1`.

---

## Schritt 4: Firewall-Ports öffnen

Gleiche Admin-PowerShell:

```powershell
# SSH (sollte schon offen sein, sicherheitshalber)
New-NetFirewallRule -DisplayName "SSH" -Direction Inbound -LocalPort 22 -Protocol TCP -Action Allow

# Ollama
New-NetFirewallRule -DisplayName "Ollama" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow

# AI-Services
New-NetFirewallRule -DisplayName "Mana-STT" -Direction Inbound -LocalPort 3020 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Mana-TTS" -Direction Inbound -LocalPort 3022 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Mana-Image-Gen" -Direction Inbound -LocalPort 3023 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Mana-LLM" -Direction Inbound -LocalPort 3025 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Mana-Video-Gen" -Direction Inbound -LocalPort 3026 -Protocol TCP -Action Allow
```

---

## Schritt 5: NVIDIA-Treiber prüfen

```powershell
nvidia-smi
```

Falls der Befehl nicht gefunden wird oder der Treiber alt ist (< 535.x):
1. https://www.nvidia.com/Download/index.aspx → neusten Treiber für deine GPU laden
2. Installieren, neu starten

Falls `nvidia-smi` funktioniert → Treiberversion und GPU-Name notieren.

---

## Schritt 6: Python 3.11 installieren

```powershell
winget install Python.Python.3.11
```

Falls `winget` nicht verfügbar: https://www.python.org/downloads/ → 3.11.x

> **Wichtig:** Bei der Installation "Add Python to PATH" ankreuzen!

Prüfen:

```powershell
python --version
```

---

## Schritt 7: Git installieren

```powershell
winget install Git.Git
```

Prüfen (neue PowerShell öffnen):

```powershell
git --version
```

---

## Schritt 8: Arbeitsverzeichnis anlegen

```powershell
mkdir C:\mana
mkdir C:\mana\services
mkdir C:\mana\venvs
mkdir C:\mana\models
```

---

## Schritt 9: Server-Modus konfigurieren (Always-On)

Windows ist standardmäßig als Desktop-PC konfiguriert und geht in den Ruhezustand — das führt dazu, dass SSH und alle AI-Services nicht mehr erreichbar sind. Für den Server-Betrieb muss das komplett deaktiviert werden.

PowerShell **als Administrator**:

```powershell
# ============================================
# 1. Energiesparplan auf "Höchstleistung" setzen
# ============================================
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c

# ============================================
# 2. Ruhezustand komplett deaktivieren
# ============================================
powercfg /hibernate off

# Standby deaktivieren (Netzbetrieb)
powercfg /change standby-timeout-ac 0
# Bildschirm-Timeout (optional: 0 = nie, oder 30 = 30 Min)
powercfg /change monitor-timeout-ac 30
# Festplatten-Timeout deaktivieren
powercfg /change disk-timeout-ac 0

# ============================================
# 3. Netzwerkadapter darf NICHT in Energiesparmodus
# ============================================
# Alle Netzwerkadapter: Energiesparen deaktivieren
Get-NetAdapter -Physical | ForEach-Object {
    $name = $_.Name
    # Disable "Allow the computer to turn off this device to save power"
    $adapter = Get-WmiObject -Class Win32_NetworkAdapter | Where-Object { $_.NetConnectionID -eq $name }
    if ($adapter) {
        $deviceID = $adapter.PNPDeviceID
        $key = "HKLM:\SYSTEM\CurrentControlSet\Enum\$deviceID\Device Parameters\WDF"
        # Setze PnPCapabilities = 24 (disable power management)
        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$deviceID"
        if (Test-Path "$regPath\Device Parameters") {
            # Alternative: über Geräte-Manager manuell deaktivieren
            Write-Host "Bitte im Geräte-Manager für '$name' Energiesparen manuell deaktivieren"
        }
    }
}

# ============================================
# 4. USB-Energiesparen deaktivieren (für Peripherie)
# ============================================
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /setactive SCHEME_CURRENT

# ============================================
# 5. Schnellstart deaktivieren (verursacht Probleme mit SSH nach Neustart)
# ============================================
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f

# ============================================
# 6. Automatischen Neustart nach Windows Update verhindern
# ============================================
# Aktive Stunden auf Maximum setzen (verhindert Neustarts tagsüber)
reg add "HKLM\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" /v ActiveHoursStart /t REG_DWORD /d 6 /f
reg add "HKLM\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" /v ActiveHoursEnd /t REG_DWORD /d 2 /f

# ============================================
# 7. Auto-Login nach Neustart (für Scheduled Tasks)
# ============================================
# WICHTIG: Scheduled Tasks mit "AtLogOn" brauchen eine aktive Sitzung.
# Nach einem Neustart muss der User automatisch eingeloggt werden.
# Über GUI: netplwiz → Haken bei "Benutzer müssen Benutzernamen und Kennwort eingeben" entfernen
# Oder per Registry (Passwort wird hier im Klartext gespeichert!):
# reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoAdminLogon /t REG_SZ /d 1 /f
# reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultUserName /t REG_SZ /d "tills" /f
# reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultPassword /t REG_SZ /d "DEIN_PASSWORT" /f
```

### Manuell im Geräte-Manager prüfen

1. **Geräte-Manager** öffnen → **Netzwerkadapter** → Rechtsklick auf den Ethernet-Adapter
2. **Eigenschaften** → **Energieverwaltung**
3. Haken bei **"Computer kann das Gerät ausschalten, um Energie zu sparen"** entfernen

### Energiesparplan verifizieren

```powershell
# Aktiven Energiesparplan anzeigen
powercfg /getactivescheme
# Sollte "Höchstleistung" zeigen

# Alle Einstellungen prüfen
powercfg /query
```

---

## Schritt 10: Neustart

```powershell
Restart-Computer
```

Nach dem Neustart sollte der PC automatisch einloggen (falls Auto-Login konfiguriert) und die Energiespareinstellungen aktiv sein.

---

## Schritt 11: SSH-Key einrichten (passwortloser Zugriff)

Auf dem **Windows-PC** in PowerShell **als Administrator** ausführen:

```powershell
# Für Admin-User muss der Key in die systemweite Datei:
"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAmtp92RmE6lPhHRg24VSYIvq9ne4+qe61SiR4c+lPWu claude-code@mana" | Out-File -Encoding utf8 -FilePath C:\ProgramData\ssh\administrators_authorized_keys

# Berechtigungen setzen (Windows erfordert das für SSH)
# Vererbung entfernen
icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r

# Berechtigungen setzen (NT AUTHORITY\SYSTEM funktioniert auf allen Sprachen)
icacls C:\ProgramData\ssh\administrators_authorized_keys /grant "NT AUTHORITY\SYSTEM:(R)"

# Admin-Gruppe: Name hängt von der Systemsprache ab, SID ist immer gleich
$adminGroup = (New-Object System.Security.Principal.SecurityIdentifier("S-1-5-32-544")).Translate([System.Security.Principal.NTAccount]).Value
icacls C:\ProgramData\ssh\administrators_authorized_keys /grant "${adminGroup}:(R)"
```

> **Warum nicht `~/.ssh/authorized_keys`?** Windows OpenSSH ignoriert diese Datei für Benutzer in der Administratoren-Gruppe. Stattdessen wird `C:\ProgramData\ssh\administrators_authorized_keys` gelesen.

---

## Schritt 12: SSH testen

**Vom Mac (dev-Rechner)** aus testen:

```bash
ssh tills@192.168.178.11
```

Beim ersten Mal Fingerprint bestätigen mit `yes`.

Falls erfolgreich, sollte eine PowerShell-Sitzung starten.

### Zusätzlich testen:

```bash
# GPU erreichbar?
ssh tills@192.168.178.11 "nvidia-smi"

# Python da?
ssh tills@192.168.178.11 "python --version"
```

---

## Ergebnis

Nach diesen Schritten hat der Windows-PC:

- [x] Fester Computername (`mana-server-gpu`)
- [x] SSH-Server (Port 22, Autostart)
- [x] Statische IP im LAN
- [x] Firewall-Ports offen für alle AI-Services
- [x] NVIDIA-Treiber mit CUDA-Support
- [x] Python 3.11
- [x] Git
- [x] Arbeitsverzeichnis `C:\mana\`
- [x] Server-Modus: Kein Ruhezustand, kein Standby, Höchstleistung
- [x] Auto-Login nach Neustart (für Scheduled Tasks)
- [x] Schnellstart deaktiviert (sauberer SSH-Boot)

**Alles Weitere (Ollama, AI-Services, Cloudflare Tunnel) wird dann per SSH gemacht.**

---

## AI-Services Einrichtung (per SSH)

Nach der Grundinstallation wurden folgende AI-Services eingerichtet:

### Ollama (LLM Inference)

- **Port**: 11434
- **Host-Binding**: `0.0.0.0` (LAN-Zugriff via `OLLAMA_HOST` System-Umgebungsvariable)
- **Installierte Modelle**:
  - `gemma3:4b` (3.3 GB) - Schnelles Chat-Modell
  - `gemma3:12b` (8.1 GB) - Bessere Qualität
  - `qwen2.5-coder:14b` (9.0 GB) - Code-Generierung
  - `nomic-embed-text` - Embedding-Modell

Ollama startet automatisch beim Login (System Tray).

### mana-llm (Port 3025)

Zentraler LLM-Gateway mit OpenAI-kompatiblem API. Routet Anfragen an Ollama und Cloud-Provider.

- **Verzeichnis**: `C:\mana\services\mana-llm\`
- **venv**: `C:\mana\venvs\llm\`
- **Config**: `C:\mana\services\mana-llm\.env`
- **Log**: `C:\mana\services\mana-llm\service.log`
- **Autostart**: Windows Scheduled Task "ManaLLM" (AtLogOn)

### mana-stt (Port 3020)

Speech-to-Text mit faster-whisper (CUDA-beschleunigt auf RTX 3090).

- **Verzeichnis**: `C:\mana\services\mana-stt\`
- **venv**: `C:\mana\venvs\stt\`
- **Config**: `C:\mana\services\mana-stt\.env`
- **Log**: `C:\mana\services\mana-stt\service.log`
- **Autostart**: Windows Scheduled Task "ManaSTT" (AtLogOn)
- **Backend**: `faster-whisper` mit CTranslate2 (CUDA float16)
- **Default-Modell**: `large-v3-turbo` (~1.6 GB, wird beim ersten Request geladen)

### mana-tts (Port 3022)

Text-to-Speech mit mehreren Backends:

- **Verzeichnis**: `C:\mana\services\mana-tts\`
- **venv**: `C:\mana\venvs\tts\` (PyTorch 2.5.1+cu121)
- **Config**: `C:\mana\services\mana-tts\.env`
- **Log**: `C:\mana\services\mana-tts\service.log`
- **Autostart**: Windows Scheduled Task "ManaTTS" (AtLogOn)
- **Backends**:
  - **Kokoro** (82M, CUDA) — Englische Stimmen, ~1s Latenz, 27 Stimmen
  - **Edge TTS** (Cloud) — Deutsche Stimmen (Katja, Conrad, etc.), ~2s Latenz
  - **Piper** (CPU/ONNX) — Lokale deutsche Stimmen (Thorsten, Kerstin), schnell
  - **F5-TTS** (CUDA) — Voice Cloning mit Referenz-Audio

### mana-image-gen (Port 3023)

Bildgenerierung mit FLUX.1-schnell (12B Parameter) via HuggingFace diffusers.

- **Verzeichnis**: `C:\mana\services\mana-image-gen\`
- **Repo-Pendant**: [`services/mana-image-gen/`](../services/mana-image-gen/) — `service.pyw`, `app/main.py`, `app/flux_service.py`, `app/api_auth.py`, `app/vram_manager.py`
- **venv**: `C:\mana\venvs\image-gen\` (PyTorch 2.5.1+cu121)
- **Config**: `C:\mana\services\mana-image-gen\.env` (siehe `services/mana-image-gen/.env.example`)
- **Log**: `C:\mana\services\mana-image-gen\service.log`
- **Autostart**: Windows Scheduled Task "ManaImageGen" (AtLogOn)
- **Modell**: FLUX.1-schnell (Apache 2.0, 4-bit quantisiert via BitsAndBytes)
- **HuggingFace**: Erfordert Login + Lizenzakzeptanz für gated Model

### mana-video-gen (Port 3026)

Videogenerierung mit LTX-Video (~2B Parameter) via HuggingFace diffusers + CUDA.

- **Verzeichnis**: `C:\mana\services\mana-video-gen\`
- **Repo-Pendant**: [`services/mana-video-gen/`](../services/mana-video-gen/) — `service.pyw`, `app/main.py`, `app/ltx_service.py`, `setup.sh`, `requirements.txt`
- **venv**: `C:\mana\venvs\video-gen\` (PyTorch + CUDA + diffusers)
- **Config**: `C:\mana\services\mana-video-gen\.env`
- **Log**: `C:\mana\services\mana-video-gen\service.log`
- **Autostart**: Windows Scheduled Task "ManaVideoGen" (AtLogOn)
- **Modell**: LTX-Video (Lightricks)
- **HuggingFace**: HF_TOKEN erforderlich für Model-Download

### Repo-Pendants der anderen GPU-Services

| Windows-Pfad | Repo-Pfad |
|---|---|
| `C:\mana\services\mana-llm\` | [`services/mana-llm/`](../services/mana-llm/) |
| `C:\mana\services\mana-stt\` | [`services/mana-stt/`](../services/mana-stt/) |
| `C:\mana\services\mana-tts\` | [`services/mana-tts/`](../services/mana-tts/) |

Jeder Service hat im Repo eine `service.pyw` Datei — das ist der Runner, den die Scheduled Tasks aufrufen. Änderungen an einem Service sollten primär im Repo gemacht und dann auf die Windows-Box gespiegelt werden, nicht andersrum.

### Management-Skripte

```powershell
# Status aller Services anzeigen
python C:\mana\status.py

# Alle Services starten (falls nicht via Scheduled Task)
python C:\mana\start-all.py

# Alle Services stoppen
python C:\mana\stop-all.py

# Scheduled Tasks manuell starten/stoppen
Start-ScheduledTask -TaskName "ManaLLM"
Start-ScheduledTask -TaskName "ManaSTT"
Start-ScheduledTask -TaskName "ManaTTS"
Start-ScheduledTask -TaskName "ManaImageGen"
Start-ScheduledTask -TaskName "ManaVideoGen"

# Alle Scheduled Tasks auf einmal anzeigen
Get-ScheduledTask -TaskName "Mana*" | Format-Table TaskName, State
```

### Zugriff: Öffentliche URLs (von überall)

Die GPU-Services sind über den Cloudflare Tunnel des Mac Mini öffentlich erreichbar.
Auf dem Mac Mini läuft ein TCP-Proxy (`~/gpu-proxy.py` als LaunchAgent), der den Traffic
an den GPU-Server im LAN weiterleitet.

```
Internet → Cloudflare → Mac Mini (gpu-proxy.py) → GPU Server (LAN)
```

| Service | Öffentliche URL |
|---------|----------------|
| mana-llm | `https://gpu-llm.mana.how` |
| mana-stt | `https://gpu-stt.mana.how` |
| mana-tts | `https://gpu-tts.mana.how` |
| mana-image-gen | `https://gpu-img.mana.how` |
| mana-video-gen | `https://gpu-video.mana.how` |
| Ollama | `https://gpu-ollama.mana.how` |

```bash
# LLM API
curl https://gpu-llm.mana.how/health
curl -X POST https://gpu-llm.mana.how/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"ollama/gemma3:12b","messages":[{"role":"user","content":"Hallo"}]}'

# STT API (WhisperX mit Word-Timestamps + Speaker Diarization)
curl https://gpu-stt.mana.how/health
curl -X POST https://gpu-stt.mana.how/transcribe \
  -F "file=@recording.wav" -F "language=de" -F "align=true" -F "diarize=true"

# TTS API
curl https://gpu-tts.mana.how/health
curl -X POST https://gpu-tts.mana.how/synthesize/auto \
  -H "Content-Type: application/json" \
  -d '{"text":"Hallo Welt","voice":"de_katja"}' --output hello.wav

# Image Generation (FLUX.2 klein 4B)
curl -X POST https://gpu-img.mana.how/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A cat","width":1024,"height":1024}'

# Video Generation (LTX-Video)
curl https://gpu-video.mana.how/health
curl -X POST https://gpu-video.mana.how/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Ocean waves crashing on rocks","width":704,"height":480}'

# Ollama direkt
curl https://gpu-ollama.mana.how/api/tags
```

### Zugriff: LAN (direkt, schneller)

Vom Mac Mini oder anderen Geräten im gleichen Netzwerk:

```bash
curl http://192.168.178.11:3025/health   # mana-llm
curl http://192.168.178.11:3020/health   # mana-stt
curl http://192.168.178.11:3022/health   # mana-tts
curl http://192.168.178.11:3023/health   # mana-image-gen
curl http://192.168.178.11:3026/health   # mana-video-gen
curl http://192.168.178.11:11434/api/tags # Ollama
```

### Verzeichnisstruktur

```
C:\mana\
├── services\
│   ├── mana-llm\            # LLM Gateway Service (Port 3025)
│   │   ├── src\              # Python-Quellcode (FastAPI + Provider Router)
│   │   ├── .env              # Konfiguration
│   │   ├── service.pyw       # Service Runner
│   │   └── service.log       # Log
│   ├── mana-stt\             # Speech-to-Text Service (Port 3020)
│   │   ├── app\              # Python-Quellcode (faster-whisper CUDA)
│   │   ├── .env
│   │   ├── service.pyw
│   │   └── service.log
│   ├── mana-tts\             # Text-to-Speech Service (Port 3022)
│   │   ├── app\              # Python-Quellcode (Kokoro + Edge TTS + Piper)
│   │   ├── .env
│   │   ├── service.pyw
│   │   └── service.log
│   └── mana-image-gen\       # Bildgenerierung (Port 3023)
│       ├── app\              # Python-Quellcode (diffusers + FLUX)
│       ├── output\           # Generierte Bilder (temporär)
│       ├── .env
│       ├── service.pyw
│       └── service.log
├── venvs\
│   ├── llm\                  # Python venv für mana-llm
│   ├── stt\                  # Python venv für mana-stt (faster-whisper)
│   ├── tts\                  # Python venv für mana-tts (PyTorch+CUDA)
│   └── image-gen\            # Python venv für mana-image-gen (PyTorch+CUDA+diffusers)
├── models\                   # (reserviert für lokale Modelle)
├── start-all.py              # Alle Services starten
├── stop-all.py               # Alle Services stoppen
├── status.py                 # Status-Übersicht
├── healthcheck.py            # Health Check + Auto-Restart (alle 5 Min)
├── healthcheck.log           # Health Check Log
├── log-rotate.py             # Log-Rotation (>10MB → .log.1/.2/.3)
├── log-shipper.py            # Logs an Loki auf Mac Mini senden
└── log-shipper-state.json    # Letzte Leseposition pro Log
```

---

## Health Check & Auto-Restart

Ein Health-Check-Skript prüft alle 5 Minuten ob die Services laufen und startet gefallene neu.
Zusätzlich werden Log-Rotation und Log-Shipping (an Loki) ausgeführt.

- **Skript**: `C:\mana\healthcheck.py`
- **Log**: `C:\mana\healthcheck.log`
- **Scheduled Task**: `ManaHealthCheck` (alle 5 Min)
- **Ausführungsreihenfolge**: Health Check → Log-Rotation → Log-Shipping

```powershell
# Manuell ausführen
python C:\mana\healthcheck.py

# Log ansehen
Get-Content C:\mana\healthcheck.log -Tail 20
```

### Log-Rotation

- **Skript**: `C:\mana\log-rotate.py`
- **Trigger**: Wird vom Health-Check alle 5 Min aufgerufen
- **Schwelle**: Rotiert ab 10 MB
- **Backups**: 3 Kopien (service.log.1, .2, .3)

### Monitoring & Logs (Loki + Grafana)

GPU-Service-Logs werden alle 5 Minuten an **Loki** auf dem Mac Mini geschickt und sind über **Grafana** durchsuchbar.

```
GPU Server (healthcheck.py → log-shipper.py)
    → HTTP POST → Mac Mini (Loki :3100)
                     → Grafana (grafana.mana.how)
```

**Komponenten:**

| Komponente | Wo | Beschreibung |
|---|---|---|
| `C:\mana\log-shipper.py` | GPU Server | Liest service.log Dateien, pusht neue Zeilen an Loki |
| `C:\mana\log-shipper-state.json` | GPU Server | Merkt sich letzte Leseposition pro Log |
| Loki (Docker) | Mac Mini | Log-Aggregator, 30 Tage Retention |
| VictoriaMetrics | Mac Mini | Scraped `/metrics` und `/health` der GPU-Services alle 15-30s |
| Grafana | Mac Mini | Dashboard unter `grafana.mana.how` |

**Loki-Queries in Grafana** (Explore → Datasource: Loki):

```
{job="mana-stt"}                    # Alle STT-Logs
{job="mana-llm"} |= "error"        # LLM-Fehler
{host="gpu-server"}                 # Alle GPU-Server-Logs
{job="healthcheck"} |= "DOWN"      # Service-Ausfälle
```

**Prometheus-Metriken** (VictoriaMetrics scraped über LAN):

| Target | Job | Port |
|---|---|---|
| GPU LLM | `gpu-llm` | 3025 (`/metrics`) |
| GPU STT | `gpu-stt` | 3020 (`/health`) |
| GPU TTS | `gpu-tts` | 3022 (`/health`) |
| GPU Image Gen | `gpu-image-gen` | 3023 (`/health`) |
| GPU Video Gen | `gpu-video-gen` | 3026 (`/health`) |

---

## TypeScript Client (`@mana/shared-gpu`)

Shared Package im Monorepo (`packages/shared-gpu/`) für alle GPU-Services:

```typescript
import { GpuClient } from '@mana/shared-gpu';

// Öffentlich (von überall, mit API-Key)
const gpu = new GpuClient({
  baseUrl: 'https://gpu.mana.how',
  apiKey: process.env.GPU_API_KEY,
});

// Oder LAN (direkt, schneller)
const gpuLan = new GpuClient({
  baseUrl: 'http://192.168.178.11',
  apiKey: process.env.GPU_API_KEY,
});

// Speech-to-Text (mit Word-Timestamps + Speaker Diarization)
const transcript = await gpu.stt.transcribe(audioBuffer, 'recording.wav', {
  language: 'de',
  diarize: true,
  maxSpeakers: 3,
});
// → { text, words: [{ word, start, end, speaker }], speakers: ['SPEAKER_00', ...] }

// Text-to-Speech (Deutsch: Edge TTS, Englisch: Kokoro)
const { audio } = await gpu.tts.synthesize({ text: 'Hallo Welt', voice: 'de_katja' });

// Image Generation (FLUX.2 klein 4B, ~3s @ 1024x1024)
const image = await gpu.image.generate({ prompt: 'A futuristic city', width: 1024, height: 1024 });
const imageUrl = gpu.image.imageUrl(image.image_url);

// Health Check aller Services
const health = await gpu.healthCheck();
// → { stt: true, tts: true, image: true }
```

---

## API-Authentifizierung

Alle GPU-Services erfordern einen API-Key für Zugriff auf geschützte Endpoints.
`/health` und `/docs` sind öffentlich (kein Key nötig).

**API-Key:** In `.env.development` unter `GPU_API_KEY`

**Verwendung:**

```bash
# Mit Header
curl -H "X-API-Key: $GPU_API_KEY" https://gpu-llm.mana.how/v1/models

# Oder als Query-Parameter
curl "https://gpu-stt.mana.how/models?api_key=$GPU_API_KEY"

# Health (kein Key nötig)
curl https://gpu-llm.mana.how/health
```

**Konfiguration auf dem GPU-Server:**

| Service | Env-Variable | Datei |
|---|---|---|
| mana-llm | `GPU_API_KEY` | `C:\mana\services\mana-llm\.env` |
| mana-stt | `API_KEYS`, `INTERNAL_API_KEY` | `C:\mana\services\mana-stt\.env` |
| mana-tts | `API_KEYS`, `INTERNAL_API_KEY` | `C:\mana\services\mana-tts\.env` |
| mana-image-gen | `GPU_API_KEY` | `C:\mana\services\mana-image-gen\.env` |

---

## Fehlerbehebung

### Server nicht erreichbar (kein Ping, kein SSH)

**Häufigste Ursache: Ruhezustand/Energiesparen nicht deaktiviert.**

1. Am PC physisch aufwecken (Taste drücken)
2. Schritt 9 (Server-Modus) erneut durchführen
3. Prüfen:

```powershell
# Aktiven Energiesparplan anzeigen
powercfg /getactivescheme
# Muss "Höchstleistung" zeigen

# Ruhezustand-Status prüfen
powercfg /availablesleepstates
# "Ruhezustand" sollte NICHT aufgeführt sein

# Standby-Timeout prüfen (muss 0 sein)
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE
```

### SSH verbindet nicht (PC ist aber an)

```powershell
# Auf dem Windows-PC prüfen:
Get-Service sshd           # Muss "Running" zeigen
Test-NetConnection -ComputerName localhost -Port 22   # Muss "TcpTestSucceeded: True" zeigen

# SSH-Dienst neu starten
Restart-Service sshd
```

### Services laufen nicht nach Neustart

Die Services nutzen Scheduled Tasks mit `AtLogOn` — der User muss eingeloggt sein.

```powershell
# Prüfen ob Tasks registriert sind
Get-ScheduledTask -TaskName "Mana*" | Format-Table TaskName, State

# Manuell starten
Start-ScheduledTask -TaskName "ManaLLM"
Start-ScheduledTask -TaskName "ManaSTT"
Start-ScheduledTask -TaskName "ManaTTS"
Start-ScheduledTask -TaskName "ManaImageGen"
Start-ScheduledTask -TaskName "ManaVideoGen"

# Status prüfen
python C:\mana\status.py
```

Falls Tasks als "Ready" statt "Running" angezeigt werden:
- Auto-Login ist nicht konfiguriert → Schritt 9, Punkt 7
- Oder: manuell am PC einloggen

### Service-Logs prüfen

```powershell
# Letzten 20 Zeilen eines Logs anzeigen
Get-Content C:\mana\services\mana-llm\service.log -Tail 20
Get-Content C:\mana\services\mana-stt\service.log -Tail 20
Get-Content C:\mana\services\mana-tts\service.log -Tail 20
Get-Content C:\mana\services\mana-image-gen\service.log -Tail 20
```

### nvidia-smi zeigt Fehler

- Treiber neu installieren: https://www.nvidia.com/Download/index.aspx
- PC neu starten
- Prüfen ob die GPU im Geräte-Manager sichtbar ist

### GPU VRAM voll

```powershell
# GPU-Auslastung prüfen
nvidia-smi

# Einzelnen Service stoppen um VRAM freizugeben
python C:\mana\stop-all.py

# Oder gezielt einen Service neu starten
Stop-ScheduledTask -TaskName "ManaImageGen"
Start-ScheduledTask -TaskName "ManaImageGen"
```

### IP-Adresse stimmt nicht

```powershell
ipconfig
# → Ethernet-Adapter prüfen, IPv4-Adresse muss 192.168.178.11 sein
```

### Port-Konflikte prüfen

```powershell
# Alle lauschenden Ports anzeigen (deutsch: "ABHÖREN")
netstat -ano | Select-String "ABHOR"

# Welcher Prozess nutzt einen bestimmten Port?
netstat -ano | Select-String "3025"
Get-Process -Id <PID>
```
