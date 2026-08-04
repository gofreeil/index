<script>
	// פורט של מסך "אישור פרסומות" מ-community/my_new_project (admin/ads-review).
	// הותאם ל-index: JS במקום TS, חיפוש פשוט במקום heMatches, מחיקה לסופר-אדמין בלבד.
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { adImgFit, parseAdImageFit } from '$lib/adImageFit';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	/** @type {'pending'|'approved'|'rejected'} */
	let activeTab = $state('pending');
	let searchQuery = $state('');
	/** @type {'newest'|'oldest'} */
	let sortOrder = $state('newest');

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
			{#each visibleList as ad (ad.id)}
				<article class="rounded-2xl border border-white/10 bg-white/5 p-3 md:p-5">
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
									{:else}
										<span
											class="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-amber-300"
											>⌛ תשלום לתיאום</span
										>
									{/if}
								</div>
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
										✅ אשר ופרסם
									</button>
								</form>
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
			</div>
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
						<tr class="text-[11px] tracking-wide text-gray-400 uppercase md:text-xs">
							<th class="px-3 py-2.5 text-right font-bold">פרסומת</th>
							<th class="hidden px-3 py-2.5 text-right font-bold md:table-cell">מפרסם</th>
							<th class="px-3 py-2.5 text-right font-bold">פורסם</th>
							<th class="px-3 py-2.5 text-right font-bold">פג בתאריך</th>
							<th class="px-3 py-2.5 text-right font-bold">משך</th>
							<th class="px-3 py-2.5 text-right font-bold">ימים שנותרו</th>
							<th class="px-3 py-2.5 text-right font-bold">סטטוס</th>
						</tr>
					</thead>
					<tbody>
						{#each data.schedules as s (s.id)}
							{@const stateColor =
								s.state === 'expired'
									? 'bg-red-500/15 text-red-300 border-red-500/40'
									: s.state === 'ending'
										? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
										: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}
							{@const stateLabel =
								s.state === 'expired' ? 'פגה' : s.state === 'ending' ? 'פגה בקרוב' : 'פעילה'}
							{@const daysColor =
								s.daysLeft < 0
									? 'text-red-300'
									: s.daysLeft <= 7
										? 'text-amber-300'
										: 'text-emerald-300'}
							{@const progress = Math.min(
								100,
								Math.max(0, ((s.durationDays - Math.max(0, s.daysLeft)) / s.durationDays) * 100)
							)}
							<tr class="border-t border-white/10 hover:bg-white/5">
								<td class="max-w-[180px] truncate px-3 py-2 font-bold text-white">{s.title}</td>
								<td class="hidden px-3 py-2 text-gray-300 md:table-cell">
									<div class="max-w-[160px] truncate">{s.advertiserName || '-'}</div>
									<div class="max-w-[160px] truncate text-[10px] text-gray-500">
										{s.advertiserEmail}
									</div>
								</td>
								<td class="px-3 py-2 whitespace-nowrap text-gray-300">{fmtDate(s.publishedAt)}</td>
								<td class="px-3 py-2 whitespace-nowrap text-gray-300">{fmtDate(s.expiresAt)}</td>
								<td class="px-3 py-2 text-gray-300">{s.durationDays} ימים</td>
								<td class="px-3 py-2 font-black whitespace-nowrap {daysColor}">
									{s.daysLeft < 0 ? `${-s.daysLeft}- ימים` : `${s.daysLeft} ימים`}
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
								<td class="px-3 py-2">
									<span
										class="rounded-full border px-2 py-0.5 text-[11px] font-black whitespace-nowrap {stateColor}"
										>{stateLabel}</span
									>
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
</div>
