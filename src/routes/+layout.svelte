<script>
	import './layout.css';
	import { lang, translations } from '$lib/i18n';
	import { get } from 'svelte/store';
	import MobileAdsDrawer from '$lib/components/MobileAdsDrawer.svelte';
	import RightAdBanner from '$lib/components/RightAdBanner.svelte';
	import AdsSidebar from '$lib/components/AdsSidebar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
	import { authUser, hydrateAuth } from '$lib/auth';

	let { children, data } = $props();

	// מקור-האמת לזהות המשתמש הוא ה-session בשרת (data.user מ-+layout.server.js).
	$effect(() => hydrateAuth(data.user));

	// Support for Svelte 5 state-like behavior from store
	let currentLang = $state('he');
	lang.subscribe((v) => {
		currentLang = v;
		if (typeof document !== 'undefined') {
			document.documentElement.lang = v;
			document.documentElement.dir = /** @type {any} */ (translations)[v]?.dir || 'rtl';
		}
	});

	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	let isLangMenuOpen = $state(false);

	/** @param {string} l */
	const changeLang = (l) => {
		lang.set(l);
		isLangMenuOpen = false;
	};

	/** @type {any} */
	let user = $state(null);
	authUser.subscribe((v) => (user = v));

	const flags = {
		he: '🇮🇱',
		en: '🇬🇧',
		ru: '🇷🇺'
	};
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<title>{t.title} - יוצאים לחירות</title>

	<!-- Meta Tags for Social Media (Open Graph) -->
	<meta property="og:title" content="מדריך בעלי מקצוע כשירים - יוצאים לחירות" />
	<meta
		property="og:description"
		content="בעלי מקצוע כשירים בהנחות והטבות ייחודיות לחברי יוצאים לחירות"
	/>
	<meta property="og:image" content="/og-image.png?v=2" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />

	<!-- Twitter Meta Tags -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="מדריך בעלי מקצוע כשירים - יוצאים לחירות" />
	<meta
		name="twitter:description"
		content="בעלי מקצוע כשירים בהנחות והטבות ייחודיות לחברי יוצאים לחירות"
	/>
	<meta name="twitter:image" content="/og-image.png?v=2" />
</svelte:head>

<a
	href="#main-content"
	class="sr-only absolute top-4 left-4 z-[100] rounded-lg bg-blue-600 px-4 py-2 text-white transition-all focus:not-sr-only focus:ring-2 focus:ring-blue-500 focus:outline-none"
>
	דלג לתוכן המרכזי
</a>

<!-- מסך פתיחה אחרי הרשמה / התחברות — גלובלי, מופעל ע"י ?welcome ב-URL -->
<WelcomeScreen userName={user?.name || ''} />

<MobileAdsDrawer />

