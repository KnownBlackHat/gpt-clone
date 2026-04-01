<script lang="ts">
	import { 
		Calculator, 
		History, 
		Trash2, 
		Delete, 
		ChevronRight,
		Info
	} from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import * as math from 'mathjs';

	let display = $state('0');
	let expression = $state('');
	let history = $state<{ expr: string, result: string }[]>([]);
	let showHistory = $state(false);
	let error = $state(false);
	let angleMode = $state<'DEG' | 'RAD'>('DEG');

	// Define a more complete button layout (6 columns)
	const buttons = [
		// Row 1: clear, parens, operators
		{ label: 'C', type: 'clear' },
		{ label: '(', type: 'operator' },
		{ label: ')', type: 'operator' },
		{ label: '%', type: 'operator', value: '%' },
		{ label: '÷', type: 'operator', value: '/' },
		{ label: '×', type: 'operator', value: '*' },

		// Row 2: scientific + numbers
		{ label: 'sin', type: 'func' },
		{ label: 'cos', type: 'func' },
		{ label: '7', type: 'num' },
		{ label: '8', type: 'num' },
		{ label: '9', type: 'num' },
		{ label: '−', type: 'operator', value: '-' },

		// Row 3
		{ label: 'tan', type: 'func' },
		{ label: 'log', type: 'func' },
		{ label: '4', type: 'num' },
		{ label: '5', type: 'num' },
		{ label: '6', type: 'num' },
		{ label: '+', type: 'operator' },

		// Row 4
		{ label: 'ln', type: 'func' },
		{ label: '√', type: 'func', value: 'sqrt' },
		{ label: '1', type: 'num' },
		{ label: '2', type: 'num' },
		{ label: '3', type: 'num' },
		{ label: '^', type: 'operator' },

		// Row 5
		{ label: 'x²', type: 'power', value: '^2' },
		{ label: 'x³', type: 'power', value: '^3' },
		{ label: '0', type: 'num' },
		{ label: '.', type: 'num' },
		{ label: '|x|', type: 'wrap', value: 'abs' },
		{ label: 'n!', type: 'factorial' },

		// Row 6: constants + equals
		{ label: 'π', type: 'const', value: 'pi' },
		{ label: 'e', type: 'const' },
		{ label: 'Ans', type: 'ans' },
		{ label: '=', type: 'equals', span: 3 },
	];

	let lastAnswer = $state('0');

	function convertForTrig(expr: string): string {
		// If in DEG mode, wrap trig inputs with degree conversion
		if (angleMode === 'DEG') {
			return expr
				.replace(/sin\(([^)]+)\)/g, 'sin(($1) * pi / 180)')
				.replace(/cos\(([^)]+)\)/g, 'cos(($1) * pi / 180)')
				.replace(/tan\(([^)]+)\)/g, 'tan(($1) * pi / 180)');
		}
		return expr;
	}

	function handleInput(btn: typeof buttons[0]) {
		error = false;
		if (btn.type === 'clear') {
			display = '0';
			expression = '';
			return;
		}

		if (btn.type === 'equals') {
			try {
				let evalExpr = expression || display;
				evalExpr = convertForTrig(evalExpr);
				// Handle factorial notation: replace n! with factorial(n)
				evalExpr = evalExpr.replace(/(\d+)!/g, 'factorial($1)');
				const result = math.evaluate(evalExpr);
				const formattedResult = math.format(result, { precision: 14 });
				history = [{ expr: expression || display, result: formattedResult }, ...history].slice(0, 50);
				lastAnswer = formattedResult;
				display = formattedResult;
				expression = '';
			} catch (err) {
				error = true;
				display = 'Error';
			}
			return;
		}

		if (btn.type === 'ans') {
			appendToExpression(lastAnswer);
			return;
		}

		if (btn.type === 'factorial') {
			appendToExpression('!');
			return;
		}

		if (btn.type === 'power') {
			appendToExpression(btn.value || '');
			return;
		}

		if (btn.type === 'wrap') {
			// Wrap current expression in abs()
			if (display === '0' || error) {
				expression = (btn.value || btn.label) + '(';
			} else {
				expression = (btn.value || btn.label) + '(' + expression + ')';
			}
			display = expression;
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
			appendToExpression(val);
		}
	}

	function appendToExpression(val: string) {
		if (display === '0' || error) {
			expression = val;
		} else {
			expression += val;
		}
		display = expression;
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

	// Keyboard support
	function handleKeydown(e: KeyboardEvent) {
		// Ignore when typing in input fields
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

		const key = e.key;

		if (key >= '0' && key <= '9') {
			e.preventDefault();
			appendToExpression(key);
		} else if (key === '.') {
			e.preventDefault();
			appendToExpression('.');
		} else if (key === '+') {
			e.preventDefault();
			appendToExpression('+');
		} else if (key === '-') {
			e.preventDefault();
			appendToExpression('-');
		} else if (key === '*') {
			e.preventDefault();
			appendToExpression('*');
		} else if (key === '/') {
			e.preventDefault();
			appendToExpression('/');
		} else if (key === '(' || key === ')') {
			e.preventDefault();
			appendToExpression(key);
		} else if (key === '^') {
			e.preventDefault();
			appendToExpression('^');
		} else if (key === '%') {
			e.preventDefault();
			appendToExpression('%');
		} else if (key === '!' ) {
			e.preventDefault();
			appendToExpression('!');
		} else if (key === 'Enter' || key === '=') {
			e.preventDefault();
			handleInput({ label: '=', type: 'equals' });
		} else if (key === 'Backspace') {
			e.preventDefault();
			backspace();
		} else if (key === 'Escape' || key === 'Delete') {
			e.preventDefault();
			handleInput({ label: 'C', type: 'clear' });
		}
	}

	$effect(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
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
		<div class="flex items-center gap-2">
			<!-- DEG/RAD Toggle -->
			<button
				onclick={() => angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG'}
				class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer
					{angleMode === 'RAD' 
						? 'bg-niva-accent/10 text-niva-accent border-niva-accent/20' 
						: 'bg-white/5 text-niva-text-secondary border-white/10 hover:bg-white/10'}"
			>
				{angleMode}
			</button>
			<button 
				onclick={() => showHistory = !showHistory}
				class="p-2 rounded-xl hover:bg-white/5 transition-colors relative cursor-pointer"
				title="History"
			>
				<History size={18} class={showHistory ? 'text-niva-accent' : 'text-niva-text-secondary'} />
				{#if history.length > 0 && !showHistory}
					<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-niva-accent pulse"></span>
				{/if}
			</button>
		</div>
	</header>

	<main class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
		<!-- Background Glows -->
		<div class="absolute top-1/4 left-1/4 w-64 h-64 bg-niva-accent/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
		<div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 blur-[150px] rounded-full -z-10 animate-pulse" style="animation-delay: 1s"></div>

		<div class="w-full max-w-lg mx-auto">
			<div class="glass-panel p-5 md:p-6 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-5 relative overflow-hidden">
				<!-- Display Area -->
				<div class="space-y-1 text-right px-2 py-4">
					<div class="h-6 text-xs font-medium text-niva-text-secondary truncate tracking-tight flex items-center justify-end gap-2">
						<span class="text-[9px] font-bold text-niva-text-secondary/50 uppercase">{angleMode}</span>
						<span class="flex-1 text-right truncate">{expression || ' '}</span>
					</div>
					<div 
						class="text-4xl md:text-5xl font-black truncate tracking-tighter"
						class:text-niva-error={error}
						class:animate-shake={error}
					>
						{display}
					</div>
				</div>

				<!-- Button Grid (6 columns) -->
				<div class="grid grid-cols-6 gap-1.5 md:gap-2">
					{#each buttons as btn}
						{@const span = (btn as any).span || 1}
						<button 
							onclick={() => handleInput(btn)}
							class="h-12 md:h-14 rounded-xl flex items-center justify-center font-bold text-xs md:text-sm transition-all active:scale-95 cursor-pointer
								{btn.type === 'clear' ? 'bg-niva-error/10 text-niva-error border border-niva-error/20 hover:bg-niva-error/20' : 
								 btn.type === 'operator' ? 'bg-niva-accent/10 text-niva-accent border border-niva-accent/20 hover:bg-niva-accent/20' :
								 btn.type === 'equals' ? 'bg-niva-accent text-niva-bg niva-glow-sm hover:opacity-90' :
								 btn.type === 'func' ? 'bg-white/5 text-niva-text-secondary border border-white/5 hover:bg-white/10 hover:border-white/10' :
								 btn.type === 'const' || btn.type === 'ans' ? 'bg-white/5 text-blue-400 border border-white/5 hover:bg-white/10' :
								 btn.type === 'power' || btn.type === 'factorial' || btn.type === 'wrap' ? 'bg-white/5 text-purple-400 border border-white/5 hover:bg-white/10' :
								 'bg-white/10 text-niva-text border border-white/5 hover:bg-white/15 hover:border-white/10'}"
							style="grid-column: span {span}"
						>
							{btn.label}
						</button>
					{/each}
					<button 
						onclick={backspace}
						class="h-12 md:h-14 rounded-xl flex items-center justify-center bg-white/5 text-niva-text-secondary border border-white/5 hover:bg-white/10 cursor-pointer active:scale-95 transition-all"
					>
						<Delete size={18} />
					</button>
				</div>
			</div>

			<!-- Keyboard Hint -->
			<div class="mt-4 flex items-center justify-center gap-2 text-niva-text-secondary opacity-40 hover:opacity-80 transition-opacity">
				<Info size={12} />
				<span class="text-[9px] font-bold uppercase tracking-widest">Keyboard input supported · Powered by Math.js</span>
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
						class="p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
					>
						<ChevronRight size={20} />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto niva-scrollbar space-y-3">
					{#each history as item}
						<button 
							onclick={() => useHistory(item)}
							class="w-full text-right p-4 rounded-2xl glass-panel border border-white/5 hover:bg-white/5 transition-all group cursor-pointer"
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
						class="w-full py-4 rounded-2xl bg-niva-error/10 text-niva-error font-bold text-xs flex items-center justify-center gap-2 hover:bg-niva-error/20 transition-all border border-niva-error/20 cursor-pointer"
					>
						<Trash2 size={14} />
						Clear History
					</button>
				{/if}
			</div>
			
			<!-- Overlay for mobile -->
			<button
				onclick={() => showHistory = false}
				class="fixed inset-0 bg-black/40 backdrop-blur-sm z-10 md:hidden border-none cursor-default"
				in:fade
				out:fade
				aria-label="Close history panel"
			></button>
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
</style>
