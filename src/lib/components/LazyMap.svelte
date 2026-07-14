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

<div bind:this={container} class="mx-auto max-w-4xl">
	<div class="rounded-3xl border border-gray-800 bg-gray-900/40 p-3 shadow-2xl sm:p-4">
		{#if show}
			<BusinessesMap {businesses} />
		{:else}
			<div class="h-[350px] w-full animate-pulse rounded-2xl bg-gray-800 sm:h-[450px]"></div>
		{/if}
	</div>
</div>
