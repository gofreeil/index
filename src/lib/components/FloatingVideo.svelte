<script>
	// ─────────────────────────────────────────────────────────────
	// נגן סרטון צף. נפתח באמצע המסך בגודל בינוני, ומשם:
	//   • גלילה למטה (יותר מ-SHRINK_AT ממקום הפתיחה) מקטינה אותו לפינה
	//     השמאלית התחתונה, כדי שאפשר יהיה לראות את שאר הדף;
	//   • חזרה אל מקום הפתיחה מחזירה אותו לאמצע;
	//   • כפתור הקטנה/הגדלה מחליף ידנית. הקטנה ידנית נשארת עד הגדלה ידנית,
	//     והגדלה ידנית הופכת את מקום הגלילה הנוכחי לנקודת הפתיחה החדשה.
	// בלי מסך כהה ובלי נעילת גלילה: הדף נשאר גלוי ושמיש מאחורי הנגן.
	//
	// הקובץ מנוגן ישירות ב-<video> ולא דרך ה-embed של הטלוויזיה. בתוך iframe
	// של אתר אחר הדפדפן (בעיקר באייפון) מכריח את הנגן להתחיל על שקט, ואין
	// ב-AVideo הגדרה שעוקפת את זה. כאן play() נקרא מתוך הלחיצה עצמה (ראו
	// play()), ולכן הסרטון מתחיל עם קול.
	//
	// z-index 1250: מעל לשונית "לאזור האישי" בנייד (MobileAdsDrawer, 1200).
	// המיקום עובר דרך מאפיין ה-CSS translate ולא transform, כדי לא להתנגש
	// באנימציית הכניסה (scale), שכותבת ל-transform.
	// ─────────────────────────────────────────────────────────────
	import { onMount } from 'svelte';
	import { scale } from 'svelte/transition';

	/** @type {{ src: string, poster?: string, title: string, closeLabel: string, shrinkLabel: string, expandLabel: string, onclose: () => void }} */
	let { src, poster = '', title, closeLabel, shrinkLabel, expandLabel, onclose } = $props();

	/** כמה פיקסלים של גלילה למטה ממקום הפתיחה עד שהנגן מתקטן */
	const SHRINK_AT = 120;
	/** חזרה לטווח הזה ממקום הפתיחה מחזירה אותו לאמצע */
	const RESTORE_AT = 40;

	/** @type {HTMLVideoElement|undefined} */
	let video = $state();
	let small = $state(false);
	/** מקום הגלילה שממנו נמדדת הגלילה למטה. -Infinity = הוקטן ידנית. */
	let anchorY = 0;

	onMount(() => {
		anchorY = window.scrollY;
	});

	function onScroll() {
		const down = window.scrollY - anchorY;
		if (!small && down > SHRINK_AT) small = true;
		else if (small && down < RESTORE_AT) small = false;
	}

	function toggleSize() {
		small = !small;
		anchorY = small ? -Infinity : window.scrollY;
	}

	/**
	 * נקרא מתוך הלחיצה שפתחה את הנגן, באותה מחסנית (אחרי flushSync), וזה
	 * מה שמאפשר קול מההתחלה. אם הדפדפן חוסם בכל זאת, הסרטון מתנגן בשקט
	 * וכפתור הקול נמצא בפקדים.
	 */
	export function play() {
		const el = video;
		if (!el) return;
		el.muted = false;
		el.play()?.catch(() => {
			el.muted = true;
			el.play()?.catch(() => {});
		});
	}

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.key === 'Escape') onclose();
	}

	const ICON_BTN =
		'shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-white/10 hover:text-white';
</script>

<svelte:window onkeydown={onKey} onscroll={onScroll} />

<div
	role="dialog"
	aria-label={title}
	class="fv overflow-hidden rounded-xl border border-white/10 bg-gray-900"
	class:small
	transition:scale={{ start: 0.96, duration: 180 }}
>
	<div class="flex items-center gap-1 py-1 ps-3 pe-1">
		<span class="min-w-0 flex-1 truncate text-xs font-semibold text-gray-200">{title}</span>
		<button
			type="button"
			onclick={toggleSize}
			aria-label={small ? expandLabel : shrinkLabel}
			title={small ? expandLabel : shrinkLabel}
			class={ICON_BTN}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				class="h-4 w-4"
			>
				{#if small}
					<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
				{:else}
					<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
				{/if}
			</svg>
		</button>
		<button type="button" onclick={onclose} aria-label={closeLabel} class={ICON_BTN}>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
				class="h-4 w-4"
			>
				<path d="M6 6l12 12M18 6 6 18" />
			</svg>
		</button>
	</div>
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		{src}
		{poster}
		controls
		playsinline
		preload="metadata"
		class="block aspect-video w-full bg-black"
	></video>
</div>

<style>
	/* אמצע המסך, גודל בינוני */
	.fv {
		position: fixed;
		z-index: 1250;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		/* הרוחב מוגבל גם בגובה המסך (יחס 16:9), כדי שהנגן לא יחרוג ממנו */
		width: min(46rem, 92vw, calc((100vh - 5rem) * 16 / 9));
		width: min(46rem, 92vw, calc((100dvh - 5rem) * 16 / 9));
		box-shadow:
			0 24px 64px -12px rgba(0, 0, 0, 0.9),
			0 0 0 1px rgba(255, 255, 255, 0.04);
		transition:
			left 0.3s ease,
			top 0.3s ease,
			translate 0.3s ease,
			width 0.3s ease;
	}

	/* מוקטן: הפינה השמאלית התחתונה (פיזית, גם ב-RTL) */
	.fv.small {
		left: 0.75rem;
		top: calc(100% - 0.75rem - env(safe-area-inset-bottom));
		translate: 0 -100%;
		width: min(22rem, 64vw);
	}

	@media (min-width: 640px) {
		.fv.small {
			left: 1rem;
			top: calc(100% - 1rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fv {
			transition: none;
		}
	}
</style>
