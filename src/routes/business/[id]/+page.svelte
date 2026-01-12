<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import IsraelMap from '$lib/components/IsraelMap.svelte';
	import { lang, translations } from '$lib/i18n';

	/** @type {{ data: any }} */
	let { data } = $props();
	const business = $derived(data.business);

	// Support for Svelte 5 state-like behavior from store
	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const PLACEHOLDER_IMG =
		'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGNsYXNzPSJoLTYgdy02IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Q0EzQUYiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xOSAyMVY1YTIgMiAwIDAwLTItMkg3YTIgMiAwIDAwLTIgMnYxNm0xNCAwaDJtLTIgMGgtNW0tOSAweDNtMiAwaDVNOSA3aDFtLTEgNGgxbTQtNGgxbS0xIDRoMW0tNSAxMHYtNWExIDEgMCAwMTEtMWgyYTEgMSAwIDAxMSAxdjVtLTQgMGg0IiAvPjwvc3ZnPg==';

	let currentImageIndex = $state(0);
	/** @type {any} */
	let interval;
	let showReviewForm = $state(false);
	let newReview = $state({ rating: 5, comment: '', user: '' });

	onMount(() => {
		if (business.banners.length > 1) {
			interval = setInterval(() => {
				currentImageIndex = (currentImageIndex + 1) % business.banners.length;
			}, 5000);
		}
		return () => clearInterval(interval);
	});

	// דאטה פיקטיבי לחוות דעת (מכיוון שאין עדיין במערכת)
	const reviews = [
		{
			id: 1,
			user: 'ישראל ישראלי',
			rating: 5,
			comment: 'שירות מעולה! הגעתי דרך האתר וקיבלתי יחס חם והנחה משמעותית.',
			date: '2023-12-15'
		},
		{
			id: 2,
			user: 'מיכל כהן',
			rating: 4,
			comment: 'איכות מצוינת. המשלוח הגיע בזמן.',
			date: '2023-11-20'
		}
	];

	const averageRating = 4.5;

	let isPhoneRevealed = $state(false);

	async function revealPhoneAndLog() {
		if (isPhoneRevealed) return;

		isPhoneRevealed = true;

		try {
			await fetch('/api/stats', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: business.id,
					businessName: business.name,
					action: 'phone_click'
				})
			});
		} catch (e) {
			console.error('Failed to log click:', e);
		}
	}

	// פונקציית עזר לציור כוכבים

	function submitReview() {
		// כאן היינו שולחים לשרת, בינתיים רק נסגור
		alert('תודה על חוות הדעת! היא תפורסם לאחר אישור.');
		showReviewForm = false;
		newReview = { rating: 5, comment: '', user: '' };
	}
</script>

