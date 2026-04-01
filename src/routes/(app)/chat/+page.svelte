<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, type Conversation, type Message } from '$lib/api';
	import { ui } from '$lib/stores/ui';
	import {
		Send,
		Sparkles,
		Code,
		BookOpen,
		Lightbulb,
		PenLine,
		Loader2,
		ImagePlus,
		FileText,
		X,
		Globe,
		MoreVertical,
		Share2,
		Edit2,
		Trash2,
		Users,
		UserPlus,
		Archive,
		ArchiveRestore,
		LayoutList,
		FolderOpen,
	} from '@lucide/svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import { copyToClipboard } from '$lib/utils';

	let conversations = $state<Conversation[]>([]);
	let activeConversationId = $state<string | null>(null);
	let messages = $state<Message[]>([]);
	let inputValue = $state('');
	let isLoading = $state(false);
	let isTyping = $state(false);
	let isSearching = $state(false);
	let isSearchEnabled = $state(false);
	let messagesContainer: HTMLElement;
	let textareaElement = $state<HTMLTextAreaElement | null>(null);
	let activeMenuId = $state<string | null>(null);
	let isArchiveView = $state(false);

	// Group creation
	let showGroupDialog = $state(false);
	let groupTitle = $state('');
	let groupEmails = $state('');
	let isCreatingGroup = $state(false);

	function countWords(text: string) {
		if (!text) return 0;
		return text.trim().split(/\s+/).filter(Boolean).length;
	}

	let totalWords = $derived(messages.reduce((acc, m) => acc + countWords(m.content), 0));
	let hasPDF = $derived(messages.some(m => !!m.pdf_text));
	let canGenerateQuiz = $derived(totalWords >= 50 || hasPDF);

	// Auto-resize textarea
	$effect(() => {
		if (textareaElement && inputValue !== undefined) {
			textareaElement.style.height = 'auto';
			textareaElement.style.height = textareaElement.scrollHeight + 'px';
		}
	});

	// Multimodal / Document state
	let imageInput: HTMLInputElement;
	let docInput: HTMLInputElement;
	let selectedImage = $state<string | null>(null);
	let imagePreview = $state<string | null>(null);
	let selectedDoc = $state<string | null>(null);
	let docName = $state<string | null>(null);

	const suggestions = [
		{ icon: Code, text: 'Help me write a Python script', category: 'Coding' },
		{ icon: BookOpen, text: 'Explain quantum computing', category: 'Research' },
		{ icon: Lightbulb, text: 'Generate creative ideas for my startup', category: 'Creative' },
		{ icon: PenLine, text: 'Write a professional email', category: 'Writing' },
	];

	async function loadConversations() {
		try {
			const data = await api.conversations.list(isArchiveView);
			conversations = data.conversations;
		} catch {
			// ignore
		}
	}

	async function handleArchive(id: string) {
		try {
			await api.conversations.archive(id);
			activeMenuId = null;
			await loadConversations();
		} catch (err: any) {
			console.error('Archive error:', err);
		}
	}

	$effect(() => {
		loadConversations();
	});

	async function loadMessages(convId: string) {
		try {
			const data = await api.messages.list(convId);
			messages = data.messages;
			scrollToBottom();
		} catch {
			// ignore
		}
	}

	async function selectConversation(conv: Conversation) {
		activeConversationId = conv.id;
		await loadMessages(conv.id);
	}

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 50);
	}

	function handleImageClick() {
		imageInput.click();
	}

	function handleDocClick() {
		docInput.click();
	}

	function handleImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const base64 = e.target?.result as string;
			selectedImage = base64;
			imagePreview = base64;
		};
		reader.readAsDataURL(file);
	}

	function handleDocUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		docName = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			const base64 = e.target?.result as string;
			selectedDoc = base64;
		};
		reader.readAsDataURL(file);
	}

	function removeImage() {
		selectedImage = null;
		imagePreview = null;
		if (imageInput) imageInput.value = '';
	}

	function removeDoc() {
		selectedDoc = null;
		docName = null;
		if (docInput) docInput.value = '';
	}

	async function handleSend() {
		if ((!inputValue.trim() && !selectedImage && !selectedDoc) || isLoading) return;

		const content = inputValue.trim();
		const imageUrl = selectedImage;
		const docUrl = selectedDoc;
		const currentDocName = docName;
		
		inputValue = '';
		removeImage();
		removeDoc();

		// Create conversation if needed
		if (!activeConversationId) {
			try {
				const { conversation } = await api.conversations.create();
				activeConversationId = conversation.id;
				conversations = [conversation, ...conversations];
			} catch {
				return;
			}
		}

		// Optimistically add user message
		const tempUserMsg: Message = {
			id: 'temp-' + Date.now(),
			role: 'user',
			content: content || (currentDocName ? `Uploaded ${currentDocName}` : 'Sent an attachment'),
			image_url: imageUrl || undefined,
			created_at: new Date().toISOString(),
		};
		messages = [...messages, tempUserMsg];
		scrollToBottom();

		isLoading = true;
		isTyping = true;
		
		const lowContent = content.toLowerCase();
		if (isSearchEnabled) {
			isSearching = true;
		} else {
			const searchKeywords = ['search', 'latest', 'who is', 'current', 'stock', 'price', 'weather', 'news', 'today', 'live'];
			if (searchKeywords.some(keyword => lowContent.includes(keyword))) {
				isSearching = true;
			}
		}

		const currentSearchEnabled = isSearchEnabled;
		isSearchEnabled = false; // Reset after use

		let assistantMsg: Message = {
			id: 'assistant-temp-' + Date.now(),
			role: 'assistant',
			content: '',
			created_at: new Date().toISOString(),
		};

		try {
			await api.messages.stream(
				activeConversationId!, 
				content, 
				(chunk) => {
					if (chunk.userMessage && !messages.find(m => m.id === chunk.userMessage?.id)) {
						messages = messages
							.filter(m => m.id !== tempUserMsg.id)
							.concat([chunk.userMessage]);
					}

					if (chunk.delta) {
						if (!messages.find(m => m.id === assistantMsg.id)) {
							messages = [...messages, assistantMsg];
						}
						assistantMsg.content += chunk.delta;
						messages = [...messages];
						scrollToBottom();
					}

					if (chunk.done && chunk.assistantMessage) {
						messages = messages
							.filter(m => m.id !== assistantMsg.id)
							.concat([chunk.assistantMessage]);
						scrollToBottom();
						// Refresh conversation list for updated title
						loadConversations();
					}

					if (chunk.error) {
						throw new Error(chunk.error);
					}
				},
				imageUrl || undefined, 
				docUrl || undefined, 
				currentSearchEnabled
			);
		} catch (err: any) {
			messages = messages.filter((m) => m.id !== tempUserMsg.id && m.id !== assistantMsg.id);
			ui.toast(err.message || "Failed to send message. Please try again.", 'error');
		} finally {
			isLoading = false;
			isTyping = false;
			isSearching = false;
		}
	}

	async function handleSuggestionClick(text: string) {
		inputValue = text;
		await handleSend();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function toggleMenu(e: Event, id: string) {
		e.stopPropagation();
		activeMenuId = activeMenuId === id ? null : id;
	}

	async function handleDeleteConversation(id: string) {
		try {
			await api.conversations.delete(id);
			conversations = conversations.filter(c => c.id !== id);
			if (activeConversationId === id) {
				activeConversationId = null;
				messages = [];
			}
		} catch {
			// ignore
		}
		activeMenuId = null;
	}

	async function handleRename(id: string) {
		const conv = conversations.find(c => c.id === id);
		if (!conv) return;
		
		const newTitle = await ui.prompt('Enter new conversation title:', 'Rename Chat', conv.title);
		if (newTitle && newTitle !== conv.title) {
			try {
				await api.conversations.rename(id, newTitle);
				conversations = conversations.map(c => 
					c.id === id ? { ...c, title: newTitle } : c
				);
			} catch {
				ui.toast('Failed to rename conversation.', 'error');
			}
		}
		activeMenuId = null;
	}

	async function handleEditMessage(messageId: string, newContent: string) {
		if (!activeConversationId) return;
		try {
			isLoading = true;
			const data = await api.messages.edit(messageId, newContent);
			const msgIndex = messages.findIndex(m => m.id === messageId);
			if (msgIndex !== -1) {
				messages = messages.slice(0, msgIndex + 1);
				messages[msgIndex].content = newContent;
			}
			if (data.needsResend) {
				inputValue = newContent;
				messages = messages.slice(0, msgIndex); 
				await handleSend();
			}
		} catch (err: any) {
			ui.toast(err.message || "Failed to edit message.", 'error');
		} finally {
			isLoading = false;
		}
	}

	async function handleRetryMessage(messageId: string) {
		if (!activeConversationId) return;
		try {
			isLoading = true;
			const data = await api.messages.retry(messageId);
			const msgIndex = messages.findIndex(m => m.id === messageId);
			if (msgIndex !== -1) {
				messages = messages.slice(0, msgIndex);
			}
			if (data.needsResend) {
				inputValue = data.userMessage.content;
				messages = messages.filter(m => m.id !== data.userMessage.id);
				
				// CRITICAL: Reset isLoading before calling handleSend, 
				// as handleSend has a guard: if (isLoading) return;
				isLoading = false; 
				await handleSend();
			}
		} catch (err: any) {
			ui.toast(err.message || "Failed to retry message.", 'error');
		} finally {
			isLoading = false;
		}
	}

	async function handleMoveToProject(id: string) {
		const conv = conversations.find((c) => c.id === id);
		if (!conv) return;
		
		const currentCategory = conv.category && conv.category !== 'General' ? conv.category : '';
		const newCategory = await ui.prompt('Enter project/category name (leave empty for General):', 'Move to Project', currentCategory);
		
		if (newCategory !== null) {
			const finalCategory = newCategory.trim() || 'General';
			if (finalCategory !== (conv.category || 'General')) {
				try {
					await api.conversations.updateCategory(id, finalCategory);
					conversations = conversations.map((c) =>
						c.id === id ? { ...c, category: finalCategory } : c
					);
					ui.toast('Moved to project successfully', 'success');
				} catch (err: any) {
					ui.toast(err.message || 'Failed to move conversation.', 'error');
				}
			}
		}
		activeMenuId = null;
	}

	async function handleSidebarShare(id: string) {
		try {
			const { shareId } = await api.conversations.share(id);
			const shareUrl = `${window.location.origin}/share/${shareId}`;
			
			const success = await copyToClipboard(shareUrl);
			if (success) {
				ui.toast("Share link copied to clipboard!", 'success');
			} else {
				console.warn("Clipboard copy completely failed, showing link instead");
				await ui.alert(`Copy your share link: ${shareUrl}`, 'Link Copied');
			}
		} catch (err: any) {
			console.error("Share failed:", err);
			ui.toast(err.message || 'Failed to generate share link.', 'error');
		}
		activeMenuId = null;
	}

	async function handleInviteLink(id: string) {
		try {
			const { shareId } = await api.conversations.share(id);
			const joinUrl = `${window.location.origin}/join/${shareId}`;
			
			const success = await copyToClipboard(joinUrl);
			if (success) {
				ui.toast("Group Invite link copied to clipboard!", 'success');
			} else {
				console.warn("Clipboard copy completely failed, showing link instead");
				await ui.alert(`Copy your invite link: ${joinUrl}`, 'Link Copied');
			}

			// Optimistically update the UI if it was not already a group
			conversations = conversations.map(c => 
				c.id === id ? { ...c, is_group: true } : c
			);
		} catch (err: any) {
			console.error("Invite failed:", err);
			ui.toast(err.message || 'Failed to generate invite link.', 'error');
		}
		activeMenuId = null;
	}
	// Close menu on click outside
	$effect(() => {
		if (activeMenuId) {
			const handleClick = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				// Close if not clicking a menu trigger or inside the menu
				if (!target.closest('.menu-trigger') && !target.closest('.menu-content')) {
					activeMenuId = null;
				}
			};
			window.addEventListener('click', handleClick);
			return () => window.removeEventListener('click', handleClick);
		}
	});

	async function handleCreateGroup() {
		if (!groupTitle.trim()) return;
		isCreatingGroup = true;
		try {
			const emails = groupEmails.split(',').map(e => e.trim()).filter(Boolean);
			const { conversation } = await api.groupChat.createGroup(groupTitle, emails);
			showGroupDialog = false;
			groupTitle = '';
			groupEmails = '';
			goto(`/chat/${conversation.id}`);
		} catch {
			// handle silently
		} finally {
			isCreatingGroup = false;
		}
	}

	function handleGenerateQuiz() {
		if (!activeConversationId && messages.length === 0) return;
		
		// Capture context from current messages
		const context = messages.map(m => {
			if (m.pdf_text) return `[PDF CONTENT]:\n${m.pdf_text}`;
			return m.content;
		}).join('\n\n').slice(-12000);

		if (context) {
			sessionStorage.setItem('niva_quiz_context', context);
			goto('/quiz?from_chat=true');
		} else {
			ui.toast("Not enough conversation context to generate a quiz.", 'error');
		}
	}

	async function handleSidebarGenerateQuiz(id: string) {
		try {
			activeMenuId = null;
			// If it's already the active one, we have the messages. 
			// If not, we might need to fetch them or just notify user to open it first.
			// To be robust, let's just fetch them if not active.
			let contextMessages = messages;
			if (activeConversationId !== id) {
				const data = await api.messages.list(id);
				contextMessages = data.messages;
			}

			const context = contextMessages.map(m => {
				if (m.pdf_text) return `[PDF CONTENT]:\n${m.pdf_text}`;
				return m.content;
			}).join('\n\n').slice(-12000);

			if (context) {
				sessionStorage.setItem('niva_quiz_context', context);
				goto('/quiz?from_chat=true');
			} else {
				ui.toast("This conversation has no messages yet.", 'info');
			}
		} catch (err) {
			console.error("Failed to generate quiz from sidebar:", err);
			ui.toast("Failed to capture conversation context.", 'error');
		}
	}
