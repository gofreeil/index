<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { lang, translations } from '$lib/i18n';
	import { authUser } from '$lib/auth';

	/** @type {{ data: any }} */
	let { data } = $props();
	const business = $derived(data.business);

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const PLACEHOLDER_IMG =
		'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGNsYXNzPSJoLTYgdy02IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Q0EzQUYiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xOSAyMVY1YTIgMiAwIDAwLTItMkg3YTIgMiAwIDAwLTIgMnYxNm0xNCAwaDJtLTIgMGgtNW0tOSAweDNtMiAwaDVNOSA3aDFtLTEgNGgxbTQtNGgxbS0xIDRoMW0tNSAxMHYtNWExIDEgMCAwMTEtMWgyYTEgMSAwIDAxMSAxdjVtLTQgMGg0IiAvPjwvc3ZnPg==';

	// המרת קישור יוטיוב ל-embed. בלי fallback קבוע — עסק בלי סרטון פשוט לא מציג וידאו.
	/** @param {string} url */
	function youtubeEmbed(url) {
		if (!url) return '';
		const patterns = [
			/(?:youtube\.com\/watch\?v=)([^&]+)/,
			/(?:youtu\.be\/)([^?]+)/,
			/(?:youtube\.com\/embed\/)([^?]+)/
		];
		for (const p of patterns) {
			const m = url.match(p);
			if (m) return `https://www.youtube.com/embed/${m[1]}`;
		}
		return '';
	}
	const ytEmbed = $derived(youtubeEmbed(business.youtube));

	let currentImageIndex = $state(0);
	/** @type {any} */
	let interval;

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

		if (business.banners.length > 1) {
			interval = setInterval(() => {
				currentImageIndex = (currentImageIndex + 1) % business.banners.length;
			}, 5000);
		}
		return () => clearInterval(interval);
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

	async function submitReview() {
		if (!user) return;
		reviewError = '';
		try {
			const res = await fetch('/api/reviews', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: business.documentId,
					businessSlug: business.slug,
					rating: newReview.rating,
					comment: newReview.comment,
					authorName: user.name
				})
			});
			const result = await res.json();
			if (result.success) {
				reviewSubmitted = true;
				showReviewForm = false;
				newReview = { rating: 5, comment: '' };
			} else {
				reviewError = result.error || 'שגיאה בשליחת חוות הדעת';
			}
		} catch (e) {
			reviewError = 'שגיאה בשליחת חוות הדעת';
		}
	}
</script>

