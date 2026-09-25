<script>
	import { enhance } from '$app/forms';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	const claims = $derived(data.claims ?? []);
	const matches = $derived(data.matches ?? []);
	const history = $derived(data.history ?? []);

	/* ═══════════ מעקב תגובות להזמנות ה-SMS ═══════════
	   לחיצה על מונה פותחת מתחתיו את הכרטיסיות שמאחוריו. */
	const tracking = $derived(/** @type {any[]} */ (data.smsTracking ?? []));
	/** @type {Array<[string, string, string]>} */
	const statDefs = [
		['sentAt', '📨 נשלחו', ''],
		['openedAt', '👀 נכנסו לאתר', ''],
		['declinedAt', '🙅 דחו ("לא שלי")', ''],
		['requestedAt', '⏳ ביקשו בעלות (ממתין)', ''],
		['claimedAt', '✅ קיבלו בעלות', '']
	];
	let openStat = $state('');
	const statRows = $derived(openStat ? tracking.filter((r) => r[openStat]) : []);
	/** @param {string} k */
	const statCount = (k) => tracking.filter((r) => r[k]).length;
	/** @param {number} n */
	const statPct = (n) => (tracking.length && n ? ` (${Math.round((n / tracking.length) * 100)}%)` : '');
	/** @param {string} iso */
	const shortDate = (iso) => {
		const d = new Date(iso);
		return iso && !isNaN(d.getTime()) ? d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '';
	};

	/* ═══════════ הזמנה ב-SMS ═══════════
	   השרת מביא לכל התאמה טיוטה מוכנה (הנוסח השמור עם הקישורים החתומים).
	   האדמין פותח עורך על ההתאמה, מתקן אם צריך, ושולח. הנוסח עצמו נערך
	   בתיבה נפרדת ומשותף לכל האדמינים. */
	const sms = $derived(
		data.sms ?? {
			enabled: false,
			provider: 'none',
			template: '',
			defaultTemplate: '',
			placeholders: [],
			maxChars: 480
		}
	);
	// מפתח ההתאמה שהעורך שלה פתוח ('' = סגור)
	let smsOpen = $state('');
	/** הטיוטות שנערכו, לפי מפתח התאמה — כדי שסגירה ופתיחה לא ימחקו עריכה */
	let drafts = $state(/** @type {Record<string,string>} */ ({}));
	let templateOpen = $state(false);
	let templateText = $state('');
	$effect(() => {
		templateText = sms.template;
	});

	/** SMS בעברית: 70 תווים למקטע בודד, 67 בהודעה מפוצלת. @param {string} s */
	const segments = (s) => (s.length <= 70 ? 1 : Math.ceil(s.length / 67));

	/** @param {string} key @param {string} draft */
	function openSms(key, draft) {
		if (smsOpen === key) {
			smsOpen = '';
			return;
		}
		if (!(key in drafts)) drafts[key] = draft;
		smsOpen = key;
	}

	/* ═══════════ הודעת בעלות ב-SMS ═══════════
	   אחרי שיוך השרת מחזיר טיוטה (form.ownerSms) — העורך נפתח מיד, והאדמין
	   בודק, מתקן ושולח. אותו עורך נפתח גם מ"הודע לבעלים" בהיסטוריה. */
	/** @type {{claimId: string, bizName: string, userName: string, phone: string, draft: string} | null} */
	let ownerEdit = $state(null);
	let ownerText = $state('');
	/** @param {any} o */
	function openOwner(o) {
		ownerEdit = o;
		ownerText = o?.draft ?? '';
	}
	$effect(() => {
		if (form?.ownerSms) openOwner(form.ownerSms);
	});
	let ownerTemplateOpen = $state(false);
	let ownerTemplateText = $state('');
	$effect(() => {
		ownerTemplateText = sms.ownerTemplate ?? '';
	});

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

	<!-- ── עורך הודעת הבעלות, לפני השליחה ──────────────────── -->
	{#if ownerEdit}
		<form
			method="POST"
			action="?/ownerSms"
			use:enhance={() => {
				busy = 'ownerSms';
				return async (/** @type {any} */ { result, update }) => {
					await update({ reset: false });
					busy = '';
					if (result.type === 'success') ownerEdit = null;
				};
			}}
			class="mb-4 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4"
		>
			<input type="hidden" name="claimId" value={ownerEdit.claimId} />
			<input type="hidden" name="phone" value={ownerEdit.phone} />
			<p class="mb-1.5 text-sm font-bold text-gray-200">
				📱 להודיע ל{ownerEdit.userName || 'בעל העסק'} ש"{ownerEdit.bizName}" שלו
			</p>
			{#if !ownerEdit.phone}
				<p class="text-sm text-amber-300">אין נייד תקין בפרופיל או על הכרטיסייה — אי אפשר לשלוח SMS.</p>
			{:else if !sms.enabled}
				<p class="text-sm text-amber-300">שליחת SMS אינה מוגדרת בשרת המשותף.</p>
			{:else}
				<p class="mb-1.5 text-xs text-gray-400">
					אל <span class="font-bold text-gray-200" dir="ltr">{ownerEdit.phone}</span> — ההודעה נשלחת
					כפי שהיא מופיעה כאן:
				</p>
				<textarea
					name="message"
					rows="4"
					maxlength={sms.maxChars}
					bind:value={ownerText}
					class="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm leading-6 text-gray-100 outline-none focus:border-blue-500"
				></textarea>
			{/if}
			<div class="mt-2 flex flex-wrap items-center gap-2">
				{#if ownerEdit.phone && sms.enabled}
					<button
						disabled={busy === 'ownerSms' || !ownerText.trim()}
						class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
					>
						{busy === 'ownerSms' ? 'שולח…' : '📱 שלח עכשיו'}
					</button>
					<button
						type="button"
						onclick={() => (ownerText = ownerEdit?.draft ?? '')}
						class="rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-bold text-gray-300 transition hover:bg-gray-800"
					>
						אפס לנוסח
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (ownerEdit = null)}
					class="rounded-lg px-3 py-1.5 text-sm font-bold text-gray-400 transition hover:bg-gray-800"
				>
					{ownerEdit.phone && sms.enabled ? 'בלי SMS' : 'סגור'}
				</button>
				{#if ownerEdit.phone && sms.enabled}
					<span class="text-[11px] text-gray-500">
						{ownerText.length} תווים · {segments(ownerText)} מקטעי SMS
					</span>
				{/if}
			</div>
		</form>
	{/if}

	<!-- ── מעקב תגובות להזמנות ה-SMS ─────────────────────────── -->
	{#if tracking.length}
		<section class="mb-8 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
			<h2 class="mb-3 text-sm font-bold text-gray-200">📊 מעקב תגובות להזמנות SMS</h2>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
				{#each statDefs as [k, label] (k)}
					{@const n = statCount(k)}
					<button
						type="button"
						onclick={() => (openStat = openStat === k ? '' : k)}
						class="rounded-xl px-3 py-2 text-center transition {openStat === k
							? 'bg-blue-600 ring-2 ring-blue-300'
							: 'bg-gray-800 hover:bg-gray-700'}"
					>
						<div class="text-2xl font-black text-white">
							{n}<span class="text-xs font-bold text-gray-200">{k === 'sentAt' ? '' : statPct(n)}</span>
						</div>
						<div class="text-xs text-gray-100">{label} {openStat === k ? '▲' : '▼'}</div>
					</button>
				{/each}
			</div>
			{#if openStat}
				<div class="mt-3 space-y-1.5">
					{#if statRows.length === 0}
						<p class="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200">אין עדיין אף אחד כאן.</p>
					{/if}
					{#each statRows as r (r.key)}
						<div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl bg-gray-800 px-3 py-2 text-sm">
							<a href="/business/{r.bizDocId}" target="_blank" rel="noopener" class="font-bold text-white hover:text-blue-300">
								{r.bizName || r.bizDocId}
							</a>
							<span class="text-xs text-gray-300">
								{r.userName}{r.phone ? ' · ' : ''}<span dir="ltr">{r.phone}</span>
							</span>
							<span class="ms-auto flex flex-wrap gap-1.5 text-xs font-bold">
								<span class="text-emerald-300">📨 {shortDate(r.sentAt)}</span>
								{#if r.openedAt}<span class="text-sky-300">👀 {shortDate(r.openedAt)}{r.opens > 1 ? ` (${r.opens}×)` : ''}</span>{/if}
								{#if r.declinedAt}<span class="text-rose-300">🙅 {shortDate(r.declinedAt)}</span>{/if}
								{#if r.requestedAt}<span class="text-amber-300">⏳ {shortDate(r.requestedAt)}</span>{/if}
								{#if r.claimedAt}<span class="text-emerald-300">✅ בעלים {shortDate(r.claimedAt)}</span>{/if}
							</span>
						</div>
					{/each}
				</div>
			{/if}
			<p class="mt-2 text-xs text-gray-500">לחצו על מונה כדי לראות את הכרטיסיות שמאחוריו. כניסות נספרות מהקישור שב-SMS.</p>
		</section>
	{/if}

	<!-- ── בקשות שמשתמשים שלחו ─────────────────────────────── -->
	<section>
		<h2 class="mb-3 text-sm font-bold text-gray-300">
			בקשות בעלות
			{#if claims.length}<span class="text-gray-500">({claims.length})</span>{/if}
		</h2>

		<!-- ── נוסח הודעת הבעלות ───────────────────────────────── -->
		<div class="mb-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
			<button
				type="button"
				onclick={() => (ownerTemplateOpen = !ownerTemplateOpen)}
				class="text-sm font-bold text-gray-200 hover:text-blue-400"
			>
				{ownerTemplateOpen ? '▾' : '◂'} נוסח ה-SMS שנשלח אחרי אישור בעלות
			</button>
			{#if ownerTemplateOpen}
				<form
					method="POST"
					action="?/saveOwnerTemplate"
					use:enhance={submitFn('ownerTemplate')}
					class="mt-3"
				>
					<textarea
						name="template"
						rows="4"
						maxlength={sms.maxChars}
						bind:value={ownerTemplateText}
						class="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm leading-6 text-gray-100 outline-none focus:border-blue-500"
					></textarea>
					<p class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
						{#each sms.ownerPlaceholders ?? [] as p (p.key)}
							<span><code class="text-blue-300">{p.key}</code> {p.help}</span>
						{/each}
					</p>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<button
							disabled={busy === 'ownerTemplate'}
							class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
						>
							{busy === 'ownerTemplate' ? '…' : 'שמור נוסח'}
						</button>
						<button
							type="button"
							onclick={() => (ownerTemplateText = sms.defaultOwnerTemplate ?? '')}
							class="rounded-lg border border-gray-600 px-4 py-1.5 text-sm font-bold text-gray-300 transition hover:bg-gray-800"
						>
							חזרה לברירת המחדל
						</button>
						<span class="text-[11px] text-gray-500">
							אחרי כל אישור ההודעה נפתחת לעריכה לפני שהיא יוצאת.
						</span>
					</div>
				</form>
			{/if}
		</div>

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
			משתמשים רשומים שהטלפון או האימייל שלהם זהים לאלה שעל כרטיסייה בלי בעלים. אפשר לשייך ישירות,
			לסמן שההתאמה אינה נכונה כדי שלא תחזור, או לשלוח לבעל העסק SMS עם הזמנה להיכנס ולבקש את
			הכרטיסייה בעצמו (ההודעה כוללת גם קישור "לא שלי").
		</p>

		<!-- ── נוסח ה-SMS + מצב הספק ─────────────────────────── -->
		<div class="mb-4 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<button
					type="button"
					onclick={() => (templateOpen = !templateOpen)}
					class="text-sm font-bold text-gray-200 hover:text-blue-400"
				>
					{templateOpen ? '▾' : '◂'} נוסח ההזמנה ב-SMS
				</button>
				{#if sms.enabled}
					<span
						class="rounded-full border border-green-500/30 bg-green-900/40 px-2.5 py-0.5 text-[11px] font-bold text-green-300"
					>
						SMS פעיל · {sms.provider}
					</span>
				{:else}
					<span
						class="rounded-full border border-amber-500/30 bg-amber-900/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-200"
						title="הספק מוגדר בשרת המשותף (api.gofreeil.com): SMSGATE_* / TRACCAR_SMS_TOKEN / TWILIO_*"
					>
						שליחת SMS אינה מוגדרת בשרת המשותף
					</span>
				{/if}
			</div>

			{#if templateOpen}
				<form method="POST" action="?/saveTemplate" use:enhance={submitFn('template')} class="mt-3">
					<textarea
						name="template"
						rows="6"
						maxlength={sms.maxChars}
						bind:value={templateText}
						class="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm leading-6 text-gray-100 outline-none focus:border-blue-500"
					></textarea>
					<p class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
						{#each sms.placeholders as p (p.key)}
							<span><code class="text-blue-300">{p.key}</code> {p.help}</span>
						{/each}
					</p>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<button
							disabled={busy === 'template'}
							class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
						>
							{busy === 'template' ? '…' : 'שמור נוסח'}
						</button>
						<button
							type="button"
							onclick={() => (templateText = sms.defaultTemplate)}
							class="rounded-lg border border-gray-600 px-4 py-1.5 text-sm font-bold text-gray-300 transition hover:bg-gray-800"
						>
							חזרה לברירת המחדל
						</button>
						<span class="text-[11px] text-gray-500">
							הנוסח משותף לכל האדמינים. לפני כל שליחה אפשר עוד לערוך את ההודעה הספציפית.
						</span>
					</div>
				</form>
			{/if}
		</div>

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
							{#if m.smsSent}
								<p class="mt-0.5 text-[11px] text-emerald-400">
									✓ נשלח SMS {fmtDate(m.smsSent.at)}{m.smsSent.by ? ' · ' + m.smsSent.by : ''}
								</p>
							{/if}
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
							<button
								type="button"
								disabled={!sms.enabled || !m.smsPhone}
								title={!sms.enabled
									? 'שליחת SMS אינה מוגדרת בשרת המשותף'
									: !m.smsPhone
										? 'אין לנמען מספר נייד תקין'
										: 'הזמנה ב-SMS לבקש את הכרטיסייה'}
								onclick={() => openSms(key, m.smsDraft)}
								class="rounded-lg border px-4 py-1.5 text-sm font-bold transition disabled:opacity-40 {smsOpen ===
								key
									? 'border-blue-500 bg-blue-900/40 text-blue-200'
									: 'border-blue-500/40 text-blue-300 hover:bg-blue-900/30'}"
							>
								📱 {m.smsSent ? 'שלח SMS שוב' : 'שלח SMS'}
							</button>
						</div>

						<!-- ── עורך ההודעה לפני השליחה ─────────────────── -->
						{#if smsOpen === key}
							<form
								method="POST"
								action="?/sms"
								use:enhance={({ cancel }) => {
									if (
										m.smsSent &&
										!confirm(`כבר נשלח SMS לנמען הזה ב-${fmtDate(m.smsSent.at)}. לשלוח שוב?`)
									) {
										cancel();
										return;
									}
									busy = key + 'sms';
									return async (/** @type {any} */ { result, update }) => {
										await update({ reset: false });
										busy = '';
										if (result.type === 'success') smsOpen = '';
									};
								}}
								class="mt-1 w-full rounded-xl border border-blue-500/20 bg-blue-950/20 p-3"
							>
								<input type="hidden" name="bizDocId" value={m.bizDocId} />
								<input type="hidden" name="userId" value={m.userId} />
								<input type="hidden" name="userName" value={m.userName} />
								<input type="hidden" name="bizName" value={m.bizName} />
								<input type="hidden" name="phone" value={m.smsPhone} />
								<p class="mb-1.5 text-xs text-gray-400">
									אל <span class="font-bold text-gray-200" dir="ltr">{m.smsPhone}</span>
									{#if m.userName}· {m.userName}{/if}
									— ההודעה נשלחת כפי שהיא מופיעה כאן:
								</p>
								<textarea
									name="message"
									rows="6"
									maxlength={sms.maxChars}
									bind:value={drafts[key]}
									class="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm leading-6 text-gray-100 outline-none focus:border-blue-500"
								></textarea>
								<div class="mt-2 flex flex-wrap items-center gap-2">
									<button
										disabled={busy === key + 'sms' || !(drafts[key] ?? '').trim()}
										class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
									>
										{busy === key + 'sms' ? 'שולח…' : '📱 שלח עכשיו'}
									</button>
									<button
										type="button"
										onclick={() => (drafts[key] = m.smsDraft)}
										class="rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-bold text-gray-300 transition hover:bg-gray-800"
									>
										אפס לנוסח
									</button>
									<button
										type="button"
										onclick={() => (smsOpen = '')}
										class="rounded-lg px-3 py-1.5 text-sm font-bold text-gray-400 transition hover:bg-gray-800"
									>
										ביטול
									</button>
									<span class="text-[11px] text-gray-500">
										{(drafts[key] ?? '').length} תווים · {segments(drafts[key] ?? '')} מקטעי SMS
									</span>
								</div>
							</form>
						{/if}
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
							<th class="px-4 py-2"></th>
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
								<td class="px-4 py-2 text-end">
									{#if h.ownerSms}
										<button
											type="button"
											onclick={() => {
												openOwner(h.ownerSms);
												window.scrollTo({ top: 0, behavior: 'smooth' });
											}}
											title="SMS לבעל העסק שהכרטיסייה שלו, עם קישור לעריכה"
											class="rounded-lg border border-blue-500/40 px-3 py-1 text-xs font-bold whitespace-nowrap text-blue-300 transition hover:bg-blue-900/30"
										>
											📱 הודע לבעלים
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</main>
