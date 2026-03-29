<script lang="ts">
	import { Sparkles, Loader2, ArrowLeft, Mail, CheckCircle2 } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	let email = $state('');
	let isLoading = $state(false);
	let isSent = $state(false);
	let error = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email) return;

		isLoading = true;
		error = '';

		// Mock API call
		try {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			isSent = true;
		} catch (err) {
			error = 'Something went wrong. Please try again.';
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
			<h1 class="text-3xl font-bold text-niva-text font-[Manrope] tracking-tight">Recover access</h1>
			<p class="text-sm text-niva-text-secondary mt-2">Enter your email to receive a reset link</p>
		</div>

		<div class="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden">
			{#if isSent}
				<div in:fade class="text-center space-y-6 py-4">
					<div class="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-2">
						<CheckCircle2 size={32} class="text-green-400" />
					</div>
					<div>
						<h3 class="text-lg font-bold text-niva-text">Check your inbox</h3>
						<p class="text-sm text-niva-text-secondary mt-2">
							We've sent a recovery link to <span class="text-niva-accent font-medium">{email}</span>.
						</p>
					</div>
					<a href="/login" class="inline-flex items-center gap-2 text-sm font-bold text-niva-accent hover:text-niva-accent/80 transition-colors pt-2">
						<ArrowLeft size={16} />
						Back to Sign In
					</a>
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6 animate-fade-in">
					{#if error}
						<div class="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
							<div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
							{error}
						</div>
					{/if}

					<div class="space-y-2.5">
						<label for="email" class="text-xs font-bold text-niva-text-secondary uppercase tracking-widest pl-1">Email Address</label>
						<div class="relative">
							<Mail size={16} class="absolute left-4 top-1/2 -translate-y-1/2 text-niva-text-secondary" />
							<input
								id="email"
								type="email"
								bind:value={email}
								placeholder="name@company.com"
								required
								class="w-full h-12 pl-12 pr-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/50 focus:bg-white/8 transition-all duration-300"
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={isLoading}
						class="w-full h-12 rounded-2xl bg-niva-accent text-niva-bg text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 niva-glow-sm"
					>
						{#if isLoading}
							<Loader2 size={18} class="animate-spin" />
							<span>Processing...</span>
						{:else}
							<span>Send Reset Link</span>
						{/if}
					</button>

					<div class="text-center pt-2">
						<a href="/login" class="inline-flex items-center gap-2 text-xs font-bold text-niva-text-secondary hover:text-white transition-colors">
							<ArrowLeft size={14} />
							Back to Sign In
						</a>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
