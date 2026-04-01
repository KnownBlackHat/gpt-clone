<script lang="ts">
	import { api, type GroupMember } from '$lib/api';
	import {
		Users,
		UserPlus,
		X,
		Crown,
		Trash2,
		Loader2,
		Mail,
		ChevronRight,
	} from '@lucide/svelte';
	import { fly, fade } from 'svelte/transition';

	let {
		conversationId,
		isOwner = false,
		visible = $bindable(false),
	} = $props<{
		conversationId: string;
		isOwner?: boolean;
		visible?: boolean;
	}>();

	let members = $state<GroupMember[]>([]);
	let inviteEmail = $state('');
	let isInviting = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	async function loadMembers() {
		if (!conversationId) return;
		isLoading = true;
		try {
			const data = await api.groupChat.members(conversationId);
			members = data.members;
		} catch {
			// Not a group or no access — that's okay, just show empty
			members = [];
		} finally {
			isLoading = false;
		}
	}

	async function inviteMember() {
		if (!inviteEmail.trim() || isInviting) return;
		isInviting = true;
		error = null;
		success = null;
		try {
			const data = await api.groupChat.addMember(conversationId, inviteEmail.trim());
			members = [...members, data.member];
			inviteEmail = '';
			success = 'Member added successfully';
			setTimeout(() => success = null, 2500);
		} catch (err: any) {
			error = err.message || 'Failed to invite member';
			setTimeout(() => error = null, 3000);
		} finally {
			isInviting = false;
		}
	}

	async function removeMember(memberId: string) {
		try {
			await api.groupChat.removeMember(conversationId, memberId);
			members = members.filter(m => m.id !== memberId);
		} catch (err: any) {
			error = err.message || 'Failed to remove member';
			setTimeout(() => error = null, 3000);
		}
	}

	function handleInviteKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			inviteMember();
		}
	}

	function getInitialColor(name: string): string {
		const colors = [
			'bg-blue-500/20 text-blue-400',
			'bg-purple-500/20 text-purple-400',
			'bg-emerald-500/20 text-emerald-400',
			'bg-amber-500/20 text-amber-400',
			'bg-rose-500/20 text-rose-400',
			'bg-cyan-500/20 text-cyan-400',
			'bg-teal-500/20 text-teal-400',
		];
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	$effect(() => {
		if (visible && conversationId) {
			loadMembers();
		}
	});
</script>

{#if visible}
	<!-- Backdrop (mobile) -->
	<button
		onclick={() => visible = false}
		class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden border-none cursor-default"
		in:fade
		out:fade
		aria-label="Close group panel"
	></button>

	<!-- Panel -->
	<div
		in:fly={{ x: 300, duration: 350 }}
		out:fly={{ x: 300, duration: 250 }}
		class="fixed md:absolute inset-y-0 right-0 w-full md:w-80 bg-niva-surface-2 border-l border-niva-glass-border shadow-2xl z-40 flex flex-col"
	>
		<!-- Header -->
		<div class="h-14 flex items-center justify-between px-5 border-b border-niva-glass-border shrink-0">
			<div class="flex items-center gap-2">
				<Users size={16} class="text-niva-accent" />
				<span class="text-sm font-bold">Members</span>
				{#if members.length > 0}
					<span class="text-[10px] font-bold text-niva-text-secondary bg-white/5 px-1.5 py-0.5 rounded-md">{members.length}</span>
				{/if}
			</div>
			<button
				onclick={() => visible = false}
				class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary transition-colors cursor-pointer"
			>
				<ChevronRight size={18} />
			</button>
		</div>

		<!-- Invite Form (only for owner) -->
		{#if isOwner}
			<div class="p-4 border-b border-niva-glass-border space-y-2">
				<div class="flex gap-2">
					<div class="flex-1 flex items-center gap-2 bg-white/5 border border-niva-glass-border rounded-xl px-3 focus-within:border-niva-accent/30 transition-colors">
						<Mail size={14} class="text-niva-text-secondary shrink-0" />
						<input
							type="email"
							placeholder="Invite by email..."
							bind:value={inviteEmail}
							onkeydown={handleInviteKeydown}
							class="flex-1 bg-transparent border-none outline-none text-xs text-niva-text placeholder:text-niva-text-secondary py-2.5"
						/>
					</div>
					<button
						onclick={inviteMember}
						disabled={!inviteEmail.trim() || isInviting}
						class="px-3 rounded-xl bg-niva-accent text-niva-bg flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shrink-0"
					>
						{#if isInviting}
							<Loader2 size={14} class="animate-spin" />
						{:else}
							<UserPlus size={14} />
						{/if}
					</button>
				</div>

				{#if error}
					<p in:fade class="text-[10px] text-niva-error font-medium px-1">{error}</p>
				{/if}
				{#if success}
					<p in:fade class="text-[10px] text-emerald-400 font-medium px-1">{success}</p>
				{/if}
			</div>
		{/if}

		<!-- Members List -->
		<div class="flex-1 overflow-y-auto niva-scrollbar p-4 space-y-2">
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 size={20} class="text-niva-accent animate-spin" />
				</div>
			{:else if members.length === 0}
				<div class="text-center py-8 space-y-3 text-niva-text-secondary">
					<Users size={32} class="mx-auto opacity-30" />
					<p class="text-xs font-medium">No group members yet</p>
					{#if isOwner}
						<p class="text-[10px]">Invite people by email to start a group</p>
					{/if}
				</div>
			{:else}
				{#each members as member}
					<div class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group/member">
						<div class="w-8 h-8 rounded-full {getInitialColor(member.username)} flex items-center justify-center shrink-0">
							<span class="text-xs font-bold">{member.username[0].toUpperCase()}</span>
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-1.5">
								<p class="text-sm font-medium text-niva-text truncate">{member.username}</p>
								{#if member.role === 'owner'}
									<Crown size={11} class="text-amber-400 shrink-0" />
								{/if}
							</div>
							<p class="text-[10px] text-niva-text-secondary truncate">{member.email}</p>
						</div>
						{#if isOwner && member.role !== 'owner'}
							<button
								onclick={() => removeMember(member.id)}
								class="p-1.5 rounded-lg hover:bg-niva-error-bg text-niva-text-secondary hover:text-niva-error transition-colors cursor-pointer opacity-0 group-hover/member:opacity-100"
								title="Remove member"
							>
								<Trash2 size={13} />
							</button>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}