<div class="relative min-h-screen bg-gray-950 text-gray-100" dir={t.dir}>
	<!-- Header -->
	<header class="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md">
		<div class="mx-auto max-w-7xl px-2 py-3 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<!-- Title & Logo Section -->
				<a
					href="/"
					class="flex min-w-0 flex-1 items-center gap-1 transition-opacity hover:opacity-80 sm:gap-3"
				>
					<img
						src="/logo-professionals.png?v=2"
						alt="לוגו בעלי מקצוע כשירים — סדר בכל עניין"
						class="h-8 w-auto rounded-lg object-contain shadow-sm sm:h-14"
					/>
					<div class="flex flex-col text-right">
						<h1
							class="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-right text-xs leading-tight font-black text-transparent sm:text-4xl"
						>
							מדריך בעלי מקצוע כשירים
						</h1>
						<p class="hidden text-right text-sm font-bold text-blue-50/90 sm:block dark:text-white">
							{t.subtitle}
						</p>
					</div>
				</a>

				<!-- Action Buttons -->
				<div class="flex flex-shrink-0 items-center gap-1 sm:gap-3">
					<!-- Language Selector -->
					<div class="relative flex items-center">
						<button
							onclick={() => (isLangMenuOpen = !isLangMenuOpen)}
							class="dark:hover:bg-gray-750 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-lg shadow-sm transition-all hover:bg-gray-50 hover:shadow-md sm:gap-2 sm:px-4 sm:py-2 sm:text-xl dark:border-gray-700 dark:bg-gray-800"
							title="Change Language"
						>
							<span class="flex items-center justify-center leading-none">
								{/** @type {any} */ (flags)[currentLang]}
							</span>
							<span class="hidden text-sm font-bold text-gray-700 sm:inline dark:text-gray-200">
								{currentLang === 'he' ? t.israel : currentLang === 'en' ? t.english : t.russia}
							</span>
							<svg
								class="h-4 w-4 text-gray-400 transition-transform {isLangMenuOpen
									? 'rotate-180'
									: ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
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
								class="absolute top-full z-[100] mt-2 flex w-36 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-2xl dark:border-gray-700 dark:bg-gray-800 {t.dir ===
								'rtl'
									? 'right-0'
									: 'left-0'}"
							>
								<button
									onclick={() => changeLang('he')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
								>
									<span class="text-lg">🇮🇱</span>
									<span class="font-medium text-gray-700 dark:text-gray-200">{t.israel}</span>
								</button>
								<button
									onclick={() => changeLang('en')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
								>
									<span class="text-lg">🇬🇧</span>
									<span class="font-medium text-gray-700 dark:text-gray-200">{t.english}</span>
								</button>
								<button
									onclick={() => changeLang('ru')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
								>
									<span class="text-lg">🇷🇺</span>
									<span class="font-medium text-gray-700 dark:text-gray-200">{t.russia}</span>
								</button>
							</div>
						{/if}
					</div>

					<!-- User Auth Section — אווטאר בלבד; ההתנתקות ופרטי המשתמש בעמוד /profile -->
					{#if user}
						<a
							href="/profile"
							class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white shadow-sm transition-all hover:scale-105 hover:shadow-md sm:h-10 sm:w-10"
							title={t.myArea}
							aria-label="{t.myArea} – {user.name}"
						>
							{(user.name || '?').trim().charAt(0).toUpperCase()}
						</a>
					{:else}
						<a
							href="/auth/login"
							class="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-blue-600 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md sm:px-4 sm:py-2 sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-blue-400"
						>
							{t.login}
						</a>
					{/if}

					<!-- Community Policy Button -->
					<a
						href="/policy"
						class="hidden items-center gap-2 rounded-full bg-gradient-to-r from-yellow-200 to-yellow-400 px-3 py-2 text-sm font-bold text-yellow-900 shadow-sm transition-all hover:scale-105 hover:shadow-md active:scale-95 sm:px-4 sm:py-2.5 lg:flex"
						title={t.policy}
					>
						<svg
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
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
						href="/submit-business"
						class="group flex items-center gap-1 overflow-hidden rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-2 py-1.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95 sm:gap-2 sm:px-5 sm:py-2.5"
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
			<p class="mt-2 text-right text-xs font-bold text-blue-600 sm:hidden dark:text-blue-300">
				{t.subtitle}
			</p>
		</div>
	</header>

	<div class="layout-container">
		<RightAdBanner />
		<main id="main-content" tabindex="-1" class="main-content">
			{@render children()}
		</main>
		<AdsSidebar approvedAds={data.approvedAds ?? []} />
	</div>

	<Footer />
</div>

<style>
	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	/* פריסת התוכן עם שני מסילות פרסום (מפורט מקהילה) */
	.layout-container {
		max-width: 1440px;
		margin: 0 auto;
		display: flex;
		gap: 2rem;
		padding: 2rem 2rem 0 2rem;
		width: 100%;
	}

	.main-content {
		flex: 1;
		min-width: 0;
	}

	@media (max-width: 1024px) {
		.layout-container {
			padding: 0;
			gap: 0;
			flex-direction: column;
			max-width: 100vw;
			/* clip ולא hidden: hidden הופך את האלמנט ל-scroll container ושובר position:sticky של צאצאים */
			overflow-x: clip;
		}
		.main-content {
			max-width: 100vw;
			overflow-x: clip;
		}
	}
</style>
