<script>
	/* ═══════════ סימן 5 הכוכבים ═══════════
	   שכבה אחת מציירת, שכבה שנייה מודדת:

	   • למטה — חמישה מתארים אפורים ("כבויים"). כשאין דירוג זה כל מה שרואים.
	   • מעליה — שכבה צהובה חתוכה ברוחב אחוזי. כך המילוי חלקי ולא מעוגל:
	     4.3 נראה כמו 4.3 ולא כמו 4, אחרת ההפרש בין 4.5 ל-4.0 נעלם.

	   במצב interactive המתארים התחתונים הם כפתורים, והשכבה הצהובה עוברת
	   ל-pointer-events-none מעליהם — כך הכוכבים גם מציגים את הממוצע האמיתי
	   וגם לחיצים, ועסק בלי דירוג מציג חמישה כפתורים כבויים שהם נקודת הכניסה
	   לדירוג הראשון. הריחוף מקדים את הבחירה: רואים מה ייבחר לפני הלחיצה.

	   dir="ltr" בכוונה גם בעמוד עברי — כוכב ראשון = כוכב אחד, כמו בכל מקום
	   אחר ברשת. */

	/**
	 * @type {{
	 *   value?: number,
	 *   size?: 'sm' | 'md' | 'lg',
	 *   interactive?: boolean,
	 *   onrate?: (n: number) => void,
	 *   label?: string,
	 *   starLabel?: (n: number) => string
	 * }}
	 */
	let {
		value = 0,
		size = 'md',
		interactive = false,
		onrate = undefined,
		label = '',
		starLabel = undefined
	} = $props();

	const SIZES = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' };
	const starClass = $derived(SIZES[size] || SIZES.md);

	let hovered = $state(0);
	const shown = $derived(hovered || value || 0);
	const pct = $derived((Math.max(0, Math.min(5, shown)) / 5) * 100);

	const STAR_PATH =
		'M11.48 3.5a.56.56 0 011.04 0l2.12 5.11c.08.2.26.33.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.19.56l1.29 5.38a.56.56 0 01-.84.61l-4.73-2.88a.56.56 0 00-.58 0l-4.73 2.88a.56.56 0 01-.84-.61l1.29-5.38a.56.56 0 00-.19-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.48-.35L11.48 3.5z';
</script>

{#snippet star(/** @type {boolean} */ filled)}
	<svg
		class="{starClass} flex-none {filled ? 'text-yellow-400' : 'text-gray-600'}"
		viewBox="0 0 24 24"
		fill={filled ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width={filled ? 0 : 1.5}
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d={STAR_PATH} />
	</svg>
{/snippet}

<span
	dir="ltr"
	class="relative inline-flex"
	role={interactive ? 'group' : 'img'}
	aria-label={label || undefined}
	onmouseleave={() => (hovered = 0)}
>
	<span class="flex items-center gap-0.5">
		{#each [1, 2, 3, 4, 5] as n (n)}
			{#if interactive}
				<button
					type="button"
					aria-label={starLabel ? starLabel(n) : String(n)}
					onmouseenter={() => (hovered = n)}
					onfocus={() => (hovered = n)}
					onblur={() => (hovered = 0)}
					onclick={() => onrate?.(n)}
					class="cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:outline-none"
				>
					{@render star(false)}
				</button>
			{:else}
				{@render star(false)}
			{/if}
		{/each}
	</span>

	<span
		class="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
		style="width:{pct}%"
		aria-hidden="true"
	>
		<span class="flex h-full items-center gap-0.5">
			{#each [1, 2, 3, 4, 5] as n (n)}{@render star(true)}{/each}
		</span>
	</span>
</span>
