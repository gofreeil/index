<script>
	import { lang, translations } from '$lib/i18n';
	import { favorites, toggleFavorite as toggleFav } from '$lib/favorites.js';
	import { imgUrl, imgSrcSet, imgFallback } from '$lib/img.js';

	let { business } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const isFavorite = $derived($favorites.includes(business.id));

	/** @param {MouseEvent} e */
	function toggleFavorite(e) {
		e.preventDefault();
		toggleFav(business.id);
	}

	/* הלוגו והבאנר מוגשים דרך ממטב התמונות ($lib/img.js): המקור הוא לרוב קובץ
	   של מגה-בייטים, והמשבצת כאן היא ~160px. כפול תשעים כרטיסיות זה ההבדל
	   בין דף שנפתח לדף שנטען.
	   הלוגו נכשל בשני שלבים: כישלון ראשון = הממטב לא זמין ⇒ ניסיון בכתובת
	   המקורית; כישלון שני = אין לוגו ⇒ מונוגרם. */
	let failedImage = $state(false);
	let rawLogo = $state(false);
	const logoSrc = $derived(rawLogo ? business.logo : imgUrl(business.logo, 384));

	function onLogoError() {
		if (!rawLogo && logoSrc !== business.logo) rawLogo = true;
		else failedImage = true;
	}
</script>

<div
	class="group relative flex w-[calc(50%-8px)] flex-col overflow-hidden rounded-xl border border-blue-800/60 bg-blue-950 transition-colors duration-200 hover:border-blue-500 sm:w-auto"
>
	<button
		onclick={toggleFavorite}
		class="absolute top-2 left-2 z-30 rounded-full bg-black/30 p-1.5 backdrop-blur-sm transition hover:bg-black/60"
		aria-label={isFavorite ? t.removeFromFavorites : t.saveToFavorites}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4 {isFavorite ? 'fill-red-500 stroke-red-500' : 'stroke-gray-300'}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path
				d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
			></path>
		</svg>
	</button>

	<a href="/business/{business.id}" class="flex flex-1 flex-col">
		<!-- אזור המדיה: משטח שטוח בלי גרדיאנט צבעוני. כשאין לוגו — מונוגרם
		     שקט במקום ריבוע ריק. -->
		<div class="relative h-24 w-full overflow-hidden bg-black/25 sm:h-40">
			{#if business.banner}
				<img
					src={imgUrl(business.banner, 256)}
					srcset={imgSrcSet(business.banner, [128, 256])}
					sizes="(min-width: 640px) 20rem, 50vw"
					alt=""
					aria-hidden="true"
					class="absolute inset-0 h-full w-full object-cover opacity-25"
					loading="lazy"
					decoding="async"
					use:imgFallback={business.banner}
				/>
			{/if}
			{#if business.logo && !failedImage}
				<img
					src={logoSrc}
					srcset={rawLogo ? undefined : imgSrcSet(business.logo, [128, 256, 384])}
					sizes="(min-width: 640px) 20rem, 50vw"
					alt={business.name}
					class="absolute inset-0 z-10 h-full w-full object-contain p-3 sm:p-4"
					loading="lazy"
					decoding="async"
					onerror={onLogoError}
				/>
			{:else}
				<span
					class="absolute inset-0 z-10 flex items-center justify-center text-2xl font-bold text-blue-300/40 sm:text-4xl"
					aria-hidden="true"
				>
					{(business.name || '').trim().charAt(0)}
				</span>
			{/if}
		</div>

		<div class="flex flex-1 flex-col p-3 sm:p-4">
			<h3
				class="line-clamp-1 text-xs font-semibold text-gray-100 transition-colors group-hover:text-white sm:text-base"
			>
				{business.name}
			</h3>
			<p class="mt-0.5 line-clamp-1 text-[10px] text-gray-400 sm:text-xs">
				{business.category}
			</p>

			{#if business.discount}
				<p class="mt-2 line-clamp-2 text-[10px] leading-tight text-emerald-400 sm:text-xs">
					{business.discount}
				</p>
			{/if}

			<div
				class="mt-auto flex items-center gap-1.5 pt-2 text-[10px] text-gray-400 sm:pt-3 sm:text-xs"
			>
				<svg
					class="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
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
	</a>
</div>
