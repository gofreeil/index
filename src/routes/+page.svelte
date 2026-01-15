<script>
	import { onMount } from 'svelte';
	import LazyMap from '$lib/components/LazyMap.svelte';
	import { lang, translations } from '$lib/i18n';
	import BusinessCard from '$lib/components/BusinessCard.svelte';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import goldStar from '$lib/assets/gold-star.png';
	import sidebarBanner from '$lib/assets/sidebar-banner.jpg';

	// Handle Language
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
	let isMenuOpen = $state(false);
	let isLocationMenuOpen = $state(false);
	let hoveredCategory = $state('');
	let hoveredCity = $state('');

	// Pagination
	let visibleCount = $state(9);
	let incrementBy = $state(21);

	function loadMore() {
		visibleCount += incrementBy;
	}

	// Favorites
	/** @type {any[]} */
	let favoriteIds = $state([]);
	onMount(() => {
		const updateFavorites = () => {
			favoriteIds = JSON.parse(localStorage.getItem('favorites') || '[]');
		};
		updateFavorites();

		// Adjust initial count for mobile
		if (window.innerWidth < 768) {
			visibleCount = 6;
			incrementBy = 12;
		}

		window.addEventListener('storage', updateFavorites);
		// Listen for custom event if local storage is modified in same tab
		const _setItem = localStorage.setItem;
		localStorage.setItem = function (key, value) {
			_setItem.apply(this, [key, value]);
			updateFavorites();
		};

		return () => {
			window.removeEventListener('storage', updateFavorites);
			localStorage.setItem = _setItem;
		};
	});

	/** @type {Record<number, boolean>} */
	let failedImages = $state({});

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

			businesses = rawData.map((/** @type {any} */ row) => {
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
					name:
						row['שם העסק או השירות '] ||
						row['שם העסק'] ||
						row['שם העסק/ שירות'] ||
						row['שם העסק / שירות'] ||
						findValue('שם') ||
						findValue('Name') ||
						'ללא שם',
					phone: row['טלפון '] || row['טלפון'] || '',
					category: cleanText(row['קטגוריה'] || row['Category'] || 'כללי'),
					banners: bannerArray,
					banner: bannerArray[0] || '', // תמונה ראשי לכרטיסייה
					description: cleanText(row['הערות'] || row['תיאור'] || ''),
					discount: cleanText(findValue('ההנחה הבלעדית')),
					salesArea: cleanText(row['אזור מכירה ארצי (אנטרנטי). אם האיזור פרטי נא לפרט היכן'] || ''),
					address: cleanText(row['מיקום המפעל / חנות / מחסן'] || ''),
					deliveries: cleanText(row['שירות משלוחים'] || ''),
					website: row['אתר'] || row['Website'] || '',
					logo: primaryLogo,
					fallbackLogo: fallbackLogo,
					rating: Number(row['דירוג'] || row['Rating'] || 0)
				};
			});
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
		[...businesses].reverse().filter((business) => {
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

	let displayedBusinesses = $derived(filteredBusinesses.slice(0, visibleCount));
	let topRatedBusinesses = $derived(
		[...filteredBusinesses].sort((a, b) => b.rating - a.rating).slice(0, 3)
	);

	let favoriteBusinesses = $derived(businesses.filter((b) => favoriteIds.includes(b.id)));

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
				<div class="mb-8 h-12 w-full animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800"></div>
				<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
					{#each Array(6) as _}
						<SkeletonCard />
					{/each}
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
							class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-900/30"
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

					<div
						class="mt-2 flex flex-wrap items-center gap-2 px-1 text-sm text-gray-500 dark:text-gray-400"
					>
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
						<span>{t.totalBusinesses.replace('{count}', businesses.length.toString())}</span>
						{#if searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all'}
							<span class="mx-1 text-gray-300 dark:text-gray-700">|</span>
							<span class="font-medium text-blue-600 dark:text-blue-400"
								>{t.foundResults.replace('{count}', filteredBusinesses.length.toString())}</span
							>
						{/if}
					</div>

					<div class="flex w-full items-center gap-2 sm:w-auto sm:flex-wrap sm:gap-4">
						<!-- svelte-ignore a11y_no_static_element_interactions -->
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
									class="absolute right-0 z-[100] mt-1 flex w-64 flex-col rounded-xl border border-gray-100 bg-white py-2 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
								>
									<button
										onclick={() => {
											selectedCategory = 'all';
											isMenuOpen = false;
										}}
										class="px-4 py-2 text-right transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 {selectedCategory ===
										'all'
											? 'font-bold text-blue-600 dark:text-blue-400'
											: 'text-gray-700 dark:text-gray-300'}"
									>
										{t.all}
									</button>

									<div class="my-1 border-t border-gray-100 dark:border-gray-700"></div>

									{#each Object.keys(catHier) as mainCat}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div class="group relative" onmouseenter={() => (hoveredCategory = mainCat)}>
											<button
												onclick={() => {
													selectedCategory = mainCat;
													isMenuOpen = false;
												}}
												class="flex w-full items-center justify-between px-4 py-2 text-right transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 {selectedCategory ===
												mainCat
													? 'font-bold text-blue-600 dark:text-blue-400'
													: 'text-gray-700 dark:text-gray-300'}"
											>
												<span class="ml-2">←</span>
												<span>{mainCat}</span>
											</button>

											{#if hoveredCategory === mainCat && catHier[mainCat].length > 0}
												<div
													class="static w-full bg-blue-50/50 py-1 lg:absolute lg:top-0 lg:right-full lg:z-[101] lg:mr-1 lg:w-56 lg:rounded-xl lg:border lg:border-gray-100 lg:bg-white lg:py-2 lg:shadow-xl dark:bg-gray-800 dark:lg:border-gray-700"
													role="none"
												>
													{#each catHier[mainCat] as subCat}
														<button
															onclick={() => {
																selectedCategory = subCat;
																isMenuOpen = false;
															}}
															class="block w-full px-8 py-2 text-right text-sm transition hover:bg-blue-100 hover:text-blue-700 lg:px-4 dark:hover:bg-blue-900/30 {selectedCategory ===
															subCat
																? 'font-bold text-blue-700 dark:text-blue-400'
																: 'text-gray-700 dark:text-gray-300'}"
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
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="menu-container relative flex-1 sm:flex-initial"
							role="button"
							tabindex="-1"
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
									class="scrollbar-thin scrollbar-thumb-gray-200 absolute right-0 z-[100] mt-1 flex max-h-[70vh] w-64 flex-col overflow-y-auto rounded-xl border border-gray-100 bg-white py-2 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
								>
									<button
										onclick={() => {
											selectedLocation = 'all';
											isLocationMenuOpen = false;
										}}
										class="px-4 py-2 text-right transition hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 {selectedLocation ===
										'all'
											? 'font-bold text-purple-600 dark:text-purple-400'
											: 'text-gray-700 dark:text-gray-300'}"
									>
										כל הארץ
									</button>

									<div class="my-1 border-t border-gray-100 dark:border-gray-700"></div>

									{#each sortedCities as city}
										<div
											class="relative border-b border-gray-50 last:border-0 dark:border-gray-700"
											role="none"
										>
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
												class="flex w-full items-center justify-between px-4 py-3 text-right transition hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 {selectedLocation ===
												city
													? 'font-bold text-purple-600 dark:text-purple-400'
													: 'text-gray-700 dark:text-gray-300'}"
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
												<div class="bg-gray-50 py-1 shadow-inner dark:bg-gray-900/50">
													{#each cityHier[city] as neighborhood}
														<button
															onclick={() => {
																selectedLocation = neighborhood;
																isLocationMenuOpen = false;
															}}
															class="block w-full border-r-4 border-transparent px-8 py-2 text-right text-sm transition hover:border-purple-400 hover:bg-purple-100/50 hover:text-purple-700 dark:hover:bg-purple-900/30 {selectedLocation ===
															neighborhood
																? 'font-bold text-purple-700 dark:text-purple-400'
																: 'text-gray-600 dark:text-gray-300'}"
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

				{#if favoriteBusinesses.length > 0}
					<div class="mb-16">
						<div class="mb-8 flex items-center gap-3">
							<div class="h-8 w-1.5 rounded-full bg-red-500"></div>
							<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">{t.favorites}</h2>
						</div>
						<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
							{#each favoriteBusinesses as business (business.id)}
								<BusinessCard {business} />
							{/each}
						</div>
					</div>
				{/if}

				<div class="mb-10 flex flex-col items-center justify-center text-center">
					<h2
						class="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
					>
						{t.topRated}
					</h2>
					<div class="mt-4 flex justify-center -space-x-1 sm:-space-x-2" dir="ltr">
						{#each [{ tx: '-100px', ty: '-50px', r: '-45deg', d: '0s' }, { tx: '-50px', ty: '80px', r: '30deg', d: '0.1s' }, { tx: '0px', ty: '-100px', r: '180deg', d: '0.2s' }, { tx: '50px', ty: '60px', r: '-20deg', d: '0.3s' }, { tx: '100px', ty: '-40px', r: '90deg', d: '0.4s' }] as star, i}
							<div
								class="animate-converge h-10 w-10 sm:h-16 sm:w-16"
								style="--tx: {star.tx}; --ty: {star.ty}; --r: {star.r}; animation-delay: {star.d}; opacity: 0; animation-fill-mode: forwards;"
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									class="h-full w-full drop-shadow-[0_3px_5px_rgba(0,0,0,0.7)]"
								>
									<defs>
										<linearGradient id="gold-gradient-{i}" x1="0%" y1="0%" x2="100%" y2="100%">
											<stop offset="0%" style="stop-color:#3d2b1f;stop-opacity:1" />
											<stop offset="15%" style="stop-color:#8a642d;stop-opacity:1" />
											<stop offset="30%" style="stop-color:#d4af37;stop-opacity:1" />
											<stop offset="45%" style="stop-color:#fcf6ba;stop-opacity:1" />
											<stop offset="60%" style="stop-color:#d4af37;stop-opacity:1" />
											<stop offset="85%" style="stop-color:#5d4037;stop-opacity:1" />
											<stop offset="100%" style="stop-color:#3d2b1f;stop-opacity:1" />
										</linearGradient>
									</defs>
									<path
										d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
										fill="url(#gold-gradient-{i})"
										stroke="#2a1b12"
										stroke-width="0.3"
									/>
								</svg>
							</div>
						{/each}
					</div>
				</div>

				<!-- Business cards grid -->
				<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
					{#each topRatedBusinesses as business (business.id)}
						<BusinessCard {business} />
					{/each}
				</div>

				<!-- Section: Businesses Map -->
				<div class="mt-20">
					<div class="mb-10 flex flex-col items-center justify-center text-center">
						<h2
							class="bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
						>
							{t.mapTitle}
						</h2>

						<div
							class="mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
						></div>
					</div>

					<LazyMap {businesses} />
				</div>

				<!-- All Businesses Section -->
				<div class="mt-20">
					<div class="mb-10 flex flex-col items-center justify-center text-center">
						<h2
							class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-2xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
						>
							{t.allBusinesses}
						</h2>
						<div
							class="mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
						></div>
					</div>

					<div class="flex flex-wrap justify-center gap-3 md:grid md:grid-cols-3 md:gap-6">
						{#each displayedBusinesses as business (business.id)}
							<BusinessCard {business} />
						{/each}
					</div>

					{#if visibleCount < filteredBusinesses.length}
						<div class="mt-12 flex justify-center">
							<button
								onclick={loadMore}
								class="rounded-full bg-white px-8 py-3 text-lg font-bold text-blue-600 shadow-md transition-all hover:bg-blue-50 hover:shadow-lg active:scale-95 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
							>
								{t.loadMore.replace('{count}', filteredBusinesses.length - visibleCount)}
							</button>
						</div>
					{/if}
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
					<div class="grid gap-4">
						<!-- Group Purchase (Priority) -->
						<a
							href="https://www.melecshop.com/"
							target="_blank"
							class="group relative overflow-hidden rounded-xl shadow-sm transition-all hover:shadow-md"
						>
							<img
								src="/group-purchase-banner.png"
								alt="קבוצת רכישה"
								class="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
							/>
							<div
								class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
							></div>
							<div class="absolute right-4 bottom-4 left-4 text-right">
								<h4 class="text-base font-extrabold text-white drop-shadow-lg sm:text-lg">
									הצטרף לקבוצת רכישה
								</h4>
								<p class="mt-1 text-xs font-medium text-white/90 drop-shadow-md sm:text-sm">
									והוזל מיד את ההוצאות החודשיות שלך
								</p>
							</div>
						</a>

						<!-- Sponsored Content Separator -->
						<div class="relative flex items-center py-2">
							<div class="flex-grow border-t border-gray-200"></div>
							<span
								class="mx-4 flex-shrink text-[10px] font-semibold tracking-wider text-gray-400 uppercase"
								>תוכן שיווקי</span
							>
							<div class="flex-grow border-t border-gray-200"></div>
						</div>

						<!-- Placeholder Ad -->
						<div
							class="rounded-xl border-2 border-dashed border-orange-400 bg-gradient-to-br from-yellow-50 to-orange-50 p-4 shadow-sm"
						>
							<div class="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-white/60">
								<svg
									class="h-10 w-10 text-orange-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4v16m8-8H4"
									/>
								</svg>
							</div>
							<h4 class="text-center text-sm font-bold text-orange-600">מקום פרסום זה</h4>
							<p class="mt-1 text-center text-xs font-medium text-orange-500">יכול להיות שלך</p>
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

	/* Pulse glow animation for "New" badge */
	.animate-pulse-glow {
		animation: pulse-glow 2s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%,
		100% {
			box-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
			transform: scale(1);
		}
		50% {
			box-shadow:
				0 0 30px rgba(34, 197, 94, 0.9),
				0 0 50px rgba(34, 197, 94, 0.5);
			transform: scale(1.05);
		}
	}

	/* Slow spin animation for star icon */
	.animate-spin-slow {
		animation: spin-slow 3s linear infinite;
	}

	@keyframes spin-slow {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
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
