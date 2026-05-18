/**
 * Shared branding components and configuration for the Mana ecosystem
 *
 * This package provides:
 * - App logos (AppLogo, AppLogoWithName)
 * - Pre-configured app logos (ManaLogo, etc.)
 * - Mana icon (ManaIcon)
 * - Branding configuration (colors, names, taglines)
 */

// Generic Components
export { default as AppLogo } from './AppLogo.svelte';
export { default as AppLogoWithName } from './AppLogoWithName.svelte';
export { default as ManaIcon } from './ManaIcon.svelte';

// Pre-configured App Logos
export {
	ManaLogo,
	CardsLogo,
	UloadLogo,
	ChatLogo,
	PresiLogo,
	QuotesLogo,
	ContactsLogo,
	CalendarLogo,
	StorageLogo,
	TodoLogo,
	MailLogo,
	MoodlitLogo,
	InventoryLogo,
	ClockLogo,
	QuestionsLogo,
	SkillTreeLogo,
	LightWriteLogo,
	MusicLogo,
} from './logos';

// Configuration
export { APP_BRANDING, getAppBranding, getAllAppBrandings } from './config';

// App Icons (SVG data URLs)
export { APP_ICONS, type AppIconId } from './app-icons';

// Mana Apps Configuration
export {
	MANA_APPS,
	getManaApp,
	getManaAppsByStatus,
	getAvailableManaApps,
	getActiveManaApps,
	getAccessibleManaApps,
	hasAppAccess,
	getTierLevel,
	APP_STATUS_LABELS,
	APP_SLIDER_LABELS,
	APP_URLS,
	ACCESS_TIER_LABELS,
	getPillAppItems,
	type ManaApp,
	type AppStatus,
	type AccessTier,
	type PillAppItemConfig,
} from './mana-apps';

// Types
export type { AppId, AppBranding, LogoProps, AppLogoWithNameProps } from './types';

// Spaces (multi-tenancy primitive — see docs/plans/spaces-foundation.md)
// Canonical types live in @mana/shared-types; branding adds only UI strings.
export {
	SPACE_TYPES,
	SPACE_TYPE_LABELS,
	SPACE_TYPE_DESCRIPTIONS,
	SPACE_MODULE_ALLOWLIST,
	isModuleAllowedInSpace,
	isSpaceType,
	parseSpaceMetadata,
	type SpaceType,
	type SpaceModuleId,
	type SpaceMetadata,
} from './spaces';

// Onboarding templates (see docs/plans/onboarding-flow.md)
export {
	ONBOARDING_TEMPLATES,
	resolveModulesForTemplates,
	type OnboardingTemplate,
	type OnboardingTemplateId,
} from './onboarding-templates';
