<script>
	// ============================================================
	// AdCardPreview — עותק סטטי של כרטיס הפרסומת מהטור הימני באתר
	// (RightAdBanner), בלי קישור, בלי סבב ובלי דהיית-ריחוף. משמש את
	// מסך הניהול לתצוגה מקדימה: ריחוף על כותרת בטבלת התזמון (דסקטופ)
	// או הקשה עליה (נייד). אותן שכבות ואותם משתני עיצוב מהבילדר —
	// מה שרואים כאן הוא בדיוק מה שמוצג על האתר.
	// ============================================================
	import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
	import {
		parseAdStyle,
		legacyAdStyle,
		adStyleVars,
		logoAnchorClass,
		logoFreeStyle,
		logoCornerSide
	} from '$lib/adStyle';

	/**
	 * @typedef {Object} PreviewAd
	 * @property {string} title
	 * @property {string} [subtitle]
	 * @property {string} [cta]
	 * @property {string} [gradient] מחלקות Tailwind (from-.../to-...) — כמו ב-RightAdBanner
	 * @property {string} [logo]
	 * @property {string} [mainImage]
	 * @property {unknown} [mainImageFit]
	 * @property {unknown} [adStyle]
	 */

	/** @type {{ ad: PreviewAd }} */
	let { ad } = $props();

	const st = $derived(parseAdStyle(ad.adStyle) ?? legacyAdStyle(ad.title));
	const cornerSide = $derived(logoCornerSide(st, Boolean(ad.logo)));
</script>

<!-- אותו כרטיס של RightAdBanner: עמודה ברוחב w-36, אזור תמונה ביחס
     144/450 ורצועת CTA מתחתיו — רק בלי ה-hover והקישור -->
<div class="relative w-36 overflow-hidden rounded-lg bg-gray-900 shadow-lg" style={adStyleVars(st)}>
	<div class="relative aspect-[144/450] w-full overflow-hidden">
		<div class="absolute inset-0 overflow-hidden">
			{#if ad.mainImage}
				<img
					src={ad.mainImage}
					alt={ad.title}
					loading="lazy"
					decoding="async"
					class="h-full w-full object-cover"
					use:adImgFit={parseAdImageFit(ad.mainImageFit)}
				/>
			{/if}
		</div>
		<div class="promo-diag bg-gradient-to-br {ad.gradient}"></div>
		<div
			class="promo-title-top"
			class:has-corner-logo-right={cornerSide === 'right'}
			class:has-corner-logo-left={cornerSide === 'left'}
			style="transform: translateY({st.titleOffsetY}px);"
		>
			<h3 class="promo-title" style="color: {st.titleColor};">{ad.title}</h3>
		</div>
		{#if ad.subtitle}
			<div class="promo-sub-wrap">
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
					: ''}"
				style={logoFreeStyle(st)}
			/>
		{/if}
	</div>
	<div class="bg-gradient-to-r {ad.gradient} p-2.5 text-center">
		<p class="text-xs leading-tight font-bold text-white">{ad.cta || ad.title}</p>
	</div>
</div>

<style>
	/* עותק מדויק של שכבות הכרטיס ב-RightAdBanner — כדי שהתצוגה
	   המקדימה תהיה זהה למה שבאמת מוצג בטור הפרסומות */
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
	.promo-logo-cta {
		top: auto;
		bottom: calc(100% - var(--diag-top-right, 78%) - 18px);
		right: 6px;
		left: auto;
	}
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
