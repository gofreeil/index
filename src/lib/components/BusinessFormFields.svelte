<script>
	// שדות טופס עריכת כרטיסייה — משותפים לבעל העסק (/business/[id]/edit)
	// ולפאנל הניהול (/admin/business/[id]). הרכיב מרנדר שדות בלבד, בלי
	// <form> ובלי כפתור שמירה: כל מסך עוטף אותו ב-action משלו.
	//
	// canModerate מוסיף את שדות הניהול (סטטוס). הוא רק מסתיר
	// אותם — האכיפה עצמה בשרת (ראו $lib/server/businessEdit.js).
	import { mediaUrl } from '$lib/businessShape.js';
	import { CATEGORIES } from '$lib/categories.js';
	import { MAX_BRANCHES, parseBranches } from '$lib/branches.js';
	import { LINK_FIELDS, parseExtraLinks } from '$lib/socialLinks.js';
	import ImageDropField from '$lib/components/ImageDropField.svelte';
	import ImageFitEditor from '$lib/components/ImageFitEditor.svelte';
	import {
		parseFit,
		parseFitList,
		parseLogoShape,
		parseMainIndex,
		DEFAULT_FIT
	} from '$lib/mediaFit.js';

	/** @type {{ biz: any, errors?: Record<string,string>, canModerate?: boolean, categories?: Array<{value:string,label:string}> | null }} */
	let { biz, errors = {}, canModerate = false, categories = null } = $props();

	// הרשימה מהשרת כוללת את דריסות הסופר-אדמין (שמות וקטגוריות שנוספו);
	// בלי פרופ נופלים לרשימה הסטטית. קטגוריה ישנה שאינה ברשימה עדיין
	// מוצגת כאופציה כדי לא לאבד אותה.
	const categoryOptions = $derived.by(() => {
		const base =
			Array.isArray(categories) && categories.length
				? categories
				: CATEGORIES.map((c) => ({ value: c, label: c }));
		return biz.category && !base.some((o) => o.value === biz.category)
			? [{ value: biz.category, label: biz.category }, ...base]
			: base;
	});

	const banners = $derived(Array.isArray(biz.banners) ? biz.banners : []);
	// לאוסף אין עמודת email — אימייל הבעלים יושב ב-extra_fields
	const ownerEmail = $derived(biz.extra_fields?.owner_email ?? '');

	// טיקטוק, X, לינקדאין ו"נוסף" יושבים ב-extra_fields.links ולא בעמודה
	// משלהם, ולכן הערך שלהם נשלף משם ולא מ-biz הישר (ראו socialLinks.js).
	const links = $derived(parseExtraLinks(biz.extra_fields?.links));
	const linkValue = (/** @type {string} */ k) => links[k] ?? biz[k] ?? '';

	// סניפים ומקומות שירות נוספים — באותה עמודת json, ונשלחים כ-JSON בשדה
	// מוסתר אחד (ראו branches.js). לשדות שעל המסך אין name: הם רק ממשק.
	let branches = $state(parseBranches(biz.extra_fields?.branches));
	const branchesJson = $derived(JSON.stringify(branches));

	function addBranch() {
		if (branches.length >= MAX_BRANCHES) return;
		branches = [...branches, { city: '', neighborhood: '', address: '' }];
	}

	/** @param {number} i */
	function removeBranch(i) {
		branches = branches.filter((_, idx) => idx !== i);
	}

	// ── מיקום וזום של הלוגו והתמונות ──
	// העורך עובד על מה שרואים: קובץ חדש שנבחר גובר על התמונה השמורה.
	// הערכים נוסעים כ-JSON בשדה מוסתר אחד ונשמרים ב-extra_fields.media_fit.

	/** רשימת fit באורך שמכסה את כל התמונות שיוצגו.
	 * @param {{x:number,y:number,z:number}[]} list @param {number} n */
	function padFits(list, n) {
		return Array.from(
			{ length: Math.max(n, list.length) },
			(_, i) => list[i] ?? { ...DEFAULT_FIT }
		);
	}

	let logoFit = $state(parseFit(biz.extra_fields?.media_fit?.logo));
	// תמונה שאין לה עדיין fit שמור מקבלת ברירת מחדל כבר כאן, ולא ב-$effect
	// בלבד: אפקטים אינם רצים ב-SSR, וכרטיסייה עם תמונות שמעולם לא מוקמו
	// הגיעה לעורך עם fit=undefined והפילה את הדף (500) לפני ההידרציה.
	let bannerFits = $state(
		padFits(parseFitList(biz.extra_fields?.media_fit?.banners), banners.length)
	);
	// מסגרת הלוגו בכרטיסייה — ריבוע מעוגל או עיגול, נוסע באותו json
	let logoShape = $state(parseLogoShape(biz.extra_fields?.media_fit?.logo_shape));
	// התמונה הראשית — הבאנר של האריח בדף הבית ופתיחת הגלריה בכרטיסייה
	let mainIndex = $state(parseMainIndex(biz.extra_fields?.media_fit?.main));
	/** @type {{name: string, url: string}[]} */
	let logoPicked = $state([]);
	/** @type {{name: string, url: string}[]} */
	let bannersPicked = $state([]);

	const logoPreview = $derived(logoPicked[0]?.url || mediaUrl(biz.logo));
	/** @type {string[]} */
	const bannerPreviews = $derived(
		bannersPicked.length
			? bannersPicked.map((p) => p.url)
			: banners.map((/** @type {any} */ b) => mediaUrl(b)).filter(Boolean)
	);

	// ובצד הלקוח — בחירת קבצים חדשים מוסיפה תצוגות מקדימות מעבר לרשימה
	$effect(() => {
		if (bannerPreviews.length > bannerFits.length) {
			bannerFits = padFits(bannerFits, bannerPreviews.length);
		}
	});

	const mediaFitJson = $derived(
		JSON.stringify({
			logo: logoFit,
			banners: bannerFits.slice(0, bannerPreviews.length),
			logo_shape: logoShape,
			// תמונה ראשית שכבר לא קיימת (הועלו תמונות חדשות) חוזרת לראשונה
			main: mainIndex < bannerPreviews.length ? mainIndex : 0
		})
	);

	const INPUT =
		'w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:outline-none';
	const LABEL = 'mb-1.5 block text-sm font-bold text-gray-300';
	const SECTION = 'rounded-2xl border border-gray-800 bg-gray-900/40 p-5';

	/** @param {string} k */
	const err = (k) => errors?.[k] ?? '';
