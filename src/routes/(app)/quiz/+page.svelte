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
		Loader2,
		Timer,
		Flame,
		History,
		ChevronDown,
		ChevronUp,
		FileText,
		X,
		Settings,
		ChevronLeft,
	} from '@lucide/svelte';
	import { fade, fly, scale } from 'svelte/transition';

	type State = 'setup' | 'generating' | 'quiz' | 'summary';
	type Difficulty = 'easy' | 'medium' | 'hard';

	let state = $state<State>('setup');

	// Setup
	let topic = $state('');
	let questionCount = $state(5);
	let difficulty = $state<Difficulty>('medium');
	let isContextBased = $state(false);
	let quizContext = $state<string | null>(null);
	let selectedPdf = $state<string | null>(null);
	let pdfName = $state<string | null>(null);
	let pdfInput: HTMLInputElement;

	// Advanced Features
	let showAdvanced = $state(false);
	let syllabus = $state('');
	let marksPerQuestion = $state(1);
	let pyqData = $state<string | null>(null);
	let pyqName = $state<string | null>(null);
	let pyqInput: HTMLInputElement;
	let showSolutions = $state(false);

	$effect(() => {
		const storedContext = sessionStorage.getItem('niva_quiz_context');
		if (storedContext) {
			quizContext = storedContext;
			isContextBased = true;
			topic = 'Assignment Context';
		}
	});

	function clearContext() {
		sessionStorage.removeItem('niva_quiz_context');
		quizContext = null;
		isContextBased = false;
		topic = '';
	}

	function handlePdfUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		
		pdfName = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			selectedPdf = e.target?.result as string;
			isContextBased = true;
			topic = `Study Material: ${file.name}`;
		};
		reader.readAsDataURL(file);
	}

	function removePdf() {
		selectedPdf = null;
		pdfName = null;
		isContextBased = false;
		topic = '';
		if (pdfInput) pdfInput.value = '';
	}

	function handlePyqUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		
		pyqName = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			pyqData = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function removePyq() {
		pyqData = null;
		pyqName = null;
		if (pyqInput) pyqInput.value = '';
	}

	// Quiz runtime
	let quizTitle = $state('');
	let questions = $state<QuizQuestion[]>([]);
	let currentIndex = $state(0);
	let selectedOption = $state<number | null>(null);
	let score = $state(0);
	let answers = $state<{questionIndex: number, selectedIndex: number, isCorrect: boolean}[]>([]);
	let error = $state<string | null>(null);
	let streak = $state(0);
	let bestStreak = $state(0);

	// Timer
	let timePerQuestion = $derived(difficulty === 'easy' ? 30 : difficulty === 'medium' ? 20 : 12);
	let timeLeft = $state(0);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);

	// History
	interface QuizResult {
		title: string;
		score: number;
		total: number;
		difficulty: Difficulty;
		grade: string;
		timestamp: number;
	}
	let quizHistory = $state<Quiz[]>([]);
	let showHistory = $state(false);
	let isLoadingHistory = $state(false);

	const currentQuestion = $derived(questions[currentIndex]);

	const difficultyMeta: Record<Difficulty, { label: string; color: string; desc: string }> = {
		easy:   { label: 'Easy',   color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', desc: 'Beginner friendly' },
		medium: { label: 'Medium', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',     desc: 'Some experience needed' },
		hard:   { label: 'Hard',   color: 'text-rose-400 bg-rose-400/10 border-rose-400/20',         desc: 'Expert level' },
	};

	function loadHistory() {
		try {
			const stored = sessionStorage.getItem('niva_quiz_history');
			if (stored) quizHistory = JSON.parse(stored);
		} catch { /* ignore */ }
	}

	function saveHistory() {
		try {
			sessionStorage.setItem('niva_quiz_history', JSON.stringify(quizHistory.slice(0, 20)));
		} catch { /* ignore */ }
	}

	function getGrade(pct: number): string {
		if (pct >= 95) return 'A+';
		if (pct >= 85) return 'A';
		if (pct >= 75) return 'B';
		if (pct >= 65) return 'C';
		if (pct >= 50) return 'D';
		return 'F';
	}

	function getGradeColor(grade: string): string {
		if (grade.startsWith('A')) return 'text-emerald-400';
		if (grade === 'B') return 'text-blue-400';
		if (grade === 'C') return 'text-amber-400';
		return 'text-rose-400';
	}

	function getMotivation(pct: number): string {
		if (pct === 100) return 'Absolutely perfect. You crushed it.';
		if (pct >= 85) return 'Outstanding performance. Really impressive.';
		if (pct >= 70) return 'Solid work. A few more reps and you\'ll ace it.';
		if (pct >= 50) return 'Decent start. Keep studying, you\'re getting there.';
		return 'Tough round. Review the material and try again.';
	}

	function startTimer() {
		stopTimer();
		timeLeft = timePerQuestion;
		timerInterval = setInterval(() => {
			timeLeft--;
			if (timeLeft <= 0) {
				stopTimer();
				if (selectedOption === null) {
					// Auto-move if time runs out
					handleOptionSelect(-1);
				}
			}
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	async function generateQuiz() {
		if (!topic.trim() && !pdfName && !syllabus) return;
		try {
			state = 'generating';
			error = null;
			showSolutions = false;
			
			const data = await api.quiz.generate({
				topic: isContextBased ? (quizContext || topic) : topic,
				amount: questionCount,
				difficulty,
				pdfData: selectedPdf || undefined,
				pyqData: pyqData || undefined,
				syllabus: syllabus || undefined,
				marks: marksPerQuestion
			});

			quizTitle = isContextBased ? "Assignment Review" : data.title;
			questions = data.questions;
			currentIndex = 0;
			score = 0;
			streak = 0;
			bestStreak = 0;
			answers = [];
			selectedOption = null;
			state = 'quiz';
			startTimer();
		} catch (err: any) {
			error = err.message || 'Failed to generate quiz. Please try again.';
			state = 'setup';
		}
	}

	async function loadHistory() {
		try {
			isLoadingHistory = true;
			const data = await api.quiz.getHistory();
			quizHistory = data.history;
		} catch (err) {
			console.error('Failed to load quiz history:', err);
		} finally {
			isLoadingHistory = false;
		}
	}

	async function saveHistory(result: {
		title: string;
		topic: string;
		difficulty: string;
		questions: QuizQuestion[];
		score: number;
		total_questions: number;
		grade: string;
	}) {
		try {
			await api.quiz.save(result);
			await loadHistory();
		} catch (err) {
			console.error('Failed to save quiz to database:', err);
		}
	}

	function handleOptionSelect(index: number) {
		if (selectedOption !== null) return;
		stopTimer();
		selectedOption = index;

		const isCorrect = index === currentQuestion?.correctIndex;
		if (isCorrect) {
			score++;
			streak++;
			if (streak > bestStreak) bestStreak = streak;
		} else {
			streak = 0;
		}
		
		answers = [...answers, {
			questionIndex: currentIndex,
			selectedIndex: index,
			isCorrect
		}];
	}

	async function nextQuestion() {
		if (currentIndex < questions.length - 1) {
			currentIndex++;
			selectedOption = null;
			startTimer();
		} else {
			stopTimer();
			const pct = Math.round((score / questions.length) * 100);
			await saveHistory({
				title: quizTitle,
				topic,
				difficulty,
				questions,
				score,
				total_questions: questions.length,
				grade: getGrade(pct)
			});
			state = 'summary';
		}
	}
	async function viewQuiz(id: string) {
		try {
			state = 'summary';
			const data = await api.quiz.getById(id);
			quizTitle = data.quiz.title;
			questions = data.quiz.questions;
			score = data.quiz.score;
			// For past quizzes, we just show all solutions
			showHistory = true;
			showSolutions = true;
			answers = data.quiz.questions.map((q, i) => ({
				questionIndex: i,
				selectedIndex: -1, // We don't store individual selections yet, just the score
				isCorrect: true // Placeholder
			}));
		} catch (err) {
			console.error('Failed to view quiz:', err);
		}
	}

	function restart() {
		stopTimer();
		state = 'setup';
		clearContext();
		removePdf();
		removePyq();
		syllabus = '';
		marksPerQuestion = 1;
		showAdvanced = false;
	}

	$effect(() => {
		loadHistory();
	});

	$effect(() => {
		return () => stopTimer();
	});
</script>

<svelte:head>
	<title>AI Quiz Generator | Niva AI</title>
</svelte:head>

<div class="flex flex-col h-full bg-niva-bg text-niva-text overflow-hidden font-[Manrope]">
	<header class="h-14 glass-panel-strong flex items-center justify-between px-6 shrink-0 border-b border-niva-glass-border z-10">
		<div class="flex items-center gap-3">
			<Brain size={18} class="text-niva-accent" />
			<h1 class="text-sm font-semibold tracking-tight">AI Quiz Generator</h1>
		</div>
		<div class="flex items-center gap-3">
			{#if state === 'quiz'}
				<!-- Streak -->
				{#if streak > 1}
					<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20" in:scale={{ duration: 300 }}>
						<Flame size={13} class="text-orange-400" />
						<span class="text-[10px] font-bold text-orange-400">{streak}×</span>
					</div>
				{/if}
				<!-- Timer -->
				<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full {timeLeft <= 5 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'} border transition-colors">
					<Timer size={13} class={timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-niva-text-secondary'} />
					<span class="text-[10px] font-bold tabular-nums {timeLeft <= 5 ? 'text-rose-400' : 'text-niva-text-secondary'}">{timeLeft}s</span>
				</div>
				<!-- Progress -->
				<div class="hidden sm:flex items-center gap-3">
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
			{:else}
				<button
					onclick={() => showHistory = !showHistory}
					class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-niva-text-secondary hover:text-niva-text cursor-pointer"
				>
					<History size={14} />
					<span class="text-[10px] font-bold uppercase tracking-wide">History</span>
					{#if quizHistory.length > 0}
						<span class="w-4 h-4 rounded-full bg-niva-accent/20 text-niva-accent text-[9px] font-bold flex items-center justify-center">{quizHistory.length}</span>
					{/if}
				</button>
			{/if}
		</div>
	</header>

	<main class="flex-1 flex flex-col items-center p-4 md:p-8 overflow-y-auto niva-scrollbar relative">
		<div class="absolute top-1/4 left-1/4 w-64 h-64 bg-niva-accent/5 blur-[120px] rounded-full -z-10 animate-pulse"></div>
		<div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 blur-[150px] rounded-full -z-10 animate-pulse" style="animation-delay: 1s"></div>

		<div class="w-full max-w-2xl mx-auto my-auto">
			{#if state === 'setup'}
				<div in:fly={{ y: 20, duration: 600 }} class="glass-panel p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden group">
					<div class="absolute -top-4 -right-4 w-24 h-24 bg-niva-accent/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

					<div class="space-y-2 text-center">
						<div class="w-16 h-16 rounded-2xl niva-gradient flex items-center justify-center mx-auto mb-6 niva-glow">
							<Sparkles size={32} class="text-niva-accent" />
						</div>
						<h2 class="text-2xl md:text-3xl font-bold text-niva-text tracking-tight">Generate a Custom Quiz</h2>
						<p class="text-niva-text-secondary text-sm">Challenge yourself or others with AI-powered questions on any subject.</p>
					</div>

					<div class="space-y-6 pt-4">
						<!-- Quiz Source Selection -->
						<div class="space-y-4">
							<div class="flex items-center justify-between px-1">
								<label class="text-[11px] font-bold text-niva-text-secondary uppercase tracking-[0.2em] ml-1">Quiz Source</label>
								{#if isContextBased}
									<button 
										onclick={clearContext}
										class="text-[10px] text-niva-accent hover:underline cursor-pointer font-bold"
									>
										Clear Context
									</button>
								{/if}
							</div>
							
							<div class="space-y-3">
								<input 
									type="file" 
									accept=".pdf" 
									bind:this={pdfInput}
									onchange={handlePdfUpload}
									class="hidden"
								/>
								
								{#if pdfName}
									<div class="flex items-center justify-between p-4 rounded-2xl bg-niva-accent/10 border border-niva-accent/20 animate-in fade-in zoom-in duration-300">
										<div class="flex items-center gap-3">
											<div class="w-8 h-8 rounded-lg bg-niva-accent/20 flex items-center justify-center text-niva-accent">
												<FileText size={16} />
											</div>
											<span class="text-xs font-bold text-niva-text truncate max-w-[200px]">{pdfName}</span>
										</div>
										<button 
											onclick={removePdf}
											class="p-1.5 rounded-lg hover:bg-white/5 text-niva-text-secondary transition-colors cursor-pointer"
										>
											<X size={14} />
										</button>
									</div>
								{:else if !quizContext}
									<button 
										onclick={() => pdfInput.click()}
										class="w-full p-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-niva-accent/40 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-2 group/upload cursor-pointer"
									>
										<div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-niva-text-secondary group-hover/upload:text-niva-accent transition-colors">
											<FileText size={20} />
										</div>
										<span class="text-xs font-bold text-niva-text-secondary group-hover/upload:text-niva-text transition-colors">Upload Study Material (PDF)</span>
										<span class="text-[10px] opacity-40">Generate from your assignment</span>
									</button>
								{/if}

								<div class="relative group/input">
									<input 
										id="topic"
										type="text" 
										bind:value={topic}
										placeholder={isContextBased ? "Describe this context..." : "e.g. Modern Physics, World History, JavaScript..."}
										class="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-niva-accent/40 focus:bg-white/10 transition-all text-sm group-hover/input:border-white/20"
										readonly={isContextBased && !selectedPdf}
									/>
								</div>
							</div>
						</div>

						<!-- Difficulty Selection -->
						<div class="space-y-3">
							<span class="text-[11px] font-bold text-niva-text-secondary uppercase tracking-[0.2em] ml-1">Difficulty</span>
							<div class="grid grid-cols-3 gap-3">
								{#each (['easy', 'medium', 'hard'] as const) as level}
									{@const meta = difficultyMeta[level]}
									<button
										onclick={() => difficulty = level}
										class="relative p-4 rounded-2xl border text-center transition-all duration-200 cursor-pointer
											{difficulty === level 
												? meta.color + ' ring-1 ring-current' 
												: 'bg-white/5 border-white/5 text-niva-text-secondary hover:bg-white/8 hover:border-white/10'}"
									>
										<span class="text-sm font-bold block">{meta.label}</span>
										<span class="text-[10px] opacity-70 block mt-0.5">{meta.desc}</span>
									</button>
								{/each}
							</div>
						</div>

						<!-- Advanced Options Toggle -->
						<div class="pt-4 border-t border-white/5 order-last">
							<button 
								onclick={() => showAdvanced = !showAdvanced}
								class="flex items-center gap-2 text-[10px] font-bold text-niva-text-secondary hover:text-niva-accent transition-colors uppercase tracking-widest cursor-pointer ml-1"
							>
								<Settings size={12} class={showAdvanced ? 'rotate-90 transition-transform' : ''} />
								Advanced Options
								<ChevronDown size={12} class={showAdvanced ? 'rotate-180 transition-transform' : ''} />
							</button>

							{#if showAdvanced}
								<div in:fly={{ y: -10, duration: 300 }} class="mt-4 space-y-5 p-5 rounded-2xl bg-white/5 border border-white/5 animate-in fade-in duration-300 shadow-inner">
									<!-- Syllabus -->
									<div class="space-y-2">
										<label for="syllabus" class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest ml-1">Syllabus / Exam Scope</label>
										<textarea 
											id="syllabus"
											bind:value={syllabus}
											placeholder="Specify topics, chapters or learning objectives..."
											class="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-niva-accent/40 text-xs min-h-[100px] niva-scrollbar placeholder:opacity-30"
										></textarea>
									</div>

									<!-- Marks -->
									<div class="flex items-center justify-between px-1">
										<label for="marks" class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest">Marks per Question</label>
										<div class="flex items-center gap-3">
											<button 
												onclick={() => marksPerQuestion = Math.max(1, marksPerQuestion - 1)}
												class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 text-niva-text transition-colors border border-white/5 font-bold"
											>-</button>
											<span class="text-sm font-black w-6 text-center text-niva-accent">{marksPerQuestion}</span>
											<button 
												onclick={() => marksPerQuestion++}
												class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 text-niva-text transition-colors border border-white/5 font-bold"
											>+</button>
										</div>
									</div>

									<!-- PYQ Upload -->
									<div class="space-y-2">
										<label class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest ml-1">Style Reference (PYQ Upload)</label>
										<input 
											type="file" 
											accept=".pdf" 
											bind:this={pyqInput}
											onchange={handlePyqUpload}
											class="hidden"
										/>
										
										{#if pyqName}
											<div class="flex items-center justify-between p-3 rounded-xl bg-niva-accent/5 border border-niva-accent/20 transition-all">
												<div class="flex items-center gap-2">
													<FileText size={14} class="text-niva-accent" />
													<span class="text-[10px] font-bold text-niva-text truncate max-w-[150px]">{pyqName}</span>
												</div>
												<button onclick={removePyq} class="text-niva-text-secondary hover:text-niva-error transition-colors cursor-pointer">
													<X size={14} />
												</button>
											</div>
										{:else}
											<button 
												onclick={() => pyqInput.click()}
												class="w-full p-4 rounded-xl border border-dashed border-white/20 hover:border-niva-accent/40 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-1.5 text-niva-text-secondary hover:text-niva-text cursor-pointer"
											>
												<FileText size={16} />
												<span class="text-[10px] font-bold">Upload Previous Year Question Paper</span>
												<span class="text-[9px] opacity-40">AI will mimic this drafting style</span>
											</button>
										{/if}
									</div>
								</div>
							{/if}
						</div>

						<!-- Question Count -->
						<div class="space-y-4">
							<div class="flex justify-between items-center px-1">
								<label for="questionCount" class="text-[11px] font-bold text-niva-text-secondary uppercase tracking-[0.2em]">Questions</label>
								<span class="text-xs font-bold text-niva-accent bg-niva-accent/10 px-2 py-1 rounded-lg">{questionCount}</span>
							</div>
							<input 
								id="questionCount"
								type="range" 
								min="3" 
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
							class="w-full h-14 rounded-2xl bg-niva-accent text-niva-bg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 niva-glow-sm mt-4 cursor-pointer"
						>
							<Brain size={18} />
							Generate Quiz
						</button>
					</div>

					<!-- History Panel (collapsible) -->
					{#if showHistory && quizHistory.length > 0}
						<div in:fly={{ y: 10, duration: 300 }} class="border-t border-white/10 pt-6 mt-2 space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="text-xs font-bold text-niva-text-secondary uppercase tracking-widest">Recent Quizzes</h3>
								<button onclick={() => { quizHistory = []; saveHistory(); }} class="text-[10px] text-niva-error/70 hover:text-niva-error cursor-pointer font-medium">Clear</button>
							</div>
							<div class="space-y-2 max-h-48 overflow-y-auto niva-scrollbar">
								{#each quizHistory as result}
									{@const pct = Math.round((result.score / result.total_questions) * 100)}
									<button 
										onclick={() => viewQuiz(result.id)}
										class="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer text-left"
									>
										<div class="min-w-0 flex-1 mr-3">
											<p class="text-xs font-medium truncate">{result.title}</p>
											<p class="text-[10px] text-niva-text-secondary mt-0.5">
												{result.score}/{result.total_questions} · {difficultyMeta[result.difficulty as Difficulty].label}
											</p>
										</div>
										<span class="text-lg font-black {getGradeColor(result.grade)} shrink-0">{result.grade}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
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
						<p class="text-sm text-niva-text-secondary">
							Generating <span class="text-niva-accent font-semibold">{difficultyMeta[difficulty].label.toLowerCase()}</span> questions for: <span class="text-niva-accent font-semibold">{topic}</span>
						</p>
					</div>
				</div>

			{:else if state === 'quiz' && currentQuestion}
				<div in:fly={{ x: 50, duration: 400 }} class="space-y-8">
					<!-- Timer bar -->
					<div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
						<div 
							class="h-full transition-all duration-1000 rounded-full {timeLeft <= 5 ? 'bg-rose-400' : 'bg-niva-accent'}"
							style="width: {(timeLeft / timePerQuestion) * 100}%"
						></div>
					</div>

					<div class="space-y-4">
						<div class="flex items-center justify-center gap-2 sm:hidden">
							<span class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest">
								{currentIndex + 1} / {questions.length}
							</span>
						</div>
						<h2 class="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-center px-4">
							{currentQuestion.question}
						</h2>
					</div>

					<div class="space-y-4">
						{#if currentQuestion.type === 'mcq'}
							<div class="grid grid-cols-1 gap-3">
								{#each currentQuestion.options || [] as option, i}
									<button 
										onclick={() => handleOptionSelect(i)}
										disabled={selectedOption !== null}
										class="group relative w-full text-left p-6 rounded-2xl transition-all duration-300 border cursor-pointer
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
						{:else}
							<!-- Short/Long form question layout -->
							<div class="glass-panel p-8 rounded-3xl border border-white/10 bg-white/5 space-y-6 shadow-inner">
								<div class="flex items-center gap-2">
									<div class="w-2 h-2 rounded-full {currentQuestion.type === 'long' ? 'bg-purple-400' : 'bg-blue-400'} animate-pulse"></div>
									<span class="text-[10px] font-bold uppercase tracking-widest text-niva-text-secondary">
										{currentQuestion.type} Form Question · {currentQuestion.marks} Marks
									</span>
								</div>

								{#if showSolutions || selectedOption !== null}
									<div in:fade class="space-y-4">
										<div class="p-6 rounded-2xl bg-niva-accent/5 border border-niva-accent/20 transition-all">
											<p class="text-[10px] font-bold text-niva-accent uppercase tracking-widest mb-3 leading-none">Professional Solution</p>
											<p class="text-sm text-niva-text leading-relaxed whitespace-pre-wrap">{currentQuestion.solution}</p>
										</div>
									</div>
								{:else}
									<div class="py-12 flex flex-col items-center justify-center text-center space-y-5">
										<div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-niva-text-secondary border border-white/10 shadow-inner">
											<FileText size={28} />
										</div>
										<p class="text-xs text-niva-text-secondary max-w-[280px] mx-auto font-medium">Draft your response mentally or on paper. Click below to verify against the ideal solution.</p>
										<button 
											onclick={() => selectedOption = 0}
											class="px-8 py-3 rounded-xl bg-niva-accent text-niva-bg text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all cursor-pointer shadow-lg niva-glow-sm"
										>
											Reveal Ideal Solution
										</button>
									</div>
								{/if}
							</div>
						{/if}
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
								class="w-full h-14 rounded-2xl bg-white text-niva-bg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all hover:scale-[1.01] cursor-pointer"
							>
								{currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
								<ChevronRight size={18} />
							</button>
						</div>
					{/if}
				</div>

			{:else if state === 'summary'}
				{@const pct = Math.round((score / questions.length) * 100)}
				{@const grade = getGrade(pct)}
				<div in:fly={{ y: 30, duration: 600 }} class="glass-panel p-10 rounded-[2.5rem] border border-white/10 text-center space-y-8 relative overflow-hidden group">
					<div class="absolute -top-10 -right-10 w-40 h-40 bg-niva-accent/10 blur-[80px] rounded-full"></div>
					
					<div class="space-y-4 relative">
						<div class="w-20 h-20 rounded-3xl niva-gradient flex items-center justify-center mx-auto mb-6 niva-glow relative">
							<Trophy size={40} class="text-niva-bg" />
							<div class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-black {getGradeColor(grade)} shadow-xl">
								{grade}
							</div>
						</div>
						<h2 class="text-3xl font-bold tracking-tight">Quiz Complete!</h2>
						<p class="text-niva-text-secondary text-sm">
							{getMotivation(pct)}
						</p>
					</div>

					<div class="grid grid-cols-3 gap-3 py-4">
						<div class="glass-panel p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-2">
							<span class="text-3xl font-black text-niva-accent leading-none">{score}</span>
							<span class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest mt-1">Score</span>
						</div>
						<div class="glass-panel p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-2">
							<span class="text-3xl font-black text-white leading-none">{pct}%</span>
							<span class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest mt-1">Accuracy</span>
						</div>
						<div class="glass-panel p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-2">
							<div class="flex items-center gap-1">
								<Flame size={16} class="text-orange-400" />
								<span class="text-3xl font-black text-orange-400 leading-none">{bestStreak}</span>
							</div>
							<span class="text-[10px] font-bold text-niva-text-secondary uppercase tracking-widest mt-1">Best Streak</span>
						</div>
					</div>

					<!-- Answers breakdown -->
					<div class="space-y-4 text-left">
						<div class="flex items-center justify-between">
							<button 
								onclick={() => showHistory = !showHistory}
								class="flex items-center gap-2 text-xs font-bold text-niva-text-secondary uppercase tracking-widest cursor-pointer hover:text-niva-text transition-colors"
							>
								Review Answers
								{#if showHistory}
									<ChevronUp size={14} />
								{:else}
									<ChevronDown size={14} />
								{/if}
							</button>
							<button 
								onclick={() => showSolutions = !showSolutions}
								class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1.5"
							>
								<Brain size={12} class="text-niva-accent" />
								{showSolutions ? 'Hide Solutions' : 'Reveal All Solutions'}
							</button>
						</div>

						{#if showHistory || showSolutions}
							<div in:fly={{ y: 10, duration: 300 }} class="space-y-3 max-h-[30rem] overflow-y-auto niva-scrollbar pr-2">
								{#each answers as answer, idx}
									{@const q = questions[answer.questionIndex]}
									<div class="p-4 rounded-2xl {q.type === 'mcq' ? (answer.isCorrect ? 'bg-green-500/5 border border-green-500/10' : 'bg-red-500/5 border border-red-500/10') : 'bg-white/5 border border-white/10'} space-y-3">
										<div class="flex items-start justify-between gap-3">
											<p class="text-xs font-bold leading-relaxed flex-1">{idx + 1}. {q.question}</p>
											{#if q.type === 'mcq'}
												<span class="text-[9px] font-black uppercase {answer.isCorrect ? 'text-green-400' : 'text-red-400'} shrink-0">
													{answer.isCorrect ? 'Correct' : 'Incorrect'}
												</span>
											{/if}
										</div>

										{#if q.type === 'mcq'}
											<p class="text-[10px] font-medium leading-relaxed opacity-70">
												<span class={answer.isCorrect ? 'text-green-400' : 'text-red-400'}>
													{answer.isCorrect ? '✓' : '✗'} Your answer: {q.options?.[answer.selectedIndex] || 'Skipped'}
												</span>
												{#if !answer.isCorrect}
													<span class="text-green-400 block mt-1">Correct Answer: {q.options?.[q.correctIndex || 0]}</span>
												{/if}
											</p>
										{/if}

										{#if showSolutions || (q.type !== 'mcq' && showHistory)}
											<div class="pt-3 border-t border-white/5 space-y-2">
												<p class="text-[9px] font-bold text-niva-accent uppercase tracking-widest">Ideal Solution</p>
												<p class="text-[11px] text-niva-text-secondary leading-relaxed italic">
													{q.type === 'mcq' ? q.explanation : q.solution}
												</p>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="space-y-3 pt-4">
						<button 
							onclick={() => { state = 'quiz'; currentIndex = 0; score = 0; streak = 0; bestStreak = 0; selectedOption = null; answers = []; showHistory = false; startTimer(); }}
							class="w-full h-14 rounded-2xl bg-niva-accent text-niva-bg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all hover:scale-[1.01] niva-glow-sm cursor-pointer"
						>
							<RotateCcw size={18} />
							Retake Quiz
						</button>
						<button 
							onclick={restart}
							class="w-full h-14 rounded-2xl bg-white/5 text-niva-text font-bold text-sm flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer"
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
		width: 1rem;
		height: 1rem;
		border-radius: 9999px;
		background: #fff;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border: 2px solid var(--niva-accent);
		cursor: pointer;
		transition: transform 0.2s;
	}
	input[type="range"]::-webkit-slider-thumb:hover {
		transform: scale(1.25);
	}
	input[type="range"]::-moz-range-thumb {
		width: 1rem;
		height: 1rem;
		border-radius: 9999px;
		background: #fff;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border: 2px solid var(--niva-accent);
		cursor: pointer;
		transition: transform 0.2s;
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
