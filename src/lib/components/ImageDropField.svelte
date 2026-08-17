<script>
	// ============================================================
	// שדה תמונה שאפשר גם לגרור אליו — ולא רק "בחירת קובץ".
	//
	// הקובץ הנגרר נכנס לאותו <input type="file"> שמאחורי הכפתור (דרך
	// DataTransfer), ולכן שום דבר בשרת לא משתנה: הקובץ ממשיך לנסוע באותו
	// name ובאותו טופס. זה גם מה שמאפשר להחליף שדה קיים ברכיב הזה בלי לגעת
	// ב-action.
	//
	// גרירה מתוך חלון דפדפן מגיעה כתמונה בלי קובץ (רק uri-list). בעבר היא
	// נבלעה בשקט והמשתמש היה בטוח שהתמונה נקלטה — ולכן היא נתפסת במפורש
	// ומקבלת הסבר.
	// ============================================================

	/**
	 * `previews` נחשף החוצה (bindable) כדי שההורה יוכל לתלות בו עורך מיקום
	 * וזום לתמונה שנבחרה — ראו ImageFitEditor.
	 * @type {{
	 *   name: string,
	 *   multiple?: boolean,
	 *   max?: number,
	 *   accept?: string,
	 *   hint?: string,
	 *   labelledBy?: string,
	 *   previews?: {name: string, url: string}[]
	 * }}
	 */
	let {
		name,
		multiple = false,
		max = 0,
		accept = 'image/*',
		hint = '',
		labelledBy,
		previews = $bindable([])
	} = $props();

	/** @type {HTMLInputElement | null} */
	let input = $state(null);
	let dragging = $state(false);
	let error = $state('');
	/** @type {{name: string, url: string}[]} */
	let picked = $state([]);

	const cap = $derived(multiple ? max || 0 : 1);

	function releasePreviews() {
		for (const p of picked) URL.revokeObjectURL(p.url);
	}

	/** מציג את מה שיושב עכשיו ב-input — מקור אמת אחד לגרירה ולבחירה */
	function syncPreviews() {
		releasePreviews();
		picked = [...(input?.files ?? [])].map((f) => ({
			name: f.name,
			url: URL.createObjectURL(f)
		}));
		previews = picked;
	}

	/** @param {File[]} files */
	function applyFiles(files) {
		if (!input) return;
		const images = files.filter((f) => f.type.startsWith('image/'));
		if (!images.length) {
			error = 'אפשר לגרור לכאן רק קובץ תמונה';
			return;
		}
		// כמה תמונות = מוסיפים לקיימות (גוררים אחת-אחת); תמונה בודדת = החלפה
		const kept = multiple ? [...(input.files ?? [])] : [];
		const dt = new DataTransfer();
		for (const f of [...kept, ...images].slice(0, cap || undefined)) dt.items.add(f);
		input.files = dt.files;
		error = cap && kept.length + images.length > cap ? `אפשר עד ${cap} תמונות` : '';
		syncPreviews();
		// הטיוטה ומאזינים אחרים בטופס מחכים לאירוע, לא להשמה
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/** @param {DragEvent} e */
	function onDragOver(e) {
		// גם uri-list — כדי שה-drop יקרה ונוכל להסביר בו למה תמונה מדף לא נקלטת
		const dt = e.dataTransfer;
		if (!dt || (!dt.types.includes('Files') && !dt.types.includes('text/uri-list'))) return;
		e.preventDefault();
		dt.dropEffect = 'copy';
		dragging = true;
	}

	/** @param {DragEvent} e */
	function onDragLeave(e) {
		// dragleave יורה גם במעבר בין ילדים באזור — מתעלמים מאלה
		const to = /** @type {Node | null} */ (e.relatedTarget);
		if (to && /** @type {HTMLElement} */ (e.currentTarget)?.contains(to)) return;
		dragging = false;
	}

	/** @param {DragEvent} e */
	function onDrop(e) {
		e.preventDefault();
		dragging = false;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (!files.length) {
			error = 'זו תמונה מתוך דף — שמרו אותה קודם למחשב וגררו את הקובץ';
			return;
		}
		applyFiles(files);
	}

	function clearFiles() {
		if (!input) return;
		input.value = '';
		error = '';
		syncPreviews();
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}
</script>

<!-- שחרור קובץ בטעות מחוץ לאזור היה מנווט את הדפדפן אל התמונה ומאבד את מה
     שמולא בטופס — בולמים את ברירת המחדל בכל הדף -->
<svelte:window
	ondragover={(e) => {
		if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
	}}
	ondrop={(e) => {
		if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
	}}
/>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<label
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed p-4 text-center transition-colors {dragging
		? 'border-blue-400 bg-blue-950/40 ring-2 ring-blue-500/40'
		: 'border-gray-700 bg-gray-900/40 hover:border-blue-500/50 hover:bg-gray-900/60'}"
>
	<input
		bind:this={input}
		{name}
		{accept}
		{multiple}
		type="file"
		class="sr-only"
		aria-labelledby={labelledBy}
		onchange={() => {
			error = '';
			syncPreviews();
		}}
	/>
	<span class="text-2xl leading-none" aria-hidden="true">🖼️</span>
	<span class="text-sm font-bold text-blue-300">
		גררו לכאן {multiple ? 'תמונות' : 'תמונה'} — או לחצו לבחירה
	</span>
	{#if hint}<span class="text-sm text-gray-500">{hint}</span>{/if}
</label>

{#if picked.length}
	<div class="mt-2 flex flex-wrap items-center gap-2">
		{#each picked as p (p.url)}
			<img
				src={p.url}
				alt={p.name}
				class="h-14 w-14 rounded-lg border border-gray-700 object-cover"
			/>
		{/each}
		<button
			type="button"
			onclick={clearFiles}
			class="rounded-full border border-gray-600 px-3 py-1 text-sm font-bold text-gray-300 transition hover:border-red-500/50 hover:text-red-300"
		>
			ניקוי הבחירה
		</button>
	</div>
{/if}

{#if error}<p class="mt-1 text-sm text-red-400">{error}</p>{/if}
