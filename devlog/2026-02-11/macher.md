---
date: 2026-02-11
day: 44
view: macher
weekday: Mittwoch
commits: 29
review: written
---

# Mittwoch, 2026-02-11 — Tag 44 (Macher-Sicht)

## Stats

29 Commits, +14772 / −1668 LoC, 190 Files. Top-Dirs: `apps/photos/apps/web` (17%), `apps/photos/apps/backend` (13%), `services/mana-core-auth/src` (7%), `apps/presi/apps/backend` (5%), `services/mana-media/apps` (5%). Tags: photos, mana-media. Session 13:59 → 01:34 (~129 aktive Min, längster Fokus 50 Min).

## Commits

- `a2e2a5b` ✨ feat(admin): add user data dashboard for cross-project data visualization (+3785/-403)
- `6039407` ✨ feat(mana-stt): add vLLM integration for Voxtral transcription (+1060/-162)
- `7c9c264` 🐛 fix(mana-stt): adjust vLLM config for CPU mode (+7/-2)
- `21d50d1` 📝 docs(mana-stt): document Whisper + Mistral API architecture (+27/-7)
- `e7e6281` 🔧 fix(docker): add missing shared packages to all backend Dockerfiles (+171/-31)
- `99a23d0` 🚀 feat(infra): expose STT and TTS APIs externally (+6/-0)
- `5cd8b63` 🐛 fix(infra): correct TTS API port to 3022 (+1/-1)
- `d3392f6` 🔧 fix(ci): disable ARM64 for storage-backend due to QEMU issues (+2/-1)
- `90c2f85` ✨ feat(photos): add Photos app with mana-media EXIF integration (+6829/-441)
- `4f9d992` 🔧 fix(docker): add missing shared packages to storage-web Dockerfile (+2/-1)
- `aab304f` 🔒️ feat(stt,tts): add API key authentication with rate limiting (+527/-8)
- `8ddc4eb` 🔧 fix(docker): build shared-vite-config in storage-web Dockerfile (+3/-0)
- `4130823` 🔧 fix(docker): add shared-stores and shared-types to storage-web (+2/-0)
- `91f175c` 🐛 fix(deps): add missing shared-stores dependency to web apps (+433/-508)
- `5ce4e42` 🚀 feat(photos): add Docker deployment configuration (+278/-7)
- `36563f4` 🔧 fix(photos): remove unused nestjs-integration dependency (+1/-16)
- `898f5d2` 🔧 chore(stt,tts): update launchd plists to load .env files (+40/-3)
- `16a7532` 🔧 chore: update lockfile after removing nestjs-integration (+265/-5)
- `741c5bc` 🐛 fix(photos): use valid Svelte 5 event syntax (+1/-1)
- `4452d37` 🐛 fix(mana-media): correct path to main.js in Dockerfile (+1/-1)

_… plus 9 weitere Commits._
