<script lang="ts">
	import { api, type QuizQuestion } from '$lib/api';
	import { 
		Sparkles, 
		Brain, 
		ChevronRight, 
		RotateCcw, 
		CheckCircle2, 
		XCircle,
		Trophy,
		Loader2
	} from '@lucide/svelte';
	import { fade, fly, scale } from 'svelte/transition';

	// Quiz States
	type State = 'setup' | 'generating' | 'quiz' | 'summary';
	let state = $state<State>('setup');

	// Setup values
	let topic = $state('');
	let questionCount = $state(5);

	// Quiz data
	let quizTitle = $state('');
	let questions = $state<QuizQuestion[]>([]);
	let currentIndex = $state(0);
	let selectedOption = $state<number | null>(null);
	let score = $state(0);
	let answers = $state<{questionIndex: number, selectedIndex: number, isCorrect: boolean}[]>([]);
	let error = $state<string | null>(null);

	const currentQuestion = $derived(questions[currentIndex]);

	async function generateQuiz() {
		if (!topic.trim()) return;
		try {
			state = 'generating';
			error = null;
			const data = await api.quiz.generate(topic, questionCount);
			quizTitle = data.title;
			questions = data.questions;
			currentIndex = 0;
			score = 0;
			answers = [];
			selectedOption = null;
			state = 'quiz';
		} catch (err: any) {
			error = err.message || 'Failed to generate quiz. Please try again.';
			state = 'setup';
		}
	}

	function handleOptionSelect(index: number) {
		if (selectedOption !== null) return; // Prevent multiple selections
		selectedOption = index;
		const isCorrect = index === currentQuestion.correctIndex;
		if (isCorrect) score++;
		
		answers = [...answers, {
			questionIndex: currentIndex,
			selectedIndex: index,
			isCorrect
		}];
	}

	function nextQuestion() {
		if (currentIndex < questions.length - 1) {
			currentIndex++;
			selectedOption = null;
		} else {
			state = 'summary';
		}
	}

	function restart() {
		state = 'setup';
		topic = '';
		questions = [];
	}
</script>

<svelte:head>
	<title>AI Quiz Generator | Niva AI</title>
</svelte:head>

