<script>
	// ============================================================
	// קטגוריות נוספות — משותף לטופס ההגשה ולשני מסכי העריכה
	//
	// עסק אחד יושב לא פעם ביותר מתחום אחד (חשמלאי שהוא גם מיזוג אוויר).
	// התחום הראשי נבחר בבורר הרגיל; כאן מסמנים עד MAX_EXTRA_CATEGORIES
	// תחומים נוספים, והעסק יופיע בסינון של כל אחד מהם.
	//
	// הרשימה נוסעת כ-JSON בשדה מוסתר יחיד — אותו דפוס של הסניפים והתגיות:
	// כך גם שחזור הטיוטה וגם חזרה אחרי שגיאת ולידציה עובדים בלי טיפול
	// מיוחד, וה-onchange שעל השדה המוסתר הוא הצד השני של אותו שחזור.
	// ============================================================
	import { MAX_EXTRA_CATEGORIES, parseExtraCategories } from '$lib/categories.js';

	/** @type {{
	 *   selected?: string[],
	 *   options?: Array<{value: string, label: string}>,
	 *   exclude?: string,
	 *   name?: string,
	 *   labelClass?: string,
	 *   selectClass?: string
	 * }} */
	let {
		selected = $bindable([]),
		options = [],
		// התחום הראשי — אין טעם להציע אותו שוב כתוספת
		exclude = '',
		name = 'extra_categories',
		labelClass = 'mb-1 block text-base font-medium text-gray-300',
		selectClass = 'w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-gray-100 focus:border-blue-500/60 focus:outline-none'
	} = $props();

	const full = $derived(selected.length >= MAX_EXTRA_CATEGORIES);
	const json = $derived(JSON.stringify(selected));

	// מה שנותר להוסיף — בלי הראשית ובלי מה שכבר נבחר
	const open = $derived(options.filter((o) => o.value !== exclude && !selected.includes(o.value)));

	// קטגוריה שנשמרה בערך הקנוני מוצגת בשם התצוגה הנוכחי שלה
	/** @param {string} v */
	const labelOf = (v) => options.find((o) => o.value === v)?.label ?? v;

	// החלפת התחום הראשי לאחד שכבר סומן כנוסף — הסימון הכפול יורד מעצמו
	$effect(() => {
		if (exclude && selected.includes(exclude)) {
			selected = selected.filter((c) => c !== exclude);
		}
	});

	/** בחירה מוסיפה צ'יפ, והבורר חוזר לשורת ההזמנה — הוא כפתור הוספה, לא שדה
	 *  @param {Event & { currentTarget: HTMLSelectElement }} e */
	function add(e) {
		const v = e.currentTarget.value;
		e.currentTarget.value = '';
		if (!v || full || selected.includes(v)) return;
		selected = [...selected, v];
	}

	/** @param {number} i */
	function remove(i) {
		selected = selected.filter((_, idx) => idx !== i);
	}

	/** שחזור טיוטה כותב אל השדה המוסתר; משם הצ'יפים חוזרים למסך.
	 *  @param {Event & { currentTarget: HTMLInputElement }} e */
	function syncFromHidden(e) {
		selected = parseExtraCategories(e.currentTarget.value);
	}
</script>

<div>
	<span class={labelClass} id="lbl-{name}">קטגוריות נוספות (עד {MAX_EXTRA_CATEGORIES})</span>
	<p class="mt-0.5 mb-2 text-sm leading-relaxed text-gray-400">
		עוסקים ביותר מתחום אחד? העסק יופיע לגולשים גם בסינון של כל תחום שתסמנו כאן.
	</p>

	{#if selected.length}
		<ul class="mb-2 flex flex-wrap gap-2">
			{#each selected as cat, i (cat)}
				<li>
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-600/15 py-1 ps-2 pe-3 text-sm font-bold text-purple-200"
					>
						<span>{labelOf(cat)}</span>
						<button
							type="button"
							onclick={() => remove(i)}
							aria-label="הסרת הקטגוריה {labelOf(cat)}"
							class="text-purple-300/70 transition hover:text-red-300">✕</button
						>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if !full}
		<select aria-labelledby="lbl-{name}" onchange={add} class={selectClass}>
			<option value="" selected>＋ הוספת קטגוריה…</option>
			{#each open as o (o.value)}
				<option value={o.value}>{o.label}</option>
			{/each}
		</select>
	{:else}
		<p class="text-sm text-gray-500">הגעתם ל-{MAX_EXTRA_CATEGORIES} קטגוריות נוספות.</p>
	{/if}

	<input type="hidden" {name} value={json} onchange={syncFromHidden} />
</div>
