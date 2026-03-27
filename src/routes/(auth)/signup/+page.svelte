<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { Sparkles, Loader2 } from '@lucide/svelte';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	async function handleSignup(e: Event) {
		e.preventDefault();
		if (!username || !email || !password) return;

		isLoading = true;
		error = '';

		try {
			await api.auth.signup(username, email, password);
			goto('/chat');
		} catch (err: any) {
			error = err.message || 'Signup failed';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="min-h-screen bg-niva-bg flex items-center justify-center p-4">
	<div class="w-full max-w-sm">
		<!-- Branding -->
		<div class="text-center mb-8">
			<div class="w-14 h-14 rounded-2xl niva-gradient flex items-center justify-center niva-glow mx-auto mb-4">
				<Sparkles size={24} class="text-niva-accent" />
			</div>
			<h1 class="text-2xl font-bold text-niva-text font-[Manrope]">Join Niva</h1>
			<p class="text-sm text-niva-text-secondary mt-1">Create your AI intelligence account</p>
		</div>

		<!-- Signup Form -->
		<form onsubmit={handleSignup} class="glass-panel rounded-2xl p-6 space-y-5">
			{#if error}
				<div class="p-3 rounded-xl bg-niva-error-bg/50 border border-niva-error/20 text-niva-error text-sm">
					{error}
				</div>
			{/if}

			<div class="space-y-2">
				<label for="username" class="text-sm font-medium text-niva-text">Username</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					placeholder="Your name"
					required
					class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/40 transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<label for="email" class="text-sm font-medium text-niva-text">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					required
					class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/40 transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<label for="password" class="text-sm font-medium text-niva-text">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="●●●●●●●●"
					required
					class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/40 transition-colors"
				/>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="w-full h-10 rounded-xl bg-niva-accent text-niva-bg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
			>
				{#if isLoading}
					<Loader2 size={16} class="animate-spin" />
					Creating account...
				{:else}
					Create Account
				{/if}
			</button>
		</form>

		<p class="text-center text-sm text-niva-text-secondary mt-6">
			Already have an account?
			<a href="/login" class="text-niva-accent hover:underline font-medium">Sign in</a>
		</p>
	</div>
</div>
