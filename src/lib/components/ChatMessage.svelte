<script lang="ts">
	import { Marked } from 'marked';
	import { markedHighlight } from 'marked-highlight';
	import hljs from 'highlight.js';
	import DOMPurify from 'dompurify';
	import { Sparkles, User as UserIcon, Copy, Check } from '@lucide/svelte';

	// Import highlight.js theme
	import 'highlight.js/styles/atom-one-dark.css';

	let { message } = $props<{ message: any }>();
	let isAssistant = $derived(message.role === 'assistant');
	let copied = $state(false);

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
			const rawHtml = marked.parse(content) as string;
			return DOMPurify.sanitize(rawHtml);
		} catch (e) {
			console.error('Markdown rendering error:', e);
			return content;
		}
	}

	function formatTime(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

</script>

<div class="flex gap-4 {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group animate-slide-up">
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
	<div class="flex flex-col max-w-[85%] {message.role === 'user' ? 'items-end' : 'items-start'}">
		<div
			class="px-5 py-3.5 rounded-2xl text-sm leading-relaxed transition-all duration-300
				{message.role === 'user'
					? 'bg-niva-accent text-niva-bg font-medium rounded-tr-none niva-glow-sm'
					: 'glass-panel text-niva-text rounded-tl-none border border-white/5'}"
		>
			{#if message.role === 'assistant'}
				<div class="markdown-content">
					{@html renderMarkdown(message.content)}
				</div>
				{#if isAssistant}
					<div class="mt-3 flex items-center justify-end border-t border-white/5 pt-2">
						<button
							onclick={copyToClipboard}
							class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary hover:text-niva-accent transition-all duration-200 cursor-pointer flex items-center gap-1.5 group"
							title="Copy response"
						>
							{#if copied}
								<Check size={14} class="text-green-400" />
								<span class="text-[10px] font-medium text-green-400">Copied!</span>
							{:else}
								<Copy size={14} class="opacity-50 group-hover:opacity-100 transition-opacity" />
								<span class="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
							{/if}
						</button>
					</div>
				{/if}
			{:else}
				<div class="whitespace-pre-wrap">{message.content}</div>
			{/if}
		</div>

		{#if message.image_url}
			<div class="mt-3 rounded-2xl overflow-hidden border border-white/10 shadow-xl max-w-sm group/img relative">
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
</style>
