<script lang="ts">
	import { goto } from '$app/navigation';
	import { RegisterPage } from '@mana/shared-auth-ui';
	import { authStore } from '$lib/stores/auth.svelte';
	import CardsLogo from '$lib/components/CardsLogo.svelte';

	async function handleSignUp(email: string, password: string) {
		return authStore.signUp(email, password);
	}

	async function handleResendVerification(email: string) {
		return authStore.resendVerificationEmail(email);
	}
</script>

<RegisterPage
	appName="Cards"
	logo={CardsLogo}
	primaryColor="#6366f1"
	onSignUp={handleSignUp}
	onResendVerification={handleResendVerification}
	{goto}
	successRedirect="/"
	loginPath="/login"
	lightBackground="#f5f5f5"
	darkBackground="#0a0a0a"
/>
