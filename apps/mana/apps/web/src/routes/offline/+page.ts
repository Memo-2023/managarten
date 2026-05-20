// `/offline` ist die Workbox-navigate-fallback. Zwei Dinge sind nötig:
//
// 1. `prerender = true` — sonst landet die Page nicht in
//    `prerendered/offline.html`, und der @mana/shared-pwa-Workbox-Config
//    matched nur `**/*.html`. Ohne wirft Workbox beim SW-Register
//    `non-precached-url: /offline`.
//
// 2. Die Page lebt unter `+page@.svelte` (statt `+page.svelte`) — die
//    `@`-Notation bricht aus der Layout-Chain aus. Das Root-Layout
//    zieht Dexie / encryption-vault / data-layer-listeners / auth-store
//    rein; beim Build-SSR throw't Browser-Code (window/document/
//    indexedDB). Genau das war der „Error: 500 /offline"-Crash, der
//    2026-04-07 zum prerender=false-FIXME geführt hatte. Mit @-Suffix
//    hängt die Page direkt am SvelteKit-Root, kein Eltern-Layout — die
//    OfflinePage aus @mana/shared-ui kommt ohne Stores aus.
export const prerender = true;
