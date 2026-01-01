<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { lang, translations } from '$lib/i18n';
	import { get } from 'svelte/store';

	let { children } = $props();

	// Support for Svelte 5 state-like behavior from store
	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang]);

	let isLangMenuOpen = $state(false);

	const changeLang = (l) => {
		lang.set(l);
		isLangMenuOpen = false;
	};

	const flags = {
		he: '🇮🇱',
		en: '🇬🇧',
		ru: '🇷🇺'
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{t.title} - יוצאים לחירות</title>

	<!-- Meta Tags for Social Media (Open Graph) -->
	<meta property="og:title" content="מדריך בעלי מקצוע כשרים - יוצאים לחירות" />
	<meta
		property="og:description"
		content="בעלי מקצוע כשרים בהנחות והטבות ייחודיות לחברי יוצאים לחירות"
	/>
	<meta property="og:image" content="/og-image.png" />
	<meta property="og:type" content="website" />

	<!-- Twitter Meta Tags -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="מדריך בעלי מקצוע כשרים - יוצאים לחירות" />
	<meta
		name="twitter:description"
		content="בעלי מקצוע כשרים בהנחות והטבות ייחודיות לחברי יוצאים לחירות"
	/>
	<meta name="twitter:image" content="/og-image.png" />
</svelte:head>

<div
	class="min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50"
	dir={t.dir}
>
	<!-- Header -->
	<header class="sticky top-0 z-50 bg-white/80 shadow-sm backdrop-blur-md">
		<div class="mx-auto max-w-7xl px-2 py-3 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<!-- Title & Logo Section -->
				<a
					href="/"
					class="flex flex-1 items-center gap-1 transition-opacity hover:opacity-80 sm:gap-3"
				>
					<img
						src="/logo.png"
						alt="לוגו"
						class="h-8 w-8 rounded-full object-cover shadow-sm sm:h-14 sm:w-14"
					/>
					<div class="flex flex-col text-right">
						<h1
							class="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-right text-base font-bold text-transparent sm:text-4xl"
						>
							מדריך בעלי מקצוע כשרים
						</h1>
						<p class="hidden text-right text-sm text-gray-600 sm:block">
							בהנחות והטבות ייחודיות לחברי יוצאים לחירות
						</p>
					</div>
				</a>

				<!-- Action Buttons -->
				<div class="flex items-center gap-2 sm:gap-3">
					<!-- Language Selector -->
					<div class="relative flex items-center">
						<button
							onclick={() => (isLangMenuOpen = !isLangMenuOpen)}
							class="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xl shadow-sm transition-all hover:bg-gray-50 hover:shadow-md sm:px-4 sm:py-2"
							title="Change Language"
						>
							<span class="flex items-center justify-center leading-none">
								{/** @type {any} */ (flags)[currentLang]}
							</span>
							<svg
								class="h-4 w-4 text-gray-400 transition-transform {isLangMenuOpen
									? 'rotate-180'
									: ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>

						{#if isLangMenuOpen}
							<div
								class="absolute top-full z-[100] mt-2 flex w-36 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-2xl {t.dir ===
								'rtl'
									? 'right-0'
									: 'left-0'}"
							>
								<button
									onclick={() => changeLang('he')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50"
								>
									<span class="text-lg">🇮🇱</span>
									<span class="font-medium text-gray-700">{t.israel}</span>
								</button>
								<button
									onclick={() => changeLang('en')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50"
								>
									<span class="text-lg">🇬🇧</span>
									<span class="font-medium text-gray-700">{t.english}</span>
								</button>
								<button
									onclick={() => changeLang('ru')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50"
								>
									<span class="text-lg">🇷🇺</span>
									<span class="font-medium text-gray-700">{t.russia}</span>
								</button>
							</div>
						{/if}
					</div>

					<!-- Community Policy Button -->
					<a
						href="/policy"
						class="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-200 to-yellow-400 px-3 py-2 text-sm font-bold text-yellow-900 shadow-sm transition-all hover:scale-105 hover:shadow-md active:scale-95 sm:px-4 sm:py-2.5"
						title={t.policy}
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<span class="hidden sm:inline">{t.policy}</span>
					</a>

					<!-- Add Store Button -->
					<a
						href="https://docs.google.com/forms/d/e/1FAIpQLSe2wvCp484_PyoJyDZ_n8GupIQVy00ozt5rxOhsWklr7UPkXQ/viewform?usp=header"
						target="_blank"
						class="group flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95 sm:px-5 sm:py-2.5"
						title={t.addStore}
					>
						<svg
							class="h-5 w-5 transition-transform group-hover:rotate-90"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span class="hidden sm:inline">{t.addStore}</span>
					</a>
				</div>
			</div>
			<p class="mt-2 text-right text-xs text-gray-600 sm:hidden">
				{t.subtitle}
			</p>
		</div>
	</header>

	{@render children()}

	<footer class="mt-8 border-t bg-gray-50 py-4 sm:mt-16 sm:py-8">
		<div class="mx-auto max-w-7xl px-4 text-right text-gray-600">
			<div class="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-12">
				<!-- Action Group (Right aligned in RTL) -->
				<div class="flex flex-col items-center gap-1 sm:gap-2">
					<p class="text-[9px] font-medium text-gray-500 sm:text-[11px]">
						{t.movementAction}
					</p>
					<a
						href="https://www.melecshop.com/"
						target="_blank"
						class="flex shrink-0 flex-col items-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-0.5 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 sm:px-4"
					>
						<span class="text-sm font-black tracking-wider sm:text-base">יוצאים לחירות</span>
						<span class="text-[8px] font-medium opacity-90 sm:text-[10px]">{t.movementSlogan}</span>
					</a>
				</div>

				<!-- Vertical Divider (Hidden on mobile) -->
				<div class="hidden h-12 w-px bg-gray-300 sm:block"></div>

				<!-- Legal link Group -->
				<div class="flex flex-col gap-1 sm:gap-2">
					<p>
						<a
							href="https://docs.google.com/forms/d/e/1FAIpQLScwLo3V6wBwv-PcZYNGx9TDsVAQUvsRuQw5wUeuO_h_90C1tQ/viewform?usp=header"
							target="_blank"
							class="text-sm font-medium text-red-500 hover:underline sm:text-lg"
						>
							{t.reportViolation}
						</a>
					</p>
				</div>

				<!-- Second Vertical Divider -->
				<div class="hidden h-12 w-px bg-gray-300 sm:block"></div>

				<!-- Contact & Privacy Group -->
				<div class="flex flex-col gap-0.5 sm:gap-1">
					<a
						href="mailto:support@melecshop.com"
						class="text-xs font-bold text-gray-700 transition-colors hover:text-blue-600 sm:text-sm"
					>
						{t.contact}
					</a>
					<a
						href="/privacy"
						class="text-[10px] text-gray-500 transition-colors hover:text-blue-600 sm:text-xs"
					>
						{t.privacy}
					</a>
				</div>
			</div>

			<div class="mt-4 border-t border-gray-200 pt-4 text-center sm:mt-8 sm:pt-8">
				<p class="text-[10px] text-gray-500 sm:text-xs">
					{t.dedication}
				</p>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}
</style>
