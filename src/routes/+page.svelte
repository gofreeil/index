<script>
	import { onMount } from 'svelte';
	import LazyMap from '$lib/components/LazyMap.svelte';
	import { lang, translations } from '$lib/i18n';
	import BusinessCard from '$lib/components/BusinessCard.svelte';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import { CATEGORIES } from '$lib/categories.js';
	import { favorites } from '$lib/favorites.js';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/** @type {any[]} */
	let businesses = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let searchTerm = $state('');
	let selectedCategory = $state('all');
	let selectedLocation = $state('all');

	// Pagination
	let visibleCount = $state(9);
	let incrementBy = $state(21);
	function loadMore() {
		visibleCount += incrementBy;
	}

	onMount(async () => {
		if (typeof window !== 'undefined' && window.innerWidth < 768) {
			visibleCount = 6;
			incrementBy = 12;
		}
		try {
			const response = await fetch('/api/businesses');
			if (!response.ok) throw new Error('Failed to fetch businesses');
			const rawData = await response.json();
			businesses = rawData.map((/** @type {any} */ b) => ({
				id: b.documentId,
				documentId: b.documentId,
				slug: b.slug,
				name: b.name || 'ללא שם',
				phone: b.phone || '',
				category: b.category || '',
				banners: b.banners || [],
				banner: b.banner || '',
				description: b.description || '',
				discount: b.discount || '',
				salesArea: b.sales_area || '',
				address: b.address || '',
				city: b.city || '',
				website: b.website || '',
				logo: b.logo || '',
				rating: Number(b.rating || 0),
				lat: typeof b.lat === 'number' ? b.lat : null,
				lng: typeof b.lng === 'number' ? b.lng : null
			}));
		} catch (/** @type {any} */ err) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	// קטגוריות מהדאטה האמיתית (בסדר הקנוני, ואז נוספות) — לא טקסונומיה קשיחה מנותקת.
	const dataCategories = $derived([...new Set(businesses.map((b) => b.category).filter(Boolean))]);
	const categories = $derived([
		...CATEGORIES.filter((c) => dataCategories.includes(c)),
		...dataCategories.filter((c) => !CATEGORIES.includes(c))
	]);
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

	// המדורגים ביותר — רק אם קיימים דירוגים אמיתיים (אחרת אין "מדורגים", זה חירטוט)
	const ratedBusinesses = $derived(
		[...filteredBusinesses].filter((b) => b.rating > 0).sort((a, b) => b.rating - a.rating)
	);
	const topRated = $derived(ratedBusinesses.slice(0, 3));

	const favoriteBusinesses = $derived(businesses.filter((b) => $favorites.includes(b.id)));

	function clearFilters() {
		selectedCategory = 'all';
		selectedLocation = 'all';
		searchTerm = '';
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	{#if loading}
		<div class="mb-8 h-12 w-full animate-pulse rounded-xl bg-gray-800"></div>
		<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
			{#each Array(6) as _}
				<SkeletonCard />
			{/each}
		</div>
	{:else if error}
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
				<select
					bind:value={selectedCategory}
					aria-label="קטגוריה"
					class="rounded-xl border border-gray-700 bg-blue-600 px-4 py-2.5 text-sm font-bold text-white outline-none"
				>
					<option value="all">כל הקטגוריות</option>
					{#each categories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>

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

		<!-- Top rated (only when real ratings exist) -->
		{#if topRated.length > 0}
			<div class="mb-16">
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
			</div>
		{/if}

		<!-- Map -->
		<div class="mt-12">
			<div class="mb-8 text-center">
				<h2
					class="bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl"
				>
					{t.mapTitle}
				</h2>
			</div>
			<LazyMap businesses={filteredBusinesses} />
		</div>

		<!-- All businesses -->
		<div class="mt-16">
			<div class="mb-8 text-center">
				<h2
					class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl"
				>
					{t.allBusinesses}
				</h2>
			</div>
			<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
				{#each displayedBusinesses as business (business.id)}
					<BusinessCard {business} />
				{/each}
			</div>

			{#if filteredBusinesses.length === 0}
				<p class="mt-8 text-center text-gray-500">לא נמצאו עסקים התואמים לחיפוש.</p>
			{/if}

			{#if visibleCount < filteredBusinesses.length}
				<div class="mt-12 flex justify-center">
					<button
						onclick={loadMore}
						class="rounded-full bg-gray-800 px-8 py-3 text-lg font-bold text-blue-400 shadow-md transition hover:bg-gray-700 active:scale-95"
					>
						{t.loadMore.replace('{count}', (filteredBusinesses.length - visibleCount).toString())}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
