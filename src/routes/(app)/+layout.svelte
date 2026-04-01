<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import {
		MessageSquarePlus,
		MessageCircle,
		Settings,
		User,
		LogOut,
		Sparkles,
		LayoutList,
	} from '@lucide/svelte';

	let { children } = $props();
	let currentPath = $derived($page.url.pathname);

	const navItems = [
		{ icon: MessageCircle, label: 'Recent', href: '/chat' },
		{ icon: LayoutList, label: 'Quiz', href: '/quiz' },
		{ icon: Settings, label: 'Settings', href: '/settings' },
	];

	async function handleNewChat() {
		try {
			const { conversation } = await api.conversations.create();
			goto(`/chat/${conversation.id}`);
		} catch {
			goto('/chat');
		}
	}

	async function handleLogout() {
		try {
			await api.auth.logout();
		} catch {
			// ignore
		}
		goto('/login');
	}
</script>

<!-- Desktop Sidebar -->
<div class="flex h-[100dvh] w-full overflow-hidden bg-niva-bg">
	<!-- Sidebar -->
	<aside class="hidden md:flex flex-col w-[72px] h-full bg-sidebar border-r border-sidebar-border shrink-0">
		<!-- Branding -->
		<div class="flex flex-col items-center pt-5 pb-4 gap-1">
			<div class="w-9 h-9 rounded-xl niva-gradient flex items-center justify-center niva-glow">
				<Sparkles size={18} class="text-niva-accent" />
			</div>
			<span class="text-[9px] font-semibold text-niva-accent tracking-wider uppercase mt-1">Niva</span>
		</div>

		<!-- New Chat -->
		<div class="px-3 mb-4">
			<button
				onclick={handleNewChat}
				class="w-full aspect-square rounded-xl bg-niva-accent/10 hover:bg-niva-accent/20 border border-niva-accent/20 flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer group"
			>
				<MessageSquarePlus size={20} class="text-niva-accent group-hover:text-white transition-colors" />
			</button>
		</div>

		<!-- Nav Items -->
		<nav class="flex-1 flex flex-col items-center gap-1 px-2">
			{#each navItems as item}
				{@const isActive = currentPath.startsWith(item.href)}
				<a
					href={item.href}
					class="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 group {isActive
						? 'bg-niva-accent/15 text-niva-accent'
						: 'text-niva-text-secondary hover:text-niva-text hover:bg-white/5'}"
				>
					<item.icon size={18} />
					<span class="text-[9px] font-medium">{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="flex flex-col items-center gap-2 pb-4 px-2">
			<a
				href="/settings"
				class="w-10 h-10 rounded-full bg-niva-surface-2 flex items-center justify-center hover:bg-niva-surface-3 transition-colors"
			>
				<User size={16} class="text-niva-text-secondary" />
			</a>
			<button
				onclick={handleLogout}
				class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-niva-error-bg transition-colors cursor-pointer group"
			>
				<LogOut size={15} class="text-niva-text-secondary group-hover:text-niva-error transition-colors" />
			</button>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="flex-1 flex flex-col h-full overflow-hidden">
		{@render children()}
	</main>

	<!-- Mobile Bottom Nav -->
	<nav class="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar/95 backdrop-blur-xl border-t border-sidebar-border flex items-center justify-around px-4 z-50">
		<button
			onclick={handleNewChat}
			class="flex flex-col items-center gap-0.5 text-niva-accent cursor-pointer"
		>
			<MessageSquarePlus size={20} />
			<span class="text-[10px] font-medium">New Chat</span>
		</button>
		{#each navItems as item}
			{@const isActive = currentPath.startsWith(item.href)}
			<a
				href={item.href}
				class="flex flex-col items-center gap-0.5 {isActive ? 'text-niva-accent' : 'text-niva-text-secondary'}"
			>
				<item.icon size={20} />
				<span class="text-[10px] font-medium">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
