/**
 * AI moderation first-pass via mana-llm.
 *
 * Asks the model to classify a deck's content into one of three
 * verdicts: pass, flag, block. `flag` means a human reviewer should
 * look at it before the deck goes public; `block` means refuse the
 * publish outright.
 *
 * Per MARKETPLACE_PLAN principle 6: "AI is moderator, not gatekeeper"
 * — `block` is only used for unambiguous offences (CSAM, real-world
 * doxxing). Anything ambiguous flows to human review.
 *
 * Fail-open: if mana-llm is unreachable or returns malformed JSON,
 * the verdict defaults to `flag` so the human reviewer catches it.
 * Better a slow publish than a quietly-skipped check.
 */

const SYSTEM_PROMPT = `Du bist Inhalts-Moderator für eine Karteikarten-Plattform. Bewerte den vorgelegten Inhalt nach folgenden Kategorien:

- spam: Werbe-Spam, ohne erkennbaren Lerninhalt
- copyright: offensichtliche, lange Lehrbuch-Auszüge ohne Quelle/Lizenzhinweis
- nsfw: sexuell explizit, jugendgefährdend
- misinformation: nachweislich falsche Fakten als Tatsachen präsentiert (außerhalb subjektiver Themen)
- hate: Hassrede, Diskriminierung gegen geschützte Gruppen
- csam: Material, das Minderjährige sexualisiert (führt IMMER zu block)

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt:
{"verdict":"pass|flag|block","categories":["..."],"rationale":"kurze Begründung"}

Regeln:
- pass: keine Kategorien getroffen
- flag: eine oder mehrere Kategorien außer csam
- block: csam ODER unmissverständliche Kombination aus mehreren schweren Kategorien
- Im Zweifel: flag (nicht block) — eine menschliche Moderatorin entscheidet final.`;

export interface ModerationVerdict {
	verdict: 'pass' | 'flag' | 'block';
	categories: string[];
	rationale: string;
	model: string;
}

export interface ModerationInput {
	title: string;
	description?: string;
	cards: { fields: Record<string, string> }[];
}

const MODEL = process.env.AI_MODERATION_MODEL || 'gpt-4o-mini';
const MAX_CARDS_FOR_PROMPT = 50;

function buildPrompt(input: ModerationInput): string {
	const sample = input.cards.slice(0, MAX_CARDS_FOR_PROMPT).map((c, i) => {
		const fieldsStr = Object.entries(c.fields)
			.map(([k, v]) => `  ${k}: ${v}`)
			.join('\n');
		return `Karte ${i + 1}:\n${fieldsStr}`;
	});
	return [
		`Deck-Titel: ${input.title}`,
		input.description ? `Beschreibung: ${input.description}` : '',
		`Karten (${input.cards.length} insgesamt, erste ${sample.length} gezeigt):`,
		...sample,
	]
		.filter(Boolean)
		.join('\n\n');
}

function failOpen(rationale: string): ModerationVerdict {
	return {
		verdict: 'flag',
		categories: ['_internal'],
		rationale: `AI-Mod fail-open: ${rationale}`,
		model: MODEL,
	};
}

function stripCodeFences(s: string): string {
	return s
		.replace(/^\s*```(?:json)?\s*/i, '')
		.replace(/\s*```\s*$/i, '')
		.trim();
}

export async function moderateDeckContent(
	input: ModerationInput,
	llmUrl: string
): Promise<ModerationVerdict> {
	let res: Response;
	try {
		res = await fetch(`${llmUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: MODEL,
				temperature: 0,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: buildPrompt(input) },
				],
			}),
		});
	} catch (e) {
		return failOpen(`network: ${(e as Error).message}`);
	}

	if (!res.ok) return failOpen(`http ${res.status}`);

	const json = (await res.json().catch(() => null)) as {
		choices?: { message?: { content?: string } }[];
	} | null;
	const raw = json?.choices?.[0]?.message?.content?.trim();
	if (!raw) return failOpen('empty response');

	let parsed: { verdict?: unknown; categories?: unknown; rationale?: unknown };
	try {
		parsed = JSON.parse(stripCodeFences(raw));
	} catch {
		return failOpen('invalid JSON');
	}

	const verdict =
		parsed.verdict === 'pass' || parsed.verdict === 'flag' || parsed.verdict === 'block'
			? parsed.verdict
			: 'flag';
	const categories = Array.isArray(parsed.categories)
		? parsed.categories.filter((c): c is string => typeof c === 'string')
		: [];
	const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';

	return { verdict, categories, rationale, model: MODEL };
}
