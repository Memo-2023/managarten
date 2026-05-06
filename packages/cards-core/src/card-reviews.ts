/**
 * Per-card-type review fan-out.
 *
 * Different card types produce different numbers of learnable units:
 *   - basic / type-in:  one  (subIndex 0)
 *   - basic-reverse:    two  (0=front→back, 1=back→front)
 *   - cloze:            one per distinct cluster (subIndex = cluster idx)
 */

import { clusterIndexes } from './cloze';
import type { CardFields, CardType } from './types';

export function subIndexesFor(input: { type: CardType; fields: CardFields }): number[] {
	switch (input.type) {
		case 'basic':
		case 'type-in':
			return [0];
		case 'basic-reverse':
			return [0, 1];
		case 'cloze': {
			const text = input.fields.text ?? '';
			const idx = clusterIndexes(text);
			return idx.length > 0 ? idx : [1];
		}
		case 'image-occlusion':
		case 'audio':
		case 'multiple-choice':
			return [0];
	}
}
