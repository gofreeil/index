<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { lang, translations } from '$lib/i18n';
	import { logout } from '$lib/auth';
	import { adminTiles } from '$lib/adminNav.js';
	import { shareLog, clearShareLog } from '$lib/shareLog.js';
	import VisitorStatsCard from '$lib/components/VisitorStatsCard.svelte';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();
	const user = $derived(data.user);
	const businesses = $derived(data.myBusinesses ?? []);
	const ads = $derived(data.myAds ?? []);
	const mod = $derived(data.moderation);

	// כרטיסיות שהמערכת זיהתה כשייכות למשתמש (טלפון/אימייל) ועדיין אין להן
	// בעלים רשום. השרת מכריע — כאן רק תצוגה וכפתור "דרוש בעלות".
	const matches = $derived(data.myMatches ?? []);
	let busyClaim = $state('');

	const fmtNum = new Intl.NumberFormat('he-IL');

	// הפריטים שממתינים לטיפול — אותו מספר שמוצג בבועה שעל האווטאר בהאדר
	// ובסרגל הניווט של /admin. מקור אחד (pendingCounts.js), בלי כפילות.
	const pendingCounts = $derived(
		data.pendingCounts ?? { businesses: 0, reviews: 0, reports: 0, ads: 0, total: 0 }
	);
	const pendingTotal = $derived(pendingCounts.total ?? 0);
	// כרטיסיות שמחכות שהמשתמש ידרוש אותן — נספרות באותה בועה, כי גם הן
	// "פריט שממתין לך". בקשה שכבר נשלחה מחכה לנו, לא לו.
	const openMatches = $derived(matches.filter((/** @type {any} */ m) => !m.claimStatus).length);
	const alertTotal = $derived(pendingTotal + openMatches);
	const alertAnchor = $derived(pendingTotal > 0 ? '#admin' : '#claims');

	// אריחי פאנל הניהול — אותה רשימה בדיוק שמוצגת כסרגל ניווט ב-/admin
	const tiles = $derived(adminTiles(Boolean(data.isAdmin), Boolean(data.superAdmin)));
	/** @param {any} item */
	const tileAlert = (item) => {
		const counts = /** @type {Record<string, number>} */ (pendingCounts);
		return item.alert ? (counts[item.alert] ?? 0) : 0;
	};
	/** @param {any} item */
	const tileCount = (item) => (item.count === 'all' ? (data.businessesTotal ?? 0) : 0);

	// סיכום הנתונים של הנכסים שלי — מוצג לכל משתמש שיש לו כרטיסייה או מודעה
	const totals = $derived(data.myTotals ?? {});
	const hasAssets = $derived(businesses.length > 0 || ads.length > 0);

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const initial = $derived((user?.name || '?').trim().charAt(0).toUpperCase());

	const LOCALE = /** @type {Record<string,string>} */ ({ he: 'he-IL', en: 'en-US', ru: 'ru-RU' });
	/** @param {string} iso */
	const fmtDate = (iso) => {
		if (!iso) return '';
		try {
			return new Date(iso).toLocaleDateString(LOCALE[currentLang] || 'he-IL', {
				day: '2-digit',
				month: '2-digit',
				year: '2-digit'
			});
		} catch {
			return '';
		}
	};

	// pill הסטטוס של כרטיסייה/מודעה — תווית מתורגמת + צבע קבוע (Tailwind לא תופס מחרוזות דינמיות)
	const STATUS_KEY = /** @type {Record<string,string>} */ ({
		pending: 'bizStatusPending',
		approved: 'bizStatusApproved',
		rejected: 'bizStatusRejected',
		frozen: 'bizStatusFrozen'
	});
	const STATUS_CLS = /** @type {Record<string,string>} */ ({
		pending:
			'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500/30',
		approved:
			'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-500/30',
		rejected:
			'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-500/30',
		frozen:
			'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600/40'
	});
	/** @param {string} st */
	const statusLabel = (st) => t[STATUS_KEY[st] || 'bizStatusPending'] || st;
	/** @param {string} st */
	const statusCls = (st) => STATUS_CLS[st] || STATUS_CLS.pending;

	// למי שלחתי — יומן השליחות של פאנל השיתוף החכם. יושב ב-localStorage
	// ולא בשרת, ולכן נקרא רק אחרי ההרכבה: לפני כן הצד השרתי והצד הלקוח
	// היו מרנדרים תוכן שונה.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const sent = $derived(mounted ? $shareLog : []);
	let confirmClear = $state(false);
	function clearSent() {
		clearShareLog();
		confirmClear = false;
	}

	/** @param {number} ts */
	const fmtWhen = (ts) => {
		try {
			return new Date(ts).toLocaleDateString(LOCALE[currentLang] || 'he-IL', {
				day: '2-digit',
				month: '2-digit',
				year: '2-digit'
			});
		} catch {
			return '';
		}
	};

	// סיבות דיווח — בתקציר המודרציה (עברית בלבד, כמו פאנל הניהול)
	const REASON_HE = /** @type {Record<string,string>} */ ({
		no_discount: 'לא נתן את ההטבה',
		cash_refused: 'סירב למזומן',
		ethics: 'הפרת הקוד האתי',
		other: 'אחר'
	});
