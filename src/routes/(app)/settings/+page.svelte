<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, type User, type Conversation } from '$lib/api';
	import {
		Sparkles,
		Shield,
		Pencil,
		Trash2,
		Search,
		Filter,
		ChevronDown,
		AlertTriangle,
		CreditCard,
		Crown,
		Clock,
		Code,
		BookOpen,
		Lightbulb,
		PenLine,
		User as UserIcon,
		X,
		Loader2,
		CheckCircle2,
	} from '@lucide/svelte';

	let user = $state<User | null>(null);
	let conversations = $state<Conversation[]>([]);
	let searchQuery = $state('');
	let showDeleteConfirm = $state(false);
	let visibleCount = $state(6);
	let sortBy = $state<'recent' | 'oldest' | 'messages'>('recent');

	// Profile Edit State
	let isEditingProfile = $state(false);
	let editUsername = $state('');
	let editEmail = $state('');
	let isUpdatingProfile = $state(false);

	// Security Update State
	let isChangingPassword = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isUpdatingPassword = $state(false);

	// Feedback State
	let successMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const categoryIcons: Record<string, typeof Code> = {
		Coding: Code,
		Research: BookOpen,
		Creative: Lightbulb,
		Writing: PenLine,
		General: Sparkles,
	};

	const categoryColors: Record<string, string> = {
		Coding: 'text-green-400 bg-green-400/10',
		Research: 'text-blue-400 bg-blue-400/10',
		Creative: 'text-purple-400 bg-purple-400/10',
		Writing: 'text-orange-400 bg-orange-400/10',
		General: 'text-niva-accent bg-niva-accent/10',
	};

	let filteredConversations = $derived(
		conversations
			.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
			.sort((a, b) => {
				if (sortBy === 'recent') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
				if (sortBy === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
				if (sortBy === 'messages') return (b.message_count || 0) - (a.message_count || 0);
				return 0;
			})
	);

	async function loadData() {
		try {
			const [userData, convData] = await Promise.all([
				api.user.get(),
				api.conversations.list(),
			]);
			user = userData.user;
			conversations = convData.conversations;
			editUsername = user.username;
			editEmail = user.email;
		} catch {
			goto('/login');
		}
	}

	async function handleUpdateProfile() {
		if (!user) return;
		isUpdatingProfile = true;
		errorMessage = null;
		try {
			const res = await api.user.update({ username: editUsername, email: editEmail });
			user = res.user;
			isEditingProfile = false;
			showSuccess('Profile updated successfully');
		} catch (err: any) {
			errorMessage = err.message || 'Failed to update profile';
		} finally {
			isUpdatingProfile = false;
		}
	}

	async function handleUpdatePassword() {
		if (newPassword !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			return;
		}
		isUpdatingPassword = true;
		errorMessage = null;
		try {
			await api.user.update({ currentPassword, newPassword });
			isChangingPassword = false;
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			showSuccess('Password changed successfully');
		} catch (err: any) {
			errorMessage = err.message || 'Failed to change password';
		} finally {
			isUpdatingPassword = false;
		}
	}

	function showSuccess(msg: string) {
		successMessage = msg;
		setTimeout(() => (successMessage = null), 3000);
	}

	async function deleteConversation(id: string, e: Event) {
		e.stopPropagation();
		try {
			await api.conversations.delete(id);
			conversations = conversations.filter((c) => c.id !== id);
			showSuccess('Conversation deleted');
		} catch {
			errorMessage = 'Failed to delete conversation';
		}
	}

	async function deleteAccount() {
		try {
			// perform permanent deletion
			await api.user.deleteAccount();
			goto('/login');
		} catch (err: any) {
			errorMessage = err.message || 'Failed to delete account';
		}
	}

	function formatDate(dateStr: string) {
		const d = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	$effect(() => {
		loadData();
	});
</script>

<div class="flex-1 overflow-y-auto niva-scrollbar">
	<!-- Top Bar -->
	<header class="h-14 glass-panel-strong flex items-center justify-between px-6 sticky top-0 z-10">
		<div class="flex items-center gap-3">
			<h1 class="text-sm font-semibold text-niva-text font-[Manrope]">Settings & History</h1>
		</div>
		<div class="flex items-center gap-3">
			{#if user}
				<div class="flex items-center gap-2">
					<div class="w-7 h-7 rounded-full bg-niva-accent/15 flex items-center justify-center">
						<span class="text-xs font-semibold text-niva-accent">{user.username[0].toUpperCase()}</span>
					</div>
					<span class="text-xs text-niva-text hidden sm:block">{user.username}</span>
				</div>
			{/if}
		</div>
	</header>

	<div class="max-w-5xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-8 space-y-10">
		<!-- Feedback Toasts -->
		{#if successMessage}
			<div class="fixed top-20 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 animate-in fade-in slide-in-from-right-4 duration-300">
				<CheckCircle2 size={18} />
				<span class="text-sm font-medium">{successMessage}</span>
			</div>
		{/if}
		{#if errorMessage}
			<div class="fixed top-20 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 animate-in fade-in slide-in-from-right-4 duration-300">
				<AlertTriangle size={18} />
				<span class="text-sm font-medium">{errorMessage}</span>
				<button onclick={() => (errorMessage = null)} class="ml-2 hover:opacity-70"><X size={14} /></button>
			</div>
		{/if}

		<!-- Hero Section -->
		<section class="text-center py-8">
			<h2 class="text-3xl md:text-5xl font-bold font-[Manrope] text-niva-text mb-3">
				Control your <span class="text-gradient">Intelligence.</span>
			</h2>
			<p class="text-niva-text-secondary text-sm md:text-base max-w-md mx-auto">
				Manage your account, review past interactions, and customize your AI experience.
			</p>
		</section>

		<!-- Profile & Subscription Grid -->
		<section class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- Profile Card -->
			<div class="rounded-2xl glass-panel p-6 space-y-5 relative">
				{#if isEditingProfile}
					<div class="space-y-4 animate-in fade-in duration-200">
						<div class="flex items-center justify-between mb-2">
							<h3 class="text-sm font-semibold text-niva-text uppercase tracking-wider">Edit Profile</h3>
							<button onclick={() => (isEditingProfile = false)} class="text-niva-text-secondary hover:text-white"><X size={16}/></button>
						</div>
						<div class="space-y-3">
							<div class="space-y-1.5">
								<label for="username" class="text-[10px] font-bold text-niva-text-secondary uppercase">Username</label>
								<input id="username" type="text" bind:value={editUsername} class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text outline-none focus:border-niva-accent/30 transition-colors" />
							</div>
							<div class="space-y-1.5">
								<label for="email" class="text-[10px] font-bold text-niva-text-secondary uppercase">Email Address</label>
								<input id="email" type="email" bind:value={editEmail} class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text outline-none focus:border-niva-accent/30 transition-colors" />
							</div>
						</div>
						<button disabled={isUpdatingProfile} onclick={handleUpdateProfile} class="w-full h-10 rounded-xl bg-niva-accent text-niva-bg text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50">
							{#if isUpdatingProfile}<Loader2 size={16} class="animate-spin" />{:else}Save Changes{/if}
						</button>
					</div>
				{:else if isChangingPassword}
					<div class="space-y-4 animate-in fade-in duration-200">
						<div class="flex items-center justify-between mb-2">
							<h3 class="text-sm font-semibold text-niva-text uppercase tracking-wider">Change Password</h3>
							<button onclick={() => (isChangingPassword = false)} class="text-niva-text-secondary hover:text-white"><X size={16}/></button>
						</div>
						<div class="space-y-3">
							<input type="password" placeholder="Current Password" bind:value={currentPassword} class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text outline-none focus:border-niva-accent/30 transition-colors" />
							<input type="password" placeholder="New Password" bind:value={newPassword} class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text outline-none focus:border-niva-accent/30 transition-colors" />
							<input type="password" placeholder="Confirm New Password" bind:value={confirmPassword} class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text outline-none focus:border-niva-accent/30 transition-colors" />
						</div>
						<button disabled={isUpdatingPassword} onclick={handleUpdatePassword} class="w-full h-10 rounded-xl bg-niva-accent text-niva-bg text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50">
							{#if isUpdatingPassword}<Loader2 size={16} class="animate-spin" />{:else}Update Password{/if}
						</button>
					</div>
				{:else}
					<div class="flex items-center gap-4">
						<div class="relative group">
							<div class="w-16 h-16 rounded-2xl bg-niva-accent/15 flex items-center justify-center niva-glow">
								<span class="text-2xl font-bold text-niva-accent">{user?.username[0].toUpperCase() ?? '?'}</span>
							</div>
						</div>
						<div>
							<h3 class="text-lg font-semibold text-niva-text font-[Manrope]">{user?.username ?? 'Loading...'}</h3>
							<p class="text-sm text-niva-text-secondary">{user?.email ?? ''}</p>
						</div>
					</div>
					<div class="flex gap-3">
						<button onclick={() => (isEditingProfile = true, editUsername = user?.username || '', editEmail = user?.email || '')} class="flex-1 py-3 rounded-2xl bg-niva-accent/10 text-niva-accent text-sm font-bold hover:bg-niva-accent/20 transition-all cursor-pointer flex items-center justify-center gap-2 border border-niva-accent/20">
							<Pencil size={14} />
							Update Name & Email
						</button>
						<button onclick={() => (isChangingPassword = true)} class="flex-1 py-3 rounded-2xl bg-white/5 text-niva-text-secondary text-sm font-bold hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/10">
							<Shield size={14} />
							Update Security
						</button>
					</div>
				{/if}
			</div>

			<!-- Subscription Card -->
			<div class="rounded-2xl niva-gradient border border-niva-accent/20 p-6 relative overflow-hidden niva-glow">
				<div class="absolute top-4 right-4 w-24 h-24 rounded-full bg-niva-accent/5 blur-2xl"></div>
				<div class="relative z-10 space-y-4">
					<div class="flex items-center gap-2">
						<Crown size={18} class="text-niva-accent" />
						<span class="text-xs font-semibold text-niva-accent uppercase tracking-wider">Active Plan</span>
					</div>
					<div>
						<h3 class="text-2xl font-bold text-niva-text font-[Manrope] uppercase">{user?.plan || 'Free'}</h3>
						<p class="text-sm text-niva-text-secondary mt-1">
							Unlimited conversations, priority responses, and advanced AI capabilities.
						</p>
					</div>
					<button onclick={() => showSuccess('Billing management coming soon')} class="w-full py-2.5 rounded-xl bg-niva-accent text-niva-bg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2">
						<CreditCard size={14} />
						Manage Billing
					</button>
				</div>
			</div>
		</section>

		<!-- Interaction History -->
		<section class="space-y-5">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h3 class="text-lg font-semibold text-niva-text font-[Manrope]">Interaction History</h3>
					<p class="text-sm text-niva-text-secondary">Browse and manage your past conversations</p>
				</div>
				<div class="flex items-center gap-3">
					<div class="relative flex-1 sm:w-64">
						<Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-niva-text-secondary" />
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search history..."
							class="w-full h-9 pl-9 pr-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text placeholder:text-niva-text-secondary outline-none focus:border-niva-accent/30 transition-colors"
						/>
					</div>
					<div class="relative group">
						<button class="h-9 px-3 rounded-xl bg-white/5 border border-niva-glass-border text-niva-text-secondary hover:text-niva-text transition-colors cursor-pointer flex items-center gap-2">
							<Filter size={14} />
							<span class="text-xs">{sortBy === 'recent' ? 'Latest' : sortBy === 'oldest' ? 'Oldest' : 'Popular'}</span>
						</button>
						<div class="absolute right-0 top-full mt-2 w-32 glass-panel rounded-xl border border-niva-accent/10 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all z-20 overflow-hidden">
							<button onclick={() => (sortBy = 'recent')} class="w-full px-4 py-2 text-left text-xs text-niva-text-secondary hover:text-niva-accent hover:bg-niva-accent/5">Latest</button>
							<button onclick={() => (sortBy = 'oldest')} class="w-full px-4 py-2 text-left text-xs text-niva-text-secondary hover:text-niva-accent hover:bg-niva-accent/5">Oldest</button>
							<button onclick={() => (sortBy = 'messages')} class="w-full px-4 py-2 text-left text-xs text-niva-text-secondary hover:text-niva-accent hover:bg-niva-accent/5">Popular</button>
						</div>
					</div>
				</div>
			</div>

			<!-- History Grid -->
			{#if filteredConversations.length === 0}
				<div class="text-center py-16">
					<Clock size={32} class="text-niva-text-secondary mx-auto mb-3" />
					<p class="text-niva-text-secondary text-sm">
						{searchQuery ? 'No conversations match your search' : 'No conversations yet'}
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{#each filteredConversations.slice(0, visibleCount) as conv}
						{@const catColor = categoryColors[conv.category] || categoryColors['General']}
						<div 
							role="button"
							tabindex="0"
							onclick={() => goto('/chat/' + conv.id)}
							onkeydown={(e) => e.key === 'Enter' && goto('/chat/' + conv.id)}
							class="group rounded-2xl glass-panel p-4 hover:border-niva-accent/20 transition-all duration-200 cursor-pointer relative"
						>
							<button
								onclick={(e) => deleteConversation(conv.id, e)}
								class="absolute top-3 right-3 w-7 h-7 rounded-lg bg-niva-error-bg/0 hover:bg-niva-error-bg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
							>
								<Trash2 size={13} class="text-niva-error" />
							</button>

							<div class="flex items-center gap-2 mb-3">
								<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full {catColor} uppercase tracking-wider">
									{conv.category}
								</span>
								<span class="text-[10px] text-niva-text-secondary">{formatDate(conv.created_at)}</span>
							</div>

							<h4 class="text-sm font-medium text-niva-text mb-2 line-clamp-2 pr-6">{conv.title}</h4>

							{#if conv.last_message}
								<p class="text-xs text-niva-text-secondary line-clamp-2">{conv.last_message}</p>
							{/if}

							<div class="flex items-center gap-2 mt-3">
								<span class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-niva-text-secondary">
									{conv.message_count || 0} messages
								</span>
							</div>
						</div>
					{/each}
				</div>

				{#if filteredConversations.length > visibleCount}
					<div class="text-center pt-4">
						<button
							onclick={() => (visibleCount += 6)}
							class="px-6 py-2.5 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text-secondary hover:text-niva-text hover:bg-white/10 transition-all cursor-pointer flex items-center gap-2 mx-auto"
						>
							<ChevronDown size={14} />
							Load More
						</button>
					</div>
				{/if}
			{/if}
		</section>

		<!-- Danger Zone -->
		<section class="rounded-2xl border border-niva-error/20 bg-niva-error-bg/30 p-6 space-y-4">
			<div class="flex items-center gap-3">
				<AlertTriangle size={20} class="text-niva-error" />
				<h3 class="text-lg font-semibold text-niva-error font-[Manrope]">Danger Zone</h3>
			</div>
			<p class="text-sm text-niva-text-secondary">
				Permanently delete your account and all associated data. This action cannot be undone.
			</p>
			{#if showDeleteConfirm}
				<div class="flex items-center gap-3">
					<button
						onclick={deleteAccount}
						class="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
					>
						Yes, Delete My Account
					</button>
					<button
						onclick={() => (showDeleteConfirm = false)}
						class="px-5 py-2.5 rounded-xl bg-white/5 text-niva-text-secondary text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer"
					>
						Cancel
					</button>
				</div>
			{:else}
				<button
					onclick={() => (showDeleteConfirm = true)}
					class="px-5 py-2.5 rounded-xl border border-niva-error/30 text-niva-error text-sm font-medium hover:bg-niva-error-bg/50 transition-colors cursor-pointer"
				>
					Delete Account
				</button>
			{/if}
		</section>
	</div>
</div>
