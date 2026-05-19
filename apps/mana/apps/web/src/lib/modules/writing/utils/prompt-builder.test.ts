/**
 * Pure-function tests for the writing prompt builder. No Dexie + no
 * network — only string assembly and deterministic helpers.
 */

import { describe, it, expect } from 'vitest';
import {
	buildDraftPrompt,
	buildShortenPrompt,
	buildExpandPrompt,
	buildChangeTonePrompt,
	buildRewritePrompt,
	buildTranslatePrompt,
	buildTitleSuggestionPrompt,
	cleanSuggestedTitle,
	estimateMaxTokens,
	type SelectionContext,
} from './prompt-builder';
import type { ResolvedReference } from './reference-resolver';
import type { DraftBriefing, DraftKind } from '../types';
import type { StylePreset } from '../presets/styles';

const baseBriefing: DraftBriefing = {
	topic: 'Was Mana von klassischen Tools unterscheidet',
	audience: null,
	tone: null,
	language: 'de',
	targetLength: { type: 'words', value: 500 },
	extraInstructions: null,
	useResearch: false,
};

function preset(overrides: Partial<StylePreset> = {}): StylePreset {
	return {
		id: 'casual-blog',
		name: { de: 'Casual Blog', en: 'Casual blog' },
		description: { de: 'Du-Ansprache, kurze Absätze.', en: '...' },
		principles: {
			toneTraits: ['conversational', 'direct'],
			rawAnalysis: 'Kurze Sätze. Du-Form. Keine Buzzwords.',
			extractedAt: '2026-04-24T00:00:00Z',
		},
		...overrides,
	};
}

describe('buildDraftPrompt', () => {
	it('produces a system+user pair with topic + length + kind', () => {
		const { system, user } = buildDraftPrompt({
			kind: 'blog',
			title: 'Mein Test-Post',
			briefing: baseBriefing,
		});
		expect(system).toContain('Ghostwriter');
		expect(system).toContain('Blogpost');
		expect(system).toContain('Deutsch');
		// The "no preamble" instruction is the most-load-bearing part of
		// the system prompt — guard it explicitly.
		expect(system).toContain('Hier ist dein Text');
		expect(user).toContain('Titel: Mein Test-Post');
		expect(user).toContain('Thema: Was Mana von');
		expect(user).toContain('Ziel-Länge: ca. 500 Wörter');
	});

	it('omits audience/tone/extraInstructions when not set', () => {
		const { user } = buildDraftPrompt({
			kind: 'blog',
			title: 'X',
			briefing: baseBriefing,
		});
		expect(user).not.toContain('Zielgruppe:');
		expect(user).not.toContain('Ton:');
		expect(user).not.toContain('Zusätzliche Hinweise:');
	});

	it('includes audience/tone/extraInstructions when set', () => {
		const { user } = buildDraftPrompt({
			kind: 'blog',
			title: 'X',
			briefing: {
				...baseBriefing,
				audience: 'Gründer',
				tone: 'sachlich',
				extraInstructions: 'mit einem Zitat beginnen',
			},
		});
		expect(user).toContain('Zielgruppe: Gründer');
		expect(user).toContain('Ton: sachlich');
		expect(user).toContain('Zusätzliche Hinweise: mit einem Zitat beginnen');
	});

	it('embeds preset style principles into the system prompt', () => {
		const { system } = buildDraftPrompt({
			kind: 'blog',
			title: 'X',
			briefing: baseBriefing,
			stylePreset: preset(),
		});
		expect(system).toContain('Casual Blog');
		expect(system).toContain('Du-Form');
		expect(system).toContain('conversational');
	});

	it('renders resolved references as a "Quellen" block + flags it in system', () => {
		const refs: ResolvedReference[] = [
			{
				kind: 'note',
				sourceLabel: 'Notiz: Mein Gedanke',
				title: 'Mein Gedanke',
				content: 'kurze notiz',
				note: null,
			},
		];
		const { system, user } = buildDraftPrompt({
			kind: 'blog',
			title: 'X',
			briefing: baseBriefing,
			resolvedReferences: refs,
		});
		expect(system).toContain('2 Quellen verknüpft');
		expect(system).toContain('Paraphrasiere');
		expect(user).toContain('--- Quellen');
		expect(user).toContain('[Quelle 1] Artikel: NYT — Headline');
		expect(user).toContain('Kontext: wichtig fürs Argument');
		expect(user).toContain('[Quelle 2] Notiz: Mein Gedanke');
		expect(user).toContain('--- Ende Quellen ---');
	});

	it('does not mention Quellen when no references are resolved', () => {
		const { system, user } = buildDraftPrompt({
			kind: 'blog',
			title: 'X',
			briefing: baseBriefing,
			resolvedReferences: [],
		});
		expect(system).not.toContain('Quellen');
		expect(user).not.toContain('Quellen');
	});

	it('uses singular "Quelle" for exactly one reference', () => {
		const { system } = buildDraftPrompt({
			kind: 'blog',
			title: 'X',
			briefing: baseBriefing,
			resolvedReferences: [
				{
					kind: 'url',
					sourceLabel: 'Link: https://example.com',
					title: 'https://example.com',
					content: '',
					note: null,
				},
			],
		});
		expect(system).toContain('1 Quelle verknüpft');
		expect(system).not.toContain('1 Quellen');
	});
});

