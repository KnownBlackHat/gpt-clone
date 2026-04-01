<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, type Conversation } from '$lib/api';
	import { FolderOpen, ArrowRight, MessageSquare, Loader2 } from '@lucide/svelte';

	let conversations = $state<Conversation[]>([]);
	let isLoading = $state(true);

	let projects = $derived(() => {
		const groups: Record<string, number> = {};
		for (const c of conversations) {
			if (c.is_archived) continue;
			const cat = c.category || 'General';
			groups[cat] = (groups[cat] || 0) + 1;
		}
		return Object.entries(groups).map(([name, count]) => ({ name, count }))
			.sort((a, b) => {
				if (a.name === 'General') return -1;
				if (b.name === 'General') return 1;
				return a.name.localeCompare(b.name);
			});
	});

	onMount(async () => {
		try {
			const data = await api.conversations.list(false);
			conversations = data.conversations || [];
		} catch (err) {
			console.error("Failed to load projects", err);
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="flex-1 overflow-y-auto niva-scrollbar p-6 md:p-12 relative z-10 w-full h-full">
	<div class="max-w-6xl mx-auto w-full">
		<header class="mb-8 flex flex-col gap-2">
			<h1 class="text-2xl md:text-3xl font-bold text-niva-text tracking-tight font-[Manrope] flex items-center gap-3">
				<FolderOpen size={28} class="text-niva-accent" />
				Projects
			</h1>
			<p class="text-sm text-niva-text-secondary">Organize your chats into dedicated workspaces.</p>
		</header>

		{#if isLoading}
			<div class="w-full h-64 flex items-center justify-center">
				<Loader2 size={32} class="animate-spin text-niva-accent opacity-50" />
			</div>
		{:else if projects().length === 0}
			<div class="w-full h-[50vh] flex flex-col items-center justify-center gap-4 glass-panel rounded-3xl border border-white/5 p-8">
				<div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
					<FolderOpen size={36} class="text-niva-text-secondary opacity-50" />
				</div>
				<h3 class="text-xl font-medium text-niva-text">No projects found</h3>
				<p class="text-sm text-niva-text-secondary max-w-md text-center">Use the "Move to Project" option in your chat settings to organize conversations.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
				{#each projects() as project}
					<button
						onclick={() => goto(`/projects/${encodeURIComponent(project.name)}`)}
						class="flex flex-col gap-4 p-5 md:p-6 rounded-3xl glass-panel border border-white/5 hover:border-niva-accent/30 transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-niva-accent/50 group/card relative overflow-hidden"
					>
						<div class="absolute inset-0 bg-gradient-to-br from-niva-accent/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>

						<div class="flex items-start justify-between w-full relative z-10">
							<div class="w-12 h-12 rounded-2xl bg-niva-accent/10 border border-niva-accent/20 text-niva-accent flex items-center justify-center transition-transform group-hover/card:scale-110">
								<FolderOpen size={22} />
							</div>
							<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-niva-text-secondary group-hover/card:bg-niva-accent group-hover/card:text-niva-bg transition-colors">
								<ArrowRight size={16} />
							</div>
						</div>
						
						<div class="mt-4 space-y-1.5 w-full relative z-10">
							<h3 class="font-bold text-lg text-niva-text tracking-tight group-hover/card:text-niva-accent transition-colors truncate w-full">{project.name}</h3>
							<div class="flex items-center gap-2 text-[11px] font-medium text-niva-text-secondary tracking-wide uppercase">
								<MessageSquare size={12} class="opacity-70" />
								<span>{project.count} chat{project.count !== 1 ? 's' : ''}</span>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
