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
	} from '@lucide/svelte';

	import { Marked } from 'marked';
	import DOMPurify from 'dompurify';

	const marked = new Marked();

	let conversationId = $derived($page.params.id);
	let messages = $state<Message[]>([]);
	let inputValue = $state('');
	let isLoading = $state(false);
	let isTyping = $state(false);
	let isSearching = $state(false);
	let title = $state('Chat');
	let messagesContainer: HTMLElement;
	let errorMessage = $state<string | null>(null);

	const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

	// Helper to render markdown safely
	function renderMarkdown(content: string) {
		if (!content) return '';
		try {
			// Ensure marked is working
			const rawHtml = marked && typeof marked.parse === 'function' 
				? marked.parse(content) as string 
				: content;
			
			// Sanitize
			return DOMPurify && typeof DOMPurify.sanitize === 'function'
				? DOMPurify.sanitize(rawHtml)
				: rawHtml;
		} catch (e) {
			console.error('Markdown rendering error:', e);
			return content;
		}
	}

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
		if (lowContent.includes('search') || lowContent.includes('latest') || lowContent.includes('who is')) {
			isSearching = true;
		}

		try {
			const data = await api.messages.send(conversationId, content, imageUrl || undefined, docUrl || undefined);
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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function formatTime(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	$effect(() => {
		if (conversationId) loadData();
	});
</script>

<div class="flex flex-col h-full">
	<!-- Top Bar -->
	<header class="h-14 glass-panel-strong flex items-center justify-between px-6 shrink-0">
		<div class="flex items-center gap-3">
			<button onclick={() => goto('/chat')} class="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
				<ArrowLeft size={16} class="text-niva-text-secondary" />
			</button>
			<Sparkles size={18} class="text-niva-accent" />
			<h1 class="text-sm font-semibold text-niva-text font-[Manrope] truncate max-w-xs">{title}</h1>
		</div>
		<span class="text-[10px] font-medium px-2 py-1 rounded-full bg-niva-accent/10 text-niva-accent">
			Niva AI
		</span>
	</header>

	<!-- Messages -->
	<div bind:this={messagesContainer} class="flex-1 overflow-y-auto niva-scrollbar px-4 md:px-8 py-6">
		<div class="max-w-3xl mx-auto space-y-6">
			{#each messages as msg}
				<div class="flex gap-3 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
					{#if msg.role === 'assistant'}
						<div class="w-8 h-8 rounded-xl niva-gradient flex items-center justify-center shrink-0 mt-1">
							<Sparkles size={14} class="text-niva-accent" />
						</div>
					{/if}
					<div
						class="max-w-[80%] rounded-2xl px-4 py-3 {msg.role === 'user'
							? 'bg-niva-accent/15 border border-niva-accent/20 text-niva-text'
							: 'glass-panel text-niva-text'}"
					>
						{#if msg.image_url}
							<div class="mb-3 rounded-xl overflow-hidden border border-white/10">
								<img src={msg.image_url} alt="Attached input" class="max-w-full h-auto object-contain max-h-64" />
							</div>
						{/if}
						{#if msg.content}
							<div class="text-sm leading-relaxed markdown-content">
								{#if msg.role === 'assistant'}
									{@html renderMarkdown(msg.content)}
								{:else}
									<p class="whitespace-pre-wrap">{msg.content}</p>
								{/if}
							</div>
						{/if}
						<span class="text-[10px] text-niva-text-secondary mt-2 block">{formatTime(msg.created_at)}</span>
					</div>
				</div>
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
				</div>

				<textarea
					bind:value={inputValue}
					onkeydown={handleKeydown}
					placeholder="Message Niva..."
					rows="1"
					class="flex-1 bg-transparent border-none outline-none text-sm text-niva-text placeholder:text-niva-text-secondary resize-none max-h-32"
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
		</div>
	</div>
</div>

<style>
	:global(.markdown-content) {
		word-break: break-word;
	}
	:global(.markdown-content p) {
		margin-bottom: 0.75rem;
	}
	:global(.markdown-content p:last-child) {
		margin-bottom: 0;
	}
	:global(.markdown-content pre) {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.75rem;
		padding: 1rem;
		margin: 1rem 0;
		overflow-x: auto;
	}
	:global(.markdown-content code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 0.85em;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.2rem 0.4rem;
		border-radius: 0.4rem;
	}
	:global(.markdown-content pre code) {
		background: transparent;
		padding: 0;
		border-radius: 0;
	}
	:global(.markdown-content ul) {
		margin: 0.75rem 0;
		padding-left: 1.5rem;
		list-style-type: disc;
	}
	:global(.markdown-content ol) {
		margin: 0.75rem 0;
		padding-left: 1.5rem;
		list-style-type: decimal;
	}
	:global(.markdown-content li) {
		margin-bottom: 0.4rem;
	}
	:global(.markdown-content h1, .markdown-content h2, .markdown-content h3) {
		font-weight: 600;
		margin: 1.25rem 0 0.75rem 0;
		color: #fff;
		line-height: 1.3;
	}
	:global(.markdown-content strong) {
		font-weight: 700;
		color: #fff;
	}
	:global(.markdown-content em) {
		font-style: italic;
	}
	:global(.markdown-content blockquote) {
		border-left: 3px solid rgba(255, 255, 255, 0.2);
		padding-left: 1rem;
		margin: 1rem 0;
		color: rgba(255, 255, 255, 0.7);
	}
</style>
