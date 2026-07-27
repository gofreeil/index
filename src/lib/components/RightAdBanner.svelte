<script>
	import { onMount } from 'svelte';
	import { lang, translations } from '$lib/i18n';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	let currentGroup = $state(0);
	let totalSwaps = $state(0);
	const MAX_SWAPS = 8; // 3 מחזורים מלאים של 3 קבוצות (מקורי + 8 החלפות = 9 צעדים)

	/**
	 * @typedef {Object} PlaceholderAd
	 * @property {string} borderColor
	 * @property {string} bgColor
	 * @property {string} hoverBorder
	 * @property {string} hoverBg
	 * @property {string} textColor
	 * @property {string} hoverText
	 * @property {string} buttonColor
	 */

	/** @type {PlaceholderAd[]} */
	const slots = [
		{
			borderColor: 'border-orange-500/30',
			bgColor: 'bg-orange-900/10',
			hoverBorder: 'hover:border-orange-500',
			hoverBg: 'hover:bg-orange-900/20',
			textColor: 'text-orange-400',
			hoverText: 'group-hover:text-orange-200',
			buttonColor: 'bg-orange-600 hover:bg-orange-500'
		},
		{
			borderColor: 'border-blue-500/30',
			bgColor: 'bg-blue-900/10',
			hoverBorder: 'hover:border-blue-500',
			hoverBg: 'hover:bg-blue-900/20',
			textColor: 'text-blue-400',
			hoverText: 'group-hover:text-blue-200',
			buttonColor: 'bg-blue-600 hover:bg-blue-500'
		},
		{
			borderColor: 'border-green-500/30',
			bgColor: 'bg-green-900/10',
			hoverBorder: 'hover:border-green-500',
			hoverBg: 'hover:bg-green-900/20',
			textColor: 'text-green-400',
			hoverText: 'group-hover:text-green-200',
			buttonColor: 'bg-green-600 hover:bg-green-500'
		},
		{
			borderColor: 'border-amber-500/30',
			bgColor: 'bg-amber-900/10',
			hoverBorder: 'hover:border-amber-500',
			hoverBg: 'hover:bg-amber-900/20',
			textColor: 'text-amber-400',
			hoverText: 'group-hover:text-amber-200',
			buttonColor: 'bg-amber-600 hover:bg-amber-500'
		},
		{
			borderColor: 'border-purple-500/30',
			bgColor: 'bg-purple-900/10',
			hoverBorder: 'hover:border-purple-500',
			hoverBg: 'hover:bg-purple-900/20',
			textColor: 'text-purple-400',
			hoverText: 'group-hover:text-purple-200',
			buttonColor: 'bg-purple-600 hover:bg-purple-500'
		},
		{
			borderColor: 'border-red-500/30',
			bgColor: 'bg-red-900/10',
			hoverBorder: 'hover:border-red-500',
			hoverBg: 'hover:bg-red-900/20',
			textColor: 'text-red-400',
			hoverText: 'group-hover:text-red-200',
			buttonColor: 'bg-red-600 hover:bg-red-500'
		},
		{
			borderColor: 'border-indigo-500/30',
			bgColor: 'bg-indigo-900/10',
			hoverBorder: 'hover:border-indigo-500',
			hoverBg: 'hover:bg-indigo-900/20',
			textColor: 'text-indigo-400',
			hoverText: 'group-hover:text-indigo-200',
			buttonColor: 'bg-indigo-600 hover:bg-indigo-500'
		},
		{
			borderColor: 'border-teal-500/30',
			bgColor: 'bg-teal-900/10',
			hoverBorder: 'hover:border-teal-500',
			hoverBg: 'hover:bg-teal-900/20',
			textColor: 'text-teal-400',
			hoverText: 'group-hover:text-teal-200',
			buttonColor: 'bg-teal-600 hover:bg-teal-500'
		},
		{
			borderColor: 'border-pink-500/30',
			bgColor: 'bg-pink-900/10',
			hoverBorder: 'hover:border-pink-500',
			hoverBg: 'hover:bg-pink-900/20',
			textColor: 'text-pink-400',
			hoverText: 'group-hover:text-pink-200',
			buttonColor: 'bg-pink-600 hover:bg-pink-500'
		},
		{
			borderColor: 'border-yellow-500/30',
			bgColor: 'bg-yellow-900/10',
			hoverBorder: 'hover:border-yellow-500',
			hoverBg: 'hover:bg-yellow-900/20',
			textColor: 'text-yellow-400',
			hoverText: 'group-hover:text-yellow-200',
			buttonColor: 'bg-yellow-600 hover:bg-yellow-500'
		},
		{
			borderColor: 'border-emerald-500/30',
			bgColor: 'bg-emerald-900/10',
			hoverBorder: 'hover:border-emerald-500',
			hoverBg: 'hover:bg-emerald-900/20',
			textColor: 'text-emerald-400',
			hoverText: 'group-hover:text-emerald-200',
			buttonColor: 'bg-emerald-600 hover:bg-emerald-500'
		},
		{
			borderColor: 'border-fuchsia-500/30',
			bgColor: 'bg-fuchsia-900/10',
			hoverBorder: 'hover:border-fuchsia-500',
			hoverBg: 'hover:bg-fuchsia-900/20',
			textColor: 'text-fuchsia-400',
			hoverText: 'group-hover:text-fuchsia-200',
			buttonColor: 'bg-fuchsia-600 hover:bg-fuchsia-500'
		}
	];

	const VIEW_MS = 14000;   // כמה זמן כל קבוצה נשארת על המסך (החלפה איטית)
	const FADE_MS = 900;     // אורך הדעיכה בין קבוצה לקבוצה — חייב להתאים ל-CSS

	let fading = $state(false);

	onMount(() => {
		let fadeTimer;
		// דעיכה החוצה → החלפת הקבוצה בזמן שהטור שקוף → דעיכה פנימה.
		// כך אין קפיצה: המשבצות לא מתחלפות מול העין אלא מתוך שקיפות מלאה.
		const interval = setInterval(() => {
			if (totalSwaps < MAX_SWAPS) {
				fading = true;
				fadeTimer = setTimeout(() => {
					currentGroup = (currentGroup + 1) % 3;
					totalSwaps++;
					fading = false;
				}, FADE_MS);
			} else {
				clearInterval(interval);
			}
		}, VIEW_MS);

		return () => {
			clearInterval(interval);
			clearTimeout(fadeTimer);
		};
	});

	const displayedAds = $derived(slots.slice(currentGroup * 4, (currentGroup + 1) * 4));
