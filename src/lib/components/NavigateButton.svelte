<script>
	// ─────────────────────────────────────────────────────────────
	// NavigateButton — "נווט" מתחת למפה של הכרטיסייה.
	//
	// המפה עונה על "איפה זה"; הכפתור הזה עונה על "קח אותי לשם" — ומוסר את
	// היעד לאפליקציה שכבר מותקנת אצל הגולש, במקום לנסות לנווט בתוך האתר.
	//
	// לעסק יש לפעמים יותר ממקום אחד (סניף, קליניקה, מחסן — ראו branches.js),
	// וכפתור יחיד היה מנווט תמיד אל הראשון בלבד. לכן: מקום אחד = כפתור אחד
	// שכתוב עליו "נווט", יותר מאחד = כפתור לכל מקום שכתוב עליו שם המקום,
	// כדי שהבחירה תיעשה לפני הלחיצה ולא בתוך אפליקציית הניווט.
	//
	// באנדרואיד הפריט הראשון בתפריט הוא geo: — הכתובת התקנית שכל אפליקציית
	// ניווט רושמת לעצמה, וכשלוחצים עליה מערכת ההפעלה עצמה פותחת את בורר
	// האפליקציות עם מה שבאמת מותקן במכשיר (Waze, גוגל מפות, מוביט...).
	// באייפון ובדסקטופ אין בורר כזה, ולכן מתחתיו יושבים קישורים ישירים:
	// כולם קישורי https "אוניברסליים" שנפתחים באפליקציה כשהיא מותקנת
	// ובאתר כשלא — כך שאף פריט בתפריט אינו מוביל למסך ריק.
	//
	// היעד עצמו: קואורדינטות אם יש (מדויק, בלי פענוח מחדש), ואחרת הכתובת
	// כטקסט חיפוש. אין לא זה ולא זה — אין כפתור, כי אין לאן לנווט.
	// ─────────────────────────────────────────────────────────────
	import { lang, translations } from '$lib/i18n';
	import { branchLine } from '$lib/branches.js';

	/** @type {{ business: any }} */
	let { business } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/** @param {unknown} v */
	const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

	/**
	 * שאילתת הכתובת מגובה בעיר רק כשזו לא כבר כתובה בתוכה, שלא ייווצר
	 * "רחוב הרצל 5, חולון, חולון" — פענוח כזה מחזיר לפעמים מרכז עיר במקום בית.
	 * @param {{address?: string, city?: string}} p
	 */
	function destText(p) {
		const addr = (p.address || '').trim();
		const city = (p.city || '').trim();
		if (!addr) return city;
		return city && !addr.includes(city) ? `${addr}, ${city}` : addr;
	}

	// המקום הראשון הוא כתובת העסק — היחיד שיש לו נקודה מדויקת על המפה;
	// לסניפים יש טקסט בלבד, ואפליקציות הניווט מפענחות אותו בעצמן.
	const places = $derived(
		(() => {
			const raw = [
				{
					address: business?.address || '',
					neighborhood: business?.neighborhood || '',
					city: business?.city || '',
					lat: num(business?.lat),
					lng: num(business?.lng)
				},
				...(Array.isArray(business?.branches) ? business.branches : []).map(
					/** @param {any} b */ (b) => ({
						address: b?.address || '',
						neighborhood: b?.neighborhood || '',
						city: b?.city || '',
						lat: null,
						lng: null
					})
				)
			].filter((p) => destText(p) || (p.lat !== null && p.lng !== null));

			// שם קצר לכפתור: העיר קודמת, כי היא מה שמבדיל בין סניפים. שני
			// מקומות שיצא להם אותו שם קצר מקבלים את השורה המלאה — אחרת שני
			// כפתורים זהים, ואי אפשר לדעת מי מהם מוביל לאן.
			const short = raw.map((p) => (p.city || p.neighborhood || p.address || '').trim());
			const twice = new Set(short.filter((s, i) => short.indexOf(s) !== i));

			return raw.map((p, i) => ({
				key: `p${i}`,
				name: (twice.has(short[i]) ? branchLine(p) : short[i]) || branchLine(p),
				text: destText(p),
				lat: p.lat,
				lng: p.lng
			}));
		})()
	);

	/** אינדקס המקום שהתפריט שלו פתוח; ‎-1 = סגור */
	let openIdx = $state(-1);
	/** באנדרואיד בלבד יש בורר אפליקציות אמיתי — נבדק בלחיצה, לא ברינדור בשרת */
	let isAndroid = $state(false);
	let pos = $state({ top: 0, left: 0 });

	const MENU_W = 224; // w-56
	const MENU_H_EST = 200; // להחלטה בלבד: לפתוח מעל הכפתור או מתחתיו

	/** התפריט נצמד לכפתור שנלחץ ונשאר בתוך המסך — הכפתורים יושבים מתחת למפה
	 * @param {HTMLElement} el */
	function place(el) {
		const r = el.getBoundingClientRect();
		const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_W - 8);
		const below = r.bottom + 6;
		const flip = below + MENU_H_EST > window.innerHeight && r.top > MENU_H_EST;
		pos = { top: flip ? Math.max(8, r.top - MENU_H_EST - 6) : below, left };
	}

	/**
	 * @param {number} i
	 * @param {MouseEvent} e
	 */
	function toggle(i, e) {
		if (openIdx === i) return close();
		isAndroid = /android/i.test(navigator.userAgent);
		place(/** @type {HTMLElement} */ (e.currentTarget));
		openIdx = i;
	}

	function close() {
		openIdx = -1;
	}

	/**
	 * כתובת של סכימה חיצונית (geo:) חייבת ללכת דרך location — window.open
	 * על סכימה לא-http נחסם בחלק מהדפדפנים ומשאיר חלון ריק.
	 * @param {string} href
	 */
	function go(href) {
		close();
		if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
		else window.location.href = href;
	}

	const enc = encodeURIComponent;

	/** @param {{name: string, text: string, lat: number|null, lng: number|null}} p */
	function appsFor(p) {
		const { lat, lng, text } = p;
		const coords = lat !== null && lng !== null;
		const label = (business?.name || '').trim() || p.name || text;
		return /** @type {{ key: string, label: string, href: string }[]} */ ([
			// בורר האפליקציות של אנדרואיד: הפריט היחיד שבאמת פותח את *כל* מה
			// שמותקן, ולכן הוא בראש ומופרד משאר הרשימה
			isAndroid && {
				key: 'device',
				label: t.navigateDeviceApps,
				href: coords ? `geo:${lat},${lng}?q=${lat},${lng}(${enc(label)})` : `geo:0,0?q=${enc(text)}`
			},
			{
				key: 'waze',
				label: 'Waze',
				href: coords
					? `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`
					: `https://waze.com/ul?q=${enc(text)}&navigate=yes`
			},
			{
				key: 'google',
				label: 'Google Maps',
				href: `https://www.google.com/maps/dir/?api=1&destination=${
					coords ? `${lat}%2C${lng}` : enc(text)
				}`
			},
			// מוביט מנווט לפי נקודה בלבד — בלי קואורדינטות אין לו מה לקבל
			coords && {
				key: 'moovit',
				label: 'Moovit',
				href: `https://moovit.com/?to=${enc(label)}&tll=${lat}_${lng}`
			},
			{
				key: 'apple',
				label: 'Apple Maps',
				href: `https://maps.apple.com/?daddr=${coords ? `${lat}%2C${lng}` : enc(text)}&dirflg=d`
			}
		]).filter(Boolean);
	}

	const APPS = $derived(openIdx >= 0 && places[openIdx] ? appsFor(places[openIdx]) : []);
