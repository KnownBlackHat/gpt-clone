<script lang="ts">
	import { 
		Calculator, 
		History, 
		Trash2, 
		Delete, 
		ChevronRight,
		Info
	} from '@lucide/svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import * as math from 'mathjs';

	let display = $state('0');
	let expression = $state('');
	let history = $state<{ expr: string, result: string }[]>([]);
	let showHistory = $state(false);
	let error = $state(false);

	const buttons = [
		{ label: 'C', flex: 1, type: 'clear' },
		{ label: '(', flex: 1, type: 'operator' },
		{ label: ')', flex: 1, type: 'operator' },
		{ label: '÷', flex: 1, type: 'operator', value: '/' },
		
		{ label: 'sin', flex: 1, type: 'func' },
		{ label: '7', flex: 1, type: 'num' },
		{ label: '8', flex: 1, type: 'num' },
		{ label: '9', flex: 1, type: 'num' },
		{ label: '×', flex: 1, type: 'operator', value: '*' },
		
		{ label: 'cos', flex: 1, type: 'func' },
		{ label: '4', flex: 1, type: 'num' },
		{ label: '5', flex: 1, type: 'num' },
		{ label: '6', flex: 1, type: 'num' },
		{ label: '−', flex: 1, type: 'operator', value: '-' },
		
		{ label: 'tan', flex: 1, type: 'func' },
		{ label: '1', flex: 1, type: 'num' },
		{ label: '2', flex: 1, type: 'num' },
		{ label: '3', flex: 1, type: 'num' },
		{ label: '+', flex: 1, type: 'operator' },
		
		{ label: 'log', flex: 1, type: 'func' },
		{ label: '0', flex: 1, type: 'num' },
		{ label: '.', flex: 1, type: 'num' },
		{ label: '=', flex: 2, type: 'equals' },
		
		{ label: 'ln', flex: 1, type: 'func' },
		{ label: '√', flex: 1, type: 'func', value: 'sqrt' },
		{ label: 'π', flex: 1, type: 'const', value: 'pi' },
		{ label: 'e', flex: 1, type: 'const' },
		{ label: '^', flex: 1, type: 'operator' },
	];

	function handleInput(btn: typeof buttons[0]) {
		error = false;
		if (btn.type === 'clear') {
			display = '0';
			expression = '';
			return;
		}

		if (btn.type === 'equals') {
			try {
				const result = math.evaluate(expression || display);
				const formattedResult = math.format(result, { precision: 14 });
				history = [{ expr: expression || display, result: formattedResult }, ...history].slice(0, 50);
				display = formattedResult;
				expression = '';
			} catch (err) {
				error = true;
				display = 'Error';
			}
			return;
		}

		const val = btn.value || btn.label;
		
		if (btn.type === 'func') {
			if (display === '0' || error) {
				expression = val + '(';
			} else {
				expression = expression + val + '(';
			}
			display = expression;
		} else {
			if (display === '0' || error) {
				expression = val;
			} else {
				expression += val;
			}
			display = expression;
		}
	}

	function backspace() {
		if (expression.length > 0) {
			expression = expression.slice(0, -1);
			display = expression || '0';
		}
	}

	function clearHistory() {
		history = [];
	}

	function useHistory(item: { expr: string, result: string }) {
		expression = item.result;
		display = item.result;
		showHistory = false;
	}
</script>

<svelte:head>
	<title>Scientific Calculator | Niva AI</title>
</svelte:head>