<svelte:head>
	<title>{business.name} - {t.title}</title>
	<meta name="description" content={business.description || t.subtitle} />

	<!-- Open Graph -->
	<meta property="og:title" content="{business.name} - {t.title}" />
	<meta property="og:description" content={business.description || t.subtitle} />
	{#if business.logo}
		<meta property="og:image" content={business.logo} />
	{/if}
	<meta property="og:type" content="business.business" />

	<!-- Twitter -->
	<meta name="twitter:title" content="{business.name} - {t.title}" />
	<meta name="twitter:description" content={business.description || t.subtitle} />
	{#if business.logo}
		<meta name="twitter:image" content={business.logo} />
	{/if}
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
	<!-- Top Section: Logo & Basic Info -->
	<div class="mb-12 flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
		<div class="flex-1 text-right">
			<h1 class="mb-2 text-4xl font-extrabold text-gray-900 md:text-5xl dark:text-gray-100">
				{business.name}
			</h1>
			<div class="mb-4 flex items-center justify-end gap-2">
				<span class="text-xl font-bold text-yellow-500">{averageRating}</span>
				<div class="flex gap-0.5" dir="ltr">
					{#each Array(5) as _, i}
						<span
							class="text-xl {i < Math.floor(averageRating)
								? 'bg-gradient-to-br from-[#3d2b1f] via-[#FCF6BA] to-[#3d2b1f] bg-clip-text text-transparent drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] filter'
								: 'text-gray-300 dark:text-gray-600'}"
						>
							★
						</span>
					{/each}
				</div>
				<span class="text-sm text-gray-500 dark:text-gray-400">({reviews.length} {t.reviews})</span>
			</div>
			<p class="text-xl text-gray-600 dark:text-gray-400">{business.category}</p>

			<div class="mt-6 flex flex-wrap justify-end gap-4">
				{#if business.phone}
					{#if isPhoneRevealed}
						<a
							href="tel:{business.phone}"
							class="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 font-bold text-white transition hover:bg-blue-700"
						>
							<span>{business.phone}</span>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
								/>
							</svg>
						</a>
					{:else}
						<button
							onclick={revealPhoneAndLog}
							class="flex items-center gap-2 rounded-full border border-blue-600 px-6 py-2 font-bold text-blue-600 transition hover:bg-blue-600 hover:text-white dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
						>
							<span>{t.revealPhone}</span>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
								/>
							</svg>
						</button>
					{/if}
				{/if}
				{#if business.website}
					<a
						href={business.website}
						target="_blank"
						class="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 font-bold text-white shadow-lg transition hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
					>
						<span>{t.businessSite}</span>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
					</a>
				{/if}
			</div>
		</div>

		<!-- Logo on the right -->
		<div
			class="order-first h-40 w-40 overflow-hidden rounded-2xl bg-white p-4 shadow-xl md:order-last md:h-56 md:w-56 dark:border dark:border-gray-700 dark:bg-gray-800"
		>
			{#if business.logo}
				<img
					src={business.logo}
					alt="לוגו {business.name}"
					class="h-full w-full object-contain"
					onerror={(e) => {
						const img = /** @type {HTMLImageElement} */ (e.target);
						if (business.fallbackLogo && img.src !== business.fallbackLogo) {
							img.src = business.fallbackLogo;
						} else {
							img.src = PLACEHOLDER_IMG;
							img.style.padding = '20px';
							img.style.backgroundColor = '#f3f4f6';
							img.style.objectFit = 'contain';
						}
					}}
				/>
			{:else}
				<div
					class="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
				>
					<svg class="h-20 w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
						/>
					</svg>
				</div>
			{/if}
		</div>
	</div>

	<!-- Gallery & Details Grid -->
	<div class="grid grid-cols-1 gap-12 lg:grid-cols-3">
		<!-- Left: Gallery and Reviews -->
		<div class="lg:col-span-2">
			<!-- Gallery -->
			{#if business.banners.length > 0}
				<div
					class="relative mb-12 h-64 overflow-hidden rounded-3xl shadow-2xl md:h-[400px] dark:border dark:border-gray-800 dark:shadow-none"
				>
					{#each business.banners as banner, i}
						{#if i === currentImageIndex}
							<img
								in:fade={{ duration: 500 }}
								out:fade={{ duration: 500 }}
								src={banner}
								alt="{business.name} banner {i}"
								class="absolute inset-0 h-full w-full object-cover"
							/>
						{/if}
					{/each}

					<!-- Gallery Controls -->
					{#if business.banners.length > 1}
						<div class="absolute right-0 bottom-4 left-0 flex justify-center gap-2">
							{#each business.banners as _, i}
								<button
									onclick={() => (currentImageIndex = i)}
									aria-label="תמונה {i + 1}"
									class="h-2 w-2 rounded-full transition-all {i === currentImageIndex
										? 'w-6 bg-white'
										: 'bg-white/50'}"
								></button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Description -->
			<section class="mb-12">
				<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">{t.aboutBusiness}</h2>
				<div
					class="rounded-2xl border border-blue-50 bg-blue-50/30 p-8 text-lg leading-relaxed text-gray-700 dark:border-blue-900/20 dark:bg-blue-900/10 dark:text-gray-300"
				>
					{business.description || t.noDescription}
				</div>
			</section>

			<!-- Reviews Section -->
			<section>
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">{t.reviews}</h2>
					<button
						onclick={() => (showReviewForm = !showReviewForm)}
						class="text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
					>
						{showReviewForm ? t.cancel : t.addReview}
					</button>
				</div>

				{#if showReviewForm}
					<div
						in:fly={{ y: 20 }}
						class="mb-8 rounded-2xl bg-gray-50 p-6 shadow-inner dark:border dark:border-gray-700 dark:bg-gray-800"
					>
						<h3 class="mb-4 font-bold text-gray-800 dark:text-gray-100">{t.whatDoYouThink}</h3>
						<div class="space-y-4">
							<input
								type="text"
								bind:value={newReview.user}
								placeholder={t.yourNamePlaceholder}
								class="w-full rounded-lg border border-gray-200 p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							/>
							<select
								bind:value={newReview.rating}
								class="w-full rounded-lg border border-gray-200 p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							>
								<option value={5}>5 ★ - Excellent</option>
								<option value={4}>4 ★ - Good</option>
								<option value={3}>3 ★ - Okay</option>
								<option value={2}>2 ★ - Needs improvement</option>
								<option value={1}>1 ★ - Bad</option>
							</select>
							<textarea
								bind:value={newReview.comment}
								placeholder={t.reviewPlaceholder}
								class="h-32 w-full rounded-lg border border-gray-200 p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							></textarea>
							<button
								onclick={submitReview}
								class="rounded-full bg-blue-600 px-6 py-2 font-bold text-white transition hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
							>
								{t.submitReview}
							</button>
						</div>
					</div>
				{/if}

				<div class="space-y-6">
					{#each reviews as review}
						<div
							class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
						>
							<div class="mb-2 flex items-center justify-between">
								<span class="font-bold text-gray-800 dark:text-gray-100">{review.user}</span>
								<span class="text-sm text-gray-400 dark:text-gray-500">{review.date}</span>
							</div>
							<div class="mb-3 flex gap-0.5" dir="ltr">
								{#each Array(5) as _, i}
									<span
										class="text-xl {i < Math.floor(review.rating)
											? 'bg-gradient-to-br from-[#3d2b1f] via-[#FCF6BA] to-[#3d2b1f] bg-clip-text text-transparent drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] filter'
											: 'text-gray-300 dark:text-gray-600'}"
									>
										★
									</span>
								{/each}
							</div>
							<p class="text-gray-600 dark:text-gray-300">{review.comment}</p>
						</div>
					{/each}
				</div>
			</section>

			<!-- Video Section -->
			{#if business.youtube}
				<section class="mt-12">
					<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
						{t.businessVideo}
					</h2>
					<div
						class="relative w-full overflow-hidden rounded-3xl shadow-2xl"
						style="padding-top: 56.25%;"
					>
						<iframe
							src={business.youtube}
							title={business.name}
							class="absolute inset-0 h-full w-full border-0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowfullscreen
						></iframe>
					</div>
				</section>
			{/if}
		</div>

		<!-- Right: Map and Info -->
		<div class="space-y-8">
			<!-- Info Card -->
			<div
				class="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800"
			>
				<h3 class="mb-6 text-xl font-bold text-gray-800 dark:text-gray-100">{t.contactInfo}</h3>

				<div class="space-y-6">
					{#if business.address}
						<div class="flex items-start gap-4">
							<div
								class="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
							>
								<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							</div>
							<div>
								<p class="font-bold text-gray-800 dark:text-gray-200">כתובת</p>
								<p class="text-gray-600 dark:text-gray-400">{business.address}</p>
							</div>
						</div>
					{/if}

					{#if business.discount}
						<div class="flex items-start gap-4">
							<div
								class="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
							>
								<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
									/>
								</svg>
							</div>
							<div>
								<p class="font-bold text-green-700 dark:text-green-400">{t.exclusiveBenefit}</p>
								<p class="text-green-800 dark:text-green-300">{business.discount}</p>
							</div>
						</div>
					{/if}

					{#if business.deliveries}
						<div class="flex items-start gap-4">
							<div
								class="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
							>
								<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
									/>
								</svg>
							</div>
							<div>
								<p class="font-bold text-gray-800 dark:text-gray-200">{t.deliveries}</p>
								<p class="text-gray-600 dark:text-gray-400">{business.deliveries}</p>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Map & Territory Section -->
			<div
				class="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="bg-gray-50 p-6 dark:bg-gray-900/50">
					<h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">{t.serviceZones}</h3>
					{#if business.address}
						<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
							<strong>{t.businessLocationLabel}</strong>
							{business.address}
						</p>
					{/if}
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						<strong>{t.serviceBorders}</strong>
						{business.salesArea || t.all}
					</p>
				</div>

				<div class="space-y-6 p-8 sm:p-6">
					<!-- Google Maps Embed for Address -->
					{#if business.address}
						<div
							class="h-64 w-full overflow-hidden rounded-2xl border border-gray-200 shadow-inner md:h-80 dark:border-gray-700"
						>
							<iframe
								title="מפה של {business.name}"
								width="100%"
								height="100%"
								style="border:0"
								loading="lazy"
								allowfullscreen
								referrerpolicy="no-referrer-when-downgrade"
								src="https://maps.google.com/maps?q={encodeURIComponent(
									business.address
								)}&t=&z=14&ie=UTF8&iwloc=&output=embed"
							></iframe>
						</div>
					{/if}

					<!-- Territory Map (IsraelMap) -->
					<div
						class="relative rounded-2xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30"
					>
						<div class="absolute top-4 right-4 z-10">
							<span
								class="rounded-lg border border-gray-100 bg-white/90 px-3 py-1 text-xs font-bold text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
							>
								{t.serviceMap}
							</span>
						</div>
						<IsraelMap salesArea={business.salesArea} address={business.address} />
					</div>
				</div>
			</div>
		</div>
	</div>
</main>

<style>
	:global(body) {
		background-color: #f8fafc;
	}
</style>
