<script lang="ts">
	import { page } from '$app/stores';
	import { api, type Message } from '$lib/api';
	import { Sparkles, Globe } from '@lucide/svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';

	let shareId = $derived($page.params.id);
	let conversation = $state<any>(null);
	let messages = $state<Message[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	async function loadSharedChat() {
		if (!shareId) return;
		try {
			isLoading = true;
			const data = await api.public.getShared(shareId);
			conversation = data.conversation;
			messages = data.messages;
		} catch (err: any) {
			error = err.message || "Failed to load shared conversation.";
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (shareId) loadSharedChat();
	});
</script>

<svelte:head>
	<title>{conversation?.title || 'Shared Chat'} | Niva AI</title>
</svelte:head>

<div class="flex flex-col h-screen bg-niva-bg text-niva-text overflow-hidden">
	<!-- Header -->
	<header class="h-14 glass-panel-strong flex items-center justify-between px-6 shrink-0 border-b border-niva-glass-border">
		<div class="flex items-center gap-3">
			<Sparkles size={18} class="text-niva-accent" />
			<h1 class="text-sm font-semibold truncate max-w-xs">{conversation?.title || 'Shared Conversation'}</h1>
		</div>
		<div class="flex items-center gap-2">
			<Globe size={14} class="text-niva-text-secondary" />
			<span class="text-[10px] font-medium text-niva-text-secondary uppercase tracking-wider">Public Share</span>
		</div>
	</header>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto niva-scrollbar px-4 md:px-8 py-8">
		<div class="max-w-3xl mx-auto space-y-8">
			{#if isLoading}
				<div class="flex flex-col items-center justify-center h-64 gap-4">
					<div class="w-8 h-8 border-2 border-niva-accent border-t-transparent rounded-full animate-spin"></div>
					<p class="text-sm text-niva-text-secondary">Loading shared conversation...</p>
				</div>
			{:else if error}
				<div class="flex flex-col items-center justify-center h-64 gap-4 text-center">
					<div class="w-12 h-12 rounded-full bg-niva-error-bg flex items-center justify-center text-niva-error">
						<Globe size={24} />
					</div>
					<div>
						<h2 class="text-lg font-bold text-niva-text mb-1">Link Expired or Invalid</h2>
						<p class="text-sm text-niva-text-secondary">{error}</p>
					</div>
				</div>
			{:else}
				{#each messages as msg}
					<ChatMessage message={msg} />
				{/each}
				
				<div class="pt-12 pb-20 text-center border-t border-niva-glass-border">
					<p class="text-sm text-niva-text-secondary mb-4">Want to start your own conversation with Niva?</p>
					<a 
						href="/signup" 
						class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-niva-accent text-niva-bg font-bold hover:scale-105 transition-transform niva-glow-sm"
					>
						<Sparkles size={16} />
						Try Niva AI Free
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--niva-bg);
	}
</style>