</script>

<svelte:head>
	<title>{t.myArea} - {t.title}</title>
</svelte:head>

<div class="mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-4 px-4 py-6">
	<!-- כרטיס הזהות — שורת זהות אחת (אווטאר, שם, אימייל, התנתקות), ומתחתיה
	     הטלפון והקיצורים. הכל דחוס: זהו כרטיס פרטים, לא באנר. -->
	<div
		class="mx-auto w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
	>
		<!-- אווטאר + שם + אימייל בשורה אחת. כשיש פריטים שממתינים לטיפול (אדמין)
		     — בועה אדומה ממוספרת בפינה, אותו מספר שמופיע על האווטאר בהאדר. -->
		<div class="flex items-center gap-3">
			<div class="relative h-12 w-12 flex-shrink-0">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white shadow-md"
					aria-hidden="true"
				>
					{initial}
				</div>
				{#if alertTotal > 0}
					<a
						href={alertAnchor}
						class="absolute -top-1.5 -left-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] leading-none font-black text-white shadow-lg ring-2 ring-white transition hover:bg-red-500 dark:ring-gray-800"
						title="{alertTotal} פריטים ממתינים לטיפול"
					>
						<span class="sr-only">פריטים ממתינים לטיפול: </span>{alertTotal}
					</a>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<h1 class="truncate text-lg font-extrabold text-gray-900 dark:text-gray-100">
					{user?.name}
				</h1>
				<p class="truncate text-xs text-gray-500 dark:text-gray-400" dir="ltr">{user?.email}</p>
			</div>
			<button
				type="button"
				onclick={logout}
				class="flex-shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
			>
				{t.logout}
			</button>
		</div>

		<!-- הטלפון שלי — שני מפתחות הזיהוי של בעל כרטיסייה הם האימייל והטלפון.
		     האימייל מגיע מההרשמה; את הטלפון המשתמש מוסיף כאן, וברגע שהוא נשמר
		     המערכת מחפשת כרטיסיות תואמות. אין אימות SMS, ולכן המספר רק *מציע*
		     התאמה — הבעלות עצמה ניתנת באישור אדמין. -->
		<form method="POST" action="?/savePhone" use:enhance class="mt-3">
			<div class="flex items-center gap-2">
				<label
					for="my-phone"
					class="flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400"
				>
					{t.myPhone}
				</label>
				<input
					id="my-phone"
					name="phone"
					type="tel"
					dir="ltr"
					value={data.myPhone ?? ''}
					placeholder={t.myPhonePlaceholder}
					class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-100"
				/>
				<button
					class="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
				>
					{t.myPhoneSave}
				</button>
			</div>
			<p class="mt-1 text-[11px] leading-tight text-gray-400 dark:text-gray-500">{t.myPhoneHint}</p>
			{#if form?.phoneSaved}
				<p class="mt-1 text-xs font-bold text-green-600 dark:text-green-400">✓ {t.myPhoneSaved}</p>
			{/if}
			{#if form?.phoneError}
				<p class="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{form.phoneError}</p>
			{/if}
		</form>

		<!-- קיצורים -->
		<div class="mt-3 grid grid-cols-2 gap-2">
			<a
				href="/submit-business"
				class="flex items-center justify-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:scale-[1.02] active:scale-95"
			>
				{t.addStore}
			</a>
			<a
				href="/"
				class="flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
			>
				{t.backToDirectory}
			</a>
		</div>
	</div>

	<!-- כרטיסיות שנראות שלך — הכרטיסיות שהוזרמו בייבוא נוצרו בלי בעלים,
	     והמערכת מזהה אותן לפי הטלפון או האימייל של המשתמש. זו הצעה בלבד:
	     הבעלות (וזכות העריכה) ניתנת רק אחרי אישור אדמין.
	     id="claims" הוא העוגן שאליו מוביל הקישור מהבועה שעל האווטאר. -->
	{#if matches.length}
		<section
			id="claims"
			class="w-full scroll-mt-24 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-500/30 dark:bg-indigo-950/20"
		>
			<h2 class="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-gray-100">
				🪪 {t.matchesTitle}
				<span class="text-sm font-bold text-gray-400">({matches.length})</span>
			</h2>
			<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.matchesHint}</p>

			{#if form?.claimError}
				<p class="mt-2 text-sm font-bold text-red-600 dark:text-red-400">{form.claimError}</p>
			{/if}

			<ul class="mt-4 space-y-2">
				{#each matches as m (m.documentId)}
					<li
						class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60"
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<h3 class="truncate font-bold text-gray-900 dark:text-gray-100">{m.name}</h3>
								<span
									class="rounded-full border px-2 py-0.5 text-[11px] font-bold {statusCls(
										m.status
									)}"
								>
									{statusLabel(m.status)}
								</span>
							</div>
							<p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
								{m.category || '—'}{m.city ? ' · ' + m.city : ''}
							</p>
						</div>

						<a
							href="/business/{m.documentId}"
							class="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
						>
							{t.matchesOpenPage}
						</a>

						{#if m.claimStatus === 'pending'}
							<span
								class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-900/30 dark:text-blue-300"
							>
								⏳ {t.matchesPending}
							</span>
						{:else}
							<form
								method="POST"
								action="?/claim"
								use:enhance={() => {
									busyClaim = m.documentId;
									return async ({ update }) => {
										await update({ reset: false });
										busyClaim = '';
									};
								}}
							>
								<input type="hidden" name="documentId" value={m.documentId} />
								<button
									disabled={busyClaim === m.documentId}
									class="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white transition hover:scale-[1.02] disabled:opacity-40"
								>
									{busyClaim === m.documentId ? '…' : t.matchesClaim}
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- פאנל הניהול — פרוס כאן, בלי להיכנס ל-/admin. id="admin" הוא העוגן
	     שאליו מוביל הקישור מהבועה שעל האווטאר (/profile#admin). -->
	{#if mod}
		<section
			id="admin"
			class="w-full scroll-mt-24 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-700/40 dark:bg-amber-950/20"
		>
			<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
				<h2 class="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-gray-100">
					🛡️ ניהול ומודרציה
					<span
						class="rounded-full border px-2 py-0.5 text-[11px] font-bold {data.superAdmin
							? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-300'
							: 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/40 dark:text-blue-300'}"
					>
						{data.superAdmin ? '👑 סופר-אדמין' : 'אדמין'}
					</span>
				</h2>
				<a href="/admin" class="text-sm font-bold text-blue-600 hover:underline dark:text-blue-400">
					לפאנל המלא ←
				</a>
			</div>

			<!-- אריחי המסכים — אותה רשימה בדיוק שמופיעה כסרגל ניווט ב-/admin.
			     הבועה האדומה על אריח = פריטים שממתינים לטיפול באותו מסך, והסכום
			     שלהן הוא בדיוק המספר שעל תמונת הפרופיל ובהאדר. -->
			<div class="grid gap-2 sm:grid-cols-2">
				{#each tiles as tile (tile.href)}
					{@const alert = tileAlert(tile)}
					{@const count = tileCount(tile)}
					<a
						href={tile.href}
						class="relative flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition hover:border-blue-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-blue-500/40"
					>
						{#if alert > 0}
							<span
								class="absolute -top-2 -left-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] leading-none font-black text-white shadow-lg ring-2 ring-amber-50 dark:ring-amber-950"
							>
								<span class="sr-only">ממתינים לטיפול: </span>{alert}
							</span>
						{/if}
						<span class="text-xl" aria-hidden="true">{tile.icon}</span>
						<span class="min-w-0">
							<span class="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">
								{tile.title}
							</span>
							<!-- המונה משולב בתחילת שורת התיאור, באותו פונט ובאותו צבע —
							     בתחילתה ולא בסופה, כדי שה-truncate לא יבלע אותו במסכים צרים -->
							<span class="block truncate text-[11px] text-gray-500 dark:text-gray-400">
								{count > 0 ? `${count} · ` : ''}{tile.desc}
							</span>
						</span>
					</a>
				{/each}
			</div>

			<!-- סטטיסטיקת הכניסות — פרוסה כאן, וכל הכרטיס קישור לפירוט המלא -->
			<div class="mt-3">
				<VisitorStatsCard
					months={data.gaMonths}
					updatedAt={data.gaUpdatedAt}
					configured={data.gaConfigured}
					nested
					href="/admin/stats"
				/>
			</div>

			<!-- הפריטים האחרונים מכל סוג -->
			{#if mod.businesses.count === 0 && mod.reviews.count === 0 && mod.reports.count === 0}
				<p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
					אין פריטים שממתינים לטיפול 🎉
				</p>
			{:else}
				<div class="mt-4 space-y-4">
					{#if mod.businesses.count}
						<div>
							<h3 class="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
								עסקים חדשים שממתינים לאישור
							</h3>
							<ul class="space-y-1.5">
								{#each mod.businesses.items as b (b.documentId)}
									<li
										class="flex flex-wrap items-center gap-x-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-gray-800/60"
									>
										<a
											href="/admin/business/{b.documentId}"
											class="font-bold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
										>
											{b.name}
										</a>
										<span class="text-xs text-gray-500 dark:text-gray-400">
											{b.category || 'ללא קטגוריה'} · {b.contact_name || '—'} · {b.phone || '—'} · {fmtDate(
												b.createdAt
											)}
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if mod.reviews.count}
						<div>
							<h3 class="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
								ביקורות שממתינות לאישור
							</h3>
							<ul class="space-y-1.5">
								{#each mod.reviews.items as r (r.documentId)}
									<li
										class="flex flex-wrap items-center gap-x-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-gray-800/60"
									>
										<span class="font-bold text-gray-900 dark:text-gray-100">
											{r.business || 'עסק לא ידוע'}
										</span>
										<span class="text-amber-500" dir="ltr">
											{'★'.repeat(Math.max(0, Math.min(5, r.rating)))}
										</span>
										<span class="text-xs text-gray-500 dark:text-gray-400">
											{r.title || r.author || 'אנונימי'} · {fmtDate(r.createdAt)}
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if mod.reports.count}
						<div>
							<h3 class="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
								דיווחים פתוחים
							</h3>
							<ul class="space-y-1.5">
								{#each mod.reports.items as r (r.documentId)}
									<li
										class="flex flex-wrap items-center gap-x-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-gray-800/60"
									>
										<span class="font-bold text-gray-900 dark:text-gray-100"
											>{r.business || '—'}</span
										>
										<span class="text-xs font-bold text-red-600 dark:text-red-400">
											{REASON_HE[r.reason] || r.reason}
										</span>
										<span class="text-xs text-gray-500 dark:text-gray-400">
											{r.reporter || 'אנונימי'} · {fmtDate(r.createdAt)}
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{/if}

	<!-- הנתונים שלי — סטטיסטיקה על הנכסים של המשתמש עצמו (כרטיסיות ומודעות).
	     מוצג לכל בעל נכס, גם למי שאינו אדמין. -->
	{#if hasAssets}
		<section
			class="w-full rounded-2xl border border-blue-100 bg-blue-50/40 p-5 dark:border-blue-500/20 dark:bg-blue-950/20"
		>
			<h2 class="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-gray-100">
				📊 {t.myStats}
			</h2>
			<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.myStatsHint}</p>

			<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#if businesses.length}
					<div
						class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60"
					>
						<div class="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
							{fmtNum.format(totals.views ?? 0)}
						</div>
						<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.statsViews}</div>
					</div>
					<div
						class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60"
					>
						<div class="text-2xl font-extrabold text-green-600 dark:text-green-400">
							{fmtNum.format(totals.reveals ?? 0)}
						</div>
						<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.statsReveals}</div>
					</div>
					<div
						class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60"
					>
						<div class="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
							{fmtNum.format(totals.reviews ?? 0)}
						</div>
						<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.statsReviews}</div>
					</div>
				{/if}
				{#if ads.length}
					<div
						class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60"
					>
						<div class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
							{fmtNum.format(totals.adImpressions ?? 0)}
						</div>
						<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.statsImpressions}</div>
					</div>
					<div
						class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60"
					>
						<div class="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
							{fmtNum.format(totals.adClicks ?? 0)}
						</div>
						<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.statsClicks}</div>
					</div>
					<div
						class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/60"
					>
						<div class="text-2xl font-extrabold text-green-600 dark:text-green-400">
							{fmtNum.format(totals.adLeads ?? 0)}
						</div>
						<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.statsLeads}</div>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<!-- העסקים שלי -->
	<section
		class="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-lg font-extrabold text-gray-900 dark:text-gray-100">
				{t.myBusinesses}
				{#if businesses.length}
					<span class="text-sm font-bold text-gray-400">({businesses.length})</span>
				{/if}
			</h2>
			<a
				href="/submit-business"
				class="text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
			>
				+ {t.addStore}
			</a>
		</div>

		{#if businesses.length === 0}
			<p class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t.myBusinessesEmpty}</p>
		{:else}
			<ul class="space-y-3">
				{#each businesses as b (b.documentId)}
					<li
						class="flex items-start gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-700"
					>
						{#if b.logo}
							<img src={b.logo} alt="" class="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
						{:else}
							<div
								class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl dark:bg-gray-700"
							>
								🏪
							</div>
						{/if}

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<h3 class="truncate font-bold text-gray-900 dark:text-gray-100">{b.name}</h3>
								<span
									class="rounded-full border px-2 py-0.5 text-[11px] font-bold {statusCls(
										b.status
									)}"
								>
									{statusLabel(b.status)}
								</span>
							</div>
							<p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
								{b.category || '—'}{b.city ? ' · ' + b.city : ''}{b.phone ? ' · ' + b.phone : ''} · {fmtDate(
									b.created_at
								)}
							</p>
							{#if b.discount}
								<p class="mt-1 truncate text-xs font-medium text-green-600 dark:text-green-400">
									🎁 {b.discount}
								</p>
							{/if}
							<p
								class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400"
							>
								<span>👁 {fmtNum.format(b.view_count)} {t.viewsLabel}</span>
								<span>☎️ {fmtNum.format(b.phone_reveal_count)} {t.statsRevealsShort}</span>
								{#if b.rating_count}
									<span>★ {b.rating.toFixed(1)} ({b.rating_count})</span>
								{/if}
							</p>
						</div>

						<!-- בעל הכרטיסייה עורך את הפרטים בעצמו — בכל סטטוס, גם כשהיא
						     עדיין ממתינה לאישור -->
						<div class="flex flex-shrink-0 flex-col gap-1.5 self-center">
							<a
								href="/business/{b.documentId}/edit"
								class="rounded-full bg-blue-600 px-3 py-1.5 text-center text-xs font-bold text-white transition hover:bg-blue-700"
							>
								✏️ {t.editMyCard}
							</a>
							{#if b.status === 'approved'}
								<a
									href="/business/{b.documentId}"
									class="rounded-full border border-gray-200 px-3 py-1.5 text-center text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
								>
									{t.viewPage}
								</a>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- המודעות שלי -->
	<section
		class="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-lg font-extrabold text-gray-900 dark:text-gray-100">
				{t.myAds}
				{#if ads.length}
					<span class="text-sm font-bold text-gray-400">({ads.length})</span>
				{/if}
			</h2>
			<a
				href="/advertise/builder"
				class="text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
			>
				+ {t.newAd}
			</a>
		</div>

		{#if ads.length === 0}
			<p class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t.myAdsEmpty}</p>
		{:else}
			<ul class="space-y-2">
				{#each ads as a (a.id)}
					<li
						class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 p-3 dark:border-gray-700"
					>
						<span class="font-bold text-gray-900 dark:text-gray-100">{a.title || '—'}</span>
						<span
							class="rounded-full border px-2 py-0.5 text-[11px] font-bold {statusCls(a.status)}"
						>
							{statusLabel(a.status)}
						</span>
						<span class="text-xs text-gray-500 dark:text-gray-400">
							{t.submittedOn}
							{fmtDate(a.submittedAt)}
							{#if a.status === 'approved' && a.expiresAt}
								· {t.activeUntil}
								{fmtDate(a.expiresAt)}
							{/if}
						</span>
						{#if a.status === 'rejected' && a.rejectionReason}
							<span class="w-full text-xs text-red-600 dark:text-red-400">{a.rejectionReason}</span>
						{/if}
						<!-- מדדי המודעה — נמדדים בצד הלקוח (ראו $lib/adTrack.js) -->
						<span
							class="flex w-full flex-wrap items-center gap-x-3 text-xs text-gray-500 dark:text-gray-400"
						>
							<span>
								{t.statsImpressions}
								<b class="font-black text-gray-900 tabular-nums dark:text-gray-100"
									>{fmtNum.format(a.stats.impressions)}</b
								>
							</span>
							<span>
								{t.statsClicks}
								<b class="font-black text-gray-900 tabular-nums dark:text-gray-100"
									>{fmtNum.format(a.stats.clicks)}</b
								>
							</span>
							<span>
								{t.statsLanding}
								<b class="font-black text-gray-900 tabular-nums dark:text-gray-100"
									>{fmtNum.format(a.stats.landing)}</b
								>
							</span>
							<span>
								{t.statsLeads}
								<b class="font-black text-green-600 tabular-nums dark:text-green-400"
									>{fmtNum.format(a.stats.leads)}</b
								>
							</span>
						</span>
						<!-- עריכה ממוקדת: פותח את הבילדר עם התוכן של המודעה הזו בדיוק,
						     והשליחה תעדכן רק אותה - מודעות אחרות שלך לא מושפעות -->
						<a
							href="/advertise/builder?edit={a.id}"
							class="ms-auto rounded-full bg-amber-500 px-3 py-1.5 text-xs font-black text-black transition hover:bg-amber-400"
							title={t.editAdTitle}
						>
							{t.editAd}
						</a>
						{#if a.status === 'approved'}
							<a
								href="/ads/{a.id}"
								class="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
							>
								{t.viewAd}
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- למי שלחתי — כל מי שקיבל ממני כרטיס עסק דרך השיתוף החכם, כדי
	     שאפשר יהיה לחזור אליו בהמשך. מוצג רק כשיש מה להציג. -->
	{#if sent.length}
		<section
			class="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-lg font-extrabold text-gray-900 dark:text-gray-100">
					{t.sentList}
					<span class="text-sm font-bold text-gray-400">({sent.length})</span>
				</h2>
				{#if confirmClear}
					<span class="flex items-center gap-3 text-sm">
						<span class="text-gray-500 dark:text-gray-400">{t.sentClearConfirm}</span>
						<button
							type="button"
							onclick={clearSent}
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
				{:else}
					<button
						type="button"
						onclick={() => (confirmClear = true)}
						class="text-sm font-bold text-gray-400 transition hover:text-red-600 dark:hover:text-red-400"
					>
						{t.sentClear}
					</button>
				{/if}
			</div>
			<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">{t.sentListHint}</p>

			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr
							class="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
						>
							<th class="py-2 text-start font-medium">{t.sentColName}</th>
							<th class="py-2 text-start font-medium">{t.sentColPhone}</th>
							<th class="py-2 text-start font-medium">{t.sentColDate}</th>
						</tr>
					</thead>
					<tbody>
						{#each sent as e (e.key)}
							<tr class="border-b border-gray-50 last:border-0 dark:border-gray-700/50">
								<td class="py-2 pe-3">
									<span class="font-bold text-gray-900 dark:text-gray-100">{e.name || '—'}</span>
									{#if e.bizName}
										<span class="block text-[11px] text-gray-400">{e.bizName}</span>
									{/if}
								</td>
								<td class="py-2 pe-3">
									<!-- הקישור פותח שיחה ריקה בוואטסאפ — "לחזור אליו", לא "לשלוח שוב" -->
									<a
										href="https://wa.me/{e.wa}"
										target="_blank"
										rel="noopener noreferrer"
										title={t.sentOpenChat}
										dir="ltr"
										class="font-medium text-green-600 hover:underline dark:text-green-400"
									>
										{e.pretty}
									</a>
								</td>
								<td class="py-2 whitespace-nowrap text-gray-500 tabular-nums dark:text-gray-400">
									{fmtWhen(e.at)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>
