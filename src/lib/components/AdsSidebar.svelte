<script>
	import { ads } from '$lib/adsData.js';
	import { lang, translations } from '$lib/i18n';
	import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
	import { adSeen } from '$lib/adSeen.js';
	import { trackAdClick } from '$lib/adTrack.js';

	/**
	 * @typedef {Object} SidebarAd
	 * @property {string} id
	 * @property {string} title
	 * @property {string} description
	 * @property {string} cta
	 * @property {string|undefined} hover
	 * @property {string} href
	 * @property {string|undefined} trackId מזהה המודעה למדידה; undefined = מודעת שותף סטטית
	 * @property {'_self'|'_blank'} target
	 * @property {string} image
	 * @property {{x:number,y:number,z:number}|undefined} imageFit
	 * @property {string} color
	 * @property {string|undefined} imageHeight
	 */

	// נעילה מכוונת: הטור השמאלי מחזיק אך ורק אתרי רשת "יוצאים לחירות".
	// פרסומות בתשלום שייכות ל-RightAdBanner בלבד; ניסיון להעביר לכאן
	// approvedAds ייכשל בבדיקת הטיפוסים במקום להיבלע בשקט.
	/** @type {{ approvedAds?: never }} */
	let {} = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/** @type {SidebarAd[]} */
	const merged = $derived([
		...ads.map((a) => ({
			id: String(a.id),
			title: a.title,
			description: a.description,
			cta: a.cta,
			hover: a.hover,
			href: a.href,
			trackId: /** @type {string|undefined} */ (undefined),
			target: /** @type {'_blank'} */ ('_blank'),
			image: a.image,
			// למודעות השותפים הסטטיות אין fit — ברירת המחדל שקולה ל-object-cover
			imageFit: /** @type {{x:number,y:number,z:number}|undefined} */ (undefined),
			color: a.color,
			imageHeight: a.imageHeight
		}))
	]);
</script>

<aside
	aria-label={t.adsPartnersAria}
	class="sticky top-4 hidden h-fit w-48 flex-shrink-0 pb-8 text-center lg:block"
>
	<h4 class="mb-2 px-2 text-xs font-bold tracking-widest text-amber-400 uppercase">
		{t.adsSidebarHeader}
	</h4>
	<div class="space-y-4">
		{#each merged as ad (ad.id)}
			<a
				href={ad.href}
				target={ad.target}
				rel={ad.target === '_blank' ? 'noopener noreferrer' : undefined}
				aria-label="{ad.title} – {ad.description}{ad.target === '_blank'
					? t.opensNewWindowSuffix
					: ''}"
				class="group relative block overflow-hidden rounded-lg shadow-lg transition-transform hover:scale-105"
				use:adSeen={ad.trackId}
				onclick={() => trackAdClick(ad.trackId)}
			>
				<div class="relative overflow-hidden" style="height: {ad.imageHeight ?? '160px'}">
					{#if ad.image}
						<div class="absolute inset-0 overflow-hidden">
							<!-- המיקום/זום שנבחרו בבילדר מוחלים גם כאן — הדמו הוא מה שרואים -->
							<img
								src={ad.image}
								alt={ad.title}
								loading="lazy"
								decoding="async"
								class="h-full w-full object-cover transition-opacity duration-[1500ms] group-hover:opacity-0"
								use:adImgFit={parseAdImageFit(ad.imageFit)}
							/>
						</div>
						<div
							class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-[1500ms] group-hover:opacity-100"
						>
							<div class="relative z-10 px-4 text-center">
								<h3 class="mb-1 text-base font-bold text-white">{ad.title}</h3>
								<p class="text-xs text-gray-200">{ad.description}</p>
							</div>
						</div>
					{:else}
						<!-- פרסומת ללא תמונה — גרדיאנט עם הכותרת והתיאור -->
						<div
							class="absolute inset-0 flex items-center justify-center bg-gradient-to-br {ad.color} px-3 text-center"
						>
							<div>
								<h3 class="mb-1 text-base font-bold text-white">{ad.title}</h3>
								<p class="text-xs text-gray-100/90">{ad.description}</p>
							</div>
						</div>
					{/if}
				</div>
				<div class="group/cta relative bg-gradient-to-r {ad.color} p-3 text-center">
					<p class="text-xs leading-tight font-bold text-white">{ad.cta}</p>
					{#if ad.hover}
						<!-- pre-line + w-max: משפט בשורה אחת נשאר בשורה אחת, אבל ירידות
						     שורה שהמפרסם הקליד נשמרות, וטקסט ארוך נגמר ב-max-w -->
						<span
							class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-[15rem] -translate-x-1/2 rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-center text-xs font-bold whitespace-pre-line text-white shadow-xl group-hover/cta:block"
						>
							{ad.hover}
						</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</aside>
