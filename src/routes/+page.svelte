<script>
	import { onMount } from 'svelte';
	import IsraelMap from '$lib/components/IsraelMap.svelte';
	import { lang, translations } from '$lib/i18n';
	import goldStar from '$lib/assets/gold-star.png';
	import sidebarBanner from '$lib/assets/sidebar-banner.jpg';

	// Handle Language
	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang]);

	/** @type {any[]} */
	let businesses = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let searchTerm = $state('');
	let selectedCategory = $state('all');
	let selectedLocation = $state('all');
	let isMenuOpen = $state(false);
	let isLocationMenuOpen = $state(false);
	let hoveredCategory = $state('');
	let hoveredCity = $state('');

	const categoryHierarchy = {
		'בית ותחזוקה': [
			'אינסטלציה',
			'חשמל',
			'שיפוצים',
			'מיזוג אוויר',
			'גינון',
			'ניקיון',
			'מנעולנות',
			'הדברה'
		],
		'מחשבים וטכנולוגיה': [
			'תיקון מחשבים',
			'בניית אתרים',
			'סלולר',
			'גרפיקה',
			'שיווק דיגיטלי',
			'אבטחת מידע'
		],
		'אוכל ומזון': ['מסעדות', 'מאפיות', 'קייטרינג', 'משלוחי אוכל', 'קונדיטוריה', 'פירות וירקות'],
		'בריאות ותזונה': ['תזונה', 'כושר', 'רפואה משלימה', 'פיזיותרפיה', 'יוגה', 'פילאטיס'],
		'יופי וטיפוח': ['מספרה', 'קוסמטיקה', 'ציפורניים', 'איפור'],
		'טיפול וייעוץ': ['אימון אישי', 'טיפול רגשי', 'ייעוץ עסקי', 'ייעוץ זוגי', 'עבודה סוציאלית'],
		אירועים: ['צילום', 'קייטרינג', 'מוזיקה', 'הפקת אירועים', 'עיצוב אירועים', 'אטרקציות'],
		'עורכי דין': ['משפחה', 'נדל"ן', 'תעבורה', 'נזיקין', 'אזרחי'],
		'שירותים פיננסים': ['ראיית חשבון', 'ביטוח', 'ייעוץ מס', 'משכנתאות', 'הנהלת חשבונות'],
		'חוגים ופנאי': ['חוגי ילדים', 'סדנאות אמנות', 'לימודי נגינה', 'ספורט ופנאי'],
		'ביבי סיטר': ['בייביסיטר', 'מטפלות', 'צהרונים'],
		הובלות: ['הובלות דירה', 'הובלות קטנות', 'אריזה ופריקה'],
		אחר: []
	};

	const cityHierarchy = {
		ירושלים: ['רמות', 'בית וגן', 'הר נוף', 'גבעת שאול', 'מאה שערים', 'פסגת זאב', 'תלפיות'],
		'בני ברק': ['מרכז', 'רמת אהרן', 'שיכון ה', 'שיכון ו', 'רמת אלחנן', 'פרדס כץ'],
		'תל אביב': ['צפון העיר', 'דרום העיר', 'יפו', 'מרכז העיר'],
		אשדוד: ['רובע ז', 'רובע ג', 'רובע ח', 'מרכז העיר'],
		'בית שמש': ['רמת בית שמש א', 'רמת בית שמש ב', 'רמת בית שמש ג', 'העיר הותיקה'],
		'ביתר עילית': ['גבעה א', 'גבעה ב'],
		'מודיעין עילית': ['קרית ספר', 'אחוזת ברכפלד'],
		חיפה: ['הדר', 'נווה שאנן', 'מרכז הכרמל'],
		'פתח תקווה': ['גני הדר', 'מרכז העיר'],
		נתניה: ['קרית צאנז', 'מרכז העיר'],
		צפת: ['העיר העתיקה', 'דרום העיר'],
		אלעד: [],
		רחובות: [],
		'באר שבע': []
	};

	const catHier = /** @type {any} */ (categoryHierarchy);
	const cityHier = /** @type {any} */ (cityHierarchy);

	// מיון הערים לפי א'-ב'
	const sortedCities = Object.keys(cityHierarchy).sort((a, b) => a.localeCompare(b, 'he'));

	// פונקציית עזר לטיהור קישורים (כעת רוב העיבוד קורה בשרת)
	/** @param {string} url */
	const getDirectImageUrl = (url) => {
		if (!url) return '';
		return url.trim();
	};

	const PLACEHOLDER_IMG =
		'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGNsYXNzPSJoLTYgdy02IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Q0EzQUYiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xOSAyMVY1YTIgMiAwIDAwLTItMkg3YTIgMiAwIDAwLTIgMnYxNm0xNCAwaDJtLTIgMGgtNW0tOSAweDNtMiAwaDVNOSA3aDFtLTEgNGgxbTQtNGgxbS0xIDRoMW0tNSAxMHYtNWExIDEgMCAwMTEtMWgyYTEgMSAwIDAxMSAxdjVtLTQgMGg0IiAvPjwvc3ZnPg==';

	onMount(async () => {
		try {
			const response = await fetch('/api/businesses');
			if (!response.ok) throw new Error('Failed to fetch businesses');
			const rawData = await response.json();

			businesses = rawData
				.map((/** @type {any} */ row) => {
					/** @param {string} partialKey */
					const findValue = (partialKey) => {
						const key = Object.keys(row).find((k) => k.includes(partialKey));
						return key ? row[key] : '';
					};

					// טיפול בתמונות - יכולות להיות כמה תמונות מופרדות בפסיק
					let rawImages = row['הוסף תמונה לבאנר'] || '';
					let bannerArray = [];
					if (rawImages) {
						bannerArray = rawImages
							.split(',')
							.map((/** @type {any} */ url) => getDirectImageUrl(url.trim()));
					}

					/** @param {string} text */
					const cleanText = (text) => {
						if (!text) return '';
						// ניקוי אגרסיבי כולל פסיקים, נקודות וכל וריאציה של "אחר אפרט"
						const cleaned = text
							.replace(/אחר[,\s:\-\.]*אפרט\s*(למטה|למה)?/g, '')
							.replace(/^[,\s:\-\.]+|[,\s:\-\.]+$/g, '') // ניקוי שאריות מהקצוות כולל נקודות
							.trim();

						// אם נשאר רק טקסט שהוא סימני פיסוק או רווחים - החזר מחרוזת ריקה כדי להסתיר אייקונים
						return !cleaned || /^[,\s:\-\.\|]+$/.test(cleaned) ? '' : cleaned;
					};

					// לוגו מעמודה J (מעובד כבר בשרת)
					const jLogo = row.logoFromColumnJ || '';
					const currentLogo = row['לוגו'] || '';

					// שימוש בלוגו התקין ביותר שקיים
					const primaryLogo = jLogo || currentLogo;
					const fallbackLogo = currentLogo;

					return {
						id: row.id,
						name: row['שם העסק או השירות '] || row['שם העסק'] || 'ללא שם',
						phone: row['טלפון '] || row['טלפון'] || '',
						category: cleanText(row['קטגוריה'] || row['Category'] || 'כללי'),
						banners: bannerArray,
						banner: bannerArray[0] || '', // תמונה ראשי לכרטיסייה
						description: cleanText(row['הערות'] || row['תיאור'] || ''),
						discount: cleanText(findValue('ההנחה הבלעדית')),
						salesArea: cleanText(
							row['אזור מכירה ארצי (אנטרנטי). אם האיזור פרטי נא לפרט היכן'] || ''
						),
						address: cleanText(row['מיקום המפעל / חנות / מחסן'] || ''),
						deliveries: cleanText(row['שירות משלוחים'] || ''),
						website: row['אתר'] || row['Website'] || '',
						logo: primaryLogo,
						fallbackLogo: fallbackLogo,
						rating: Number(row['דירוג'] || row['Rating'] || 0)
					};
				})
				.sort((/** @type {any} */ a, /** @type {any} */ b) => b.rating - a.rating);
		} catch (/** @type {any} */ err) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	const categories = $derived([
		'all',
		...new Set(businesses.map((b) => b.category).filter(Boolean))
	]);

	const filteredBusinesses = $derived(
		businesses.filter((business) => {
			const matchesSearch =
				searchTerm === '' ||
				Object.values(business).some((value) =>
					String(value).toLowerCase().includes(searchTerm.toLowerCase())
				);

			let matchesCategory = false;
			if (selectedCategory === 'all') {
				matchesCategory = true;
			} else if (catHier[selectedCategory]) {
				matchesCategory =
					business.category === selectedCategory ||
					catHier[selectedCategory].includes(business.category);
			} else {
				matchesCategory = business.category === selectedCategory;
			}

			let matchesLocation = false;
			if (selectedLocation === 'all') {
				matchesLocation = true;
			} else if (cityHier[selectedLocation]) {
				// אם נבחרה עיר, נבדוק אם העסק בעיר או באחת השכונות שלה
				matchesLocation =
					String(business.address).includes(selectedLocation) ||
					String(business.salesArea).includes(selectedLocation);
			} else {
				// בחירה ספציפית של שכונה
				matchesLocation =
					String(business.address).includes(selectedLocation) ||
					String(business.salesArea).includes(selectedLocation);
			}

			return matchesSearch && matchesCategory && matchesLocation;
		})
	);

	let displayedBusinesses = $derived(filteredBusinesses.slice(0, 3));
	let newestBusinesses = $derived([...businesses].reverse().slice(0, 3));

	// פונקציה לסגירת כל התפריטים בלחיצה מחוץ להם
	/** @param {MouseEvent} event */
	function handleOutsideClick(event) {
		const target = /** @type {HTMLElement} */ (event.target);
		if (!target.closest('.menu-container')) {
			isMenuOpen = false;
			isLocationMenuOpen = false;
			hoveredCategory = '';
			hoveredCity = '';
		}
	}

	onMount(() => {
		window.addEventListener('click', handleOutsideClick);
		return () => window.removeEventListener('click', handleOutsideClick);
	});
</script>

<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="flex flex-col gap-8 lg:flex-row">
		<!-- Main Content Area -->
		<div class="flex-1">
			{#if loading}
				<div class="flex min-h-[400px] items-center justify-center">
					<div class="text-center">
						<div
							class="inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
						></div>
						<p class="mt-4 text-gray-600">{t.loading}</p>
					</div>
				</div>
			{:else if error}
				<div class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
					<p class="text-red-600">{t.error}: {error}</p>
				</div>
			{:else}
				<!-- Filters -->
				<div class="mb-8 space-y-4">
					<div class="relative">
						<input
							type="text"
							bind:value={searchTerm}
							placeholder={t.search}
							class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
						/>
						<svg
							class="absolute top-3.5 right-4 h-5 w-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>

					<div class="mt-2 flex flex-wrap items-center gap-2 px-1 text-sm text-gray-500">
						<svg
							class="h-4 w-4 text-blue-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
							/>
						</svg>
						<span>סה"כ <strong>{businesses.length}</strong> עסקים באינדקס</span>
						{#if searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all'}
							<span class="mx-1 text-gray-300">|</span>
							<span class="font-medium text-blue-600">נמצאו {filteredBusinesses.length} תוצאות</span
							>
						{/if}
					</div>

					<div class="flex w-full items-center gap-2 sm:w-auto sm:flex-wrap sm:gap-4">
						<div
							class="menu-container relative flex-1 sm:flex-initial"
							onmouseenter={() => {
								isMenuOpen = true;
								isLocationMenuOpen = false;
							}}
						>
							<button
								onclick={(e) => {
									e.stopPropagation();
									isMenuOpen = !isMenuOpen;
									if (isMenuOpen) isLocationMenuOpen = false;
								}}
								class="flex h-full w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 sm:gap-2 sm:px-6 sm:text-base"
							>
								<svg
									class="h-4 w-4 sm:h-5 sm:w-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 6h16M4 12h16m-7 6h7"
									/>
								</svg>
								<span class="line-clamp-1"
									>{selectedCategory === 'all' ? 'קטגוריות' : selectedCategory}</span
								>
							</button>

							{#if isMenuOpen}
								<div
									class="absolute right-0 z-[100] mt-1 flex w-64 flex-col rounded-xl border border-gray-100 bg-white py-2 shadow-2xl"
								>
									<button
										onclick={() => {
											selectedCategory = 'all';
											isMenuOpen = false;
										}}
										class="px-4 py-2 text-right transition hover:bg-blue-50 hover:text-blue-600 {selectedCategory ===
										'all'
											? 'font-bold text-blue-600'
											: 'text-gray-700'}"
									>
										{t.all}
									</button>

									<div class="my-1 border-t border-gray-100"></div>

									{#each Object.keys(catHier) as mainCat}
										<div class="group relative" onmouseenter={() => (hoveredCategory = mainCat)}>
											<button
												onclick={() => {
													selectedCategory = mainCat;
													isMenuOpen = false;
												}}
												class="flex w-full items-center justify-between px-4 py-2 text-right transition hover:bg-blue-50 hover:text-blue-600 {selectedCategory ===
												mainCat
													? 'font-bold text-blue-600'
													: 'text-gray-700'}"
											>
												<span class="ml-2">←</span>
												<span>{mainCat}</span>
											</button>

											{#if hoveredCategory === mainCat && catHier[mainCat].length > 0}
												<div
													class="static w-full bg-blue-50/50 py-1 lg:absolute lg:top-0 lg:right-full lg:z-[101] lg:mr-1 lg:w-56 lg:rounded-xl lg:border lg:border-gray-100 lg:bg-white lg:py-2 lg:shadow-xl"
												>
													{#each catHier[mainCat] as subCat}
														<button
															onclick={() => {
																selectedCategory = subCat;
																isMenuOpen = false;
															}}
															class="block w-full px-8 py-2 text-right text-sm transition hover:bg-blue-100 hover:text-blue-700 lg:px-4 {selectedCategory ===
															subCat
																? 'font-bold text-blue-700'
																: 'text-gray-700'}"
														>
															{subCat}
														</button>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Location Filter (Neighborhoods) -->
						<div
							class="menu-container relative flex-1 sm:flex-initial"
							onmouseenter={() => {
								isLocationMenuOpen = true;
								isMenuOpen = false;
							}}
						>
							<button
								onclick={(e) => {
									e.stopPropagation();
									isLocationMenuOpen = !isLocationMenuOpen;
									if (isLocationMenuOpen) isMenuOpen = false;
								}}
								class="flex h-full w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-2 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-purple-700 sm:gap-2 sm:px-6 sm:text-base"
							>
								<svg
									class="h-4 w-4 sm:h-5 sm:w-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								<span class="line-clamp-1"
									>{selectedLocation === 'all' ? t.neighborhoods : selectedLocation}</span
								>
							</button>

							{#if isLocationMenuOpen}
								<div
									class="scrollbar-thin scrollbar-thumb-gray-200 absolute right-0 z-[100] mt-1 flex max-h-[70vh] w-64 flex-col overflow-y-auto rounded-xl border border-gray-100 bg-white py-2 shadow-2xl"
								>
									<button
										onclick={() => {
											selectedLocation = 'all';
											isLocationMenuOpen = false;
										}}
										class="px-4 py-2 text-right transition hover:bg-purple-50 hover:text-purple-600 {selectedLocation ===
										'all'
											? 'font-bold text-purple-600'
											: 'text-gray-700'}"
									>
										כל הארץ
									</button>

									<div class="my-1 border-t border-gray-100"></div>

									{#each sortedCities as city}
										<div class="relative border-b border-gray-50 last:border-0">
											<button
												onmouseenter={() => (hoveredCity = city)}
												onclick={() => {
													const neighborhoods = cityHier[city];
													if (!neighborhoods || neighborhoods.length === 0) {
														selectedLocation = city;
														isLocationMenuOpen = false;
													} else {
														hoveredCity = hoveredCity === city ? '' : city;
													}
												}}
												class="flex w-full items-center justify-between px-4 py-3 text-right transition hover:bg-purple-50 hover:text-purple-600 {selectedLocation ===
												city
													? 'font-bold text-purple-600'
													: 'text-gray-700'}"
											>
												<span class="text-base">{city}</span>
												{#if cityHier[city]?.length > 0}
													<svg
														class="h-4 w-4 transition-transform {hoveredCity === city
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
												{/if}
											</button>

											{#if hoveredCity === city && cityHier[city]?.length > 0}
												<div class="bg-gray-50 py-1 shadow-inner">
													{#each cityHier[city] as neighborhood}
														<button
															onclick={() => {
																selectedLocation = neighborhood;
																isLocationMenuOpen = false;
															}}
															class="block w-full border-r-4 border-transparent px-8 py-2 text-right text-sm transition hover:border-purple-400 hover:bg-purple-100/50 hover:text-purple-700 {selectedLocation ===
															neighborhood
																? 'font-bold text-purple-700'
																: 'text-gray-600'}"
														>
															{neighborhood}
														</button>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>

						{#if selectedCategory !== 'all' || selectedLocation !== 'all'}
							<button
								onclick={() => {
									selectedCategory = 'all';
									selectedLocation = 'all';
								}}
								class="text-sm font-medium text-gray-500 hover:text-blue-600"
							>
								ביטול כל המסננים
							</button>
						{/if}
					</div>
				</div>

				<div class="mb-10 flex flex-col items-center justify-center text-center">
					<h2
						class="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
					>
						{t.topRated}
					</h2>
					<div class="mt-4 flex justify-center -space-x-1 sm:-space-x-2" dir="ltr">
						{#each [{ tx: '-100px', ty: '-50px', r: '-45deg', d: '0s' }, { tx: '-50px', ty: '80px', r: '30deg', d: '0.1s' }, { tx: '0px', ty: '-100px', r: '180deg', d: '0.2s' }, { tx: '50px', ty: '60px', r: '-20deg', d: '0.3s' }, { tx: '100px', ty: '-40px', r: '90deg', d: '0.4s' }] as star, i}
							<img
								src={goldStar}
								alt="כוכב זהב"
								class="animate-converge h-10 w-10 object-contain mix-blend-multiply sm:h-16 sm:w-16"
								style="--tx: {star.tx}; --ty: {star.ty}; --r: {star.r}; animation-delay: {star.d}; opacity: 0; animation-fill-mode: forwards;"
							/>
						{/each}
					</div>
				</div>

				<!-- Business cards grid -->
				<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
					{#each displayedBusinesses as business (business.id)}
						<a
							href="/business/{business.id}"
							class="group flex w-[calc(50%-8px)] flex-col overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:w-auto sm:rounded-xl sm:shadow-md sm:hover:shadow-xl"
						>
							<div class="relative h-28 w-full overflow-hidden bg-gray-100 sm:h-48">
								{#if business.logo}
									<img
										src={business.logo}
										alt={business.name}
										class="absolute inset-0 z-10 h-full w-full object-contain p-2 transition duration-500 group-hover:scale-105"
										loading="lazy"
										onerror={(e) => {
											const img = /** @type {HTMLImageElement} */ (e.target);
											if (business.fallbackLogo && !img.dataset.fallbackTried) {
												img.dataset.fallbackTried = 'true';
												img.src = business.fallbackLogo;
											} else {
												img.src = PLACEHOLDER_IMG;
												img.style.padding = '20px';
												img.style.backgroundColor = '#f3f4f6';
												img.style.objectFit = 'contain';
											}
										}}
									/>
								{/if}
								{#if business.banner}
									<img
										src={business.banner}
										alt={business.name}
										class="h-full w-full object-cover opacity-30 transition duration-500 group-hover:scale-105"
										loading="lazy"
									/>
								{:else}
									<div
										class="h-full w-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-20"
									></div>
								{/if}
							</div>

							<div class="flex flex-1 flex-col p-3 sm:p-6">
								<!-- Header: Name & Category -->
								<div class="mb-2 sm:mb-4">
									<h3
										class="line-clamp-1 text-xs font-bold text-gray-800 transition group-hover:text-blue-600 sm:text-xl"
									>
										{business.name}
									</h3>
									<span
										class="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 sm:px-3 sm:py-1 sm:text-xs"
									>
										{business.category}
									</span>
								</div>

								<!-- Discount -->
								{#if business.discount}
									<div
										class="mb-2 rounded border border-green-100 bg-green-50 p-1.5 sm:mb-4 sm:rounded-lg sm:p-3"
									>
										<p class="line-clamp-2 text-[10px] leading-tight text-green-800 sm:text-sm">
											{business.discount}
										</p>
									</div>
								{/if}

								<!-- Description (Hidden on mobile) -->
								{#if business.description}
									<p class="mb-4 line-clamp-3 hidden flex-grow text-sm text-gray-600 sm:block">
										{business.description}
									</p>
								{/if}

								<!-- Info Grid -->
								<div
									class="mt-auto border-t pt-2 text-[10px] text-gray-600 sm:space-y-2 sm:pt-4 sm:text-sm"
								>
									<div class="flex items-center gap-1.5">
										<svg
											class="h-3 w-3 flex-shrink-0 text-gray-400 sm:h-4 sm:w-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
											/>
										</svg>
										<span class="line-clamp-1">{business.address || business.salesArea}</span>
									</div>
								</div>
							</div>
						</a>
					{/each}
				</div>

				<!-- New Businesses Section -->
				<div class="mt-20">
					<div class="mb-10 flex flex-col items-center justify-center text-center">
						<h2
							class="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
						>
							{t.newBusinesses}
						</h2>
						<div class="mt-4 flex gap-2">
							<span
								class="animate-jump-limited inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
							>
								חדש באתר!
							</span>
						</div>
					</div>

					<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
						{#each newestBusinesses as business (business.id)}
							<a
								href="/business/{business.id}"
								class="group flex w-[calc(50%-8px)] flex-col overflow-hidden rounded-lg border-t-2 border-green-500 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:w-auto sm:rounded-xl sm:border-t-4 sm:shadow-md sm:hover:shadow-xl"
							>
								<div class="relative h-28 w-full overflow-hidden bg-gray-100 sm:h-48">
									{#if business.logo}
										<img
											src={business.logo}
											alt={business.name}
											class="absolute inset-0 z-10 h-full w-full object-contain p-2 transition duration-500 group-hover:scale-105"
											loading="lazy"
											onerror={(e) => {
												const img = /** @type {HTMLImageElement} */ (e.target);
												if (business.fallbackLogo && !img.dataset.fallbackTried) {
													img.dataset.fallbackTried = 'true';
													img.src = business.fallbackLogo;
												} else {
													img.src = PLACEHOLDER_IMG;
													img.style.padding = '20px';
													img.style.backgroundColor = '#f3f4f6';
													img.style.objectFit = 'contain';
												}
											}}
										/>
									{/if}
									{#if business.banner}
										<img
											src={business.banner}
											alt={business.name}
											class="h-full w-full object-cover opacity-30 transition duration-500 group-hover:scale-105"
											loading="lazy"
										/>
									{:else}
										<div
											class="h-full w-full bg-gradient-to-r from-green-500 to-blue-500 opacity-20"
										></div>
									{/if}
									<div
										class="absolute top-1 right-1 z-20 rounded bg-green-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm sm:top-2 sm:right-2 sm:rounded-lg sm:px-2 sm:py-1 sm:text-[10px]"
									>
										חדש
									</div>
								</div>

								<div class="flex flex-1 flex-col p-3 sm:p-6">
									<!-- Header: Name & Category -->
									<div class="mb-2 sm:mb-4">
										<h3
											class="line-clamp-1 text-xs font-bold text-gray-800 transition group-hover:text-green-600 sm:text-xl"
										>
											{business.name}
										</h3>
										<span
											class="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 sm:px-3 sm:py-1 sm:text-xs"
										>
											{business.category}
										</span>
									</div>

									<!-- Discount -->
									{#if business.discount}
										<div
											class="mb-2 rounded border border-green-100 bg-green-50 p-1.5 sm:mb-4 sm:rounded-lg sm:p-3"
										>
											<p class="line-clamp-2 text-[10px] leading-tight text-green-800 sm:text-sm">
												{business.discount}
											</p>
										</div>
									{/if}

									<!-- Info Grid -->
									<div
										class="mt-auto border-t pt-2 text-[10px] text-gray-600 sm:space-y-2 sm:pt-4 sm:text-sm"
									>
										<div class="flex items-center gap-1.5">
											<svg
												class="h-3 w-3 flex-shrink-0 text-gray-400 sm:h-4 sm:w-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
												/>
											</svg>
											<span class="line-clamp-1">{business.address}</span>
										</div>
									</div>
								</div></a
							>
						{/each}
					</div>
				</div>

				<!-- Section: Businesses Map -->
				<div class="mt-20">
					<div class="mb-10 flex flex-col items-center justify-center text-center">
						<h2
							class="bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
						>
							{t.mapTitle}
						</h2>

						<div
							class="mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
						></div>
					</div>

					<div
						class="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-gray-100 bg-white p-2 shadow-2xl"
					>
						<div class="rounded-2xl bg-slate-50">
							<IsraelMap {businesses} showRegions={false} />
						</div>
					</div>
				</div>

				<!-- All Businesses Section -->
				<div class="mt-20">
					<div class="mb-10 flex flex-col items-center justify-center text-center">
						<h2
							class="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
						>
							{t.allBusinesses}
						</h2>
						<div
							class="mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
						></div>
					</div>

					<div class="flex flex-wrap justify-center gap-3 px-2 sm:gap-8 sm:px-4">
						{#each filteredBusinesses as business (business.id)}
							<a
								href="/business/{business.id}"
								class="group relative flex aspect-square w-[calc(33.33%-8px)] items-center justify-center rounded-xl border border-gray-100 bg-white p-2 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl sm:h-32 sm:w-32 sm:rounded-2xl sm:p-4"
								title={business.name}
							>
								{#if business.logo}
									<img
										src={business.logo}
										alt={business.name}
										class="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-110"
										loading="lazy"
										onerror={(e) => {
											const img = /** @type {HTMLImageElement} */ (e.target);
											if (business.fallbackLogo && !img.dataset.fallbackTried) {
												img.dataset.fallbackTried = 'true';
												img.src = business.fallbackLogo;
											} else {
												img.src = PLACEHOLDER_IMG;
												img.style.padding = '8px';
												img.style.backgroundColor = '#f3f4f6';
												img.style.borderRadius = '50%';
											}
										}}
									/>
								{:else}
									<div class="flex flex-col items-center justify-center text-center">
										<div
											class="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"
										>
											<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
												/>
											</svg>
										</div>
										<span class="line-clamp-2 text-[10px] font-bold text-gray-400"
											>{business.name}</span
										>
									</div>
								{/if}

								<!-- Hover Tooltip -->
								<div
									class="pointer-events-none absolute -bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
								>
									{business.name}
									<div
										class="absolute -top-1 left-1/2 -translate-x-1/2 border-x-4 border-b-4 border-x-transparent border-b-gray-800"
									></div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Sticky Left Sidebar -->
		<aside class="hidden w-64 shrink-0 lg:block">
			<div class="sticky top-32 z-10 space-y-6">
				<!-- Banner Area -->
				<!-- Banner Area -->
				<a
					href="https://www.melecshop.com/"
					target="_blank"
					class="group relative flex h-48 flex-col items-center justify-center overflow-hidden rounded-2xl shadow-md transition-shadow hover:shadow-lg"
				>
					<img
						src={sidebarBanner}
						alt="Banner"
						class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
					/>
					<div class="absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/50"></div>
					<div class="relative z-10 p-4 text-center">
						<span class="block text-lg font-bold text-white drop-shadow-md"
							>{t.sidebarBannerTitle}</span
						>
						<p class="mt-2 text-xs font-medium text-white/90 drop-shadow">{t.sidebarBannerP}</p>
					</div>
				</a>

				<!-- Advertisements -->
				<div class="space-y-4">
					<h3 class="border-b pb-2 text-lg font-bold text-gray-800">{t.ads}</h3>
					<div class="grid gap-4">
						<div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
							<div class="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-gray-100">
								<svg
									class="h-8 w-8 text-gray-300"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
							</div>
							<h4 class="text-sm font-bold">{t.specialOffer}</h4>
							<p class="mt-1 text-xs text-gray-500">{t.specialOfferDesc}</p>
						</div>

						<div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
							<div class="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-gray-200">
								<span class="text-xs font-medium text-gray-400">{t.ads}</span>
							</div>
							<h4 class="text-sm font-bold">{t.newWorld}</h4>
							<p class="mt-1 text-xs text-gray-500">{t.newWorldDesc}</p>
						</div>
					</div>
				</div>

				<!-- Action Call -->
				<div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
					<p class="text-xs font-medium text-blue-800">{t.wantToAdvertise}</p>
					<a
						href="mailto:support@melecshop.com"
						class="mt-2 block text-xs font-bold text-blue-600 hover:underline">{t.contact}</a
					>
				</div>
			</div>
		</aside>
	</div>
</main>

<style>
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.animate-converge {
		animation: converge 1s cubic-bezier(0.25, 1, 0.5, 1) forwards;
	}

	@keyframes converge {
		0% {
			opacity: 0;
			transform: translate(var(--tx), var(--ty)) rotate(var(--r)) scale(3);
			filter: blur(10px);
		}
		60% {
			opacity: 1;
		}
		100% {
			opacity: 1;
			transform: translate(0, 0) rotate(0deg) scale(1);
			filter: blur(0px);
		}
	}

	@keyframes jump-limited {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}
</style>
