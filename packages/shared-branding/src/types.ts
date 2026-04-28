/**
 * App identifiers for branding.
 *
 * Derived from `APP_BRANDING` keys so `<AppLogo app={…}>` accepts exactly
 * the apps that have a branding entry — adding/removing one in config.ts
 * automatically updates the union, no hand-maintenance.
 */
import type { AppId } from './config';
export type { AppId };

/**
 * App branding configuration.
 *
 * `id` is `string` (not `AppId`) because `AppId` is derived from the keys
 * of `APP_BRANDING`, and constraining `id` to `AppId` would create a
 * circular type reference. Each entry's key in `APP_BRANDING` is the
 * authoritative id; the `id` field is a redundant convenience.
 */
export interface AppBranding {
	/** Unique app identifier */
	id: string;
	/** Display name */
	name: string;
	/** Short description/tagline */
	tagline: string;
	/** Primary brand color (hex) */
	primaryColor: string;
	/** Secondary brand color (hex) */
	secondaryColor?: string;
	/** SVG path data for the logo icon */
	logoPath: string;
	/** Logo viewBox (default: "0 0 24 24") */
	logoViewBox?: string;
	/** Whether the logo uses stroke instead of fill */
	logoStroke?: boolean;
	/** Logo stroke width (if logoStroke is true) */
	logoStrokeWidth?: number;
}

/**
 * Logo component props
 */
export interface LogoProps {
	/** Size in pixels */
	size?: number;
	/** Override color (uses app primary color if not provided) */
	color?: string;
	/** Additional CSS classes */
	class?: string;
}

/**
 * App logo with name props
 */
export interface AppLogoWithNameProps extends LogoProps {
	/** Show app name next to logo */
	showName?: boolean;
	/** Font size for name (CSS value) */
	nameFontSize?: string;
	/** Gap between logo and name */
	gap?: string;
}
