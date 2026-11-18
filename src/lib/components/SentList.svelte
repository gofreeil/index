<script>
	// ─────────────────────────────────────────────────────────────
	// SentList — "למי שלחתי": כל מי שקיבל ממני כרטיס עסק דרך השיתוף החכם.
	// מוצג באזור האישי. הנתונים נשמרים בחשבון (shareLog.js → api/share-log).
	//
	// מעבר לרשימה, הטבלה היא כלי מעקב קטן — הדפוס של CRM קל:
	//   • תזכורת לחזור לנמען (3 ימים / שבוע / תאריך אחר + יומן) — ReminderSheet
	//   • תזכורות שהגיע זמנן עולות לראש הרשימה, עם כותרת "להיום"
	//   • עריכת שם והערה במקום (לחיצה), מחיקת שורה עם "ביטול"
	//   • "המשך שיחה" — וואטסאפ עם הודעת מעקב מוכנה, לא שיחה ריקה
	//   • חיפוש, סינון לתזכורות, וייצוא לאקסל
	// ─────────────────────────────────────────────────────────────
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fly } from 'svelte/transition';
	import {
		shareLog,
		revealKey,
		clearShareLog,
		syncShareLog,
		updateShare,
		removeShare,
		restoreShare
	} from '$lib/shareLog.js';
	import { sentText, fill } from '$lib/sentListText.js';
	import { arrival } from '$lib/zoomNav.js';
	import { canonical } from '$lib/seo';
	import ReminderSheet from '$lib/components/ReminderSheet.svelte';

	/** @type {{ canShare?: boolean, lang?: string, t: any }} */
	let { canShare = true, lang = 'he', t } = $props();

	const LOCALE = /** @type {Record<string,string>} */ ({ he: 'he-IL', en: 'en-US', ru: 'ru-RU' });
	const locale = $derived(LOCALE[lang] || 'he-IL');
	const tx = $derived(/** @type {any} */ (sentText)[lang] || sentText.he);

	// הרשימה נקראת מ-localStorage — רק אחרי ההרכבה, כדי שהצד השרתי והצד
	// הלקוח לא ירנדרו תוכן שונה.
	let mounted = $state(false);
	let syncing = $state(true);
	/** "עכשיו" חי: תזכורת שהגיע זמנה מתחלפת למצב "באיחור" בלי רענון. */
	let now = $state(Date.now());
	/** @type {HTMLElement | undefined} */
	let root = $state();
	/** השורה שהמשתמש הגיע אליה מהשיתוף החכם (נבחרה שם ברגע שמירת השם). */
	let fresh = $state('');
	/** הבהוב השורה החדשה — נמשך כמה שניות ודועך. */
	let glow = $state(false);

	function scrollToFresh() {
		const li = [...(root?.querySelectorAll('li[data-key]') ?? [])].find(
			(n) => /** @type {HTMLElement} */ (n).dataset.key === fresh
		);
		const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		li?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
	}

	onMount(() => {
		mounted = true;
		syncShareLog().finally(() => (syncing = false));
		const tick = setInterval(() => (now = Date.now()), 60_000);

		/** @type {ReturnType<typeof setTimeout>[]} */
		const timers = [];
		let alive = true;
		const arrivedFor = get(revealKey);
		if (arrivedFor) {
			revealKey.set('');
			fresh = arrivedFor;
			glow = true;
			// הגענו בזום (zoomNav) — מחכים שהאזור האישי ייפתח עד הסוף, ורק אז
			// "נוסעים" מראש הדף אל השורה. בלי זום ההבטחה כבר פתורה, והגלילה
			// ממקמת את השורה אחרי שהניווט גלל לעוגן (#sent).
			void arrival().then(() => {
				if (!alive) return;
				timers.push(setTimeout(scrollToFresh, 120), setTimeout(() => (glow = false), 4500));
			});
		}
		return () => {
			alive = false;
			clearInterval(tick);
			timers.forEach(clearTimeout);
		};
	});
	const all = $derived(mounted ? $shareLog : []);
	const freshEntry = $derived(fresh ? (all.find((e) => e.key === fresh) ?? null) : null);

	// ── חיפוש וסינון ─────────────────────────────────────────────
	let query = $state('');
	let onlyReminders = $state(false);

	const endOfToday = $derived.by(() => {
		const d = new Date(now);
		d.setHours(23, 59, 59, 999);
		return d.getTime();
	});

	/** @param {string} s */
	const digits = (s) => s.replace(/\D/g, '');

	const rows = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const qd = digits(q);
		const list = all.filter((e) => {
			if (onlyReminders && !e.remindAt) return false;
			if (!q) return true;
			const text = `${e.name} ${e.bizName} ${e.note} ${e.pretty}`.toLowerCase();
			return text.includes(q) || (qd.length >= 3 && digits(e.pretty + e.wa).includes(qd));
		});
		// תזכורות להיום/באיחור קודם (הקרובה ביותר ראשונה), אחריהן לפי תאריך השליחה
		const urgent = (/** @type {any} */ e) => Boolean(e.remindAt) && e.remindAt <= endOfToday;
		return [...list].sort((a, b) => {
			const ua = urgent(a);
			const ub = urgent(b);
			if (ua !== ub) return ua ? -1 : 1;
			if (ua && ub) return a.remindAt - b.remindAt;
			return b.at - a.at;
		});
	});

	const dueToday = $derived(all.filter((e) => e.remindAt && e.remindAt <= endOfToday).length);
	const withReminder = $derived(all.filter((e) => e.remindAt).length);

	// ── תצוגה ────────────────────────────────────────────────────
	/** @param {number} ts */
	function fmtDate(ts) {
		try {
			return new Date(ts).toLocaleDateString(locale, {
				day: '2-digit',
				month: '2-digit',
				year: '2-digit'
			});
		} catch {
			return '';
		}
	}

	/** @param {number} ts */
	function fmtRemind(ts) {
		try {
			const d = new Date(ts);
			const day = d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
			const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
			return `${day} · ${time}`;
		} catch {
			return '';
		}
	}

	/**
	 * מצב התזכורת: due = הגיע זמנה, today = היום עוד מעט, future = בהמשך.
	 * @param {number} ts
	 */
	function remState(ts) {
		if (ts <= now) return 'due';
		return ts <= endOfToday ? 'today' : 'future';
	}

	const REM_CLS = /** @type {Record<string,string>} */ ({
		due: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-300',
		today:
			'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-300',
		future:
			'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/30 dark:text-blue-300'
	});

	// ── עריכה במקום (שם / הערה) ──────────────────────────────────
	let edit = $state({ key: '', field: '' });
	let draft = $state('');

	/** @param {any} e @param {'name'|'note'} field */
	function startEdit(e, field) {
		edit = { key: e.key, field };
		draft = e[field] || '';
	}
	function commitEdit() {
		if (!edit.key) return; // Escape כבר ביטל — ה-blur שאחריו לא שומר
		const { key, field } = edit;
		edit = { key: '', field: '' };
		updateShare(key, { [field]: draft });
	}
	/** @param {KeyboardEvent} ev */
	function editKey(ev) {
		if (ev.key === 'Enter') {
			ev.preventDefault();
			commitEdit();
		} else if (ev.key === 'Escape') {
			ev.stopPropagation();
			edit = { key: '', field: '' };
		}
	}
	/** @param {HTMLElement} node */
	function focusOnMount(node) {
		node.focus();
		if (node instanceof HTMLInputElement) node.select();
	}

	// ── תזכורת ───────────────────────────────────────────────────
	let sheetKey = $state('');
	const sheetEntry = $derived(all.find((e) => e.key === sheetKey) ?? null);

	// ── מחיקה עם ביטול ───────────────────────────────────────────
	/** @type {import('$lib/shareLogMerge.js').ShareEntry | null} */
	let undoEntry = $state(null);
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let undoTimer;
	/** @param {string} key */
	function del(key) {
		const gone = removeShare(key);
		if (!gone) return;
		undoEntry = gone;
		clearTimeout(undoTimer);
		undoTimer = setTimeout(() => (undoEntry = null), 6000);
	}
	function undo() {
		if (undoEntry) restoreShare(undoEntry);
		undoEntry = null;
		clearTimeout(undoTimer);
	}

	// ── ניקוי הכול ───────────────────────────────────────────────
	let confirmClear = $state(false);
	function clearAll() {
		void clearShareLog();
		confirmClear = false;
	}

	// ── וואטסאפ: המשך שיחה ───────────────────────────────────────
	/** @param {any} e */
	function followUpHref(e) {
		const url = e.bizId ? canonical(`/business/${e.bizId}`) : '';
		const vars = { name: e.name ? ` ${e.name}` : '', biz: e.bizName || '', url };
		const text = e.bizName ? fill(tx.followMsg, vars) : fill(tx.followMsgNoBiz, vars);
		return `https://wa.me/${e.wa}?text=${encodeURIComponent(text)}`;
	}

	// ── ייצוא לאקסל (CSV עם BOM, כדי שהעברית תיפתח נכון) ─────────
	/** @param {string} v */
	const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
	function exportCsv() {
		const head = [tx.colName, tx.colPhone, tx.colCard, tx.colSent, tx.colReminder, tx.colNote];
		const body = all.map((e) => [
			e.name,
			e.pretty,
			e.bizName,
			e.at ? fmtDate(e.at) : '',
			e.remindAt ? fmtRemind(e.remindAt) : '',
			e.note
		]);
		const csv = [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n');
		const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'sent-list.csv';
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	const FIELD =
		'w-full rounded-md border border-blue-400 bg-white px-2 py-1 text-base text-gray-900 focus:outline-none dark:border-blue-500 dark:bg-gray-900 dark:text-gray-100';
	const ICON_BTN =
		'flex h-7 w-7 items-center justify-center rounded-lg text-lg transition focus-visible:outline-2 focus-visible:outline-blue-500';
	/** עמודות הטבלה (מ-md): שם · טלפון · הערה · כרטיסייה · תאריך · תזכורת · פעולות. אותה תבנית לכותרות ולשורות. */
	const GRID =
		'md:grid-cols-[minmax(0,1fr)_6.25rem_minmax(0,1.3fr)_minmax(0,1fr)_4rem_7rem_4rem]';
	/** תווית שדה קטנה — רק בנייד, שם אין שורת כותרות. */
	const LBL = 'mb-0.5 block text-xs font-bold text-gray-400 md:hidden';
</script>

{#if all.length || canShare}
	<!-- id="sent": העוגן שאליו מוביל השיתוף החכם (/profile#sent) -->
	<section
		id="sent"
		bind:this={root}
		class="w-full scroll-mt-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
			<h2 class="text-xl font-extrabold text-gray-900 dark:text-gray-100">
				{t.sentList}
				{#if all.length}<span class="text-sm font-bold text-gray-400">({all.length})</span>{/if}
			</h2>
			{#if confirmClear}
				<span class="flex items-center gap-3 text-base">
					<span class="text-gray-500 dark:text-gray-400">{t.sentClearConfirm}</span>
					<button
						type="button"
						onclick={clearAll}
						class="font-bold text-red-600 hover:underline dark:text-red-400"
					>
						{t.sentClear}
					</button>
					<button
						type="button"
						onclick={() => (confirmClear = false)}
						class="font-bold text-gray-400 hover:underline"
					>
						{t.cancel}
					</button>
				</span>
			{:else if all.length}
				<span class="flex items-center gap-3 text-base">
					<button
						type="button"
						onclick={exportCsv}
						class="font-bold text-gray-400 transition hover:text-blue-600 dark:hover:text-blue-400"
					>
						{tx.exportCsv}
					</button>
					<button
						type="button"
						onclick={() => (confirmClear = true)}
						class="font-bold text-gray-400 transition hover:text-red-600 dark:hover:text-red-400"
					>
						{t.sentClear}
					</button>
				</span>
			{/if}
		</div>

		<!-- הגעה מהשיתוף החכם: אישור, וקיצורי הדרך הטבעיים של מי ששלח ליד — לקבוע לו תזכורת, או לחזור לכרטיס ולשלוח לעוד אחד -->
		{#if freshEntry}
			<div
				class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-500/40 dark:bg-emerald-900/30"
			>
				<span class="font-bold text-emerald-800 dark:text-emerald-300">
					✓ {fill(tx.freshAdded, { name: freshEntry.name || freshEntry.pretty })}
				</span>
				<button
					type="button"
					onclick={() => (sheetKey = freshEntry.key)}
					class="font-bold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
				>
					⏰ {tx.reminderAdd}
				</button>
				{#if freshEntry.bizId}
					<a
						href="/business/{freshEntry.bizId}"
						class="font-bold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
					>
						{tx.sendAnother}
					</a>
				{/if}
				<button
					type="button"
					onclick={() => (fresh = '')}
					aria-label={tx.close}
					class="ms-auto text-emerald-700/60 transition hover:text-emerald-800 dark:text-emerald-300/60"
				>
					✕
				</button>
			</div>
		{/if}

		{#if dueToday > 0}
			<button
				type="button"
				onclick={() => (onlyReminders = !onlyReminders)}
				class="mb-3 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-start text-sm font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200"
			>
				<span aria-hidden="true">🔔</span>
				{dueToday === 1 ? tx.todayBannerOne : fill(tx.todayBanner, { n: dueToday })}
			</button>
		{/if}

		{#if all.length >= 4}
			<div class="mb-2 flex items-center gap-2">
				<input
					type="search"
					bind:value={query}
					placeholder={tx.search}
					aria-label={tx.search}
					class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100"
				/>
				{#if withReminder}
					<button
						type="button"
						aria-pressed={onlyReminders}
						onclick={() => (onlyReminders = !onlyReminders)}
						class="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-bold transition {onlyReminders
							? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
							: 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}"
					>
						{tx.onlyReminders} ({withReminder})
					</button>
				{/if}
			</div>
		{/if}

		{#if !all.length}
			<p
				class="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400"
			>
				{syncing ? t.sentLoading : t.sentEmpty}
			</p>
		{:else if !rows.length}
			<p class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{tx.noResults}</p>
		{:else}
			<!-- טבלה: במסך רחב שורת כותרות ועמודות קבועות; בנייד כל שורה הופכת לכרטיס קטן
			     עם תווית קטנה מעל כל שדה (LBL מוסתרת מ-md ומעלה) -->
			<div
				role="presentation"
				class="-mx-2 mb-1 hidden items-center gap-x-2 border-b border-gray-200 px-2 pb-1.5 text-xs font-bold text-gray-400 md:grid {GRID} dark:border-gray-600"
			>
				<span>{tx.colName}</span>
				<span>{tx.colPhone}</span>
				<span>{tx.colNote}</span>
				<span>{tx.colCard}</span>
				<span>{tx.colSent}</span>
				<span>{tx.colReminder}</span>
				<span class="sr-only">{tx.colActions}</span>
			</div>
			<ul>
				{#each rows as e (e.key)}
					{@const st = e.remindAt ? remState(e.remindAt) : ''}
					<li
						data-key={e.key}
						class="-mx-2 grid grid-cols-2 items-center gap-x-2 gap-y-1.5 rounded-lg border-b border-gray-100 px-2 py-2 transition-colors duration-700 last:border-0 {GRID} dark:border-gray-700/60 {glow &&
						e.key === fresh
							? 'bg-emerald-100/80 dark:bg-emerald-900/30'
							: ''}"
					>
						<!-- שם — ניתן לעריכה בלחיצה -->
						<div class="min-w-0">
							<span class={LBL}>{tx.colName}</span>
							{#if edit.key === e.key && edit.field === 'name'}
								<input
									use:focusOnMount
									bind:value={draft}
									onkeydown={editKey}
									onblur={commitEdit}
									maxlength="60"
									placeholder={tx.namePlaceholder}
									aria-label={tx.namePlaceholder}
									class={FIELD}
								/>
							{:else}
								<button
									type="button"
									onclick={() => startEdit(e, 'name')}
									class="max-w-full truncate text-start text-base font-bold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
									title={tx.namePlaceholder}
								>
									{#if e.name}{e.name}{:else}<span class="font-medium text-gray-400"
											>{tx.noName} ✎</span
										>{/if}
								</button>
							{/if}
						</div>

						<!-- טלפון — קישור לשיחה ריקה בוואטסאפ -->
						<div class="min-w-0">
							<span class={LBL}>{tx.colPhone}</span>
							<a
								href="https://wa.me/{e.wa}"
								target="_blank"
								rel="noopener noreferrer"
								title={t.sentOpenChat}
								dir="ltr"
								class="inline-block text-sm font-medium text-green-600 hover:underline dark:text-green-400"
							>
								{e.pretty}
							</a>
						</div>

						<!-- הערה — ניתנת לעריכה בלחיצה -->
						<div class="col-span-2 min-w-0 md:col-span-1">
							<span class={LBL}>{tx.colNote}</span>
							{#if edit.key === e.key && edit.field === 'note'}
								<input
									use:focusOnMount
									bind:value={draft}
									onkeydown={editKey}
									onblur={commitEdit}
									maxlength="300"
									placeholder={tx.notePlaceholder}
									aria-label={tx.notePlaceholder}
									class={FIELD}
								/>
							{:else if e.note}
								<button
									type="button"
									onclick={() => startEdit(e, 'note')}
									class="block max-w-full text-start text-sm leading-5 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
								>
									{e.note}
								</button>
							{:else}
								<button
									type="button"
									onclick={() => startEdit(e, 'note')}
									class="text-sm font-bold text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
								>
									+ {tx.noteAdd}
								</button>
							{/if}
						</div>

						<!-- הכרטיסייה שנשלחה -->
						<div class="min-w-0 text-sm leading-5 break-words text-gray-600 dark:text-gray-300">
							<span class={LBL}>{tx.colCard}</span>
							{e.bizName || '—'}
						</div>

						<!-- תאריך השליחה -->
						<div class="min-w-0 text-sm text-gray-600 tabular-nums dark:text-gray-300">
							<span class={LBL}>{tx.colSent}</span>
							{e.at ? fmtDate(e.at) : '—'}
						</div>

						<!-- תזכורת -->
						<div class="min-w-0">
							<span class={LBL}>{tx.colReminder}</span>
							<button
								type="button"
								onclick={() => (sheetKey = e.key)}
								title={e.remindAt ? tx.reminderEdit : tx.reminderAdd}
								class="flex items-center gap-1 rounded-lg border px-1.5 py-1 text-start text-xs font-bold transition {e.remindAt
									? REM_CLS[st]
									: 'border-gray-200 text-gray-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}"
							>
								<span aria-hidden="true">{e.remindAt ? '🔔' : '⏰'}</span>
								{#if e.remindAt}
									<span class="tabular-nums"
										>{st === 'due' ? `${tx.overdue} · ` : st === 'today' ? `${tx.today} · ` : ''}{fmtRemind(
											e.remindAt
										)}</span
									>
								{:else}
									{tx.reminderAdd}
								{/if}
							</button>
						</div>

						<!-- פעולות: המשך שיחה, מחיקה -->
						<div class="flex items-center justify-end gap-0.5 md:justify-start">
							<a
								href={followUpHref(e)}
								target="_blank"
								rel="noopener noreferrer"
								title={tx.followUp}
								aria-label={tx.followUp}
								class="{ICON_BTN} text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
							>
								<span aria-hidden="true">💬</span>
							</a>
							<button
								type="button"
								onclick={() => del(e.key)}
								title={tx.del}
								aria-label={tx.del}
								class="{ICON_BTN} text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
							>
								<span aria-hidden="true">🗑</span>
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

{#if sheetEntry}
	<ReminderSheet entry={sheetEntry} {lang} {locale} onclose={() => (sheetKey = '')} />
{/if}

{#if undoEntry}
	<div
		class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
		transition:fly={{ y: 24, duration: 180 }}
		role="status"
	>
		<div
			class="flex items-center gap-4 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-xl dark:bg-gray-700"
		>
			<span>{tx.deleted}</span>
			<button type="button" onclick={undo} class="font-extrabold text-blue-300 hover:underline">
				{tx.undo}
			</button>
		</div>
	</div>
{/if}
