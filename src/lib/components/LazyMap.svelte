<script>
	import { onMount } from 'svelte';
	import IsraelMap from '$lib/components/IsraelMap.svelte';
	import InteractiveMap from '$lib/components/InteractiveMap.svelte';

	/** @type {{ businesses: any[] }} */
	let { businesses = [] } = $props();

	/** @type {HTMLDivElement} */
	let mapContainer;
	let shouldLoadInteractiveMap = $state(false);
	/** @type {IntersectionObserver} */
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

<div bind:this={mapContainer} class="styled-map-wrapper">
	<div class="inner-frame">
		{#if !shouldLoadInteractiveMap}
			<!-- Static map placeholder - loads immediately -->
			<div class="static-map-container">
				<IsraelMap {businesses} showRegions={false} />
				<div class="loading-overlay">
					<div class="loading-text">
						<svg class="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
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
			<div class="h-[350px] w-full sm:h-[450px]">
				<InteractiveMap {businesses} />
			</div>
		{/if}
	</div>
</div>

<style>
	.styled-map-wrapper {
		position: relative;
		max-width: 950px;
		margin: 2rem auto;
		background: white;
		padding: 32px; /* Large safe zone for mobile scrolling */
		border-radius: 2.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
		border: 1px solid rgba(0, 0, 0, 0.05);
		transition: all 0.3s ease;
	}

	@media (min-width: 640px) {
		.styled-map-wrapper {
			padding: 12px;
		}
	}

	:global(.dark) .styled-map-wrapper {
		background: #1f2937;
		border-color: rgba(255, 255, 255, 0.1);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
	}

	.inner-frame {
		position: relative;
		border-radius: 1.8rem;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.05);
	}

	.inner-frame::after {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2px solid rgba(59, 130, 246, 0.2);
		border-radius: 1.5rem;
		pointer-events: none;
		z-index: 20;
	}

	.static-map-container {
		position: relative;
		width: 100%;
		height: 350px;
	}

	@media (min-width: 640px) {
		.static-map-container {
			height: 450px;
		}
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
		z-index: 25;
	}

	:global(.dark) .loading-overlay {
		background: rgba(31, 41, 55, 0.9);
		color: white;
	}

	.loading-text {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
	}

	:global(.dark) .loading-text {
		color: #f3f4f6;
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
