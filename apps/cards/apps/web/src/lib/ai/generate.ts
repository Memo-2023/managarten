/**
 * AI card generation — text → list of basic cards via mana-llm.
 *
 * Uses mana-llm's OpenAI-compatible /v1/chat/completions endpoint with
 * a system prompt that constrains the output to a JSON array. We strip
 * Markdown code fences before parsing because most chat models wrap
 * JSON output in ```json blocks even when explicitly told not to.
 *
 * No streaming — we need the full JSON before we can show anything.
 * Phase-2 ideas: chunk long inputs, PDF parsing, image OCR.
 */

const SYSTEM_PROMPT = `Du bist ein Karteikarten-Generator. Aus dem vom Nutzer gegebenen Text erstellst du Lernkarten zum Auswendiglernen.

Regeln:
- Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Erklärung, ohne Markdown-Code-Fences.
- Schema: [{"front": "Frage oder Begriff", "back": "Antwort"}, ...]
- 5–15 Karten je nach Textlänge.
- Front: kurze, präzise Frage oder ein Begriff. Back: prägnante Antwort, max. 2 Sätze.
- Eine Karte pro klar abgegrenzter Faktenerinnerung — nicht ganze Absätze umkopieren.
- Sprache: dieselbe wie der Quelltext.`;

export interface GeneratedCard {
	front: string;
	back: string;
}

function llmUrl(): string {
	if (typeof window !== 'undefined') {
		const fromWindow = (window as unknown as { __PUBLIC_MANA_LLM_URL__?: string })
			.__PUBLIC_MANA_LLM_URL__;
		if (fromWindow) return fromWindow.replace(/\/$/, '');
	}
	return 'http://localhost:3025';
}

function stripCodeFences(s: string): string {
	return s
		.replace(/^\s*```(?:json|javascript|js)?\s*/i, '')
		.replace(/\s*```\s*$/i, '')
		.trim();
}

function defaultModel(): string {
	if (typeof window !== 'undefined') {
		const fromWindow = (window as unknown as { __PUBLIC_CARDS_AI_MODEL__?: string })
			.__PUBLIC_CARDS_AI_MODEL__;
		if (fromWindow) return fromWindow;
	}
	// mana-llm proxies many providers — this id matches what the
	// playground module uses as a sensible default. Adjust per env via
	// __PUBLIC_CARDS_AI_MODEL__ injection.
	return 'gpt-4o-mini';
}

export async function generateCardsFromText(
	source: string,
	opts: { model?: string; signal?: AbortSignal } = {}
): Promise<GeneratedCard[]> {
	const trimmed = source.trim();
	if (!trimmed) return [];

	const res = await fetch(`${llmUrl()}/v1/chat/completions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		signal: opts.signal,
		body: JSON.stringify({
			model: opts.model ?? defaultModel(),
			temperature: 0.3,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: trimmed },
			],
		}),
	});

	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new Error(`mana-llm: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
	}

	const json = (await res.json()) as {
		choices?: { message?: { content?: string } }[];
	};
	const raw = json.choices?.[0]?.message?.content?.trim();
	if (!raw) throw new Error('Leere Antwort vom LLM erhalten.');

	let parsed: unknown;
	try {
		parsed = JSON.parse(stripCodeFences(raw));
	} catch (e) {
		throw new Error(`LLM-Antwort war kein gültiges JSON:\n${raw.slice(0, 200)}`);
	}

	if (!Array.isArray(parsed)) {
		throw new Error('LLM-Antwort ist kein Array.');
	}

	const cards: GeneratedCard[] = [];
	for (const item of parsed) {
		if (
			typeof item === 'object' &&
			item !== null &&
			typeof (item as GeneratedCard).front === 'string' &&
			typeof (item as GeneratedCard).back === 'string'
		) {
			const c = item as GeneratedCard;
			if (c.front.trim() && c.back.trim()) {
				cards.push({ front: c.front.trim(), back: c.back.trim() });
			}
		}
	}

	if (cards.length === 0) {
		throw new Error('Keine gültigen Karten in der LLM-Antwort gefunden.');
	}
	return cards;
}
