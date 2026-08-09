<script>
	import { onMount } from 'svelte';
	import { lang, translations } from '$lib/i18n';
	import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
	import {
		parseAdStyle,
		legacyAdStyle,
		adStyleVars,
		logoAnchorClass,
		logoFreeStyle,
		logoCornerSide
	} from '$lib/adStyle';
	import { adSeen } from '$lib/adSeen.js';
	import { trackAdClick } from '$lib/adTrack.js';
	import { AD_SLOT_COUNT } from '$lib/adSlots.js';

	/**
	 * מודעה של מפרסם שאושרה. הטור הימני הוא המקום היחיד שלה באתר —
	 * הטור השמאלי שמור לאתרי רשת "יוצאים לחירות" בלבד.
	 * @typedef {Object} ApprovedAd
	 * @property {string} id
	 * @property {string} title
	 * @property {string} subtitle
	 * @property {string} [cta]
	 * @property {string} [hover]
	 * @property {string} gradient
	 * @property {string} [logo] לוגו המפרסם (data-URI); ריק כשלא הועלה לוגו
	 * @property {string} mainImage
	 * @property {{x:number,y:number,z:number}} [mainImageFit] מיקום+זום מהבילדר
	 * @property {import('$lib/adStyle').AdStyle|null} [adStyle] העיצוב מהבילדר; חסר במודעות ותיקות
	 * @property {number} [slot] מספר המקום בטור (1..12) - נקבע במסך הניהול; חסר במודעות ותיקות
	 */

	/** @type {{ approvedAds?: ApprovedAd[] }} */
	let { approvedAds = [] } = $props();

	// העיצוב שהמפרסם קבע בבילדר הוא מה שמוצג כאן — אותו מודול משותף
	// (adStyle.js) מנרמל אותו בשני הצדדים. מודעה שנשלחה לפני שהעיצוב נשמר
	// מקבלת את הכלל הישן, כדי שמודעות שכבר רצות לא ישנו את מראן.
	/** @param {ApprovedAd} ad */
	const styleOf = (ad) => parseAdStyle(ad.adStyle) ?? legacyAdStyle(ad.title);

	// פרסומות משלמות תופסות את המקום הממוספר שלהן בלוח ומשתתפות בסבב
	// יחד עם המשבצות הפנויות
	const paidAds = $derived((approvedAds ?? []).filter((a) => a.mainImage));

	// עד xl הטור מוסתר. כשיש פרסומת אמיתית זה היה מעלים מפרסם משלם ממסכי lg,
	// ולכן במקרה כזה הטור נפתח כבר מ-lg (כמו טור אתרי הרשת שממול).
	const visibilityClass = $derived(paidAds.length > 0 ? 'hidden lg:block' : 'hidden xl:block');

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	let currentGroup = $state(0);

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

	const VIEW_MS = 14000; // כמה זמן כל קבוצה נשארת על המסך (החלפה איטית)
	const FADE_MS = 900; // אורך הדעיכה בין קבוצה לקבוצה — חייב להתאים ל-CSS
	const PER_GROUP = 4; // כמה מקומות (פרסומות ופנויים) נראים בו-זמנית

	/** @typedef {{ num: number, ad?: ApprovedAd, tpl?: PlaceholderAd }} BoardCell */

	// לוח 12 המקומות בסדר מספרי: מקום שנתפס מציג את הפרסומת, מקום פנוי
	// מציג משבצת "יכול להיות שלך". פרסומת מאושרת *תופסת* מקום - סך
	// הכרטיסים הוא תמיד 12 בדיוק. המספר מגיע מהשרת (נקבע במסך הניהול);
	// מודעה ותיקה בלי מספר ממלאת את המספר הפנוי הנמוך ביותר.
	const board = $derived.by(() => {
		/** @type {Set<number>} */
		const taken = new Set();
		for (const a of paidAds) {
			if (typeof a.slot === 'number' && a.slot >= 1) taken.add(a.slot);
		}
		let nextFree = 1;
		/** @type {Map<number, ApprovedAd>} */
		const byNum = new Map();
		/** @type {BoardCell[]} */
		const overflow = [];
		for (const a of paidAds) {
			let num = typeof a.slot === 'number' && a.slot >= 1 ? a.slot : 0;
			// בלי מספר, או בהתנגשות נדירה - המספר הפנוי הנמוך ביותר
			if (num === 0 || byNum.has(num)) {
				while (taken.has(nextFree)) nextFree++;
				num = nextFree;
				taken.add(num);
			}
			if (num <= AD_SLOT_COUNT) byNum.set(num, a);
			else overflow.push({ num, ad: a });
		}
		/** @type {BoardCell[]} */
		const cells = [];
		for (let n = 1; n <= AD_SLOT_COUNT; n++) {
			const ad = byNum.get(n);
			// תבניות הצבע קבועות למספר: משבצת 7 שומרת על הצבעים שלה
			// גם כשמקומות לפניה נתפסים
			cells.push(ad ? { num: n, ad } : { num: n, tpl: slots[(n - 1) % slots.length] });
		}
		// מעבר ל-12 (גלישה) - בסוף הלוח, כדי שפרסומת לא תיעלם
		return [...cells, ...overflow];
	});
	const groupCount = $derived(Math.max(1, Math.ceil(board.length / PER_GROUP)));

	let fading = $state(false);

	onMount(() => {
		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let fadeTimer;
		// דעיכה החוצה → החלפת הקבוצה בזמן שהטור שקוף → דעיכה פנימה.
		// כך אין קפיצה: הכרטיסים לא מתחלפים מול העין אלא מתוך שקיפות מלאה.
		// הסבב רץ כל עוד הדף פתוח: גם הפרסומות המשולמות מתחלפות בו, ולכן
		// עצירה הייתה מקבעת קבוצה אחת ומסתירה לצמיתות את הפרסומות שבאחרות.
		const interval = setInterval(() => {
			if (groupCount <= 1) return;
			fading = true;
			fadeTimer = setTimeout(() => {
				currentGroup = (currentGroup + 1) % groupCount;
				fading = false;
			}, FADE_MS);
		}, VIEW_MS);

		return () => {
			clearInterval(interval);
			clearTimeout(fadeTimer);
		};
	});

	// שינוי במספר הקבוצות תוך כדי סבב (למשל אישור פרסומת) לא משאיר את
	// הטור ריק עד לסיבוב הבא
	const safeGroup = $derived(currentGroup % groupCount);

	// הקבוצה המוצגת כרגע: 4 מקומות עוקבים לפי הסדר המספרי (1-4, 5-8, 9-12)
	const displayed = $derived(board.slice(safeGroup * PER_GROUP, (safeGroup + 1) * PER_GROUP));
