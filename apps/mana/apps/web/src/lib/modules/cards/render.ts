/**
 * Cards module — Markdown render helper is now sourced from
 * `@mana/cards-core`. Thin re-export so existing local imports keep
 * working.
 */

export { renderMarkdown, type RenderOptions } from '@mana/cards-core';