</script>

<svelte:window onresize={close} onscroll={close} />

{#if places.length}
	<!-- הכפתורים ממורכזים מתחת למפה, ונשברים לשורה נוספת כשיש הרבה מקומות -->
	<div class="flex flex-wrap items-center justify-center gap-2">
		{#each places as p, i (p.key)}
			<button
				type="button"
				onclick={(e) => toggle(i, e)}
				aria-haspopup="menu"
				aria-expanded={openIdx === i}
				aria-label={places.length > 1 ? `${t.navigate} – ${p.name}` : undefined}
				class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-500"
			>
				<!-- חץ הניווט המקובל, אותו סימן שנושאות אפליקציות הניווט עצמן -->
				<svg
					class="h-5 w-5 flex-shrink-0"
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M21.4 2.6 3.3 9.5c-1.2.5-1.1 2.2.1 2.5l7 2 2 7c.3 1.2 2 1.3 2.5.1l6.9-18.1a1 1 0 0 0-1.4-1.4Z"
					/>
				</svg>
				<span class="max-w-[13rem] truncate">
					{places.length > 1 ? p.name || t.navigate : t.navigate}
				</span>
			</button>
		{/each}
	</div>

	{#if openIdx >= 0}
		<!-- שכבה שקופה על כל המסך: לחיצה בחוץ סוגרת -->
		<div class="fixed inset-0 z-40" role="presentation" onclick={close}></div>
		<div
			role="menu"
			tabindex="-1"
			dir={t.dir}
			onkeydown={(e) => e.key === 'Escape' && close()}
			style="top:{pos.top}px; left:{pos.left}px; width:{MENU_W}px"
			class="fixed z-50 overflow-hidden rounded-xl border border-white/10 bg-gray-900 py-1 text-start shadow-xl"
		>
			{#each APPS as app (app.key)}
				{#if app.key === 'waze' && isAndroid}
					<div class="my-1 border-t border-white/10"></div>
				{/if}
				<button
					type="button"
					role="menuitem"
					onclick={() => go(app.href)}
					class="block w-full px-3 py-2 text-start text-sm text-gray-100 transition hover:bg-white/10"
				>
					{app.label}
				</button>
			{/each}
		</div>
	{/if}
{/if}
