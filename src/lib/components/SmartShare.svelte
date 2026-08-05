<script>
	// ─────────────────────────────────────────────────────────────
	// שיתוף חכם — שליחת כרטיס העסק לטלפון של מכר.
	//
	// הרכיב מוצג אך ורק לבעל הכרטיסייה: ההחלטה נופלת בשרת
	// (business/[id]/+page.server.js → data.canSmartShare), כי מפתחות
	// הבעלות לא נשלחים ללקוח ואי אפשר לזייף את ההרשאה מהדפדפן.
	//
	// אין באתר ספק SMS, ולכן השליחה עצמה נעשית דרך קישור עמוק: wa.me עם
	// ההודעה מוכנה, או sms: כגיבוי. בעל העסק מקליד מספר ולוחץ פעם אחת —
	// אפליקציית הוואטסאפ נפתחת עם השיחה והטקסט מוכנים.
	// ─────────────────────────────────────────────────────────────
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { lang, translations } from '$lib/i18n';
	import { canonical } from '$lib/seo';
	import { parsePhoneIL } from '$lib/phoneIL.js';

	/** @type {{ business: any }} */
	let { business } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/**
	 * הצבת ערכים בתבנית תרגום ({who}, {biz}…). ערך ריק מוצב כריק —
	 * רק מפתח שלא הועבר כלל נשאר גלוי, כדי שתבנית שבורה תיראה מיד.
	 * @param {string} tpl @param {Record<string,string>} vars
	 */
	const fmt = (tpl, vars) =>
		String(tpl ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

	// ── מצב הפאנל ────────────────────────────────────────────────
	let open = $state(false);
	let phoneRaw = $state('');
	let recipient = $state('');
	/** @type {'personal'|'benefit'|'plain'} */
	let tone = $state('personal');
	let copied = $state(false);

	const parsed = $derived(parsePhoneIL(phoneRaw));
	const touched = $derived(phoneRaw.trim().length > 0);
	const errorLabel = $derived(
		!touched || parsed.ok
			? ''
			: parsed.error === 'landline'
				? t.smartShareErrLandline
				: parsed.error === 'short'
					? t.smartShareErrShort
					: t.smartShareErrInvalid
	);

	// ── זיכרון הנמענים ───────────────────────────────────────────
	// מי שמפיץ את הכרטיס עושה זאת בסבב של כמה אנשים ברצף. הרשימה
	// חוסכת הקלדה חוזרת ומראה למי כבר נשלח. מקומית בלבד (localStorage) —
	// מספרי טלפון של צד שלישי לא נשמרים בשרת.
	const MAX_RECENT = 8;
	const storageKey = $derived(`idx-smart-share:${business.documentId}`);
	/** @type {{wa:string,e164:string,pretty:string,name:string,at:number}[]} */
	let recent = $state([]);

	onMount(() => {
		try {
			const arr = JSON.parse(localStorage.getItem(storageKey) || '[]');
			if (Array.isArray(arr)) recent = arr.filter((r) => r?.wa).slice(0, MAX_RECENT);
		} catch {
			/* אחסון חסום או תוכן פגום — הרשימה פשוט מתחילה ריקה */
		}
	});

	function persist() {
		try {
			localStorage.setItem(storageKey, JSON.stringify(recent));
		} catch {
			/* גלישה פרטית / אחסון מלא — השליחה כבר קרתה, אין על מה להתריע */
		}
	}

	/** @param {{wa:string,e164:string,pretty:string,name:string,at:number}} entry */
	function remember(entry) {
		recent = [entry, ...recent.filter((r) => r.wa !== entry.wa)].slice(0, MAX_RECENT);
		persist();
	}

	function forgetAll() {
		recent = [];
		persist();
	}

	// ── ההודעה ───────────────────────────────────────────────────
	const bizArea = $derived(business.address || business.city || business.sales_area || '');
	const shortDesc = $derived(
		String(business.description || business.unique_content || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 140)
	);
	const bizUrl = $derived(canonical(`/business/${business.documentId}`));

	/**
	 * ההודעה המלאה, לפי הסגנון שנבחר. הכוכביות סביב שם העסק הן הדגשה
	 * של וואטסאפ — הוא מרנדר *טקסט* כמודגש.
	 * @param {string} who שם הנמען, אם הוקלד
	 */
	function buildMessage(who) {
		const vars = {
			who,
			biz: business.name || '',
			category: business.category || '',
			discount: business.discount || '',
			phone: business.phone || '',
			area: bizArea
		};
		/** @param {string} key */
		const line = (key) => fmt(t[key], vars);

		/** @type {string[]} */
		const lines = [];
		if (who) lines.push(line('shareMsgGreeting'));

		// בלי קטגוריה התבניות נופלות ל"— ." ריק, ולכן נשארים עם השם בלבד.
		let headline = `*${vars.biz}*`;
		if (business.category) {
			if (tone === 'plain') headline = line('shareMsgPlain');
			else if (tone === 'benefit' && business.discount) headline = line('shareMsgBenefitLead');
			else headline = line('shareMsgPersonal');
		}
		lines.push(headline);

		if (tone === 'personal' && shortDesc) lines.push(shortDesc);
		if (business.discount && tone !== 'plain') lines.push(line('shareMsgBenefitLine'));
		if (bizArea) lines.push(line('shareMsgAreaLine'));
		if (business.phone) lines.push(line('shareMsgPhoneLine'));

		lines.push('', line('shareMsgLinkLead'), bizUrl, '', line('shareMsgFooter'));
		return lines.join('\n');
	}

	const message = $derived(buildMessage(recipient.trim()));

	/** @param {string} wa @param {string} text */
	const waLink = (wa, text) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;

	/**
	 * פתיחת היעד. sms: הוא סכימת-פרוטוקול ש-window.open נחסם עליה בחלק
	 * מהדפדפנים — ולכן ניווט ישיר; wa.me הוא עמוד רגיל ונפתח בלשונית
	 * נפרדת, כדי שדף העסק לא יאבד באמצע סבב שליחות.
	 * @param {string} href @param {'wa'|'sms'} channel
	 */
	function openLink(href, channel) {
		if (channel === 'sms') window.location.href = href;
		else window.open(href, '_blank', 'noopener,noreferrer');
	}

	/** @param {'wa'|'sms'} channel */
	function send(channel) {
		if (!parsed.ok) return;
		const href =
			channel === 'wa'
				? waLink(parsed.wa, message)
				: `sms:${parsed.e164}?&body=${encodeURIComponent(message)}`;
		remember({
			wa: parsed.wa,
			e164: parsed.e164,
			pretty: parsed.pretty,
			name: recipient.trim(),
			at: Date.now()
		});
		openLink(href, channel);
		// מתפנים לנמען הבא — המספר שנשלח כבר מופיע ברשימת "נשלח לאחרונה"
		phoneRaw = '';
		recipient = '';
	}

	/** @param {{wa:string,e164:string,pretty:string,name:string,at:number}} entry */
	function resend(entry) {
		openLink(waLink(entry.wa, buildMessage(entry.name || '')), 'wa');
		remember({ ...entry, at: Date.now() });
	}

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(message);
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			/* בלי הרשאת clipboard — התצוגה המקדימה עדיין ניתנת לסימון והעתקה ידנית */
		}
	}

	const TONES = /** @type {const} */ ([
		['personal', 'smartShareTonePersonal'],
		['benefit', 'smartShareToneBenefit'],
		['plain', 'smartShareTonePlain']
	]);
