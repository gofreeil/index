<script>
	// מסך הסטטיסטיקה המלא. שני מקורות, ובכוונה בסדר הזה:
	// קודם מה שתמיד קיים (המאגר שלנו), ואחריו מה שתלוי ב-Google Analytics.
	import VisitorStatsCard from '$lib/components/VisitorStatsCard.svelte';

	/** @type {{ data: any }} */
	let { data } = $props();

	const fmt = new Intl.NumberFormat('he-IL');
	const dir = $derived(data.directory);

	// סיכומי שנה — נגזרים מהנתונים החודשיים שכבר בידינו
	const yearViews = $derived(
		(data.months ?? []).reduce(
			(/** @type {number} */ s, /** @type {any} */ m) => s + m.pageViews,
			0
		)
	);
	const yearVisitors = $derived(
		(data.months ?? []).reduce((/** @type {number} */ s, /** @type {any} */ m) => s + m.visitors, 0)
	);

	// גידול המאגר — 12 החודשים האחרונים, האחרון הוא החודש הנוכחי
	const growth = $derived(dir?.growth ?? []);
	const addedThisMonth = $derived(growth.at(-1)?.added ?? 0);
	const yearAdded = $derived(
		growth.reduce((/** @type {number} */ s, /** @type {any} */ m) => s + m.added, 0)
	);
	const maxAdded = $derived(Math.max(1, ...growth.map((/** @type {any} */ m) => m.added)));
	const currentYm = $derived(growth.at(-1)?.yearMonth ?? '');

	/** "202608" → "אוגוסט 2026" @param {string} ym */
	function monthLabel(ym) {
		const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
		return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d);
	}
	/** "202608" → "8/26" @param {string} ym */
	const monthShort = (ym) => `${Number(ym.slice(4, 6))}/${ym.slice(2, 4)}`;

	// GA מחזיר שמות ערים/ערוצים באנגלית — מתרגמים את הנפוצים, השאר כמו שהם
	const CITY_HE = /** @type {Record<string,string>} */ ({
		Jerusalem: 'ירושלים',
		'Tel Aviv-Yafo': 'תל אביב-יפו',
		'Tel Aviv': 'תל אביב',
		Haifa: 'חיפה',
		'Bnei Brak': 'בני ברק',
		Beersheba: 'באר שבע',
		"Be'er Sheva": 'באר שבע',
		Ashdod: 'אשדוד',
		'Petah Tikva': 'פתח תקווה',
		Netanya: 'נתניה',
		'Rishon LeZion': 'ראשון לציון',
		"Modi'in Illit": 'מודיעין עילית',
		'Modiin Illit': 'מודיעין עילית',
		'Beit Shemesh': 'בית שמש',
		Elad: 'אלעד',
		'Ramat Gan': 'רמת גן',
		'Bat Yam': 'בת ים',
		Holon: 'חולון',
		Rehovot: 'רחובות',
		Ashkelon: 'אשקלון',
		Lod: 'לוד',
		Safed: 'צפת',
		Tiberias: 'טבריה',
		Netivot: 'נתיבות',
		Ofakim: 'אופקים',
		'Kiryat Gat': 'קריית גת',
		"Modi'in-Maccabim-Re'ut": 'מודיעין',
		Herzliya: 'הרצליה',
		'Kfar Saba': 'כפר סבא',
		"Ra'anana": 'רעננה',
		'Givat Shmuel': 'גבעת שמואל',
		'Beitar Illit': 'ביתר עילית'
	});
	const DEVICE_HE = /** @type {Record<string,string>} */ ({
		mobile: '📱 נייד',
		desktop: '💻 מחשב',
		tablet: 'טאבלט',
		'smart tv': 'טלוויזיה חכמה'
	});
	const CHANNEL_HE = /** @type {Record<string,string>} */ ({
		// ערוץ סינתטי שנשלף מתוך המקורות בשרת — לא שם של GA
		WhatsApp: '💬 שיתופים בוואטסאפ',
		'Organic Search': 'חיפוש אורגני (גוגל)',
		Direct: 'כניסה ישירה',
		Referral: 'הפניות מאתרים',
		'Organic Social': 'רשתות חברתיות',
		'Paid Search': 'חיפוש ממומן',
		Email: 'מייל',
		Display: 'באנרים',
		'Cross-network': 'רשתות מעורבות',
		'Organic Video': 'וידאו',
		'Organic Shopping': 'שופינג',
		Unassigned: 'לא משויך'
	});

	/**
	 * @typedef {Object} Row
	 * @property {string} label
	 * @property {string} [sub]
	 * @property {number} count
	 * @property {string} [href]
	 */

	// ── שורות מהמאגר שלנו (תמיד קיימות) ──
	const viewedRows = $derived(
		(dir?.topViewed ?? []).map((/** @type {any} */ b) => ({
			label: b.name,
			sub: b.city || b.category,
			count: b.views,
			href: `/business/${b.documentId}`
		}))
	);
	const revealRows = $derived(
		(dir?.topReveals ?? []).map((/** @type {any} */ b) => ({
			label: b.name,
			sub: b.city || b.category,
			count: b.reveals,
			href: `/business/${b.documentId}`
		}))
	);
	const categoryRows = $derived(
		(dir?.categories ?? []).map((/** @type {any} */ c) => ({ label: c.key, count: c.count }))
	);
	const cityRowsInternal = $derived(
		(dir?.cities ?? []).map((/** @type {any} */ c) => ({ label: c.key, count: c.count }))
	);

	// ── שורות מ-Google Analytics ──
	const gaPageRows = $derived(
		(data.topPages ?? []).map((/** @type {any} */ b) => ({
			label: b.name,
			sub: b.city,
			count: b.count,
			href: `/business/${b.documentId}`
		}))
	);
	const cityRows = $derived(
		(data.cities ?? [])
			.filter((/** @type {any} */ c) => c.key !== '(not set)')
			.map((/** @type {any} */ c) => ({ label: CITY_HE[c.key] ?? c.key, count: c.count }))
	);
	const deviceRows = $derived(
		(data.devices ?? []).map((/** @type {any} */ d) => ({
			label: DEVICE_HE[d.key] ?? d.key,
			count: d.count
		}))
	);
	const channelRows = $derived(
		(data.channels ?? []).map((/** @type {any} */ c) => ({
			label: CHANNEL_HE[c.key] ?? c.key,
			count: c.count
		}))
	);
