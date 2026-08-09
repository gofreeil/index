<script lang="ts">
	/**
	 * מסך פתיחה מלא אחרי הרשמה / זיהוי ראשון — גלובלי (מוצג ב-+layout), כדי שיופיע
	 * בכל יעד נחיתה. מקור-אמת: פרמטר `welcome` ב-URL שנשתל בזרימות ההרשמה / ה-SSO:
	 *   welcome=1 | welcome=new  → "ברוכים המצטרפים" (הרשמה / זיהוי ראשון)
	 *   welcome=back             → "ברוכים השבים"
	 * בשני המצבים מוצגת רשת הלוגואים של כל האתרים (networkSites — הרשימה
	 * הקנונית המלאה, כולל האתר הנוכחי; לא adsData שמשמש לרוטציית פרסומות).
	 *
	 * עצמאי בכוונה: קורא את ה-URL דרך window.location ב-onMount (לא $app/state)
	 * כדי שאותו רכיב יעבוד בכל מאגרי הרשת ללא תלות ב-i18n.
	 */
	import { onMount } from 'svelte';
	import { networkSites } from '$lib/networkSites';

	let { userName = '' }: { userName?: string } = $props();

	const WELCOME_MS = 7000;
	// לוגו האתר — המשתנה היחיד שמשתנה בין אתרי הרשת
	const LOGO_SRC = '/logo-professionals.png?v=3';

	let kind = $state<'new' | 'back' | null>(null);
	let visible = $state(false);
	let fill = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function dismiss() {
		if (timer) clearTimeout(timer);
		visible = false;
		try {
			const url = new URL(window.location.href);
			url.searchParams.delete('welcome');
			history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
		} catch {
			/* ignore */
		}
	}

	onMount(() => {
		const p = new URLSearchParams(window.location.search).get('welcome');
		kind = p === '1' || p === 'new' ? 'new' : p === 'back' ? 'back' : null;
		if (!kind) return;
		visible = true;
		// מסמנים שהדפדפן הזה כבר קיבל ברכה — כניסות SSO הבאות לא יציגו שוב "ברוכים המצטרפים"
		try {
			localStorage.setItem('gofreeil-welcomed', '1');
		} catch {
			/* ignore */
		}
		requestAnimationFrame(() => (fill = true));
		timer = setTimeout(dismiss, WELCOME_MS);
		return () => {
			if (timer) clearTimeout(timer);
		};
	});
</script>

{#if visible && kind}
	<div
		role="dialog"
		aria-modal="true"
		dir="rtl"
		class="fixed inset-0 z-[1300] overflow-y-auto
			{kind === 'new'
			? 'bg-gradient-to-br from-blue-950 via-[#070b14] to-purple-950'
			: 'bg-gradient-to-br from-emerald-950 via-[#070b14] to-blue-950'}"
	>
		<button
			type="button"
			onclick={dismiss}
			aria-label="סגירה"
			class="fixed top-4 left-4 z-[1310] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-gray-200 transition-colors hover:bg-white/20 hover:text-white"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
				focusable="false"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>

		<div
			class="flex min-h-full items-start justify-center px-3 py-8 sm:px-4 sm:py-12 md:items-center"
		>
			<div class="w-full max-w-none text-center sm:max-w-3xl lg:max-w-5xl">
				{#if kind === 'new'}
					<img
						src={LOGO_SRC}
						alt="לוגו האתר"
						class="mx-auto mb-4 h-24 w-24 rounded-full bg-white object-cover shadow-lg ring-2 ring-purple-400/40 sm:h-28 sm:w-28"
					/>
					<h2
						class="mb-3 flex items-center justify-center gap-2 text-3xl font-black text-white sm:text-4xl"
					>
						<span class="text-xl" aria-hidden="true">🎉</span>
						<span>ברוכים המצטרפים</span>
					</h2>
					<p class="mx-auto mb-6 max-w-2xl text-lg leading-relaxed text-gray-200 sm:text-xl">
						נרשמת בהצלחה — ומעכשיו אתה מוכר בכל אתרי רשת יוצאים לחירות, ללא צורך בהזדהות נוספת.
					</p>
					<p class="mb-4 text-base font-bold tracking-wide text-purple-200 sm:text-lg">
						יוצאים לחירות מוכיחים שעולם חדש הוא אפשרי
					</p>
				{:else}
					<div class="mb-4 text-7xl sm:text-8xl">👋</div>
					<h2 class="mb-3 text-3xl font-black text-white sm:text-4xl">
						ברוכים השבים{userName.trim() ? `, ${userName.trim()}` : ''}!
					</h2>
					<p class="mx-auto mb-6 max-w-2xl text-lg leading-relaxed text-gray-200 sm:text-xl">
						טוב לראות אותך שוב ברשת יוצאים לחירות.
					</p>
				{/if}
				<!-- לוגואים של כל האתרים ברשת (הרשימה הקנונית המלאה, כולל האתר
				     הנוכחי) — מוצגים בשני המצבים (מצטרפים + שבים). flex-wrap עם
				     מרכוז כדי שהשורה האחרונה (חלקית) תתמרכז ולא תישאר צמודה לצד -->
				<div
					class="flex flex-wrap justify-center gap-2 sm:gap-3"
					aria-label="אתרי רשת יוצאים לחירות"
				>
					{#each networkSites as site (site.id)}
						<a
							href={site.href}
							target="_blank"
							rel="noopener noreferrer"
							title={site.title}
							class="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 {kind ===
							'new'
								? 'hover:border-purple-400/40'
								: 'hover:border-emerald-400/40'} grow-0 basis-[calc(33.333%-0.34rem)] p-2 transition-all hover:-translate-y-0.5 sm:basis-[calc(25%-0.57rem)] sm:p-3 lg:basis-[calc(20%-0.6rem)]"
						>
							<div
								class="aspect-[4/3] w-full overflow-hidden rounded-lg bg-gradient-to-br {site.color}"
							>
								<img
									src={site.image}
									alt={site.title}
									loading="lazy"
									class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
							</div>
							<span
								class="line-clamp-2 text-center text-xs leading-tight font-semibold text-gray-200 sm:text-sm"
								>{site.title}</span
							>
						</a>
					{/each}
				</div>
			</div>
		</div>

		<!-- פס זמן — מתמלא עד סוף המסך (7 שניות) ואז המסך נסגר -->
		<div class="fixed right-0 bottom-0 left-0 z-[1310] h-1.5 bg-white/10">
			<div
				class="h-full {kind === 'new' ? 'bg-purple-400' : 'bg-emerald-400'}"
				style="width: {fill ? '100%' : '0%'}; transition: width {WELCOME_MS}ms linear;"
			></div>
		</div>
	</div>
{/if}
