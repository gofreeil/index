<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { mediaUrl, STATUS_HE } from '$lib/businessShape.js';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	// ?tab=cards מאפשר לחזור לפאנל ישירות ללשונית מסוימת (למשל אחרי מחיקת כרטיסייה)
	let tab = $state(page.url.searchParams.get('tab') || 'pending');
	let busy = $state('');

	const REASON_HE = {
		no_discount: 'לא נתן את ההטבה',
		cash_refused: 'סירב למזומן',
		ethics: 'הפרת הקוד האתי',
		other: 'אחר'
	};
	/** @param {string} r */
	const reasonHe = (r) => /** @type {any} */ (REASON_HE)[r] || r;

	/** @param {string} iso */
	const fmtDate = (iso) => {
		if (!iso) return '';
		try {
			return new Date(iso).toLocaleDateString('he-IL', {
				day: '2-digit',
				month: '2-digit',
				year: '2-digit'
			});
		} catch {
			return '';
		}
	};

	const pending = $derived(data.businesses ?? []);
	const allBusinesses = $derived(data.allBusinesses ?? []);
	const reviews = $derived(data.reviews ?? []);
	const reports = $derived(data.reports ?? []);

	// ── חיפוש וסינון בטאב הכרטיסיות ──
	let q = $state('');
	let statusFilter = $state('all');
	const STATUS_CHIPS = [
		['all', 'הכל'],
		['approved', 'מאושרים'],
		['pending', 'ממתינים'],
		['frozen', 'מוקפאים'],
		['rejected', 'נדחו']
	];
	const filteredCards = $derived(
		allBusinesses.filter((/** @type {any} */ b) => {
			if (statusFilter !== 'all' && (b.status || 'pending') !== statusFilter) return false;
			const needle = q.trim().toLowerCase();
			if (!needle) return true;
			return [b.name, b.category, b.subcategory, b.phone, b.city, b.contact_name].some((v) =>
				String(v || '')
					.toLowerCase()
					.includes(needle)
			);
		})
	);

	// "פרסומות" הוא עמוד נפרד (/admin/ads, פורט מהקהילה) — href במקום tab
	const tabs = $derived([
		{ id: 'pending', label: 'ממתינים לאישור', count: pending.length, badge: 'bg-blue-600' },
		{ id: 'cards', label: 'כרטיסיות', count: allBusinesses.length, badge: 'bg-gray-600' },
		{
			id: 'ads',
			label: '📢 פרסומות',
			count: data.adsPending ?? 0,
			badge: 'bg-purple-600',
			href: '/admin/ads'
		},
		{ id: 'reviews', label: 'ביקורות', count: reviews.length, badge: 'bg-amber-600' },
		{ id: 'reports', label: 'דיווחים', count: reports.length, badge: 'bg-red-600' }
	]);

	// class מלא ומילולי — Tailwind לא תופס מחרוזות מורכבות דינמית
	const BTN = {
		approve: 'bg-green-600 hover:bg-green-700',
		reject: 'bg-red-600 hover:bg-red-700',
		freeze: 'bg-gray-600 hover:bg-gray-700',
		review: 'bg-amber-600 hover:bg-amber-700'
	};
	const BIZ_ACTIONS = [
		['approved', 'אשר', BTN.approve],
		['rejected', 'דחה', BTN.reject],
		['frozen', 'הקפא', BTN.freeze]
	];
	const REVIEW_ACTIONS = [
		['approved', 'אשר', BTN.approve],
		['rejected', 'דחה', BTN.reject]
	];
	const REPORT_ACTIONS = [
		['resolved', 'טופל', BTN.approve],
		['dismissed', 'נדחה', BTN.freeze],
		['reviewing', 'בבדיקה', BTN.review]
	];

	/** @param {string} st סטטוס נוכחי → כפתורי הפעולה בכרטיסייה/פרסומת */
	const cardActions = (st) => {
		/** @type {string[][]} */
		const acts = [];
		if (st !== 'approved') acts.push(['approved', st === 'frozen' ? 'שחזר' : 'אשר', BTN.approve]);
		if (st === 'approved') acts.push(['frozen', 'הקפא', BTN.freeze]);
		if (st === 'pending') acts.push(['rejected', 'דחה', BTN.reject]);
		return acts;
	};

	/** @param {string} st */
	const statusPill = (st) => STATUS_HE[st] ?? [st, 'bg-gray-800 text-gray-300 border-gray-600/40'];

	// enhance: מסמן busy לפי מזהה, ואחרי הפעולה מרענן את הרשימות
	/** @param {string} id */
	const submitFn = (id) => () => {
		busy = id;
		return async (/** @type {any} */ { update }) => {
			await update({ reset: false });
			busy = '';
		};
	};

	// כמו submitFn, עם אישור לפני מחיקה לצמיתות
	/** @param {string} id */
	const confirmDeleteFn =
		(id) =>
		(/** @type {any} */ { cancel }) => {
			if (!confirm('למחוק לצמיתות? הפעולה אינה הפיכה.')) {
				cancel();
				return;
			}
			busy = id;
			return async (/** @type {any} */ { update }) => {
				await update({ reset: false });
				busy = '';
			};
		};
