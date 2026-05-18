<script lang="ts">
	// Side-effect: registers every per-Space seeder (workbench Home
	// scene + future module seeds) into the per-space-seeds map BEFORE
	// any code path can call `loadActiveSpace` / `setActiveSpace`.
	// See docs/plans/workbench-seeding-cleanup.md.
	import '$lib/data/seeds';

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { redirectToPortal, portalHref } from '$lib/auth/portal-redirect';
	import type { Component, Snippet } from 'svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import FeedbackQuickModal from '$lib/components/feedback/FeedbackQuickModal.svelte';
	import { onDestroy, setContext, tick } from 'svelte';
	import { createReminderScheduler } from '@mana/shared-stores';
	import { todoReminderSource } from '$lib/modules/todo/reminder-source';
	import { startEventStore, stopEventStore } from '$lib/data/events/event-store';
	import { startMissionTick, stopMissionTick } from '$lib/data/ai/missions/setup';
	import {
		startServerIterationExecutor,
		stopServerIterationExecutor,
	} from '$lib/data/ai/missions/server-iteration-executor';
	import { initTools } from '$lib/data/tools/init';
	import { startEventBridge, stopEventBridge } from '$lib/triggers/event-bridge';
	import { startStreakTracker, stopStreakTracker } from '$lib/data/projections/streaks';
	import { startWaveScheduler, stopWaveScheduler } from '$lib/modules/forms/lib/wave-scheduler';
	import { startGoalTracker, stopGoalTracker } from '$lib/companion/goals';
	import {
		startFeedbackToaster,
		stopFeedbackToaster,
	} from '$lib/notifications/feedback-toaster.svelte';
	import { initByok } from '$lib/byok';
	import { bottomBarStore } from '$lib/stores/bottom-bar.svelte';
	import { locale, _ } from 'svelte-i18n';
	import {
		PillNavigation,
		PillDropdownBar,
		TagStrip,
		DragPreview,
		ActionZone,
		QuickInputBar,
	} from '@mana/shared-ui';
	import type {
		PillNavItem,
		PillDropdownItem,
		PillBarConfig,
		SpotlightAction,
		ContentSearcher,
		ContextMenuItem,
	} from '@mana/shared-ui';
	import { ContextMenu } from '@mana/shared-ui';
	import { createWorkbenchContextMenu } from '$lib/context-menu';
	import type { InputBarAdapter } from '$lib/quick-input/types';
	import { getAdapterLoader } from '$lib/quick-input/registry';
	import { createFallbackAdapter } from '$lib/quick-input/fallback-adapter';
	import { AuthGate } from '@mana/shared-auth-ui';
	import { MANA_APPS, hasAppAccess, ACCESS_TIER_LABELS } from '@mana/shared-branding';
	import type { AccessTier } from '@mana/shared-branding';
	import { createGuestMode, type GuestMode } from '$lib/stores/guest-mode.svelte';
	import { guestPrompt, setGuestPromptNavigator } from '$lib/stores/guest-prompt.svelte';
	import { NotificationBar } from '@mana/shared-ui';
	import { tagLocalStore, tagMutations, useAllTags } from '@mana/shared-stores';
	import { linkLocalStore, linkMutations } from '@mana/shared-links';
	import { manaStore } from '$lib/data/local-store';
	import { startLlmQueue, stopLlmQueue } from '$lib/llm-queue';
	import { useAiTierItems } from '$lib/components/layout/use-ai-tier-items.svelte';
	import { useSyncStatusItems } from '$lib/components/layout/use-sync-status-items.svelte';
	import RouteTierGate from '$lib/components/layout/RouteTierGate.svelte';
	import SpaceSwitcher from '$lib/components/layout/SpaceSwitcher.svelte';
	import { getEffectiveTier } from '$lib/data/scope';
	import { useLocalStt } from '$lib/components/voice/use-local-stt.svelte';
	import { Microphone, Stop } from '@mana/shared-icons';
	import { createUnifiedSync, restoreClientIdFromDexie } from '$lib/data/sync';
	import { cleanupOrphanMigrationFlags } from '$lib/data/migrations-cleanup';
	import { bootstrapSingletons } from '$lib/data/bootstrap-singletons';
	import { syncBilling } from '$lib/stores/sync-billing.svelte';
	import { networkStore } from '$lib/stores/network.svelte';
	import { db } from '$lib/data/database';
	import { dashboardStore } from '$lib/stores/dashboard.svelte';
	import {
		THEME_DEFINITIONS,
		DEFAULT_THEME_VARIANTS,
		EXTENDED_THEME_VARIANTS,
	} from '@mana/shared-theme';
	import type { ThemeVariant } from '@mana/shared-theme';
	import { getLanguageDropdownItems, getCurrentLanguageLabel } from '@mana/shared-i18n';
	import { setLocale, supportedLocales, type SupportedLocale } from '$lib/i18n';
	import { ManaEvents, AppEvents } from '@mana/shared-utils/analytics';
	import { setUser as setErrorTrackingUser } from '@mana/shared-error-tracking/browser';
	import { trackReturnVisit, trackModuleUsed, markAsGuest } from '$lib/stores/funnel-tracking';
	import { theme } from '$lib/stores/theme';
	import { authStore } from '$lib/stores/auth.svelte';
	import { userSettings } from '$lib/stores/user-settings.svelte';
	import { isNavCollapsed as collapsedStore } from '$lib/stores/navigation';
	import { onboardingStatus } from '$lib/stores/onboarding-status.svelte';
	import { getPillAppItems } from '@mana/shared-branding';
	import { STORAGE_KEYS } from '$lib/config/storage-keys';
	import { SearchRegistry } from '$lib/search/registry';
	import { registerAllProviders } from '$lib/search/providers';
	import { initSharedUload } from '@mana/shared-uload';
	import type { DragPayload } from '@mana/shared-ui/dnd';
	import WallpaperLayer from '$lib/components/wallpaper/WallpaperLayer.svelte';
	import { wallpaperStore } from '$lib/stores/wallpaper.svelte';

	let { children }: { children: Snippet } = $props();

	// ── Idle-defer helper ───────────────────────────────────
	// Runs work when the browser is idle so first interaction isn't
	// blocked by non-critical init (telemetry, schedulers, side-effect
	// streams). Falls back to setTimeout on browsers without
	// requestIdleCallback.
	function idle(cb: () => void, timeout = 2000) {
		if (typeof window === 'undefined') return;
		const ric = (
			window as unknown as {
				requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void;
			}
		).requestIdleCallback;
		if (ric) ric(cb, { timeout });
		else setTimeout(cb, 0);
	}

	// ── Onboarding mode ─────────────────────────────────────
	// When the user is on any /onboarding/* route the main chrome
	// (PillNav, wallpaper, bottom-stack) is hidden so the three
	// onboarding screens get the full viewport. The route guard
	// below also reads this flag to avoid redirecting a user who
	// is already inside the flow.
	let isOnboarding = $derived($page.url.pathname.startsWith('/onboarding'));

	// Full-bleed routes skip the max-w-7xl clamp + horizontal padding so
	// the module can use the full viewport width. Currently used by the
	// website editor — a canvas-style tool where the centre preview
	// shouldn't fight two sidebars inside a 1280px container.
	let isFullBleedRoute = $derived(/^\/website\/[^/]+\/edit\/[^/]+/.test($page.url.pathname));

	// ── App switcher ────────────────────────────────────────
	// Prefer the active Space's tier for gating — falls back to the user
	// tier only during the bootstrap window where no space has loaded.
	let effectiveTier = $derived(getEffectiveTier(authStore.user?.tier));
	let appItems = $derived(getPillAppItems('mana', undefined, undefined, effectiveTier));

	// ── Per-route tier gate ─────────────────────────────────
	// AuthGate (the wrapping component) only checks tiers onMount and only
	// for authenticated users — so a guest typing /dreams into the URL bar
	// or a public-tier user navigating into a founder module would slip
	// past silently. This reactive check looks up the first path segment
	// in MANA_APPS, and if that app has a requiredTier the current user
	// (or guest) doesn't meet, we render a denial panel instead of the
	// routed view.
	//
	// Routes that don't map to a MANA_APPS id (settings, profile, admin,
	// help, …) fall through with `routeAppId === null` and are never
	// blocked here. Workbench `/` (empty first segment) likewise passes
	// through — soft-filtering of openApps happens in (app)/+page.svelte.
	let routeAppId = $derived.by(() => {
		const seg = $page.url.pathname.split('/')[1] ?? '';
		if (!seg) return null;
		return MANA_APPS.find((a) => a.id === seg) ?? null;
	});
	let routeBlocked = $derived.by(() => {
		if (!routeAppId) return false;
		return !hasAppAccess(effectiveTier, routeAppId.requiredTier);
	});
	let routeTierLabels = $derived.by(() => {
		const labels = ACCESS_TIER_LABELS[($locale || 'de') === 'de' ? 'de' : 'en'];
		const tier = effectiveTier as AccessTier;
		const required = routeAppId?.requiredTier ?? ('public' as AccessTier);
		return {
			user: labels[tier] ?? tier,
			required: labels[required] ?? required,
		};
	});

	// ── UI State ────────────────────────────────────────────
	let isCollapsed = $state(false);
	let showShortcuts = $state(false);

	// ── Theme ───────────────────────────────────────────────
	let isDark = $derived(theme.isDark);
	let pinnedThemes = $derived<ThemeVariant[]>(
		(userSettings.theme?.pinnedThemes || []).filter((t): t is ThemeVariant =>
			EXTENDED_THEME_VARIANTS.includes(t as ThemeVariant)
		)
	);
	let visibleThemes = $derived<ThemeVariant[]>([...DEFAULT_THEME_VARIANTS, ...pinnedThemes]);
	let themeVariantItems = $derived<PillDropdownItem[]>([
		...visibleThemes.map((variant) => ({
			id: variant,
			label: THEME_DEFINITIONS[variant].label,
			icon: THEME_DEFINITIONS[variant].icon,
			onClick: () => theme.setVariant(variant),
			active: theme.variant === variant,
		})),
		{
			id: 'all-themes',
			label: $_('nav.all_themes'),
			icon: 'palette',
			onClick: () => goto('/?app=themes'),
			active: false,
		},
	]);
	let currentThemeVariantLabel = $derived(THEME_DEFINITIONS[theme.variant].label);

	// ── i18n ────────────────────────────────────────────────
	let currentLocale = $derived($locale || 'de');
	function handleLocaleChange(newLocale: string) {
		if (supportedLocales.includes(newLocale as SupportedLocale)) {
			setLocale(newLocale as SupportedLocale);
		}
		userSettings.updateGlobal({ locale: newLocale });
		AppEvents.languageChanged(newLocale);
	}

	// Sync locale from user settings (backend) after login
	$effect(() => {
		if (userSettings.loaded && userSettings.locale) {
			const settingsLocale = userSettings.locale;
			if (
				supportedLocales.includes(settingsLocale as SupportedLocale) &&
				settingsLocale !== $locale
			) {
				setLocale(settingsLocale as SupportedLocale);
			}
		}
	});
	let languageItems = $derived(
		getLanguageDropdownItems(supportedLocales, currentLocale, handleLocaleChange)
	);
	let currentLanguageLabel = $derived(getCurrentLanguageLabel(currentLocale));

	// ── AI Tier Selector (PillNav dropdown) ─────────────────
	const aiTier = useAiTierItems();

	// ── Sync status dropdown ────────────────────────────────
	const syncStatus = useSyncStatusItems();

	// ── User / Guest awareness ──────────────────────────────
	let userEmail = $derived(
		authStore.isAuthenticated ? authStore.user?.email || $_('nav.menu') : ''
	);

	// ── Bottom-stack single-bar policy ───────────────────────
	// Only one bar may be open at a time. Opening one closes the others.
	const allTags = useAllTags();
	let isTagStripVisible = $state(false);
	let isQuickInputVisible = $state(false);
	let isBottomBarVisible = $state(false);
	let activeBar = $state<PillBarConfig | null>(null);

	// Quick-feedback modal — opened from the user-menu chip ("Idee teilen").
	// Replaces the older floating "Idee?" pill so feedback lives in the same
	// affordance as Profile / Credits / Logout.
	let feedbackModalOpen = $state(false);
	let feedbackModuleContext = $derived.by(() => {
		const path = $page.url.pathname;
		const seg = path.split('/').filter(Boolean)[0];
		const fromPath = seg && !seg.startsWith('(') ? seg : null;
		return $page.url.searchParams.get('app') ?? fromPath ?? undefined;
	});

	function closeAllBars() {
		isTagStripVisible = false;
		isQuickInputVisible = false;
		isBottomBarVisible = false;
		activeBar = null;
	}

	function handleTagStripToggle() {
		const next = !isTagStripVisible;
		closeAllBars();
		isTagStripVisible = next;
	}

	function handleQuickInputToggle() {
		const next = !isQuickInputVisible;
		closeAllBars();
		isQuickInputVisible = next;
	}

	function handleBottomBarToggle() {
		const next = !isBottomBarVisible;
		closeAllBars();
		isBottomBarVisible = next;
	}

	function handleOpenBar(config: PillBarConfig | null) {
		closeAllBars();
		activeBar = config;
	}
	function closeActiveBar() {
		activeBar = null;
	}

	// ── Fullscreen mode (press "f" to toggle) ───────────────
	// Hides the entire bottom-stack (pill nav, QuickInputBar, TagStrip,
	// notifications, bottom bar) so only the routed page content
	// (e.g. workbench pages) is visible. Esc exits.
	let isFullscreen = $state(false);

	// Bottom chrome height: calculated from state, not measured (avoids reflow loop)
	const bottomChromeHeight = $derived(
		isFullscreen
			? 0
			: (isCollapsed ? 0 : 56) +
					(activeBar ? 64 : 0) +
					(isTagStripVisible ? 64 : 0) +
					(isQuickInputVisible ? 64 : 0) +
					(isBottomBarVisible && bottomBarStore.component ? 64 : 0)
	);

	// ── DnD context ─────────────────────────────────────────
	let tagDropHandler = $state<((tagId: string, payload: DragPayload) => void) | null>(null);
	setContext('tagDropHandler', {
		set(handler: (tagId: string, payload: DragPayload) => void) {
			tagDropHandler = handler;
		},
		clear() {
			tagDropHandler = null;
		},
	});

	// ── Navigation Context Menu ──────────────────────────────
	const navCtxMenu = createWorkbenchContextMenu();

	function makeNavContextMenu(href: string): (e: MouseEvent) => void {
		return (e: MouseEvent) => {
			e.preventDefault();
			const items: ContextMenuItem[] = [
				{
					id: 'open-new-tab',
					label: 'In neuem Tab öffnen',
					action: () => window.open(href, '_blank'),
				},
				{
					id: 'copy-link',
					label: 'Link kopieren',
					action: () => navigator.clipboard.writeText(window.location.origin + href),
				},
			];
			navCtxMenu.open(e, href, items);
		};
	}

	// ── Navigation ──────────────────────────────────────────
	// System pages (spiral, credits, profile, themes, help) are workbench
	// apps now — no standalone routes. The user-menu dropdown links via
	// `spiralHref` / `creditsHref` / `profileHref` etc., all pointing to
	// `/?app=<id>` deep-links.
	let isOnWorkbench = $derived($page.url.pathname === '/');
	let baseNavItems = $derived<PillNavItem[]>([
		isOnWorkbench
			? {
					href: '/',
					label: 'Workbench-Tabs',
					icon: 'tabs',
					iconOnly: true,
					onClick: handleBottomBarToggle,
					active: isBottomBarVisible,
				}
			: {
					href: '/',
					label: 'Home',
					icon: 'home',
					iconOnly: true,
					onClick: () => goto('/'),
					active: false,
				},
		{
			href: '/',
			label: 'Suche',
			icon: 'search',
			iconOnly: true,
			onClick: handleQuickInputToggle,
			active: isQuickInputVisible,
		},
		{
			href: '/',
			label: $_('nav.tags'),
			icon: 'tag',
			iconOnly: true,
			onClick: handleTagStripToggle,
			active: isTagStripVisible,
		},
	]);

	let isAdmin = $derived(authStore.user?.role === 'admin');
	let navItems = $derived<PillNavItem[]>(
		isAdmin ? [...baseNavItems, { href: '/admin', label: 'Admin', icon: 'shield' }] : baseNavItems
	);
	let navRoutes = $derived(navItems.map((item) => item.href));

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}
		if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
			showShortcuts = !showShortcuts;
			return;
		}
		if (
			(event.key === 'f' || event.key === 'F') &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey
		) {
			event.preventDefault();
			isFullscreen = !isFullscreen;
			return;
		}
		if (event.key === 'Escape' && isFullscreen) {
			event.preventDefault();
			isFullscreen = false;
			return;
		}
		if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
			const num = parseInt(event.key);
			if (num >= 1 && num <= navRoutes.length) {
				event.preventDefault();
				const route = navRoutes[num - 1];
				if (route) goto(route);
			}
			return;
		}
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		switch (event.key) {
			case 'q':
			case 'Q':
				event.preventDefault();
				handleBottomBarToggle();
				return;
			case 'w':
			case 'W':
				event.preventDefault();
				handleQuickInputToggle();
				return;
			case 'e':
			case 'E':
				event.preventDefault();
				handleTagStripToggle();
				return;
			case 'r':
			case 'R':
				event.preventDefault();
				(async () => {
					if (isCollapsed) handleCollapsedChange(false);
					await tick();
					document.querySelector<HTMLButtonElement>('[data-user-menu-trigger]')?.click();
				})();
				return;
			case 't':
			case 'T':
				event.preventDefault();
				if (!isCollapsed) closeAllBars();
				handleCollapsedChange(!isCollapsed);
				return;
		}
	}

	function handleCollapsedChange(collapsed: boolean) {
		isCollapsed = collapsed;
		collapsedStore.set(collapsed);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEYS.NAV_COLLAPSED, String(collapsed));
		}
	}

	function handleToggleTheme() {
		theme.toggleMode();
		AppEvents.themeChanged(theme.isDark ? 'dark' : 'light');
	}

	function handleThemeModeChange(mode: 'light' | 'dark' | 'system') {
		theme.setMode(mode);
		AppEvents.themeChanged(mode);
	}

	// ── Sync ────────────────────────────────────────────────
	const SYNC_SERVER_URL =
		(typeof window !== 'undefined' &&
			(window as unknown as Record<string, unknown>).__PUBLIC_SYNC_SERVER_URL__) ||
		import.meta.env.PUBLIC_SYNC_SERVER_URL ||
		'http://localhost:3050';
	let unifiedSync: ReturnType<typeof createUnifiedSync> | null = null;
	const reminderScheduler = createReminderScheduler({
		sources: [todoReminderSource],
	});

	async function handleSignOut() {
		unifiedSync?.stopAll();
		guestMode?.destroy();
		setErrorTrackingUser(null);
		await authStore.signOut();
		redirectToPortal({ next: '/' });
	}

	// ── Guest Mode ──────────────────────────────────────────
	let guestMode = $state<GuestMode | null>(null);

	// ── Lazy-loaded UI (modals, toasts, banners) ────────────
	// Static imports for these were adding weight to the initial layout
	// bundle for components that are rarely-to-never visible on first
	// paint. Each is fetched either on first demand (modals) or shortly
	// after idle (always-mounted toasts/banners that self-gate).
	// Permissive prop typing — props are validated at the call site
	// where {@const} narrows the component back to its concrete type.
	type AnyComponent = Component<any>;
	let KeyboardShortcutsModalC = $state<AnyComponent | null>(null);
	let GuestWelcomeModalC = $state<AnyComponent | null>(null);
	let SessionWarningC = $state<AnyComponent | null>(null);
	let EncryptionIntroBannerC = $state<AnyComponent | null>(null);
	let SuggestionToastC = $state<AnyComponent | null>(null);
	let NudgeToastC = $state<AnyComponent | null>(null);

	// On-demand: only fetch when the user actually opens them.
	$effect(() => {
		if (showShortcuts && !KeyboardShortcutsModalC) {
			import('$lib/components/KeyboardShortcutsModal.svelte').then((m) => {
				KeyboardShortcutsModalC = m.default;
			});
		}
	});
	$effect(() => {
		if (guestMode?.showWelcome && !GuestWelcomeModalC) {
			import('@mana/shared-auth-ui').then((m) => {
				GuestWelcomeModalC = m.GuestWelcomeModal;
			});
		}
	});

	// Idle-mount: background toasts/banners that self-gate internally.
	// Deferring the import also defers their transitive deps
	// (automationsStore, day-snapshot projection, streaks, crypto gate).
	idle(() => {
		void import('$lib/components/SuggestionToast.svelte').then((m) => {
			SuggestionToastC = m.default;
		});
		void import('$lib/components/NudgeToast.svelte').then((m) => {
			NudgeToastC = m.default;
		});
		void import('$lib/components/EncryptionIntroBanner.svelte').then((m) => {
			EncryptionIntroBannerC = m.default;
		});
		void import('$lib/components/SessionWarning.svelte').then((m) => {
			SessionWarningC = m.default;
		});
	});

	// ── Auth Ready (replaces monolith onMount) ──────────────
	async function handleAuthReady() {
		// Wire the unified guest-prompt singleton to SvelteKit's `goto`
		// so the "Anmelden" button does a client-side transition instead
		// of the default full-page reload. Idempotent — safe to call on
		// every auth-ready cycle. If the user signs in successfully,
		// drop any leftover guest prompts so the bottom bar starts the
		// authenticated session clean.
		setGuestPromptNavigator((href) => goto(href));
		if (authStore.isAuthenticated) guestPrompt.clear();

		// Phase A (critical): the local-store inits are required before
		// liveQueries anywhere downstream (TagStrip, module list views)
		// can return non-empty results. Keep these awaited.
		await Promise.all([
			manaStore.initialize(),
			tagLocalStore.initialize(),
			linkLocalStore.initialize(),
		]);

		// Phase A-idle: side-effect streams, telemetry, projection workers.
		// All idempotent and self-gated; deferring to the next idle frame
		// lets the first paint + interaction land without waiting on
		// event-bridge wiring or LLM-queue reclaim work.
		idle(() => {
			// uload-Federation: schreibt direkt gegen die föderierte
			// uload-API (Code/uload/), nicht mehr in lokale Dexie+mana-sync.
			// Override URL via PUBLIC_ULOAD_API_URL (dev: http://localhost:3107).
			initSharedUload({
				apiUrl: import.meta.env.PUBLIC_ULOAD_API_URL ?? 'https://uload-api.mana.how',
				getAuthToken: () => authStore.getValidToken(),
				shortUrlOrigin: import.meta.env.PUBLIC_ULOAD_SHORT_ORIGIN ?? 'https://ulo.ad',
			});
			startEventStore();
			initTools();
			startEventBridge();
			startStreakTracker();
			startGoalTracker();
			startFeedbackToaster();
			initByok();
			startLlmQueue();
			// dashboardStore only drives /dashboard — safe to defer; other
			// routes don't read from it on first paint.
			void dashboardStore.initialize();
			reminderScheduler.start();
			// AI Mission tick — scans pendingProposals/aiMissions on an
			// interval and runs any that are due. Safe idempotent; see
			// data/ai/missions/setup.ts.
			startMissionTick();
			// Forms wave-scheduler (M10c) — auto-fires due recurring-form
			// waves via mana-mail bulk-send while the tab is open. No-op
			// without broadcasts settings configured. Headless cron is
			// M10d (server-side worker in mana-ai or mana-notify).
			startWaveScheduler();
			// Apply server-planned iterations locally on sync — see
			// data/ai/missions/server-iteration-executor.ts.
			startServerIterationExecutor();
		});

		// Restore nav collapsed state (cheap, keep inline)
		if (typeof localStorage !== 'undefined') {
			const savedCollapsed = localStorage.getItem(STORAGE_KEYS.NAV_COLLAPSED);
			if (savedCollapsed === 'true') {
				isCollapsed = true;
				collapsedStore.set(true);
			}
		}

		// Phase B (critical): sync for authenticated users. Data delivery
		// is user-visible via the pending-count badge, so we keep the
		// sync engine boot on the critical path.
		if (authStore.isAuthenticated) {
			setErrorTrackingUser({ id: authStore.user?.id ?? 'unknown', email: authStore.user?.email });
			// Multi-Agent Workbench (Phase 1): bind the real user identity
			// to the ambient Actor so subsequent writes stamp principalId +
			// displayName correctly instead of 'legacy:user' / 'Du'.
			const { bindDefaultUser } = await import('$lib/data/events/actor');
			const uid = authStore.user?.id ?? 'unknown';
			const name = authStore.user?.name || authStore.user?.email || 'Du';
			bindDefaultUser(uid, name);

			// Spaces foundation: resolve the user's active Space from Better
			// Auth before sync runs so pending-change rows get stamped with a
			// real organization id (not the `_personal:<userId>` sentinel the
			// v28 migration leaves behind). Failure is non-fatal — the scope
			// wrapper falls back to the sentinel, sync still pushes with a
			// NULL space_id, and the next boot retries. See
			// docs/plans/spaces-foundation.md.
			try {
				const { loadActiveSpace, reconcileSentinels } = await import('$lib/data/scope');
				await loadActiveSpace();
				const rewritten = await reconcileSentinels();
				if (rewritten > 0) {
					console.info(`[spaces] reconciled ${rewritten} sentinel records to active space`);
				}
			} catch (err) {
				console.warn('[spaces] active-space boot failed — sync will use sentinel scope', err);
			}

			await syncBilling.load();
			// F6: reconcile the per-device sync client_id between Dexie
			// (canonical) and localStorage (cache) before the sync engine
			// reads it. A localStorage wipe gets restored from Dexie here,
			// so the next push/pull keeps the same identity the server
			// already knows.
			await restoreClientIdFromDexie();
			// Sweep stale localStorage flags from migration helpers that
			// have since been deleted (F7 + future cleanups).
			cleanupOrphanMigrationFlags();
			// Reconcile per-user + per-Space singletons via mana-auth's
			// idempotent bootstrap endpoint before the sync engine starts
			// pulling. Best-effort — failures fall back to the in-store
			// `getOrCreateLocalDoc()` path that handles the rare race
			// where a write happens before the bootstrap row arrives.
			void bootstrapSingletons();
			const getToken = () => authStore.getValidToken();
			unifiedSync = createUnifiedSync(SYNC_SERVER_URL, getToken, syncBilling.active);
			// Expose on window for SYNC_DEBUG.md (Schritt C). Not a security
			// concern: every method on the returned object is also reachable
			// via Dexie + a fresh fetch from the same DevTools console, and
			// the production user can't escalate anything by poking at it.
			if (typeof window !== 'undefined') {
				(window as unknown as { __unifiedSync: typeof unifiedSync }).__unifiedSync = unifiedSync;
			}
			const refreshPendingCount = async () => {
				try {
					const count = await db.table('_pendingChanges').count();
					networkStore.setPendingCount(count);
				} catch {
					// DB not ready yet
				}
			};
			unifiedSync.onStatusChange(async (s) => {
				networkStore.setSyncStatus(s);
				// Update pending count when sync status changes
				await refreshPendingCount();
			});
			unifiedSync.onBillingRequired(() => {
				// Server returned 402 — sync subscription expired or paused
				syncBilling.load();
			});
			unifiedSync.startAll();
			// Seed the badge count on mount: onStatusChange only fires on
			// transitions, so without this the badge stays at its last known
			// value (0 on a fresh tab) until a sync actually runs.
			refreshPendingCount();

			// Onboarding guard: brand-new users land on `/` after signup
			// but have `onboardingCompletedAt === null`. Redirect them
			// into the 3-screen flow. Fired non-blocking because the
			// earlier Phase A already initialized the data layer, so
			// leaving sync running in parallel during onboarding is
			// harmless (and useful — templates/+page.svelte writes a
			// scene at the end). Self-skips when already inside the
			// flow so the screens don't bounce each other.
			if (!isOnboarding) {
				void onboardingStatus.load().then(() => {
					if (onboardingStatus.needsOnboarding) {
						goto('/onboarding/name', { replaceState: true });
					}
				});
			}

			// Phase B-idle: settings + return-visit telemetry. Non-gating.
			idle(async () => {
				trackReturnVisit();
				userSettings.load().catch(() => {});
			});
		}
		// IMPORTANT: do NOT call notificationService.requestPermission() here.
		// Browsers (Chrome/Firefox) require permission requests to come from
		// a user gesture. Calling it at mount time queues the prompt until
		// the next click, which means the FIRST click on any button (e.g.
		// the dreams "Traum sprechen" mic button) shows a notification
		// permission popup instead of the action the user actually clicked
		// — and getUserMedia() / other permission requests get silently
		// dropped because Chrome only shows one permission dialog at a time.
		//
		// Notification permission must be requested from a button the user
		// explicitly clicks ("Benachrichtigungen aktivieren" toggle in
		// Settings, or first time a reminder is created). The reminder
		// scheduler still runs without permission — it just won't fire
		// OS notifications until the user grants it.

		// Phase C: Guest mode — welcome modal + nudge
		if (!authStore.isAuthenticated) {
			markAsGuest();
			guestMode = createGuestMode('mana', {
				nudgeDelayMinutes: 3,
				onRegister: () => redirectToPortal({ target: 'register' }),
			});
		}
	}

	onDestroy(() => {
		unifiedSync?.stopAll();
		reminderScheduler.stop();
		stopEventStore();
		stopEventBridge();
		stopStreakTracker();
		stopGoalTracker();
		stopFeedbackToaster();
		stopMissionTick();
		stopWaveScheduler();
		stopServerIterationExecutor();
		guestMode?.destroy();
		// Fire-and-forget — we don't need to await; the in-flight task
		// will finish in the background and the next page session will
		// pick up where we left off.
		void stopLlmQueue();
	});

	// ── Search / Spotlight ───────────────────────────────────
	const searchRegistry = new SearchRegistry();
	registerAllProviders(searchRegistry);

	const contentSearcher: ContentSearcher = async (query, signal) => {
		return searchRegistry.search(query, { signal });
	};

	// ── Local STT (speech-to-text via Whisper in browser) ───
	const localStt = useLocalStt({ language: ($locale || 'de') === 'de' ? 'de' : 'en' });

	// When STT finishes transcription, feed the text into the current
	// module's QuickInputBar adapter (create action). This makes voice
	// input context-aware: on /todo it creates a task, on /calendar an
	// event, on / it searches, etc.
	// Transcribed text is injected into the QuickInputBar so the user
	// can see, edit, and confirm it before creating anything.
	let sttInjectedText = $state('');
	$effect(() => {
		const t = localStt.text;
		const e = localStt.error;
		if (import.meta.env.DEV && e) {
			console.warn('[layout-stt] Error:', e);
		}
		if (t) {
			sttInjectedText = t;
		}
	});

	// ── QuickInputBar — context-aware adapter per module ─────
	let inputBarAdapter = $state<InputBarAdapter>(createFallbackAdapter(searchRegistry));
	let activeModulePrefix = $state<string | null>(null);

	$effect(() => {
		const pathname = $page.url.pathname;
		const moduleSlug = '/' + pathname.split('/')[1];

		if (moduleSlug === activeModulePrefix) return;

		// Track module usage + ensure lazy sync for this module
		const moduleName = pathname.split('/')[1];
		if (moduleName && authStore.isAuthenticated) {
			trackModuleUsed(moduleName);
			unifiedSync?.ensureAppSynced(moduleName);
		}

		const loader = getAdapterLoader(pathname);
		if (!loader) {
			inputBarAdapter = createFallbackAdapter(searchRegistry);
			activeModulePrefix = null;
			return;
		}

		const target = moduleSlug;
		loader().then(({ createAdapter }) => {
			if (target === '/' + $page.url.pathname.split('/')[1]) {
				inputBarAdapter = createAdapter() as InputBarAdapter;
				activeModulePrefix = target;
			}
		});
	});

	const spotlightActions: SpotlightAction[] = [
		{ id: 'home', label: 'Home', category: 'Navigation', onExecute: () => goto('/') },
		{
			id: 'spiral',
			label: 'Mana Spiral',
			category: 'Navigation',
			onExecute: () => goto('/?app=spiral'),
		},
		{
			id: 'credits',
			label: 'Credits',
			category: 'Navigation',
			onExecute: () => goto('/?app=credits'),
		},
		{
			id: 'settings',
			label: 'Einstellungen',
			category: 'Navigation',
			onExecute: () => goto('/?app=settings'),
		},
	];
