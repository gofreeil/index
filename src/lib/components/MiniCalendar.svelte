<script>
	// ─────────────────────────────────────────────────────────────
	// MiniCalendar — יומן קטן באזור האישי, מתחת ל"למי שלחתי".
	//   • לשונית "הערות": חודש קומפקטי. לחיצה על יום → ההערות שלו + התזכורות
	//     מהטבלה שנופלות בו. הערות נשמרות בחשבון (api/calendar-notes) ועוברות
	//     בין מכשירים; כל הערה אפשר לשלוח ליומן גוגל בלחיצה (קישור TEMPLATE —
	//     בלי הרשאות גוגל נוספות).
	//   • לשונית "גוגל": יומן הגוגל של המשתמש עצמו (embed). מוצג רק אם הוא
	//     מחובר לגוגל באותו דפדפן — גוגל לא מאפשר עריכה בתוך ה-embed.
	// ─────────────────────────────────────────────────────────────
	import { onMount } from 'svelte';
	import { shareLog } from '$lib/shareLog.js';
	import { mergeNotes } from '$lib/calendarNotes.js';
	import { googleCalendarUrl } from '$lib/calendar.js';

	/** @type {{ lang?: string, email?: string }} */
	let { lang = 'he', email = '' } = $props();

	const TEXT = /** @type {Record<string, any>} */ ({
		he: {
			title: 'היומן שלי',
			notes: 'הערות',
			google: 'יומן גוגל',
			add: 'הוספה',
			placeholder: 'הערה ליום הזה…',
			empty: 'אין הערות ליום הזה',
			toGoogle: 'הוספה ליומן גוגל',
			del: 'מחיקה',
			today: 'היום',
			reminder: 'תזכורת',
			googleHint: 'מוצג כשאתם מחוברים לגוגל בדפדפן הזה. לעריכה —',
			openGoogle: 'פתיחה ביומן גוגל',
			days: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
		},
		en: {
			title: 'My calendar',
			notes: 'Notes',
			google: 'Google Calendar',
			add: 'Add',
			placeholder: 'Note for this day…',
			empty: 'No notes for this day',
			toGoogle: 'Add to Google Calendar',
			del: 'Delete',
			today: 'Today',
			reminder: 'Reminder',
			googleHint: 'Shown when you are signed in to Google in this browser. To edit —',
			openGoogle: 'open Google Calendar',
			days: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
		},
		ru: {
			title: 'Мой календарь',
			notes: 'Заметки',
			google: 'Google Календарь',
			add: 'Добавить',
			placeholder: 'Заметка на этот день…',
			empty: 'Нет заметок на этот день',
			toGoogle: 'Добавить в Google Календарь',
			del: 'Удалить',
			today: 'Сегодня',
			reminder: 'Напоминание',
			googleHint: 'Показывается, если вы вошли в Google в этом браузере. Для правки —',
			openGoogle: 'открыть Google Календарь',
			days: ['В', 'П', 'В', 'С', 'Ч', 'П', 'С']
		}
	});
	const LOCALE = /** @type {Record<string,string>} */ ({ he: 'he-IL', en: 'en-US', ru: 'ru-RU' });
	const tx = $derived(TEXT[lang] || TEXT.he);
	const locale = $derived(LOCALE[lang] || 'he-IL');

	const LS_NOTES = 'idx-calnotes';
	const LS_TAB = 'idx-cal-tab';

	/** @param {number} n */
	const p2 = (n) => String(n).padStart(2, '0');
	/** @param {Date} d */
	const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

	let mounted = $state(false);
	/** @type {import('$lib/calendarNotes.js').CalNote[]} */
	let notes = $state([]);
	let tab = $state('notes');
	let todayKey = $state(ymd(new Date()));
	let selected = $state(ymd(new Date()));
	let view = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	let draft = $state('');
	let draftTime = $state('');

	/** @param {any[]} list */
	function setNotes(list) {
		notes = mergeNotes(list);
		try {
			localStorage.setItem(LS_NOTES, JSON.stringify(notes));
		} catch {
			/* מצב פרטי — עובדים מהזיכרון */
		}
	}

	/** @param {any[]} changed */
	async function push(changed) {
		try {
			const res = await fetch('/api/calendar-notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notes: changed })
			});
			if (res.ok) setNotes(mergeNotes(notes, (await res.json()).notes));
		} catch {
			/* בלי רשת — העותק המקומי נשמר ויישלח בכניסה הבאה */
		}
	}

	onMount(() => {
		mounted = true;
		/** @type {any[]} */
		let local = [];
		try {
			local = JSON.parse(localStorage.getItem(LS_NOTES) || '[]');
			tab = localStorage.getItem(LS_TAB) === 'google' && email ? 'google' : 'notes';
		} catch {
			/* ignore */
		}
		setNotes(local);
		if (notes.length) void push(notes);
		else
			fetch('/api/calendar-notes')
				.then((r) => (r.ok ? r.json() : null))
				.then((d) => d?.notes && setNotes(d.notes))
				.catch(() => {});
		const tick = setInterval(() => (todayKey = ymd(new Date())), 60_000);
		return () => clearInterval(tick);
	});

	/** @param {string} t */
	function setTab(t) {
		tab = t;
		try {
			localStorage.setItem(LS_TAB, t);
		} catch {
			/* ignore */
		}
	}

	// ── החודש המוצג ──────────────────────────────────────────────
	const monthLabel = $derived(view.toLocaleDateString(locale, { month: 'long', year: 'numeric' }));
	const cells = $derived.by(() => {
		const first = view.getDay();
		const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
		/** @type {(string|null)[]} */
		const out = Array(first).fill(null);
		for (let d = 1; d <= count; d++) out.push(ymd(new Date(view.getFullYear(), view.getMonth(), d)));
		return out;
	});
	/** @param {number} delta */
	const shift = (delta) => (view = new Date(view.getFullYear(), view.getMonth() + delta, 1));

	const live = $derived(notes.filter((n) => !n.deleted));
	const reminders = $derived(
		mounted ? $shareLog.filter((e) => e.remindAt).map((e) => ({ ...e, day: ymd(new Date(e.remindAt)) })) : []
	);
	const marks = $derived.by(() => {
		/** @type {Record<string, { n: number, r: number }>} */
		const m = {};
		for (const n of live) (m[n.date] ??= { n: 0, r: 0 }).n++;
		for (const r of reminders) (m[r.day] ??= { n: 0, r: 0 }).r++;
		return m;
	});

	const dayNotes = $derived(live.filter((n) => n.date === selected));
	const dayReminders = $derived(reminders.filter((r) => r.day === selected));
	const selectedLabel = $derived(
		new Date(`${selected}T12:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'numeric' })
	);

	// ── פעולות ───────────────────────────────────────────────────
	function addNote() {
		const text = draft.trim();
		if (!text) return;
		const note = {
			id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
			date: selected,
			time: draftTime,
			text,
			updatedAt: Date.now()
		};
		setNotes([...notes, note]);
		draft = '';
		draftTime = '';
		void push([note]);
	}

	/** @param {import('$lib/calendarNotes.js').CalNote} n @param {string} text */
	function editNote(n, text) {
		if (text.trim() === n.text) return;
		const next = text.trim()
			? { ...n, text: text.trim(), updatedAt: Date.now() }
			: { ...n, text: '', deleted: true, updatedAt: Date.now() };
		setNotes([...notes.filter((x) => x.id !== n.id), next]);
		void push([next]);
	}

	/** @param {import('$lib/calendarNotes.js').CalNote} n */
	function deleteNote(n) {
		const next = { ...n, text: '', deleted: true, updatedAt: Date.now() };
		setNotes([...notes.filter((x) => x.id !== n.id), next]);
		void push([next]);
	}

	/** @param {import('$lib/calendarNotes.js').CalNote} n */
	function googleUrl(n) {
		const [y, m, d] = n.date.split('-').map(Number);
		const [hh, mm] = (n.time || '09:00').split(':').map(Number);
		return googleCalendarUrl({
			title: n.text.split('\n')[0].slice(0, 80),
			details: n.text,
			start: new Date(y, m - 1, d, hh, mm).getTime(),
			minutes: 30
		});
	}

	/** @param {number} ts */
	const hhmm = (ts) => {
		const d = new Date(ts);
		return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
	};

	const embedSrc = $derived.by(() => {
		let tz = 'Asia/Jerusalem';
		try {
			tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
		} catch {
			/* ignore */
		}
		const q = new URLSearchParams({
			src: email,
			ctz: tz,
			mode: 'AGENDA',
			hl: lang === 'he' ? 'iw' : lang,
			showTitle: '0',
			showPrint: '0',
			showCalendars: '0',
			showTz: '0'
		});
		return `https://calendar.google.com/calendar/embed?${q.toString()}`;
	});