</script>

<!-- כפתורי שינוי סטטוס (אשר/דחה/הקפא/שחזר) לפריט -->
{#snippet moderateBtns(
	/** @type {string} */ kind,
	/** @type {string} */ id,
	/** @type {string[][]} */ actions,
	/** @type {string} */ bizDoc = ''
)}
	{#each actions as [st, lbl, cls] (st)}
		<form method="POST" action="?/moderate" use:enhance={submitFn(id + st)}>
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="documentId" value={id} />
			{#if bizDoc}<input type="hidden" name="businessDocId" value={bizDoc} />{/if}
			<input type="hidden" name="status" value={st} />
			<button
				disabled={busy === id + st}
				class="rounded-lg {cls} px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-40"
			>
				{busy === id + st ? '…' : lbl}
			</button>
		</form>
	{/each}
{/snippet}

<!-- מחיקה לצמיתות — מוצג לסופר-אדמין בלבד -->
{#snippet deleteBtn(/** @type {string} */ kind, /** @type {string} */ id)}
	{#if data.superAdmin}
		<form method="POST" action="?/deleteItem" use:enhance={confirmDeleteFn(id + 'del')}>
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="documentId" value={id} />
			<button
				disabled={busy === id + 'del'}
				class="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-1.5 text-sm font-bold text-red-300 transition hover:bg-red-900/50 disabled:opacity-40"
				title="מחיקה לצמיתות (סופר-אדמין)"
			>
				{busy === id + 'del' ? '…' : '🗑 מחק'}
			</button>
		</form>
	{/if}
{/snippet}

<svelte:head>
	<title>פאנל ניהול — מדריך בעלי מקצוע</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-5xl px-4 py-8 sm:px-6" dir="rtl">
	{#if !data.authorized}
		<div
			class="mx-auto mt-10 max-w-md rounded-3xl border border-gray-800 bg-gray-900/50 p-10 text-center"
		>
			<div class="mb-4 text-5xl">🔒</div>
			{#if !data.user}
				<h1 class="mb-3 text-2xl font-bold text-gray-100">נדרשת התחברות</h1>
				<p class="mb-6 text-gray-400">פאנל הניהול פתוח לצוות האינדקס בלבד.</p>
				<a
					href="/auth/login"
					class="rounded-full bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
				>
					התחברות
				</a>
			{:else}
				<h1 class="mb-3 text-2xl font-bold text-gray-100">אין הרשאה</h1>
				<p class="text-gray-400">
					החשבון {data.user.email} אינו מורשה לניהול. פנה לסופר-אדמין.
				</p>
			{/if}
		</div>
	{:else}
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="flex items-center gap-3 text-3xl font-extrabold text-gray-100">
					פאנל ניהול
					{#if data.superAdmin}
						<span
							class="rounded-full border border-amber-500/40 bg-amber-900/30 px-3 py-1 text-xs font-bold text-amber-300"
						>
							👑 סופר-אדמין
						</span>
					{:else}
						<span
							class="rounded-full border border-blue-500/40 bg-blue-900/30 px-3 py-1 text-xs font-bold text-blue-300"
						>
							🛡️ אדמין
						</span>
					{/if}
				</h1>
				<p class="mt-1 text-sm text-gray-500">מחובר: {data.user.name} · {data.user.email}</p>
			</div>
			<a href="/" class="text-sm text-gray-400 hover:text-blue-400">← לאתר</a>
		</div>

		{#if form?.error}
			<div
				class="mb-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-center text-red-300"
			>
				{form.error}
			</div>
		{/if}

		<!-- Tabs -->
		<div class="mb-6 flex flex-wrap gap-1 border-b border-gray-800 sm:gap-2">
			{#each tabs as t (t.id)}
				{#if t.href}
					<a
						href={t.href}
						class="relative -mb-px border-b-2 border-transparent px-3 py-3 text-sm font-bold text-gray-400 transition hover:text-gray-200 sm:px-4"
					>
						{t.label}
						{#if t.count > 0}
							<span class="mr-1 rounded-full {t.badge} px-2 py-0.5 text-xs text-white"
								>{t.count}</span
							>
						{/if}
					</a>
				{:else}
					<button
						onclick={() => (tab = t.id)}
						class="relative -mb-px border-b-2 px-3 py-3 text-sm font-bold transition sm:px-4 {tab ===
						t.id
							? 'border-blue-500 text-blue-400'
							: 'border-transparent text-gray-400 hover:text-gray-200'}"
					>
						{t.label}
						{#if t.count > 0}
							<span class="mr-1 rounded-full {t.badge} px-2 py-0.5 text-xs text-white"
								>{t.count}</span
							>
						{/if}
					</button>
				{/if}
			{/each}
		</div>

		<!-- ממתינים לאישור (עסקים חדשים) -->
		{#if tab === 'pending'}
			{#if pending.length === 0}
				<p class="py-16 text-center text-gray-500">אין עסקים שממתינים לאישור 🎉</p>
			{:else}
				<div class="space-y-4">
					{#each pending as b (b.documentId)}
						<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
							<div class="flex items-start justify-between gap-4">
								<div class="min-w-0 flex-1">
									<h3 class="text-lg font-bold text-gray-100">{b.name}</h3>
									<p class="mt-0.5 text-xs text-gray-500">
										{b.category || 'ללא קטגוריה'} · {b.contact_name || '—'} · {b.phone || '—'} · {fmtDate(
											b.createdAt
										)}
									</p>
									{#if b.discount}
										<p class="mt-2 text-sm font-medium text-green-400">🎁 {b.discount}</p>
									{/if}
									{#if b.description}
										<p class="mt-2 line-clamp-3 text-sm text-gray-400">{b.description}</p>
									{/if}
									{#if b.website || b.address || b.sales_area}
										<p class="mt-2 text-xs text-gray-500">
											{b.address || b.sales_area || ''}{b.website ? ' · ' + b.website : ''}
										</p>
									{/if}
								</div>
								{#if mediaUrl(b.logo)}
									<img
										src={mediaUrl(b.logo)}
										alt=""
										class="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
									/>
								{/if}
							</div>
							<div class="mt-4 flex flex-wrap items-center gap-2">
								{@render moderateBtns('business', b.documentId, BIZ_ACTIONS)}
								<a
									href="/admin/business/{b.documentId}"
									class="rounded-lg border border-gray-600 px-4 py-1.5 text-sm font-bold text-gray-200 transition hover:bg-gray-800"
								>
									✏️ ערוך
								</a>
								{@render deleteBtn('business', b.documentId)}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- כרטיסיות — כל העסקים: עריכה, הקפאה/שחזור, מחיקה -->
		{#if tab === 'cards'}
			<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
				<input
					type="search"
					bind:value={q}
					placeholder="חיפוש לפי שם, קטגוריה, טלפון, עיר…"
					class="w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:outline-none sm:max-w-xs"
				/>
				<div class="flex flex-wrap gap-1.5">
					{#each STATUS_CHIPS as [val, lbl] (val)}
						<button
							onclick={() => (statusFilter = val)}
							class="rounded-full px-3 py-1 text-xs font-bold transition {statusFilter === val
								? 'bg-blue-600 text-white'
								: 'border border-gray-700 text-gray-400 hover:text-gray-200'}"
						>
							{lbl}
						</button>
					{/each}
				</div>
				<span class="text-xs text-gray-500">{filteredCards.length} מתוך {allBusinesses.length}</span
				>
			</div>

			{#if filteredCards.length === 0}
				<p class="py-16 text-center text-gray-500">לא נמצאו כרטיסיות</p>
			{:else}
				<div class="space-y-3">
					{#each filteredCards as b (b.documentId)}
						{@const [stLbl, stCls] = statusPill(b.status || 'pending')}
						<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
							<div class="flex items-center gap-4">
								{#if mediaUrl(b.logo)}
									<img
										src={mediaUrl(b.logo)}
										alt=""
										class="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
									/>
								{:else}
									<div
										class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gray-800 text-xl"
									>
										🏪
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<h3 class="truncate font-bold text-gray-100">{b.name}</h3>
										<span class="rounded-full border px-2 py-0.5 text-[11px] font-bold {stCls}"
											>{stLbl}</span
										>
									</div>
									<p class="mt-0.5 truncate text-xs text-gray-500">
										{b.category || 'ללא קטגוריה'}{b.city ? ' · ' + b.city : ''} · {b.phone || '—'} · {fmtDate(
											b.createdAt
										)}
									</p>
								</div>
								<div class="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
									<a
										href="/admin/business/{b.documentId}"
										class="rounded-lg border border-gray-600 px-4 py-1.5 text-sm font-bold text-gray-200 transition hover:bg-gray-800"
									>
										✏️ ערוך
									</a>
									{@render moderateBtns(
										'business',
										b.documentId,
										cardActions(b.status || 'pending')
									)}
									{@render deleteBtn('business', b.documentId)}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- ביקורות -->
		{#if tab === 'reviews'}
			{#if reviews.length === 0}
				<p class="py-16 text-center text-gray-500">אין ביקורות שממתינות לאישור 🎉</p>
			{:else}
				<div class="space-y-4">
					{#each reviews as r (r.documentId)}
						<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
							<div class="flex items-center justify-between">
								<span class="font-bold text-gray-100">{r.business?.name || 'עסק לא ידוע'}</span>
								<span class="text-amber-400" dir="ltr"
									>{'★'.repeat(Math.max(0, Math.min(5, r.rating || 0)))}</span
								>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{r.author_name || 'אנונימי'}{r.author_city ? ' · ' + r.author_city : ''} · {fmtDate(
									r.submitted_at || r.createdAt
								)}
							</p>
							{#if r.title}<p class="mt-2 font-medium text-gray-200">{r.title}</p>{/if}
							{#if r.body}<p class="mt-1 text-sm text-gray-400">{r.body}</p>{/if}
							<div class="mt-4 flex flex-wrap gap-2">
								{@render moderateBtns(
									'review',
									r.documentId,
									REVIEW_ACTIONS,
									r.business?.documentId ?? ''
								)}
								{@render deleteBtn('review', r.documentId)}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- דיווחים -->
		{#if tab === 'reports'}
			{#if reports.length === 0}
				<p class="py-16 text-center text-gray-500">אין דיווחים פתוחים 🎉</p>
			{:else}
				<div class="space-y-4">
					{#each reports as r (r.documentId)}
						<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
							<div class="flex items-center justify-between">
								<span class="font-bold text-gray-100">{r.business_name || '—'}</span>
								<span class="rounded-full bg-red-900/40 px-3 py-0.5 text-xs font-bold text-red-300">
									{reasonHe(r.reason)}
								</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{r.reporter_name || 'אנונימי'} · {fmtDate(r.createdAt)}
							</p>
							{#if r.details}<p class="mt-2 text-sm text-gray-300">{r.details}</p>{/if}
							<div class="mt-4 flex flex-wrap gap-2">
								{@render moderateBtns('report', r.documentId, REPORT_ACTIONS)}
								{@render deleteBtn('report', r.documentId)}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</main>
