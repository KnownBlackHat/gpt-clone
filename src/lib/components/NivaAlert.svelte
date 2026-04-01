<script lang="ts">
	import { ui } from '$lib/stores/ui';
	import { fade, scale, fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { 
		AlertCircle, 
		CheckCircle2, 
		Info, 
		HelpCircle,
		X,
		MessageSquare,
		ListFilter
	} from '@lucide/svelte';

	const icons = {
		info: Info,
		success: CheckCircle2,
		error: AlertCircle,
		confirm: HelpCircle,
		prompt: MessageSquare,
		select: ListFilter
	};

	const colors = {
		info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
		success: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
		error: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
		confirm: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
		prompt: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
		select: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20'
	};

	let Icon = $derived(icons[$ui.type]);
</script>

{#if $ui.show}
	<div 
		class="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 150 }}
	>
		<!-- Backdrop -->
		<div 
			class="absolute inset-0 bg-niva-bg/80 backdrop-blur-md"
			onclick={() => ui.close(false)}
		></div>

		<!-- Dialog -->
		<div 
			class="relative w-full max-w-sm glass-panel-strong border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden p-8 space-y-6"
			in:scale={{ duration: 400, start: 0.9, easing: backOut }}
		>
			<div class="flex flex-col items-center text-center space-y-4">
				<div class="w-16 h-16 rounded-2xl flex items-center justify-center {colors[$ui.type]} niva-glow-sm">
					<Icon size={32} />
				</div>
				
				<div class="space-y-2">
					<h3 class="text-xl font-bold text-niva-text tracking-tight">{$ui.title}</h3>
					<p class="text-sm text-niva-text-secondary leading-relaxed font-medium">{$ui.message}</p>
				</div>

				{#if $ui.type === 'prompt'}
					<div class="w-full pt-4" in:fly={{ y: 10, duration: 300 }}>
						<input 
							type="text" 
							bind:value={$ui.promptValue}
							placeholder={$ui.placeholder}
							class="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-niva-text placeholder:text-white/20 outline-none focus:border-niva-accent/50 focus:bg-white/10 transition-all"
							autofocus
							onkeydown={(e) => e.key === 'Enter' && ui.close($ui.promptValue)}
						/>
					</div>
				{:else if $ui.type === 'select' && $ui.options}
					<div class="w-full pt-4 max-h-[40dvh] overflow-y-auto niva-scrollbar flex flex-col gap-2" in:fly={{ y: 10, duration: 300 }}>
						{#each $ui.options as option}
							<button
								onclick={() => ui.close(option.value)}
								class="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-pointer text-left group"
							>
								<span class="text-sm font-medium text-niva-text group-hover:text-niva-accent transition-colors">{option.label}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex flex-col sm:flex-row gap-3 pt-2">
				{#if $ui.type === 'confirm' || $ui.type === 'prompt' || $ui.type === 'select'}
					<button 
						onclick={() => ui.close(false)}
						class="flex-1 h-12 rounded-xl bg-white/5 border border-white/5 text-niva-text-secondary font-bold text-xs uppercase tracking-widest hover:bg-white/10 hover:text-niva-text transition-all cursor-pointer"
					>
						{$ui.cancelText || 'Cancel'}
					</button>
				{/if}
				{#if $ui.type !== 'select'}
					<button 
						onclick={() => ui.close($ui.type === 'prompt' ? $ui.promptValue : true)}
						class="flex-1 h-12 rounded-xl {$ui.type === 'error' ? 'bg-rose-500 text-white' : 'bg-niva-accent text-niva-bg'} font-bold text-xs uppercase tracking-widest hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-lg niva-glow-sm"
					>
						{$ui.confirmText || 'OK'}
					</button>
				{/if}
			</div>

			<!-- Close button top-right -->
			<button 
				onclick={() => ui.close(false)}
				class="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/5 text-niva-text-secondary transition-colors cursor-pointer"
			>
				<X size={18} />
			</button>
		</div>
	</div>
{/if}

<!-- Toast Area -->
<div class="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
	{#each $ui.toasts as toast (toast.id)}
		{@const ToastIcon = icons[toast.type]}
		<div 
			class="flex items-center gap-3 px-4 py-3 rounded-2xl glass-panel-strong border border-white/10 shadow-2xl pointer-events-auto min-w-[280px]"
			in:fly={{ y: 20, duration: 400, easing: backOut }}
			out:fade={{ duration: 200 }}
		>
			<div class="w-8 h-8 rounded-lg flex items-center justify-center {colors[toast.type]}">
				<ToastIcon size={16} />
			</div>
			<p class="text-[13px] font-medium text-niva-text">{toast.message}</p>
		</div>
	{/each}
</div>

<style>
	.glass-panel-strong {
		background: rgba(15, 17, 23, 0.85);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
	}

	.niva-glow-sm {
		box-shadow: 0 0 20px -5px currentColor;
	}
</style>
