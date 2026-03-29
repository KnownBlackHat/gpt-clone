<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { Sparkles, Loader2 } from '@lucide/svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!email || !password) return;

		isLoading = true;
		error = '';

		try {
			await api.auth.login(email, password);
			goto('/chat');
		} catch (err: any) {
			error = err.message || 'Login failed';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="min-h-screen bg-niva-bg flex items-center justify-center p-4 relative overflow-hidden">
	<!-- Background Decorations -->
	<div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-niva-accent/10 rounded-full blur-[120px] animate-float"></div>
	<div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-float" style="animation-delay: -5s;"></div>

	<div class="w-full max-w-sm relative z-10 animate-slide-up">
		<!-- Branding -->
		<div class="text-center mb-10">
			<div class="w-16 h-16 rounded-2xl niva-gradient flex items-center justify-center niva-glow mx-auto mb-6 transform hover:scale-105 transition-transform duration-300">
				<Sparkles size={28} class="text-niva-accent" />
			</div>
			<h1 class="text-3xl font-bold text-niva-text font-[Manrope] tracking-tight">Welcome back</h1>
			<p class="text-sm text-niva-text-secondary mt-2">Enter your credentials to access Niva AI</p>
		</div>

		<!-- Login Form -->
		<form onsubmit={handleLogin} class="glass-panel rounded-3xl p-8 space-y-6 shadow-2xl">
			{#if error}
				<div class="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-fade-in">
					<div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
					{error}
				</div>
			{/if}

			<div class="space-y-2.5">
				<label for="email" class="text-xs font-bold text-niva-text-secondary uppercase tracking-widest pl-1">Email Address</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="name@company.com"
					required
					class="w-full h-12 px-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/50 focus:bg-white/8 transition-all duration-300"
				/>
			</div>

			<div class="space-y-2.5">
				<div class="flex items-center justify-between pl-1">
					<label for="password" class="text-xs font-bold text-niva-text-secondary uppercase tracking-widest">Password</label>
					<a href="/forgot-password" class="text-[11px] text-niva-accent hover:text-niva-accent/80 transition-colors font-semibold">Forgot?</a>
				</div>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					required
					class="w-full h-12 px-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/50 focus:bg-white/8 transition-all duration-300"
				/>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="w-full h-12 rounded-2xl bg-niva-accent text-niva-bg text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 niva-glow-sm"
			>
				{#if isLoading}
					<Loader2 size={18} class="animate-spin" />
					<span>Authenticating...</span>
				{:else}
					<span>Sign In to Niva</span>
				{/if}
			</button>
		</form>

		<p class="text-center text-sm text-niva-text-secondary mt-8 font-medium">
			New to Niva AI?
			<a href="/signup" class="text-niva-accent hover:text-niva-accent/80 transition-colors font-bold ml-1">Create an account</a>
		</p>
	</div>
</div>
