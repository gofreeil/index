<script>
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { lang, translations } from '$lib/i18n';
	import { authUser } from '$lib/auth';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import SmartShare from '$lib/components/SmartShare.svelte';
	import { branchLine } from '$lib/branches.js';
	import ServiceAreaMap from '$lib/components/ServiceAreaMap.svelte';
	import { adImgFit } from '$lib/adImageFit';
	import { parseFit, isDefaultFit, logoShapeClass } from '$lib/mediaFit.js';
	import { sameAsLinks } from '$lib/socialLinks.js';
	import SocialLinks from '$lib/components/SocialLinks.svelte';
	import { SITE_NAME, DEFAULT_OG_IMAGE, professionalSchema, breadcrumbSchema } from '$lib/seo';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();
	const business = $derived(data.business);

	// הגעה ממסך העריכה אחרי שמירה (?saved=1) — אישור קצר בראש הכרטיסייה.
	const justSaved = $derived(page.url.searchParams.get('saved') === '1');

	/* ═══════════ בעלות על הכרטיסייה ═══════════
	   השרת מכריע (data.claim): כרטיסייה בלי בעלים אפשר לדרוש, בקשה שנשלחה
	   מחכה לאישור אדמין, וכשהמערכת זיהתה התאמה (טלפון/אימייל) ההזמנה נוסחת
	   כפנייה אישית ולא כהצעה כללית. */
	const claim = $derived(data.claim ?? {});
	let claimOpen = $state(false);
	let claimSending = $state(false);
	const claimSent = $derived(form?.claimed === true || claim.status === 'pending');

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const PLACEHOLDER_IMG =
		'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGNsYXNzPSJoLTYgdy02IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Q0EzQUYiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xOSAyMVY1YTIgMiAwIDAwLTItMkg3YTIgMiAwIDAwLTIgMnYxNm0xNCAwaDJtLTIgMGgtNW0tOSAweDNtMiAwaDVNOSA3aDFtLTEgNGgxbTQtNGgxbS0xIDRoMW0tNSAxMHYtNWExIDEgMCAwMTEtMWgyYTEgMSAwIDAxMSAxdjVtLTQgMGg0IiAvPjwvc3ZnPg==';

	/* ═══════════ סרטון תדמית ═══════════
	   הקישור נשמר כמו שבעל העסק הדביק אותו, ולכן צריך לזהות את כל הצורות
	   שיוטיוב מפיץ בהן היום — watch, youtu.be, shorts, live, embed — כולל
	   הזנבות (?si=, &list=, &t=). בלי fallback קבוע: עסק בלי סרטון לא מציג וידאו. */
	const YT_PATTERNS = [
		/youtube\.com\/watch\?[^\s]*v=([\w-]{6,})/i,
		/youtu\.be\/([\w-]{6,})/i,
		/youtube\.com\/(?:embed|shorts|live|v)\/([\w-]{6,})/i
	];
	/** @param {string} url */
	function youtubeEmbed(url) {
		const v = String(url || '').trim();
		if (!v) return '';
		for (const p of YT_PATTERNS) {
			const m = v.match(p);
			if (m) return `https://www.youtube.com/embed/${m[1]}`;
		}
		return '';
	}
	// הסרטון הוא שדה משלו (video); הנפילה ל-youtube היא בשביל כרטיסיות ותיקות
	// שבהן הסרטון הוקלד בשדה היוטיוב, לפני שהופרד מערוץ היוטיוב.
	// כתובת ערוץ לא מייצרת embed בכל מקרה — YT_PATTERNS דורש מזהה סרטון.
	const ytEmbed = $derived(youtubeEmbed(business.video || business.youtube));

	// מיקום וזום שנקבעו בעורך הכרטיסייה. ברירת מחדל = הפעולה כבויה,
	// והתמונה נשארת בדיוק כפי שה-class מציג אותה היום (ראו mediaFit.js).
	const logoFit = $derived(parseFit(business.logo_fit));
	/** @param {number} i */
	const bannerFit = (i) => parseFit(business.banner_fits?.[i]);

	// גלריית התמונות מדפדפת רק ביד: התמונה הראשית נשארת על המסך עד שהמבקר
	// לוחץ על חץ. גלריה שמתחלפת מעצמה החליפה לו את התמונה באמצע הצפייה,
	// והמיקום והזום שבעל העסק כיוון לכל תמונה נבלעו בהחלפה.
	// הפתיחה היא בתמונה שבעל העסק סימן כראשית, ולא בהכרח בראשונה שהועלתה.
	let currentImageIndex = $state(business.main_index ?? 0);

	/** @param {number} delta */
	function stepImage(delta) {
		const n = business.banners.length;
		if (n < 2) return;
		currentImageIndex = (currentImageIndex + delta + n) % n;
	}

	/** @type {any[]} */
	let reviews = $state([]);
	let showReviewForm = $state(false);
	let newReview = $state({ rating: 5, comment: '' });
	let reviewSubmitted = $state(false);
	let reviewError = $state('');

	/** @type {any} */
	let user = $state(null);
	authUser.subscribe((v) => (user = v));

	// דירוג הכותרת: הממוצע המחושב בבאקאנד (rating_avg/rating_count).
	const avgRating = $derived(business.rating || 0);
	const ratingCount = $derived(business.rating_count || 0);

	async function fetchReviews() {
		try {
			const res = await fetch(`/api/reviews?businessId=${encodeURIComponent(business.documentId)}`);
			if (res.ok) reviews = await res.json();
		} catch (e) {
			console.error('Failed to fetch reviews:', e);
		}
	}

	onMount(() => {
		fetchReviews();
		// מונה צפייה אטומי (לא כתיבה לגיליון write-only)
		fetch('/api/stats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ documentId: business.documentId, action: 'view' })
		}).catch(() => {});
	});

	let isPhoneRevealed = $state(false);
	async function revealPhoneAndLog() {
		if (isPhoneRevealed) return;
		isPhoneRevealed = true;
		try {
			await fetch('/api/stats', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ documentId: business.documentId, action: 'reveal_phone' })
			});
		} catch (e) {
			console.error('reveal failed:', e);
		}
	}

	/**
	 * השרת מחזיר code יציב ולא טקסט, והניסוח נבחר כאן — אחרת הודעת השגיאה
	 * הייתה מגיעה בעברית גם לממשק האנגלי והרוסי.
	 * @param {string} [code]
	 */
	const reviewErrText = (code) =>
		code === 'auth'
			? t.reviewErrAuth
			: code === 'duplicate'
				? t.reviewErrDuplicate
				: code === 'rate'
					? t.reviewErrTooMany
					: t.reviewErrGeneric;

	async function submitReview() {
		if (!user) return;
		reviewError = '';
		try {
			// שם המחבר לא נשלח: השרת לוקח אותו מה-session, כדי שאי אפשר יהיה
			// לחתום חוות דעת בשם של מישהו אחר.
			const res = await fetch('/api/reviews', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: business.documentId,
					businessSlug: business.slug,
					rating: newReview.rating,
					comment: newReview.comment
				})
			});
			const result = await res.json().catch(() => null);
			if (result?.success) {
				reviewSubmitted = true;
				showReviewForm = false;
				newReview = { rating: 5, comment: '' };
			} else {
				reviewError = reviewErrText(result?.code);
			}
		} catch (e) {
			reviewError = t.reviewErrGeneric;
		}
	}

	/* ═══════════ SEO ═══════════
	   דף עסק הוא דף הנחיתה שאמור להיתפס בחיפושים כמו "חשמלאי בפתח תקווה".
	   לכן הכותרת נושאת גם את התחום וגם את העיר, והתיאור נבנה מהתוכן האמיתי
	   של העסק — כדי שלא ייווצרו תיאורים כפולים בין דפי עסקים. */
	const bizPath = $derived(`/business/${business.documentId}`);

	/**
	 * שם המקום לכותרת. רק 3 מ-89 העסקים מילאו "עיר", ולכן יש נפילה ל"אזור מכירה" —
	 * אבל השדה הזה הוא טקסט חופשי שברוב הרשומות אינו מקום: "אזור ספציפי, אפרט
	 * בהערות", "אנטרנטי", "פייסבוק", "נגיש", "אימון בזום מכל מקום בארץ". בלי סינון
	 * נוצרו כותרות כמו "... — אחר — בארצי/אונליין".
	 * ולכן: מקבלים רק ערך שנראה כמו שם יישוב — קצר, בלי פיסוק, ובלי מילות-לא-מקום.
	 * @param {string} raw
	 */
	function placeOrEmpty(raw) {
		const v = (raw || '').replace(/\s+/g, ' ').trim();
		if (!v || v.length > 20) return '';
		if (/[.,/\\|;:()0-9]/.test(v)) return '';
		if (
			/אזור|ארצי|כל הארץ|עולם|אונליין|און ליין|אינטרנט|אנטרנט|זום|טלפון|פייסבוק|נגיש|קליניקה|חנות|משלוח|שירות|מקבל|בהערות|פרטי/.test(
				v
			)
		)
			return '';
		return v;
	}
	const bizArea = $derived(placeOrEmpty(business.city) || placeOrEmpty(business.sales_area));

	/* ═══════════ מפה ═══════════
	   הכרטיסייה הציגה עד כאן מפת גוגל של נקודת הכתובת, שנבנתה מניחוש הטוב
	   ביותר מתוך טקסט חופשי (address / city / sales_area). היא הוחלפה
	   ב-ServiceAreaMap: אזור השירות עונה על מה שהמחפש בא לברר — "האם הוא
	   מגיע אליי" — ואת נקודת הכתובת ממילא מראה המפה שבדף הבית.
	   placeOrEmpty נשאר: הוא משרת את הכותרת ואת ה-JSON-LD, לא את המפה. */

	const pageTitle = $derived(
		[business.name, business.category, bizArea ? `ב${bizArea}` : ''].filter(Boolean).join(' — ') +
			` | ${SITE_NAME}`
	);
	const metaDescription = $derived(
		(
			business.description ||
			business.unique_content ||
			`${business.name}${business.category ? ` — ${business.category}` : ''}${bizArea ? ` ב${bizArea}` : ''}. פרטי התקשרות, אזור שירות, דירוגים וחוות דעת של לקוחות.`
		)
			.replace(/\s+/g, ' ')
			.slice(0, 300) +
			(business.discount ? ` · הטבה לחברי הקהילה: ${business.discount}`.slice(0, 100) : '')
	);
	const bizImage = $derived(business.logo || business.banner || DEFAULT_OG_IMAGE);

	const schemas = $derived([
		professionalSchema({
			name: business.name,
			description: business.description || business.unique_content || undefined,
			path: bizPath,
			category: business.category || undefined,
			phone: business.phone || undefined,
			website: business.website || undefined,
			image: business.logo || business.banner || undefined,
			address: business.address || undefined,
			// addressLocality מוצהר רק כשיש עיר אמיתית; areaServed סופג גם ניסוח
			// חופשי ("כל הארץ", "אזור הנגב") — זה שדה תיאורי ולגיטימי שם.
			city: placeOrEmpty(business.city) || undefined,
			areaServed: business.sales_area || business.city || undefined,
			lat: business.lat,
			lng: business.lng,
			rating: avgRating,
			ratingCount: ratingCount,
			sameAs: sameAsLinks(business)
		}),
		breadcrumbSchema([
			{ name: 'אינדקס בעלי מקצוע', path: '/' },
			...(business.category ? [{ name: business.category, path: '/' }] : []),
			{ name: business.name, path: bizPath }
		])
	]);

	// שורת מטא אחת מתחת לשם: תחום · תת-תחום · מקום. בלי כפילויות ובלי ריקים.
	const metaLine = $derived(
		[...new Set([business.category, business.subcategory, bizArea].filter(Boolean))].join(' · ')
	);
