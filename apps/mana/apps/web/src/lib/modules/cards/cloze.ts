/**
 * Cards module — cloze parser is now sourced from `@mana/cards-core`.
 * Thin re-export so existing local imports keep working.
 */

export {
	tokenize,
	clusterIndexes,
	clusters,
	renderCloze,
	type ClozeCluster,
	type RenderedCloze,
} from '@mana/cards-core';
