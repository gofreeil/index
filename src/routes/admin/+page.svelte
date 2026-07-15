<script>
	import { enhance } from '$app/forms';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	let tab = $state('businesses');
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
			return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
		} catch {
			return '';
		}
	};

	const businesses = $derived(data.businesses ?? []);
	const reviews = $derived(data.reviews ?? []);
	const reports = $derived(data.reports ?? []);

	const tabs = $derived([
		{ id: 'businesses', label: 'עסקים', count: businesses.length, badge: 'bg-blue-600' },
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

	// enhance: מסמן busy לפי מזהה, ואחרי הפעולה מרענן את הרשימות
	/** @param {string} id */
	const submitFn = (id) => () => {
		busy = id;
		return async (/** @type {any} */ { update }) => {
			await update({ reset: false });
			busy = '';
		};
	};
</script>

<svelte:head>
	<title>מודרציה — מדריך בעלי מקצוע</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-4xl px-4 py-8 sm:px-6" dir="rtl">
	{#if !data.authorized}
		<div class="mx-auto mt-10 max-w-md rounded-3xl border border-gray-800 bg-gray-900/50 p-10 text-center">
			<div class="mb-4 text-5xl">🔒</div>
			{#if !data.user}
				<h1 class="mb-3 text-2xl font-bold text-gray-100">נדרשת התחברות</h1>
				<p class="mb-6 text-gray-400">מסך המודרציה פתוח לצוות האינדקס בלבד.</p>
				<a href="/auth/login" class="rounded-full bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700">
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
				<h1 class="text-3xl font-extrabold text-gray-100">מודרציה</h1>
				<p class="text-sm text-gray-500">מחובר: {data.user.name} · {data.user.email}</p>
			</div>
			<a href="/" class="text-sm text-gray-400 hover:text-blue-400">← לאתר</a>
		</div>

		{#if form?.error}
			<div class="mb-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-center text-red-300">
				{form.error}
			</div>
		{/if}

		<!-- Tabs -->
		<div class="mb-6 flex gap-2 border-b border-gray-800">
			{#each tabs as t}
				<button
					onclick={() => (tab = t.id)}
					class="relative -mb-px border-b-2 px-4 py-3 text-sm font-bold transition {tab === t.id
						? 'border-blue-500 text-blue-400'
						: 'border-transparent text-gray-400 hover:text-gray-200'}"
				>
					{t.label}
					{#if t.count > 0}
						<span class="mr-1 rounded-full {t.badge} px-2 py-0.5 text-xs text-white">{t.count}</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Businesses -->
		{#if tab === 'businesses'}
			{#if businesses.length === 0}
				<p class="py-16 text-center text-gray-500">אין עסקים שממתינים לאישור 🎉</p>
			{:else}
				<div class="space-y-4">
					{#each businesses as b (b.documentId)}
						<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
							<div class="flex items-start justify-between gap-4">
								<div class="min-w-0 flex-1">
									<h3 class="text-lg font-bold text-gray-100">{b.name}</h3>
									<p class="mt-0.5 text-xs text-gray-500">
										{b.category || 'ללא קטגוריה'} · {b.contact_name || '—'} · {b.phone || '—'} · {fmtDate(b.createdAt)}
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
							</div>
							<div class="mt-4 flex flex-wrap gap-2">
								{#each BIZ_ACTIONS as [st, lbl, cls]}
									<form method="POST" action="?/moderate" use:enhance={submitFn(b.documentId + st)}>
										<input type="hidden" name="kind" value="business" />
										<input type="hidden" name="documentId" value={b.documentId} />
										<input type="hidden" name="status" value={st} />
										<button
											disabled={busy === b.documentId + st}
											class="rounded-lg {cls} px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-40"
										>
											{busy === b.documentId + st ? '…' : lbl}
										</button>
									</form>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Reviews -->
		{#if tab === 'reviews'}
			{#if reviews.length === 0}
				<p class="py-16 text-center text-gray-500">אין ביקורות שממתינות לאישור 🎉</p>
			{:else}
				<div class="space-y-4">
					{#each reviews as r (r.documentId)}
						<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
							<div class="flex items-center justify-between">
								<span class="font-bold text-gray-100">{r.business?.name || 'עסק לא ידוע'}</span>
								<span class="text-amber-400" dir="ltr">{'★'.repeat(Math.max(0, Math.min(5, r.rating || 0)))}</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								{r.author_name || 'אנונימי'}{r.author_city ? ' · ' + r.author_city : ''} · {fmtDate(r.submitted_at || r.createdAt)}
							</p>
							{#if r.title}<p class="mt-2 font-medium text-gray-200">{r.title}</p>{/if}
							{#if r.body}<p class="mt-1 text-sm text-gray-400">{r.body}</p>{/if}
							<div class="mt-4 flex gap-2">
								{#each REVIEW_ACTIONS as [st, lbl, cls]}
									<form method="POST" action="?/moderate" use:enhance={submitFn(r.documentId + st)}>
										<input type="hidden" name="kind" value="review" />
										<input type="hidden" name="documentId" value={r.documentId} />
										<input type="hidden" name="businessDocId" value={r.business?.documentId ?? ''} />
										<input type="hidden" name="status" value={st} />
										<button
											disabled={busy === r.documentId + st}
											class="rounded-lg {cls} px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-40"
										>
											{busy === r.documentId + st ? '…' : lbl}
										</button>
									</form>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Reports -->
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
							<div class="mt-4 flex gap-2">
								{#each REPORT_ACTIONS as [st, lbl, cls]}
									<form method="POST" action="?/moderate" use:enhance={submitFn(r.documentId + st)}>
										<input type="hidden" name="kind" value="report" />
										<input type="hidden" name="documentId" value={r.documentId} />
										<input type="hidden" name="status" value={st} />
										<button
											disabled={busy === r.documentId + st}
											class="rounded-lg {cls} px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-40"
										>
											{busy === r.documentId + st ? '…' : lbl}
										</button>
									</form>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</main>
