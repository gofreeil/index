<script>
	// פורט של מסך "אישור פרסומות" מ-community/my_new_project (admin/ads-review).
	// הותאם ל-index: JS במקום TS, חיפוש פשוט במקום heMatches, מחיקה לסופר-אדמין בלבד.
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
	import { AD_SLOT_COUNT } from '$lib/adSlots.js';
	import AdCardPreview from '$lib/components/AdCardPreview.svelte';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	/** @type {'pending'|'approved'|'rejected'} */
	let activeTab = $state('pending');
	let searchQuery = $state('');
	// 'display' = הסדר שבו הפרסומות מוצגות באתר. רק בו אפשר להחליף מקום,
	// אחרת החצים היו מזיזים ביחס לתצוגה אחרת ממה שהגולש רואה.
	/** @type {'display'|'newest'|'oldest'} */
	let sortOrder = $state('display');
	const canReorder = $derived(sortOrder === 'display' && !searchQuery.trim());
	// תקופות הפרסום שאפשר לקצוב מטבלת התזמון (נספרות מיום הפרסום)
	const DURATION_OPTIONS = [7, 14, 30, 60, 90, 180, 365];
	// 12 המקומות הממוספרים בטור הפרסומות — בורר המקום בטבלת התזמון
	const SLOT_NUMBERS = Array.from({ length: AD_SLOT_COUNT }, (_, i) => i + 1);

	/** מספר המקום של פרסומת מאושרת; לממתינות/נדחות אין מקום
	 *  @param {any} ad @param {number} fallback */
	function slotOf(ad, fallback) {
		return typeof ad?.slot === 'number' ? ad.slot : fallback;
	}

	// מי תופסת כל מקום בטור — גם מושהית/פגה שומרת את המקום שלה
	const slotOccupants = $derived(
		new Map(
			data.schedules
				.filter((/** @type {any} */ s) => typeof s.slot === 'number')
				.map((/** @type {any} */ s) => [s.slot, { id: s.id, title: s.title }])
		)
	);
	/** @param {string} t */
	function shortTitle(t) {
		return t.length > 22 ? t.slice(0, 21) + '…' : t;
	}
	// הטור מציג רביעייה עוקבת אחת בכל רגע (1-4, אחריה 5-8... — ראו RightAdBanner).
	// הסימון כאן משקף את זה: צבע לכל רביעייה (= מה שמוצג יחד), אות לרביעייה
	// ושם-מיקום בתוך הרביעייה (רקע בהיר בלבד — כהה נשבר בהדגשת המערכת)
	const GROUP_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];
	const POS_NAMES = ['עליונה', 'שנייה', 'שלישית', 'תחתונה'];
	/** @param {number} n */
	function slotGroup(n) {
		return Math.ceil(n / 4);
	}
	/** @param {number} n */
	function slotGroupLetter(n) {
		return GROUP_LETTERS[slotGroup(n) - 1] ?? String(slotGroup(n));
	}
	/** @param {number} n */
	function slotPosName(n) {
		return POS_NAMES[(n - 1) % 4];
	}
	/** @param {number} n */
	function slotOptionBg(n) {
		const g = slotGroup(n) % 4;
		if (g === 1) return '#dbeafe';
		if (g === 2) return '#dcfce7';
		if (g === 3) return '#fef9c3';
		return '#f3e8ff';
	}
	/** אפשרויות הבורר מקובצות לרביעיות — כל קבוצה מקבלת כותרת optgroup משלה
	 *  @param {number[]} options */
	function groupSlotOptions(options) {
		/** @type {Map<number, number[]>} */
		const byGroup = new Map();
		for (const n of options) {
			const g = slotGroup(n);
			byGroup.set(g, [...(byGroup.get(g) ?? []), n]);
		}
		return [...byGroup.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([g, nums]) => ({ letter: GROUP_LETTERS[g - 1] ?? String(g), nums }));
	}
	/** תווית אפשרות בבורר המקום: מספר + מיקום ברביעייה; מקום תפוס מסומן עם שם הפרסומת שיושבת בו
	 *  @param {number} n @param {string} selfId */
	function slotOptionLabel(n, selfId) {
		const base = `${n} · ${slotPosName(n)}`;
		const occ = slotOccupants.get(n);
		if (!occ) return `${base} — פנוי`;
		if (occ.id === selfId) return `${base} — המקום הנוכחי`;
		return `${base} ⚠ ${shortTitle(occ.title)}`;
	}
	// אזהרה חיה מתחת לבורר ברגע שנבחר מקום תפוס (לפי מזהה השורה)
	/** @type {Record<string, string>} */
	let slotWarning = $state({});
	/** @param {Event} e @param {{id: string}} self */
	function onSlotPick(e, self) {
		const n = Number(/** @type {HTMLSelectElement} */ (e.currentTarget).value);
		const occ = slotOccupants.get(n);
		slotWarning = {
			...slotWarning,
			[self.id]:
				occ && occ.id !== self.id
					? `מקום ${n} תפוס ע"י "${shortTitle(occ.title)}" — לחיצה על "העבר" תחליף ביניהן`
					: ''
		};
	}
	/** אישור אחרון לפני העברה למקום תפוס — אישור = החלפה, ביטול = כלום לא זז
	 *  @param {MouseEvent} e @param {{id: string, title: string, slot?: number|null}} self */
	function confirmSlotMove(e, self) {
		const btnForm = /** @type {HTMLButtonElement} */ (e.currentTarget).form;
		const sel = /** @type {HTMLSelectElement|null} */ (btnForm?.elements.namedItem('slot'));
		const n = Number(sel?.value);
		const occ = slotOccupants.get(n);
		if (!occ || occ.id === self.id) return;
		const ok = confirm(
			`⚠ מקום ${n} כבר תפוס על ידי "${occ.title}".\n\n` +
				`אישור — החלפה: "${self.title}" תעבור למקום ${n}, ו"${occ.title}" תעבור למקום ${self.slot ?? '-'}.\n` +
				`ביטול — ההעברה מתבטלת ושתי הפרסומות נשארות במקומן.`
		);
		if (!ok) e.preventDefault();
	}

	// תצוגה מקדימה של הכרטיס כפי שהוא באמת מוצג בטור הפרסומות באתר:
	// ריחוף על הכותרת בטבלת התזמון (דסקטופ) או הקשה עליה (נייד/דסקטופ)
	const approvedById = $derived(
		new Map(data.approved.map((/** @type {any} */ a) => [a.id, a]))
	);
	/** @type {{id: string, x: number, y: number}|null} */
	let hoverPreview = $state(null);
	/** @type {string|null} */
	let modalPreviewId = $state(null);
	const PREVIEW_W = 144; // w-36 — רוחב הכרטיס האמיתי בטור
	const PREVIEW_H = 490; // aspect-[144/450] + רצועת ה-CTA
	/** @param {MouseEvent} e @param {string} id */
	function openHoverPreview(e, id) {
		if (!approvedById.has(id)) return;
		// מסך מגע — אין ריחוף אמיתי; ההקשה פותחת את המודאל במקום
		if (window.matchMedia('(hover: none)').matches) return;
		const r = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
		// הכרטיס צף משמאל לתא, מוצמד לגבולות המסך — מחוץ למכל הגלילה של
		// הטבלה (fixed), אחרת ה-overflow היה חותך אותו
		const y = Math.max(
			8,
			Math.min(window.innerHeight - PREVIEW_H - 8, r.top + r.height / 2 - PREVIEW_H / 2)
		);
		const x = Math.max(8, r.left - PREVIEW_W - 16);
		hoverPreview = { id, x, y };
	}

	// בחירה רב-פריטית (SvelteSet — ריאקטיבי לשינויים במקום)
	const selected = new SvelteSet();
	/** @param {string} id */
	function toggleSelect(id) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}
	function clearSelection() {
		selected.clear();
	}
	/** @param {string[]} ids */
	function selectAllVisible(ids) {
		for (const id of ids) selected.add(id);
	}

	// עריכה בשורה
	/** @type {string|null} */
	let editingId = $state(null);
	let editTitle = $state('');
	let editSubtitle = $state('');
	let editCta = $state('');
	let editHover = $state('');
	/** @param {any} ad */
	function startEdit(ad) {
		editingId = ad.id;
		editTitle = ad.title ?? '';
		editSubtitle = ad.subtitle ?? '';
		editCta = ad.cta ?? '';
		editHover = ad.hoverText ?? '';
	}
	function cancelEdit() {
		editingId = null;
	}

	// רענון אוטומטי כל 30 שניות (כדי לראות פרסומות חדשות שנכנסות מהבילדר)
	let autoRefresh = $state(true);
	/** @type {ReturnType<typeof setInterval>|null} */
	let refreshTimer = null;
	onMount(() => {
		refreshTimer = setInterval(() => {
			if (autoRefresh && document.visibilityState === 'visible') invalidateAll();
		}, 30000);
	});
	onDestroy(() => {
		if (refreshTimer) clearInterval(refreshTimer);
	});

	/** @param {any[]} list */
	function applyFilter(list) {
		const q = searchQuery.trim().toLowerCase();
		const filtered = q
			? list.filter((a) =>
					[a.title, a.subtitle, a.submittedBy?.email, a.submittedBy?.name].some((v) =>
						String(v || '')
							.toLowerCase()
							.includes(q)
					)
				)
			: list;
		// הסדר מהשרת = סדר התצוגה באתר (מיקום ידני, ואחריו החדשות ביותר)
		if (sortOrder === 'display') return [...filtered];
		return [...filtered].sort((x, y) => {
			const xt = new Date(x.submittedAt).getTime();
			const yt = new Date(y.submittedAt).getTime();
			return sortOrder === 'newest' ? yt - xt : xt - yt;
		});
	}

	const pendingList = $derived(
		applyFilter(data.pending.filter((/** @type {any} */ p) => p.status === 'pending'))
	);
	const rejectedList = $derived(
		applyFilter(data.pending.filter((/** @type {any} */ p) => p.status === 'rejected'))
	);
	const approvedList = $derived(applyFilter(data.approved));

	const visibleList = $derived(
		activeTab === 'pending' ? pendingList : activeTab === 'approved' ? approvedList : rejectedList
	);

	const visibleSelectedIds = $derived(
		Array.from(selected).filter((id) => visibleList.some((/** @type {any} */ a) => a.id === id))
	);

	/** @param {string} [s] */
	function fmtDate(s) {
		if (!s) return '';
		return new Date(s).toLocaleString('he-IL', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/** @param {string} [s] */
	function fmtDateOnly(s) {
		if (!s) return '';
		return new Date(s).toLocaleDateString('he-IL', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit'
		});
	}

	/** @param {string} [s] */
	function fmtTimeOnly(s) {
		if (!s) return '';
		return new Date(s).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
	}

	// חלון הקציבה: כל פרטי התקופה והתשלום של הפרסומת + קציבה מהירה
	// במסלולים או תאריך תפוגה שרירותי. נפתח מכפתור "קצוב" בטבלת התזמון.
	/** @type {any} */
	let durationModal = $state(null);
	/** תאריך ISO → ערך של <input type="date">. @param {string} [iso] */
	const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');
	/** סגירת החלון עם שליחת טופס מתוכו — הנתונים כבר נתפסו ע"י enhance */
	function closeOnSubmit() {
		durationModal = null;
		return async (/** @type {{ update: () => Promise<void> }} */ { update }) => update();
	}
</script>

<svelte:head>
	<title>אישור פרסומות — פאנל ניהול</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- הכותרת, הזהות וסרגל הניווט יושבים ב-admin/+layout.svelte — כאן רק התוכן -->
<div class="pb-10" dir="rtl">
	<!-- כותרת + ניווט -->
	<header class="mb-5 flex flex-wrap items-start justify-between gap-3 md:mb-6">
		<div class="min-w-0">
			<h1 class="mb-1 text-2xl font-black text-white md:text-3xl">📢 אישור פרסומות</h1>
			<p class="text-xs text-gray-400 md:text-sm">
				פרסומות שנשלחו דרך בילדר הפרסומות — אשר/דחה לפני פרסום בסרגל הצד של האתר.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/admin"
				class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/10"
			>
				← לפאנל הניהול
			</a>
			<button
				type="button"
				onclick={() => invalidateAll()}
				class="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
				title="רענן עכשיו"
			>
				🔄 רענן
			</button>
			<label class="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
				<input type="checkbox" bind:checked={autoRefresh} class="accent-amber-500" />
				רענון אוטומטי
			</label>
		</div>
	</header>

	{#if data.backendUnavailable}
		<div
			class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
		>
			⚠️ הבאקאנד (Strapi) לא זמין כרגע — הרשימות והסטטיסטיקות עשויות להיות חלקיות. נסה לרענן בעוד
			רגע.
		</div>
	{/if}

	<!-- סטטיסטיקות -->
	<section class="mb-5 grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
		<div class="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-center">
			<div class="text-[10px] font-bold tracking-wide text-amber-300 uppercase md:text-xs">
				ממתינות
			</div>
			<div class="text-2xl font-black text-amber-200 md:text-3xl">{data.stats.pending}</div>
		</div>
		<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-center">
			<div class="text-[10px] font-bold tracking-wide text-emerald-300 uppercase md:text-xs">
				פורסמו
			</div>
			<div class="text-2xl font-black text-emerald-200 md:text-3xl">{data.stats.approved}</div>
		</div>
		<div class="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-center">
			<div class="text-[10px] font-bold tracking-wide text-red-300 uppercase md:text-xs">נדחו</div>
			<div class="text-2xl font-black text-red-200 md:text-3xl">{data.stats.rejected}</div>
		</div>
		<div class="rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-2.5 text-center">
			<div class="text-[10px] font-bold tracking-wide text-blue-300 uppercase md:text-xs">
				השבוע נשלחו
			</div>
			<div class="text-2xl font-black text-blue-200 md:text-3xl">
				{data.stats.submittedThisWeek}
			</div>
		</div>
		<div
			class="col-span-2 rounded-xl border border-purple-500/30 bg-purple-500/5 px-3 py-2.5 text-center md:col-span-1"
		>
			<div class="text-[10px] font-bold tracking-wide text-purple-300 uppercase md:text-xs">
				השבוע אושרו
			</div>
			<div class="text-2xl font-black text-purple-200 md:text-3xl">
				{data.stats.approvedThisWeek}
			</div>
		</div>
	</section>

	<!-- הודעות -->
	{#if form?.success}
		<div
			class="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
		>
			✅ {form.message}
		</div>
	{/if}
	{#if form?.error}
		<div
			class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
		>
			❌ {form.error}
		</div>
	{/if}

	<!-- טאבים -->
	<div class="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:gap-2">
		<button
			type="button"
			onclick={() => {
				activeTab = 'pending';
				clearSelection();
			}}
			class="rounded-xl px-4 py-2 text-sm font-black whitespace-nowrap transition-all
				{activeTab === 'pending'
				? 'bg-amber-500 text-black'
				: 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}"
		>
			⏳ ממתינות ({data.stats.pending})
		</button>
		<button
			type="button"
			onclick={() => {
				activeTab = 'approved';
				clearSelection();
			}}
			class="rounded-xl px-4 py-2 text-sm font-black whitespace-nowrap transition-all
				{activeTab === 'approved'
				? 'bg-emerald-500 text-black'
				: 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}"
		>
			✅ פורסמו ({data.stats.approved})
		</button>
		<button
			type="button"
			onclick={() => {
				activeTab = 'rejected';
				clearSelection();
			}}
			class="rounded-xl px-4 py-2 text-sm font-black whitespace-nowrap transition-all
				{activeTab === 'rejected'
				? 'bg-red-500 text-white'
				: 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}"
		>
			❌ נדחו ({data.stats.rejected})
		</button>
	</div>

	<!-- חיפוש + מיון -->
	<div class="mb-4 flex flex-wrap gap-2 md:gap-3">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="🔎 חיפוש לפי כותרת, תיאור או מגיש..."
			class="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/50 focus:outline-none"
		/>
		<select
			bind:value={sortOrder}
			class="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:outline-none"
		>
			<option value="display" style="background:#fff;color:#111">סדר התצוגה באתר</option>
			<option value="newest" style="background:#fff;color:#111">חדש לישן</option>
			<option value="oldest" style="background:#fff;color:#111">ישן לחדש</option>
		</select>
	</div>

	<!-- שורת בחירה רב-פריטית (רק ב-pending) -->
	{#if activeTab === 'pending' && visibleList.length > 0}
		<div
			class="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
		>
			<button
				type="button"
				onclick={() => selectAllVisible(visibleList.map((/** @type {any} */ a) => a.id))}
				class="text-xs font-bold text-amber-300 hover:text-amber-200"
			>
				בחר הכל ({visibleList.length})
			</button>
			<span class="text-xs text-gray-600">·</span>
			<button
				type="button"
				onclick={clearSelection}
				class="text-xs font-bold text-gray-400 hover:text-gray-300"
			>
				נקה
			</button>
			{#if visibleSelectedIds.length > 0}
				<span class="mr-2 text-xs text-gray-300">נבחרו {visibleSelectedIds.length}</span>
				<form
					method="POST"
					action="?/bulkApprove"
					use:enhance={() =>
						async ({ update }) => {
							clearSelection();
							await update();
						}}
					class="inline-flex"
				>
					<input type="hidden" name="ids" value={visibleSelectedIds.join(',')} />
					<button
						type="submit"
						class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-black hover:bg-emerald-400"
					>
						✅ אשר את הנבחרים
					</button>
				</form>
				<form
					method="POST"
					action="?/bulkReject"
					use:enhance={() =>
						async ({ update }) => {
							clearSelection();
							await update();
						}}
					class="inline-flex gap-1"
				>
					<input type="hidden" name="ids" value={visibleSelectedIds.join(',')} />
					<input
						type="text"
						name="reason"
						placeholder="סיבת דחייה (אופציונלי)"
						class="w-40 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white"
					/>
					<button
						type="submit"
						class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-500"
					>
						❌ דחה את הנבחרים
					</button>
				</form>
			{/if}
		</div>
	{/if}

	<!-- רשימה -->
	{#if visibleList.length === 0}
		<div
			class="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-gray-500 italic"
		>
			{searchQuery
				? 'לא נמצאו תוצאות לחיפוש'
				: activeTab === 'pending'
					? 'אין פרסומות שממתינות לאישור'
					: activeTab === 'approved'
						? 'עוד לא פורסמו פרסומות'
						: 'אין פרסומות שנדחו'}
		</div>
	{:else}
		<div class="grid gap-3 md:gap-4">
			{#each visibleList as ad, adIndex (ad.id)}
				<article class="rounded-2xl border border-white/10 bg-white/5 p-3 md:p-5">
					{#if activeTab === 'approved'}
						<!-- מיקום הפרסומת בטור הפרסומות באתר + החלפת מקום -->
						<div class="mb-3 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
							<span
								class="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-black/20 px-1.5 text-sm font-black whitespace-nowrap"
								style="background:{slotOptionBg(slotOf(ad, adIndex + 1))};color:#111"
								title="רביעייה {slotGroupLetter(slotOf(ad, adIndex + 1))}׳ · הכרטיס ה{slotPosName(slotOf(ad, adIndex + 1))} בה"
							>
								{slotOf(ad, adIndex + 1)} · {slotGroupLetter(slotOf(ad, adIndex + 1))}׳
							</span>
							<span class="text-[11px] font-bold text-gray-400 md:text-xs">
								מקום {slotOf(ad, adIndex + 1)} מתוך {AD_SLOT_COUNT} בטור הפרסומות
							</span>
							{#if canReorder}
								<div class="mr-auto flex items-center gap-1.5">
									<form method="POST" action="?/move" use:enhance>
										<input type="hidden" name="id" value={ad.id} />
										<input type="hidden" name="dir" value="up" />
										<button
											type="submit"
											disabled={adIndex === 0}
											class="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-gray-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
											title="העלה מקום אחד למעלה">▲ למעלה</button
										>
									</form>
									<form method="POST" action="?/move" use:enhance>
										<input type="hidden" name="id" value={ad.id} />
										<input type="hidden" name="dir" value="down" />
										<button
											type="submit"
											disabled={adIndex === visibleList.length - 1}
											class="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-gray-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
											title="הורד מקום אחד למטה">▼ למטה</button
										>
									</form>
								</div>
							{:else}
								<span class="mr-auto text-[10px] text-gray-500">
									כדי להחליף מקום - בחר מיון "סדר התצוגה באתר" ונקה את החיפוש
								</span>
							{/if}
						</div>
					{/if}
					<div class="flex flex-col gap-3 md:flex-row md:gap-4">
						{#if activeTab === 'pending'}
							<label class="inline-flex flex-shrink-0 cursor-pointer items-start pt-1">
								<input
									type="checkbox"
									checked={selected.has(ad.id)}
									onchange={() => toggleSelect(ad.id)}
									class="h-5 w-5 accent-amber-500"
								/>
							</label>
						{/if}

						{#if ad.mainImage}
							<!-- אותו מיקום/זום שהמפרסם קבע — המנהל מאשר את מה שבאמת יוצג -->
							<div
								class="relative h-32 w-full flex-shrink-0 overflow-hidden rounded-xl border border-white/10 md:h-40 md:w-40"
							>
								<img
									src={ad.mainImage}
									alt={ad.title}
									class="h-full w-full object-cover"
									use:adImgFit={parseAdImageFit(ad.mainImageFit)}
								/>
							</div>
						{/if}

						<div class="min-w-0 flex-1">
							{#if editingId === ad.id}
								<form
									method="POST"
									action="?/update"
									use:enhance={() =>
										async ({ update }) => {
											editingId = null;
											await update();
										}}
									class="space-y-2"
								>
									<input type="hidden" name="id" value={ad.id} />
									<input
										type="text"
										name="title"
										bind:value={editTitle}
										class="w-full rounded-lg border border-amber-400/40 bg-black/40 px-3 py-1.5 text-base font-bold text-white"
									/>
									<input
										type="text"
										name="subtitle"
										bind:value={editSubtitle}
										class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
									/>
									<input
										type="text"
										name="cta"
										bind:value={editCta}
										placeholder="טקסט CTA"
										class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white"
									/>
									<input
										type="text"
										name="hoverText"
										bind:value={editHover}
										placeholder="טקסט hover"
										class="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white"
									/>
									<div class="flex gap-2">
										<button
											type="submit"
											class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-black"
										>
											💾 שמור
										</button>
										<button
											type="button"
											onclick={cancelEdit}
											class="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-gray-300"
										>
											ביטול
										</button>
									</div>
								</form>
							{:else}
								<div class="mb-1 flex flex-wrap items-center gap-2">
									<h3 class="text-base font-black text-white md:text-lg">{ad.title}</h3>
									{#if ad.payment === 'code'}
										<span
											class="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-emerald-300"
											>💳 קוד תנועה — כמו שולם</span
										>
									{:else if ad.codeRequested}
										<!-- הקוד הוא בקשה בלבד. הניסוח חייב לומר במפורש שלא שולם,
										     אחרת מאשרים פרסומת בהנחה שנכנס כסף. -->
										<span
											class="rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-sky-300"
											>🎟️ ביקש חינם עם קוד — לא שולם</span
										>
									{:else}
										<span
											class="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-amber-300"
											>⌛ תשלום לתיאום</span
										>
									{/if}
								</div>
								<!-- מפרסם חוזר ששיפר את הפרסומת שלו: לא בקשה חדשה אלא גרסה
								     מעודכנת, והאישור מחליף את הישנה במקום להוסיף פרסומת שנייה -->
								{#if ad.replacesAdId && ad.status === 'pending'}
									{@const prevLive = (data.approved ?? []).some(
										(/** @type {any} */ o) => o.id === ad.replacesAdId
									)}
									<div
										class="mb-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-2.5 py-1.5"
									>
										<p class="m-0 text-[11px] font-black text-blue-200 md:text-xs">
											🔄 עדכון לפרסומת קיימת{ad.replacesTitle
												? ` — גרסה קודמת: "${ad.replacesTitle}"`
												: ''}
										</p>
										<p class="m-0 mt-0.5 text-[10px] text-blue-100/70 md:text-[11px]">
											{prevLive
												? 'עם האישור הגרסה הזו נכנסת במקום הישנה, באותו מקום בטור ועם אותו תאריך סיום — הישנה יורדת מהאתר.'
												: 'למפרסם אין כרגע פרסומת פעילה על האתר — האישור פשוט יפרסם את הגרסה הזו.'}
										</p>
									</div>
								{:else if ad.supersededBy}
									<div class="mb-2 rounded-lg border border-gray-500/40 bg-white/5 px-2.5 py-1.5">
										<p class="m-0 text-[11px] font-black text-gray-300 md:text-xs">
											🔄 גרסה ישנה — הוחלפה בגרסה מעודכנת של המפרסם
										</p>
									</div>
								{/if}
								<p class="mb-1 text-xs text-gray-300 md:text-sm">{ad.subtitle}</p>
								{#if ad.cta}
									<p class="mb-2 text-[10px] text-amber-300 md:text-xs">CTA: {ad.cta}</p>
								{/if}
								{#if ad.hoverText}
									<p class="mb-2 text-[10px] text-gray-500 md:text-xs">Hover: {ad.hoverText}</p>
								{/if}
								<div class="space-y-0.5 text-[10px] text-gray-400 md:text-xs">
									{#if ad.submittedBy?.email}<div>📧 {ad.submittedBy.email}</div>{/if}
									<div>📅 נשלח: {fmtDate(ad.submittedAt)}</div>
									{#if ad.decidedAt}<div>
											🕒 הוחלט: {fmtDate(ad.decidedAt)}{ad.decidedBy ? ` · ${ad.decidedBy}` : ''}
										</div>{/if}
									{#if ad.landing?.phone}<div>☎️ {ad.landing.phone}</div>{/if}
									{#if ad.landing?.website}<div>🌐 {ad.landing.website}</div>{/if}
									{#if ad.landing?.address}<div>📍 {ad.landing.address}</div>{/if}
									{#if ad.rejectionReason}<div class="text-red-300">
											❌ סיבת דחייה: {ad.rejectionReason}
										</div>{/if}
								</div>
							{/if}
						</div>
					</div>

					{#if editingId !== ad.id}
						<details class="mt-3 text-xs text-gray-300">
							<summary class="cursor-pointer font-bold text-amber-300"
								>תצוגה מקדימה של דף הנחיתה</summary
							>
							<div class="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/40 p-3">
								{#if ad.landing?.headline}<p class="font-bold text-white">
										{ad.landing.headline}
									</p>{/if}
								{#if ad.landing?.pitch}<p>{ad.landing.pitch}</p>{/if}
								{#if ad.landing?.advantages?.some((/** @type {string} */ a) => a?.trim())}
									<ul class="list-disc pr-5">
										{#each ad.landing.advantages as a, i (i)}
											{#if a?.trim()}<li>{a}</li>{/if}
										{/each}
									</ul>
								{/if}
								<a
									href={`/ads/${ad.id}`}
									target="_blank"
									rel="noopener"
									class="mt-2 inline-block rounded-lg bg-white/10 px-3 py-1.5 font-bold text-amber-300 hover:bg-white/15"
								>
									פתח את דף הנחיתה המלא ←
								</a>
							</div>
						</details>

						<!-- פעולות לפי טאב -->
						<div class="mt-4 flex flex-wrap gap-2">
							{#if activeTab === 'pending'}
								<form
									method="POST"
									action="?/approve"
									use:enhance
									class="flex flex-wrap items-center gap-2"
								>
									<input type="hidden" name="id" value={ad.id} />
									<label class="flex items-center gap-1.5 text-xs font-bold text-gray-400">
										שולם עבור:
										<!-- ברירת המחדל = התקופה שהמפרסם בחר בשליחה -->
										<select
											name="durationDays"
											class="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-amber-400/50 focus:outline-none"
										>
											<option
												value="30"
												selected={ad.requestedDurationDays !== 180}
												style="background:#fff;color:#111">חודש</option
											>
											<option
												value="180"
												selected={ad.requestedDurationDays === 180}
												style="background:#fff;color:#111">חצי שנה</option
											>
										</select>
									</label>
									<button
										type="submit"
										class="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-black hover:bg-emerald-400"
									>
										{(data.approved ?? []).some((/** @type {any} */ o) => o.id === ad.replacesAdId)
											? '✅ אשר והחלף את הישנה'
											: '✅ אשר ופרסם'}
									</button>
								</form>
								<!-- מפרסם שבאמת רוצה שתי פרסומות במקביל, ולא שדרג את הקיימת -->
								{#if (data.approved ?? []).some((/** @type {any} */ o) => o.id === ad.replacesAdId)}
									<form method="POST" action="?/approve" use:enhance>
										<input type="hidden" name="id" value={ad.id} />
										<input type="hidden" name="keepPrevious" value="1" />
										<input
											type="hidden"
											name="durationDays"
											value={ad.requestedDurationDays === 180 ? 180 : 30}
										/>
										<button
											type="submit"
											class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-gray-300 hover:bg-white/10"
											title="הישנה תישאר על האתר וזו תתווסף לידה"
										>
											➕ אשר כפרסומת נוספת
										</button>
									</form>
								{/if}
								<button
									type="button"
									onclick={() => startEdit(ad)}
									class="rounded-xl border border-blue-500/40 bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200 hover:bg-blue-500/30"
								>
									✏️ ערוך לפני אישור
								</button>
								<form
									method="POST"
									action="?/reject"
									use:enhance
									class="flex min-w-[220px] flex-1 gap-2"
								>
									<input type="hidden" name="id" value={ad.id} />
									<input
										type="text"
										name="reason"
										placeholder="סיבת דחייה (אופציונלי)"
										class="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
									/>
									<button
										type="submit"
										class="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500"
									>
										❌ דחה
									</button>
								</form>
							{:else if activeTab === 'approved'}
								<a
									href={`/ads/${ad.id}`}
									target="_blank"
									rel="noopener"
									class="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-black text-amber-200 hover:bg-amber-500/25"
								>
									פתח דף נחיתה
								</a>
								<button
									type="button"
									onclick={() => startEdit(ad)}
									class="rounded-xl border border-blue-500/40 bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200 hover:bg-blue-500/30"
								>
									✏️ ערוך
								</button>
								<form method="POST" action="?/backToPending" use:enhance>
									<input type="hidden" name="id" value={ad.id} />
									<button
										type="submit"
										class="rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-sm font-black text-amber-200 hover:bg-amber-500/30"
										onclick={(e) => {
											if (!confirm('להוריד את הפרסומת מהאתר ולהחזיר אותה לממתינות?'))
												e.preventDefault();
										}}
									>
										⏸ הורד מהאתר
									</button>
								</form>
								{#if data.superAdmin}
									<form method="POST" action="?/remove" use:enhance>
										<input type="hidden" name="id" value={ad.id} />
										<button
											type="submit"
											class="rounded-xl border border-red-500/40 bg-red-600/20 px-4 py-2 text-sm font-black text-red-300 hover:bg-red-600/30"
											onclick={(e) => {
												if (!confirm('למחוק את הפרסומת לצמיתות?')) e.preventDefault();
											}}
										>
											🗑 מחק
										</button>
									</form>
								{/if}
							{:else}
								<form method="POST" action="?/backToPending" use:enhance>
									<input type="hidden" name="id" value={ad.id} />
									<button
										type="submit"
										class="rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-sm font-black text-amber-200 hover:bg-amber-500/30"
									>
										↩️ החזר לממתינות
									</button>
								</form>
								{#if data.superAdmin}
									<form method="POST" action="?/remove" use:enhance>
										<input type="hidden" name="id" value={ad.id} />
										<button
											type="submit"
											class="rounded-xl border border-red-500/40 bg-red-600/20 px-4 py-2 text-sm font-black text-red-300 hover:bg-red-600/30"
											onclick={(e) => {
												if (!confirm('למחוק את הפרסומת לצמיתות?')) e.preventDefault();
											}}
										>
											🗑 מחק
										</button>
									</form>
								{/if}
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}

	<!-- ============================================================ -->
	<!-- תזמון פרסומות פעילות + תאריכי פקיעה                          -->
	<!-- ============================================================ -->
	<section class="mt-10">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<span class="text-2xl">📅</span>
				<h2 class="text-lg font-black text-white">תזמון פרסומות</h2>
				<span
					class="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold text-gray-300"
					>{data.schedules.length}</span
				>
			</div>
			<div class="flex items-center gap-2 text-[10px] md:text-xs">
				<span class="inline-flex items-center gap-1 text-emerald-300"
					><span class="h-2 w-2 rounded-full bg-emerald-400"></span>פעילה</span
				>
				<span class="inline-flex items-center gap-1 text-amber-300"
					><span class="h-2 w-2 rounded-full bg-amber-400"></span>≤ 7 ימים</span
				>
				<span class="inline-flex items-center gap-1 text-red-300"
					><span class="h-2 w-2 rounded-full bg-red-400"></span>פגה</span
				>
				<span class="inline-flex items-center gap-1 text-blue-300"
					><span class="h-2 w-2 rounded-full bg-blue-400"></span>מושהית</span
				>
			</div>
		</div>

		<!-- מקרא הרביעיות: הטור מציג רביעייה עוקבת אחת בכל רגע (כמו ב-RightAdBanner),
		     וכל רביעייה צבועה בצבע שלה. בתוך הרביעייה המספר הנמוך עליון והגבוה תחתון -->
		<div class="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-300 md:text-xs">
			<span>הטור מציג רביעייה אחת בכל רגע, לפי הסדר:</span>
			<span class="rounded-full border border-black/20 px-2 py-0.5" style="background:#dbeafe;color:#111">א׳ · 1-4</span>
			<span class="rounded-full border border-black/20 px-2 py-0.5" style="background:#dcfce7;color:#111">ב׳ · 5-8</span>
			<span class="rounded-full border border-black/20 px-2 py-0.5" style="background:#fef9c3;color:#111">ג׳ · 9-12</span>
			<span class="rounded-full border border-black/20 px-2 py-0.5" style="background:#f3e8ff;color:#111">ד׳ · 13-16</span>
			<span class="text-gray-500">בתוך כל רביעייה: המספר הנמוך למעלה, הגבוה למטה</span>
		</div>

		{#if data.schedules.length === 0}
			<div
				class="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-gray-500 italic"
			>
				אין כרגע פרסומות פעילות באתר
			</div>
		{:else}
			<div class="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
				<table class="w-full text-sm" dir="rtl">
					<thead class="bg-white/5">
						<!-- 4 עמודות בלבד — המידע מוערם בכמה שורות בכל תא, כדי שבדסקטופ
						     הכל ייכנס למסך אחד בלי גלילה אופקית -->
						<tr class="text-[11px] tracking-wide text-gray-400 uppercase md:text-xs">
							<th class="px-2 py-2.5 text-right font-bold">מקום</th>
							<th class="px-2 py-2.5 text-right font-bold">פרסומת ומפרסם</th>
							<th class="px-2 py-2.5 text-right font-bold">תקופה</th>
							<th class="px-2 py-2.5 text-right font-bold">ניהול</th>
						</tr>
					</thead>
					<tbody>
						{#each data.schedules as s (s.id)}
							{@const stateColor =
								s.state === 'paused'
									? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
									: s.state === 'expired'
										? 'bg-red-500/15 text-red-300 border-red-500/40'
										: s.state === 'ending'
											? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
											: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}
							{@const stateLabel =
								s.state === 'paused'
									? 'מושהית'
									: s.state === 'expired'
										? 'פגה'
										: s.state === 'ending'
											? 'פגה בקרוב'
											: 'פעילה'}
							{@const daysColor =
								s.state === 'paused'
									? 'text-blue-300'
									: s.daysLeft < 0
										? 'text-red-300'
										: s.daysLeft <= 7
											? 'text-amber-300'
											: 'text-emerald-300'}
							{@const progress = Math.min(
								100,
								Math.max(0, ((s.durationDays - Math.max(0, s.daysLeft)) / s.durationDays) * 100)
							)}
							<!-- מקום מעל 12 (גלישה) מתווסף לבורר כדי שלא ייעלם -->
							{@const slotOptions =
								s.slot && !SLOT_NUMBERS.includes(s.slot)
									? [...SLOT_NUMBERS, s.slot].sort((a, b) => a - b)
									: SLOT_NUMBERS}
							<tr class="border-t border-white/10 hover:bg-white/5">
								<!-- מספר המקום בטור + העברה ישירה למקום אחר (מקום תפוס - מתחלפות).
								     פריסה אנכית צרה - כדי שכל הטבלה תיכנס ברוחב המסך בלי גלילה -->
								<td class="px-2 py-2">
									<form
										method="POST"
										action="?/setSlot"
										use:enhance
										class="flex flex-col items-start gap-1"
									>
										<input type="hidden" name="id" value={s.id} />
										<div class="flex items-center gap-1">
											<span
												class="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-black/20 px-1.5 text-xs font-black whitespace-nowrap"
												style="background:{typeof s.slot === 'number'
													? slotOptionBg(s.slot)
													: '#fff'};color:#111"
												title={typeof s.slot === 'number'
													? `רביעייה ${slotGroupLetter(s.slot)}׳ · הכרטיס ה${slotPosName(s.slot)} בה`
													: ''}
											>
												{typeof s.slot === 'number' ? `${s.slot} · ${slotGroupLetter(s.slot)}׳` : '-'}
											</span>
											<select
												name="slot"
												onchange={(e) => onSlotPick(e, s)}
												class="rounded-lg border border-white/15 bg-black/40 px-1.5 py-1 text-[11px] text-white focus:border-amber-400/50 focus:outline-none"
											>
												<!-- כל רביעייה תחת כותרת משלה — הקשר מספר↔רביעייה קריא במילים,
												     לא רק בצבע; מקום תפוס שומר את צבע הרביעייה ומסומן באדום מודגש -->
												{#each groupSlotOptions(slotOptions) as grp (grp.letter)}
													<optgroup label="— רביעייה {grp.letter}׳ (מוצגות יחד) —">
														{#each grp.nums as n (n)}
															{@const occ = slotOccupants.get(n)}
															{@const takenByOther = !!occ && occ.id !== s.id}
															<option
																value={n}
																selected={n === s.slot}
																style="background:{slotOptionBg(n)};color:{takenByOther
																	? '#b91c1c'
																	: '#111'};font-weight:{takenByOther ? '700' : '400'}"
															>
																{slotOptionLabel(n, s.id)}
															</option>
														{/each}
													</optgroup>
												{/each}
											</select>
										</div>
										<button
											type="submit"
											onclick={(e) => confirmSlotMove(e, s)}
											class="rounded-lg border border-purple-500/40 bg-purple-500/20 px-2 py-1 text-[11px] font-black whitespace-nowrap text-purple-200 hover:bg-purple-500/30"
											title="העבר למקום שנבחר; מקום תפוס - תתבקש לאשר החלפה בין השתיים"
										>
											⇄ העבר
										</button>
										{#if slotWarning[s.id]}
											<span class="max-w-[150px] text-[10px] leading-snug font-bold text-amber-300">
												⚠ {slotWarning[s.id]}
											</span>
										{/if}
									</form>
								</td>
								<!-- פרסומת + מפרסם + סטטוס בתא אחד, מוערמים.
								     ריחוף על הכותרת = תצוגה מקדימה צפה; הקשה = מודאל עם הכרטיס עצמו -->
								<td class="px-2 py-2">
									<button
										type="button"
										onmouseenter={(e) => openHoverPreview(e, s.id)}
										onmouseleave={() => (hoverPreview = null)}
										onclick={() => {
											hoverPreview = null;
											modalPreviewId = s.id;
										}}
										title="תצוגה מקדימה של הפרסומת כפי שהיא מוצגת באתר"
										class="line-clamp-2 max-w-[160px] cursor-pointer text-right leading-snug font-bold break-words text-white underline decoration-white/30 decoration-dotted underline-offset-2 hover:text-amber-300"
									>
										{s.title}
									</button>
									<div class="mt-0.5 max-w-[160px] truncate text-xs text-gray-300">
										{s.advertiserName || '-'}
									</div>
									<div class="max-w-[160px] truncate text-[10px] text-gray-500">
										{s.advertiserEmail}
									</div>
									<span
										class="mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-black whitespace-nowrap {stateColor}"
										>{stateLabel}</span
									>
								</td>
								<!-- כל נתוני הזמן בתא אחד: פורסם, פג, וכמה נותר מתוך המשך -->
								<td class="px-2 py-2 text-xs leading-relaxed whitespace-nowrap">
									<div class="text-gray-300">
										פורסם: {fmtDateOnly(s.publishedAt)}
										<span class="text-[10px] text-gray-500">{fmtTimeOnly(s.publishedAt)}</span>
									</div>
									<div class="text-gray-300">
										פג: {fmtDateOnly(s.expiresAt)}
										<span class="text-[10px] text-gray-500">{fmtTimeOnly(s.expiresAt)}</span>
									</div>
									<div class="mt-0.5 font-black {daysColor}">
										{s.daysLeft < 0 ? `${-s.daysLeft}- ימים` : `${s.daysLeft} ימים`}
										<span class="text-[10px] font-bold text-gray-500">מתוך {s.durationDays}</span>
									</div>
									<div class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
										<div
											class="h-full {s.state === 'expired'
												? 'bg-red-400'
												: s.state === 'ending'
													? 'bg-amber-400'
													: 'bg-emerald-400'}"
											style="width: {progress}%"
										></div>
									</div>
								</td>
								<!-- ניהול הפרסומת ישירות מהשורה: קציבת תקופה, השהיה, הורדה, מחיקה.
								     רוחב מוגבל — הכפתורים נערמים בשתי שורות במקום להרחיב את הטבלה -->
								<td class="px-2 py-2">
									<div class="flex max-w-[240px] flex-wrap items-center gap-1">
										<!-- פותח את חלון הקציבה: פרטי תשלום ותאריכים + שינוי תקופה/תפוגה.
										     שמור לסופר-אדמין (כמו המחיקה) — אדמין רגיל לא רואה את הכפתור -->
										{#if data.superAdmin}
											<button
												type="button"
												onclick={() => (durationModal = s)}
												class="rounded-lg border border-blue-500/40 bg-blue-500/20 px-2 py-1 text-[11px] font-black whitespace-nowrap text-blue-200 hover:bg-blue-500/30"
												title="פרטי התקופה והתשלום + שינוי תקופה או תאריך תפוגה">⏱ קצוב</button
											>
										{/if}

										{#if s.state === 'paused'}
											<form method="POST" action="?/resume" use:enhance>
												<input type="hidden" name="id" value={s.id} />
												<button
													type="submit"
													class="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-[11px] font-black whitespace-nowrap text-emerald-200 hover:bg-emerald-500/30"
													title="הימים השמורים נספרים מהיום">▶ המשך</button
												>
											</form>
										{:else}
											<form method="POST" action="?/pause" use:enhance>
												<input type="hidden" name="id" value={s.id} />
												<button
													type="submit"
													class="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-black whitespace-nowrap text-gray-200 hover:bg-white/20"
													title="יורדת מהאתר ושומרת את הימים שנותרו"
													onclick={(e) => {
														if (
															!confirm('להשהות את הפרסומת? היא תרד מהאתר והימים שנותרו יישמרו לה.')
														)
															e.preventDefault();
													}}>⏸ השהה</button
												>
											</form>
										{/if}

										<form method="POST" action="?/backToPending" use:enhance>
											<input type="hidden" name="id" value={s.id} />
											<button
												type="submit"
												class="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-black whitespace-nowrap text-amber-200 hover:bg-amber-500/25"
												title="חוזרת לתור האישורים"
												onclick={(e) => {
													if (!confirm('להוריד את הפרסומת מהאתר ולהחזיר אותה לממתינות?'))
														e.preventDefault();
												}}>⤴ הורד</button
											>
										</form>

										{#if data.superAdmin}
											<form method="POST" action="?/remove" use:enhance>
												<input type="hidden" name="id" value={s.id} />
												<button
													type="submit"
													class="rounded-lg border border-red-500/40 bg-red-600/20 px-2 py-1 text-[11px] font-black whitespace-nowrap text-red-300 hover:bg-red-600/30"
													onclick={(e) => {
														if (!confirm(`למחוק לצמיתות את "${s.title}"?`)) e.preventDefault();
													}}>🗑 מחק</button
												>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- ============================================================ -->
	<!-- מפרסמים — קיבוץ לפי אימייל                                   -->
	<!-- ============================================================ -->
	<section class="mt-10 mb-12">
		<div class="mb-3 flex items-center gap-2">
			<span class="text-2xl">👤</span>
			<h2 class="text-lg font-black text-white">מפרסמים</h2>
			<span
				class="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold text-gray-300"
				>{data.advertisers.length}</span
			>
		</div>

		{#if data.advertisers.length === 0}
			<div
				class="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-gray-500 italic"
			>
				עוד אין מפרסמים במערכת
			</div>
		{:else}
			<div class="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
				<table class="w-full text-sm" dir="rtl">
					<thead class="bg-white/5">
						<tr class="text-[11px] tracking-wide text-gray-400 uppercase md:text-xs">
							<th class="px-3 py-2.5 text-right font-bold">שם</th>
							<th class="hidden px-3 py-2.5 text-right font-bold md:table-cell">חברה</th>
							<th class="hidden px-3 py-2.5 text-right font-bold md:table-cell">עיר/כתובת</th>
							<th class="hidden px-3 py-2.5 text-right font-bold lg:table-cell">טלפון</th>
							<th class="px-3 py-2.5 text-right font-bold">סך תשלום</th>
							<th class="px-3 py-2.5 text-right font-bold">פרסומות</th>
							<th class="px-3 py-2.5 text-right font-bold">פעילות</th>
							<th class="hidden px-3 py-2.5 text-right font-bold md:table-cell">סוג</th>
						</tr>
					</thead>
					<tbody>
						{#each data.advertisers as a (a.key)}
							<tr class="border-t border-white/10 hover:bg-white/5">
								<td class="px-3 py-2 font-bold text-white">
									<div class="max-w-[160px] truncate">{a.name || '-'}</div>
									<div class="max-w-[160px] truncate text-[10px] text-gray-500">{a.email}</div>
								</td>
								<td class="hidden max-w-[160px] truncate px-3 py-2 text-gray-300 md:table-cell"
									>{a.companyName || '-'}</td
								>
								<td class="hidden max-w-[160px] truncate px-3 py-2 text-gray-300 md:table-cell"
									>{a.address || '-'}</td
								>
								<td class="hidden px-3 py-2 whitespace-nowrap text-gray-300 lg:table-cell"
									>{a.phone || '-'}</td
								>
								<td class="px-3 py-2 font-black whitespace-nowrap text-emerald-300">
									{a.totalPaid > 0 ? `₪${a.totalPaid.toLocaleString('he-IL')}` : '-'}
								</td>
								<td class="px-3 py-2 text-gray-300">{a.adsCount}</td>
								<td
									class="px-3 py-2 {a.activeCount > 0
										? 'font-black text-emerald-300'
										: 'text-gray-500'}">{a.activeCount}</td
								>
								<td class="hidden px-3 py-2 md:table-cell">
									{#if a.isReturning}
										<span
											class="rounded-full border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-purple-300"
											>🔁 חוזר</span
										>
									{:else}
										<span
											class="rounded-full border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-blue-300"
											>חדש</span
										>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- תצוגה מקדימה צפה בריחוף על כותרת בטבלת התזמון (דסקטופ בלבד) -->
	{#if hoverPreview}
		{@const pAd = approvedById.get(hoverPreview.id)}
		{#if pAd}
			<div
				class="pointer-events-none fixed z-40 hidden drop-shadow-2xl md:block"
				style="left:{hoverPreview.x}px; top:{hoverPreview.y}px"
			>
				<AdCardPreview ad={pAd} />
			</div>
		{/if}
	{/if}

	<!-- מודאל תצוגה מקדימה בהקשה על הכותרת (נייד ודסקטופ) -->
	{#if modalPreviewId}
		{@const mAd = approvedById.get(modalPreviewId)}
		{#if mAd}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
				role="presentation"
				onclick={() => (modalPreviewId = null)}
			>
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="my-auto flex flex-col items-center gap-3"
					role="dialog"
					aria-modal="true"
					aria-label="תצוגה מקדימה של הפרסומת"
					tabindex="-1"
					onclick={(e) => e.stopPropagation()}
				>
					<AdCardPreview ad={mAd} />
					<div class="flex items-center gap-2">
						<a
							href={`/ads/${mAd.id}`}
							target="_blank"
							rel="noopener"
							class="rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-500/30"
						>
							פתח דף נחיתה
						</a>
						<button
							type="button"
							onclick={() => (modalPreviewId = null)}
							class="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black text-gray-200 hover:bg-white/20"
						>
							✕ סגור
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- חלון הקציבה: כל מה שצריך לדעת על התקופה והתשלום של הפרסומת,
     ושתי דרכי שינוי — מסלול ימים (נספר מיום הפרסום) או תאריך תפוגה שרירותי -->
{#if durationModal}
	{@const m = durationModal}
	{@const mDurOptions = DURATION_OPTIONS.includes(m.durationDays)
		? DURATION_OPTIONS
		: [...DURATION_OPTIONS, m.durationDays].sort((a, b) => a - b)}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
		role="presentation"
		onclick={() => (durationModal = null)}
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="my-auto w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label="קציבת תקופת פרסום"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-3 flex items-start justify-between gap-2">
				<h3 class="text-base leading-snug font-black text-white">⏱ קציבת תקופה — {m.title}</h3>
				<button
					type="button"
					onclick={() => (durationModal = null)}
					class="shrink-0 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-black text-gray-200 hover:bg-white/20"
				>
					✕
				</button>
			</div>

			<!-- מה המפרסם שילם ומתי — כל הנתונים במקום אחד -->
			<dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
				<dt class="font-bold text-gray-500">מפרסם</dt>
				<dd class="font-bold text-gray-200">
					{m.advertiserName || '-'}
					{#if m.advertiserEmail}<span class="font-normal text-gray-500">· {m.advertiserEmail}</span
						>{/if}
				</dd>
				<dt class="font-bold text-gray-500">מסלול שנרכש</dt>
				<dd class="font-bold text-gray-200">
					{m.requestedDurationDays} ימים
					{#if m.paymentAmount}<span class="text-gray-400">— {m.paymentAmount} ₪</span>{/if}
				</dd>
				<dt class="font-bold text-gray-500">סטטוס תשלום</dt>
				<dd class="font-black {m.payment === 'code' ? 'text-emerald-300' : 'text-amber-300'}">
					{m.payment === 'code' ? '✓ שולם (אושר בקוד)' : '⏳ לתיאום מול המפרסם'}
				</dd>
				<dt class="font-bold text-gray-500">הוגש</dt>
				<dd class="text-gray-200">
					{fmtDateOnly(m.submittedAt)} <span class="text-gray-500">{fmtTimeOnly(m.submittedAt)}</span>
				</dd>
				<dt class="font-bold text-gray-500">פורסם</dt>
				<dd class="text-gray-200">
					{fmtDateOnly(m.publishedAt)} <span class="text-gray-500">{fmtTimeOnly(m.publishedAt)}</span>
				</dd>
				<dt class="font-bold text-gray-500">פג בתאריך</dt>
				<dd class="text-gray-200">
					{fmtDateOnly(m.expiresAt)} <span class="text-gray-500">{fmtTimeOnly(m.expiresAt)}</span>
				</dd>
				<dt class="font-bold text-gray-500">נותרו</dt>
				<dd
					class="font-black {m.state === 'paused'
						? 'text-blue-300'
						: m.daysLeft < 0
							? 'text-red-300'
							: m.daysLeft <= 7
								? 'text-amber-300'
								: 'text-emerald-300'}"
				>
					{m.daysLeft < 0 ? `${-m.daysLeft}- ימים` : `${m.daysLeft} ימים`}
					<span class="font-bold text-gray-500">מתוך {m.durationDays}</span>
					{#if m.state === 'paused'}<span class="text-blue-300">(מושהית)</span>{/if}
				</dd>
			</dl>

			<!-- דרך 1: קציבה במסלול ימים, נספרת מיום הפרסום -->
			<form
				method="POST"
				action="?/setDuration"
				use:enhance={closeOnSubmit}
				class="mb-2 flex items-center gap-2"
			>
				<input type="hidden" name="id" value={m.id} />
				<label class="shrink-0 text-xs font-bold text-gray-400" for="dur-days"
					>תקופה מיום הפרסום</label
				>
				<select
					id="dur-days"
					name="days"
					class="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white focus:border-amber-400/50 focus:outline-none"
				>
					{#each mDurOptions as d (d)}
						<option value={d} selected={d === m.durationDays} style="background:#fff;color:#111"
							>{d} ימים</option
						>
					{/each}
				</select>
				<button
					type="submit"
					class="rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-1.5 text-xs font-black whitespace-nowrap text-blue-200 hover:bg-blue-500/30"
				>
					קצוב
				</button>
			</form>

			<!-- דרך 2: תאריך תפוגה שרירותי — הפרסומת יורדת בסוף היום שנבחר -->
			<form method="POST" action="?/setExpiry" use:enhance={closeOnSubmit} class="flex items-center gap-2">
				<input type="hidden" name="id" value={m.id} />
				<label class="shrink-0 text-xs font-bold text-gray-400" for="dur-date">או תאריך תפוגה</label>
				<input
					id="dur-date"
					type="date"
					name="expires"
					required
					value={toDateInput(m.expiresAt)}
					class="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-white focus:border-amber-400/50 focus:outline-none"
				/>
				<button
					type="submit"
					class="rounded-lg border border-purple-500/40 bg-purple-500/20 px-3 py-1.5 text-xs font-black whitespace-nowrap text-purple-200 hover:bg-purple-500/30"
				>
					קבע תאריך
				</button>
			</form>
			<p class="mt-3 text-[10px] leading-snug text-gray-500">
				קציבה במסלול נספרת מיום הפרסום, ולכן מסלול קצר מהזמן שכבר עבר מוריד את הפרסומת מיד. תאריך
				ידני קובע את התפוגה לסוף היום שנבחר — גם אחורה (הורדה מיידית) וגם קדימה.
			</p>
		</div>
	</div>
{/if}

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			modalPreviewId = null;
			hoverPreview = null;
			durationModal = null;
		}
	}}
/>
