<script>
	import { enhance } from '$app/forms';
	import { OTHER, DEFAULT_CATEGORY_FIT } from '$lib/categories.js';
	import { adImgFit, AD_ZOOM_MIN, AD_ZOOM_MAX } from '$lib/adImageFit';

	// ============================================================
	// מסך ניהול הקטגוריות — לסופר-אדמין בלבד (הגייטינג בשרת).
	//
	// כל המסך הוא טופס אחד: שם ואימוג'י נערכים בשורות, הסדר בחיצים,
	// ותמונות מצורפות כקבצים לפי אינדקס השורה (img_0, img_1...). כפתור
	// השמירה שולח את המצב המלא כ-JSON נסתר + הקבצים — ככה אין סנכרון
	// חלקי בין פעולות נפרדות, ומה שרואים על המסך הוא בדיוק מה שיישמר.
	// ============================================================

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	/** @typedef {{ key: string, name: string, icon: string, image: string, count: number, builtin: boolean, defaultName?: string, defaultIcon?: string, isNew: boolean, removeImage: boolean, previewUrl: string, dropError: string, fitX: number, fitY: number, fitZ: number }} Row */

	/** @param {any[]} cats @returns {Row[]} */
	const seed = (cats) =>
		(cats ?? []).map((/** @type {any} */ c) => ({
			key: c.key,
			name: c.name,
			icon: c.icon,
			image: c.image || '',
			count: c.count ?? 0,
			builtin: !!c.builtin,
			defaultName: c.defaultName,
			defaultIcon: c.defaultIcon,
			isNew: false,
			removeImage: false,
			// תצוגה מקדימה מקומית של קובץ שנבחר/נגרר וטרם נשמר (ObjectURL)
			previewUrl: '',
			dropError: '',
			// מיקום+זום של התמונה באריח (אותה סמנטיקה כמו בפרסומות)
			fitX: c.imageFit?.x ?? DEFAULT_CATEGORY_FIT.x,
			fitY: c.imageFit?.y ?? DEFAULT_CATEGORY_FIT.y,
			fitZ: c.imageFit?.z ?? DEFAULT_CATEGORY_FIT.z
		}));

	// המצב הנערך מקומית; נזרע מהשרת פעם אחת, ונזרע מחדש אחרי שמירה מוצלחת
	// svelte-ignore state_referenced_locally
	let rows = $state(seed(data.categories));
	// svelte-ignore state_referenced_locally
	let customOrder = $state(Boolean(data.hasCustomOrder));
	let saving = $state(false);
	let resetting = $state(false);
	let filesPicked = $state(false); // נבחר קובץ תמונה — גם זה "שינוי שטרם נשמר"
	let newName = $state('');
	let newIcon = $state('');
	let addError = $state('');
	let newCount = 0; // מזהים זמניים לשורות חדשות — השרת מנפיק מזהה אמיתי
	/** @type {HTMLFormElement | null} */
	let formEl = $state(null);

	// "אחר" מוצמדת לסוף — גם באתר (המסילה) וגם כאן; אין להזיז ואין למחוק
	/** @param {Row} r */
	const isPinned = (r) => r.builtin && r.key === OTHER;

	/* ── גרירת תמונה על שורה ──────────────────────────────────────
	   כל שורת קטגוריה היא אזור שחרור: הקובץ הנגרר נכנס לאותו <input type=file>
	   שמאחורי "בחירת קובץ" (דרך DataTransfer), ולכן השמירה בשרת לא משתנה —
	   הקובץ ממשיך לנסוע בשם img_<אינדקס>. */
	let dragOverKey = $state(''); // השורה שמעליה מרחפים עכשיו עם קובץ

	/** מעדכן את התצוגה המקדימה המקומית של שורה (ומשחרר את הקודמת)
	 * @param {Row} r @param {File | null} file */
	function setPreview(r, file) {
		if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
		r.previewUrl = file ? URL.createObjectURL(file) : '';
	}

	/** מכניס קובץ לקלט הקובץ של השורה — הנתיב המשותף לגרירה ולבחירה
	 * @param {number} i @param {File} file */
	function applyImageFile(i, file) {
		const input = /** @type {HTMLInputElement | null} */ (
			formEl?.querySelector(`input[name="img_${i}"]`)
		);
		if (!input) return;
		const dt = new DataTransfer();
		dt.items.add(file);
		input.files = dt.files;
		const r = rows[i];
		setPreview(r, file);
		r.removeImage = false; // תמונה חדשה מבטלת סימון הסרה — הכוונה היא החלפה
		r.dropError = '';
		centerFit(r); // נקודת מיקוד של תמונה קודמת חסרת משמעות בתמונה אחרת
		filesPicked = true;
	}

	/* ── מיקום + זום של התמונה באריח ─────────────────────────────
	   אותה סמנטיקה כמו בבילדר הפרסומות (adImgFit): גוררים את התצוגה
	   המקדימה כדי למקם, כפתורי +/- לזום, "מרכז" מאפס. הערכים נוסעים
	   ב-payload ונשמרים רק כשהם שונים מברירת המחדל. */

	const ZOOM_FACTOR = 1.15;

	/** @param {Row} r */
	function centerFit(r) {
		r.fitX = DEFAULT_CATEGORY_FIT.x;
		r.fitY = DEFAULT_CATEGORY_FIT.y;
		r.fitZ = DEFAULT_CATEGORY_FIT.z;
	}

	/** @param {Row} r @param {'in' | 'out'} dir */
	function zoomFit(r, dir) {
		const next = dir === 'in' ? r.fitZ * ZOOM_FACTOR : r.fitZ / ZOOM_FACTOR;
		r.fitZ = Math.round(Math.min(AD_ZOOM_MAX, Math.max(AD_ZOOM_MIN, next)) * 100) / 100;
	}

	/** הסרת התמונה של השורה: קובץ טרי נמחק מהקלט; תמונה שמורה מסומנת
	 *  להסרה בשמירה. @param {number} i */
	function removeRowImage(i) {
		const r = rows[i];
		const input = /** @type {HTMLInputElement | null} */ (
			formEl?.querySelector(`input[name="img_${i}"]`)
		);
		if (input) input.value = '';
		setPreview(r, null);
		if (r.image) r.removeImage = true;
		centerFit(r);
	}

	/** האם יש לשורה תמונה על המסך (טרייה או שמורה) — ואז מציגים את עורך המיקום
	 * @param {Row} r */
	const hasVisibleImage = (r) => Boolean(r.previewUrl || (r.image && !r.removeImage));

	/* גרירת התצוגה המקדימה ממקמת את נקודת המיקוד. ההמרה: הזזת המצביע
	   בפיקסל אחד מזיזה את התמונה בפיקסל — כלומר משנה את האחוז ביחס לטווח
	   הגלישה (רוחב התמונה המוצגת פחות רוחב המשבצת). */
	/** @type {{ id: number, sx: number, sy: number, fx: number, fy: number, rx: number, ry: number } | null} */
	let pan = null;

	/** @param {PointerEvent} e @param {Row} r */
	function panDown(e, r) {
		const box = /** @type {HTMLElement} */ (e.currentTarget);
		const img = box.querySelector('img');
		if (!img?.naturalWidth || !img.naturalHeight) return;
		const W = box.clientWidth;
		const H = box.clientHeight;
		const k = Math.max(W / img.naturalWidth, H / img.naturalHeight) * r.fitZ;
		pan = {
			id: e.pointerId,
			sx: e.clientX,
			sy: e.clientY,
			fx: r.fitX,
			fy: r.fitY,
			rx: img.naturalWidth * k - W,
			ry: img.naturalHeight * k - H
		};
		box.setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	/** @param {PointerEvent} e @param {Row} r */
	function panMove(e, r) {
		if (!pan || e.pointerId !== pan.id) return;
		e.preventDefault();
		const round1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
		// גרירה ימינה מזיזה את התמונה ימינה = חושפת את צדה השמאלי = x קטן
		if (pan.rx > 1) {
			r.fitX = round1(Math.min(100, Math.max(0, pan.fx - ((e.clientX - pan.sx) / pan.rx) * 100)));
		}
		if (pan.ry > 1) {
			r.fitY = round1(Math.min(100, Math.max(0, pan.fy - ((e.clientY - pan.sy) / pan.ry) * 100)));
		}
	}

	/** @param {PointerEvent} e */
	function panUp(e) {
		if (pan && e.pointerId === pan.id) pan = null;
	}

	/** @param {DragEvent} e @param {Row} r */
	function onRowDragOver(e, r) {
		// רק גרירת קבצים מהמחשב — לא גרירת טקסט או תמונה מתוך הדף עצמו
		if (!e.dataTransfer?.types?.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		dragOverKey = r.key;
	}

	/** @param {DragEvent} e @param {Row} r */
	function onRowDragLeave(e, r) {
		// dragleave יורה גם במעבר בין ילדים בתוך השורה — מתעלמים מאלה
		const to = /** @type {Node | null} */ (e.relatedTarget);
		if (to && /** @type {HTMLElement} */ (e.currentTarget)?.contains(to)) return;
		if (dragOverKey === r.key) dragOverKey = '';
	}

	/** @param {DragEvent} e @param {number} i */
	function onRowDrop(e, i) {
		e.preventDefault();
		dragOverKey = '';
		const file = e.dataTransfer?.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			rows[i].dropError = 'אפשר לגרור לכאן רק קובץ תמונה';
			return;
		}
		applyImageFile(i, file);
	}

	const payloadJson = $derived(
		JSON.stringify({
			customOrder,
			rows: rows.map((r) => ({
				key: r.key,
				name: r.name,
				icon: r.icon,
				removeImage: r.removeImage,
				isNew: r.isNew,
				imageFit: { x: r.fitX, y: r.fitY, z: r.fitZ }
			}))
		})
	);

	/** יש שינוי שטרם נשמר? משווים מול מה שהשרת נתן */
	const dirty = $derived.by(() => {
		if (filesPicked) return true;
		const base = seed(data.categories);
		if (customOrder !== Boolean(data.hasCustomOrder)) return true;
		if (rows.length !== base.length) return true;
		return rows.some(
			(r, i) =>
				r.key !== base[i].key ||
				r.name !== base[i].name ||
				r.icon !== base[i].icon ||
				r.fitX !== base[i].fitX ||
				r.fitY !== base[i].fitY ||
				r.fitZ !== base[i].fitZ ||
				r.removeImage ||
				r.isNew
		);
	});

	/** @param {number} i @param {1 | -1} dir */
	function move(i, dir) {
		const j = i + dir;
		if (j < 0 || j >= rows.length) return;
		if (isPinned(rows[i]) || isPinned(rows[j])) return;
		const copy = [...rows];
		[copy[i], copy[j]] = [copy[j], copy[i]];
		rows = copy;
		customOrder = true;
	}

	function addRow() {
		const name = newName.trim();
		if (!name) {
			addError = 'צריך שם לקטגוריה החדשה';
			return;
		}
		if (rows.some((r) => r.name.trim() === name)) {
			addError = 'כבר יש קטגוריה בשם הזה';
			return;
		}
		addError = '';
		/** @type {Row} */
		const row = {
			key: `new_${newCount++}`,
			name,
			icon: newIcon.trim() || '🏷️',
			image: '',
			count: 0,
			builtin: false,
			isNew: true,
			removeImage: false,
			previewUrl: '',
			dropError: '',
			fitX: DEFAULT_CATEGORY_FIT.x,
			fitY: DEFAULT_CATEGORY_FIT.y,
			fitZ: DEFAULT_CATEGORY_FIT.z
		};
		// נכנסת לפני "אחר" המוצמדת לסוף
		const at = rows.length && isPinned(rows[rows.length - 1]) ? rows.length - 1 : rows.length;
		rows = [...rows.slice(0, at), row, ...rows.slice(at)];
		newName = '';
		newIcon = '';
	}

	/** @param {number} i */
	function removeRow(i) {
		const r = rows[i];
		if (r.builtin) return;
		const warn = r.count
			? `למחוק את "${r.name}"? ${r.count} כרטיסיות מסווגות אליה — הן יחזרו להציג את התווית שנשמרה בהן.`
			: `למחוק את "${r.name}"?`;
		if (!r.isNew && !confirm(warn)) return;
		setPreview(r, null); // שחרור ה-ObjectURL של השורה שנמחקת
		rows = rows.filter((_, idx) => idx !== i);
	}

	/** שחזור שם/אימוג'י של קטגוריה מובנית לברירת המחדל שבקוד @param {Row} r */
	function restoreDefaults(r) {
		if (!r.builtin) return;
		r.name = r.defaultName ?? r.name;
		r.icon = r.defaultIcon ?? r.icon;
	}

	function reseed() {
		for (const r of rows) setPreview(r, null); // שחרור כל ה-ObjectURL-ים
		rows = seed(data.categories);
		customOrder = Boolean(data.hasCustomOrder);
		filesPicked = false;
		// קלטי הקבצים לא נשלטים ע"י Svelte — מנקים ידנית אחרי שמירה
		formEl?.querySelectorAll('input[type="file"]').forEach((el) => {
			/** @type {HTMLInputElement} */ (el).value = '';
		});
	}

	/** @param {'save' | 'reset'} kind */
	const submitFn =
		(kind) =>
		(/** @type {any} */ { cancel }) => {
			if (
				kind === 'reset' &&
				!confirm('לאפס את כל הקטגוריות לברירת המחדל? שמות, סדר ותמונות שהוגדרו כאן יימחקו.')
			) {
				cancel();
				return;
			}
			if (kind === 'save') saving = true;
			else resetting = true;
			return async (/** @type {any} */ { update, result }) => {
				await update({ reset: false });
				saving = false;
				resetting = false;
				if (result?.type === 'success') reseed();
			};
		};

	const freeLabels = $derived(Object.entries(data.freeLabels ?? {}));
</script>

<svelte:head>
	<title>ניהול קטגוריות — פאנל ניהול</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- שחרור קובץ בטעות מחוץ לשורה היה מנווט את הדפדפן אל התמונה ומוחק את
     כל העריכות שטרם נשמרו — בולמים את ברירת המחדל בכל הדף -->
<svelte:window ondragover={(e) => e.preventDefault()} ondrop={(e) => e.preventDefault()} />

<main class="mx-auto max-w-4xl pb-10" dir="rtl">
	<div class="mb-6 flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-extrabold text-gray-100">🗂️ ניהול קטגוריות</h1>
			<p class="mt-1 text-sm text-gray-500">
				שם, אימוג'י, תמונה וסדר של תחומי האינדקס — לסופר-אדמין בלבד. השינויים חלים על התצוגה בלבד;
				הכרטיסיות במאגר שומרות את התווית המקורית שלהן.
			</p>
		</div>
		<a href="/admin" class="flex-shrink-0 text-sm text-gray-400 hover:text-blue-400">← לפאנל</a>
	</div>

	{#if form?.success}
		<div
			class="mb-4 rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-center text-green-300"
		>
			✓ {form.message}
		</div>
	{/if}
	{#if form?.error}
		<div
			class="mb-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-center text-red-300"
		>
			{form.error}
		</div>
	{/if}

	<!-- איך זה עובד -->
	<div
		class="mb-6 rounded-2xl border border-blue-500/20 bg-blue-950/20 p-4 text-xs leading-relaxed text-gray-400"
	>
		<p class="mb-1 font-bold text-blue-300">איך זה עובד:</p>
		<ul class="list-inside list-disc space-y-0.5">
			<li>
				הסדר כאן הוא סדר האריחים במסילת דף הבית. בלי שינוי ידני המסילה מסתדרת לבד לפי כמות העסקים.
			</li>
			<li>תמונה שמועלית מחליפה את האימוג'י על האריח; "אחר" תמיד אחרונה.</li>
			<li>קטגוריה בלי עסקים לא מוצגת במסילה, אבל כן מופיעה בטופס ההגשה.</li>
			<li>שינוי שם חל בכל האתר (מסילה, כרטיסיות, דפי עסק) — בלי לשנות את הרשומות במאגר.</li>
		</ul>
	</div>

	<!-- מצב הסדר -->
	<div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
		<span
			class="rounded-full border px-2.5 py-1 font-bold {customOrder
				? 'border-purple-500/40 bg-purple-900/30 text-purple-300'
				: 'border-gray-600/40 bg-gray-800/60 text-gray-300'}"
		>
			{customOrder ? '✋ סדר ידני — כמו שמוצג כאן' : '🤖 סדר אוטומטי — לפי כמות עסקים'}
		</span>
		{#if customOrder}
			<button
				type="button"
				class="text-gray-500 underline-offset-2 hover:text-blue-400 hover:underline"
				onclick={() => (customOrder = false)}
			>
				חזרה לסדר אוטומטי (ייקבע בשמירה)
			</button>
		{/if}
	</div>

	<form
		bind:this={formEl}
		method="POST"
		action="?/save"
		enctype="multipart/form-data"
		use:enhance={submitFn('save')}
	>
		<input type="hidden" name="payload" value={payloadJson} />

		<div class="space-y-2">
			{#each rows as r, i (r.key)}
				<!-- כל השורה היא אזור שחרור לתמונה — לא רק כפתור הבחירה -->
				<div
					role="group"
					aria-label="קטגוריה {r.name} — אפשר לגרור לכאן קובץ תמונה"
					ondragover={(e) => onRowDragOver(e, r)}
					ondragleave={(e) => onRowDragLeave(e, r)}
					ondrop={(e) => onRowDrop(e, i)}
					class="rounded-2xl border bg-gray-900/40 p-3 transition-colors {dragOverKey === r.key
						? 'border-blue-400 bg-blue-950/40 ring-2 ring-blue-500/40'
						: r.isNew
							? 'border-green-500/30'
							: 'border-gray-800'}"
				>
					<div class="flex flex-wrap items-center gap-3">
						<!-- מיקום + חיצי סדר -->
						<div class="flex items-center gap-1.5">
							<span
								class="w-7 text-center font-mono text-sm font-black tabular-nums {customOrder
									? 'text-purple-300'
									: 'text-gray-600'}">{i + 1}</span
							>
							{#if !isPinned(r)}
								<div class="flex flex-col">
									<button
										type="button"
										class="rounded px-1 text-gray-500 transition hover:bg-gray-800 hover:text-blue-300 disabled:opacity-25"
										disabled={i === 0}
										aria-label="העלאת {r.name} במעלה הסדר"
										onclick={() => move(i, -1)}>▲</button
									>
									<button
										type="button"
										class="rounded px-1 text-gray-500 transition hover:bg-gray-800 hover:text-blue-300 disabled:opacity-25"
										disabled={i >= rows.length - 1 || isPinned(rows[i + 1])}
										aria-label="הורדת {r.name} במורד הסדר"
										onclick={() => move(i, 1)}>▼</button
									>
								</div>
							{:else}
								<span class="px-1 text-xs text-gray-600" title="&quot;אחר&quot; תמיד אחרונה"
									>📌</span
								>
							{/if}
						</div>

						<!-- תצוגה מקדימה: קובץ שנבחר/נגרר וטרם נשמר גובר, אחריו התמונה
						     השמורה, ואחרת האימוג'י. המיקום והזום מוחלים גם כאן — מה
						     שרואים בשורה הוא מה שיהיה על האריח בדף הבית. -->
						<div
							class="relative grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-700 bg-gray-950/60 text-2xl"
						>
							{#if r.previewUrl}
								<img
									src={r.previewUrl}
									alt=""
									class="h-full w-full object-cover"
									use:adImgFit={{ x: r.fitX, y: r.fitY, z: r.fitZ }}
								/>
							{:else if r.image && !r.removeImage}
								<img
									src={r.image}
									alt=""
									class="h-full w-full object-cover"
									use:adImgFit={{ x: r.fitX, y: r.fitY, z: r.fitZ }}
								/>
							{:else}
								{r.icon}
							{/if}
						</div>

						<!-- שם + אימוג'י -->
						<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
							<input
								type="text"
								bind:value={r.name}
								maxlength="40"
								aria-label="שם הקטגוריה"
								class="w-full min-w-40 flex-1 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-sm font-bold text-gray-100 focus:border-blue-500/60 focus:outline-none sm:w-auto"
							/>
							<input
								type="text"
								bind:value={r.icon}
								maxlength="16"
								aria-label="אימוג'י הקטגוריה"
								placeholder="🏷️"
								class="w-16 rounded-lg border border-gray-700 bg-gray-900/60 px-2 py-1.5 text-center text-sm text-gray-100 focus:border-blue-500/60 focus:outline-none"
							/>
							{#if r.builtin && (r.name !== r.defaultName || r.icon !== r.defaultIcon)}
								<button
									type="button"
									class="text-[11px] text-gray-500 underline-offset-2 hover:text-blue-400 hover:underline"
									title={'לחזור אל "' + r.defaultName + '"'}
									onclick={() => restoreDefaults(r)}
								>
									שחזור ברירת מחדל
								</button>
							{/if}
						</div>

						<!-- מונה + תגיות -->
						<div class="flex flex-shrink-0 items-center gap-2 text-[11px]">
							{#if r.isNew}
								<span
									class="rounded-full border border-green-500/40 bg-green-900/30 px-2 py-0.5 font-bold text-green-300"
									>חדשה — תישמר בשמירה</span
								>
							{:else if r.count > 0}
								<span class="rounded-full bg-gray-800 px-2 py-0.5 font-bold text-gray-300"
									>{r.count} עסקים</span
								>
							{:else}
								<span
									class="rounded-full border border-dashed border-gray-700 px-2 py-0.5 text-gray-500"
									title="לא מוצגת במסילת דף הבית עד שיהיו בה עסקים">ריקה</span
								>
							{/if}
							{#if !r.builtin && !r.isNew}
								<span class="rounded-full bg-gray-800/70 px-2 py-0.5 text-gray-400"
									>נוספה מהמסך</span
								>
							{/if}
						</div>

						<!-- מחיקה (רק לקטגוריות שנוספו מהמסך) -->
						{#if !r.builtin}
							<button
								type="button"
								class="flex-shrink-0 rounded-lg border border-red-500/40 bg-red-950/40 px-2.5 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-900/50"
								onclick={() => removeRow(i)}
							>
								🗑 מחק
							</button>
						{/if}
					</div>

					<!-- תמונה -->
					<div class="mt-2 flex flex-wrap items-center gap-3 ps-9 text-xs text-gray-400">
						<label class="flex items-center gap-2">
							<span class="flex-shrink-0">{r.image ? 'החלפת תמונה:' : "תמונה במקום האימוג'י:"}</span
							>
							<input
								type="file"
								name={'img_' + i}
								accept="image/*"
								onchange={(e) => {
									const f = /** @type {HTMLInputElement} */ (e.currentTarget).files?.[0] ?? null;
									setPreview(r, f);
									if (f) {
										r.removeImage = false;
										r.dropError = '';
										centerFit(r);
										filesPicked = true;
									}
								}}
								class="block text-xs text-gray-400 file:me-2 file:rounded-lg file:border-0 file:bg-gray-700 file:px-2.5 file:py-1 file:text-gray-200"
							/>
						</label>
						<span class="text-gray-600 select-none" aria-hidden="true"
							>— או פשוט גררו תמונה על השורה</span
						>
						{#if r.removeImage && !r.previewUrl}
							<span class="font-bold text-red-300">
								התמונה תוסר בשמירה —
								<button
									type="button"
									class="underline underline-offset-2 hover:text-red-200"
									onclick={() => (r.removeImage = false)}>ביטול</button
								>
							</span>
						{/if}
						{#if r.dropError}
							<span class="font-bold text-red-400">{r.dropError}</span>
						{/if}
					</div>

					<!-- עורך מיקום + זום — מוצג כשיש תמונה על המסך -->
					{#if hasVisibleImage(r)}
						<div class="mt-2 flex flex-wrap items-center gap-3 ps-9">
							<div
								class="fit-box relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-gray-600 bg-gray-950/80 shadow-inner"
								title="גררו את התמונה כדי למקם אותה בתוך האריח"
								onpointerdown={(e) => panDown(e, r)}
								onpointermove={(e) => panMove(e, r)}
								onpointerup={panUp}
								onpointercancel={panUp}
							>
								<img
									src={r.previewUrl || r.image}
									alt=""
									draggable="false"
									class="h-full w-full object-cover"
									use:adImgFit={{ x: r.fitX, y: r.fitY, z: r.fitZ }}
								/>
							</div>
							<div class="flex flex-col gap-1.5 text-xs">
								<div class="flex items-center gap-1.5">
									<button
										type="button"
										class="fit-btn"
										aria-label="זום פנימה"
										onclick={() => zoomFit(r, 'in')}>🔍+</button
									>
									<button
										type="button"
										class="fit-btn"
										aria-label="זום החוצה"
										onclick={() => zoomFit(r, 'out')}>🔍−</button
									>
									<span class="w-10 text-center text-gray-500 tabular-nums"
										>{Math.round(r.fitZ * 100)}%</span
									>
								</div>
								<div class="flex items-center gap-1.5">
									<button type="button" class="fit-btn" onclick={() => centerFit(r)}>⌖ מרכז</button>
									<button
										type="button"
										class="fit-btn fit-btn--danger"
										onclick={() => removeRowImage(i)}>🗑 הסרה</button
									>
								</div>
								<p class="max-w-44 leading-snug text-gray-600">
									גררו את התמונה כדי למקם, וזום +/− כדי לקרב או להרחיק
								</p>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- הוספת קטגוריה -->
		<div class="mt-4 rounded-2xl border border-dashed border-gray-700 bg-gray-900/30 p-4">
			<p class="mb-2 text-sm font-bold text-gray-300">➕ קטגוריה חדשה</p>
			<div class="flex flex-wrap items-center gap-2">
				<input
					type="text"
					bind:value={newName}
					maxlength="40"
					placeholder="שם הקטגוריה…"
					aria-label="שם הקטגוריה החדשה"
					class="w-full min-w-40 flex-1 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:outline-none sm:w-auto"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addRow();
						}
					}}
				/>
				<input
					type="text"
					bind:value={newIcon}
					maxlength="16"
					placeholder="🏷️"
					aria-label="אימוג'י הקטגוריה החדשה"
					class="w-16 rounded-lg border border-gray-700 bg-gray-900/60 px-2 py-2 text-center text-sm text-gray-100 focus:border-blue-500/60 focus:outline-none"
				/>
				<button
					type="button"
					onclick={addRow}
					class="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700"
				>
					הוסף
				</button>
			</div>
			{#if addError}<p class="mt-1.5 text-xs text-red-400">{addError}</p>{/if}
			<p class="mt-2 text-[11px] text-gray-500">
				הקטגוריה תופיע מיד בטופס ההגשה; במסילת דף הבית — ברגע שתסווג אליה כרטיסייה ראשונה. תמונה
				אפשר לצרף בשורה שלה אחרי ההוספה.
			</p>
		</div>

		<!-- שמירה -->
		<div
			class="sticky bottom-3 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-700 bg-gray-950/95 p-3 shadow-2xl backdrop-blur"
		>
			<p class="text-xs {dirty ? 'font-bold text-amber-300' : 'text-gray-500'}">
				{dirty ? '⚠ יש שינויים שטרם נשמרו' : 'אין שינויים שממתינים לשמירה'}
			</p>
			<button
				disabled={saving}
				class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
			>
				{saving ? 'שומר…' : '💾 שמירת הקטגוריות'}
			</button>
		</div>
	</form>

	<!-- תוויות חופשיות שהוקלדו ידנית על כרטיסיות -->
	{#if freeLabels.length}
		<section class="mt-8">
			<h2 class="mb-2 text-sm font-bold text-gray-300">תוויות חופשיות בכרטיסיות</h2>
			<p class="mb-3 text-xs text-gray-500">
				קטגוריות שהוקלדו ידנית על כרטיסיות ואינן ברשימה. הן מוצגות במסילה אחרי הקטגוריות המסודרות;
				כדי לאחד אותן עם קטגוריה קיימת — ערכו את הכרטיסייה עצמה.
			</p>
			<div class="flex flex-wrap gap-2">
				{#each freeLabels as [label, count] (label)}
					<span
						class="rounded-full border border-gray-700 bg-gray-900/60 px-3 py-1 text-xs text-gray-300"
					>
						{label} · {count}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<!-- איפוס -->
	<section class="mt-8 rounded-2xl border border-red-500/20 bg-red-950/10 p-4">
		<h2 class="mb-1 text-sm font-bold text-red-300">איפוס מלא</h2>
		<p class="mb-3 text-xs text-gray-500">
			מחיקת כל ההתאמות — שמות, אימוג'ים, תמונות, סדר וקטגוריות שנוספו — וחזרה לברירת המחדל שבקוד.
			הכרטיסיות עצמן לא נפגעות.
		</p>
		<form method="POST" action="?/reset" use:enhance={submitFn('reset')}>
			<button
				disabled={resetting}
				class="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-900/50 disabled:opacity-40"
			>
				{resetting ? 'מאפס…' : '♻ איפוס לברירת המחדל'}
			</button>
		</form>
	</section>
</main>

<style>
	/* עורך מיקום התמונה — הגרירה ממקמת, לא גוללת */
	.fit-box {
		cursor: grab;
		touch-action: none;
	}
	.fit-box:active {
		cursor: grabbing;
	}
	.fit-btn {
		border: 1px solid #374151; /* gray-700 */
		background: rgba(31, 41, 55, 0.7); /* gray-800 */
		color: #d1d5db; /* gray-300 */
		border-radius: 0.5rem;
		padding: 0.3rem 0.6rem;
		font-weight: 700;
		transition: background 0.15s ease;
	}
	.fit-btn:hover {
		background: #374151;
	}
	.fit-btn--danger {
		border-color: rgba(239, 68, 68, 0.4); /* red-500/40 */
		background: rgba(69, 10, 10, 0.4); /* red-950/40 */
		color: #fca5a5; /* red-300 */
	}
	.fit-btn--danger:hover {
		background: rgba(127, 29, 29, 0.5); /* red-900/50 */
	}
</style>