</script>

<!-- פרטי העסק -->
<section class={SECTION}>
	<h2 class="mb-4 font-bold text-gray-200">פרטי העסק</h2>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<label class={LABEL} for="f-name">שם העסק *</label>
			<input id="f-name" name="name" value={biz.name ?? ''} class={INPUT} required />
			{#if err('name')}<p class="mt-1 text-xs text-red-400">{err('name')}</p>{/if}
		</div>
		{#if canModerate}
			<div>
				<label class={LABEL} for="f-status">סטטוס</label>
				<select id="f-status" name="status" value={biz.status ?? 'pending'} class={INPUT}>
					<option value="pending">ממתין</option>
					<option value="approved">מאושר</option>
					<option value="frozen">מוקפא (מוסר מהאתר)</option>
					<option value="rejected">נדחה</option>
				</select>
				{#if err('status')}<p class="mt-1 text-xs text-red-400">{err('status')}</p>{/if}
			</div>
		{/if}
		<div>
			<label class={LABEL} for="f-category">קטגוריה</label>
			<select id="f-category" name="category" value={biz.category ?? ''} class={INPUT}>
				<option value="">— ללא —</option>
				{#each categoryOptions as c (c.value)}
					<option value={c.value}>{c.label}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class={LABEL} for="f-subcategory">תת-קטגוריה / פירוט</label>
			<input id="f-subcategory" name="subcategory" value={biz.subcategory ?? ''} class={INPUT} />
		</div>
		<div class="sm:col-span-2">
			<label class={LABEL} for="f-description">תיאור קצר</label>
			<textarea
				id="f-description"
				name="description"
				rows="3"
				class={INPUT}
				value={biz.description ?? ''}
			></textarea>
		</div>
		<div class="sm:col-span-2">
			<label class={LABEL} for="f-unique">תוכן ייחודי (מוצג בעמוד העסק)</label>
			<textarea
				id="f-unique"
				name="unique_content"
				rows="4"
				class={INPUT}
				value={biz.unique_content ?? ''}
			></textarea>
		</div>
		<div class="sm:col-span-2">
			<label class={LABEL} for="f-discount">🎁 ההטבה הבלעדית לחברי הקהילה</label>
			<input id="f-discount" name="discount" value={biz.discount ?? ''} class={INPUT} />
		</div>
	</div>
</section>

<!-- יצירת קשר -->
<section class={SECTION}>
	<h2 class="mb-4 font-bold text-gray-200">יצירת קשר</h2>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<label class={LABEL} for="f-contact">שם איש קשר</label>
			<input id="f-contact" name="contact_name" value={biz.contact_name ?? ''} class={INPUT} />
		</div>
		<div>
			<label class={LABEL} for="f-phone">טלפון</label>
			<input id="f-phone" name="phone" dir="ltr" value={biz.phone ?? ''} class={INPUT} />
		</div>
		<div class="sm:col-span-2">
			<label class={LABEL} for="f-email">אימייל בעל העסק</label>
			<input id="f-email" name="email" type="email" dir="ltr" value={ownerEmail} class={INPUT} />
			<p class="mt-1 text-xs text-gray-500">
				לא מוצג באתר. משמש לזיהוי בעל הכרטיסייה כשהוא נרשם למערכת.
			</p>
			{#if err('email')}<p class="mt-1 text-xs text-red-400">{err('email')}</p>{/if}
		</div>
	</div>
</section>

<!-- מיקום -->
<section class={SECTION}>
	<h2 class="mb-4 font-bold text-gray-200">מיקום</h2>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="sm:col-span-2">
			<label class={LABEL} for="f-address">כתובת מלאה</label>
			<input id="f-address" name="address" value={biz.address ?? ''} class={INPUT} />
		</div>
		<div>
			<label class={LABEL} for="f-city">עיר</label>
			<input id="f-city" name="city" value={biz.city ?? ''} class={INPUT} />
		</div>
		<div>
			<label class={LABEL} for="f-neighborhood">שכונה</label>
			<input id="f-neighborhood" name="neighborhood" value={biz.neighborhood ?? ''} class={INPUT} />
		</div>
		<div class="sm:col-span-2">
			<label class={LABEL} for="f-sales">אזור מכירה / שירות</label>
			<input id="f-sales" name="sales_area" value={biz.sales_area ?? ''} class={INPUT} />
		</div>

		<!-- מקומות נוספים: סניף שני, מחסן, קליניקה בעיר אחרת -->
		<div class="rounded-xl border border-dashed border-gray-700 p-4 sm:col-span-2">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<span class="text-sm font-bold text-gray-300">סניפים ומקומות שירות נוספים</span>
					<p class="mt-0.5 text-xs text-gray-500">כל מקום שיתווסף יופיע גם הוא על המפה.</p>
				</div>
				<button
					type="button"
					onclick={addBranch}
					disabled={branches.length >= MAX_BRANCHES}
					class="shrink-0 rounded-full border border-blue-500/40 bg-blue-600/10 px-4 py-1.5 text-sm font-bold text-blue-300 transition hover:bg-blue-600/20 disabled:opacity-40"
				>
					＋ הוספת מקום
				</button>
			</div>

			{#each branches as branch, i (branch)}
				<div class="mt-3 rounded-lg border border-gray-700 bg-gray-900/60 p-3">
					<div class="mb-2 flex items-center justify-between gap-2">
						<span class="text-xs font-bold text-gray-400">מקום נוסף {i + 1}</span>
						<button
							type="button"
							onclick={() => removeBranch(i)}
							class="text-xs font-bold text-red-400 transition hover:text-red-300">הסרה</button
						>
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<input
							bind:value={branch.city}
							placeholder="עיר"
							aria-label="עיר — מקום נוסף {i + 1}"
							class={INPUT}
						/>
						<input
							bind:value={branch.neighborhood}
							placeholder="שכונה"
							aria-label="שכונה — מקום נוסף {i + 1}"
							class={INPUT}
						/>
						<input
							bind:value={branch.address}
							placeholder="כתובת מלאה"
							aria-label="כתובת — מקום נוסף {i + 1}"
							class={INPUT}
						/>
					</div>
				</div>
			{/each}

			<input type="hidden" name="branches" value={branchesJson} />
		</div>
	</div>
</section>

<!-- מדיה — מיד אחרי המיקום, כי התמונה היא הדבר הראשון שרואים בכרטיסייה -->
<section class={SECTION}>
	<h2 class="mb-4 font-bold text-gray-200">מדיה</h2>
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		<div>
			<span class={LABEL} id="lbl-logo">לוגו</span>
			{#if mediaUrl(biz.logo)}
				<img
					src={mediaUrl(biz.logo)}
					alt="לוגו נוכחי"
					class="mb-2 h-20 w-20 rounded-xl object-cover"
				/>
				<label class="mb-2 flex items-center gap-2 text-xs text-gray-400">
					<input type="checkbox" name="remove_logo" class="accent-red-500" /> הסר את הלוגו הנוכחי
				</label>
			{:else}
				<p class="mb-2 text-xs text-gray-600">אין לוגו</p>
			{/if}
			<ImageDropField
				name="logo"
				labelledBy="lbl-logo"
				hint="קובץ תמונה עד 3MB"
				bind:previews={logoPicked}
			/>
			<!-- מסגרת הלוגו: הבחירה משנה מיד את התצוגה המקדימה שמעליה, כדי
			     שהבחירה תיעשה על מה שרואים ולא על תיאור -->
			<div class="mt-3 flex items-center gap-2 text-xs">
				<span class="text-gray-400">מסגרת הלוגו:</span>
				{#each [['square', 'מרובע'], ['circle', 'עגול']] as [value, label] (value)}
					<button
						type="button"
						onclick={() => (logoShape = /** @type {any} */ (value))}
						aria-pressed={logoShape === value}
						class="rounded-lg border px-3 py-1 font-bold transition {logoShape === value
							? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
							: 'border-gray-700 text-gray-400 hover:border-gray-500'}"
					>
						{label}
					</button>
				{/each}
			</div>
			{#if logoPreview}
				<div class="mt-3">
					<ImageFitEditor
						src={logoPreview}
						bind:fit={logoFit}
						aspect="square"
						mode="contain"
						label="לוגו"
						round={logoShape === 'circle'}
					/>
				</div>
			{/if}
			{#if err('logo')}<p class="mt-1 text-xs text-red-400">{err('logo')}</p>{/if}
		</div>
		<div>
			<span class={LABEL} id="lbl-banners">תמונות העסק (עד 4 — העלאה חדשה מחליפה את כולן)</span>
			{#if banners.length}
				<div class="mb-2 flex flex-wrap gap-2">
					{#each banners as b, i (b?.id ?? i)}
						<img src={mediaUrl(b)} alt="" class="h-16 w-24 rounded-lg object-cover" />
					{/each}
				</div>
				<label class="mb-2 flex items-center gap-2 text-xs text-gray-400">
					<input type="checkbox" name="remove_banners" class="accent-red-500" /> הסר את כל התמונות
				</label>
			{:else}
				<p class="mb-2 text-xs text-gray-600">אין תמונות</p>
			{/if}
			<ImageDropField
				name="banners"
				labelledBy="lbl-banners"
				multiple
				max={4}
				hint="עד 4 תמונות, כל אחת עד 3MB"
				bind:previews={bannersPicked}
			/>
			{#each bannerPreviews as url, i (url)}
				<div class="mt-3">
					<div class="mb-1 flex flex-wrap items-center gap-2 text-xs">
						<span class="font-bold text-gray-400">תמונה {i + 1}</span>
						<!-- התמונה הראשית: זו שתופיע כבאנר באריח שבדף הבית, תיפתח
						     ראשונה בגלריה ותישלח בשיתוף -->
						{#if mainIndex === i}
							<span
								class="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-300"
								>★ ראשית</span
							>
						{:else}
							<button
								type="button"
								onclick={() => (mainIndex = i)}
								class="rounded-full border border-gray-700 px-2 py-0.5 font-bold text-gray-400 transition hover:border-amber-500/50 hover:text-amber-300"
							>
								☆ הפוך לראשית
							</button>
						{/if}
					</div>
					<ImageFitEditor src={url} bind:fit={bannerFits[i]} aspect="wide" label="תמונה {i + 1}" />
				</div>
			{/each}
			{#if bannerPreviews.length > 1}
				<p class="mt-2 text-xs text-gray-500">
					התמונה הראשית היא שמופיעה באריח של העסק בדף הבית ובשיתוף.
				</p>
			{/if}
			{#if err('banners')}<p class="mt-1 text-xs text-red-400">{err('banners')}</p>{/if}
		</div>
		<!-- סרטון התדמית הוא נגן מוטמע בכרטיסייה, ולכן שדה משלו ולא שורה
		     ברשימת הקישורים — שם יושב ערוץ היוטיוב -->
		<div class="sm:col-span-2">
			<label class={LABEL} for="f-video">סרטון תדמית (קישור ליוטיוב)</label>
			<input
				id="f-video"
				name="video"
				dir="ltr"
				placeholder="https://youtube.com/watch?v=…"
				value={linkValue('video')}
				class={INPUT}
			/>
			<p class="mt-1 text-xs text-gray-500">מוטמע כנגן בכרטיסייה. ערוץ היוטיוב הוא שדה נפרד.</p>
			{#if err('video')}<p class="mt-1 text-xs text-red-400">{err('video')}</p>{/if}
		</div>
		<input type="hidden" name="media_fit" value={mediaFitJson} />
	</div>
</section>

<!-- קישורים -->
<section class={SECTION}>
	<h2 class="mb-4 font-bold text-gray-200">קישורים</h2>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each LINK_FIELDS as [k, lbl, ph] (k)}
			<div>
				<label class={LABEL} for="f-{k}">{lbl}</label>
				<input id="f-{k}" name={k} dir="ltr" placeholder={ph} value={linkValue(k)} class={INPUT} />
				{#if err(k)}<p class="mt-1 text-xs text-red-400">{err(k)}</p>{/if}
			</div>
		{/each}
	</div>
</section>