<div class="flex flex-col h-full bg-niva-bg text-niva-text overflow-hidden font-[Manrope]">
	<!-- Header -->
	<header class="h-14 glass-panel-strong flex items-center justify-between px-6 shrink-0 border-b border-niva-glass-border z-10">
		<div class="flex items-center gap-3">
			<Brain size={18} class="text-niva-accent" />
			<h1 class="text-sm font-semibold tracking-tight">AI Quiz Generator</h1>
		</div>
		{#if state === 'quiz'}
			<div class="flex items-center gap-3">
				<div class="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
					<div 
						class="h-full bg-niva-accent transition-all duration-500" 
						style="width: {(currentIndex + 1) / questions.length * 100}%"
					></div>
				</div>
				<span class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest leading-none">
					{currentIndex + 1} / {questions.length}
				</span>
			</div>
		{/if}
	</header>

	<main class="flex-1 flex flex-col items-center p-4 md:p-8 overflow-y-auto niva-scrollbar relative">
		<!-- Background Glows -->
		<div class="absolute top-1/4 left-1/4 w-64 h-64 bg-niva-accent/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
		<div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 blur-[150px] rounded-full -z-10 animate-pulse" style="animation-delay: 1s"></div>

		<div class="w-full max-w-2xl mx-auto my-auto">
			{#if state === 'setup'}
				<div in:fly={{ y: 20, duration: 600 }} class="glass-panel p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden group">
					<!-- Decorative Sparkle -->
					<div class="absolute -top-4 -right-4 w-24 h-24 bg-niva-accent/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

					<div class="space-y-2 text-center">
						<div class="w-16 h-16 rounded-2xl niva-gradient flex items-center justify-center mx-auto mb-6 niva-glow">
							<Sparkles size={32} class="text-niva-accent" />
						</div>
						<h2 class="text-2xl md:text-3xl font-bold text-niva-text tracking-tight">Generate a Custom Quiz</h2>
						<p class="text-niva-text-secondary text-sm">Challenge yourself or others with AI-powered questions on any subject.</p>
					</div>

					<div class="space-y-6 pt-4">
						<div class="space-y-2">
							<label for="topic" class="text-[11px] font-bold text-niva-text-secondary uppercase tracking-[0.2em] ml-1">Topic or Subject</label>
							<div class="relative group/input">
								<input 
									id="topic"
									type="text" 
									bind:value={topic}
									placeholder="e.g. Modern Physics, World History, JavaScript..."
									class="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-niva-accent/40 focus:bg-white/10 transition-all text-sm group-hover/input:border-white/20"
								/>
							</div>
						</div>

						<div class="space-y-4">
							<div class="flex justify-between items-center px-1">
								<label class="text-[11px] font-bold text-niva-text-secondary uppercase tracking-[0.2em]">Questions</label>
								<span class="text-xs font-bold text-niva-accent bg-niva-accent/10 px-2 py-1 rounded-lg">{questionCount}</span>
							</div>
							<input 
								type="range" 
								min="1" 
								max="15" 
								bind:value={questionCount}
								class="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-niva-accent hover:bg-white/20 transition-colors"
							/>
						</div>

						{#if error}
							<div class="p-4 rounded-2xl bg-niva-error-bg/50 border border-niva-error/20 flex items-center gap-3 animate-shake">
								<XCircle size={18} class="text-niva-error shrink-0" />
								<p class="text-xs text-niva-error font-medium">{error}</p>
							</div>
						{/if}

						<button 
							onclick={generateQuiz}
							disabled={!topic.trim() || state === 'generating'}
							class="w-full h-14 rounded-2xl bg-niva-accent text-niva-bg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 niva-glow-sm mt-4"
						>
							{#if state === 'generating'}
								<Loader2 size={18} class="animate-spin" />
								Crafting your quiz...
							{:else}
								<Brain size={18} />
								Generate Quiz
							{/if}
						</button>
					</div>
				</div>

			{:else if state === 'generating'}
				<div in:fade class="flex flex-col items-center justify-center space-y-6 text-center">
					<div class="relative">
						<div class="w-24 h-24 rounded-full border-4 border-niva-accent/20 border-t-niva-accent animate-spin"></div>
						<div class="absolute inset-0 flex items-center justify-center">
							<Brain size={32} class="text-niva-accent animate-pulse" />
						</div>
					</div>
					<div class="space-y-2">
						<h3 class="text-xl font-bold tracking-tight">AI is thinking...</h3>
						<p class="text-sm text-niva-text-secondary">Generating personalized questions for: <span class="text-niva-accent font-semibold">{topic}</span></p>
					</div>
				</div>

			{:else if state === 'quiz' && currentQuestion}
				<div in:fly={{ x: 50, duration: 400 }} class="space-y-8">
					<div class="space-y-4">
						<h2 class="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-center px-4">
							{currentQuestion.question}
						</h2>
					</div>

					<div class="grid grid-cols-1 gap-4">
						{#each currentQuestion.options as option, i}
							<button 
								onclick={() => handleOptionSelect(i)}
								disabled={selectedOption !== null}
								class="group relative w-full text-left p-6 rounded-2xl transition-all duration-300 border 
									{selectedOption === null 
										? 'glass-panel hover:bg-white/10 hover:border-white/20 border-white/5' 
										: i === currentQuestion.correctIndex
											? 'bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20'
											: selectedOption === i
												? 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20'
												: 'glass-panel opacity-50 border-white/5'}"
							>
								<div class="flex items-center gap-4 relative z-10">
									<span class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors
										{selectedOption === null
											? 'bg-white/5 border-white/10 group-hover:border-niva-accent/50 group-hover:text-niva-accent'
											: i === currentQuestion.correctIndex
												? 'bg-green-500/20 border-green-500/50 text-green-400'
												: selectedOption === i
													? 'bg-red-500/20 border-red-500/50 text-red-400'
													: 'bg-white/5 border-white/10 text-white/30'}">
										{String.fromCharCode(65 + i)}
									</span>
									<span class="flex-1 text-sm md:text-base font-medium transition-colors {selectedOption !== null && i !== currentQuestion.correctIndex ? 'text-white/50' : ''}">
										{option}
									</span>
									
									{#if selectedOption !== null}
										{#if i === currentQuestion.correctIndex}
											<div in:scale={{duration: 400}}>
												<CheckCircle2 size={20} class="text-green-400" />
											</div>
										{:else if selectedOption === i}
											<div in:scale={{duration: 400}}>
												<XCircle size={20} class="text-red-400" />
											</div>
										{/if}
									{/if}
								</div>
							</button>
						{/each}
					</div>

					{#if selectedOption !== null}
						<div in:fly={{ y: 20, duration: 400 }} class="space-y-6">
							<div class="glass-panel p-6 rounded-2xl border border-white/10 bg-white/5">
								<div class="flex items-center gap-2 mb-2">
									<Brain size={14} class="text-niva-accent" />
									<span class="text-[10px] font-bold uppercase tracking-widest text-niva-accent">Quick Insight</span>
								</div>
								<p class="text-xs md:text-sm text-niva-text-secondary leading-relaxed font-medium">
									{currentQuestion.explanation}
								</p>
							</div>

							<button 
								onclick={nextQuestion}
								class="w-full h-14 rounded-2xl bg-white text-niva-bg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all hover:scale-[1.01]"
							>
								{currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
								<ChevronRight size={18} />
							</button>
						</div>
					{/if}
				</div>

			{:else if state === 'summary'}
				<div in:fly={{ y: 30, duration: 600 }} class="glass-panel p-10 rounded-[2.5rem] border border-white/10 text-center space-y-8 relative overflow-hidden group">
					<div class="absolute -top-10 -right-10 w-40 h-40 bg-niva-accent/10 blur-[80px] rounded-full"></div>
					
					<div class="space-y-4 relative">
						<div class="w-20 h-20 rounded-3xl niva-gradient flex items-center justify-center mx-auto mb-6 niva-glow relative">
							<Trophy size={40} class="text-niva-bg" />
							<div class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-niva-bg shadow-xl">
								!
							</div>
						</div>
						<h2 class="text-3xl font-bold tracking-tight">Quiz Complete!</h2>
						<p class="text-niva-text-secondary text-sm">Great effort! Here is how you performed on <span class="text-white font-semibold">"{quizTitle}"</span>.</p>
					</div>

					<div class="grid grid-cols-2 gap-4 py-4">
						<div class="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-2">
							<span class="text-3xl font-black text-niva-accent leading-none">{score}</span>
							<span class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest mt-1">Score</span>
						</div>
						<div class="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-2">
							<span class="text-3xl font-black text-white leading-none">{Math.round((score / questions.length) * 100)}%</span>
							<span class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest mt-1">Accuracy</span>
						</div>
					</div>

					<div class="space-y-3 pt-4">
						<button 
							onclick={() => { state = 'quiz'; currentIndex = 0; score = 0; selectedOption = null; answers = []; }}
							class="w-full h-14 rounded-2xl bg-niva-accent text-niva-bg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all hover:scale-[1.01] niva-glow-sm"
						>
							<RotateCcw size={18} />
							Retake Quiz
						</button>
						<button 
							onclick={restart}
							class="w-full h-14 rounded-2xl bg-white/5 text-niva-text font-bold text-sm flex items-center justify-center hover:bg-white/10 transition-all"
						>
							New Topic
						</button>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>

<style>
	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		@apply w-4 h-4 rounded-full bg-white shadow-lg border-2 border-niva-accent cursor-pointer transition-transform duration-200;
	}
	input[type="range"]::-webkit-slider-thumb:hover {
		@apply scale-125;
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

	.h-14 { height: 3.5rem; }
</style>