</script>

<!-- RightAdBanner.svelte -->
<aside
	aria-label={t.ads}
	class="sticky top-4 {visibilityClass} h-fit w-36 flex-shrink-0 pb-8 text-center"
>
	<h4 class="mb-2 px-2 text-xs font-bold tracking-widest text-amber-400 uppercase">
		{t.marketingContent}
	</h4>

	<!-- לוח 12 המקומות בסדר מספרי, בקבוצות של 4 (1-4, 5-8, 9-12).
	     כל הכרטיסים מתחלפים בסבב כרגיל - פרסומות ומשבצות פנויות יחד:
	     פרסומת שנקבעה למקום 5 מופיעה עם קבוצת 5-8, בין 6 ל-8, וסך
	     המקומות הוא 12 בדיוק. הקישור תמיד לדף הנחיתה הפנימי /ads/<id>. -->
	<div class="ads-track space-y-3" class:fading>
		{#each displayed as cell (cell.num)}
			{#if cell.ad}
				{@const ad = cell.ad}
				{@const st = styleOf(ad)}
				{@const cornerSide = logoCornerSide(st, Boolean(ad.logo))}
				<!-- aspect-[144/450] = היחס שהבילדר מציג בתצוגה החיה, כדי שהחיתוך
				     שהמפרסם כיוון לא יישבר. -->
				<a
					href="/ads/{ad.id}"
					aria-label="{ad.title} – {ad.subtitle}"
					class="group relative block overflow-hidden rounded-lg shadow-lg transition-transform hover:scale-105"
					style={adStyleVars(st)}
					use:adSeen={ad.id}
					onclick={() => trackAdClick(ad.id)}
				>
					<div class="relative aspect-[144/450] w-full overflow-hidden">
						<div class="absolute inset-0 overflow-hidden">
							<img
								src={ad.mainImage}
								alt={ad.title}
								loading="lazy"
								decoding="async"
								class="h-full w-full object-cover transition-opacity duration-[1500ms] group-hover:opacity-0"
								use:adImgFit={parseAdImageFit(ad.mainImageFit)}
							/>
						</div>
						<!-- אותן שכבות בדיוק של התצוגה החיה בבילדר: רצועה אלכסונית
						     בגובה שנקבע, כותרת בצבע ובמיקום שנבחרו, סלוגן ולוגו
						     בצורה ובמקום שהמפרסם קבע (כולל גרירה חופשית). בלעדיהן
						     הכרטיס היה תמונה חשופה, והמפרסם לא ראה את שמו על המסך. -->
						<div
							class="promo-diag bg-gradient-to-br {ad.gradient} transition-opacity duration-[1500ms] group-hover:opacity-0"
						></div>
						<div
							class="promo-title-top transition-opacity duration-[1500ms] group-hover:opacity-0"
							class:has-corner-logo-right={cornerSide === 'right'}
							class:has-corner-logo-left={cornerSide === 'left'}
							style="transform: translateY({st.titleOffsetY}px);"
						>
							<h3 class="promo-title" style="color: {st.titleColor};">{ad.title}</h3>
						</div>
						{#if ad.subtitle}
							<div
								class="promo-sub-wrap transition-opacity duration-[1500ms] group-hover:opacity-0"
							>
								<p class="promo-sub">{ad.subtitle}</p>
							</div>
						{/if}
						{#if ad.logo}
							<img
								src={ad.logo}
								alt=""
								loading="lazy"
								decoding="async"
								class="promo-logo {logoAnchorClass(st, 'promo')} {st.logoShape === 'circle'
									? 'promo-logo-circle'
									: ''} transition-opacity duration-[1500ms] group-hover:opacity-0"
								style={logoFreeStyle(st)}
							/>
						{/if}
						<div
							class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-[1500ms] group-hover:opacity-100"
						>
							<div class="relative z-10 px-3 text-center">
								<h3 class="mb-1 text-sm font-bold text-white">{ad.title}</h3>
								<p class="text-xs text-gray-200">{ad.subtitle}</p>
							</div>
						</div>
					</div>
					<div class="group/cta relative bg-gradient-to-r {ad.gradient} p-2.5 text-center">
						<p class="text-xs leading-tight font-bold text-white">{ad.cta || ad.title}</p>
						{#if ad.hover}
							<span
								class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-xl group-hover/cta:block"
							>
								{ad.hover}
							</span>
						{/if}
					</div>
				</a>
			{:else if cell.tpl}
				{@const ad = cell.tpl}
				<div
					class="group relative flex h-[490px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed {ad.borderColor} {ad.bgColor} p-3 text-center transition-all duration-700 {ad.hoverBorder} {ad.hoverBg}"
				>
					<!-- מספר המקום הפנוי - בדיוק המספרים שלא נתפסו ע"י פרסומות -->
					<div
						class="absolute top-3 right-3 rounded-full border border-white/5 bg-white/10 px-3 py-1 text-sm font-black text-white/60 shadow-sm backdrop-blur-sm"
					>
						{cell.num}
					</div>

					<div
						class="relative flex h-full w-full flex-col items-center justify-between overflow-hidden py-6"
					>
						<div class="z-10 mt-4 text-3xl transition-transform duration-300 group-hover:scale-125">
							📢
						</div>

						<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
							<div
								class="flex origin-center -rotate-90 transform items-center gap-3 whitespace-nowrap"
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
			{/if}
		{/each}
	</div>
</aside>

<style>
	/* דעיכה רכה בין קבוצות הלוח — כל הקבוצה (פרסומות ומשבצות פנויות)
	   דועכת ומתחלפת יחד. הערך חייב להתאים ל-FADE_MS שבסקריפט. */
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

	/* ============================================================
	   שכבות המודעה — אותם ערכים בדיוק של התצוגה החיה בבילדר
	   (advertise/builder: .pro-diag / .pro-title-top / .pro-sub / .ad-logo).
	   --diag-top-* מגיעים מהעיצוב ששמור עם המודעה, ולכן לכל מודעה גובה
	   רצועה משלה; בלעדיו נופלים לברירת המחדל של הבילדר.
	   ============================================================ */
	.promo-diag {
		position: absolute;
		inset: 0;
		clip-path: polygon(
			0 var(--diag-top-left, 88%),
			100% var(--diag-top-right, 78%),
			100% 100%,
			0 100%
		);
		opacity: 0.96;
		pointer-events: none;
	}
	/* פס הברק הלבן שחוצה את האלכסון */
	.promo-diag::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			125deg,
			transparent 30%,
			rgba(255, 255, 255, 0.18) 45%,
			transparent 60%
		);
		pointer-events: none;
	}
	.promo-title-top {
		position: absolute;
		inset-inline: 0;
		top: 0;
		z-index: 5;
		padding: 0.55rem 0.7rem 0.85rem;
		text-align: center;
		background: linear-gradient(
			180deg,
			rgba(0, 0, 0, 0.78) 0%,
			rgba(0, 0, 0, 0.45) 55%,
			rgba(0, 0, 0, 0) 100%
		);
		pointer-events: none;
	}
	/* לוגו בפינה העליונה יושב באותו גובה של הכותרת. בלי שמירת המקום הזאת
	   הוא מכסה לה את המילה האחרונה - המשבצת רחבה 144px בלבד. ריפוד פיזי
	   ולא לוגי: הדף RTL, והקצה הלוגי הפוך לצד שבו הלוגו באמת נמצא. */
	.promo-title-top.has-corner-logo-right {
		padding-right: 46px;
	}
	.promo-title-top.has-corner-logo-left {
		padding-left: 46px;
	}
	.promo-title {
		margin: 0;
		color: white;
		font-weight: 900;
		font-size: 1.15rem;
		line-height: 1.15;
		letter-spacing: 0.005em;
		text-shadow:
			0 2px 10px rgba(0, 0, 0, 0.85),
			0 1px 2px rgba(0, 0, 0, 0.95);
	}
	.promo-sub-wrap {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		z-index: 4;
		padding: 0.55rem 0.7rem 1.1rem;
		text-align: right;
		pointer-events: none;
	}
	.promo-sub {
		margin: 0;
		color: rgba(255, 255, 255, 0.95);
		font-weight: 600;
		font-size: 0.88rem;
		line-height: 1.3;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
	}
	/* משולש בלתי-נראה שגורם לשורה הראשונה להתקצר לפי שיפוע האלכסון */
	.promo-sub::before {
		content: '';
		float: left;
		width: 28%;
		height: 1.35em;
		shape-outside: polygon(0 0, 100% 0, 0 100%);
	}
	.promo-logo {
		position: absolute;
		z-index: 6;
		width: 36px;
		height: 36px;
		border-radius: 6px;
		background: white;
		padding: 3px;
		object-fit: contain;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
	}
	/* right/left פיזיים - כמו בבילדר. עם inset-inline-end הלוגו קפץ לצד
	   שמאל, כי הדף RTL והקצה הלוגי שם הוא שמאל. */
	.promo-logo-right {
		top: 6px;
		right: 6px;
		left: auto;
	}
	.promo-logo-left {
		top: 6px;
		left: 6px;
		right: auto;
	}
	/* עוגן "מעל ה-CTA": הלוגו רוכב על הפינה הימנית של הרצועה האלכסונית,
	   מרכזו על --diag-top-right (18px = חצי מגובה הלוגו) */
	.promo-logo-cta {
		top: auto;
		bottom: calc(100% - var(--diag-top-right, 78%) - 18px);
		right: 6px;
		left: auto;
	}
	/* מיקום חופשי שהמפרסם גרר: הנקודה המדויקת מגיעה ב-style inline */
	.promo-logo-free {
		top: auto;
		bottom: auto;
		right: auto;
		left: auto;
	}
	.promo-logo-circle {
		border-radius: 50%;
	}
</style>
