<script>
	import { onMount } from 'svelte';

	/** @type {any[]} */
	let businesses = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let searchTerm = $state('');
	let selectedCategory = $state('all');
	let selectedLocation = $state('all');
	let isMenuOpen = $state(false);
	let isLocationMenuOpen = $state(false);
	let hoveredCategory = $state(null);
	let hoveredCity = $state(null);

	const categoryHierarchy = {
		'בית ותחזוקה': ['אינסטלציה', 'חשמל', 'שיפוצים', 'מיזוג אוויר', 'גינון', 'ניקיון'],
		'מחשבים וטכנולוגיה': ['תיקון מחשבים', 'בניית אתרים', 'סלולר', 'גרפיקה'],
		'טיפול וייעוץ': ['אימון אישי', 'טיפול רגשי', 'ייעוץ עסקי', 'ייעוץ זוגי'],
		'אירועים ופנאי': ['צילום', 'קייטרינג', 'מוזיקה', 'הפקת אירועים'],
		'יופי ובריאות': ['קונדיטוריה', 'מספרה', 'תזונה', 'כושר'],
		'שירותים משפטיים ופיננסיים': ['עריכת דין', 'ראיית חשבון', 'ביטוח'],
		'אוכל ומזון': ['מסעדות', 'מאפיות', 'קייטרינג', 'משלוחי אוכל']
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

	// מיון הערים לפי א'-ב'
	const sortedCities = Object.keys(cityHierarchy).sort((a, b) => a.localeCompare(b, 'he'));

	// פונקציית עזר להמרת קישורי גוגל דרייב לקישור תמונה ישיר
	/** @param {string} url */
	const getDirectImageUrl = (url) => {
		if (!url) return '';

		// אם זה קישור של גוגל דרייב
		if (url.includes('drive.google.com') && url.includes('id=')) {
			const idMatch = url.match(/id=([^&]+)/);
			if (idMatch && idMatch[1]) {
				// המרה לפורמט uc?export=view שמציג את התמונה ישירות
				return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
			}
		}
		return url;
	};

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

						// אם נשאר רק תו בודד של פיסוק או שהטקסט ריק - החזר מחרוזת ריקה
						return cleaned.length <= 1 && /^[,\s:\-\.]$/.test(cleaned) ? '' : cleaned;
					};

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
						logo: row['לוגו'] || '',
						rating: Number(row['דירוג'] || row['Rating'] || 0)
					};
				})
				.sort((a, b) => b.rating - a.rating);
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
			} else if (categoryHierarchy[selectedCategory]) {
				matchesCategory =
					business.category === selectedCategory ||
					categoryHierarchy[selectedCategory].includes(business.category);
			} else {
				matchesCategory = business.category === selectedCategory;
			}

			let matchesLocation = false;
			if (selectedLocation === 'all') {
				matchesLocation = true;
			} else if (cityHierarchy[selectedLocation]) {
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
			hoveredCategory = null;
			hoveredCity = null;
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
						<p class="mt-4 text-gray-600">טוען עסקים...</p>
					</div>
				</div>
			{:else if error}
				<div class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
					<p class="text-red-600">שגיאה בטעינת העסקים: {error}</p>
				</div>
			{:else}
				<!-- Filters -->
				<div class="mb-8 space-y-4">
					<div class="relative">
						<input
							type="text"
							bind:value={searchTerm}
							placeholder="חיפוש עסקים..."
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

					<div class="mt-2 flex items-center gap-2 px-1 text-sm text-gray-500">
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

					<div class="flex flex-wrap items-center gap-4">
						<div
							class="menu-container relative inline-block"
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
								class="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-blue-700"
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 6h16M4 12h16m-7 6h7"
									/>
								</svg>
								<span>{selectedCategory === 'all' ? 'קטגוריות' : selectedCategory}</span>
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
										הכל
									</button>

									<div class="my-1 border-t border-gray-100"></div>

									{#each Object.keys(categoryHierarchy) as mainCat}
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

											{#if hoveredCategory === mainCat && categoryHierarchy[mainCat].length > 0}
												<div
													class="absolute top-0 right-full z-[101] mr-1 w-56 rounded-xl border border-gray-100 bg-white py-2 shadow-xl"
												>
													{#each categoryHierarchy[mainCat] as subCat}
														<button
															onclick={() => {
																selectedCategory = subCat;
																isMenuOpen = false;
															}}
															class="block w-full px-4 py-2 text-right text-sm transition hover:bg-blue-50 hover:text-blue-600 {selectedCategory ===
															subCat
																? 'font-bold text-blue-600'
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
							{:else}
								<!-- Hidden indicator for better perceived performance -->
							{/if}
						</div>

						<!-- Location Filter (Neighborhoods) -->
						<div
							class="menu-container relative inline-block"
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
								class="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-purple-700"
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
								<span>{selectedLocation === 'all' ? 'עסקים בשכונתי' : selectedLocation}</span>
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
													if (cityHierarchy[city].length === 0) {
														selectedLocation = city;
														isLocationMenuOpen = false;
													} else {
														hoveredCity = hoveredCity === city ? null : city;
													}
												}}
												class="flex w-full items-center justify-between px-4 py-3 text-right transition hover:bg-purple-50 hover:text-purple-600 {selectedLocation ===
												city
													? 'font-bold text-purple-600'
													: 'text-gray-700'}"
											>
												<span class="text-base">{city}</span>
												{#if cityHierarchy[city].length > 0}
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

											{#if hoveredCity === city && cityHierarchy[city].length > 0}
												<div class="bg-gray-50 py-1 shadow-inner">
													{#each cityHierarchy[city] as neighborhood}
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

				<div class="mb-10 flex flex-col items-center justify-center">
					<h2
						class="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
					>
						שלושת המדורגים ביותר
					</h2>
					<div class="mt-4 flex gap-2">
						{#each Array(5) as _, i}
							<svg
								class="animate-gold-shimmer h-10 w-10 drop-shadow-lg"
								viewBox="0 0 24 24"
								style="animation-delay: {i * 0.2}s"
							>
								<defs>
									<linearGradient id="gold-gradient-{i}" x1="0%" y1="0%" x2="100%" y2="100%">
										<stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
										<stop offset="50%" style="stop-color:#B8860B;stop-opacity:1" />
										<stop offset="100%" style="stop-color:#8B6508;stop-opacity:1" />
									</linearGradient>
									<filter id="f3d-{i}" x="-20%" y="-20%" width="140%" height="140%">
										<feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur" />
										<feOffset in="blur" dx="1" dy="1" result="offsetBlur" />
										<feSpecularLighting
											in="blur"
											surfaceScale="5"
											specularConstant="1"
											specularExponent="20"
											lighting-color="#ffffff"
											result="specOut"
										>
											<fePointLight x="-5000" y="-10000" z="20000" />
										</feSpecularLighting>
										<feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
										<feComposite
											in="SourceGraphic"
											in2="specOut"
											operator="arithmetic"
											k1="0"
											k2="1"
											k3="1"
											k4="0"
										/>
									</filter>
								</defs>
								<path
									filter="url(#f3d-{i})"
									fill="url(#gold-gradient-{i})"
									stroke="#5C4508"
									stroke-width="0.5"
									d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
								/>
							</svg>
						{/each}
					</div>
				</div>

				<!-- Business cards grid -->
				<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
					{#each displayedBusinesses as business (business.id)}
						<a
							href="/business/{business.id}"
							class="group flex flex-col overflow-hidden rounded-xl bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
						>
							<!-- Banner Image -->
							{#if business.banner}
								<div class="relative h-48 w-full overflow-hidden bg-gray-100">
									<img
										src={business.banner}
										alt={business.name}
										class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
										loading="lazy"
									/>
								</div>
							{:else}
								<div class="h-3 bg-gradient-to-r from-blue-500 to-purple-500"></div>
							{/if}

							<div class="flex flex-1 flex-col p-6">
								<!-- Header: Name & Category -->
								<div class="mb-4">
									<div class="flex items-start justify-between">
										<h3
											class="text-xl font-bold text-gray-800 transition group-hover:text-blue-600"
										>
											{business.name}
										</h3>
									</div>
									<span
										class="mt-1 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
									>
										{business.category}
									</span>
								</div>

								<!-- Discount -->
								{#if business.discount}
									<div class="mb-4 rounded-lg border border-green-100 bg-green-50 p-3">
										<div class="flex items-center gap-2 text-green-700">
											<svg
												class="h-5 w-5 flex-shrink-0"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
												/>
											</svg>
											<span class="text-sm font-bold">הטבה לחברים:</span>
										</div>
										<p class="mt-1 text-sm text-green-800">{business.discount}</p>
									</div>
								{/if}

								<!-- Description -->
								{#if business.description}
									<p class="mb-4 line-clamp-3 flex-grow text-sm text-gray-600">
										{business.description}
									</p>
								{/if}

								<!-- Info Grid -->
								<div class="mt-auto space-y-2 border-t pt-4 text-sm text-gray-600">
									{#if business.address || business.salesArea}
										<div class="flex items-start gap-2">
											<svg
												class="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
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
											<span>
												{business.address ? business.address : ''}
												{business.address && business.salesArea ? ' | ' : ''}
												{business.salesArea}
											</span>
										</div>
									{/if}

									{#if business.deliveries && business.deliveries !== 'לא'}
										<div class="flex items-center gap-2">
											<svg
												class="h-4 w-4 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
												/>
											</svg>
											<span>{business.deliveries}</span>
										</div>
									{/if}

									{#if business.phone}
										<div class="flex items-center gap-2">
											<svg
												class="h-4 w-4 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
												/>
											</svg>
											<span class="font-medium">
												{business.phone}
											</span>
										</div>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>

				<!-- New Businesses Section -->
				<div class="mt-20">
					<div class="mb-10 flex flex-col items-center justify-center">
						<h2
							class="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
						>
							עסקים חדשים שהצטרפו
						</h2>
						<div class="mt-4 flex gap-2">
							<span
								class="inline-flex animate-bounce items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
							>
								חדש באתר!
							</span>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
						{#each newestBusinesses as business (business.id)}
							<a
								href="/business/{business.id}"
								class="group flex flex-col overflow-hidden rounded-xl border-t-4 border-green-500 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
							>
								<!-- Banner Image -->
								{#if business.banner}
									<div class="relative h-48 w-full overflow-hidden bg-gray-100">
										<img
											src={business.banner}
											alt={business.name}
											class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
											loading="lazy"
										/>
										<div
											class="absolute top-2 right-2 rounded-lg bg-green-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm"
										>
											חדש
										</div>
									</div>
								{:else}
									<div class="h-3 bg-gradient-to-r from-green-500 to-blue-500"></div>
								{/if}

								<div class="flex flex-1 flex-col p-6">
									<!-- Header: Name & Category -->
									<div class="mb-4">
										<div class="flex items-start justify-between">
											<h3
												class="text-xl font-bold text-gray-800 transition group-hover:text-green-600"
											>
												{business.name}
											</h3>
										</div>
										<span
											class="mt-1 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
										>
											{business.category}
										</span>
									</div>

									<!-- Discount -->
									{#if business.discount}
										<div class="mb-4 rounded-lg border border-green-100 bg-green-50 p-3">
											<div class="flex items-center gap-2 text-green-700">
												<svg
													class="h-5 w-5 flex-shrink-0"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
													/>
												</svg>
												<span class="text-sm font-bold">הטבה לחברים:</span>
											</div>
											<p class="mt-1 text-sm text-green-800">{business.discount}</p>
										</div>
									{/if}

									<!-- Info Grid -->
									<div class="mt-auto space-y-2 border-t pt-4 text-sm text-gray-600">
										{#if business.address}
											<div class="flex items-start gap-2">
												<svg
													class="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
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
												<span>{business.address}</span>
											</div>
										{/if}
									</div>
								</div></a
							>
						{/each}
					</div>
				</div>
				<!-- All Businesses Section -->
				<div class="mt-20">
					<div class="mb-10 flex flex-col items-center justify-center">
						<h2
							class="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl lg:text-5xl"
						>
							כלל העסקים העובדים איתנו
						</h2>
						<div
							class="mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
						></div>
					</div>

					<div class="flex flex-wrap justify-center gap-8 px-4">
						{#each filteredBusinesses as business (business.id)}
							<a
								href="/business/{business.id}"
								class="group relative flex h-32 w-32 items-center justify-center rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
								title={business.name}
							>
								{#if business.logo}
									<img
										src={getDirectImageUrl(business.logo)}
										alt={business.name}
										class="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-110"
										loading="lazy"
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
			<div class="sticky top-28 space-y-6">
				<!-- Banner Area -->
				<div
					class="flex h-48 flex-col items-center justify-center rounded-2xl border border-yellow-300 bg-gradient-to-br from-yellow-100 to-yellow-200 p-6 text-center shadow-sm"
				>
					<span class="text-sm font-bold text-yellow-800">באנר פרסומי</span>
					<p class="mt-2 text-xs text-yellow-700">כאן יכול להופיע הבאנר שלכם</p>
				</div>

				<!-- Advertisements -->
				<div class="space-y-4">
					<h3 class="border-b pb-2 text-lg font-bold text-gray-800">פרסומות</h3>
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
							<h4 class="text-sm font-bold">הטבה מיוחדת</h4>
							<p class="mt-1 text-xs text-gray-500">גלו את המבצעים החדשים שלנו לקהילה</p>
						</div>

						<div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
							<div class="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-gray-200">
								<span class="text-xs font-medium text-gray-400">פרסומת נוספת</span>
							</div>
							<h4 class="text-sm font-bold">עולם חדש בבניה</h4>
							<p class="mt-1 text-xs text-gray-500">הצטרפו למהפכה הכלכלית שלנו</p>
						</div>
					</div>
				</div>

				<!-- Action Call -->
				<div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
					<p class="text-xs font-medium text-blue-800">רוצים לפרסם כאן?</p>
					<a
						href="mailto:support@melecshop.com"
						class="mt-2 block text-xs font-bold text-blue-600 hover:underline">צרו קשר</a
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
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.animate-gold-shimmer {
		animation: gold-shimmer 2s ease-in-out 1 forwards;
	}

	@keyframes gold-shimmer {
		0%,
		100% {
			transform: scale(1) rotate(0deg);
			filter: brightness(1);
		}
		50% {
			transform: scale(1.15) rotate(5deg);
			filter: brightness(1.3) drop-shadow(0 0 15px rgba(184, 134, 11, 0.6));
		}
	}
</style>