describe('selection prompts', () => {
	const ctx: SelectionContext = {
		selectionText: 'Dieser Satz ist redundant und enthält Füllwörter.',
		language: 'de',
	};

	it('buildShortenPrompt asks for ~50–60% length and fences the selection', () => {
		const { system, user } = buildShortenPrompt(ctx);
		expect(system).toContain('kürzt');
		// Trailer must be present for every selection prompt — it's what
		// keeps the model from prefixing "Hier ist…".
		expect(system).toContain('Nur der Ersatztext');
		expect(user).toContain('50–60%');
		expect(user).toContain('---\nDieser Satz ist redundant');
	});

	it('buildExpandPrompt asks for ~150–180% length', () => {
		const { user } = buildExpandPrompt(ctx);
		expect(user).toContain('150–180%');
	});

	it('buildChangeTonePrompt embeds the target tone', () => {
		const { user } = buildChangeTonePrompt(ctx, { targetTone: 'warm' });
		expect(user).toContain('"warm"');
	});

	it('buildRewritePrompt embeds the freeform instruction', () => {
		const { user } = buildRewritePrompt(ctx, { instruction: 'aktiver formulieren' });
		expect(user).toContain('aktiver formulieren');
	});

	it('buildTranslatePrompt drops the "keep source language" rule', () => {
		const { system, user } = buildTranslatePrompt(ctx, { targetLanguage: 'en' });
		expect(system).toContain('übersetzt');
		expect(user).toContain('English');
	});

	it('selection prompts inject the style hint when present', () => {
		const ctxWithStyle: SelectionContext = {
			...ctx,
			stylePreset: preset(),
		};
		const { system } = buildShortenPrompt(ctxWithStyle);
		expect(system).toContain('Stil-Kontext');
		expect(system).toContain('Casual Blog');
	});
});

describe('buildTitleSuggestionPrompt', () => {
	it('asks for 4–8 words, no quotes, no period, no prefix', () => {
		const { system, user } = buildTitleSuggestionPrompt({
			kind: 'blog',
			briefing: baseBriefing,
		});
		expect(system).toContain('4 bis 8 Wörter');
		expect(system).toContain('keine Anführungszeichen');
		expect(system).toContain('"Titel:"-Präfix');
		expect(user).toContain('Thema: Was Mana von');
		expect(user).toContain('Schlage genau einen Titel vor');
	});

	it('appends the excerpt block when provided', () => {
		const { user } = buildTitleSuggestionPrompt({
			kind: 'blog',
			briefing: baseBriefing,
			excerpt: 'Hier ist mein Entwurf-Anfang.',
		});
		expect(user).toContain('Aktueller Textauszug:');
		expect(user).toContain('Hier ist mein Entwurf-Anfang');
	});
});

