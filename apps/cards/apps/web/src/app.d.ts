// Virtual modules provided by vite-plugin-pwa (wrapped by @vite-pwa/sveltekit):
//   - virtual:pwa-info            → pwaInfo.webManifest.linkTag for <svelte:head>
//   - virtual:pwa-register/svelte → useRegisterSW() Svelte-store hook
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/svelte" />

declare global {
	namespace App {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface Locals {}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface PageData {}
	}
}

export {};
