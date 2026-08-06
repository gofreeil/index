<script>
	import './layout.css';
	import { lang, translations } from '$lib/i18n';
	import { get } from 'svelte/store';
	import MobileAdsDrawer from '$lib/components/MobileAdsDrawer.svelte';
	import RightAdBanner from '$lib/components/RightAdBanner.svelte';
	import AdsSidebar from '$lib/components/AdsSidebar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
	import Flag from '$lib/components/Flag.svelte';
	import PolicyModal from '$lib/components/PolicyModal.svelte';
	import { authUser, hydrateAuth } from '$lib/auth';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	// מקור-האמת לזהות המשתמש הוא ה-session בשרת (data.user מ-+layout.server.js).
	$effect(() => hydrateAuth(data.user));

	// פריטים שממתינים לטיפול אדמין (עסקים + ביקורות + דיווחים + פרסומות +
	// בעלות). 0 לכל מי שאינו אדמין. מסמן את האווטאר בבועה אדומה עד שמישהו
	// מהאדמינים מטפל — אותו מספר בדיוק מוצג באזור האישי ועל אריחי הפאנל.
	const pendingTotal = $derived(data.pending?.total ?? 0);

	// אותה בועה, מהצד של בעל העסק: כרטיסיות שהמערכת זיהתה כשלו והוא עוד
	// לא דרש אותן. הקישור מוביל אל המדור שבאזור האישי שבו דורשים אותן.
	const myMatches = $derived(data.myMatches ?? 0);
	const alertTotal = $derived(pendingTotal + myMatches);
	const alertHref = $derived(
		pendingTotal > 0 ? '/profile#admin' : myMatches > 0 ? '/profile#claims' : '/profile'
	);
	const alertTitle = $derived(
		pendingTotal > 0
			? `${pendingTotal} פריטים ממתינים לטיפול`
			: `${myMatches} כרטיסיות מחכות לך באתר`
	);

	// הטענת Google Analytics (gtag) בצד-הלקוח — רק אם הוגדר מזהה מדידה.
	// עלות שרת אפסית: הסקריפט נטען מגוגל, לא מאיתנו.
	onMount(() => {
		const gaId = data.gaId;
		if (!gaId || typeof document === 'undefined') return;
		if (document.getElementById('ga-gtag')) return;
		const s = document.createElement('script');
		s.id = 'ga-gtag';
		s.async = true;
		s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
		document.head.appendChild(s);
		const w = /** @type {any} */ (window);
		w.dataLayer = w.dataLayer || [];
		w.gtag = function () {
			// eslint-disable-next-line prefer-rest-params
			w.dataLayer.push(arguments);
		};
		w.gtag('js', new Date());
		w.gtag('config', gaId);
	});

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

	// קודי הדגלים ב-flagcdn (ISO 3166-1 alpha-2) — אותו מקור דגלים כמו בשאר
	// אתרי הרשת, במקום אימוג'י שלא נתמך ב-Windows.
	/** @type {Record<string, string>} */
	const flagCodes = {
		he: 'il',
		en: 'gb',
		ru: 'ru'
	};

	// חלון המידע של מדיניות הקהילה, שנפתח מכפתור המידע שבכותרת.
	let isPolicyOpen = $state(false);
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png?v=3" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
	<!-- כותרת גיבוי בלבד: כל דף ציבורי דורס אותה דרך <Seo> ($lib/components/Seo.svelte) -->
	<title>{t.title} - יוצאים לחירות</title>
	<!-- תגי ה-Open Graph / Twitter מוגדרים פר-דף ברכיב <Seo>. תג גלובלי כאן היה
	     מקדים את הפר-דפי ב-HTML, וכל שיתוף של דף עסק בוואטסאפ היה מציג את שם
	     האתר במקום את שם העסק. גם מידות התמונה יצאו מכאן: לדף עסק יש לוגו משלו,
	     ומידות קשיחות היו משקרות לגביו. -->
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

