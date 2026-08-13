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
			<BusinessesMap {businesses} />
		{:else}
			<div class="h-[215px] w-full animate-pulse rounded-xl bg-gray-800 md:h-[430px]"></div>
		{/if}
	</div>
</div>