</script>

<svelte:head>
	<title>סטטיסטיקה — פאנל ניהול</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet statTile(
	/** @type {string} */ label,
	/** @type {number} */ value,
	/** @type {string} */ cls,
	/** @type {string} */ hint = ''
)}
	<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
		<div class="text-2xl font-extrabold {cls}">{fmt.format(value)}</div>
		<div class="mt-1 text-xs text-gray-400">{label}</div>
		{#if hint}<div class="mt-0.5 text-[11px] text-gray-500">{hint}</div>{/if}
	</div>
{/snippet}

{#snippet rankCard(
	/** @type {string} */ title,
	/** @type {string} */ subtitle,
	/** @type {Row[]} */ rows
)}
	<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
		<h3 class="font-bold text-gray-100">{title}</h3>
		<p class="mt-0.5 text-xs text-gray-400">{subtitle}</p>
		{#if rows.length === 0}
			<p class="mt-3 text-sm text-gray-500">אין עדיין נתונים.</p>
		{:else}
			{@const max = Math.max(...rows.map((r) => r.count))}
			<ul class="mt-3 space-y-2.5">
				{#each rows as r, i (r.href ?? r.label)}
					<li>
						<svelte:element
							this={r.href ? 'a' : 'div'}
							href={r.href ?? undefined}
							class="group block"
						>
							<span class="flex items-baseline justify-between gap-2 text-sm">
								<span
									class="min-w-0 truncate font-bold text-gray-100 {r.href
										? 'group-hover:text-blue-400'
										: ''}"
								>
									<span class="text-gray-500 tabular-nums">{i + 1}.</span>
									{r.label}
									{#if r.sub}<span class="text-[11px] font-normal text-gray-400">
											· {r.sub}</span
										>{/if}
								</span>
								<span class="flex-shrink-0 text-xs font-black text-blue-400 tabular-nums">
									{fmt.format(r.count)}
								</span>
							</span>
							<span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-800">
								<span
									class="block h-full rounded-full bg-gradient-to-l from-blue-600 to-purple-500"
									style="width:{Math.max(3, Math.round((r.count / max) * 100))}%"
								></span>
							</span>
						</svelte:element>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/snippet}

<div class="space-y-4 pb-10">
	<h2 class="text-xl font-extrabold text-gray-100">📈 סטטיסטיקה מלאה</h2>

	<!-- ── המאגר שלנו — עובד תמיד, בלי תלות בהגדרות ── -->
	{#if dir}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{@render statTile(
				'כרטיסיות באתר',
				dir.totals.all,
				'text-gray-100',
				`${dir.totals.approved} מאושרות`
			)}
			{@render statTile('צפיות בכרטיסיות', dir.engagement.views, 'text-blue-400', 'מאז ומתמיד')}
			{@render statTile(
				'חשיפות טלפון',
				dir.engagement.reveals,
				'text-green-400',
				'לחיצות "הצג טלפון"'
			)}
			{@render statTile(
				'ביקורות מאושרות',
				dir.reviews.approved,
				'text-amber-400',
				dir.reviews.avgRating ? `דירוג ממוצע ★ ${dir.reviews.avgRating.toFixed(1)}` : ''
			)}
		</div>

		<!-- גידול המאגר -->
		<div class="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
			<div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
				<div class="min-w-0">
					<h3 class="font-bold text-gray-100">🆕 כרטיסיות חדשות</h3>
					<p class="mt-0.5 text-xs text-gray-400">
						כמה כרטיסיות נוספו בכל חודש — כך רואים את הצמיחה.
						{fmt.format(yearAdded)} נוספו בשנה האחרונה, וסה"כ {fmt.format(dir.totals.all)} כרטיסיות באתר
						({fmt.format(dir.totals.withDiscount)} מהן עם הטבה).
					</p>
				</div>
				<div class="text-left">
					<div class="text-2xl font-extrabold text-blue-400">+{fmt.format(addedThisMonth)}</div>
					<div class="text-[11px] text-gray-400">נוספו החודש</div>
				</div>
			</div>

			<div class="flex items-stretch justify-center gap-1.5">
				{#each growth as m (m.yearMonth)}
					<div
						class="flex max-w-16 min-w-0 flex-1 flex-col items-center"
						title="{monthLabel(m.yearMonth)}: {fmt.format(m.added)} כרטיסיות חדשות"
					>
						<div class="mb-1 text-[10px] font-bold text-gray-300 tabular-nums">
							{fmt.format(m.added)}
						</div>
						<div class="flex h-24 w-full items-end">
							<div
								class="w-full rounded-t-md transition-all {m.added > 0
									? 'bg-gradient-to-t from-blue-600 to-purple-500'
									: 'bg-white/10'} {m.yearMonth === currentYm
									? 'shadow-[0_0_12px_rgba(59,130,246,0.5)]'
									: ''}"
								style="height: {m.added > 0
									? Math.max(6, Math.round((m.added / maxAdded) * 100))
									: 4}%"
							></div>
						</div>
						<div
							class="mt-1 text-[10px] whitespace-nowrap {m.yearMonth === currentYm
								? 'font-bold text-blue-400'
								: 'text-gray-400'}"
						>
							{monthShort(m.yearMonth)}
						</div>
					</div>
				{/each}
			</div>

			<!-- פילוח לפי סטטוס -->
			<div class="flex flex-wrap gap-2 border-t border-gray-800 pt-3 text-xs">
				<span
					class="rounded-full border border-green-500/30 bg-green-900/30 px-2.5 py-1 font-bold text-green-300"
				>
					מאושרות {fmt.format(dir.totals.approved)}
				</span>
				<span
					class="rounded-full border border-blue-500/30 bg-blue-900/30 px-2.5 py-1 font-bold text-blue-300"
				>
					ממתינות {fmt.format(dir.totals.pending)}
				</span>
				<span
					class="rounded-full border border-gray-600/40 bg-gray-800 px-2.5 py-1 font-bold text-gray-300"
				>
					מוקפאות {fmt.format(dir.totals.frozen)}
				</span>
				<span
					class="rounded-full border border-red-500/30 bg-red-900/30 px-2.5 py-1 font-bold text-red-300"
				>
					נדחו {fmt.format(dir.totals.rejected)}
				</span>
			</div>
		</div>

		<div class="grid items-start gap-3 lg:grid-cols-2">
			{@render rankCard(
				'🏆 הכרטיסיות הנצפות ביותר',
				'מונה הצפיות שלנו בדף הכרטיסייה — לחיצה פותחת את הכרטיסייה',
				viewedRows
			)}
			{@render rankCard(
				'☎️ הכי הרבה חשיפות טלפון',
				'כמה גולשים לחצו "הצג מספר טלפון" — האינדיקציה הישירה ביותר לפניות',
				revealRows
			)}
			{@render rankCard('🏷️ קטגוריות מובילות', 'כמה כרטיסיות יש בכל קטגוריה', categoryRows)}
			{@render rankCard('📍 ערים במאגר', 'איפה נמצאים בעלי המקצוע', cityRowsInternal)}
		</div>
	{:else}
		<div class="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-2.5 text-sm text-red-300">
			לא הצלחנו לטעון את נתוני המאגר כרגע — נסו לרענן בעוד רגע.
		</div>
	{/if}

	<!-- ── מדדי הפרסומות ── -->
	{#if data.adTotals}
		<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
			<h3 class="font-bold text-gray-100">📢 מדדי הפרסומות</h3>
			<p class="mt-0.5 text-xs text-gray-400">
				סך כל המודעות באתר. אותם מדדים מוצגים לכל מפרסם על המודעות שלו באזור האישי.
			</p>
			<div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div>
					<div class="text-xl font-extrabold text-gray-100">
						{fmt.format(data.adTotals.impressions)}
					</div>
					<div class="text-xs text-gray-400">חשיפות</div>
				</div>
				<div>
					<div class="text-xl font-extrabold text-blue-400">{fmt.format(data.adTotals.clicks)}</div>
					<div class="text-xs text-gray-400">קליקים</div>
				</div>
				<div>
					<div class="text-xl font-extrabold text-purple-400">
						{fmt.format(data.adTotals.landing)}
					</div>
					<div class="text-xs text-gray-400">צפיות בדף נחיתה</div>
				</div>
				<div>
					<div class="text-xl font-extrabold text-green-400">{fmt.format(data.adTotals.leads)}</div>
					<div class="text-xs text-gray-400">פניות</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- ── Google Analytics ── -->
	<h2 class="pt-2 text-xl font-extrabold text-gray-100">🌍 תנועה באתר (Google Analytics)</h2>

	{#if data.months && data.months.length > 0}
		<div class="grid grid-cols-2 gap-3">
			{@render statTile('צפיות בשנה האחרונה', yearViews, 'text-blue-400')}
			{@render statTile('כניסות בשנה האחרונה', yearVisitors, 'text-purple-400')}
		</div>
	{/if}

	<VisitorStatsCard
		months={data.months}
		updatedAt={data.gaUpdatedAt}
		configured={data.gaConfigured}
	/>

	{#if data.gaConfigured}
		{#if data.insightsAvailable}
			<div class="grid items-start gap-3 lg:grid-cols-2">
				{@render rankCard(
					'👀 דפי הכרטיסיות הנצפים ב-GA',
					'צפיות בדפי /business בשנה האחרונה, לפי Google Analytics',
					gaPageRows
				)}
				{@render rankCard('🌍 הערים של הגולשים', 'מאיפה נכנסים לאתר (לפי מיקום הגולש)', cityRows)}
				{@render rankCard('📱 מכשירים', 'ממה גולשים לאתר', deviceRows)}
				{@render rankCard(
					'🧭 מקורות תנועה',
					'איך מגיעים לאתר · שיתוף בוואטסאפ שלא מוסר מקור נספר ככניסה ישירה',
					channelRows
				)}
			</div>
		{:else}
			<div
				class="rounded-xl border border-amber-500/30 bg-amber-900/20 px-4 py-2.5 text-sm text-amber-200"
			>
				נתוני הפירוט (ערים, מכשירים, מקורות) אינם זמינים כרגע — נסו לרענן בעוד רגע.
			</div>
		{/if}
	{:else}
		<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-300">
			<p class="font-bold text-gray-100">איך מחברים את Google Analytics</p>
			<ol class="mt-2 list-inside list-decimal space-y-1 text-xs text-gray-400">
				<li>
					פותחים נכס GA4 (או משתמשים בנכס הקיים של יוצאים לחירות) ומוסיפים את הדומיין
					<code class="rounded bg-white/10 px-1">index.gofreeil.com</code> כזרם נתונים.
				</li>
				<li>
					מגדירים ב-Vercel את <code class="rounded bg-white/10 px-1">GA_MEASUREMENT_ID</code> (המזהה G-XXXX)
					— מרגע זה הגולשים נספרים.
				</li>
				<li>
					מוסיפים <code class="rounded bg-white/10 px-1">GA_PROPERTY_ID</code> (המזהה המספרי) ואת
					פרטי ה-service account (<code class="rounded bg-white/10 px-1">GA_SA_JSON</code>, או
					<code class="rounded bg-white/10 px-1">GA_SA_CLIENT_EMAIL</code> +
					<code class="rounded bg-white/10 px-1">GA_SA_PRIVATE_KEY</code>) — מרגע זה המסך הזה מתמלא.
					אותו service account שמשמש את שאר האתרים מתאים גם כאן, צריך רק להוסיף אותו כ-Viewer בנכס.
				</li>
			</ol>
			<p class="mt-2 text-xs text-gray-500">
				בדיקת חיבור מהירה: <code class="rounded bg-white/10 px-1">/api/cron/visitors</code>.
			</p>
		</div>
	{/if}
</div>
