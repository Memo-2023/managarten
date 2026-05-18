/**
 * Schema handling for SpiralDB
 * Encodes/decodes field definitions in Ring 2
 */

import type { SchemaDefinition, FieldDefinition, BitStream, ColorIndex } from './types.js';
import { createBitStream, writeBits, readBits, bitsToPixels, pixelsToBits } from './encoding.js';
import { FIELD_TYPE_BITS, BITS_TO_FIELD_TYPE } from './constants.js';

/**
 * Encode a schema definition to pixels
 * Format per field: [type:3bit][maxLength:9bit][nullable:1bit] = 13 bits
 */
export function encodeSchema(schema: SchemaDefinition): ColorIndex[] {
	const stream = createBitStream();

	// Schema version (9 bits)
	writeBits(stream, schema.version, 9);

	// Number of fields (6 bits, max 63 fields)
	writeBits(stream, schema.fields.length, 6);

	// Each field definition
	for (const field of schema.fields) {
		// Type (3 bits)
		writeBits(stream, FIELD_TYPE_BITS[field.type], 3);

		// Max length (9 bits)
		writeBits(stream, field.maxLength, 9);

		// Nullable flag (1 bit)
		writeBits(stream, field.nullable ? 1 : 0, 1);
	}

	// End marker
	writeBits(stream, FIELD_TYPE_BITS['end'], 3);

	return bitsToPixels(stream.bits);
}

/**
 * Decode pixels to a schema definition
 */
export function decodeSchema(pixels: ColorIndex[], fieldNames: string[]): SchemaDefinition {
	const bits = pixelsToBits(pixels);
	const stream: BitStream = { bits, position: 0 };

	// Schema version
	const version = readBits(stream, 9);

	// Number of fields
	const fieldCount = readBits(stream, 6);

	const fields: FieldDefinition[] = [];
	for (let i = 0; i < fieldCount; i++) {
		// Type
		const typeBits = readBits(stream, 3);
		const type = BITS_TO_FIELD_TYPE[typeBits];

		if (type === 'end') break;

		// Max length
		const maxLength = readBits(stream, 9);

		// Nullable
		const nullable = readBits(stream, 1) === 1;

		fields.push({
			name: fieldNames[i] || `field_${i}`,
			type,
			maxLength,
			nullable,
		});
	}

	return {
		version,
		name: 'decoded_schema',
		fields,
	};
}

/**
 * Calculate how many pixels a schema needs
 */
export function getSchemaPixelCount(schema: SchemaDefinition): number {
	// Version (9) + field count (6) + fields * 13 + end marker (3)
	const totalBits = 9 + 6 + schema.fields.length * 13 + 3;
	return Math.ceil(totalBits / 3);
}

/**
 * Create a schema for Todo items
 */
export function createTodoSchema(): SchemaDefinition {
	return {
		version: 1,
		name: 'todo',
		fields: [
			{ name: 'id', type: 'int', maxLength: 12 }, // 0-4095
			{ name: 'status', type: 'int', maxLength: 3 }, // 0-7
			{ name: 'priority', type: 'int', maxLength: 3 }, // 0-7
			{ name: 'createdAt', type: 'timestamp', maxLength: 24 }, // Days since epoch
			{ name: 'dueDate', type: 'timestamp', maxLength: 24, nullable: true },
			{ name: 'completedAt', type: 'timestamp', maxLength: 24, nullable: true },
			{ name: 'title', type: 'string', maxLength: 255 },
			{ name: 'description', type: 'string', maxLength: 511, nullable: true },
			{ name: 'tags', type: 'array', maxLength: 8 }, // Max 8 tag IDs
		],
	};
}

/**
 * Create a schema for Contact items (Contacts app)
 */
export function createContactSchema(): SchemaDefinition {
	return {
		version: 1,
		name: 'contact',
		fields: [
			{ name: 'id', type: 'int', maxLength: 12 }, // 0-4095
			{ name: 'status', type: 'int', maxLength: 3 }, // 0=active, 2=favorite, 4=archived
			{ name: 'hasEmail', type: 'bool', maxLength: 1 },
			{ name: 'hasPhone', type: 'bool', maxLength: 1 },
			{ name: 'createdAt', type: 'timestamp', maxLength: 24 },
			{ name: 'name', type: 'string', maxLength: 100 },
			{ name: 'company', type: 'string', maxLength: 100, nullable: true },
			{ name: 'city', type: 'string', maxLength: 50, nullable: true },
		],
	};
}

/**
 * Create a schema for Quote items (Quotes app)
 */
