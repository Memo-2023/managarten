/**
 * PDF text extraction using pdfjs-dist.
 *
 * Loads each page, walks the text layer, joins items with spaces and
 * pages with double newlines so the LLM gets a structured input. We
 * don't try to preserve columns / tables — the use case is "feed me
 * the prose so I can make cards", not document fidelity.
 *
 * Worker is wired via Vite's `?worker` suffix so the heavy parsing
 * happens off the main thread (PDF extraction is CPU-heavy).
 */

import * as pdfjs from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

let workerWired = false;
function ensureWorker() {
	if (workerWired) return;
	pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker();
	workerWired = true;
}

export interface PdfExtractResult {
	text: string;
	pageCount: number;
}

export async function extractTextFromPdf(file: File | Blob): Promise<PdfExtractResult> {
	ensureWorker();
	const buffer = await file.arrayBuffer();
	const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

	const pages: string[] = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const page = await doc.getPage(i);
		const content = await page.getTextContent();
		const pieces: string[] = [];
		for (const item of content.items) {
			if (typeof (item as { str?: string }).str === 'string') {
				pieces.push((item as { str: string }).str);
			}
		}
		pages.push(
			pieces
				.join(' ')
				.replace(/[ \t]+/g, ' ')
				.trim()
		);
	}

	await doc.destroy();
	return {
		text: pages.filter(Boolean).join('\n\n'),
		pageCount: doc.numPages,
	};
}
