<script>
	import { onMount } from 'svelte';

	let count = $state(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			// First try to just get the current count without incrementing (to show immediately if cached?)
			// Actually, standard hit counter logic is to increment on load.
			// To prevent spamming on refresh, we can use sessionStorage
			const hasVisited = sessionStorage.getItem('visited_session');

			let method = 'POST'; // Default to increment

			if (hasVisited) {
				method = 'GET'; // Just read if already visited this session
			} else {
				sessionStorage.setItem('visited_session', 'true');
			}

			const response = await fetch('/api/counter', { method });
			if (response.ok) {
				const data = await response.json();
				count = data.count;
			}
		} catch (err) {
			console.error('Failed to load visitor count', err);
		} finally {
			loading = false;
		}
	});
</script>

{#if count !== null}
	<div
		class="mt-3 flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white/80 px-4 py-1.5 text-xs font-bold text-gray-700 shadow-sm backdrop-blur-sm transition-all hover:border-blue-300 hover:bg-white hover:text-blue-600 hover:shadow-md sm:text-sm"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
			<circle cx="12" cy="12" r="3"></circle>
		</svg>
		<span
			>מספר כניסות לאתר: <span class="font-mono font-medium">{count.toLocaleString()}</span></span
		>
	</div>
{/if}
