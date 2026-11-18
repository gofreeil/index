<script>
	// ─────────────────────────────────────────────────────────────
	// נגן סרטון מוקטן וצף — בפינה התחתונה, ונשאר שם בזמן גלילה.
	//
	// בלי מסך כהה ובלי נעילת גלילה: הדף נשאר גלוי ושמיש מאחורי הנגן, ומי
	// שגולל בזמן הצפייה ממשיך לראות את שאר הדף.
	//
	// הקובץ מנוגן ישירות ב-<video> ולא דרך ה-embed של הטלוויזיה. בתוך iframe
	// של אתר אחר הדפדפן (בעיקר באייפון) מכריח את הנגן להתחיל על שקט, ואין
	// ב-AVideo הגדרה שעוקפת את זה. כאן play() נקרא מתוך הלחיצה עצמה (ראו
	// play()), ולכן הסרטון מתחיל עם קול.
	//
	// הנגן בצד ימין הפיזי גם ב-RTL, כי בשמאל יושבת בנייד המגירה של "לאזור
	// האישי". z-[1250] שם אותו מעל הלשונית שלה (1200).
	// ─────────────────────────────────────────────────────────────
	import { fly } from 'svelte/transition';

	/** @type {{ src: string, poster?: string, title: string, closeLabel: string, onclose: () => void }} */
	let { src, poster = '', title, closeLabel, onclose } = $props();

	/** @type {HTMLVideoElement|undefined} */
	let video = $state();

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
</script>

<svelte:window onkeydown={onKey} />

<div
	role="dialog"
	aria-label={title}
	style="margin-bottom: env(safe-area-inset-bottom)"
	class="fixed right-3 bottom-3 z-[1250] w-[64vw] max-w-[22rem] overflow-hidden rounded-xl border border-white/10 bg-gray-900 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.85)] sm:right-4 sm:bottom-4 sm:w-[22rem]"
	transition:fly={{ y: 24, duration: 180 }}
>
	<div class="flex items-center gap-2 py-1 ps-3 pe-1">
		<span class="min-w-0 flex-1 truncate text-xs font-semibold text-gray-200">{title}</span>
		<button
			type="button"
			onclick={onclose}
			aria-label={closeLabel}
			class="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
		>
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
