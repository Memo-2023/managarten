---
title: 'mana-media als zentrale Bild-Pipeline + Effect-Depth-Fix'
description: 'Kurzer Tag: Bild-Uploads aller 5 Module routen über mana-media (CAS, Thumbnails, EXIF, Photos-Galerie). Dazu der Fix für effect_update_depth_exceeded der seit dem Unified-App-Switch auf 6 Dashboard-Modulen heumkroch.'
date: 2026-04-04
author: 'Till Schneider'
category: 'bugfix'
tags:
  ['mana-media', 'cas', 'thumbnails', 'photos', 'svelte5', 'reactivity', 'liveQuery', 'guest-mode']
featured: false
commits: 2
readTime: 4
stats:
  filesChanged: 23
  linesAdded: 299
  linesRemoved: 318
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 2
workingHours:
  start: '2026-04-04T10:30'
  end: '2026-04-04T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **mana-media** wird zentrale Bild-Pipeline: Picture, Contacts, Planta, Storage, Food laden Bilder darüber hoch
- **CAS (SHA-256 Dedup)**, **Thumbnails**, **EXIF-Extraktion** automatisch
- Alle hochgeladenen Bilder erscheinen in der **Photos-Galerie**
- Fix: `effect_update_depth_exceeded` in 6 Dashboard-Modulen (Resultat des Unified-App-Switches)

Kurze Samstag-Session — zwei gezielte Commits.

---

## mana-media: Eine Pipeline für alle Bild-Uploads

Bisher hat jedes Modul Bilder direkt in S3/MinIO geschrieben. Das hatte mehrere Nachteile:

- **Keine Dedup** — dasselbe Bild in 3 Modulen lag 3-mal im Bucket
- **Keine Thumbnails** — jedes Modul rollte sein eigenes Resizing
- **Keine EXIF-Extraktion** — keine konsistente Date-Taken-Sortierung
- **Photos-Galerie sah nichts davon** — uploads aus Contacts/Picture/Planta waren in der Galerie unsichtbar

### Neues Routing

```
Vorher:                          Nachher:
Picture  → S3 direkt             Picture  ─┐
Contacts → S3 direkt             Contacts ─┤
Planta   → S3 direkt   ───→      Planta   ─┼─→ mana-media → S3 (CAS) + DB
Storage  → S3 direkt             Storage  ─┤                 ↓
Food → S3 direkt             Food ─┘             Photos Gallery
```

### Implementierung

`apps/api/src/lib/media.ts` ist der neue Helper. Module-Routes rufen `uploadImageToMedia(buffer, { module, ownerId })` und bekommen eine `mediaId` zurück, die sie in ihrer eigenen Tabelle persistieren.

mana-media liefert zurück:

- `mediaId` — referenzierbar überall
- `url` für das Original
- `thumbnailUrls` für 256/512/1024
- `width / height / format`
- `exif.takenAt`, GPS, Camera

### Was nicht über mana-media geht

- **Non-Images** (PDFs, Audio, Docs): bleiben direkt bei `@manacore/shared-storage`. Sharp kann sowas nicht.
- **SVG-Avatare** in Contacts: bleiben bei shared-storage, weil Sharp keine SVGs verarbeitet.

### Nebeneffekt: Photos-Galerie wird automatisch befüllt

Die Photos-App liest aus `mana_media.media WHERE owner_id = ?`. Damit erscheinen jetzt alle Avatare aus Contacts, alle Pflanzen-Fotos aus Planta, alle Mahlzeit-Bilder aus Food etc. in der Galerie — ohne dass die Module davon wissen.

---

## Fix: effect_update_depth_exceeded

Seit der Unified-App-Migration vor 3 Tagen tauchten in 6 Dashboard-Modulen Svelte-5-Errors auf:

```
Uncaught Svelte error: effect_update_depth_exceeded
Maximum update depth exceeded. This can happen when a reactive
block or effect repeatedly sets a new value.
```

### Root Cause

```typescript
// alt — verursacht den Error
let items = $state<Item[]>([]);
$effect(() => {
	const sub = liveQuery(() => db.items.toArray()).subscribe((arr) => {
		items = arr; // <- triggert weitere $state writes downstream
	});
	return () => sub.unsubscribe();
});
```

Das `$state`-Write in dem `$effect` triggerte downstream Effects (in Children), die wieder Stores updateten, die wieder Children re-rendered → Cascade. Bei kleinen Listen okay, bei den Dashboard-Widgets mit 6 parallelen Subscriptions: BOOM.

### Fix

`useLiveQueryWithDefault` ist ein Hook der `liveQuery` direkt in einen `$derived` umwandelt — kein doppelter `$state` Round-Trip:

```typescript
// neu
const items = useLiveQueryWithDefault(() => db.items.toArray(), [] as Item[]);
```

Migriert in: **todo, calendar, contacts, habits, notes, finance** — die 6 Dashboard-Module.

### Plus: Zwei verwandte Reactivity-Fixes

1. **`checkInlineSuggestion` in Dexie-Hooks** — wurde innerhalb einer Single-Table-Transaction aufgerufen, hat aber Cross-Table reads gemacht. `setTimeout(…, 0)` deferiert es nach dem Transaction-Commit.

2. **`guestMode` mit `$state()` deklariert** — am 03.04. wurde es vorübergehend auf primitive zurückgesetzt (wegen einer Reactivity-Schleife). Mit dem heutigen Pattern-Switch funktioniert `$state()` wieder.

3. **`trySSO` mit 5s Timeout** — wenn mana-auth unreachable ist, hängt der Login-Flow nicht mehr. Timeout-Path führt direkt in den Guest-Modus.

---

## Zusammenfassung

| Bereich             | Commits | Highlights                                                             |
| ------------------- | ------- | ---------------------------------------------------------------------- |
| mana-media Pipeline | 1       | 5 Module über CAS, Thumbnails, EXIF, Photos-Galerie sichtbar           |
| Reactivity-Fixes    | 1       | useLiveQueryWithDefault in 6 Modulen, Dexie-Hook deferral, SSO-Timeout |

---

## Nächste Schritte

- mana-media Cleanup-Job für orphaned Bilder
- Sharp aktivieren für animierte WebP / AVIF Output
- File-Bytes Encryption auch für mana-media Uploads (gehört zu Phase 8 der Encryption-Roadmap)
