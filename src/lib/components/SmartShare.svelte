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

<section
	dir={t.dir}
	class="mb-10 overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/25 via-gray-900 to-gray-900 shadow-xl"
>
	<div class="flex flex-wrap items-center justify-between gap-4 p-6">
		<div class="min-w-0">
			<div class="mb-1 flex items-center gap-2">
				<span class="text-2xl" aria-hidden="true">🚀</span>
				<h2 class="text-xl font-bold text-emerald-300">{t.smartShare}</h2>
				<span
					class="rounded-full border border-emerald-500/30 bg-emerald-900/40 px-2 py-0.5 text-[11px] font-bold text-emerald-200"
				>
					{t.smartShareBadge}
				</span>
			</div>
			<p class="max-w-xl text-sm leading-relaxed text-gray-400">{t.smartShareLead}</p>
		</div>

		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls="smart-share-panel"
			class="flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-lg transition hover:bg-emerald-500 active:scale-95"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 10h11M9 21V3m10 6l3 3-3 3"
				/>
			</svg>
			<span>{open ? t.smartShareCloseBtn : t.smartShareOpenBtn}</span>
		</button>
	</div>

	{#if open}
		<div
			id="smart-share-panel"
			transition:slide={{ duration: 200 }}
			class="border-t border-emerald-500/20 p-6"
		>
			<div class="grid gap-6 lg:grid-cols-2">
				<!-- ימין: מי מקבל ואיך זה נשמע -->
				<div class="space-y-4">
					<div>
						<label for="ss-phone" class="mb-1 block text-sm font-medium text-gray-300">
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
							class="w-full rounded-xl border bg-gray-800 px-4 py-3 text-lg tracking-wide text-gray-100 transition outline-none {errorLabel
								? 'border-red-500/60 focus:border-red-500'
								: parsed.ok
									? 'border-emerald-500/60 focus:border-emerald-400'
									: 'border-gray-600 focus:border-emerald-500'}"
						/>
						<p id="ss-phone-status" class="mt-1.5 min-h-[1.25rem] text-xs">
							{#if errorLabel}
								<span class="font-medium text-red-400">{errorLabel}</span>
							{:else if parsed.ok}
								<span class="font-medium text-emerald-400">
									{t.smartShareTarget}
									<span dir="ltr">{parsed.pretty}</span>
								</span>
							{:else}
								<span class="text-gray-500">{t.smartSharePhoneHint}</span>
							{/if}
						</p>
					</div>

					<div>
						<label for="ss-who" class="mb-1 block text-sm font-medium text-gray-300">
							{t.smartShareWhoLabel}
						</label>
						<input
							id="ss-who"
							type="text"
							autocomplete="off"
							bind:value={recipient}
							placeholder={t.smartShareWhoPlaceholder}
							class="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-2.5 text-gray-100 transition outline-none focus:border-emerald-500"
						/>
					</div>

					<div>
						<span class="mb-2 block text-sm font-medium text-gray-300">{t.smartShareToneLabel}</span
						>
						<div class="flex flex-wrap gap-2">
							{#each TONES as [key, label] (key)}
								<button
									type="button"
									onclick={() => (tone = key)}
									aria-pressed={tone === key}
									class="rounded-full border px-4 py-1.5 text-sm font-medium transition {tone ===
									key
										? 'border-emerald-400 bg-emerald-600/20 text-emerald-200'
										: 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200'}"
								>
									{t[label]}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- שמאל: איך ההודעה תיראה אצל המכר -->
				<div class="flex flex-col">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-medium text-gray-300">{t.smartSharePreviewLabel}</span>
						<button
							type="button"
							onclick={copyMessage}
							class="text-xs font-bold text-emerald-400 transition hover:text-emerald-300"
						>
							{copied ? t.smartShareCopied : t.smartShareCopy}
						</button>
					</div>
					<div class="flex-1 rounded-2xl bg-gray-800/60 p-3">
						<pre
							class="max-h-64 overflow-y-auto rounded-xl bg-emerald-950/60 p-4 text-right text-sm leading-relaxed break-words whitespace-pre-wrap text-gray-200"
							dir="auto">{message}</pre>
					</div>
				</div>
			</div>

			<!-- שליחה -->
			<div class="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					onclick={() => send('wa')}
					disabled={!parsed.ok}
					class="flex items-center gap-2 rounded-full bg-green-600 px-8 py-3 font-bold text-white shadow-lg transition hover:bg-green-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-green-600"
				>
					<span aria-hidden="true">💬</span>
					<span>{t.smartShareSendWa}</span>
				</button>
				<button
					type="button"
					onclick={() => send('sms')}
					disabled={!parsed.ok}
					class="flex items-center gap-2 rounded-full border border-gray-600 px-6 py-3 font-bold text-gray-300 transition hover:border-gray-400 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<span aria-hidden="true">✉️</span>
					<span>{t.smartShareSendSms}</span>
				</button>
			</div>

			{#if recent.length > 0}
				<div class="mt-6 border-t border-gray-700/60 pt-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-medium text-gray-400">
							{t.smartShareRecent} ({recent.length})
						</span>
						<button
							type="button"
							onclick={forgetAll}
							class="text-xs text-gray-500 transition hover:text-gray-300"
						>
							{t.smartShareForget}
						</button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each recent as entry (entry.wa)}
							<button
								type="button"
								onclick={() => resend(entry)}
								title={t.smartShareResend}
								class="flex items-center gap-2 rounded-full border border-gray-600 bg-gray-800/70 px-3 py-1.5 text-xs text-gray-300 transition hover:border-green-500/60 hover:text-white"
							>
								<span aria-hidden="true">↻</span>
								<span>{entry.name || entry.pretty}</span>
								{#if entry.name}<span class="text-gray-500" dir="ltr">{entry.pretty}</span>{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</section>
