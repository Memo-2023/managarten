/**
 * Per-Space "Welcome" seed for the Forms module.
 *
 * Drops a single draft form into each Space the first time it is
 * activated, so the empty state is replaced by a concrete example
 * users can edit, publish, or delete. Idempotent via deterministic id —
 * see docs/plans/workbench-seeding-cleanup.md.
 *
 * Plan: docs/plans/forms-module.md M1.
 */

import { db } from '../database';
import { encryptRecord } from '../crypto';
import { registerSpaceSeed } from '../scope/per-space-seeds';
import { DEFAULT_FORM_SETTINGS } from '$lib/modules/forms/types';
import type { FormField, LocalForm } from '$lib/modules/forms/types';

const TABLE = 'forms';

export function formsWelcomeSeedId(spaceId: string): string {
	return `seed-welcome-${spaceId}`;
}

const exampleFields: FormField[] = [
	{
		id: 'seed-name',
		type: 'short_text',
		label: 'Wie heißt du?',
		required: true,
	},
	{
		id: 'seed-mood',
		type: 'rating',
		label: 'Wie geht es dir heute?',
		required: false,
		config: { ratingScale: 5 },
	},
	{
		id: 'seed-note',
		type: 'long_text',
		label: 'Magst du etwas teilen?',
		helpText: 'Ein Satz reicht.',
		required: false,
	},
];

registerSpaceSeed('forms-welcome', async (spaceId) => {
	const id = formsWelcomeSeedId(spaceId);
	const existing = await db.table(TABLE).get(id);
	if (existing) return;

	const row: LocalForm = {
		id,
		spaceId,
		title: 'Beispiel-Formular',
		description: 'Ein Mini-Pulse-Check als Startpunkt. Bearbeite oder lösche es jederzeit.',
		fields: exampleFields,
		branching: [],
		status: 'draft',
		settings: { ...DEFAULT_FORM_SETTINGS },
		responseCount: 0,
		visibility: 'private',
	} as LocalForm;

	await encryptRecord(TABLE, row);
	await db.table(TABLE).add(row);
});
