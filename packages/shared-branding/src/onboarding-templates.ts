/**
 * Onboarding templates — starter-packs a user picks on Screen 3 of the
 * first-login flow (/onboarding/templates). Each template is a named
 * use-case with an ordered list of module IDs. The flow's finish
 * handler deduplicates the union of picked templates' modules (keeping
 * the first occurrence in priority order), caps the total at 8, and
 * writes the result as the user's Home scene.
 *
 * All module IDs are verified against
 * apps/mana/apps/web/src/lib/app-registry/apps.ts — if a template
 * references a module that was removed, catch it in the test below
 * before the user sees an empty tile.
 *
 * See docs/plans/onboarding-flow.md for rationale (why these templates,
 * why multi-select, why a cap).
 */

export type OnboardingTemplateId =
	| 'alltag'
	| 'arbeit'
	| 'health'
	| 'sport'
	| 'lernen'
	| 'entdecken'
	| 'erinnern';

export type OnboardingTemplate = {
	id: OnboardingTemplateId;
	/** German name rendered on the tile. */
	name: string;
	/** One-line description under the tile name. */
	shortDescription: string;
	/** Phosphor icon name — resolved by the consuming page. */
	iconName: 'House' | 'Briefcase' | 'Heart' | 'Barbell' | 'GraduationCap' | 'Compass' | 'Camera';
	/**
	 * Module IDs in priority order (first = most important). Dedup
	 * across templates keeps the earliest occurrence; cap = 8.
	 */
	moduleIds: string[];
};

export const ONBOARDING_TEMPLATES: readonly OnboardingTemplate[] = [
	{
		id: 'alltag',
		name: 'Alltag',
		shortDescription: 'Aufgaben, Termine, Notizen, Kontakte',
		iconName: 'House',
		moduleIds: ['todo', 'calendar', 'notes', 'contacts'],
	},
	{
		id: 'arbeit',
		name: 'Arbeit',
		shortDescription: 'Produktivität für den Job',
		iconName: 'Briefcase',
		moduleIds: ['todo', 'calendar', 'mail', 'chat', 'times', 'notes'],
	},
	{
		id: 'health',
		name: 'Health',
		shortDescription: 'Gesundheit, Stimmung, Ernährung, Zyklus',
		iconName: 'Heart',
		moduleIds: ['habits', 'body', 'mood', 'period'],
	},
	{
		id: 'sport',
		name: 'Sport',
		shortDescription: 'Training, Ziele, Körper, Ernährung',
		iconName: 'Barbell',
		moduleIds: ['habits', 'body', 'goals', 'stretch'],
	},
	{
		id: 'lernen',
		name: 'Lernen',
		shortDescription: 'Skills, Quizzes, Notizen, Kontext',
		iconName: 'GraduationCap',
		moduleIds: ['skilltree', 'quiz', 'notes', 'library', 'kontext'],
	},
	{
		id: 'entdecken',
		name: 'Entdecken',
		shortDescription: 'Orte, Fotos, Musik, Wetter',
		iconName: 'Compass',
		moduleIds: ['places', 'photos', 'music', 'wetter'],
	},
	{
		id: 'erinnern',
		name: 'Erinnern',
		shortDescription: 'Journal, Fotos, Zitate',
		iconName: 'Camera',
		moduleIds: ['journal', 'photos', 'quotes'],
	},
];

/**
 * Pick modules for the user's Home scene based on a multi-selection of
 * templates. Iterates templates in the order provided, collecting their
 * modules while skipping dups and stopping at the cap.
 *
 * Exported so the onboarding page and its test can share the same
 * logic — the page only has to worry about UI state.
 */
export function resolveModulesForTemplates(
	selectedIds: readonly OnboardingTemplateId[],
	cap = 8
): string[] {
	const byId = new Map(ONBOARDING_TEMPLATES.map((t) => [t.id, t]));
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of selectedIds) {
		const tpl = byId.get(id);
		if (!tpl) continue;
		for (const moduleId of tpl.moduleIds) {
			if (seen.has(moduleId)) continue;
			seen.add(moduleId);
			out.push(moduleId);
			if (out.length >= cap) return out;
		}
	}
	return out;
}
