<script>
	// ─────────────────────────────────────────────────────────────
	// NavigateButton — "נווט" מתחת למפה של הכרטיסייה.
	//
	// המפה עונה על "איפה זה"; הכפתור הזה עונה על "קח אותי לשם" — ומוסר את
	// היעד לאפליקציה שכבר מותקנת אצל הגולש, במקום לנסות לנווט בתוך האתר.
	//
	// באנדרואיד הפריט הראשון הוא geo: — הכתובת התקנית שכל אפליקציית ניווט
	// רושמת לעצמה, וכשלוחצים עליה מערכת ההפעלה עצמה פותחת את בורר
	// האפליקציות עם מה שבאמת מותקן במכשיר (Waze, גוגל מפות, מוביט...).
	// באייפון ובדסקטופ אין בורר כזה, ולכן מתחתיו יושבים קישורים ישירים:
	// כולם קישורי https "אוניברסליים" שנפתחים באפליקציה כשהיא מותקנת
	// ובאתר כשלא — כך שאף פריט בתפריט אינו מוביל למסך ריק.
	//
	// היעד עצמו: קואורדינטות אם יש (מדויק, בלי פענוח מחדש), ואחרת הכתובת
	// כטקסט חיפוש. אין לא זה ולא זה — אין כפתור, כי אין לאן לנווט.
	// ─────────────────────────────────────────────────────────────
	import { lang, translations } from '$lib/i18n';

	/** @type {{ business: any }} */
	let { business } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const lat = $derived(typeof business?.lat === 'number' ? business.lat : null);
	const lng = $derived(typeof business?.lng === 'number' ? business.lng : null);
	const hasCoords = $derived(lat !== null && lng !== null);

	// שאילתת הכתובת מגובה בעיר רק כשזו לא כבר כתובה בתוכה, שלא ייווצר
	// "רחוב הרצל 5, חולון, חולון" — פענוח כזה מחזיר לפעמים מרכז עיר במקום בית
	const destText = $derived(
		(() => {
			const addr = (business?.address || '').trim();
			const city = (business?.city || '').trim();
			if (!addr) return city;
			return city && !addr.includes(city) ? `${addr}, ${city}` : addr;
		})()
	);
	const label = $derived((business?.name || '').trim() || destText);
	const canNavigate = $derived(hasCoords || !!destText);

	let open = $state(false);
	/** באנדרואיד בלבד יש בורר אפליקציות אמיתי — נבדק בלחיצה, לא ברינדור בשרת */
	let isAndroid = $state(false);
	/** @type {HTMLButtonElement|undefined} */
	let btn = $state();
	let pos = $state({ top: 0, left: 0 });

	const MENU_W = 224; // w-56
	const MENU_H_EST = 200; // להחלטה בלבד: לפתוח מעל הכפתור או מתחתיו

	/** התפריט נצמד לכפתור ונשאר בתוך המסך — הכפתור יושב לרוב בתחתית המפה */
	function place() {
		const r = btn?.getBoundingClientRect();
		if (!r) return;
		const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_W - 8);
		const below = r.bottom + 6;
		const flip = below + MENU_H_EST > window.innerHeight && r.top > MENU_H_EST;
		pos = { top: flip ? Math.max(8, r.top - MENU_H_EST - 6) : below, left };
	}

	function toggle() {
		if (!open) {
			isAndroid = /android/i.test(navigator.userAgent);
			place();
		}
		open = !open;
	}

	function close() {
		open = false;
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

	const APPS = $derived(
		/** @type {{ key: string, label: string, href: string }[]} */ ([
			// בורר האפליקציות של אנדרואיד: הפריט היחיד שבאמת פותח את *כל* מה
			// שמותקן, ולכן הוא בראש ומופרד משאר הרשימה
			isAndroid && {
				key: 'device',
				label: t.navigateDeviceApps,
				href: hasCoords
					? `geo:${lat},${lng}?q=${lat},${lng}(${enc(label)})`
					: `geo:0,0?q=${enc(destText)}`
			},
			{
				key: 'waze',
				label: 'Waze',
				href: hasCoords
					? `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`
					: `https://waze.com/ul?q=${enc(destText)}&navigate=yes`
			},
			{
				key: 'google',
				label: 'Google Maps',
				href: `https://www.google.com/maps/dir/?api=1&destination=${
					hasCoords ? `${lat}%2C${lng}` : enc(destText)
				}`
			},
			// מוביט מנווט לפי נקודה בלבד — בלי קואורדינטות אין לו מה לקבל
			hasCoords && {
				key: 'moovit',
				label: 'Moovit',
				href: `https://moovit.com/?to=${enc(label)}&tll=${lat}_${lng}`
			},
			{
				key: 'apple',
				label: 'Apple Maps',
				href: `https://maps.apple.com/?daddr=${
					hasCoords ? `${lat}%2C${lng}` : enc(destText)
				}&dirflg=d`
			}
		]).filter(Boolean)
	);
</script>

<svelte:window onresize={close} onscroll={close} />

{#if canNavigate}
	<button
		type="button"
		bind:this={btn}
		onclick={toggle}
		aria-haspopup="menu"
		aria-expanded={open}
		class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-500"
	>
		<!-- חץ הניווט המקובל, אותו סימן שנושאות אפליקציות הניווט עצמן -->
		<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path
				d="M21.4 2.6 3.3 9.5c-1.2.5-1.1 2.2.1 2.5l7 2 2 7c.3 1.2 2 1.3 2.5.1l6.9-18.1a1 1 0 0 0-1.4-1.4Z"
			/>
		</svg>
		{t.navigate}
	</button>

	{#if open}
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
