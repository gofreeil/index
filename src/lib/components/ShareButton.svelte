<script>
	// ─────────────────────────────────────────────────────────────
	// ShareButton — שיתוף הקישור לדף העסק.
	//
	// לחיצה פותחת תפריט קטן ובו שתי הדרכים שהמשתמש מצפה להן:
	//   • "שיתוף באפליקציות" — גיליון השיתוף של מערכת ההפעלה
	//     (navigator.share), ומשם כל אפליקציה שמותקנת אצלו. מוצג רק
	//     כשהדפדפן באמת תומך — אחרת זו שורה שלא עושה כלום.
	//   • העתקת הקישור, ולצידה קיצורים לאפליקציות הנפוצות — הגיבוי
	//     לדסקטופ, שבו ברוב הדפדפנים אין גיליון שיתוף בכלל.
	//
	// התפריט הוא position:fixed לפי מיקום הכפתור, ולא absolute: הכרטיסייה
	// בדף הבית היא overflow-hidden, ותפריט רגיל היה נחתך בגבול הכרטיס.
	//
	// הסימן הוא שלוש הנקודות המקובלות (share), בלי מלל — אותו כפתור יושב
	// גם בכרטיסייה הקטנה וגם בראש דף העסק.
	// ─────────────────────────────────────────────────────────────
	import { lang, translations } from '$lib/i18n';
	import { canonical } from '$lib/seo';

	/**
	 * @type {{
	 *   path?: string,
	 *   url?: string,
	 *   title?: string,
	 *   text?: string,
	 *   variant?: 'card' | 'page'
	 * }}
	 */
	let { path = '', url = '', title = '', text = '', variant = 'card' } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	// הקישור תמיד מוחלט ואל הדומיין הקנוני — הוא נשלח לאנשים אחרים, ולכן
	// כתובת יחסית או כתובת של סביבת התצוגה המקדימה חסרת ערך
	const shareUrl = $derived(url || canonical(path));
	const shareTitle = $derived(title || '');
	const shareText = $derived(text || title || '');
	const message = $derived(shareText ? `${shareText}\n${shareUrl}` : shareUrl);

	let open = $state(false);
	let copied = $state(false);
	// גיליון השיתוף של מערכת ההפעלה קיים רק בדפדפן, ולכן הבדיקה נעשית
	// בלחיצה עצמה ולא ברינדור בשרת
	let canNative = $state(false);
	/** @type {HTMLButtonElement|undefined} */
	let btn = $state();
	let pos = $state({ top: 0, left: 0 });

	const MENU_W = 208; // w-52

	/** התפריט נצמד לכפתור, ונשאר בתוך המסך גם בקצה של כרטיס בשוליים */
	function place() {
		const r = btn?.getBoundingClientRect();
		if (!r) return;
		const left = Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8);
		pos = { top: r.bottom + 6, left };
	}

	/** @param {MouseEvent} e */
	function toggle(e) {
		// הכפתור יושב בתוך כרטיס שכולו קישור — בלי זה הלחיצה מנווטת לעסק
		e.preventDefault();
		e.stopPropagation();
		if (!open) {
			canNative = typeof navigator.share === 'function';
			place();
		}
		open = !open;
		copied = false;
	}

	function close() {
		open = false;
	}

	async function shareNative() {
		close();
		try {
			await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
		} catch {
			/* ביטול של המשתמש בגיליון השיתוף — לא שגיאה */
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
		} catch {
			// בלי הרשאת clipboard (http, דפדפן ישן) — בחירה ידנית מתוך שדה זמני
			const el = document.createElement('textarea');
			el.value = shareUrl;
			el.setAttribute('readonly', '');
			el.style.position = 'fixed';
			el.style.opacity = '0';
			document.body.appendChild(el);
			el.select();
			try {
				document.execCommand('copy');
			} catch {
				/* גם זה נכשל — התפריט נשאר פתוח, והקישור עדיין בשאר האפשרויות */
			}
			el.remove();
		}
		copied = true;
		setTimeout(() => {
			copied = false;
			close();
		}, 1200);
	}

	/** @param {string} href */
	function openApp(href) {
		close();
		window.open(href, '_blank', 'noopener,noreferrer');
	}

	const APPS = $derived([
		{
			key: 'whatsapp',
			label: 'WhatsApp',
			href: `https://wa.me/?text=${encodeURIComponent(message)}`
		},
		{
			key: 'telegram',
			label: 'Telegram',
			href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
		},
		{
			key: 'facebook',
			label: 'Facebook',
			href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
		},
		{
			key: 'email',
			label: t.shareEmail,
			href: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(message)}`
		}
	]);

	const btnClass = $derived(
		variant === 'page'
			? 'rounded-full border border-white/15 p-2 text-gray-300 transition hover:border-white/30 hover:text-white'
			: 'rounded-full bg-black/30 p-1.5 text-gray-300 backdrop-blur-sm transition before:absolute before:-inset-2 before:content-[""] hover:bg-black/60 hover:text-white'
	);
	const iconClass = $derived(variant === 'page' ? 'h-5 w-5' : 'h-4 w-4');
</script>

<svelte:window onresize={close} onscroll={close} />

<button
	type="button"
	bind:this={btn}
	onclick={toggle}
	aria-label={t.share}
	aria-haspopup="menu"
	aria-expanded={open}
	class="relative {btnClass}"
>
	<!-- סימן השיתוף המקובל: שלוש נקודות מחוברות, בלי מלל -->
	<svg
		class={iconClass}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="18" cy="5" r="3" />
		<circle cx="6" cy="12" r="3" />
		<circle cx="18" cy="19" r="3" />
		<path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
	</svg>
</button>

{#if open}
	<!-- שכבה שקופה על כל המסך: לחיצה בחוץ סוגרת, וגם בולמת לחיצה שהייתה
	     נופלת על הכרטיס שמתחת -->
	<div
		class="fixed inset-0 z-40"
		role="presentation"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			close();
		}}
	></div>
	<div
		role="menu"
		tabindex="-1"
		dir={t.dir}
		onkeydown={(e) => e.key === 'Escape' && close()}
		style="top:{pos.top}px; left:{pos.left}px; width:{MENU_W}px"
		class="fixed z-50 overflow-hidden rounded-xl border border-white/10 bg-gray-900 py-1 text-start shadow-xl"
	>
		{#if canNative}
			<button
				type="button"
				role="menuitem"
				onclick={shareNative}
				class="block w-full px-3 py-2 text-start text-sm text-gray-100 transition hover:bg-white/10"
			>
				{t.shareApps}
			</button>
		{/if}
		<button
			type="button"
			role="menuitem"
			onclick={copyLink}
			class="block w-full px-3 py-2 text-start text-sm text-gray-100 transition hover:bg-white/10"
		>
			{copied ? t.shareCopied : t.shareCopyLink}
		</button>
		<div class="my-1 border-t border-white/10"></div>
		{#each APPS as app (app.key)}
			<button
				type="button"
				role="menuitem"
				onclick={() => openApp(app.href)}
				class="block w-full px-3 py-2 text-start text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
			>
				{app.label}
			</button>
		{/each}
	</div>
{/if}
