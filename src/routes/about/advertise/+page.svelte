<script>
	// ============================================================
	// /about/advertise — פורט מצומצם ("advertise lite") מ-community.
	// שומר על המבנה, העיצוב והזרימה של דף הפרסום, אך בלי התשתיות
	// הספציפיות ל-community: בורר הערים/שכונות, קרן המעשר (CoinAnimation),
	// ו-endpoint שליחת המייל. במקומם: מחיר טבלה שטוח (ללא הכפלה בשכונות),
	// שליחת תיעוד ההזמנה ב-mailto, וקישורי בילדר לאתר הקהילה.
	//
	// כל הטקסט (עברית) מוטמע ישירות ב-markup — לא דרך $lib/i18n. הדף בעברית בלבד.
	// המרה מ-TS ל-JS + Svelte 5 runes.
	// ============================================================
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		DEFAULT_DISCOUNT_CODES,
		FREE_PROMO,
		FREE_PROMO_CODE_TEXT,
		FREE_PROMO_DISCOUNT,
		evaluateDiscount,
		discountAmount
	} from './discountCodes.js';

	// קישור הבילדר של הקהילה (index אינו כולל בילדר משלו).
	const BUILDER_URL = 'https://community.gofreeil.com/about/advertise/builder';
	// מספר הוואטסאפ האמיתי של התנועה (050-875-0632).
	const WA_PHONE = '972508750632';
	// כתובת המייל ליצירת קשר.
	const CONTACT_EMAIL = 'freedomhasbegun@gmail.com';
	// תוספת תמונה על המפה — 50 ₪ לשנה.
	const MAP_IMAGE_PRICE_YEARLY = 50;

	// data.user מגיע מה-+layout.server.js של index (יש email, אין phone).
	let { data } = $props();

	const packages = [
		{
			name: 'באנר צד',
			icon: '📌',
			location: 'מופיע בגירסת הדסקטופ',
			border: 'border-blue-500/40',
			bg: 'bg-blue-900/10',
			features: ['חשיפה גבוהה בכל עמוד', 'קהל מקומי ממוקד', 'לינק לאתר שלך'],
			image: 'https://community.gofreeil.com/images/advertisement-page/Desktop-advertisement.webp'
		},
		{
			name: 'כרטיס תוכן',
			icon: '🖼️',
			location: 'בתוכן עמוד הבית',
			border: 'border-purple-500/40',
			bg: 'bg-purple-900/10',
			features: ['הופעה על המפה', 'הופעה ברשימת התצוגה', 'דף פרטי עם הפרטים'],
			image: 'https://community.gofreeil.com/images/advertisement-page/neighborhood-map.webp'
		},
		{
			name: 'פרסומת נייד',
			icon: '📱',
			location: 'באנר במסך מלא',
			border: 'border-green-500/40',
			bg: 'bg-green-900/10',
			features: [
				'פרסומת ל4 שניות כאשר הגולש לוחץ על היתרונות באתר',
				'כולל דף נחיתה',
				'קישור ישיר לאתר המפרסם'
			],
			image: 'https://community.gofreeil.com/images/advertisement-page/mobile.webp',
			imageScale: 1.45,
			imageOrigin: '65% 0%'
		}
	];

	// ---- Guided tutorial pointer ----
	/** @typedef {'pick-row' | 'pick-plan' | 'done'} TutorialStep */
	/** @type {TutorialStep} */
	let tutorialStep = $state('pick-row');
	/** @type {number | null} */
	let highlightedRow = $state(null);
	/** @type {number | null} */
	let confirmingRow = $state(null);
	/** @type {HTMLDivElement | null} */
	let calculatorEl = $state(null);
	/** @type {HTMLHeadingElement | null} */
	let pricingHeadingEl = $state(null);
	let flashTotal = $state(false);

	// Step indicator: number flashes briefly once, then the title lights up.
	let step1NumLight = $state(false);
	let step1TitleLight = $state(false);
	let step2NumLight = $state(false);
	let step2TitleLight = $state(false);
	let step3NumLight = $state(false);
	let step3TitleLight = $state(false);

	const NUM_MS = 700; // number flash duration
	const TITLE_MS = 1500; // title glow duration (after number)
	/**
	 * @param {number[]} timers
	 * @param {(v: boolean) => void} numSetter
	 * @param {(v: boolean) => void} titleSetter
	 */
	const flashStep = (timers, numSetter, titleSetter) => {
		numSetter(true);
		timers.push(window.setTimeout(() => numSetter(false), NUM_MS));
		timers.push(window.setTimeout(() => titleSetter(true), NUM_MS));
		timers.push(window.setTimeout(() => titleSetter(false), NUM_MS + TITLE_MS));
	};

	$effect(() => {
		const step = tutorialStep;
		/** @type {number[]} */
		const timers = [];
		if (step === 'pick-row')
			flashStep(
				timers,
				(v) => (step1NumLight = v),
				(v) => (step1TitleLight = v)
			);
		else if (step === 'pick-plan')
			flashStep(
				timers,
				(v) => (step2NumLight = v),
				(v) => (step2TitleLight = v)
			);
		else if (step === 'done')
			flashStep(
				timers,
				(v) => (step3NumLight = v),
				(v) => (step3TitleLight = v)
			);
		return () => {
			for (const t of timers) clearTimeout(t);
		};
	});

	/** @param {number} num */
	function highlightRow(num) {
		highlightedRow = num;
		if (tutorialStep === 'pick-row') tutorialStep = 'pick-plan';
	}

	function advanceFromPlan() {
		if (tutorialStep === 'pick-row' || tutorialStep === 'pick-plan') tutorialStep = 'done';
	}

	// Format numbers with thousands separator for readability
	/** @param {number} n */
	function fmt(n) {
		return n.toLocaleString('en-US');
	}

	// ---- Contact prefill ----
	let userEmail = $state('');
	$effect(() => {
		userEmail = data?.user?.email ?? '';
	});
	let userPhone = $state('');

	// ---- Free editing day + ad-period expiration ----
	let confirmedPeriod = $state(false);
	let today = new Date();
	/** @param {Date} d */
	function addOneMonthSameDate(d) {
		const r = new Date(d);
		r.setMonth(r.getMonth() + 1);
		return r;
	}
	let expirationDate = $derived(addOneMonthSameDate(today));
	/** @param {Date} d */
	function fmtDate(d) {
		return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}
	/** @param {Date} d */
	function fmtMonthName(d) {
		return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
	}
	// Build a calendar-month grid (Sunday-first) for a given date.
	/** @param {Date} anchor */
	function buildCalendar(anchor) {
		const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const startDow = firstOfMonth.getDay(); // 0=Sun..6=Sat
		const start = new Date(firstOfMonth);
		start.setDate(1 - startDow);
		/** @type {Date[]} */
		const cells = [];
		for (let i = 0; i < 42; i++) {
			const c = new Date(start);
			c.setDate(start.getDate() + i);
			cells.push(c);
		}
		return cells;
	}
	/**
	 * @param {Date} a
	 * @param {Date} b
	 */
	function sameDay(a, b) {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	// Pricing rows — קטגוריות ומחירי הטבלה (מחיר שטוח, ללא הכפלה בשכונות).
	const rows = [
		{ num: 1, type: 'פרסומת ארוכה', half: 5, total: 30, single: 25, reach: 'לכל האזורים', details: 'מופיע ל-6 שניות ונעלם 12 שניות' },
		{ num: 2, type: 'עסק', half: 25, total: 150, single: 35, reach: 'לכל האזורים', details: 'מופיע במפה וברשימה' },
		{ num: 3, type: 'חוג', half: 10, total: 60, single: 25, reach: 'לכל האזורים', details: 'מופיע במפה וברשימה' },
		{ num: 4, type: 'צימר / סאבלט', half: 45, total: 270, single: 60, reach: 'לכל האזורים', details: 'מופיע במפה וברשימה' },
		{ num: 5, type: 'דרושים לעבודה', half: 5, total: 30, single: 25, reach: 'לכל האזורים', details: 'מופיע רק ברשימה' },
		{ num: 6, type: 'פנויים פנויות', half: 10, total: 60, single: 15, regularHalf: 20, regularTotal: 120, regularSingle: 30, promo: true, reach: 'כולל רשימה ארצית', details: 'מופיע רק ברשימה' },
		{ num: 7, type: 'מסעדה', half: 45, total: 270, single: 60, reach: 'לכל האזורים', details: 'מופיע במפה וברשימה' },
		{ num: 8, type: 'בייבי סיטר', half: 8, total: 48, single: 20, reach: 'לכל האזורים', details: 'מופיע במפה וברשימה' },
		{ num: 9, type: 'אולמות', half: 45, total: 270, single: 60, reach: 'לכל האזורים', details: 'מופיע במפה וברשימה' },
		{ num: 10, type: 'מזון מהיר', half: 30, total: 180, single: 45, reach: 'לכל האזורים', details: 'פלאפל, שווארמה, פיצה, גלידה' }
	];

	// ---- Calculator state: each row can be 'half' | 'single' | unset ----
	/** @typedef {'half' | 'single'} Plan */
	/** @type {Map<number, Plan>} */
	let planMap = $state(new Map());

	/**
	 * @param {number} num
	 * @param {Plan} plan
	 */
	function setPlan(num, plan) {
		const next = new Map(planMap);
		if (next.get(num) === plan) {
			next.delete(num); // clicking active side = turn off
			planMap = next;
			return;
		}
		next.set(num, plan);
		highlightedRow = num;
		advanceFromPlan();
		planMap = next;

		// checkmark animation, then slow scroll to calculator + flash total
		confirmingRow = num;
		setTimeout(() => {
			confirmingRow = null;
			slowScrollTo(calculatorEl, 3000);
			setTimeout(() => {
				flashTotal = true;
				setTimeout(() => {
					flashTotal = false;
				}, 1500);
			}, 3000);
		}, 700);
	}

	// Custom slow scroll (browser 'smooth' is ~500ms, too quick for this flow)
	/**
	 * @param {HTMLElement | null} el
	 * @param {number} duration
	 */
	function slowScrollTo(el, duration) {
		if (!el) return;
		const startY = window.scrollY;
		const stickyHeader = document.querySelector('header');
		const headerOffset = stickyHeader ? stickyHeader.offsetHeight + 16 : 16;
		const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset;
		const distance = targetY - startY;
		if (Math.abs(distance) < 4) return;
		const startTime = performance.now();
		/** @param {number} t */
		const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

		/** @param {number} now */
		function step(now) {
			const elapsed = now - startTime;
			const t = Math.min(1, elapsed / duration);
			window.scrollTo(0, startY + distance * ease(t));
			if (t < 1) requestAnimationFrame(step);
		}
		requestAnimationFrame(step);
	}

	// Selected items (מחיר שטוח — כל שורה × 1)
	let selectedItems = $derived(
		rows
			.filter((r) => planMap.has(r.num))
			.map((r) => {
				const plan = /** @type {Plan} */ (planMap.get(r.num));
				const monthsCount = plan === 'half' ? 6 : 1;
				const eMonthly = plan === 'half' ? r.half : r.single;
				const eTotal = plan === 'half' ? r.total : r.single;
				return { ...r, plan, monthsCount, eMonthly, eTotal };
			})
	);

	// ---- תוספת: תמונה/לוגו על המפה - 50 ₪ לשנה ----
	let mapImageAddon = $state(false);
	let mapImageAddonPrice = $derived(mapImageAddon ? MAP_IMAGE_PRICE_YEARLY : 0);

	let totalPayment = $derived(
		selectedItems.reduce((s, r) => s + r.eTotal, 0) + mapImageAddonPrice
	);

	let halfItems = $derived(selectedItems.filter((r) => r.plan === 'half'));
	let singleItems = $derived(selectedItems.filter((r) => r.plan === 'single'));
	let hasSelection = $derived(planMap.size > 0);

	// ---- Discount code (הנחת רכז / בעלים / פטור / קוד מבצע ההשקה) ----
	const discountCodes = [...DEFAULT_DISCOUNT_CODES, ...(FREE_PROMO ? [FREE_PROMO_DISCOUNT] : [])];
	// index אינו כולל תפקיד "רכז" — הנחת הרכז לא חלה כאן.
	const isCoordinator = false;
	let discountInput = $state('');

	let discountEval = $derived(evaluateDiscount(discountInput, discountCodes, isCoordinator));
	let discountValue = $derived(
		discountEval.applied && discountEval.matched
			? discountAmount(totalPayment, discountEval.matched)
			: 0
	);
	let effectiveTotal = $derived(Math.max(0, totalPayment - discountValue));
	let isFreeExempt = $derived(discountEval.applied && discountEval.matched?.kind === 'free');
	let discountLabelText = $derived(discountEval.matched?.label ?? '');

	// ---- שליחת תיעוד ההזמנה ב-mailto (index חסר endpoint מייל) ----
	let mailtoBody = $derived(
		`פרטי הזמנת פרסום:%0A` +
			selectedItems
				.map(
					(r) =>
						`${r.type} - ${r.plan === 'half' ? `חצי שנה ₪${fmt(r.eTotal)}` : `חודש בודד ₪${fmt(r.eTotal)}`}`
				)
				.join('%0A') +
			(mapImageAddon ? `%0Aתמונה על המפה - ₪${fmt(MAP_IMAGE_PRICE_YEARLY)} לשנה` : '') +
			(discountValue > 0 ? `%0Aהנחה (${discountLabelText}): -₪${fmt(discountValue)}` : '') +
			`%0A%0Aסה״כ: ₪${fmt(effectiveTotal)}` +
			(userPhone.trim() ? `%0Aהטלפון שלי: ${userPhone.trim()}` : '')
	);
	let mailtoHref = $derived(
		`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('הזמנת פרסום באתר')}&body=${mailtoBody}`
	);

	// wa.me URL — includes the user's phone in the message body if entered
	let whatsappHref = $derived.by(() => {
		const types = selectedItems.map((r) => r.type).join(', ');
		const phoneLine = userPhone.trim() ? `%0Aהטלפון שלי: ${userPhone.trim()}` : '';
		const discountLine =
			discountValue > 0 ? `%0Aהנחה (${discountLabelText}): -₪${fmt(discountValue)}` : '';
		const msg = `שלום, אני מעוניין לפרסם: ${types}. סה״כ ₪${fmt(effectiveTotal)}.`;
		return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(msg)}${discountLine}${phoneLine}`;
	});

	onMount(() => {
		if (!browser) return;
	});
</script>

<svelte:head>
	<title>פרסום באתר | מדריך בעלי מקצוע כשירים</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 md:py-12" dir="rtl">
	<!-- Header -->
	<div class="mb-10 text-center md:mb-14">
		<div class="mb-4 text-5xl">📢</div>
		<h1
			class="mb-4 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-3xl font-black text-transparent md:text-5xl"
		>
			פרסם באתר הקהילה
		</h1>
		<p class="mx-auto max-w-2xl text-lg leading-relaxed text-gray-300 md:text-xl">
			היחשף לקהל הקהילה ישירות - קהל ממוקד ומעורב
		</p>
	</div>

	{#if FREE_PROMO}
		<!-- מבצע השקה: פרסום חינם באמצעות קוד בשדה ההנחה -->
		<div
			class="mb-10 rounded-2xl border-2 border-green-500/60 bg-gradient-to-br from-green-900/30 to-emerald-900/20 p-6 text-center shadow-lg shadow-green-500/10"
			style="animation: slideDown 0.4s ease-out;"
		>
			<div class="mb-2 text-4xl">🎉</div>
			<h2 class="mb-2 text-2xl font-black text-green-300 md:text-3xl">
				בתקופה הראשונית - הפרסום חינם!
			</h2>
			<p class="text-base leading-relaxed text-gray-200 md:text-lg">
				בשדה קוד ההנחה שבתחתית הדף רשמו
				<span
					class="inline-block rounded-lg border border-green-400/50 bg-green-500/20 px-3 py-0.5 font-black whitespace-nowrap text-green-200"
					>"{FREE_PROMO_CODE_TEXT}"</span
				>
				<br class="hidden md:block" />
				ותוכלו להעלות את הפרסום <span class="font-black text-green-300">ללא תשלום</span>.
			</p>
		</div>
	{/if}

	<!-- Packages -->
	<h2 class="mb-4 text-center text-xl font-black text-white md:text-2xl">אפשרויות הפרסום</h2>
	<div class="mb-12 grid grid-cols-3 gap-2 md:gap-4">
		{#each packages as pkg (pkg.name)}
			<div
				class="rounded-xl border {pkg.border} {pkg.bg} flex flex-col p-2.5 md:flex-row-reverse md:items-stretch md:gap-5 md:p-5"
			>
				<div class="flex flex-col md:flex-1">
					<h3 class="mb-2 text-xs leading-tight font-black text-white md:mb-3 md:text-lg">
						{pkg.name}
					</h3>
					<p class="mb-3 text-[10px] leading-tight text-gray-400 md:mb-5 md:text-sm">
						{pkg.location}
					</p>
					<ul class="space-y-1 md:space-y-1.5">
						{#each pkg.features as feature (feature)}
							<li
								class="flex items-start gap-1 text-[10px] leading-tight text-gray-300 md:gap-1.5 md:text-sm"
							>
								<span class="flex-shrink-0 text-green-400">✓</span>
								{feature}
							</li>
						{/each}
					</ul>
				</div>
				{#if pkg.image}
					<div class="hidden md:block md:flex-1 md:overflow-hidden md:rounded-lg">
						<img
							src={pkg.image}
							alt={pkg.name}
							class="h-full w-full object-cover object-right-top"
							style={pkg.imageScale
								? `transform: scale(${pkg.imageScale}); transform-origin: ${pkg.imageOrigin ?? 'top right'};`
								: ''}
							loading="lazy"
						/>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Pricing Table heading -->
	<h2
		bind:this={pricingHeadingEl}
		class="mb-6 scroll-mt-4 text-center text-xl font-black text-white md:mb-8 md:text-4xl"
	>
		מחירון
	</h2>

	<!-- Pricing Table - step 1 (right in RTL) + step 2 (left in RTL) -->
	<div class="mb-6 flex flex-row items-center justify-between gap-3 px-1">
		<!-- Step 1 - right in RTL (first child) -->
		<p
			class="flex items-center gap-2 rounded-xl px-2 py-1 text-sm leading-snug font-bold text-gray-200 opacity-90 md:text-base"
			class:step-title-light={step1TitleLight}
		>
			<span
				class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-black"
				class:step-num-light={step1NumLight}
				style="background: radial-gradient(circle, #fde047 0%, #f59e0b 60%, #d97706 100%); opacity: 0.75"
				>1</span
			>
			בחר את סוג הפרסום
			{#if tutorialStep === 'pick-row'}
				<span
					class="tutorial-finger pointer-events-none text-base drop-shadow-[0_0_5px_rgba(245,158,11,0.45)] select-none md:text-lg"
					aria-hidden="true">👇</span
				>
			{/if}
		</p>
		<!-- Step 2 - left in RTL (last child) -->
		<p
			class="flex items-center gap-2 rounded-xl px-2 py-1 text-sm leading-snug font-bold text-gray-200 transition-opacity md:text-base
				{tutorialStep === 'pick-row' ? 'opacity-50' : 'opacity-90'}"
			class:step-title-light={step2TitleLight}
		>
			<span
				class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-black"
				class:step-num-light={step2NumLight}
				style="background: radial-gradient(circle, #fde047 0%, #f59e0b 60%, #d97706 100%); opacity: 0.75"
				>2</span
			>
			בחר את פרק הזמן
			{#if tutorialStep === 'pick-plan'}
				<span
					class="tutorial-finger pointer-events-none text-base drop-shadow-[0_0_5px_rgba(245,158,11,0.45)] select-none md:text-lg"
					aria-hidden="true">👇</span
				>
			{/if}
		</p>
	</div>

	<!-- Mobile cards (visible only on small screens) -->
	<div class="mb-6 space-y-3 md:hidden">
		{#each rows as row (row.num)}
			{@const plan = planMap.get(row.num)}
			{@const highlighted = !plan && highlightedRow === row.num}
			<div
				role="button"
				tabindex="0"
				onclick={() => highlightRow(row.num)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						highlightRow(row.num);
					}
				}}
				class="relative cursor-pointer rounded-2xl border px-4 py-3 transition-all
				{plan === 'half'
					? 'border-amber-500/50 bg-amber-500/10'
					: plan === 'single'
						? 'border-blue-500/50 bg-blue-500/10'
						: highlighted
							? 'scale-[1.01] border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/20'
							: 'border-white/10 bg-white/3 hover:border-white/25'}
				{plan && confirmingRow !== row.num ? 'ring-2 ring-amber-400 ring-offset-0' : ''}"
			>
				{#if confirmingRow === row.num}
					<span
						class="confirm-check-pop pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
						aria-hidden="true"
					>
						<span
							class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-3xl font-black text-black shadow-[0_0_30px_rgba(245,158,11,0.9)]"
						>
							✓
						</span>
					</span>
				{/if}
				<!-- Row: name + toggle -->
				<div class="mb-2 flex items-center justify-between gap-3">
					<div class="flex min-w-0 items-center gap-2">
						<span class="flex-shrink-0 text-xs font-black text-gray-400">#{row.num}</span>
						<span class="truncate text-base font-black text-white">{row.type}</span>
						{#if row.promo}
							<span
								class="animate-pulse rounded-full border border-rose-400/50 bg-rose-500/25 px-2 py-0.5 text-[10px] font-black whitespace-nowrap text-rose-200"
								>🔥 מבצע זמני</span
							>
						{/if}
					</div>
					<!-- Toggle -->
					<div
						class="relative inline-flex h-9 flex-shrink-0 rounded-full transition-all duration-300"
						style="padding: 2px;
							background: {plan === 'half'
							? 'rgba(245,158,11,0.2)'
							: plan === 'single'
								? 'rgba(59,130,246,0.2)'
								: 'rgba(255,255,255,0.12)'};
							border: 1.5px solid {plan === 'half'
							? 'rgba(245,158,11,0.7)'
							: plan === 'single'
								? 'rgba(59,130,246,0.7)'
								: 'rgba(255,255,255,0.3)'};"
					>
						<button
							type="button"
							onclick={() => setPlan(row.num, 'half')}
							class="toggle-segment relative z-10 flex items-center rounded-full px-3 text-xs leading-none font-black whitespace-nowrap transition-all duration-200"
							style="background: {plan === 'half'
								? '#f59e0b'
								: 'transparent'}; color: {plan === 'half' ? '#000' : plan ? '#9ca3af' : '#e5e7eb'};"
							>½שנה</button
						>
						{#if !plan}
							<span
								class="mx-0.5 flex-shrink-0 self-center text-xs leading-none font-black text-white/50"
								>/</span
							>
						{/if}
						<button
							type="button"
							onclick={() => setPlan(row.num, 'single')}
							class="toggle-segment relative z-10 flex items-center rounded-full px-3 text-xs leading-none font-black whitespace-nowrap transition-all duration-200"
							style="background: {plan === 'single'
								? '#3b82f6'
								: 'transparent'}; color: {plan === 'single'
								? '#fff'
								: plan
									? '#9ca3af'
									: '#e5e7eb'};"
							>חודש</button
						>
					</div>
				</div>
				<!-- Prices row -->
				<div class="mt-1 flex flex-wrap gap-4 text-sm">
					<div class="flex items-baseline gap-1">
						<span class="text-sm font-semibold text-gray-300">חצי שנה -</span>
						{#if row.regularHalf}
							<span class="text-xs text-gray-500 line-through">₪{fmt(row.regularHalf)}</span>
						{/if}
						<span class="text-sm font-black text-amber-400">₪{fmt(row.half)}</span>
						<span class="text-sm font-semibold text-gray-300">/חודש</span>
					</div>
					<div class="flex items-baseline gap-1">
						<span class="text-sm font-semibold text-gray-300">חודש בודד -</span>
						{#if row.regularSingle}
							<span class="text-xs text-gray-500 line-through">₪{fmt(row.regularSingle)}</span>
						{/if}
						<span class="text-sm font-black text-white">₪{fmt(row.single)}</span>
					</div>
				</div>
				<!-- Details -->
				<p class="mt-1.5 text-sm font-medium text-gray-300">{row.reach} · {row.details}</p>
			</div>
		{/each}
	</div>

	<!-- Desktop table (hidden on mobile) -->
	<div class="relative mb-6 hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
		<table class="w-full text-right text-base">
			<thead>
				<tr class="border-b border-amber-500/30 bg-amber-500/20">
					<th class="px-4 py-4 text-center font-black text-amber-400">#</th>
					<th class="px-4 py-4 font-black text-amber-400">סוג</th>
					<th class="px-4 py-4 text-center font-black whitespace-nowrap text-amber-400">
						לחודש ₪<br /><span class="text-sm font-normal text-amber-400/70">(חצי שנה)</span>
					</th>
					<th class="px-4 py-4 text-center font-black whitespace-nowrap text-amber-400">
						לחודש<br /><span class="text-sm font-normal text-amber-400/70">בודד</span>
					</th>
					<th class="px-4 py-4 font-black text-amber-400">פריסה</th>
					<th class="px-4 py-4 font-black text-amber-400">פרטים</th>
					<!-- Toggle column header - last = left side in RTL -->
					<th class="border-r border-white/10 bg-white/8 px-4 py-4 text-center">
						<div class="flex flex-col items-center gap-1">
							<span class="text-xs font-bold text-amber-400/80">½שנה</span>
							<div class="flex items-center gap-1">
								<div class="h-px w-4 bg-amber-500/50"></div>
								<div class="h-2 w-2 rounded-full bg-white/30"></div>
								<div class="h-px w-4 bg-blue-400/40"></div>
							</div>
							<span class="text-xs font-bold text-blue-400/80">חודש</span>
						</div>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row, i (row.num)}
					{@const plan = planMap.get(row.num)}
					{@const highlighted = !plan && highlightedRow === row.num}
					<tr
						onclick={() => highlightRow(row.num)}
						class="relative cursor-pointer border-b border-white/5 transition-all
						{plan === 'half'
							? 'bg-amber-500/10'
							: plan === 'single'
								? 'bg-blue-500/10'
								: highlighted
									? 'partial-highlight bg-amber-500/15'
									: i % 2 === 0
										? 'bg-white/3 hover:bg-white/5'
										: 'bg-white/5 hover:bg-white/8'}
						{plan && confirmingRow !== row.num
							? 'outline outline-2 outline-offset-[-2px] outline-amber-400'
							: ''}"
					>
						<td
							class="px-4 py-4 text-center font-bold
							{plan ? 'text-amber-400' : highlighted ? 'text-amber-300' : 'text-gray-400'}">{row.num}</td
						>

						<td
							class="group/typecell relative px-4 py-4 font-bold
							{plan === 'half' ? 'text-amber-300' : plan === 'single' ? 'text-blue-300' : 'text-white'}"
						>
							<div class="flex flex-wrap items-center gap-2">
								<span>{row.type}</span>
								{#if row.promo}
									<span
										class="animate-pulse rounded-full border border-rose-400/50 bg-rose-500/25 px-2 py-0.5 text-[10px] font-black whitespace-nowrap text-rose-200"
										>🔥 מבצע זמני</span
									>
								{/if}
							</div>
							{#if row.num === 1}
								<!-- Tooltip: "פרסומת ארוכה" = הפרסומות שבצד -->
								<div
									class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-purple-500/60 bg-gray-900 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover/typecell:opacity-100"
								>
									📢 הפרסומות שבצד ימין
									<div
										class="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-gray-900"
									></div>
								</div>
							{/if}
						</td>

						<td class="px-4 py-4 text-center">
							{#if row.regularHalf}
								<span class="me-1 text-xs text-gray-500 line-through">₪{fmt(row.regularHalf)}</span>
							{/if}
							<span class="text-sm font-bold text-white">₪{fmt(row.half)}</span>
							<span
								class="block text-base font-black {plan === 'half'
									? 'text-amber-300'
									: 'text-amber-400'}"
							>
								{#if row.regularTotal}
									<span class="me-1 text-[11px] font-bold text-gray-500 line-through"
										>₪{fmt(row.regularTotal)}</span
									>
								{/if}
								סה"כ ₪{fmt(row.total)}
							</span>
						</td>

						<td class="px-4 py-4 text-center">
							{#if row.regularSingle}
								<span class="me-1 text-xs text-gray-500 line-through">₪{fmt(row.regularSingle)}</span
								>
							{/if}
							<span class="font-bold {plan === 'single' ? 'text-blue-300' : 'text-gray-300'}"
								>₪{fmt(row.single)}</span
							>
						</td>

						<td class="px-4 py-4 text-sm text-gray-300">{row.reach}</td>
						<td class="px-4 py-4 text-sm text-gray-400">{row.details}</td>

						<!-- 3-state toggle - last column = left side in RTL -->
						<td
							class="relative border-r border-white/10 px-3 py-3 text-center"
							style="background: {plan === 'half'
								? 'rgba(245,158,11,0.12)'
								: plan === 'single'
									? 'rgba(59,130,246,0.12)'
									: 'rgba(255,255,255,0.06)'}"
						>
							{#if confirmingRow === row.num}
								<span
									class="confirm-check-pop pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
									aria-hidden="true"
								>
									<span
										class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-2xl font-black text-black shadow-[0_0_24px_rgba(245,158,11,0.9)]"
									>
										✓
									</span>
								</span>
							{/if}

							<div class="flex justify-center" role="presentation" onclick={(e) => e.stopPropagation()}>
								<div
									class="relative inline-flex h-9 rounded-full transition-all duration-300"
									style="
										padding: 2px;
										background: {plan === 'half'
										? 'rgba(245,158,11,0.2)'
										: plan === 'single'
											? 'rgba(59,130,246,0.2)'
											: 'rgba(255,255,255,0.12)'};
										border: 1.5px solid {plan === 'half'
										? 'rgba(245,158,11,0.7)'
										: plan === 'single'
											? 'rgba(59,130,246,0.7)'
											: 'rgba(255,255,255,0.3)'};
									"
								>
									<!-- Half-year segment (right in RTL) -->
									<button
										type="button"
										onclick={() => setPlan(row.num, 'half')}
										class="toggle-segment relative z-10 flex items-center rounded-full px-3 text-xs leading-none font-black whitespace-nowrap transition-all duration-200"
										style="background: {plan === 'half'
											? '#f59e0b'
											: 'transparent'}; color: {plan === 'half'
											? '#000'
											: plan
												? '#9ca3af'
												: '#e5e7eb'};"
										title="חצי שנה"
										>½שנה</button
									>

									{#if !plan}
										<span
											class="mx-0.5 flex-shrink-0 self-center text-xs leading-none font-black text-white/50"
											>/</span
										>
									{/if}

									<!-- Single-month segment (left in RTL) -->
									<button
										type="button"
										onclick={() => setPlan(row.num, 'single')}
										class="toggle-segment relative z-10 flex items-center rounded-full px-3 text-xs leading-none font-black whitespace-nowrap transition-all duration-200"
										style="background: {plan === 'single'
											? '#3b82f6'
											: 'transparent'}; color: {plan === 'single'
											? '#fff'
											: plan
												? '#9ca3af'
												: '#e5e7eb'};"
										title="חודש בודד"
										>חודש</button
									>
								</div>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- ===== Calculator Banner ===== -->
	{#if hasSelection}
		<div
			bind:this={calculatorEl}
			class="mb-12 scroll-mt-4 rounded-2xl border-2 border-white/20 bg-gradient-to-br from-gray-900 to-gray-950 p-6 shadow-2xl md:p-8"
			style="animation: slideDown 0.3s ease-out;"
		>
			<!-- Title -->
			<div class="mb-6 flex flex-wrap items-center justify-center gap-2">
				<span class="text-3xl">🧮</span>
				<h2 class="text-xl font-black text-white md:text-2xl">מחשבון וסיכום</h2>
				<span
					class="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-black text-gray-300"
				>
					{planMap.size} נבחרו
				</span>
			</div>

			<!-- Selected items breakdown -->
			<div class="mb-6 overflow-hidden rounded-xl border border-white/10 bg-black/40">
				<div class="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
					<p class="text-xs font-bold tracking-wider text-gray-400 uppercase">פרסומות שנבחרו</p>
					<div class="flex gap-3 text-[10px]">
						{#if halfItems.length > 0}
							<span class="font-bold text-amber-400">🟡 {halfItems.length} חצי שנה</span>
						{/if}
						{#if singleItems.length > 0}
							<span class="font-bold text-blue-400">🔵 {singleItems.length} חודש בודד</span>
						{/if}
					</div>
				</div>
				<ul class="divide-y divide-white/5">
					{#each selectedItems as item (item.num)}
						<li class="flex items-center justify-between gap-3 px-4 py-3">
							<div class="flex min-w-0 items-center gap-2">
								<button
									type="button"
									onclick={() => {
										const n = new Map(planMap);
										n.delete(item.num);
										planMap = n;
									}}
									class="flex-shrink-0 text-xs text-gray-600 transition-colors hover:text-red-400"
									aria-label="הסר"
								>✕</button>
								<span
									class="truncate text-sm font-bold
									{item.plan === 'half' ? 'text-amber-200' : 'text-blue-200'}">{item.type}</span
								>
							</div>
							<div class="flex flex-shrink-0 items-center gap-3">
								<!-- Plan badge -->
								<span
									class="rounded-full px-2 py-0.5 text-[10px] font-black
									{item.plan === 'half'
										? 'border border-amber-500/30 bg-amber-500/20 text-amber-400'
										: 'border border-blue-500/30 bg-blue-500/20 text-blue-400'}"
								>
									{item.plan === 'half' ? '½ שנה' : 'חודש'}
								</span>
								<!-- Price -->
								<div class="flex items-center gap-2 whitespace-nowrap">
									<span class="text-xs text-gray-600">
										{item.plan === 'half' ? 'ל-6 חודשים' : 'לחודש'}
									</span>
									<span
										class="text-sm font-black {item.plan === 'half'
											? 'text-amber-400'
											: 'text-blue-400'}"
									>
										₪{fmt(item.eTotal)}
									</span>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Total + Contact - single merged box with a divider line between them -->
			<div class="mb-6 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/5">
				<div class="grid grid-cols-1 items-stretch md:grid-cols-2">
					<!-- Total - right side in RTL (DOM-first) -->
					<div
						class="flex flex-col justify-center gap-3 border-b border-white/15 px-6 py-5 text-right md:border-b-0 md:border-l"
					>
						<!-- Per-item math breakdown -->
						<div class="space-y-1.5">
							{#each selectedItems as item (item.num)}
								<p class="text-base leading-snug font-bold text-gray-100 md:text-lg">
									<span class="{item.plan === 'half' ? 'text-amber-300' : 'text-blue-300'}"
										>{item.type}:</span
									>
									<span class="text-white">₪{fmt(item.eMonthly)}</span>
									<span class="font-medium text-gray-300">לחודש</span>
									{#if item.monthsCount > 1}
										<span class="mx-0.5 text-gray-400">×</span>
										<span class="text-white">{item.monthsCount}</span>
										<span class="font-medium text-gray-300">חודשים</span>
									{/if}
									<span class="mx-1 text-gray-400">=</span>
									<span class="{item.plan === 'half' ? 'text-amber-300' : 'text-blue-300'} font-black"
										>₪{fmt(item.eTotal)}</span
									>
								</p>
							{/each}
							{#if mapImageAddon}
								<p class="text-base leading-snug font-bold text-purple-200 md:text-lg">
									<span class="text-purple-300">🗺️ תמונה על המפה:</span>
									<span class="text-white">₪{fmt(MAP_IMAGE_PRICE_YEARLY)}</span>
									<span class="font-medium text-gray-300">לשנה</span>
								</p>
							{/if}
						</div>

						<!-- תוספת: תמונה/לוגו על המפה - 50 ₪ לשנה -->
						<button
							type="button"
							onclick={() => (mapImageAddon = !mapImageAddon)}
							class="rounded-xl border p-3 text-right transition-all {mapImageAddon
								? 'border-purple-400/60 bg-purple-500/15'
								: 'border-white/15 bg-white/5 hover:bg-white/10'}"
						>
							<div class="flex items-center gap-2.5">
								<span class="text-2xl" aria-hidden="true">🗺️</span>
								<div class="min-w-0 flex-1">
									<p class="text-sm leading-tight font-black text-white md:text-base">
										תמונה או לוגו על המפה
									</p>
									<p class="text-xs leading-snug text-gray-300">
										התמונה של הכרטיס תופיע על המפה במקום האייקון · 50 ₪ לשנה.
									</p>
								</div>
								<span
									class="relative h-6 w-11 shrink-0 rounded-full transition-colors {mapImageAddon
										? 'bg-purple-500'
										: 'bg-gray-600'}"
								>
									<span
										class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all {mapImageAddon
											? 'start-0.5'
											: 'end-0.5'}"
									></span>
								</span>
							</div>
						</button>

						<div class="flex flex-wrap items-center justify-start gap-x-3 gap-y-1">
							{#if discountValue > 0}
								<span class="text-2xl font-black text-gray-500 line-through md:text-3xl"
									>₪{fmt(totalPayment)}</span
								>
							{/if}
							<p
								class="inline-block text-5xl font-black md:text-6xl {discountValue > 0
									? 'text-green-400'
									: 'text-white'}"
								class:total-flash={flashTotal}
							>
								₪{fmt(effectiveTotal)}
							</p>
							{#if isFreeExempt}
								<span
									class="rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs font-black text-green-300 md:text-sm"
									>🎉 {discountLabelText || 'פטור מלא מתשלום'}</span
								>
							{:else if discountValue > 0}
								<span
									class="rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs font-black text-green-300 md:text-sm"
								>
									{discountEval.matched?.label} · חסכת ₪{fmt(discountValue)}
								</span>
							{:else}
								<span class="text-xs font-bold text-gray-400 md:text-sm">ניתן לפרוס לתשלומים</span>
							{/if}
						</div>
					</div>

					<!-- ===== Contact section (מייל / וואטסאפ) ===== -->
					<div class="flex flex-col justify-center p-5" style="animation: slideDown 0.25s ease-out;">
						<p
							class="mb-3 flex items-center justify-center gap-2 text-center text-sm font-bold text-gray-300"
							class:step-title-light={step3TitleLight}
						>
							<span
								class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-black"
								class:step-num-light={step3NumLight}
								style="background: radial-gradient(circle, #fde047 0%, #f59e0b 60%, #d97706 100%); opacity: 0.75"
								>3</span
							>
							📧 קבל אישור הזמנה - מייל / וואטסאפ
						</p>
						<div class="flex flex-col gap-2">
							<!-- Row 1: phone + WhatsApp -->
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<input
									type="tel"
									bind:value={userPhone}
									placeholder="050-1234567"
									dir="ltr"
									class="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white transition-all placeholder:text-gray-600 focus:border-green-500/60 focus:bg-green-900/10 focus:outline-none"
								/>
								<a
									href={whatsappHref}
									target="_blank"
									rel="noopener noreferrer"
									aria-label="שלח הזמנת פרסום בוואטסאפ (נפתח בחלון חדש)"
									class="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-green-500/20 transition-all hover:scale-105 hover:bg-green-500"
								>
									💬 שלח בוואטסאפ
								</a>
							</div>
							<!-- Row 2: email + send-doc (mailto) -->
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<input
									type="email"
									bind:value={userEmail}
									placeholder="your@email.com"
									dir="ltr"
									class="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white transition-all placeholder:text-gray-600 focus:border-amber-500/60 focus:bg-amber-900/10 focus:outline-none"
								/>
								<a
									href={mailtoHref}
									class="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-105 hover:bg-amber-400"
								>
									✉️ שלח תיעוד - ₪{fmt(effectiveTotal)}
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
			<!-- /Total + Contact merged box -->

			<!-- Breakdown cards (only if both plan types selected) -->
			{#if halfItems.length > 0 && singleItems.length > 0}
				<div class="mb-6 grid grid-cols-2 gap-3">
					<div class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
						<p class="mb-1 text-[10px] font-bold text-amber-400/70 uppercase">חצי שנה</p>
						<p class="text-xl font-black text-amber-400">
							₪{fmt(halfItems.reduce((s, r) => s + r.eTotal, 0))}
						</p>
						<p class="text-[10px] text-gray-500">{halfItems.length} פרסומות · 6 חודשים</p>
					</div>
					<div class="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-center">
						<p class="mb-1 text-[10px] font-bold text-blue-400/70 uppercase">חודש בודד</p>
						<p class="text-xl font-black text-blue-400">
							₪{fmt(singleItems.reduce((s, r) => s + r.eTotal, 0))}
						</p>
						<p class="text-[10px] text-gray-500">{singleItems.length} פרסומות · חודש בודד</p>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Empty state -->
		<div
			class="mb-12 rounded-2xl border-2 border-dashed border-white/10 bg-white/2 p-5 text-center"
		>
			<p class="text-sm text-gray-500">
				🧮 בחר את סוג הפרסום ותקופתו כדי לראות את
				<span class="font-bold text-white">סיכום המחיר!</span>
			</p>
		</div>
	{/if}

	<!-- ===== STEP 4: Period confirmation (FREE editing day + expiration) ===== -->
	{#if hasSelection}
		<div
			class="mt-8 rounded-2xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-900/20 to-indigo-900/15 p-5 md:p-7"
			dir="rtl"
		>
			<h2 class="mb-3 flex items-center justify-center gap-2 text-center text-xl font-black text-white md:text-2xl">
				<span
					class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-black"
					style="background: radial-gradient(circle, #fde047 0%, #f59e0b 60%, #d97706 100%); opacity: 0.85"
					>4</span
				>
				📅 תקופת הפרסום ותאריך התפוגה
			</h2>

			<!-- Explainer -->
			<div class="mb-5 rounded-xl border border-white/10 bg-white/3 p-4 md:p-5">
				<p class="mb-2 flex items-center gap-2 text-sm font-black text-amber-300 md:text-base">
					<span class="text-xl">🎁</span>
					<span>יום העריכה - חינם על חשבון המערכת</span>
				</p>
				<ul
					class="list-outside list-disc space-y-1.5 pr-6 text-xs leading-relaxed text-gray-200 md:text-sm"
				>
					<li>
						היום, <strong class="text-amber-200">{fmtDate(today)}</strong>, הוא יום העריכה החינמית -
						לא נספר בתקופת הפרסום.
					</li>
					<li>
						הפרסומת תרוץ <strong class="text-amber-200">חודש מלא</strong> - עד
						<strong class="text-amber-200">{fmtDate(expirationDate)} כולל</strong>.
					</li>
					<li>
						תקופת העריכה החינמית נגמרת היום ב<strong class="text-amber-200">23:59</strong>. כדאי
						לסיים את העריכה לפני זה!
					</li>
				</ul>
			</div>

			<!-- Two-month calendar with markers -->
			<div class="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
				{#each [today, expirationDate] as anchor (anchor.getTime())}
					{@const cells = buildCalendar(anchor)}
					<div class="rounded-xl border border-white/10 bg-black/30 p-3">
						<p class="mb-2 text-center text-sm font-black text-amber-300">{fmtMonthName(anchor)}</p>
						<div
							class="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-gray-500"
						>
							{#each ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as dow (dow)}
								<div>{dow}</div>
							{/each}
						</div>
						<div class="grid grid-cols-7 gap-0.5">
							{#each cells as cell (cell.getTime())}
								{@const inMonth = cell.getMonth() === anchor.getMonth()}
								{@const isToday = sameDay(cell, today)}
								{@const isExpiry = sameDay(cell, expirationDate)}
								<div
									class="flex aspect-square items-center justify-center rounded text-xs font-bold
									{!inMonth ? 'text-gray-700' : 'text-gray-300'}
									{isToday ? 'bg-amber-500 text-black ring-2 ring-amber-300' : ''}
									{isExpiry && !isToday ? 'bg-red-500 text-white ring-2 ring-red-300' : ''}"
								>
									{cell.getDate()}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- Calendar legend -->
			<div class="mb-5 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
				<span class="inline-flex items-center gap-1.5"
					><span class="h-3 w-3 rounded bg-amber-500"></span> היום - יום עריכה חינם</span
				>
				<span class="inline-flex items-center gap-1.5"
					><span class="h-3 w-3 rounded bg-red-500"></span> תאריך תפוגת הפרסומת</span
				>
			</div>

			<!-- Confirmation checkbox -->
			<label
				class="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-amber-500/40 hover:bg-white/8"
			>
				<input
					type="checkbox"
					bind:checked={confirmedPeriod}
					class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-2 border-amber-500/50 accent-amber-500"
				/>
				<div class="flex-1">
					<p class="mb-1 text-sm font-bold text-white md:text-base">
						הבנתי את אורך התקופה ואת תאריך התפוגה
					</p>
					<p class="text-xs leading-relaxed text-gray-400 md:text-sm">
						היום ({fmtDate(today)}) - יום עריכה חינם. הפרסומת שלי תפעל עד
						<span class="font-bold text-amber-300">{fmtDate(expirationDate)} כולל</span>.
					</p>
				</div>
			</label>
		</div>
	{/if}

	<!-- ===== STEP 5: Secure Payment ===== -->
	<div
		class="mt-8 rounded-2xl border border-white/10 bg-white/3 p-6 md:p-8"
		dir="rtl"
		class:opacity-50={hasSelection && !confirmedPeriod}
		class:pointer-events-none={hasSelection && !confirmedPeriod}
	>
		<h2 class="mb-2 flex items-center justify-center gap-2 text-center text-xl font-black text-white md:text-2xl">
			<span
				class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-black"
				style="background: radial-gradient(circle, #fde047 0%, #f59e0b 60%, #d97706 100%); opacity: 0.75"
				>5</span
			>
			🔒 תשלום מאובטח
		</h2>
		{#if hasSelection && !confirmedPeriod}
			<p class="mb-3 -mt-1 text-center text-sm font-bold text-amber-300">
				⬆️ סמן/י תחילה את התיבה למעלה (שלב 4) כדי לפתוח את התשלום
			</p>
		{/if}
		<p class="mb-6 text-center text-sm text-gray-400">
			התשלום מתבצע בצורה מאובטחת דרך חברת הסליקה - פרטי האשראי שלך לא מגיעים אלינו
		</p>

		<!-- ===== Discount drawer ===== -->
		<div class="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 md:p-5">
			<label
				for="discount-code"
				class="mb-1.5 block text-right text-sm font-black text-amber-200 md:text-base"
			>
				🎟️ קוד הנחה
			</label>
			{#if FREE_PROMO}
				<p class="mb-2.5 text-right text-xs font-bold text-green-300 md:text-sm">
					🎉 בתקופה הראשונית: רשמו כאן "{FREE_PROMO_CODE_TEXT}" והעלאת הפרסום חינם - ללא תשלום.
				</p>
			{:else}
				<p class="mb-2.5 text-right text-xs text-gray-400">
					יש לך קוד הנחה? הזן/י אותו כאן והסכום יתעדכן אוטומטית.
				</p>
			{/if}
			<input
				id="discount-code"
				type="text"
				bind:value={discountInput}
				placeholder="הקלד/י כאן את מילות ההנחה"
				dir="rtl"
				class="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-right text-sm text-white transition-all placeholder:text-gray-600 focus:border-amber-500/60 focus:bg-amber-900/10 focus:outline-none"
			/>
			{#if discountInput.trim()}
				{#if discountEval.applied && discountEval.matched}
					<p
						class="mt-2.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-right text-sm font-bold text-green-300"
					>
						{#if isFreeExempt}
							✅ פטור מלא מתשלום - {discountEval.matched.label}. ניתן להעלות את הפרסום ללא עלות.
						{:else}
							✅ ההנחה הופעלה: {discountEval.matched.label} ({discountEval.matched.percent}%) · חסכת
							₪{fmt(discountValue)}
						{/if}
					</p>
				{:else if discountEval.reason === 'not-coordinator'}
					<p
						class="mt-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-right text-sm font-bold text-red-300"
					>
						⛔ קוד זה מיועד לרכזים מאושרים בלבד.
					</p>
				{:else if discountEval.reason === 'inactive'}
					<p
						class="mt-2.5 rounded-lg border border-gray-500/30 bg-gray-500/10 px-3 py-2 text-right text-sm font-bold text-gray-300"
					>
						קוד זה אינו פעיל כרגע.
					</p>
				{:else}
					<p class="mt-2.5 text-right text-xs text-gray-500">הקוד שהוזן אינו מזוהה.</p>
				{/if}
			{/if}
		</div>

		{#if isFreeExempt}
			<!-- ===== Free exemption flow - upload publication at no cost ===== -->
			<div class="rounded-xl border-2 border-green-500/50 bg-green-900/15 p-6 text-center">
				<div class="mb-3 text-3xl">🎉</div>
				<h3 class="mb-1 text-lg font-black text-green-300">
					{discountLabelText || 'פטור מלא מתשלום'}
				</h3>
				<p class="mb-5 text-sm text-gray-300">הקוד התקבל - אפשר להעלות את הפרסום ללא כל עלות.</p>
				<a
					href={BUILDER_URL}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-7 py-3.5 text-base font-black text-white shadow-lg shadow-green-500/20 transition-all hover:scale-105 hover:bg-green-500"
				>
					🎨 להעלות את הפרסום בחינם
				</a>
			</div>
		{:else}
			<div class="mb-6 flex flex-wrap justify-center gap-3">
				{#each ['Visa', 'Mastercard', 'American Express', 'Bit', 'PayPal'] as method (method)}
					<div
						class="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-gray-300"
					>
						{method}
					</div>
				{/each}
			</div>

			<div class="rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-900/10 p-6 text-center">
				<div class="mb-3 text-3xl">💳</div>
				<h3 class="mb-1 font-black text-white">סליקה מאובטחת</h3>
				<p class="mb-4 text-sm text-gray-400">
					מחוברים לחברת סליקה מורשית - עסקה מאובטחת ב-SSL
				</p>

				<!-- Temporary notice - payment processor not yet connected -->
				<p
					class="mb-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-center text-sm leading-snug font-bold text-orange-200 sm:flex-row md:text-base"
				>
					<span class="text-lg">🚧</span>
					<span
						>הסליקה באתר עדיין לא מחוברת - לסיום ההזמנה ולתשלום, צור קשר בוואטסאפ:
						<a
							href={`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(`שלום, אני מעוניין/ת להשלים תשלום על פרסום (סה״כ ₪${fmt(effectiveTotal)}).`)}`}
							target="_blank"
							rel="noopener noreferrer"
							class="font-black whitespace-nowrap text-white underline underline-offset-2 hover:text-orange-100"
						>
							050-875-0632 💬
						</a>
					</span>
				</p>

				<div class="flex flex-col justify-center gap-3 sm:flex-row">
					<a
						href={`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(`שלום, אני מעוניין/ת להשלים תשלום על פרסום באתר. סה״כ: ₪${fmt(effectiveTotal)}.` + (selectedItems.length > 0 ? ` פריטים: ${selectedItems.map((r) => r.type).join(', ')}.` : ''))}`}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="לתשלום זמני - צור קשר בוואטסאפ (נפתח בחלון חדש)"
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-black text-white transition-all hover:scale-105 hover:bg-purple-500"
					>
						💬 לתיאום תשלום בוואטסאפ
					</a>
					<a
						href={BUILDER_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-black text-white transition-all hover:scale-105 hover:bg-green-500"
					>
						🎨 כבר שילמתי - לבנות את הפרסומת
					</a>
				</div>
				<p
					class="mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm leading-snug font-bold text-amber-200 md:text-base"
				>
					<span class="text-lg">📞</span>
					<span
						>לאחר השלמת הרכישה ניצור איתכם קשר לתיאום הפרסום
						<span class="font-black text-amber-100">בהקדם</span></span
					>
				</p>

				<!-- After-payment guidance -->
				<div class="mt-3 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-right">
					<p class="mb-1.5 flex items-center gap-2 text-sm font-black text-green-300 md:text-base">
						<span class="text-lg">💾</span>
						<span>אחרי התשלום - איך ממשיכים?</span>
					</p>
					<ul
						class="list-outside list-disc space-y-1 pr-6 text-xs leading-relaxed text-gray-200 md:text-sm"
					>
						<li>
							תועברו אוטומטית ל<a
								href={BUILDER_URL}
								target="_blank"
								rel="noopener noreferrer"
								class="font-bold text-amber-300 underline hover:text-amber-200">בילדר הפרסומת</a
							> - שלב אחר שלב, עם תצוגה מקדימה חיה.
						</li>
						<li>
							הטיוטה <strong class="text-green-300">נשמרת אוטומטית בכל רגע</strong> - אם הדף נסגר, הכל
							יישמר.
						</li>
					</ul>
				</div>
			</div>
		{/if}

		<div class="mt-5 flex flex-wrap justify-center gap-4">
			{#each [{ icon: '🔒', label: 'SSL מאובטח' }, { icon: '✅', label: 'PCI DSS תקן' }, { icon: '🏦', label: 'בנק ישראל מורשה' }, { icon: '↩️', label: 'החזר כספי תוך 14 יום' }] as badge (badge.label)}
				<div class="flex items-center gap-1.5 text-xs text-gray-400">
					<span>{badge.icon}</span>
					<span>{badge.label}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Contact CTA -->
	<div
		class="mt-6 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-900/30 to-yellow-900/20 p-4 text-center md:p-6"
	>
		<h2 class="mb-3 text-lg font-black text-amber-400 md:text-xl">ליצירת קשר אנושי</h2>
		<div class="flex flex-col justify-center gap-2 sm:flex-row">
			<a
				href={`mailto:${CONTACT_EMAIL}`}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-black shadow-lg shadow-amber-500/30 transition-all hover:scale-105 hover:bg-amber-400"
			>
				✉️ שלח מייל
			</a>
			<a
				href={`https://wa.me/${WA_PHONE}`}
				target="_blank"
				rel="noopener noreferrer"
				aria-label="צור קשר בוואטסאפ (נפתח בחלון חדש)"
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-green-500/30 transition-all hover:scale-105 hover:bg-green-500"
			>
				💬 וואטסאפ
			</a>
		</div>
		<p class="mt-3 text-xs text-gray-500">{CONTACT_EMAIL}</p>
	</div>