<!-- חלון המידע של מדיניות הקהילה — גלובלי, נפתח מכפתור המידע שבכותרת -->
<PolicyModal bind:open={isPolicyOpen} />

<div class="relative min-h-screen bg-gray-950 text-gray-100" dir={t.dir}>
	<!-- Header -->
	<header class="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md">
		<div class="mx-auto max-w-7xl px-2 py-3 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<!-- Title & Logo Section -->
				<a
					href="/"
					class="group flex min-w-0 flex-1 items-center gap-1 sm:gap-3"
					title={t.homeTooltip}
					aria-label={t.homeTooltip}
				>
					<!-- הלוגו גדל מעט בריחוף מעל הקישור כולו (group-hover), כדי שגם מי
					     שהעכבר שלו מתקרב מכיוון הכותרת יקבל את הרמז שזה קישור לדף הבית. -->
					<img
						src="/logo-professionals.png?v=3"
						alt="לוגו בעלי מקצוע כשירים — סדר בכל עניין"
						class="h-8 w-auto rounded-lg object-contain shadow-sm transition-transform duration-300 ease-out group-hover:scale-110 sm:h-14"
					/>
					<div class="flex flex-col text-right transition-opacity group-hover:opacity-80">
						<!-- שם המותג בכותרת הוא <p> ולא <h1>: ה-h1 שייך לכותרת הייחודית של כל דף
						     (שם העסק בדף עסק, כותרת האינדקס בדף הבית). h1 גלובלי זהה בכל הדפים
						     היה מטשטש לגוגל במה כל דף עוסק. -->
						<!-- הגרדיאנט בגוונים בהירים (400/300) ולא 600: הכותרת יושבת על רקע
						     gray-900 כהה, וכחול-סגול כהה כמעט נבלע בו. -->
						<p
							class="bg-gradient-to-r from-sky-400 via-blue-300 to-fuchsia-400 bg-clip-text text-right text-xs leading-tight font-black text-transparent sm:text-4xl"
						>
							מדריך בעלי מקצוע כשירים
						</p>
						<p class="hidden text-right text-sm font-bold text-blue-50/90 sm:block dark:text-white">
							{t.subtitle}
						</p>
					</div>
				</a>

				<!-- Action Buttons — סדר ה-DOM הוא מימין לשמאל (העמוד ב-RTL):
				     שפה, מידע, הוסף עסק, ואזור אישי בקצה השמאלי. -->
				<div class="flex flex-shrink-0 items-center gap-1 sm:gap-3">
					<!-- Language Selector -->
					<div class="relative flex items-center">
						<button
							onclick={() => (isLangMenuOpen = !isLangMenuOpen)}
							class="dark:hover:bg-gray-750 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-lg shadow-sm transition-all hover:bg-gray-50 hover:shadow-md sm:gap-2 sm:px-4 sm:py-2 sm:text-xl dark:border-gray-700 dark:bg-gray-800"
							title="Change Language"
						>
							<Flag
								code={flagCodes[currentLang]}
								label={currentLang === 'he'
									? t.israel
									: currentLang === 'en'
										? t.english
										: t.russia}
							/>
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
									<Flag code="il" label={t.israel} />
									<span class="font-medium text-gray-700 dark:text-gray-200">{t.israel}</span>
								</button>
								<button
									onclick={() => changeLang('en')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
								>
									<Flag code="gb" label={t.english} />
									<span class="font-medium text-gray-700 dark:text-gray-200">{t.english}</span>
								</button>
								<button
									onclick={() => changeLang('ru')}
									class="flex items-center gap-3 px-3 py-2.5 text-right text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
								>
									<Flag code="ru" label={t.russia} />
									<span class="font-medium text-gray-700 dark:text-gray-200">{t.russia}</span>
								</button>
							</div>
						{/if}
					</div>

					<!-- כפתור "מידע" — מדיניות הקהילה ותנאיה.
					     קליק רגיל פותח את המדיניות בחלון מידע על גבי הדף הנוכחי, אבל
					     האלמנט נשאר <a> אמיתי אל /policy: כך פתיחה בלשונית חדשה
					     (ctrl+קליק), שמירת הקישור וסריקה של גוגל ממשיכות לעבוד. -->
					<a
						href="/policy"
						onclick={(e) => {
							// דילוג על פתיחת החלון כשהגולש ביקש במפורש לשונית/חלון אחר
							if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
							e.preventDefault();
							isPolicyOpen = true;
						}}
						class="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-200 to-yellow-400 px-2 py-1.5 text-sm font-bold text-yellow-900 shadow-sm transition-all hover:scale-105 hover:shadow-md active:scale-95 sm:px-4 sm:py-2.5"
						title={t.communityPolicyTitle}
						aria-haspopup="dialog"
					>
						<!-- אייקון "מידע" (i בעיגול) ולא אייקון מסמך: הכפתור נקרא "מידע",
						     והצמד אייקון+כיתוב צריך לספר את אותו סיפור. -->
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
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<!-- "מידע" מילה קצרה, ולכן הכיתוב נגלה כבר ב-sm ולא רק ב-lg כמו
						     הכיתוב הארוך שהיה כאן קודם. -->
						<span class="hidden sm:inline">{t.info}</span>
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

					<!-- User Auth Section — תצוגת האזור האישי מפורטת מהגמ"ח הארצי:
					     גלולה כהה ובתוכה עיגול אווטאר בגרדיאנט ענבר–ורוד ושם המשתמש.
					     הגרדיאנט הזה, ולא הכחול-סגול של "הוסף עסק", כדי ששני הכפתורים
					     הסמוכים לא ייראו כאותו כפתור. ההתנתקות ופרטי המשתמש בעמוד /profile.
					     כשיש פריטים שממתינים לטיפול (אדמין) — בועה אדומה ממוספרת בפינה,
					     והקישור מוביל ישר לפאנל שבאזור האישי. -->
					{#if user}
						<a
							href={alertHref}
							class="relative flex flex-shrink-0 items-center gap-2 rounded-full bg-[#1c2f5a] px-1.5 py-1.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#2a4379] sm:px-3 sm:py-2"
							title={alertTotal > 0 ? alertTitle : t.myArea}
							aria-label={alertTotal > 0
								? `${t.myArea} – ${user.name} – ${alertTitle}`
								: `${t.myArea} – ${user.name}`}
						>
							<span
								class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-xs"
								aria-hidden="true">👤</span
							>
							<span class="hidden max-w-[120px] truncate sm:inline">{user.name || user.email}</span>
							{#if alertTotal > 0}
								<span
									class="pointer-events-none absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] leading-none font-black text-white shadow-lg ring-2 ring-gray-900"
								>
									<span class="sr-only">פריטים ממתינים לטיפול:</span>{alertTotal > 99
										? '99+'
										: alertTotal}
								</span>
							{/if}
						</a>
					{:else}
						<a
							href="/auth/login"
							class="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-600 px-2 py-1.5 text-sm font-bold text-white shadow-sm transition-all hover:from-amber-400 hover:to-pink-500 sm:px-4 sm:py-2"
							title={t.login}
						>
							<span aria-hidden="true">👤</span>
							<span class="hidden sm:inline">{t.login}</span>
						</a>
					{/if}
				</div>
			</div>
			<p class="mt-2 text-right text-xs font-bold text-blue-600 sm:hidden dark:text-blue-300">
				{t.subtitle}
			</p>
		</div>
	</header>

	<div class="layout-container">
		<!-- ב-RTL הילד הראשון הוא הצד הימני: הפרסומות בימין, אתרי הרשת בשמאל.
		     approvedAds מגיע ל-RightAdBanner בלבד - אין פרסומות בטור השמאלי. -->
		<RightAdBanner approvedAds={data.approvedAds ?? []} />
		<main id="main-content" tabindex="-1" class="main-content">
			{@render children()}
		</main>
		<AdsSidebar />
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
