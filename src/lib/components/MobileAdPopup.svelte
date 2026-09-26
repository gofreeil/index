<script>
	// פרסומת במסך מלא בנייד — פורט מ-community (MobileAdPopup.svelte).
	// נפתחת מ-triggerAdPopup (לחיצה על עסק), נסגרת לבד אחרי SECONDS
	// שניות וממשיכה ליעד שנלחץ.
	import { adPopup, closeAdPopup } from '$lib/adPopupStore.js';
	import { adImgFit } from '$lib/adImageFit';
	import { markAdSeen, trackAdClick } from '$lib/adTrack.js';
	import { beforeNavigate, goto } from '$app/navigation';
	import { onDestroy } from 'svelte';

	const SECONDS = 5;

	/** @type {{ ad: import('$lib/adPopupStore.js').PopupAd, pendingHref?: string } | null} */
	let popup = $state(null);
	let countdown = $state(SECONDS);
	/** @type {ReturnType<typeof setInterval> | null} */
	let timer = null;

	const unsubscribe = adPopup.subscribe((val) => {
		popup = val;
		if (timer) clearInterval(timer);
		timer = null;
		if (val) {
			if (val.ad.internal) markAdSeen(String(val.ad.id));
			countdown = SECONDS;
			timer = setInterval(() => {
				countdown -= 1;
				if (countdown <= 0) handleClose();
			}, 1000);
		}
	});

	function handleClose() {
		const href = popup?.pendingHref;
		closeAdPopup();
		if (href) goto(href);
	}

	function handleAdClick() {
		if (popup?.ad.internal) trackAdClick(String(popup.ad.id));
		closeAdPopup();
	}

	// ניווט אחר (כפתור חזרה וכו') בזמן שהפרסומת פתוחה — סוגרים אותה, כדי
	// שהטיימר לא יקפיץ אחר כך לעסק שכבר לא רלוונטי
	beforeNavigate(() => closeAdPopup());

	onDestroy(() => {
		unsubscribe();
		if (timer) clearInterval(timer);
	});
</script>

{#if popup}
	<div class="lg:hidden" dir="rtl">
		<button
			class="fixed inset-0 z-[2000] cursor-pointer border-0 bg-black/70 p-0"
			onclick={handleClose}
			aria-label="סגור פרסומת"
		></button>

		<div
			class="fixed top-1/2 left-1/2 z-[2001] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl"
		>
			<div class="absolute inset-x-0 top-0 z-10 h-1 bg-white/20">
				<div
					class="h-full bg-purple-500 transition-[width] duration-1000 ease-linear"
					style="width: {(countdown / SECONDS) * 100}%"
				></div>
			</div>

			<button
				onclick={handleClose}
				class="absolute top-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/55 text-xs font-bold text-white transition-colors hover:bg-black/80"
				aria-label="סגור">{countdown}</button
			>

			<div class="relative h-44 w-full overflow-hidden">
				<img
					src={popup.ad.image}
					alt={popup.ad.title}
					class="h-full w-full object-cover"
					use:adImgFit={popup.ad.imageFit ?? { x: 50, y: 50, z: popup.ad.imageScale ?? 1, r: 0 }}
				/>
				<div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
			</div>

			<div class="bg-[#0f172a] p-4">
				<h3
					class="mb-1 bg-gradient-to-r {popup.ad
						.color} bg-clip-text text-lg leading-tight font-black text-transparent"
				>
					{popup.ad.title}
				</h3>
				{#if popup.ad.description}
					<p class="mb-3 text-sm leading-snug text-gray-300">{popup.ad.description}</p>
				{/if}
				<a
					href={popup.ad.href}
					target={popup.ad.internal ? undefined : '_blank'}
					rel={popup.ad.internal ? undefined : 'noopener noreferrer'}
					onclick={handleAdClick}
					class="block w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-center text-sm font-bold text-white transition-all hover:from-purple-500 hover:to-indigo-500"
				>
					← {popup.ad.cta}
				</a>
			</div>
		</div>
	</div>
{/if}