<svelte:head>
	<title>{business.name} - {t.title}</title>
	<meta name="description" content={business.description || t.subtitle} />
	<meta property="og:title" content="{business.name} - {t.title}" />
	<meta property="og:description" content={business.description || t.subtitle} />
	{#if business.logo}<meta property="og:image" content={business.logo} />{/if}
	<meta property="og:type" content="business.business" />
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
	<a href="/" class="mb-6 inline-flex items-center gap-1 text-sm text-blue-400 hover:underline"
		>→ {t.backToDirectory}</a
	>

	<!-- Top: Logo & Basic Info -->
	<div class="mb-12 flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
		<div class="flex-1 text-right">
			<h1 class="mb-2 text-4xl font-extrabold text-gray-100 md:text-5xl">{business.name}</h1>
			<div class="mb-4 flex items-center justify-end gap-2">
				{#if ratingCount > 0}
					<div class="flex items-center gap-2" role="img" aria-label="{avgRating} מתוך 5">
						<span class="text-xl font-bold text-yellow-500">{avgRating}</span>
						<div class="flex gap-0.5" dir="ltr" aria-hidden="true">
							{#each Array(5) as _, i}
								<span
									class="text-xl {i < Math.round(avgRating)
										? 'text-yellow-400'
										: 'text-gray-600'}">★</span
								>
							{/each}
						</div>
						<span class="text-sm text-gray-400">({ratingCount} {t.reviews})</span>
					</div>
				{:else}
					<span class="text-sm text-gray-400">{t.noReviews}</span>
				{/if}
			</div>

			<div class="mt-6 flex flex-wrap justify-end gap-4">
				{#if business.phone}
					{#if isPhoneRevealed}
						<a
							href="tel:{business.phone}"
							class="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 font-bold text-white transition hover:bg-blue-700"
						>
							<span dir="ltr">{business.phone}</span>
						</a>
					{:else}
						<button
							onclick={revealPhoneAndLog}
							class="flex items-center gap-2 rounded-full border border-blue-500 px-6 py-2 font-bold text-blue-400 transition hover:bg-blue-600 hover:text-white"
						>
							<span>{t.revealPhone}</span>
						</button>
					{/if}
				{/if}
				{#if business.website}
					<a
						href={business.website}
						target="_blank"
						rel="noopener"
						class="flex items-center gap-2 rounded-full bg-blue-700 px-6 py-2 font-bold text-white shadow-lg transition hover:bg-blue-800"
					>
						<span>{t.businessSite}</span>
					</a>
				{/if}
			</div>
		</div>

		<div
			class="order-first h-40 w-40 overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl md:order-last md:h-56 md:w-56"
		>
			{#if business.logo}
				<img
					src={business.logo}
					alt="לוגו {business.name}"
					class="h-full w-full object-contain"
					onerror={(e) => {
						const img = /** @type {HTMLImageElement} */ (e.target);
						img.src = PLACEHOLDER_IMG;
					}}
				/>
			{:else}
				<div class="flex h-full w-full items-center justify-center text-gray-500">
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

	<div class="grid grid-cols-1 gap-12 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<!-- Gallery -->
			{#if business.banners.length > 0}
				<div class="relative mb-12 h-64 overflow-hidden rounded-3xl shadow-2xl md:h-[400px]">
					{#each business.banners as banner, i}
						{#if i === currentImageIndex}
							<img
								in:fade={{ duration: 500 }}
								out:fade={{ duration: 500 }}
								src={banner}
								alt="{business.name} {i + 1}"
								class="absolute inset-0 h-full w-full object-cover"
							/>
						{/if}
					{/each}
					{#if business.banners.length > 1}
						<div class="absolute right-0 bottom-4 left-0 flex justify-center gap-2">
							{#each business.banners as _, i}
								<button
									onclick={() => (currentImageIndex = i)}
									aria-label="תמונה {i + 1}"
									class="h-2 rounded-full transition-all {i === currentImageIndex
										? 'w-6 bg-white'
										: 'w-2 bg-white/50'}"
								></button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Description -->
			<section class="mb-12">
				<h2 class="mb-4 text-2xl font-bold text-gray-100">{t.aboutBusiness}</h2>
				<div
					class="rounded-2xl border border-blue-900/20 bg-blue-900/10 p-8 text-lg leading-relaxed text-gray-300"
				>
					{business.description || t.noDescription}
				</div>
			</section>

			<!-- Reviews -->
			<section>
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-2xl font-bold text-gray-100">{t.reviews}</h2>
					<button
						onclick={() => (showReviewForm = !showReviewForm)}
						class="text-sm font-bold text-blue-400 hover:underline"
					>
						{showReviewForm ? t.cancel : t.addReview}
					</button>
				</div>

				{#if reviewSubmitted}
					<div
						class="mb-8 rounded-2xl border border-green-500/30 bg-green-900/20 p-6 text-center text-green-300"
					>
						תודה! חוות הדעת נשלחה ותפורסם לאחר אישור.
					</div>
				{/if}

				{#if showReviewForm}
					<div in:fly={{ y: 20 }} class="mb-8 rounded-2xl border border-gray-700 bg-gray-800 p-6">
						{#if !user}
							<div class="text-center">
								<p class="mb-4 text-gray-400">{t.loginToReview}</p>
								<div class="flex justify-center gap-4">
									<a
										href="/auth/login"
										class="rounded-full bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700"
										>{t.login}</a
									>
									<a
										href="/auth/register"
										class="rounded-full border border-blue-500 px-6 py-2 font-bold text-blue-400 hover:bg-blue-600 hover:text-white"
										>{t.register}</a
									>
								</div>
							</div>
						{:else}
							<h3 class="mb-4 font-bold text-gray-100">{t.whatDoYouThink}</h3>
							<div class="space-y-4">
								<div class="flex items-center gap-2">
									<span class="text-sm text-gray-400">{t.fullName}:</span>
									<span class="font-bold text-gray-100">{user.name}</span>
								</div>
								<select
									bind:value={newReview.rating}
									class="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-white"
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
									class="h-32 w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-white"
								></textarea>
								{#if reviewError}<p class="text-sm text-red-400">{reviewError}</p>{/if}
								<button
									onclick={submitReview}
									class="rounded-full bg-blue-700 px-6 py-2 font-bold text-white hover:bg-blue-800"
									>{t.submitReview}</button
								>
							</div>
						{/if}
					</div>
				{/if}

				<div class="space-y-6">
					{#if reviews.length === 0}
						<div class="rounded-2xl border border-dashed border-gray-700 p-12 text-center">
							<p class="text-lg font-medium text-gray-400">{t.noReviews}</p>
						</div>
					{:else}
						{#each reviews as review}
							<div class="rounded-2xl border border-gray-700 bg-gray-800 p-6">
								<div class="mb-2 flex items-center justify-between">
									<span class="font-bold text-gray-100">{review.author_name}</span>
									<span class="text-sm text-gray-500">{review.date}</span>
								</div>
								<div class="mb-3 flex gap-0.5" dir="ltr">
									{#each Array(5) as _, i}
										<span class="text-xl {i < Math.round(review.rating) ? 'text-yellow-400' : 'text-gray-600'}"
											>★</span
										>
									{/each}
								</div>
								{#if review.title}<p class="mb-1 font-semibold text-gray-200">{review.title}</p>{/if}
								<p class="text-gray-300">{review.body}</p>
							</div>
						{/each}
					{/if}
				</div>
			</section>

			<!-- Video (רק אם קיים) -->
			{#if ytEmbed}
				<section class="mt-12">
					<h2 class="mb-4 text-2xl font-bold text-gray-100">{t.businessVideo}</h2>
					<div class="relative w-full overflow-hidden rounded-3xl shadow-2xl" style="padding-top: 56.25%;">
						<iframe
							src={ytEmbed}
							title={business.name}
							class="absolute inset-0 h-full w-full border-0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowfullscreen
						></iframe>
					</div>
				</section>
			{/if}
		</div>

		<!-- Right: Info & Map -->
		<div class="space-y-8">
			<div class="rounded-3xl border border-gray-700 bg-gray-800 p-8 shadow-xl">
				<h3 class="mb-6 text-xl font-bold text-gray-100">{t.contactInfo}</h3>
				<div class="space-y-6">
					{#if business.address}
						<div>
							<p class="font-bold text-gray-200">כתובת</p>
							<p class="text-gray-400">{business.address}</p>
						</div>
					{/if}
					{#if business.discount}
						<div>
							<p class="font-bold text-green-400">{t.exclusiveBenefit}</p>
							<p class="text-green-300">{business.discount}</p>
						</div>
					{/if}
					{#if business.sales_area}
						<div>
							<p class="font-bold text-gray-200">{t.serviceBorders}</p>
							<p class="text-gray-400">{business.sales_area}</p>
						</div>
					{/if}
				</div>
			</div>

			{#if business.address}
				<div class="overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 shadow-xl">
					<div class="bg-gray-900/50 p-6">
						<h3 class="text-xl font-bold text-gray-100">{t.serviceZones}</h3>
					</div>
					<div class="p-4">
						<div class="h-64 w-full overflow-hidden rounded-2xl border border-gray-700 md:h-80">
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
					</div>
				</div>
			{/if}
		</div>
	</div>
</main>
