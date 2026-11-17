<script>
	// ─────────────────────────────────────────────────────────────
	// ReminderSheet — "תזכורת לחזור אל נמען". גיליון תחתון בנייד ומודאל
	// ממורכז במחשב (הדפוס של snooze בג'ימייל / גוגל קיפ):
	//
	//   • שתי בחירות מהירות — בעוד 3 ימים, בעוד שבוע — לחיצה אחת וגמרנו.
	//   • "תאריך אחר": תאריך ושעה בבורר המובנה של המכשיר, או פתיחה ישירה
	//     של יומן גוגל עם האירוע מוכן.
	//   • אחרי הקביעה: הצעה להוסיף ליומן (גוגל / קובץ .ics). זו ההתראה
	//     עצמה — לאתר אין ספק מייל או push, והיומן של המשתמש מקפיץ התראה
	//     בטלפון בדיוק בזמן, גם כשהאתר סגור.
	//
	// התזכורת נשמרת על שורת הנמען (updateShare → remindAt) ועוברת עם
	// החשבון בין מכשירים, כמו שאר היומן.
	// ─────────────────────────────────────────────────────────────
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { updateShare } from '$lib/shareLog.js';
	import { googleCalendarUrl, downloadIcs } from '$lib/calendar.js';
	import { sentText, fill } from '$lib/sentListText.js';
	import { canonical } from '$lib/seo';

	/** @type {{ entry: import('$lib/shareLogMerge.js').ShareEntry, lang?: string, locale?: string, onclose: () => void }} */
	let { entry, lang = 'he', locale = 'he-IL', onclose } = $props();

	const tx = $derived(/** @type {any} */ (sentText)[lang] || sentText.he);
	const who = $derived(entry.name || entry.pretty);

	// הערך ההתחלתי בלבד: אחרי הפתיחה המצב הפנימי (mode) הוא שמנהל את הגיליון,
	// גם כשה-entry מתעדכן מתחת אליו אחרי שמירה.
	/** pick = בחירה, other = תאריך אחר, saved = נקבעה — הצעת יומן. */
	// svelte-ignore state_referenced_locally
	let mode = $state(entry.remindAt ? 'saved' : 'pick');
	// svelte-ignore state_referenced_locally
	let savedAt = $state(entry.remindAt || 0);
	let error = $state('');

	/** @param {number} n ימים קדימה, בשעה 09:00 */
	function daysAhead(n) {
		const d = new Date();
		d.setDate(d.getDate() + n);
		d.setHours(9, 0, 0, 0);
		return d.getTime();
	}

	/** @param {number} n */
	const p2 = (n) => String(n).padStart(2, '0');
	/** @param {Date} d */
	const dateInput = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

	const tomorrow = new Date(daysAhead(1));
	let dateStr = $state(dateInput(tomorrow));
	let timeStr = $state('09:00');
	const todayStr = dateInput(new Date());

	/** @param {number} ms */
	function fmtDay(ms) {
		try {
			return new Date(ms).toLocaleDateString(locale, {
				weekday: 'long',
				day: 'numeric',
				month: 'numeric'
			});
		} catch {
			return '';
		}
	}
	/** @param {number} ms */
	function fmtTime(ms) {
		try {
			return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '';
		}
	}
	/** @param {number} ms */
	const fmtFull = (ms) => `${fmtDay(ms)} · ${fmtTime(ms)}`;

	/** @param {number} ms */
	function commit(ms) {
		if (ms <= Date.now()) {
			error = tx.errPast;
			return false;
		}
		error = '';
		updateShare(entry.key, { remindAt: ms });
		savedAt = ms;
		mode = 'saved';
		return true;
	}

	function otherMs() {
		if (!dateStr) {
			error = tx.errDate;
			return 0;
		}
		return new Date(`${dateStr}T${timeStr || '09:00'}`).getTime();
	}

	function saveOther() {
		const ms = otherMs();
		if (ms) commit(ms);
	}

	/** @param {number} ms */
	function calEvent(ms) {
		const bizUrl = entry.bizId ? canonical(`/business/${entry.bizId}`) : '';
		let details = fill(tx.evDetails, {
			phone: entry.pretty,
			wa: `https://wa.me/${entry.wa}`,
			url: bizUrl
		});
		if (!bizUrl) details = details.replace(/\n[^\n]*$/, '');
		if (entry.note) details += `\n${entry.note}`;
		return {
			title: fill(tx.evTitle, { who, biz: entry.bizName }).replace(/\s—\s*$/, ''),
			details,
			start: ms,
			minutes: 15,
			uid: `${entry.key}-${ms}`
		};
	}

	/**
	 * פתיחת יומן גוגל. מ"תאריך אחר" — שומרת גם את התזכורת באתר, כדי שהטבלה
	 * והיומן יתאימו. window.open חייב לקרות בתוך הלחיצה (חוסם חלונות).
	 * @param {number} ms
	 */
	function openGoogle(ms) {
		if (mode === 'other' && !commit(ms)) return;
		window.open(googleCalendarUrl(calEvent(ms)), '_blank', 'noopener,noreferrer');
	}

	/** @param {number} ms */
	function icsFile(ms) {
		if (mode === 'other' && !commit(ms)) return;
		downloadIcs(calEvent(ms), 'reminder.ics');
	}

	function cancelReminder() {
		updateShare(entry.key, { remindAt: 0 });
		onclose();
	}

	const isDue = $derived(Boolean(entry.remindAt) && entry.remindAt <= Date.now());

	/** @type {HTMLDivElement | undefined} */
	let panel = $state();
	onMount(() => {
		panel?.focus();
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = prev);
	});

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.key === 'Escape') onclose();
	}

	const OPT =
		'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-start transition hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-gray-700 dark:focus-visible:bg-gray-700';
	const INPUT =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light] focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:[color-scheme:dark]';
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
	transition:fade={{ duration: 150 }}
	onclick={onclose}
