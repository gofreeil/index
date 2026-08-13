<script>
	import { onMount } from 'svelte';
	import BusinessesMap from '$lib/components/BusinessesMap.svelte';

	/** @type {{ businesses: any[] }} */
	let { businesses = [] } = $props();

	/** @type {HTMLDivElement} */
	let container;
	let show = $state(false);
	/** @type {IntersectionObserver} */
	let observer;

	/* המפה הגדולה היא מופע שני של BusinessesMap ולא הזזה של הראשון בין
	   מכלים: Leaflet קושר את עצמו לצומת שנתנו לו, והעברת הצומת בין הורים
	   מחייבת invalidateSize ומסגור מחדש בכל כיוון. מופע נפרד נולד ומת עם
	   השכבה (onDestroy קורא ל-map.remove), והאריחים כבר במטמון הדפדפן. */
	let expanded = $state(false);

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) show = true;
			},
			{ rootMargin: '200px' }
		);
		if (container) observer.observe(container);
		return () => observer?.disconnect();
	});

	/** השכבה נתלית ישירות על body: ל-main יש overflow-x: clip מתחת ל-1024px,
	   ובתוך מכל כזה fixed אינו מובטח להתפרס על כל המסך בכל דפדפן.
	   @param {HTMLElement} node */
	function portal(node) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	// כל עוד המפה פרושה על המסך, הדף שמאחוריה אינו נגלל — אחרת גרירה על
	// המפה בקצה שלה מושכת את הדף שמתחת. Escape סוגר, כמו כל שכבה מודאלית.
	$effect(() => {
		if (!expanded) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		/** @param {KeyboardEvent} e */
		const onKey = (e) => {
			if (e.key === 'Escape') expanded = false;
		};
		window.addEventListener('keydown', onKey);
		return () => {
			document.body.style.overflow = prev;
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<!-- מפה קומפקטית: היא יושבת בראש הדף לצד שורת החיפוש (חצי רוחב), ולכן
     היא נותנת הצצה לפריסה הארצית בלי לדחוף את התוכן מתחתיה אל מחוץ למסך.
     המסגרת היא מלבן לאורך בכוונה — ביחס של הארץ עצמה, שארוכה מצפון לדרום
     וצרה ממערב למזרח: במלבן לרוחב הלכו שני שלישים מהשטח על ים ועל מדבר,
     והיישובים הצטופפו לפס דק באמצע.
     גובה השלד חייב להתאים לגובה המפה ב-BusinessesMap, אחרת יש קפיצה. -->
<div bind:this={container} class="mx-auto max-w-[290px]">
	<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-1.5 shadow-lg md:p-2">
		{#if show}
			<BusinessesMap {businesses} onexpand={() => (expanded = true)} />
		{:else}
			<div class="h-[215px] w-full animate-pulse rounded-xl bg-gray-800 md:h-[430px]"></div>
		{/if}
	</div>
</div>

{#if expanded}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		use:portal
		class="fixed inset-0 z-[3000] flex flex-col bg-gray-950/95 p-2 backdrop-blur-sm sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-label="מפת העסקים"
	>
		<div class="mb-2 flex flex-shrink-0 items-center justify-between px-1">
			<h2 class="text-sm font-bold text-gray-200 sm:text-base">העסקים שלנו פרוסים בארץ</h2>
			<button
				type="button"
				onclick={() => (expanded = false)}
				class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-bold text-gray-200 transition hover:border-blue-500 hover:text-white"
			>
				סגירה ✕
			</button>
		</div>
		<!-- min-h-0: בלעדיו פריט flex אינו מתכווץ מתחת לגובה תוכנו, והמפה
		     הייתה גולשת מתחת לתחתית המסך -->
		<div class="min-h-0 flex-1 overflow-hidden rounded-xl">
			<BusinessesMap {businesses} full />
		</div>
	</div>
{/if}
