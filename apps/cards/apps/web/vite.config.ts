import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { createPWAConfig } from '@mana/shared-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA(
			createPWAConfig({
				name: 'Cards',
				shortName: 'Cards',
				description: 'Karteikarten mit Spaced Repetition',
				themeColor: '#0a0a0a',
			})
		),
	],
});