>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={panel}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-labelledby="reminder-title"
		class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl outline-none sm:max-w-sm sm:rounded-2xl dark:bg-gray-800"
		transition:fly={{ y: 48, duration: 200 }}
		onclick={(e) => e.stopPropagation()}
	>
		{#if mode === 'saved'}
			<div class="flex flex-col items-center gap-1 pt-1 text-center">
				<span
					class="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-xl text-green-600 dark:bg-green-900/40 dark:text-green-400"
					aria-hidden="true">✓</span
				>
				<h2 id="reminder-title" class="mt-1 text-base font-extrabold text-gray-900 dark:text-gray-100">
					{tx.savedTitle}
				</h2>
				<p class="text-sm font-bold text-blue-600 dark:text-blue-400">{fmtFull(savedAt)}</p>
				<p class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{who}</p>
			</div>
			<p class="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{tx.savedHint}</p>
			<div class="mt-3 flex flex-col gap-2">
				<button
					type="button"
					onclick={() => openGoogle(savedAt)}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
				>
					<span aria-hidden="true">📅</span>
					{tx.openGoogle}
				</button>
				<button
					type="button"
					onclick={() => icsFile(savedAt)}
					class="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
				>
					<span aria-hidden="true">⬇</span>
					{tx.downloadIcs}
				</button>
			</div>
			<div class="mt-3 flex items-center justify-between text-sm">
				<button
					type="button"
					onclick={cancelReminder}
					class="font-bold text-gray-400 transition hover:text-red-600 dark:hover:text-red-400"
				>
					{isDue ? tx.markDone : tx.cancelReminder}
				</button>
				<span class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => (mode = 'pick')}
						class="font-bold text-blue-600 hover:underline dark:text-blue-400"
					>
						{tx.reminderEdit}
					</button>
					<button
						type="button"
						onclick={onclose}
						class="font-bold text-gray-500 hover:underline dark:text-gray-300"
					>
						{tx.close}
					</button>
				</span>
			</div>
		{:else}
			<h2 id="reminder-title" class="px-1 pb-1 text-base font-extrabold text-gray-900 dark:text-gray-100">
				<span aria-hidden="true">⏰</span>
				{fill(tx.sheetTitle, { who })}
			</h2>
			{#if entry.bizName}
				<p class="px-1 pb-2 text-xs text-gray-500 dark:text-gray-400">{entry.bizName}</p>
			{/if}

			<div class="flex flex-col">
				<button type="button" class={OPT} onclick={() => commit(daysAhead(3))}>
					<span class="font-bold text-gray-900 dark:text-gray-100">{tx.in3}</span>
					<span class="text-xs text-gray-500 tabular-nums dark:text-gray-400"
						>{fmtDay(daysAhead(3))} · 09:00</span
					>
				</button>
				<button type="button" class={OPT} onclick={() => commit(daysAhead(7))}>
					<span class="font-bold text-gray-900 dark:text-gray-100">{tx.in7}</span>
					<span class="text-xs text-gray-500 tabular-nums dark:text-gray-400"
						>{fmtDay(daysAhead(7))} · 09:00</span
					>
				</button>
				<button
					type="button"
					class={OPT}
					aria-expanded={mode === 'other'}
					onclick={() => {
						mode = mode === 'other' ? 'pick' : 'other';
						error = '';
					}}
				>
					<span class="font-bold text-gray-900 dark:text-gray-100">{tx.other}</span>
					<span class="text-xs text-gray-500 dark:text-gray-400" aria-hidden="true"
						>{mode === 'other' ? '▴' : '▾'}</span
					>
				</button>
			</div>

			{#if mode === 'other'}
				<div class="mx-1 mt-1 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
					<p class="mb-2 text-xs font-bold text-gray-500 dark:text-gray-400">{tx.otherHint}</p>
					<div class="grid grid-cols-[1fr_6.5rem] gap-2">
						<label class="block">
							<span class="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">{tx.dateLabel}</span>
							<input type="date" min={todayStr} bind:value={dateStr} class={INPUT} />
						</label>
						<label class="block">
							<span class="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">{tx.timeLabel}</span>
							<input type="time" bind:value={timeStr} class={INPUT} />
						</label>
					</div>
					{#if error}
						<p class="mt-2 text-xs font-bold text-red-600 dark:text-red-400" role="alert">{error}</p>
					{/if}
					<button
						type="button"
						onclick={saveOther}
						class="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
					>
						{tx.save}
					</button>
					<button
						type="button"
						onclick={() => {
							const ms = otherMs();
							if (ms) openGoogle(ms);
						}}
						class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
					>
						<span aria-hidden="true">📅</span>
						{tx.openGoogle}
					</button>
					<p class="mt-1.5 text-center text-[11px] leading-4 text-gray-400">{tx.googleHint}</p>
				</div>
			{/if}

			<div class="mt-2 flex items-center justify-between px-1 text-sm">
				{#if entry.remindAt}
					<button
						type="button"
						onclick={cancelReminder}
						class="font-bold text-gray-400 transition hover:text-red-600 dark:hover:text-red-400"
					>
						{tx.cancelReminder}
					</button>
				{:else}
					<span></span>
				{/if}
				<button
					type="button"
					onclick={onclose}
					class="font-bold text-gray-500 hover:underline dark:text-gray-300"
				>
					{tx.close}
				</button>
			</div>
		{/if}
	</div>
</div>