describe('cleanSuggestedTitle', () => {
	it.each([
		['"Hello World"', 'Hello World'],
		["'Hello World'", 'Hello World'],
		['„Hello World"', 'Hello World'],
		['«Hello World»', 'Hello World'],
		['‚Hello World‘', 'Hello World'],
	])('strips wrapping quotes %s → %s', (raw, expected) => {
		expect(cleanSuggestedTitle(raw)).toBe(expected);
	});

	it('strips a "Titel:" prefix', () => {
		expect(cleanSuggestedTitle('Titel: Hello World')).toBe('Hello World');
		expect(cleanSuggestedTitle('Title: Hello World')).toBe('Hello World');
	});

	it('strips a single trailing period', () => {
		expect(cleanSuggestedTitle('Hello World.')).toBe('Hello World');
	});

	it('keeps "?" and "!" as intentional punctuation', () => {
		expect(cleanSuggestedTitle('Hello World?')).toBe('Hello World?');
		expect(cleanSuggestedTitle('Hello World!')).toBe('Hello World!');
	});

	it('keeps doubled periods (ellipsis-style)', () => {
		expect(cleanSuggestedTitle('Hello World..')).toBe('Hello World..');
	});

	it('trims surrounding whitespace', () => {
		expect(cleanSuggestedTitle('  Hello World  ')).toBe('Hello World');
	});

	it('returns empty string for empty input', () => {
		expect(cleanSuggestedTitle('')).toBe('');
		expect(cleanSuggestedTitle('   ')).toBe('');
	});

	it('handles combined artefacts in one pass', () => {
		expect(cleanSuggestedTitle('Titel: "Hello World".')).toBe('Hello World');
	});
});

describe('estimateMaxTokens', () => {
	it('clamps to the 256–8000 range', () => {
		const tiny: DraftBriefing = {
			...baseBriefing,
			targetLength: { type: 'words', value: 10 },
		};
		expect(estimateMaxTokens(tiny)).toBeGreaterThanOrEqual(256);

		const huge: DraftBriefing = {
			...baseBriefing,
			targetLength: { type: 'words', value: 100000 },
		};
		expect(estimateMaxTokens(huge)).toBeLessThanOrEqual(8000);
	});

	it('returns roughly 2x target words + buffer', () => {
		const briefing: DraftBriefing = {
			...baseBriefing,
			targetLength: { type: 'words', value: 1000 },
		};
		// 1000 * 2 + 200 = 2200
		expect(estimateMaxTokens(briefing)).toBe(2200);
	});

	it('handles minutes-of-speech via 150 words/minute', () => {
		const briefing: DraftBriefing = {
			...baseBriefing,
			targetLength: { type: 'minutes', value: 5 },
		};
		// 5 * 150 = 750 words → 750 * 2 + 200 = 1700
		expect(estimateMaxTokens(briefing)).toBe(1700);
	});

	it('handles chars unit via /5 words estimate', () => {
		const briefing: DraftBriefing = {
			...baseBriefing,
			targetLength: { type: 'chars', value: 5000 },
		};
		// 5000 / 5 = 1000 words → 2200
		expect(estimateMaxTokens(briefing)).toBe(2200);
	});

	it('falls back to 500 words when targetLength is missing', () => {
		const briefing: DraftBriefing = {
			...baseBriefing,
			targetLength: null,
		};
		// 500 * 2 + 200 = 1200
		expect(estimateMaxTokens(briefing)).toBe(1200);
	});
});

describe('language coverage', () => {
	it.each<DraftKind>(['blog', 'essay', 'email', 'social', 'story', 'cover-letter', 'speech'])(
		'kind=%s gets a German label in the system prompt',
		(kind) => {
			const { system } = buildDraftPrompt({
				kind,
				title: 'X',
				briefing: baseBriefing,
			});
			// Each kind should produce a non-empty German label fragment.
			expect(system.length).toBeGreaterThan(80);
			expect(system).toContain('Deutsch');
		}
	);
});
