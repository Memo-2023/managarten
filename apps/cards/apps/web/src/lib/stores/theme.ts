/**
 * Cards Theme Store
 *
 * Uses the shared theme system. The Cards brand accent (#8b5cf6 from
 * MANA_APPS) becomes `--color-app-accent` on document.documentElement
 * so the existing `bg-app-accent` / `text-app-accent` utilities work
 * everywhere — Lernen-CTA, cloze highlight, link colours, etc.
 *
 * The accent is theme-agnostic by design: it stays the same whether
 * the user picks Lume / Nature / Stone / Ocean × Light / Dark, so the
 * Cards identity reads consistently across variants.
 */
import { createThemeStore } from '@mana/shared-theme';

export type { ThemeMode, ThemeVariant, EffectiveMode } from '@mana/shared-theme';

// Cards brand: #8b5cf6 (violet-500) → HSL channels.
const CARDS_ACCENT_HSL = '258 90% 66%';

export const theme = createThemeStore({
	appId: 'cards',
});

/**
 * Write the Cards app accent onto documentElement once at boot. The
 * shared theme store doesn't know about per-app accents — it only
 * touches the variant tokens — so we set this independently and it
 * survives every variant switch.
 */
export function applyCardsAccent(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.style.setProperty('--color-app-accent', CARDS_ACCENT_HSL);
}
