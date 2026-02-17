<script>
	import { onMount } from 'svelte';
	import { lang, translations } from '$lib/i18n';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/** @type {number | null} */
	let count = $state(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			const hasVisited = sessionStorage.getItem('visited_session');
			let method = 'POST';
			if (hasVisited) {
				method = 'GET';
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
		class="mt-1 flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold text-gray-700 sm:text-sm"
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
			aria-hidden="true"
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
			<circle cx="12" cy="12" r="3"></circle>
		</svg>
		<span
			>{t.visitorCount}<span class="font-mono font-medium">{(count ?? 0).toLocaleString()}</span
			></span
		>
	</div>
{/if}