<div class="flex flex-col h-full bg-niva-bg text-niva-text overflow-hidden font-[Manrope]">
	<!-- Header -->
	<header class="h-14 glass-panel-strong flex items-center justify-between px-6 shrink-0 border-b border-niva-glass-border z-10">
		<div class="flex items-center gap-3">
			<Calculator size={18} class="text-niva-accent" />
			<h1 class="text-sm font-semibold tracking-tight">Scientific Calculator</h1>
		</div>
		<button 
			onclick={() => showHistory = !showHistory}
			class="p-2 rounded-xl hover:bg-white/5 transition-colors relative"
			title="History"
		>
			<History size={18} class={showHistory ? 'text-niva-accent' : 'text-niva-text-secondary'} />
			{#if history.length > 0 && !showHistory}
				<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-niva-accent pulse"></span>
			{/if}
		</button>
	</header>

	<main class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
		<!-- Background Glows -->
		<div class="absolute top-1/4 left-1/4 w-64 h-64 bg-niva-accent/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
		<div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 blur-[150px] rounded-full -z-10 animate-pulse" style="animation-delay: 1s"></div>

		<div class="w-full max-w-md mx-auto">
			<div class="glass-panel p-6 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-6 relative overflow-hidden">
				<!-- Display Area -->
				<div class="space-y-1 text-right px-2 py-4">
					<div class="h-6 text-xs font-medium text-niva-text-secondary truncate tracking-tight">
						{expression || ' '}
					</div>
					<div 
						class="text-4xl md:text-5xl font-black truncate tracking-tighter"
						class:text-niva-error={error}
						class:animate-shake={error}
					>
						{display}
					</div>
				</div>

				<!-- Controls -->
				<div class="grid grid-cols-5 gap-2 md:gap-3">
					{#each buttons as btn}
						<button 
							onclick={() => handleInput(btn)}
							class="h-14 md:h-16 rounded-2xl flex items-center justify-center font-bold text-sm md:text-base transition-all active:scale-95
								{btn.type === 'clear' ? 'bg-niva-error/10 text-niva-error border border-niva-error/20 hover:bg-niva-error/20' : 
								 btn.type === 'operator' ? 'bg-niva-accent/10 text-niva-accent border border-niva-accent/20 hover:bg-niva-accent/20' :
								 btn.type === 'equals' ? 'bg-niva-accent text-niva-bg col-span-2 niva-glow-sm' :
								 btn.type === 'func' ? 'bg-white/5 text-niva-text-secondary border border-white/5 hover:bg-white/10 hover:border-white/10' :
								 btn.type === 'const' ? 'bg-white/5 text-blue-400 border border-white/5 hover:bg-white/10' :
								 'bg-white/10 text-niva-text border border-white/5 hover:bg-white/15 hover:border-white/10'}"
						>
							{btn.label}
						</button>
					{/each}
					<button 
						onclick={backspace}
						class="h-14 md:h-16 rounded-2xl flex items-center justify-center bg-white/5 text-niva-text-secondary border border-white/5 hover:bg-white/10"
					>
						<Delete size={20} />
					</button>
				</div>
			</div>

			<!-- Quick Info -->
			<div class="mt-6 flex items-center justify-center gap-2 text-niva-text-secondary opacity-50 hover:opacity-100 transition-opacity">
				<Info size={14} />
				<span class="text-[10px] font-bold uppercase tracking-widest">Powered by Math.js engine</span>
			</div>
		</div>

		<!-- History Drawer -->
		{#if showHistory}
			<div 
				in:fly={{ x: 300, duration: 400 }} 
				out:fly={{ x: 300, duration: 300 }}
				class="absolute inset-y-0 right-0 w-full md:w-80 bg-niva-surface-2 border-l border-niva-glass-border shadow-2xl z-20 flex flex-col p-6 space-y-6"
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<History size={18} class="text-niva-accent" />
						<h2 class="font-bold">History</h2>
					</div>
					<button 
						onclick={() => showHistory = false}
						class="p-2 rounded-xl hover:bg-white/5 transition-colors"
					>
						<ChevronRight size={20} />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto niva-scrollbar space-y-3">
					{#each history as item}
						<button 
							onclick={() => useHistory(item)}
							class="w-full text-right p-4 rounded-2xl glass-panel border border-white/5 hover:bg-white/5 transition-all group"
						>
							<div class="text-[10px] text-niva-text-secondary mb-1 truncate">{item.expr}</div>
							<div class="text-lg font-bold group-hover:text-niva-accent transition-colors">{item.result}</div>
						</button>
					{:else}
						<div class="h-full flex flex-col items-center justify-center text-niva-text-secondary text-center space-y-4 opacity-40">
							<History size={48} />
							<p class="text-sm font-medium">No calculations yet.</p>
						</div>
					{/each}
				</div>

				{#if history.length > 0}
					<button 
						onclick={clearHistory}
						class="w-full py-4 rounded-2xl bg-niva-error/10 text-niva-error font-bold text-xs flex items-center justify-center gap-2 hover:bg-niva-error/20 transition-all border border-niva-error/20"
					>
						<Trash2 size={14} />
						Clear History
					</button>
				{/if}
			</div>
			
			<!-- Overlay for mobile -->
			<div 
				onclick={() => showHistory = false}
				class="fixed inset-0 bg-black/40 backdrop-blur-sm z-10 md:hidden"
				in:fade
				out:fade
			></div>
		{/if}
	</main>
</div>

<style>
	.pulse {
		animation: pulse-ring 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
	}

	@keyframes pulse-ring {
		0% { transform: scale(0.33); }
		80%, 100% { opacity: 0; }
	}

	.animate-shake {
		animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
	}

	@keyframes shake {
		10%, 90% { transform: translate3d(-1px, 0, 0); }
		20%, 80% { transform: translate3d(2px, 0, 0); }
		30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
		40%, 60% { transform: translate3d(4px, 0, 0); }
	}

	header, .h-14 { height: 3.5rem; }
</style>
