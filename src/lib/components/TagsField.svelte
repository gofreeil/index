<script>
	// ============================================================
	// שדה התגיות — משותף לטופס ההגשה ולשני מסכי העריכה
	//
	// מקלידים מילה ולוחצים Enter, והיא הופכת לתגית עם סולמית. הסולמית היא
	// תצוגה בלבד: הערך הנשמר הוא המילה עצמה (ראו $lib/tags.js), ולכן גם
	// חיפוש שהוקלד בלעדיה מוצא אותה.
	//
	// הרשימה נוסעת כ-JSON בשדה מוסתר יחיד ולא כשדות חוזרים — שחזור הטיוטה
	// מדלג על שם שחוזר כמה פעמים (ראו applyToForm ב-formDraft.ts). ה-onchange
	// שעל השדה המוסתר הוא הצד השני של אותו שחזור: כשהטיוטה כותבת אליו,
	// התגיות חוזרות למסך.
	// ============================================================
	import { MAX_TAGS, cleanTag, parseTags, serializeTags, tagKey } from '$lib/tags.js';

	/** @type {{
	 *   tags?: string[],
	 *   name?: string,
	 *   suggestions?: string[],
	 *   inputClass?: string,
	 *   labelClass?: string
	 * }} */
	let {
		tags = $bindable([]),
		name = 'tags',
		suggestions = [],
		inputClass = 'w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:outline-none',
		labelClass = 'mb-1.5 block text-sm font-bold text-gray-300'
	} = $props();

	let draft = $state('');
	/** @type {HTMLInputElement | null} */
	let inputEl = $state(null);

	const full = $derived(tags.length >= MAX_TAGS);
	const tagsJson = $derived(serializeTags(tags));

	// הצעה שכבר נבחרה יורדת מהשורה מיד — אחרת היא נראית כאילו הלחיצה לא נקלטה
	const openSuggestions = $derived.by(() => {
		const taken = new Set(tags.map(tagKey));
		return suggestions.filter((s) => s && !taken.has(tagKey(s)));
	});

	/** @param {string} raw */
	function addTag(raw) {
		const tag = cleanTag(raw);
		if (tag.length < 2 || full) return;
		if (tags.some((t) => tagKey(t) === tagKey(tag))) return;
		tags = [...tags, tag];
	}

	/** @param {number} i */
	function removeTag(i) {
		tags = tags.filter((_, idx) => idx !== i);
	}

	function commitDraft() {
		// הדבקה של שורה שלמה ("חשמלאי, מזגנים") מתפרקת לכמה תגיות
		for (const tag of parseTags(draft)) addTag(tag);
		draft = '';
	}

	/** @param {KeyboardEvent} e */
	function onKeydown(e) {
		if (e.key === 'Enter' || e.key === ',') {
			// בלי זה Enter בתוך טופס שולח את הטופס כולו
			e.preventDefault();
			commitDraft();
			return;
		}
		// Backspace על תיבה ריקה מוחק את התגית האחרונה — התנהגות מוכרת משדות תגיות
		if (e.key === 'Backspace' && !draft && tags.length) removeTag(tags.length - 1);
	}

	/** שחזור טיוטה כותב אל השדה המוסתר; משם התגיות חוזרות למסך.
	 *  @param {Event & { currentTarget: HTMLInputElement }} e */
	function syncFromHidden(e) {
		tags = parseTags(e.currentTarget.value);
	}

	/** לחיצה על כפתור בתוך השדה לא מוציאה את המיקוד מתיבת ההקלדה — אחרת
	 *  ה-onblur היה מקבע כתגית את מה שהוקלד למחצה בדרך ללחיצה על הצעה.
	 *  @param {MouseEvent} e */
	const keepFocus = (e) => e.preventDefault();
</script>

<div>
	<span class={labelClass} id="lbl-{name}">🏷️ תגיות — המילים שבהן יחפשו אתכם</span>

	<!-- ההסבר לבעל העסק. לא "מלאו עוד שדה" אלא למה זה משרת אותו: מנוע
	     החיפוש של האתר בודק את התגיות כמו שהוא בודק את שם העסק, ולכן כל
	     מילה כאן היא דרך נוספת שבה לקוח מגיע אליו. -->
	<p class="mt-0.5 mb-2 text-xs leading-relaxed text-gray-400">
		הגולשים לא תמיד מחפשים במילים שבהן אתם מתארים את עצמכם — אחד מקליד "שרברב" והשני "אינסטלטור",
		אחד "מזגנים" והשני "מיזוג אוויר". כל מילה שתוסיפו כאן נכנסת למנוע החיפוש שלנו ומחזירה אתכם
		בתוצאות גם למי שחיפש אחרת. הוסיפו מקצועות נרדפים, שירותים שאתם נותנים והערים שאתם עובדים בהן.
	</p>

	<div class="flex flex-wrap items-center gap-2">
		<input
			bind:this={inputEl}
			bind:value={draft}
			onkeydown={onKeydown}
			onblur={commitDraft}
			disabled={full}
			aria-labelledby="lbl-{name}"
			aria-describedby="hint-{name}"
			placeholder={full ? `הגעתם ל-${MAX_TAGS} תגיות` : 'הקלידו מילה ולחצו Enter'}
			class="{inputClass} flex-1 disabled:opacity-50"
		/>
		<button
			type="button"
			onclick={() => {
				commitDraft();
				inputEl?.focus();
			}}
			disabled={full || !draft.trim()}
			class="shrink-0 rounded-full border border-blue-500/40 bg-blue-600/10 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-600/20 disabled:opacity-40"
		>
			＋ הוספה
		</button>
	</div>
	<p id="hint-{name}" class="mt-1 text-xs text-gray-500">
		Enter אחרי כל מילה. עד {MAX_TAGS} תגיות.
	</p>

	{#if tags.length}
		<ul class="mt-3 flex flex-wrap gap-2">
			{#each tags as tag, i (tag)}
				<li>
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-600/15 py-1 ps-2 pe-3 text-sm font-bold text-blue-200"
					>
						<span dir="rtl">#{tag}</span>
						<button
							type="button"
							onmousedown={keepFocus}
							onclick={() => removeTag(i)}
							aria-label="הסרת התגית {tag}"
							class="text-blue-300/70 transition hover:text-red-300">✕</button
						>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- ההצעות — נגזרות ממה שכבר מולא בטופס (ראו $lib/tagSuggest). הן משתנות
	     תוך כדי הקלדה, ולכן הן נראות כמו תשובה למה שנכתב ולא כרשימה כללית. -->
	{#if openSuggestions.length && !full}
		<div class="mt-3 rounded-xl border border-dashed border-gray-700 p-3">
			<p class="text-xs font-bold text-gray-300">
				💡 לפי מה שמילאתם, אלה התגיות שכדאי להוסיף — לחיצה מוסיפה:
			</p>
			<ul class="mt-2 flex flex-wrap gap-2">
				{#each openSuggestions as s (s)}
					<li>
						<button
							type="button"
							onmousedown={keepFocus}
							onclick={() => addTag(s)}
							class="rounded-full border border-gray-700 bg-gray-900/60 px-3 py-1 text-sm font-medium text-gray-300 transition hover:border-blue-500/50 hover:bg-blue-600/10 hover:text-blue-200"
						>
							＋ #{s}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<input type="hidden" {name} value={tagsJson} onchange={syncFromHidden} />
</div>