export function createQuoteSchema(): SchemaDefinition {
	return {
		version: 1,
		name: 'quote',
		fields: [
			{ name: 'id', type: 'int', maxLength: 12 }, // 0-4095
			{ name: 'status', type: 'int', maxLength: 3 }, // 0=active, 2=favorited, 4=removed
			{ name: 'category', type: 'int', maxLength: 4 }, // 10 categories (0-15)
			{ name: 'language', type: 'int', maxLength: 3 }, // 6 languages (0-7)
			{ name: 'createdAt', type: 'timestamp', maxLength: 24 },
			{ name: 'quoteId', type: 'string', maxLength: 100 }, // Reference to content package
			{ name: 'author', type: 'string', maxLength: 100 },
			{ name: 'text', type: 'string', maxLength: 255 },
		],
	};
}

/**
 * Create a schema for Mana Activity events (cross-app unified spiral)
 *
 * Stores activity highlights from all apps in a single spiral.
 * Each record is a compact activity event: which app, what happened, when.
 */
export function createManaActivitySchema(): SchemaDefinition {
	return {
		version: 1,
		name: 'mana_activity',
		fields: [
			{ name: 'id', type: 'int', maxLength: 12 }, // 0-4095
			{ name: 'app', type: 'int', maxLength: 5 }, // 0-31 (app index)
			{ name: 'eventType', type: 'int', maxLength: 4 }, // 0-15 (event type)
			{ name: 'value', type: 'int', maxLength: 12 }, // 0-4095 (count/score/etc)
			{ name: 'createdAt', type: 'timestamp', maxLength: 24 },
			{ name: 'label', type: 'string', maxLength: 80 },
		],
	};
}

/**
 * App index mapping for Mana Activity schema
 */
export const MANA_APP_INDEX: Record<string, number> = {
	todo: 0,
	calendar: 1,
	contacts: 2,
	chat: 3,
	quotes: 4,
	picture: 5,
	clock: 6,
	storage: 7,
	music: 8,
	presi: 9,
	cards: 11,
	photos: 12,
	skilltree: 13,
	inventory: 15,
	times: 16,
	questions: 19,
	moodlit: 20,
	calc: 22,
	mana: 31,
};

export const MANA_APP_NAMES: Record<number, string> = Object.fromEntries(
	Object.entries(MANA_APP_INDEX).map(([k, v]) => [v, k])
);

/**
 * Event type mapping for Mana Activity schema
 */
export const MANA_EVENT_TYPE: Record<string, number> = {
	created: 0,
	completed: 1,
	favorited: 2,
	deleted: 3,
	imported: 4,
	exported: 5,
	milestone: 6,
	streak: 7,
	snapshot: 8,
};

export const MANA_EVENT_NAMES: Record<number, string> = Object.fromEntries(
	Object.entries(MANA_EVENT_TYPE).map(([k, v]) => [v, k])
);

/**
 * Validate that a record matches a schema
 */
export function validateRecord(
	schema: SchemaDefinition,
	record: Record<string, unknown>
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	for (const field of schema.fields) {
		const value = record[field.name];

		// Check nullable
		if (value === null || value === undefined) {
			if (!field.nullable) {
				errors.push(`Field '${field.name}' is required`);
			}
			continue;
		}

		// Type-specific validation
		switch (field.type) {
			case 'int':
				if (typeof value !== 'number' || !Number.isInteger(value)) {
					errors.push(`Field '${field.name}' must be an integer`);
				} else if (value < 0 || value >= 2 ** field.maxLength) {
					errors.push(`Field '${field.name}' out of range (max ${2 ** field.maxLength - 1})`);
				}
				break;

			case 'string':
				if (typeof value !== 'string') {
					errors.push(`Field '${field.name}' must be a string`);
				} else if (value.length > field.maxLength) {
					errors.push(`Field '${field.name}' too long (max ${field.maxLength} chars)`);
				}
				break;

			case 'bool':
				if (typeof value !== 'boolean') {
					errors.push(`Field '${field.name}' must be a boolean`);
				}
				break;

			case 'timestamp':
				if (!(value instanceof Date)) {
					errors.push(`Field '${field.name}' must be a Date`);
				}
				break;

			case 'array':
				if (!Array.isArray(value)) {
					errors.push(`Field '${field.name}' must be an array`);
				} else if (value.length > field.maxLength) {
					errors.push(`Field '${field.name}' has too many items (max ${field.maxLength})`);
				}
				break;
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Get field names from a schema
 */
export function getFieldNames(schema: SchemaDefinition): string[] {
	return schema.fields.map((f) => f.name);
}