</script>

<section
	id="calendar"
	class="w-full scroll-mt-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
>
	<div class="mb-2 flex items-center justify-between gap-2">
		<h2 class="text-lg font-extrabold text-gray-900 dark:text-gray-100">📅 {tx.title}</h2>
		{#if email}
			<div class="flex rounded-full bg-gray-100 p-0.5 text-xs font-bold dark:bg-gray-700">
				{#each [['notes', tx.notes], ['google', tx.google]] as [key, label] (key)}
					<button
						type="button"
						onclick={() => setTab(key)}
						class="rounded-full px-3 py-1 transition {tab === key
							? 'bg-white text-blue-600 shadow dark:bg-gray-900 dark:text-blue-400'
							: 'text-gray-500 dark:text-gray-400'}"
					>
						{label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if tab === 'google' && email}
		<iframe
			title={tx.google}
			src={embedSrc}
			class="h-72 w-full rounded-xl border-0 bg-white"
			loading="lazy"
		></iframe>
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			{tx.googleHint}
			<a
				href="https://calendar.google.com/calendar/r"
				target="_blank"
				rel="noopener"
				class="font-bold text-blue-600 hover:underline dark:text-blue-400">{tx.openGoogle}</a
			>
		</p>
	{:else}
		<div class="flex flex-col gap-3 sm:flex-row">
			<!-- החודש -->
			<div class="w-full sm:w-64 sm:shrink-0">
				<div class="mb-1 flex items-center justify-between text-sm font-bold text-gray-700 dark:text-gray-200">
					<button type="button" onclick={() => shift(-1)} class="px-2 text-gray-400 hover:text-blue-600" aria-label="prev">‹</button>
					<span>{monthLabel}</span>
					<button type="button" onclick={() => shift(1)} class="px-2 text-gray-400 hover:text-blue-600" aria-label="next">›</button>
				</div>
				<div class="grid grid-cols-7 gap-0.5 text-center text-xs">
					{#each tx.days as d, i (i)}
						<span class="py-0.5 font-bold text-gray-400">{d}</span>
					{/each}
					{#each cells as day, i (day ?? `x${i}`)}
						{#if day}
							{@const mk = marks[day]}
							<button
								type="button"
								onclick={() => (selected = day)}
								class="relative h-8 rounded-lg font-semibold transition
									{selected === day
									? 'bg-blue-600 text-white'
									: day === todayKey
										? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-900/30 dark:text-blue-300'
										: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}"
							>
								{Number(day.slice(8))}
								{#if mk}
									<span class="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
										{#if mk.n}<span class="h-1 w-1 rounded-full {selected === day ? 'bg-white' : 'bg-emerald-500'}"></span>{/if}
										{#if mk.r}<span class="h-1 w-1 rounded-full {selected === day ? 'bg-white' : 'bg-amber-500'}"></span>{/if}
									</span>
								{/if}
							</button>
						{:else}
							<span></span>
						{/if}
					{/each}
				</div>
			</div>

			<!-- היום הנבחר -->
			<div class="min-w-0 flex-1">
				<div class="mb-1 flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
					{selectedLabel}
					{#if selected !== todayKey}
						<button
							type="button"
							onclick={() => {
								selected = todayKey;
								const n = new Date();
								view = new Date(n.getFullYear(), n.getMonth(), 1);
							}}
							class="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">{tx.today}</button
						>
					{/if}
				</div>

				<ul class="mb-2 space-y-1 text-sm">
					{#each dayReminders as r (r.key)}
						<li class="flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
							<span>🔔 {hhmm(r.remindAt)}</span>
							<span class="truncate font-semibold">{r.name || r.pretty}</span>
							<a href="#sent" class="ms-auto text-xs font-bold hover:underline">{tx.reminder}</a>
						</li>
					{/each}
					{#each dayNotes as n (n.id)}
						<li class="flex items-start gap-2 rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-900/20">
							{#if n.time}<span class="pt-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{n.time}</span>{/if}
							<textarea
								rows="1"
								value={n.text}
								onchange={(e) => editNote(n, e.currentTarget.value)}
								class="field-sizing-content min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm text-gray-800 focus:ring-0 dark:text-gray-100"
							></textarea>
							<a
								href={googleUrl(n)}
								target="_blank"
								rel="noopener"
								title={tx.toGoogle}
								aria-label={tx.toGoogle}
								class="text-base opacity-70 hover:opacity-100">🗓️</a
							>
							<button
								type="button"
								onclick={() => deleteNote(n)}
								title={tx.del}
								aria-label={tx.del}
								class="text-gray-400 hover:text-red-500">✕</button
							>
						</li>
					{/each}
					{#if !dayReminders.length && !dayNotes.length}
						<li class="text-xs text-gray-400">{tx.empty}</li>
					{/if}
				</ul>

				<form
					class="flex gap-1.5"
					onsubmit={(e) => {
						e.preventDefault();
						addNote();
					}}
				>
					<input
						type="time"
						bind:value={draftTime}
						class="w-24 rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
					/>
					<input
						type="text"
						bind:value={draft}
						placeholder={tx.placeholder}
						maxlength="1000"
						class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
					/>
					<button
						type="submit"
						disabled={!draft.trim()}
						class="rounded-lg bg-blue-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
					>
						{tx.add}
					</button>
				</form>
			</div>
		</div>
	{/if}
</section>
