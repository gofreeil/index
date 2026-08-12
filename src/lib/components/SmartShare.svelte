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
	//
	// המסלול המהיר הוא מספר → שליחה, ותו לא: נוסח ההודעה מוסתר מאחורי
	// כפתור עריכה, ושם הנמען נשאל רק אחרי השליחה — כשהוא כבר לא עומד
	// בדרך. הפאנל רק כותב ליומן (shareLog.js) ולא מציג אותו: רשימת מי
	// שקיבל את הכרטיס יושבת במקום אחד בלבד — האזור האישי.
	// ─────────────────────────────────────────────────────────────
	import { tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { lang, translations } from '$lib/i18n';
	import { canonical } from '$lib/seo';
	import { parsePhoneIL } from '$lib/phoneIL.js';
	import { logShare, nameShare } from '$lib/shareLog.js';

	/** @type {{ business: any }} */
	let { business } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/**
	 * הצבת ערכים בתבנית תרגום ({biz}, {phone}…). ערך ריק מוצב כריק —
	 * רק מפתח שלא הועבר כלל נשאר גלוי, כדי שתבנית שבורה תיראה מיד.
	 * @param {string} tpl @param {Record<string,string>} vars
	 */
	const fmt = (tpl, vars) =>
		String(tpl ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

	// ── מצב הפאנל ────────────────────────────────────────────────
	let open = $state(false);
	let phoneRaw = $state('');
	/** @type {'personal'|'benefit'|'plain'} */
	let tone = $state('personal');
	let copied = $state(false);
	let editing = $state(false);
	/** נוסח שנערך ידנית. null = ההודעה האוטומטית, שמתעדכנת לפי הסגנון. */
	let draft = $state(/** @type {string|null} */ (null));

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
	 * של וואטסאפ — הוא מרנדר *טקסט* כמודגש. אין פנייה בשם: שם הנמען לא
	 * ידוע בזמן הכתיבה, כי הוא נשאל רק אחרי השליחה.
	 */
	function buildMessage() {
		const vars = {
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

	const autoMessage = $derived(buildMessage());
	const message = $derived(draft ?? autoMessage);

	/**
	 * בחירת סגנון מבטלת עריכה ידנית — אחרת הכפתורים היו נראים שבורים,
	 * כי הטקסט שעל המסך לא היה משתנה. זו גם הדרך לחזור לנוסח האוטומטי.
	 * @param {'personal'|'benefit'|'plain'} key
	 */
	function pickTone(key) {
		tone = key;
		draft = null;
	}

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

	// ── "למי שלחת?" ──────────────────────────────────────────────
	// השאלה עולה רק אחרי שהקישור נפתח. השורה כבר רשומה ביומן בלי שם,
	// ולכן דילוג על השאלה לא מאבד את השליחה — רק את התווית.
	/** @type {{key:string, pretty:string}|null} */
	let pending = $state(null);
	let pendingName = $state('');
	let savedFlash = $state(false);
	/** @type {HTMLInputElement|undefined} */
	let whoInput = $state();

	/** @param {'wa'|'sms'} channel */
	function send(channel) {
		if (!parsed.ok) return;
		const href =
			channel === 'wa'
				? waLink(parsed.wa, message)
				: `sms:${parsed.e164}?&body=${encodeURIComponent(message)}`;
		const key = logShare({
			bizId: business.documentId,
			bizName: business.name || '',
			wa: parsed.wa,
			e164: parsed.e164,
			pretty: parsed.pretty,
			at: Date.now()
		});
		openLink(href, channel);

		pending = { key, pretty: parsed.pretty };
		pendingName = '';
		savedFlash = false;
		// מתפנים לנמען הבא — הנוסח חוזר לברירת המחדל, המספר מתנקה
		phoneRaw = '';
		editing = false;
		draft = null;
		tick().then(() => whoInput?.focus());
	}

	function saveWho() {
		if (!pending) return;
		nameShare(pending.key, pendingName);
		pending = null;
		pendingName = '';
		savedFlash = true;
		setTimeout(() => (savedFlash = false), 4000);
	}

	function skipWho() {
		pending = null;
		pendingName = '';
	}

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(message);
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			/* בלי הרשאת clipboard — פותחים את העורך, שם אפשר לסמן ולהעתיק ידנית */
			editing = true;
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
	<div class="flex items-center justify-between gap-3">
		<h2 class="shrink-0 text-sm font-semibold text-gray-400">
			{t.smartShare}
			<!-- התווית נופלת ראשונה כשצר: הכפתור והכותרת נשארים באותה שורה. -->
			<span class="mr-2 hidden text-xs font-normal text-gray-600 sm:inline">
				{t.smartShareBadge}
			</span>
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
					<span class="block text-xs text-gray-500">{t.smartShareToneLabel}</span>
					<div class="mt-1.5 inline-flex rounded-lg border border-white/10 p-0.5">
						{#each TONES as [key, label] (key)}
							<button
								type="button"
								onclick={() => pickTone(key)}
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

			<!-- הנוסח מוכן ולרוב אין מה לעשות איתו, ולכן הוא לא תופס מקום על
			     המסך: מי שרוצה לשנות משהו פותח את העורך, וכל השאר פשוט שולחים. -->
			<div class="mt-3 flex flex-wrap items-center gap-4">
				<button
					type="button"
					onclick={() => (editing = !editing)}
					aria-expanded={editing}
					aria-controls="ss-editor"
					class="text-xs text-gray-500 transition hover:text-gray-300"
				>
					{editing ? t.smartShareEditClose : t.smartShareEditBtn}
				</button>
				<button
					type="button"
					onclick={copyMessage}
					class="text-xs text-gray-500 transition hover:text-gray-300"
				>
					{copied ? t.smartShareCopied : t.smartShareCopy}
				</button>
			</div>

			{#if editing}
				<div id="ss-editor" transition:slide={{ duration: 160 }} class="mt-2">
					<label for="ss-text" class="block text-xs text-gray-500">
						{t.smartSharePreviewLabel}
					</label>
					<textarea
						id="ss-text"
						rows="9"
						dir="auto"
						value={message}
						oninput={(e) => (draft = e.currentTarget.value)}
						class="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-6 text-gray-300 transition outline-none focus:border-white/30"
					></textarea>
					{#if draft !== null}
						<button
							type="button"
							onclick={() => (draft = null)}
							class="mt-1 text-xs text-gray-600 transition hover:text-gray-400"
						>
							{t.smartShareResetText}
						</button>
					{/if}
				</div>
			{/if}

			<!-- שאלת השם — אחרי השליחה בלבד, כדי שהיא לא תעמוד בדרך למי
			     שרק רוצה לשלוח ולהמשיך הלאה. -->
			{#if pending}
				<div
					transition:slide={{ duration: 160 }}
					class="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-3"
				>
					<label for="ss-who" class="block text-sm font-medium text-gray-300">
						{t.smartShareAskWho}
					</label>
					<p class="mt-0.5 text-xs text-gray-500">
						{fmt(t.smartShareAskWhoHint, { phone: pending.pretty })}
					</p>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<input
							id="ss-who"
							type="text"
							autocomplete="off"
							bind:this={whoInput}
							bind:value={pendingName}
							onkeydown={(e) => e.key === 'Enter' && saveWho()}
							placeholder={t.smartShareWhoPlaceholder}
							class="min-w-0 flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-gray-100 transition outline-none placeholder:text-gray-600 focus:border-white/30"
						/>
						<button
							type="button"
							onclick={saveWho}
							disabled={!pendingName.trim()}
							class="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
						>
							{t.smartShareSaveWho}
						</button>
						<button
							type="button"
							onclick={skipWho}
							class="text-xs text-gray-500 transition hover:text-gray-300"
						>
							{t.smartShareSkipWho}
						</button>
					</div>
				</div>
			{:else if savedFlash}
				<p transition:slide={{ duration: 160 }} class="mt-5 text-xs text-emerald-400">
					{t.smartShareSavedWho}
					<a href="/profile" class="text-gray-500 underline-offset-4 hover:underline">
						{t.smartShareSavedLink}
					</a>
				</p>
			{/if}
		</div>
	{/if}
</section>
