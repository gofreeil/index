<script>
	import { lang, translations } from '$lib/i18n';
	import { onMount } from 'svelte';

	let { business } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	let isFavorite = $state(false);

	onMount(() => {
		const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
		isFavorite = favorites.includes(business.id);
	});

	/** @param {MouseEvent} e */
	function toggleFavorite(e) {
		e.preventDefault();
		const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
		if (isFavorite) {
			const index = favorites.indexOf(business.id);
			if (index > -1) favorites.splice(index, 1);
		} else {
			favorites.push(business.id);
		}
		localStorage.setItem('favorites', JSON.stringify(favorites));
		isFavorite = !isFavorite;
	}

	let failedImage = $state(false);
</script>

<a
	href="/business/{business.id}"
	class="group flex w-[calc(50%-8px)] flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:w-auto sm:rounded-xl sm:shadow-md sm:hover:shadow-xl"
>
	<div class="relative h-28 w-full overflow-hidden bg-gray-700 sm:h-48">
		<button
			onclick={toggleFavorite}
			class="absolute top-2 left-2 z-30 rounded-full bg-gray-800/80 p-1.5 shadow-sm transition hover:bg-gray-800"
			aria-label={isFavorite ? t.removeFromFavorites : t.saveToFavorites}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4 {isFavorite ? 'fill-red-500 stroke-red-500' : 'stroke-gray-400'}"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path
					d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
				></path>
			</svg>
		</button>

		{#if business.logo && !failedImage}
			<img
				src={business.logo}
				alt={business.name}
				class="absolute inset-0 z-10 h-full w-full object-contain p-2 transition duration-500 group-hover:scale-105"
				loading="lazy"
				onerror={() => {
					if (business.fallbackLogo) {
						business.logo = business.fallbackLogo;
					} else {
						failedImage = true;
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
			<div class="h-full w-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-20"></div>
		{/if}
	</div>

	<div class="flex flex-1 flex-col p-3 sm:p-6">
		<div class="mb-2 sm:mb-4">
			<h3
				class="line-clamp-1 text-xs font-bold text-gray-100 transition group-hover:text-blue-400 sm:text-xl"
			>
				{business.name}
			</h3>
			<span
				class="mt-1 inline-block rounded-full bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-400 sm:px-3 sm:py-1 sm:text-xs"
			>
				{business.category}
			</span>
		</div>

		{#if business.discount}
			<div
				class="mb-2 rounded border border-green-800/30 bg-green-900/20 p-1.5 sm:mb-4 sm:rounded-lg sm:p-3"
			>
				<p class="line-clamp-2 text-[10px] leading-tight text-green-400 sm:text-sm">
					{business.discount}
				</p>
			</div>
		{/if}

		<div
			class="mt-auto border-t border-gray-700 pt-2 text-[10px] text-gray-400 sm:space-y-2 sm:pt-4 sm:text-sm"
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
