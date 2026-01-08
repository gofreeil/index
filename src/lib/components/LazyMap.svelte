<script>
	import { onMount } from 'svelte';
	import IsraelMap from '$lib/components/IsraelMap.svelte';
	import InteractiveMap from '$lib/components/InteractiveMap.svelte';

	/** @type {{ businesses: any[] }} */
	let { businesses = [] } = $props();

	let mapContainer;
	let shouldLoadInteractiveMap = $state(false);
	let observer;

	onMount(() => {
		// Intersection Observer - loads interactive map only when scrolled into view
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !shouldLoadInteractiveMap) {
						shouldLoadInteractiveMap = true;
						console.log('🗺️ Loading interactive map...');
					}
				});
			},
			{
				rootMargin: '200px' // Start loading 200px before it comes into view
			}
		);

		if (mapContainer) {
			observer.observe(mapContainer);
		}

		return () => {
			if (observer) {
				observer.disconnect();
			}
		};
	});
</script>

<div bind:this={mapContainer} class="map-wrapper">
	{#if !shouldLoadInteractiveMap}
		<!-- Static map placeholder - loads immediately -->
		<div class="static-map-container">
			<IsraelMap {businesses} showRegions={false} />
			<div class="loading-overlay">
				<div class="loading-text">
					<svg class="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span>טוען מפה אינטראקטיבית...</span>
				</div>
			</div>
		</div>
	{:else}
		<!-- Interactive map - loads when scrolled into view -->
		<div class="h-[600px] w-full">
			<InteractiveMap {businesses} />
		</div>
	{/if}
</div>

<style>
	.map-wrapper {
		position: relative;
		min-height: 500px;
	}

	.static-map-container {
		position: relative;
		width: 100%;
	}

	.loading-overlay {
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(8px);
		padding: 12px 24px;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		display: flex;
		align-items: center;
		gap: 12px;
		z-index: 10;
	}

	.loading-text {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>
