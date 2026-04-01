<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { api, type Conversation } from '$lib/api';
	import { FolderOpen, ArrowLeft, MoreVertical, Share2, LayoutList, UserPlus, Edit2, Archive, ArchiveRestore, Trash2, Users, Loader2, MessageSquare } from '@lucide/svelte';
	import { ui } from '$lib/stores/ui';

	let categoryQuery = $derived(decodeURIComponent($page.params.category || ''));
	let conversations = $state<Conversation[]>([]);
	let filteredConversations = $derived(conversations.filter(c => {
		if (c.is_archived) return false;
		const cat = c.category || 'General';
		return cat === categoryQuery;
	}));
	
	let isLoading = $state(true);
	let activeMenuId = $state<string | null>(null);

	onMount(async () => {
		try {
			const data = await api.conversations.list(false);
			conversations = data.conversations || [];
		} catch (err) {
			console.error("Failed to load project chats", err);
		} finally {
			isLoading = false;
		}
	});

	function selectConversation(conv: Conversation) {
		goto(`/chat/${conv.id}`);
	}

	function toggleMenu(e: MouseEvent, id: string) {
		if (activeMenuId === id) {
			activeMenuId = null;
		} else {
			activeMenuId = id;
		}
	}

	async function handleDelete(id: string) {
		if (await ui.confirm('Are you sure you want to delete this chat?', 'Delete Chat', 'Delete', 'Cancel')) {
			try {
				await api.conversations.delete(id);
				conversations = conversations.filter(c => c.id !== id);
			} catch (err: any) {
				ui.toast(err.message || "Failed to delete conversation", 'error');
			}
		}
		activeMenuId = null;
	}

	$effect(() => {
		if (activeMenuId) {
			const handleClick = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				if (!target.closest('.menu-trigger') && !target.closest('.menu-content')) {
					activeMenuId = null;
				}
			};
			window.addEventListener('click', handleClick);
			return () => window.removeEventListener('click', handleClick);
		}
	});
</script>

<div class="flex-1 overflow-y-auto niva-scrollbar p-6 md:p-12 relative z-10 w-full h-full">
	<div class="max-w-4xl mx-auto w-full flex flex-col h-full">
		<button
			onclick={() => goto('/projects')}
			class="mb-6 flex items-center gap-2 text-sm font-medium text-niva-text-secondary hover:text-niva-text transition-colors cursor-pointer w-fit group"
		>
			<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
				<ArrowLeft size={16} class="group-hover:-translate-x-1 transition-transform" />
			</div>
			Back to Projects
		</button>

		<header class="mb-10 flex flex-col gap-3">
			<div class="flex items-center gap-4">
				<div class="w-14 h-14 rounded-2xl bg-niva-accent/10 border border-niva-accent/20 flex items-center justify-center text-niva-accent shadow-xl">
					<FolderOpen size={26} />
				</div>
				<div class="flex flex-col gap-1">
					<h1 class="text-2xl md:text-3xl font-bold text-niva-text tracking-tight font-[Manrope]">{categoryQuery}</h1>
					<p class="text-[13px] font-medium text-niva-text-secondary tracking-widest uppercase flex items-center gap-2">
						{#if !isLoading}
						<span>{filteredConversations.length} Node{filteredConversations.length !== 1 ? 's' : ''} Online</span>
						{/if}
					</p>
				</div>
			</div>
		</header>

		{#if isLoading}
			<div class="w-full flex-1 flex items-center justify-center min-h-[300px]">
				<Loader2 size={36} class="animate-spin text-niva-accent opacity-50" />
			</div>
		{:else if filteredConversations.length === 0}
			<div class="w-full min-h-[50vh] flex flex-col items-center justify-center gap-4 glass-panel rounded-3xl border border-white/5 p-8 text-center">
				<div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-2">
					<MessageSquare size={32} class="text-niva-text-secondary opacity-40" />
				</div>
				<h3 class="text-xl font-medium text-niva-text">Project Empty</h3>
				<p class="text-sm text-niva-text-secondary max-w-sm">No active conversations found mapped to this core project vector.</p>
				<button onclick={() => goto('/chat')} class="mt-4 px-6 py-3 rounded-xl bg-niva-accent text-niva-bg font-bold text-sm tracking-widest uppercase hover:scale-105 transition-transform">Start Chatting</button>
			</div>
		{:else}
			<div class="flex flex-col gap-3 pb-12">
				{#each filteredConversations as conv (conv.id)}
					<div class="relative group/item z-10 rounded-[20px] transition-all duration-300 hover:bg-white/5 border border-white/5 hover:border-niva-accent/20 glass-panel shadow-sm hover:shadow-xl">
						<button
							onclick={() => selectConversation(conv)}
							class="w-full flex items-center justify-between p-4 md:p-5 pr-14 rounded-[20px] transition-all duration-200 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-niva-accent/50"
						>
							<div class="flex items-start gap-4 w-full overflow-hidden">
								<div class="mt-0.5 w-10 h-10 rounded-xl bg-niva-surface-2 flex items-center justify-center text-niva-text-secondary group-hover/item:bg-niva-accent/10 group-hover/item:text-niva-accent transition-colors shrink-0">
									{#if conv.is_group}
										<Users size={18} />
									{:else}
										<MessageSquare size={18} />
									{/if}
								</div>
								<div class="flex flex-col gap-1 w-full overflow-hidden">
									<p class="text-[15px] font-bold text-niva-text truncate w-full font-[Manrope]">{conv.title}</p>
									<p class="text-[13px] text-niva-text-secondary truncate w-full max-w-[90%] leading-relaxed">{conv.last_message || 'Empty node block...'}</p>
								</div>
							</div>
						</button>
						
						<!-- Context Toggle -->
						<button
							onmousedown={(e) => { e.stopPropagation(); e.preventDefault(); toggleMenu(e, conv.id); }}
							class="absolute top-1/2 -translate-y-1/2 right-4 w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer z-20 menu-trigger
								{activeMenuId === conv.id ? 'bg-niva-accent/20 text-niva-accent opacity-100' : 'md:opacity-0 md:group-hover/item:opacity-100 text-niva-text-secondary hover:bg-white/10 hover:text-niva-accent'}
								active:scale-95"
							title="Quick Options"
						>
							<MoreVertical size={20} class="pointer-events-none" />
						</button>

						{#if activeMenuId === conv.id}
							<div class="absolute right-4 top-14 w-48 bg-niva-surface-2 border border-niva-glass-border rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-2 duration-200 menu-content">
								<button onclick={() => handleDelete(conv.id)} class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-niva-error hover:bg-niva-error-bg/50 rounded-lg transition-colors cursor-pointer text-left font-medium">
									<Trash2 size={14} />
									Delete Chat
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
