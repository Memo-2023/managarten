<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { ShieldCheck } from '@mana/shared-icons';
	import { PasskeyManager, TwoFactorSetup, AuditLog, SessionManager } from '@mana/shared-auth-ui';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		passkeys as passkeysClient,
		sessions as sessionsClient,
		twoFactor as twoFactorClient,
		audit as auditClient,
		type PasskeyEntry,
		type SessionEntry,
		type SecurityEvent,
	} from '$lib/auth/settings-client';
	import SettingsPanel from '../SettingsPanel.svelte';
	import SettingsSectionHeader from '../SettingsSectionHeader.svelte';
	import VaultSection from './VaultSection.svelte';

	let passkeys = $state<PasskeyEntry[]>([]);
	let passkeyAvailable = $state(false);
	let sessions = $state<SessionEntry[]>([]);
	let sessionsLoading = $state(false);
	let securityEvents = $state<SecurityEvent[]>([]);
	let securityEventsLoading = $state(false);

	// Adapter: die UI-Komponenten erwarten `{ success, error? }`-Returns,
	// unsere Settings-Client-Methoden werfen. Hier einmal zentral übersetzen.
	function asResult<T>(p: Promise<T>): Promise<{ success: boolean; error?: string }> {
		return p
			.then(() => ({ success: true as const }))
			.catch((e: unknown) => ({
				success: false as const,
				error: e instanceof Error ? e.message : String(e),
			}));
	}

	async function handleEnable(password: string) {
		try {
			const r = await twoFactorClient.enable(password);
			return { success: true as const, totpURI: r.uri, backupCodes: r.backupCodes };
		} catch (e) {
			return { success: false as const, error: e instanceof Error ? e.message : String(e) };
		}
	}

	async function handleGenerateBackupCodes(password: string) {
		try {
			const r = await twoFactorClient.generateBackupCodes(password);
			return { success: true as const, backupCodes: r.backupCodes };
		} catch (e) {
			return { success: false as const, error: e instanceof Error ? e.message : String(e) };
		}
	}

	onMount(async () => {
		if (!authStore.isAuthenticated) return;
		try {
			const cap = await passkeysClient.capability();
			passkeyAvailable = cap.available;
			passkeys = await passkeysClient.list();
			sessionsLoading = true;
			sessions = await sessionsClient.list();
			sessionsLoading = false;
			securityEventsLoading = true;
			securityEvents = await auditClient.getSecurityEvents();
			securityEventsLoading = false;
		} catch (e) {
			console.error('SecuritySection load failed:', e);
			sessionsLoading = false;
			securityEventsLoading = false;
		}
	});
</script>

<SettingsPanel>
	<SettingsSectionHeader
		icon={ShieldCheck}
		title={$_('settings.security.title')}
		description={$_('settings.security.description')}
		tone="blue"
	/>
</SettingsPanel>

<SettingsPanel id="passkeys">
	<PasskeyManager
		{passkeys}
		{passkeyAvailable}
		onRegister={(name) => asResult(passkeysClient.register(name))}
		onDelete={(id) => asResult(passkeysClient.delete(id))}
		onRename={(id, name) => asResult(passkeysClient.rename(id, name))}
		onRefresh={async () => {
			passkeys = await passkeysClient.list();
		}}
		primaryColor="hsl(var(--color-primary))"
	/>
</SettingsPanel>

<SettingsPanel id="sessions">
	<SessionManager
		{sessions}
		loading={sessionsLoading}
		onRevoke={(id) => asResult(sessionsClient.revoke(id))}
		onRefresh={async () => {
			sessionsLoading = true;
			sessions = await sessionsClient.list();
			sessionsLoading = false;
		}}
		primaryColor="hsl(var(--color-primary))"
	/>
</SettingsPanel>

<SettingsPanel id="two-factor">
	<TwoFactorSetup
		enabled={!!authStore.user?.twoFactorEnabled}
		onEnable={handleEnable}
		onDisable={(password) => asResult(twoFactorClient.disable(password))}
		onGenerateBackupCodes={handleGenerateBackupCodes}
		primaryColor="hsl(var(--color-primary))"
	/>
</SettingsPanel>

<SettingsPanel id="vault">
	<VaultSection />
</SettingsPanel>

<SettingsPanel id="security-log">
	<AuditLog
		events={securityEvents}
		loading={securityEventsLoading}
		onRefresh={async () => {
			securityEventsLoading = true;
			securityEvents = await auditClient.getSecurityEvents();
			securityEventsLoading = false;
		}}
		primaryColor="hsl(var(--color-primary))"
	/>
</SettingsPanel>
