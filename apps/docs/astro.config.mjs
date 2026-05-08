import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://docs.mana.how',
	integrations: [
		starlight({
			title: 'Mana Docs',
			description:
				'Documentation for the Mana ecosystem - a multi-app platform with shared infrastructure.',
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				replacesTitle: false,
			},
			social: {
				github: 'https://github.com/Memo-2023/managarten',
			},
			editLink: {
				baseUrl: 'https://github.com/Memo-2023/managarten/edit/main/apps/docs/',
			},
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
						{ label: 'Project Structure', slug: 'getting-started/project-structure' },
					],
				},
				{
					label: 'Development',
					items: [
						{ label: 'Local Development', slug: 'development/local-development' },
						{ label: 'Environment Variables', slug: 'development/environment-variables' },
						{ label: 'Docker Setup', slug: 'development/docker' },
						{ label: 'Database Migrations', slug: 'development/database-migrations' },
						{ label: 'Testing', slug: 'development/testing' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
						{ label: 'Authentication', slug: 'architecture/authentication' },
						{ label: 'Security & Encryption', slug: 'architecture/security' },
						{ label: 'Backend (NestJS)', slug: 'architecture/backend' },
						{ label: 'Web (SvelteKit)', slug: 'architecture/web' },
						{ label: 'Mobile (Expo)', slug: 'architecture/mobile' },
						{ label: 'Search Service', slug: 'architecture/search' },
						{ label: 'Storage', slug: 'architecture/storage' },
					],
				},
				{
					label: 'Guidelines',
					items: [
						{ label: 'Code Style', slug: 'guidelines/code-style' },
						{ label: 'Error Handling', slug: 'guidelines/error-handling' },
						{ label: 'Database Patterns', slug: 'guidelines/database' },
						{ label: 'Design & UX', slug: 'guidelines/design-ux' },
					],
				},
				{
					label: 'Deployment',
					items: [
						{ label: 'Overview', slug: 'deployment/overview' },
						{ label: 'Cloudflare Pages', slug: 'deployment/cloudflare-pages' },
						{ label: 'Mac Mini Server', slug: 'deployment/mac-mini-server' },
						{ label: 'Self-Hosting', slug: 'deployment/self-hosting' },
					],
				},
				{
					label: 'Projects',
					collapsed: true,
					items: [
						{ label: 'Overview', slug: 'projects' },
						{ label: 'Chat', slug: 'projects/chat' },
					],
				},
				{
					label: 'API Reference',
					collapsed: true,
					items: [{ label: 'Overview', slug: 'api' }],
				},
			],
			head: [
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: 'https://docs.mana.how/og-image.png',
					},
				},
				{
					tag: 'script',
					content: `
						// Set dark mode as default
						(function() {
							const stored = localStorage.getItem('starlight-theme');
							if (!stored) {
								document.documentElement.dataset.theme = 'dark';
								localStorage.setItem('starlight-theme', 'dark');
							}
						})();
					`,
				},
			],
		}),
		tailwind({ applyBaseStyles: false }),
		sitemap(),
	],
});