</script>

<svelte:window onkeydown={handleKeydown} />

<AuthGate
	{authStore}
	{goto}
	allowGuest={true}
	onReady={handleAuthReady}
	appName="Mana"
	locale={($locale || 'de') === 'de' ? 'de' : 'en'}
>
	{#if isOnboarding}
		<!-- Onboarding mode: clean slate — the onboarding shell layout
			 renders a full-viewport container with its own progress dots
			 and skip-all. Keep AuthGate wrapping so the screens still
			 enforce the authenticated-user requirement. -->
		{@render children()}
	{:else}
		<div class="min-h-screen" class:bg-background={!wallpaperStore.hasWallpaper}>
			<WallpaperLayer config={wallpaperStore.effective} />

			<!-- Bottom Stack: all fixed-bottom elements in one flex container.
			 Hidden entirely when fullscreen mode is active (press "f"). -->
			{#if !isFullscreen}
				<div class="bottom-stack" style:--bottom-chrome-height="{bottomChromeHeight}px">
					<!-- Page-injected bottom bar (e.g. workbench scene+app tabs).
				 Gated by isBottomBarVisible so the "workbench tabs" pill can
				 toggle it without unmounting the owning page. -->
					{#if isBottomBarVisible && bottomBarStore.component}
						{@const BarComponent = bottomBarStore.component}
						<BarComponent {...bottomBarStore.props} />
					{/if}

					<!-- One-time encryption intro — sits at the top of the stack so
				 it can't be obscured by the QuickInputBar / TagStrip / PillNav.
				 Self-gates on isVaultUnlocked() so guests never see it.
				 Lazy-loaded after idle (see $effects above). -->
					{#if EncryptionIntroBannerC}
						{@const EncryptionIntroBanner = EncryptionIntroBannerC}
						<div class="bottom-stack-notification">
							<EncryptionIntroBanner />
						</div>
					{/if}

					<!-- Sync pause banner — shown when sync was paused due to insufficient credits -->
					{#if syncBilling.paused}
						<div class="bottom-stack-notification">
							<div
								class="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
							>
								<span>Cloud Sync pausiert — Credits reichen nicht aus.</span>
								<div class="flex gap-2">
									<a
										href="/?app=credits&tab=packages"
										class="font-medium underline hover:no-underline"
									>
										Credits aufladen
									</a>
									<a
										href="/?app=settings#cloud-sync"
										class="font-medium underline hover:no-underline"
									>
										Sync-Einstellungen
									</a>
								</div>
							</div>
						</div>
					{/if}

					<!-- Guest notifications — combines the time-based nudge from
				 createGuestMode (one-shot after N minutes) with the
				 event-driven prompts pushed by guestPrompt.requireAccount
				 (e.g. server feature called while signed out, 401 from
				 the auth-aware fetch). Both flow into the same bar so
				 the user only ever sees one stripe instead of stacking. -->
					{#if (guestMode && guestMode.notifications.length > 0) || guestPrompt.notifications.length > 0}
						<div class="bottom-stack-notification">
							<NotificationBar
								notifications={[...(guestMode?.notifications ?? []), ...guestPrompt.notifications]}
							/>
						</div>
					{/if}

					<!-- Session expiry warning (auth only). Self-gates on the
				 secondsLeft countdown and only renders inside the stack
				 when actually warning, so the wrapper is no-op otherwise.
				 Lazy-loaded after idle. -->
					{#if authStore.isAuthenticated && SessionWarningC}
						{@const SessionWarning = SessionWarningC}
						<div class="bottom-stack-notification">
							<SessionWarning />
						</div>
					{/if}

					<!-- Cross-module automation suggestions. Lives in the (app)
				 stack because automationsStore is an (app)-only module
				 and the toast doesn't make sense on auth/landing pages
				 anyway. Self-gates on visible state. Lazy-loaded after idle. -->
					{#if SuggestionToastC}
						{@const SuggestionToast = SuggestionToastC}
						<div class="bottom-stack-notification">
							<SuggestionToast />
						</div>
					{/if}

					<!-- Companion Brain pulse nudges — water reminders, streak
				 warnings, morning summary etc. Self-gates on active nudges.
				 Lazy-loaded after idle. -->
					{#if NudgeToastC}
						{@const NudgeToast = NudgeToastC}
						<div class="bottom-stack-notification">
							<NudgeToast />
						</div>
					{/if}

					<!-- QuickInputBar with inline nav toggle — gated by the "search" pill -->
					{#if isQuickInputVisible}
						<QuickInputBar
							onSearch={inputBarAdapter.onSearch}
							onSelect={inputBarAdapter.onSelect}
							onParseCreate={inputBarAdapter.onParseCreate}
							onCreate={inputBarAdapter.onCreate}
							onSearchChange={inputBarAdapter.onSearchChange}
							placeholder={inputBarAdapter.placeholder}
							appIcon={inputBarAdapter.appIcon}
							emptyText={inputBarAdapter.emptyText}
							createText={inputBarAdapter.createText}
							deferSearch={inputBarAdapter.deferSearch}
							locale={$locale || 'de'}
							defaultOptions={inputBarAdapter.defaultOptions}
							selectedDefaultId={inputBarAdapter.selectedDefaultId}
							defaultOptionLabel={inputBarAdapter.defaultOptionLabel}
							onDefaultChange={inputBarAdapter.onDefaultChange}
							highlightPatterns={inputBarAdapter.highlightPatterns}
							positioning="static"
							injectedText={sttInjectedText}
						>
							{#snippet leftAction()}
								<button
									class="stt-mic-btn"
									class:recording={localStt.state === 'recording'}
									class:busy={localStt.state === 'loading' || localStt.state === 'transcribing'}
									onclick={() => localStt.toggle()}
									disabled={localStt.state === 'loading' || localStt.state === 'transcribing'}
									title={localStt.state === 'recording'
										? 'Aufnahme beenden'
										: localStt.state === 'transcribing'
											? 'Wird transkribiert…'
											: localStt.state === 'loading'
												? 'Modell wird geladen…'
												: 'Spracheingabe'}
								>
									{#if localStt.state === 'recording'}
										<Stop size={16} weight="fill" />
									{:else}
										<Microphone size={16} weight={localStt.state === 'idle' ? 'regular' : 'fill'} />
									{/if}
								</button>
							{/snippet}
						</QuickInputBar>
					{/if}

					<!-- TagStrip (between QuickInputBar and PillNav) -->
					{#if isTagStripVisible}
						<TagStrip
							tags={(allTags.value ?? []).map((t) => ({
								id: t.id,
								name: t.name,
								color: t.color || '#3b82f6',
							}))}
							selectedIds={[]}
							onToggle={() => {}}
							onClear={() => {}}
							onTagDrop={tagDropHandler ?? undefined}
							managementHref="/tags"
							loading={allTags.loading}
							positioning="static"
						/>
					{/if}

					<!-- Dropdown-as-bar: shows the items of the currently opened
				 PillNavigation dropdown (theme / AI / sync / user) as
				 horizontal pills directly above the PillNav. -->
					{#if activeBar}
						<PillDropdownBar
							items={activeBar.items}
							label={activeBar.label}
							icon={activeBar.icon}
							positioning="static"
						/>
					{/if}

					<!-- PillNav (bottom of stack) -->
					<PillNavigation
						onOpenBar={handleOpenBar}
						activeBarId={activeBar?.id ?? null}
						items={navItems}
						currentPath={$page.url.pathname}
						appName="Mana"
						homeRoute="/"
						onLogout={handleSignOut}
						onToggleTheme={handleToggleTheme}
						{isDark}
						{isCollapsed}
						onCollapsedChange={handleCollapsedChange}
						showThemeToggle={true}
						showThemeVariants={true}
						{themeVariantItems}
						{currentThemeVariantLabel}
						themeMode={theme.mode}
						onThemeModeChange={handleThemeModeChange}
						showLanguageSwitcher={true}
						{languageItems}
						{currentLanguageLabel}
						showLogout={authStore.isAuthenticated}
						loginHref={portalHref()}
						primaryColor="hsl(var(--color-primary))"
						showAppSwitcher={false}
						showAiTierSelector={true}
						aiTierItems={aiTier.items}
						currentAiTierLabel={aiTier.label}
						currentAiTierIcon={aiTier.icon}
						showSyncStatus={authStore.isAuthenticated}
						syncStatusItems={syncStatus.items}
						currentSyncLabel={syncStatus.label}
						{appItems}
						{userEmail}
						profileHref="/?app=profile"
						spiralHref="/?app=spiral"
						creditsHref="/?app=credits"
						themesHref="/?app=themes"
						helpHref="/?app=help"
						onFeedback={() => (feedbackModalOpen = true)}
						{spotlightActions}
						{contentSearcher}
						positioning="static"
					>
						{#snippet startSlot()}
							{#if authStore.isAuthenticated}
								<SpaceSwitcher locale={$locale === 'en' ? 'en' : 'de'} />
							{/if}
						{/snippet}
					</PillNavigation>
				</div>
			{/if}

			<!-- DnD: floating preview -->
			<DragPreview />

			<!-- Main content.
			 Publish layout offsets as CSS variables so descendants (esp.
			 ModuleShell in the carousel) can compute their available
			 height against viewport + bottom chrome without prop
			 drilling. `--workbench-top-offset` must match the vertical
			 padding on the inner max-w-7xl wrapper below. -->
			<main
				style="padding-bottom: {bottomChromeHeight +
					8}px; --bottom-chrome-height: {bottomChromeHeight}px; --workbench-reserved-y: 1.5rem;"
				class="pt-2"
			>
				<div
					class={isFullBleedRoute
						? 'w-full'
						: 'mx-auto max-w-7xl px-3 py-2 sm:px-6 sm:py-3 lg:px-8'}
				>
					{#if routeBlocked && routeAppId}
						<RouteTierGate
							appName={routeAppId.name}
							userTierLabel={routeTierLabels.user}
							requiredTierLabel={routeTierLabels.required}
						/>
					{:else}
						{@render children()}
					{/if}
				</div>
			</main>

			<!-- Session expiry warning lives inside .bottom-stack now (see above)
			 so it doesn't end up obscured by the QuickInputBar like
			 EncryptionIntroBanner used to be. -->

			<!-- Keyboard shortcuts modal — loaded on first `?` press -->
			{#if KeyboardShortcutsModalC}
				{@const KeyboardShortcutsModal = KeyboardShortcutsModalC}
				<KeyboardShortcutsModal open={showShortcuts} onclose={() => (showShortcuts = false)} />
			{/if}
		</div>
	{/if}

	<!-- Navigation Context Menu -->
	<ContextMenu
		visible={navCtxMenu.state.visible}
		x={navCtxMenu.state.x}
		y={navCtxMenu.state.y}
		items={navCtxMenu.items}
		onClose={() => navCtxMenu.close()}
	/>

	<!-- Guest Welcome Modal — loaded when guest mode activates -->
	{#if guestMode && GuestWelcomeModalC}
		{@const GuestWelcomeModal = GuestWelcomeModalC}
		<GuestWelcomeModal
			appId="mana"
			visible={guestMode.showWelcome}
			onClose={() => guestMode?.dismissWelcome()}
			onLogin={() => redirectToPortal()}
			onRegister={() => redirectToPortal({ target: 'register' })}
			locale={($locale || 'de') === 'de' ? 'de' : 'en'}
		/>
	{/if}

	<!-- Quick-feedback modal — opened from the user-menu chip. -->
	<FeedbackQuickModal
		open={feedbackModalOpen}
		moduleContext={feedbackModuleContext}
		onClose={() => (feedbackModalOpen = false)}
	/>
</AuthGate>

<ToastContainer />

<style>
	.bottom-stack {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 90;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		/* Bars stack flush — each bar's own wrapper controls its height,
		   so visual breathing room comes from inside the bar, not the gap. */
		gap: 0;
		pointer-events: none;
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}

	.bottom-stack > :global(*) {
		pointer-events: auto;
	}

	/* STT mic button inside QuickInputBar leftAction slot */
	.stt-mic-btn {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 50%;
		border: none;
		background: hsl(var(--color-foreground, 0 0% 90%) / 0.08);
		color: hsl(var(--color-foreground, 0 0% 90%) / 0.5);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		padding: 0;
	}

	.stt-mic-btn:hover:not(:disabled) {
		background: hsl(var(--color-foreground, 0 0% 90%) / 0.15);
		color: hsl(var(--color-primary, 239 84% 67%));
	}

	.stt-mic-btn:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.stt-mic-btn.recording {
		background: hsl(var(--color-error, 0 84% 60%) / 0.15);
		color: hsl(var(--color-error, 0 84% 60%));
		animation: stt-pulse 1.5s ease-in-out infinite;
	}

	.stt-mic-btn.busy {
		animation: stt-spin 1s linear infinite;
	}

	@keyframes stt-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 hsl(var(--color-error, 0 84% 60%) / 0.3);
		}
		50% {
			box-shadow: 0 0 0 4px hsl(var(--color-error, 0 84% 60%) / 0);
		}
	}

	@keyframes stt-spin {
		from {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
		to {
			opacity: 0.5;
		}
	}

	.bottom-stack-notification {
		display: flex;
		justify-content: center;
		/* Only horizontal padding — vertical spacing comes from the
		   parent .bottom-stack `gap`, so all bars are evenly spaced
		   regardless of how many children they nest. */
		padding: 0 1rem;
	}
</style>