</script>

<!-- RightAdBanner.svelte -->
<aside
	aria-label={t.ads}
	class="sticky top-4 hidden h-fit w-36 flex-shrink-0 pb-8 text-center xl:block"
>
	<h4 class="mb-2 px-2 text-xs font-bold tracking-widest text-amber-400 uppercase">
		{t.marketingContent}
	</h4>
	<div class="space-y-3 ads-track" class:fading>
		{#each displayedAds as ad, index}
			<div
				class="group relative flex h-[490px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed {ad.borderColor} {ad.bgColor} p-3 text-center transition-all duration-700 {ad.hoverBorder} {ad.hoverBg}"
			>
				<!-- מספור המודעה -->
				<div
					class="absolute top-3 right-3 rounded-full border border-white/5 bg-white/10 px-3 py-1 text-sm font-black text-white/60 shadow-sm backdrop-blur-sm"
				>
					{currentGroup * 4 + index + 1}
				</div>

				<div
					class="relative flex h-full w-full flex-col items-center justify-between overflow-hidden py-6"
				>
					<div class="z-10 mt-4 text-3xl transition-transform duration-300 group-hover:scale-125">
						📢
					</div>

					<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
						<div
							class="flex -rotate-90 transform items-center gap-3 whitespace-nowrap origin-center"
						>
							<span
								class="text-2xl font-black {ad.textColor} {ad.hoverText} tracking-wider drop-shadow-sm"
							>
								{t.thisAdSpace}
							</span>
							<span
								class="text-base font-bold {ad.textColor} {ad.hoverText} opacity-90 drop-shadow-sm"
							>
								{t.couldBeYours}
							</span>
						</div>
					</div>

					<a
						href="/about/advertise"
						class="z-10 mb-4 rounded-full {ad.buttonColor} px-5 py-2 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105"
					>
						{t.adDetails}
					</a>
				</div>
			</div>
		{/each}
	</div>
</aside>

<style>
	/* דעיכה רכה בין קבוצות המודעות — במקום החלקה קופצנית של כל כרטיס.
	   הערך חייב להתאים ל-FADE_MS שבסקריפט. */
	.ads-track {
		opacity: 1;
		transition: opacity 900ms ease-in-out;
	}
	.ads-track.fading {
		opacity: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.ads-track {
			transition-duration: 1ms;
		}
	}
</style>
