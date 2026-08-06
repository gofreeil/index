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

	/** @type {{ data: { businesses: any[], loadError: string | null } }} */
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
	   התחום של כל כרטיסייה כבר נקבע בשרת (resolveCategory), ולכן כאן רק
	   סופרים. הסדר הוא לפי מספר העסקים בפועל ולא לפי הרשימה הקנונית —
	   מה שיש ממנו הכי הרבה באתר צריך להיות מה שרואים ראשון — ו"אחר" תמיד
	   אחרון. תחומים ריקים אינם מוצגים כלל: אריח שמוביל ל-0 תוצאות הוא
	   הבטחה שבורה (הם עדיין קיימים בטופס ההגשה). */
	const railCategories = $derived.by(() => {
		/** @type {Record<string, number>} */
		const counts = {};
		for (const b of businesses) {
			const key = b.category || OTHER;
			counts[key] = (counts[key] ?? 0) + 1;
		}
		return Object.entries(counts)
			.map(([label, count]) => ({ key: label, label, icon: categoryIcon(label), count }))
			.sort(
				(a, b) =>
					(a.key === OTHER ? 1 : 0) - (b.key === OTHER ? 1 : 0) ||
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

	/* ═══════════ טבלת כל בעלי המקצוע ═══════════
	   עד כאן ישבה כאן רשימה פתוחה של כל 92 בעלי המקצוע לפי תחום, והיא תפסה
	   מסך שלם בתחתית דף הבית. עכשיו אותו תוכן בדיוק יושב בטבלה שנפתחת
	   בכפתור. הטבלה מרונדרת תמיד ב-HTML ורק מוסתרת ב-CSS (ולא ב-{#if}) —
	   זו הסיבה שהרשימה נולדה מלכתחילה: היא הקישור הפנימי היחיד לכל עסק ועסק,
	   והכרטיסים למעלה מוצגים 9 בכל פעם. הסרה מה-DOM הייתה מנתקת 80 עסקים
	   מהסריקה של גוגל ומנועי ה-AI. */
	let showTable = $state(false);
	/** @type {'name' | 'category' | 'city'} */
	let sortBy = $state('category');
	let sortDir = $state(1);

	/** @type {Array<{ key: 'name' | 'category' | 'city', label: string }>} */
	const TABLE_COLS = [
		{ key: 'name', label: 'שם העסק' },
		{ key: 'category', label: 'תחום' },
		{ key: 'city', label: 'עיר' }
	];

	/** @param {'name' | 'category' | 'city'} col */
	function sortTable(col) {
		if (sortBy === col) sortDir = -sortDir;
		else {
			sortBy = col;
			sortDir = 1;
		}
	}

	const tableRows = $derived(
		[...businesses].sort((a, b) => {
			const key = /** @param {any} x */ (x) => String(x[sortBy] ?? '');
			// שובר-שוויון קבוע לפי שם: בלעדיו סדר הכרטיסיות בתוך תחום מתהפך
			// בכל מיון חוזר, והטבלה נראית כאילו היא "מתערבבת" מעצמה
			return (
				sortDir * key(a).localeCompare(key(b), 'he') ||
				String(a.name).localeCompare(String(b.name), 'he')
			);
		})
	);

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
		<!-- Filters -->
		<div class="mb-8 space-y-4">
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

		<!-- מסילת התחומים — המסנן הראשי לפי תחום, במקום תפריט נפתח שהסתיר
		     את התחומים עד שנוגעים בו. כל אריח נושא את מספר העסקים שבו. -->
		{#if railCategories.length > 1}
			<CategoryRail
				categories={railCategories}
				selected={selectedCategory === 'all' ? '' : selectedCategory}
				onselect={pickCategory}
			/>
		{/if}

		<!-- מפה — מיד מתחת למסילת התחומים, בגודל קומפקטי. היא מציגה תמיד את
		     התוצאות המסוננות, ולכן בחירת תחום מצטיירת גם עליה. -->
		<div class="mt-4 mb-10">
			<h2 class="mb-3 text-center text-base font-bold text-gray-300 sm:text-lg">
				{t.mapTitle}
			</h2>
			<LazyMap businesses={filteredBusinesses} />
		</div>

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
				<p class="mt-8 text-center text-gray-500">לא נמצאו עסקים התואמים לחיפוש.</p>
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
				<div class="mb-16">
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
					<div class="mt-8 flex justify-center">
						<button
							onclick={scrollToResults}
							class="rounded-full border border-gray-700 px-6 py-2.5 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300"
						>
							{t.allProfessionals}
						</button>
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

		<!-- ═══ טבלת כל בעלי המקצוע ═══
		     הכרטיסים למעלה מוצגים 9 בכל פעם ("טען עוד"), ולכן רובם אינם מקושרים
		     ב-HTML הראשון. הטבלה הזו מקשרת לכל עסק ועסק, וכך גוגל מגלה ומאנדקס
		     את כולם — אבל היא סגורה עד שלוחצים, כדי שלא תתפוס מסך שלם בתחתית
		     דף הבית. hidden ב-CSS ולא {#if}: התוכן חייב להישאר ב-HTML הראשון. -->
		{#if businesses.length > 0}
			<section
				class="mt-20 border-t border-gray-800 pt-10 text-center"
				aria-labelledby="full-index-title"
			>
				<h2 id="full-index-title" class="mb-2 text-xl font-extrabold text-gray-100">
					כל בעלי המקצוע לפי תחום
				</h2>
				<p class="mb-5 text-sm text-gray-400">
					{businesses.length} בעלי מקצוע בטבלה אחת.
				</p>

				<button
					type="button"
					onclick={() => (showTable = !showTable)}
					aria-expanded={showTable}
					aria-controls="all-businesses-table"
					class="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 px-6 py-3 text-sm font-black text-blue-200 shadow-lg transition-all hover:border-blue-400/70 hover:from-blue-900/70 hover:to-indigo-900/70 active:scale-95"
				>
					<span aria-hidden="true">📋</span>
					{showTable ? 'סגירת הטבלה' : 'פתיחת הטבלה'}
					<span class="text-xs" aria-hidden="true">{showTable ? '▲' : '▼'}</span>
				</button>

				<div id="all-businesses-table" class="mt-6" class:hidden={!showTable}>
					<!-- overflow-x על העטיפה: בנייד הטבלה רחבה מהמסך, וגלילה אופקית
					     בתוך המכל עדיפה על דחיסת עמודות עד לאי-קריאוּת -->
					<div class="overflow-x-auto rounded-2xl border border-gray-800">
						<table class="w-full min-w-[34rem] border-collapse text-right text-sm">
							<caption class="sr-only">
								כל בעלי המקצוע באינדקס — לחיצה על כותרת עמודה ממיינת לפיה
							</caption>
							<thead class="bg-gray-900/80 text-xs text-gray-300">
								<tr>
									<th scope="col" class="w-10 px-3 py-3 font-bold">#</th>
									{#each TABLE_COLS as col (col.key)}
										<th
											scope="col"
											class="px-3 py-3 font-bold"
											aria-sort={sortBy === col.key
												? sortDir === 1
													? 'ascending'
													: 'descending'
												: 'none'}
										>
											<button
												type="button"
												onclick={() => sortTable(col.key)}
												class="inline-flex items-center gap-1 hover:text-blue-300"
											>
												{col.label}
												<span class="text-[0.65rem] opacity-70" aria-hidden="true">
													{sortBy === col.key ? (sortDir === 1 ? '▲' : '▼') : '↕'}
												</span>
											</button>
										</th>
									{/each}
									<th scope="col" class="px-3 py-3 font-bold">ההטבה לחברי הקהילה</th>
								</tr>
							</thead>
							<tbody>
								{#each tableRows as b, i (b.id)}
									<tr class="border-t border-gray-800/80 even:bg-gray-900/30 hover:bg-gray-800/50">
										<td class="px-3 py-2 text-xs text-gray-600 tabular-nums">{i + 1}</td>
										<td class="px-3 py-2">
											<a
												href="/business/{b.id}"
												class="font-medium text-gray-200 hover:text-blue-400 hover:underline"
											>
												{b.name}
											</a>
										</td>
										<td class="px-3 py-2 whitespace-nowrap text-gray-400">
											<span aria-hidden="true">{categoryIcon(b.category)}</span>
											{b.category}
										</td>
										<td class="px-3 py-2 text-gray-400">{b.city || '—'}</td>
										<td class="px-3 py-2 text-gray-400">{b.discount || '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>
		{/if}
	{/if}

	<!-- ההסבר "איך זה עובד" והשאלות הנפוצות עברו ללשונית "אודות" שבדף המידע
	     (/policy, וגם בחלון שנפתח מכפתור "מידע" שבכותרת), כדי שכל המידע על
	     האתר יישב במקום אחד. הקישור לשם יושב בכותרת, בכל דף. -->
</div>