</script>

<!-- כלי של בעל העסק בסוף דף הכרטיסייה: במצב סגור הוא שורה אחת שקטה, כדי
     שלא יתחרה בתוכן שהמבקר בא בשבילו. כל המשקל הוויזואלי נשמר לכפתור אחד. -->
<section dir={t.dir} class="mt-10 border-t border-white/[0.08] pt-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-sm font-semibold text-gray-400">
			{t.smartShare}
			<span class="mr-2 text-xs font-normal text-gray-600">{t.smartShareBadge}</span>
		</h2>
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls="smart-share-panel"
			class="rounded-lg border border-white/15 px-3.5 py-1.5 text-sm font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
		>
			{open ? t.smartShareCloseBtn : t.smartShareOpenBtn}
		</button>
	</div>

	{#if open}
		<div id="smart-share-panel" transition:slide={{ duration: 200 }} class="mt-5 max-w-xl">
			<p class="text-sm leading-6 text-gray-500">{t.smartShareLead}</p>

			<div class="mt-5 space-y-4">
				<div>
					<label for="ss-phone" class="block text-xs text-gray-500">
						{t.smartSharePhoneLabel}
					</label>
					<input
						id="ss-phone"
						type="tel"
						inputmode="tel"
						autocomplete="off"
						dir="ltr"
						bind:value={phoneRaw}
						placeholder="050-123-4567"
						aria-invalid={!!errorLabel}
						aria-describedby="ss-phone-status"
						class="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 tracking-wide text-gray-100 transition outline-none placeholder:text-gray-600 {errorLabel
							? 'border-red-500/50 focus:border-red-500'
							: parsed.ok
								? 'border-emerald-500/50 focus:border-emerald-400'
								: 'border-white/10 focus:border-white/30'}"
					/>
					<p id="ss-phone-status" class="mt-1 min-h-[1rem] text-xs">
						{#if errorLabel}
							<span class="text-red-400">{errorLabel}</span>
						{:else if parsed.ok}
							<span class="text-emerald-400">
								{t.smartShareTarget}
								<span dir="ltr">{parsed.pretty}</span>
							</span>
						{:else}
							<span class="text-gray-600">{t.smartSharePhoneHint}</span>
						{/if}
					</p>
				</div>

				<div>
					<label for="ss-who" class="block text-xs text-gray-500">{t.smartShareWhoLabel}</label>
					<input
						id="ss-who"
						type="text"
						autocomplete="off"
						bind:value={recipient}
						placeholder={t.smartShareWhoPlaceholder}
						class="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-gray-100 transition outline-none placeholder:text-gray-600 focus:border-white/30"
					/>
				</div>

				<div>
					<span class="block text-xs text-gray-500">{t.smartShareToneLabel}</span>
					<div class="mt-1.5 inline-flex rounded-lg border border-white/10 p-0.5">
						{#each TONES as [key, label] (key)}
							<button
								type="button"
								onclick={() => (tone = key)}
								aria-pressed={tone === key}
								class="rounded-md px-3 py-1 text-xs font-medium transition {tone === key
									? 'bg-white/10 text-gray-100'
									: 'text-gray-500 hover:text-gray-300'}"
							>
								{t[label]}
							</button>
						{/each}
					</div>
				</div>

				<!-- תצוגה מקדימה — הסיבה היחידה שהיא כאן היא שכפתורי הסגנון
				     חסרי משמעות בלי לראות מה משתנה. לכן: שקטה וקומפקטית. -->
				<div>
					<div class="flex items-baseline justify-between gap-3">
						<span class="text-xs text-gray-500">{t.smartSharePreviewLabel}</span>
						<button
							type="button"
							onclick={copyMessage}
							class="text-xs text-gray-500 transition hover:text-gray-300"
						>
							{copied ? t.smartShareCopied : t.smartShareCopy}
						</button>
					</div>
					<pre
						class="mt-1.5 max-h-40 overflow-y-auto rounded-lg bg-white/[0.03] p-3 text-xs leading-6 break-words whitespace-pre-wrap text-gray-400"
						dir="auto">{message}</pre>
				</div>
			</div>

			<div class="mt-5 flex flex-wrap items-center gap-4">
				<button
					type="button"
					onclick={() => send('wa')}
					disabled={!parsed.ok}
					class="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
				>
					{t.smartShareSendWa}
				</button>
				<button
					type="button"
					onclick={() => send('sms')}
					disabled={!parsed.ok}
					class="text-sm text-gray-400 underline-offset-4 transition hover:text-gray-200 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
				>
					{t.smartShareSendSms}
				</button>
			</div>

			{#if recent.length > 0}
				<div class="mt-6">
					<div class="flex items-baseline justify-between gap-3">
						<span class="text-xs text-gray-500">
							{t.smartShareRecent} ({recent.length})
						</span>
						<button
							type="button"
							onclick={forgetAll}
							class="text-xs text-gray-600 transition hover:text-gray-400"
						>
							{t.smartShareForget}
						</button>
					</div>
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each recent as entry (entry.wa)}
							<button
								type="button"
								onclick={() => resend(entry)}
								title={t.smartShareResend}
								class="rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-400 transition hover:border-white/25 hover:text-gray-200"
							>
								<span aria-hidden="true">↻</span>
								<span>{entry.name || entry.pretty}</span>
								{#if entry.name}<span class="text-gray-600" dir="ltr">{entry.pretty}</span>{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</section>
