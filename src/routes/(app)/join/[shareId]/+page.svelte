<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { Loader2, UserPlus, AlertCircle } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	const shareId = page.params.shareId as string;
	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');

	async function joinConversation() {
		try {
			const { conversationId } = await api.groupChat.joinByLink(shareId);
			status = 'success';
			// Short delay to show success state
			setTimeout(() => {
				goto(`/chat/${conversationId}`);
			}, 1000);
		} catch (err: any) {
			status = 'error';
			errorMessage = err.message || 'Failed to join conversation. The link might be invalid or expired.';
		}
	}

	onMount(() => {
		joinConversation();
	});
</script>

<svelte:head>
	<title>Joining Conversation | Niva AI</title>
</svelte:head>

<div class="fixed inset-0 flex items-center justify-center bg-niva-bg p-6">
	<div 
		class="max-w-md w-full glass-panel-strong border border-niva-glass-border rounded-3xl p-8 md:p-12 text-center space-y-6 niva-glow"
		in:fade={{ duration: 400 }}
	>
		{#if status === 'loading'}
			<div class="space-y-4">
				<div class="w-16 h-16 rounded-full niva-gradient flex items-center justify-center mx-auto animate-pulse">
					<UserPlus size={28} class="text-niva-accent" />
				</div>
				<h1 class="text-xl font-bold text-niva-text">Joining Conversation</h1>
				<p class="text-sm text-niva-text-secondary">Please wait while we add you to the session...</p>
				<div class="flex justify-center pt-2">
					<Loader2 size={24} class="text-niva-accent animate-spin" />
				</div>
			</div>
		{:else if status === 'success'}
			<div class="space-y-4">
				<div class="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
					<UserPlus size={28} class="text-emerald-400" />
				</div>
				<h1 class="text-xl font-bold text-niva-text">Successfully Joined!</h1>
				<p class="text-sm text-niva-text-secondary">Redirecting you to the chat...</p>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="w-16 h-16 rounded-full bg-niva-error-bg flex items-center justify-center mx-auto">
					<AlertCircle size={28} class="text-niva-error" />
				</div>
				<h1 class="text-xl font-bold text-niva-text text-niva-error">Join Failed</h1>
				<p class="text-sm text-niva-text-secondary">{errorMessage}</p>
				<button 
					onclick={() => goto('/chat')}
					class="mt-4 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-niva-text text-sm font-medium transition-all"
				>
					Back to Chats
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--niva-bg);
	}
</style>
