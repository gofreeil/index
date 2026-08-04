<script>
	// ============================================================
	// כרטיס "סטטיסטיקת כניסות" (נתוני Google Analytics) — רכיב משותף.
	// פורט מהגמ"ח הארצי. מוצג בשני מקומות: פרוס בפאנל שבאזור האישי
	// (/profile#admin) ובמסך הייעודי /admin/stats — כדי שהנתונים יהיו
	// מול העיניים בלי לחיצה נוספת.
	// מציג מספר אחד לכל חודש — צפיות (screenPageViews).
	// ============================================================

	/**
	 * @typedef {Object} MonthRow
	 * @property {string} yearMonth YYYYMM כפי שמוחזר מ-GA, למשל "202608"
	 * @property {number} visitors
	 * @property {number} pageViews
	 */

	let {
		/** @type {MonthRow[]|null} null = GA לא זמין; [] = אין עדיין נתונים */
		months,
		/** @type {number|null} */
		updatedAt = null,
		/** true כשהכרטיס יושב בתוך כרטיס אחר (למשל באזור האישי) */
		nested = false,
		/** כשמוגדר — כל הכרטיס הופך לקישור לפירוט המלא */
		href = null,
		/** האם GA מוגדר בכלל — משנה את הודעת ה"לא זמין" להנחיית התקנה */
		configured = true
	} = $props();

	// GA מחזיר ישן→חדש; הגרף נשאר כרונולוגי, הפירוט מוצג חדש→ישן
	const chartMonths = $derived(months ?? []);
	const listMonths = $derived([...(months ?? [])].reverse());
	const maxViews = $derived(
		Math.max(1, ...chartMonths.map((/** @type {MonthRow} */ m) => m.pageViews))
	);

	const fmt = new Intl.NumberFormat('he-IL');
	const now = new Date();
	const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

	/** "202608" → "אוגוסט 2026" @param {string} ym */
	function monthLabel(ym) {
		const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
		return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d);
	}

	/** "202608" → "8/26" (לציר החודשים) @param {string} ym */
	const monthShort = (ym) => `${Number(ym.slice(4, 6))}/${ym.slice(2, 4)}`;

	/** @param {number} ts */
	function updatedAgo(ts) {
		const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
		if (mins < 1) return 'עכשיו';
		if (mins < 60) return `לפני ${mins} דק׳`;
		return `לפני ${Math.round(mins / 60)} שע׳`;
	}
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	href={href ?? undefined}
	class="block space-y-3 rounded-2xl border p-4 {nested
		? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50'
		: 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'} {href
		? 'transition-colors hover:border-blue-400 dark:hover:border-blue-500/60'
		: ''}"
>
	<div>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-base font-extrabold text-gray-900 dark:text-gray-100">📈 סטטיסטיקת כניסות</h2>
			{#if href}<span class="text-xs font-bold text-blue-600 dark:text-blue-400">לפירוט המלא ←</span
				>{/if}
		</div>
		<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
			כמה צפיות היו לאתר בכל חודש (מתוך Google Analytics). הנתונים מתעדכנים אחת לשעה.
			{#if updatedAt}<span class="text-gray-400 dark:text-gray-500"
					>עודכן {updatedAgo(updatedAt)}.</span
				>{/if}
		</p>
	</div>

	{#if !configured}
		<div
			class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
		>
			Google Analytics עדיין לא מחובר לאתר. אחרי הגדרת משתני הסביבה
			<code class="mx-1 rounded bg-black/10 px-1 dark:bg-white/10">GA_PROPERTY_ID</code>
			ופרטי ה-service account, הנתונים יופיעו כאן מעצמם.
		</div>
	{:else if months === null}
		<div
			class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200"
		>
			נתוני Google Analytics אינם זמינים כרגע — נסו לרענן בעוד רגע.
		</div>
	{:else if chartMonths.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400">
			אין עדיין נתונים — הם יופיעו אחרי שהאתר יצבור תנועה.
		</p>
	{:else}
		<!-- גרף עמודות — צפיות לפי חודש, כרונולוגי. מוצג רק כשיש לפחות שני
		     חודשים להשוואה; חודש בודד הוא מלבן ענק שכבר מיוצג בפירוט. -->
		{#if chartMonths.length > 1}
			<div class="flex items-stretch justify-center gap-1.5">
				{#each chartMonths as m (m.yearMonth)}
					<div
						class="flex max-w-16 min-w-0 flex-1 flex-col items-center"
						title="{monthLabel(m.yearMonth)}: {fmt.format(m.pageViews)} צפיות"
					>
						<div class="mb-1 text-[10px] font-bold text-gray-500 tabular-nums dark:text-gray-300">
							{fmt.format(m.pageViews)}
						</div>
						<div class="flex h-24 w-full items-end">
							<div
								class="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-purple-500 transition-all {m.yearMonth ===
								currentYm
									? 'shadow-[0_0_12px_rgba(59,130,246,0.5)]'
									: ''}"
								style="height: {Math.max(4, Math.round((m.pageViews / maxViews) * 100))}%"
							></div>
						</div>
						<div
							class="mt-1 text-[10px] whitespace-nowrap {m.yearMonth === currentYm
								? 'font-bold text-blue-600 dark:text-blue-400'
								: 'text-gray-500 dark:text-gray-400'}"
						>
							{monthShort(m.yearMonth)}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- פירוט חודשי — חדש→ישן -->
		<div
			class="space-y-2 {chartMonths.length > 1
				? 'border-t border-gray-200 pt-3 dark:border-gray-700'
				: ''}"
		>
			{#each listMonths as m (m.yearMonth)}
				<div class="flex items-center gap-3">
					<div class="w-24 flex-shrink-0 text-xs font-bold text-gray-900 dark:text-gray-100">
						{monthLabel(m.yearMonth)}
						{#if m.yearMonth === currentYm}
							<span class="mt-0.5 block text-[10px] font-semibold text-blue-600 dark:text-blue-400">
								● מתעדכן
							</span>
						{/if}
					</div>
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-900">
						<div
							class="h-full rounded-full bg-gradient-to-l from-blue-600 to-purple-500"
							style="width:{Math.max(3, Math.round((m.pageViews / maxViews) * 100))}%"
						></div>
					</div>
					<div
						class="w-20 flex-shrink-0 text-left text-xs font-extrabold text-blue-600 dark:text-blue-400"
					>
						{fmt.format(m.pageViews)} צפיות
					</div>
				</div>
			{/each}
		</div>
	{/if}
</svelte:element>
