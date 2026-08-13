<script>
	// ============================================================
	// עורך מיקום וזום לתמונה אחת — גוררים את התצוגה כדי למקם, +/− לזום,
	// "מרכז" מאפס. אותה סמנטיקה ואותה פעולת ציור (adImgFit) של הסטודיו
	// בפרסומות ושל אריחי הקטגוריות, כדי שמה שרואים כאן יהיה מה שיוצג.
	//
	// המשבצת כאן היא באותו יחס של המשבצת האמיתית (square ללוגו, wide
	// לתמונות) — אחרת המיקום שנבחר כאן לא היה מתאר את מה שייחתך שם.
	// ============================================================

	import { adImgFit, AD_ZOOM_MIN, AD_ZOOM_MAX } from '$lib/adImageFit';
	import { DEFAULT_FIT } from '$lib/mediaFit.js';

	/**
	 * @type {{
	 *   src: string,
	 *   fit: {x: number, y: number, z: number, r?: number},
	 *   aspect?: 'square' | 'wide',
	 *   mode?: 'cover' | 'contain',
	 *   label?: string,
	 *   round?: boolean
	 * }}
	 */
	let {
		src,
		fit = $bindable(),
		aspect = 'wide',
		mode = 'cover',
		label = '',
		round = false
	} = $props();

	const ZOOM_FACTOR = 1.15;

	// "מרכז" מאפס מיקום וזום ומשאיר את הסיבוב: תמונה שהגיעה שכובה מהטלפון
	// עדיין שכובה, ואיפוס המיקום לא אמור להחזיר אותה לצידה.
	function center() {
		fit = { ...DEFAULT_FIT, r: fit.r ?? 0 };
	}

	function rotate() {
		fit = { ...fit, r: ((fit.r ?? 0) + 90) % 360 };
	}

	/** @param {'in' | 'out'} dir */
	function zoom(dir) {
		const next = dir === 'in' ? fit.z * ZOOM_FACTOR : fit.z / ZOOM_FACTOR;
		fit = { ...fit, z: Math.round(Math.min(AD_ZOOM_MAX, Math.max(AD_ZOOM_MIN, next)) * 100) / 100 };
	}

	/* גרירה: הזזת המצביע בפיקסל אחד מזיזה את התמונה בפיקסל — כלומר משנה
	   את האחוז ביחס לטווח הגלישה (התמונה המוצגת פחות המשבצת). */
	/** @type {{id: number, sx: number, sy: number, fx: number, fy: number, rx: number, ry: number} | null} */
	let pan = null;

	/** @param {PointerEvent} e */
	function panDown(e) {
		const box = /** @type {HTMLElement} */ (e.currentTarget);
		const img = box.querySelector('img');
		if (!img?.naturalWidth || !img.naturalHeight) return;
		const W = box.clientWidth;
		const H = box.clientHeight;
		// x/y נשארים בצירי המסך גם כשהתמונה מסובבת, ולכן טווח הגלישה נמדד
		// על המידות שאחרי הסיבוב — בדיוק כמו ב-adImgFit
		const swap = fit.r === 90 || fit.r === 270;
		const nw = swap ? img.naturalHeight : img.naturalWidth;
		const nh = swap ? img.naturalWidth : img.naturalHeight;
		const base = mode === 'contain' ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh);
		const k = base * fit.z;
		pan = {
			id: e.pointerId,
			sx: e.clientX,
			sy: e.clientY,
			fx: fit.x,
			fy: fit.y,
			rx: nw * k - W,
			ry: nh * k - H
		};
		box.setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	/** @param {PointerEvent} e */
	function panMove(e) {
		if (!pan || e.pointerId !== pan.id) return;
		e.preventDefault();
		const round1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
		const next = { ...fit };
		// גרירה ימינה מזיזה את התמונה ימינה = חושפת את צדה השמאלי = x קטן
		if (Math.abs(pan.rx) > 1) {
			next.x = round1(Math.min(100, Math.max(0, pan.fx - ((e.clientX - pan.sx) / pan.rx) * 100)));
		}
		if (Math.abs(pan.ry) > 1) {
			next.y = round1(Math.min(100, Math.max(0, pan.fy - ((e.clientY - pan.sy) / pan.ry) * 100)));
		}
		fit = next;
	}

	/** @param {PointerEvent} e */
	function panUp(e) {
		if (pan && e.pointerId === pan.id) pan = null;
	}
</script>

<div class="flex flex-wrap items-center gap-3">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative flex-shrink-0 cursor-move touch-none overflow-hidden border border-gray-600 bg-gray-950/80 shadow-inner {round
			? 'rounded-full'
			: 'rounded-xl'} {aspect === 'square' ? 'h-24 w-24' : 'h-24 w-40'}"
		title="גררו את התמונה כדי למקם אותה"
		onpointerdown={panDown}
		onpointermove={panMove}
		onpointerup={panUp}
		onpointercancel={panUp}
	>
		<img
			{src}
			alt={label || 'תצוגה מקדימה'}
			draggable="false"
			class="h-full w-full object-cover"
			use:adImgFit={{ x: fit.x, y: fit.y, z: fit.z, r: fit.r ?? 0, mode }}
		/>
	</div>

	<div class="flex flex-col gap-1.5 text-xs">
		<div class="flex items-center gap-1.5">
			<button type="button" class="fit-btn" aria-label="זום פנימה" onclick={() => zoom('in')}
				>🔍+</button
			>
			<button type="button" class="fit-btn" aria-label="זום החוצה" onclick={() => zoom('out')}
				>🔍−</button
			>
			<span class="w-10 text-center text-gray-500 tabular-nums">{Math.round(fit.z * 100)}%</span>
		</div>
		<div class="flex items-center gap-1.5">
			<button type="button" class="fit-btn" onclick={center}>⌖ מרכז</button>
			<!-- כל לחיצה מסובבת רבע — התיקון לתמונה שהגיעה שכובה מהטלפון -->
			<button type="button" class="fit-btn" onclick={rotate} aria-label="סובב ב-90 מעלות"
				>↻ סובב</button
			>
		</div>
		<p class="max-w-44 leading-snug text-gray-600">גררו את התמונה כדי למקם, וזום +/− לקירוב</p>
	</div>
</div>

<style>
	.fit-btn {
		border-radius: 0.5rem;
		border: 1px solid #4b5563;
		background: rgb(17 24 39 / 0.6);
		padding: 0.25rem 0.5rem;
		font-weight: 700;
		color: #d1d5db;
		transition: border-color 0.15s;
	}
	.fit-btn:hover {
		border-color: rgb(59 130 246 / 0.6);
		color: #93c5fd;
	}
</style>