</script>

<div class="flex h-full relative">
	<!-- Conversation List Sidebar (desktop/tablet) -->
	<aside class="hidden md:flex flex-col w-72 border-r border-niva-glass-border bg-niva-surface-1/50 shrink-0 relative z-40">
		<div class="p-4 border-b border-niva-glass-border">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold text-niva-text font-[Manrope]">
					{isArchiveView ? 'Archived' : 'Conversations'}
				</h2>
				<div class="flex items-center gap-1">
					<button
						onclick={() => isArchiveView = !isArchiveView}
						class="p-1.5 rounded-lg hover:bg-white/5 {isArchiveView ? 'text-niva-accent' : 'text-niva-text-secondary'} transition-colors cursor-pointer"
						title={isArchiveView ? 'Show Active' : 'Show Archived'}
					>
						<Archive size={14} />
					</button>
					<button
						onclick={() => showGroupDialog = true}
						class="p-1.5 px-2.5 rounded-lg bg-niva-accent/10 border border-niva-accent/20 text-[10px] font-bold text-niva-accent hover:bg-niva-accent/20 transition-all cursor-pointer flex items-center gap-1"
						title="New Group Chat"
					>
						<Users size={12} />
						<span>+ GROUP</span>
					</button>
				</div>
			</div>
		</div>
		<div class="flex-1 overflow-y-auto niva-scrollbar p-2 space-y-1">
			{#if conversations.length === 0}
				<p class="text-xs text-niva-text-secondary p-3 text-center">No conversations yet</p>
			{:else}
				{#each conversations as conv (conv.id)}
					<div class="relative group/item {activeMenuId === conv.id ? 'z-[200]' : 'z-10'} rounded-xl transition-all duration-200
						{activeConversationId === conv.id ? 'bg-niva-accent/10 border border-niva-accent/20' : 'hover:bg-white/5 border border-transparent'}">
						
						<!-- Main Selection Button -->
						<button
							onclick={() => selectConversation(conv)}
							class="w-full text-left p-3 pr-11 rounded-xl transition-all duration-200 cursor-pointer"
						>
							<p class="text-sm font-medium text-niva-text truncate">
								{#if conv.is_group}<Users size={11} class="inline-block mr-1 text-niva-accent opacity-70" />{/if}
								{conv.title}
							</p>
							<p class="text-[11px] text-niva-text-secondary mt-1 truncate">{conv.last_message || 'No messages'}</p>
						</button>
						
						<!-- Three-Dot Toggle -->
						<button
							onmousedown={(e) => { e.stopPropagation(); e.preventDefault(); toggleMenu(e, conv.id); }}
							class="absolute top-1/2 -translate-y-1/2 right-1.5 w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer z-[210] menu-trigger
								{activeMenuId === conv.id ? 'bg-niva-accent/20 text-niva-accent opacity-100' : 'opacity-40 group-hover/item:opacity-100 text-niva-text-secondary hover:bg-white/10 hover:text-niva-accent'}
								active:scale-95"
							title="Chat options"
						>
							<MoreVertical size={20} class="pointer-events-none" />
						</button>

						{#if activeMenuId === conv.id}
							<div class="absolute right-0 top-full mt-1 w-52 bg-niva-surface-2 border border-niva-glass-border rounded-2xl shadow-2xl z-[220] p-1.5 animate-in fade-in slide-in-from-top-2 duration-200 menu-content">
								<button onclick={() => handleSidebarShare(conv.id)} class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-niva-text hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left">
									<Share2 size={16} class="text-niva-text-secondary pointer-events-none" />
									Share View
								</button>
								{#if (activeConversationId === conv.id ? canGenerateQuiz : (conv.message_count || 0) > 3)}
									<button onclick={() => handleSidebarGenerateQuiz(conv.id)} class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-niva-accent bg-niva-accent/5 hover:bg-niva-accent/10 rounded-xl transition-colors cursor-pointer text-left font-bold">
										<LayoutList size={16} class="pointer-events-none" />
										Generate Quiz
									</button>
								{/if}
								<button onclick={() => handleInviteLink(conv.id)} class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-niva-text hover:bg-white/5 rounded-xl transition-colors cursor-pointer text-left">
									<UserPlus size={14} class="text-niva-text-secondary" />
									Invite by Link
								</button>
								<button onclick={() => handleRename(conv.id)} class="w-full flex items-center gap-2 px-3 py-2 text-xs text-niva-text hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left">
									<Edit2 size={14} class="text-niva-text-secondary" />
									Rename Chat
								</button>
								<button onclick={() => handleMoveToProject(conv.id)} class="w-full flex items-center gap-2 px-3 py-2 text-xs text-niva-text hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left">
									<FolderOpen size={14} class="text-niva-text-secondary" />
									Move to Project
								</button>
								<button onclick={() => handleArchive(conv.id)} class="w-full flex items-center gap-2 px-3 py-2 text-xs text-niva-text hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left">
									{#if conv.is_archived}
										<ArchiveRestore size={14} class="text-niva-text-secondary" />
										Unarchive Chat
									{:else}
										<Archive size={14} class="text-niva-text-secondary" />
										Archive Chat
									{/if}
								</button>
								<div class="h-px bg-niva-glass-border my-1"></div>
								<button onclick={() => handleDeleteConversation(conv.id)} class="w-full flex items-center gap-2 px-3 py-2 text-xs text-niva-error hover:bg-niva-error-bg/30 rounded-lg transition-colors cursor-pointer text-left">
									<Trash2 size={14} />
									Delete Chat
								</button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</aside>

	<!-- Chat Area -->
	<div class="flex-1 flex flex-col h-full">
		<!-- Top Bar -->
		<header class="h-14 glass-panel-strong flex items-center justify-between px-6 shrink-0">
			<div class="flex items-center gap-3">
				<Sparkles size={18} class="text-niva-accent" />
				<h1 class="text-sm font-semibold text-niva-text font-[Manrope]">
					{activeConversationId ? 'Chat' : 'New Conversation'}
				</h1>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-[10px] font-medium px-2 py-1 rounded-full bg-niva-accent/10 text-niva-accent">
					Niva AI
				</span>
			</div>
		</header>

		<!-- Messages -->
		<div bind:this={messagesContainer} class="flex-1 overflow-y-auto niva-scrollbar px-4 md:px-8 py-6">
			{#if messages.length === 0 && !activeConversationId}
				<!-- Welcome State -->
				<div class="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
					<div class="w-16 h-16 rounded-2xl niva-gradient flex items-center justify-center niva-glow mb-6">
						<Sparkles size={28} class="text-niva-accent" />
					</div>
					<h2 class="text-2xl md:text-3xl font-bold text-niva-text font-[Manrope] text-center mb-2">
						What can I help you with?
					</h2>
					<p class="text-niva-text-secondary text-sm text-center mb-8">
						Start a conversation or pick a suggestion below
					</p>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
						{#each suggestions as sug}
							<button
								onclick={() => handleSuggestionClick(sug.text)}
								class="p-4 rounded-2xl glass-panel hover:bg-white/8 transition-all duration-200 text-left group cursor-pointer"
							>
								<div class="flex items-center gap-3 mb-2">
									<div class="w-8 h-8 rounded-lg bg-niva-accent/10 flex items-center justify-center">
										<sug.icon size={14} class="text-niva-accent" />
									</div>
									<span class="text-[10px] font-medium text-niva-accent uppercase tracking-wider">{sug.category}</span>
								</div>
								<p class="text-sm text-niva-text group-hover:text-white transition-colors">{sug.text}</p>
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<!-- Message List -->
				<div class="max-w-3xl mx-auto space-y-6">
					{#each messages as msg}
						<ChatMessage 
							message={msg} 
							onEdit={handleEditMessage}
							onRetry={handleRetryMessage}
							onShare={() => { if(activeConversationId) handleSidebarShare(activeConversationId) }}
							onGenerateQuiz={handleGenerateQuiz}
						/>
					{/each}

					{#if isSearching}
						<div class="flex gap-3 items-center text-niva-accent animate-pulse px-11">
							<Globe size={14} />
							<span class="text-xs font-medium">Niva is searching the web...</span>
						</div>
					{/if}

					{#if isTyping}
						<div class="flex gap-3 items-start">
							<div class="w-8 h-8 rounded-xl niva-gradient flex items-center justify-center shrink-0">
								<Sparkles size={14} class="text-niva-accent" />
							</div>
							<div class="glass-panel rounded-2xl px-4 py-3">
								<div class="flex gap-1.5">
									<span class="w-2 h-2 rounded-full bg-niva-accent/50 animate-bounce" style="animation-delay: 0ms;"></span>
									<span class="w-2 h-2 rounded-full bg-niva-accent/50 animate-bounce" style="animation-delay: 150ms;"></span>
									<span class="w-2 h-2 rounded-full bg-niva-accent/50 animate-bounce" style="animation-delay: 300ms;"></span>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="border-t border-niva-glass-border p-4 md:px-8 pb-20 md:pb-4">
			<div class="max-w-3xl mx-auto space-y-3">
				<div class="flex flex-wrap gap-2">
					{#if imagePreview}
						<div class="relative w-24 h-24 rounded-xl overflow-hidden border border-niva-accent/30 niva-glow">
							<img src={imagePreview} alt="Preview" class="w-full h-full object-cover" />
							<button
								onclick={removeImage}
								class="absolute top-1 right-1 w-6 h-6 rounded-lg bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
							>
								<X size={14} />
							</button>
						</div>
					{/if}
					{#if docName}
						<div class="relative flex items-center gap-3 px-4 py-2 rounded-xl glass-panel border border-niva-accent/30 niva-glow pr-10">
							<FileText size={18} class="text-niva-accent" />
							<span class="text-xs text-niva-text truncate max-w-[150px]">{docName}</span>
							<button
								onclick={removeDoc}
								class="absolute right-2 w-6 h-6 rounded-lg bg-white/5 text-niva-text-secondary flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
							>
								<X size={14} />
							</button>
						</div>
					{/if}
				</div>

				<div class="flex items-end gap-3 glass-panel rounded-2xl p-3">
					<input
						type="file"
						accept="image/*"
						bind:this={imageInput}
						onchange={handleImageUpload}
						class="hidden"
					/>
					<input
						type="file"
						accept=".pdf"
						bind:this={docInput}
						onchange={handleDocUpload}
						class="hidden"
					/>
					
					<div class="flex gap-1 shrink-0">
						<button
							onclick={handleImageClick}
							class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-all duration-200 cursor-pointer text-niva-text-secondary hover:text-niva-accent"
							title="Upload Image"
						>
							<ImagePlus size={20} />
						</button>
						<button
							onclick={handleDocClick}
							class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-all duration-200 cursor-pointer text-niva-text-secondary hover:text-niva-accent"
							title="Upload PDF"
						>
							<FileText size={20} />
						</button>
						<button
							onclick={() => isSearchEnabled = !isSearchEnabled}
							class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer
								{isSearchEnabled ? 'text-niva-accent bg-niva-accent/10' : 'text-niva-text-secondary hover:text-niva-accent hover:bg-white/5'}"
							title="Web Search"
						>
							<Globe size={20} />
						</button>
					</div>

					<textarea
						bind:this={textareaElement}
						bind:value={inputValue}
						onkeydown={handleKeydown}
						placeholder="Message Niva (search, upload pdf...)"
						rows="1"
						class="flex-1 bg-transparent border-none outline-none text-sm text-niva-text placeholder:text-niva-text-secondary resize-none max-h-32 niva-scrollbar overflow-y-auto"
					></textarea>
					<button
						onclick={handleSend}
						disabled={(!inputValue.trim() && !selectedImage && !selectedDoc) || isLoading}
						class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0
							{(inputValue.trim() || selectedImage || selectedDoc) && !isLoading
								? 'bg-niva-accent text-niva-bg hover:opacity-90'
								: 'bg-white/5 text-niva-text-secondary'}"
					>
						{#if isLoading}
							<Loader2 size={16} class="animate-spin" />
						{:else}
							<Send size={16} />
						{/if}
					</button>
				</div>
				<p class="text-[10px] text-niva-text-secondary text-center">
					Niva AI can search the web and read PDF files now.
				</p>
			</div>
		</div>
	</div>
</div>

<!-- Group Creation Dialog -->
{#if showGroupDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button onclick={() => showGroupDialog = false} class="absolute inset-0 bg-black/50 backdrop-blur-sm border-none cursor-default" aria-label="Close dialog"></button>
		<div class="relative glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-md space-y-5 shadow-2xl">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Users size={18} class="text-niva-accent" />
					<h3 class="text-sm font-bold text-niva-text">New Group Chat</h3>
				</div>
				<button onclick={() => showGroupDialog = false} class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary cursor-pointer">
					<X size={14} />
				</button>
			</div>
			<div class="space-y-3">
				<div class="space-y-1.5">
					<label for="groupName" class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-wider">Group Name</label>
					<input
						id="groupName"
						type="text"
						bind:value={groupTitle}
						placeholder="e.g. Study Group, Project Team..."
						class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text outline-none focus:border-niva-accent/30 transition-colors"
					/>
				</div>
				<div class="space-y-1.5">
					<label for="groupMembers" class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-wider">Members (emails, comma separated)</label>
					<input
						id="groupMembers"
						type="text"
						bind:value={groupEmails}
						placeholder="user1@email.com, user2@email.com"
						class="w-full h-10 px-4 rounded-xl bg-white/5 border border-niva-glass-border text-sm text-niva-text outline-none focus:border-niva-accent/30 transition-colors"
					/>
				</div>
			</div>
			<button
				onclick={handleCreateGroup}
				disabled={!groupTitle.trim() || isCreatingGroup}
				class="w-full h-10 rounded-xl bg-niva-accent text-niva-bg text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
			>
				{#if isCreatingGroup}
					<Loader2 size={14} class="animate-spin" />
				{:else}
					<UserPlus size={14} />
				{/if}
				Create Group
			</button>
		</div>
	</div>
{/if}
