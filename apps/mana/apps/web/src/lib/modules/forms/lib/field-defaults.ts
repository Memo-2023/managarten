import type { FieldType, FormField } from '../types';

/**
 * Build a fresh `FormField` for the given type with sensible defaults.
 * Generates a fresh UUID and the type-specific config so the builder
 * can append-and-go without touching the underlying schema engine.
 */
export function makeDefaultField(type: FieldType): FormField {
	const id = crypto.randomUUID();
	const base: FormField = {
		id,
		type,
		label: defaultLabel(type),
		required: false,
	};

	switch (type) {
		case 'single_choice':
		case 'multi_choice':
			return {
				...base,
				options: [
					{ id: crypto.randomUUID(), label: 'Option 1' },
					{ id: crypto.randomUUID(), label: 'Option 2' },
				],
			};
		case 'rating':
			return { ...base, config: { ratingScale: 5 } };
		case 'short_text':
			return { ...base, config: { maxLength: 120 } };
		case 'long_text':
			return { ...base, config: { maxLength: 2000 } };
		case 'number':
			return { ...base, config: {} };
		case 'consent':
			return {
				...base,
				required: true,
				label: 'Ich stimme der Datenverarbeitung zu.',
			};
		case 'section':
			return { ...base, label: 'Abschnitt' };
		default:
			return base;
	}
}

function defaultLabel(type: FieldType): string {
	switch (type) {
		case 'short_text':
			return 'Kurze Frage';
		case 'long_text':
			return 'Längere Frage';
		case 'single_choice':
			return 'Wähle eine Option';
		case 'multi_choice':
			return 'Wähle eine oder mehrere Optionen';
		case 'number':
			return 'Zahl';
		case 'date':
			return 'Datum';
		case 'email':
			return 'E-Mail-Adresse';
		case 'yes_no':
			return 'Ja oder Nein?';
		case 'rating':
			return 'Wie würdest du das bewerten?';
		case 'section':
			return 'Abschnitt';
		case 'consent':
			return 'Einwilligung';
	}
}
