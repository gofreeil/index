<script>
	import { enhance } from '$app/forms';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	const claims = $derived(data.claims ?? []);
	const matches = $derived(data.matches ?? []);
	const history = $derived(data.history ?? []);

	let busy = $state('');

	/** @param {string} id */
	const submitFn = (id) => () => {
		busy = id;
		return async (/** @type {any} */ { update }) => {
			await update({ reset: false });
			busy = '';
		};
	};

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

	const MATCHED_HE = /** @type {Record<string,string>} */ ({
		phone: 'טלפון זהה',
		email: 'אימייל זהה',
		manual: 'בקשה ידנית'
	});
	const STATUS_HE = /** @type {Record<string,string>} */ ({
		approved: 'אושרה',
		rejected: 'נדחתה',
		dismissed: 'סומנה כלא רלוונטית'
	});
</script>

<svelte:head>
	<title>בעלות על כרטיסיות — פאנל ניהול</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="pb-10" dir="rtl">
	<div class="mb-6">
		<h1 class="text-2xl font-extrabold text-gray-100">בעלות על כרטיסיות</h1>
		<p class="mt-1 text-sm text-gray-500">
			אישור כאן משייך את הכרטיסייה למשתמש — ומאותו רגע הוא רשאי לערוך את הדף שלו. בקשה על כרטיסייה
			שכבר יש לה בעלים היא בקשת <span class="text-amber-400">העברת בעלות</span>, ומאושרת בכפתור
			נפרד.
		</p>
	</div>

	{#if form?.error}
		<div
			class="mb-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-center text-red-300"
		>
			{form.error}
		</div>
	{/if}
	{#if form?.ok}
		<div
			class="mb-4 rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-center text-green-300"
		>
			✓ {form.message}
		</div>
	{/if}

	<!-- ── בקשות שמשתמשים שלחו ─────────────────────────────── -->
	<section>
		<h2 class="mb-3 text-sm font-bold text-gray-300">
			בקשות בעלות
			{#if claims.length}<span class="text-gray-500">({claims.length})</span>{/if}
		</h2>

		{#if claims.length === 0}
			<p class="rounded-2xl border border-gray-800 bg-gray-900/40 py-10 text-center text-gray-500">
				אין בקשות בעלות שממתינות להכרעה 🎉
			</p>
		{:else}
			<div class="space-y-3">
				{#each claims as c (c.id)}
					<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<a
									href="/admin/business/{c.bizDocId}"
									class="text-lg font-bold text-gray-100 hover:text-blue-400"
								>
									{c.bizName || c.bizDocId}
								</a>
								<p class="mt-1 text-sm text-gray-400">
									<span class="font-bold text-gray-200">{c.userName || c.userEmail}</span>
									<span class="text-gray-500" dir="ltr"> · {c.userEmail}</span>
									{#if c.userPhone}<span class="text-gray-500" dir="ltr">
											· {c.userPhone}</span
										>{/if}
								</p>
								<p class="mt-1 text-xs text-gray-500">
									{MATCHED_HE[c.matchedBy] ?? c.matchedBy} · נשלחה {fmtDate(c.createdAt)}
								</p>
								{#if c.note}
									<p class="mt-2 rounded-lg bg-gray-800/60 p-2.5 text-sm text-gray-300">{c.note}</p>
								{/if}

								<!-- בקשה על כרטיסייה משויכת = בקשת העברה. האזהרה כאן כדי
								     שההכרעה תילקח מול העובדה הזו, ולא בהיסח הדעת. -->
								{#if c.currentOwnerId}
									<p
										class="mt-2 rounded-lg border border-amber-500/30 bg-amber-900/20 p-2.5 text-xs text-amber-200"
									>
										⇄ הכרטיסייה משויכת כרגע למשתמש #{c.currentOwnerId}{c.currentOwnerEmail
											? ' · ' + c.currentOwnerEmail
											: ''} — אישור כאן מעביר את הבעלות, והבעלים הנוכחי מאבד את זכות העריכה.
									</p>
								{:else if c.alreadyOwner}
									<p class="mt-2 text-xs text-gray-500">
										הכרטיסייה כבר משויכת לדורש — אפשר פשוט לסגור את הבקשה.
									</p>
								{/if}
							</div>
							<span
								class="rounded-full border px-2.5 py-0.5 text-[11px] font-bold {c.matchedBy ===
								'manual'
									? 'border-gray-600/40 bg-gray-800 text-gray-300'
									: 'border-green-500/30 bg-green-900/40 text-green-300'}"
							>
								{c.matchedBy === 'manual' ? 'ללא התאמה אוטומטית' : 'הפרטים תואמים'}
							</span>
						</div>

						<div class="mt-4 flex flex-wrap items-center gap-2">
							<form
								method="POST"
								action="?/approve"
								use:enhance={c.currentOwnerId
									? ({ cancel }) => {
											if (
												!confirm(
													`להעביר את "${c.bizName || 'הכרטיסייה'}" ממשתמש #${c.currentOwnerId} אל ${c.userEmail}?`
												)
											) {
												cancel();
												return;
											}
											return submitFn(c.id + 'ok')();
										}
									: submitFn(c.id + 'ok')}
							>
								<input type="hidden" name="claimId" value={c.id} />
								{#if c.currentOwnerId}<input type="hidden" name="transfer" value="1" />{/if}
								<button
									disabled={busy === c.id + 'ok'}
									class="rounded-lg px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-40 {c.currentOwnerId
										? 'bg-amber-600 hover:bg-amber-700'
										: 'bg-green-600 hover:bg-green-700'}"
								>
									{busy === c.id + 'ok'
										? '…'
										: c.currentOwnerId
											? '⇄ אשר והעבר בעלות'
											: '✓ אשר ושייך'}
								</button>
							</form>
							<form method="POST" action="?/reject" use:enhance={submitFn(c.id + 'no')}>
								<input type="hidden" name="claimId" value={c.id} />
								<button
									disabled={busy === c.id + 'no'}
									class="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
								>
									{busy === c.id + 'no' ? '…' : 'דחה'}
								</button>
							</form>
							<a
								href="/business/{c.bizDocId}"
								target="_blank"
								rel="noopener noreferrer"
								class="rounded-lg border border-gray-600 px-4 py-1.5 text-sm font-bold text-gray-200 transition hover:bg-gray-800"
							>
								לדף העסק ↗
							</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- ── התאמות שהמערכת מצאה ─────────────────────────────── -->
	<section class="mt-10">
		<h2 class="mb-1 text-sm font-bold text-gray-300">
			התאמות שהמערכת מצאה
			{#if matches.length}<span class="text-gray-500">({matches.length})</span>{/if}
		</h2>
		<p class="mb-3 text-xs text-gray-500">
			משתמשים רשומים שהטלפון או האימייל שלהם זהים לאלה שעל כרטיסייה בלי בעלים. אפשר לשייך ישירות, או
			לסמן שההתאמה אינה נכונה כדי שלא תחזור.
		</p>

		{#if matches.length === 0}
			<p class="rounded-2xl border border-gray-800 bg-gray-900/40 py-10 text-center text-gray-500">
				אין התאמות פתוחות
			</p>
		{:else}
			<div class="space-y-2">
				{#each matches as m (m.bizDocId + m.userId)}
					{@const key = m.bizDocId + m.userId}
					<div
						class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-gray-800 bg-gray-900/40 p-4"
					>
						<div class="min-w-0 flex-1">
							<a
								href="/admin/business/{m.bizDocId}"
								class="font-bold text-gray-100 hover:text-blue-400"
							>
								{m.bizName || m.bizDocId}
							</a>
							<p class="mt-0.5 text-xs text-gray-500">
								<span dir="ltr">{m.bizPhone}</span>{m.bizCity ? ' · ' + m.bizCity : ''}
							</p>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-bold text-gray-200">{m.userName || m.userEmail}</p>
							<p class="truncate text-xs text-gray-500" dir="ltr">
								{m.userEmail}{m.userPhone ? ' · ' + m.userPhone : ''}
							</p>
						</div>
						<span
							class="rounded-full border border-blue-500/30 bg-blue-900/40 px-2.5 py-0.5 text-[11px] font-bold text-blue-300"
						>
							{MATCHED_HE[m.matchedBy]}
						</span>
						<div class="flex flex-wrap items-center gap-2">
							<form method="POST" action="?/assign" use:enhance={submitFn(key + 'ok')}>
								<input type="hidden" name="bizDocId" value={m.bizDocId} />
								<input type="hidden" name="userId" value={m.userId} />
								<input type="hidden" name="userEmail" value={m.userEmail} />
								<input type="hidden" name="userName" value={m.userName} />
								<input type="hidden" name="userPhone" value={m.userPhone} />
								<input type="hidden" name="matchedBy" value={m.matchedBy} />
								<button
									disabled={busy === key + 'ok'}
									class="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-40"
								>
									{busy === key + 'ok' ? '…' : 'שייך'}
								</button>
							</form>
							<form method="POST" action="?/dismiss" use:enhance={submitFn(key + 'no')}>
								<input type="hidden" name="bizDocId" value={m.bizDocId} />
								<input type="hidden" name="bizName" value={m.bizName} />
								<input type="hidden" name="userId" value={m.userId} />
								<input type="hidden" name="userEmail" value={m.userEmail} />
								<button
									disabled={busy === key + 'no'}
									class="rounded-lg border border-gray-600 px-4 py-1.5 text-sm font-bold text-gray-300 transition hover:bg-gray-800 disabled:opacity-40"
								>
									{busy === key + 'no' ? '…' : 'התעלם'}
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- ── היסטוריית הכרעות ────────────────────────────────── -->
	{#if history.length}
		<section class="mt-10">
			<h2 class="mb-3 text-sm font-bold text-gray-300">הכרעות אחרונות</h2>
			<div class="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900/40">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-800 text-xs text-gray-500">
							<th class="px-4 py-2 text-start font-medium">כרטיסייה</th>
							<th class="px-4 py-2 text-start font-medium">משתמש</th>
							<th class="px-4 py-2 text-start font-medium">תוצאה</th>
							<th class="px-4 py-2 text-start font-medium">מי ומתי</th>
						</tr>
					</thead>
					<tbody>
						{#each history as h (h.id)}
							<tr class="border-b border-gray-800/60 last:border-0">
								<td class="px-4 py-2 text-gray-200">{h.bizName || h.bizDocId}</td>
								<td class="px-4 py-2 text-gray-400" dir="ltr">{h.userEmail || h.userId}</td>
								<td class="px-4 py-2">
									<span
										class="font-bold {h.status === 'approved' ? 'text-green-400' : 'text-gray-400'}"
									>
										{STATUS_HE[h.status] ?? h.status}
									</span>
								</td>
								<td class="px-4 py-2 text-xs text-gray-500">
									{h.decidedBy || '—'} · {fmtDate(h.decidedAt)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</main>
