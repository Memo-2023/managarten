<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { LoginPage } from '@mana/shared-auth-ui';
	import { authStore } from '$lib/stores/auth.svelte';
	import CardsLogo from '$lib/components/CardsLogo.svelte';

	const verified = $derived(page.url.searchParams.get('verified') === 'true');
	const initialEmail = $derived(page.url.searchParams.get('email') || '');

	async function handleSignIn(email: string, password: string) {
		return authStore.signIn(email, password);
	}

	async function handleResendVerification(email: string) {
		return authStore.resendVerificationEmail(email);
	}
</script>

<LoginPage
	appName="Cards"
	logo={CardsLogo}
	primaryColor="#6366f1"
	onSignIn={handleSignIn}
	onResendVerification={handleResendVerification}
	{goto}
	successRedirect="/"
	registerPath="/register"
	forgotPasswordPath="/forgot-password"
	lightBackground="#f5f5f5"
	darkBackground="#0a0a0a"
	isDark
	{verified}
	{initialEmail}
/>
