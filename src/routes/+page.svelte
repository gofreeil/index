<script>
	import { onMount, tick } from 'svelte';
	import LazyMap from '$lib/components/LazyMap.svelte';
	import { lang, translations } from '$lib/i18n';
	import BusinessCard from '$lib/components/BusinessCard.svelte';
	import CategoryRail from '$lib/components/CategoryRail.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { categoryIcon, OTHER } from '$lib/categories.js';
	import { favorites } from '$lib/favorites.js';
	import {
		SITE_NAME,
		SITE_DESCRIPTION,
		websiteSchema,
		organizationSchema,
		serviceSchema,
		collectionSchema
	} from '$lib/seo';

	/** @type {{ data: { businesses: any[], catRail?: { byName: Record<string, {icon: string, image: string, imageFit?: { x: number, y: number, z: number }}>, order: string[], otherName: string }, loadError: string | null } }} */
	let { data } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	// הרשימה מגיעה מהשרת (+page.server.js) ולכן מוגשת בתוך ה-HTML לגוגל ול-AI.
	const businesses = $derived(data.businesses);
	const error = $derived(data.loadError);
	let searchTerm = $state('');
	let selectedCategory = $state('all');
	let selectedLocation = $state('all');

	// Pagination
	let visibleCount = $state(9);
	let incrementBy = $state(21);
	function loadMore() {
		visibleCount += incrementBy;
	}

	onMount(() => {
		if (typeof window !== 'undefined' && window.innerWidth < 768) {
			visibleCount = 6;
			incrementBy = 12;
		}
	});

	/* ═══════════ מסילת התחומים ═══════════
	   התחום של כל כרטיסייה כבר נקבע בשרת (resolveCategory + דריסות התצוגה
	   של הסופר-אדמין), ולכן כאן רק סופרים. הסדר: אם הסופר-אדמין קבע סדר
	   במסך ניהול הקטגוריות — הוא הקובע; אחרת לפי מספר העסקים בפועל — מה
	   שיש ממנו הכי הרבה באתר צריך להיות מה שרואים ראשון. "אחר" תמיד אחרון.
	   כל תחום חי מוצג, גם כשאין בו עדיין אף עסק: המסילה היא מפת התחומים
	   של האתר, ותחום שנעלם ממנה נקרא כ"האתר לא עוסק בזה" — גם למי שמחפש
	   וגם למי ששוקל להגיש עסק. תחום שנמחק במסך הניהול אינו מגיע לכאן
	   מלכתחילה (effectiveCategories מסנן אותו). */
	const railMeta = $derived(data.catRail?.byName ?? {});
	const railOrder = $derived(
		new Map(
			(data.catRail?.order ?? []).map((/** @type {string} */ n, /** @type {number} */ i) => [n, i])
		)
	);
	const otherName = $derived(data.catRail?.otherName ?? OTHER);
	const railCategories = $derived.by(() => {
		/** @type {Record<string, number>} */
		const counts = {};
		for (const b of businesses) {
			const key = b.category || otherName;
			counts[key] = (counts[key] ?? 0) + 1;
		}
		// railMeta = כל התחומים החיים (כולל הריקים); counts מוסיף תוויות חופשיות
		// שהוקלדו על כרטיסיות ואינן ברשימת הניהול — גם להן מגיע אריח
		const labels = new Set([...Object.keys(railMeta), ...Object.keys(counts)]);
		return [...labels]
			.map((label) => ({
				key: label,
				label,
				icon: railMeta[label]?.icon ?? categoryIcon(label),
				image: railMeta[label]?.image ?? '',
				imageFit: railMeta[label]?.imageFit,
				count: counts[label] ?? 0
			}))
			.sort(
				(a, b) =>
					(a.key === otherName ? 1 : 0) - (b.key === otherName ? 1 : 0) ||
					(railOrder.get(a.key) ?? Infinity) - (railOrder.get(b.key) ?? Infinity) ||
					b.count - a.count ||
					a.label.localeCompare(b.label, 'he')
			);
	});

	/* גלילה אל בלוק התוצאות. איתור לפי id ולא ב-bind:this: הבלוק חי בשני
	   מקומות שונים בדף (מיד מתחת למסילה כשמסננים, ובתחתית כשלא), ורק אחד מהם
	   קיים בכל רגע — הפניה חיה עלולה להתאפס בדיוק ברגע המעבר. */
	function scrollToResults() {
		const el = document.getElementById('results');
		if (!el) return;
		const header = document.querySelector('header');
		const top =
			el.getBoundingClientRect().top + window.scrollY - ((header?.offsetHeight ?? 0) + 12);
		window.scrollTo({
			top: Math.max(0, top),
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
	}

	/** מעבר אל כלל בעלי המקצוע — מנקה סינון פעיל כדי שהרשימה תהיה באמת "הכל" */
	async function goToAllBusinesses() {
		clearFilters();
		visibleCount = 9;
		await tick();
		scrollToResults();
	}

	/** בחירת תחום מהמסילה — מסננת, והתוצאות נפתחות מיד מתחת למסילה
	 *  @param {string} key */
	async function pickCategory(key) {
		selectedCategory = key || 'all';
		visibleCount = 9;
		await tick();
		// לחיצה חוזרת על תחום נבחר מבטלת את הסינון; אז בלוק התוצאות חוזר
		// לתחתית הדף, וגלילה אליו הייתה זורקת את המשתמש הרחק מהמסילה
		if (key) scrollToResults();
	}

	// ערים מהדאטה
	const cities = $derived(
		[...new Set(businesses.map((b) => b.city).filter(Boolean))].sort((a, b) =>
			a.localeCompare(b, 'he')
		)
	);

	// חיפוש על שדות רלוונטיים בלבד (לא על כל אובייקט כולל URL של תמונות)
	const SEARCH_FIELDS = ['name', 'category', 'description', 'discount', 'address', 'salesArea'];
	/** @param {any} b */
	function matchesSearch(b) {
		if (!searchTerm) return true;
		const q = searchTerm.toLowerCase();
		return SEARCH_FIELDS.some((f) =>
			String(b[f] || '')
				.toLowerCase()
				.includes(q)
		);
	}

	// ה-API כבר מחזיר מהחדש לישן (createdAt:desc) — אין צורך להפוך (ה-reverse היה שריד מ-Google Sheets)
	const filteredBusinesses = $derived(
		businesses.filter((b) => {
			const okCat = selectedCategory === 'all' || b.category === selectedCategory;
			const okLoc =
				selectedLocation === 'all' ||
				b.city === selectedLocation ||
				String(b.address).includes(selectedLocation) ||
				String(b.salesArea).includes(selectedLocation);
			return matchesSearch(b) && okCat && okLoc;
		})
	);

	const displayedBusinesses = $derived(filteredBusinesses.slice(0, visibleCount));

	/* סינון פעיל (מסילת התחומים / חיפוש / עיר) הופך את הדף למצב "תוצאות":
	   הקומות הקבועות מתחלפות ברשימת העסקים הרלוונטיים, מיד מתחת למסילה. */
	const isFiltering = $derived(
		Boolean(searchTerm) || selectedCategory !== 'all' || selectedLocation !== 'all'
	);

	// המדורגים ביותר — רק אם קיימים דירוגים אמיתיים (אחרת אין "מדורגים", זה חירטוט)
	const ratedBusinesses = $derived(
		[...filteredBusinesses].filter((b) => b.rating > 0).sort((a, b) => b.rating - a.rating)
	);
	let showAllRated = $state(false);
	const topRated = $derived(showAllRated ? ratedBusinesses : ratedBusinesses.slice(0, 3));

	// שנתווספו לאחרונה — ה-API מחזיר createdAt:desc, ולכן ראש הרשימה הוא החדש
	const recentBusinesses = $derived(filteredBusinesses.slice(0, 3));

	const favoriteBusinesses = $derived(businesses.filter((b) => $favorites.includes(b.id)));

	function clearFilters() {
		selectedCategory = 'all';
		selectedLocation = 'all';
		searchTerm = '';
	}

	/* ═══════════ SEO ═══════════
	   דף הבית הוא דף הכניסה המרכזי מגוגל וממנועי ה-AI: כותרת ותיאור מלאים,
	   canonical, JSON-LD (WebSite, Organization, Service, ItemList של כל
	   בעלי המקצוע, FAQ), וכן אינדקס טקסטואלי מלא בתחתית הדף שמקשר לכל עסק. */
	const pageTitle = `בעלי מקצוע מומלצים ומדורגים בכל הארץ | ${SITE_NAME}`;

	/* ═══════════ שאר בעלי המקצוע ═══════════
	   עד כאן ישבה כאן טבלה שריכזה את כל 92 בעלי המקצוע. עכשיו במקומה יושבים
	   הכרטיסים של מי שלא הופיע באף קומה למעלה, מחולקים לעמודים.

	   כל העמודים מרונדרים תמיד ב-HTML ורק הלא-נוכחיים מוסתרים ב-CSS (ולא
	   ב-{#if}) — זו הסיבה שהרשימה הזו נולדה מלכתחילה: היא הקישור הפנימי היחיד
	   לרוב העסקים, והכרטיסים למעלה מוצגים 9 בלבד. הסרה מה-DOM הייתה מנתקת
	   עשרות עסקים מהסריקה של גוגל ומנועי ה-AI. התמונות נטענות ב-loading="lazy",
	   ולכן עמודים מוסתרים לא מושכים בייטים. */
	let showRest = $state(false);
	let restPage = $state(0);

	/* 18 בעמוד: שש שורות של שלושה בדסקטופ, תשע שורות של שניים בנייד — בערך
	   מסך מלא אחרי שהפרסומות לוקחות את חלקן, ומתחלק בלי שארית בשתי הפריסות. */
	const REST_PAGE_SIZE = 18;

	// "שאר" = מי שלא מוצג באף אחת מהקומות שמעל (מדורגים / שנתווספו / כלל העסקים),
	// כדי שהמשתמש לא יפגוש כאן שוב את אותם כרטיסים שכבר גלל דרכם
	const shownAbove = $derived(
		new Set([...topRated, ...recentBusinesses, ...displayedBusinesses].map((b) => b.id))
	);
	const restBusinesses = $derived(businesses.filter((b) => !shownAbove.has(b.id)));

	const restPageCount = $derived(Math.max(1, Math.ceil(restBusinesses.length / REST_PAGE_SIZE)));
	const restPages = $derived(
		Array.from({ length: restPageCount }, (_, i) =>
			restBusinesses.slice(i * REST_PAGE_SIZE, (i + 1) * REST_PAGE_SIZE)
		)
	);
	// נגזר ולא מתוקן ב-$effect: מספר העמודים מתכווץ כשנפתחים "המדורגים ביותר",
	// והצמדה בתוך אפקט הייתה כותבת למצב שהיא עצמה קוראת
	const currentRestPage = $derived(Math.min(restPage, restPageCount - 1));

	/* חלון מספרי העמודים: עד 7 עמודים מציגים הכל, ומעבר לזה רק ראשון, אחרון
	   והשכנים של הנוכחי — אחרת שורת העמודים נשברת לשתי שורות ככל שהאינדקס גדל */
	const restPageNumbers = $derived.by(() => {
		if (restPageCount <= 7) return Array.from({ length: restPageCount }, (_, i) => i);
		const near = [0, restPageCount - 1, currentRestPage - 1, currentRestPage, currentRestPage + 1];
		return [...new Set(near)].filter((n) => n >= 0 && n < restPageCount).sort((a, b) => a - b);
	});

	/** @param {number} page */
	function goToRestPage(page) {
		restPage = Math.min(Math.max(page, 0), restPageCount - 1);
		// גלילה חזרה לראש הבלוק: בלעדיה מעבר עמוד משאיר את המשתמש בתחתית
		// הרשימה הקודמת, מול כרטיסים שהתחלפו מתחתיו בלי שיראה את זה
		const el = document.getElementById('rest-professionals');
		if (!el) return;
		const header = document.querySelector('header');
		const top =
			el.getBoundingClientRect().top + window.scrollY - ((header?.offsetHeight ?? 0) + 12);
		window.scrollTo({
			top: Math.max(0, top),
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
	}

	// ה-FAQPage אינו כאן יותר: ההסבר והשאלות הנפוצות עברו ללשונית "אודות"
	// שבדף המידע (/policy), והסכימה נדדה לשם — גוגל דורש שהסכימה תשקף טקסט
	// שגלוי בפועל באותו עמוד.
	const schemas = $derived([
		websiteSchema(),
		organizationSchema(),
		serviceSchema(),
		collectionSchema({
			name: `${SITE_NAME} — אינדקס בעלי המקצוע`,
			description: SITE_DESCRIPTION,
			path: '/',
			numberOfItems: businesses.length,
			items: businesses.map((b) => ({ name: b.name, path: `/business/${b.id}` }))
		})
	]);
</script>

<Seo
	title={pageTitle}
	description={SITE_DESCRIPTION}
	path="/"
	keywords="בעלי מקצוע, בעל מקצוע מומלץ, אינדקס בעלי מקצוע, חשמלאי, אינסטלטור, שיפוצניק, מזגנים, הובלות, מחשבים, עורך דין, בייביסיטר, דירוג בעלי מקצוע, המלצות"
/>
<JsonLd data={schemas} />

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- H1 — הכותרת הראשית של הדף. עד כאן לא היה בדף אף h1, וגוגל לא ידע במה הדף עוסק. -->
	<h1 class="mb-8 text-center text-2xl font-extrabold text-gray-100 sm:text-4xl">
		בעלי מקצוע כשירים — מומלצים, מדורגים ובהטבה לחברי הקהילה
	</h1>

	{#if error}
		<div class="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
			<p class="text-red-400">{t.error}: {error}</p>
		</div>
	{:else}
		<!-- ═══ שורת הפתיחה: חיפוש ומפה זה לצד זה ═══
		     המפה עלתה לכאן מלמטה (עד כאן ישבה מתחת למסילת התחומים) ותופסת חצי
		     רוחב בלבד — כך גם החיפוש אינו נמתח לכל רוחב המסך, ושניהם נראים יחד
		     בלי גלילה. בנייד הם נערמים: חיפוש למעלה, מפה מתחתיו.
		     items-center בדסקטופ: המפה גבוהה מבלוק החיפוש, וכשהחיפוש נצמד
		     לראש השורה נפער מתחתיו חלל ריק — מרכוז אנכי מיישר אותו למפה. -->
		<div class="mb-8 grid items-start gap-4 md:grid-cols-2 md:items-center md:gap-6">
			<!-- Filters -->
			<div class="space-y-4">
				<div class="relative">
					<input
						type="text"
						bind:value={searchTerm}
						placeholder={t.search}
						aria-label={t.search}
						class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 pr-12 text-gray-100 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900/30"
					/>
					<svg
						class="absolute top-3.5 right-4 h-5 w-5 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>

				<div class="flex flex-wrap items-center gap-2 px-1 text-sm text-gray-400">
					<span>{t.totalBusinesses.replace('{count}', businesses.length.toString())}</span>
					{#if searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all'}
						<span class="text-gray-700">|</span>
						<span class="font-medium text-blue-400"
							>{t.foundResults.replace('{count}', filteredBusinesses.length.toString())}</span
						>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-3">
					{#if cities.length > 0}
						<select
							bind:value={selectedLocation}
							aria-label="עיר"
							class="rounded-xl border border-gray-700 bg-purple-600 px-4 py-2.5 text-sm font-bold text-white outline-none"
						>
							<option value="all">כל הארץ</option>
							{#each cities as city}
								<option value={city}>{city}</option>
							{/each}
						</select>
					{/if}

					{#if searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all'}
						<button
							onclick={clearFilters}
							class="text-sm font-medium text-gray-400 hover:text-blue-400"
						>
							ביטול כל המסננים
						</button>
					{/if}
				</div>
			</div>

			<!-- מפה — מציגה תמיד את התוצאות המסוננות, ולכן חיפוש או בחירת תחום
			     מצטיירים גם עליה. -->
			<div>
				<h2 class="mb-2 text-center text-sm font-bold text-gray-300 sm:text-base">
					{t.mapTitle}
				</h2>
				<LazyMap businesses={filteredBusinesses} />
			</div>
		</div>

		<!-- מסילת התחומים — המסנן הראשי לפי תחום, במקום תפריט נפתח שהסתיר
		     את התחומים עד שנוגעים בו. כל אריח נושא את מספר העסקים שבו. -->
		{#if railCategories.length > 1}
			<CategoryRail
				categories={railCategories}
				selected={selectedCategory === 'all' ? '' : selectedCategory}
				onselect={pickCategory}
			/>
		{/if}

		<!-- גוף רשימת התוצאות — מוגדר פעם אחת ומרונדר במקום אחד בכל רגע:
		     מיד מתחת למסילה כשיש סינון פעיל, ובתחתית הדף כשאין.
		     withLoadMore: ברשימה התחתונה הכרטיסים הם מדגם, והדרך לראות את כולם
		     היא הטבלה שמתחתיה — ולכן "טען עוד" מופיע רק במצב סינון, שם רשימה
		     קטועה בלי המשך היא תוצאה חסרה. -->
		{#snippet resultsBody(withLoadMore = false)}
			<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
				{#each displayedBusinesses as business (business.id)}
					<BusinessCard {business} />
				{/each}
			</div>

			{#if filteredBusinesses.length === 0}
				<!-- אריח של תחום ריק מוביל לכאן, ואז "לא נמצאו... לחיפוש" מטעה: לא
				     חיפשו כלום, פשוט אין עדיין עסקים בתחום -->
				{#if selectedCategory !== 'all' && !searchTerm && selectedLocation === 'all'}
					<p class="mt-8 text-center text-gray-500">
						עדיין אין עסקים בתחום הזה. יש לכם עסק מתאים?
						<a href="/submit-business" class="font-semibold text-blue-400 hover:text-blue-300"
							>הוסיפו אותו לאינדקס</a
						>
					</p>
				{:else}
					<p class="mt-8 text-center text-gray-500">לא נמצאו עסקים התואמים לחיפוש.</p>
				{/if}
			{/if}

			{#if withLoadMore && visibleCount < filteredBusinesses.length}
				<div class="mt-12 flex justify-center">
					<button
						onclick={loadMore}
						class="rounded-full bg-gray-800 px-8 py-3 text-lg font-bold text-blue-400 shadow-md transition hover:bg-gray-700 active:scale-95"
					>
						{t.loadMore.replace('{count}', (filteredBusinesses.length - visibleCount).toString())}
					</button>
				</div>
			{/if}
		{/snippet}

		{#if isFiltering}
			<!-- מצב תוצאות: מי שבחר תחום במסילה (או חיפש/בחר עיר) מקבל את
			     העסקים הרלוונטיים כאן ועכשיו, ולא מתחת לקומות ולמפה. -->
			<div id="results" class="mt-6 mb-16">
				<div class="mb-8 text-center">
					<h2
						class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl"
					>
						{selectedCategory === 'all' ? t.filterResultsTitle : selectedCategory}
					</h2>
					<p class="mt-2 text-sm text-gray-400">
						{t.foundResults.replace('{count}', filteredBusinesses.length.toString())}
					</p>
				</div>

				{@render resultsBody(true)}

				<div class="mt-10 flex justify-center">
					<button
						onclick={goToAllBusinesses}
						class="rounded-full border border-gray-700 px-6 py-2.5 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300"
					>
						{t.allProfessionals}
					</button>
				</div>
			</div>
		{:else}
			<!-- קומה 1: המדורגים ביותר (רק כשיש דירוגים אמיתיים) -->
			{#if topRated.length > 0}
				<div class="mt-6 mb-16">
					<div class="mb-8 text-center">
						<h2
							class="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl"
						>
							{t.topRated}
						</h2>
					</div>
					<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
						{#each topRated as business (business.id)}
							<BusinessCard {business} />
						{/each}
					</div>
					{#if ratedBusinesses.length > 3}
						<div class="mt-8 flex justify-center">
							<button
								onclick={() => (showAllRated = !showAllRated)}
								class="rounded-full border border-gray-700 px-6 py-2.5 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300"
							>
								{showAllRated ? t.showLess : t.moreTopRated}
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- קומה 2: בעלי מקצוע שנתווספו לאחרונה -->
			{#if recentBusinesses.length > 0}
				<!-- mt-6 כמו בקומה 1: כשאין דירוגים זו הקומה הראשונה, והיא נצמדה למסילה -->
				<div class="mt-6 mb-16">
					<div class="mb-8 text-center">
						<h2
							class="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl"
						>
							{t.newBusinesses}
						</h2>
					</div>
					<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
						{#each recentBusinesses as business (business.id)}
							<BusinessCard {business} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Favorites -->
			{#if favoriteBusinesses.length > 0}
				<div class="mb-16">
					<div class="mb-8 flex items-center gap-3">
						<div class="h-8 w-1.5 rounded-full bg-red-500"></div>
						<h2 class="text-2xl font-bold text-gray-100">{t.favorites}</h2>
					</div>
					<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
						{#each favoriteBusinesses as business (business.id)}
							<BusinessCard {business} />
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<!-- All businesses — יעד הכפתור "לכלל בעלי המקצוע והעסקים" -->
		{#if !isFiltering}
			<div id="results" class="mt-16">
				<div class="mb-8 text-center">
					<h2
						class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl"
					>
						{t.allBusinesses}
					</h2>
				</div>

				{@render resultsBody()}
			</div>
		{/if}

		<!-- ═══ שאר בעלי המקצוע ═══
		     הכרטיסים למעלה מוצגים 9 בלבד, ולכן בלי הבלוק הזה רוב העסקים אינם
		     מקושרים ב-HTML הראשון. כל העמודים יושבים ב-HTML וגוגל מגלה דרכם כל
		     עסק ועסק — אבל הבלוק סגור עד שלוחצים, כדי שלא יתפוס מסך שלם בתחתית
		     דף הבית. hidden ב-CSS ולא {#if}: התוכן חייב להישאר ב-HTML הראשון. -->
		{#if restBusinesses.length > 0}
			<section
				id="rest-professionals"
				class="mt-20 border-t border-gray-800 pt-10"
				aria-labelledby="rest-title"
			>
				<div class="text-center">
					<h2
						id="rest-title"
						class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl"
					>
						לשאר בעלי המקצוע
					</h2>
					<p class="mt-2 mb-5 text-sm text-gray-400">
						עוד {restBusinesses.length} בעלי מקצוע שלא הופיעו למעלה.
					</p>

					<button
						type="button"
						onclick={() => (showRest = !showRest)}
						aria-expanded={showRest}
						aria-controls="rest-list"
						class="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 px-6 py-3 text-sm font-black text-blue-200 shadow-lg transition-all hover:border-blue-400/70 hover:from-blue-900/70 hover:to-indigo-900/70 active:scale-95"
					>
						<span aria-hidden="true">👷</span>
						{showRest ? 'סגירת הרשימה' : 'הצגת שאר בעלי המקצוע'}
						<span class="text-xs" aria-hidden="true">{showRest ? '▲' : '▼'}</span>
					</button>
				</div>

				<div id="rest-list" class="mt-8" class:hidden={!showRest}>
					<!-- ההסתרה יושבת על עטיפה נטולת מחלקות-display: על הרשת עצמה
					     היא הייתה מפסידה ל-md:grid, שגובר על hidden בברייקפוינט -->
					{#each restPages as page, i (i)}
						<div class:hidden={i !== currentRestPage}>
							<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
								{#each page as business (business.id)}
									<BusinessCard {business} />
								{/each}
							</div>
						</div>
					{/each}

					{#if restPageCount > 1}
						<nav
							class="mt-10 flex flex-wrap items-center justify-center gap-2"
							aria-label="עמודי בעלי המקצוע"
						>
							<button
								type="button"
								onclick={() => goToRestPage(currentRestPage - 1)}
								disabled={currentRestPage === 0}
								class="rounded-full border border-gray-700 px-4 py-2 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700"
							>
								הקודם
							</button>

							{#each restPageNumbers as n, idx (n)}
								{#if idx > 0 && n - restPageNumbers[idx - 1] > 1}
									<span class="px-1 text-gray-600" aria-hidden="true">…</span>
								{/if}
								<button
									type="button"
									onclick={() => goToRestPage(n)}
									aria-current={n === currentRestPage ? 'page' : undefined}
									class="min-w-9 rounded-full border px-3 py-2 text-sm font-bold tabular-nums transition {n ===
									currentRestPage
										? 'border-blue-400 bg-blue-900/50 text-blue-100'
										: 'border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-300'}"
								>
									{n + 1}
								</button>
							{/each}

							<button
								type="button"
								onclick={() => goToRestPage(currentRestPage + 1)}
								disabled={currentRestPage >= restPageCount - 1}
								class="rounded-full border border-gray-700 px-4 py-2 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700"
							>
								הבא
							</button>
						</nav>

						<p class="mt-4 text-center text-xs text-gray-500">
							עמוד {currentRestPage + 1} מתוך {restPageCount}
						</p>
					{/if}
				</div>
			</section>
		{/if}
	{/if}

	<!-- ההסבר "איך זה עובד" והשאלות הנפוצות עברו ללשונית "אודות" שבדף המידע
	     (/policy, וגם בחלון שנפתח מכפתור "מידע" שבכותרת), כדי שכל המידע על
	     האתר יישב במקום אחד. הקישור לשם יושב בכותרת, בכל דף. -->
</div>
