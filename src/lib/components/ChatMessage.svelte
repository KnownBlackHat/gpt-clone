<script lang="ts">
	import { Marked } from 'marked';
	import { markedHighlight } from 'marked-highlight';
	import hljs from 'highlight.js';
	import DOMPurify from 'dompurify';
	import { Sparkles, User as UserIcon, Copy, Check, Edit2, RotateCcw, X, Send, Share2, LayoutList } from '@lucide/svelte';

	// Import highlight.js theme
	import 'highlight.js/styles/atom-one-dark.css';

	let { message, onEdit, onRetry, onShare, onGenerateQuiz } = $props<{ 
		message: any, 
		onEdit?: (id: string, newContent: string) => void,
		onRetry?: (id: string) => void,
		onShare?: (id: string) => void,
		onGenerateQuiz?: (id: string) => void
	}>();
	let isAssistant = $derived(message.role === 'assistant');
	let copied = $state(false);
	let isEditing = $state(false);
	let editContent = $state('');

	$effect(() => {
		editContent = message.content;
	});

	function startEditing() {
		editContent = message.content;
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
	}

	function saveEdit() {
		if (editContent.trim() && editContent !== message.content) {
			onEdit?.(message.id, editContent);
		}
		isEditing = false;
	}

	async function copyToClipboard() {
		const text = message.content;
		if (!text) return;

		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
			} else {
				// Fallback to execCommand('copy') for non-secure contexts
				const textArea = document.createElement('textarea');
				textArea.value = text;
				textArea.style.position = 'fixed';
				textArea.style.left = '-9999px';
				textArea.style.top = '0';
				document.body.appendChild(textArea);
				textArea.focus();
				textArea.select();
				const successful = document.execCommand('copy');
				document.body.removeChild(textArea);
				if (!successful) throw new Error('copy command failed');
			}
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	const marked = new Marked(
		markedHighlight({
			langPrefix: 'hljs language-',
			highlight(code, lang) {
				const language = hljs.getLanguage(lang) ? lang : 'plaintext';
				return hljs.highlight(code, { language }).value;
			}
		})
	);

	function renderMarkdown(content: string) {
		if (!content) return '';
		try {
			// First, handle <calculation> tags
			let processed = content.replace(/<calculation>([\s\S]*?)<\/calculation>/g, (match, calculation) => {
				return `
					<details class="niva-calculation-dropdown">
						<summary>
							<span class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-niva-accent"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="12" x2="12" y1="8" y2="16"/></svg>
								Show Calculations
							</span>
						</summary>
						<div class="calculation-content">
							${marked.parse(calculation.trim())}
						</div>
					</details>
				`;
			});

			const rawHtml = marked.parse(processed) as string;
			return DOMPurify.sanitize(rawHtml, {
				ADD_TAGS: ['details', 'summary'],
				ADD_ATTR: ['class']
			});
		} catch (e) {
			console.error('Markdown rendering error:', e);
			return content;
		}
	}

	function formatTime(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function setupCodeBlocks(node: HTMLElement, content: string) {
		const update = () => {
			const pres = node.querySelectorAll('pre');
			pres.forEach((pre) => {
				if (pre.querySelector('.copy-code-btn')) return;

				pre.style.position = 'relative';
				const btn = document.createElement('button');
				btn.className = 'copy-code-btn';
				btn.innerHTML = `
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
					<span>Copy</span>
				`;

				btn.onclick = async () => {
					const code = pre.querySelector('code')?.innerText || '';
					if (!code) return;

					try {
						if (navigator.clipboard && window.isSecureContext) {
							await navigator.clipboard.writeText(code);
						} else {
							const textArea = document.createElement('textarea');
							textArea.value = code;
							textArea.style.position = 'fixed';
							textArea.style.left = '-9999px';
							document.body.appendChild(textArea);
							textArea.select();
							document.execCommand('copy');
							document.body.removeChild(textArea);
						}

						btn.classList.add('copied');
						btn.innerHTML = `
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
							<span class="text-green-400">Copied!</span>
						`;
						setTimeout(() => {
							btn.classList.remove('copied');
							btn.innerHTML = `
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
								<span>Copy</span>
							`;
						}, 2000);
					} catch (err) {
						console.error('Failed to copy code:', err);
					}
				};

				pre.appendChild(btn);
			});
		};

		update();
		return { update };
	}
</script>

<div class="flex md:gap-4 gap-3 {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group animate-slide-up">
	<!-- Avatar -->
	<div class="shrink-0 pt-1">
		{#if message.role === 'assistant'}
			<div class="w-8 h-8 rounded-xl niva-gradient flex items-center justify-center niva-glow">
				<Sparkles size={14} class="text-niva-accent" />
			</div>
		{:else}
			<div class="w-8 h-8 rounded-xl bg-niva-accent/10 border border-niva-accent/20 flex items-center justify-center">
				<UserIcon size={14} class="text-niva-accent" />
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="flex flex-col md:max-w-[85%] max-w-[92%] {message.role === 'user' ? 'items-end' : 'items-start'}">
		<div
			class="md:px-5 px-4 md:py-3.5 py-3 rounded-2xl md:text-sm text-[13px] leading-relaxed transition-all duration-300
				{message.role === 'user'
					? 'bg-niva-accent text-niva-bg font-medium rounded-tr-none niva-glow-sm'
					: 'glass-panel text-niva-text rounded-tl-none border border-white/5'}"
		>
			{#if message.role === 'assistant'}
				<div class="markdown-content" use:setupCodeBlocks={message.content}>
					{@html renderMarkdown(message.content)}
				</div>
			{:else}
				{#if isEditing}
					<div class="flex flex-col gap-2 min-w-[200px] md:min-w-[400px]">
						<textarea
							bind:value={editContent}
							class="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm text-niva-bg placeholder:text-niva-bg/50 outline-none focus:border-white/40 resize-none min-h-[80px]"
						></textarea>
						<div class="flex justify-end gap-2">
							<button 
								onclick={cancelEditing}
								class="px-3 py-1.5 rounded-lg hover:bg-white/10 text-niva-bg/80 text-xs font-medium transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button 
								onclick={saveEdit}
								class="px-3 py-1.5 rounded-lg bg-niva-bg text-niva-accent text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
							>
								<Send size={12} />
								Save & Submit
							</button>
						</div>
					</div>
				{:else}
					<div class="whitespace-pre-wrap">{message.content}</div>
				{/if}
			{/if}
		</div>

		{#if isAssistant}
			<div class="mt-1 flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
				<button
					onclick={copyToClipboard}
					class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary hover:text-niva-accent transition-all duration-200 cursor-pointer flex items-center gap-1.5 group/btn"
					title="Copy response"
				>
					{#if copied}
						<Check size={14} class="text-green-400" />
					{:else}
						<Copy size={14} class="opacity-50 group-hover/btn:opacity-100 transition-opacity" />
					{/if}
				</button>
				<button
					onclick={() => onRetry?.(message.id)}
					class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary hover:text-niva-accent transition-all duration-200 cursor-pointer flex items-center gap-1.5 group/btn"
					title="Retry response"
				>
					<RotateCcw size={14} class="opacity-50 group-hover/btn:opacity-100 transition-opacity" />
				</button>
				<button
					onclick={() => onShare?.(message.id)}
					class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary hover:text-niva-accent transition-all duration-200 cursor-pointer flex items-center gap-1.5 group/btn"
					title="Share chat"
				>
					<Share2 size={14} class="opacity-50 group-hover/btn:opacity-100 transition-opacity" />
				</button>
				
				{#if onGenerateQuiz}
					<button
						onclick={() => onGenerateQuiz(message.id)}
						class="p-1.5 px-2.5 rounded-lg bg-niva-accent/10 border border-niva-accent/20 text-[10px] font-bold text-niva-accent hover:bg-niva-accent/20 transition-all cursor-pointer flex items-center gap-1.5 ml-2"
						title="Generate Quiz from this context"
					>
						<LayoutList size={12} />
						<span>QUIZZ</span>
					</button>
				{/if}
			</div>
		{/if}

		{#if message.image_url}
			<div class="mt-3 rounded-2xl overflow-hidden border border-white/10 shadow-xl max-w-full md:max-w-sm group/img relative">
				<img src={message.image_url} alt="User upload" class="w-full h-auto object-cover transition-transform duration-500 group-hover/img:scale-105" />
				<div class="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity"></div>
			</div>
		{/if}

		<span class="text-[10px] text-niva-text-secondary mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity font-medium tracking-tight">
			{formatTime(message.created_at)}
		</span>
	</div>
</div>

<style>
	:global(.markdown-content) {
		word-break: break-word;
		color: var(--niva-text);
	}
	
	:global(.markdown-content p) {
		margin-bottom: 1.25rem;
	}
	
	:global(.markdown-content p:last-child) {
		margin-bottom: 0;
	}
	
	:global(.markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4, .markdown-content h5, .markdown-content h6) {
		font-weight: 700;
		color: #fff;
		margin-top: 1.75rem;
		margin-bottom: 0.75rem;
		line-height: 1.3;
		font-family: var(--font-display, inherit);
	}
	
	:global(.markdown-content h1) { font-size: 1.625rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 0.5rem; }
	:global(.markdown-content h2) { font-size: 1.375rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 0.3rem; }
	:global(.markdown-content h3) { font-size: 1.125rem; }
	:global(.markdown-content h4) { font-size: 1rem; }

	:global(.markdown-content ul, .markdown-content ol) {
		margin-top: 0.5rem;
		margin-bottom: 1.25rem;
		padding-left: 1.5rem;
	}
	
	:global(.markdown-content ul) { list-style-type: disc; }
	:global(.markdown-content ol) { list-style-type: decimal; }
	
	:global(.markdown-content li) { 
		margin-bottom: 0.625rem;
		line-height: 1.6;
	}
	
	:global(.markdown-content li::marker) {
		color: var(--niva-accent);
	}
	
	:global(.markdown-content li:last-child) { margin-bottom: 0; }

	:global(.markdown-content pre) {
		background: #1e1e1e !important;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.875rem;
		padding: 1.25rem;
		margin: 1.5rem 0;
		overflow-x: auto;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
	}
	
	:global(.markdown-content code) {
		font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.875em;
		padding: 0.2em 0.4em;
		background: rgba(175, 198, 255, 0.1);
		border-radius: 0.375rem;
		color: #AFC6FF;
		border: 1px solid rgba(175, 198, 255, 0.1);
	}
	
	:global(.markdown-content pre code) {
		background: transparent;
		padding: 0;
		border-radius: 0;
		color: inherit;
		display: block;
		border: none;
		line-height: 1.5;
	}

	:global(.markdown-content blockquote) {
		border-left: 4px solid var(--niva-accent);
		padding: 0.75rem 1rem 0.75rem 1.25rem;
		margin: 1.5rem 0;
		color: rgba(255, 255, 255, 0.85);
		font-style: italic;
		background: rgba(175, 198, 255, 0.03);
		border-radius: 0 0.75rem 0.75rem 0;
	}

	:global(.markdown-content strong) {
		font-weight: 700;
		color: #fff;
	}

	:global(.markdown-content a) {
		color: var(--niva-accent);
		text-decoration: underline;
		text-underline-offset: 3px;
		transition: opacity 0.2s;
	}
	
	:global(.markdown-content a:hover) {
		opacity: 0.8;
	}

	/* Citation styling */
	:global(.markdown-content a[href*="http"]) {
		font-size: 0.75em;
		vertical-align: super;
		text-decoration: none;
		background: rgba(175, 198, 255, 0.15);
		padding: 0.1em 0.4em;
		border-radius: 0.25rem;
		margin: 0 0.15em;
		font-weight: 600;
		border: 1px solid rgba(175, 198, 255, 0.2);
	}
	
	:global(.markdown-content a[href*="http"]:hover) {
		background: rgba(175, 198, 255, 0.25);
		border-color: var(--niva-accent);
	}

	/* References list at bottom */
	:global(.markdown-content h3#references) {
		font-size: 0.9rem;
		margin-top: 1.5rem;
		color: var(--niva-text-secondary);
		border-bottom: none;
	}
	
	:global(.markdown-content h3#references + ul) {
		font-size: 0.8rem;
		color: var(--niva-text-secondary);
		list-style-type: none;
		padding-left: 0;
	}
	
	:global(.markdown-content h3#references + ul li) {
		margin-bottom: 0.25rem;
	}

	:global(.markdown-content hr) {
		border: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		margin: 2rem 0;
	}

	:global(.markdown-content table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1.5rem 0;
		font-size: 0.9em;
	}
	
	:global(.markdown-content th, .markdown-content td) {
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.75rem;
		text-align: left;
	}
	
	:global(.markdown-content th) {
		background: rgba(255, 255, 255, 0.05);
		font-weight: 600;
	}

	:global(.hljs) {
		background: transparent !important;
		padding: 0 !important;
	}

	:global(.niva-calculation-dropdown) {
		margin: 1rem 0;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.03);
		transition: all 0.3s ease;
	}

	:global(.niva-calculation-dropdown[open]) {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(var(--niva-accent-rgb), 0.2);
	}

	:global(.niva-calculation-dropdown summary) {
		padding: 0.75rem 1rem;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--niva-text-secondary);
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		user-select: none;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	:global(.niva-calculation-dropdown summary::-webkit-details-marker) {
		display: none;
	}

	:global(.niva-calculation-dropdown summary:hover) {
		color: var(--niva-text);
		background: rgba(255, 255, 255, 0.02);
	}

	:global(.niva-calculation-dropdown .calculation-content) {
		padding: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		font-size: 0.85rem;
		line-height: 1.6;
		color: var(--niva-text);
	}

	:global(.niva-calculation-dropdown .calculation-content p) {
		margin-bottom: 0.75rem;
	}

	:global(.niva-calculation-dropdown .calculation-content p:last-child) {
		margin-bottom: 0;
	}
</style>
