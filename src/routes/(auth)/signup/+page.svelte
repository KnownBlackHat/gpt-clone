<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { Sparkles, Loader2 } from '@lucide/svelte';

	// local state for the form - keeping it simple
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	async function onUserSignUp(e: Event) {
		e.preventDefault();
		
		// basic guard - browser validation should catch most of this though
		if (!username.trim() || !email.trim() || !password) return;

		isLoading = true;
		error = '';

		try {
			// hit the signup endpoint and hope for the best
			await api.auth.signup(username, email, password);
			
			// if we're here, we're good to go. redirect to main app.
			goto('/chat');
		} catch (err: any) {
			// note: backend should return a 'message' field on error
			error = err.message || 'Something went wrong during signup.';
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
			<h1 class="text-3xl font-bold text-niva-text font-[Manrope] tracking-tight">Join Niva</h1>
			<p class="text-sm text-niva-text-secondary mt-2">Create your AI intelligence account</p>
		</div>

		<!-- Signup Form -->
		<form onsubmit={onUserSignUp} class="glass-panel rounded-3xl p-8 space-y-5 shadow-2xl">
			{#if error}
				<div class="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-fade-in">
					<div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
					{error}
				</div>
			{/if}

			<div class="space-y-2">
				<label for="username" class="text-xs font-bold text-niva-text-secondary uppercase tracking-widest pl-1">Username</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					placeholder="Alex Rivera"
					required
					class="w-full h-11 px-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/50 focus:bg-white/8 transition-all duration-300"
				/>
			</div>

			<div class="space-y-2">
				<label for="email" class="text-xs font-bold text-niva-text-secondary uppercase tracking-widest pl-1">Email Address</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="alex@example.com"
					required
					class="w-full h-11 px-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/50 focus:bg-white/8 transition-all duration-300"
				/>
			</div>

			<div class="space-y-2">
				<label for="password" class="text-xs font-bold text-niva-text-secondary uppercase tracking-widest pl-1">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					required
					class="w-full h-11 px-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/50 focus:bg-white/8 transition-all duration-300"
				/>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="w-full h-12 mt-4 rounded-2xl bg-niva-accent text-niva-bg text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 niva-glow-sm"
			>
				{#if isLoading}
					<Loader2 size={18} class="animate-spin" />
					<span>Creating Account...</span>
				{:else}
					<span>Launch Your AI</span>
				{/if}
			</button>
		</form>

		<p class="text-center text-sm text-niva-text-secondary mt-8 font-medium">
			Already have an account?
			<a href="/login" class="text-niva-accent hover:text-niva-accent/80 transition-colors font-bold ml-1">Sign in instead</a>
		</p>
	</div>
</div>
