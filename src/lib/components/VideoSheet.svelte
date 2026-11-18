<script>
	// ─────────────────────────────────────────────────────────────
	// סרטון הסבר בחלון — מגירה מלמטה בנייד, חלון במרכז בדסקטופ.
	//
	// בנייד אין hover, ולכן הסבר לא יכול לשבת בטולטיפ: לחיצה על "מה זה?"
	// פותחת את הסרטון, באותה צורה בכל מסך. הנגן הוא ה-embed של הטלוויזיה
	// (tv.gofreeil.com, AVideo) והוא נטען רק כשהחלון נפתח — לא מכביד על הדף.
	//
	// autoplay=1 + allow="autoplay": הפתיחה היא לחיצה של המשתמש, ולכן רוב
	// הדפדפנים מנגנים מיד ועם קול. ב-iOS לפעמים נדרשת עוד הקשה על הנגן.
	//
	// z-[1250]: מעל לשונית "לאזור האישי" הצפה בנייד (MobileAdsDrawer, 1200),
	// שאחרת נשארה מונחת על הנגן.
	//
	// הרוחב חסום לפי גובה המסך: טלפון לרוחב (~390px גובה) היה מקבל נגן
	// 16:9 ברוחב מלא שגולש מעבר לתחתית.
	// ─────────────────────────────────────────────────────────────
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	/** @type {{ src: string, title: string, closeLabel: string, onclose: () => void }} */
	let { src, title, closeLabel, onclose } = $props();

	/** @type {HTMLDivElement|undefined} */
	let panel = $state();

	const embed = $derived(src + (src.includes('?') ? '&' : '?') + 'autoplay=1');

	onMount(() => {
		panel?.focus();
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = prev);
	});

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[1250] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
	transition:fade={{ duration: 150 }}
	onclick={onclose}
>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={panel}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-labelledby="video-sheet-title"
		style="max-width: min(48rem, calc((100dvh - 5rem) * 16 / 9))"
		class="w-full overflow-hidden rounded-t-2xl border border-white/10 bg-gray-900 pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none sm:rounded-2xl sm:pb-0"
		transition:fly={{ y: 48, duration: 200 }}
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between gap-3 px-4 py-2.5">
			<h2 id="video-sheet-title" class="text-sm font-semibold text-gray-200">{title}</h2>
			<button
				type="button"
				onclick={onclose}
				aria-label={closeLabel}
				class="-me-1.5 rounded-full p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					aria-hidden="true"
					class="h-5 w-5"
				>
					<path d="M6 6l12 12M18 6 6 18" />
				</svg>
			</button>
		</div>
		<div class="aspect-video w-full bg-black">
			<iframe
				src={embed}
				{title}
				class="h-full w-full"
				allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
				allowfullscreen
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		</div>
	</div>
</div>