</div>

<style>
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes gentleHover {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-5px) scale(1.03);
		}
	}
	/* Use a class so Svelte keeps the keyframe (inline-style refs may be tree-shaken) */
	:global(.tutorial-finger) {
		display: inline-block;
		animation: gentleHover 2.6s ease-in-out infinite !important;
		will-change: transform;
	}
	/* Toggle button hover feedback */
	:global(.toggle-segment) {
		cursor: pointer;
	}
	:global(.toggle-segment:hover) {
		transform: scale(1.08);
		box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.45);
	}
	:global(.toggle-segment:active) {
		transform: scale(0.95);
	}

	/* Step indicator - single brief flash on the number badge (~0.7s) */
	@keyframes stepNumFlashAnim {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
			transform: scale(1);
			filter: brightness(1);
		}
		50% {
			box-shadow: 0 0 18px 6px rgba(251, 191, 36, 0.95);
			transform: scale(1.25);
			filter: brightness(1.55);
		}
	}
	:global(.step-num-light) {
		animation: stepNumFlashAnim 0.7s ease-in-out 1;
	}

	/* Step indicator - title glow that lights up AFTER the number flash (~1.5s) */
	@keyframes stepTitleGlowAnim {
		0%,
		100% {
			color: rgb(229 231 235);
			text-shadow: 0 0 0 rgba(251, 191, 36, 0);
		}
		50% {
			color: #fbbf24;
			text-shadow:
				0 0 14px rgba(251, 191, 36, 0.9),
				0 0 28px rgba(251, 191, 36, 0.5);
		}
	}
	:global(.step-title-light) {
		animation: stepTitleGlowAnim 1.5s ease-in-out 1;
	}

	/* Subtle flash on the total amount when the slow scroll lands on the calculator */
	@keyframes totalFlashAnim {
		0%,
		100% {
			transform: scale(1);
			color: #ffffff;
			text-shadow: 0 0 0 rgba(251, 191, 36, 0);
		}
		50% {
			transform: scale(1.06);
			color: #fbbf24;
			text-shadow:
				0 0 24px rgba(251, 191, 36, 0.65),
				0 0 48px rgba(251, 191, 36, 0.35);
		}
	}
	:global(.total-flash) {
		animation: totalFlashAnim 0.75s ease-in-out 2;
	}

	/* Step 1 partial highlight - outlines all cells in the row except the toggle column (last td) */
	:global(tr.partial-highlight > td) {
		box-shadow:
			inset 0 2px 0 #fbbf24,
			inset 0 -2px 0 #fbbf24;
	}
	:global(tr.partial-highlight > td:first-child) {
		box-shadow:
			inset 0 2px 0 #fbbf24,
			inset 0 -2px 0 #fbbf24,
			inset -2px 0 0 #fbbf24;
	}
	:global(tr.partial-highlight > td:nth-last-child(2)) {
		box-shadow:
			inset 0 2px 0 #fbbf24,
			inset 0 -2px 0 #fbbf24,
			inset 2px 0 0 #fbbf24;
	}
	:global(tr.partial-highlight > td:last-child) {
		box-shadow: none;
	}

	/* Step checkmark pop - plays once when a plan is selected, then fades */
	@keyframes confirmCheckPop {
		0% {
			opacity: 0;
			transform: scale(0);
		}
		35% {
			opacity: 1;
			transform: scale(1.35);
		}
		60% {
			opacity: 1;
			transform: scale(1);
		}
		85% {
			opacity: 1;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.05);
		}
	}
	:global(.confirm-check-pop > span) {
		animation: confirmCheckPop 0.7s ease-out forwards;
	}
</style>
