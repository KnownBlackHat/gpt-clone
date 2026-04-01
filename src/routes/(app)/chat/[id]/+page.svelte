<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api, type Message } from '$lib/api';
	import {
		Send,
		Sparkles,
		Loader2,
		ArrowLeft,
		ImagePlus,
		FileText,
		X,
		Globe,
		MoreVertical,
		Share2,
		Edit2,
		Trash2,
	} from '@lucide/svelte';

	import ChatMessage from '$lib/components/ChatMessage.svelte';

	let conversationId = $derived($page.params.id);
	let messages = $state<Message[]>([]);
	let inputValue = $state('');
	let isLoading = $state(false);
	let isTyping = $state(false);
	let isSearching = $state(false);
	let title = $state('Chat');
	let messagesContainer: HTMLElement;
	let errorMessage = $state<string | null>(null);
	let isSearchEnabled = $state(false);
	let textareaElement = $state<HTMLTextAreaElement | null>(null);
	let isMenuOpen = $state(false);

	// Auto-resize textarea
	$effect(() => {
		if (textareaElement && inputValue !== undefined) {
			textareaElement.style.height = 'auto';
			textareaElement.style.height = textareaElement.scrollHeight + 'px';
		}
	});

	const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

	// Multimodal / Document state
	let imageInput: HTMLInputElement;
	let docInput: HTMLInputElement;
	let selectedImage = $state<string | null>(null);
	let imagePreview = $state<string | null>(null);
	let selectedDoc = $state<string | null>(null);
	let docName = $state<string | null>(null);

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 50);
	}

	async function loadData() {
		if (!conversationId) return;
		try {
			const [convData, msgData] = await Promise.all([
				api.conversations.get(conversationId),
				api.messages.list(conversationId),
			]);
			title = convData.conversation.title;
			messages = msgData.messages;
			scrollToBottom();
		} catch {
			goto('/chat');
		}
	}

	function handleImageClick() {
		imageInput.click();
	}

	function handleDocClick() {
		docInput.click();
	}

	function handleImageUpload(e: Event) {
		errorMessage = null;
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE) {
			errorMessage = `Image too large. Max size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
			if (imageInput) imageInput.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			const base64 = e.target?.result as string;
			selectedImage = base64;
			imagePreview = base64;
		};
		reader.readAsDataURL(file);
	}

	function handleDocUpload(e: Event) {
		errorMessage = null;
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE) {
			errorMessage = `PDF too large. Max size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
			if (docInput) docInput.value = '';
			return;
		}

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
		if ((!inputValue.trim() && !selectedImage && !selectedDoc) || isLoading || !conversationId) return;

		const content = inputValue.trim();
		const imageUrl = selectedImage;
		const docUrl = selectedDoc;
		const currentDocName = docName;

		inputValue = '';
		removeImage();
		removeDoc();

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

		try {
			const data = await api.messages.send(conversationId, content, imageUrl || undefined, docUrl || undefined, currentSearchEnabled);
			messages = messages
				.filter((m) => m.id !== tempUserMsg.id)
				.concat([data.userMessage, data.assistantMessage]);
			scrollToBottom();
		} catch (err: any) {
			messages = messages.filter((m) => m.id !== tempUserMsg.id);
			if (err.message.includes('413') || err.message.toLowerCase().includes('large')) {
				errorMessage = "File is too large for the server to process. Please try a smaller file.";
			} else {
				errorMessage = err.message || "Failed to send message. Please try again.";
			}
		} finally {
			isLoading = false;
			isTyping = false;
			isSearching = false;
		}
	}

	async function handleEdit(messageId: string, newContent: string) {
		try {
			isLoading = true;
			const data = await api.messages.edit(messageId, newContent);
			
			// Update messages list: remove everything after the edited message
			const msgIndex = messages.findIndex(m => m.id === messageId);
			if (msgIndex !== -1) {
				messages = messages.slice(0, msgIndex + 1);
				messages[msgIndex].content = newContent;
			}

			if (data.needsResend) {
				// We need to trigger a new response. 
				// The easiest way is to reuse handleSend logic but for the edited content
				inputValue = newContent;
				// Remove the message we just updated from the list because handleSend will add a 'temp' one
				// or just call the API directly.
				messages = messages.slice(0, msgIndex); 
				await handleSend();
			}
		} catch (err: any) {
			errorMessage = err.message || "Failed to edit message.";
		} finally {
			isLoading = false;
		}
	}

	async function handleRetry(messageId: string) {
		try {
			isLoading = true;
			const data = await api.messages.retry(messageId);
			
			// Find the user message that was retried
			const msgIndex = messages.findIndex(m => m.id === messageId);
			if (msgIndex !== -1) {
				// Remove the assistant message and everything after
				messages = messages.slice(0, msgIndex);
			}

			if (data.needsResend) {
				inputValue = data.userMessage.content;
				// handleSend will add it back
				messages = messages.filter(m => m.id !== data.userMessage.id);
				await handleSend();
			}
		} catch (err: any) {
			errorMessage = err.message || "Failed to retry message.";
		} finally {
			isLoading = false;
		}
	}

	async function handleShare() {
		if (!conversationId) return;
		try {
			isLoading = true;
			const { shareId } = await api.conversations.share(conversationId);
			const shareUrl = `${window.location.origin}/share/${shareId}`;
			
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(shareUrl);
				alert("Share link copied to clipboard!");
			} else {
				errorMessage = `Share link: ${shareUrl}`;
			}
		} catch (err: any) {
			errorMessage = err.message || "Failed to generate share link.";
		} finally {
			isLoading = false;
		}
	}

	async function handleRename() {
		if (!conversationId) return;
		const newTitle = prompt('Enter new conversation title:', title);
		if (newTitle && newTitle !== title) {
			try {
				await api.conversations.rename(conversationId, newTitle);
				title = newTitle;
			} catch {
				alert('Failed to rename conversation.');
			}
		}
		isMenuOpen = false;
	}

	async function handleDelete() {
		if (!conversationId) return;
		if (confirm('Are you sure you want to delete this conversation?')) {
			try {
				await api.conversations.delete(conversationId);
				goto('/chat');
			} catch (err: any) {
				errorMessage = err.message || "Failed to delete conversation.";
			}
		}
		isMenuOpen = false;
	}

	// Close menu on click outside
	$effect(() => {
		const handleClick = () => isMenuOpen = false;
		if (isMenuOpen) {
			window.addEventListener('click', handleClick);
			return () => window.removeEventListener('click', handleClick);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	$effect(() => {
		if (conversationId) loadData();
	});
</script>

<div class="flex flex-col h-full">
	<!-- Top Bar -->
	<header class="h-14 glass-panel-strong flex items-center justify-between md:px-6 px-4 shrink-0 relative z-50">
		<div class="flex items-center gap-3">
			<button onclick={() => goto('/chat')} class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary transition-colors cursor-pointer">
				<ArrowLeft size={16} />
			</button>
			<Sparkles size={18} class="text-niva-accent" />
			<h1 class="text-sm font-semibold text-niva-text font-[Manrope] truncate max-w-[150px] md:max-w-xs">{title}</h1>
		</div>
		<div class="flex items-center gap-2">
			<span class="hidden sm:inline-block text-[10px] font-medium px-2 py-1 rounded-full bg-niva-accent/10 text-niva-accent">
				Niva AI
			</span>
			<div class="relative">
				<button 
					onclick={(e) => { e.stopPropagation(); isMenuOpen = !isMenuOpen; }}
					class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary transition-colors cursor-pointer"
				>
					<MoreVertical size={18} />
				</button>
				
				{#if isMenuOpen}
					<div class="absolute right-0 top-10 w-48 bg-niva-surface-2 border border-niva-glass-border rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in duration-200">
						<button onclick={handleShare} class="w-full flex items-center gap-2 px-3 py-2 text-xs text-niva-text hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left">
							<Share2 size={14} class="text-niva-text-secondary" />
							Share Chat
						</button>
						<button onclick={handleRename} class="w-full flex items-center gap-2 px-3 py-2 text-xs text-niva-text hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left">
							<Edit2 size={14} class="text-niva-text-secondary" />
							Rename Chat
						</button>
						<div class="h-px bg-niva-glass-border my-1"></div>
						<button onclick={handleDelete} class="w-full flex items-center gap-2 px-3 py-2 text-xs text-niva-error hover:bg-niva-error-bg/30 rounded-lg transition-colors cursor-pointer text-left">
							<Trash2 size={14} />
							Delete Chat
						</button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<div bind:this={messagesContainer} class="flex-1 overflow-y-auto niva-scrollbar px-3 md:px-8 py-6">
		<div class="max-w-3xl mx-auto space-y-6">
			{#each messages as msg}
				<ChatMessage 
					message={msg} 
					onEdit={handleEdit}
					onRetry={handleRetry}
					onShare={handleShare}
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
	</div>

	<!-- Input Area -->
	<div class="border-t border-niva-glass-border p-3 md:px-8 pb-20 md:pb-4">
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

			{#if errorMessage}
				<div class="px-4 py-2 rounded-xl bg-niva-error-bg border border-niva-error/20 flex items-center justify-between group">
					<div class="flex items-center gap-2">
						<span class="w-1.5 h-1.5 rounded-full bg-niva-error animate-pulse"></span>
						<span class="text-xs text-niva-error font-medium">{errorMessage}</span>
					</div>
					<button onclick={() => errorMessage = null} class="p-1 rounded-lg hover:bg-niva-error/10 text-niva-error/60 transition-colors">
						<X size={12} />
					</button>
				</div>
			{/if}

			<div class="flex items-end gap-2 md:gap-3 glass-panel rounded-2xl md:p-3 p-2">
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
				
				<div class="flex gap-0.5 md:gap-1 shrink-0">
					<button
						onclick={handleImageClick}
						class="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-all duration-200 cursor-pointer text-niva-text-secondary hover:text-niva-accent"
						title="Upload Image"
					>
						<ImagePlus size={18} class="md:hidden" />
						<ImagePlus size={20} class="hidden md:block" />
					</button>
					<button
						onclick={handleDocClick}
						class="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-all duration-200 cursor-pointer text-niva-text-secondary hover:text-niva-accent"
						title="Upload PDF"
					>
						<FileText size={18} class="md:hidden" />
						<FileText size={20} class="hidden md:block" />
					</button>
					<button
						onclick={() => isSearchEnabled = !isSearchEnabled}
						class="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer
							{isSearchEnabled ? 'text-niva-accent bg-niva-accent/10' : 'text-niva-text-secondary hover:text-niva-accent hover:bg-white/5'}"
						title="Web Search"
					>
						<Globe size={18} class="md:hidden" />
						<Globe size={20} class="hidden md:block" />
					</button>
				</div>

				<textarea
					bind:this={textareaElement}
					bind:value={inputValue}
					onkeydown={handleKeydown}
					placeholder="Message Niva..."
					rows="1"
					class="flex-1 bg-transparent border-none outline-none text-[13px] md:text-sm text-niva-text placeholder:text-niva-text-secondary resize-none max-h-24 md:max-h-32 niva-scrollbar overflow-y-auto py-1.5"
				></textarea>
				<button
					onclick={handleSend}
					disabled={(!inputValue.trim() && !selectedImage && !selectedDoc) || isLoading}
					class="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0
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
		</div>
	</div>
</div>

<style>
</style>
