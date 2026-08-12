<script>
	// שורת הלוגואים של הרשתות בכרטיסיית העסק. הרשימה, הצבעים והלוגואים
	// מגיעים כולם מ-$lib/socialLinks.js — כאן תצוגה בלבד.
	//
	// כל לוגו נצבע בצבע המותג שלו (currentColor), והעיגול מסביבו נייטרלי:
	// שמונה עיגולים צבעוניים מלאים היו מושכים יותר תשומת לב מהעסק עצמו.
	import { socialsOf } from '$lib/socialLinks.js';

	/** @type {{ business: any }} */
	let { business } = $props();

	const items = $derived(socialsOf(business));
</script>

{#if items.length}
	<div class="mt-3 flex flex-wrap items-center gap-2">
		{#each items as s (s.key)}
			<a
				href={s.url}
				target="_blank"
				rel="noopener nofollow"
				title={s.name}
				aria-label={s.name}
				style="color: {s.brand}"
				class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-current hover:bg-white/10"
			>
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
					<path d={s.path} />
				</svg>
			</a>
		{/each}
	</div>
{/if}