</script>

<Seo
	title={pageTitle}
	description={metaDescription}
	path={bizPath}
	image={bizImage}
	type="business.business"
	keywords={[business.category, bizArea, business.name, 'בעל מקצוע מומלץ', 'דירוג וחוות דעת']
		.filter(Boolean)
		.join(', ')}
/>
<JsonLd data={schemas} />

<main class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
	{#if justSaved}
		<p
			class="mb-4 rounded-xl border border-green-500/30 bg-green-900/20 px-4 py-2 text-base text-green-300"
		>
			✓ {t.cardSaved}
		</p>
	{/if}

	<div class="flex items-center justify-between gap-3">
		<a href="/" class="text-sm text-gray-500 transition hover:text-gray-300"
			>→ {t.backToDirectory}</a
		>
		<!-- כפתור "ערוך" — לאדמין על כל כרטיסייה, ולבעל הכרטיסייה על שלו בלבד.
		     ההכרעה בשרת (data.canEdit), ומסך העריכה בודק את ההרשאה שוב. -->
		{#if data.canEdit}
			<a
				href="/business/{business.documentId}/edit"
				class="rounded-lg border border-white/15 px-3 py-1 text-sm font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
			>
				✏️ {t.editCard}
			</a>
		{/if}
	</div>

	<!-- ── כותרת ───────────────────────────────────────────── -->
	<header class="mt-4 flex items-start gap-4">
		<!-- מסגרת הלוגו — ריבוע מעוגל או עיגול, לבחירת בעל העסק (mediaFit.js) -->
		<div
			class="h-14 w-14 flex-shrink-0 overflow-hidden bg-white/5 sm:h-16 sm:w-16 {logoShapeClass(
				business.logo_shape
			)}"
			aria-hidden={!business.logo}
		>
			{#if business.logo}
				<img
					src={business.logo}
					alt="לוגו {business.name}"
					class="h-full w-full object-contain p-1.5"
					use:adImgFit={{ ...logoFit, mode: 'contain', enabled: !isDefaultFit(logoFit) }}
					onerror={(/** @type {Event} */ e) => {
						const img = /** @type {HTMLImageElement} */ (e.target);
						img.src = PLACEHOLDER_IMG;
					}}
				/>
			{:else}
				<div class="flex h-full w-full items-center justify-center text-gray-600">
					<svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
						/>
					</svg>
				</div>
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			<h1 class="text-3xl leading-tight font-semibold text-gray-50 sm:text-4xl">{business.name}</h1>
			{#if metaLine}
				<p class="mt-1 text-base text-gray-400">{metaLine}</p>
			{/if}
			<p class="mt-1.5 text-sm">
				{#if ratingCount > 0}
					<span
						class="text-gray-400"
						role="img"
						aria-label={t.ratingOutOf5.replace('{rating}', String(avgRating))}
					>
						<span class="text-yellow-400" aria-hidden="true">★</span>
						<span class="font-medium text-gray-200">{avgRating}</span>
						<span class="text-gray-500">· {ratingCount} {t.reviews}</span>
					</span>
				{:else}
					<span class="text-gray-500">{t.noReviews}</span>
				{/if}
			</p>
		</div>
	</header>

	<!-- ── פעולות ──────────────────────────────────────────
	     הטלפון ירד לסוף הדף (מדור משלו למטה); כאן נשאר האתר בלבד. -->
	{#if business.website}
		<div class="mt-4 flex flex-wrap items-center gap-2">
			<a
				href={business.website}
				target="_blank"
				rel="noopener"
				class="rounded-lg border border-white/15 px-4 py-2 text-base font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
			>
				{t.businessSite}
			</a>
		</div>
	{/if}

	{#if business.discount}
		<p class="mt-3 text-base text-emerald-400">
			<span class="text-gray-500">{t.exclusiveBenefit}:</span>
			{business.discount}
		</p>
	{/if}

	<!-- ── שיתוף חכם — בראש הדף, בהישג יד של בעל העסק ולא בסוף הגלילה.
	     כלי שלו בלבד; השרת מכריע מי רואה אותו. -->
	{#if data.canSmartShare}
		<SmartShare {business} />
	{/if}

	<!-- ── דרישת בעלות ──────────────────────────────────────────
	     כרטיסייה שהוזרמה בייבוא היא כרטיסייה בלי בעלים: בעל העסק לא יכול
	     לערוך אותה עד שידרוש אותה ואדמין יאשר. כרטיסייה שכבר שויכה נפתחת
	     רק למי שהמערכת מזהה כבעליה — ואז זו בקשת *העברת* בעלות. לאדמין
	     המדור מוצג רק כשיש התאמה אליו עצמו — אחרת הוא היה מלווה אותו
	     ב-92 הדפים. -->
	{#if claim.open && (!data.isAdmin || claim.matchedBy)}
		<section
			class="mt-6 rounded-xl border p-4 {claim.matchedBy && !claimSent
				? 'border-amber-400/30 bg-amber-400/[0.06]'
				: 'border-white/10 bg-white/[0.03]'}"
		>
			{#if claimSent}
				<p class="text-base text-emerald-400">
					✓ {claim.transfer ? t.claimPendingTransfer : t.claimPending}
				</p>
			{:else if !claim.loggedIn}
				<p class="text-base text-gray-400">
					{t.claimLogin}
					<a href="/auth/login" class="font-medium text-blue-400 hover:text-blue-300">{t.login}</a>
				</p>
			{:else if claim.status === 'rejected'}
				<p class="text-base text-gray-400">{t.claimRejected}</p>
			{:else}
				<h2 class="text-base font-semibold text-gray-200">
					{claim.transfer
						? t.claimTitleTransfer
						: claim.matchedBy
							? t.claimTitleMatched
							: t.claimTitle}
				</h2>
				<p class="mt-1 text-base leading-7 text-gray-400">
					{claim.transfer
						? t.claimBodyTransfer
						: claim.matchedBy
							? t.claimBodyMatched
							: t.claimBody}
				</p>

				{#if form?.claimError}
					<p class="mt-2 text-sm text-red-400">{form.claimError}</p>
				{/if}

				{#if claimOpen}
					<form
						method="POST"
						action="?/claim"
						transition:slide={{ duration: 200 }}
						use:enhance={() => {
							claimSending = true;
							return async ({ update }) => {
								await update({ reset: false });
								claimSending = false;
							};
						}}
						class="mt-3"
					>
						<label for="claim-note" class="block text-sm text-gray-500">{t.claimNoteLabel}</label>
						<textarea
							id="claim-note"
							name="note"
							rows="2"
							maxlength="500"
							class="mt-1 w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-2 text-base text-gray-100 outline-none placeholder:text-gray-600 focus:border-white/30"
							placeholder={claim.transfer ? t.claimNotePlaceholderTransfer : t.claimNotePlaceholder}
						></textarea>
						<button
							disabled={claimSending}
							class="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
						>
							{claimSending ? '…' : t.claimSend}
						</button>
					</form>
				{:else}
					<button
						onclick={() => (claimOpen = true)}
						class="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-500"
					>
						{claim.transfer ? t.claimBtnTransfer : t.claimBtn}
					</button>
				{/if}
			{/if}
		</section>
	{/if}

	<!-- ── תמונות ──────────────────────────────────────────── -->
	{#if business.banners.length > 0}
		<div class="relative mt-5 aspect-[16/9] overflow-hidden rounded-xl bg-white/5">
			{#each business.banners as banner, i}
				{#if i === currentImageIndex}
					<img
						in:fade={{ duration: 200 }}
						out:fade={{ duration: 200 }}
						src={banner}
						alt="{business.name} {i + 1}"
						class="absolute inset-0 h-full w-full object-cover"
						use:adImgFit={{ ...bannerFit(i), enabled: !isDefaultFit(bannerFit(i)) }}
					/>
				{/if}
			{/each}
			{#if business.banners.length > 1}
				<!-- החצים יושבים בקצוות הלוגיים (start/end), ולכן בעברית "הקודמת"
				     היא מימין — ובממשק האנגלי/רוסי הגלריה מתהפכת מעצמה. -->
				<button
					type="button"
					onclick={() => stepImage(-1)}
					aria-label="התמונה הקודמת"
					class="absolute start-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70"
				>
					<svg
						class="h-5 w-5 rtl:rotate-180"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
					</svg>
				</button>
				<button
					type="button"
					onclick={() => stepImage(1)}
					aria-label="התמונה הבאה"
					class="absolute end-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70"
				>
					<svg
						class="h-5 w-5 rtl:rotate-180"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
					</svg>
				</button>

				<div class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
					{#each business.banners as _, i}
						<button
							type="button"
							onclick={() => (currentImageIndex = i)}
							aria-label="תמונה {i + 1}"
							class="h-1 rounded-full transition-all {i === currentImageIndex
								? 'w-5 bg-white'
								: 'w-2 bg-white/40'}"
						></button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── על העסק, פרטי קשר ומפה ──────────────────────────
	     המפה עומדת לאורך על חצי מסך — בעברית בצד שמאל, ובממשק האנגלי/הרוסי
	     היא מתהפכת עם כיוון הקריאה. החצי השני נושא את התיאור *ואת* פרטי הקשר
	     יחד: תיאור קצר השאיר חצי מסך ריק לצד מפה גבוהה, ופרטי הקשר ישבו
	     מתחתיה במדור נפרד. במסך צר הכול נערם, התוכן ראשון. -->
	<section class="mt-6 border-t border-white/[0.08] pt-5">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
			<div class="min-w-0 flex-1">
				<h2 class="text-base font-semibold text-gray-400">{t.aboutBusiness}</h2>
				<p class="mt-2 text-lg leading-7 whitespace-pre-line text-gray-300">
					{business.description || t.noDescription}
				</p>

				{#if business.address || business.sales_area || business.branches?.length}
					<h2 class="mt-5 text-base font-semibold text-gray-400">{t.contactInfo}</h2>
					<dl class="mt-2 space-y-2 text-base">
						{#if business.address}
							<div>
								<dt class="text-sm text-gray-500">{t.addressLabel}</dt>
								<dd class="mt-0.5 text-gray-300">{business.address}</dd>
							</div>
						{/if}
						{#if business.sales_area}
							<div>
								<dt class="text-sm text-gray-500">{t.serviceBorders}</dt>
								<dd class="mt-0.5 text-gray-300">{business.sales_area}</dd>
							</div>
						{/if}
						{#if business.branches?.length}
							<div>
								<dt class="text-sm text-gray-500">{t.moreLocations}</dt>
								<dd class="mt-0.5 space-y-0.5 text-gray-300">
									{#each business.branches as branch, i (i)}
										<p>{branchLine(branch)}</p>
									{/each}
								</dd>
							</div>
						{/if}
					</dl>
				{/if}
			</div>

			<!-- מפה אחת בכרטיסייה, והיא של אזורי השירות. מפת גוגל שישבה כאן
			     הראתה את נקודת הכתובת בלבד — תפקיד שהמפה של דף הבית ממלאת —
			     ואל תוך iframe של גוגל אי אפשר לצייר את האזורים מבחוץ. -->
			<div class="w-full flex-shrink-0 sm:w-1/2">
				<div class="overflow-hidden rounded-xl border border-white/10">
					<ServiceAreaMap {business} height="h-72 sm:h-[26rem]" />
				</div>
				<p class="mt-1.5 text-center text-[11px] leading-4 text-gray-500">
					אזור עבודה מקורב לפי הכרטיסייה, לא גבול מדויק. מי שלא ציין אזור מסומן ככל הארץ.
				</p>
			</div>
		</div>
	</section>

	<!-- ── סרטון תדמית ─────────────────────────────────────── -->
	{#if ytEmbed || data.canSmartShare}
		<section class="mt-6 border-t border-white/[0.08] pt-5">
			<h2 class="text-base font-semibold text-gray-400">{t.businessVideo}</h2>
			{#if ytEmbed}
				<div class="mt-2 aspect-video overflow-hidden rounded-xl bg-white/5">
					<iframe
						src={ytEmbed}
						title={business.name}
						class="h-full w-full border-0"
						loading="lazy"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				</div>
			{:else}
				<!-- ריק רק לבעל הכרטיסייה/אדמין: מבקר רגיל לא רואה מדור ריק. -->
				<p class="mt-2 text-base text-gray-500">
					{t.businessVideoEmpty}
					{#if data.canEdit}
						<a
							href="/business/{business.documentId}/edit"
							class="text-blue-400 transition hover:text-blue-300">{t.businessVideoEdit} →</a
						>
					{/if}
				</p>
			{/if}
		</section>
	{/if}

	<!-- הרשתות של העסק — לוגו לכל רשת שהוא מילא, מתחת לסרטון התדמית.
	     מחוץ למדור הווידאו בכוונה: עסק בלי סרטון עדיין מציג את הרשתות.
	     האתר לא כאן: הוא כפתור מילולי בשורת הפעולות שבראש הדף. -->
	<SocialLinks {business} />

	<!-- ── חוות דעת ────────────────────────────────────────── -->
	<section class="mt-6 border-t border-white/[0.08] pt-5">
		<div class="flex items-center justify-between gap-4">
			<h2 class="text-base font-semibold text-gray-400">{t.reviews}</h2>
			<button
				onclick={() => (showReviewForm = !showReviewForm)}
				class="text-sm font-medium text-blue-400 transition hover:text-blue-300"
			>
				{showReviewForm ? t.cancel : t.addReview}
			</button>
		</div>

		{#if reviewSubmitted}
			<p class="mt-3 text-base text-emerald-400">{t.reviewThanks}</p>
		{/if}

		{#if showReviewForm}
			<div transition:slide={{ duration: 200 }} class="mt-3 rounded-xl bg-white/[0.03] p-4">
				{#if !user}
					<p class="text-base text-gray-400">{t.loginToReview}</p>
					<div class="mt-3 flex gap-2">
						<a
							href="/auth/login"
							class="rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-500"
							>{t.login}</a
						>
						<a
							href="/auth/register"
							class="rounded-lg border border-white/15 px-4 py-2 text-base font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
							>{t.register}</a
						>
					</div>
				{:else}
					<p class="text-base text-gray-400">
						{t.whatDoYouThink}
						<span class="text-gray-500">· {user.name}</span>
					</p>
					<div class="mt-3 space-y-3">
						<select
							bind:value={newReview.rating}
							aria-label={t.reviews}
							class="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-base text-gray-100 outline-none focus:border-white/30"
						>
							<option value={5}>5 ★</option>
							<option value={4}>4 ★</option>
							<option value={3}>3 ★</option>
							<option value={2}>2 ★</option>
							<option value={1}>1 ★</option>
						</select>
						<textarea
							bind:value={newReview.comment}
							placeholder={t.reviewPlaceholder}
							class="h-24 w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-2 text-base text-gray-100 outline-none placeholder:text-gray-600 focus:border-white/30"
						></textarea>
						{#if reviewError}<p class="text-sm text-red-400">{reviewError}</p>{/if}
						<button
							onclick={submitReview}
							class="rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-500"
							>{t.submitReview}</button
						>
					</div>
				{/if}
			</div>
		{/if}

		{#if reviews.length === 0}
			<p class="mt-3 text-base text-gray-500">{t.noReviews}</p>
		{:else}
			<ul class="mt-1 divide-y divide-white/[0.08]">
				{#each reviews as review}
					<li class="py-3">
						<div class="flex items-baseline justify-between gap-3">
							<span class="text-base font-medium text-gray-200">{review.author_name}</span>
							<span class="text-sm text-gray-600">{review.date}</span>
						</div>
						<div
							class="mt-1 flex gap-0.5 text-sm"
							dir="ltr"
							aria-label={t.ratingOutOf5.replace('{rating}', String(review.rating))}
						>
							{#each Array(5) as _, i}
								<span
									aria-hidden="true"
									class={i < Math.round(review.rating) ? 'text-yellow-400' : 'text-gray-700'}
									>★</span
								>
							{/each}
						</div>
						{#if review.title}<p class="mt-2 text-base font-medium text-gray-200">
								{review.title}
							</p>{/if}
						<p class="mt-1 text-base leading-7 text-gray-400">{review.body}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- ── טלפון ───────────────────────────────────────────
	     סוף הכרטיסייה: המספר נחשף אחרי שהמבקר קרא את העסק וראה חוות דעת.
	     החשיפה עדיין נספרת בלחיצה (reveal_phone), כמו קודם. -->
	{#if business.phone}
		<section class="mt-6 border-t border-white/[0.08] pt-5">
			<h2 class="text-base font-semibold text-gray-400">{t.callNow}</h2>
			<div class="mt-2">
				{#if isPhoneRevealed}
					<a
						href="tel:{business.phone}"
						class="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-lg font-semibold text-white transition hover:bg-blue-500"
					>
						<span dir="ltr">{business.phone}</span>
					</a>
				{:else}
					<button
						onclick={revealPhoneAndLog}
						class="rounded-lg bg-blue-600 px-5 py-2.5 text-lg font-semibold text-white transition hover:bg-blue-500"
					>
						{t.revealPhone}
					</button>
				{/if}
			</div>
		</section>
	{/if}
</main>
