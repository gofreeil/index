<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import IsraelMap from '$lib/components/IsraelMap.svelte';

	/** @type {{ data: any }} */
	let { data } = $props();
	const business = $derived(data.business);

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

	// פונקציית עזר לציור כוכבים
	/** @param {number} rating */
	const renderStars = (rating) => {
		return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
	};

	function submitReview() {
		// כאן היינו שולחים לשרת, בינתיים רק נסגור
		alert('תודה על חוות הדעת! היא תפורסם לאחר אישור.');
		showReviewForm = false;
		newReview = { rating: 5, comment: '', user: '' };
	}
</script>

<svelte:head>
	<title>{business.name} - יוצאים לחירות</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
	<!-- Top Section: Logo & Basic Info -->
	<div class="mb-12 flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
		<div class="flex-1 text-right">
			<h1 class="mb-2 text-4xl font-extrabold text-gray-900 md:text-5xl">{business.name}</h1>
			<div class="mb-4 flex items-center justify-end gap-2">
				<span class="text-xl font-bold text-yellow-500">{averageRating}</span>
				<span class="text-xl text-yellow-400">{renderStars(averageRating)}</span>
				<span class="text-sm text-gray-500">({reviews.length} חוות דעת)</span>
			</div>
			<p class="text-xl text-gray-600">{business.category}</p>

			<div class="mt-6 flex flex-wrap justify-end gap-4">
				{#if business.phone}
					<a
						href="tel:{business.phone}"
						class="flex items-center gap-2 rounded-full border border-blue-600 px-6 py-2 font-bold text-blue-600 transition hover:bg-blue-600 hover:text-white"
					>
						<span>התקשרו עכשיו</span>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
							/>
						</svg>
					</a>
				{/if}
				{#if business.website}
					<a
						href={business.website}
						target="_blank"
						class="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 font-bold text-white shadow-lg transition hover:bg-blue-700"
					>
						<span>לאתר העסק</span>
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
			class="order-first h-40 w-40 overflow-hidden rounded-2xl bg-white p-4 shadow-xl md:order-last md:h-56 md:w-56"
		>
			{#if business.logo}
				<img src={business.logo} alt="לוגו {business.name}" class="h-full w-full object-contain" />
			{:else}
				<div class="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
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
				<div class="relative mb-12 h-64 overflow-hidden rounded-3xl shadow-2xl md:h-[400px]">
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
				<h2 class="mb-4 text-2xl font-bold text-gray-800">על העסק</h2>
				<div
					class="rounded-2xl border border-blue-50 bg-blue-50/30 p-8 text-lg leading-relaxed text-gray-700"
				>
					{business.description || 'אין תיאור זמין לעסק זה.'}
				</div>
			</section>

			<!-- Reviews Section -->
			<section>
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-2xl font-bold text-gray-800">חוות דעת של לקוחות</h2>
					<button
						onclick={() => (showReviewForm = !showReviewForm)}
						class="text-sm font-bold text-blue-600 hover:underline"
					>
						{showReviewForm ? 'ביטול' : 'הוסף חוות דעת'}
					</button>
				</div>

				{#if showReviewForm}
					<div in:fly={{ y: 20 }} class="mb-8 rounded-2xl bg-gray-50 p-6 shadow-inner">
						<h3 class="mb-4 font-bold text-gray-800">מה דעתך על העסק?</h3>
						<div class="space-y-4">
							<input
								type="text"
								bind:value={newReview.user}
								placeholder="השם שלך"
								class="w-full rounded-lg border border-gray-200 p-2"
							/>
							<select
								bind:value={newReview.rating}
								class="w-full rounded-lg border border-gray-200 p-2"
							>
								<option value={5}>5 כוכבים - מעולה</option>
								<option value={4}>4 כוכבים - טוב מאוד</option>
								<option value={3}>3 כוכבים - בסדר</option>
								<option value={2}>2 כוכבים - טעון שיפור</option>
								<option value={1}>1 כוכב - גרוע</option>
							</select>
							<textarea
								bind:value={newReview.comment}
								placeholder="כתוב כאן את חוות הדעת שלך..."
								class="h-32 w-full rounded-lg border border-gray-200 p-2"
							></textarea>
							<button
								onclick={submitReview}
								class="rounded-full bg-blue-600 px-6 py-2 font-bold text-white transition hover:bg-blue-700"
							>
								שלח חוות דעת
							</button>
						</div>
					</div>
				{/if}

				<div class="space-y-6">
					{#each reviews as review}
						<div class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
							<div class="mb-2 flex items-center justify-between">
								<span class="font-bold text-gray-800">{review.user}</span>
								<span class="text-sm text-gray-400">{review.date}</span>
							</div>
							<div class="mb-3 text-yellow-400">{renderStars(review.rating)}</div>
							<p class="text-gray-600">{review.comment}</p>
						</div>
					{/each}
				</div>
			</section>
		</div>

		<!-- Right: Map and Info -->
		<div class="space-y-8">
			<!-- Info Card -->
			<div class="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
				<h3 class="mb-6 text-xl font-bold text-gray-800">פרטי קשר ומיקום</h3>

				<div class="space-y-6">
					{#if business.address}
						<div class="flex items-start gap-4">
							<div
								class="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"
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
								<p class="font-bold text-gray-800">כתובת</p>
								<p class="text-gray-600">{business.address}</p>
							</div>
						</div>
					{/if}

					{#if business.discount}
						<div class="flex items-start gap-4">
							<div
								class="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600"
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
								<p class="font-bold text-green-700">הטבה בלעדית</p>
								<p class="text-green-800">{business.discount}</p>
							</div>
						</div>
					{/if}

					{#if business.deliveries}
						<div class="flex items-start gap-4">
							<div
								class="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600"
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
								<p class="font-bold text-gray-800">משלוחים</p>
								<p class="text-gray-600">{business.deliveries}</p>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Map & Territory Section -->
			<div class="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
				<div class="bg-gray-50 p-6">
					<h3 class="text-xl font-bold text-gray-800">מיקום ואזורי שירות</h3>
					{#if business.address}
						<p class="mt-1 text-sm text-gray-600">
							<strong>מיקום העסק:</strong>
							{business.address}
						</p>
					{/if}
					<p class="mt-1 text-sm text-gray-600">
						<strong>גבולות שירות:</strong>
						{business.salesArea || 'כל הארץ'}
					</p>
				</div>

				<div class="space-y-4 p-4">
					<!-- Google Maps Embed for Address -->
					{#if business.address}
						<div
							class="h-64 w-full overflow-hidden rounded-2xl border border-gray-200 shadow-inner md:h-80"
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
					<div class="relative rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
						<div class="absolute top-4 right-4 z-10">
							<span
								class="rounded-lg border border-gray-100 bg-white/90 px-3 py-1 text-xs font-bold text-gray-700 shadow-sm"
							>
								מפת אזורי שירות
							</span>
						</div>
						<IsraelMap salesArea={business.salesArea} />
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
